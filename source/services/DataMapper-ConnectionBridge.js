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

const defaultConnectionBridgeOptions = (
	{
		RoutePrefix: '/mapper'
	});

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
		// Implementation note: meadow-endpoints' default surface does
		// not expose PUT/PATCH on this beacon, so we read the existing
		// record, soft-delete it, then insert a merged version. The
		// (Scope, Hash) UNIQUE INDEX has WHERE Deleted=0, so the new
		// row coexists with the soft-deleted one. The IDDashboardConfig
		// changes — callers should re-fetch by Hash if they need the
		// new ID.
		pOratorServiceServer.doPut(`${tmpRoutePrefix}/dashboard/:id`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpID = parseInt(pRequest.params.id, 10);
				if (!tmpID)
				{
					return _self._sendError(pResponse, 400, 'PUT /mapper/dashboard/:id requires numeric ID', fNext);
				}
				let tmpBody = pRequest.body || {};

				// Step 1 — fetch the existing record so we can merge.
				beaconRequestEx('configs-databeacon', 'GET',
					'/1.0/platform-configs/DashboardConfig/' + tmpID, null,
					(pReadErr, pExisting) =>
					{
						if (pReadErr) return _self._sendError(pResponse, 502, pReadErr.message || String(pReadErr), fNext);
						if (!pExisting || !pExisting.IDDashboardConfig)
						{
							return _self._sendError(pResponse, 404, 'Dashboard ' + tmpID + ' not found', fNext);
						}

						// Merge body into existing — only Hash, Scope, Title, Layout are mutable.
						let tmpMerged = {
							Hash:   (tmpBody.Hash !== undefined) ? String(tmpBody.Hash) : pExisting.Hash,
							Scope:  (tmpBody.Scope !== undefined) ? String(tmpBody.Scope || '') : (pExisting.Scope || ''),
							Title:  (tmpBody.Title !== undefined) ? tmpBody.Title : pExisting.Title,
							Layout: (tmpBody.Layout !== undefined)
								? (typeof tmpBody.Layout === 'string' ? tmpBody.Layout : JSON.stringify(tmpBody.Layout))
								: pExisting.Layout
						};

						// Step 2 — soft-delete the existing row.
						beaconRequestEx('configs-databeacon', 'DELETE',
							'/1.0/platform-configs/DashboardConfig/' + tmpID, null,
							(pDelErr) =>
							{
								if (pDelErr) return _self._sendError(pResponse, 502, pDelErr.message || String(pDelErr), fNext);
								// Step 3 — insert the merged version.
								beaconRequestEx('configs-databeacon', 'POST',
									'/1.0/platform-configs/DashboardConfig', tmpMerged,
									(pInsErr, pInserted) =>
									{
										if (pInsErr) return _self._sendError(pResponse, 502, pInsErr.message || String(pInsErr), fNext);
										pResponse.send({ Success: true, Dashboard: pInserted });
										return fNext();
									});
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
						: JSON.stringify(tmpBody.OperationConfiguration || {})
				};

				let fPersist = (pValidationWarning) =>
				{
					beaconRequestEx('configs-databeacon', 'POST',
						'/1.0/platform-configs/OperationConfig', tmpRecord,
						(pError, pResult) =>
						{
							if (pError) return _self._sendError(pResponse, 502, pError.message || String(pError), fNext);
							let tmpResp = { Success: true, Operation: pResult };
							if (pValidationWarning) tmpResp.ValidationWarning = pValidationWarning;
							pResponse.send(tmpResp);
							return fNext();
						});
				};

				if (tmpSkipValidation) return fPersist('Validation skipped via ?skipValidation=1.');
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
						let tmpMerged = {};
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

						let fPersist = (pValidationWarning) =>
						{
							beaconRequestEx('configs-databeacon', 'DELETE',
								'/1.0/platform-configs/OperationConfig/' + tmpID, null,
								(pDelErr) =>
								{
									if (pDelErr) return _self._sendError(pResponse, 502, pDelErr.message || String(pDelErr), fNext);
									beaconRequestEx('configs-databeacon', 'POST',
										'/1.0/platform-configs/OperationConfig', tmpMerged,
										(pInsErr, pInserted) =>
										{
											if (pInsErr) return _self._sendError(pResponse, 502, pInsErr.message || String(pInsErr), fNext);
											let tmpResp = { Success: true, Operation: pInserted };
											if (pValidationWarning) tmpResp.ValidationWarning = pValidationWarning;
											pResponse.send(tmpResp);
											return fNext();
										});
								});
						};

						if (tmpSkipValidation) return fPersist('Validation skipped via ?skipValidation=1.');
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
										pResponse.send({
											Success:        pManifest && (pManifest.Status === 'Complete'),
											OperationHash:  tmpHash,
											OperationName:  tmpGraph.Name,
											RunHash:        pManifest && pManifest.RunHash,
											Status:         pManifest && pManifest.Status,
											ElapsedMs:      pManifest && pManifest.ElapsedMs,
											TaskOutputs:    _self._summarizeTaskOutputs(pManifest && pManifest.TaskOutputs),
											Errors:         pManifest && pManifest.Errors
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
							case 'aggregation':
								tmpGraph = _self._compileAggregationToOperation(pOperation);
								break;
							case 'histogram':
								tmpGraph = _self._compileHistogramToOperation(pOperation);
								break;
							case 'intersection':
								tmpGraph = _self._compileIntersectionToOperation(pOperation);
								break;
							default:
								tmpDispatchErr = 'OperationType "' + pOperation.OperationType + '" not supported. Expected one of: Extraction, Aggregation, Histogram, Intersection.';
						}
						if (tmpDispatchErr)
						{
							return _self._sendError(pResponse, 501, tmpDispatchErr, fNext);
						}

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
										pResponse.send({
											Success:        pManifest && (pManifest.Status === 'Complete'),
											OperationHash:  tmpHash,
											OperationName:  tmpGraph.Name,
											OperationType:  pOperation.OperationType,
											RunHash:        pManifest && pManifest.RunHash,
											Status:         pManifest && pManifest.Status,
											ElapsedMs:      pManifest && pManifest.ElapsedMs,
											TaskOutputs:    _self._summarizeTaskOutputs(pManifest && pManifest.TaskOutputs),
											Errors:         pManifest && pManifest.Errors
										});
										return fNext();
									});
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
						// Typed ops opt into parallel write chunks (5-way pool).
						// Mapping (the existing flow) stays at the default 1.
						Concurrency:      5,
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
						// Typed ops opt into parallel write chunks (5-way pool).
						// Mapping (the existing flow) stays at the default 1.
						Concurrency:      5,
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
						// Typed ops opt into parallel write chunks (5-way pool).
						// Mapping (the existing flow) stays at the default 1.
						Concurrency:      5,
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
						// Typed ops opt into parallel write chunks (5-way pool).
						// Mapping (the existing flow) stays at the default 1.
						Concurrency:      5,
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

		if (tmpType === 'extraction' || tmpType === 'intersection')
		{
			let tmpProj = tmpCfg.Projection || {};
			Object.keys(tmpProj).forEach((k) => tmpSet.add(k));
		}
		else if (tmpType === 'aggregation')
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
