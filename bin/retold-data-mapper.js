#!/usr/bin/env node
/**
 * Retold Data Mapper — CLI Entry Point
 *
 * Starts the Data Mapper as a standalone service:
 *   - its own Orator HTTP server (default port 8395)
 *   - web UI at http://localhost:<port>/
 *   - REST API at /mapper/*
 *   - optionally connects to an Ultravisor as a beacon
 *
 * Subcommands:
 *   serve (default)     Start the API server + web UI
 *   init                Create the internal SQLite schema
 *
 * @author Steven Velozo <steven@velozo.com>
 */
const libPict = require('pict');
const libMeadowConnectionManager = require('meadow-connection-manager');
const libRetoldDataMapper = require('../source/Retold-DataMapper.js');

const libFs = require('fs');
const libPath = require('path');

// ================================================================
// CLI Argument Parsing
// ================================================================

let _CLIConfig = null;
let _CLILogPath = null;
let _CLIPort = null;
let _CLIDBPath = null;
let _CLICommand = 'serve';
let _CLIUltravisorURL = '';
let _CLIBeaconName = 'retold-data-mapper';
let _CLIUserName = '';
let _CLIPassword = '';
let _CLIVerbose = false;

let tmpArgs = process.argv.slice(2);
let tmpPositionalIndex = 0;

for (let i = 0; i < tmpArgs.length; i++)
{
	let tmpArg = tmpArgs[i];

	if (tmpArg === '--config' || tmpArg === '-c')
	{
		if (tmpArgs[i + 1])
		{
			let tmpConfigPath = libPath.resolve(tmpArgs[i + 1]);
			try
			{
				let tmpRaw = libFs.readFileSync(tmpConfigPath, 'utf8');
				_CLIConfig = JSON.parse(tmpRaw);
				console.log(`Retold DataMapper: Loaded config from ${tmpConfigPath}`);
			}
			catch (pConfigError)
			{
				console.error(`Retold DataMapper: Failed to load config from ${tmpConfigPath}: ${pConfigError.message}`);
				process.exit(1);
			}
			i++;
		}
	}
	else if (tmpArg === '--port' || tmpArg === '-p')
	{
		if (tmpArgs[i + 1])
		{
			_CLIPort = parseInt(tmpArgs[i + 1], 10);
			i++;
		}
	}
	else if (tmpArg === '--db' || tmpArg === '-d')
	{
		if (tmpArgs[i + 1])
		{
			_CLIDBPath = libPath.resolve(tmpArgs[i + 1]);
			i++;
		}
	}
	else if (tmpArg === '--log' || tmpArg === '-l')
	{
		if (tmpArgs[i + 1] && !tmpArgs[i + 1].startsWith('-'))
		{
			_CLILogPath = libPath.resolve(tmpArgs[i + 1]);
			i++;
		}
		else
		{
			_CLILogPath = `${process.cwd()}/DataMapper-Run-${Date.now()}.log`;
		}
	}
	else if (tmpArg === '--ultravisor' || tmpArg === '-u')
	{
		if (tmpArgs[i + 1]) { _CLIUltravisorURL = tmpArgs[i + 1]; i++; }
	}
	else if (tmpArg === '--name' || tmpArg === '-n')
	{
		if (tmpArgs[i + 1]) { _CLIBeaconName = tmpArgs[i + 1]; i++; }
	}
	else if (tmpArg === '--password' || tmpArg === '-w')
	{
		if (tmpArgs[i + 1]) { _CLIPassword = tmpArgs[i + 1]; i++; }
	}
	else if (tmpArg === '--user' || tmpArg === '-U')
	{
		// HTTP-auth username for the dispatcher's /1.0/Authenticate POST.
		// The beacon mesh identity (--name) is what UV uses for routing,
		// AffinityKey, etc. — but the HTTP auth that backs cross-beacon
		// /Beacon/Work/Dispatch needs a real USER account registered on
		// the auth-beacon. In most deployments those are the same, but
		// against shared UVs (e.g. QA) the data-mapper's beacon name is
		// just a mesh handle and the HTTP auth has to use the operator's
		// service-account email. When omitted, defaults to --name for
		// backward compat with solo/promiscuous setups.
		if (tmpArgs[i + 1]) { _CLIUserName = tmpArgs[i + 1]; i++; }
	}
	else if (tmpArg === '--verbose' || tmpArg === '-v')
	{
		_CLIVerbose = true;
	}
	else if (tmpArg === '--help' || tmpArg === '-h')
	{
		printHelp();
		process.exit(0);
	}
	else if (!tmpArg.startsWith('-'))
	{
		if (tmpPositionalIndex === 0)
		{
			_CLICommand = tmpArg;
		}
		tmpPositionalIndex++;
	}
}

function printHelp()
{
	console.log(`
Retold Data Mapper — Visual Cross-Beacon Schema Mapping

Usage:
  retold-data-mapper [command] [options]

Commands:
  serve                   Start the API server + web UI (default)
  init                    Create the internal SQLite schema

Options:
  --config, -c <path>     Path to a JSON config file
  --port, -p <port>       API server port (default: 8395)
  --db, -d <path>         SQLite database file (default: ./data/datamapper.sqlite)
  --ultravisor, -u <url>  Connect to Ultravisor on startup (e.g. http://localhost:8422)
  --name, -n <name>       Beacon name on the Ultravisor (default: retold-data-mapper)
  --user, -U <user>       HTTP auth username on the Ultravisor (env: DATAMAPPER_BEACON_USER).
                          Defaults to --name. Set this when the beacon's mesh
                          name differs from the registered USER account (e.g.
                          on shared/QA UVs the beacon is "<svc>-data-mapper"
                          but the auth-beacon user account is the operator's
                          email).
  --password, -w <pw>     Beacon password for Ultravisor auth (env: DATAMAPPER_BEACON_PASSWORD)
  --log, -l [path]        Write log output to a file
  --verbose, -v           Verbose logging
  --help, -h              Show this help

Environment variables (override defaults; CLI flags win over env vars):
  DATAMAPPER_ULTRAVISOR_URL   Same as --ultravisor
  DATAMAPPER_BEACON_NAME      Same as --name
  DATAMAPPER_BEACON_USER      Same as --user (defaults to BEACON_NAME)
  DATAMAPPER_BEACON_PASSWORD  Same as --password

Examples:
  retold-data-mapper                                   Start on port 8395
  retold-data-mapper --port 9000                       Custom port
  retold-data-mapper --ultravisor http://localhost:8422  Auto-connect on startup
  retold-data-mapper init                              Create database tables
`);
}

// ================================================================
// Configuration
// ================================================================

let _DefaultDBPath = libPath.join(process.cwd(), 'data', 'datamapper.sqlite');

let _Settings =
	{
		Product: 'RetoldDataMapper',
		ProductVersion: '0.0.1',
		APIServerPort: _CLIPort || parseInt(process.env.PORT, 10) || 8395,
		LogStreams:
			[
				{
					streamtype: 'console',
					level: _CLIVerbose ? 'trace' : 'info'
				}
			],
		SQLite:
			{
				SQLiteFilePath: _CLIDBPath || _DefaultDBPath
			}
	};

if (_CLIConfig)
{
	Object.assign(_Settings, _CLIConfig);
}

// Resolve Ultravisor settings with this precedence:
//   1. CLI flags (--ultravisor / --name / --password)
//   2. DATAMAPPER_* environment variables (so docker-run can inject them
//      without per-deploy CLI plumbing)
//   3. The loaded config file's Settings.Ultravisor.{URL,BeaconName,Password}
//
// The CLI used to drop the password on the floor entirely — the service
// constructor below only forwarded URL + BeaconName, so any beacon
// joining a Ultravisor whose auth-beacon requires real credentials
// would silently auth with "" and the dispatch loop would later return
// empty bodies. Filling the gap lets retold-data-mapper register
// against a real UV the same way retold-databeacon does.
if (!_CLIUltravisorURL)
{
	_CLIUltravisorURL = process.env.DATAMAPPER_ULTRAVISOR_URL
		|| (_Settings.Ultravisor && _Settings.Ultravisor.URL)
		|| '';
}
if (!_CLIBeaconName || _CLIBeaconName === 'retold-data-mapper')
{
	let tmpEnvName = process.env.DATAMAPPER_BEACON_NAME
		|| (_Settings.Ultravisor && _Settings.Ultravisor.BeaconName);
	if (tmpEnvName) _CLIBeaconName = tmpEnvName;
}
if (!_CLIPassword)
{
	_CLIPassword = process.env.DATAMAPPER_BEACON_PASSWORD
		|| (_Settings.Ultravisor && _Settings.Ultravisor.Password)
		|| '';
}
if (!_CLIUserName)
{
	_CLIUserName = process.env.DATAMAPPER_BEACON_USER
		|| (_Settings.Ultravisor && _Settings.Ultravisor.UserName)
		|| '';
}

if (_CLILogPath)
{
	_Settings.LogStreams.push(
		{
			loggertype: 'simpleflatfile',
			outputloglinestoconsole: false,
			showtimestamps: true,
			formattedtimestamps: true,
			level: 'trace',
			path: _CLILogPath
		});
}

if (_CLICommand !== 'serve')
{
	_Settings.LogStreams = [{ streamtype: 'console', level: 'warn' }];
}

let _DataDir = libPath.dirname(_Settings.SQLite.SQLiteFilePath);
if (_DataDir !== ':memory:' && !libFs.existsSync(_DataDir))
{
	libFs.mkdirSync(_DataDir, { recursive: true });
}

// ================================================================
// Bootstrap
// ================================================================

let _Fable = new libPict(_Settings);

_Fable.serviceManager.addServiceType('MeadowConnectionManager', libMeadowConnectionManager);
_Fable.serviceManager.instantiateServiceProvider('MeadowConnectionManager');

_Fable.MeadowConnectionManager.connect('datamapper',
	{
		Type: 'SQLite',
		SQLiteFilePath: _Settings.SQLite.SQLiteFilePath
	},
	(pError, pConnection) =>
	{
		if (pError)
		{
			console.error(`SQLite connection error: ${pError}`);
			process.exit(1);
		}

		_Fable.MeadowSQLiteProvider = pConnection.instance;
		_Fable.settings.MeadowProvider = 'SQLite';

		switch (_CLICommand)
		{
			case 'serve':
				commandServe();
				break;
			case 'init':
				commandInit();
				break;
			default:
				console.error(`Unknown command: ${_CLICommand}`);
				printHelp();
				process.exit(1);
		}
	});

function commandServe()
{
	_Fable.serviceManager.addServiceType('RetoldDataMapper', libRetoldDataMapper);
	let tmpMapperService = _Fable.serviceManager.instantiateServiceProvider('RetoldDataMapper',
		{
			AutoCreateSchema: true,

			FullMeadowSchemaPath: libPath.join(__dirname, '..', 'model') + '/',
			FullMeadowSchemaFilename: 'MeadowModel-DataMapper.json',

			Endpoints:
				{
					MeadowEndpoints: true,
					ConnectionBridge: true,
					WebUI: true
				},

			Ultravisor:
				{
					URL: _CLIUltravisorURL,
					BeaconName: _CLIBeaconName,
					UserName: _CLIUserName,
					Password: _CLIPassword
				}
		});

	tmpMapperService.initializeService((pInitError) =>
	{
		if (pInitError)
		{
			_Fable.log.error(`Initialization error: ${pInitError}`);
			process.exit(1);
		}
		_Fable.log.info(`Retold DataMapper running on port ${_Settings.APIServerPort}`);
		_Fable.log.info(`API:    http://localhost:${_Settings.APIServerPort}/mapper/`);
		_Fable.log.info(`Web UI: http://localhost:${_Settings.APIServerPort}/`);
		if (_CLIUltravisorURL)
		{
			_Fable.log.info(`Ultravisor: ${_CLIUltravisorURL} (beacon: ${_CLIBeaconName})`);
		}
	});

	process.on('SIGINT', () =>
	{
		console.log('\nShutting down...');
		tmpMapperService.stopService(() => process.exit(0));
		setTimeout(() => process.exit(0), 5000);
	});
}

function commandInit()
{
	console.log('Initializing DataMapper database schema...');
	try
	{
		_Fable.MeadowSQLiteProvider.db.exec(libRetoldDataMapper.DATAMAPPER_SCHEMA_SQL);
		console.log('Schema created successfully.');
		console.log(`Database: ${_Settings.SQLite.SQLiteFilePath}`);
	}
	catch (pError)
	{
		console.error(`Error creating schema: ${pError.message}`);
		process.exit(1);
	}
	process.exit(0);
}
