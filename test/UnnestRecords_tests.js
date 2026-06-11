/**
 * Retold Data Mapper — UnnestRecords Test Suite
 *
 * Unit tests for the DataMapperTransform:UnnestRecords typed-transform op:
 *   - the beacon action handler (explode an array-of-objects column into one
 *     record per element), driven in isolation via a stub beacon-service that
 *     captures the registered Handler (same pattern as DataMapper-TypedOps_tests.js)
 *   - the bridge compiler `_compileUnnestToOperation` (Pull → Unnest → Comprehend
 *     → Write graph)
 *   - the `_validateOperationConfiguration` case for OperationType=Unnest
 *
 * No UV, no MeadowProxy, no real beacon.
 */
const libAssert = require('assert');
const libFable = require('fable');
const libBeaconProvider = require('../source/services/DataMapper-BeaconProvider.js');
const libConnectionBridge = require('../source/services/DataMapper-ConnectionBridge.js');

// Stub beacon-service that captures the registered action handlers.
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
	tmpFable.serviceManager.addServiceType('DataMapperBeaconProvider', libBeaconProvider);
	let tmpProvider = tmpFable.serviceManager.instantiateServiceProvider('DataMapperBeaconProvider');
	tmpProvider.registerCapabilities(tmpStubBeacon);
	return { fable: tmpFable, provider: tmpProvider, handlers: tmpHandlers };
}

// Sync invoke wrapper (the in-memory handlers fire their callback synchronously).
function invoke(pHandler, pSettings)
{
	let tmpResult = null;
	let tmpErr = null;
	pHandler.Handler({ Settings: pSettings || {} }, {}, (e, r) => { tmpErr = e; tmpResult = r; });
	if (tmpErr) { throw tmpErr; }
	let tmpOut = (tmpResult && tmpResult.Outputs) || {};
	if (tmpOut.Records === undefined && typeof tmpOut.Result === 'string')
	{
		try { tmpOut.Records = JSON.parse(tmpOut.Result); } catch (e) { tmpOut.Records = []; }
	}
	return tmpOut;
}

// Variant that returns the Error the handler callbacks with (guard / required-field paths).
function invokeExpectError(pHandler, pSettings)
{
	let tmpErr = null;
	pHandler.Handler({ Settings: pSettings || {} }, {}, (e, r) => { tmpErr = e; });
	return tmpErr;
}

// Fixtures: 4 documents — object array (2), JSON-string array (1), empty array (0), no array (skipped).
const DOCS =
[
	{ IDDocument: 1, SampleID: 'S-100', FormData: { MoistureTable: [ { Layer: 'A', MoisturePct: 12.4, Pass: true }, { Layer: 'B', MoisturePct: 18.7, Pass: false } ] } },
	{ IDDocument: 2, SampleID: 'S-101', FormData: { MoistureTable: '[{"Layer":"A","MoisturePct":7.7,"Pass":true}]' } },
	{ IDDocument: 3, SampleID: 'S-102', FormData: { MoistureTable: [] } },
	{ IDDocument: 4, SampleID: 'S-103', FormData: {} }
];

const CFG =
{
	Entity: 'MoistureReading',
	GUIDName: 'GUIDMoistureReading',
	GUIDTemplate: 'MR_{~D:Record.SampleID~}_{~D:Record.ElementIndex~}',
	ArrayPath: 'FormData.MoistureTable',
	ParentCarry: { SampleID: '{~D:Record.SampleID~}', IDDocument: '{~D:Record.IDDocument~}' },
	ElementProjection: { Layer: '{~D:Element.Layer~}', MoisturePct: '{~D:Element.MoisturePct~}', Pass: '{~D:Element.Pass~}' }
};

suite
(
	'UnnestRecords — typed transform op',
	function ()
	{
		let _ctx = null;
		suiteSetup(function () { _ctx = captureHandlers(); });

		suite
		(
			'beacon action handler',
			function ()
			{
				test('action is registered', function ()
				{
					libAssert.ok(_ctx.handlers['DataMapperTransform:UnnestRecords'], 'DataMapperTransform:UnnestRecords should be registered');
				});

				test('empty input returns zero rows', function ()
				{
					let tmpOut = invoke(_ctx.handlers['DataMapperTransform:UnnestRecords'], { Records: [], OperationConfiguration: CFG });
					libAssert.strictEqual(tmpOut.RecordCount, 0);
				});

				test('explodes array-of-objects into one row per element', function ()
				{
					let tmpOut = invoke(_ctx.handlers['DataMapperTransform:UnnestRecords'], { Records: DOCS, OperationConfiguration: CFG });
					libAssert.strictEqual(tmpOut.RecordCount, 3, '2 (doc1) + 1 (doc2) + 0 (doc3 empty) = 3');
					libAssert.strictEqual(tmpOut.ElementCount, 3);
					libAssert.strictEqual(tmpOut.SkippedNoArray, 1, 'doc4 has no MoistureTable array');
				});

				test('hoists element fields, carries parent keys, deterministic per-element GUID', function ()
				{
					let tmpRows = invoke(_ctx.handlers['DataMapperTransform:UnnestRecords'], { Records: DOCS, OperationConfiguration: CFG }).Records;
					libAssert.strictEqual(tmpRows[0].Layer, 'A');
					libAssert.strictEqual(tmpRows[0].MoisturePct, 12.4);
					libAssert.strictEqual(tmpRows[0].SampleID, 'S-100');
					libAssert.strictEqual(tmpRows[0].IDDocument, 1);
					libAssert.strictEqual(tmpRows[0].GUIDMoistureReading, 'MR_S-100_0');
					libAssert.strictEqual(tmpRows[1].GUIDMoistureReading, 'MR_S-100_1');
				});

				test('parses a JSON-string array column inline', function ()
				{
					let tmpRows = invoke(_ctx.handlers['DataMapperTransform:UnnestRecords'], { Records: DOCS, OperationConfiguration: CFG }).Records;
					let tmpRow = tmpRows.find((r) => r.SampleID === 'S-101');
					libAssert.ok(tmpRow, 'doc2 JSON-string MoistureTable should be parsed and exploded');
					libAssert.strictEqual(tmpRow.Layer, 'A');
					libAssert.strictEqual(tmpRow.MoisturePct, 7.7);
					libAssert.strictEqual(tmpRow.GUIDMoistureReading, 'MR_S-101_0');
				});

				test('Filter keeps only elements matching every equality', function ()
				{
					let tmpCfg = Object.assign({}, CFG, { Filter: { Pass: true } });
					let tmpOut = invoke(_ctx.handlers['DataMapperTransform:UnnestRecords'], { Records: DOCS, OperationConfiguration: tmpCfg });
					libAssert.strictEqual(tmpOut.RecordCount, 2, 'doc1-A + doc2-A pass; doc1-B dropped');
					libAssert.strictEqual(tmpOut.FilteredOutCount, 1);
				});

				test('missing ArrayPath returns an error', function ()
				{
					let tmpCfg = Object.assign({}, CFG);
					delete tmpCfg.ArrayPath;
					let tmpErr = invokeExpectError(_ctx.handlers['DataMapperTransform:UnnestRecords'], { Records: DOCS, OperationConfiguration: tmpCfg });
					libAssert.ok(tmpErr instanceof Error);
					libAssert.match(tmpErr.message, /ArrayPath is required/);
				});

				test('non-array Records does not throw', function ()
				{
					let tmpOut = invoke(_ctx.handlers['DataMapperTransform:UnnestRecords'], { Records: 'not-an-array', OperationConfiguration: CFG });
					libAssert.strictEqual(tmpOut.RecordCount, 0);
				});
			}
		);

		suite
		(
			'compiler _compileUnnestToOperation',
			function ()
			{
				let OP =
				{
					OperationType: 'Unnest', Hash: 'unnest-moisture',
					SourceBeaconName: 'source-databeacon', SourceConnectionHash: 'source-main', SourceEntity: 'Document',
					TargetBeaconName: 'target-databeacon', TargetConnectionHash: 'target-main', TargetTable: 'MoistureReading',
					OperationConfiguration: CFG
				};
				function compile(pOp) { return libConnectionBridge.prototype._compileUnnestToOperation.call(Object.create(libConnectionBridge.prototype), pOp); }

				test('emits a Pull -> Unnest -> Comprehend -> Write graph', function ()
				{
					let tmpTypes = compile(OP).Graph.Nodes.map((n) => n.Type);
					libAssert.ok(tmpTypes.includes('beacon-datamapperrecords-pullrecords'));
					libAssert.ok(tmpTypes.includes('beacon-datamappertransform-unnestrecords'));
					libAssert.ok(tmpTypes.includes('beacon-datamappertransform-buildcomprehension'));
					libAssert.ok(tmpTypes.includes('beacon-datamapperrecords-writerecords'));
				});

				test('bundles the Unnest OperationConfiguration on the unnest node', function ()
				{
					let tmpNode = compile(OP).Graph.Nodes.find((n) => n.Hash === 'unnest');
					libAssert.ok(tmpNode, 'unnest node present');
					let tmpCfg = JSON.parse(tmpNode.Data.OperationConfiguration);
					libAssert.strictEqual(tmpCfg.ArrayPath, 'FormData.MoistureTable');
					libAssert.ok(tmpCfg.ElementProjection && tmpCfg.ElementProjection.Layer);
					libAssert.ok(tmpCfg.ParentCarry && tmpCfg.ParentCarry.SampleID);
				});

				test('routes source/target onto pull/write nodes', function ()
				{
					let tmpGraph = compile(OP);
					let tmpPull = tmpGraph.Graph.Nodes.find((n) => n.Hash === 'pull');
					let tmpWrite = tmpGraph.Graph.Nodes.find((n) => n.Hash === 'write');
					libAssert.strictEqual(tmpPull.Data.SourceBeaconName, 'source-databeacon');
					libAssert.strictEqual(tmpPull.Data.ConnectionHash, 'source-main');
					libAssert.strictEqual(tmpWrite.Data.TargetBeaconName, 'target-databeacon');
					libAssert.strictEqual(tmpWrite.Data.Entity, 'MoistureReading');
				});

				test('wires the state edges pull -> unnest -> comprehension', function ()
				{
					let tmpState = compile(OP).Graph.Connections.filter((c) => c.ConnectionType === 'State');
					libAssert.ok(tmpState.some((c) => c.SourceNodeHash === 'pull' && c.TargetNodeHash === 'unnest' && c.Data.StateKey === 'Records'));
					libAssert.ok(tmpState.some((c) => c.SourceNodeHash === 'unnest' && c.TargetNodeHash === 'comprehension' && c.Data.StateKey === 'Records'));
				});
			}
		);

		suite
		(
			'validation _validateOperationConfiguration',
			function ()
			{
				let BASE =
				{
					OperationType: 'Unnest',
					SourceBeaconName: 's', SourceConnectionHash: 'sc', SourceEntity: 'Document',
					TargetBeaconName: 't', TargetConnectionHash: 'tc', TargetTable: 'MoistureReading',
					OperationConfiguration: CFG
				};
				function validate(pOp) { return libConnectionBridge.prototype._validateOperationConfiguration.call(Object.create(libConnectionBridge.prototype), pOp); }

				test('accepts a valid Unnest op (returns null)', function ()
				{
					libAssert.strictEqual(validate(BASE), null);
				});

				test('rejects missing ArrayPath', function ()
				{
					let tmpErr = validate(Object.assign({}, BASE, { OperationConfiguration: Object.assign({}, CFG, { ArrayPath: undefined }) }));
					libAssert.ok(tmpErr instanceof Error);
					libAssert.match(tmpErr.message, /ArrayPath/);
				});

				test('rejects empty ElementProjection', function ()
				{
					let tmpErr = validate(Object.assign({}, BASE, { OperationConfiguration: Object.assign({}, CFG, { ElementProjection: {} }) }));
					libAssert.ok(tmpErr instanceof Error);
					libAssert.match(tmpErr.message, /ElementProjection/);
				});
			}
		);
	}
);
