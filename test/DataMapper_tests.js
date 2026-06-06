/**
 * Retold Data Mapper — Unit Test Suite
 *
 * Tests the Validator, SyncEngine, and Reporter services using
 * mocked ultravisor dispatches (no real network or database).
 *
 * @author Steven Velozo <steven@velozo.com>
 */
const libAssert = require('assert');
const libFable = require('fable');
const libRetoldDataMapper = require('../source/Retold-DataMapper.js');

// ================================================================
// Fixtures
// ================================================================

const FIXTURE_SOURCE_SCHEMA = {
	Tables: [
		{
			TableName: 'Book',
			ColumnCount: 5,
			Columns: [
				{ Column: 'IDBook', Type: 'int' },
				{ Column: 'Title', Type: 'nvarchar' },
				{ Column: 'ISBN', Type: 'nvarchar' },
				{ Column: 'PublicationYear', Type: 'int' },
				{ Column: 'Genre', Type: 'nvarchar' },
				{ Column: 'Language', Type: 'nvarchar' }
			]
		},
		{
			TableName: 'Author',
			ColumnCount: 3,
			Columns: [
				{ Column: 'IDAuthor', Type: 'int' },
				{ Column: 'GUIDAuthor', Type: 'nvarchar' },
				{ Column: 'FullName', Type: 'nvarchar' },
				{ Column: 'BirthYear', Type: 'int' }
			]
		}
	]
};

const FIXTURE_TARGET_SCHEMA = {
	Tables: [
		{
			TableName: 'Publication',
			ColumnCount: 4,
			Columns: [
				{ Column: 'IDPublication', Type: 'int' },
				{ Column: 'Name', Type: 'varchar' },
				{ Column: 'ProductCode', Type: 'varchar' },
				{ Column: 'Year', Type: 'varchar' },
				{ Column: 'Category', Type: 'varchar' },
				{ Column: 'LanguageCode', Type: 'varchar' }
			]
		},
		{
			TableName: 'Author',
			ColumnCount: 3,
			Columns: [
				{ Column: 'IDAuthor', Type: 'int' },
				{ Column: 'ExternalGUID', Type: 'varchar' },
				{ Column: 'DisplayName', Type: 'varchar' },
				{ Column: 'BornYear', Type: 'int' }
			]
		}
	]
};

const FIXTURE_VALID_ENTITY_MAPPINGS = [
	{
		SourceEntity: 'Book',
		TargetEntity: 'Publication',
		IdentityMapping: { Source: 'ISBN', Target: 'ProductCode' },
		SyncMode: 'Upsert',
		Fields: [
			{ Source: 'Title', Target: 'Name' },
			{ Source: 'ISBN', Target: 'ProductCode' },
			{ Source: 'PublicationYear', Target: 'Year' },
			{ Source: 'Genre', Target: 'Category' },
			{ Source: 'Language', Target: 'LanguageCode' }
		]
	}
];

const FIXTURE_SOURCE_RECORDS = [
	{ IDBook: 1, Title: 'Dune', ISBN: '978-0441013593', PublicationYear: 1965, Genre: 'Science Fiction', Language: 'en' },
	{ IDBook: 2, Title: 'Neuromancer', ISBN: '978-0441569595', PublicationYear: 1984, Genre: 'Cyberpunk', Language: 'en' },
	{ IDBook: 3, Title: 'Foundation', ISBN: '978-0553293357', PublicationYear: 1951, Genre: 'Science Fiction', Language: 'en' }
];

// ================================================================
// Test helpers
// ================================================================

function createTestFable()
{
	return new libFable(
		{
			Product: 'RetoldDataMapperTest',
			ProductVersion: '0.0.1',
			LogStreams: [{ streamtype: 'console', level: 'error' }]
		});
}

/**
 * Build a mock ultravisor client that dispatches to fixture data.
 *
 * @param {object} pOptions — { sourceRecords, targetRecords, failOnWrite }
 * @returns {object} — mock client with dispatch()
 */
function createMockClient(pOptions)
{
	let tmpOpts = pOptions || {};
	let tmpSourceRecords = tmpOpts.sourceRecords || FIXTURE_SOURCE_RECORDS;
	let tmpTargetRecords = tmpOpts.targetRecords || [];
	let tmpWrittenRecords = [];
	let tmpFailOnWrite = tmpOpts.failOnWrite || false;

	return {
		_written: tmpWrittenRecords,
		_targetRecords: tmpTargetRecords,

		dispatch: function (pWorkItem, fCallback)
		{
			let tmpCapability = pWorkItem.Capability;
			let tmpAction = pWorkItem.Action;

			if (tmpCapability === 'DataBeaconManagement' && tmpAction === 'Introspect')
			{
				let tmpAffinityKey = pWorkItem.AffinityKey;
				if (tmpAffinityKey === 'source-beacon')
				{
					return fCallback(null, { Outputs: FIXTURE_SOURCE_SCHEMA });
				}
				if (tmpAffinityKey === 'target-beacon')
				{
					return fCallback(null, { Outputs: FIXTURE_TARGET_SCHEMA });
				}
				return fCallback(new Error('Unknown beacon: ' + tmpAffinityKey));
			}

			if (tmpCapability === 'MeadowProxy' && tmpAction === 'Request')
			{
				let tmpMethod = pWorkItem.Settings.Method;
				let tmpPath = pWorkItem.Settings.Path;

				// Parse plural read: GET /1.0/{hash}/{entity}s/{offset}/{cap}
				let tmpReadMatch = tmpPath.match(/^\/1\.0\/[^/]+\/(\w+)s\/(\d+)\/(\d+)$/);
				if (tmpMethod === 'GET' && tmpReadMatch)
				{
					let tmpOffset = parseInt(tmpReadMatch[2], 10);
					let tmpCap = parseInt(tmpReadMatch[3], 10);
					let tmpSlice = tmpSourceRecords.slice(tmpOffset, tmpOffset + tmpCap);
					return fCallback(null, { Outputs: { Status: 200, Body: JSON.stringify(tmpSlice) } });
				}

				// Parse filtered read: GET /1.0/{hash}/{entity}s/FilteredTo/{col}/{val}/0/1
				let tmpFilterMatch = tmpPath.match(/^\/1\.0\/[^/]+\/(\w+)s\/FilteredTo\/(\w+)\/([^/]+)\/0\/1$/);
				if (tmpMethod === 'GET' && tmpFilterMatch)
				{
					let tmpFilterCol = tmpFilterMatch[2];
					let tmpFilterVal = decodeURIComponent(tmpFilterMatch[3]);
					let tmpFound = tmpTargetRecords.find((pR) => String(pR[tmpFilterCol]) === String(tmpFilterVal));
					let tmpResult = tmpFound ? [tmpFound] : [];
					return fCallback(null, { Outputs: { Status: 200, Body: JSON.stringify(tmpResult) } });
				}

				// POST (create)
				if (tmpMethod === 'POST')
				{
					if (tmpFailOnWrite)
					{
						return fCallback(null, { Outputs: { Status: 500, Body: '{"Error":"Mock write failure"}' } });
					}
					let tmpBody = pWorkItem.Settings.Body;
					let tmpRecord = (typeof (tmpBody) === 'string') ? JSON.parse(tmpBody) : tmpBody;
					tmpWrittenRecords.push({ method: 'POST', record: tmpRecord });
					return fCallback(null, { Outputs: { Status: 200, Body: JSON.stringify(tmpRecord) } });
				}

				// PUT (update)
				if (tmpMethod === 'PUT')
				{
					if (tmpFailOnWrite)
					{
						return fCallback(null, { Outputs: { Status: 500, Body: '{"Error":"Mock write failure"}' } });
					}
					let tmpBody = pWorkItem.Settings.Body;
					let tmpRecord = (typeof (tmpBody) === 'string') ? JSON.parse(tmpBody) : tmpBody;
					tmpWrittenRecords.push({ method: 'PUT', record: tmpRecord });
					return fCallback(null, { Outputs: { Status: 200, Body: JSON.stringify(tmpRecord) } });
				}

				return fCallback(new Error('Unhandled mock request: ' + tmpMethod + ' ' + tmpPath));
			}

			return fCallback(new Error('Unhandled mock dispatch: ' + tmpCapability + ':' + tmpAction));
		}
	};
}

// ================================================================
// Tests
// ================================================================

suite
(
	'Retold DataMapper',
	function ()
	{
		// ============================================================
		// Sort filter (FSF) builder — single + composite SortField
		// ============================================================
		suite
		(
			'_buildSortFilter',
			function ()
			{
				const _buildSortFilter = require('../source/services/DataMapper-BeaconProvider.js')._buildSortFilter;

				test
				(
					'single column gives one FSF stanza (backward-compatible)',
					function ()
					{
						libAssert.strictEqual(_buildSortFilter('IDBook'), 'FSF~IDBook~ASC~0');
					}
				);
				test
				(
					'composite PK gives one stanza per column (total order)',
					function ()
					{
						libAssert.strictEqual(_buildSortFilter('MISCHGUT_NR,TRIAL_NR'), 'FSF~MISCHGUT_NR~ASC~0~FSF~TRIAL_NR~ASC~0');
					}
				);
				test
				(
					'trims whitespace around column names',
					function ()
					{
						libAssert.strictEqual(_buildSortFilter('A, B , C'), 'FSF~A~ASC~0~FSF~B~ASC~0~FSF~C~ASC~0');
					}
				);
				test
				(
					'drops empty segments from trailing or doubled commas',
					function ()
					{
						libAssert.strictEqual(_buildSortFilter('A,,B,'), 'FSF~A~ASC~0~FSF~B~ASC~0');
					}
				);
				test
				(
					'falsy SortField yields empty string',
					function ()
					{
						libAssert.strictEqual(_buildSortFilter(''), '');
						libAssert.strictEqual(_buildSortFilter(undefined), '');
						libAssert.strictEqual(_buildSortFilter(null), '');
					}
				);
			}
		);

		// ============================================================
		// Validator
		// ============================================================
		suite
		(
			'Validator',
			function ()
			{
				let _Fable = null;
				let _Mapper = null;

				suiteSetup
				(
					function ()
					{
						_Fable = createTestFable();
						_Fable.serviceManager.addServiceType('RetoldDataMapper', libRetoldDataMapper);
						_Mapper = _Fable.serviceManager.instantiateServiceProvider('RetoldDataMapper');
					}
				);

				test
				(
					'Valid mapping passes validation',
					function ()
					{
						let tmpResult = _Mapper.Validator.validate(
							FIXTURE_VALID_ENTITY_MAPPINGS,
							FIXTURE_SOURCE_SCHEMA,
							FIXTURE_TARGET_SCHEMA);

						libAssert.strictEqual(tmpResult.Valid, true, 'Expected validation to pass');
						libAssert.strictEqual(tmpResult.Errors.length, 0, 'Expected no errors');
					}
				);

				test
				(
					'Missing source entity fails validation',
					function ()
					{
						let tmpMappings = [
							{
								SourceEntity: 'NonExistent',
								TargetEntity: 'Publication',
								Fields: [{ Source: 'Title', Target: 'Name' }]
							}
						];

						let tmpResult = _Mapper.Validator.validate(tmpMappings, FIXTURE_SOURCE_SCHEMA, FIXTURE_TARGET_SCHEMA);

						libAssert.strictEqual(tmpResult.Valid, false);
						libAssert.ok(tmpResult.Errors.length > 0);
						libAssert.ok(tmpResult.Errors[0].indexOf('NonExistent') >= 0);
					}
				);

				test
				(
					'Missing target entity fails validation',
					function ()
					{
						let tmpMappings = [
							{
								SourceEntity: 'Book',
								TargetEntity: 'NonExistent',
								Fields: [{ Source: 'Title', Target: 'Name' }]
							}
						];

						let tmpResult = _Mapper.Validator.validate(tmpMappings, FIXTURE_SOURCE_SCHEMA, FIXTURE_TARGET_SCHEMA);

						libAssert.strictEqual(tmpResult.Valid, false);
						libAssert.ok(tmpResult.Errors[0].indexOf('NonExistent') >= 0);
					}
				);

				test
				(
					'Missing source field fails validation',
					function ()
					{
						let tmpMappings = [
							{
								SourceEntity: 'Book',
								TargetEntity: 'Publication',
								Fields: [{ Source: 'FakeColumn', Target: 'Name' }]
							}
						];

						let tmpResult = _Mapper.Validator.validate(tmpMappings, FIXTURE_SOURCE_SCHEMA, FIXTURE_TARGET_SCHEMA);

						libAssert.strictEqual(tmpResult.Valid, false);
						libAssert.ok(tmpResult.Errors[0].indexOf('FakeColumn') >= 0);
					}
				);

				test
				(
					'Missing target field fails validation',
					function ()
					{
						let tmpMappings = [
							{
								SourceEntity: 'Book',
								TargetEntity: 'Publication',
								Fields: [{ Source: 'Title', Target: 'FakeColumn' }]
							}
						];

						let tmpResult = _Mapper.Validator.validate(tmpMappings, FIXTURE_SOURCE_SCHEMA, FIXTURE_TARGET_SCHEMA);

						libAssert.strictEqual(tmpResult.Valid, false);
						libAssert.ok(tmpResult.Errors[0].indexOf('FakeColumn') >= 0);
					}
				);

				test
				(
					'Missing identity mapping source field fails validation',
					function ()
					{
						let tmpMappings = [
							{
								SourceEntity: 'Book',
								TargetEntity: 'Publication',
								IdentityMapping: { Source: 'FakeID', Target: 'ProductCode' },
								Fields: [{ Source: 'Title', Target: 'Name' }]
							}
						];

						let tmpResult = _Mapper.Validator.validate(tmpMappings, FIXTURE_SOURCE_SCHEMA, FIXTURE_TARGET_SCHEMA);

						libAssert.strictEqual(tmpResult.Valid, false);
						libAssert.ok(tmpResult.Errors[0].indexOf('FakeID') >= 0);
					}
				);

				test
				(
					'Type mismatch produces a warning, not an error',
					function ()
					{
						let tmpResult = _Mapper.Validator.validate(
							FIXTURE_VALID_ENTITY_MAPPINGS,
							FIXTURE_SOURCE_SCHEMA,
							FIXTURE_TARGET_SCHEMA);

						// PublicationYear is int in source, Year is varchar in target
						libAssert.ok(tmpResult.Warnings.length > 0, 'Expected type mismatch warnings');
						libAssert.strictEqual(tmpResult.Valid, true, 'Warnings should not fail validation');
					}
				);

				test
				(
					'Invalid SyncMode fails validation',
					function ()
					{
						let tmpMappings = [
							{
								SourceEntity: 'Book',
								TargetEntity: 'Publication',
								SyncMode: 'BadMode',
								Fields: [{ Source: 'Title', Target: 'Name' }]
							}
						];

						let tmpResult = _Mapper.Validator.validate(tmpMappings, FIXTURE_SOURCE_SCHEMA, FIXTURE_TARGET_SCHEMA);

						libAssert.strictEqual(tmpResult.Valid, false);
						libAssert.ok(tmpResult.Errors[0].indexOf('BadMode') >= 0);
					}
				);

				test
				(
					'Empty entity mappings fails validation',
					function ()
					{
						let tmpResult = _Mapper.Validator.validate([], FIXTURE_SOURCE_SCHEMA, FIXTURE_TARGET_SCHEMA);
						libAssert.strictEqual(tmpResult.Valid, false);
					}
				);
			}
		);

		// ============================================================
		// SyncEngine
		// ============================================================
		suite
		(
			'SyncEngine',
			function ()
			{
				let _Fable = null;
				let _Mapper = null;

				suiteSetup
				(
					function ()
					{
						_Fable = createTestFable();
						_Fable.serviceManager.addServiceType('RetoldDataMapper', libRetoldDataMapper);
						_Mapper = _Fable.serviceManager.instantiateServiceProvider('RetoldDataMapper');
					}
				);

				test
				(
					'InsertOnly sync writes all records',
					function (fDone)
					{
						let tmpClient = createMockClient();
						let tmpReporter = _Mapper.Reporter;
						tmpReporter.begin('test-insert');

						let tmpEntityMapping = {
							SourceEntity: 'Book',
							TargetEntity: 'Publication',
							SyncMode: 'InsertOnly',
							IdentityMapping: { Source: 'ISBN', Target: 'ProductCode' },
							Fields: [
								{ Source: 'Title', Target: 'Name' },
								{ Source: 'ISBN', Target: 'ProductCode' }
							]
						};

						_Mapper.SyncEngine.sync(
							tmpEntityMapping,
							tmpClient,
							{ BeaconName: 'source-beacon', ConnectionHash: 'src-hash', IDBeaconConnection: 1 },
							{ BeaconName: 'target-beacon', ConnectionHash: 'tgt-hash', IDBeaconConnection: 1 },
							{ BatchSize: 100, ContinueOnError: false },
							tmpReporter,
							(pError) =>
							{
								libAssert.ifError(pError);
								libAssert.strictEqual(tmpClient._written.length, 3, 'Expected 3 records written');
								libAssert.strictEqual(tmpClient._written[0].method, 'POST');
								libAssert.strictEqual(tmpClient._written[0].record.Name, 'Dune');
								libAssert.strictEqual(tmpClient._written[0].record.ProductCode, '978-0441013593');
								fDone();
							});
					}
				);

				test
				(
					'Upsert creates new records when target is empty',
					function (fDone)
					{
						let tmpClient = createMockClient({ targetRecords: [] });
						let tmpReporter = _Mapper.Reporter;
						tmpReporter.begin('test-upsert-create');

						let tmpEntityMapping = {
							SourceEntity: 'Book',
							TargetEntity: 'Publication',
							SyncMode: 'Upsert',
							IdentityMapping: { Source: 'ISBN', Target: 'ProductCode' },
							Fields: [
								{ Source: 'Title', Target: 'Name' },
								{ Source: 'ISBN', Target: 'ProductCode' }
							]
						};

						_Mapper.SyncEngine.sync(
							tmpEntityMapping,
							tmpClient,
							{ BeaconName: 'source-beacon', ConnectionHash: 'src-hash', IDBeaconConnection: 1 },
							{ BeaconName: 'target-beacon', ConnectionHash: 'tgt-hash', IDBeaconConnection: 1 },
							{ BatchSize: 100, ContinueOnError: false },
							tmpReporter,
							(pError) =>
							{
								libAssert.ifError(pError);
								libAssert.strictEqual(tmpClient._written.length, 3);
								// All should be POST (create) since target is empty
								for (let i = 0; i < tmpClient._written.length; i++)
								{
									libAssert.strictEqual(tmpClient._written[i].method, 'POST');
								}
								fDone();
							});
					}
				);

				test
				(
					'Upsert updates existing records',
					function (fDone)
					{
						let tmpExistingTargetRecords = [
							{ IDPublication: 42, Name: 'Old Dune Title', ProductCode: '978-0441013593' }
						];
						let tmpClient = createMockClient({ targetRecords: tmpExistingTargetRecords });
						let tmpReporter = _Mapper.Reporter;
						tmpReporter.begin('test-upsert-update');

						let tmpEntityMapping = {
							SourceEntity: 'Book',
							TargetEntity: 'Publication',
							SyncMode: 'Upsert',
							IdentityMapping: { Source: 'ISBN', Target: 'ProductCode' },
							Fields: [
								{ Source: 'Title', Target: 'Name' },
								{ Source: 'ISBN', Target: 'ProductCode' }
							]
						};

						_Mapper.SyncEngine.sync(
							tmpEntityMapping,
							tmpClient,
							{ BeaconName: 'source-beacon', ConnectionHash: 'src-hash', IDBeaconConnection: 1 },
							{ BeaconName: 'target-beacon', ConnectionHash: 'tgt-hash', IDBeaconConnection: 1 },
							{ BatchSize: 100, ContinueOnError: false },
							tmpReporter,
							(pError) =>
							{
								libAssert.ifError(pError);
								// First record (Dune) should be PUT (update), others POST (create)
								let tmpPuts = tmpClient._written.filter((pW) => pW.method === 'PUT');
								let tmpPosts = tmpClient._written.filter((pW) => pW.method === 'POST');
								libAssert.strictEqual(tmpPuts.length, 1, 'Expected 1 update');
								libAssert.strictEqual(tmpPosts.length, 2, 'Expected 2 creates');
								libAssert.strictEqual(tmpPuts[0].record.IDPublication, 42, 'Expected ID from existing record');
								libAssert.strictEqual(tmpPuts[0].record.Name, 'Dune', 'Expected updated name');
								fDone();
							});
					}
				);

				test
				(
					'ContinueOnError allows remaining records after write failure',
					function (fDone)
					{
						// Only fail the first record, pass the rest
						let tmpCallCount = 0;
						let tmpWritten = [];
						let tmpMockClient = {
							_written: tmpWritten,
							dispatch: function (pWorkItem, fCallback)
							{
								if (pWorkItem.Capability === 'MeadowProxy' && pWorkItem.Action === 'Request')
								{
									let tmpMethod = pWorkItem.Settings.Method;
									let tmpPath = pWorkItem.Settings.Path;

									// Plural read
									let tmpReadMatch = tmpPath.match(/^\/1\.0\/[^/]+\/(\w+)s\/(\d+)\/(\d+)$/);
									if (tmpMethod === 'GET' && tmpReadMatch)
									{
										let tmpOffset = parseInt(tmpReadMatch[2], 10);
										let tmpCap = parseInt(tmpReadMatch[3], 10);
										let tmpSlice = FIXTURE_SOURCE_RECORDS.slice(tmpOffset, tmpOffset + tmpCap);
										return fCallback(null, { Outputs: { Status: 200, Body: JSON.stringify(tmpSlice) } });
									}

									// POST — fail first, succeed rest
									if (tmpMethod === 'POST')
									{
										tmpCallCount++;
										if (tmpCallCount === 1)
										{
											return fCallback(null, { Outputs: { Status: 500, Body: '{"Error":"Mock failure"}' } });
										}
										let tmpBody = pWorkItem.Settings.Body;
										let tmpRecord = (typeof (tmpBody) === 'string') ? JSON.parse(tmpBody) : tmpBody;
										tmpWritten.push({ method: 'POST', record: tmpRecord });
										return fCallback(null, { Outputs: { Status: 200, Body: JSON.stringify(tmpRecord) } });
									}
								}
								return fCallback(new Error('Unhandled'));
							}
						};

						let tmpReporter = _Mapper.Reporter;
						tmpReporter.begin('test-continue-on-error');

						let tmpEntityMapping = {
							SourceEntity: 'Book',
							TargetEntity: 'Publication',
							SyncMode: 'InsertOnly',
							IdentityMapping: { Source: 'ISBN', Target: 'ProductCode' },
							Fields: [{ Source: 'Title', Target: 'Name' }]
						};

						_Mapper.SyncEngine.sync(
							tmpEntityMapping,
							tmpMockClient,
							{ BeaconName: 'source-beacon', ConnectionHash: 'src-hash', IDBeaconConnection: 1 },
							{ BeaconName: 'target-beacon', ConnectionHash: 'tgt-hash', IDBeaconConnection: 1 },
							{ BatchSize: 100, ContinueOnError: true },
							tmpReporter,
							(pError) =>
							{
								// Should succeed (ContinueOnError) despite the first write failing
								libAssert.ifError(pError);
								// 2 records should have been written (records 2 and 3)
								libAssert.strictEqual(tmpWritten.length, 2);
								fDone();
							});
					}
				);

				test
				(
					'Pagination reads multiple batches',
					function (fDone)
					{
						let tmpClient = createMockClient();
						let tmpReporter = _Mapper.Reporter;
						tmpReporter.begin('test-pagination');

						let tmpEntityMapping = {
							SourceEntity: 'Book',
							TargetEntity: 'Publication',
							SyncMode: 'InsertOnly',
							IdentityMapping: { Source: 'ISBN', Target: 'ProductCode' },
							Fields: [{ Source: 'Title', Target: 'Name' }]
						};

						// BatchSize of 2 means 3 records require 2 batches
						_Mapper.SyncEngine.sync(
							tmpEntityMapping,
							tmpClient,
							{ BeaconName: 'source-beacon', ConnectionHash: 'src-hash', IDBeaconConnection: 1 },
							{ BeaconName: 'target-beacon', ConnectionHash: 'tgt-hash', IDBeaconConnection: 1 },
							{ BatchSize: 2, ContinueOnError: false },
							tmpReporter,
							(pError) =>
							{
								libAssert.ifError(pError);
								libAssert.strictEqual(tmpClient._written.length, 3, 'All 3 records should be written across 2 batches');
								fDone();
							});
					}
				);
			}
		);

		// ============================================================
		// Reporter
		// ============================================================
		suite
		(
			'Reporter',
			function ()
			{
				let _Fable = null;
				let _Mapper = null;

				suiteSetup
				(
					function ()
					{
						_Fable = createTestFable();
						_Fable.serviceManager.addServiceType('RetoldDataMapper', libRetoldDataMapper);
						_Mapper = _Fable.serviceManager.instantiateServiceProvider('RetoldDataMapper');
					}
				);

				test
				(
					'toJSON produces correct structure',
					function ()
					{
						let tmpReporter = _Mapper.Reporter;
						tmpReporter.begin('test-report');

						let tmpEntity = tmpReporter.beginEntity('Book → Publication');
						tmpEntity.Total = 10;
						tmpEntity.Synced = 8;
						tmpEntity.Errors = 1;
						tmpEntity.Skipped = 1;
						tmpReporter.finishEntity('Book → Publication');

						tmpReporter.addError('Book → Publication', 'Test error message');
						tmpReporter.finish();

						let tmpJSON = tmpReporter.toJSON();

						libAssert.strictEqual(tmpJSON.Name, 'test-report');
						libAssert.strictEqual(tmpJSON.TotalRecords, 10);
						libAssert.strictEqual(tmpJSON.TotalSynced, 8);
						libAssert.strictEqual(tmpJSON.TotalErrors, 1);
						libAssert.strictEqual(tmpJSON.TotalSkipped, 1);
						libAssert.strictEqual(tmpJSON.Entities.length, 1);
						libAssert.strictEqual(tmpJSON.Errors.length, 1);
						libAssert.ok(tmpJSON.ElapsedMs >= 0);
					}
				);

				test
				(
					'summary produces readable text',
					function ()
					{
						let tmpReporter = _Mapper.Reporter;
						tmpReporter.begin('summary-test');

						let tmpEntity = tmpReporter.beginEntity('Book → Publication');
						tmpEntity.Total = 5;
						tmpEntity.Synced = 5;
						tmpReporter.finishEntity('Book → Publication');
						tmpReporter.finish();

						let tmpSummary = tmpReporter.summary();

						libAssert.ok(tmpSummary.indexOf('summary-test') >= 0);
						libAssert.ok(tmpSummary.indexOf('5 synced') >= 0);
						libAssert.ok(tmpSummary.indexOf('0 errors') >= 0);
					}
				);

				test
				(
					'Multiple entities aggregate correctly',
					function ()
					{
						let tmpReporter = _Mapper.Reporter;
						tmpReporter.begin('multi-entity-test');

						let tmpEntity1 = tmpReporter.beginEntity('Book → Publication');
						tmpEntity1.Total = 10;
						tmpEntity1.Synced = 10;
						tmpReporter.finishEntity('Book → Publication');

						let tmpEntity2 = tmpReporter.beginEntity('Author → Author');
						tmpEntity2.Total = 5;
						tmpEntity2.Synced = 4;
						tmpEntity2.Errors = 1;
						tmpReporter.finishEntity('Author → Author');

						tmpReporter.finish();

						let tmpJSON = tmpReporter.toJSON();

						libAssert.strictEqual(tmpJSON.TotalRecords, 15);
						libAssert.strictEqual(tmpJSON.TotalSynced, 14);
						libAssert.strictEqual(tmpJSON.TotalErrors, 1);
						libAssert.strictEqual(tmpJSON.Entities.length, 2);
					}
				);
			}
		);

		// ============================================================
		// Discovery
		// ============================================================
		suite
		(
			'Discovery',
			function ()
			{
				let _Fable = null;
				let _Mapper = null;

				suiteSetup
				(
					function ()
					{
						_Fable = createTestFable();
						_Fable.serviceManager.addServiceType('RetoldDataMapper', libRetoldDataMapper);
						_Mapper = _Fable.serviceManager.instantiateServiceProvider('RetoldDataMapper');
					}
				);

				test
				(
					'Introspect returns schema from mock dispatch',
					function (fDone)
					{
						let tmpClient = createMockClient();

						_Mapper.Discovery.introspectBeacon(tmpClient, 'source-beacon', 1,
							(pError, pSchema) =>
							{
								libAssert.ifError(pError);
								libAssert.ok(pSchema);
								libAssert.ok(pSchema.Tables.length > 0);
								libAssert.strictEqual(pSchema.Tables[0].TableName, 'Book');
								libAssert.ok(pSchema.Tables[0].Columns.length > 0);
								fDone();
							});
					}
				);

				test
				(
					'Introspect caches results',
					function (fDone)
					{
						let tmpDispatchCount = 0;
						let tmpCachingClient = {
							dispatch: function (pWorkItem, fCallback)
							{
								tmpDispatchCount++;
								return fCallback(null, { Outputs: FIXTURE_SOURCE_SCHEMA });
							}
						};

						_Mapper.Discovery.clearCache();

						_Mapper.Discovery.introspectBeacon(tmpCachingClient, 'cache-test-beacon', 1,
							(pError1) =>
							{
								libAssert.ifError(pError1);
								libAssert.strictEqual(tmpDispatchCount, 1);

								// Second call should hit cache
								_Mapper.Discovery.introspectBeacon(tmpCachingClient, 'cache-test-beacon', 1,
									(pError2, pSchema2) =>
									{
										libAssert.ifError(pError2);
										libAssert.strictEqual(tmpDispatchCount, 1, 'Should not dispatch again');
										libAssert.ok(pSchema2.Tables.length > 0);
										fDone();
									});
							});
					}
				);
			}
		);

		// ============================================================
		// Service construction
		// ============================================================
		suite
		(
			'Service Construction',
			function ()
			{
				test
				(
					'RetoldDataMapper constructs with all sub-services',
					function ()
					{
						let tmpFable = createTestFable();
						tmpFable.serviceManager.addServiceType('RetoldDataMapper', libRetoldDataMapper);
						let tmpMapper = tmpFable.serviceManager.instantiateServiceProvider('RetoldDataMapper');

						libAssert.ok(tmpMapper);
						libAssert.ok(tmpMapper.Discovery);
						libAssert.ok(tmpMapper.Validator);
						libAssert.ok(tmpMapper.SyncEngine);
						libAssert.ok(tmpMapper.Reporter);
						libAssert.strictEqual(tmpMapper.serviceType, 'RetoldDataMapper');
					}
				);
			}
		);

		// ============================================================
		// Execute-WriteTargetRaw — clone-to-lake raw-archive wrapper
		// ============================================================
		suite
		(
			'Execute-WriteTargetRaw',
			function ()
			{
				const libExecuteWriteTargetRaw = require('../source/services/executors/Execute-WriteTargetRaw.js');
				const libCrypto = require('crypto');

				function _md5Hex(pString)
				{
					return libCrypto.createHash('md5').update(pString).digest('hex');
				}

				function _makeMockTask(pCapturedWorkItems, pDispatchOverride)
				{
					let tmpCoordinator =
					{
						dispatchAndWait: function (pWorkItem, fCallback)
						{
							pCapturedWorkItems.push(pWorkItem);
							if (pDispatchOverride) return pDispatchOverride(pWorkItem, fCallback);
							return fCallback(null, { Outputs: { Status: 200 } });
						}
					};
					return {
						fable:
						{
							servicesMap:
							{
								UltravisorBeaconCoordinator: { ubc: tmpCoordinator }
							}
						}
					};
				}

				test
				(
					'wraps each record into { Identity, RawJSON, RecordMD5, IngestedAt, SourceTable }',
					function (fDone)
					{
						let tmpCaptured = [];
						let tmpTask = _makeMockTask(tmpCaptured);
						let tmpSourceRecord = { IDCustomer: 42, CompanyName: 'Acme', ContactEmail: 'x@y.z' };
						let tmpSettings =
						{
							BeaconName:     'lake-databeacon',
							ConnectionHash: 'lake-main',
							Entity:         'C134_PRODLASTRADA_RAW_Customer',
							Comprehension:  { Customer: { 'GUID-1': tmpSourceRecord } },
							IdentityField:  'IDCustomer',
							SourceTable:    'Customer',
							SyncMode:       'Upsert'
						};

						libExecuteWriteTargetRaw(tmpTask, tmpSettings, {}, function (pErr, pResult)
						{
							libAssert.strictEqual(pErr, null);
							libAssert.strictEqual(pResult.EventToFire, 'Complete');
							libAssert.strictEqual(pResult.Outputs.Written, 1);
							libAssert.strictEqual(pResult.Outputs.Errors, 0);
							libAssert.strictEqual(tmpCaptured.length, 1);

							let tmpBody = JSON.parse(tmpCaptured[0].Settings.Body);
							libAssert.strictEqual(tmpBody.Identity, 42);
							libAssert.strictEqual(tmpBody.SourceTable, 'Customer');
							libAssert.strictEqual(typeof tmpBody.IngestedAt, 'string');
							libAssert.ok(/^\d{4}-\d{2}-\d{2}T/.test(tmpBody.IngestedAt));
							libAssert.strictEqual(tmpBody.RawJSON, JSON.stringify(tmpSourceRecord));
							libAssert.strictEqual(tmpBody.RecordMD5, _md5Hex(JSON.stringify(tmpSourceRecord)));
							libAssert.strictEqual(tmpCaptured[0].Settings.Path, '/1.0/lake-main/C134_PRODLASTRADA_RAW_Customer');
							libAssert.strictEqual(tmpCaptured[0].AffinityKey, 'lake-databeacon');
							fDone();
						});
					}
				);

				test
				(
					'falls back to the comprehension key when IdentityField is missing on the record',
					function (fDone)
					{
						let tmpCaptured = [];
						let tmpTask = _makeMockTask(tmpCaptured);
						let tmpSettings =
						{
							BeaconName:     'lake-databeacon',
							ConnectionHash: 'lake-main',
							Entity:         'C134_PRODLASTRADA_RAW_Author',
							Comprehension:  { Author: { 'GUID-ABC': { FullName: 'Anon', BirthYear: 1900 } } },
							IdentityField:  'IDAuthor',
							SourceTable:    'Author'
						};

						libExecuteWriteTargetRaw(tmpTask, tmpSettings, {}, function (pErr, pResult)
						{
							libAssert.strictEqual(pErr, null);
							libAssert.strictEqual(pResult.EventToFire, 'Complete');
							let tmpBody = JSON.parse(tmpCaptured[0].Settings.Body);
							libAssert.strictEqual(tmpBody.Identity, 'GUID-ABC');
							fDone();
						});
					}
				);

				test
				(
					'unchanged record produces identical RecordMD5 across runs',
					function (fDone)
					{
						let tmpCaptured = [];
						let tmpTask = _makeMockTask(tmpCaptured);
						let tmpRecord = { IDFoo: 1, Name: 'stable' };
						let tmpSettings =
						{
							BeaconName:     'lake-databeacon',
							ConnectionHash: 'lake-main',
							Entity:         'C134_PRODLASTRADA_RAW_Foo',
							Comprehension:  { Foo: { 'k1': tmpRecord } },
							IdentityField:  'IDFoo',
							SourceTable:    'Foo'
						};

						libExecuteWriteTargetRaw(tmpTask, tmpSettings, {}, function ()
						{
							let tmpFirstMD5 = JSON.parse(tmpCaptured[0].Settings.Body).RecordMD5;
							tmpCaptured.length = 0;
							libExecuteWriteTargetRaw(tmpTask, tmpSettings, {}, function ()
							{
								let tmpSecondMD5 = JSON.parse(tmpCaptured[0].Settings.Body).RecordMD5;
								libAssert.strictEqual(tmpFirstMD5, tmpSecondMD5);
								fDone();
							});
						});
					}
				);

				test
				(
					'reports Error when required settings are missing',
					function (fDone)
					{
						let tmpCaptured = [];
						let tmpTask = _makeMockTask(tmpCaptured);
						let tmpSettings = { BeaconName: '', ConnectionHash: '', Entity: '', Comprehension: {} };

						libExecuteWriteTargetRaw(tmpTask, tmpSettings, {}, function (pErr, pResult)
						{
							libAssert.strictEqual(pErr, null);
							libAssert.strictEqual(pResult.EventToFire, 'Error');
							libAssert.strictEqual(tmpCaptured.length, 0);
							fDone();
						});
					}
				);

				test
				(
					'counts HTTP >= 400 responses as errors',
					function (fDone)
					{
						let tmpCaptured = [];
						let tmpTask = _makeMockTask(tmpCaptured, function (pWorkItem, fCallback)
						{
							return fCallback(null, { Outputs: { Status: 500 } });
						});
						let tmpSettings =
						{
							BeaconName:     'lake-databeacon',
							ConnectionHash: 'lake-main',
							Entity:         'C134_PRODLASTRADA_RAW_Foo',
							Comprehension:  { Foo: { 'k1': { IDFoo: 1 } } },
							IdentityField:  'IDFoo',
							SourceTable:    'Foo'
						};

						libExecuteWriteTargetRaw(tmpTask, tmpSettings, {}, function (pErr, pResult)
						{
							libAssert.strictEqual(pErr, null);
							libAssert.strictEqual(pResult.EventToFire, 'Error');
							libAssert.strictEqual(pResult.Outputs.Written, 0);
							libAssert.strictEqual(pResult.Outputs.Errors, 1);
							libAssert.strictEqual(pResult.Outputs.ErrorLog[0].Error, 'HTTP 500');
							fDone();
						});
					}
				);
			}
		);
	}
);
