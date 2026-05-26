# retold-data-mapper

> **[&#9654; Read the Retold-Data-Mapper Documentation](https://fable-retold.github.io/retold-data-mapper/)** &mdash; interactive docs with the full API reference.

Cross-beacon schema mapping and data sync. Discovers remote databeacons on the Ultravisor mesh, introspects their schemas, validates a declarative field mapping config, and executes batch syncs — all without direct database access.

## Quick start

```bash
npm install
retold-data-mapper --config mapping.json --dry-run   # validate, report plan
retold-data-mapper --config mapping.json --run       # execute sync
```

See [examples/bookstore-sync.json](examples/bookstore-sync.json) for the mapping config format.

## Try it yourself (dev-server)

`npm run dev` boots a mini Ultravisor mesh so you can click through a real mapping end-to-end. It starts three things in-process:

| Service | URL | Purpose |
|---|---|---|
| Ultravisor | http://localhost:18422/ | Work dispatch coordinator |
| Source DataBeacon | http://localhost:18390/ | Reads from your source DB |
| Target DataBeacon | http://localhost:18391/ | Writes to your target DB |

Both beacons auto-register with the Ultravisor and routing is pinned to names `source-beacon` / `target-beacon`.

```bash
npm install
npm run dev
```

Then, in your browser:

**Step 1 — Configure the source beacon** (http://localhost:18390/)
1. Click **Connections** → **+ New Connection**
2. Pick a DB type (MSSQL / PostgreSQL / MySQL / SQLite / …), fill in config
3. Click **Test Connection** → **Save** → **Connect**
4. Click **Introspect** to discover tables
5. For each table you want to read, click **Enable Endpoints**
6. Note the **connection ID** (shown in the UI) and the **URL slug** of the connection name — e.g. a connection named `"Bookstore MSSQL"` becomes `bookstore-mssql`

**Step 2 — Configure the target beacon** (http://localhost:18391/)

Same flow. Important: the target table(s) must already exist in the target database — the mapper does NOT create schema in v1. Create the table with whatever columns your mapping needs, then introspect and enable endpoints.

**Step 3 — Write a mapping config**

Copy [examples/bookstore-sync.json](examples/bookstore-sync.json) and edit. The key fields you MUST get right:

```json
{
  "Ultravisor": { "URL": "http://localhost:18422", "UserName": "retold", "Password": "" },
  "Source": {
    "BeaconName":         "source-beacon",          ← fixed, see dev-server output
    "ConnectionHash":     "bookstore-mssql",        ← URL slug of your Source connection Name
    "IDBeaconConnection": 1                          ← the numeric ID from the Source beacon UI
  },
  "Target": {
    "BeaconName":         "target-beacon",
    "ConnectionHash":     "analytics-pg",
    "IDBeaconConnection": 1
  },
  "EntityMappings": [ /* SourceEntity → TargetEntity + field mappings */ ]
}
```

**Step 4 — Run the mapper** (in another terminal)

```bash
# Dry-run first: validates the config against the live introspected schemas
./bin/retold-data-mapper.js --config my-mapping.json --dry-run

# Then execute
./bin/retold-data-mapper.js --config my-mapping.json --run --verbose
```

**Step 5 — Verify**: query your target DB directly, or hit the target beacon's endpoint:

```bash
curl http://localhost:18391/1.0/<your-target-slug>/<YourEntityPlural>/0/10
```

Press **Ctrl-C** in the dev-server terminal to stop everything. The beacon SQLite files under `data/` are regenerated on each `npm run dev`.

### Known limitations you'll hit

1. **Both beacons using the same external DB engine type.** Meadow's DAL registers providers globally on the fable (e.g. `fable.MeadowSQLiteProvider`), so a beacon running internal SQLite metadata + an external SQLite for dynamic endpoints stomps on its own internal DAL. In practice: pick *different* engines for the two beacons' external connections (e.g. MSSQL source + PostgreSQL target), OR use a non-SQLite internal store.

2. **Writes via dynamic endpoints.** The `meadow-endpoints` Create operation previously crashed on `this.DAL.jsonSchema` being undefined for dynamically-introspected DALs. Fixed upstream at [meadow-endpoints/source/endpoints/create/Meadow-Operation-Create.js:22](../../../meadow/meadow-endpoints/source/endpoints/create/Meadow-Operation-Create.js) with a null-guard; the same patch is applied in `node_modules/` here. `npm rebuild` or reinstall would lose the vendored copy — rerun `cp .../meadow-endpoints/source/endpoints/create/Meadow-Operation-Create.js node_modules/...` if needed, or publish the fix.

3. **Ultravisor routing.** `AffinityKey` is sticky-after-first-claim, not name-based routing. The dev-server pre-seeds bindings at boot so `source-beacon` / `target-beacon` actually land on the right beacon. In a production mesh with one beacon per role this isn't an issue.

## How to verify it works (automated)

There are three levels of verification, from fastest to most thorough.

### 1. Unit tests (mocked mesh)

20 tests covering validator, sync engine (InsertOnly / Upsert / error recovery / pagination), reporter, and discovery:

```bash
npm test
```

### 2. Integration smoke test (no live infra)

Exercises the full pipeline in dry-run mode — skips gracefully if the Ultravisor env isn't up:

```bash
npx mocha test/DataMapper-Integration_tests.js -u tdd --exit
```

### 3. End-to-end harness (real mesh, real databases)

Boots an Ultravisor + two DataBeacons in-process, connects one to MSSQL (meadow-mssql-test) and the other to PostgreSQL (meadow-postgresql-test), and proves 20 `Book` records flow through the mesh into a renamed-schema `MappedBook`.

**Prerequisites:**

```bash
# MSSQL: source — meadow's bookstore fixture on port 31433
cd ../../meadow/meadow && ./scripts/mssql-test-db.sh start

# PostgreSQL: target — on port 35432 (from meadow-connection-mssql or meadow-harness)
docker ps | grep meadow-postgresql-test   # must be running

# Pre-create the target table once (idempotent)
docker exec meadow-postgresql-test psql -U postgres -d bookstore -c "CREATE TABLE IF NOT EXISTS \"MappedBook\" (
  \"IDMappedBook\" SERIAL PRIMARY KEY,
  \"GUIDMappedBook\" VARCHAR(36),
  \"CreateDate\" TIMESTAMP, \"CreatingIDUser\" INTEGER DEFAULT 0,
  \"UpdateDate\" TIMESTAMP, \"UpdatingIDUser\" INTEGER DEFAULT 0,
  \"Deleted\" SMALLINT DEFAULT 0, \"DeleteDate\" TIMESTAMP, \"DeletingIDUser\" INTEGER DEFAULT 0,
  \"BookTitle\" VARCHAR(500), \"BookISBN\" VARCHAR(64),
  \"BookGenre\" VARCHAR(128), \"BookLanguage\" VARCHAR(32), \"BookYear\" INTEGER
);"
```

**Run:**

```bash
npm install
docker exec meadow-postgresql-test psql -U postgres -d bookstore -c 'TRUNCATE TABLE "MappedBook";'
node test/integration-harness.js
```

**Expected output (tail):**

```
[7/7] Running mapper (SYNC)...
  Batch at offset 0: 10 records
  Batch at offset 10: 10 records
=== Retold DataMapper: integration-test-sync ===
  Book → MappedBook: 20 synced | 0 errors | 0 skipped (0.1s)
Total: 20 synced | 0 errors | 0 skipped
── Verification ──────────────────────────────────
Target MappedBook records (via beacon HTTP): 20
Sample: IDMappedBook=21, BookTitle="The Hunger Games", BookISBN=439023483, BookYear=2008
✓ Integration test PASSED — data synced through the mesh.
  Source: MSSQL Book (bookstore@127.0.0.1:31433) via source-beacon
  Target: PostgreSQL MappedBook via target-beacon
  Transport: 20 records routed through Ultravisor:18422
```

**Verify independently:**

```bash
docker exec meadow-postgresql-test psql -U postgres -d bookstore \
  -c 'SELECT "IDMappedBook", "BookTitle", "BookISBN", "BookYear" FROM "MappedBook" ORDER BY "IDMappedBook" LIMIT 5;'
```

### What the harness exercises

| Step | Component | Proof |
|---|---|---|
| 1 | Ultravisor boot | `ultravisor` module initializes in-process, API server starts |
| 2 | DataBeacon boot × 2 | Both beacons instantiate with full endpoint suite |
| 3 | Beacon registration | Both appear in `/Beacon/Capabilities` with `BeaconCount: 2` |
| 4 | MSSQL source connection | `POST /beacon/connection` + introspect finds 6 bookstore tables |
| 5 | PostgreSQL target connection | `POST /beacon/connection` + introspect finds MappedBook |
| 6 | Mesh introspection (source) | `DataBeaconManagement:Introspect` dispatched via Ultravisor, full column details returned |
| 7 | Mesh introspection (target) | Same but on the other beacon — proves routing isolation |
| 8 | Validator | All 5 field mappings validate against live introspected schemas |
| 9 | Dry run | Validation-only path completes cleanly |
| 10 | Sync engine (paginated) | Book records read in 2 batches of 10 |
| 11 | Mesh writes | 20 records POSTed via `MeadowProxy:Request` through target beacon |
| 12 | Post-sync query | PostgreSQL returns 20 rows with transformed field names |

## Findings from running the harness

Two ecosystem issues surfaced while building the harness. Both have workarounds applied in the harness / in `node_modules`; upstream fixes would help.

1. **Ultravisor routing by name isn't supported.** `AffinityKey` provides sticky routing after the first dispatch, but when two beacons register the same capabilities, the first dispatch wins the race. The harness pre-seeds `_AffinityBindings` to pin routing per-beacon. In production, beacons with distinct roles should expose distinct capability namespaces (e.g. `DataBeaconAccess:Source` vs `DataBeaconAccess:Target`) to avoid this.

2. **Meadow DAL provider collision on same-type connections.** A DataBeacon running internal SQLite metadata + an external SQLite endpoint stomps on `fable.MeadowSQLiteProvider` when dynamic endpoints are enabled. The harness avoids this by using PostgreSQL for the external connection. Same-type layering would need a per-connection provider key.

3. **meadow-endpoints Create assumes `this.DAL.jsonSchema`.** Dynamic endpoints built from introspected columns don't populate `jsonSchema.properties`, causing a `TypeError` on the first POST. The harness patches `node_modules/meadow-endpoints/source/endpoints/create/Meadow-Operation-Create.js:22` to null-guard the check.

## Architecture

```
retold-data-mapper (CLI)
│
├─ fable-ultravisor-client ────▶ Ultravisor (NOC)
│     │                                │
│     │  DataBeaconManagement:Introspect (schemas + columns)
│     │  MeadowProxy:Request GET       (paginated reads from source)
│     │  MeadowProxy:Request POST/PUT  (writes to target)
│     │                                │
│     ├── AffinityKey: source-beacon ──┤── DataBeacon-A → MSSQL
│     └── AffinityKey: target-beacon ──┘── DataBeacon-B → PostgreSQL
│
├─ Mapping config (JSON)
│     SourceEntity.Fields.Source ──▶ TargetEntity.Fields.Target
│
└─ CLI summary: "Synced 20 records | 0 errors | 0 skipped"
```

The mapper never touches a database directly. All CRUD is relayed through `MeadowProxy:Request` work items over the Ultravisor mesh.

## Module layout

```
retold-data-mapper/
├── bin/retold-data-mapper.js           ← CLI entry
├── source/
│   ├── Retold-DataMapper.js            ← Main fable service
│   └── services/
│       ├── DataMapper-Discovery.js     ← Mesh introspection + cache
│       ├── DataMapper-Validator.js     ← Config ↔ schema validation
│       ├── DataMapper-SyncEngine.js    ← Read/transform/write loop
│       └── DataMapper-Reporter.js      ← Per-entity stats + summary
├── test/
│   ├── DataMapper_tests.js             ← 20 unit tests (mocked mesh)
│   ├── DataMapper-Integration_tests.js ← Dry-run smoke test
│   └── integration-harness.js          ← Full end-to-end harness
├── examples/bookstore-sync.json        ← Mapping config example
└── package.json
```

## Mapping config format

```json
{
  "Name": "acme-to-beta-bookstore-sync",
  "Ultravisor": { "URL": "http://ultravisor.noc:54321", "UserName": "mapper", "Password": "" },
  "Source": { "BeaconName": "customer-acme", "ConnectionHash": "bookstore-mssql", "IDBeaconConnection": 1 },
  "Target": { "BeaconName": "customer-beta", "ConnectionHash": "analytics-pg",  "IDBeaconConnection": 1 },
  "EntityMappings": [
    {
      "SourceEntity": "Book",
      "TargetEntity": "Publication",
      "IdentityMapping": { "Source": "ISBN", "Target": "ProductCode" },
      "SyncMode": "Upsert",
      "Fields": [
        { "Source": "Title", "Target": "Name" },
        { "Source": "ISBN",  "Target": "ProductCode" }
      ]
    }
  ],
  "Options": { "BatchSize": 100, "ContinueOnError": true }
}
```

- **`SyncMode`** — `Upsert` (match by identity, update or create), `InsertOnly` (create all, skip duplicates), `Replace` (wipe + reinsert, v2).
- **`IdentityMapping`** — how to match existing records on the target for Upsert.
- **`Fields`** — explicit source → target mappings. Unmapped fields are ignored.

## License

MIT
