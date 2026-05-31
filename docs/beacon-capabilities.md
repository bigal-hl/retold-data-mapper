# Beacon Capabilities

When the Data Mapper connects to an Ultravisor, it registers as a beacon and advertises a set of **capabilities**, each with one or more **actions**. These are implemented in `source/services/DataMapper-BeaconProvider.js` and registered through `registerCapabilities()`. The compiled operation graphs (and any other mesh node) dispatch work items at these actions; the Data Mapper executes them and, where needed, dispatches further work items onward to source and target databeacons.

The Data Mapper registers **three capabilities**: `DataMapperSource`, `DataMapperRecords`, and `DataMapperTransform`.

> Note: the provider logs "3 capabilities … with 9 actions" on startup, but the registered action set has grown to eleven (the streaming `CloneStream` and `AggregateStream` actions were added under `DataMapperRecords` after that log message was written). The actions documented below are the ones present in the code.

## DataMapperSource

Schema discovery for a source beacon.

### IntrospectSource

Introspect a DataBeacon connection to discover its tables and columns. The handler dispatches a `DataBeaconManagement:Introspect` work item to the named source beacon and returns the discovered schema.

| Setting | Type | Required | Description |
|---------|------|----------|-------------|
| `SourceBeaconName` | String | yes | Beacon name of the data source (mesh `AffinityKey`). |
| `IDBeaconConnection` | Number | yes | Connection ID on the source beacon. |

Outputs: `{ Schema: { Tables }, TableCount, ConnectionHash }`.

## DataMapperRecords

Reading from and writing to beacon entities, plus two streaming whole-table operations.

### PullRecords

Read all records from a source entity, paginated internally. Reads run through `DataBeaconAccess`/`MeadowProxy` against the source beacon. Pagination is forced to a stable sort order so high-volume reads against PostgreSQL do not silently drop or duplicate rows.

| Setting | Type | Required | Description |
|---------|------|----------|-------------|
| `SourceBeaconName` | String | yes | Beacon name of the data source. |
| `ConnectionHash` | String | yes | URL slug of the source connection. |
| `Entity` | String | yes | Entity/table name to read. |
| `BatchSize` | Number | no | Records per page. |
| `FilterExpression` | String | no | Meadow filter (for example `FBV~Field~EQ~Value`), spliced into the read URL. |
| `SortField` | String | no | Column to order by for stable pagination. Defaults to the entity's auto-identity column. |

### WriteRecords

Push a comprehension (or a bare records array) to a target entity using meadow-endpoints bulk `Upserts` (`PUT /<Entity>s/Upserts`), routed to the target beacon.

| Setting | Type | Required | Description |
|---------|------|----------|-------------|
| `TargetBeaconName` | String | yes | Beacon name of the target. |
| `ConnectionHash` | String | yes | URL slug of the target connection. |
| `Entity` | String | no | Target entity name (informational when a comprehension is supplied). |
| `Comprehension` | Object | no | Preferred input: `{ Entity: { GUID: record } }` (flows from `BuildComprehension`). |
| `Records` | Array | no | Back-compat bare records array, wrapped into a single-entity comprehension. |
| `BulkChunkSize` | Number | no | Records per bulk `Upserts` call (default 500). |
| `Concurrency` | Number | no | Bulk-upsert chunks in flight (default 1, clamped to 1–5). |
| `ResetMode` | String | no | `Append` (default) or `Replace`. `Replace` soft-deletes target rows whose GUID is absent from the new comprehension. |
| `GUIDName` | String | no | GUID column used by `ResetMode=Replace` orphan detection. |

### CloneStream

A streaming pull-batch → write-batch clone. Instead of holding the whole source in memory, it loops a read+write pair so working memory stays at one batch. Use it for 1:1 mirrors with no cross-record logic; the destination's GUID upsert key handles deduplication. (Used by the `PassthroughClone` operation type.)

### AggregateStream

A streaming-layout aggregation that pushes the `GROUP BY` into the source database (`DataBeaconAccess:Aggregate`), receives the small result set, and chunked-writes it to the target. Memory ceiling is the result set, never the source. (Used by the `SQLAggregate` operation type.)

## DataMapperTransform

In-memory record transforms. Each holds its input set in memory, guarded by `DATA_MAPPER_MAX_INMEMORY_ROWS` (default 250,000); inputs above that bound are rejected with an error directing you to reduce the set upstream.

### MapRecords

Apply a `MappingConfiguration` to a batch of source records -- the core field-mapping step. Under a full Pict instance it uses meadow-integration's `TabularTransform` (which resolves template expressions such as `{~D:Record.Field~}` and `GUIDTemplate`); otherwise it falls back to a lightweight regex mapper.

| Setting | Type | Required | Description |
|---------|------|----------|-------------|
| `Records` | Array | yes | Source records to transform. |
| `MappingConfiguration` | Object | yes | Mapping rules: `{ Entity, Mappings, GUIDTemplate, Solvers }`. |

### BuildComprehension

Accumulate mapped records into a comprehension keyed by GUID -- `{ Entity: { GUID: record } }`. Records sharing a GUID collapse to one entry, which is how the pipeline deduplicates before the write.

| Setting | Type | Required | Description |
|---------|------|----------|-------------|
| `Records` | Array | yes | Mapped records to accumulate. |
| `Entity` | String | yes | Entity name for the comprehension key. |
| `GUIDField` | String | yes | Field used as the unique key. |

### Typed operations (Phase 2b)

The remaining four actions implement the typed operations. They are fully implemented as capability handlers in `BeaconProvider`, and the ConnectionBridge has compilers that build operation graphs around them, dispatched by `POST /mapper/uv/run-operation/:id`.

| Action | Operation type | What it does |
|--------|----------------|--------------|
| `ExtractRecords` | Extraction | Drop rows that fail every `Filter` equality, then project the survivors like a mapping (with a deterministic GUID). |
| `AggregateRecords` | Aggregation | Group by `GroupBy` keys and compute `Sum` / `Count` / `Mean` / `Min` / `Max` per group; one output record per unique group. |
| `HistogramRecords` | Histogram | Bucket a column (`DateMonth` / `DateDay` / `DateYear` / `NumericRange`) and aggregate per bucket (and optional group). |
| `IntersectRecords` | Intersection | In-memory join of `SourceRecords × RelatedRecords` on a key, with optional `OrderBy` and per-source `Limit`, projecting a merged namespace. |

Each takes its type-specific options bundled inside a single `OperationConfiguration` object so the Ultravisor's settings resolver does not strip the template expressions before the handler runs.

> **Roadmap caveat:** while these handlers and their compilers are present and exercised by the module's test harness, end-to-end use assumes the broader data-platform plumbing -- an `OperationConfig` store on a `configs-databeacon` and lake target tables ensured via `DataBeaconSchema:EnsureSchema`. On a minimal source-to-target mesh, treat the typed operations as advanced/roadmap and the field-mapping pipeline (`run-mapping`) as the primary path.

## How the actions compose

The field-mapping pipeline chains three of these actions plus a source read and a target write:

```
PullRecords  →  MapRecords  →  BuildComprehension  →  WriteRecords
```

The typed operations reuse the same shape, swapping `MapRecords` for the matching transform action. Because the Data Mapper is both the orchestrator (it triggers the operation) and the executor (its beacon answers each node), a single mapping turns into one self-contained mesh operation. See [Architecture](architecture.md) for the full graph and how data flows between nodes on the Ultravisor's `State` edges.
