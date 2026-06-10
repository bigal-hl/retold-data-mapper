/**
 * Retold Data Mapper — Source Filter Pass-Through Suite
 *
 * Every typed-op compiler must thread OperationConfiguration.FilterExpression
 * / SortField onto its source Pull (or stream) node so a projection can read a
 * FILTERED source. PullRecords/CloneStream already consume these settings —
 * these tests pin that the compilers emit them.
 */
const libAssert = require('assert');
const libConnectionBridge = require('../source/services/DataMapper-ConnectionBridge.js');

const FILTER = 'FBV~DocumentType~EQ~WI-Moisture-Walbec~FBV~Deleted~EQ~0';

function baseOp(pType, pCfg)
{
	return {
		OperationType: pType, Hash: 'flt-' + pType.toLowerCase(),
		SourceBeaconName: 'src', SourceConnectionHash: 'src-conn', SourceEntity: 'Document',
		TargetBeaconName: 'tgt', TargetConnectionHash: 'tgt-conn', TargetTable: 'Out',
		OperationConfiguration: Object.assign({ Entity: 'Out', GUIDTemplate: 'O_{~D:Record.ID~}' }, pCfg)
	};
}

function compile(pMethod, pOp)
{
	return libConnectionBridge.prototype[pMethod].call({}, pOp);
}

function pullNode(pGraph, pHash)
{
	return pGraph.Graph.Nodes.find((n) => n.Hash === (pHash || 'pull'));
}

suite('Source filter pass-through (compilers)', function ()
{
	const CASES =
	[
		{ method: '_compileExtractionToOperation',   cfg: { Projection: { A: '{~D:Record.A~}' } } },
		{ method: '_compileUnnestToOperation',       cfg: { ArrayPath: 'T', ElementProjection: { A: '{~D:Element.A~}' } } },
		{ method: '_compileAggregationToOperation',  cfg: { GroupBy: [ 'A' ], Aggregates: [ { Source: 'B', Function: 'Sum', As: 'BSum' } ] } },
		{ method: '_compileHistogramToOperation',    cfg: { BucketColumn: 'D', BucketKind: 'DateDay', Aggregates: [ { Source: '*', Function: 'Count', As: 'N' } ] } }
	];

	for (const tmpCase of CASES)
	{
		test(`${tmpCase.method} threads FilterExpression + SortField onto the pull node`, function ()
		{
			const tmpOp = baseOp('X', Object.assign({ FilterExpression: FILTER, SortField: 'IDDocument' }, tmpCase.cfg));
			const tmpNode = pullNode(compile(tmpCase.method, tmpOp));
			libAssert.strictEqual(tmpNode.Data.FilterExpression, FILTER);
			libAssert.strictEqual(tmpNode.Data.SortField, 'IDDocument');
		});

		test(`${tmpCase.method} emits empty filter fields when unset`, function ()
		{
			const tmpNode = pullNode(compile(tmpCase.method, baseOp('X', tmpCase.cfg)));
			libAssert.strictEqual(tmpNode.Data.FilterExpression, '');
			libAssert.strictEqual(tmpNode.Data.SortField, '');
		});
	}

	test('_compileIntersectionToOperation threads the filter onto the SOURCE pull only', function ()
	{
		const tmpOp = baseOp('Intersection',
			{ FilterExpression: FILTER, RelatedEntity: 'Other', JoinOn: { SourceField: 'A', RelatedField: 'A' }, Projection: { A: '{~D:Record.A~}' } });
		const tmpGraph = compile('_compileIntersectionToOperation', tmpOp);
		libAssert.strictEqual(pullNode(tmpGraph, 'pull-source').Data.FilterExpression, FILTER);
		libAssert.strictEqual(pullNode(tmpGraph, 'pull-related').Data.FilterExpression, undefined, 'related pull must not inherit the source filter');
	});

	test('_compileCloneToOperation passes the filter through on the stream node (pre-existing behavior)', function ()
	{
		const tmpOp = baseOp('PassthroughClone', { FilterExpression: FILTER });
		const tmpNode = pullNode(compile('_compileCloneToOperation', tmpOp), 'clone');
		libAssert.strictEqual(tmpNode.Data.FilterExpression, FILTER);
	});
});
