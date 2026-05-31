# Phase 2b — Typed Operations: Extraction / Aggregation / Histogram / Intersection

This plan picks up where the Phase A/B/C + B-full session left off. The
canonical Pull → Map → Comprehension → Write pipeline is working
end-to-end through Ultravisor's queue (commit `8d683e9` in
`retold-data-mapper`). The data-mapper now compiles a stored
`MappingConfiguration` into a 5-node UV Operation, and the lake
absorbs records via meadow-endpoints' bulk `/Upserts` with the
new per-row error visibility (commits `b16d8f9` + `2942fe1` in
`meadow-endpoints`).

Phase 2b adds the four **typed** operations called out in
[`PLAN.md`](../PLAN.md): Extraction, Aggregation, Histogram, and
Intersection. These are the cached-view producers — operators
define them once, they compute against the opdb (or directly
against the lake), and the result lands in named tables in the lake
that `pict-section-dashboard` reads.

Each typed operation reuses the same execution shell as Mapping but
swaps the `Map → Comprehension` half for type-specific compute. The
existing `Pull` and `Write` nodes work unchanged.

---

## 1 · Where we are

**Done (this codebase, before Phase 2b):**

- `data-mapper-beacon` exposes 5 actions (`IntrospectSource`,
  `PullRecords`, `MapRecords`, `BuildComprehension`, `WriteRecords`).
- `WriteRecords` chunks comprehensions into bulk `/Upserts` calls
  routed through MeadowProxy.
- `_compileMappingToOperation` produces the canonical 5-node graph
  with State edges feeding records → mapped → comprehension →
  write.
- `MappingConfig` table stores the operator-authored intent;
  `/mapper/uv/run-mapping/:id` compiles → POSTs to UV → triggers →
  returns the manifest summary.
- The mapping editor has a "Discover source columns" introspection
  helper that drops `{~D:Record.<col>~}` snippets at the cursor.
- `meadow-endpoints` exposes both `/Upserts` (bare-array, back-
  compat) and `/Upserts/Detailed` (envelope with per-row errors).
- All meadow-connection-* + migration-manager defaults bumped from
  GUID size 36 → 255 so combinatorial GUIDs from
  IntegrationAdapter no longer overflow silently.
- Engine wraps task `Execute()` in try/catch; rest-request
  executor stringifies bodies before handing to simple-get.

**Pending uncommitted live state to know about:**

- Lake schema was hand-rolled at `/tmp/lake-schema-meadow.sql`
  during the session for the WeatherStation/WeatherReading mirror.
  Should be re-emitted via `DataBeaconSchema:EnsureSchema` (already
  exposed on every retold-databeacon as a beacon action — confirmed
  in `/Beacon/Capabilities`).

**Architectural premise:**

> "The data-mapper is the intent-capture surface. Ultravisor owns
> execution, queue, scheduling, and observability. We don't
> duplicate."
> ([memory: retold-data-mapper-vision](../../../../.claude/projects/-Users-steven-Code/memory/project_retold_data_mapper_vision.md))

Phase 2b extends the same pattern: typed operations are *intent*;
each compiles to a UV Operation graph; UV does the work.

---

## 2 · Goal

Land the four typed operations as first-class compositions of
existing-or-new data-mapper-beacon node types, with at least one
demo of each that runs end-to-end against the WeatherStation +
WeatherReading lake data already in the stack.

| Type | What it produces | Example demo we'll build |
|---|---|---|
| **Extraction** | Subset of fields from a source set | `WeatherStationCompact` (StationCode, CityName, StateName, Active) extracted from `WeatherStation` |
| **Aggregation** | Aggregate values grouped by clustering key(s) | `WeatherSummaryByCity` (CityName, StateName, AvgTempF, MaxTempF, MinTempF, ReadingCount) — group readings by city |
| **Histogram** | Bucketed counts/values over a column | `WeatherReadingsByMonth` (YearMonth, ReadingCount, AvgTempF) — bucket readings by month |
| **Intersection** | Related-record set attached to source records | `LatestReadingsPerStation` (IDWeatherStation, IDWeatherReading, ReadingDate, AvgTempF) — last 3 readings per station |

Each demo lands in lake as a stable cached-view table. Re-runs
upsert-idempotently (same primary key contract as Mapping).

---

## 3 · Per-type design

The shared shape across all four types:

```
Operator-authored config (in OperationConfig table)
    │
    │ data-mapper bridge compiler
    ▼
UV Operation graph
    │
    │ POST /Operation, Trigger
    ▼
Pull → <type-specific compute> → Comprehension → Write
```

Each type adds **one new beacon action** on the data-mapper beacon
that does the type-specific compute. The Pull+Comprehension+Write
nodes stay identical to Mapping's.

### 3.1 · Extraction

The lightest of the four — projects (selects + renames) a subset of
columns. Often combined with a row-level filter.

**New beacon action:** `DataMapperTransform:ExtractRecords`
- Inputs: `Records[]`, `Projection` (object: `{ TargetCol: "{~D:Record.SourceCol~}", ... }`),
  optional `Filter` (a Foxhound-style filter expression, evaluated client-side
  against each record).
- Output: `Records[]` (projected/filtered).

**Compiled graph:** `Pull → Extract → Comprehension → Write`

**OperationConfig record:**
```json
{
  "Hash": "weatherstation-compact",
  "Name": "WeatherStation Compact",
  "OperationType": "Extraction",
  "SourceBeaconName": "lake-databeacon",
  "SourceConnectionHash": "lake-main",
  "SourceEntity": "WeatherStation",
  "TargetBeaconName": "lake-databeacon",
  "TargetConnectionHash": "lake-main",
  "TargetTable": "WeatherStationCompact",
  "OperationConfiguration": {
    "Entity": "WeatherStationCompact",
    "GUIDName": "GUIDWeatherStationCompact",
    "GUIDTemplate": "WSC_{~D:Record.IDWeatherStation~}",
    "Filter": { "Active": 1 },
    "Projection": {
      "StationCode": "{~D:Record.StationCode~}",
      "CityName":    "{~D:Record.CityName~}",
      "StateName":   "{~D:Record.StateName~}",
      "Active":      "{~D:Record.Active~}"
    }
  }
}
```

**Notable:** Extraction is *almost* the same as Mapping. The
`MapRecords` action could probably handle Extraction directly
if we add Filter support there. Decide whether Extraction is its
own action or just a `Filter`-aware Mapping. Recommendation: add
`Filter` to `MapRecords` and skip a dedicated Extract action.

### 3.2 · Aggregation

`SUM` / `COUNT` / `MEAN` / `MIN` / `MAX` over a grouping key.

**New beacon action:** `DataMapperTransform:AggregateRecords`
- Inputs:
  - `Records[]`
  - `GroupBy[]` — array of source field names that form the
    grouping key (e.g., `["CityName", "StateName"]`)
  - `Aggregates[]` — array of `{ Source: "FieldName", Function:
    "Sum"|"Count"|"Mean"|"Min"|"Max", As: "TargetCol" }`
  - `IncludeGroupColumns` (default true) — pass-through the
    GroupBy fields into output
- Output: `Records[]` (one per group; columns are GroupBy ∪ Aggregates.As)

**Compiled graph:** `Pull → Aggregate → Comprehension → Write`

**OperationConfig record:**
```json
{
  "Hash": "weather-summary-by-city",
  "Name": "Weather Summary By City",
  "OperationType": "Aggregation",
  "SourceBeaconName": "lake-databeacon",
  "SourceConnectionHash": "lake-main",
  "SourceEntity": "WeatherReading",
  "TargetBeaconName": "lake-databeacon",
  "TargetConnectionHash": "lake-main",
  "TargetTable": "WeatherSummaryByCity",
  "OperationConfiguration": {
    "Entity": "WeatherSummaryByCity",
    "GUIDName": "GUIDWeatherSummaryByCity",
    "GUIDTemplate": "WSBC_{~PascalCaseIdentifier:Record.CityName~}_{~PascalCaseIdentifier:Record.StateName~}",
    "GroupBy": ["CityName", "StateName"],
    "Aggregates": [
      { "Source": "AvgTemperatureF",  "Function": "Mean", "As": "AvgTempF" },
      { "Source": "HighTemperatureF", "Function": "Max",  "As": "MaxTempF" },
      { "Source": "LowTemperatureF",  "Function": "Min",  "As": "MinTempF" },
      { "Source": "IDWeatherReading", "Function": "Count","As": "ReadingCount" }
    ]
  }
}
```

**Notable:** WeatherReading rows don't have CityName / StateName
directly — those live on WeatherStation. We need either (a) a
join (which is the Intersection type's job) or (b) the operation
to also pull WeatherStation and merge. For the demo, simplest path:
use `IDWeatherStation` as the GroupBy and include a separate
"resolve city name" step. Or precompute via a Mapping that joins.
**Decide before implementing.**

### 3.3 · Histogram

Bucketed aggregation over a numeric or date column, with optional
secondary grouping.

**New beacon action:** `DataMapperTransform:HistogramRecords`
- Inputs:
  - `Records[]`
  - `BucketColumn` — source field to bucket on
  - `BucketKind` — `"DateMonth"` | `"DateDay"` | `"DateYear"` |
    `"NumericRange"`
  - `BucketSize` — for `NumericRange` (e.g., 10 → 0-9, 10-19, ...);
    ignored for date kinds
  - `GroupBy[]` — optional additional grouping (e.g., per city)
  - `Aggregates[]` — same shape as Aggregation
- Output: `Records[]` (one per bucket × group; columns are
  `Bucket` + GroupBy ∪ Aggregates.As)

**Compiled graph:** `Pull → Histogram → Comprehension → Write`

**OperationConfig record:**
```json
{
  "Hash": "weather-readings-by-month",
  "Name": "Weather Readings By Month",
  "OperationType": "Histogram",
  "SourceBeaconName": "lake-databeacon",
  "SourceConnectionHash": "lake-main",
  "SourceEntity": "WeatherReading",
  "TargetBeaconName": "lake-databeacon",
  "TargetConnectionHash": "lake-main",
  "TargetTable": "WeatherReadingsByMonth",
  "OperationConfiguration": {
    "Entity": "WeatherReadingsByMonth",
    "GUIDName": "GUIDWeatherReadingsByMonth",
    "GUIDTemplate": "WRBM_{~D:Record.YearMonth~}",
    "BucketColumn": "ReadingDate",
    "BucketKind":   "DateMonth",
    "Aggregates": [
      { "Source": "IDWeatherReading", "Function": "Count", "As": "ReadingCount" },
      { "Source": "AvgTemperatureF",  "Function": "Mean",  "As": "AvgTempF" }
    ]
  }
}
```

### 3.4 · Intersection

For each row in a *source* set, attach the top-N rows from a
*related* set joined on a key. Produces denormalized rows.

**New beacon action:** `DataMapperRecords:PullRelatedRecords`
(probably; may also need a small `IntersectRecords` transform)
- Inputs:
  - `SourceRecords[]` — already-pulled source rows
  - `RelatedBeaconName`, `RelatedConnectionHash`, `RelatedEntity` —
    where the related rows live
  - `JoinOn` — `{ SourceField: "IDWeatherStation",
    RelatedField: "IDWeatherStation" }`
  - `OrderBy[]` — sort the related set before slicing
    (e.g., `[{ Field: "ReadingDate", Direction: "DESC" }]`)
  - `Limit` — N rows per source row (e.g., 3)
- Output: `Records[]` — one row per (source × related-N), with
  fields from both sides.

**Compiled graph:** `Pull (source) → PullRelated → Intersect →
Comprehension → Write`. Two pulls + one intersect.

**OperationConfig record:**
```json
{
  "Hash": "latest-readings-per-station",
  "Name": "Latest 3 Readings Per Station",
  "OperationType": "Intersection",
  "SourceBeaconName": "lake-databeacon",
  "SourceConnectionHash": "lake-main",
  "SourceEntity": "WeatherStation",
  "TargetBeaconName": "lake-databeacon",
  "TargetConnectionHash": "lake-main",
  "TargetTable": "LatestReadingsPerStation",
  "OperationConfiguration": {
    "Entity": "LatestReadingsPerStation",
    "GUIDName": "GUIDLatestReadingsPerStation",
    "GUIDTemplate": "LRPS_{~D:Record.IDWeatherStation~}_{~D:Record.IDWeatherReading~}",
    "RelatedEntity": "WeatherReading",
    "RelatedConnectionHash": "lake-main",
    "JoinOn": {
      "SourceField":  "IDWeatherStation",
      "RelatedField": "IDWeatherStation"
    },
    "OrderBy": [{ "Field": "ReadingDate", "Direction": "DESC" }],
    "Limit": 3,
    "Projection": {
      "IDWeatherStation":  "{~D:Source.IDWeatherStation~}",
      "StationCode":       "{~D:Source.StationCode~}",
      "CityName":          "{~D:Source.CityName~}",
      "IDWeatherReading":  "{~D:Related.IDWeatherReading~}",
      "ReadingDate":       "{~D:Related.ReadingDate~}",
      "AvgTempF":          "{~D:Related.AvgTemperatureF~}"
    }
  }
}
```

**Notable:** The `{~D:Source.X~}` vs `{~D:Related.X~}` template
prefix is new — TabularTransform's existing template only knows
`Record.X`. Either extend TabularTransform or just merge the two
records into a single namespace before mapping.

---

## 4 · Implementation order (recommended)

1. **Schema & API surface** (1–2 hrs)
   - Add `OperationConfig` table (in
     `/tmp/lab-data-platform/configs/init-platform-configs.sql`
     and via `DataBeaconSchema:EnsureSchema`).
   - Decide whether to fold OperationConfig back in (it was retired
     this session — see commit `8d683e9`) or to put typed
     operations on a new table. **Recommendation: bring it back, but
     scoped exclusively to typed operations.** Mapping stays in
     `MappingConfig`.
   - Add `/mapper/operations` CRUD on `DataMapper-ConnectionBridge.js`
     mirroring the existing `/mapper/mappings` pattern.

2. **Extraction** (2–3 hrs)
   - Add `Filter` setting to existing `MapRecords` action; skip a
     new Extract action.
   - Add `_compileExtractionToOperation` to bridge — same as
     `_compileMappingToOperation` but uses Filter.
   - `/mapper/uv/run-operation/:id` endpoint that dispatches by
     `OperationConfig.OperationType`.
   - Demo: `WeatherStationCompact`. Verify rows appear in lake.

3. **Aggregation** (3–4 hrs)
   - New beacon action `AggregateRecords` (see §3.2). Implement in
     `DataMapper-BeaconProvider.js`. JS reduce over Records, per
     unique GroupBy key.
   - Bridge compiler: `_compileAggregationToOperation` swaps the
     Map node for an Aggregate node.
   - Demo: `WeatherSummaryByCity`. May require a JOIN-style pre-pull
     on WeatherStation to enrich Reading rows with CityName — see
     §3.2 note.

4. **Histogram** (3–4 hrs)
   - New beacon action `HistogramRecords`. JS bucket the values,
     then aggregate per bucket. Date bucketing via simple substring
     of the ISO date (`'2024-01-15'.slice(0,7)` → `'2024-01'`).
   - Bridge compiler: `_compileHistogramToOperation`.
   - Demo: `WeatherReadingsByMonth`.

5. **Intersection** (4–6 hrs — most involved)
   - New beacon actions: `PullRelatedRecords` (or use existing
     PullRecords with a filter) and `IntersectRecords`.
   - Decide on the Source/Related namespace handling for templates
     (see §3.4 note).
   - Bridge compiler: `_compileIntersectionToOperation` produces a
     7-node graph (start, source-pull, related-pull, intersect,
     comprehension, write, end).
   - Demo: `LatestReadingsPerStation`.

6. **UI surface** (2–4 hrs, can run in parallel from step 2)
   - In the existing mapping editor (or a new Operations editor):
     pick `OperationType` from a dropdown; show type-specific
     fields below (GroupBy, Aggregates, BucketColumn, etc.).
   - Add "Run via UV" button on each Operation row.
   - The result-panel renderer can be the same one used for
     mappings — manifest summary is structurally the same.

7. **Polish** (1–2 hrs)
   - Make all 4 demos schedulable via `/Schedule/Operation` in
     Ultravisor (already exists from the prior session).
   - Memory: write per-type `feedback_*.md` capturing any decisions
     that surprised you (e.g. Source/Related namespace choice).

**Total estimate: 16–25 hours of focused work.** The most
involved part is Intersection; the most decision-heavy is
Aggregation (because of the join question).

---

## 5 · Validation strategy

For each operation type:

1. **Direct dispatch test** — POST a constructed OperationConfig
   to UV, trigger, inspect manifest. Confirms the beacon action
   produces the right output shape.
2. **End-to-end via UI** — create the OperationConfig in the
   editor, click Run via UV, see the result panel populate.
3. **Lake verification** — `psql` count + `SELECT` a few rows from
   the result table. Confirms the comprehension landed correctly
   via meadow's bulk Upsert.
4. **Idempotence** — run twice, count stays the same, UpdateDate
   refreshes. Same proof we did for Mapping in Phase B-full.
5. **Lake schema** — for each new result table, generate the
   schema descriptor and dispatch via `DataBeaconSchema:EnsureSchema`
   instead of hand-rolling SQL. This is the canonical path now.

---

## 6 · Open questions

| Question | Why it matters | Notes |
|---|---|---|
| Bring back `OperationConfig` table or keep typed ops in `MappingConfig` with a Type discriminator? | Affects schema, CRUD endpoints, UI surface | Recommendation: bring it back. Mapping = identity transform; Operations = typed compute. Different intent, different UX. |
| For Aggregation/Histogram, do we pull join-able dimension data inline (e.g. CityName for Reading rows) or precompute via a Mapping operation that produces an enriched Reading table? | Affects whether Aggregation needs a join primitive | Recommend precompute. Keeps Aggregation simple; the join is its own concern. |
| Source/Related template prefix for Intersection (`{~D:Source.X~}` vs flat namespace) | API ergonomics + TabularTransform changes | Recommend flat namespace via merge before the Projection step — keeps TabularTransform unchanged. |
| Should the typed-op compiler set `SyncMode: 'Upsert'` (the default now) or expose Insert / Replace as alternatives? | Affects re-run behavior | Default Upsert. Add an `OutputMode: 'Append' | 'Replace' | 'Upsert'` setting on OperationConfig if needed. |
| Date bucketing — depend on the source field already being ISO 8601, or parse via Fable.Math? | Robustness | For demo: assume ISO. Production: parse. |
| Are typed-op result tables ever **read** by another typed op (i.e. composing a Histogram of an Aggregation)? | Architecture — composability | PLAN.md implies yes ("composes one or more operations"). Don't block on this; the dashboard layer composes. Each op is single-source. |

---

## 7 · Files / commits to read first (in order)

1. [`PLAN.md`](../PLAN.md) — the full vision; read §"The four operations" carefully.
2. [`examples/sample-operation.json`](../examples/sample-operation.json) — the canonical 5-node Pull→Map→Comprehend→Write graph shape.
3. [`examples/bookstore-sync.json`](../examples/bookstore-sync.json) — high-level mapping intent doc (different shape than OperationConfig but same spirit).
4. [`source/services/DataMapper-ConnectionBridge.js`](../source/services/DataMapper-ConnectionBridge.js) — the bridge with `_compileMappingToOperation` and `/mapper/uv/run-mapping/:id`. The new compilers slot in next to it.
5. [`source/services/DataMapper-BeaconProvider.js`](../source/services/DataMapper-BeaconProvider.js) — where new beacon actions get registered. `WriteRecords` is the most complex existing action; new ones can be simpler (no MeadowProxy dispatch needed for transforms).
6. [`test/harness/run-harness.js`](../test/harness/run-harness.js) — the working harness that proves Pull→Map→Write end-to-end. Useful template for typed-op test scripts.
7. [`docs/examples/bookstore/`](../../../meadow/meadow-integration/docs/examples/bookstore/) inside meadow-integration — has `mapping_books_BookAuthorJoin.json` showing the canonical combinatorial GUID pattern for join entities.
8. memory: [`project_retold_data_mapper_vision.md`](../../../../.claude/projects/-Users-steven-Code/memory/project_retold_data_mapper_vision.md) — the architectural premise.

---

## 8 · Out of scope for Phase 2b

- `pict-section-dashboard` — Phase 3.
- Customer portal host — Phase 3.
- Multi-source operations (e.g. Aggregation that pulls from
  multiple beacons in parallel). Single-source for now.
- Operation versioning / A-B testing.
- Real-time / streaming operations. All cached views are
  recomputed on schedule or on-demand.
