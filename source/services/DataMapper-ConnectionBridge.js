/**
 * DataMapper - Connection Bridge Service
 *
 * REST endpoints for the mapping editor web UI. Every call that needs to
 * reach another beacon (source / target DataBeacons) is dispatched through
 * the Ultravisor mesh via fable-ultravisor-client — the web UI never talks
 * to foreign beacons directly.
 *
 * Endpoints live under options.RoutePrefix (default: /mapper).
 *
 * @author Steven Velozo <steven@velozo.com>
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libPath = require('path');
const libFs = require('fs');

const defaultConnectionBridgeOptions = (
	{
		RoutePrefix: '/mapper'
	});

// Configs-databeacon bootstrap defaults. The beacon name is fixed by
// the bridge's REST handlers (they hardcode AffinityKey='configs-databeacon')
// so anything else here would mismatch. The connection name is what
// shows up as the URL slug in /1.0/<connection-slug>/<table>/... — the
// existing handlers all reference 'platform-configs', so it's fixed too.
const CONFIGS_BEACON_NAME = 'configs-databeacon';
const CONFIGS_CONNECTION_NAME = 'platform-configs';
const CONFIGS_SCHEMA_FILES = ['OperationConfigSchema.json', 'DashboardConfigSchema.json'];

// Env var name for declarative additional-beacon connection provisioning.
// Value is a JSON array of { BeaconName, ConnectionName, Type, Config,
// AutoConnect, Description } entries. Each entry results in an idempotent
// DataBeaconManagement.CreateConnection dispatch against BeaconName at
// data-mapper startup. Used to make the data-platform stack zero-touch:
// without this, lake-databeacon / opdb-databeacon would have no connection
// at boot, every Pull→Write would 405, and the operator would have to wire
// each beacon by hand through its own admin UI.
const BOOTSTRAP_CONNECTIONS_ENV = 'RETOLD_DATA_MAPPER_BOOTSTRAP_CONNECTIONS';

class DataMapperConnectionBridge extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, defaultConnectionBridgeOptions, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'DataMapperConnectionBridge';

		// Set by Retold-DataMapper.initializeService — needed so we can reach
		// the Ultravisor client that lives on the owner service.
		this._Owner = null;
	}

	setOwner(pOwnerService)
	{
		this._Owner = pOwnerService;
	}

	_client()
	{
		return this._Owner ? this._Owner.getUltravisorClient() : null;
	}

	_dispatch(pWorkItem, fCallback)
	{
		let tmpClient = this._client();
		if (!tmpClient)
		{
			return fCallback(new Error('Not connected to an Ultravisor'));
		}
		return tmpClient.dispatch(pWorkItem, fCallback);
	}

	_request(pMethod, pPath, pBody, fCallback)
	{
		let tmpClient = this._client();
		if (!tmpClient)
		{
			return fCallback(new Error('Not connected to an Ultravisor'));
		}
		return tmpClient.request(pMethod, pPath, pBody, fCallback);
	}

	_sendError(pResponse, pStatus, pMessage, fNext)
	{
		pResponse.send(pStatus || 500, { Error: pMessage });
		return fNext();
	}

	/**
	 * Send an HTTP request to a beacon's local REST surface, proxied
	 * through the UV mesh via the MeadowProxy capability. Same shape the
	 * route handlers use; exposed as a method so the bootstrap can share
	 * it without duplicating the dispatch envelope.
	 */
	_meadowProxyRequest(pBeaconName, pMethod, pPath, pBody, fCb)
	{
		this._dispatch(
			{
				Capability: 'MeadowProxy',
				Action: 'Request',
				Settings:
				{
					Method:     pMethod,
					Path:       pPath,
					Body:       (pBody === undefined || pBody === null) ? '' : (typeof pBody === 'string' ? pBody : JSON.stringify(pBody)),
					RemoteUser: ''
				},
				AffinityKey: pBeaconName,
				TimeoutMs:   30000
			},
			(pError, pResult) =>
			{
				if (pError) return fCb(pError);
				let tmpOutputs = (pResult && pResult.Outputs) || pResult || {};
				let tmpStatus = tmpOutputs.Status;
				let tmpBody = tmpOutputs.Body;
				if (typeof tmpStatus === 'number' && tmpStatus >= 400)
				{
					let tmpSnippet = (typeof tmpBody === 'string') ? tmpBody.slice(0, 200) : '';
					return fCb(new Error('beacon ' + pBeaconName + ' returned ' + tmpStatus + ': ' + tmpSnippet));
				}
				if (typeof tmpBody === 'string' && tmpBody)
				{
					try { return fCb(null, JSON.parse(tmpBody)); }
					catch (pErr) { return fCb(new Error('beacon ' + pBeaconName + ' returned non-JSON: ' + pErr.message)); }
				}
				return fCb(null, tmpBody);
			});
	}

	/**
	 * Idempotent self-bootstrap of the configs-databeacon. Ensures:
	 *   1. A SQLite connection named "platform-configs" exists and is connected
	 *   2. The OperationConfig + DashboardConfig tables exist with their
	 *      dynamic REST endpoints enabled
	 *
	 * Called from Retold-DataMapper.connectUltravisor() after the UV client
	 * has authenticated. Skipped silently if the configs-databeacon isn't
	 * registered yet (mesh not fully up); the operator can re-trigger via
	 * POST /mapper/admin/bootstrap-configs.
	 *
	 * Failures are LOGGED and surfaced to the callback but do not crash
	 * startup — the data-mapper still serves /mapper/mappings (internal
	 * SQLite) even if the configs-databeacon isn't reachable, and the
	 * bootstrap can be retried by hand.
	 */
	bootstrapConfigsBeacon(fCallback)
	{
		let tmpSelf = this;
		this.fable.log.info('DataMapper bootstrap: starting configs-databeacon provisioning...');

		// List connections via the typed DataBeaconAccess capability — the
		// MeadowProxy /beacon/* paths are correctly allowlist-blocked
		// (those are databeacon-internal management routes, not customer
		// data). This is the only way to enumerate connections via the mesh.
		this._dispatch(
			{
				Capability: 'DataBeaconAccess',
				Action:     'ListConnections',
				Settings:   {},
				AffinityKey: CONFIGS_BEACON_NAME,
				TimeoutMs:   15000
			},
			(pListErr, pResult) =>
			{
				if (pListErr)
				{
					tmpSelf.fable.log.warn(`DataMapper bootstrap: list connections failed (${pListErr.message}). Will still try eager-registration in case data exists.`);
					return tmpSelf._bootstrapEagerRegisterAll(fCallback);
				}
				let tmpOutputs = (pResult && pResult.Outputs) || pResult || {};
				let tmpConnections = tmpOutputs.Connections || [];
				let tmpExisting = tmpConnections.find((c) => c && c.Name === CONFIGS_CONNECTION_NAME);
				if (tmpExisting && tmpExisting.IDBeaconConnection)
				{
					tmpSelf.fable.log.info(`DataMapper bootstrap: connection [${CONFIGS_CONNECTION_NAME}] already present (id=${tmpExisting.IDBeaconConnection}).`);
					return tmpSelf._bootstrapEnsureSchemas(tmpExisting.IDBeaconConnection, (pSchemaErr) =>
					{
						// Schemas done (or failed warn-only); always proceed to
						// eager-register so existing ops show in UV's /Operation.
						return tmpSelf._bootstrapEagerRegisterAll(fCallback);
					});
				}

				// No connection yet — create via the typed
				// DataBeaconManagement.CreateConnection capability (added in
				// retold-databeacon 1.0.2). Idempotent: if it sneaked in
				// between ListConnections and now, the handler returns the
				// existing IDBeaconConnection. AutoConnect:true brings the
				// runtime up + restores any flagged dynamic endpoints.
				tmpSelf.fable.log.info(`DataMapper bootstrap: connection [${CONFIGS_CONNECTION_NAME}] not found — creating via DataBeaconManagement.CreateConnection.`);
				tmpSelf._dispatch(
					{
						Capability: 'DataBeaconManagement',
						Action:     'CreateConnection',
						Settings:
						{
							Name:        CONFIGS_CONNECTION_NAME,
							Type:        'SQLite',
							Config:      { SQLiteFilePath: '/app/data/platform-configs.sqlite' },
							AutoConnect: true,
							Description: 'Auto-provisioned by retold-data-mapper. Hosts OperationConfig + DashboardConfig tables.'
						},
						AffinityKey: CONFIGS_BEACON_NAME,
						TimeoutMs:   30000
					},
					(pCreateErr, pCreateRes) =>
					{
						if (pCreateErr)
						{
							// Likely a pre-1.0.2 databeacon image without the
							// new capability. Fall back to the operator-action
							// instructions; eager-register pass still runs.
							tmpSelf.fable.log.warn(
								`DataMapper bootstrap: CreateConnection dispatch failed (${pCreateErr.message}). ` +
								`Likely an older databeacon image without the typed capability. ` +
								`Operator can create it via: POST http://<configs-databeacon>:8389/beacon/connection ` +
								`{Name: "${CONFIGS_CONNECTION_NAME}", Type: "SQLite", Config: {SQLiteFilePath: "/app/data/platform-configs.sqlite"}, AutoConnect: true}, ` +
								`then POST /mapper/admin/bootstrap-configs.`);
							return tmpSelf._bootstrapEagerRegisterAll(fCallback);
						}
						let tmpCreateOut = (pCreateRes && pCreateRes.Outputs) || pCreateRes || {};
						let tmpNewID = tmpCreateOut.IDBeaconConnection;
						if (!tmpNewID)
						{
							tmpSelf.fable.log.warn('DataMapper bootstrap: CreateConnection returned no IDBeaconConnection — skipping schema step.');
							return tmpSelf._bootstrapEagerRegisterAll(fCallback);
						}
						tmpSelf.fable.log.info(`DataMapper bootstrap: created connection [${CONFIGS_CONNECTION_NAME}] (id=${tmpNewID}, created=${tmpCreateOut.Created}, connected=${tmpCreateOut.Connected}).`);
						return tmpSelf._bootstrapEnsureSchemas(tmpNewID, () =>
						{
							return tmpSelf._bootstrapEagerRegisterAll(fCallback);
						});
					});
			});
	}

	/**
	 * Provision additional databeacon connections declared in the
	 * RETOLD_DATA_MAPPER_BOOTSTRAP_CONNECTIONS env var. Each entry triggers
	 * an idempotent DataBeaconManagement.CreateConnection dispatch against
	 * the named beacon. Skipped silently when the env var is absent or
	 * empty (e.g. solo data-mapper deployments that don't want lake/opdb
	 * auto-wired).
	 *
	 * Entry shape (JSON array):
	 *   [{ BeaconName: "lake-databeacon",
	 *      ConnectionName: "lake-main",
	 *      Type: "PostgreSQL",
	 *      Config: { Host, Port, Database, User, Password, ... },
	 *      AutoConnect: true,
	 *      Description: "..." },
	 *    ...]
	 *
	 * Each entry is processed serially. Per-entry failures are logged
	 * warn-only and do not block subsequent entries — a missing or
	 * unreachable beacon shouldn't sabotage other provisioning.
	 *
	 * fCallback fires once when all entries are processed (no error).
	 */
	bootstrapAdditionalBeacons(fCallback)
	{
		let tmpSelf = this;
		let tmpRaw = process.env[BOOTSTRAP_CONNECTIONS_ENV];
		if (!tmpRaw || !tmpRaw.trim())
		{
			return fCallback(null, { Skipped: true, Reason: 'env var not set' });
		}

		let tmpEntries;
		try { tmpEntries = JSON.parse(tmpRaw); }
		catch (pParseErr)
		{
			tmpSelf.fable.log.warn(
				`DataMapper bootstrap: ${BOOTSTRAP_CONNECTIONS_ENV} is not valid JSON ` +
				`(${pParseErr.message}). Skipping additional-beacon provisioning. ` +
				`Expected a JSON array of {BeaconName, ConnectionName, Type, Config, AutoConnect, Description}.`);
			return fCallback(null, { Skipped: true, Reason: 'invalid JSON' });
		}
		if (!Array.isArray(tmpEntries) || tmpEntries.length === 0)
		{
			return fCallback(null, { Skipped: true, Reason: 'empty array' });
		}

		tmpSelf.fable.log.info(`DataMapper bootstrap: provisioning ${tmpEntries.length} additional-beacon connection(s) from ${BOOTSTRAP_CONNECTIONS_ENV}.`);

		let tmpReport = { Created: [], AlreadyPresent: [], Failed: [] };
		let tmpIdx = 0;
		let fNext = () =>
		{
			if (tmpIdx >= tmpEntries.length)
			{
				tmpSelf.fable.log.info(
					`DataMapper bootstrap: additional-beacon provisioning done — ` +
					`${tmpReport.Created.length} created, ${tmpReport.AlreadyPresent.length} already present, ` +
					`${tmpReport.Failed.length} failed.`);
				return fCallback(null, tmpReport);
			}
			let tmpEntry = tmpEntries[tmpIdx++];
			tmpSelf._provisionOneBeaconConnection(tmpEntry, (pErr, pOutcome) =>
			{
				if (pErr)
				{
					tmpReport.Failed.push({ BeaconName: tmpEntry.BeaconName, ConnectionName: tmpEntry.ConnectionName, Error: pErr.message });
				}
				else if (pOutcome && pOutcome.AlreadyPresent)
				{
					tmpReport.AlreadyPresent.push({ BeaconName: tmpEntry.BeaconName, ConnectionName: tmpEntry.ConnectionName, IDBeaconConnection: pOutcome.IDBeaconConnection });
				}
				else
				{
					tmpReport.Created.push({ BeaconName: tmpEntry.BeaconName, ConnectionName: tmpEntry.ConnectionName, IDBeaconConnection: pOutcome && pOutcome.IDBeaconConnection });
				}
				return fNext();
			});
		};
		fNext();
	}

	/**
	 * Idempotent provisioning of a single (beacon, connection) pair.
	 * Lists connections first; only dispatches CreateConnection when no
	 * matching name is present. Silent skip when the entry is malformed
	 * (missing BeaconName / ConnectionName / Type) — log a warn so the
	 * operator can find it.
	 */
	_provisionOneBeaconConnection(pEntry, fCallback)
	{
		let tmpSelf = this;
		if (!pEntry || !pEntry.BeaconName || !pEntry.ConnectionName || !pEntry.Type)
		{
			tmpSelf.fable.log.warn(
				`DataMapper bootstrap: skipping malformed connection entry — ` +
				`requires BeaconName, ConnectionName, Type. Got: ${JSON.stringify(pEntry)}`);
			return fCallback(null, { Skipped: true });
		}

		let tmpBeacon = pEntry.BeaconName;
		let tmpName   = pEntry.ConnectionName;

		tmpSelf._dispatch(
			{
				Capability:  'DataBeaconAccess',
				Action:      'ListConnections',
				Settings:    {},
				AffinityKey: tmpBeacon,
				TimeoutMs:   15000
			},
			(pListErr, pListResult) =>
			{
				if (pListErr)
				{
					tmpSelf.fable.log.warn(`DataMapper bootstrap: ListConnections on [${tmpBeacon}] failed (${pListErr.message}); attempting CreateConnection anyway (handler is idempotent).`);
				}
				let tmpOutputs = (pListResult && pListResult.Outputs) || pListResult || {};
				let tmpExisting = (tmpOutputs.Connections || []).find((c) => c && c.Name === tmpName);
				if (tmpExisting && tmpExisting.IDBeaconConnection)
				{
					tmpSelf.fable.log.info(`DataMapper bootstrap: connection [${tmpBeacon}/${tmpName}] already present (id=${tmpExisting.IDBeaconConnection}).`);
					return fCallback(null, { AlreadyPresent: true, IDBeaconConnection: tmpExisting.IDBeaconConnection });
				}

				tmpSelf.fable.log.info(`DataMapper bootstrap: creating connection [${tmpBeacon}/${tmpName}] (Type=${pEntry.Type}).`);
				tmpSelf._dispatch(
					{
						Capability:  'DataBeaconManagement',
						Action:      'CreateConnection',
						Settings:
						{
							Name:        tmpName,
							Type:        pEntry.Type,
							Config:      pEntry.Config || {},
							AutoConnect: pEntry.AutoConnect !== false,
							Description: pEntry.Description || `Auto-provisioned by retold-data-mapper bootstrap.`
						},
						AffinityKey: tmpBeacon,
						TimeoutMs:   30000
					},
					(pCreateErr, pCreateRes) =>
					{
						if (pCreateErr)
						{
							tmpSelf.fable.log.warn(
								`DataMapper bootstrap: CreateConnection [${tmpBeacon}/${tmpName}] failed (${pCreateErr.message}). ` +
								`The data-mapper will continue, but operations targeting this connection will return HTTP 405 ` +
								`until the connection is created (e.g. via the beacon's web UI).`);
							return fCallback(pCreateErr);
						}
						let tmpCreateOut = (pCreateRes && pCreateRes.Outputs) || pCreateRes || {};
						let tmpNewID = tmpCreateOut.IDBeaconConnection;
						tmpSelf.fable.log.info(`DataMapper bootstrap: created connection [${tmpBeacon}/${tmpName}] (id=${tmpNewID}, created=${tmpCreateOut.Created}, connected=${tmpCreateOut.Connected}).`);
						return fCallback(null, { IDBeaconConnection: tmpNewID });
					});
			});
	}

	/**
	 * Walk every OperationConfig on configs-databeacon and ensure each is
	 * registered as a UV Operation graph. Idempotent — _eagerRegisterOperationGraph
	 * cache-hits when the compile hash already matches. Run on every
	 * data-mapper startup so a UV restart (which clears its in-memory
	 * /Operation registry) auto-recovers without operator intervention.
	 */
	_bootstrapEagerRegisterAll(fCallback)
	{
		let tmpSelf = this;
		// Use the same MeadowProxy path the bridge's /mapper/operations
		// reader uses — allowlisted, returns the OperationConfig rows.
		this._meadowProxyRequest(CONFIGS_BEACON_NAME, 'GET',
			'/1.0/platform-configs/OperationConfigs/0/1000', null,
			(pErr, pRows) =>
			{
				if (pErr)
				{
					tmpSelf.fable.log.warn(`DataMapper bootstrap: skipping eager-register pass — ${pErr.message}. Existing operations will compile + register on first run instead.`);
					return fCallback(null);
				}
				let tmpRows = Array.isArray(pRows) ? pRows.filter((r) => r && !r.Deleted) : [];
				if (tmpRows.length === 0)
				{
					tmpSelf.fable.log.info('DataMapper bootstrap: no OperationConfigs to eager-register.');
					return fCallback(null);
				}

				// Probe UV's /Operation list. UV's registry is in-memory, so a
				// UV restart wipes it without invalidating our per-row
				// CompiledOperationHash cache. If UV doesn't currently know
				// about a hash, force a re-register for that row instead of
				// trusting the stale cache.
				tmpSelf._request('GET', '/Operation', null, (pUVErr, pUVList) =>
				{
					let tmpUVHashes = {};
					if (!pUVErr && Array.isArray(pUVList))
					{
						for (let i = 0; i < pUVList.length; i++)
						{
							if (pUVList[i] && pUVList[i].Hash) tmpUVHashes[pUVList[i].Hash] = true;
						}
					}

					tmpSelf.fable.log.info(`DataMapper bootstrap: eager-registering ${tmpRows.length} OperationConfig${tmpRows.length === 1 ? '' : 's'} with UV (UV currently knows ${Object.keys(tmpUVHashes).length} graph${Object.keys(tmpUVHashes).length === 1 ? '' : 's'})...`);

					let tmpIdx = 0;
					let tmpRegistered = 0;
					let tmpCacheHits = 0;
					let tmpFailed = 0;
					let fNext = () =>
					{
						if (tmpIdx >= tmpRows.length)
						{
							tmpSelf.fable.log.info(`DataMapper bootstrap: eager-register pass done. Registered ${tmpRegistered}, cache-hits ${tmpCacheHits}, failed ${tmpFailed}.`);
							return fCallback(null);
						}
						let tmpRow = tmpRows[tmpIdx++];
						// Stale-cache invalidation: if our cached UV hash isn't
						// in UV's current registry, clear the cache fields on
						// this in-memory copy so _eagerRegisterOperationGraph
						// treats it as a fresh compile + register.
						if (tmpRow.CompiledOperationHash && !tmpUVHashes[tmpRow.CompiledOperationHash])
						{
							tmpRow.CompiledOperationHash = '';
							tmpRow.CompiledOperationConfigHash = '';
						}
						tmpSelf._eagerRegisterOperationGraph(tmpRow, (pIgnored, pRes) =>
						{
							if (pRes && pRes.CacheHit) tmpCacheHits++;
							else if (pRes && pRes.Compiled) tmpRegistered++;
							else tmpFailed++;
							return fNext();
						});
					};
					fNext();
				});
			});
	}

	_bootstrapEnsureConnected(pIDBeaconConnection, fCallback)
	{
		let tmpSelf = this;
		this._meadowProxyRequest(CONFIGS_BEACON_NAME, 'POST',
			'/beacon/connection/' + pIDBeaconConnection + '/connect', null,
			(pConnErr) =>
			{
				if (pConnErr)
				{
					// Already-connected returns success on the beacon side, but
					// other failures here would block schema work — log + abort.
					tmpSelf.fable.log.warn(`DataMapper bootstrap: connection activate failed: ${pConnErr.message}`);
					return fCallback(pConnErr);
				}
				return tmpSelf._bootstrapEnsureSchemas(pIDBeaconConnection, fCallback);
			});
	}

	_bootstrapEnsureSchemas(pIDBeaconConnection, fCallback)
	{
		let tmpSelf = this;
		let tmpSchemaDir = libPath.resolve(__dirname, 'schemas');
		let tmpQueue = CONFIGS_SCHEMA_FILES.slice();
		let tmpReport = [];

		let fNext = () =>
		{
			if (tmpQueue.length === 0)
			{
				tmpSelf.fable.log.info(`DataMapper bootstrap: configs-databeacon ready. Schemas: ${tmpReport.map((r) => r.SchemaName + (r.TablesCreated.length ? '(+' + r.TablesCreated.length + ')' : '')).join(', ')}.`);
				return fCallback(null, tmpReport);
			}
			let tmpFile = tmpQueue.shift();
			let tmpAbs = libPath.join(tmpSchemaDir, tmpFile);
			let tmpSchema;
			try { tmpSchema = JSON.parse(libFs.readFileSync(tmpAbs, 'utf8')); }
			catch (pReadErr)
			{
				tmpSelf.fable.log.warn(`DataMapper bootstrap: cannot read ${tmpFile}: ${pReadErr.message}`);
				return fNext();
			}
			tmpSelf._bootstrapEnsureOneSchema(pIDBeaconConnection, tmpSchema, (pErr, pResult) =>
			{
				if (pErr)
				{
					tmpSelf.fable.log.warn(`DataMapper bootstrap: ensure ${tmpSchema.SchemaName} failed: ${pErr.message}`);
				}
				else
				{
					tmpReport.push(pResult);
				}
				return fNext();
			});
		};
		fNext();
	}

	_bootstrapEnsureOneSchema(pIDBeaconConnection, pSchema, fCallback)
	{
		let tmpSelf = this;
		this._dispatch(
			{
				Capability: 'DataBeaconSchema',
				Action:     'EnsureSchema',
				Settings:
				{
					IDBeaconConnection: pIDBeaconConnection,
					SchemaName:         pSchema.SchemaName,
					SchemaJSON:         pSchema
				},
				AffinityKey: CONFIGS_BEACON_NAME,
				TimeoutMs:   60000
			},
			(pErr, pResult) =>
			{
				if (pErr) return fCallback(pErr);
				let tmpOutputs = (pResult && pResult.Outputs) || pResult || {};
				let tmpCreated = Array.isArray(tmpOutputs.TablesCreated) ? tmpOutputs.TablesCreated.slice() : [];
				let tmpResult = { SchemaName: pSchema.SchemaName, TablesCreated: tmpCreated };
				if (tmpCreated.length === 0) return fCallback(null, tmpResult);

				// Refresh introspection so the dynamic-endpoint manager
				// picks up the new tables, then enable each so PUT /Upserts
				// returns 200 instead of 405.
				tmpSelf._dispatch(
					{
						Capability: 'DataBeaconManagement',
						Action:     'Introspect',
						Settings:   { IDBeaconConnection: pIDBeaconConnection },
						AffinityKey: CONFIGS_BEACON_NAME,
						TimeoutMs:   30000
					},
					(pIntErr) =>
					{
						if (pIntErr) return fCallback(null, tmpResult);
						let tmpIdx = 0;
						let fEnableNext = () =>
						{
							if (tmpIdx >= tmpCreated.length) return fCallback(null, tmpResult);
							let tmpTable = tmpCreated[tmpIdx++];
							tmpSelf._dispatch(
								{
									Capability: 'DataBeaconManagement',
									Action:     'EnableEndpoint',
									Settings:   { IDBeaconConnection: pIDBeaconConnection, TableName: tmpTable },
									AffinityKey: CONFIGS_BEACON_NAME,
									TimeoutMs:   15000
								},
								() => fEnableNext());
						};
						fEnableNext();
					});
			});
	}

	/**
	 * Extract a unique beacon name set from the Ultravisor action catalog.
	 * A beacon is anything providing DataBeaconAccess (excludes the mapper
	 * itself, which provides only DataMapperSource/Records/Transform).
	 */
	_extractBeaconsFromCatalog(pCapabilities)
	{
		let tmpCatalog = (pCapabilities && pCapabilities.ActionCatalog) || [];
		let tmpBeaconSet = {};

		for (let i = 0; i < tmpCatalog.length; i++)
		{
			let tmpAction = tmpCatalog[i];
			let tmpSourceBeacons = tmpAction.SourceBeacons || [];

			// Only include beacons that provide DataBeaconAccess.
			if (tmpAction.Capability !== 'DataBeaconAccess')
			{
				continue;
			}

			for (let b = 0; b < tmpSourceBeacons.length; b++)
			{
				let tmpID = tmpSourceBeacons[b];
				// BeaconIDs follow bcn-<name>-<timestamp>
				let tmpMatch = tmpID.match(/^bcn-(.+)-\d+$/);
				let tmpName = tmpMatch ? tmpMatch[1] : tmpID;
				if (!tmpBeaconSet[tmpName])
				{
					tmpBeaconSet[tmpName] = { Name: tmpName, BeaconID: tmpID };
				}
			}
		}

		return Object.keys(tmpBeaconSet).map((pName) => tmpBeaconSet[pName]);
	}

	connectRoutes(pOratorServiceServer)
	{
		let tmpRoutePrefix = this.options.RoutePrefix;

		// ── Write-side auth gate ────────────────────────────────
		//
		// If DATA_MAPPER_WRITE_TOKEN is set in the env, every
		// non-GET request under <RoutePrefix>/* must carry
		// `Authorization: Bearer <token>`. Reads stay open so the
		// dashboards (and dashboard-databeacon's panel-data fetches)
		// don't need credentials. If the env var is unset we log a
		// warning at startup — the gate is opt-in, not opt-out, to
		// stay backwards-compatible with the existing demo flow.
		let tmpWriteToken = process.env.DATA_MAPPER_WRITE_TOKEN || '';
		if (!tmpWriteToken)
		{
			this.fable.log.warn('DataMapper ConnectionBridge: DATA_MAPPER_WRITE_TOKEN not set — writes on ' + tmpRoutePrefix + '/* are unauthenticated. Set the env var to enable bearer-token auth on POST/PUT/DELETE.');
		}
		else
		{
			this.fable.log.info('DataMapper ConnectionBridge: bearer-token auth enabled for writes on ' + tmpRoutePrefix + '/*.');
		}

		pOratorServiceServer.server.use((pRequest, pResponse, fNext) =>
		{
			if (!tmpWriteToken) return fNext();
			let tmpUrl = pRequest.url || '';
			if (tmpUrl.indexOf(tmpRoutePrefix + '/') !== 0 && tmpUrl !== tmpRoutePrefix) return fNext();
			let tmpMethod = pRequest.method || '';
			if (tmpMethod === 'GET' || tmpMethod === 'HEAD' || tmpMethod === 'OPTIONS') return fNext();
			let tmpAuth = (pRequest.headers && (pRequest.headers.authorization || pRequest.headers.Authorization)) || '';
			if (tmpAuth === 'Bearer ' + tmpWriteToken) return fNext();
			pResponse.send(401, { Error: 'Unauthorized — POST/PUT/DELETE on ' + tmpRoutePrefix + '/* requires Authorization: Bearer <DATA_MAPPER_WRITE_TOKEN>.' });
			return fNext(false);
		});

		// ── Ultravisor connection management ────────────────────

		pOratorServiceServer.doPost(`${tmpRoutePrefix}/ultravisor/connect`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpBody = pRequest.body || {};
				if (!tmpBody.URL)
				{
					return this._sendError(pResponse, 400, 'URL is required', fNext);
				}
				if (!this._Owner)
				{
					return this._sendError(pResponse, 500, 'DataMapper owner not set', fNext);
				}

				this._Owner.connectUltravisor(
					tmpBody.URL,
					tmpBody.BeaconName || '',
					tmpBody.Password || '',
					(pError) =>
					{
						if (pError)
						{
							pResponse.send({ Success: false, Error: pError.message || String(pError), Status: 'Failed' });
							return fNext();
						}
						pResponse.send(Object.assign({ Success: true }, this._Owner.getUltravisorStatus()));
						return fNext();
					});
			});

		pOratorServiceServer.doPost(`${tmpRoutePrefix}/ultravisor/disconnect`,
			(pRequest, pResponse, fNext) =>
			{
				if (!this._Owner)
				{
					return this._sendError(pResponse, 500, 'DataMapper owner not set', fNext);
				}
				this._Owner.disconnectUltravisor((pError) =>
				{
					pResponse.send({ Success: !pError, Status: 'Disconnected' });
					return fNext();
				});
			});

		pOratorServiceServer.doGet(`${tmpRoutePrefix}/ultravisor/status`,
			(pRequest, pResponse, fNext) =>
			{
				if (!this._Owner)
				{
					pResponse.send({ Connected: false, Status: 'Unknown', URL: '' });
					return fNext();
				}
				pResponse.send(this._Owner.getUltravisorStatus());
				return fNext();
			});

		// ── Beacon discovery ────────────────────────────────────

		pOratorServiceServer.doGet(`${tmpRoutePrefix}/beacons`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpClient = this._client();
				if (!tmpClient)
				{
					pResponse.send({ Beacons: [] });
					return fNext();
				}

				this._request('GET', '/Beacon/Capabilities', null,
					(pError, pResult) =>
					{
						if (pError)
						{
							return this._sendError(pResponse, 502, pError.message || String(pError), fNext);
						}
						let tmpBeacons = this._extractBeaconsFromCatalog(pResult);
						pResponse.send({ Count: tmpBeacons.length, Beacons: tmpBeacons });
						return fNext();
					});
			});

		// ── Beacon connections ──────────────────────────────────

		pOratorServiceServer.doGet(`${tmpRoutePrefix}/beacon/:name/connections`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpName = pRequest.params.name;
				this._dispatch(
					{
						Capability: 'DataBeaconAccess',
						Action: 'ListConnections',
						Settings: {},
						AffinityKey: tmpName,
						TimeoutMs: 15000
					},
					(pError, pResult) =>
					{
						if (pError)
						{
							return this._sendError(pResponse, 502, pError.message || String(pError), fNext);
						}
						let tmpOutputs = (pResult && pResult.Outputs) || pResult || {};
						pResponse.send({ BeaconName: tmpName, Connections: tmpOutputs.Connections || [] });
						return fNext();
					});
			});

		// ── Introspection ───────────────────────────────────────

		// GET /mapper/beacon/:name/columns?ConnectionHash=X&Entity=Y
		// Convenience for the editor: resolve ConnectionHash → IDBeaconConnection
		// (via ListConnections), introspect, and return just the columns for
		// the requested entity. Saves the editor from doing two calls + a
		// hash-to-id lookup itself.
		pOratorServiceServer.doGet(`${tmpRoutePrefix}/beacon/:name/columns`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpName = pRequest.params.name;
				let tmpHash = (pRequest.query && pRequest.query.ConnectionHash) || '';
				let tmpEntity = (pRequest.query && pRequest.query.Entity) || '';
				if (!tmpHash || !tmpEntity)
				{
					return this._sendError(pResponse, 400,
						'GET /mapper/beacon/:name/columns requires ?ConnectionHash and ?Entity', fNext);
				}

				// Step 1 — list connections, find the one whose slug matches.
				this._dispatch(
					{
						Capability: 'DataBeaconAccess',
						Action: 'ListConnections',
						Settings: {},
						AffinityKey: tmpName,
						TimeoutMs: 15000
					},
					(pListErr, pListResult) =>
					{
						if (pListErr) return this._sendError(pResponse, 502, 'list connections: ' + pListErr.message, fNext);
						let tmpConns = ((pListResult && pListResult.Outputs) || pListResult || {}).Connections || [];
						// ConnectionHash is the URL slug (Name lowercased+kebabed by meadow).
						// Match by Name slug to be tolerant of either form.
						let tmpMatch = tmpConns.find((c) =>
						{
							let tmpSlug = String(c.Name || '').toLowerCase().replace(/\s+/g, '-');
							return tmpSlug === tmpHash || c.Name === tmpHash || String(c.Hash || '') === tmpHash;
						});
						if (!tmpMatch)
						{
							return this._sendError(pResponse, 404,
								`No connection on beacon "${tmpName}" matched hash "${tmpHash}"`, fNext);
						}

						// Step 2 — introspect, then pick out the requested entity's columns.
						this._dispatch(
							{
								Capability: 'DataBeaconManagement',
								Action: 'Introspect',
								Settings: { IDBeaconConnection: tmpMatch.IDBeaconConnection },
								AffinityKey: tmpName,
								TimeoutMs: 30000
							},
							(pIntErr, pIntResult) =>
							{
								if (pIntErr) return this._sendError(pResponse, 502, 'introspect: ' + pIntErr.message, fNext);
								let tmpTables = ((pIntResult && pIntResult.Outputs) || pIntResult || {}).Tables || [];
								let tmpTable = tmpTables.find((t) =>
									(t.TableName === tmpEntity) || (t.Name === tmpEntity));
								if (!tmpTable)
								{
									return this._sendError(pResponse, 404,
										`No entity "${tmpEntity}" on beacon "${tmpName}" connection "${tmpHash}". ` +
										`Available: ${tmpTables.slice(0, 8).map((t) => t.TableName || t.Name).join(', ')}`, fNext);
								}
								let tmpColumns = (tmpTable.Columns || []).map((c) =>
									({ Name: c.Name || c.Column, DataType: c.DataType || c.Type || '' }));
								pResponse.send({
									BeaconName: tmpName,
									ConnectionHash: tmpHash,
									IDBeaconConnection: tmpMatch.IDBeaconConnection,
									Entity: tmpEntity,
									Columns: tmpColumns
								});
								return fNext();
							});
					});
			});

		pOratorServiceServer.doPost(`${tmpRoutePrefix}/beacon/:name/introspect`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpName = pRequest.params.name;
				let tmpBody = pRequest.body || {};

				this._dispatch(
					{
						Capability: 'DataBeaconManagement',
						Action: 'Introspect',
						Settings: { IDBeaconConnection: tmpBody.IDBeaconConnection },
						AffinityKey: tmpName,
						TimeoutMs: 30000
					},
					(pError, pResult) =>
					{
						if (pError)
						{
							return this._sendError(pResponse, 502, pError.message || String(pError), fNext);
						}
						let tmpOutputs = (pResult && pResult.Outputs) || pResult || {};
						pResponse.send(
							{
								BeaconName: tmpName,
								Tables: tmpOutputs.Tables || [],
								ConnectionHash: tmpOutputs.ConnectionHash || ''
							});
						return fNext();
					});
			});

		// ── Configs-databeacon self-bootstrap (manual retrigger) ─
		//
		// POST /mapper/admin/bootstrap-configs
		// Re-runs the same idempotent bootstrap that fires automatically
		// after Ultravisor auth in Retold-DataMapper.connectUltravisor.
		// Useful when the configs-databeacon wasn't reachable at startup
		// (mesh wasn't up yet), or after wiping configs state by hand.
		pOratorServiceServer.doPost(`${tmpRoutePrefix}/admin/bootstrap-configs`,
			(pRequest, pResponse, fNext) =>
			{
				_self.bootstrapConfigsBeacon((pErr, pReport) =>
				{
					if (pErr) return _self._sendError(pResponse, 502, pErr.message || String(pErr), fNext);
					pResponse.send({ Success: true, Report: pReport || [] });
					return fNext();
				});
			});

		// ── EnsureSchema admin pass-through ─────────────────────
		//
		// POST /mapper/admin/ensure-schema
		// Body: { BeaconName, IDBeaconConnection, SchemaName, SchemaJSON, AutoEnable? (default true) }
		//
		// Dispatches DataBeaconSchema:EnsureSchema, then (when AutoEnable
		// is true and TablesCreated is non-empty) Introspect + EnableEndpoint
		// for each newly created table. Without that follow-up the table
		// exists on disk but the dynamic endpoint manager has no entry, so
		// PUT /Upserts returns HTTP 405. The two extra dispatches are
		// idempotent — Introspect is read-only, EnableEndpoint is no-op
		// when already enabled.
		pOratorServiceServer.doPost(`${tmpRoutePrefix}/admin/ensure-schema`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpBody = pRequest.body || {};
				if (!tmpBody.BeaconName || !tmpBody.IDBeaconConnection || !tmpBody.SchemaName || !tmpBody.SchemaJSON)
				{
					return this._sendError(pResponse, 400,
						'POST /mapper/admin/ensure-schema requires BeaconName, IDBeaconConnection, SchemaName, SchemaJSON', fNext);
				}
				let tmpAutoEnable = (tmpBody.AutoEnable === undefined) ? true : !!tmpBody.AutoEnable;
				this._dispatch(
					{
						Capability: 'DataBeaconSchema',
						Action:     'EnsureSchema',
						Settings:
						{
							IDBeaconConnection: tmpBody.IDBeaconConnection,
							SchemaName:         tmpBody.SchemaName,
							SchemaJSON:         tmpBody.SchemaJSON
						},
						AffinityKey: tmpBody.BeaconName,
						TimeoutMs:   60000
					},
					(pError, pResult) =>
					{
						if (pError) return this._sendError(pResponse, 502, pError.message || String(pError), fNext);
						let tmpOutputs = (pResult && pResult.Outputs) || pResult || {};
						let tmpCreated = Array.isArray(tmpOutputs.TablesCreated) ? tmpOutputs.TablesCreated.slice() : [];

						let fDone = (pEnabled) =>
						{
							pResponse.send({
								Success:    !!tmpOutputs.Success,
								BeaconName: tmpBody.BeaconName,
								Result:     tmpOutputs,
								Enabled:    pEnabled || []
							});
							return fNext();
						};

						if (!tmpAutoEnable || tmpCreated.length === 0) return fDone();

						// Refresh introspection so the dynamic endpoint
						// manager sees the new tables, then enable each.
						this._dispatch(
							{
								Capability: 'DataBeaconManagement',
								Action:     'Introspect',
								Settings:   { IDBeaconConnection: tmpBody.IDBeaconConnection },
								AffinityKey: tmpBody.BeaconName,
								TimeoutMs:   30000
							},
							(pIntErr) =>
							{
								if (pIntErr) return fDone({ Error: 'introspect: ' + pIntErr.message });

								let tmpIdx = 0;
								let tmpEnabled = [];
								let fNextEnable = () =>
								{
									if (tmpIdx >= tmpCreated.length) return fDone(tmpEnabled);
									let tmpTable = tmpCreated[tmpIdx++];
									this._dispatch(
										{
											Capability: 'DataBeaconManagement',
											Action:     'EnableEndpoint',
											Settings:   { IDBeaconConnection: tmpBody.IDBeaconConnection, TableName: tmpTable },
											AffinityKey: tmpBody.BeaconName,
											TimeoutMs:   15000
										},
										(pEnErr, pEnRes) =>
										{
											tmpEnabled.push({ TableName: tmpTable,
												Success: !pEnErr,
												Endpoint: ((pEnRes && pEnRes.Outputs) || {}).EndpointBase || null,
												Error: pEnErr ? pEnErr.message : null });
											fNextEnable();
										});
								};
								fNextEnable();
							});
					});
			});

		// POST /mapper/admin/enable-endpoint
		// Body: { BeaconName, IDBeaconConnection, TableName }
		// Calls DataBeaconManagement:EnableEndpoint so a table just created
		// via EnsureSchema gets its CRUD REST surface (incl. PUT /Upserts)
		// exposed. Without this, WriteRecords would fail with HTTP 405 on
		// the bulk PUT path.
		pOratorServiceServer.doPost(`${tmpRoutePrefix}/admin/enable-endpoint`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpBody = pRequest.body || {};
				if (!tmpBody.BeaconName || !tmpBody.IDBeaconConnection || !tmpBody.TableName)
				{
					return this._sendError(pResponse, 400,
						'POST /mapper/admin/enable-endpoint requires BeaconName, IDBeaconConnection, TableName', fNext);
				}
				this._dispatch(
					{
						Capability: 'DataBeaconManagement',
						Action:     'EnableEndpoint',
						Settings:
						{
							IDBeaconConnection: tmpBody.IDBeaconConnection,
							TableName:          tmpBody.TableName
						},
						AffinityKey: tmpBody.BeaconName,
						TimeoutMs:   30000
					},
					(pError, pResult) =>
					{
						if (pError) return this._sendError(pResponse, 502, pError.message || String(pError), fNext);
						let tmpOutputs = (pResult && pResult.Outputs) || pResult || {};
						pResponse.send({ Success: true, BeaconName: tmpBody.BeaconName, TableName: tmpBody.TableName, Result: tmpOutputs });
						return fNext();
					});
			});

		// ── MappingConfig CRUD ──────────────────────────────────

		// Scope semantics for /mapper/mappings:
		//   - GET ?scope=<value>  : '' = global only, * = no filter,
		//                           any other value = exact match
		//   - POST/PUT  : Scope read from body.Scope OR ?scope= query
		//                 (body wins). Stored as-is, defaults to ''.
		pOratorServiceServer.doGet(`${tmpRoutePrefix}/mappings`,
			(pRequest, pResponse, fNext) =>
			{
				if (!this.fable.DAL || !this.fable.DAL.MappingConfig)
				{
					pResponse.send({ Mappings: [] });
					return fNext();
				}
				let tmpScope = (pRequest.query && pRequest.query.scope !== undefined) ? pRequest.query.scope : '';
				let tmpQuery = this.fable.DAL.MappingConfig.query.clone().addFilter('Deleted', 0);
				this.fable.DAL.MappingConfig.doReads(tmpQuery,
					(pError, pQuery, pRecords) =>
					{
						if (pError)
						{
							return this._sendError(pResponse, 500, pError.message || String(pError), fNext);
						}
						let tmpFiltered = pRecords.filter((pR) =>
						{
							if (tmpScope === '*') return true;
							let tmpRowScope = (pR.Scope === null || pR.Scope === undefined) ? '' : String(pR.Scope);
							return tmpRowScope === String(tmpScope || '');
						});
						pResponse.send({ Count: tmpFiltered.length, Mappings: tmpFiltered });
						return fNext();
					});
			});

		pOratorServiceServer.doPost(`${tmpRoutePrefix}/mappings`,
			(pRequest, pResponse, fNext) =>
			{
				if (!this.fable.DAL || !this.fable.DAL.MappingConfig)
				{
					return this._sendError(pResponse, 500, 'MappingConfig DAL not initialized', fNext);
				}
				let tmpBody = pRequest.body || {};
				let tmpQueryScope = (pRequest.query && pRequest.query.scope !== undefined && pRequest.query.scope !== '*')
					? String(pRequest.query.scope) : '';
				let tmpRecord =
				{
					Scope: (tmpBody.Scope !== undefined) ? String(tmpBody.Scope || '') : tmpQueryScope,
					Name: tmpBody.Name || 'Untitled Mapping',
					Description: tmpBody.Description || '',
					SourceBeaconName: tmpBody.SourceBeaconName || '',
					SourceConnectionHash: tmpBody.SourceConnectionHash || '',
					SourceEntity: tmpBody.SourceEntity || '',
					TargetBeaconName: tmpBody.TargetBeaconName || '',
					TargetConnectionHash: tmpBody.TargetConnectionHash || '',
					TargetEntity: tmpBody.TargetEntity || '',
					MappingConfiguration: (typeof tmpBody.MappingConfiguration === 'string')
						? tmpBody.MappingConfiguration
						: JSON.stringify(tmpBody.MappingConfiguration || {}),
					FlowDiagramState: (typeof tmpBody.FlowDiagramState === 'string')
						? tmpBody.FlowDiagramState
						: JSON.stringify(tmpBody.FlowDiagramState || {})
				};

				let tmpQuery = this.fable.DAL.MappingConfig.query.clone()
					.setIDUser(0)
					.addRecord(tmpRecord);

				this.fable.DAL.MappingConfig.doCreate(tmpQuery,
					(pError, pQuery, pQueryRead, pRecord) =>
					{
						if (pError)
						{
							return this._sendError(pResponse, 500, pError.message || String(pError), fNext);
						}
						pResponse.send({ Success: true, Mapping: pRecord });
						return fNext();
					});
			});

		pOratorServiceServer.doGet(`${tmpRoutePrefix}/mapping/:id`,
			(pRequest, pResponse, fNext) =>
			{
				if (!this.fable.DAL || !this.fable.DAL.MappingConfig)
				{
					return this._sendError(pResponse, 500, 'MappingConfig DAL not initialized', fNext);
				}
				let tmpID = parseInt(pRequest.params.id, 10);
				let tmpQuery = this.fable.DAL.MappingConfig.query.clone()
					.addFilter('IDMappingConfig', tmpID);
				this.fable.DAL.MappingConfig.doRead(tmpQuery,
					(pError, pQuery, pRecord) =>
					{
						if (pError || !pRecord || !pRecord.IDMappingConfig)
						{
							return this._sendError(pResponse, 404, 'Mapping not found', fNext);
						}
						pResponse.send({ Mapping: pRecord });
						return fNext();
					});
			});

		pOratorServiceServer.doPut(`${tmpRoutePrefix}/mapping/:id`,
			(pRequest, pResponse, fNext) =>
			{
				if (!this.fable.DAL || !this.fable.DAL.MappingConfig)
				{
					return this._sendError(pResponse, 500, 'MappingConfig DAL not initialized', fNext);
				}
				let tmpID = parseInt(pRequest.params.id, 10);
				let tmpBody = pRequest.body || {};

				let tmpReadQuery = this.fable.DAL.MappingConfig.query.clone()
					.addFilter('IDMappingConfig', tmpID);

				this.fable.DAL.MappingConfig.doRead(tmpReadQuery,
					(pReadError, pReadQuery, pExisting) =>
					{
						if (pReadError || !pExisting || !pExisting.IDMappingConfig)
						{
							return this._sendError(pResponse, 404, 'Mapping not found', fNext);
						}

						let tmpFields =
						[
							'Scope', 'Name', 'Description',
							'SourceBeaconName', 'SourceConnectionHash', 'SourceEntity',
							'TargetBeaconName', 'TargetConnectionHash', 'TargetEntity'
						];
						for (let i = 0; i < tmpFields.length; i++)
						{
							if (tmpBody[tmpFields[i]] !== undefined)
							{
								pExisting[tmpFields[i]] = tmpBody[tmpFields[i]];
							}
						}
						if (tmpBody.MappingConfiguration !== undefined)
						{
							pExisting.MappingConfiguration = (typeof tmpBody.MappingConfiguration === 'string')
								? tmpBody.MappingConfiguration
								: JSON.stringify(tmpBody.MappingConfiguration);
						}
						if (tmpBody.FlowDiagramState !== undefined)
						{
							pExisting.FlowDiagramState = (typeof tmpBody.FlowDiagramState === 'string')
								? tmpBody.FlowDiagramState
								: JSON.stringify(tmpBody.FlowDiagramState);
						}

						let tmpUpdateQuery = this.fable.DAL.MappingConfig.query.clone()
							.addRecord(pExisting);
						this.fable.DAL.MappingConfig.doUpdate(tmpUpdateQuery,
							(pError, pQuery, pQueryRead, pRecord) =>
							{
								if (pError)
								{
									return this._sendError(pResponse, 500, pError.message || String(pError), fNext);
								}
								pResponse.send({ Success: true, Mapping: pRecord });
								return fNext();
							});
					});
			});

		pOratorServiceServer.doDel(`${tmpRoutePrefix}/mapping/:id`,
			(pRequest, pResponse, fNext) =>
			{
				if (!this.fable.DAL || !this.fable.DAL.MappingConfig)
				{
					return this._sendError(pResponse, 500, 'MappingConfig DAL not initialized', fNext);
				}
				let tmpID = parseInt(pRequest.params.id, 10);
				let tmpQuery = this.fable.DAL.MappingConfig.query.clone()
					.addFilter('IDMappingConfig', tmpID);
				this.fable.DAL.MappingConfig.doDelete(tmpQuery,
					(pError) =>
					{
						if (pError)
						{
							return this._sendError(pResponse, 500, pError.message || String(pError), fNext);
						}
						pResponse.send({ Success: true });
						return fNext();
					});
			});

		// ─────────────────────────────────────────────────────────────
		//  Dashboards (Phase 2 demo path)
		//
		//  Configs live on the configs-databeacon. Panel data lives on
		//  whatever beacon + endpoint each panel references in its
		//  Layout. Each request dispatches through the UV mesh with
		//  AffinityKey set to the beacon's registered Name; UV's
		//  Coordinator + Scheduler resolve that against findBeaconByName
		//  and route the work item to the right beacon.
		// ─────────────────────────────────────────────────────────────

		let _self = this;
		function beaconRequest(pBeaconName, pPath, fCb)
		{
			beaconRequestEx(pBeaconName, 'GET', pPath, '', fCb);
		}
		// Multi-method variant — same dispatch path, takes a Method + Body.
		// Both helpers route by AffinityKey=BeaconName via the UV mesh.
		function beaconRequestEx(pBeaconName, pMethod, pPath, pBody, fCb)
		{
			_self._dispatch(
				{
					Capability: 'MeadowProxy',
					Action: 'Request',
					Settings:
					{
						Method:     pMethod,
						Path:       pPath,
						Body:       (pBody === undefined || pBody === null) ? '' : (typeof pBody === 'string' ? pBody : JSON.stringify(pBody)),
						RemoteUser: ''
					},
					AffinityKey: pBeaconName,
					TimeoutMs:   30000
				},
				(pError, pResult) =>
				{
					if (pError) return fCb(pError);
					let tmpOutputs = (pResult && pResult.Outputs) || pResult || {};
					let tmpStatus = tmpOutputs.Status;
					let tmpBody = tmpOutputs.Body;
					if (typeof (tmpStatus) === 'number' && tmpStatus >= 400)
					{
						let tmpSnippet = (typeof tmpBody === 'string') ? tmpBody.slice(0, 200) : '';
						return fCb(new Error('beacon ' + pBeaconName + ' returned ' + tmpStatus + ': ' + tmpSnippet));
					}
					if (typeof (tmpBody) === 'string' && tmpBody)
					{
						try { return fCb(null, JSON.parse(tmpBody)); }
						catch (pErr) { return fCb(new Error('beacon ' + pBeaconName + ' returned non-JSON: ' + pErr.message)); }
					}
					return fCb(null, tmpBody);
				});
		}

		// Scope-aware row filter. Default scope '' means "global only"
		// (empty / null Scope on the row). scope='*' means "any scope —
		// don't filter". A non-empty scope value matches that exact value.
		//
		// We filter in JS rather than via meadow's FilteredTo URL because
		// FBV~Field~EQ~ with an empty right-hand value is ambiguous in the
		// URL grammar and doesn't reliably match empty strings vs nulls.
		function _scopeMatches(pRow, pScope)
		{
			if (pScope === '*') return true;
			let tmpRowScope = (pRow.Scope === null || pRow.Scope === undefined) ? '' : String(pRow.Scope);
			return tmpRowScope === String(pScope || '');
		}

		// GET /mapper/dashboards?scope=<scope> — list available dashboards.
		// scope='' (default) returns global dashboards only; a non-empty
		// scope returns only dashboards in that scope; scope=* returns all.
		pOratorServiceServer.doGet(`${tmpRoutePrefix}/dashboards`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpScope = (pRequest.query && pRequest.query.scope !== undefined) ? pRequest.query.scope : '';
				beaconRequest('configs-databeacon', '/1.0/platform-configs/DashboardConfigs',
					(pError, pRows) =>
					{
						if (pError)
						{
							return _self._sendError(pResponse, 502, pError.message || String(pError), fNext);
						}
						let tmpRows = Array.isArray(pRows) ? pRows : [];
						pResponse.send({
							Dashboards: tmpRows.filter((pR) => _scopeMatches(pR, tmpScope)).map((pR) =>
								({
									IDDashboardConfig: pR.IDDashboardConfig,
									Hash: pR.Hash,
									Title: pR.Title,
									Scope: pR.Scope || ''
								}))
						});
						return fNext();
					});
			});

		// GET /mapper/dashboard/:hash?scope=<scope> — full config with
		// parsed Layout. Lookup is by (Scope, Hash); two scopes can have
		// dashboards with the same Hash without collision.
		pOratorServiceServer.doGet(`${tmpRoutePrefix}/dashboard/:hash`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpHash = pRequest.params.hash;
				let tmpScope = (pRequest.query && pRequest.query.scope !== undefined) ? pRequest.query.scope : '';
				beaconRequest('configs-databeacon',
					'/1.0/platform-configs/DashboardConfigs/FilteredTo/FBV~Hash~EQ~' + encodeURIComponent(tmpHash),
					(pError, pRows) =>
					{
						if (pError)
						{
							return _self._sendError(pResponse, 502, pError.message || String(pError), fNext);
						}
						let tmpMatches = (Array.isArray(pRows) ? pRows : []).filter((pR) => _scopeMatches(pR, tmpScope));
						if (tmpMatches.length === 0)
						{
							return _self._sendError(pResponse, 404, `Dashboard ${tmpHash} not found in scope "${tmpScope}"`, fNext);
						}
						let tmpRow = tmpMatches[0];
						let tmpLayout = tmpRow.Layout;
						try { tmpLayout = JSON.parse(tmpLayout); } catch (e) { /* keep as-is */ }
						pResponse.send({
							IDDashboardConfig: tmpRow.IDDashboardConfig,
							Hash: tmpRow.Hash,
							Scope: tmpRow.Scope || '',
							Title: tmpRow.Title,
							Layout: tmpLayout
						});
						return fNext();
					});
			});

		// POST /mapper/dashboards?scope=<scope> — create a dashboard.
		// Body: { Hash, Title, Layout }. Scope is taken from the body
		// (preferred) or the ?scope= query, defaulting to '' (global).
		// Layout is stringified into JSON for storage. Proxies to the
		// configs beacon so storage is consistent with direct REST.
		pOratorServiceServer.doPost(`${tmpRoutePrefix}/dashboards`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpBody = pRequest.body || {};
				if (!tmpBody.Hash)
				{
					return _self._sendError(pResponse, 400, 'POST /mapper/dashboards requires Hash', fNext);
				}
				let tmpQueryScope = (pRequest.query && pRequest.query.scope !== undefined && pRequest.query.scope !== '*')
					? String(pRequest.query.scope) : '';
				let tmpRecord =
				{
					Hash:   String(tmpBody.Hash),
					Scope:  (tmpBody.Scope !== undefined) ? String(tmpBody.Scope || '') : tmpQueryScope,
					Title:  tmpBody.Title || '',
					Layout: (typeof tmpBody.Layout === 'string') ? tmpBody.Layout : JSON.stringify(tmpBody.Layout || {})
				};
				beaconRequestEx('configs-databeacon', 'POST',
					'/1.0/platform-configs/DashboardConfig', tmpRecord,
					(pError, pResult) =>
					{
						if (pError) return _self._sendError(pResponse, 502, pError.message || String(pError), fNext);
						pResponse.send({ Success: true, Dashboard: pResult });
						return fNext();
					});
			});

		// PUT /mapper/dashboard/:id — update by primary key.
		// meadow-endpoints 4.0.19+ exposes PUT-by-id directly: the URL
		// :IDRecord is authoritative and the row updates in place. No
		// more soft-delete-then-insert dance, no more ID churn.
		pOratorServiceServer.doPut(`${tmpRoutePrefix}/dashboard/:id`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpID = parseInt(pRequest.params.id, 10);
				if (!tmpID)
				{
					return _self._sendError(pResponse, 400, 'PUT /mapper/dashboard/:id requires numeric ID', fNext);
				}
				let tmpBody = pRequest.body || {};

				// Fetch the existing record so we can merge unchanged
				// fields. (PUT-by-id will replace the whole row, so we
				// need to send back the fields the caller didn't touch.)
				beaconRequestEx('configs-databeacon', 'GET',
					'/1.0/platform-configs/DashboardConfig/' + tmpID, null,
					(pReadErr, pExisting) =>
					{
						if (pReadErr) return _self._sendError(pResponse, 502, pReadErr.message || String(pReadErr), fNext);
						if (!pExisting || !pExisting.IDDashboardConfig)
						{
							return _self._sendError(pResponse, 404, 'Dashboard ' + tmpID + ' not found', fNext);
						}

						let tmpMerged = {
							IDDashboardConfig: tmpID,
							Hash:   (tmpBody.Hash !== undefined) ? String(tmpBody.Hash) : pExisting.Hash,
							Scope:  (tmpBody.Scope !== undefined) ? String(tmpBody.Scope || '') : (pExisting.Scope || ''),
							Title:  (tmpBody.Title !== undefined) ? tmpBody.Title : pExisting.Title,
							Layout: (tmpBody.Layout !== undefined)
								? (typeof tmpBody.Layout === 'string' ? tmpBody.Layout : JSON.stringify(tmpBody.Layout))
								: pExisting.Layout
						};

						beaconRequestEx('configs-databeacon', 'PUT',
							'/1.0/platform-configs/DashboardConfig/' + tmpID, tmpMerged,
							(pErr, pUpdated) =>
							{
								if (pErr) return _self._sendError(pResponse, 502, pErr.message || String(pErr), fNext);
								pResponse.send({ Success: true, Dashboard: pUpdated });
								return fNext();
							});
					});
			});

		// DELETE /mapper/dashboard/:id — soft-delete by primary key.
		pOratorServiceServer.doDel(`${tmpRoutePrefix}/dashboard/:id`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpID = parseInt(pRequest.params.id, 10);
				if (!tmpID)
				{
					return _self._sendError(pResponse, 400, 'DELETE /mapper/dashboard/:id requires numeric ID', fNext);
				}
				beaconRequestEx('configs-databeacon', 'DELETE',
					'/1.0/platform-configs/DashboardConfig/' + tmpID, null,
					(pError, pResult) =>
					{
						if (pError) return _self._sendError(pResponse, 502, pError.message || String(pError), fNext);
						pResponse.send({ Success: true, Result: pResult });
						return fNext();
					});
			});

		// POST /mapper/dashboard/panel-data — fetch one panel's data
		pOratorServiceServer.doPost(`${tmpRoutePrefix}/dashboard/panel-data`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpBody = pRequest.body || {};
				if (!tmpBody.BeaconName || !tmpBody.ConnectionName || !tmpBody.Endpoint)
				{
					return _self._sendError(pResponse, 400,
						'panel-data requires BeaconName, ConnectionName, Endpoint', fNext);
				}
				let tmpPageSize = parseInt(tmpBody.PageSize, 10) || 50;
				let tmpPage = parseInt(tmpBody.Page, 10) || 0;
				let tmpBegin = tmpPage * tmpPageSize;
				// Meadow-endpoints uses path-based pagination: <base>/<begin>/<count>
				// (not query string). The plural-table convention is meadow's too.
				let tmpPath = '/1.0/' + tmpBody.ConnectionName + '/' + tmpBody.Endpoint + 's'
					+ '/' + tmpBegin + '/' + tmpPageSize;
				beaconRequest(tmpBody.BeaconName, tmpPath,
					(pError, pRows) =>
					{
						if (pError)
						{
							return _self._sendError(pResponse, 502, pError.message || String(pError), fNext);
						}
						pResponse.send({
							Rows: Array.isArray(pRows) ? pRows : [],
							Page: tmpPage,
							PageSize: tmpPageSize
						});
						return fNext();
					});
			});

		// ─────────────────────────────────────────────────────────────
		//  OperationConfig CRUD (Phase 2b — typed operations)
		//
		//  Mirrors /mapper/dashboards: storage on configs-databeacon,
		//  proxied via MeadowProxy. (Scope, Hash) is the unique key.
		//  OperationType discriminates Extraction / Aggregation /
		//  Histogram / Intersection — the bridge dispatches by it at
		//  compile time. See PLAN-PHASE-2B-Operation-Types.md §3 for
		//  the per-type OperationConfiguration shape.
		// ─────────────────────────────────────────────────────────────

		// GET /mapper/operations?scope=<scope>&type=<OperationType>
		pOratorServiceServer.doGet(`${tmpRoutePrefix}/operations`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpScope = (pRequest.query && pRequest.query.scope !== undefined) ? pRequest.query.scope : '';
				let tmpType = (pRequest.query && pRequest.query.type) || '';
				beaconRequest('configs-databeacon', '/1.0/platform-configs/OperationConfigs/0/1000',
					(pError, pRows) =>
					{
						if (pError) return _self._sendError(pResponse, 502, pError.message || String(pError), fNext);
						let tmpRows = Array.isArray(pRows) ? pRows : [];
						let tmpFiltered = tmpRows.filter((pR) =>
						{
							if (pR.Deleted) return false;
							if (!_scopeMatches(pR, tmpScope)) return false;
							if (tmpType && pR.OperationType !== tmpType) return false;
							return true;
						});
						pResponse.send({
							Count: tmpFiltered.length,
							Operations: tmpFiltered.map((pR) =>
								({
									IDOperationConfig: pR.IDOperationConfig,
									Hash:              pR.Hash,
									Scope:             pR.Scope || '',
									Name:              pR.Name,
									Description:       pR.Description,
									OperationType:     pR.OperationType,
									SourceBeaconName:  pR.SourceBeaconName,
									SourceConnectionHash: pR.SourceConnectionHash,
									SourceEntity:      pR.SourceEntity,
									TargetBeaconName:  pR.TargetBeaconName,
									TargetConnectionHash: pR.TargetConnectionHash,
									TargetTable:       pR.TargetTable
								}))
						});
						return fNext();
					});
			});

		// GET /mapper/operation/:hash?scope=<scope>
		// Lookup is by (Scope, Hash). OperationConfiguration is JSON-parsed
		// before returning so the editor doesn't have to.
		pOratorServiceServer.doGet(`${tmpRoutePrefix}/operation/:hash`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpHash = pRequest.params.hash;
				let tmpScope = (pRequest.query && pRequest.query.scope !== undefined) ? pRequest.query.scope : '';
				beaconRequest('configs-databeacon',
					'/1.0/platform-configs/OperationConfigs/FilteredTo/FBV~Hash~EQ~' + encodeURIComponent(tmpHash),
					(pError, pRows) =>
					{
						if (pError) return _self._sendError(pResponse, 502, pError.message || String(pError), fNext);
						let tmpMatches = (Array.isArray(pRows) ? pRows : []).filter((pR) => !pR.Deleted && _scopeMatches(pR, tmpScope));
						if (tmpMatches.length === 0)
						{
							return _self._sendError(pResponse, 404, `Operation ${tmpHash} not found in scope "${tmpScope}"`, fNext);
						}
						let tmpRow = tmpMatches[0];
						let tmpCfg = tmpRow.OperationConfiguration;
						try { tmpCfg = JSON.parse(tmpCfg); } catch (e) { /* keep as-is */ }
						pResponse.send(Object.assign({}, tmpRow, { OperationConfiguration: tmpCfg }));
						return fNext();
					});
			});

		// POST /mapper/operations?scope=<scope> — create.
		// Body: { Hash, Name, Description?, OperationType, SourceBeaconName,
		//         SourceConnectionHash, SourceEntity, TargetBeaconName,
		//         TargetConnectionHash, TargetTable, OperationConfiguration }
		pOratorServiceServer.doPost(`${tmpRoutePrefix}/operations`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpBody = pRequest.body || {};
				if (!tmpBody.Hash)         return _self._sendError(pResponse, 400, 'POST /mapper/operations requires Hash', fNext);
				if (!tmpBody.OperationType) return _self._sendError(pResponse, 400, 'POST /mapper/operations requires OperationType', fNext);
				let tmpQueryScope = (pRequest.query && pRequest.query.scope !== undefined && pRequest.query.scope !== '*')
					? String(pRequest.query.scope) : '';
				let tmpSkipValidation = !!(pRequest.query && (pRequest.query.skipValidation === '1' || pRequest.query.skipValidation === 'true'));
				let tmpRecord =
				{
					Hash:                 String(tmpBody.Hash),
					Scope:                (tmpBody.Scope !== undefined) ? String(tmpBody.Scope || '') : tmpQueryScope,
					Name:                 tmpBody.Name || '',
					Description:          tmpBody.Description || '',
					OperationType:        String(tmpBody.OperationType),
					SourceBeaconName:     tmpBody.SourceBeaconName || '',
					SourceConnectionHash: tmpBody.SourceConnectionHash || '',
					SourceEntity:         tmpBody.SourceEntity || '',
					TargetBeaconName:     tmpBody.TargetBeaconName || '',
					TargetConnectionHash: tmpBody.TargetConnectionHash || '',
					TargetTable:          tmpBody.TargetTable || '',
					OperationConfiguration: (typeof tmpBody.OperationConfiguration === 'string')
						? tmpBody.OperationConfiguration
						: JSON.stringify(tmpBody.OperationConfiguration || {}),
					DependsOn:            (tmpBody.DependsOn !== undefined)
						? (typeof tmpBody.DependsOn === 'string' ? tmpBody.DependsOn : JSON.stringify(tmpBody.DependsOn || []))
						: '[]',
					ResetMode:            (tmpBody.ResetMode === 'Replace') ? 'Replace' : 'Append',
					Concurrency:          (tmpBody.Concurrency != null) ? Math.max(0, parseInt(tmpBody.Concurrency, 10) || 0) : 0
					// CompiledOperationHash / CompiledOperationConfigHash are
					// populated by the run-operation path, not by the user.
				};

				let fPersist = (pValidationWarning) =>
				{
					beaconRequestEx('configs-databeacon', 'POST',
						'/1.0/platform-configs/OperationConfig', tmpRecord,
						(pError, pResult) =>
						{
							if (pError) return _self._sendError(pResponse, 502, pError.message || String(pError), fNext);

							// Eager-register the UV Operation graph so it shows
							// up in UV's /Operation list before first run.
							// Best-effort — failures here log but don't block
							// the create response (run-operation will retry).
							_self._eagerRegisterOperationGraph(pResult, (pIgnored, pRegResult) =>
							{
								let tmpResp = { Success: true, Operation: pResult };
								if (pValidationWarning) tmpResp.ValidationWarning = pValidationWarning;
								if (pRegResult) tmpResp.UVRegistration = pRegResult;
								pResponse.send(tmpResp);
								return fNext();
							});
						});
				};

				if (tmpSkipValidation) return fPersist('Validation skipped via ?skipValidation=1.');

				// Per-type configuration validation runs first (cheap, local).
				let tmpCfgErr = _self._validateOperationConfiguration(tmpRecord);
				if (tmpCfgErr) return _self._sendError(pResponse, 400, tmpCfgErr.message, fNext);

				_self._validateAgainstTarget(tmpRecord, (pValidationErr, pWarning) =>
				{
					if (pValidationErr) return _self._sendError(pResponse, 400, pValidationErr.message, fNext);
					return fPersist(pWarning || null);
				});
			});

		// PUT /mapper/operation/:id — update by primary key.
		// Same soft-delete-then-insert pattern as /mapper/dashboard/:id
		// (meadow's PUT/PATCH surface isn't enabled on this beacon, and the
		// (Scope, Hash) UNIQUE INDEX has WHERE Deleted=0 so the new row
		// coexists with the soft-deleted one). IDOperationConfig changes
		// — callers should re-fetch by Hash if they need the new ID.
		pOratorServiceServer.doPut(`${tmpRoutePrefix}/operation/:id`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpID = parseInt(pRequest.params.id, 10);
				if (!tmpID) return _self._sendError(pResponse, 400, 'PUT /mapper/operation/:id requires numeric ID', fNext);
				let tmpBody = pRequest.body || {};
				let tmpSkipValidation = !!(pRequest.query && (pRequest.query.skipValidation === '1' || pRequest.query.skipValidation === 'true'));

				beaconRequestEx('configs-databeacon', 'GET',
					'/1.0/platform-configs/OperationConfig/' + tmpID, null,
					(pReadErr, pExisting) =>
					{
						if (pReadErr) return _self._sendError(pResponse, 502, pReadErr.message || String(pReadErr), fNext);
						if (!pExisting || !pExisting.IDOperationConfig)
						{
							return _self._sendError(pResponse, 404, 'Operation ' + tmpID + ' not found', fNext);
						}

						let tmpFields = ['Hash', 'Scope', 'Name', 'Description', 'OperationType',
							'SourceBeaconName', 'SourceConnectionHash', 'SourceEntity',
							'TargetBeaconName', 'TargetConnectionHash', 'TargetTable'];
						let tmpMerged = { IDOperationConfig: tmpID };
						for (let i = 0; i < tmpFields.length; i++)
						{
							let tmpField = tmpFields[i];
							tmpMerged[tmpField] = (tmpBody[tmpField] !== undefined)
								? (tmpField === 'Scope' ? String(tmpBody[tmpField] || '') : tmpBody[tmpField])
								: pExisting[tmpField];
						}
						tmpMerged.OperationConfiguration = (tmpBody.OperationConfiguration !== undefined)
							? (typeof tmpBody.OperationConfiguration === 'string'
								? tmpBody.OperationConfiguration
								: JSON.stringify(tmpBody.OperationConfiguration))
							: pExisting.OperationConfiguration;
						tmpMerged.DependsOn = (tmpBody.DependsOn !== undefined)
							? (typeof tmpBody.DependsOn === 'string' ? tmpBody.DependsOn : JSON.stringify(tmpBody.DependsOn || []))
							: (pExisting.DependsOn || '[]');
						tmpMerged.ResetMode = (tmpBody.ResetMode !== undefined)
							? ((tmpBody.ResetMode === 'Replace') ? 'Replace' : 'Append')
							: (pExisting.ResetMode || 'Append');
						tmpMerged.Concurrency = (tmpBody.Concurrency !== undefined)
							? Math.max(0, parseInt(tmpBody.Concurrency, 10) || 0)
							: (pExisting.Concurrency || 0);
						// Compiled* are reset on edit so the next run
						// recompiles (the cfg may have changed materially).
						// They get re-populated by the run-operation path
						// after a successful UV /Operation register.
						tmpMerged.CompiledOperationHash = '';
						tmpMerged.CompiledOperationConfigHash = '';

						let fPersist = (pValidationWarning) =>
						{
							// PUT-by-id (meadow-endpoints 4.0.19+): URL ID is
							// authoritative, row updates in place, primary key
							// preserved. No more soft-delete-then-insert.
							beaconRequestEx('configs-databeacon', 'PUT',
								'/1.0/platform-configs/OperationConfig/' + tmpID, tmpMerged,
								(pErr, pUpdated) =>
								{
									if (pErr) return _self._sendError(pResponse, 502, pErr.message || String(pErr), fNext);

									// Re-register the UV Operation graph so the
									// edited config is reflected in UV's
									// /Operation list before the next run. Cache
									// keys were just cleared above, so this
									// always recompiles. Best-effort.
									_self._eagerRegisterOperationGraph(pUpdated || tmpMerged, (pIgnored, pRegResult) =>
									{
										let tmpResp = { Success: true, Operation: pUpdated };
										if (pValidationWarning) tmpResp.ValidationWarning = pValidationWarning;
										if (pRegResult) tmpResp.UVRegistration = pRegResult;
										pResponse.send(tmpResp);
										return fNext();
									});
								});
						};

						if (tmpSkipValidation) return fPersist('Validation skipped via ?skipValidation=1.');

						let tmpCfgErr = _self._validateOperationConfiguration(tmpMerged);
						if (tmpCfgErr) return _self._sendError(pResponse, 400, tmpCfgErr.message, fNext);

						_self._validateAgainstTarget(tmpMerged, (pValidationErr, pWarning) =>
						{
							if (pValidationErr) return _self._sendError(pResponse, 400, pValidationErr.message, fNext);
							return fPersist(pWarning || null);
						});
					});
			});

		// DELETE /mapper/operation/:id — soft-delete by primary key.
		pOratorServiceServer.doDel(`${tmpRoutePrefix}/operation/:id`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpID = parseInt(pRequest.params.id, 10);
				if (!tmpID) return _self._sendError(pResponse, 400, 'DELETE /mapper/operation/:id requires numeric ID', fNext);
				beaconRequestEx('configs-databeacon', 'DELETE',
					'/1.0/platform-configs/OperationConfig/' + tmpID, null,
					(pError, pResult) =>
					{
						if (pError) return _self._sendError(pResponse, 502, pError.message || String(pError), fNext);
						pResponse.send({ Success: true, Result: pResult });
						return fNext();
					});
			});

		// ── Ultravisor pass-through (compile + run via UV) ──────
		// This is the "glue" surface — the data-mapper UI calls these
		// to compile a stored MappingConfig into a fully-unfolded
		// Pull→Map→Write Ultravisor Operation, persist it on UV, run
		// it through UV's queue, and return the manifest. UV owns
		// execution, scheduling, and observability — the data-mapper
		// only describes the intent.

		// POST /mapper/uv/run-mapping/:id
		// Compile the MappingConfig identified by :id into an Operation
		// graph, POST it to UV's /Operation, trigger via /Operation/:Hash/Trigger
		// (synchronous — the Trigger endpoint returns the completed manifest
		// inline for ops that finish quickly), return both the assigned
		// OperationHash and the run summary.
		pOratorServiceServer.doPost(`${tmpRoutePrefix}/uv/run-mapping/:id`,
			(pRequest, pResponse, fNext) =>
			{
				if (!this.fable.DAL || !this.fable.DAL.MappingConfig)
				{
					return _self._sendError(pResponse, 500, 'MappingConfig DAL not initialized', fNext);
				}
				let tmpClient = _self._client();
				if (!tmpClient)
				{
					return _self._sendError(pResponse, 503, 'Not connected to an Ultravisor', fNext);
				}
				let tmpID = parseInt(pRequest.params.id, 10);
				if (!tmpID) return _self._sendError(pResponse, 400, 'POST /mapper/uv/run-mapping/:id requires numeric ID', fNext);

				let tmpReadQ = this.fable.DAL.MappingConfig.query.clone()
					.addFilter('IDMappingConfig', tmpID);
				this.fable.DAL.MappingConfig.doRead(tmpReadQ,
					(pErr, pQuery, pMapping) =>
					{
						if (pErr || !pMapping || !pMapping.IDMappingConfig)
						{
							return _self._sendError(pResponse, 404, 'Mapping ' + tmpID + ' not found', fNext);
						}
						let tmpGraph = _self._compileMappingToOperation(pMapping);
						_self._request('POST', '/Operation', tmpGraph,
							(pPostErr, pCreated) =>
							{
								if (pPostErr) return _self._sendError(pResponse, 502, 'UV /Operation failed: ' + pPostErr.message, fNext);
								let tmpHash = (pCreated && pCreated.Hash) || (tmpGraph && tmpGraph.Hash);
								if (!tmpHash) return _self._sendError(pResponse, 502, 'UV /Operation returned no Hash', fNext);

								_self._request('POST', '/Operation/' + tmpHash + '/Trigger', {},
									(pTrigErr, pManifest) =>
									{
										if (pTrigErr) return _self._sendError(pResponse, 502, 'UV /Trigger failed: ' + pTrigErr.message, fNext);
										let tmpHasTaskErrors = _self._taskOutputsHaveErrors(pManifest && pManifest.TaskOutputs);
										pResponse.send({
											Success:        pManifest && (pManifest.Status === 'Complete') && !tmpHasTaskErrors,
											OperationHash:  tmpHash,
											OperationName:  tmpGraph.Name,
											RunHash:        pManifest && pManifest.RunHash,
											Status:         pManifest && pManifest.Status,
											ElapsedMs:      pManifest && pManifest.ElapsedMs,
											TaskOutputs:    _self._summarizeTaskOutputs(pManifest && pManifest.TaskOutputs),
											Errors:         pManifest && pManifest.Errors,
											HasTaskErrors:  tmpHasTaskErrors
										});
										return fNext();
									});
							});
					});
			});

		// POST /mapper/uv/run-operation/:id
		// Look up the OperationConfig on the configs-databeacon by
		// IDOperationConfig, dispatch by OperationType to the matching
		// _compile<Type>ToOperation compiler, POST the resulting Operation
		// graph to UV's /Operation, trigger it, and return the manifest
		// summary. Same response shape as /mapper/uv/run-mapping/:id so
		// the editor's result-panel renderer is shared.
		pOratorServiceServer.doPost(`${tmpRoutePrefix}/uv/run-operation/:id`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpClient = _self._client();
				if (!tmpClient) return _self._sendError(pResponse, 503, 'Not connected to an Ultravisor', fNext);
				let tmpID = parseInt(pRequest.params.id, 10);
				if (!tmpID) return _self._sendError(pResponse, 400, 'POST /mapper/uv/run-operation/:id requires numeric ID', fNext);

				beaconRequestEx('configs-databeacon', 'GET',
					'/1.0/platform-configs/OperationConfig/' + tmpID, null,
					(pErr, pOperation) =>
					{
						if (pErr) return _self._sendError(pResponse, 502, pErr.message || String(pErr), fNext);
						if (!pOperation || !pOperation.IDOperationConfig)
						{
							return _self._sendError(pResponse, 404, 'Operation ' + tmpID + ' not found', fNext);
						}

						let tmpType = String(pOperation.OperationType || '').toLowerCase();
						let tmpGraph = null;
						let tmpDispatchErr = null;
						switch (tmpType)
						{
							case 'extraction':
								tmpGraph = _self._compileExtractionToOperation(pOperation);
								break;
							case 'unnest':
								tmpGraph = _self._compileUnnestToOperation(pOperation);
								break;
							case 'passthroughclone':
								tmpGraph = _self._compileCloneToOperation(pOperation);
								break;
							case 'aggregation':
								tmpGraph = _self._compileAggregationToOperation(pOperation);
								break;
							case 'sqlaggregate':
								tmpGraph = _self._compileSQLAggregateToOperation(pOperation);
								break;
							case 'histogram':
								tmpGraph = _self._compileHistogramToOperation(pOperation);
								break;
							case 'intersection':
								tmpGraph = _self._compileIntersectionToOperation(pOperation);
								break;
							case 'sqljoin':
								tmpGraph = _self._compileSQLJoinToOperation(pOperation);
								break;
							default:
								tmpDispatchErr = 'OperationType "' + pOperation.OperationType + '" not supported. Expected one of: Extraction, Unnest, PassthroughClone, Aggregation, SQLAggregate, Histogram, Intersection, SQLJoin.';
						}
						if (tmpDispatchErr)
						{
							return _self._sendError(pResponse, 501, tmpDispatchErr, fNext);
						}

						// Graph caching: if the OperationConfiguration hash
						// matches what we previously stored on the
						// OperationConfig row, skip re-registering the
						// graph on UV — just trigger the existing one.
						// Saves a UV /Operation roundtrip per run and keeps
						// UV's /Operation list from filling up with N copies
						// of the same graph. Persistent now (meadow-endpoints
						// 4.0.19 PUT-by-id makes per-row state durable
						// across edits and restarts).
						let tmpCfgHash = _self._hashOperationConfig(pOperation);
						let tmpCacheHit = !!(pOperation.CompiledOperationConfigHash === tmpCfgHash
							&& pOperation.CompiledOperationHash);

						let fTrigger = (pUVHash, pCacheHit) =>
						{
							_self._request('POST', '/Operation/' + pUVHash + '/Trigger',
								// TimeoutMs raised from UV's 10-min default to 1 hour
								// for high-volume runs (e.g. 250K-row clones write
								// ~12 min with 5-way concurrency). UV's OutputStore
								// keeps the manifest small via disk-spillover, so the
								// trigger only needs to outlast the write loop.
								{ TimeoutMs: 3600000 },
								(pTrigErr, pManifest) =>
								{
									if (pTrigErr)
									{
										// Cache-stale recovery: UV restarted (or
										// otherwise lost the graph) and our
										// cached hash isn't registered there
										// anymore. Recompile + re-register +
										// retry the trigger once. The cache
										// gets refreshed in the cache-write
										// path of the recompile branch below.
										if (pCacheHit && /not found/i.test(pTrigErr.message || ''))
										{
											_self.fable.log.info('run-operation: cached UV graph ' + pUVHash + ' missing — recompiling and retrying.');
											return fRegisterAndTrigger();
										}
										return _self._sendError(pResponse, 502, 'UV /Trigger failed: ' + pTrigErr.message, fNext);
									}
									let tmpHasTaskErrors = _self._taskOutputsHaveErrors(pManifest && pManifest.TaskOutputs);
									pResponse.send({
										Success:        pManifest && (pManifest.Status === 'Complete') && !tmpHasTaskErrors,
										OperationHash:  pUVHash,
										OperationName:  tmpGraph.Name,
										OperationType:  pOperation.OperationType,
										CacheHit:       !!pCacheHit,
										RunHash:        pManifest && pManifest.RunHash,
										Status:         pManifest && pManifest.Status,
										ElapsedMs:      pManifest && pManifest.ElapsedMs,
										TaskOutputs:    _self._summarizeTaskOutputs(pManifest && pManifest.TaskOutputs),
										Errors:         pManifest && pManifest.Errors,
										HasTaskErrors:  tmpHasTaskErrors
									});
									return fNext();
								});
						};

						let fRegisterAndTrigger = () =>
						{
							_self._request('POST', '/Operation', tmpGraph,
								(pPostErr, pCreated) =>
								{
									if (pPostErr) return _self._sendError(pResponse, 502, 'UV /Operation failed: ' + pPostErr.message, fNext);
									let tmpHash = (pCreated && pCreated.Hash) || (tmpGraph && tmpGraph.Hash);
									if (!tmpHash) return _self._sendError(pResponse, 502, 'UV /Operation returned no Hash', fNext);
									// Persist the new compiled hash on the
									// OperationConfig row via PUT-by-id (in-
									// place; IDOperationConfig stable). Best-
									// effort: if the persist fails we still
									// trigger; the next run just re-registers.
									let tmpUpdate = {
										IDOperationConfig:           pOperation.IDOperationConfig,
										CompiledOperationHash:       tmpHash,
										CompiledOperationConfigHash: tmpCfgHash
									};
									beaconRequestEx('configs-databeacon', 'PUT',
										'/1.0/platform-configs/OperationConfig/' + pOperation.IDOperationConfig, tmpUpdate,
										(pPutErr) =>
										{
											if (pPutErr) _self.fable.log.warn('run-operation: cache-persist failed: ' + pPutErr.message + ' (next run will re-register)');
											return fTrigger(tmpHash, false);
										});
								});
						};

						if (tmpCacheHit)
						{
							// Reuse the cached UV graph hash — no /Operation POST.
							return fTrigger(pOperation.CompiledOperationHash, true);
						}

						return fRegisterAndTrigger();
					});
			});


			// POST /mapper/uv/run-chain/:idOrHash
			//
			// Walk the OperationConfig.DependsOn DAG starting from
			// :idOrHash, run each operation in topological order (deepest
			// dependencies first), halt on the first failure. Cycles →
			// 400. The :idOrHash is interpreted as a numeric ID if
			// parseable, otherwise as a Hash — Hash is friendlier for
			// scripting since it's the user-chosen identifier.
			pOratorServiceServer.doPost(`${tmpRoutePrefix}/uv/run-chain/:idOrHash`,
				(pRequest, pResponse, fNext) =>
				{
					let tmpClient = _self._client();
					if (!tmpClient) return _self._sendError(pResponse, 503, 'Not connected to an Ultravisor', fNext);
					let tmpKey = String(pRequest.params.idOrHash || '');
					if (!tmpKey) return _self._sendError(pResponse, 400, 'POST /mapper/uv/run-chain/:idOrHash requires a Hash or numeric ID', fNext);
					let tmpAsInt = parseInt(tmpKey, 10);
					let tmpIsId = String(tmpAsInt) === tmpKey;

					// Pull the full operation set so we can resolve hashes →
					// configs and walk DependsOn references.
					beaconRequest('configs-databeacon', '/1.0/platform-configs/OperationConfigs/0/1000',
						(pListErr, pListRows) =>
						{
							if (pListErr) return _self._sendError(pResponse, 502, pListErr.message || String(pListErr), fNext);
							let tmpAll = (Array.isArray(pListRows) ? pListRows : []).filter((r) => !r.Deleted);
							let tmpById = {};
							let tmpByHash = {};
							for (let i = 0; i < tmpAll.length; i++)
							{
								tmpById[tmpAll[i].IDOperationConfig]  = tmpAll[i];
								tmpByHash[tmpAll[i].Hash]             = tmpAll[i];
							}
							let tmpStart = tmpIsId ? tmpById[tmpAsInt] : tmpByHash[tmpKey];
							if (!tmpStart) return _self._sendError(pResponse, 404, 'Operation "' + tmpKey + '" not found (looked up by ' + (tmpIsId ? 'ID' : 'Hash') + ')', fNext);

							// Topo sort: depth-first walk from :id, emitting
							// each node only after its dependencies. Throws on
							// cycle.
							let tmpOrder = [];
							let tmpVisiting = {};   // Hash → true while in current path
							let tmpVisited  = {};   // Hash → true once emitted

							let tmpCycle = null;
							let fVisit = (pNode) =>
							{
								if (tmpCycle) return;
								if (tmpVisited[pNode.Hash]) return;
								if (tmpVisiting[pNode.Hash])
								{
									tmpCycle = pNode.Hash;
									return;
								}
								tmpVisiting[pNode.Hash] = true;
								let tmpDeps = [];
								try { tmpDeps = JSON.parse(pNode.DependsOn || '[]') || []; } catch (e) { tmpDeps = []; }
								for (let d = 0; d < tmpDeps.length; d++)
								{
									let tmpDepHash = String(tmpDeps[d]);
									let tmpDep = tmpByHash[tmpDepHash];
									if (!tmpDep)
									{
										tmpCycle = '(missing dependency: ' + tmpDepHash + ' from ' + pNode.Hash + ')';
										return;
									}
									fVisit(tmpDep);
								}
								tmpVisiting[pNode.Hash] = false;
								tmpVisited[pNode.Hash] = true;
								tmpOrder.push(pNode);
							};
							fVisit(tmpStart);
							if (tmpCycle)
							{
								return _self._sendError(pResponse, 400,
									'Dependency cycle or missing dep detected at "' + tmpCycle + '" while resolving ' + tmpStart.Hash, fNext);
							}

							// Run each op sequentially via the existing
							// run-operation endpoint logic. We re-enter our own
							// REST surface to keep cache-write + ResetMode +
							// validation behavior consistent.
							let tmpResults = [];
							let tmpIdx = 0;
							let fRunNext = () =>
							{
								if (tmpIdx >= tmpOrder.length)
								{
									return pResponse.send({
										Success:    tmpResults.every((r) => r && r.Status === 'Complete'),
										ChainStart: tmpStart.Hash,
										ChainOrder: tmpOrder.map((o) => o.Hash),
										Results:    tmpResults
									}) && fNext();
								}
								let tmpCurrent = tmpOrder[tmpIdx++];
								// Inline the run-operation logic by issuing a
								// loopback POST. Simplest path that picks up
								// any future changes to that endpoint.
								let tmpUrl = 'http://127.0.0.1:' + (_self._Owner && _self._Owner.options && _self._Owner.options.Port || 8395)
									+ tmpRoutePrefix + '/uv/run-operation/' + tmpCurrent.IDOperationConfig;
								require('http').request(tmpUrl,
									{ method: 'POST', headers: { 'Content-Type': 'application/json' } },
									(pRes) =>
									{
										let tmpChunks = [];
										pRes.on('data', (c) => tmpChunks.push(c));
										pRes.on('end', () =>
										{
											let tmpBodyStr = Buffer.concat(tmpChunks).toString();
											let tmpRes = null;
											try { tmpRes = JSON.parse(tmpBodyStr); } catch (e) { tmpRes = { Error: 'parse: ' + e.message, Body: tmpBodyStr }; }
											tmpResults.push({
												Hash:           tmpCurrent.Hash,
												Name:           tmpCurrent.Name,
												OperationType:  tmpCurrent.OperationType,
												Status:         tmpRes && tmpRes.Status,
												Success:        !!(tmpRes && tmpRes.Success),
												CacheHit:       !!(tmpRes && tmpRes.CacheHit),
												ElapsedMs:      tmpRes && tmpRes.ElapsedMs,
												TaskOutputs:    tmpRes && tmpRes.TaskOutputs,
												Error:          tmpRes && tmpRes.Error
											});
											// Halt on first failure.
											if (!tmpRes || tmpRes.Error || tmpRes.Status !== 'Complete')
											{
												return pResponse.send({
													Success:    false,
													ChainStart: tmpStart.Hash,
													ChainOrder: tmpOrder.map((o) => o.Hash),
													HaltedAt:   tmpCurrent.Hash,
													Results:    tmpResults
												}) && fNext();
											}
											fRunNext();
										});
									}).on('error', (e) =>
									{
										tmpResults.push({ Hash: tmpCurrent.Hash, Error: e.message });
										return pResponse.send({
											Success:    false,
											ChainStart: tmpStart.Hash,
											HaltedAt:   tmpCurrent.Hash,
											Results:    tmpResults
										}) && fNext();
									}).end();
							};
							fRunNext();
						});
				});

			// POST /mapper/operation/:id/schedule
			// Body: { Cron: '<cron expr>', Enabled: true|false }
			//
			// Pass-through to UV's /Schedule/Operation. The OperationConfig's
			// CompiledOperationHash must be set (i.e. the op has been run at
			// least once) — UV schedules by hash, not by config-id.
			pOratorServiceServer.doPost(`${tmpRoutePrefix}/operation/:id/schedule`,
				(pRequest, pResponse, fNext) =>
				{
					let tmpClient = _self._client();
					if (!tmpClient) return _self._sendError(pResponse, 503, 'Not connected to an Ultravisor', fNext);
					let tmpID = parseInt(pRequest.params.id, 10);
					if (!tmpID) return _self._sendError(pResponse, 400, 'POST /mapper/operation/:id/schedule requires numeric ID', fNext);
					let tmpBody = pRequest.body || {};
					if (!tmpBody.Cron) return _self._sendError(pResponse, 400, 'Schedule body requires Cron (e.g. "0 */6 * * *").', fNext);

					beaconRequestEx('configs-databeacon', 'GET',
						'/1.0/platform-configs/OperationConfig/' + tmpID, null,
						(pErr, pOp) =>
						{
							if (pErr) return _self._sendError(pResponse, 502, pErr.message, fNext);
							if (!pOp || !pOp.IDOperationConfig) return _self._sendError(pResponse, 404, 'Operation ' + tmpID + ' not found', fNext);
							if (!pOp.CompiledOperationHash)
							{
								return _self._sendError(pResponse, 409,
									'Operation graph not yet registered with UV — run it once via /mapper/uv/run-operation/' + tmpID + ' before scheduling.', fNext);
							}
							_self._request('POST', '/Schedule/Operation',
								{ OperationHash: pOp.CompiledOperationHash, Cron: tmpBody.Cron, Enabled: (tmpBody.Enabled !== false) },
								(pSchedErr, pSchedRes) =>
								{
									if (pSchedErr) return _self._sendError(pResponse, 502, 'UV /Schedule/Operation failed: ' + pSchedErr.message, fNext);
									pResponse.send({ Success: true, Hash: pOp.Hash, OperationHash: pOp.CompiledOperationHash, Schedule: pSchedRes });
									return fNext();
								});
						});
				});

		// GET /mapper/uv/operations — list UV operations (scope-agnostic
		// for now; UV's Operations don't have the same Scope concept
		// as MappingConfig).
		pOratorServiceServer.doGet(`${tmpRoutePrefix}/uv/operations`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpClient = _self._client();
				if (!tmpClient) { pResponse.send({ Operations: [] }); return fNext(); }
				_self._request('GET', '/Operation', null,
					(pErr, pResult) =>
					{
						if (pErr) return _self._sendError(pResponse, 502, pErr.message || String(pErr), fNext);
						let tmpOps = Array.isArray(pResult) ? pResult : (pResult && pResult.Operations) || [];
						pResponse.send({ Count: tmpOps.length, Operations: tmpOps.map((o) =>
							({ Hash: o.Hash, Name: o.Name, Description: o.Description, Tags: o.Tags || [] })) });
						return fNext();
					});
			});

		// GET /mapper/uv/manifest/:runHash — fetch a manifest for display.
		pOratorServiceServer.doGet(`${tmpRoutePrefix}/uv/manifest/:runHash`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpClient = _self._client();
				if (!tmpClient) return _self._sendError(pResponse, 503, 'Not connected to an Ultravisor', fNext);
				_self._request('GET', '/Manifest/' + pRequest.params.runHash, null,
					(pErr, pManifest) =>
					{
						if (pErr) return _self._sendError(pResponse, 502, pErr.message || String(pErr), fNext);
						pResponse.send(pManifest);
						return fNext();
					});
			});

		this.fable.log.info(`DataMapper ConnectionBridge routes connected at ${tmpRoutePrefix}/*`);
	}

	/**
	 * Compile a MappingConfig record into the canonical Pull → Map →
	 * Comprehension → Write Ultravisor Operation graph.
	 *
	 *   Pull (data-mapper beacon)        — paginated read of source entity
	 *     ↓ State: Records[]
	 *   Map  (data-mapper beacon)        — TabularTransform per MappingConfiguration
	 *     ↓ State: Records[] (mapped, with deterministic GUID per GUIDTemplate)
	 *   Comprehension (data-mapper beacon) — keys mapped records by GUID into { Entity: { GUID: row } }
	 *     ↓ State: Comprehension{}
	 *   Write (data-mapper beacon)       — bulk Upserts via meadow-integration to the target meadow REST
	 *
	 * The 4-step shape is the canonical example from
	 * `examples/sample-operation.json`. The Comprehension node is the
	 * accumulator that makes upsert idempotent — meadow decides PUT vs
	 * INSERT per row by matching GUID<Entity>, and the deterministic
	 * combinatorial GUID in the MappingConfiguration's GUIDTemplate is
	 * what ties source rows to their lake-side identity.
	 */
	_compileMappingToOperation(pMapping)
	{
		let tmpMC = pMapping.MappingConfiguration || {};
		if (typeof tmpMC === 'string')
		{
			try { tmpMC = JSON.parse(tmpMC); } catch (e) { tmpMC = {}; }
		}
		let tmpMCString = JSON.stringify(tmpMC);

		let tmpEntity = pMapping.TargetEntity || tmpMC.Entity || 'Record';
		let tmpGUIDField = tmpMC.GUIDName || ('GUID' + tmpEntity);

		let tmpHashSeed = (pMapping.Hash || ('mapping-' + pMapping.IDMappingConfig));
		let tmpName = pMapping.Name || ('Mapping ' + (pMapping.Hash || pMapping.IDMappingConfig));

		return {
			Name: tmpName,
			Description: pMapping.Description || '',
			Tags: ['data-mapper', 'mapping', tmpHashSeed],
			Author: 'retold-data-mapper',
			Version: '1.0.0',
			Graph: {
				Nodes: [
					{ Hash: 'start', Type: 'start', X: 50, Y: 200, Width: 100, Height: 60, Title: 'Start',
					  Ports: [ { Hash: 'start-eo-out', Direction: 'output', Side: 'right-bottom' } ] },

					{ Hash: 'pull', Type: 'beacon-datamapperrecords-pullrecords',
					  X: 220, Y: 180, Width: 220, Height: 140, Title: 'Pull ' + (pMapping.SourceEntity || '?'),
					  Ports: [
						{ Hash: 'p-ei-Trigger',  Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'p-eo-Complete', Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'p-so-Result',   Direction: 'output', Side: 'right-top',    Label: 'Result' }
					  ],
					  Data: {
						SourceBeaconName: pMapping.SourceBeaconName || '',
						ConnectionHash:   pMapping.SourceConnectionHash || '',
						Entity:           pMapping.SourceEntity || '',
						BatchSize:        100,
						AffinityKey:      'data-mapper'
					  }
					},

					{ Hash: 'map', Type: 'beacon-datamappertransform-maprecords',
					  X: 480, Y: 180, Width: 220, Height: 140, Title: 'Map → ' + tmpEntity,
					  Ports: [
						{ Hash: 'm-ei-Trigger',  Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'm-eo-Complete', Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'm-si-Records',  Direction: 'input',  Side: 'left-top',    Label: 'Records' },
						{ Hash: 'm-so-Result',   Direction: 'output', Side: 'right-top',   Label: 'Result' }
					  ],
					  Data: {
						MappingConfiguration: tmpMCString,
						AffinityKey:          'data-mapper'
					  }
					},

					{ Hash: 'comprehension', Type: 'beacon-datamappertransform-buildcomprehension',
					  X: 740, Y: 180, Width: 240, Height: 140, Title: 'Comprehend ' + tmpEntity,
					  Ports: [
						{ Hash: 'c-ei-Trigger',       Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'c-eo-Complete',      Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'c-si-Records',       Direction: 'input',  Side: 'left-top',    Label: 'Records' },
						{ Hash: 'c-so-Comprehension', Direction: 'output', Side: 'right-top',   Label: 'Comprehension' }
					  ],
					  Data: {
						Entity:       tmpEntity,
						GUIDField:    tmpGUIDField,
						AffinityKey:  'data-mapper'
					  }
					},

					{ Hash: 'write', Type: 'beacon-datamapperrecords-writerecords',
					  X: 1020, Y: 180, Width: 240, Height: 140, Title: 'Upsert ' + tmpEntity,
					  Ports: [
						{ Hash: 'w-ei-Trigger',       Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'w-eo-Complete',      Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'w-si-Comprehension', Direction: 'input',  Side: 'left-top',    Label: 'Comprehension' }
					  ],
					  Data: {
						TargetBeaconName: pMapping.TargetBeaconName || '',
						ConnectionHash:   pMapping.TargetConnectionHash || '',
						Entity:           tmpEntity,
						AffinityKey:      'data-mapper'
					  }
					},

					{ Hash: 'end', Type: 'end', X: 1300, Y: 220, Width: 100, Height: 60, Title: 'End',
					  Ports: [ { Hash: 'end-ei-in', Direction: 'input', Side: 'left-bottom' } ] }
				],
				Connections: [
					// Event flow
					{ SourceNodeHash: 'start',         SourcePortHash: 'start-eo-out',   TargetNodeHash: 'pull',          TargetPortHash: 'p-ei-Trigger' },
					{ SourceNodeHash: 'pull',          SourcePortHash: 'p-eo-Complete',  TargetNodeHash: 'map',           TargetPortHash: 'm-ei-Trigger' },
					{ SourceNodeHash: 'map',           SourcePortHash: 'm-eo-Complete',  TargetNodeHash: 'comprehension', TargetPortHash: 'c-ei-Trigger' },
					{ SourceNodeHash: 'comprehension', SourcePortHash: 'c-eo-Complete',  TargetNodeHash: 'write',         TargetPortHash: 'w-ei-Trigger' },
					{ SourceNodeHash: 'write',         SourcePortHash: 'w-eo-Complete',  TargetNodeHash: 'end',           TargetPortHash: 'end-ei-in' },

					// State (data) flow
					{ SourceNodeHash: 'pull',          SourcePortHash: 'p-so-Result',         TargetNodeHash: 'map',           TargetPortHash: 'm-si-Records',       ConnectionType: 'State', Data: { StateKey: 'Records' } },
					{ SourceNodeHash: 'map',           SourcePortHash: 'm-so-Result',         TargetNodeHash: 'comprehension', TargetPortHash: 'c-si-Records',       ConnectionType: 'State', Data: { StateKey: 'Records' } },
					{ SourceNodeHash: 'comprehension', SourcePortHash: 'c-so-Comprehension',  TargetNodeHash: 'write',         TargetPortHash: 'w-si-Comprehension', ConnectionType: 'State', Data: { StateKey: 'Comprehension' } }
				],
				ViewState: { PanX: 0, PanY: 0, Zoom: 1 }
			}
		};
	}

	/**
	 * Compile an OperationConfig (OperationType=Extraction) into the
	 * canonical Pull → Extract → Comprehension → Write graph.
	 *
	 *   Pull       — paginated read of source entity
	 *     ↓ State: Records[]
	 *   Extract    — Filter + Project + GUID via DataMapperTransform:ExtractRecords
	 *     ↓ State: Records[]
	 *   Comprehension — keys mapped records by GUID
	 *     ↓ State: Comprehension{}
	 *   Write      — bulk Upserts via meadow-integration to TargetTable
	 *
	 * Same shape as _compileMappingToOperation, but the middle node is
	 * ExtractRecords instead of MapRecords. Filter rejects and Projection
	 * errors attribute to the Extract node in the manifest.
	 */
	_compileExtractionToOperation(pOperation)
	{
		let tmpCfg = pOperation.OperationConfiguration || {};
		if (typeof tmpCfg === 'string')
		{
			try { tmpCfg = JSON.parse(tmpCfg); } catch (e) { tmpCfg = {}; }
		}

		let tmpEntity = tmpCfg.Entity || pOperation.TargetTable || 'Record';
		let tmpGUIDName = tmpCfg.GUIDName || ('GUID' + tmpEntity);
		let tmpGUIDTemplate = tmpCfg.GUIDTemplate || '';
		let tmpProjection = tmpCfg.Projection || {};
		let tmpFilter = tmpCfg.Filter || null;
		let tmpHashSeed = (pOperation.Hash || ('operation-' + pOperation.IDOperationConfig));
		let tmpName = pOperation.Name || ('Operation ' + (pOperation.Hash || pOperation.IDOperationConfig));

		return {
			Name: tmpName,
			Description: pOperation.Description || '',
			Tags: ['data-mapper', 'operation', 'extraction', tmpHashSeed],
			Author: 'retold-data-mapper',
			Version: '1.0.0',
			Graph: {
				Nodes: [
					{ Hash: 'start', Type: 'start', X: 50, Y: 200, Width: 100, Height: 60, Title: 'Start',
					  Ports: [ { Hash: 'start-eo-out', Direction: 'output', Side: 'right-bottom' } ] },

					{ Hash: 'pull', Type: 'beacon-datamapperrecords-pullrecords',
					  X: 220, Y: 180, Width: 220, Height: 140, Title: 'Pull ' + (pOperation.SourceEntity || '?'),
					  Ports: [
						{ Hash: 'p-ei-Trigger',  Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'p-eo-Complete', Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'p-so-Result',   Direction: 'output', Side: 'right-top',    Label: 'Result' }
					  ],
					  Data: {
						SourceBeaconName: pOperation.SourceBeaconName || '',
						ConnectionHash:   pOperation.SourceConnectionHash || '',
						Entity:           pOperation.SourceEntity || '',
						BatchSize:        500,
						FilterExpression: tmpCfg.FilterExpression || '',
						SortField:        tmpCfg.SortField || '',
						AffinityKey:      'data-mapper'
					  }
					},

					{ Hash: 'extract', Type: 'beacon-datamappertransform-extractrecords',
					  X: 480, Y: 180, Width: 220, Height: 140, Title: 'Extract → ' + tmpEntity,
					  Ports: [
						{ Hash: 'x-ei-Trigger',  Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'x-eo-Complete', Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'x-si-Records',  Direction: 'input',  Side: 'left-top',    Label: 'Records' },
						{ Hash: 'x-so-Result',   Direction: 'output', Side: 'right-top',   Label: 'Result' }
					  ],
					  Data: {
						// Bundle Entity / GUIDName / GUIDTemplate / Projection / Filter
						// into ONE Object-typed setting. UV's settings resolver
						// template-resolves String-typed inputs (it would strip
						// {~D:Record.X~} placeholders from a top-level GUIDTemplate
						// or Projection-value strings before the handler runs).
						// MappingConfiguration in MapRecords uses the same trick.
						OperationConfiguration: JSON.stringify({
							Entity:       tmpEntity,
							GUIDName:     tmpGUIDName,
							GUIDTemplate: tmpGUIDTemplate,
							Projection:   tmpProjection,
							Filter:       tmpFilter
						}),
						AffinityKey:  'data-mapper'
					  }
					},

					{ Hash: 'comprehension', Type: 'beacon-datamappertransform-buildcomprehension',
					  X: 740, Y: 180, Width: 240, Height: 140, Title: 'Comprehend ' + tmpEntity,
					  Ports: [
						{ Hash: 'c-ei-Trigger',       Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'c-eo-Complete',      Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'c-si-Records',       Direction: 'input',  Side: 'left-top',    Label: 'Records' },
						{ Hash: 'c-so-Comprehension', Direction: 'output', Side: 'right-top',   Label: 'Comprehension' }
					  ],
					  Data: {
						Entity:       tmpEntity,
						GUIDField:    tmpGUIDName,
						AffinityKey:  'data-mapper'
					  }
					},

					{ Hash: 'write', Type: 'beacon-datamapperrecords-writerecords',
					  X: 1020, Y: 180, Width: 240, Height: 140, Title: 'Upsert ' + tmpEntity,
					  Ports: [
						{ Hash: 'w-ei-Trigger',       Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'w-eo-Complete',      Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'w-si-Comprehension', Direction: 'input',  Side: 'left-top',    Label: 'Comprehension' }
					  ],
					  Data: {
						TargetBeaconName: pOperation.TargetBeaconName || '',
						ConnectionHash:   pOperation.TargetConnectionHash || '',
						Entity:           tmpEntity,
						GUIDName:         tmpGUIDName,
						// Typed ops opt into parallel write chunks (5-way pool by
						// default). OperationConfig.Concurrency overrides per-op.
						// Mapping (the existing flow) stays at the default 1.
						Concurrency:      Math.max(1, Math.min(5, pOperation.Concurrency || 5)),
						// ResetMode tells WriteRecords to soft-delete orphan rows
						// (existing GUIDs not in the new comprehension) after the
						// upsert succeeds. Default 'Append' = no purge.
						ResetMode:        (pOperation.ResetMode === 'Replace') ? 'Replace' : 'Append',
						AffinityKey:      'data-mapper'
					  }
					},

					{ Hash: 'end', Type: 'end', X: 1300, Y: 220, Width: 100, Height: 60, Title: 'End',
					  Ports: [ { Hash: 'end-ei-in', Direction: 'input', Side: 'left-bottom' } ] }
				],
				Connections: [
					// Event flow
					{ SourceNodeHash: 'start',         SourcePortHash: 'start-eo-out',   TargetNodeHash: 'pull',          TargetPortHash: 'p-ei-Trigger' },
					{ SourceNodeHash: 'pull',          SourcePortHash: 'p-eo-Complete',  TargetNodeHash: 'extract',       TargetPortHash: 'x-ei-Trigger' },
					{ SourceNodeHash: 'extract',       SourcePortHash: 'x-eo-Complete',  TargetNodeHash: 'comprehension', TargetPortHash: 'c-ei-Trigger' },
					{ SourceNodeHash: 'comprehension', SourcePortHash: 'c-eo-Complete',  TargetNodeHash: 'write',         TargetPortHash: 'w-ei-Trigger' },
					{ SourceNodeHash: 'write',         SourcePortHash: 'w-eo-Complete',  TargetNodeHash: 'end',           TargetPortHash: 'end-ei-in' },

					// State (data) flow
					{ SourceNodeHash: 'pull',          SourcePortHash: 'p-so-Result',         TargetNodeHash: 'extract',       TargetPortHash: 'x-si-Records',       ConnectionType: 'State', Data: { StateKey: 'Records' } },
					{ SourceNodeHash: 'extract',       SourcePortHash: 'x-so-Result',         TargetNodeHash: 'comprehension', TargetPortHash: 'c-si-Records',       ConnectionType: 'State', Data: { StateKey: 'Records' } },
					{ SourceNodeHash: 'comprehension', SourcePortHash: 'c-so-Comprehension',  TargetNodeHash: 'write',         TargetPortHash: 'w-si-Comprehension', ConnectionType: 'State', Data: { StateKey: 'Comprehension' } }
				],
				ViewState: { PanX: 0, PanY: 0, Zoom: 1 }
			}
		};
	}

	/**
	 * Compile an OperationConfig (OperationType=Unnest) into the same
	 * Pull → <middle> → Comprehend → Write graph as Extraction, except the
	 * middle node is UnnestRecords: it explodes OperationConfiguration.ArrayPath
	 * into one record per element (1→N). ElementProjection / ParentCarry / Filter
	 * attribute to the Unnest node in the manifest.
	 */
	_compileUnnestToOperation(pOperation)
	{
		let tmpCfg = pOperation.OperationConfiguration || {};
		if (typeof tmpCfg === 'string')
		{
			try { tmpCfg = JSON.parse(tmpCfg); } catch (e) { tmpCfg = {}; }
		}

		let tmpEntity = tmpCfg.Entity || pOperation.TargetTable || 'Record';
		let tmpGUIDName = tmpCfg.GUIDName || ('GUID' + tmpEntity);
		let tmpGUIDTemplate = tmpCfg.GUIDTemplate || '';
		let tmpArrayPath = tmpCfg.ArrayPath || '';
		let tmpElementProjection = tmpCfg.ElementProjection || {};
		let tmpParentCarry = tmpCfg.ParentCarry || {};
		let tmpFilter = tmpCfg.Filter || null;
		let tmpSolvers = Array.isArray(tmpCfg.Solvers) ? tmpCfg.Solvers : [];
		let tmpHashSeed = (pOperation.Hash || ('operation-' + pOperation.IDOperationConfig));
		let tmpName = pOperation.Name || ('Operation ' + (pOperation.Hash || pOperation.IDOperationConfig));

		return {
			Name: tmpName,
			Description: pOperation.Description || '',
			Tags: ['data-mapper', 'operation', 'unnest', tmpHashSeed],
			Author: 'retold-data-mapper',
			Version: '1.0.0',
			Graph: {
				Nodes: [
					{ Hash: 'start', Type: 'start', X: 50, Y: 200, Width: 100, Height: 60, Title: 'Start',
					  Ports: [ { Hash: 'start-eo-out', Direction: 'output', Side: 'right-bottom' } ] },

					{ Hash: 'pull', Type: 'beacon-datamapperrecords-pullrecords',
					  X: 220, Y: 180, Width: 220, Height: 140, Title: 'Pull ' + (pOperation.SourceEntity || '?'),
					  Ports: [
						{ Hash: 'p-ei-Trigger',  Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'p-eo-Complete', Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'p-so-Result',   Direction: 'output', Side: 'right-top',    Label: 'Result' }
					  ],
					  Data: {
						SourceBeaconName: pOperation.SourceBeaconName || '',
						ConnectionHash:   pOperation.SourceConnectionHash || '',
						Entity:           pOperation.SourceEntity || '',
						BatchSize:        500,
						FilterExpression: tmpCfg.FilterExpression || '',
						SortField:        tmpCfg.SortField || '',
						AffinityKey:      'data-mapper'
					  }
					},

					{ Hash: 'unnest', Type: 'beacon-datamappertransform-unnestrecords',
					  X: 480, Y: 180, Width: 220, Height: 140, Title: 'Unnest → ' + tmpEntity,
					  Ports: [
						{ Hash: 'u-ei-Trigger',  Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'u-eo-Complete', Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'u-si-Records',  Direction: 'input',  Side: 'left-top',    Label: 'Records' },
						{ Hash: 'u-so-Result',   Direction: 'output', Side: 'right-top',   Label: 'Result' }
					  ],
					  Data: {
						OperationConfiguration: JSON.stringify({
							Entity:            tmpEntity,
							GUIDName:          tmpGUIDName,
							GUIDTemplate:      tmpGUIDTemplate,
							ArrayPath:         tmpArrayPath,
							ElementProjection: tmpElementProjection,
							ParentCarry:       tmpParentCarry,
							Filter:            tmpFilter,
							Solvers:           tmpSolvers
						}),
						AffinityKey:  'data-mapper'
					  }
					},

					{ Hash: 'comprehension', Type: 'beacon-datamappertransform-buildcomprehension',
					  X: 740, Y: 180, Width: 240, Height: 140, Title: 'Comprehend ' + tmpEntity,
					  Ports: [
						{ Hash: 'c-ei-Trigger',       Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'c-eo-Complete',      Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'c-si-Records',       Direction: 'input',  Side: 'left-top',    Label: 'Records' },
						{ Hash: 'c-so-Comprehension', Direction: 'output', Side: 'right-top',   Label: 'Comprehension' }
					  ],
					  Data: {
						Entity:       tmpEntity,
						GUIDField:    tmpGUIDName,
						AffinityKey:  'data-mapper'
					  }
					},

					{ Hash: 'write', Type: 'beacon-datamapperrecords-writerecords',
					  X: 1020, Y: 180, Width: 240, Height: 140, Title: 'Upsert ' + tmpEntity,
					  Ports: [
						{ Hash: 'w-ei-Trigger',       Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'w-eo-Complete',      Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'w-si-Comprehension', Direction: 'input',  Side: 'left-top',    Label: 'Comprehension' }
					  ],
					  Data: {
						TargetBeaconName: pOperation.TargetBeaconName || '',
						ConnectionHash:   pOperation.TargetConnectionHash || '',
						Entity:           tmpEntity,
						GUIDName:         tmpGUIDName,
						Concurrency:      Math.max(1, Math.min(5, pOperation.Concurrency || 5)),
						ResetMode:        (pOperation.ResetMode === 'Replace') ? 'Replace' : 'Append',
						AffinityKey:      'data-mapper'
					  }
					},

					{ Hash: 'end', Type: 'end', X: 1300, Y: 220, Width: 100, Height: 60, Title: 'End',
					  Ports: [ { Hash: 'end-ei-in', Direction: 'input', Side: 'left-bottom' } ] }
				],
				Connections: [
					{ SourceNodeHash: 'start',         SourcePortHash: 'start-eo-out',   TargetNodeHash: 'pull',          TargetPortHash: 'p-ei-Trigger' },
					{ SourceNodeHash: 'pull',          SourcePortHash: 'p-eo-Complete',  TargetNodeHash: 'unnest',        TargetPortHash: 'u-ei-Trigger' },
					{ SourceNodeHash: 'unnest',        SourcePortHash: 'u-eo-Complete',  TargetNodeHash: 'comprehension', TargetPortHash: 'c-ei-Trigger' },
					{ SourceNodeHash: 'comprehension', SourcePortHash: 'c-eo-Complete',  TargetNodeHash: 'write',         TargetPortHash: 'w-ei-Trigger' },
					{ SourceNodeHash: 'write',         SourcePortHash: 'w-eo-Complete',  TargetNodeHash: 'end',           TargetPortHash: 'end-ei-in' },

					{ SourceNodeHash: 'pull',          SourcePortHash: 'p-so-Result',         TargetNodeHash: 'unnest',        TargetPortHash: 'u-si-Records',       ConnectionType: 'State', Data: { StateKey: 'Records' } },
					{ SourceNodeHash: 'unnest',        SourcePortHash: 'u-so-Result',         TargetNodeHash: 'comprehension', TargetPortHash: 'c-si-Records',       ConnectionType: 'State', Data: { StateKey: 'Records' } },
					{ SourceNodeHash: 'comprehension', SourcePortHash: 'c-so-Comprehension',  TargetNodeHash: 'write',         TargetPortHash: 'w-si-Comprehension', ConnectionType: 'State', Data: { StateKey: 'Comprehension' } }
				],
				ViewState: { PanX: 0, PanY: 0, Zoom: 1 }
			}
		};
	}

	/**
	 * Compile an OperationConfig (OperationType=PassthroughClone) into a
	 * single-node streaming graph: one CloneStream work item that loops
	 * pull-batch + write-batch internally until the source is exhausted.
	 *
	 * Different layout from Extraction (Pull → Extract → Comprehend → Write):
	 * the Comprehension stage is gone because the destination's GUIDxxxMirror
	 * upsert key already dedups on the write side. State edges never carry
	 * a giant array — at 100x scale (2.5M rows) memory ceiling is one batch.
	 *
	 * Use for 1:1 clones where there's no cross-record JS logic. For
	 * computed columns / synthetic GUIDs / row-pair operations, the
	 * Extraction layout still applies.
	 */
	_compileCloneToOperation(pOperation)
	{
		let tmpCfg = pOperation.OperationConfiguration || {};
		if (typeof tmpCfg === 'string')
		{
			try { tmpCfg = JSON.parse(tmpCfg); } catch (e) { tmpCfg = {}; }
		}

		let tmpEntity        = tmpCfg.Entity || pOperation.TargetTable || 'Record';
		let tmpGUIDName      = tmpCfg.GUIDName || ('GUID' + tmpEntity);
		let tmpGUIDTemplate  = tmpCfg.GUIDTemplate || '';
		let tmpProjection    = tmpCfg.Projection || null;
		let tmpHashSeed      = (pOperation.Hash || ('operation-' + pOperation.IDOperationConfig));
		let tmpName          = pOperation.Name || ('Clone ' + (pOperation.Hash || pOperation.IDOperationConfig));

		return {
			Name: tmpName,
			Description: pOperation.Description || '',
			Tags: ['data-mapper', 'operation', 'passthrough-clone', tmpHashSeed],
			Author: 'retold-data-mapper',
			Version: '1.0.0',
			Graph: {
				Nodes: [
					{ Hash: 'start', Type: 'start', X: 50, Y: 200, Width: 100, Height: 60, Title: 'Start',
					  Ports: [ { Hash: 'start-eo-out', Direction: 'output', Side: 'right-bottom' } ] },

					{ Hash: 'clone', Type: 'beacon-datamapperrecords-clonestream',
					  X: 220, Y: 180, Width: 240, Height: 140,
					  Title: 'Stream ' + (pOperation.SourceEntity || '?') + ' → ' + tmpEntity,
					  Ports: [
						{ Hash: 'c-ei-Trigger',  Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'c-eo-Complete', Direction: 'output', Side: 'right-bottom', Label: 'Complete' }
					  ],
					  Data: {
						SourceBeaconName:     pOperation.SourceBeaconName || '',
						SourceConnectionHash: pOperation.SourceConnectionHash || '',
						SourceEntity:         pOperation.SourceEntity || '',
						TargetBeaconName:     pOperation.TargetBeaconName || '',
						TargetConnectionHash: pOperation.TargetConnectionHash || '',
						TargetEntity:         tmpEntity,
						GUIDName:             tmpGUIDName,
						BatchSize:            tmpCfg.BatchSize || 500,
						// SortField/FilterExpression/WriteConcurrency are
						// optional; the executor defaults SortField to
						// 'ID<SourceEntity>'. Pass through if the caller set them.
						SortField:            (tmpCfg.SortField !== undefined) ? tmpCfg.SortField : undefined,
						FilterExpression:     tmpCfg.FilterExpression || '',
						WriteConcurrency:     tmpCfg.WriteConcurrency || 1,
						// GUIDTemplate + Projection live inside an Object-typed
						// setting so UV's settings resolver doesn't template-strip
						// the {~D:Record.X~} placeholders before the handler runs.
						// (The resolver substitutes those tokens against whatever's
						// in scope at compile time, which collapses every batch
						// to the same GUID and the upserts overwrite a single
						// row. Same trick the typed-op compilers use for the
						// Aggregate/Histogram/Intersect Settings.)
						OperationConfiguration: JSON.stringify({ Projection: tmpProjection, GUIDTemplate: tmpGUIDTemplate }),
						AffinityKey:          'data-mapper'
					  }
					},

					{ Hash: 'end', Type: 'end', X: 540, Y: 220, Width: 100, Height: 60, Title: 'End',
					  Ports: [ { Hash: 'end-ei-in', Direction: 'input', Side: 'left-bottom' } ] }
				],
				Connections: [
					{ SourceNodeHash: 'start', SourcePortHash: 'start-eo-out',  TargetNodeHash: 'clone', TargetPortHash: 'c-ei-Trigger' },
					{ SourceNodeHash: 'clone', SourcePortHash: 'c-eo-Complete', TargetNodeHash: 'end',   TargetPortHash: 'end-ei-in' }
				],
				ViewState: { PanX: 0, PanY: 0, Zoom: 1 }
			}
		};
	}

	/**
	 * Compile an OperationConfig (OperationType=SQLAggregate) into a
	 * single-node streaming graph: one AggregateStream work item that
	 * pushes the GROUP BY into the source DB, receives the small result
	 * set (cardinality of group keys), and chunked-writes the rows.
	 *
	 * Different layout from Aggregation (Pull → Aggregate → Comprehend → Write):
	 * the source frame never enters V8 — only the aggregated result does.
	 * Memory ceiling = group cardinality, not source row count. Pair with
	 * source databases that have indexes on the GroupBy columns; otherwise
	 * the source-side scan dominates.
	 */
	_compileSQLAggregateToOperation(pOperation)
	{
		let tmpCfg = pOperation.OperationConfiguration || {};
		if (typeof tmpCfg === 'string')
		{
			try { tmpCfg = JSON.parse(tmpCfg); } catch (e) { tmpCfg = {}; }
		}

		let tmpEntity        = tmpCfg.Entity || pOperation.TargetTable || 'Aggregate';
		let tmpGUIDName      = tmpCfg.GUIDName || ('GUID' + tmpEntity);
		let tmpGUIDTemplate  = tmpCfg.GUIDTemplate || '';
		let tmpGroupBy       = Array.isArray(tmpCfg.GroupBy) ? tmpCfg.GroupBy : [];
		let tmpAggregates    = Array.isArray(tmpCfg.Aggregates) ? tmpCfg.Aggregates : [];
		let tmpOrderBy       = Array.isArray(tmpCfg.OrderBy) ? tmpCfg.OrderBy : [];
		let tmpHashSeed      = (pOperation.Hash || ('operation-' + pOperation.IDOperationConfig));
		let tmpName          = pOperation.Name || ('SQLAggregate ' + (pOperation.Hash || pOperation.IDOperationConfig));

		// Bundle GroupBy/Aggregates/GUIDTemplate inside an Object-typed
		// OperationConfiguration setting so UV's settings resolver doesn't
		// template-strip the {~D:Record.X~} placeholders or chew on the
		// nested arrays. Same trick CloneStream uses for its GUIDTemplate.
		let tmpBundledCfg = {
			GroupBy: tmpGroupBy,
			Aggregates: tmpAggregates,
			GUIDTemplate: tmpGUIDTemplate
		};
		if (tmpOrderBy.length > 0) { tmpBundledCfg.OrderBy = tmpOrderBy; }

		return {
			Name: tmpName,
			Description: pOperation.Description || '',
			Tags: ['data-mapper', 'operation', 'sql-aggregate', tmpHashSeed],
			Author: 'retold-data-mapper',
			Version: '1.0.0',
			Graph: {
				Nodes: [
					{ Hash: 'start', Type: 'start', X: 50, Y: 200, Width: 100, Height: 60, Title: 'Start',
					  Ports: [ { Hash: 'start-eo-out', Direction: 'output', Side: 'right-bottom' } ] },

					{ Hash: 'agg', Type: 'beacon-datamapperrecords-aggregatestream',
					  X: 220, Y: 180, Width: 260, Height: 140,
					  Title: 'SQL Agg ' + (pOperation.SourceEntity || '?') + ' → ' + tmpEntity,
					  Ports: [
						{ Hash: 'a-ei-Trigger',  Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'a-eo-Complete', Direction: 'output', Side: 'right-bottom', Label: 'Complete' }
					  ],
					  Data: {
						SourceBeaconName:     pOperation.SourceBeaconName || '',
						SourceConnection:     pOperation.SourceConnectionHash || '',
						SourceTable:          pOperation.SourceEntity || '',
						TargetBeaconName:     pOperation.TargetBeaconName || '',
						TargetConnectionHash: pOperation.TargetConnectionHash || '',
						TargetEntity:         tmpEntity,
						GUIDName:             tmpGUIDName,
						BatchSize:            tmpCfg.BatchSize || 500,
						OperationConfiguration: JSON.stringify(tmpBundledCfg),
						AffinityKey:          'data-mapper'
					  }
					},

					{ Hash: 'end', Type: 'end', X: 560, Y: 220, Width: 100, Height: 60, Title: 'End',
					  Ports: [ { Hash: 'end-ei-in', Direction: 'input', Side: 'left-bottom' } ] }
				],
				Connections: [
					{ SourceNodeHash: 'start', SourcePortHash: 'start-eo-out',  TargetNodeHash: 'agg', TargetPortHash: 'a-ei-Trigger' },
					{ SourceNodeHash: 'agg',   SourcePortHash: 'a-eo-Complete', TargetNodeHash: 'end', TargetPortHash: 'end-ei-in' }
				],
				ViewState: { PanX: 0, PanY: 0, Zoom: 1 }
			}
		};
	}

	/**
	 * Compile an OperationConfig (OperationType=SQLJoin) into a single-node
	 * streaming graph: one JoinStream work item that pages an INNER JOIN out
	 * of the source DB and chunked-writes each page to the target table.
	 *
	 * Different layout from Intersection (Pull → Pull-Related → Intersect →
	 * Comprehend → Write): both source frames never enter V8 — only one
	 * page-sized batch of the joined result lives in memory at a time. The
	 * planner-side requirement is that source + related share a connection
	 * so the JOIN can be done at the DB.
	 */
	_compileSQLJoinToOperation(pOperation)
	{
		let tmpCfg = pOperation.OperationConfiguration || {};
		if (typeof tmpCfg === 'string')
		{
			try { tmpCfg = JSON.parse(tmpCfg); } catch (e) { tmpCfg = {}; }
		}

		let tmpEntity        = tmpCfg.Entity || pOperation.TargetTable || 'Joined';
		let tmpGUIDName      = tmpCfg.GUIDName || ('GUID' + tmpEntity);
		let tmpGUIDTemplate  = tmpCfg.GUIDTemplate || '';
		let tmpJoinOn        = tmpCfg.JoinOn || {};
		let tmpProjection    = tmpCfg.Projection || {};
		let tmpOrderBy       = tmpCfg.OrderBy || '';
		let tmpRelatedTable  = tmpCfg.RelatedEntity || '';
		let tmpHashSeed      = (pOperation.Hash || ('operation-' + pOperation.IDOperationConfig));
		let tmpName          = pOperation.Name || ('SQLJoin ' + (pOperation.Hash || pOperation.IDOperationConfig));

		// Bundle JoinOn / Projection / OrderBy / GUIDTemplate inside an
		// Object-typed Setting so UV's resolver leaves the {~D:Record.X~} /
		// {~D:Related.X~} placeholders in the projection alone (otherwise
		// the resolver chews them up before the handler sees them).
		let tmpBundledCfg = {
			JoinOn:       tmpJoinOn,
			Projection:   tmpProjection,
			OrderBy:      tmpOrderBy,
			GUIDTemplate: tmpGUIDTemplate
		};

		return {
			Name: tmpName,
			Description: pOperation.Description || '',
			Tags: ['data-mapper', 'operation', 'sql-join', tmpHashSeed],
			Author: 'retold-data-mapper',
			Version: '1.0.0',
			Graph: {
				Nodes: [
					{ Hash: 'start', Type: 'start', X: 50, Y: 200, Width: 100, Height: 60, Title: 'Start',
					  Ports: [ { Hash: 'start-eo-out', Direction: 'output', Side: 'right-bottom' } ] },

					{ Hash: 'join', Type: 'beacon-datamapperrecords-joinstream',
					  X: 220, Y: 180, Width: 280, Height: 140,
					  Title: 'SQL Join ' + (pOperation.SourceEntity || '?') + ' ⨝ ' + tmpRelatedTable + ' → ' + tmpEntity,
					  Ports: [
						{ Hash: 'j-ei-Trigger',  Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'j-eo-Complete', Direction: 'output', Side: 'right-bottom', Label: 'Complete' }
					  ],
					  Data: {
						SourceBeaconName:     pOperation.SourceBeaconName || '',
						SourceConnection:     pOperation.SourceConnectionHash || '',
						SourceTable:          pOperation.SourceEntity || '',
						RelatedTable:         tmpRelatedTable,
						TargetBeaconName:     pOperation.TargetBeaconName || '',
						TargetConnectionHash: pOperation.TargetConnectionHash || '',
						TargetEntity:         tmpEntity,
						GUIDName:             tmpGUIDName,
						BatchSize:            tmpCfg.BatchSize || 500,
						OperationConfiguration: JSON.stringify(tmpBundledCfg),
						AffinityKey:          'data-mapper'
					  }
					},

					{ Hash: 'end', Type: 'end', X: 580, Y: 220, Width: 100, Height: 60, Title: 'End',
					  Ports: [ { Hash: 'end-ei-in', Direction: 'input', Side: 'left-bottom' } ] }
				],
				Connections: [
					{ SourceNodeHash: 'start', SourcePortHash: 'start-eo-out',  TargetNodeHash: 'join', TargetPortHash: 'j-ei-Trigger' },
					{ SourceNodeHash: 'join',  SourcePortHash: 'j-eo-Complete', TargetNodeHash: 'end',  TargetPortHash: 'end-ei-in' }
				],
				ViewState: { PanX: 0, PanY: 0, Zoom: 1 }
			}
		};
	}

	/**
	 * Compile an OperationConfig (OperationType=Aggregation) into the
	 * canonical Pull → Aggregate → Comprehension → Write graph. The
	 * Aggregate node groups records by GroupBy keys and computes the
	 * configured aggregates per group.
	 */
	_compileAggregationToOperation(pOperation)
	{
		let tmpCfg = pOperation.OperationConfiguration || {};
		if (typeof tmpCfg === 'string') { try { tmpCfg = JSON.parse(tmpCfg); } catch (e) { tmpCfg = {}; } }

		let tmpEntity = tmpCfg.Entity || pOperation.TargetTable || 'Aggregate';
		let tmpGUIDName = tmpCfg.GUIDName || ('GUID' + tmpEntity);
		let tmpHashSeed = (pOperation.Hash || ('operation-' + pOperation.IDOperationConfig));
		let tmpName = pOperation.Name || ('Operation ' + (pOperation.Hash || pOperation.IDOperationConfig));

		return {
			Name: tmpName,
			Description: pOperation.Description || '',
			Tags: ['data-mapper', 'operation', 'aggregation', tmpHashSeed],
			Author: 'retold-data-mapper',
			Version: '1.0.0',
			Graph: {
				Nodes: [
					{ Hash: 'start', Type: 'start', X: 50, Y: 200, Width: 100, Height: 60, Title: 'Start',
					  Ports: [ { Hash: 'start-eo-out', Direction: 'output', Side: 'right-bottom' } ] },

					{ Hash: 'pull', Type: 'beacon-datamapperrecords-pullrecords',
					  X: 220, Y: 180, Width: 220, Height: 140, Title: 'Pull ' + (pOperation.SourceEntity || '?'),
					  Ports: [
						{ Hash: 'p-ei-Trigger',  Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'p-eo-Complete', Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'p-so-Result',   Direction: 'output', Side: 'right-top',    Label: 'Result' }
					  ],
					  Data: {
						SourceBeaconName: pOperation.SourceBeaconName || '',
						ConnectionHash:   pOperation.SourceConnectionHash || '',
						Entity:           pOperation.SourceEntity || '',
						BatchSize:        500,
						FilterExpression: tmpCfg.FilterExpression || '',
						SortField:        tmpCfg.SortField || '',
						AffinityKey:      'data-mapper'
					  }
					},

					{ Hash: 'aggregate', Type: 'beacon-datamappertransform-aggregaterecords',
					  X: 480, Y: 180, Width: 220, Height: 140, Title: 'Aggregate → ' + tmpEntity,
					  Ports: [
						{ Hash: 'a-ei-Trigger',  Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'a-eo-Complete', Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'a-si-Records',  Direction: 'input',  Side: 'left-top',    Label: 'Records' },
						{ Hash: 'a-so-Result',   Direction: 'output', Side: 'right-top',   Label: 'Result' }
					  ],
					  Data: {
						OperationConfiguration: JSON.stringify(tmpCfg),
						AffinityKey:            'data-mapper'
					  }
					},

					{ Hash: 'comprehension', Type: 'beacon-datamappertransform-buildcomprehension',
					  X: 740, Y: 180, Width: 240, Height: 140, Title: 'Comprehend ' + tmpEntity,
					  Ports: [
						{ Hash: 'c-ei-Trigger',       Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'c-eo-Complete',      Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'c-si-Records',       Direction: 'input',  Side: 'left-top',    Label: 'Records' },
						{ Hash: 'c-so-Comprehension', Direction: 'output', Side: 'right-top',   Label: 'Comprehension' }
					  ],
					  Data: { Entity: tmpEntity, GUIDField: tmpGUIDName, AffinityKey: 'data-mapper' }
					},

					{ Hash: 'write', Type: 'beacon-datamapperrecords-writerecords',
					  X: 1020, Y: 180, Width: 240, Height: 140, Title: 'Upsert ' + tmpEntity,
					  Ports: [
						{ Hash: 'w-ei-Trigger',       Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'w-eo-Complete',      Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'w-si-Comprehension', Direction: 'input',  Side: 'left-top',    Label: 'Comprehension' }
					  ],
					  Data: {
						TargetBeaconName: pOperation.TargetBeaconName || '',
						ConnectionHash:   pOperation.TargetConnectionHash || '',
						Entity:           tmpEntity,
						GUIDName:         tmpGUIDName,
						// Typed ops opt into parallel write chunks (5-way pool by
						// default). OperationConfig.Concurrency overrides per-op.
						// Mapping (the existing flow) stays at the default 1.
						Concurrency:      Math.max(1, Math.min(5, pOperation.Concurrency || 5)),
						// ResetMode tells WriteRecords to soft-delete orphan rows
						// (existing GUIDs not in the new comprehension) after the
						// upsert succeeds. Default 'Append' = no purge.
						ResetMode:        (pOperation.ResetMode === 'Replace') ? 'Replace' : 'Append',
						AffinityKey:      'data-mapper'
					  }
					},

					{ Hash: 'end', Type: 'end', X: 1300, Y: 220, Width: 100, Height: 60, Title: 'End',
					  Ports: [ { Hash: 'end-ei-in', Direction: 'input', Side: 'left-bottom' } ] }
				],
				Connections: [
					{ SourceNodeHash: 'start',         SourcePortHash: 'start-eo-out',  TargetNodeHash: 'pull',          TargetPortHash: 'p-ei-Trigger' },
					{ SourceNodeHash: 'pull',          SourcePortHash: 'p-eo-Complete', TargetNodeHash: 'aggregate',     TargetPortHash: 'a-ei-Trigger' },
					{ SourceNodeHash: 'aggregate',     SourcePortHash: 'a-eo-Complete', TargetNodeHash: 'comprehension', TargetPortHash: 'c-ei-Trigger' },
					{ SourceNodeHash: 'comprehension', SourcePortHash: 'c-eo-Complete', TargetNodeHash: 'write',         TargetPortHash: 'w-ei-Trigger' },
					{ SourceNodeHash: 'write',         SourcePortHash: 'w-eo-Complete', TargetNodeHash: 'end',           TargetPortHash: 'end-ei-in' },

					{ SourceNodeHash: 'pull',          SourcePortHash: 'p-so-Result',        TargetNodeHash: 'aggregate',     TargetPortHash: 'a-si-Records',       ConnectionType: 'State', Data: { StateKey: 'Records' } },
					{ SourceNodeHash: 'aggregate',     SourcePortHash: 'a-so-Result',        TargetNodeHash: 'comprehension', TargetPortHash: 'c-si-Records',       ConnectionType: 'State', Data: { StateKey: 'Records' } },
					{ SourceNodeHash: 'comprehension', SourcePortHash: 'c-so-Comprehension', TargetNodeHash: 'write',         TargetPortHash: 'w-si-Comprehension', ConnectionType: 'State', Data: { StateKey: 'Comprehension' } }
				],
				ViewState: { PanX: 0, PanY: 0, Zoom: 1 }
			}
		};
	}

	/**
	 * Compile an OperationConfig (OperationType=Histogram). Same shape
	 * as Aggregation but the middle node is HistogramRecords and the
	 * config carries BucketColumn / BucketKind / BucketSize alongside
	 * GroupBy + Aggregates.
	 */
	_compileHistogramToOperation(pOperation)
	{
		let tmpCfg = pOperation.OperationConfiguration || {};
		if (typeof tmpCfg === 'string') { try { tmpCfg = JSON.parse(tmpCfg); } catch (e) { tmpCfg = {}; } }

		let tmpEntity = tmpCfg.Entity || pOperation.TargetTable || 'Histogram';
		let tmpGUIDName = tmpCfg.GUIDName || ('GUID' + tmpEntity);
		let tmpHashSeed = (pOperation.Hash || ('operation-' + pOperation.IDOperationConfig));
		let tmpName = pOperation.Name || ('Operation ' + (pOperation.Hash || pOperation.IDOperationConfig));

		return {
			Name: tmpName,
			Description: pOperation.Description || '',
			Tags: ['data-mapper', 'operation', 'histogram', tmpHashSeed],
			Author: 'retold-data-mapper',
			Version: '1.0.0',
			Graph: {
				Nodes: [
					{ Hash: 'start', Type: 'start', X: 50, Y: 200, Width: 100, Height: 60, Title: 'Start',
					  Ports: [ { Hash: 'start-eo-out', Direction: 'output', Side: 'right-bottom' } ] },

					{ Hash: 'pull', Type: 'beacon-datamapperrecords-pullrecords',
					  X: 220, Y: 180, Width: 220, Height: 140, Title: 'Pull ' + (pOperation.SourceEntity || '?'),
					  Ports: [
						{ Hash: 'p-ei-Trigger',  Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'p-eo-Complete', Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'p-so-Result',   Direction: 'output', Side: 'right-top',    Label: 'Result' }
					  ],
					  Data: {
						SourceBeaconName: pOperation.SourceBeaconName || '',
						ConnectionHash:   pOperation.SourceConnectionHash || '',
						Entity:           pOperation.SourceEntity || '',
						BatchSize:        500,
						FilterExpression: tmpCfg.FilterExpression || '',
						SortField:        tmpCfg.SortField || '',
						AffinityKey:      'data-mapper'
					  }
					},

					{ Hash: 'histogram', Type: 'beacon-datamappertransform-histogramrecords',
					  X: 480, Y: 180, Width: 220, Height: 140, Title: 'Histogram → ' + tmpEntity,
					  Ports: [
						{ Hash: 'h-ei-Trigger',  Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'h-eo-Complete', Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'h-si-Records',  Direction: 'input',  Side: 'left-top',    Label: 'Records' },
						{ Hash: 'h-so-Result',   Direction: 'output', Side: 'right-top',   Label: 'Result' }
					  ],
					  Data: { OperationConfiguration: JSON.stringify(tmpCfg), AffinityKey: 'data-mapper' }
					},

					{ Hash: 'comprehension', Type: 'beacon-datamappertransform-buildcomprehension',
					  X: 740, Y: 180, Width: 240, Height: 140, Title: 'Comprehend ' + tmpEntity,
					  Ports: [
						{ Hash: 'c-ei-Trigger',       Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'c-eo-Complete',      Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'c-si-Records',       Direction: 'input',  Side: 'left-top',    Label: 'Records' },
						{ Hash: 'c-so-Comprehension', Direction: 'output', Side: 'right-top',   Label: 'Comprehension' }
					  ],
					  Data: { Entity: tmpEntity, GUIDField: tmpGUIDName, AffinityKey: 'data-mapper' }
					},

					{ Hash: 'write', Type: 'beacon-datamapperrecords-writerecords',
					  X: 1020, Y: 180, Width: 240, Height: 140, Title: 'Upsert ' + tmpEntity,
					  Ports: [
						{ Hash: 'w-ei-Trigger',       Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'w-eo-Complete',      Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'w-si-Comprehension', Direction: 'input',  Side: 'left-top',    Label: 'Comprehension' }
					  ],
					  Data: {
						TargetBeaconName: pOperation.TargetBeaconName || '',
						ConnectionHash:   pOperation.TargetConnectionHash || '',
						Entity:           tmpEntity,
						GUIDName:         tmpGUIDName,
						// Typed ops opt into parallel write chunks (5-way pool by
						// default). OperationConfig.Concurrency overrides per-op.
						// Mapping (the existing flow) stays at the default 1.
						Concurrency:      Math.max(1, Math.min(5, pOperation.Concurrency || 5)),
						// ResetMode tells WriteRecords to soft-delete orphan rows
						// (existing GUIDs not in the new comprehension) after the
						// upsert succeeds. Default 'Append' = no purge.
						ResetMode:        (pOperation.ResetMode === 'Replace') ? 'Replace' : 'Append',
						AffinityKey:      'data-mapper'
					  }
					},

					{ Hash: 'end', Type: 'end', X: 1300, Y: 220, Width: 100, Height: 60, Title: 'End',
					  Ports: [ { Hash: 'end-ei-in', Direction: 'input', Side: 'left-bottom' } ] }
				],
				Connections: [
					{ SourceNodeHash: 'start',         SourcePortHash: 'start-eo-out',  TargetNodeHash: 'pull',          TargetPortHash: 'p-ei-Trigger' },
					{ SourceNodeHash: 'pull',          SourcePortHash: 'p-eo-Complete', TargetNodeHash: 'histogram',     TargetPortHash: 'h-ei-Trigger' },
					{ SourceNodeHash: 'histogram',     SourcePortHash: 'h-eo-Complete', TargetNodeHash: 'comprehension', TargetPortHash: 'c-ei-Trigger' },
					{ SourceNodeHash: 'comprehension', SourcePortHash: 'c-eo-Complete', TargetNodeHash: 'write',         TargetPortHash: 'w-ei-Trigger' },
					{ SourceNodeHash: 'write',         SourcePortHash: 'w-eo-Complete', TargetNodeHash: 'end',           TargetPortHash: 'end-ei-in' },

					{ SourceNodeHash: 'pull',          SourcePortHash: 'p-so-Result',        TargetNodeHash: 'histogram',     TargetPortHash: 'h-si-Records',       ConnectionType: 'State', Data: { StateKey: 'Records' } },
					{ SourceNodeHash: 'histogram',     SourcePortHash: 'h-so-Result',        TargetNodeHash: 'comprehension', TargetPortHash: 'c-si-Records',       ConnectionType: 'State', Data: { StateKey: 'Records' } },
					{ SourceNodeHash: 'comprehension', SourcePortHash: 'c-so-Comprehension', TargetNodeHash: 'write',         TargetPortHash: 'w-si-Comprehension', ConnectionType: 'State', Data: { StateKey: 'Comprehension' } }
				],
				ViewState: { PanX: 0, PanY: 0, Zoom: 1 }
			}
		};
	}

	/**
	 * Compile an OperationConfig (OperationType=Intersection). 7-node
	 * graph: two Pull nodes (one per join side) feeding an Intersect
	 * node that builds a flat-namespace-merged result, then the standard
	 * Comprehension → Write tail. Used for both enrichment-style joins
	 * (Limit=1) and "latest N per X" patterns (Limit > 1, OrderBy set).
	 *
	 * The OperationConfiguration must declare:
	 *   - RelatedBeaconName, RelatedConnectionHash, RelatedEntity
	 *   - JoinOn: { SourceField, RelatedField }
	 *   - Projection: { TargetCol: "{~D:Record.MergedField~}" or literal }
	 *   - GUIDName / GUIDTemplate (combinatorial, references merged fields)
	 *   - OrderBy?: [{ Field, Direction }]   (DESC|ASC)
	 *   - Limit?: number                     (default unlimited)
	 */
	_compileIntersectionToOperation(pOperation)
	{
		let tmpCfg = pOperation.OperationConfiguration || {};
		if (typeof tmpCfg === 'string') { try { tmpCfg = JSON.parse(tmpCfg); } catch (e) { tmpCfg = {}; } }

		let tmpEntity = tmpCfg.Entity || pOperation.TargetTable || 'Intersection';
		let tmpGUIDName = tmpCfg.GUIDName || ('GUID' + tmpEntity);
		let tmpRelatedBeacon = tmpCfg.RelatedBeaconName || pOperation.SourceBeaconName || '';
		let tmpRelatedConn = tmpCfg.RelatedConnectionHash || pOperation.SourceConnectionHash || '';
		let tmpRelatedEntity = tmpCfg.RelatedEntity || '';
		let tmpHashSeed = (pOperation.Hash || ('operation-' + pOperation.IDOperationConfig));
		let tmpName = pOperation.Name || ('Operation ' + (pOperation.Hash || pOperation.IDOperationConfig));

		return {
			Name: tmpName,
			Description: pOperation.Description || '',
			Tags: ['data-mapper', 'operation', 'intersection', tmpHashSeed],
			Author: 'retold-data-mapper',
			Version: '1.0.0',
			Graph: {
				Nodes: [
					{ Hash: 'start', Type: 'start', X: 50, Y: 220, Width: 100, Height: 60, Title: 'Start',
					  Ports: [ { Hash: 'start-eo-out', Direction: 'output', Side: 'right-bottom' } ] },

					{ Hash: 'pull-source', Type: 'beacon-datamapperrecords-pullrecords',
					  X: 220, Y: 100, Width: 220, Height: 140, Title: 'Pull source: ' + (pOperation.SourceEntity || '?'),
					  Ports: [
						{ Hash: 'ps-ei-Trigger',  Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'ps-eo-Complete', Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'ps-so-Result',   Direction: 'output', Side: 'right-top',    Label: 'Result' }
					  ],
					  Data: {
						SourceBeaconName: pOperation.SourceBeaconName || '',
						ConnectionHash:   pOperation.SourceConnectionHash || '',
						Entity:           pOperation.SourceEntity || '',
						BatchSize:        500,
						FilterExpression: tmpCfg.FilterExpression || '',
						SortField:        tmpCfg.SortField || '',
						AffinityKey:      'data-mapper'
					  }
					},

					{ Hash: 'pull-related', Type: 'beacon-datamapperrecords-pullrecords',
					  X: 220, Y: 320, Width: 220, Height: 140, Title: 'Pull related: ' + tmpRelatedEntity,
					  Ports: [
						{ Hash: 'pr-ei-Trigger',  Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'pr-eo-Complete', Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'pr-so-Result',   Direction: 'output', Side: 'right-top',    Label: 'Result' }
					  ],
					  Data: {
						SourceBeaconName: tmpRelatedBeacon,
						ConnectionHash:   tmpRelatedConn,
						Entity:           tmpRelatedEntity,
						BatchSize:        500,
						AffinityKey:      'data-mapper'
					  }
					},

					{ Hash: 'intersect', Type: 'beacon-datamappertransform-intersectrecords',
					  X: 510, Y: 220, Width: 240, Height: 160, Title: 'Intersect → ' + tmpEntity,
					  Ports: [
						{ Hash: 'i-ei-Trigger',         Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'i-eo-Complete',        Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'i-si-SourceRecords',   Direction: 'input',  Side: 'left-top',    Label: 'SourceRecords' },
						{ Hash: 'i-si-RelatedRecords',  Direction: 'input',  Side: 'left',        Label: 'RelatedRecords' },
						{ Hash: 'i-so-Result',          Direction: 'output', Side: 'right-top',   Label: 'Result' }
					  ],
					  Data: { OperationConfiguration: JSON.stringify(tmpCfg), AffinityKey: 'data-mapper' }
					},

					{ Hash: 'comprehension', Type: 'beacon-datamappertransform-buildcomprehension',
					  X: 800, Y: 200, Width: 240, Height: 140, Title: 'Comprehend ' + tmpEntity,
					  Ports: [
						{ Hash: 'c-ei-Trigger',       Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'c-eo-Complete',      Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'c-si-Records',       Direction: 'input',  Side: 'left-top',    Label: 'Records' },
						{ Hash: 'c-so-Comprehension', Direction: 'output', Side: 'right-top',   Label: 'Comprehension' }
					  ],
					  Data: { Entity: tmpEntity, GUIDField: tmpGUIDName, AffinityKey: 'data-mapper' }
					},

					{ Hash: 'write', Type: 'beacon-datamapperrecords-writerecords',
					  X: 1080, Y: 220, Width: 240, Height: 140, Title: 'Upsert ' + tmpEntity,
					  Ports: [
						{ Hash: 'w-ei-Trigger',       Direction: 'input',  Side: 'left-bottom', Label: 'Trigger' },
						{ Hash: 'w-eo-Complete',      Direction: 'output', Side: 'right-bottom', Label: 'Complete' },
						{ Hash: 'w-si-Comprehension', Direction: 'input',  Side: 'left-top',    Label: 'Comprehension' }
					  ],
					  Data: {
						TargetBeaconName: pOperation.TargetBeaconName || '',
						ConnectionHash:   pOperation.TargetConnectionHash || '',
						Entity:           tmpEntity,
						GUIDName:         tmpGUIDName,
						// Typed ops opt into parallel write chunks (5-way pool by
						// default). OperationConfig.Concurrency overrides per-op.
						// Mapping (the existing flow) stays at the default 1.
						Concurrency:      Math.max(1, Math.min(5, pOperation.Concurrency || 5)),
						// ResetMode tells WriteRecords to soft-delete orphan rows
						// (existing GUIDs not in the new comprehension) after the
						// upsert succeeds. Default 'Append' = no purge.
						ResetMode:        (pOperation.ResetMode === 'Replace') ? 'Replace' : 'Append',
						AffinityKey:      'data-mapper'
					  }
					},

					{ Hash: 'end', Type: 'end', X: 1380, Y: 240, Width: 100, Height: 60, Title: 'End',
					  Ports: [ { Hash: 'end-ei-in', Direction: 'input', Side: 'left-bottom' } ] }
				],
				Connections: [
					// Event flow: pull source → pull related → intersect → comp → write → end.
					// Serial pulls keep the engine model simple (no fork-join needed).
					{ SourceNodeHash: 'start',         SourcePortHash: 'start-eo-out',   TargetNodeHash: 'pull-source',   TargetPortHash: 'ps-ei-Trigger' },
					{ SourceNodeHash: 'pull-source',   SourcePortHash: 'ps-eo-Complete', TargetNodeHash: 'pull-related',  TargetPortHash: 'pr-ei-Trigger' },
					{ SourceNodeHash: 'pull-related',  SourcePortHash: 'pr-eo-Complete', TargetNodeHash: 'intersect',     TargetPortHash: 'i-ei-Trigger' },
					{ SourceNodeHash: 'intersect',     SourcePortHash: 'i-eo-Complete',  TargetNodeHash: 'comprehension', TargetPortHash: 'c-ei-Trigger' },
					{ SourceNodeHash: 'comprehension', SourcePortHash: 'c-eo-Complete',  TargetNodeHash: 'write',         TargetPortHash: 'w-ei-Trigger' },
					{ SourceNodeHash: 'write',         SourcePortHash: 'w-eo-Complete',  TargetNodeHash: 'end',           TargetPortHash: 'end-ei-in' },

					// State (data) flow — two state edges feeding intersect.
					{ SourceNodeHash: 'pull-source',   SourcePortHash: 'ps-so-Result',       TargetNodeHash: 'intersect',     TargetPortHash: 'i-si-SourceRecords',  ConnectionType: 'State', Data: { StateKey: 'SourceRecords' } },
					{ SourceNodeHash: 'pull-related',  SourcePortHash: 'pr-so-Result',       TargetNodeHash: 'intersect',     TargetPortHash: 'i-si-RelatedRecords', ConnectionType: 'State', Data: { StateKey: 'RelatedRecords' } },
					{ SourceNodeHash: 'intersect',     SourcePortHash: 'i-so-Result',        TargetNodeHash: 'comprehension', TargetPortHash: 'c-si-Records',        ConnectionType: 'State', Data: { StateKey: 'Records' } },
					{ SourceNodeHash: 'comprehension', SourcePortHash: 'c-so-Comprehension', TargetNodeHash: 'write',         TargetPortHash: 'w-si-Comprehension',  ConnectionType: 'State', Data: { StateKey: 'Comprehension' } }
				],
				ViewState: { PanX: 0, PanY: 0, Zoom: 1 }
			}
		};
	}

	/**
	 * Per-type configuration validation. Catches the most common
	 * misconfigurations *before* the operation hits UV, so users see
	 * a 400 with a specific field message instead of a runtime crash
	 * deep inside a beacon action.
	 *
	 * Returns null on success, an Error on failure.
	 */
	_validateOperationConfiguration(pOperation)
	{
		let tmpType = String(pOperation.OperationType || '').toLowerCase();
		if (!tmpType) return new Error('OperationType is required.');

		let tmpCfg = pOperation.OperationConfiguration || {};
		if (typeof tmpCfg === 'string')
		{
			try { tmpCfg = JSON.parse(tmpCfg); }
			catch (e) { return new Error('OperationConfiguration is not valid JSON: ' + e.message); }
		}
		if (!tmpCfg || typeof tmpCfg !== 'object')
		{
			return new Error('OperationConfiguration must be a JSON object.');
		}

		// Common: every type must declare an Entity (used as the
		// comprehension key + GUID-column basis).
		if (!tmpCfg.Entity)
		{
			return new Error('OperationConfiguration.Entity is required (target entity name).');
		}

		// Common: source/target plumbing.
		let tmpMissing = [];
		['SourceBeaconName', 'SourceConnectionHash', 'SourceEntity',
		 'TargetBeaconName', 'TargetConnectionHash', 'TargetTable']
			.forEach((f) => { if (!pOperation[f]) tmpMissing.push(f); });
		if (tmpMissing.length > 0)
		{
			return new Error('Missing required source/target fields: ' + tmpMissing.join(', '));
		}

		// Type-specific:
		switch (tmpType)
		{
			case 'extraction':
				if (!tmpCfg.Projection || typeof tmpCfg.Projection !== 'object' || Object.keys(tmpCfg.Projection).length === 0)
				{
					return new Error('Extraction requires OperationConfiguration.Projection (non-empty object of {targetCol: "{~D:Record.sourceCol~}"}).');
				}
				break;

			case 'unnest':
				if (!tmpCfg.ArrayPath || typeof tmpCfg.ArrayPath !== 'string')
				{
					return new Error('Unnest requires OperationConfiguration.ArrayPath (dotted path to the array-of-objects column, e.g. "FormData.MoistureTable").');
				}
				if (!tmpCfg.ElementProjection || typeof tmpCfg.ElementProjection !== 'object' || Object.keys(tmpCfg.ElementProjection).length === 0)
				{
					return new Error('Unnest requires OperationConfiguration.ElementProjection (non-empty {targetCol: "{~D:Element.field~}"}).');
				}
				break;

			case 'passthroughclone':
				// Projection is OPTIONAL on PassthroughClone (a 1:1 mirror
				// passes the source record through as-is). GUIDTemplate is
				// required so the destination GUIDxxxMirror upsert key is
				// deterministic.
				if (!tmpCfg.GUIDTemplate || typeof tmpCfg.GUIDTemplate !== 'string')
				{
					return new Error('PassthroughClone requires OperationConfiguration.GUIDTemplate (e.g. "CUSTOMER_{~D:Record.IDCustomer~}").');
				}
				break;

			case 'aggregation':
				if (!Array.isArray(tmpCfg.GroupBy) || tmpCfg.GroupBy.length === 0)
				{
					return new Error('Aggregation requires OperationConfiguration.GroupBy (non-empty array of source column names).');
				}
				if (!Array.isArray(tmpCfg.Aggregates) || tmpCfg.Aggregates.length === 0)
				{
					return new Error('Aggregation requires OperationConfiguration.Aggregates (non-empty array of {Source, Function: "Sum|Count|Mean|Min|Max", As}).');
				}
				for (let i = 0; i < tmpCfg.Aggregates.length; i++)
				{
					let tmpA = tmpCfg.Aggregates[i] || {};
					let tmpFn = String(tmpA.Function || tmpA.Op || '').toLowerCase();
					if (!['sum', 'count', 'mean', 'avg', 'average', 'min', 'max'].includes(tmpFn))
					{
						return new Error('Aggregates[' + i + '].Function must be one of Sum|Count|Mean|Min|Max (got "' + (tmpA.Function || tmpA.Op || '') + '").');
					}
					if (!tmpA.As) return new Error('Aggregates[' + i + '].As is required (target column name).');
				}
				break;

			case 'sqlaggregate':
				// SQLAggregate is the streaming-layout counterpart to Aggregation:
				// same shape requirements, but the GroupBy/Aggregates get pushed
				// down into the source DB instead of materialised in V8. GUIDTemplate
				// is required so the destination upsert key is deterministic — group
				// rows are written under stable GUIDs so re-runs replace, not duplicate.
				if (!Array.isArray(tmpCfg.GroupBy) || tmpCfg.GroupBy.length === 0)
				{
					return new Error('SQLAggregate requires OperationConfiguration.GroupBy (non-empty array of source column names).');
				}
				if (!Array.isArray(tmpCfg.Aggregates) || tmpCfg.Aggregates.length === 0)
				{
					return new Error('SQLAggregate requires OperationConfiguration.Aggregates (non-empty array of {Source, Function: "Sum|Count|Mean|Avg|Min|Max", As}).');
				}
				for (let i = 0; i < tmpCfg.Aggregates.length; i++)
				{
					let tmpA = tmpCfg.Aggregates[i] || {};
					let tmpFn = String(tmpA.Function || tmpA.Op || '').toLowerCase();
					if (!['sum', 'count', 'mean', 'avg', 'min', 'max'].includes(tmpFn))
					{
						return new Error('SQLAggregate Aggregates[' + i + '].Function must be one of Sum|Count|Mean|Avg|Min|Max (got "' + (tmpA.Function || tmpA.Op || '') + '").');
					}
					if (!tmpA.As) return new Error('SQLAggregate Aggregates[' + i + '].As is required (target column name).');
				}
				if (!tmpCfg.GUIDTemplate || typeof tmpCfg.GUIDTemplate !== 'string')
				{
					return new Error('SQLAggregate requires OperationConfiguration.GUIDTemplate (e.g. "ORDERBYMONTH_{~D:Record.OrderMonth~}").');
				}
				break;

			case 'histogram':
				if (!tmpCfg.BucketColumn)
				{
					return new Error('Histogram requires OperationConfiguration.BucketColumn (source column to bucket).');
				}
				if (!['DateMonth', 'DateDay', 'DateYear', 'NumericRange'].includes(tmpCfg.BucketKind || 'DateMonth'))
				{
					return new Error('Histogram BucketKind must be DateMonth | DateDay | DateYear | NumericRange (got "' + tmpCfg.BucketKind + '").');
				}
				if (tmpCfg.BucketKind === 'NumericRange' && !(Number(tmpCfg.BucketSize) > 0))
				{
					return new Error('Histogram BucketSize must be > 0 when BucketKind=NumericRange.');
				}
				if (!Array.isArray(tmpCfg.Aggregates) || tmpCfg.Aggregates.length === 0)
				{
					return new Error('Histogram requires OperationConfiguration.Aggregates (non-empty array of {Source, Function, As}).');
				}
				break;

			case 'intersection':
				if (!tmpCfg.RelatedEntity)
				{
					return new Error('Intersection requires OperationConfiguration.RelatedEntity.');
				}
				if (!tmpCfg.JoinOn || !tmpCfg.JoinOn.SourceField || !tmpCfg.JoinOn.RelatedField)
				{
					return new Error('Intersection requires OperationConfiguration.JoinOn = { SourceField, RelatedField }.');
				}
				if (!tmpCfg.Projection || typeof tmpCfg.Projection !== 'object' || Object.keys(tmpCfg.Projection).length === 0)
				{
					return new Error('Intersection requires OperationConfiguration.Projection (non-empty {targetCol: "{~D:Record.field~}"}).');
				}
				if (Array.isArray(tmpCfg.OrderBy))
				{
					for (let i = 0; i < tmpCfg.OrderBy.length; i++)
					{
						if (!tmpCfg.OrderBy[i] || !tmpCfg.OrderBy[i].Field)
						{
							return new Error('OrderBy[' + i + '].Field is required.');
						}
						let tmpDir = String(tmpCfg.OrderBy[i].Direction || 'ASC').toUpperCase();
						if (tmpDir !== 'ASC' && tmpDir !== 'DESC')
						{
							return new Error('OrderBy[' + i + '].Direction must be ASC or DESC.');
						}
					}
				}
				break;

			case 'sqljoin':
				// SQLJoin is the streaming-layout counterpart to Intersection.
				// Same shape requirements as Intersection PLUS:
				//   - Projection values must be exactly {~D:Record.X~} or {~D:Related.X~}
				//     (no static strings, no computed expressions). Anything else can't
				//     be pushed down to SQL — operator should choose Intersection instead.
				//   - OrderBy must be a single string field (the source-table PK column),
				//     not the array-of-objects form Intersection uses. The SQL emitter
				//     needs a stable, indexed scalar for paged ORDER BY.
				//   - GUIDTemplate is required (so the destination upsert key is stable).
				//   - The runtime check that source + related share a connection happens
				//     at execute time (we don't have the connection topology in scope here).
				if (!tmpCfg.RelatedEntity)
				{
					return new Error('SQLJoin requires OperationConfiguration.RelatedEntity (the related table — must live on the same connection as the source).');
				}
				if (!tmpCfg.JoinOn || !tmpCfg.JoinOn.SourceField || !tmpCfg.JoinOn.RelatedField)
				{
					return new Error('SQLJoin requires OperationConfiguration.JoinOn = { SourceField, RelatedField }.');
				}
				if (!tmpCfg.Projection || typeof tmpCfg.Projection !== 'object' || Object.keys(tmpCfg.Projection).length === 0)
				{
					return new Error('SQLJoin requires OperationConfiguration.Projection (non-empty {targetCol: "{~D:Record.X~}" | "{~D:Related.X~}"}).');
				}
				{
					let tmpProjKeys = Object.keys(tmpCfg.Projection);
					let tmpAllowed = /^\{~D:(Record|Related)\.[A-Za-z_][A-Za-z0-9_]*~\}$/;
					for (let i = 0; i < tmpProjKeys.length; i++)
					{
						let tmpV = tmpCfg.Projection[tmpProjKeys[i]];
						if (typeof tmpV !== 'string' || !tmpAllowed.test(tmpV))
						{
							return new Error('SQLJoin Projection[' + tmpProjKeys[i] + '] must be exactly "{~D:Record.<field>~}" or "{~D:Related.<field>~}" (got ' + JSON.stringify(tmpV) + '). Static or computed projections can\'t be pushed down — use OperationType=Intersection instead.');
						}
					}
				}
				if (!tmpCfg.OrderBy || typeof tmpCfg.OrderBy !== 'string')
				{
					// OrderBy MUST be UNIQUE on the source table — typically the
					// PK. Keyset pagination (WHERE col > <last seen>) duplicates
					// rows across pages if the column has ties, and stalls the
					// cursor if the LAST row of one page shares its OrderBy
					// value with the first row of the next page. Use the source
					// PK (e.g. IDSalesOrderLine) unless a different unique
					// column is justifiable.
					return new Error('SQLJoin requires OperationConfiguration.OrderBy (string — a stable, indexed, UNIQUE source-table column for keyset pagination, e.g. "IDSalesOrderLine").');
				}
				if (!tmpCfg.GUIDTemplate || typeof tmpCfg.GUIDTemplate !== 'string')
				{
					return new Error('SQLJoin requires OperationConfiguration.GUIDTemplate (e.g. "OLE_{~D:Record.IDSalesOrderLine~}").');
				}
				break;

			default:
				return new Error('Unknown OperationType "' + pOperation.OperationType + '". Expected Extraction | Unnest | PassthroughClone | Aggregation | SQLAggregate | Histogram | Intersection | SQLJoin.');
		}
		return null;
	}

	/**
	 * Stable SHA-1 of a canonical JSON encoding of the OperationConfig
	 * fields that materially affect the compiled UV graph. Used as the
	 * cache key for graph reuse: when this matches the stored
	 * CompiledOperationConfigHash, we trigger the existing UV operation
	 * by hash instead of re-registering. Keeps UV's /Operation list
	 * from filling up with N copies of the same graph.
	 *
	 * Doesn't include Description/Name/Scope (cosmetic) or DependsOn
	 * (chain-level, not graph-level).
	 */
	/**
	 * Compile an OperationConfig into a UV Operation graph and register
	 * it with UV. Mirrors the compile-then-POST path inside
	 * /mapper/uv/run-operation/:id but stops short of triggering the run,
	 * so seeded/edited operations show up in UV's /Operation list before
	 * the operator's first click. Persists the compile cache hashes back
	 * to the configs-databeacon row so the run-time path is a cache-hit.
	 *
	 * Best-effort: any failure (UV unreachable, compile error, persist
	 * error) is caught and reported via the result envelope. Callers
	 * proceed regardless — the next /mapper/uv/run-operation/:id call
	 * falls back to compile-then-register.
	 *
	 * fCallback: (null, { Compiled, OperationHash?, CacheHit?, Reason? })
	 */
	_eagerRegisterOperationGraph(pOperation, fCallback)
	{
		let tmpClient = this._client();
		if (!tmpClient)
		{
			return fCallback(null, { Compiled: false, Reason: 'Ultravisor client not connected' });
		}
		let tmpType = String(pOperation.OperationType || '').toLowerCase();
		let tmpGraph;
		try
		{
			switch (tmpType)
			{
				case 'extraction':       tmpGraph = this._compileExtractionToOperation(pOperation);   break;
				case 'unnest':           tmpGraph = this._compileUnnestToOperation(pOperation);       break;
				case 'passthroughclone': tmpGraph = this._compileCloneToOperation(pOperation);       break;
				case 'aggregation':      tmpGraph = this._compileAggregationToOperation(pOperation);  break;
				case 'sqlaggregate':     tmpGraph = this._compileSQLAggregateToOperation(pOperation); break;
				case 'histogram':        tmpGraph = this._compileHistogramToOperation(pOperation);    break;
				case 'intersection':     tmpGraph = this._compileIntersectionToOperation(pOperation); break;
				case 'sqljoin':          tmpGraph = this._compileSQLJoinToOperation(pOperation);      break;
				default:
					return fCallback(null, { Compiled: false, Reason: 'Unsupported OperationType: ' + pOperation.OperationType });
			}
		}
		catch (pErr)
		{
			return fCallback(null, { Compiled: false, Reason: 'Compile failed: ' + pErr.message });
		}
		let tmpCfgHash = this._hashOperationConfig(pOperation);
		if (pOperation.CompiledOperationConfigHash === tmpCfgHash && pOperation.CompiledOperationHash)
		{
			return fCallback(null, { Compiled: false, OperationHash: pOperation.CompiledOperationHash, CacheHit: true });
		}
		let tmpSelf = this;
		this._request('POST', '/Operation', tmpGraph, (pPostErr, pCreated) =>
		{
			if (pPostErr) return fCallback(null, { Compiled: false, Reason: 'UV /Operation failed: ' + pPostErr.message });
			let tmpHash = (pCreated && pCreated.Hash) || (tmpGraph && tmpGraph.Hash);
			if (!tmpHash) return fCallback(null, { Compiled: false, Reason: 'UV /Operation returned no Hash' });

			let tmpUpdate =
			{
				IDOperationConfig:           pOperation.IDOperationConfig,
				CompiledOperationHash:       tmpHash,
				CompiledOperationConfigHash: tmpCfgHash
			};
			tmpSelf._meadowProxyRequest('configs-databeacon', 'PUT',
				'/1.0/platform-configs/OperationConfig/' + pOperation.IDOperationConfig, tmpUpdate,
				(pPutErr) =>
				{
					if (pPutErr)
					{
						tmpSelf.fable.log.warn('eager-register: cache-persist failed for ' + pOperation.Hash + ': ' + pPutErr.message);
					}
					return fCallback(null, { Compiled: true, OperationHash: tmpHash, CacheHit: false });
				});
		});
	}

	_hashOperationConfig(pOperation)
	{
		let tmpCfg = pOperation.OperationConfiguration || {};
		if (typeof tmpCfg === 'string')
		{
			try { tmpCfg = JSON.parse(tmpCfg); } catch (e) { tmpCfg = {}; }
		}
		let tmpCanonical = JSON.stringify({
			Hash:                 pOperation.Hash || '',
			OperationType:        pOperation.OperationType || '',
			SourceBeaconName:     pOperation.SourceBeaconName || '',
			SourceConnectionHash: pOperation.SourceConnectionHash || '',
			SourceEntity:         pOperation.SourceEntity || '',
			TargetBeaconName:     pOperation.TargetBeaconName || '',
			TargetConnectionHash: pOperation.TargetConnectionHash || '',
			TargetTable:          pOperation.TargetTable || '',
			ResetMode:            pOperation.ResetMode || 'Append',
			Concurrency:          pOperation.Concurrency || 0,
			OperationConfiguration: tmpCfg
		});
		return require('crypto').createHash('sha1').update(tmpCanonical).digest('hex');
	}

	/**
	 * Compute the set of column names an OperationConfig will write
	 * to its TargetTable. Each OperationType has its own output shape:
	 *   - Extraction:    Object.keys(Projection) + GUIDName
	 *   - Aggregation:   GroupBy + Aggregates.As + GUIDName
	 *   - Histogram:     BucketAs + GroupBy + Aggregates.As + GUIDName
	 *   - Intersection:  Object.keys(Projection) + GUIDName
	 * Returns an array of strings (deduplicated). Audit columns
	 * (CreateDate / UpdateDate / GUID — the auto-managed meadow side)
	 * are not included; those are injected by meadow itself on insert.
	 */
	_declaredOutputColumns(pOperation)
	{
		let tmpCfg = pOperation.OperationConfiguration || {};
		if (typeof tmpCfg === 'string') { try { tmpCfg = JSON.parse(tmpCfg); } catch (e) { tmpCfg = {}; } }
		let tmpType = String(pOperation.OperationType || '').toLowerCase();
		let tmpEntity = tmpCfg.Entity || pOperation.TargetTable || 'X';
		let tmpGUIDName = tmpCfg.GUIDName || ('GUID' + tmpEntity);
		let tmpSet = new Set();
		tmpSet.add(tmpGUIDName);

		if (tmpType === 'extraction' || tmpType === 'intersection' || tmpType === 'passthroughclone' || tmpType === 'sqljoin')
		{
			let tmpProj = tmpCfg.Projection || {};
			Object.keys(tmpProj).forEach((k) => tmpSet.add(k));
		}
		else if (tmpType === 'aggregation' || tmpType === 'sqlaggregate')
		{
			let tmpGroupBy = Array.isArray(tmpCfg.GroupBy) ? tmpCfg.GroupBy : [];
			let tmpAggs = Array.isArray(tmpCfg.Aggregates) ? tmpCfg.Aggregates : [];
			tmpGroupBy.forEach((g) => tmpSet.add(g));
			tmpAggs.forEach((a) => tmpSet.add(a.As || (String(a.Function || a.Op || 'op').toLowerCase() + '_' + (a.Source || 'col'))));
		}
		else if (tmpType === 'histogram')
		{
			tmpSet.add(tmpCfg.BucketAs || 'Bucket');
			let tmpGroupBy = Array.isArray(tmpCfg.GroupBy) ? tmpCfg.GroupBy : [];
			let tmpAggs = Array.isArray(tmpCfg.Aggregates) ? tmpCfg.Aggregates : [];
			tmpGroupBy.forEach((g) => tmpSet.add(g));
			tmpAggs.forEach((a) => tmpSet.add(a.As || (String(a.Function || a.Op || 'op').toLowerCase() + '_' + (a.Source || 'col'))));
		}
		return Array.from(tmpSet);
	}

	/**
	 * Validate that the OperationConfig's declared output columns
	 * exist on the TargetTable. Forward-pass: if the table doesn't
	 * exist on the target beacon yet, allow save (the operation may
	 * be staged before EnsureSchema runs). If the table DOES exist,
	 * any declared column missing from it → fail with 400.
	 *
	 * Two dispatches via the UV mesh: ListConnections (to resolve
	 * ConnectionHash → IDBeaconConnection) and Introspect (to read
	 * the table list). Skips silently if TargetBeaconName is empty.
	 *
	 * fCallback signature: function(pError | null, pWarning | null)
	 *   pError   — Error to surface as 400; aborts the save
	 *   pWarning — string flagged in the response (table not found etc.)
	 */
	_validateAgainstTarget(pOperation, fCallback)
	{
		let tmpBeacon = pOperation.TargetBeaconName;
		let tmpHash = pOperation.TargetConnectionHash;
		let tmpTable = pOperation.TargetTable;
		if (!tmpBeacon || !tmpHash || !tmpTable)
		{
			return fCallback(null, 'TargetBeaconName / TargetConnectionHash / TargetTable not all set — skipped column validation.');
		}

		let tmpDeclared = this._declaredOutputColumns(pOperation);
		if (tmpDeclared.length === 0)
		{
			return fCallback(null, 'OperationConfiguration declared no output columns — skipped column validation.');
		}

		let _self = this;
		this._dispatch(
			{
				Capability: 'DataBeaconAccess',
				Action:     'ListConnections',
				Settings:   {},
				AffinityKey: tmpBeacon,
				TimeoutMs:   15000
			},
			(pListErr, pListResult) =>
			{
				if (pListErr) return fCallback(null, 'ListConnections on ' + tmpBeacon + ' failed: ' + pListErr.message + ' — skipped column validation.');
				let tmpConns = ((pListResult && pListResult.Outputs) || pListResult || {}).Connections || [];
				let tmpMatch = tmpConns.find((c) =>
				{
					let tmpSlug = String(c.Name || '').toLowerCase().replace(/\s+/g, '-');
					return tmpSlug === tmpHash || c.Name === tmpHash || String(c.Hash || '') === tmpHash;
				});
				if (!tmpMatch)
				{
					return fCallback(null, 'No connection on ' + tmpBeacon + ' matches "' + tmpHash + '" — skipped column validation.');
				}

				_self._dispatch(
					{
						Capability: 'DataBeaconManagement',
						Action:     'Introspect',
						Settings:   { IDBeaconConnection: tmpMatch.IDBeaconConnection },
						AffinityKey: tmpBeacon,
						TimeoutMs:   30000
					},
					(pIntErr, pIntResult) =>
					{
						if (pIntErr) return fCallback(null, 'Introspect on ' + tmpBeacon + ' failed: ' + pIntErr.message + ' — skipped column validation.');
						let tmpTables = ((pIntResult && pIntResult.Outputs) || pIntResult || {}).Tables || [];
						let tmpHit = tmpTables.find((t) => (t.TableName === tmpTable) || (t.Name === tmpTable));
						if (!tmpHit)
						{
							return fCallback(null, 'TargetTable "' + tmpTable + '" not yet on ' + tmpBeacon + '/' + tmpHash + ' — save allowed; ensure-schema before first run.');
						}
						let tmpExisting = new Set((tmpHit.Columns || []).map((c) => c.Name || c.Column));
						let tmpMissing = tmpDeclared.filter((c) => !tmpExisting.has(c));
						if (tmpMissing.length > 0)
						{
							return fCallback(new Error(
								'OperationConfiguration declares output columns missing from TargetTable "' + tmpTable + '": ' +
								tmpMissing.join(', ') +
								'. Either update the OperationConfiguration to drop them, ' +
								'or run /mapper/admin/ensure-schema with an updated descriptor first.'));
						}
						return fCallback(null, null);
					});
			});
	}

	/**
	 * Walk a UV manifest's TaskOutputs and return whether ANY task reported
	 * row-level errors (Errors > 0 or Errors[].length > 0) OR an HTTP-shaped
	 * non-2xx Status. Used by /run-operation so a "Status: Complete" manifest
	 * with bulk-upsert failures inside doesn't get reported as Success=true.
	 */
	_taskOutputsHaveErrors(pTaskOutputs)
	{
		if (!pTaskOutputs || typeof pTaskOutputs !== 'object') return false;
		let tmpKeys = Object.keys(pTaskOutputs);
		for (let i = 0; i < tmpKeys.length; i++)
		{
			let tmpVal = pTaskOutputs[tmpKeys[i]];
			if (!tmpVal || typeof tmpVal !== 'object') continue;
			let tmpErrors = tmpVal.Errors;
			if (typeof tmpErrors === 'number' && tmpErrors > 0) return true;
			if (Array.isArray(tmpErrors) && tmpErrors.length > 0) return true;
			if (typeof tmpVal.OrphanErrors === 'number' && tmpVal.OrphanErrors > 0) return true;
			if (typeof tmpVal.Status === 'number' && tmpVal.Status >= 400) return true;
		}
		return false;
	}

	/**
	 * Reduce a UV manifest's TaskOutputs (which can include the full
	 * record arrays for each step) to just the count fields the UI
	 * needs to render a result panel. Keeps the response small.
	 */
	_summarizeTaskOutputs(pTaskOutputs)
	{
		if (!pTaskOutputs || typeof pTaskOutputs !== 'object') return {};
		let tmpSummary = {};
		let tmpKeys = Object.keys(pTaskOutputs);
		for (let i = 0; i < tmpKeys.length; i++)
		{
			let tmpKey = tmpKeys[i];
			let tmpVal = pTaskOutputs[tmpKey];
			if (!tmpVal || typeof tmpVal !== 'object') continue;
			let tmpRow = {};
			if ('RecordCount'         in tmpVal) tmpRow.RecordCount         = tmpVal.RecordCount;
			if ('FilteredOutCount'    in tmpVal) tmpRow.FilteredOutCount    = tmpVal.FilteredOutCount;
			if ('GroupCount'          in tmpVal) tmpRow.GroupCount          = tmpVal.GroupCount;
			if ('BucketCount'         in tmpVal) tmpRow.BucketCount         = tmpVal.BucketCount;
			if ('MatchedSourceCount'  in tmpVal) tmpRow.MatchedSourceCount  = tmpVal.MatchedSourceCount;
			if ('UnmatchedSourceCount' in tmpVal) tmpRow.UnmatchedSourceCount = tmpVal.UnmatchedSourceCount;
			if ('Written'             in tmpVal) tmpRow.Written             = tmpVal.Written;
			if ('OrphansDeleted'      in tmpVal) tmpRow.OrphansDeleted      = tmpVal.OrphansDeleted;
			if ('OrphanErrors'        in tmpVal) tmpRow.OrphanErrors        = tmpVal.OrphanErrors;
			if ('ElapsedMs'           in tmpVal) tmpRow.ElapsedMs           = tmpVal.ElapsedMs;
			if ('Errors'           in tmpVal)
			{
				tmpRow.Errors = Array.isArray(tmpVal.Errors) ? tmpVal.Errors.length : (tmpVal.Errors || 0);
			}
			tmpSummary[tmpKey] = tmpRow;
		}
		return tmpSummary;
	}

}

module.exports = DataMapperConnectionBridge;
module.exports.serviceType = 'DataMapperConnectionBridge';
module.exports.default_configuration = defaultConnectionBridgeOptions;
