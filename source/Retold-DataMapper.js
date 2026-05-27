/**
 * Retold Data Mapper
 *
 * Standalone service for cross-beacon schema mapping. Runs its own Orator
 * server with the visual mapping editor web UI and a REST API at /mapper/*
 * that dispatches through the Ultravisor mesh via fable-ultravisor-client.
 *
 * Connects to any Ultravisor as a beacon (registers DataMapperSource,
 * DataMapperRecords, DataMapperTransform capabilities) so operation graphs
 * in the flow editor can call into it.
 *
 * @author Steven Velozo <steven@velozo.com>
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');

const libOrator = require('orator');
const libOratorServiceServerRestify = require('orator-serviceserver-restify');
const libOratorStaticServer = require('orator-static-server');

const libMeadow = require('meadow');
const libMeadowEndpoints = require('meadow-endpoints');

const libPath = require('path');
const libFs = require('fs');

const libDataMapperConnectionBridge = require('./services/DataMapper-ConnectionBridge.js');
const libDataMapperBeaconProvider = require('./services/DataMapper-BeaconProvider.js');

// Standalone sub-services exposed on the main service instance so the
// test suite (and any external caller) can reach them via
// `mapper.Discovery / .Validator / .SyncEngine / .Reporter`.
const libDataMapperDiscovery = require('./services/DataMapper-Discovery.js');
const libDataMapperValidator = require('./services/DataMapper-Validator.js');
const libDataMapperSyncEngine = require('./services/DataMapper-SyncEngine.js');
const libDataMapperReporter = require('./services/DataMapper-Reporter.js');

let libUltravisorBeacon = null;
try
{
	libUltravisorBeacon = require('ultravisor-beacon');
}
catch (pError)
{
	// ultravisor-beacon is optional — only needed for beacon registration
}

let libFableUltravisorClient = null;
try
{
	libFableUltravisorClient = require('fable-ultravisor-client');
}
catch (pError)
{
	// optional — only needed when dispatching through the mesh
}

// Embedded schema SQL for SQLite auto-creation
const DATAMAPPER_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS User (
	IDUser INTEGER PRIMARY KEY AUTOINCREMENT,
	GUIDUser TEXT,
	CreateDate TEXT, CreatingIDUser INTEGER DEFAULT 0,
	UpdateDate TEXT, UpdatingIDUser INTEGER DEFAULT 0,
	Deleted INTEGER DEFAULT 0, DeleteDate TEXT, DeletingIDUser INTEGER DEFAULT 0,
	LoginID TEXT, Name TEXT
);
CREATE TABLE IF NOT EXISTS MappingConfig (
	IDMappingConfig INTEGER PRIMARY KEY AUTOINCREMENT,
	GUIDMappingConfig TEXT,
	CreateDate TEXT, CreatingIDUser INTEGER DEFAULT 0,
	UpdateDate TEXT, UpdatingIDUser INTEGER DEFAULT 0,
	Deleted INTEGER DEFAULT 0, DeleteDate TEXT, DeletingIDUser INTEGER DEFAULT 0,
	Scope TEXT DEFAULT '',
	Name TEXT,
	Description TEXT,
	SourceBeaconName TEXT,
	SourceConnectionHash TEXT,
	SourceEntity TEXT,
	TargetBeaconName TEXT,
	TargetConnectionHash TEXT,
	TargetEntity TEXT,
	MappingConfiguration TEXT,
	FlowDiagramState TEXT
);
CREATE TABLE IF NOT EXISTS OperationTemplate (
	IDOperationTemplate INTEGER PRIMARY KEY AUTOINCREMENT,
	GUIDOperationTemplate TEXT,
	CreateDate TEXT, CreatingIDUser INTEGER DEFAULT 0,
	UpdateDate TEXT, UpdatingIDUser INTEGER DEFAULT 0,
	Deleted INTEGER DEFAULT 0, DeleteDate TEXT, DeletingIDUser INTEGER DEFAULT 0,
	Name TEXT,
	Description TEXT,
	OperationHash TEXT,
	OperationJSON TEXT
);
INSERT OR IGNORE INTO User (IDUser, LoginID, Name) VALUES (1, 'system', 'System');
`;

const defaultDataMapperSettings = (
	{
		AutoStartOrator: true,
		AutoCreateSchema: false,

		FullMeadowSchemaPath: `${process.cwd()}/model/`,
		FullMeadowSchemaFilename: 'MeadowModel-DataMapper.json',

		// Path to the web app folder for static serving; false to skip
		WebAppPath: false,

		// Endpoint allow-list
		Endpoints:
			{
				MeadowEndpoints: true,
				ConnectionBridge: true,
				WebUI: true
			},

		DataMapper:
			{
				RoutePrefix: '/mapper'
			},

		// If set, connect to Ultravisor on initialize and register capabilities
		Ultravisor:
			{
				URL: '',
				BeaconName: 'retold-data-mapper',
				MaxConcurrent: 5
			}
	});

class RetoldDataMapper extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, JSON.parse(JSON.stringify(defaultDataMapperSettings)), pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'RetoldDataMapper';

		this.options = Object.assign({}, JSON.parse(JSON.stringify(defaultDataMapperSettings)), this.options);

		// Restify + Orator
		this.fable.serviceManager.addServiceType('OratorServiceServer', libOratorServiceServerRestify);
		this.fable.serviceManager.addServiceType('Orator', libOrator);

		this.fable.serviceManager.instantiateServiceProvider('OratorServiceServer', this.options);
		this.fable.serviceManager.instantiateServiceProvider('Orator', this.options);

		// Internal Meadow DAL
		this._Meadow = libMeadow.new(pFable);
		this._DAL = {};
		this._MeadowEndpoints = {};

		let tmpRoutePrefix = this.options.DataMapper.RoutePrefix;

		this.fable.serviceManager.addServiceType('DataMapperConnectionBridge', libDataMapperConnectionBridge);
		this.fable.serviceManager.instantiateServiceProvider('DataMapperConnectionBridge',
			{
				RoutePrefix: tmpRoutePrefix
			});

		// Expose DAL on fable for sub-services
		this.fable.DAL = this._DAL;
		this.fable.MeadowEndpoints = this._MeadowEndpoints;

		// Beacon state (populated by connectUltravisor)
		this._BeaconService = null;
		this._BeaconProvider = null;
		this._UltravisorClient = null;
		this._UltravisorURL = '';
		this._UltravisorStatus = 'Disconnected';

		// Standalone sub-services (Discovery / Validator / SyncEngine /
		// Reporter). Constructed inline rather than going through the
		// service manager so they're cheap, plain instances reachable
		// via `mapper.Validator.validate(...)` etc. — matches the test
		// surface in test/DataMapper_tests.js.
		this.Discovery = new libDataMapperDiscovery(this.fable);
		this.Validator = new libDataMapperValidator(this.fable);
		this.SyncEngine = new libDataMapperSyncEngine(this.fable);
		this.Reporter = new libDataMapperReporter(this.fable);

		this.serviceInitialized = false;
	}

	/**
	 * Check if an endpoint group is enabled.
	 */
	isEndpointGroupEnabled(pGroupName)
	{
		if (!this.options.Endpoints)
		{
			return false;
		}
		if (!this.options.Endpoints.hasOwnProperty(pGroupName))
		{
			return false;
		}
		return !!this.options.Endpoints[pGroupName];
	}

	/**
	 * Create the internal SQLite schema (MappingConfig, OperationTemplate).
	 */
	createSchema(fCallback)
	{
		try
		{
			if (this.fable.MeadowSQLiteProvider && this.fable.MeadowSQLiteProvider.db)
			{
				this.fable.log.info('Creating DataMapper schema (CREATE TABLE IF NOT EXISTS)...');
				this.fable.MeadowSQLiteProvider.db.exec(DATAMAPPER_SCHEMA_SQL);
				this.fable.log.info('DataMapper schema created successfully.');
			}
			else
			{
				this.fable.log.warn('No SQLite provider available; skipping schema auto-creation.');
			}
		}
		catch (pError)
		{
			this.fable.log.error(`Error creating DataMapper schema: ${pError}`);
			return fCallback(pError);
		}

		return fCallback();
	}

	/**
	 * Load a parsed model object and create DAL objects + Meadow Endpoints.
	 */
	loadModel(pModelName, pModelObject, fCallback)
	{
		this.fable.log.info(`DataMapper loading model [${pModelName}]...`);

		let tmpEntityList = Object.keys(pModelObject.Tables);

		this.fable.log.info(`...initializing ${tmpEntityList.length} DAL objects for model [${pModelName}]...`);

		for (let i = 0; i < tmpEntityList.length; i++)
		{
			let tmpDALEntityName = tmpEntityList[i];
			let tmpRoutesAlreadyConnected = this._MeadowEndpoints.hasOwnProperty(tmpDALEntityName);

			try
			{
				let tmpDALSchema = pModelObject.Tables[tmpDALEntityName];
				let tmpDALMeadowSchema = tmpDALSchema.MeadowSchema;

				this._DAL[tmpDALEntityName] = this._Meadow.loadFromPackageObject(tmpDALMeadowSchema);
				this._DAL[tmpDALEntityName].setProvider('SQLite');
				this._MeadowEndpoints[tmpDALEntityName] = libMeadowEndpoints.new(this._DAL[tmpDALEntityName]);

				if (!tmpRoutesAlreadyConnected && this.isEndpointGroupEnabled('MeadowEndpoints'))
				{
					this._MeadowEndpoints[tmpDALEntityName].connectRoutes(this.fable.OratorServiceServer);
				}
			}
			catch (pError)
			{
				this.fable.log.error(`Error initializing DAL for entity [${tmpDALEntityName}]: ${pError}`);
			}
		}

		return fCallback();
	}

	loadModelFromFile(pModelName, pModelPath, pModelFilename, fCallback)
	{
		this.fable.log.info(`...loading model [${pModelName}] from file [${pModelPath}${pModelFilename}]...`);

		let tmpModelObject;
		try
		{
			tmpModelObject = require(`${pModelPath}${pModelFilename}`);
		}
		catch (pError)
		{
			this.fable.log.error(`Error loading model file [${pModelPath}${pModelFilename}]: ${pError}`);
			return fCallback(pError);
		}

		return this.loadModel(pModelName, tmpModelObject, fCallback);
	}

	initializeService(fCallback)
	{
		if (this.serviceInitialized)
		{
			return fCallback(new Error('RetoldDataMapper is being initialized but has already been initialized...'));
		}

		let tmpAnticipate = this.fable.newAnticipate();

		this.fable.log.info(`Retold DataMapper is initializing...`);

		// Start Orator
		tmpAnticipate.anticipate(
			(fInitCallback) =>
			{
				if (this.options.AutoStartOrator)
				{
					this.fable.Orator.startWebServer(fInitCallback);
				}
				else
				{
					return fInitCallback();
				}
			});

		// Enable body + query parsing
		tmpAnticipate.anticipate(
			(fInitCallback) =>
			{
				this.fable.OratorServiceServer.server.use(this.fable.OratorServiceServer.bodyParser());
				this.fable.OratorServiceServer.server.use(require('restify').plugins.queryParser());
				return fInitCallback();
			});

		// Schema auto-create
		tmpAnticipate.anticipate(
			(fInitCallback) =>
			{
				if (this.options.AutoCreateSchema)
				{
					return this.createSchema(fInitCallback);
				}
				return fInitCallback();
			});

		// Load internal Meadow model
		tmpAnticipate.anticipate(
			(fInitCallback) =>
			{
				if (this.options.FullMeadowSchemaFilename)
				{
					let tmpModelName = this.options.FullMeadowSchemaFilename.replace(/\.json$/i, '');
					return this.loadModelFromFile(tmpModelName, this.options.FullMeadowSchemaPath, this.options.FullMeadowSchemaFilename, fInitCallback);
				}
				return fInitCallback();
			});

		// Wire sub-service routes
		tmpAnticipate.anticipate(
			(fInitCallback) =>
			{
				if (this.isEndpointGroupEnabled('ConnectionBridge'))
				{
					this.fable.DataMapperConnectionBridge.setOwner(this);
					this.fable.DataMapperConnectionBridge.connectRoutes(this.fable.OratorServiceServer);
				}
				return fInitCallback();
			});

		// Serve static web UI + pict.min.js
		tmpAnticipate.anticipate(
			(fInitCallback) =>
			{
				if (!this.isEndpointGroupEnabled('WebUI'))
				{
					return fInitCallback();
				}

				let tmpWebAppPath = this.options.WebAppPath;
				if (!tmpWebAppPath)
				{
					tmpWebAppPath = libPath.join(__dirname, 'services', 'web-app', 'web');
				}

				this.fable.log.info(`Serving DataMapper web UI from ${tmpWebAppPath}`);

				let tmpPictMinJsPath;
				try
				{
					tmpPictMinJsPath = require.resolve('pict/dist/pict.min.js');
				}
				catch (pResolveError)
				{
					this.fable.log.warn(`Could not resolve pict.min.js: ${pResolveError}`);
				}

				if (tmpPictMinJsPath)
				{
					this.fable.OratorServiceServer.doGet('/pict.min.js',
						(pRequest, pResponse, fNext) =>
						{
							libFs.readFile(tmpPictMinJsPath, 'utf8',
								(pError, pData) =>
								{
									if (pError)
									{
										pResponse.send(500, { Error: 'Could not read pict.min.js' });
										return fNext();
									}
									pResponse.setHeader('Content-Type', 'application/javascript');
									pResponse.sendRaw(200, pData);
									return fNext();
								});
						});
				}

				this.fable.serviceManager.addServiceType('OratorStaticServer', libOratorStaticServer);
				let tmpStaticServer = this.fable.serviceManager.instantiateServiceProvider('OratorStaticServer');

				tmpStaticServer.addStaticRoute(tmpWebAppPath, 'index.html', '/*', '/');

				return fInitCallback();
			});

		// Optional: auto-connect to Ultravisor
		tmpAnticipate.anticipate(
			(fInitCallback) =>
			{
				let tmpURL = this.options.Ultravisor && this.options.Ultravisor.URL;
				if (!tmpURL)
				{
					return fInitCallback();
				}

				this.connectUltravisor(tmpURL, this.options.Ultravisor.BeaconName, this.options.Ultravisor.Password || '',
					(pError) =>
					{
						if (pError)
						{
							this.fable.log.warn(`Auto-connect to Ultravisor failed: ${pError.message || pError}`);
						}
						return fInitCallback();
					});
			});

		tmpAnticipate.wait(
			(pError) =>
			{
				if (pError)
				{
					this.log.error(`Error initializing Retold DataMapper: ${pError}`);
					return fCallback(pError);
				}
				this.serviceInitialized = true;
				return fCallback();
			});
	}

	/**
	 * Connect to an Ultravisor as a beacon and register capabilities.
	 */
	connectUltravisor(pURL, pBeaconName, pPassword, fCallback)
	{
		if (!libUltravisorBeacon)
		{
			return fCallback(new Error('ultravisor-beacon not installed'));
		}
		if (!libFableUltravisorClient)
		{
			return fCallback(new Error('fable-ultravisor-client not installed'));
		}

		let tmpBeaconName = pBeaconName || this.options.Ultravisor.BeaconName || 'retold-data-mapper';
		let tmpPassword = pPassword || (this.options.Ultravisor && this.options.Ultravisor.Password) || '';
		let tmpMaxConcurrent = (this.options.Ultravisor && this.options.Ultravisor.MaxConcurrent) || 5;
		// HTTP-auth username for the dispatcher's /1.0/Authenticate POST.
		// When set (typical against a shared/QA UV where the beacon name
		// isn't a registered user account), use it for the user session
		// the dispatcher relies on for /Beacon/Work/Dispatch + /mapper/*
		// REST. When unset, fall back to the beacon name so existing
		// promiscuous-UV deployments keep working without re-wiring.
		let tmpUserName = (this.options.Ultravisor && this.options.Ultravisor.UserName) || tmpBeaconName;

		if (this._BeaconService)
		{
			this.fable.log.info('Disconnecting existing Ultravisor beacon before reconnecting...');
			try { this._BeaconService.disable(() => {}); } catch (e) { /* ignore */ }
			this._BeaconService = null;
		}

		this.fable.addServiceTypeIfNotExists('UltravisorBeacon', libUltravisorBeacon);
		this._BeaconService = this.fable.instantiateServiceProviderWithoutRegistration('UltravisorBeacon',
			{
				ServerURL: pURL,
				Name: tmpBeaconName,
				// UserName separates the HTTP-auth identity (used by
				// _authenticate for the WS upgrade cookie) from the mesh
				// handle Name (used for AffinityKey routing). Without
				// this, the BeaconService's own HTTP auth tries to login
				// as the beacon name, which fails on shared UVs whose
				// auth-beacon doesn't have a user account by that name.
				// Needs ultravisor-beacon >= 1.0.3.
				UserName: tmpUserName,
				Password: tmpPassword,
				MaxConcurrent: tmpMaxConcurrent,
				StagingPath: process.cwd()
			});

		this.fable.serviceManager.addServiceTypeIfNotExists('DataMapperBeaconProvider', libDataMapperBeaconProvider);
		this._BeaconProvider = this.fable.serviceManager.instantiateServiceProviderIfNotExists('DataMapperBeaconProvider');
		this._BeaconProvider.registerCapabilities(this._BeaconService);

		// Keep a direct client handle for /mapper/* REST dispatches
		this.fable.addServiceTypeIfNotExists('UltravisorClient', libFableUltravisorClient);
		this._UltravisorClient = this.fable.instantiateServiceProviderWithoutRegistration('UltravisorClient',
			{
				UltravisorURL: pURL,
				UserName: tmpUserName,
				Password: tmpPassword
			});
		this._UltravisorURL = pURL;

		// Authenticate the dispatcher's client BEFORE enable/bootstrap.
		// Hand the same service-account creds the BeaconService uses to
		// the dispatcher client too. Without this the dispatcher
		// hardcodes 'data-mapper' / '' and any UV with a real auth-
		// beacon rejects subsequent /Beacon/Work/Dispatch calls with
		// "Authentication required." — exact symptom: CloneStream's
		// inner MeadowProxy.Request work items never reach the target
		// beacon, the manifest shows Pulled:0 with no error surfaced.
		//
		// IMPORTANT: this MUST complete before enable/bootstrap runs
		// because bootstrap's first _dispatch fires immediately and
		// needs the session cookie on the request. configureClient now
		// takes a callback for that reason.
		this._BeaconProvider.configureClient(pURL, tmpUserName, tmpPassword, (pDispatcherAuthError) =>
		{
			if (pDispatcherAuthError)
			{
				this.fable.log.warn(`DataMapperBeaconProvider dispatcher auth failed: ${pDispatcherAuthError.message || pDispatcherAuthError}. Cross-beacon dispatch will 401.`);
			}

			this._UltravisorClient.authenticate((pAuthError) =>
			{
				if (pAuthError)
				{
					this.fable.log.warn(`UltravisorClient auth failed: ${pAuthError.message || pAuthError}`);
				}

				this._BeaconService.enable((pEnableError) =>
				{
				if (pEnableError)
				{
					this._UltravisorStatus = 'Failed';
					return fCallback(pEnableError);
				}
				this._UltravisorStatus = 'Connected';
				this.fable.log.info(`DataMapper connected to Ultravisor at ${pURL} as [${tmpBeaconName}].`);

				// Mount the WebAuth proxy on data-mapper's Orator server
				// so its three pict-app shells (Dashboard / Mapper /
				// Mapping / Operation) require login when the upstream
				// UV is in non-promiscuous mode.  Same pattern as the
				// other beacons; non-fatal if it can't install (the
				// data-mapper still serves its mesh capabilities + UI
				// in promiscuous mode).
				try
				{
					if (libUltravisorBeacon && libUltravisorBeacon.WebAuth && this.fable.OratorServiceServer)
					{
						libUltravisorBeacon.WebAuth.install(this.fable.OratorServiceServer,
							{
								UltravisorURL:     pURL,
								BeaconName:        tmpBeaconName,
								BeaconID:          () => this._BeaconService && this._BeaconService.getBeaconID
									? this._BeaconService.getBeaconID() : '',
								CookieName:        'SessionID',
								RoutePrefix:       '/1.0/',
								StatusPath:        '/status',
								// Gate the data-mapper's REST surface
								// (/mapper/*) — the in-app dashboards
								// read from there.  Static UI + auth
								// routes stay public.
								GatedPathPrefixes: ['/mapper/'],
								Log:               this.fable.log
							});
						this.fable.log.info('DataMapper: WebAuth mounted /1.0/{Authenticate,Deauthenticate,CheckSession} + /status proxy');
					}
				}
				catch (pWebAuthErr)
				{
					this.fable.log.warn(`DataMapper: WebAuth install skipped: ${pWebAuthErr && pWebAuthErr.message}`);
				}

				// Best-effort self-bootstrap of the configs-databeacon
				// (platform-configs SQLite connection + OperationConfig /
				// DashboardConfig tables). Idempotent and gated on the
				// configs-databeacon being mesh-reachable; failures log
				// and continue so the rest of the data-mapper still serves.
				let tmpBridge = this.fable.DataMapperConnectionBridge;
				if (tmpBridge && typeof tmpBridge.bootstrapConfigsBeacon === 'function')
				{
					tmpBridge.bootstrapConfigsBeacon((pBootErr) =>
					{
						if (pBootErr)
						{
							this.fable.log.warn(`DataMapper bootstrap deferred: ${pBootErr.message}. Retrigger via POST /mapper/admin/bootstrap-configs once configs-databeacon is reachable.`);
						}
						// Provision additional beacon connections (lake/opdb/etc.)
						// declared via RETOLD_DATA_MAPPER_BOOTSTRAP_CONNECTIONS.
						// Runs after configs is up so the eager-register pass
						// has somewhere to read OperationConfigs from. Failures
						// here are warn-only — operator can fix the env var
						// and bounce, or wire connections via the beacon UIs.
						if (typeof tmpBridge.bootstrapAdditionalBeacons === 'function')
						{
							tmpBridge.bootstrapAdditionalBeacons((pAddErr) =>
							{
								if (pAddErr)
								{
									this.fable.log.warn(`DataMapper bootstrap: additional-beacon provisioning returned an error — ${pAddErr.message}.`);
								}
								return fCallback(null);
							});
							return;
						}
						return fCallback(null);
					});
					return;
				}
				return fCallback(null);
			});
		});
		});
	}

	/**
	 * Disconnect the Ultravisor beacon.
	 */
	disconnectUltravisor(fCallback)
	{
		if (!this._BeaconService)
		{
			this._UltravisorStatus = 'Disconnected';
			return fCallback();
		}

		this._BeaconService.disable((pError) =>
		{
			this._BeaconService = null;
			this._UltravisorClient = null;
			this._UltravisorStatus = 'Disconnected';
			return fCallback(pError);
		});
	}

	getUltravisorStatus()
	{
		return {
			Connected: this._UltravisorStatus === 'Connected',
			Status: this._UltravisorStatus,
			URL: this._UltravisorURL,
			BeaconName: (this.options.Ultravisor && this.options.Ultravisor.BeaconName) || 'retold-data-mapper'
		};
	}

	getUltravisorClient()
	{
		return this._UltravisorClient;
	}

	stopService(fCallback)
	{
		if (!this.serviceInitialized)
		{
			return fCallback(new Error('RetoldDataMapper is being stopped but is not initialized...'));
		}

		this.fable.log.info(`Retold DataMapper is stopping`);

		let tmpAnticipate = this.fable.newAnticipate();

		tmpAnticipate.anticipate(
			(fStepCallback) =>
			{
				this.disconnectUltravisor(() => fStepCallback());
			});

		tmpAnticipate.anticipate(this.fable.Orator.stopWebServer.bind(this.fable.Orator));

		tmpAnticipate.wait(
			(pError) =>
			{
				if (pError)
				{
					this.log.error(`Error stopping Retold DataMapper: ${pError}`);
					return fCallback(pError);
				}
				this.serviceInitialized = false;
				return fCallback();
			});
	}
}

module.exports = RetoldDataMapper;
module.exports.DATAMAPPER_SCHEMA_SQL = DATAMAPPER_SCHEMA_SQL;
