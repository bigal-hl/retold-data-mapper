# REST API

The Data Mapper mounts its REST API under the `/mapper` prefix (configurable via `options.DataMapper.RoutePrefix`). All routes are served by the ConnectionBridge service (`source/services/DataMapper-ConnectionBridge.js`) on the Data Mapper's own Orator server, so the web UI talks to them same-origin with no CORS.

In addition to these routes, the server exposes standard Meadow CRUD endpoints for its internal entities at `/1.0/{Entity}` (for example `MappingConfig`) when the `MeadowEndpoints` group is enabled.

## Authentication

Reads (`GET`) are always open. Writes (`POST`, `PUT`, `DELETE`) under `/mapper/*` are gated by an optional bearer token: if the environment variable `DATA_MAPPER_WRITE_TOKEN` is set, every non-GET request to a `/mapper/*` route must carry `Authorization: Bearer <token>` or it is rejected with `401`. If the variable is unset, writes are unauthenticated and the server logs a startup warning.

When the Data Mapper is connected to an Ultravisor running in non-promiscuous mode, the beacon's WebAuth proxy additionally gates the `/mapper/*` prefix behind an Ultravisor session (the `/1.0/Authenticate`, `/1.0/Deauthenticate`, `/1.0/CheckSession`, and `/status` routes are mounted for the in-app login flow). The static web UI and those auth routes stay public.

## Ultravisor connection

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/mapper/ultravisor/connect` | Connect to an Ultravisor as a beacon. Body: `{ URL, BeaconName?, Password? }`. Returns the connection status. |
| `POST` | `/mapper/ultravisor/disconnect` | Disconnect the beacon. |
| `GET` | `/mapper/ultravisor/status` | Current connection status: `{ Connected, Status, URL, BeaconName }`. |

## Mesh discovery

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/mapper/beacons` | List beacons visible on the connected Ultravisor. |
| `GET` | `/mapper/beacon/:name/connections` | List the database connections on a named beacon (dispatches `DataBeaconAccess:ListConnections`). |
| `GET` | `/mapper/beacon/:name/columns` | Introspect and return the columns/tables for a connection on a named beacon. |
| `POST` | `/mapper/beacon/:name/introspect` | Trigger an introspection of a connection on a named beacon. |

## Mappings

CRUD over the internal `MappingConfig` store. Mappings carry a `Scope` so multiple logical projects can share one Data Mapper; list and create accept an optional `?scope=` query parameter (`*` matches all scopes).

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/mapper/mappings` | List saved mappings (filtered by scope). |
| `POST` | `/mapper/mappings` | Create a mapping. Body includes `Name`, source/target beacon + connection hash + entity, `MappingConfiguration`, and optional `FlowDiagramState`. |
| `GET` | `/mapper/mapping/:id` | Fetch one mapping by `IDMappingConfig`. |
| `PUT` | `/mapper/mapping/:id` | Update a mapping. |
| `DELETE` | `/mapper/mapping/:id` | Soft-delete a mapping. |

## Operations (typed Phase-2b configs)

CRUD over `OperationConfig` records, which live on the `configs-databeacon` (not in the Data Mapper's local SQLite). These describe typed operations -- Extraction, Aggregation, Histogram, Intersection, and clone/join variants.

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/mapper/operations` | List operation configs. |
| `GET` | `/mapper/operation/:hash` | Fetch one operation config by hash. |
| `POST` | `/mapper/operations` | Create an operation config. |
| `PUT` | `/mapper/operation/:id` | Update an operation config. |
| `DELETE` | `/mapper/operation/:id` | Delete an operation config. |

## Running syncs and operations

These are the routes that actually move data. Each compiles the stored intent into an Ultravisor `Operation` graph, registers it (`POST /Operation`), triggers it (`POST /Operation/:hash/Trigger`), and returns a manifest summary. They require an active Ultravisor connection and return `503` if the Data Mapper is not connected.

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/mapper/uv/run-mapping/:id` | Compile a `MappingConfig` into the `Pull → Map → Comprehend → Write` graph, register, trigger, and return the run manifest summary. |
| `POST` | `/mapper/uv/run-operation/:id` | Compile an `OperationConfig` by its `OperationType` (Extraction, PassthroughClone, Aggregation, SQLAggregate, Histogram, Intersection, SQLJoin), register (or reuse a cached graph), trigger, and return the summary. |
| `POST` | `/mapper/uv/run-chain/:idOrHash` | Walk an operation's `DependsOn` DAG and run each operation in topological order, halting on the first failure. Cycles return `400`. The identifier is treated as a numeric ID if parseable, otherwise as a hash. |
| `POST` | `/mapper/operation/:id/schedule` | Register a cron schedule for an operation on the Ultravisor. Body: `{ Cron, Enabled? }`. Requires the operation to have been run once (so a compiled graph hash exists), otherwise returns `409`. |

The success response from a run is shaped like:

```json
{
	"Success": true,
	"OperationHash": "…",
	"OperationName": "Demographics → City",
	"RunHash": "…",
	"Status": "Complete",
	"ElapsedMs": 1234,
	"TaskOutputs": { },
	"Errors": [ ],
	"HasTaskErrors": false
}
```

`run-operation` additionally returns `OperationType` and a `CacheHit` flag indicating whether the previously compiled Ultravisor graph was reused.

## Ultravisor inspection

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/mapper/uv/operations` | List the operations currently registered on the Ultravisor (hash, name, description, tags). |
| `GET` | `/mapper/uv/manifest/:runHash` | Fetch a full run manifest from the Ultravisor for display. |

## Dashboards and cached views

Dashboard configuration and panel data, also backed by the configs/dashboard beacons.

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/mapper/dashboards` | List dashboard configs. |
| `GET` | `/mapper/dashboard/:hash` | Fetch one dashboard config by hash. |
| `POST` | `/mapper/dashboards` | Create a dashboard config. |
| `PUT` | `/mapper/dashboard/:id` | Update a dashboard config. |
| `DELETE` | `/mapper/dashboard/:id` | Delete a dashboard config. |
| `POST` | `/mapper/dashboard/panel-data` | Fetch the data for a dashboard panel (reads a cached-view table through the mesh). |

## Admin

Bootstrap and schema-management helpers used when wiring a fresh mesh.

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/mapper/admin/bootstrap-configs` | (Re)provision the `configs-databeacon` -- its platform-configs connection and the `OperationConfig` / `DashboardConfig` tables. Idempotent. |
| `POST` | `/mapper/admin/ensure-schema` | Ensure a schema on a target beacon (dispatches `DataBeaconSchema:EnsureSchema`), then introspect and enable endpoints for newly created tables. Body: `{ BeaconName, IDBeaconConnection, SchemaName, SchemaJSON, AutoEnable? }`. |
| `POST` | `/mapper/admin/enable-endpoint` | Enable a dynamic endpoint for a table on a target beacon. |

> Some admin and bootstrap routes assume the broader data-platform layout (a `configs-databeacon`, a lake databeacon). On a minimal mesh with only a source and target beacon, the mapping CRUD and `run-mapping` routes are the core surface.
