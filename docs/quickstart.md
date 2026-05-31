# Quick Start

This guide gets a Data Mapper beacon-server running, connected to an Ultravisor, and reachable through its web UI and REST API. Where a step depends on mesh plumbing that is still coming together, it is called out explicitly.

## Prerequisites

- Node.js (the version used across the Retold ecosystem).
- An Ultravisor to connect to. The Data Mapper is a beacon; it cannot run a sync without a mesh. See [ultravisor](https://stevenvelozo.github.io/ultravisor/).
- One or more [retold-databeacon](https://fable-retold.github.io/retold-databeacon/) instances on that mesh exposing the source and target databases you want to map between. The Data Mapper reads and writes only through these beacons.

## 1. Install

From a checkout of the module:

```bash
npm install
```

The CLI entry point is `bin/retold-data-mapper.js`, exposed as the `retold-data-mapper` bin.

## 2. Initialize the internal database

The Data Mapper keeps its own state (saved mappings, operation templates) in a local SQLite file. Create the schema before the first run:

```bash
node bin/retold-data-mapper.js init
```

This creates the `MappingConfig`, `OperationTemplate`, and `User` tables in `./data/datamapper.sqlite` (override the path with `--db`). The `serve` command also auto-creates the schema on startup, so `init` is mainly useful for provisioning the database file ahead of time or in a container build.

## 3. Start the server

```bash
node bin/retold-data-mapper.js serve
```

By default the server listens on port **8395** and logs the two URLs it exposes:

```
API:    http://localhost:8395/mapper/
Web UI: http://localhost:8395/
```

To connect to an Ultravisor on startup, pass `--ultravisor` (and a port if you want a non-default one):

```bash
node bin/retold-data-mapper.js serve \
	--port 8395 \
	--ultravisor http://localhost:8422 \
	--name retold-data-mapper
```

On a shared or authenticated Ultravisor, supply the HTTP-auth account and password. The `--user` flag is for cases where the beacon's mesh name differs from the registered user account:

```bash
node bin/retold-data-mapper.js serve \
	--ultravisor http://uv.example.com:54321 \
	--name retold-data-mapper \
	--user data-mapper@example.com \
	--password "$UV_PASSWORD"
```

### Command-line options

| Flag | Env var | Default | Description |
|------|---------|---------|-------------|
| `--config`, `-c` | `RETOLD_DATA_MAPPER_CONFIG_FILE` | -- | Path to a JSON config file (merged over defaults). |
| `--port`, `-p` | `RETOLD_DATA_MAPPER_PORT` | `8395` | HTTP server port. |
| `--db`, `-d` | `RETOLD_DATA_MAPPER_DB_PATH` | `./data/datamapper.sqlite` | Internal SQLite file path. |
| `--ultravisor`, `-u` | `RETOLD_DATA_MAPPER_ULTRAVISOR_URL` | -- | Ultravisor URL to auto-connect to on startup. |
| `--name`, `-n` | `RETOLD_DATA_MAPPER_BEACON_NAME` | `retold-data-mapper` | Beacon name on the mesh. |
| `--user`, `-U` | `RETOLD_DATA_MAPPER_BEACON_USER` | (defaults to `--name`) | HTTP-auth username for the Ultravisor. |
| `--password`, `-w` | `RETOLD_DATA_MAPPER_BEACON_PASSWORD` | -- | HTTP-auth password for the Ultravisor. |
| `--max-concurrent` | `RETOLD_DATA_MAPPER_MAX_CONCURRENT` | `5` | Max concurrent beacon work items. |
| `--log`, `-l` | `RETOLD_DATA_MAPPER_LOG_PATH` | -- | Write log output to a file. |
| `--verbose`, `-v` | -- | off | Verbose (trace-level) logging. |

Every secret-bearing environment variable also honors a `_FILE` suffix (for example `RETOLD_DATA_MAPPER_BEACON_PASSWORD_FILE=/run/secrets/uv-pass`) so credentials can be read from a Docker or Kubernetes secret mount.

## 4. Confirm it is on the mesh

If you started with `--ultravisor`, the server registers its three capabilities (`DataMapperSource`, `DataMapperRecords`, `DataMapperTransform`) on connect. You can also connect (or reconnect) at runtime through the REST API:

```bash
curl -X POST http://localhost:8395/mapper/ultravisor/connect \
	-H "Content-Type: application/json" \
	-d '{ "URL": "http://localhost:8422", "BeaconName": "retold-data-mapper" }'

curl http://localhost:8395/mapper/ultravisor/status
```

A connected status looks like:

```json
{ "Connected": true, "Status": "Connected", "URL": "http://localhost:8422", "BeaconName": "retold-data-mapper" }
```

## 5. Reach the web UI and REST API

Open `http://localhost:8395/` for the web UI. The landing page is the visual mapper (a Pict application); the navigation bar links to the Mappings, Operations, Cached views, and Dashboards shell pages.

> **Note:** The web UI is a work-in-progress front end over the REST API -- a compiled Pict bundle for the visual mapper plus several plain HTML shell pages. Expect it to evolve.

The REST API lives under `/mapper/*` and is the stable surface. List the beacons the Data Mapper can see on the mesh:

```bash
curl http://localhost:8395/mapper/beacons
```

## 6. Create and run a mapping

The end-to-end sync path is:

1. **Create a mapping** -- `POST /mapper/mappings` with the source/target beacon names and connection hashes, the source and target entities, and a `MappingConfiguration` (see [Mapping Configuration](mapping-configuration.md)). The mapping is stored in the internal SQLite database and returns a numeric `IDMappingConfig`.
2. **Run it** -- `POST /mapper/uv/run-mapping/:id`. The Data Mapper compiles the mapping into an Ultravisor operation graph (`Pull → Map → Comprehend → Write`), registers it on the Ultravisor, triggers it, and returns the run manifest summary.

```bash
# Create a mapping (abbreviated body)
curl -X POST http://localhost:8395/mapper/mappings \
	-H "Content-Type: application/json" \
	-d '{
		"Name": "Demographics → City",
		"SourceBeaconName": "demographics-beacon",
		"SourceConnectionHash": "demographics",
		"SourceEntity": "Demographics",
		"TargetBeaconName": "lake-beacon",
		"TargetConnectionHash": "city-lake",
		"TargetEntity": "City",
		"MappingConfiguration": {
			"Entity": "City",
			"GUIDName": "GUIDCity",
			"GUIDTemplate": "City_{~PascalCaseIdentifier:Record.CityName~}_{~D:Record.StateCode~}",
			"Mappings": {
				"CityName": "{~D:Record.CityName~}",
				"StateCode": "{~D:Record.StateCode~}",
				"Population": "{~D:Record.Population~}"
			}
		}
	}'

# Run the mapping by its IDMappingConfig
curl -X POST http://localhost:8395/mapper/uv/run-mapping/1
```

### What this requires to actually move data

Running a sync depends on the rest of the mesh being in place:

- The Data Mapper must be **connected to an Ultravisor** (`POST /mapper/uv/run-mapping/:id` returns `503 Not connected to an Ultravisor` otherwise).
- The named **source and target beacons must be registered** on that Ultravisor with the referenced connections, and the target entity must have endpoints enabled (the bridge can ensure a target schema via `POST /mapper/admin/ensure-schema`).
- The `MappingConfiguration` template expressions (for example `{~D:Record.Field~}`) are resolved at mapping time by meadow-integration's `TabularTransform`, which requires the source records to carry those fields.

For a fully wired local mesh to experiment against, the module ships a development harness under `test/harness/` (seeded test databases and an automated multi-entity run). That harness is the most reliable way to see a sync run end-to-end while the standalone web-UI workflow is still maturing.

## Stopping the server

The server handles `SIGINT` (Ctrl-C), disconnecting its beacon and stopping the Orator server cleanly before exiting.
