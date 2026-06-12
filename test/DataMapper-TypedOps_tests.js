/**
 * Retold Data Mapper — Typed Operations Test Suite
 *
 * Unit tests for the four Phase 2b typed-transform beacon actions
 * (ExtractRecords / AggregateRecords / HistogramRecords /
 * IntersectRecords). Drives the action handlers in isolation —
 * no UV, no MeadowProxy, no real beacon. The action provider is
 * registered against a stub beacon-service that captures the
 * Handler functions so each test can invoke them directly with
 * a synthetic Settings object.
 *
 * Tests cover, table-driven where it pays:
 *   - Empty input
 *   - Single-row input
 *   - Mixed-type numeric coercion (postgres returns Decimal as
 *     strings via meadow REST — the actions need to handle that)
 *   - Date-bucket boundaries (DateMonth / DateDay / DateYear,
 *     ISO 8601 + edge dates)
 *   - GroupBy stability (deterministic group-key encoding)
 *   - OrderBy stability (multi-key, ASC + DESC, null handling)
 *   - Limit semantics (Limit=1 enrichment, Limit=N truncation)
 *   - Missing-key behavior (rows without the JoinOn / GroupBy /
 *     BucketColumn key get filtered out, not crashed on)
 *   - GUIDTemplate substitution (incl. char sanitization)
 *
 * @author Steven Velozo <steven@velozo.com>
 */
const libAssert = require('assert');
const libFable = require('fable');
const libBeaconProvider = require('../source/services/DataMapper-BeaconProvider.js');

// ================================================================
// Stub beacon-service: captures the Handler functions registered
// via pBeaconService.registerCapability so the tests can drive
// them directly without spinning up an Ultravisor.
// ================================================================

function captureHandlers()
{
	let tmpHandlers = {};
	let tmpStubBeacon =
	{
		registerCapability: function (pSpec)
		{
			let tmpKeys = Object.keys(pSpec.actions || {});
			for (let i = 0; i < tmpKeys.length; i++)
			{
				tmpHandlers[pSpec.Capability + ':' + tmpKeys[i]] = pSpec.actions[tmpKeys[i]];
			}
		}
	};

	let tmpFable = new libFable();
	let tmpProvider = tmpFable.serviceManager.addServiceTypeIfNotExists
		? null
		: null;
	tmpFable.serviceManager.addServiceType('DataMapperBeaconProvider', libBeaconProvider);
	tmpProvider = tmpFable.serviceManager.instantiateServiceProvider('DataMapperBeaconProvider');
	tmpProvider.registerCapabilities(tmpStubBeacon);
	return { fable: tmpFable, provider: tmpProvider, handlers: tmpHandlers };
}

// Sync invocation wrapper: handlers are async-style with a
// callback, but for in-memory transforms the callback always
// fires synchronously, so we can return its captured value.
//
// The handlers ship Result (stringified) but no longer ship
// Records (the unstringified array) — the WS payload at 100K-
// row scale was breaching the keep-alive budget when both were
// serialized. The test wrapper re-hydrates Records from Result
// for assertion convenience.
function invoke(pHandler, pSettings)
{
	let tmpResult = null;
	let tmpErr = null;
	pHandler.Handler({ Settings: pSettings || {} }, {}, (e, r) => { tmpErr = e; tmpResult = r; });
	if (tmpErr) throw tmpErr;
	let tmpOut = (tmpResult && tmpResult.Outputs) || {};
	if (tmpOut.Records === undefined && typeof tmpOut.Result === 'string')
	{
		try { tmpOut.Records = JSON.parse(tmpOut.Result); } catch (e) { tmpOut.Records = []; }
	}
	return tmpOut;
}

// Variant that catches the error thrown by the row-count guard
// (the guard fHandlerCallbacks an Error rather than a result).
function invokeExpectError(pHandler, pSettings)
{
	let tmpResult = null;
	let tmpErr = null;
	pHandler.Handler({ Settings: pSettings || {} }, {}, (e, r) => { tmpErr = e; tmpResult = r; });
	return tmpErr;
}

// ================================================================
// Tests
// ================================================================

suite
(
	'Phase 2b — Typed Operation beacon actions',
	function ()
	{
		let _ctx = null;
		suiteSetup
		(
			function ()
			{
				_ctx = captureHandlers();
			}
		);

		// ============================================================
		// ExtractRecords
		// ============================================================
		suite
		(
			'ExtractRecords',
			function ()
			{
				test
				(
					'Empty input returns empty Records',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:ExtractRecords'],
							{ Records: [], OperationConfiguration: { Entity: 'X', Projection: { A: '{~D:Record.A~}' } } });
						libAssert.strictEqual(tmpOut.RecordCount, 0);
						libAssert.strictEqual(tmpOut.FilteredOutCount, 0);
						libAssert.strictEqual(Array.isArray(tmpOut.Records), true);
					}
				);

				test
				(
					'Filter equality drops non-matching rows',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:ExtractRecords'],
							{ Records: [{ A: 1, Active: true }, { A: 2, Active: false }, { A: 3, Active: true }],
							  OperationConfiguration:
							  {
								Entity: 'X',
								Projection: { A: '{~D:Record.A~}' },
								Filter: { Active: true }
							  } });
						libAssert.strictEqual(tmpOut.RecordCount, 2);
						libAssert.strictEqual(tmpOut.FilteredOutCount, 1);
						libAssert.deepStrictEqual(tmpOut.Records.map(r => r.A), [1, 3]);
					}
				);

				test
				(
					'Filter handles string/number parity (1 matches "1")',
					function ()
					{
						// Postgres can return numerics as strings via meadow REST,
						// so equality has to fall through to string-compare. This
						// is the same coercion AggregateRecords does.
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:ExtractRecords'],
							{ Records: [{ Active: 1 }, { Active: '1' }, { Active: 0 }],
							  OperationConfiguration:
							  {
								Entity: 'X',
								Projection: { A: '{~D:Record.Active~}' },
								Filter: { Active: 1 }
							  } });
						libAssert.strictEqual(tmpOut.RecordCount, 2);
						libAssert.strictEqual(tmpOut.FilteredOutCount, 1);
					}
				);

				test
				(
					'Projection resolves {~D:Record.X~} templates',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:ExtractRecords'],
							{ Records: [{ FirstName: 'Ada', LastName: 'Lovelace' }],
							  OperationConfiguration:
							  {
								Entity: 'X',
								Projection:
								{
									Given:  '{~D:Record.FirstName~}',
									Family: '{~D:Record.LastName~}',
									Static: 'literal'
								}
							  } });
						libAssert.strictEqual(tmpOut.Records[0].Given, 'Ada');
						libAssert.strictEqual(tmpOut.Records[0].Family, 'Lovelace');
						libAssert.strictEqual(tmpOut.Records[0].Static, 'literal');
					}
				);

				test
				(
					'GUIDTemplate substitutes source row value',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:ExtractRecords'],
							{ Records: [{ IDX: 42 }, { IDX: 7 }],
							  OperationConfiguration:
							  {
								Entity: 'Y',
								GUIDName: 'GUIDY',
								GUIDTemplate: 'PFX_{~D:Record.IDX~}',
								Projection: { N: '{~D:Record.IDX~}' }
							  } });
						libAssert.strictEqual(tmpOut.Records[0].GUIDY, 'PFX_42');
						libAssert.strictEqual(tmpOut.Records[1].GUIDY, 'PFX_7');
					}
				);

				test
				(
					'Missing template field renders empty (does not throw)',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:ExtractRecords'],
							{ Records: [{ A: 1 }],
							  OperationConfiguration:
							  {
								Entity: 'Z',
								GUIDName: 'GUIDZ',
								GUIDTemplate: 'P_{~D:Record.NotPresent~}',
								Projection: { K: '{~D:Record.A~}' }
							  } });
						libAssert.strictEqual(tmpOut.Records[0].GUIDZ, 'P_');
					}
				);
			}
		);

		// ============================================================
		// AggregateRecords
		// ============================================================
		suite
		(
			'AggregateRecords',
			function ()
			{
				test
				(
					'Empty input returns empty groups',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:AggregateRecords'],
							{ Records: [],
							  OperationConfiguration: { Entity: 'X', GroupBy: ['A'], Aggregates: [{ Source: 'V', Function: 'Sum', As: 'Total' }] } });
						libAssert.strictEqual(tmpOut.GroupCount, 0);
					}
				);

				test
				(
					'CollectDistinct / CountDistinct build provenance columns (IDDocuments)',
					function ()
					{
						let tmpRecs = [
							{ Day: 'D1', IDDocument: 900 }, { Day: 'D1', IDDocument: 901 }, { Day: 'D1', IDDocument: 900 },
							{ Day: 'D2', IDDocument: 903 }
						];
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:AggregateRecords'],
							{ Records: tmpRecs,
							  OperationConfiguration:
							  {
								Entity: 'X', GroupBy: ['Day'],
								Aggregates: [
									{ Source: 'IDDocument', Function: 'CollectDistinct', As: 'IDDocuments' },
									{ Source: 'IDDocument', Function: 'CountDistinct',   As: 'IDDocumentCount' }
								]
							  } });
						let tmpD1 = tmpOut.Records.find(r => r.Day === 'D1');
						libAssert.strictEqual(tmpD1.IDDocuments, '900,901', 'distinct CSV, first-seen order');
						libAssert.strictEqual(tmpD1.IDDocumentCount, 2);
						let tmpD2 = tmpOut.Records.find(r => r.Day === 'D2');
						libAssert.strictEqual(tmpD2.IDDocuments, '903');
						libAssert.strictEqual(tmpD2.IDDocumentCount, 1);
					}
				);

				test
				(
					'Sum / Count / Mean / Min / Max compute correctly per group',
					function ()
					{
						let tmpRecs = [
							{ Group: 'A', V: 10 }, { Group: 'A', V: 20 }, { Group: 'A', V: 30 },
							{ Group: 'B', V: 5 },  { Group: 'B', V: 15 }
						];
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:AggregateRecords'],
							{ Records: tmpRecs,
							  OperationConfiguration:
							  {
								Entity: 'X', GroupBy: ['Group'],
								Aggregates: [
									{ Source: 'V', Function: 'Sum',   As: 'Total' },
									{ Source: 'V', Function: 'Count', As: 'N' },
									{ Source: 'V', Function: 'Mean',  As: 'Avg' },
									{ Source: 'V', Function: 'Min',   As: 'Lo' },
									{ Source: 'V', Function: 'Max',   As: 'Hi' },
									{ Source: '*', Function: 'Count', As: 'StarCount' }
								]
							  } });
						libAssert.strictEqual(tmpOut.GroupCount, 2);
						let tmpA = tmpOut.Records.find(r => r.Group === 'A');
						libAssert.strictEqual(tmpA.Total, 60);
						libAssert.strictEqual(tmpA.N, 3);
						libAssert.strictEqual(tmpA.Avg, 20);
						libAssert.strictEqual(tmpA.Lo, 10);
						libAssert.strictEqual(tmpA.Hi, 30);
						libAssert.strictEqual(tmpA.StarCount, 3);

						let tmpB = tmpOut.Records.find(r => r.Group === 'B');
						libAssert.strictEqual(tmpB.Total, 20);
						libAssert.strictEqual(tmpB.Avg, 10);
					}
				);

				test
				(
					'Stringified numerics (postgres meadow REST) coerce to numbers',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:AggregateRecords'],
							{ Records: [{ G: 'X', V: '12.5' }, { G: 'X', V: '7.5' }, { G: 'X', V: '10' }],
							  OperationConfiguration:
							  {
								Entity: 'A', GroupBy: ['G'],
								Aggregates: [
									{ Source: 'V', Function: 'Sum',  As: 'S' },
									{ Source: 'V', Function: 'Mean', As: 'M' }
								]
							  } });
						libAssert.strictEqual(tmpOut.Records[0].S, 30);
						libAssert.strictEqual(tmpOut.Records[0].M, 10);
					}
				);

				test
				(
					'Multi-column GroupBy keys group distinctly (no collision)',
					function ()
					{
						// JSON-encoded multi-key prevents the [A,B] vs [AB] collision class.
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:AggregateRecords'],
							{ Records: [
								{ S: 'NY', C: 'NewYork', V: 1 },
								{ S: 'NYNew', C: 'York',  V: 1 },
								{ S: 'NY', C: 'NewYork', V: 1 }
							  ],
							  OperationConfiguration:
							  {
								Entity: 'X', GroupBy: ['S', 'C'],
								Aggregates: [{ Source: '*', Function: 'Count', As: 'N' }]
							  } });
						libAssert.strictEqual(tmpOut.GroupCount, 2);
						let tmpHit = tmpOut.Records.find(r => r.S === 'NY' && r.C === 'NewYork');
						libAssert.strictEqual(tmpHit.N, 2);
					}
				);

				test
				(
					'Null and undefined values skipped from numeric aggregates (Count of * still counts the row)',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:AggregateRecords'],
							{ Records: [{ G: 'X', V: 10 }, { G: 'X', V: null }, { G: 'X' /* undefined */ }, { G: 'X', V: 20 }],
							  OperationConfiguration:
							  {
								Entity: 'X', GroupBy: ['G'],
								Aggregates: [
									{ Source: 'V', Function: 'Sum',   As: 'S' },
									{ Source: 'V', Function: 'Count', As: 'NV' },
									{ Source: '*', Function: 'Count', As: 'NRow' }
								]
							  } });
						libAssert.strictEqual(tmpOut.Records[0].S, 30);
						libAssert.strictEqual(tmpOut.Records[0].NV, 2);
						libAssert.strictEqual(tmpOut.Records[0].NRow, 4);
					}
				);

				test
				(
					'GUIDTemplate sanitizes non-alphanumeric (so combinatorial keys are GUID-safe)',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:AggregateRecords'],
							{ Records: [{ City: 'New York, NY', V: 1 }],
							  OperationConfiguration:
							  {
								Entity: 'X', GUIDName: 'GUIDX', GUIDTemplate: 'C_{~D:Record.City~}',
								GroupBy: ['City'],
								Aggregates: [{ Source: '*', Function: 'Count', As: 'N' }]
							  } });
						libAssert.strictEqual(tmpOut.Records[0].GUIDX, 'C_NewYorkNY');
					}
				);
			}
		);

		// ============================================================
		// HistogramRecords
		// ============================================================
		suite
		(
			'HistogramRecords',
			function ()
			{
				test
				(
					'DateMonth bucket trims to YYYY-MM',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:HistogramRecords'],
							{ Records: [
								{ D: '2025-01-15', V: 1 },
								{ D: '2025-01-31', V: 2 },
								{ D: '2025-02-01', V: 3 },
								{ D: '2024-12-31', V: 4 }
							  ],
							  OperationConfiguration:
							  {
								Entity: 'X', BucketColumn: 'D', BucketKind: 'DateMonth', BucketAs: 'YM',
								Aggregates: [{ Source: 'V', Function: 'Sum', As: 'S' }]
							  } });
						libAssert.strictEqual(tmpOut.BucketCount, 3);
						let byBucket = {};
						tmpOut.Records.forEach(r => { byBucket[r.YM] = r.S; });
						libAssert.strictEqual(byBucket['2024-12'], 4);
						libAssert.strictEqual(byBucket['2025-01'], 3);
						libAssert.strictEqual(byBucket['2025-02'], 3);
					}
				);

				test
				(
					'DateMonth bucket handles ISO 8601 with timestamp suffix',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:HistogramRecords'],
							{ Records: [{ D: '2025-03-15T00:00:00.000Z' }, { D: '2025-03-15T23:59:59' }],
							  OperationConfiguration:
							  {
								Entity: 'X', BucketColumn: 'D', BucketKind: 'DateMonth', BucketAs: 'YM',
								Aggregates: [{ Source: '*', Function: 'Count', As: 'N' }]
							  } });
						libAssert.strictEqual(tmpOut.BucketCount, 1);
						libAssert.strictEqual(tmpOut.Records[0].YM, '2025-03');
						libAssert.strictEqual(tmpOut.Records[0].N, 2);
					}
				);

				test
				(
					'NumericRange bucket sizes by BucketSize and emits "lo-hi" labels',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:HistogramRecords'],
							{ Records: [{ T: 5 }, { T: 9 }, { T: 10 }, { T: 19 }, { T: 100 }],
							  OperationConfiguration:
							  {
								Entity: 'X', BucketColumn: 'T', BucketKind: 'NumericRange', BucketSize: 10,
								BucketAs: 'Range',
								Aggregates: [{ Source: '*', Function: 'Count', As: 'N' }]
							  } });
						let byBucket = {};
						tmpOut.Records.forEach(r => { byBucket[r.Range] = r.N; });
						libAssert.strictEqual(byBucket['0-9'], 2);
						libAssert.strictEqual(byBucket['10-19'], 2);
						libAssert.strictEqual(byBucket['100-109'], 1);
					}
				);

				test
				(
					'Secondary GroupBy multiplies buckets',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:HistogramRecords'],
							{ Records: [
								{ D: '2025-01-15', S: 'A' },
								{ D: '2025-01-15', S: 'B' },
								{ D: '2025-02-15', S: 'A' }
							  ],
							  OperationConfiguration:
							  {
								Entity: 'X', BucketColumn: 'D', BucketKind: 'DateMonth',
								BucketAs: 'YM', GroupBy: ['S'],
								Aggregates: [{ Source: '*', Function: 'Count', As: 'N' }]
							  } });
						libAssert.strictEqual(tmpOut.BucketCount, 3);
						// Stable sort: each (bucket, group) emitted exactly once.
						libAssert.strictEqual(tmpOut.Records.length, 3);
					}
				);

				test
				(
					'Missing BucketColumn drops the row (does not throw)',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:HistogramRecords'],
							{ Records: [{ D: '2025-01-15' }, { /* no D */ }, { D: null }, { D: '' }],
							  OperationConfiguration:
							  {
								Entity: 'X', BucketColumn: 'D', BucketKind: 'DateMonth', BucketAs: 'YM',
								Aggregates: [{ Source: '*', Function: 'Count', As: 'N' }]
							  } });
						libAssert.strictEqual(tmpOut.BucketCount, 1);
						libAssert.strictEqual(tmpOut.Records[0].N, 1);
					}
				);

				test
				(
					'Output is sorted by (bucket, groupBy) for stable downstream consumers',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:HistogramRecords'],
							{ Records: [
								{ D: '2025-03-15', S: 'B' },
								{ D: '2025-01-15', S: 'A' },
								{ D: '2025-02-15', S: 'C' }
							  ],
							  OperationConfiguration:
							  {
								Entity: 'X', BucketColumn: 'D', BucketKind: 'DateMonth',
								BucketAs: 'YM', GroupBy: ['S'],
								Aggregates: [{ Source: '*', Function: 'Count', As: 'N' }]
							  } });
						let tmpKeys = tmpOut.Records.map(r => r.YM + '|' + r.S);
						let tmpSorted = tmpKeys.slice().sort();
						libAssert.deepStrictEqual(tmpKeys, tmpSorted);
					}
				);
			}
		);

		// ============================================================
		// IntersectRecords
		// ============================================================
		suite
		(
			'IntersectRecords',
			function ()
			{
				test
				(
					'Limit=1 enrichment: each source row emits exactly one merged row',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:IntersectRecords'],
							{ SourceRecords: [{ IDX: 1, A: 'a' }, { IDX: 2, A: 'b' }],
							  RelatedRecords: [
								{ IDX: 1, B: 'x' }, { IDX: 1, B: 'y' },
								{ IDX: 2, B: 'z' }, { IDX: 3, B: 'w' }
							  ],
							  OperationConfiguration:
							  {
								Entity: 'X',
								JoinOn: { SourceField: 'IDX', RelatedField: 'IDX' },
								Limit: 1,
								Projection: { A: '{~D:Record.A~}', B: '{~D:Record.B~}' }
							  } });
						libAssert.strictEqual(tmpOut.RecordCount, 2);
						libAssert.strictEqual(tmpOut.MatchedSourceCount, 2);
						libAssert.strictEqual(tmpOut.UnmatchedSourceCount, 0);
					}
				);

				test
				(
					'Source fields win on namespace collision (merge keeps source identity columns)',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:IntersectRecords'],
							{ SourceRecords: [{ IDX: 1, Tag: 'src' }],
							  RelatedRecords: [{ IDX: 1, Tag: 'rel' }],
							  OperationConfiguration:
							  {
								Entity: 'X',
								JoinOn: { SourceField: 'IDX', RelatedField: 'IDX' },
								Projection: { Tag: '{~D:Record.Tag~}' }
							  } });
						libAssert.strictEqual(tmpOut.Records[0].Tag, 'src');
					}
				);

				test
				(
					'Unmatched source rows are dropped, counted in UnmatchedSourceCount',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:IntersectRecords'],
							{ SourceRecords: [{ IDX: 1 }, { IDX: 2 }, { IDX: 99 }],
							  RelatedRecords: [{ IDX: 1, V: 'a' }, { IDX: 2, V: 'b' }],
							  OperationConfiguration:
							  {
								Entity: 'X',
								JoinOn: { SourceField: 'IDX', RelatedField: 'IDX' },
								Projection: { K: '{~D:Record.V~}' }
							  } });
						libAssert.strictEqual(tmpOut.MatchedSourceCount, 2);
						libAssert.strictEqual(tmpOut.UnmatchedSourceCount, 1);
					}
				);

				test
				(
					'OrderBy DESC sorts related, Limit=N truncates per-source',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:IntersectRecords'],
							{ SourceRecords: [{ IDX: 1 }],
							  RelatedRecords: [
								{ IDX: 1, D: '2025-01-15' },
								{ IDX: 1, D: '2025-03-15' },
								{ IDX: 1, D: '2025-02-15' },
								{ IDX: 1, D: '2025-04-15' },
								{ IDX: 1, D: '2025-05-15' }
							  ],
							  OperationConfiguration:
							  {
								Entity: 'X',
								JoinOn: { SourceField: 'IDX', RelatedField: 'IDX' },
								OrderBy: [{ Field: 'D', Direction: 'DESC' }],
								Limit: 3,
								Projection: { D: '{~D:Record.D~}' }
							  } });
						libAssert.strictEqual(tmpOut.RecordCount, 3);
						libAssert.deepStrictEqual(tmpOut.Records.map(r => r.D),
							['2025-05-15', '2025-04-15', '2025-03-15']);
					}
				);

				test
				(
					'Multi-key OrderBy resolves ties via secondary key',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:IntersectRecords'],
							{ SourceRecords: [{ IDX: 1 }],
							  RelatedRecords: [
								{ IDX: 1, A: 1, B: 'z' },
								{ IDX: 1, A: 1, B: 'a' },
								{ IDX: 1, A: 2, B: 'm' }
							  ],
							  OperationConfiguration:
							  {
								Entity: 'X',
								JoinOn: { SourceField: 'IDX', RelatedField: 'IDX' },
								OrderBy: [
									{ Field: 'A', Direction: 'ASC' },
									{ Field: 'B', Direction: 'ASC' }
								],
								Projection: { A: '{~D:Record.A~}', B: '{~D:Record.B~}' }
							  } });
						libAssert.deepStrictEqual(tmpOut.Records.map(r => r.A + '|' + r.B), ['1|a', '1|z', '2|m']);
					}
				);

				test
				(
					'Null OrderBy values sort to the end (regardless of direction)',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:IntersectRecords'],
							{ SourceRecords: [{ IDX: 1 }],
							  RelatedRecords: [
								{ IDX: 1, K: 5 },
								{ IDX: 1, K: null },
								{ IDX: 1, K: 1 }
							  ],
							  OperationConfiguration:
							  {
								Entity: 'X',
								JoinOn: { SourceField: 'IDX', RelatedField: 'IDX' },
								OrderBy: [{ Field: 'K', Direction: 'ASC' }],
								Projection: { K: '{~D:Record.K~}' }
							  } });
						// Non-null values sorted ASC, null trails (deterministic).
						let tmpKs = tmpOut.Records.map(r => r.K);
						libAssert.deepStrictEqual(tmpKs, [1, 5, null]);
					}
				);

				test
				(
					'Empty inputs return empty Records (no crash on null sides)',
					function ()
					{
						let tmpOut = invoke(_ctx.handlers['DataMapperTransform:IntersectRecords'],
							{ SourceRecords: [], RelatedRecords: [],
							  OperationConfiguration:
							  {
								Entity: 'X',
								JoinOn: { SourceField: 'A', RelatedField: 'A' },
								Projection: {}
							  } });
						libAssert.strictEqual(tmpOut.RecordCount, 0);
						libAssert.strictEqual(tmpOut.MatchedSourceCount, 0);
						libAssert.strictEqual(tmpOut.UnmatchedSourceCount, 0);
					}
				);
			}
		);

		// ============================================================
		// Row-count guard (production safety net for the in-memory path)
		// ============================================================
		suite
		(
			'Row-count guard',
			function ()
			{
				// The guard reads DATA_MAPPER_MAX_INMEMORY_ROWS at module-
				// load time, so we test against the default (250000). One
				// past the limit on each handler should fail with a clear
				// error message rather than OOM-or-truncate silently.
				let _bigCount = 250001;
				let _dummyCfg = { Entity: 'X', GroupBy: ['G'], Aggregates: [{ Source: '*', Function: 'Count', As: 'N' }] };

				test
				(
					'AggregateRecords rejects input above DATA_MAPPER_MAX_INMEMORY_ROWS',
					function ()
					{
						let tmpRecs = new Array(_bigCount).fill({ G: 'X', V: 1 });
						let tmpErr = invokeExpectError(_ctx.handlers['DataMapperTransform:AggregateRecords'],
							{ Records: tmpRecs, OperationConfiguration: _dummyCfg });
						libAssert.ok(tmpErr instanceof Error, 'expected an Error from the guard');
						libAssert.match(tmpErr.message, /AggregateRecords.*exceeds DATA_MAPPER_MAX_INMEMORY_ROWS/);
					}
				);

				test
				(
					'HistogramRecords rejects input above DATA_MAPPER_MAX_INMEMORY_ROWS',
					function ()
					{
						let tmpRecs = new Array(_bigCount).fill({ D: '2025-01-15' });
						let tmpErr = invokeExpectError(_ctx.handlers['DataMapperTransform:HistogramRecords'],
							{ Records: tmpRecs, OperationConfiguration:
								{ Entity: 'X', BucketColumn: 'D', BucketKind: 'DateMonth', BucketAs: 'YM',
								  Aggregates: [{ Source: '*', Function: 'Count', As: 'N' }] } });
						libAssert.ok(tmpErr instanceof Error);
						libAssert.match(tmpErr.message, /HistogramRecords.*exceeds DATA_MAPPER_MAX_INMEMORY_ROWS/);
					}
				);

				test
				(
					'IntersectRecords rejects when either side exceeds limit',
					function ()
					{
						let tmpRecs = new Array(_bigCount).fill({ IDX: 1 });
						let tmpErrSource = invokeExpectError(_ctx.handlers['DataMapperTransform:IntersectRecords'],
							{ SourceRecords: tmpRecs, RelatedRecords: [{ IDX: 1 }],
							  OperationConfiguration: { Entity: 'X', JoinOn: { SourceField: 'IDX', RelatedField: 'IDX' }, Projection: {} } });
						libAssert.match(tmpErrSource.message, /IntersectRecords \(Source\)/);

						let tmpErrRel = invokeExpectError(_ctx.handlers['DataMapperTransform:IntersectRecords'],
							{ SourceRecords: [{ IDX: 1 }], RelatedRecords: tmpRecs,
							  OperationConfiguration: { Entity: 'X', JoinOn: { SourceField: 'IDX', RelatedField: 'IDX' }, Projection: {} } });
						libAssert.match(tmpErrRel.message, /IntersectRecords \(Related\)/);
					}
				);

				test
				(
					'ElapsedMs is reported on every transform output',
					function ()
					{
						let tmpEx = invoke(_ctx.handlers['DataMapperTransform:ExtractRecords'],
							{ Records: [{ A: 1 }], OperationConfiguration: { Entity: 'X', Projection: { A: '{~D:Record.A~}' } } });
						let tmpAg = invoke(_ctx.handlers['DataMapperTransform:AggregateRecords'],
							{ Records: [{ G: 1, V: 1 }], OperationConfiguration: { Entity: 'X', GroupBy: ['G'],
								Aggregates: [{ Source: '*', Function: 'Count', As: 'N' }] } });
						let tmpHi = invoke(_ctx.handlers['DataMapperTransform:HistogramRecords'],
							{ Records: [{ D: '2025-01-15' }], OperationConfiguration: { Entity: 'X', BucketColumn: 'D', BucketKind: 'DateMonth',
								BucketAs: 'YM', Aggregates: [{ Source: '*', Function: 'Count', As: 'N' }] } });
						let tmpIn = invoke(_ctx.handlers['DataMapperTransform:IntersectRecords'],
							{ SourceRecords: [{ IDX: 1 }], RelatedRecords: [{ IDX: 1, V: 'a' }],
							  OperationConfiguration: { Entity: 'X', JoinOn: { SourceField: 'IDX', RelatedField: 'IDX' }, Projection: { V: '{~D:Record.V~}' } } });
						libAssert.ok(typeof tmpEx.ElapsedMs === 'number');
						libAssert.ok(typeof tmpAg.ElapsedMs === 'number');
						libAssert.ok(typeof tmpHi.ElapsedMs === 'number');
						libAssert.ok(typeof tmpIn.ElapsedMs === 'number');
					}
				);
			}
		);
	}
);
