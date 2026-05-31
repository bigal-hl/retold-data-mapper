# Retold Data Mapper

Retold Data Mapper is a standalone **beacon-server** for cross-beacon schema mapping and data synchronization across the Ultravisor mesh. It is built in the same family as [retold-databeacon](https://fable-retold.github.io/retold-databeacon/) and retold-facto: it runs its own Orator HTTP server on its own port, serves a web UI, exposes a REST API, keeps its own state in an internal SQLite database, and connects to any Ultravisor as a beacon.

Its job is to take records from one beacon entity, transform them with a declarative mapping configuration, and write them into a target beacon entity -- all without ever touching a database directly. Every read and write is dispatched as an Ultravisor work item through [fable-ultravisor-client](https://fable-retold.github.io/fable-ultravisor-client/).

## What it does

When you save a mapping in the Data Mapper, it records which source beacon and entity to read from, which target beacon and entity to write to, and a `MappingConfiguration` describing how source fields become target fields. To run the sync, the Data Mapper **compiles** that mapping into an Ultravisor operation graph and triggers it. The graph's nodes call back into the Data Mapper's own beacon capabilities to pull, map, comprehend, and write the records:

```
Pull → Map → Comprehend → Write
```

Because the Data Mapper is itself a beacon, those four steps run as ordinary mesh work items. The source read and the target write are dispatched onward to the relevant databeacons, so the Data Mapper never needs network access to the underlying databases.

## Core ideas

### Beacon-server, not a CLI batch tool

The shipped binary is a long-running server. The `serve` command starts the Orator server, the web UI, and the REST API; the `init` command creates the internal SQLite schema. There is no one-shot "run this mapping file and exit" mode -- mappings are stored in the internal database and executed through the REST API or web UI while the server runs.

### Everything goes through the mesh

The Data Mapper holds no database drivers for your source and target data. It dispatches `DataBeaconAccess`, `DataBeaconManagement`, and `MeadowProxy` work items to other beacons via the Ultravisor. This is why the server must be connected to an Ultravisor before any sync can run.

### Mappings compile to operation graphs

A saved mapping is intent. At run time the Data Mapper's bridge compiles it into an Ultravisor `Operation` (a node graph), registers it on the Ultravisor, and triggers it. The Ultravisor owns execution and returns a run manifest summarizing what happened.

## Current state

This is an actively evolving module. Here is an honest breakdown of what ships today versus what is work-in-progress.

**Shipped and working:**

- The `serve` and `init` CLI commands (`bin/retold-data-mapper.js`).
- The Orator server, internal SQLite store, and Meadow CRUD endpoints.
- The REST API under `/mapper/*` (see [REST API](rest-api.md)), including the sync-execution routes `POST /mapper/uv/run-mapping/:id`, `POST /mapper/uv/run-operation/:id`, and `POST /mapper/uv/run-chain/:idOrHash`.
- Beacon registration with three capabilities -- `DataMapperSource`, `DataMapperRecords`, and `DataMapperTransform` (see [Beacon Capabilities](beacon-capabilities.md)).
- The `MappingConfiguration` format consumed by the compiler (see [Mapping Configuration](mapping-configuration.md)).

**Present but evolving:**

- The **web UI** is in transition. It is served as static files from `source/services/web-app/web/` and is a mix of a compiled Pict application bundle (the visual mapper at `/`) and several plain multi-page HTML shells (`/mappings.html`, `/operations.html`, `/dashboards.html`, `/cached-views.html`) wired together by a vanilla navigation bar. Treat the visual editor as a work-in-progress front end over the REST API, not a finished product.

**Roadmap / partial:**

- The **typed Phase-2b operations** (Extraction, Aggregation, Histogram, Intersection) are wired as beacon capability handlers and have compilers in the bridge, driven by an `OperationConfig` record stored on a separate `configs-databeacon`. They are functional in the codebase but depend on additional mesh plumbing (the configs beacon, lake target tables) that is part of the larger data-platform effort. See [Beacon Capabilities](beacon-capabilities.md) for what is wired and what to treat as roadmap.

## Documentation

- [Quick Start](quickstart.md) -- install, initialize, serve, and connect to the mesh.
- [Architecture](architecture.md) -- the beacon-server model, the services, and the Pull → Map → Comprehend → Write pipeline.
- [REST API](rest-api.md) -- the routes the server mounts under `/mapper/*`.
- [Beacon Capabilities](beacon-capabilities.md) -- the capabilities and actions advertised on the mesh.
- [Mapping Configuration](mapping-configuration.md) -- the mapping format the compiler consumes.

## Related Modules

- [fable-ultravisor-client](https://fable-retold.github.io/fable-ultravisor-client/) -- mesh dispatch client used for every cross-beacon work item.
- [retold-databeacon](https://fable-retold.github.io/retold-databeacon/) -- the sibling beacon-server that exposes source and target databases.
- [ultravisor](https://stevenvelozo.github.io/ultravisor/) -- the orchestration engine that runs the compiled operation graphs.
- [meadow-integration](https://fable-retold.github.io/meadow-integration/) -- supplies the `TabularTransform` and comprehension/upsert machinery the mapping pipeline uses.
