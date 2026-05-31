# Retold Data Mapper

> A standalone beacon-server for cross-beacon schema mapping and data sync over the Ultravisor mesh

- Map fields between databeacon entities and run the sync as an Ultravisor operation
- Dispatches every database read and write through the mesh -- never touches a database directly
- Registers DataMapper capabilities on any Ultravisor as a beacon
- Runs its own Orator server, web UI, and REST API on its own port

[Get Started](README.md)
[GitHub](https://github.com/fable-retold/retold-data-mapper)
