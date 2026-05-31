# Prompt for a fresh Claude session — Phase 2b: typed operations

Paste the block below into a new Claude Code session in the
`/Users/steven/Code/retold/modules/apps/retold-data-mapper`
working directory.

---

> Pick up Phase 2b of the retold-data-mapper plan: the four typed
> operations (Extraction, Aggregation, Histogram, Intersection).
> The full plan is in [`docs/PLAN-PHASE-2B-Operation-Types.md`](PLAN-PHASE-2B-Operation-Types.md).
> Read it first. Also read [`PLAN.md`](../PLAN.md) §"The four
> operations" for the original vision and
> [`examples/sample-operation.json`](../examples/sample-operation.json)
> for the canonical UV Operation graph shape. The architectural
> premise is in user memory under
> "retold-data-mapper-vision".
>
> **State of the world coming in (don't redo any of this):**
>
> - Phase A/B/C + B-full landed in commit `8d683e9`. Run via UV is
>   working end-to-end: data-mapper compiles a stored
>   `MappingConfiguration` into a 5-node Pull→Map→Comprehension→Write
>   UV Operation, triggers it through Ultravisor's queue, returns
>   the manifest summary. Verify by clicking "▶ Run via UV" on a
>   row at http://127.0.0.1:58395/mappings.html — should still show
>   pull=50/map=50/comp=50/write=50/0 errors.
> - meadow-endpoints exposes both `/Upserts` (bare-array,
>   back-compat) and `/Upserts/Detailed` (envelope `{Counts,
>   UpsertedRecords, ErrorRecords}`) plus
>   `X-Meadow-Upsert-{Total,Succeeded,Errored}` headers on both.
> - All meadow-connection-* + migration-manager defaults bumped GUID
>   size 36 → 255. Combinatorial GUIDs no longer overflow.
> - Engine try/catches synchronous task throws; rest-request
>   stringifies bodies. Two real bugs from earlier are gone.
> - `DataBeaconSchema:EnsureSchema` is **already exposed** on every
>   retold-databeacon as a beacon action (auto-becomes UV node type
>   `beacon-databeaconschema-ensureschema`). Use this — don't
>   hand-roll SQL — when creating new lake result tables.
> - Lake currently has 50 WeatherStations + 600 WeatherReadings
>   (the source for all four typed-op demos). Schema in
>   `/tmp/lake-schema-meadow.sql` (canonical meadow-postgres shape:
>   SERIAL on IDxxx, VARCHAR(255) on GUIDxxx, UNIQUE INDEX on GUIDxxx).
>
> **Your job:**
>
> 1. Implement the four typed operations following the plan's
>    recommended order (Schema → Extraction → Aggregation →
>    Histogram → Intersection → UI → Polish). Each gets a new
>    beacon action on the data-mapper beacon, a compiler in the
>    bridge, a CRUD entry in the editor UI, and at least one demo
>    that runs end-to-end against the live weather data.
> 2. Use `DataBeaconSchema:EnsureSchema` to materialize each result
>    table (don't write CREATE TABLE SQL by hand — that path is
>    deprecated as of last session). Build the descriptor from
>    meadow's stricture conventions (see
>    `DataBeacon-SchemaManager.js` for the descriptor shape; it
>    includes `Type: 'AutoIdentity' | 'AutoGUID' | 'String' |
>    'Numeric' | 'Decimal' | 'DateTime' | 'Boolean' | ...`).
> 3. For each demo, validate per the plan's §5 — direct dispatch
>    test, end-to-end via UI, lake count + sample rows, idempotent
>    re-run, and EnsureSchema-driven table creation.
> 4. Resolve the open questions in §6 as you encounter them. The
>    biggest one is whether to bring back `OperationConfig` (was
>    retired in commit `8d683e9`) or extend `MappingConfig` with a
>    `Type` field. The plan recommends bringing OperationConfig
>    back — confirm with the user before going deep on schema work.
>
> **Working stack (already running, don't restart unless you
> change container code):**
>
> - Ultravisor at `http://127.0.0.1:54322`. UI shows Operations,
>   Schedule, Manifests, Timeline, Throughput, Beacons.
> - data-mapper at `http://127.0.0.1:58395`. Mappings page works.
> - lake-databeacon (host port may shift; resolve via
>   `docker port stack-data-platform-6ec96a-retold-databeacon-lake-1 8389`).
> - postgres lake DB: `docker exec stack-data-platform-6ec96a-postgres-1 psql -U lake -d lake -c '...'`.
> - data-mapper beacon: `docker exec stack-data-platform-6ec96a-retold-data-mapper-1 ...`.
> - When you patch a service file, `docker cp` it into the
>   container's `/app/source/...` and `docker restart` the
>   container. Don't try `docker compose up`.
>
> **Pre-existing follow-ups you may run into (not blocking, but
> worth knowing):**
>
> - TimelineAggregator buckets are missing `ByBeacon` aggregation
>   and `Completed` events lose `Capability` attribution. The
>   Beacon and Capability lanes in UV's Timeline view appear empty
>   as a result. Filing a UV PR is its own work.
> - The mapping editor's chip-insertion drops the snippet at the
>   raw caret position; if cursor is at column 0 it puts the
>   snippet before the JSON's opening `{`. Cosmetic; could be
>   smarter about finding the Mappings: { } block.
>
> **Don't:**
>
> - Don't reintroduce data-mapper-side `/run` REST handlers. UV
>   owns execution. Compile to a UV Operation and trigger via the
>   queue, like Mapping does.
> - Don't hand-roll table creation SQL anywhere. EnsureSchema.
> - Don't try to bypass MeadowProxy for cross-beacon writes —
>   MeadowProxy + AffinityKey is how the mesh routes by beacon
>   name; direct HTTP doesn't have the right hostnames.
> - Don't change response shape of existing endpoints
>   (`/Upserts`, `/mapper/uv/run-mapping/:id`, etc.) — clients
>   depend on them. Add new endpoints if you need a different
>   shape (the `/Upserts/Detailed` precedent is the right move).
>
> **First action:** read `docs/PLAN-PHASE-2B-Operation-Types.md`
> end-to-end, then propose a TodoWrite list of the first 5–8
> concrete steps you'll take and run them past the user before
> starting implementation.
