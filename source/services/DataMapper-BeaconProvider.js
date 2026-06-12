/**
 * DataMapper Beacon Provider
 *
 * Registers retold-data-mapper capabilities with an Ultravisor beacon
 * service. When the beacon connects to an Ultravisor, these capabilities
 * auto-register as task types in the flow editor palette.
 *
 * Capabilities:
 *   DataMapperSource:IntrospectSource     — introspect a beacon connection
 *   DataMapperRecords:PullRecords         — read all records from a beacon entity
 *   DataMapperTransform:MapRecords          — apply MappingConfiguration to a batch of records
 *   DataMapperTransform:ExtractRecords      — Phase 2b Extraction: filter + project a batch
 *   DataMapperTransform:UnnestRecords       — Explode an array-of-objects column into one record per element (1→N)
 *   DataMapperTransform:AggregateRecords    — Phase 2b Aggregation: Sum/Count/Mean/Min/Max grouped by keys
 *   DataMapperTransform:HistogramRecords    — Phase 2b Histogram: bucket + aggregate per bucket
 *   DataMapperTransform:IntersectRecords    — Phase 2b Intersection: in-memory join Source × Related, OrderBy + Limit
 *   DataMapperTransform:BuildComprehension — accumulate records into a comprehension
 *   DataMapperRecords:WriteRecords        — write records to a target beacon entity
 *
 * @author Steven Velozo <steven@velozo.com>
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFableUltravisorClient = require('fable-ultravisor-client');

// meadow-integration's IntegrationAdapter handles upsert + batching + retry
// + audit-column stripping when pushing a comprehension. Loaded eagerly so
// WriteRecords doesn't pay the require cost mid-dispatch.
const libMeadowIntegrationAdapter = require('meadow-integration/source/Meadow-Service-Integration-Adapter.js');
const libMeadowCloneRestClient    = require('meadow-integration/source/services/clone/Meadow-Service-RestClient.js');
const libMeadowGUIDMap            = require('meadow-integration/source/Meadow-Service-Integration-GUIDMap.js');

// Node crypto for the raw-archive RecordMD5 (WriteRecordsRaw clone-to-lake).
const libCrypto                   = require('crypto');

// In-memory row-count guard. The four typed transforms hold their
// input set fully in memory (the architecture supports swapping in a
// SQL-pushdown compute later, but for now: bounded). Configurable via
// DATA_MAPPER_MAX_INMEMORY_ROWS env var. Default chosen to give 2.5×
// headroom over the 100K stress-test target — beyond that the JS V8
// heap, the JSON.parse cost on the State edge, and the meadow upsert
// chunk loop all start to misbehave.
const MAX_INMEMORY_ROWS = parseInt(process.env.DATA_MAPPER_MAX_INMEMORY_ROWS, 10) || 250000;

function _checkRowCount(pAction, pCount)
{
	if (pCount > MAX_INMEMORY_ROWS)
	{
		return new Error(
			`${pAction}: input row count ${pCount} exceeds DATA_MAPPER_MAX_INMEMORY_ROWS=${MAX_INMEMORY_ROWS}. ` +
			`The current in-memory transform path can't safely process this volume. ` +
			`Either raise the env var (and accept higher memory pressure) or compose smaller input sets via Extraction/Filter upstream.`);
	}
	return null;
}

/**
 * Resolve a dotted path against an object (UnnestRecords ArrayPath / template lookup).
 * @param {object} pRoot
 * @param {string} pPath - e.g. 'FormData.MoistureTable' or 'Element.MoistureOvenHotPlate'
 * @return {*} value at the path, or undefined when any hop is missing
 */
function _unnestGetByPath(pRoot, pPath)
{
	if (!pRoot || !pPath)
	{
		return undefined;
	}
	let tmpCursor = pRoot;
	let tmpSegments = String(pPath).split('.');
	for (let i = 0; i < tmpSegments.length; i++)
	{
		if (tmpCursor === null || typeof (tmpCursor) !== 'object')
		{
			return undefined;
		}
		tmpCursor = tmpCursor[tmpSegments[i]];
	}
	return tmpCursor;
}

/**
 * Lightweight {~D:Record.<dotted.path>~} resolver for the no-Pict fallback path.
 * A template that is exactly one token returns the native value; a multi-token
 * template returns a string. Non-string templates pass through unchanged.
 * @param {string} pTemplate
 * @param {object} pRoot
 * @return {*}
 */
function _unnestResolveTemplate(pTemplate, pRoot)
{
	if (typeof (pTemplate) !== 'string')
	{
		return pTemplate;
	}
	let tmpWhole = pTemplate.match(/^\{~D:Record\.([^~]+)~\}$/);
	if (tmpWhole)
	{
		return _unnestGetByPath(pRoot, tmpWhole[1]);
	}
	return pTemplate.replace(/\{~D:Record\.([^~]+)~\}/g, function (pMatch, pPath)
	{
		let tmpValue = _unnestGetByPath(pRoot, pPath);
		return (tmpValue === undefined || tmpValue === null) ? '' : String(tmpValue);
	});
}

/**
 * Apply solver expressions to a projected row. Mirrors TabularTransform's
 * comprehension-path solver loop (ExpressionParser.solve with a source scope
 * and a separate destination): expressions read the SOURCE scope (e.g.
 * Record.Field) and assignments land on the projected row. No-op when the
 * ExpressionParser is unavailable (the no-Pict lightweight fallback, which
 * has never supported the solver grammar).
 *
 * @param {object} pFable
 * @param {string[]} pSolvers - assignment expressions, e.g. 'X = TONUMBER(Record.A, 0)'
 * @param {object} pSourceScope - the data the expressions read (e.g. { Record: row })
 * @param {object} pProjectedRow - assignment destination (mutated)
 */
function _applySolvers(pFable, pSolvers, pSourceScope, pProjectedRow)
{
	if (!Array.isArray(pSolvers) || pSolvers.length === 0)
	{
		return;
	}
	if (!pFable.ExpressionParser && pFable.serviceManager)
	{
		pFable.serviceManager.instantiateServiceProviderIfNotExists('Math');
		pFable.serviceManager.instantiateServiceProviderIfNotExists('ExpressionParser');
	}
	if (!pFable.ExpressionParser)
	{
		return;
	}
	let tmpSolverResults = {};
	for (let i = 0; i < pSolvers.length; i++)
	{
		pFable.ExpressionParser.solve(pSolvers[i], pSourceScope, tmpSolverResults, pFable.manifest, pProjectedRow);
	}
}

/**
 * UnnestRecords handler logic — explode an array-of-objects column into one
 * record per element (1→N). Module-level + dependency-injected so it is
 * unit-testable without standing up the full beacon. Each emitted row is built
 * from a synthetic per-element record { ...ParentRow, ElementIndex, Element },
 * resolving ParentCarry against Record.* and ElementProjection against the
 * Element (rewritten to Record.Element.* so the existing template grammar
 * applies). A JSON-string ArrayPath column is parsed inline.
 *
 * @param {object} pWorkItem - { Settings: { Records, OperationConfiguration } }
 * @param {Function} fHandlerCallback - (error, { Outputs, Log })
 * @param {object} pFable - Fable instance (log + serviceManager + parseTemplate)
 * @param {Function} [pTabularTransformLib] - meadow-integration TabularTransform (Pict path)
 * @param {Function} pCheckRowCount - the in-memory row-count guard
 */
function _unnestRecordsHandler(pWorkItem, fHandlerCallback, pFable, pTabularTransformLib, pCheckRowCount)
{
	let tmpStartMs = Date.now();
	let tmpSettings = pWorkItem.Settings || {};
	let tmpRecords = tmpSettings.Records || [];
	let tmpCfg = tmpSettings.OperationConfiguration || {};
	if (typeof (tmpRecords) === 'string') { try { tmpRecords = JSON.parse(tmpRecords); } catch (e) { pFable.log.error(`UnnestRecords: Records parse error: ${e.message}`); tmpRecords = []; } }
	if (typeof (tmpCfg)     === 'string') { try { tmpCfg     = JSON.parse(tmpCfg);     } catch (e) { pFable.log.error(`UnnestRecords: OperationConfiguration parse error: ${e.message}`); tmpCfg = {}; } }

	if (Array.isArray(tmpRecords))
	{
		let tmpGuard = pCheckRowCount('UnnestRecords', tmpRecords.length);
		if (tmpGuard) { return fHandlerCallback(tmpGuard); }
	}

	let tmpEntity = tmpCfg.Entity || 'Record';
	let tmpGUIDName = tmpCfg.GUIDName || ('GUID' + tmpEntity);
	let tmpGUIDTemplate = tmpCfg.GUIDTemplate || '';
	let tmpArrayPath = tmpCfg.ArrayPath || '';
	let tmpElementProjection = (tmpCfg.ElementProjection && typeof (tmpCfg.ElementProjection) === 'object') ? tmpCfg.ElementProjection : {};
	let tmpParentCarry = (tmpCfg.ParentCarry && typeof (tmpCfg.ParentCarry) === 'object') ? tmpCfg.ParentCarry : {};
	let tmpFilter = tmpCfg.Filter || null;
	let tmpSolvers = Array.isArray(tmpCfg.Solvers) ? tmpCfg.Solvers : [];

	if (!Array.isArray(tmpRecords))
	{
		return fHandlerCallback(null, {
			Outputs: { Result: '[]', RecordCount: 0, ElementCount: 0, FilteredOutCount: 0, SkippedNoArray: 0, Errors: [] },
			Log: [`UnnestRecords: input Records was not an array (got ${typeof (tmpRecords)}).`]
		});
	}
	if (!tmpArrayPath)
	{
		return fHandlerCallback(new Error('UnnestRecords: OperationConfiguration.ArrayPath is required (dotted path to the array-of-objects column).'));
	}

	// Merge ParentCarry (Record.* scope, as-is) with ElementProjection
	// (Element.* scope, rewritten to Record.Element.* so the existing
	// {~D:Record.X~} grammar resolves against the synthetic per-element row).
	let tmpMappings = {};
	let tmpCarryKeys = Object.keys(tmpParentCarry);
	for (let c = 0; c < tmpCarryKeys.length; c++)
	{
		tmpMappings[tmpCarryKeys[c]] = tmpParentCarry[tmpCarryKeys[c]];
	}
	let tmpProjKeys = Object.keys(tmpElementProjection);
	for (let p = 0; p < tmpProjKeys.length; p++)
	{
		let tmpVal = tmpElementProjection[tmpProjKeys[p]];
		tmpMappings[tmpProjKeys[p]] = (typeof (tmpVal) === 'string') ? tmpVal.replace(/\{~(D|JSON):Element\./g, '{~$1:Record.Element.') : tmpVal;
	}

	let tmpMappingConfig = { Entity: tmpEntity, GUIDName: tmpGUIDName, GUIDTemplate: tmpGUIDTemplate, Mappings: tmpMappings, Solvers: tmpSolvers };

	let tmpTransform = null;
	if (pTabularTransformLib && typeof (pFable.parseTemplate) === 'function')
	{
		pFable.serviceManager.addServiceTypeIfNotExists('TabularTransform', pTabularTransformLib);
		tmpTransform = pFable.serviceManager.instantiateServiceProviderIfNotExists('TabularTransform');
	}

	let tmpEmitted = [];
	let tmpFilteredOut = 0;
	let tmpSkippedNoArray = 0;
	let tmpErrors = [];
	let tmpFilterKeys = (tmpFilter && typeof (tmpFilter) === 'object') ? Object.keys(tmpFilter) : [];

	for (let i = 0; i < tmpRecords.length; i++)
	{
		let tmpParent = tmpRecords[i];
		let tmpArray = _unnestGetByPath(tmpParent, tmpArrayPath);
		if (typeof (tmpArray) === 'string') { try { tmpArray = JSON.parse(tmpArray); } catch (e) { tmpArray = null; } }
		if (!Array.isArray(tmpArray))
		{
			tmpSkippedNoArray++;
			continue;
		}

		for (let e = 0; e < tmpArray.length; e++)
		{
			let tmpElement = tmpArray[e];

			let tmpKeep = true;
			for (let f = 0; f < tmpFilterKeys.length; f++)
			{
				let tmpKey = tmpFilterKeys[f];
				let tmpExpected = tmpFilter[tmpKey];
				let tmpActual = (tmpElement && typeof (tmpElement) === 'object') ? tmpElement[tmpKey] : undefined;
				if (tmpActual !== tmpExpected && String(tmpActual) !== String(tmpExpected)) { tmpKeep = false; break; }
			}
			if (!tmpKeep) { tmpFilteredOut++; continue; }

			let tmpSynthetic = Object.assign({}, tmpParent, { ElementIndex: e, Element: tmpElement });
			try
			{
				let tmpRow;
				if (tmpTransform && typeof (tmpTransform.createRecordFromMapping) === 'function')
				{
					tmpRow = tmpTransform.createRecordFromMapping(tmpSynthetic, tmpMappingConfig, {});
				}
				else
				{
					tmpRow = {};
					let tmpMapKeys = Object.keys(tmpMappings);
					for (let m = 0; m < tmpMapKeys.length; m++)
					{
						tmpRow[tmpMapKeys[m]] = _unnestResolveTemplate(tmpMappings[tmpMapKeys[m]], tmpSynthetic);
					}
					if (tmpGUIDTemplate) { tmpRow[tmpGUIDName] = _unnestResolveTemplate(tmpGUIDTemplate, tmpSynthetic); }
				}
				_applySolvers(pFable, tmpSolvers, { Record: tmpSynthetic }, tmpRow);
				tmpEmitted.push(tmpRow);
			}
			catch (pUnnestErr)
			{
				tmpErrors.push({ Index: i, Element: e, Error: pUnnestErr.message });
				if (tmpErrors.length === 1) { pFable.log.error(`UnnestRecords: first error at record ${i} element ${e}: ${pUnnestErr.message}`); }
			}
		}

		// Unnest multiplies rows, so the input guard is not sufficient — check
		// the running output against the same ceiling.
		let tmpOutGuard = pCheckRowCount('UnnestRecords (output)', tmpEmitted.length);
		if (tmpOutGuard) { return fHandlerCallback(tmpOutGuard); }
	}

	let tmpElapsedMs = Date.now() - tmpStartMs;
	return fHandlerCallback(null, {
		Outputs:
		{
			RecordCount:      tmpEmitted.length,
			ElementCount:     tmpEmitted.length,
			FilteredOutCount: tmpFilteredOut,
			SkippedNoArray:   tmpSkippedNoArray,
			Errors:           tmpErrors,
			ElapsedMs:        tmpElapsedMs,
			Result:           JSON.stringify(tmpEmitted)
		},
		Log: [`UnnestRecords: ${tmpRecords.length} record(s) → ${tmpEmitted.length} element row(s) (filtered out ${tmpFilteredOut}, no-array ${tmpSkippedNoArray}, errors ${tmpErrors.length}) in ${tmpElapsedMs}ms.`]
	});
}

/**
 * Build a meadow FilteredTo sort segment from a SortField naming ONE column or a
 * comma-separated list (e.g. a composite PK). Emits one FSF stanza per column so
 * the ORDER BY is a total order — a non-unique leading column makes OFFSET
 * pagination skip/duplicate rows (the ~38% silent loss this guards against). A
 * single-column SortField is byte-identical to the prior 'FSF~<col>~ASC~0', so
 * existing single-key callers are unaffected.
 * @param {string} pSortField - one column name, or 'col1,col2,...'
 * @return {string} e.g. 'FSF~col1~ASC~0~FSF~col2~ASC~0'; '' when pSortField is falsy
 */
function _buildSortFilter(pSortField)
{
	if (!pSortField)
	{
		return '';
	}
	return String(pSortField).split(',')
		.map((pColumn) => (pColumn.trim()))
		.filter((pColumn) => (pColumn.length > 0))
		.map((pColumn) => ('FSF~' + pColumn + '~ASC~0'))
		.join('~');
}

let libTabularTransform = null;
try
{
	libTabularTransform = require('meadow-integration/source/services/tabular/Service-TabularTransform.js');
}
catch (pError)
{
	// Optional — falls back to lightweight mapper
}

class DataMapperBeaconProvider extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'DataMapperBeaconProvider';

		// Ultravisor client for dispatching sub-work-items to other beacons
		// (source/target databeacons). Set via configureClient().
		this._Client = null;
	}

	/**
	 * Configure the Ultravisor client for cross-beacon dispatch.
	 * Must be called before beacon handlers execute.
	 *
	 * The dispatcher client authenticates as a USER (with a session
	 * cookie attached to subsequent POSTs), separate from the beacon-
	 * registration WebSocket the BeaconService maintains. Pass the same
	 * service-account credentials the BeaconService uses so the
	 * resulting session has the same permission level — otherwise
	 * subsequent dispatch calls (and any /mapper/* REST calls that ride
	 * on this client) get "Authentication required." from UV's API
	 * server even though the WebSocket-side beacon is registered fine.
	 *
	 * Default `UserName: 'data-mapper'` with empty password matches the
	 * lab's promiscuous-UV preset (the synth-demo target) where UV
	 * doesn't actually check credentials. Against a UV with a real auth-
	 * beacon, callers MUST pass real creds.
	 *
	 * IMPORTANT: callers MUST serialize on fCallback before issuing any
	 * dispatch. Without it the bootstrap pass below races the async auth
	 * POST and dispatches go out with no session cookie attached — UV
	 * replies 401 "Authentication required." even though both sides have
	 * valid credentials.
	 *
	 * @param {string} pUltravisorURL — e.g. "http://localhost:18422"
	 * @param {string} [pUserName='data-mapper']
	 * @param {string} [pPassword='']
	 * @param {function} [fCallback] — function(pError) — fires after auth completes
	 */
	configureClient(pUltravisorURL, pUserName, pPassword, fCallback)
	{
		let tmpUserName = (pUserName === undefined || pUserName === null || pUserName === '') ? 'data-mapper' : pUserName;
		let tmpPassword = (pPassword === undefined || pPassword === null) ? '' : pPassword;
		let fDone = (typeof fCallback === 'function') ? fCallback : function () {};
		this.fable.serviceManager.addServiceTypeIfNotExists('UltravisorClient', libFableUltravisorClient);
		this._Client = this.fable.serviceManager.instantiateServiceProvider('UltravisorClient',
			{
				UltravisorURL: pUltravisorURL,
				UserName: tmpUserName,
				Password: tmpPassword
			});

		// A transient rejection here (UV mid-boot, the auth-beacon inside its
		// reconnect backoff during a stack restart) previously left the
		// dispatcher permanently sessionless — every later self-dispatch
		// returned "Authentication required." until a manual restart. Retry
		// with doubled backoff so stack restarts self-heal.
		let tmpMaxAttempts = parseInt(process.env.DATA_MAPPER_CLIENT_AUTH_RETRIES, 10) || 5;
		let tmpBackoffMs = parseInt(process.env.DATA_MAPPER_CLIENT_AUTH_BACKOFF_MS, 10) || 2000;
		let tmpAttempt = 0;

		let fAttemptAuth = () =>
		{
			tmpAttempt++;
			this._Client.authenticate((pError) =>
			{
				if (pError)
				{
					if (tmpAttempt < tmpMaxAttempts)
					{
						let tmpDelayMs = tmpBackoffMs;
						tmpBackoffMs = tmpBackoffMs * 2;
						this.log.warn(`DataMapperBeaconProvider: client auth attempt ${tmpAttempt}/${tmpMaxAttempts} failed for [${tmpUserName}] (${pError.message}); retrying in ${tmpDelayMs}ms.`);
						return setTimeout(fAttemptAuth, tmpDelayMs);
					}
					this.log.error(`DataMapperBeaconProvider: client auth failed for [${tmpUserName}] — ${pError.message}`);
					return fDone(pError);
				}
				let tmpCookie = (typeof this._Client.getSessionCookie === 'function') ? this._Client.getSessionCookie() : null;
				if (!tmpCookie)
				{
					// Auth succeeded but UV sent no Set-Cookie header — every
					// subsequent dispatch will 401 since the request can't
					// carry a session.
					this.log.warn(`DataMapperBeaconProvider: client authenticated as [${tmpUserName}] against ${pUltravisorURL} but UV returned no session cookie — dispatches will 401.`);
				}
				else
				{
					this.log.info(`DataMapperBeaconProvider: client authenticated as [${tmpUserName}] against ${pUltravisorURL} (session cookie set).`);
				}
				return fDone(null);
			});
		};
		fAttemptAuth();
	}

	/**
	 * Dispatch a work item to another beacon via the Ultravisor.
	 *
	 * A session can go stale under us (UV restart mints new session state) —
	 * on "Authentication required." re-authenticate once and retry, so the
	 * streaming ops self-heal instead of silently reporting Pulled:0 until a
	 * mapper restart.
	 */
	_dispatch(pWorkItem, fCallback, pIsRetry)
	{
		if (!this._Client)
		{
			return fCallback(new Error('DataMapperBeaconProvider: UltravisorClient not configured. Call configureClient() first.'));
		}
		this._Client.dispatch(pWorkItem, (pError, pResult) =>
		{
			if (pError && !pIsRetry && /authentication required/i.test(pError.message || ''))
			{
				this.log.warn('DataMapperBeaconProvider: dispatch rejected with "Authentication required." — re-authenticating and retrying once.');
				return this._Client.authenticate((pAuthError) =>
				{
					if (pAuthError)
					{
						this.log.error(`DataMapperBeaconProvider: re-authentication failed (${pAuthError.message}); surfacing the original dispatch failure.`);
						return fCallback(pError);
					}
					return this._dispatch(pWorkItem, fCallback, true);
				});
			}
			return fCallback(pError, pResult);
		});
	}

	/**
	 * Register all DataMapper capabilities on a beacon service.
	 *
	 * @param {object} pBeaconService — ultravisor-beacon instance
	 */
	registerCapabilities(pBeaconService)
	{
		if (!pBeaconService)
		{
			this.log.error('DataMapperBeaconProvider: beacon service is required.');
			return;
		}

		let tmpFable = this.fable;
		let tmpSelf = this;

		// ── Capability: DataMapperSource ─────────────────────────

		pBeaconService.registerCapability(
			{
				Capability: 'DataMapperSource',
				Name: 'DataMapperSourceProvider',
				actions:
				{
					'IntrospectSource':
					{
						Description: 'Introspect a DataBeacon connection to discover tables and columns',
						SettingsSchema:
						[
							{ Name: 'SourceBeaconName', DataType: 'String', Required: true, Description: 'Beacon name of the data source' },
							{ Name: 'IDBeaconConnection', DataType: 'Number', Required: true, Description: 'Connection ID on the source beacon' }
						],
						Handler: function (pWorkItem, pContext, fHandlerCallback)
						{
							let tmpSettings = pWorkItem.Settings || {};
							let tmpBeaconName = tmpSettings.SourceBeaconName;
							let tmpConnID = tmpSettings.IDBeaconConnection;

							if (!tmpBeaconName)
							{
								return fHandlerCallback(null, {
									Outputs: { Schema: {}, TableCount: 0 },
									Log: ['IntrospectSource: SourceBeaconName is required.']
								});
							}

							if (!tmpSelf._Client)
							{
								return fHandlerCallback(null, {
									Outputs: { Schema: {}, TableCount: 0 },
									Log: ['IntrospectSource: UltravisorClient not configured. Call configureClient().']
								});
							}

							tmpSelf._dispatch(
								{
									Capability: 'DataBeaconManagement',
									Action: 'Introspect',
									Settings: { IDBeaconConnection: tmpConnID },
									AffinityKey: tmpBeaconName,
									RequireAffinityMatch: true,
									TimeoutMs: 30000
								},
								(pError, pResult) =>
								{
									if (pError)
									{
										return fHandlerCallback(null, {
											Outputs: { Schema: {}, TableCount: 0 },
											Log: [`IntrospectSource: ${pError.message}`]
										});
									}

									let tmpOutputs = (pResult && pResult.Outputs) || pResult || {};
									let tmpSchema = { Tables: tmpOutputs.Tables || [] };

									return fHandlerCallback(null, {
										Outputs:
										{
											Schema: tmpSchema,
											TableCount: tmpSchema.Tables.length,
											ConnectionHash: tmpOutputs.ConnectionHash || tmpBeaconName
										},
										Log: [`IntrospectSource: found ${tmpSchema.Tables.length} tables on beacon [${tmpBeaconName}].`]
									});
								});
						}
					}
				}
			});

		// ── Capability: DataMapperManagement ─────────────────────
		// Mesh-dispatchable definition management, so callers (e.g. the
		// platform projection service) never need this service's REST
		// surface: register-or-update an OperationConfig and receive the
		// compiled UV operation hash to trigger runs with.

		pBeaconService.registerCapability(
			{
				Capability: 'DataMapperManagement',
				Name: 'DataMapperManagementProvider',
				actions:
				{
					'RegisterOperation':
					{
						Description: 'Create-or-update an OperationConfig, compile it, and register the UV operation graph. Returns the CompiledOperationHash for UV-only triggering.',
						SettingsSchema:
						[
							{ Name: 'OperationConfig', DataType: 'Object', Required: true, Description: 'The OperationConfig fields (Hash + OperationType required; OperationConfiguration is the per-type block)' },
							{ Name: 'SkipValidation', DataType: 'Boolean', Required: false, Description: 'Skip per-type configuration + target validation' }
						],
						Handler: function (pWorkItem, pContext, fHandlerCallback)
						{
							let tmpSettings = pWorkItem.Settings || {};
							let tmpConfig = tmpSettings.OperationConfig;
							if (typeof tmpConfig === 'string')
							{
								try { tmpConfig = JSON.parse(tmpConfig); }
								catch (pParseError) { return fHandlerCallback(new Error('RegisterOperation: OperationConfig is not valid JSON.')); }
							}
							if (!tmpConfig || typeof tmpConfig !== 'object')
							{
								return fHandlerCallback(new Error('RegisterOperation requires Settings.OperationConfig (object).'));
							}
							let tmpBridge = tmpSelf.fable.DataMapperConnectionBridge;
							if (!tmpBridge)
							{
								return fHandlerCallback(new Error('RegisterOperation: ConnectionBridge service not available.'));
							}
							tmpBridge.registerOperationConfig(tmpConfig, { SkipValidation: !!tmpSettings.SkipValidation },
								(pError, pResult) =>
								{
									if (pError) return fHandlerCallback(pError);
									let tmpOperation = pResult.Operation || {};
									return fHandlerCallback(null,
									{
										Outputs:
										{
											Success: true,
											IDOperationConfig: tmpOperation.IDOperationConfig,
											Hash: tmpOperation.Hash,
											Scope: tmpOperation.Scope,
											CompiledOperationHash: pResult.CompiledOperationHash,
											ValidationWarning: pResult.ValidationWarning,
											UVRegistration: pResult.UVRegistration
										},
										Log: [`RegisterOperation: [${tmpOperation.Hash}] stored as #${tmpOperation.IDOperationConfig}; compiled graph [${pResult.CompiledOperationHash || '(pending)'}].`]
									});
								});
						}
					}
				}
			});

		// ── Capability: DataMapperRecords ────────────────────────

		pBeaconService.registerCapability(
			{
				Capability: 'DataMapperRecords',
				Name: 'DataMapperRecordsProvider',
				actions:
				{
					'PullRecords':
					{
						Description: 'Read all records from a beacon entity (paginated internally)',
						SettingsSchema:
						[
							{ Name: 'SourceBeaconName', DataType: 'String', Required: true, Description: 'Beacon name of the data source' },
							{ Name: 'ConnectionHash', DataType: 'String', Required: true, Description: 'URL slug of the source connection' },
							{ Name: 'Entity', DataType: 'String', Required: true, Description: 'Entity/table name to read' },
							{ Name: 'BatchSize', DataType: 'Number', Required: false, Description: 'Records per page (default 100)' },
							{ Name: 'FilterExpression', DataType: 'String', Required: false, Description: 'Meadow filter (e.g. FBV~Field~EQ~Value); spliced into URL as /FilteredTo/<expr>' },
							{ Name: 'SortField', DataType: 'String', Required: false, Description: 'Column to ORDER BY for stable pagination. Defaults to "ID<Entity>" — meadow\'s standard auto-identity convention. Postgres without ORDER BY can return the same row on multiple pages once the table outgrows a single seq-scan window, which silently truncates pulled data; explicit sort fixes that.' }
						],
						Handler: function (pWorkItem, pContext, fHandlerCallback, fReportProgress)
						{
							let tmpStartMs = Date.now();
							let tmpSettings = pWorkItem.Settings || {};
							let tmpBeaconName = tmpSettings.SourceBeaconName;
							let tmpConnectionHash = tmpSettings.ConnectionHash;
							let tmpEntity = tmpSettings.Entity;
							let tmpBatchSize = tmpSettings.BatchSize || 500;

							// Stable-pagination guard. Without an explicit sort,
							// postgres LIMIT/OFFSET against a 250K-row table
							// returns rows in unstable seq-scan order — the same
							// PK can appear on multiple pages while others are
							// missed entirely (we measured ~38% silent loss at
							// 250K rows). Force ORDER BY <PK> via meadow's filter
							// FSF directive so paginated reads are deterministic.
							let tmpSortField = tmpSettings.SortField || ('ID' + tmpEntity);
							let tmpSortFilter = _buildSortFilter(tmpSortField);
							let tmpUserFilter = tmpSettings.FilterExpression || '';
							let tmpCombinedFilter = tmpUserFilter
								? tmpUserFilter + '~' + tmpSortFilter
								: tmpSortFilter;
							let tmpFilterSegment = '/FilteredTo/' + tmpCombinedFilter;

							if (!tmpSelf._Client || !tmpBeaconName || !tmpConnectionHash || !tmpEntity)
							{
								return fHandlerCallback(null, {
									Outputs: { Records: [], RecordCount: 0, ElapsedMs: 0 },
									Log: ['PullRecords: missing required settings.']
								});
							}

							// Paginated read.
							//
							// fReportProgress (4th handler arg from ultravisor-beacon's
							// CapabilityAdapter) sends a progress event back to UV which
							// updates the work item's LastEventAt — without these calls
							// UV's BeaconScheduler stall-detector flips us to Status=Stalled
							// after HeartbeatExpectedMs * 2 = 120s by default. At 250K
							// rows/500-per-batch the loop runs ~3 minutes and would always
							// trip that threshold even though batches are landing every
							// ~350ms. We report after every batch — cheap noop when
							// fReportProgress isn't supplied (e.g. older beacon clients).
							let tmpAllRecords = [];
							let tmpOffset = 0;
							// Source beacons that don't implement meadow's
							// /FilteredTo URL pattern (e.g. retold-synth-databeacon
							// — its records are deterministic by construction so
							// it doesn't need ORDER BY anyway) return 404 on the
							// FSF-injected path. On the FIRST 404 we drop the
							// filter segment for the rest of the pull and keep
							// going. Subsequent batches use the plain URL pattern.
							let tmpUseSortFilter = !!tmpSortField;
							let tmpBatchRetries = 0;

							let fReadBatch = () =>
							{
								let tmpEffectiveFilter = tmpUseSortFilter ? tmpFilterSegment : (tmpUserFilter ? '/FilteredTo/' + tmpUserFilter : '');
								let tmpPath = `/1.0/${tmpConnectionHash}/${tmpEntity}s${tmpEffectiveFilter}/${tmpOffset}/${tmpBatchSize}`;

								// Dispatch through the UV mesh; AffinityKey now routes
								// by beacon Name (UV Coordinator + Scheduler resolve
								// AffinityKey against findBeaconByName), so the work
								// item reliably lands on the source beacon.
								tmpSelf._dispatch(
									{
										Capability: 'MeadowProxy',
										Action: 'Request',
										Settings: { Method: 'GET', Path: tmpPath, Body: '', RemoteUser: '' },
										AffinityKey: tmpBeaconName,
										RequireAffinityMatch: true,
										TimeoutMs: 30000
									},
									(pError, pResult) =>
									{
										if (pError)
										{
											return fHandlerCallback(null, {
												Outputs: { Records: tmpAllRecords, RecordCount: tmpAllRecords.length, ElapsedMs: Date.now() - tmpStartMs },
												Log: [`PullRecords: read error at offset ${tmpOffset}: ${pError.message}`]
											});
										}

										let tmpOutputs = (pResult && pResult.Outputs) || pResult || {};
										let tmpStatus = tmpOutputs.Status;
										// First-batch fallback: if the source 404s on
										// our sort-injected /FilteredTo URL (e.g. synth),
										// disable the sort filter and re-fetch the
										// same offset with a plain URL.
										if (tmpUseSortFilter && tmpStatus === 404 && tmpAllRecords.length === 0 && tmpOffset === 0)
										{
											tmpUseSortFilter = false;
											return fReadBatch();
										}
										// retry, or propagate error, on pull failure
										if (typeof (tmpStatus) === 'number' && tmpStatus >= 500)
										{
											if (tmpBatchRetries < 2)
											{
												tmpBatchRetries++;
												tmpFable.log.warn(`PullRecords: HTTP ${tmpStatus} at offset ${tmpOffset} — retry ${tmpBatchRetries}/2 in ${tmpBatchRetries}s.`);
												return setTimeout(fReadBatch, tmpBatchRetries * 1000);
											}
											return fHandlerCallback(null, {
												Outputs: { Records: [], Pulled: tmpAllRecords.length, Errors: 1,
													ErrorLog: [ { Offset: tmpOffset, Status: tmpStatus, Attempts: tmpBatchRetries + 1, Error: `source read failed: HTTP ${tmpStatus} at offset ${tmpOffset} after ${tmpBatchRetries + 1} attempts`, Body: String(tmpOutputs.Body || '').slice(0, 300) } ] },
												Log: [`PullRecords: source returned HTTP ${tmpStatus} at offset ${tmpOffset} after ${tmpBatchRetries + 1} attempts — failing the pull (check SortField/route).`]
											});
										}
										tmpBatchRetries = 0;
										let tmpBody = tmpOutputs.Body;
										if (typeof (tmpBody) === 'string')
										{
											try { tmpBody = JSON.parse(tmpBody); } catch (e) { tmpBody = []; }
										}
										let tmpRecords = Array.isArray(tmpBody) ? tmpBody : [];

										for (let i = 0; i < tmpRecords.length; i++)
										{
											tmpAllRecords.push(tmpRecords[i]);
										}

										// Heartbeat: tell UV we're alive + how far along.
										// Older beacon clients may not pass fReportProgress;
										// guard before calling so we don't crash the pull.
										if (typeof fReportProgress === 'function')
										{
											try { fReportProgress({ Phase: 'pulling', RecordsRead: tmpAllRecords.length, ElapsedMs: Date.now() - tmpStartMs }); }
											catch (pProgErr) { /* progress is best-effort */ }
										}

										if (tmpRecords.length < tmpBatchSize)
										{
											let tmpElapsedMs = Date.now() - tmpStartMs;
											// Important: only emit Result (the
											// stringified records) over the wire,
											// not Records itself. UV's State edge
											// reads `Outputs.Result` (the port is
											// `p-so-Result`); the downstream
											// transform action JSON.parses it back
											// into an array. Sending Records
											// alongside Result *doubles* the WS
											// payload — at 100K rows that's enough
											// to breach the WS keep-alive budget
											// and triggers `Failed to report
											// completion: socket hang up` on the
											// beacon side.
											return fHandlerCallback(null, {
												Outputs: { RecordCount: tmpAllRecords.length, ElapsedMs: tmpElapsedMs, Result: JSON.stringify(tmpAllRecords) },
												Log: [`PullRecords: read ${tmpAllRecords.length} records from ${tmpEntity} on beacon [${tmpBeaconName}] in ${tmpElapsedMs}ms.`]
											});
										}

										tmpOffset += tmpRecords.length;
										fReadBatch();
									});
							};

							fReadBatch();
						}
					},

					'CloneStream':
					{
						Description: 'Streaming pull-batch → write-batch clone. Fundamentally different layout from PullRecords→ExtractRecords→BuildComprehension→WriteRecords: this single work item loops the read+write pair so working memory stays at one batch instead of the full source. Use for clones where the output is a 1:1 mirror with no cross-record logic; the destination\'s GUID upsert key handles dedup naturally and the State edge never carries a giant array.',
						SettingsSchema:
						[
							{ Name: 'SourceBeaconName',     DataType: 'String', Required: true, Description: 'Beacon name of the data source' },
							{ Name: 'SourceConnectionHash', DataType: 'String', Required: true, Description: 'URL slug of the source connection' },
							{ Name: 'SourceEntity',         DataType: 'String', Required: true, Description: 'Source entity/table name (singular; meadow appends "s" for the plural endpoint)' },
							{ Name: 'TargetBeaconName',     DataType: 'String', Required: true, Description: 'Beacon name of the write target' },
							{ Name: 'TargetConnectionHash', DataType: 'String', Required: true, Description: 'URL slug of the target connection' },
							{ Name: 'TargetEntity',         DataType: 'String', Required: true, Description: 'Target entity/table name. Bulk-upsert URL will be /1.0/<TargetConnectionHash>/<TargetEntity>/Upserts.' },
							{ Name: 'GUIDName',             DataType: 'String', Required: true, Description: 'Destination GUID column (e.g. GUIDCustomerMirror). Each chunk-record\'s value for this column is set from OperationConfiguration.GUIDTemplate before upsert; meadow uses it as the upsert key.' },
							{ Name: 'OperationConfiguration', DataType: 'Object', Required: true, Description: '{ GUIDTemplate, Projection? }. GUIDTemplate is the destination GUID format-string ({~D:Record.IDCustomer~} tokens are substituted per source record). Projection is optional — if absent the source record passes through as-is. Bundled here so UV\'s settings resolver doesn\'t template-strip the placeholders before the handler runs.' },
							{ Name: 'BatchSize',            DataType: 'Number', Required: false, Description: 'Records per pull/upsert batch (default 500). The pull-write pair fires once per batch.' },
							{ Name: 'SortField',            DataType: 'String', Required: false, Description: 'Source sort column for stable pagination. Defaults to "ID<SourceEntity>". Pass empty string to disable (e.g. for synth-databeacon, which doesn\'t implement /FilteredTo).' },
							{ Name: 'FilterExpression',     DataType: 'String', Required: false, Description: 'Meadow filter to apply on the source pull (e.g. FBV~Status~EQ~Active).' },
							{ Name: 'WriteConcurrency',     DataType: 'Number', Required: false, Description: 'In-flight bulk Upsert chunks (clamped 1..5). Default 1 — one batch in-flight at a time keeps the streaming guarantee. Bumping to N means up to N batches resident in memory simultaneously.' }
						],
						Handler: function (pWorkItem, pContext, fHandlerCallback, fReportProgress)
						{
							let tmpStartMs = Date.now();
							let tmpSettings = pWorkItem.Settings || {};
							let tmpSourceBeacon = tmpSettings.SourceBeaconName;
							let tmpSourceConn   = tmpSettings.SourceConnectionHash;
							let tmpSourceEntity = tmpSettings.SourceEntity;
							let tmpTargetBeacon = tmpSettings.TargetBeaconName;
							let tmpTargetConn   = tmpSettings.TargetConnectionHash;
							let tmpTargetEntity = tmpSettings.TargetEntity;
							let tmpGUIDName     = tmpSettings.GUIDName;
							let tmpBatchSize    = tmpSettings.BatchSize || 500;

							let tmpOpCfg = tmpSettings.OperationConfiguration || {};
							if (typeof tmpOpCfg === 'string')
							{
								try { tmpOpCfg = JSON.parse(tmpOpCfg); } catch (e) { tmpOpCfg = {}; }
							}
							let tmpProjection = (tmpOpCfg && tmpOpCfg.Projection) || null;
							let tmpProjKeys   = tmpProjection ? Object.keys(tmpProjection) : null;
							// GUIDTemplate lives inside OperationConfiguration (Object-
							// typed) so UV's settings resolver doesn't template-strip
							// the {~D:Record.X~} placeholders. Top-level GUIDTemplate
							// is accepted as a fallback for any caller that hasn't
							// migrated to the bundled shape.
							let tmpGUIDTemplate = (tmpOpCfg && tmpOpCfg.GUIDTemplate) || tmpSettings.GUIDTemplate || '';

							// Sort filter for stable pagination (postgres LIMIT/OFFSET
							// without ORDER BY returns the same row on multiple pages
							// once the table outgrows seq-scan window). Default to
							// the source's PK convention; explicit empty disables for
							// sources that don't implement /FilteredTo (synth).
							let tmpSortField = (tmpSettings.SortField !== undefined) ? tmpSettings.SortField : ('ID' + tmpSourceEntity);
							let tmpUserFilter = tmpSettings.FilterExpression || '';
							let tmpUseSortFilter = !!tmpSortField;
							let tmpSortFilter = tmpUseSortFilter ? _buildSortFilter(tmpSortField) : '';
							let tmpFullFilter = tmpUseSortFilter
								? (tmpUserFilter ? tmpUserFilter + '~' + tmpSortFilter : tmpSortFilter)
								: tmpUserFilter;

							if (!tmpSelf._Client || !tmpSourceBeacon || !tmpSourceConn || !tmpSourceEntity
								|| !tmpTargetBeacon || !tmpTargetConn || !tmpTargetEntity)
							{
								return fHandlerCallback(null, {
									Outputs: { Pulled: 0, Written: 0, Errors: 0, ElapsedMs: 0, ErrorLog: [] },
									Log: ['CloneStream: missing required settings.']
								});
							}

							let tmpTotalPulled  = 0;
							let tmpTotalWritten = 0;
							let tmpTotalErrors  = 0;
							let tmpErrorLog     = [];
							let tmpOffset       = 0;

							// ── Per-record projection ────────────────────────
							//
							// The destination GUID is constructed via tmpGUIDTemplate.
							// If a Projection map is supplied, only those columns
							// flow through (with template substitution); otherwise
							// the source record passes through as-is (the destination's
							// schema decides what to keep on the upsert side).
							let fProject = (pSrcRec) =>
							{
								let tmpOut;
								if (tmpProjKeys)
								{
									tmpOut = {};
									for (let k = 0; k < tmpProjKeys.length; k++)
									{
										let tmpExpr = tmpProjection[tmpProjKeys[k]];
										if (typeof tmpExpr === 'string')
										{
											let tmpMatch = tmpExpr.match(/^\{~D:Record\.(\w+)~\}$/);
											if (tmpMatch) { tmpOut[tmpProjKeys[k]] = pSrcRec[tmpMatch[1]]; }
											else if (pSrcRec.hasOwnProperty(tmpExpr)) { tmpOut[tmpProjKeys[k]] = pSrcRec[tmpExpr]; }
											else { tmpOut[tmpProjKeys[k]] = tmpExpr; }
										}
										else { tmpOut[tmpProjKeys[k]] = tmpExpr; }
									}
								}
								else
								{
									tmpOut = Object.assign({}, pSrcRec);
								}
								// Always apply the GUIDTemplate after projection.
								// Substitute {~D:Record.X~} from the SOURCE record so
								// templates like CUSTOMER_{~D:Record.IDCustomer~}
								// resolve even when IDCustomer isn't in the projection.
								if (tmpGUIDTemplate && tmpGUIDName)
								{
									tmpOut[tmpGUIDName] = tmpGUIDTemplate.replace(
										/\{~D:Record\.(\w+)~\}/g,
										(_m, pField) => (pSrcRec[pField] === undefined || pSrcRec[pField] === null) ? '' : String(pSrcRec[pField]));
								}
								return tmpOut;
							};

							// ── Loop ─────────────────────────────────────────
							let fNextBatch = () =>
							{
								let tmpEffectiveFilter = tmpUseSortFilter
									? (tmpFullFilter ? '/FilteredTo/' + tmpFullFilter : '')
									: (tmpUserFilter ? '/FilteredTo/' + tmpUserFilter : '');
								let tmpReadPath = `/1.0/${tmpSourceConn}/${tmpSourceEntity}s${tmpEffectiveFilter}/${tmpOffset}/${tmpBatchSize}`;
								tmpSelf._dispatch(
									{
										Capability:  'MeadowProxy',
										Action:      'Request',
										Settings:    { Method: 'GET', Path: tmpReadPath, Body: '', RemoteUser: '' },
										AffinityKey: tmpSourceBeacon,
										RequireAffinityMatch: true,
										TimeoutMs:   60000
									},
									(pReadErr, pReadResult) =>
									{
										if (pReadErr)
										{
											return fHandlerCallback(null, {
												Outputs: { Pulled: tmpTotalPulled, Written: tmpTotalWritten, Errors: tmpTotalErrors, ElapsedMs: Date.now() - tmpStartMs, ErrorLog: tmpErrorLog },
												Log: [`CloneStream: read failed at offset ${tmpOffset} — ${pReadErr.message}`]
											});
										}
										let tmpReadOut = (pReadResult && pReadResult.Outputs) || pReadResult || {};
										// First-batch fallback: source 404s on /FilteredTo
										// (synth) → drop the sort filter and retry.
										if (tmpUseSortFilter && tmpReadOut.Status === 404 && tmpTotalPulled === 0 && tmpOffset === 0)
										{
											tmpUseSortFilter = false;
											return fNextBatch();
										}
										let tmpBody = tmpReadOut.Body;
										if (typeof tmpBody === 'string')
										{
											try { tmpBody = JSON.parse(tmpBody); } catch (e) { tmpBody = []; }
										}
										let tmpRecords = Array.isArray(tmpBody) ? tmpBody : [];
										let tmpReadCount = tmpRecords.length;
										if (tmpReadCount === 0)
										{
											return fHandlerCallback(null, {
												Outputs: { Pulled: tmpTotalPulled, Written: tmpTotalWritten, Errors: tmpTotalErrors, ElapsedMs: Date.now() - tmpStartMs, ErrorLog: tmpErrorLog.slice(0, 50) },
												Log: [`CloneStream: ${tmpSourceEntity} → ${tmpTargetEntity} on [${tmpTargetBeacon}] — pulled ${tmpTotalPulled}, wrote ${tmpTotalWritten}, ${tmpTotalErrors} errors in ${Date.now() - tmpStartMs}ms.`]
											});
										}

										// Project this batch in place — the source array
										// is replaced by projected, the source array is
										// dereferenced and GC'able by the time we issue
										// the upsert. Memory ceiling = one batch.
										let tmpProjected = new Array(tmpReadCount);
										for (let i = 0; i < tmpReadCount; i++) tmpProjected[i] = fProject(tmpRecords[i]);
										tmpRecords = null;

										let tmpWritePath = `/1.0/${tmpTargetConn}/${tmpTargetEntity}/Upserts`;
										tmpSelf._dispatch(
											{
												Capability:  'MeadowProxy',
												Action:      'Request',
												Settings:    { Method: 'PUT', Path: tmpWritePath, Body: JSON.stringify(tmpProjected), RemoteUser: '' },
												AffinityKey: tmpTargetBeacon,
												RequireAffinityMatch: true,
												TimeoutMs:   120000
											},
											(pWriteErr, pWriteResult) =>
											{
												let tmpBatchPulled = tmpReadCount;
												tmpProjected = null;
												if (pWriteErr)
												{
													tmpTotalErrors += tmpBatchPulled;
													tmpErrorLog.push({ Offset: tmpOffset, Error: pWriteErr.message || String(pWriteErr) });
												}
												else
												{
													let tmpWriteOut = (pWriteResult && pWriteResult.Outputs) || {};
													let tmpHeaders = tmpWriteOut.Headers || {};
													let tmpHdrSucceeded = parseInt(tmpHeaders['x-meadow-upsert-succeeded'] || tmpHeaders['X-Meadow-Upsert-Succeeded'] || '-1', 10);
													let tmpHdrErrored   = parseInt(tmpHeaders['x-meadow-upsert-errored']   || tmpHeaders['X-Meadow-Upsert-Errored']   || '-1', 10);
													if (tmpHdrSucceeded >= 0 && tmpHdrErrored >= 0)
													{
														tmpTotalWritten += tmpHdrSucceeded;
														tmpTotalErrors  += tmpHdrErrored;
														if (tmpHdrErrored > 0)
														{
															let tmpRespBody = tmpWriteOut.Body;
															if (typeof tmpRespBody === 'string')
															{
																try { tmpRespBody = JSON.parse(tmpRespBody); } catch (e) { /* ignore */ }
															}
															// Preserve up to 25 per-row errors per batch with
															// full { Record, Operation, Error } context — the
															// launcher de-dups by Error text. Truncate Record
															// JSON to ~400 chars so a batch worth of rows stays
															// in a manageable response payload.
															let tmpBatchErrors = [];
															if (tmpRespBody && Array.isArray(tmpRespBody.Errors))
															{
																let tmpSlice = tmpRespBody.Errors.slice(0, 25);
																for (let i = 0; i < tmpSlice.length; i++)
																{
																	let tmpRow = tmpSlice[i] || {};
																	let tmpRecordJSON;
																	try { tmpRecordJSON = JSON.stringify(tmpRow.Record); }
																	catch (eR) { tmpRecordJSON = String(tmpRow.Record); }
																	if (typeof tmpRecordJSON === 'string' && tmpRecordJSON.length > 400)
																	{
																		tmpRecordJSON = tmpRecordJSON.slice(0, 400) + '...';
																	}
																	tmpBatchErrors.push(
																		{
																			Record:    tmpRecordJSON,
																			Operation: tmpRow.Operation || 'Unknown',
																			Error:     tmpRow.Error || tmpRow.Message || ''
																		});
																}
															}
															tmpErrorLog.push({ Offset: tmpOffset, Errored: tmpHdrErrored, Of: tmpBatchPulled, Details: tmpBatchErrors });
														}
													}
													else
													{
														// No headers — fall back to status-only.
														let tmpStatus = tmpWriteOut.Status;
														if (typeof tmpStatus === 'number' && tmpStatus >= 400)
														{
															tmpTotalErrors += tmpBatchPulled;
															tmpErrorLog.push({ Offset: tmpOffset, Error: `HTTP ${tmpStatus}` });
														}
														else
														{
															tmpTotalWritten += tmpBatchPulled;
														}
													}
												}
												tmpTotalPulled += tmpBatchPulled;

												if (typeof fReportProgress === 'function')
												{
													try { fReportProgress({ Phase: 'streaming', Pulled: tmpTotalPulled, Written: tmpTotalWritten, Errors: tmpTotalErrors }); }
													catch (pProgIgn) { /* best-effort */ }
												}

												// Last batch (short read) → done.
												if (tmpBatchPulled < tmpBatchSize)
												{
													return fHandlerCallback(null, {
														Outputs: { Pulled: tmpTotalPulled, Written: tmpTotalWritten, Errors: tmpTotalErrors, ElapsedMs: Date.now() - tmpStartMs, ErrorLog: tmpErrorLog.slice(0, 50) },
														Log: [`CloneStream: ${tmpSourceEntity} → ${tmpTargetEntity} on [${tmpTargetBeacon}] — pulled ${tmpTotalPulled}, wrote ${tmpTotalWritten}, ${tmpTotalErrors} errors in ${Date.now() - tmpStartMs}ms.`]
													});
												}
												tmpOffset += tmpBatchPulled;
												return fNextBatch();
											});
									});
							};

							fNextBatch();
						}
					},

					'JoinStream':
					{
						Description: 'Streaming-layout INNER JOIN: pushes the JOIN into the source DB (DataBeaconAccess.Join) using KEYSET pagination, pages through the result, chunked-writes each page to the target table. Memory ceiling = page size, never the source. Pair with OperationType=SQLJoin. Both source and related must live on the same connection. OrderBy MUST be a UNIQUE source-table column (typically the PK) — keyset pagination duplicates rows otherwise.',
						SettingsSchema:
						[
							{ Name: 'SourceBeaconName',     DataType: 'String', Required: true, Description: 'Beacon name of the source (UV mesh AffinityKey for the join dispatch).' },
							{ Name: 'SourceConnection',     DataType: 'String', Required: true, Description: 'Source connection name (resolved to IDBeaconConnection at run time).' },
							{ Name: 'SourceTable',          DataType: 'String', Required: true, Description: 'Source (left) table.' },
							{ Name: 'RelatedTable',         DataType: 'String', Required: true, Description: 'Related (right) table — must be on the same connection as Source.' },
							{ Name: 'TargetBeaconName',     DataType: 'String', Required: true },
							{ Name: 'TargetConnectionHash', DataType: 'String', Required: true },
							{ Name: 'TargetEntity',         DataType: 'String', Required: true },
							{ Name: 'GUIDName',             DataType: 'String', Required: true, Description: 'Destination GUID column. Set per-row from OperationConfiguration.GUIDTemplate before upsert.' },
							{ Name: 'OperationConfiguration', DataType: 'Object', Required: true, Description: '{ JoinOn:{SourceField,RelatedField}, Projection (Record.X / Related.X only), GUIDTemplate, OrderBy (must be UNIQUE source column), BatchSize? }. Bundled to dodge UV settings-resolver template stripping.' },
							{ Name: 'BatchSize',            DataType: 'Number', Required: false, Description: 'Rows per page on both the source-side keyset LIMIT and the target-side Upserts chunk. Default 500.' }
						],
						Handler: function (pWorkItem, pContext, fHandlerCallback, fReportProgress)
						{
							let tmpStartMs = Date.now();
							let tmpSettings = pWorkItem.Settings || {};
							let tmpSourceBeacon = tmpSettings.SourceBeaconName;
							let tmpSourceConn   = tmpSettings.SourceConnection;
							let tmpSourceTable  = tmpSettings.SourceTable;
							let tmpRelatedTable = tmpSettings.RelatedTable;
							let tmpTargetBeacon = tmpSettings.TargetBeaconName;
							let tmpTargetConn   = tmpSettings.TargetConnectionHash;
							let tmpTargetEntity = tmpSettings.TargetEntity;
							let tmpGUIDName     = tmpSettings.GUIDName;
							let tmpBatchSize    = tmpSettings.BatchSize || 500;

							let tmpOpCfg = tmpSettings.OperationConfiguration || {};
							if (typeof tmpOpCfg === 'string')
							{
								try { tmpOpCfg = JSON.parse(tmpOpCfg); } catch (e) { tmpOpCfg = {}; }
							}
							let tmpJoinOn      = tmpOpCfg.JoinOn || {};
							let tmpProjection  = tmpOpCfg.Projection || {};
							let tmpOrderBy     = tmpOpCfg.OrderBy || '';
							let tmpGUIDTemplate = tmpOpCfg.GUIDTemplate || '';

							if (!tmpSelf._Client || !tmpSourceBeacon || !tmpSourceConn || !tmpSourceTable || !tmpRelatedTable
								|| !tmpTargetBeacon || !tmpTargetConn || !tmpTargetEntity || !tmpGUIDName
								|| !tmpJoinOn.SourceField || !tmpJoinOn.RelatedField
								|| !tmpOrderBy)
							{
								return fHandlerCallback(null, {
									Outputs: { Pulled: 0, Written: 0, Errors: 0, ElapsedMs: 0, ErrorLog: [] },
									Log: ['JoinStream: missing required settings (SourceBeaconName, SourceConnection, SourceTable, RelatedTable, Target*, GUIDName, JoinOn.SourceField, JoinOn.RelatedField, OrderBy).']
								});
							}

							let tmpWritePath = `/1.0/${tmpTargetConn}/${tmpTargetEntity}/Upserts`;
							let tmpTotalPulled  = 0;
							let tmpTotalWritten = 0;
							let tmpTotalErrors  = 0;
							let tmpErrorLog     = [];
							// Keyset cursor: null on the first page (emitter omits WHERE),
							// then the OrderBy column value of the last row of the previous page.
							let tmpAfterValue   = null;
							let tmpAggSourceMs  = 0;
							let tmpConnID       = null;

							// ── Resolve source IDBeaconConnection once ───────
							tmpSelf._dispatch(
								{
									Capability:  'DataBeaconAccess',
									Action:      'ListConnections',
									Settings:    {},
									AffinityKey: tmpSourceBeacon,
									RequireAffinityMatch: true,
									TimeoutMs:   30000
								},
								(pListErr, pListResult) =>
								{
									if (pListErr)
									{
										return fHandlerCallback(null, {
											Outputs: { Pulled: 0, Written: 0, Errors: 0, ElapsedMs: Date.now() - tmpStartMs, ErrorLog: [{ Phase: 'ListConnections', Error: pListErr.message }] },
											Log: [`JoinStream: ListConnections on [${tmpSourceBeacon}] failed — ${pListErr.message}`]
										});
									}
									let tmpListOut = (pListResult && pListResult.Outputs) || pListResult || {};
									let tmpConnections = Array.isArray(tmpListOut.Connections) ? tmpListOut.Connections : [];
									let tmpMatch = null;
									for (let i = 0; i < tmpConnections.length; i++)
									{
										let tmpC = tmpConnections[i];
										let tmpName = tmpC && tmpC.Name;
										if (tmpName === tmpSourceConn) { tmpMatch = tmpC; break; }
										let tmpSanitized = (typeof tmpName === 'string') ? tmpName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '';
										if (tmpSanitized === tmpSourceConn) { tmpMatch = tmpC; break; }
									}
									if (!tmpMatch || !tmpMatch.IDBeaconConnection)
									{
										return fHandlerCallback(null, {
											Outputs: { Pulled: 0, Written: 0, Errors: 0, ElapsedMs: Date.now() - tmpStartMs, ErrorLog: [{ Phase: 'ListConnections', Error: 'no match' }] },
											Log: [`JoinStream: source connection [${tmpSourceConn}] not found on beacon [${tmpSourceBeacon}].`]
										});
									}
									tmpConnID = tmpMatch.IDBeaconConnection;

									// ── Page loop (keyset pagination) ────────
									// Pass AfterValue=null on the first page (emitter omits
									// WHERE) and AfterValue=<last cursor> on subsequent pages.
									// CursorField is the row-key the emitter chose for the
									// cursor column; we read it from the last row of each
									// page and (when it's the synthetic sentinel) strip it
									// before writing.
									let fNextPage = () =>
									{
										let tmpJoinSpec =
											{
												Table:        tmpSourceTable,
												RelatedTable: tmpRelatedTable,
												JoinOn:       tmpJoinOn,
												Projection:   tmpProjection,
												OrderBy:      tmpOrderBy,
												Limit:        tmpBatchSize,
												AfterValue:   tmpAfterValue
											};

										tmpSelf._dispatch(
											{
												Capability:  'DataBeaconAccess',
												Action:      'Join',
												Settings:    { IDBeaconConnection: tmpConnID, JoinSpec: tmpJoinSpec },
												AffinityKey: tmpSourceBeacon,
												RequireAffinityMatch: true,
												TimeoutMs:   600000
											},
											(pJoinErr, pJoinResult) =>
											{
												if (pJoinErr)
												{
													tmpErrorLog.push({ Phase: 'Join', AfterValue: tmpAfterValue, Error: pJoinErr.message });
													return fHandlerCallback(null, {
														Outputs: { Pulled: tmpTotalPulled, Written: tmpTotalWritten, Errors: tmpTotalErrors + 1, ElapsedMs: Date.now() - tmpStartMs, AggregateMs: tmpAggSourceMs, ErrorLog: tmpErrorLog.slice(0, 50) },
														Log: [`JoinStream: source join failed at after=${JSON.stringify(tmpAfterValue)} — ${pJoinErr.message}`]
													});
												}
												let tmpJoinOut = (pJoinResult && pJoinResult.Outputs) || pJoinResult || {};
												let tmpRows = Array.isArray(tmpJoinOut.Rows) ? tmpJoinOut.Rows : [];
												let tmpCursorField = tmpJoinOut.CursorField || null;
												tmpAggSourceMs += (tmpJoinOut.ElapsedMs || 0);
												let tmpRowCount = tmpRows.length;

												if (tmpRowCount === 0)
												{
													return fHandlerCallback(null, {
														Outputs: { Pulled: tmpTotalPulled, Written: tmpTotalWritten, Errors: tmpTotalErrors, ElapsedMs: Date.now() - tmpStartMs, AggregateMs: tmpAggSourceMs, ErrorLog: tmpErrorLog.slice(0, 50) },
														Log: [`JoinStream: ${tmpSourceTable} ⨝ ${tmpRelatedTable} → ${tmpTargetEntity} on [${tmpTargetBeacon}] — pulled ${tmpTotalPulled}, wrote ${tmpTotalWritten}, ${tmpTotalErrors} errors in ${Date.now() - tmpStartMs}ms (source SQL ${tmpAggSourceMs}ms total).`]
													});
												}

												// Capture the cursor for the next page BEFORE
												// any row mutation. CursorField is the column
												// name the emitter chose for src.<OrderBy>.
												let tmpNextAfterValue = tmpAfterValue;
												if (tmpCursorField)
												{
													let tmpLastRow = tmpRows[tmpRowCount - 1];
													if (tmpLastRow && tmpLastRow[tmpCursorField] !== undefined)
													{
														tmpNextAfterValue = tmpLastRow[tmpCursorField];
													}
												}

												// If the emitter added a synthetic sentinel
												// cursor column (CursorField === '_dbkj_cursor'),
												// strip it from each row before write — the
												// target table doesn't have it.
												let tmpStripCursor = (tmpCursorField === '_dbkj_cursor');
												if (tmpStripCursor)
												{
													for (let i = 0; i < tmpRowCount; i++)
													{
														delete tmpRows[i][tmpCursorField];
													}
												}

												// Apply GUIDTemplate per row (substitute from
												// the row itself — the source-side projection
												// already named columns to match the target).
												if (tmpGUIDTemplate)
												{
													for (let i = 0; i < tmpRowCount; i++)
													{
														let tmpRow = tmpRows[i];
														tmpRow[tmpGUIDName] = tmpGUIDTemplate.replace(
															/\{~D:Record\.(\w+)~\}/g,
															(_m, pField) => (tmpRow[pField] === undefined || tmpRow[pField] === null) ? '' : String(tmpRow[pField]));
													}
												}

												// Chunked write of this page
												tmpSelf._dispatch(
													{
														Capability:  'MeadowProxy',
														Action:      'Request',
														Settings:    { Method: 'PUT', Path: tmpWritePath, Body: JSON.stringify(tmpRows), RemoteUser: '' },
														AffinityKey: tmpTargetBeacon,
														RequireAffinityMatch: true,
														TimeoutMs:   120000
													},
													(pWriteErr, pWriteResult) =>
													{
														if (pWriteErr)
														{
															tmpTotalErrors += tmpRowCount;
															tmpErrorLog.push({ AfterValue: tmpAfterValue, Error: pWriteErr.message || String(pWriteErr) });
														}
														else
														{
															let tmpWriteOut = (pWriteResult && pWriteResult.Outputs) || {};
															let tmpHeaders = tmpWriteOut.Headers || {};
															let tmpHdrSucceeded = parseInt(tmpHeaders['x-meadow-upsert-succeeded'] || tmpHeaders['X-Meadow-Upsert-Succeeded'] || '-1', 10);
															let tmpHdrErrored   = parseInt(tmpHeaders['x-meadow-upsert-errored']   || tmpHeaders['X-Meadow-Upsert-Errored']   || '-1', 10);
															if (tmpHdrSucceeded >= 0 && tmpHdrErrored >= 0)
															{
																tmpTotalWritten += tmpHdrSucceeded;
																tmpTotalErrors  += tmpHdrErrored;
																if (tmpHdrErrored > 0)
																{
																	let tmpRespBody = tmpWriteOut.Body;
																	if (typeof tmpRespBody === 'string')
																	{
																		try { tmpRespBody = JSON.parse(tmpRespBody); } catch (e) { /* ignore */ }
																	}
																	let tmpFirstErrors = (tmpRespBody && Array.isArray(tmpRespBody.Errors))
																		? tmpRespBody.Errors.slice(0, 3).map((pE) => (pE && (pE.Error || pE.Message || JSON.stringify(pE).slice(0, 200))))
																		: [];
																	tmpErrorLog.push({ AfterValue: tmpAfterValue, Errored: tmpHdrErrored, Of: tmpRowCount, Details: tmpFirstErrors });
																}
															}
															else
															{
																let tmpStatus = tmpWriteOut.Status;
																if (typeof tmpStatus === 'number' && tmpStatus >= 400)
																{
																	tmpTotalErrors += tmpRowCount;
																	tmpErrorLog.push({ AfterValue: tmpAfterValue, Error: `HTTP ${tmpStatus}` });
																}
																else
																{
																	tmpTotalWritten += tmpRowCount;
																}
															}
														}
														tmpTotalPulled += tmpRowCount;
														tmpRows = null;

														if (typeof fReportProgress === 'function')
														{
															try { fReportProgress({ Phase: 'streaming', Pulled: tmpTotalPulled, Written: tmpTotalWritten, Errors: tmpTotalErrors }); }
															catch (pIgn) { /* best-effort */ }
														}

														// Last page (short read) → done.
														if (tmpRowCount < tmpBatchSize)
														{
															return fHandlerCallback(null, {
																Outputs: { Pulled: tmpTotalPulled, Written: tmpTotalWritten, Errors: tmpTotalErrors, ElapsedMs: Date.now() - tmpStartMs, AggregateMs: tmpAggSourceMs, ErrorLog: tmpErrorLog.slice(0, 50) },
																Log: [`JoinStream: ${tmpSourceTable} ⨝ ${tmpRelatedTable} → ${tmpTargetEntity} on [${tmpTargetBeacon}] — pulled ${tmpTotalPulled}, wrote ${tmpTotalWritten}, ${tmpTotalErrors} errors in ${Date.now() - tmpStartMs}ms (source SQL ${tmpAggSourceMs}ms total).`]
															});
														}
														// Defensive: if the cursor didn't advance
														// (cursor field missing from the last row,
														// or non-unique OrderBy violation), abort
														// rather than spin forever.
														if (tmpNextAfterValue === tmpAfterValue && tmpAfterValue !== null)
														{
															tmpErrorLog.push({ AfterValue: tmpAfterValue, Error: 'keyset cursor did not advance — OrderBy column may not be unique or CursorField missing from row' });
															return fHandlerCallback(null, {
																Outputs: { Pulled: tmpTotalPulled, Written: tmpTotalWritten, Errors: tmpTotalErrors + 1, ElapsedMs: Date.now() - tmpStartMs, AggregateMs: tmpAggSourceMs, ErrorLog: tmpErrorLog.slice(0, 50) },
																Log: [`JoinStream: keyset cursor stalled at after=${JSON.stringify(tmpAfterValue)} — aborting to avoid infinite loop.`]
															});
														}
														tmpAfterValue = tmpNextAfterValue;
														return fNextPage();
													});
											});
									};
									fNextPage();
								});
						}
					},

					'AggregateStream':
					{
						Description: 'Streaming-layout Aggregation: pushes the GROUP BY into the source DB (DataBeaconAccess.Aggregate), receives the small result set (cardinality of group keys), then chunked-writes the rows to the target table. Memory ceiling = the result set, never the source. Pair with OperationType=SQLAggregate.',
						SettingsSchema:
						[
							{ Name: 'SourceBeaconName',     DataType: 'String', Required: true, Description: 'Beacon name of the source (UV mesh AffinityKey for the aggregate dispatch).' },
							{ Name: 'SourceConnection',     DataType: 'String', Required: true, Description: 'Source connection name as registered on the source beacon (matches BeaconConnection.Name OR its URL-sanitized form). Resolved to IDBeaconConnection at run time via DataBeaconAccess.ListConnections.' },
							{ Name: 'SourceTable',          DataType: 'String', Required: true, Description: 'Source table to aggregate over.' },
							{ Name: 'TargetBeaconName',     DataType: 'String', Required: true, Description: 'Beacon name of the write target.' },
							{ Name: 'TargetConnectionHash', DataType: 'String', Required: true, Description: 'URL slug of the target connection (used in the /1.0/<hash>/<Table>/Upserts URL).' },
							{ Name: 'TargetEntity',         DataType: 'String', Required: true, Description: 'Target table for the aggregated rows.' },
							{ Name: 'GUIDName',             DataType: 'String', Required: true, Description: 'Destination GUID column. Each result row\'s value for this column is set from OperationConfiguration.GUIDTemplate before upsert; meadow uses it as the upsert key (so re-runs replace, not duplicate).' },
							{ Name: 'OperationConfiguration', DataType: 'Object', Required: true, Description: '{ GroupBy: [field], Aggregates: [{Source, Function, As}], GUIDTemplate, OrderBy? }. Bundled here so UV\'s settings resolver does not template-strip the {~D:Record.X~} placeholders before the handler runs.' },
							{ Name: 'BatchSize',            DataType: 'Number', Required: false, Description: 'Records per chunked-write Upserts call (default 500). The result set is sliced into chunks of this size and PUT one at a time through MeadowProxy.' }
						],
						Handler: function (pWorkItem, pContext, fHandlerCallback, fReportProgress)
						{
							let tmpStartMs = Date.now();
							let tmpSettings = pWorkItem.Settings || {};
							let tmpSourceBeacon = tmpSettings.SourceBeaconName;
							let tmpSourceConn   = tmpSettings.SourceConnection;
							let tmpSourceTable  = tmpSettings.SourceTable;
							let tmpTargetBeacon = tmpSettings.TargetBeaconName;
							let tmpTargetConn   = tmpSettings.TargetConnectionHash;
							let tmpTargetEntity = tmpSettings.TargetEntity;
							let tmpGUIDName     = tmpSettings.GUIDName;
							let tmpBatchSize    = tmpSettings.BatchSize || 500;

							let tmpOpCfg = tmpSettings.OperationConfiguration || {};
							if (typeof tmpOpCfg === 'string')
							{
								try { tmpOpCfg = JSON.parse(tmpOpCfg); } catch (e) { tmpOpCfg = {}; }
							}
							let tmpGroupBy    = Array.isArray(tmpOpCfg.GroupBy) ? tmpOpCfg.GroupBy : [];
							let tmpAggregates = Array.isArray(tmpOpCfg.Aggregates) ? tmpOpCfg.Aggregates : [];
							let tmpOrderBy    = Array.isArray(tmpOpCfg.OrderBy) ? tmpOpCfg.OrderBy : [];
							let tmpGUIDTemplate = tmpOpCfg.GUIDTemplate || '';

							if (!tmpSelf._Client || !tmpSourceBeacon || !tmpSourceConn || !tmpSourceTable
								|| !tmpTargetBeacon || !tmpTargetConn || !tmpTargetEntity || !tmpGUIDName
								|| tmpAggregates.length === 0)
							{
								return fHandlerCallback(null, {
									Outputs: { Pulled: 0, Written: 0, Errors: 0, ElapsedMs: 0, ErrorLog: [] },
									Log: ['AggregateStream: missing required settings.']
								});
							}

							// ── Resolve source IDBeaconConnection ────────────
							// The aggregate action is keyed by numeric IDBeaconConnection,
							// but operation configs carry the human-readable Name. One
							// extra dispatch up front; the rest of the work is the
							// streaming chunked write.
							tmpSelf._dispatch(
								{
									Capability:  'DataBeaconAccess',
									Action:      'ListConnections',
									Settings:    {},
									AffinityKey: tmpSourceBeacon,
									RequireAffinityMatch: true,
									TimeoutMs:   30000
								},
								(pListErr, pListResult) =>
								{
									if (pListErr)
									{
										return fHandlerCallback(null, {
											Outputs: { Pulled: 0, Written: 0, Errors: 0, ElapsedMs: Date.now() - tmpStartMs, ErrorLog: [{ Phase: 'ListConnections', Error: pListErr.message }] },
											Log: [`AggregateStream: ListConnections on [${tmpSourceBeacon}] failed — ${pListErr.message}`]
										});
									}
									let tmpListOut = (pListResult && pListResult.Outputs) || pListResult || {};
									let tmpConnections = Array.isArray(tmpListOut.Connections) ? tmpListOut.Connections : [];
									let tmpMatch = null;
									for (let i = 0; i < tmpConnections.length; i++)
									{
										let tmpC = tmpConnections[i];
										let tmpName = tmpC && tmpC.Name;
										if (tmpName === tmpSourceConn)
										{
											tmpMatch = tmpC;
											break;
										}
										// Also accept the URL-sanitized form. Configs in
										// the demo are already sanitized but operators may
										// store either form.
										let tmpSanitized = (typeof tmpName === 'string') ? tmpName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '';
										if (tmpSanitized === tmpSourceConn)
										{
											tmpMatch = tmpC;
											break;
										}
									}
									if (!tmpMatch || !tmpMatch.IDBeaconConnection)
									{
										return fHandlerCallback(null, {
											Outputs: { Pulled: 0, Written: 0, Errors: 0, ElapsedMs: Date.now() - tmpStartMs, ErrorLog: [{ Phase: 'ListConnections', Error: 'no match' }] },
											Log: [`AggregateStream: source connection [${tmpSourceConn}] not found on beacon [${tmpSourceBeacon}].`]
										});
									}
									let tmpConnID = tmpMatch.IDBeaconConnection;

									// ── Dispatch source-side aggregate ───────
									let tmpAggSpec =
										{
											Table: tmpSourceTable,
											GroupBy: tmpGroupBy,
											Aggregates: tmpAggregates
										};
									if (tmpOrderBy.length > 0) { tmpAggSpec.OrderBy = tmpOrderBy; }

									if (typeof fReportProgress === 'function')
									{
										try { fReportProgress({ Phase: 'aggregating' }); } catch (pIgn) { /* best-effort */ }
									}

									tmpSelf._dispatch(
										{
											Capability:  'DataBeaconAccess',
											Action:      'Aggregate',
											Settings:    { IDBeaconConnection: tmpConnID, AggregateSpec: tmpAggSpec },
											AffinityKey: tmpSourceBeacon,
											RequireAffinityMatch: true,
											TimeoutMs:   1800000
										},
										(pAggErr, pAggResult) =>
										{
											if (pAggErr)
											{
												return fHandlerCallback(null, {
													Outputs: { Pulled: 0, Written: 0, Errors: 1, ElapsedMs: Date.now() - tmpStartMs, ErrorLog: [{ Phase: 'Aggregate', Error: pAggErr.message }] },
													Log: [`AggregateStream: source aggregate failed — ${pAggErr.message}`]
												});
											}
											let tmpAggOut = (pAggResult && pAggResult.Outputs) || pAggResult || {};
											let tmpRows = Array.isArray(tmpAggOut.Rows) ? tmpAggOut.Rows : [];
											let tmpAggElapsed = tmpAggOut.ElapsedMs || 0;
											let tmpRowCount = tmpRows.length;

											if (tmpRowCount === 0)
											{
												return fHandlerCallback(null, {
													Outputs: { Pulled: 0, Written: 0, Errors: 0, ElapsedMs: Date.now() - tmpStartMs, AggregateMs: tmpAggElapsed, ErrorLog: [] },
													Log: [`AggregateStream: source returned 0 rows; nothing to write.`]
												});
											}

											// ── Apply GUIDTemplate per row ───
											if (tmpGUIDTemplate)
											{
												for (let i = 0; i < tmpRowCount; i++)
												{
													let tmpRow = tmpRows[i];
													tmpRow[tmpGUIDName] = tmpGUIDTemplate.replace(
														/\{~D:Record\.(\w+)~\}/g,
														(_m, pField) => (tmpRow[pField] === undefined || tmpRow[pField] === null) ? '' : String(tmpRow[pField]));
												}
											}

											// ── Chunked write to target ──────
											let tmpTotalWritten = 0;
											let tmpTotalErrors  = 0;
											let tmpErrorLog     = [];
											let tmpChunkOffset  = 0;
											let tmpWritePath    = `/1.0/${tmpTargetConn}/${tmpTargetEntity}/Upserts`;

											let fNextChunk = () =>
											{
												if (tmpChunkOffset >= tmpRowCount)
												{
													return fHandlerCallback(null, {
														Outputs:
														{
															Pulled: tmpRowCount,
															Written: tmpTotalWritten,
															Errors: tmpTotalErrors,
															ElapsedMs: Date.now() - tmpStartMs,
															AggregateMs: tmpAggElapsed,
															ErrorLog: tmpErrorLog.slice(0, 50)
														},
														Log: [`AggregateStream: ${tmpSourceTable} → ${tmpTargetEntity} on [${tmpTargetBeacon}] — ${tmpRowCount} groups (aggregate ${tmpAggElapsed}ms), wrote ${tmpTotalWritten}, ${tmpTotalErrors} errors in ${Date.now() - tmpStartMs}ms.`]
													});
												}
												let tmpChunk = tmpRows.slice(tmpChunkOffset, tmpChunkOffset + tmpBatchSize);
												tmpSelf._dispatch(
													{
														Capability:  'MeadowProxy',
														Action:      'Request',
														Settings:    { Method: 'PUT', Path: tmpWritePath, Body: JSON.stringify(tmpChunk), RemoteUser: '' },
														AffinityKey: tmpTargetBeacon,
														RequireAffinityMatch: true,
														TimeoutMs:   120000
													},
													(pWriteErr, pWriteResult) =>
													{
														let tmpChunkLen = tmpChunk.length;
														if (pWriteErr)
														{
															tmpTotalErrors += tmpChunkLen;
															tmpErrorLog.push({ Offset: tmpChunkOffset, Error: pWriteErr.message || String(pWriteErr) });
														}
														else
														{
															let tmpWriteOut = (pWriteResult && pWriteResult.Outputs) || {};
															let tmpHeaders = tmpWriteOut.Headers || {};
															let tmpHdrSucceeded = parseInt(tmpHeaders['x-meadow-upsert-succeeded'] || tmpHeaders['X-Meadow-Upsert-Succeeded'] || '-1', 10);
															let tmpHdrErrored   = parseInt(tmpHeaders['x-meadow-upsert-errored']   || tmpHeaders['X-Meadow-Upsert-Errored']   || '-1', 10);
															if (tmpHdrSucceeded >= 0 && tmpHdrErrored >= 0)
															{
																tmpTotalWritten += tmpHdrSucceeded;
																tmpTotalErrors  += tmpHdrErrored;
																if (tmpHdrErrored > 0)
																{
																	let tmpRespBody = tmpWriteOut.Body;
																	if (typeof tmpRespBody === 'string')
																	{
																		try { tmpRespBody = JSON.parse(tmpRespBody); } catch (e) { /* ignore */ }
																	}
																	let tmpFirstErrors = (tmpRespBody && Array.isArray(tmpRespBody.Errors))
																		? tmpRespBody.Errors.slice(0, 3).map((pE) => (pE && (pE.Error || pE.Message || JSON.stringify(pE).slice(0, 200))))
																		: [];
																	tmpErrorLog.push({ Offset: tmpChunkOffset, Errored: tmpHdrErrored, Of: tmpChunkLen, Details: tmpFirstErrors });
																}
															}
															else
															{
																let tmpStatus = tmpWriteOut.Status;
																if (typeof tmpStatus === 'number' && tmpStatus >= 400)
																{
																	tmpTotalErrors += tmpChunkLen;
																	tmpErrorLog.push({ Offset: tmpChunkOffset, Error: `HTTP ${tmpStatus}` });
																}
																else
																{
																	tmpTotalWritten += tmpChunkLen;
																}
															}
														}
														tmpChunkOffset += tmpChunkLen;
														if (typeof fReportProgress === 'function')
														{
															try { fReportProgress({ Phase: 'writing', Written: tmpTotalWritten, Errors: tmpTotalErrors, Of: tmpRowCount }); }
															catch (pIgn) { /* best-effort */ }
														}
														return fNextChunk();
													});
											};
											fNextChunk();
										});
								});
						}
					},

					'WriteRecordsRaw':
					{
						Description: 'Clone a comprehension to a target beacon entity as raw-archive rows { Identity, RawJSON, RecordMD5, IngestedAt, SourceTable } via per-record POST. Preserves each source record verbatim — use for clone-to-lake passes where the source has no reliable unique identifier (Identity falls back to the comprehension key, e.g. record-N).',
						SettingsSchema:
						[
							{ Name: 'TargetBeaconName', DataType: 'String', Required: true,  Description: 'Beacon name of the target lake (UV mesh AffinityKey).' },
							{ Name: 'ConnectionHash',   DataType: 'String', Required: true,  Description: 'URL slug of the target connection (meadow REST at /1.0/<ConnectionHash>/).' },
							{ Name: 'Entity',           DataType: 'String', Required: true,  Description: 'Target raw-archive entity name (e.g. RAW_Sale).' },
							{ Name: 'Comprehension',    DataType: 'Object', Required: true,  Description: 'Comprehension { <Entity>: { <key>: <record>, ... } } — flows from the BuildComprehension node. Each record is wrapped into a raw-archive row.' },
							{ Name: 'IdentityField',    DataType: 'String', Required: false, Description: 'Field on each source record to preserve as the Identity column. If absent or missing on the record, falls back to the comprehension key — so source rows need no unique id.' },
							{ Name: 'SourceTable',      DataType: 'String', Required: false, Description: 'Original source table name; stored verbatim in the SourceTable column for round-trip identification.' }
						],
						Handler: function (pWorkItem, pContext, fHandlerCallback, fReportProgress)
						{
							let tmpStartMs = Date.now();
							let tmpSettings = pWorkItem.Settings || {};
							let tmpBeaconName = tmpSettings.TargetBeaconName;
							let tmpConnHash   = tmpSettings.ConnectionHash;
							let tmpEntity     = tmpSettings.Entity;
							let tmpSourceTable = tmpSettings.SourceTable || '';
							let tmpIdentityField = tmpSettings.IdentityField || '';

							let tmpComprehension = tmpSettings.Comprehension;
							if (typeof (tmpComprehension) === 'string') { try { tmpComprehension = JSON.parse(tmpComprehension); } catch (e) { tmpComprehension = null; } }

							if (!tmpSelf._Client || !tmpComprehension || typeof (tmpComprehension) !== 'object' || !tmpBeaconName || !tmpConnHash || !tmpEntity)
							{
								return fHandlerCallback(null, {
									Outputs: { Written: 0, Errors: 0, ErrorLog: [] },
									Log: ['WriteRecordsRaw: TargetBeaconName, ConnectionHash, Entity, and a Comprehension are required, and an UltravisorClient must be configured.']
								});
							}

							// Find the entity sub-object. First object value wins so
							// the raw write tolerates the comprehension key not
							// matching the destination table name.
							let tmpEntityData = tmpComprehension[tmpEntity];
							if (!tmpEntityData || typeof (tmpEntityData) !== 'object')
							{
								let tmpCKeys = Object.keys(tmpComprehension);
								for (let i = 0; i < tmpCKeys.length; i++)
								{
									if (tmpComprehension[tmpCKeys[i]] && typeof (tmpComprehension[tmpCKeys[i]]) === 'object')
									{
										tmpEntityData = tmpComprehension[tmpCKeys[i]];
										break;
									}
								}
							}

							let tmpRowKeys = (tmpEntityData && typeof (tmpEntityData) === 'object') ? Object.keys(tmpEntityData) : [];
							if (tmpRowKeys.length === 0)
							{
								return fHandlerCallback(null, {
									Outputs: { Written: 0, Errors: 0, ErrorLog: [] },
									Log: [`WriteRecordsRaw: no records in comprehension for entity [${tmpEntity}].`]
								});
							}

							let tmpIngestedAt = new Date().toISOString();
							let tmpWritten = 0;
							let tmpErrors  = 0;
							let tmpErrorLog = [];
							let tmpIndex = 0;

							let fWriteNext = () =>
							{
								if (tmpIndex >= tmpRowKeys.length)
								{
									let tmpElapsedMs = Date.now() - tmpStartMs;
									return fHandlerCallback(null, {
										Outputs: { Written: tmpWritten, Errors: tmpErrors, ErrorLog: tmpErrorLog, ElapsedMs: tmpElapsedMs },
										Log: [`WriteRecordsRaw (→ ${tmpBeaconName}/${tmpConnHash}/${tmpEntity}): ${tmpWritten} raw rows written, ${tmpErrors} errors out of ${tmpRowKeys.length} (sourceTable [${tmpSourceTable}]) in ${tmpElapsedMs}ms.`]
									});
								}

								let tmpKey = tmpRowKeys[tmpIndex];
								let tmpSourceRecord = tmpEntityData[tmpKey];
								tmpIndex++;

								let tmpIdentity = null;
								if (tmpIdentityField && tmpSourceRecord && Object.prototype.hasOwnProperty.call(tmpSourceRecord, tmpIdentityField))
								{
									tmpIdentity = tmpSourceRecord[tmpIdentityField];
								}
								if (tmpIdentity === null || typeof (tmpIdentity) === 'undefined')
								{
									tmpIdentity = tmpKey;
								}

								let tmpRawJSON = JSON.stringify(tmpSourceRecord);
								let tmpRawRecord =
								{
									Identity:    tmpIdentity,
									RawJSON:     tmpRawJSON,
									RecordMD5:   libCrypto.createHash('md5').update(tmpRawJSON).digest('hex'),
									IngestedAt:  tmpIngestedAt,
									SourceTable: tmpSourceTable
								};

								tmpSelf._dispatch(
									{
										Capability: 'MeadowProxy',
										Action:     'Request',
										Settings:
										{
											Method:     'POST',
											Path:       `/1.0/${tmpConnHash}/${tmpEntity}`,
											Body:       JSON.stringify(tmpRawRecord),
											RemoteUser: ''
										},
										AffinityKey: tmpBeaconName,
										RequireAffinityMatch: true,
										TimeoutMs:   30000
									},
									(pErr, pResult) =>
									{
										if (pErr)
										{
											tmpErrors++;
											tmpErrorLog.push({ Index: tmpIndex - 1, Error: pErr.message || String(pErr) });
										}
										else
										{
											let tmpOut = (pResult && pResult.Outputs) || pResult || {};
											let tmpStatus = tmpOut.Status;
											if (typeof (tmpStatus) === 'number' && tmpStatus >= 400)
											{
												tmpErrors++;
												tmpErrorLog.push({ Index: tmpIndex - 1, Error: `HTTP ${tmpStatus}` });
											}
											else { tmpWritten++; }
										}
										if (typeof fReportProgress === 'function')
										{
											try { fReportProgress({ Phase: 'writing-raw', Entity: tmpEntity, Written: tmpWritten, Errors: tmpErrors }); }
											catch (pProgIgn) { /* best-effort */ }
										}
										fWriteNext();
									});
							};

							fWriteNext();
						}
					},
					'WriteRecords':
					{
						Description: 'Push a comprehension to a target beacon entity using meadow-endpoints bulk Upserts (PUT /<Entity>s/Upserts), routed through the UV mesh by AffinityKey=TargetBeaconName.',
						SettingsSchema:
						[
							{ Name: 'TargetBeaconName', DataType: 'String', Required: true, Description: 'Beacon name of the target (UV mesh AffinityKey).' },
							{ Name: 'ConnectionHash',   DataType: 'String', Required: true, Description: 'URL slug of the target connection (the beacon\'s meadow REST is at /1.0/<ConnectionHash>/).' },
							{ Name: 'Entity',           DataType: 'String', Required: false, Description: 'Target entity name. Informational when Comprehension is supplied; meadow upserts each entity in the comprehension by its key.' },
							{ Name: 'Comprehension',    DataType: 'Object', Required: false, Description: 'Comprehension { <Entity>: { <GUID>: <record>, ... } }. Preferred input; flows from the BuildComprehension node.' },
							{ Name: 'Records',          DataType: 'Array',  Required: false, Description: 'Back-compat: bare records array. If provided without Comprehension, will be wrapped into { <Entity>: { <i>: <record> } }.' },
							{ Name: 'BulkChunkSize',    DataType: 'Number', Required: false, Description: 'Records per bulk Upserts call. Default 500. Each chunk is one PUT roundtrip through MeadowProxy.' },
							{ Name: 'Concurrency',      DataType: 'Number', Required: false, Description: 'How many bulk Upserts chunks to keep in flight concurrently. Default 1 (preserves the original sequential behavior — backwards-compatible). Clamped to [1, 5]: meadow-endpoints\' /Upserts handler processes its rows strictly serially per request, so client-side parallelism is the only knob for raw throughput, but each worker takes a postgres connection from the target beacon\'s pool — keeping the cap modest avoids starving other tenants of the lake. Compilers (typed-op Write nodes) opt in explicitly; ad-hoc /Upserts callers stay at 1.' },
							{ Name: 'ResetMode',        DataType: 'String', Required: false, Description: '\'Append\' (default) | \'Replace\'. Replace soft-deletes existing rows whose GUID is NOT in the new comprehension after the upsert succeeds — keeps cached views from accumulating orphans when source data churns. The purge does NOT touch meadow\'s internal Upsert handler (which is intentionally serial); orphans are deleted via meadow\'s standard DELETE-by-id surface, parallelized client-side via Concurrency.' },
							{ Name: 'GUIDName',         DataType: 'String', Required: false, Description: 'Column name for the GUID/identity used by ResetMode=Replace orphan detection. Defaults to "GUID" + Entity. Ignored when ResetMode=Append.' }
						],
						Handler: function (pWorkItem, pContext, fHandlerCallback, fReportProgress)
						{
							let tmpStartMs = Date.now();
							let tmpSettings  = pWorkItem.Settings || {};
							let tmpBeaconName = tmpSettings.TargetBeaconName;
							let tmpConnHash   = tmpSettings.ConnectionHash;
							let tmpEntityHint = tmpSettings.Entity;

							let tmpComprehension = tmpSettings.Comprehension;
							let tmpRecords       = tmpSettings.Records;
							if (typeof (tmpComprehension) === 'string') { try { tmpComprehension = JSON.parse(tmpComprehension); } catch (e) { tmpComprehension = null; } }
							if (typeof (tmpRecords)       === 'string') { try { tmpRecords       = JSON.parse(tmpRecords); }       catch (e) { tmpRecords = null; } }

							// Wrap a bare records array into a single-entity
							// comprehension so the rest of the handler is uniform.
							if (!tmpComprehension && Array.isArray(tmpRecords) && tmpEntityHint)
							{
								tmpComprehension = {};
								tmpComprehension[tmpEntityHint] = {};
								for (let i = 0; i < tmpRecords.length; i++)
								{
									let tmpRow = tmpRecords[i];
									let tmpGUIDKey = (tmpRow && tmpRow['GUID' + tmpEntityHint]) ? String(tmpRow['GUID' + tmpEntityHint]) : ('record-' + i);
									tmpComprehension[tmpEntityHint][tmpGUIDKey] = tmpRow;
								}
							}

							if (!tmpSelf._Client || !tmpComprehension || typeof (tmpComprehension) !== 'object' || !tmpBeaconName || !tmpConnHash)
							{
								return fHandlerCallback(null, {
									Outputs: { Written: 0, Errors: 0, ErrorLog: [], EntitiesWritten: [] },
									Log: ['WriteRecords: TargetBeaconName, ConnectionHash, and a Comprehension (or Records + Entity) are required, and an UltravisorClient must be configured.']
								});
							}

							// Iterate the comprehension's entities. For each,
							// PUT the bulk /Upserts endpoint via MeadowProxy.
							// UV resolves AffinityKey=TargetBeaconName to the
							// right beacon URL — we don't need to know the
							// beacon's hostname or port directly. meadow-
							// endpoints decides per-row PUT vs INSERT by
							// matching GUID<Entity>, so a stable combinatorial
							// GUIDTemplate in the MappingConfiguration makes
							// re-runs idempotent without dupe-key errors.
							let tmpEntityKeys = Object.keys(tmpComprehension);
							let tmpEntityIdx = 0;
							let tmpTotalWritten = 0;
							let tmpTotalErrors  = 0;
							let tmpErrorLog     = [];
							let tmpEntitiesWritten = [];
							let tmpEntityCounts = {};

							let fNextEntity = () =>
							{
								if (tmpEntityIdx >= tmpEntityKeys.length)
								{
									let tmpElapsedMs = Date.now() - tmpStartMs;
									// Aggregate orphan stats across entities
									// for the top-level summary.
									let tmpTotalOrphansDeleted = 0;
									let tmpTotalOrphanErrors = 0;
									Object.keys(tmpEntityCounts).forEach((k) =>
									{
										if (typeof tmpEntityCounts[k].OrphansDeleted === 'number') tmpTotalOrphansDeleted += tmpEntityCounts[k].OrphansDeleted;
										if (typeof tmpEntityCounts[k].OrphanErrors === 'number')   tmpTotalOrphanErrors   += tmpEntityCounts[k].OrphanErrors;
									});
									let tmpOutputs = {
										Written:          tmpTotalWritten,
										Errors:           tmpTotalErrors,
										ErrorLog:         tmpErrorLog,
										EntitiesWritten:  tmpEntitiesWritten,
										PerEntity:        tmpEntityCounts,
										ElapsedMs:        tmpElapsedMs
									};
									if (tmpTotalOrphansDeleted > 0 || tmpTotalOrphanErrors > 0)
									{
										tmpOutputs.OrphansDeleted = tmpTotalOrphansDeleted;
										tmpOutputs.OrphanErrors   = tmpTotalOrphanErrors;
									}
									return fHandlerCallback(null, {
										Outputs: tmpOutputs,
										Log: [`WriteRecords (Upsert → ${tmpBeaconName}/${tmpConnHash}): ${tmpTotalWritten} written across ${tmpEntitiesWritten.length} entity(ies), ${tmpTotalErrors} errors${tmpTotalOrphansDeleted ? ', ' + tmpTotalOrphansDeleted + ' orphans purged' : ''}, in ${tmpElapsedMs}ms.`]
									});
								}
								let tmpEntity = tmpEntityKeys[tmpEntityIdx];
								tmpEntityIdx++;

								let tmpEntityMap = tmpComprehension[tmpEntity] || {};
								let tmpRowKeys = Object.keys(tmpEntityMap);
								if (tmpRowKeys.length === 0)
								{
									tmpEntityCounts[tmpEntity] = { Written: 0, Errors: 0 };
									return fNextEntity();
								}

								let tmpRowArr = tmpRowKeys.map((k) => tmpEntityMap[k]);
								// meadow-endpoints' BULK Upsert: PUT
								// /1.0/<ConnectionHash>/<Entity>/Upserts with the
								// records ARRAY body. Meadow looks up each row
								// by GUID<Entity> and decides UPDATE vs INSERT.
								// Inside each request, meadow processes rows
								// strictly serially (eachLimit=1, ~2200 rows/sec
								// ceiling per request — this is intentional, not a
								// bug). To raise total throughput we keep N
								// requests in flight concurrently — each lands on
								// a separate connection from the lake-databeacon
								// postgres pool, so they parallelize cleanly.
								let tmpPath = `/1.0/${tmpConnHash}/${tmpEntity}/Upserts`;
								let tmpChunkSize = tmpSettings.BulkChunkSize || 500;
								// Concurrency: default 1 (sequential, original
								// behavior). Clamped to 1..5 so a misconfiguration
								// can't pin the lake's connection pool.
								let tmpConcurrency = Math.max(1, Math.min(5, tmpSettings.Concurrency || 1));
								let tmpResetMode = (tmpSettings.ResetMode === 'Replace') ? 'Replace' : 'Append';
								let tmpGUIDName = tmpSettings.GUIDName || ('GUID' + tmpEntity);
								let tmpEntityWritten = 0;
								let tmpEntityErrors  = 0;
								let tmpChunkOffset = 0;
								let tmpInFlight = 0;
								let tmpDoneSignaled = false;
								let tmpOrphansDeleted = 0;
								let tmpOrphanErrors = 0;

								let fFinalizeEntity = () =>
								{
									if (tmpDoneSignaled) return;
									tmpDoneSignaled = true;
									if (tmpEntityWritten > 0) tmpEntitiesWritten.push(tmpEntity);
									tmpTotalWritten += tmpEntityWritten;
									tmpTotalErrors  += tmpEntityErrors;
									let tmpCounts = { Written: tmpEntityWritten, Errors: tmpEntityErrors };
									if (tmpResetMode === 'Replace')
									{
										tmpCounts.OrphansDeleted = tmpOrphansDeleted;
										tmpCounts.OrphanErrors   = tmpOrphanErrors;
									}
									tmpEntityCounts[tmpEntity] = tmpCounts;
									return fNextEntity();
								};

								// fSignalEntityDone — called when all upsert
								// chunks settle. In Append mode we go straight
								// to finalize. In Replace mode we kick off the
								// orphan-purge pass first.
								let fSignalEntityDone = () =>
								{
									if (tmpResetMode !== 'Replace') return fFinalizeEntity();

									// Replace mode: the live set is the GUIDs
									// in this run's comprehension. Anything in
									// the lake table that's NOT in this set is
									// stale and gets soft-deleted.
									let tmpLiveSet = new Set();
									for (let k = 0; k < tmpRowKeys.length; k++) tmpLiveSet.add(String(tmpRowKeys[k]));
									let tmpListPath = (pPage, pSize) => `/1.0/${tmpConnHash}/${tmpEntity}s/${pPage * pSize}/${pSize}`;

									// Paginate the existing rows. Page size
									// 500 matches the Upsert chunk size. We
									// capture (ID, GUID) pairs so the purge
									// can DELETE by primary key (meadow's
									// only standard DELETE surface).
									let tmpPage = 0;
									let tmpIDName = 'ID' + tmpEntity;
									let tmpExisting = [];

									let fReadExisting = () =>
									{
										tmpSelf._dispatch(
											{
												Capability: 'MeadowProxy',
												Action:     'Request',
												Settings: { Method: 'GET', Path: tmpListPath(tmpPage, 500), Body: '', RemoteUser: '' },
												AffinityKey: tmpBeaconName,
												RequireAffinityMatch: true,
												TimeoutMs: 30000
											},
											(pErr, pResult) =>
											{
												if (pErr)
												{
													tmpFable.log.warn(`WriteRecords[Replace]: existing-rows fetch error at page ${tmpPage}: ${pErr.message}`);
													return fFinalizeEntity();
												}
												let tmpOut = (pResult && pResult.Outputs) || pResult || {};
												let tmpBody = tmpOut.Body;
												if (typeof tmpBody === 'string') { try { tmpBody = JSON.parse(tmpBody); } catch (e) { tmpBody = []; } }
												let tmpRows = Array.isArray(tmpBody) ? tmpBody : [];
												for (let i = 0; i < tmpRows.length; i++)
												{
													let tmpRow = tmpRows[i];
													if (!tmpRow) continue;
													let tmpG = tmpRow[tmpGUIDName];
													let tmpId = tmpRow[tmpIDName];
													if (tmpG && tmpId) tmpExisting.push({ id: tmpId, guid: String(tmpG) });
												}
												if (tmpRows.length < 500)
												{
													return fComputeAndPurgeOrphans();
												}
												tmpPage++;
												fReadExisting();
											});
									};

									let fComputeAndPurgeOrphans = () =>
									{
										let tmpOrphans = tmpExisting.filter((r) => !tmpLiveSet.has(r.guid));
										if (tmpOrphans.length === 0) return fFinalizeEntity();

										// Soft-delete orphans via meadow's
										// per-row DELETE-by-id. Concurrent
										// N at a time, mirroring the Upsert
										// pool. Meadow's UPDATE flips the
										// Deleted column on the row; the row
										// stays in the table for forensics +
										// idempotent re-runs (next time the
										// GUID matches a live row, meadow's
										// CollisionRename behavior renames
										// the soft-deleted row's GUID so the
										// new INSERT can take the slot).
										let tmpOrphanIdx = 0;
										let tmpOrphanInFlight = 0;
										let tmpOrphanDoneSignaled = false;

										let fOrphanDone = () =>
										{
											if (tmpOrphanDoneSignaled) return;
											tmpOrphanDoneSignaled = true;
											return fFinalizeEntity();
										};

										let fStartNextOrphan = () =>
										{
											if (tmpOrphanIdx >= tmpOrphans.length)
											{
												if (tmpOrphanInFlight === 0) fOrphanDone();
												return;
											}
											let tmpO = tmpOrphans[tmpOrphanIdx++];
											tmpOrphanInFlight++;
											let tmpDelPath = `/1.0/${tmpConnHash}/${tmpEntity}/${tmpO.id}`;
											tmpSelf._dispatch(
												{
													Capability: 'MeadowProxy',
													Action:     'Request',
													Settings: { Method: 'DELETE', Path: tmpDelPath, Body: '', RemoteUser: '' },
													AffinityKey: tmpBeaconName,
													RequireAffinityMatch: true,
													TimeoutMs: 30000
												},
												(pErr, pResult) =>
												{
													if (pErr)
													{
														tmpOrphanErrors++;
													}
													else
													{
														let tmpOut = (pResult && pResult.Outputs) || pResult || {};
														let tmpStatus = tmpOut.Status;
														if (typeof tmpStatus === 'number' && tmpStatus >= 400) tmpOrphanErrors++;
														else tmpOrphansDeleted++;
													}
													tmpOrphanInFlight--;
													if (tmpOrphanIdx < tmpOrphans.length) fStartNextOrphan();
													else if (tmpOrphanInFlight === 0) fOrphanDone();
												});
										};

										let tmpOrphanPrime = Math.min(tmpConcurrency, tmpOrphans.length);
										for (let p = 0; p < tmpOrphanPrime; p++) fStartNextOrphan();
									};

									fReadExisting();
								};

								let fStartNextChunk = () =>
								{
									if (tmpChunkOffset >= tmpRowArr.length)
									{
										// No more chunks to dispatch — if nothing's
										// in flight either, we're done with this entity.
										if (tmpInFlight === 0) fSignalEntityDone();
										return;
									}
									let tmpStart = tmpChunkOffset;
									let tmpChunk = tmpRowArr.slice(tmpStart, tmpStart + tmpChunkSize);
									let tmpChunkLen = tmpChunk.length;
									tmpChunkOffset += tmpChunkLen;
									let tmpBodyStr = JSON.stringify(tmpChunk);
									tmpInFlight++;

									tmpSelf._dispatch(
										{
											Capability: 'MeadowProxy',
											Action:     'Request',
											Settings:
											{
												Method:     'PUT',
												Path:       tmpPath,
												Body:       tmpBodyStr,
												RemoteUser: ''
											},
											AffinityKey: tmpBeaconName,
											RequireAffinityMatch: true,
											TimeoutMs:   60000
										},
										(pErr, pResult) =>
										{
											if (pErr)
											{
												tmpEntityErrors += tmpChunkLen;
												tmpErrorLog.push({ Entity: tmpEntity, Chunk: tmpStart, Error: pErr.message || String(pErr) });
											}
											else
											{
												let tmpOut = (pResult && pResult.Outputs) || {};
												let tmpStatus = tmpOut.Status;
												if (typeof (tmpStatus) === 'number' && tmpStatus >= 400)
												{
													tmpEntityErrors += tmpChunkLen;
													let tmpSnippet = (typeof tmpOut.Body === 'string') ? tmpOut.Body.slice(0, 160) : '';
													tmpErrorLog.push({ Entity: tmpEntity, Chunk: tmpStart, Error: `HTTP ${tmpStatus}: ${tmpSnippet}` });
												}
												else
												{
													// meadow's bulk Upserts returns HTTP 200
													// even when every row in the chunk fails
													// (postgres type errors, missing table, NOT
													// NULL violations, etc.). The authoritative
													// per-row totals are in HTTP HEADERS:
													//   X-Meadow-Upsert-Total
													//   X-Meadow-Upsert-Succeeded
													//   X-Meadow-Upsert-Errored
													// without these, we'd silently report
													// "Written: 25000" while the table stays empty.
													// MeadowProxy forwards response headers into
													// Outputs.Headers (lowercased keys, per Node http).
													let tmpHeaders = (tmpOut.Headers) || {};
													let tmpHdrTotal      = parseInt(tmpHeaders['x-meadow-upsert-total']     || tmpHeaders['X-Meadow-Upsert-Total']     || '-1', 10);
													let tmpHdrSucceeded  = parseInt(tmpHeaders['x-meadow-upsert-succeeded'] || tmpHeaders['X-Meadow-Upsert-Succeeded'] || '-1', 10);
													let tmpHdrErrored    = parseInt(tmpHeaders['x-meadow-upsert-errored']   || tmpHeaders['X-Meadow-Upsert-Errored']   || '-1', 10);

													let tmpBody = tmpOut.Body;
													if (typeof tmpBody === 'string')
													{
														try { tmpBody = JSON.parse(tmpBody); }
														catch (pParseIgn) { /* leave as string for fallback */ }
													}
													let tmpFirstErrors = [];
													if (tmpBody && typeof tmpBody === 'object' && Array.isArray(tmpBody.Errors))
													{
														tmpFirstErrors = tmpBody.Errors.slice(0, 3).map((pE) => (pE && (pE.Error || pE.Message || JSON.stringify(pE).slice(0, 200))));
													}

													let tmpRowSucceeded;
													let tmpRowErrored;
													if (tmpHdrSucceeded >= 0 && tmpHdrErrored >= 0)
													{
														// Headers tell the truth — use them.
														tmpRowSucceeded = tmpHdrSucceeded;
														tmpRowErrored   = tmpHdrErrored;
													}
													else if (tmpBody && typeof tmpBody === 'object')
													{
														// No headers (older meadow?) — try the body.
														tmpRowErrored   = Array.isArray(tmpBody.Errors)  ? tmpBody.Errors.length  : 0;
														tmpRowSucceeded = Array.isArray(tmpBody.Records) ? tmpBody.Records.length
															: (Array.isArray(tmpBody) ? tmpBody.length : Math.max(0, tmpChunkLen - tmpRowErrored));
													}
													else
													{
														// Truly opaque — assume the chunk wrote.
														tmpRowSucceeded = tmpChunkLen;
														tmpRowErrored   = 0;
													}

													if (tmpRowErrored > 0)
													{
														tmpEntityErrors += tmpRowErrored;
														tmpErrorLog.push({ Entity: tmpEntity, Chunk: tmpStart, Error: `${tmpRowErrored}/${tmpChunkLen} rows errored`, Details: tmpFirstErrors });
													}
													if (tmpRowSucceeded > 0) tmpEntityWritten += tmpRowSucceeded;
												}
											}
											// Heartbeat per-chunk so UV's stall detector
											// (HeartbeatExpectedMs * 2 = 120s default)
											// doesn't flip a long bulk-write to Stalled.
											// At 250K rows / 500 per chunk = 500 chunks;
											// even at 5-way concurrency the wall-clock
											// can run several minutes total.
											if (typeof fReportProgress === 'function')
											{
												try { fReportProgress({ Phase: 'writing', Entity: tmpEntity, Written: tmpEntityWritten, Errors: tmpEntityErrors }); }
												catch (pProgErr) { /* best-effort */ }
											}
											tmpInFlight--;
											// Refill the worker pool: try to start a
											// fresh chunk to replace this one. If
											// no more work AND nothing in flight,
											// we're done.
											if (tmpChunkOffset < tmpRowArr.length)
											{
												fStartNextChunk();
											}
											else if (tmpInFlight === 0)
											{
												fSignalEntityDone();
											}
										});
								};

								// Prime the pool with up to BulkConcurrency
								// in-flight chunks. The "if more work" check
								// inside fStartNextChunk handles the tail
								// where we have fewer chunks left than workers.
								let tmpPrime = Math.min(tmpConcurrency, Math.ceil(tmpRowArr.length / tmpChunkSize));
								if (tmpPrime === 0) return fSignalEntityDone();
								for (let p = 0; p < tmpPrime; p++) fStartNextChunk();
							};
							fNextEntity();
						}
					}
				}
			});

		// ── Capability: DataMapperTransform ──────────────────────

		pBeaconService.registerCapability(
			{
				Capability: 'DataMapperTransform',
				Name: 'DataMapperTransformProvider',
				actions:
				{
					'MapRecords':
					{
						Description: 'Apply a MappingConfiguration to a batch of source records',
						SettingsSchema:
						[
							{ Name: 'Records', DataType: 'Array', Required: true, Description: 'Source records to transform' },
							{ Name: 'MappingConfiguration', DataType: 'Object', Required: true, Description: 'Mapping rules: { Entity, Mappings, GUIDTemplate, Solvers }' }
						],
						Handler: function (pWorkItem, pContext, fHandlerCallback)
						{
							let tmpSettings = pWorkItem.Settings || {};
							let tmpRecords = tmpSettings.Records || [];
							let tmpConfig = tmpSettings.MappingConfiguration || {};

							tmpFable.log.info(`MapRecords: Records type=${typeof(tmpRecords)}, isArray=${Array.isArray(tmpRecords)}, length=${typeof(tmpRecords)==='string'?tmpRecords.length:(Array.isArray(tmpRecords)?tmpRecords.length:'?')}`);
							tmpFable.log.info(`MapRecords: Config type=${typeof(tmpConfig)}, keys=${typeof(tmpConfig)==='object'?Object.keys(tmpConfig||{}).join(','):'N/A'}`);

							if (typeof (tmpRecords) === 'string')
							{
								try { tmpRecords = JSON.parse(tmpRecords); } catch (e) { tmpFable.log.error(`MapRecords: JSON parse error: ${e.message}`); tmpRecords = []; }
							}
							if (typeof (tmpConfig) === 'string')
							{
								try { tmpConfig = JSON.parse(tmpConfig); } catch (e) { tmpFable.log.error(`MapRecords: Config parse error: ${e.message}`); tmpConfig = {}; }
							}

							tmpFable.log.info(`MapRecords: after parse Records=${Array.isArray(tmpRecords)?tmpRecords.length:'not-array'}, Config.Mappings=${tmpConfig.Mappings?Object.keys(tmpConfig.Mappings).join(','):'none'}`);
							if (Array.isArray(tmpRecords) && tmpRecords.length > 0)
							{
								tmpFable.log.info(`MapRecords: first record keys: ${Object.keys(tmpRecords[0]).join(',')}`);
								tmpFable.log.info(`MapRecords: first record Title="${tmpRecords[0].Title}" ISBN="${tmpRecords[0].ISBN}"`);
							}

							if (!Array.isArray(tmpRecords) || tmpRecords.length === 0)
							{
								return fHandlerCallback(null, {
									Outputs: { MappedRecords: [], RecordCount: 0 },
									Log: [`MapRecords: no input records. Records type=${typeof(tmpRecords)}, isArray=${Array.isArray(tmpRecords)}`]
								});
							}

							// TabularTransform requires Pict (for parseTemplate).
							// When running under a plain Fable instance, use
							// the lightweight regex-based mapper instead.
							let tmpTransform = null;
							if (libTabularTransform && typeof (tmpFable.parseTemplate) === 'function')
							{
								tmpFable.serviceManager.addServiceTypeIfNotExists('TabularTransform', libTabularTransform);
								tmpTransform = tmpFable.serviceManager.instantiateServiceProviderIfNotExists('TabularTransform');
							}

							let tmpMappedRecords = [];
							let tmpErrors = [];
							let tmpMappings = tmpConfig.Mappings || {};

							for (let i = 0; i < tmpRecords.length; i++)
							{
								try
								{
									let tmpMapped;
									if (tmpTransform && typeof (tmpTransform.createRecordFromMapping) === 'function')
									{
										tmpMapped = tmpTransform.createRecordFromMapping(tmpRecords[i], tmpConfig, {});
									}
									else
									{
										// Lightweight fallback: resolve {~D:Record.Field~} templates
										tmpMapped = {};
										let tmpKeys = Object.keys(tmpMappings);
										for (let k = 0; k < tmpKeys.length; k++)
										{
											let tmpExpr = tmpMappings[tmpKeys[k]];
											if (typeof (tmpExpr) === 'string')
											{
												// Support both {~D:Record.Field~} templates and plain field names
												let tmpMatch = tmpExpr.match(/\{~D:Record\.(\w+)~\}/);
												if (tmpMatch)
												{
													tmpMapped[tmpKeys[k]] = tmpRecords[i][tmpMatch[1]];
												}
												else if (tmpRecords[i].hasOwnProperty(tmpExpr))
												{
													// Plain field name (e.g. "Title" maps directly)
													tmpMapped[tmpKeys[k]] = tmpRecords[i][tmpExpr];
												}
												else
												{
													// Literal value
													tmpMapped[tmpKeys[k]] = tmpExpr;
												}
											}
											else
											{
												tmpMapped[tmpKeys[k]] = tmpExpr;
											}
										}
									}
									if (i === 0) { tmpFable.log.info(`MapRecords: first mapped record: ${JSON.stringify(tmpMapped)}`); }
									tmpMappedRecords.push(tmpMapped);
								}
								catch (pMapError)
								{
									tmpErrors.push({ Index: i, Error: pMapError.message });
									if (tmpErrors.length === 1)
									{
										tmpFable.log.error(`MapRecords: first mapping error at index ${i}: ${pMapError.message}`);
										tmpFable.log.error(`MapRecords: stack: ${pMapError.stack}`);
									}
								}
							}

							return fHandlerCallback(null, {
								Outputs:
								{
									MappedRecords: tmpMappedRecords,
									RecordCount: tmpMappedRecords.length,
									Errors: tmpErrors,
									Result: JSON.stringify(tmpMappedRecords)
								},
								Log: [`MapRecords: mapped ${tmpMappedRecords.length} of ${tmpRecords.length} records.`]
							});
						}
					},

					'ExtractRecords':
					{
						Description: 'Filter + project a record set (Phase 2b Extraction). Drops rows that do not match every Filter equality, then applies Projection like a MappingConfiguration. Lives as its own beacon action so per-row Filter rejects and Projection errors attribute to this node in the manifest.',
						SettingsSchema:
						[
							{ Name: 'Records',                DataType: 'Array',  Required: true,  Description: 'Source records (typically from a preceding PullRecords).' },
							{ Name: 'OperationConfiguration', DataType: 'Object', Required: true,  Description: '{ Entity, GUIDName?, GUIDTemplate?, Projection, Filter? }. Bundled into one Object-typed setting so UV\'s settings resolver does not strip {~D:Record.X~} templates inside GUIDTemplate / Projection — string-typed settings are template-resolved before reaching the handler.' }
						],
						Handler: function (pWorkItem, pContext, fHandlerCallback)
						{
							let tmpStartMs = Date.now();
							let tmpSettings = pWorkItem.Settings || {};
							let tmpRecords = tmpSettings.Records || [];
							let tmpCfg = tmpSettings.OperationConfiguration || {};
							if (typeof (tmpCfg) === 'string') { try { tmpCfg = JSON.parse(tmpCfg); } catch (pCfgParseError) { tmpCfg = {}; } }

							if (typeof (tmpRecords) === 'string')
							{
								try { tmpRecords = JSON.parse(tmpRecords); } catch (e) { tmpFable.log.error(`ExtractRecords: Records parse error: ${e.message}`); tmpRecords = []; }
							}
							if (typeof (tmpCfg) === 'string')
							{
								try { tmpCfg = JSON.parse(tmpCfg); } catch (e) { tmpFable.log.error(`ExtractRecords: OperationConfiguration parse error: ${e.message}`); tmpCfg = {}; }
							}

							if (Array.isArray(tmpRecords))
							{
								let tmpGuard = _checkRowCount('ExtractRecords', tmpRecords.length);
								if (tmpGuard) return fHandlerCallback(tmpGuard);
							}

							let tmpEntity = tmpCfg.Entity || 'Record';
							let tmpGUIDName = tmpCfg.GUIDName || ('GUID' + tmpEntity);
							let tmpGUIDTemplate = tmpCfg.GUIDTemplate || '';
							let tmpProjection = tmpCfg.Projection || {};
							let tmpFilter = tmpCfg.Filter || null;

							if (!Array.isArray(tmpRecords))
							{
								return fHandlerCallback(null, {
									Outputs: { Records: [], Result: '[]', RecordCount: 0, FilteredOutCount: 0, Errors: [] },
									Log: [`ExtractRecords: input Records was not an array (got ${typeof(tmpRecords)}).`]
								});
							}

							// Build a MappingConfiguration the existing template
							// machinery already understands. The compiler in
							// the bridge funnels Projection straight in as
							// Mappings, so the per-cell template grammar is
							// identical to MapRecords' (incl. {~D:Record.X~}).
							let tmpMappingConfig =
							{
								Entity:       tmpEntity,
								GUIDName:     tmpGUIDName,
								GUIDTemplate: tmpGUIDTemplate,
								Mappings:     tmpProjection,
								Solvers:      Array.isArray(tmpCfg.Solvers) ? tmpCfg.Solvers : []
							};

							// Same TabularTransform availability check as
							// MapRecords. The transform path includes
							// GUIDTemplate resolution; the lightweight fallback
							// also handles it (block below) so the two paths
							// produce equivalent rows.
							let tmpTransform = null;
							if (libTabularTransform && typeof (tmpFable.parseTemplate) === 'function')
							{
								tmpFable.serviceManager.addServiceTypeIfNotExists('TabularTransform', libTabularTransform);
								tmpTransform = tmpFable.serviceManager.instantiateServiceProviderIfNotExists('TabularTransform');
							}

							let tmpKept = [];
							let tmpFilteredOut = 0;
							let tmpErrors = [];
							let tmpFilterKeys = (tmpFilter && typeof (tmpFilter) === 'object') ? Object.keys(tmpFilter) : [];

							for (let i = 0; i < tmpRecords.length; i++)
							{
								let tmpRow = tmpRecords[i];

								// Step 1 — filter. Equality with == fallback
								// (so 1 matches "1" — meadow's REST returns
								// numeric columns as numbers but we sometimes
								// receive them as strings via JSON re-parse).
								let tmpKeep = true;
								for (let f = 0; f < tmpFilterKeys.length; f++)
								{
									let tmpKey = tmpFilterKeys[f];
									let tmpExpected = tmpFilter[tmpKey];
									let tmpActual = tmpRow ? tmpRow[tmpKey] : undefined;
									if (tmpActual !== tmpExpected && String(tmpActual) !== String(tmpExpected))
									{
										tmpKeep = false;
										break;
									}
								}
								if (!tmpKeep)
								{
									tmpFilteredOut++;
									continue;
								}

								// Step 2 — project. Same path MapRecords uses,
								// so per-row error attribution and template
								// semantics stay consistent with Mapping.
								try
								{
									let tmpProjected;
									if (tmpTransform && typeof (tmpTransform.createRecordFromMapping) === 'function')
									{
										tmpProjected = tmpTransform.createRecordFromMapping(tmpRow, tmpMappingConfig, {});
									}
									else
									{
										tmpProjected = {};
										let tmpKeys = Object.keys(tmpProjection);
										for (let k = 0; k < tmpKeys.length; k++)
										{
											let tmpExpr = tmpProjection[tmpKeys[k]];
											if (typeof (tmpExpr) === 'string')
											{
												let tmpMatch = tmpExpr.match(/\{~D:Record\.(\w+)~\}/);
												if (tmpMatch)
												{
													tmpProjected[tmpKeys[k]] = tmpRow[tmpMatch[1]];
												}
												else if (tmpRow.hasOwnProperty(tmpExpr))
												{
													tmpProjected[tmpKeys[k]] = tmpRow[tmpExpr];
												}
												else
												{
													tmpProjected[tmpKeys[k]] = tmpExpr;
												}
											}
											else
											{
												tmpProjected[tmpKeys[k]] = tmpExpr;
											}
										}
										// Lightweight GUIDTemplate resolution:
										// substitute every {~D:Record.X~} for
										// the source row's value. Whatever
										// chars are around them stay literal,
										// so "WSC_42" comes out of "WSC_{~D:Record.IDWeatherStation~}".
										if (tmpGUIDTemplate)
										{
											tmpProjected[tmpGUIDName] = tmpGUIDTemplate.replace(
												/\{~D:Record\.(\w+)~\}/g,
												(pMatch, pField) => (tmpRow[pField] === undefined || tmpRow[pField] === null) ? '' : String(tmpRow[pField]));
										}
									}
									_applySolvers(tmpFable, Array.isArray(tmpCfg.Solvers) ? tmpCfg.Solvers : [], { Record: tmpRow }, tmpProjected);
									tmpKept.push(tmpProjected);
								}
								catch (pProjErr)
								{
									tmpErrors.push({ Index: i, Error: pProjErr.message });
									if (tmpErrors.length === 1)
									{
										tmpFable.log.error(`ExtractRecords: first projection error at index ${i}: ${pProjErr.message}`);
									}
								}
							}

							let tmpElapsedMs = Date.now() - tmpStartMs;
							// Records is redundant with Result over the wire —
							// the State edge reads Result. Drop Records to halve
							// the WS payload at 100K-row scale.
							return fHandlerCallback(null, {
								Outputs:
								{
									RecordCount:      tmpKept.length,
									FilteredOutCount: tmpFilteredOut,
									Errors:           tmpErrors,
									ElapsedMs:        tmpElapsedMs,
									Result:           JSON.stringify(tmpKept)
								},
								Log: [`ExtractRecords: kept ${tmpKept.length} of ${tmpRecords.length} (filtered out ${tmpFilteredOut}, errors ${tmpErrors.length}) in ${tmpElapsedMs}ms.`]
							});
						}
					},

					'UnnestRecords':
					{
						Description: 'Explode an array-of-objects column into one record per element (1→N). Resolves OperationConfiguration.ArrayPath on each source record (a JSON-string column is parsed inline), then emits one record per element from ElementProjection (Element.* scope) + ParentCarry (Record.* scope) + a deterministic per-element GUID. Its own beacon action so the explode and per-element errors attribute to this node in the manifest.',
						SettingsSchema:
						[
							{ Name: 'Records',                DataType: 'Array',  Required: true, Description: 'Source records (typically from a preceding PullRecords).' },
							{ Name: 'OperationConfiguration', DataType: 'Object', Required: true, Description: '{ Entity, GUIDName?, GUIDTemplate?, ArrayPath, ElementProjection{col:"{~D:Element.x~}"}, ParentCarry?{col:"{~D:Record.x~}"}, Filter?, Solvers? }. Bundled as one Object so UV does not template-strip the {~D:...~} placeholders.' }
						],
						Handler: function (pWorkItem, pContext, fHandlerCallback)
						{
							return _unnestRecordsHandler(pWorkItem, fHandlerCallback, tmpFable, libTabularTransform, _checkRowCount);
						}
					},

					'AggregateRecords':
					{
						Description: 'Group records by GroupBy keys, compute aggregates (Sum / Count / Mean / Min / Max / CollectDistinct / CountDistinct) per group, project a deterministic GUID per group. Output is one record per unique GroupBy combination, with columns = GroupBy ∪ Aggregates.As ∪ GUID.',
						SettingsSchema:
						[
							{ Name: 'Records',                DataType: 'Array',  Required: true, Description: 'Source records (typically from upstream PullRecords).' },
							{ Name: 'OperationConfiguration', DataType: 'Object', Required: true, Description: '{ Entity, GUIDName?, GUIDTemplate?, GroupBy:[fields], Aggregates:[{Source,Function,As}], IncludeGroupColumns? (default true) }. Bundled as one Object so UV does not template-strip GUIDTemplate / inner expressions.' }
						],
						Handler: function (pWorkItem, pContext, fHandlerCallback)
						{
							let tmpStartMs = Date.now();
							let tmpSettings = pWorkItem.Settings || {};
							let tmpRecords = tmpSettings.Records || [];
							let tmpCfg = tmpSettings.OperationConfiguration || {};
							if (typeof (tmpRecords) === 'string') { try { tmpRecords = JSON.parse(tmpRecords); } catch (e) { tmpRecords = []; } }
							if (typeof (tmpCfg)     === 'string') { try { tmpCfg     = JSON.parse(tmpCfg);     } catch (e) { tmpCfg = {}; } }

							let tmpEntity = tmpCfg.Entity || 'Aggregate';
							let tmpGUIDName = tmpCfg.GUIDName || ('GUID' + tmpEntity);
							let tmpGUIDTemplate = tmpCfg.GUIDTemplate || '';
							let tmpGroupBy = Array.isArray(tmpCfg.GroupBy) ? tmpCfg.GroupBy : [];
							let tmpAggs = Array.isArray(tmpCfg.Aggregates) ? tmpCfg.Aggregates : [];
							let tmpIncludeGroupCols = (tmpCfg.IncludeGroupColumns === undefined) ? true : !!tmpCfg.IncludeGroupColumns;

							if (!Array.isArray(tmpRecords))
							{
								return fHandlerCallback(null, {
									Outputs: { Records: [], RecordCount: 0, GroupCount: 0, ElapsedMs: 0, Result: '[]' },
									Log: [`AggregateRecords: input Records was not an array.`]
								});
							}
							let tmpGuard = _checkRowCount('AggregateRecords', tmpRecords.length);
							if (tmpGuard) return fHandlerCallback(tmpGuard);

							// Build groups keyed by joined GroupBy values. The
							// key is a JSON-encoded array of values so collisions
							// across distinct value combinations are impossible
							// (e.g. ["NY","NewYork"] vs ["NYNewYork"] both
							// hashable but distinct here).
							let tmpGroups = {};
							for (let i = 0; i < tmpRecords.length; i++)
							{
								let tmpRow = tmpRecords[i];
								if (!tmpRow) continue;
								let tmpKeyVals = [];
								for (let g = 0; g < tmpGroupBy.length; g++)
								{
									let tmpVal = tmpRow[tmpGroupBy[g]];
									tmpKeyVals.push(tmpVal === undefined ? null : tmpVal);
								}
								let tmpKey = JSON.stringify(tmpKeyVals);
								if (!tmpGroups[tmpKey]) tmpGroups[tmpKey] = { Key: tmpKeyVals, Rows: [], Sample: tmpRow };
								tmpGroups[tmpKey].Rows.push(tmpRow);
							}

							let tmpOut = [];
							let tmpGroupKeys = Object.keys(tmpGroups);
							for (let k = 0; k < tmpGroupKeys.length; k++)
							{
								let tmpGroup = tmpGroups[tmpGroupKeys[k]];
								let tmpResult = {};

								if (tmpIncludeGroupCols)
								{
									for (let g = 0; g < tmpGroupBy.length; g++)
									{
										tmpResult[tmpGroupBy[g]] = tmpGroup.Key[g];
									}
								}

								for (let a = 0; a < tmpAggs.length; a++)
								{
									let tmpAgg = tmpAggs[a];
									let tmpFn = String(tmpAgg.Function || tmpAgg.Op || '').toLowerCase();
									let tmpSrc = tmpAgg.Source || tmpAgg.Column;
									let tmpAs = tmpAgg.As || (tmpFn + '_' + (tmpSrc || 'col'));
									let tmpVals = [];
									for (let r = 0; r < tmpGroup.Rows.length; r++)
									{
										let tmpV = (tmpSrc === '*' || !tmpSrc) ? 1 : tmpGroup.Rows[r][tmpSrc];
										// Coerce stringified numbers (postgres numeric returns strings via meadow REST)
										if (typeof tmpV === 'string' && tmpV !== '' && !isNaN(Number(tmpV))) tmpV = Number(tmpV);
										if (tmpV === undefined || tmpV === null) continue;
										tmpVals.push(tmpV);
									}
									let tmpAggValue = null;
									switch (tmpFn)
									{
										case 'count':
											tmpAggValue = (tmpSrc === '*' || !tmpSrc) ? tmpGroup.Rows.length : tmpVals.length;
											break;
										case 'sum':
											tmpAggValue = tmpVals.reduce((s, v) => s + Number(v), 0);
											break;
										case 'mean': case 'avg': case 'average':
											tmpAggValue = tmpVals.length === 0 ? null : tmpVals.reduce((s, v) => s + Number(v), 0) / tmpVals.length;
											if (tmpAggValue !== null) tmpAggValue = Math.round(tmpAggValue * 100) / 100;
											break;
										case 'min':
											tmpAggValue = tmpVals.length === 0 ? null : tmpVals.reduce((m, v) => Number(v) < m ? Number(v) : m, Number(tmpVals[0]));
											break;
										case 'max':
											tmpAggValue = tmpVals.length === 0 ? null : tmpVals.reduce((m, v) => Number(v) > m ? Number(v) : m, Number(tmpVals[0]));
											break;
										case 'collectdistinct':
											// Distinct values joined as CSV, first-seen order
											tmpAggValue = Array.from(new Set(tmpVals.map((v) => String(v)))).join(',');
											break;
										case 'countdistinct':
											tmpAggValue = new Set(tmpVals.map((v) => String(v))).size;
											break;
										default:
											tmpAggValue = null;
									}
									tmpResult[tmpAs] = tmpAggValue;
								}

								// Resolve GUIDTemplate against the group's first
								// row (Sample) — group columns and any other
								// stable-per-group column on Sample work as
								// substitution sources. Aggregates are also in
								// scope via tmpResult so a template can reference
								// {~D:Result.AvgTempF~} too.
								if (tmpGUIDTemplate)
								{
									tmpResult[tmpGUIDName] = tmpGUIDTemplate.replace(
										/\{~D:Record\.(\w+)~\}/g,
										(_m, pField) =>
										{
											let tmpV = tmpGroup.Sample[pField];
											if (tmpV === undefined && tmpResult.hasOwnProperty(pField)) tmpV = tmpResult[pField];
											return (tmpV === undefined || tmpV === null) ? '' : String(tmpV).replace(/[^A-Za-z0-9]/g, '');
										});
								}

								tmpOut.push(tmpResult);
							}

							let tmpElapsedMs = Date.now() - tmpStartMs;
							return fHandlerCallback(null, {
								Outputs:
								{
									RecordCount: tmpOut.length,
									GroupCount:  tmpOut.length,
									ElapsedMs:   tmpElapsedMs,
									Result:      JSON.stringify(tmpOut)
								},
								Log: [`AggregateRecords: ${tmpRecords.length} input rows → ${tmpOut.length} groups across ${tmpGroupBy.length} GroupBy field(s) and ${tmpAggs.length} aggregate(s) in ${tmpElapsedMs}ms.`]
							});
						}
					},

					'HistogramRecords':
					{
						Description: 'Bucket records by a column (DateMonth / DateDay / DateYear / NumericRange) with optional secondary GroupBy, then compute aggregates per bucket × group. Output is one record per (Bucket, GroupBy) combination.',
						SettingsSchema:
						[
							{ Name: 'Records',                DataType: 'Array',  Required: true, Description: 'Source records (typically from upstream PullRecords).' },
							{ Name: 'OperationConfiguration', DataType: 'Object', Required: true, Description: '{ Entity, GUIDName?, GUIDTemplate?, BucketColumn, BucketKind: "DateMonth"|"DateDay"|"DateYear"|"NumericRange", BucketSize? (NumericRange only), GroupBy?:[], Aggregates:[{Source,Function,As}], BucketAs? (default "Bucket") }. Bundled to dodge UV template stripping.' }
						],
						Handler: function (pWorkItem, pContext, fHandlerCallback)
						{
							let tmpStartMs = Date.now();
							let tmpSettings = pWorkItem.Settings || {};
							let tmpRecords = tmpSettings.Records || [];
							let tmpCfg = tmpSettings.OperationConfiguration || {};
							if (typeof (tmpRecords) === 'string') { try { tmpRecords = JSON.parse(tmpRecords); } catch (e) { tmpRecords = []; } }
							if (typeof (tmpCfg)     === 'string') { try { tmpCfg     = JSON.parse(tmpCfg);     } catch (e) { tmpCfg = {}; } }

							let tmpEntity = tmpCfg.Entity || 'Histogram';
							let tmpGUIDName = tmpCfg.GUIDName || ('GUID' + tmpEntity);
							let tmpGUIDTemplate = tmpCfg.GUIDTemplate || '';
							let tmpBucketCol = tmpCfg.BucketColumn;
							let tmpBucketKind = tmpCfg.BucketKind || 'DateMonth';
							let tmpBucketSize = tmpCfg.BucketSize || 10;
							let tmpBucketAs = tmpCfg.BucketAs || 'Bucket';
							let tmpGroupBy = Array.isArray(tmpCfg.GroupBy) ? tmpCfg.GroupBy : [];
							let tmpAggs = Array.isArray(tmpCfg.Aggregates) ? tmpCfg.Aggregates : [];

							if (!Array.isArray(tmpRecords) || !tmpBucketCol)
							{
								return fHandlerCallback(null, {
									Outputs: { Records: [], RecordCount: 0, BucketCount: 0, ElapsedMs: 0, Result: '[]' },
									Log: [`HistogramRecords: missing Records array or BucketColumn.`]
								});
							}
							let tmpGuard = _checkRowCount('HistogramRecords', tmpRecords.length);
							if (tmpGuard) return fHandlerCallback(tmpGuard);

							// Compute the bucket key for one row.
							let fBucket = (pVal) =>
							{
								if (pVal === undefined || pVal === null || pVal === '') return null;
								if (tmpBucketKind === 'DateYear')  return String(pVal).slice(0, 4);
								if (tmpBucketKind === 'DateMonth') return String(pVal).slice(0, 7);
								if (tmpBucketKind === 'DateDay')   return String(pVal).slice(0, 10);
								if (tmpBucketKind === 'NumericRange')
								{
									let tmpN = Number(pVal);
									if (isNaN(tmpN)) return null;
									let tmpFloor = Math.floor(tmpN / tmpBucketSize) * tmpBucketSize;
									return tmpFloor + '-' + (tmpFloor + tmpBucketSize - 1);
								}
								return String(pVal);
							};

							// (Bucket, GroupBy...) → { Rows, BucketKey, GroupKey }
							let tmpBuckets = {};
							for (let i = 0; i < tmpRecords.length; i++)
							{
								let tmpRow = tmpRecords[i];
								if (!tmpRow) continue;
								let tmpBucket = fBucket(tmpRow[tmpBucketCol]);
								if (tmpBucket === null) continue;
								let tmpGroupVals = [];
								for (let g = 0; g < tmpGroupBy.length; g++)
								{
									let tmpV = tmpRow[tmpGroupBy[g]];
									tmpGroupVals.push(tmpV === undefined ? null : tmpV);
								}
								let tmpKey = JSON.stringify([tmpBucket, tmpGroupVals]);
								if (!tmpBuckets[tmpKey]) tmpBuckets[tmpKey] = { Bucket: tmpBucket, GroupVals: tmpGroupVals, Rows: [], Sample: tmpRow };
								tmpBuckets[tmpKey].Rows.push(tmpRow);
							}

							let tmpOut = [];
							let tmpBucketKeys = Object.keys(tmpBuckets);
							for (let k = 0; k < tmpBucketKeys.length; k++)
							{
								let tmpB = tmpBuckets[tmpBucketKeys[k]];
								let tmpResult = {};
								tmpResult[tmpBucketAs] = tmpB.Bucket;
								for (let g = 0; g < tmpGroupBy.length; g++)
								{
									tmpResult[tmpGroupBy[g]] = tmpB.GroupVals[g];
								}

								for (let a = 0; a < tmpAggs.length; a++)
								{
									let tmpAgg = tmpAggs[a];
									let tmpFn = String(tmpAgg.Function || tmpAgg.Op || '').toLowerCase();
									let tmpSrc = tmpAgg.Source || tmpAgg.Column;
									let tmpAs = tmpAgg.As || (tmpFn + '_' + (tmpSrc || 'col'));
									let tmpVals = [];
									for (let r = 0; r < tmpB.Rows.length; r++)
									{
										let tmpV = (tmpSrc === '*' || !tmpSrc) ? 1 : tmpB.Rows[r][tmpSrc];
										if (typeof tmpV === 'string' && tmpV !== '' && !isNaN(Number(tmpV))) tmpV = Number(tmpV);
										if (tmpV === undefined || tmpV === null) continue;
										tmpVals.push(tmpV);
									}
									let tmpAggValue = null;
									switch (tmpFn)
									{
										case 'count':
											tmpAggValue = (tmpSrc === '*' || !tmpSrc) ? tmpB.Rows.length : tmpVals.length;
											break;
										case 'sum':
											tmpAggValue = tmpVals.reduce((s, v) => s + Number(v), 0);
											break;
										case 'mean': case 'avg': case 'average':
											tmpAggValue = tmpVals.length === 0 ? null : tmpVals.reduce((s, v) => s + Number(v), 0) / tmpVals.length;
											if (tmpAggValue !== null) tmpAggValue = Math.round(tmpAggValue * 100) / 100;
											break;
										case 'min':
											tmpAggValue = tmpVals.length === 0 ? null : tmpVals.reduce((m, v) => Number(v) < m ? Number(v) : m, Number(tmpVals[0]));
											break;
										case 'max':
											tmpAggValue = tmpVals.length === 0 ? null : tmpVals.reduce((m, v) => Number(v) > m ? Number(v) : m, Number(tmpVals[0]));
											break;
										case 'collectdistinct':
											// Distinct values joined as CSV, first-seen order
											tmpAggValue = Array.from(new Set(tmpVals.map((v) => String(v)))).join(',');
											break;
										case 'countdistinct':
											tmpAggValue = new Set(tmpVals.map((v) => String(v))).size;
											break;
										default:
											tmpAggValue = null;
									}
									tmpResult[tmpAs] = tmpAggValue;
								}

								if (tmpGUIDTemplate)
								{
									tmpResult[tmpGUIDName] = tmpGUIDTemplate.replace(
										/\{~D:Record\.(\w+)~\}/g,
										(_m, pField) =>
										{
											let tmpV = tmpResult[pField];
											if (tmpV === undefined && tmpB.Sample) tmpV = tmpB.Sample[pField];
											return (tmpV === undefined || tmpV === null) ? '' : String(tmpV).replace(/[^A-Za-z0-9_]/g, '_');
										});
								}
								tmpOut.push(tmpResult);
							}

							// Sort by bucket then group for stable output (helps idempotence + dashboard charts).
							tmpOut.sort((a, b) =>
							{
								let tmpAk = a[tmpBucketAs] + '|' + JSON.stringify(tmpGroupBy.map((g) => a[g]));
								let tmpBk = b[tmpBucketAs] + '|' + JSON.stringify(tmpGroupBy.map((g) => b[g]));
								return tmpAk < tmpBk ? -1 : tmpAk > tmpBk ? 1 : 0;
							});

							let tmpElapsedMs = Date.now() - tmpStartMs;
							return fHandlerCallback(null, {
								Outputs:
								{
									RecordCount: tmpOut.length,
									BucketCount: tmpOut.length,
									ElapsedMs:   tmpElapsedMs,
									Result:      JSON.stringify(tmpOut)
								},
								Log: [`HistogramRecords: ${tmpRecords.length} rows → ${tmpOut.length} (Bucket × Group) cells via ${tmpBucketKind} on ${tmpBucketCol} in ${tmpElapsedMs}ms.`]
							});
						}
					},

					'IntersectRecords':
					{
						Description: 'Join SourceRecords × RelatedRecords on a key, optionally OrderBy the related side and Limit per Source row, project a merged namespace (Source fields win on collision; Related fields override only when missing on Source). Use Limit=1 for enrichment-style joins (one related row attached per source); higher Limit + OrderBy for "latest N per X" patterns.',
						SettingsSchema:
						[
							{ Name: 'SourceRecords',          DataType: 'Array',  Required: true, Description: 'Records from the source pull.' },
							{ Name: 'RelatedRecords',         DataType: 'Array',  Required: true, Description: 'Records from the related pull.' },
							{ Name: 'OperationConfiguration', DataType: 'Object', Required: true, Description: '{ Entity, GUIDName?, GUIDTemplate?, JoinOn:{SourceField,RelatedField}, OrderBy?:[{Field,Direction}], Limit? (default unlimited), Projection }. Bundled to dodge UV template stripping.' }
						],
						Handler: function (pWorkItem, pContext, fHandlerCallback)
						{
							let tmpStartMs = Date.now();
							let tmpSettings = pWorkItem.Settings || {};
							let tmpSource = tmpSettings.SourceRecords || [];
							let tmpRelated = tmpSettings.RelatedRecords || [];
							let tmpCfg = tmpSettings.OperationConfiguration || {};
							if (typeof (tmpSource)  === 'string') { try { tmpSource  = JSON.parse(tmpSource);  } catch (e) { tmpSource  = []; } }
							if (typeof (tmpRelated) === 'string') { try { tmpRelated = JSON.parse(tmpRelated); } catch (e) { tmpRelated = []; } }
							if (typeof (tmpCfg)     === 'string') { try { tmpCfg     = JSON.parse(tmpCfg);     } catch (e) { tmpCfg     = {}; } }

							let tmpEntity = tmpCfg.Entity || 'Intersection';
							let tmpGUIDName = tmpCfg.GUIDName || ('GUID' + tmpEntity);
							let tmpGUIDTemplate = tmpCfg.GUIDTemplate || '';
							let tmpJoin = tmpCfg.JoinOn || {};
							let tmpSrcField = tmpJoin.SourceField || 'ID';
							let tmpRelField = tmpJoin.RelatedField || 'ID';
							let tmpOrderBy = Array.isArray(tmpCfg.OrderBy) ? tmpCfg.OrderBy : [];
							let tmpLimit = tmpCfg.Limit || 0;
							let tmpProjection = tmpCfg.Projection || {};

							if (!Array.isArray(tmpSource) || !Array.isArray(tmpRelated))
							{
								return fHandlerCallback(null, {
									Outputs: { Records: [], RecordCount: 0, MatchedSourceCount: 0, UnmatchedSourceCount: 0, ElapsedMs: 0, Result: '[]' },
									Log: [`IntersectRecords: SourceRecords or RelatedRecords missing.`]
								});
							}
							// Guard both sides — Intersection holds source AND
							// related fully in memory (the related index is ~O(R)
							// and the per-source loop pulls into match arrays).
							let tmpGuardS = _checkRowCount('IntersectRecords (Source)', tmpSource.length);
							if (tmpGuardS) return fHandlerCallback(tmpGuardS);
							let tmpGuardR = _checkRowCount('IntersectRecords (Related)', tmpRelated.length);
							if (tmpGuardR) return fHandlerCallback(tmpGuardR);

							// Index Related rows by RelatedField → [rows].
							let tmpIndex = {};
							for (let i = 0; i < tmpRelated.length; i++)
							{
								let tmpRow = tmpRelated[i];
								if (!tmpRow) continue;
								let tmpKey = String(tmpRow[tmpRelField]);
								if (!tmpIndex[tmpKey]) tmpIndex[tmpKey] = [];
								tmpIndex[tmpKey].push(tmpRow);
							}

							let tmpProjKeys = Object.keys(tmpProjection);
							let tmpOut = [];
							let tmpMatchedCount = 0;
							let tmpUnmatchedCount = 0;

							for (let s = 0; s < tmpSource.length; s++)
							{
								let tmpSrc = tmpSource[s];
								if (!tmpSrc) continue;
								let tmpKey = String(tmpSrc[tmpSrcField]);
								let tmpMatches = (tmpIndex[tmpKey] || []).slice();
								if (tmpMatches.length === 0)
								{
									tmpUnmatchedCount++;
									continue;
								}
								tmpMatchedCount++;

								// Sort matches per OrderBy (stable, multi-key).
								if (tmpOrderBy.length > 0)
								{
									tmpMatches.sort((a, b) =>
									{
										for (let o = 0; o < tmpOrderBy.length; o++)
										{
											let tmpOrd = tmpOrderBy[o];
											let tmpFld = tmpOrd.Field;
											let tmpDir = String(tmpOrd.Direction || 'ASC').toUpperCase() === 'DESC' ? -1 : 1;
											let tmpAv = a[tmpFld];
											let tmpBv = b[tmpFld];
											if (tmpAv === tmpBv) continue;
											if (tmpAv === undefined || tmpAv === null) return 1 * tmpDir;
											if (tmpBv === undefined || tmpBv === null) return -1 * tmpDir;
											return (tmpAv < tmpBv ? -1 : 1) * tmpDir;
										}
										return 0;
									});
								}

								if (tmpLimit > 0) tmpMatches = tmpMatches.slice(0, tmpLimit);

								// Emit one record per (source × matched related).
								for (let m = 0; m < tmpMatches.length; m++)
								{
									let tmpRel = tmpMatches[m];
									// Flat namespace per §6 Q3 decision: Related
									// fields fill where Source has none; Source
									// wins on collision (so the source row's
									// identity columns aren't clobbered).
									let tmpMerged = Object.assign({}, tmpRel, tmpSrc);
									let tmpProjected = {};
									for (let p = 0; p < tmpProjKeys.length; p++)
									{
										let tmpExpr = tmpProjection[tmpProjKeys[p]];
										if (typeof tmpExpr === 'string')
										{
											// Accept three prefixes — Record.X (merged
											// namespace, Source-wins-on-collision per
											// §6 Q3), Source.X (force the source side),
											// and Related.X (force the related side).
											// Without Related/Source explicit access,
											// any related field whose name collides
											// with a source field is unreachable, and a
											// projection that uses {~D:Related.X~}
											// would otherwise pass through as a literal
											// string and crash the upsert (HTTP 200
											// from the bulk endpoint, but every row
											// errors with "invalid input syntax").
											let tmpMatchTpl = tmpExpr.match(/^\{~D:(Record|Source|Related)\.(\w+)~\}$/);
											if (tmpMatchTpl)
											{
												let tmpScope = tmpMatchTpl[1];
												let tmpField = tmpMatchTpl[2];
												let tmpLookup = (tmpScope === 'Source') ? tmpSrc
													: (tmpScope === 'Related') ? tmpRel
													: tmpMerged;
												tmpProjected[tmpProjKeys[p]] = tmpLookup[tmpField];
											}
											else if (tmpMerged.hasOwnProperty(tmpExpr)) { tmpProjected[tmpProjKeys[p]] = tmpMerged[tmpExpr]; }
											else { tmpProjected[tmpProjKeys[p]] = tmpExpr; }
										}
										else { tmpProjected[tmpProjKeys[p]] = tmpExpr; }
									}
									if (tmpGUIDTemplate)
									{
										tmpProjected[tmpGUIDName] = tmpGUIDTemplate.replace(
											/\{~D:(Record|Source|Related)\.(\w+)~\}/g,
											(_m, pScope, pField) =>
											{
												let tmpLookup = (pScope === 'Source') ? tmpSrc
													: (pScope === 'Related') ? tmpRel
													: tmpMerged;
												let tmpVal = tmpLookup[pField];
												return (tmpVal === undefined || tmpVal === null) ? '' : String(tmpVal).replace(/[^A-Za-z0-9_]/g, '_');
											});
									}
									tmpOut.push(tmpProjected);
								}
							}

							let tmpElapsedMs = Date.now() - tmpStartMs;
							return fHandlerCallback(null, {
								Outputs:
								{
									RecordCount:          tmpOut.length,
									MatchedSourceCount:   tmpMatchedCount,
									UnmatchedSourceCount: tmpUnmatchedCount,
									ElapsedMs:            tmpElapsedMs,
									Result:               JSON.stringify(tmpOut)
								},
								Log: [`IntersectRecords: ${tmpSource.length} source × ${tmpRelated.length} related → ${tmpOut.length} joined rows (${tmpMatchedCount} sources matched, ${tmpUnmatchedCount} unmatched, Limit=${tmpLimit || '∞'}) in ${tmpElapsedMs}ms.`]
							});
						}
					},

					'BuildComprehension':
					{
						Description: 'Accumulate mapped records into a comprehension keyed by GUID',
						SettingsSchema:
						[
							{ Name: 'Records', DataType: 'Array', Required: true, Description: 'Mapped records to accumulate' },
							{ Name: 'Entity', DataType: 'String', Required: true, Description: 'Entity name for the comprehension key' },
							{ Name: 'GUIDField', DataType: 'String', Required: true, Description: 'Field used as the unique key' }
						],
						Handler: function (pWorkItem, pContext, fHandlerCallback)
						{
							let tmpSettings = pWorkItem.Settings || {};
							let tmpRecords = tmpSettings.Records || [];
							let tmpEntity = tmpSettings.Entity;
							let tmpGUIDField = tmpSettings.GUIDField;

							if (typeof (tmpRecords) === 'string')
							{
								try { tmpRecords = JSON.parse(tmpRecords); } catch (e) { tmpRecords = []; }
							}

							let tmpComprehension = {};
							tmpComprehension[tmpEntity] = {};

							for (let i = 0; i < tmpRecords.length; i++)
							{
								let tmpRecord = tmpRecords[i];
								let tmpKey = (tmpGUIDField && tmpRecord[tmpGUIDField])
									? String(tmpRecord[tmpGUIDField])
									: `record-${i}`;
								tmpComprehension[tmpEntity][tmpKey] = tmpRecord;
							}

							return fHandlerCallback(null, {
								Outputs:
								{
									Comprehension: tmpComprehension,
									RecordCount: tmpRecords.length
								},
								Log: [`BuildComprehension: accumulated ${tmpRecords.length} records into entity [${tmpEntity}].`]
							});
						}
					}
				}
			});

		this.log.info('DataMapperBeaconProvider: registered 4 capabilities (DataMapperSource, DataMapperManagement, DataMapperRecords, DataMapperTransform) with 12 actions.');
	}
}

module.exports = DataMapperBeaconProvider;
// Exposed for unit testing — pure helper, no instance state.
module.exports._buildSortFilter = _buildSortFilter;
module.exports._unnestRecordsHandler = _unnestRecordsHandler;
module.exports._unnestGetByPath = _unnestGetByPath;
