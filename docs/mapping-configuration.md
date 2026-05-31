# Mapping Configuration

A `MappingConfiguration` describes how a batch of source records becomes target records. It is the payload the `MapRecords` capability applies (and what `POST /mapper/uv/run-mapping/:id` compiles into the mapping pipeline). The format is meadow-integration's tabular-transform shape, **not** the older entity-mapping format that appears in the repository's `examples/` and `README`.

## Where it lives

A `MappingConfiguration` is one field on a stored `MappingConfig` row. The row also records the routing -- which beacons, connections, and entities the sync moves data between:

```json
{
	"Name": "Demographics → City",
	"SourceBeaconName": "demographics-beacon",
	"SourceConnectionHash": "demographics",
	"SourceEntity": "Demographics",
	"TargetBeaconName": "lake-beacon",
	"TargetConnectionHash": "city-lake",
	"TargetEntity": "City",
	"MappingConfiguration": { }
}
```

The `MappingConfiguration` itself is concerned only with shaping each record; the surrounding fields handle where records come from and go to.

## The format

```json
{
	"Entity": "City",
	"GUIDName": "GUIDCity",
	"GUIDTemplate": "City_{~PascalCaseIdentifier:Record.CityName~}_{~D:Record.StateCode~}",
	"Mappings": {
		"CityName": "{~D:Record.CityName~}",
		"StateCode": "{~D:Record.StateCode~}",
		"Region": "{~D:Record.Region~}",
		"Population": "{~D:Record.Population~}"
	},
	"Solvers": []
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `Entity` | yes | The target entity name. Also used as the comprehension key in the pipeline. |
| `GUIDName` | recommended | The name of the GUID/identity column on the target record (for example `GUIDCity`). Defaults to `"GUID" + Entity` when omitted. |
| `GUIDTemplate` | recommended | A template that produces a deterministic GUID per record. Determinism is what lets reruns upsert the same row instead of duplicating it. |
| `Mappings` | yes | An object whose keys are target field names and whose values are expressions producing the value (most commonly a `{~D:Record.Field~}` reference). |
| `Solvers` | no | An array of derived-value solver expressions evaluated by `TabularTransform`. Optional; omit or leave empty when not needed. |

## Expressions

The expression values are resolved by meadow-integration's `TabularTransform` (when the Data Mapper runs under a full Pict instance) at mapping time -- they are **not** resolved by the Ultravisor's settings resolver. The two forms you will use most:

- **Data substitution** -- `{~D:Record.FieldName~}` pulls the named field from the current source record. This is the workhorse of both `Mappings` values and `GUIDTemplate`.
- **Normalized identifier** -- `{~PascalCaseIdentifier:Record.FieldName~}` is used inside `GUIDTemplate` to fold a free-text field (such as a city name) into a stable identifier fragment, so that minor casing differences still produce the same GUID.

A mapping value that is not a recognized template expression is treated as a literal. This is how the harness sets constant columns, for example `"HasDemographicData": "1"`.

> A note on the lightweight fallback: when the Data Mapper is running without Pict's `parseTemplate` available, `MapRecords` falls back to a regex mapper that understands `{~D:Record.Field~}`, plain field names, and literals -- but not the full solver/expression grammar. The compiled `run-mapping` pipeline runs under Pict, so the full `TabularTransform` path applies there.

## Worked examples

These are the mappings the module's own test harness uses (`test/harness/mappings/`), which are the canonical reference for the current format.

### Simple field copy with a deterministic GUID

```json
{
	"Entity": "City",
	"GUIDName": "GUIDCity",
	"GUIDTemplate": "City_{~PascalCaseIdentifier:Record.CityName~}_{~D:Record.StateCode~}",
	"Mappings": {
		"CityName": "{~D:Record.CityName~}",
		"StateCode": "{~D:Record.StateCode~}",
		"Region": "{~D:Record.Region~}",
		"Population": "{~D:Record.Population~}",
		"AreaSqMiles": "{~D:Record.AreaSqMiles~}",
		"PopDensity": "{~D:Record.PopDensity~}",
		"FoundedYear": "{~D:Record.FoundedYear~}",
		"MedianIncome": "{~D:Record.MedianIncome~}"
	}
}
```

### Field copy plus literal/constant columns

Here several target columns are set to constants while the GUID is built to match the `City` entity's naming, so the two can be correlated downstream:

```json
{
	"Entity": "CityMetadata",
	"GUIDName": "GUIDCityMetadata",
	"GUIDTemplate": "CM_{~PascalCaseIdentifier:Record.CityName~}_{~D:Record.StateCode~}",
	"Mappings": {
		"CityName": "{~D:Record.CityName~}",
		"StateCode": "{~D:Record.StateCode~}",
		"HasWeatherData": "0",
		"HasDemographicData": "1",
		"HasTransitData": "0",
		"SourceCount": "1",
		"DataQualityScore": "3.3"
	}
}
```

## How GUIDs drive deduplication

The `GUIDTemplate` is resolved per record and written to the `GUIDName` column. In the pipeline, `BuildComprehension` keys records by that GUID, so two source records that resolve to the same GUID collapse into one entry. On write, meadow-endpoints `Upserts` uses that GUID as the upsert key, so rerunning a mapping updates existing rows rather than inserting duplicates. Designing a `GUIDTemplate` that is stable across runs and unique per logical entity is therefore the most important modeling decision in a mapping. See the [GUID comprehension pattern](https://fable-retold.github.io/meadow-integration/) in meadow-integration for the deeper treatment of deterministic GUIDs, multi-entity splits, and cross-entity linking via `Solvers`.

## Typed operations use a different config

The typed Phase-2b operations (Extraction, Aggregation, Histogram, Intersection) do **not** use `MappingConfiguration`. They are configured by an `OperationConfig` record with an `OperationConfiguration` blob whose shape depends on `OperationType` -- for example `{ GroupBy, Aggregates, GUIDTemplate }` for an aggregation, or `{ JoinOn, OrderBy, Limit, Projection }` for an intersection. Those records live on the `configs-databeacon` and are run via `POST /mapper/uv/run-operation/:id`. See [Beacon Capabilities](beacon-capabilities.md) for the per-action settings.
