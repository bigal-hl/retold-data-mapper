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
	 * @param {string} pUltravisorURL — e.g. "http://localhost:18422"
	 */
	configureClient(pUltravisorURL)
	{
		this.fable.serviceManager.addServiceTypeIfNotExists('UltravisorClient', libFableUltravisorClient);
		this._Client = this.fable.serviceManager.instantiateServiceProvider('UltravisorClient',
			{
				UltravisorURL: pUltravisorURL,
				UserName: 'data-mapper',
				Password: ''
			});

		this._Client.authenticate((pError) =>
		{
			if (pError)
			{
				this.log.error(`DataMapperBeaconProvider: client auth failed — ${pError.message}`);
			}
			else
			{
				this.log.info(`DataMapperBeaconProvider: client authenticated against ${pUltravisorURL}`);
			}
		});
	}

	/**
	 * Dispatch a work item to another beacon via the Ultravisor.
	 */
	_dispatch(pWorkItem, fCallback)
	{
		if (!this._Client)
		{
			return fCallback(new Error('DataMapperBeaconProvider: UltravisorClient not configured. Call configureClient() first.'));
		}
		this._Client.dispatch(pWorkItem, fCallback);
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
							{ Name: 'FilterExpression', DataType: 'String', Required: false, Description: 'Meadow filter (e.g. FBV~Field~EQ~Value); spliced into URL as /FilteredTo/<expr>' }
						],
						Handler: function (pWorkItem, pContext, fHandlerCallback)
						{
							let tmpStartMs = Date.now();
							let tmpSettings = pWorkItem.Settings || {};
							let tmpBeaconName = tmpSettings.SourceBeaconName;
							let tmpConnectionHash = tmpSettings.ConnectionHash;
							let tmpEntity = tmpSettings.Entity;
							let tmpBatchSize = tmpSettings.BatchSize || 500;
							let tmpFilterSegment = tmpSettings.FilterExpression
								? '/FilteredTo/' + tmpSettings.FilterExpression
								: '';

							if (!tmpSelf._Client || !tmpBeaconName || !tmpConnectionHash || !tmpEntity)
							{
								return fHandlerCallback(null, {
									Outputs: { Records: [], RecordCount: 0, ElapsedMs: 0 },
									Log: ['PullRecords: missing required settings.']
								});
							}

							// Paginated read
							let tmpAllRecords = [];
							let tmpOffset = 0;

							let fReadBatch = () =>
							{
								let tmpPath = `/1.0/${tmpConnectionHash}/${tmpEntity}s${tmpFilterSegment}/${tmpOffset}/${tmpBatchSize}`;

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
							{ Name: 'Concurrency',      DataType: 'Number', Required: false, Description: 'How many bulk Upserts chunks to keep in flight concurrently. Default 1 (preserves the original sequential behavior — backwards-compatible). Clamped to [1, 5]: meadow-endpoints\' /Upserts handler processes its rows strictly serially per request, so client-side parallelism is the only knob for raw throughput, but each worker takes a postgres connection from the target beacon\'s pool — keeping the cap modest avoids starving other tenants of the lake. Compilers (typed-op Write nodes) opt in explicitly; ad-hoc /Upserts callers stay at 1.' }
						],
						Handler: function (pWorkItem, pContext, fHandlerCallback)
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
									return fHandlerCallback(null, {
										Outputs: {
											Written:          tmpTotalWritten,
											Errors:           tmpTotalErrors,
											ErrorLog:         tmpErrorLog,
											EntitiesWritten:  tmpEntitiesWritten,
											PerEntity:        tmpEntityCounts,
											ElapsedMs:        tmpElapsedMs
										},
										Log: [`WriteRecords (Upsert → ${tmpBeaconName}/${tmpConnHash}): ${tmpTotalWritten} written across ${tmpEntitiesWritten.length} entity(ies), ${tmpTotalErrors} errors, in ${tmpElapsedMs}ms.`]
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
								let tmpEntityWritten = 0;
								let tmpEntityErrors  = 0;
								let tmpChunkOffset = 0;
								let tmpInFlight = 0;
								let tmpDoneSignaled = false;

								let fSignalEntityDone = () =>
								{
									if (tmpDoneSignaled) return;
									tmpDoneSignaled = true;
									if (tmpEntityWritten > 0) tmpEntitiesWritten.push(tmpEntity);
									tmpTotalWritten += tmpEntityWritten;
									tmpTotalErrors  += tmpEntityErrors;
									tmpEntityCounts[tmpEntity] = { Written: tmpEntityWritten, Errors: tmpEntityErrors };
									return fNextEntity();
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
													// meadow's bulk Upserts returns
													// an ack array of length =
													// input length on success.
													tmpEntityWritten += tmpChunkLen;
												}
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
								Solvers:      []
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

					'AggregateRecords':
					{
						Description: 'Group records by GroupBy keys, compute aggregates (Sum / Count / Mean / Min / Max) per group, project a deterministic GUID per group. Output is one record per unique GroupBy combination, with columns = GroupBy ∪ Aggregates.As ∪ GUID.',
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
											let tmpMatch = tmpExpr.match(/^\{~D:Record\.(\w+)~\}$/);
											if (tmpMatch) { tmpProjected[tmpProjKeys[p]] = tmpMerged[tmpMatch[1]]; }
											else if (tmpMerged.hasOwnProperty(tmpExpr)) { tmpProjected[tmpProjKeys[p]] = tmpMerged[tmpExpr]; }
											else { tmpProjected[tmpProjKeys[p]] = tmpExpr; }
										}
										else { tmpProjected[tmpProjKeys[p]] = tmpExpr; }
									}
									if (tmpGUIDTemplate)
									{
										tmpProjected[tmpGUIDName] = tmpGUIDTemplate.replace(
											/\{~D:Record\.(\w+)~\}/g,
											(_m, pField) => (tmpMerged[pField] === undefined || tmpMerged[pField] === null) ? '' : String(tmpMerged[pField]).replace(/[^A-Za-z0-9_]/g, '_'));
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

		this.log.info('DataMapperBeaconProvider: registered 3 capabilities (DataMapperSource, DataMapperRecords, DataMapperTransform) with 9 actions.');
	}
}

module.exports = DataMapperBeaconProvider;
