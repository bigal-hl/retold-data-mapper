#!/usr/bin/env node
/**
 * Retold Data Mapper — Synth-Demo Seeder
 *
 * Pre-populates the data-mapper's MappingConfig + OperationConfig tables
 * with a click-and-run demo against retold-synth-databeacon's bundled
 * `industrial-supply-v1` spec (14 entities, ~46K records). Designed to
 * be either:
 *   (a) run as a one-shot init container after stack launch (the
 *       `seed-synth-demo` component in preset-data-platform-synth-demo)
 *   (b) invoked manually post-launch via `npm run seed-synth-demo`
 *
 * What it seeds (under scope `synth-demo`):
 *
 *   Clones (Extraction, Pull→Write, lazy target-schema creation):
 *     synth-clone-customers     1.5K rows  Customer       → CustomerMirror
 *     synth-clone-orders        5K rows    SalesOrder     → SalesOrderMirror
 *     synth-clone-orderlines    25K rows   SalesOrderLine → SalesOrderLineMirror
 *
 *   Typed-op transforms (run on the cloned lake tables, not on synth
 *   directly — DependsOn lets "Run all in dependency order" run them
 *   in the right sequence):
 *     synth-orders-by-payment-terms   Aggregation
 *     synth-orders-by-month           Histogram
 *     synth-orderline-with-orders     Intersection
 *
 *   Mapping (lake → opdb):
 *     synth-customers-to-opdb-summary  CustomerMirror → CustomerSummary
 *
 * Idempotent: re-runs over the same scope are a no-op (the data-mapper's
 * Hash is unique-per-scope; duplicate POSTs return 409 which we treat
 * as success).
 *
 * Targets the data-mapper REST surface; configure with MAPPER_BASE
 * (default http://localhost:8395 — matches the synth-demo preset's
 * default port 8395 inside the docker network, or :58395 from the host).
 *
 * @author Steven Velozo <steven@velozo.com>
 * @license MIT
 */
'use strict';

const libHttp = require('http');
const libUrl = require('url');

const MAPPER_BASE = process.env.MAPPER_BASE || 'http://localhost:8395';
const SCOPE = process.env.SEED_SCOPE || 'synth-demo';
const READY_RETRIES = parseInt(process.env.SEED_RETRIES || '60', 10);
const READY_DELAY_MS = parseInt(process.env.SEED_DELAY_MS || '2000', 10);

const SOURCE_BEACON = 'synth-databeacon';
const SOURCE_CONNECTION = 'industrial-supply-v1';
const LAKE_BEACON = 'lake-databeacon';
const LAKE_CONNECTION = 'lake-main';
const OPDB_BEACON = 'opdb-databeacon';
const OPDB_CONNECTION = 'opdb-main';
// Typed-op outputs (CachedView_*) land on the dashboard databeacon so
// the dashboards read from a dedicated DB rather than competing with
// the lake's clone-write load. Lake = raw + cloned data; opdb =
// operational mappings; dashboard = aggregated/typed-op results.
const DASHBOARD_BEACON = 'dashboard-databeacon';
const DASHBOARD_CONNECTION = 'dashboard-main';

// ── Records to seed ─────────────────────────────────────────────────

// Clone operations: pure pass-through Extractions. The Projection maps
// every meadow-style field 1:1; the GUID column is reused so each
// clone-row preserves its source identity (Meadow's CollisionRename
// handles the soft-delete-then-reinsert case).
const CLONES =
[
	{
		Hash:                  'synth-clone-customers',
		Name:                  'Clone Customers from synth',
		Description:           '1,500 Customers — pass-through clone into the lake.',
		Entity:                'Customer',
		TargetTable:           'CustomerMirror',
		Projection:
			[
				'IDCustomer', 'GUIDCustomer', 'AccountNumber', 'CompanyName',
				'ContactFirst', 'ContactLast', 'ContactEmail', 'ContactPhone',
				'BillingCity', 'BillingState', 'BillingPostal',
				'PaymentTerms', 'CreditLimitUSD', 'CustomerSince',
				'CreateDate', 'UpdateDate', 'Deleted'
			]
	},
	{
		Hash:                  'synth-clone-orders',
		Name:                  'Clone SalesOrders from synth',
		Description:           '5,000 SalesOrder headers — pass-through clone into the lake.',
		Entity:                'SalesOrder',
		TargetTable:           'SalesOrderMirror',
		Projection:
			[
				'IDSalesOrder', 'GUIDSalesOrder', 'OrderNumber',
				'IDCustomer', 'IDSalesRep',
				'OrderDate', 'ShipDate', 'Status',
				'TotalUSD', 'ShippingUSD', 'TaxUSD', 'Channel',
				'CreateDate', 'UpdateDate', 'Deleted'
			]
	},
	{
		Hash:                  'synth-clone-orderlines',
		Name:                  'Clone SalesOrderLines from synth (25K)',
		Description:           '25,000 SalesOrderLine line items — the big clone. Exercise the bulk-write throughput.',
		Entity:                'SalesOrderLine',
		TargetTable:           'SalesOrderLineMirror',
		Projection:
			[
				'IDSalesOrderLine', 'GUIDSalesOrderLine',
				'IDSalesOrder', 'IDProduct',
				'LineNumber', 'Quantity', 'UnitPriceUSD', 'DiscountPercent', 'ExtendedUSD',
				'CreateDate', 'UpdateDate', 'Deleted'
			]
	}
];

// Typed-op transforms — run on the LAKE-resident cloned tables, NOT
// on synth directly (so they exercise the same path the operator's
// own custom transforms would). DependsOn lets "Run all in dependency
// order" run the clones first.
const TYPED_OPS =
[
	{
		Hash:                  'synth-customers-by-payment-terms',
		Name:                  'Customers by Payment Terms (Aggregation)',
		Description:           'Group cloned Customers by PaymentTerms; count customers + sum credit limits. In-memory layout: pulls all source rows into V8 and aggregates there.',
		OperationType:         'Aggregation',
		Source:                { Beacon: LAKE_BEACON,      Connection: LAKE_CONNECTION,      Entity: 'CustomerMirror' },
		Target:                { Beacon: DASHBOARD_BEACON, Connection: DASHBOARD_CONNECTION, Table: 'CachedView_CustomersByPaymentTerms' },
		DependsOn:             ['synth-clone-customers'],
		OperationConfiguration:
			{
				Entity:        'CachedView_CustomersByPaymentTerms',
				GUIDName:      'GUIDCachedView_CustomersByPaymentTerms',
				GUIDTemplate:  'CBPT_{~D:Record.PaymentTerms~}',
				GroupBy:       ['PaymentTerms'],
				Aggregates:
				[
					{ As: 'CustomerCount',  Op: 'COUNT', Column: '*' },
					{ As: 'TotalCredit',    Op: 'SUM',   Column: 'CreditLimitUSD' },
					{ As: 'AvgCredit',      Op: 'AVG',   Column: 'CreditLimitUSD' },
					{ As: 'MaxCredit',      Op: 'MAX',   Column: 'CreditLimitUSD' }
				]
			}
	},
	{
		Hash:                  'synth-customers-by-payment-terms-sql',
		Name:                  'Customers by Payment Terms (SQLAggregate)',
		Description:           'Same shape as the Aggregation variant — pushes the GROUP BY into the source DB instead of reading every source row into V8. Memory ceiling = group cardinality, not source size.',
		OperationType:         'SQLAggregate',
		Source:                { Beacon: LAKE_BEACON,      Connection: LAKE_CONNECTION,      Entity: 'CustomerMirror' },
		Target:                { Beacon: DASHBOARD_BEACON, Connection: DASHBOARD_CONNECTION, Table: 'CachedView_CustomersByPaymentTerms_SQL' },
		DependsOn:             ['synth-clone-customers'],
		OperationConfiguration:
			{
				Entity:        'CachedView_CustomersByPaymentTerms_SQL',
				GUIDName:      'GUIDCachedView_CustomersByPaymentTerms_SQL',
				GUIDTemplate:  'CBPTSQL_{~D:Record.PaymentTerms~}',
				GroupBy:       ['PaymentTerms'],
				Aggregates:
				[
					{ As: 'CustomerCount',  Op: 'COUNT', Column: '*' },
					{ As: 'TotalCredit',    Op: 'SUM',   Column: 'CreditLimitUSD' },
					{ As: 'AvgCredit',      Op: 'AVG',   Column: 'CreditLimitUSD' },
					{ As: 'MaxCredit',      Op: 'MAX',   Column: 'CreditLimitUSD' }
				]
			}
	},
	{
		Hash:                  'synth-orders-by-month',
		Name:                  'Orders by Month (Histogram)',
		Description:           'Bucket cloned SalesOrders by OrderDate month — see seasonality.',
		OperationType:         'Histogram',
		Source:                { Beacon: LAKE_BEACON,      Connection: LAKE_CONNECTION,      Entity: 'SalesOrderMirror' },
		Target:                { Beacon: DASHBOARD_BEACON, Connection: DASHBOARD_CONNECTION, Table: 'CachedView_OrdersByMonth' },
		DependsOn:             ['synth-clone-orders'],
		OperationConfiguration:
			{
				Entity:        'CachedView_OrdersByMonth',
				GUIDName:      'GUIDCachedView_OrdersByMonth',
				// Use the actual bucket-data field (Month, set by BucketAs)
				// — the HistogramRecords compiler doesn't preserve "BucketKey"
				// in the projected record, so referencing it would collapse
				// every bucket into one row with empty key.
				GUIDTemplate:  'OBM_{~D:Record.Month~}',
				BucketColumn:  'OrderDate',
				BucketKind:    'DateMonth',
				BucketAs:      'Month',
				Aggregates:
				[
					{ As: 'OrderCount',  Op: 'COUNT', Column: '*' },
					{ As: 'TotalRevenue', Op: 'SUM',  Column: 'TotalUSD' }
				]
			}
	},
	{
		Hash:                  'synth-orderline-with-orders',
		Name:                  'OrderLines with Order Headers (Intersection)',
		Description:           'Join SalesOrderLineMirror × SalesOrderMirror by IDSalesOrder. In-memory layout: pulls both sides into V8, hash-joins, writes.',
		OperationType:         'Intersection',
		Source:                { Beacon: LAKE_BEACON,      Connection: LAKE_CONNECTION,      Entity: 'SalesOrderLineMirror' },
		Target:                { Beacon: DASHBOARD_BEACON, Connection: DASHBOARD_CONNECTION, Table: 'CachedView_OrderLinesEnriched' },
		DependsOn:             ['synth-clone-orderlines', 'synth-clone-orders'],
		OperationConfiguration:
			{
				Entity:                'CachedView_OrderLinesEnriched',
				GUIDName:              'GUIDCachedView_OrderLinesEnriched',
				GUIDTemplate:          'OLE_{~D:Record.IDSalesOrderLine~}',
				// Related side stays on lake — the join reads from the
				// cloned headers there. Only the materialized output
				// crosses to the dashboard databeacon.
				RelatedBeaconName:     LAKE_BEACON,
				RelatedConnectionHash: LAKE_CONNECTION,
				RelatedEntity:         'SalesOrderMirror',
				JoinOn:                { SourceField: 'IDSalesOrder', RelatedField: 'IDSalesOrder' },
				Projection:
					{
						IDSalesOrderLine: '{~D:Record.IDSalesOrderLine~}',
						LineNumber:       '{~D:Record.LineNumber~}',
						Quantity:         '{~D:Record.Quantity~}',
						ExtendedUSD:      '{~D:Record.ExtendedUSD~}',
						OrderNumber:      '{~D:Related.OrderNumber~}',
						OrderDate:        '{~D:Related.OrderDate~}',
						OrderStatus:      '{~D:Related.Status~}',
						IDCustomer:       '{~D:Related.IDCustomer~}'
					}
			}
	},
	{
		Hash:                  'synth-orderline-with-orders-sql',
		Name:                  'OrderLines with Order Headers (SQLJoin)',
		Description:           'Same join shape as the Intersection variant — pushes the INNER JOIN into Postgres and pages the result. Memory ceiling = page size, never the source.',
		OperationType:         'SQLJoin',
		Source:                { Beacon: LAKE_BEACON,      Connection: LAKE_CONNECTION,      Entity: 'SalesOrderLineMirror' },
		Target:                { Beacon: DASHBOARD_BEACON, Connection: DASHBOARD_CONNECTION, Table: 'CachedView_OrderLinesEnriched_SQL' },
		DependsOn:             ['synth-clone-orderlines', 'synth-clone-orders'],
		OperationConfiguration:
			{
				Entity:                'CachedView_OrderLinesEnriched_SQL',
				GUIDName:              'GUIDCachedView_OrderLinesEnriched_SQL',
				GUIDTemplate:          'OLESQL_{~D:Record.IDSalesOrderLine~}',
				// SQLJoin requires source + related on the same connection.
				// Both lake mirrors live on lake-databeacon/lake-main, so
				// the JOIN runs entirely in Postgres.
				RelatedEntity:         'SalesOrderMirror',
				JoinOn:                { SourceField: 'IDSalesOrder', RelatedField: 'IDSalesOrder' },
				OrderBy:               'IDSalesOrderLine',
				Projection:
					{
						IDSalesOrderLine: '{~D:Record.IDSalesOrderLine~}',
						LineNumber:       '{~D:Record.LineNumber~}',
						Quantity:         '{~D:Record.Quantity~}',
						ExtendedUSD:      '{~D:Record.ExtendedUSD~}',
						OrderNumber:      '{~D:Related.OrderNumber~}',
						OrderDate:        '{~D:Related.OrderDate~}',
						OrderStatus:      '{~D:Related.Status~}',
						IDCustomer:       '{~D:Related.IDCustomer~}'
					},
				BatchSize: 5000
			}
	}
];

// One mapping from lake to opdb so the Mappings tab isn't empty either.
const MAPPINGS =
[
	{
		Name:                  'CustomerMirror → opdb CustomerSummary',
		Description:           'Project the cloned lake Customers into a smaller opdb table for the operational DB.',
		SourceBeaconName:      LAKE_BEACON,
		SourceConnectionHash:  LAKE_CONNECTION,
		SourceEntity:          'CustomerMirror',
		TargetBeaconName:      OPDB_BEACON,
		TargetConnectionHash:  OPDB_CONNECTION,
		TargetEntity:          'CustomerSummary',
		MappingConfiguration:
			{
				Entity:        'CustomerSummary',
				GUIDName:      'GUIDCustomerSummary',
				GUIDTemplate:  'CSM_{~D:Record.IDCustomer~}',
				Solvers:       [],
				Mappings:
					{
						AccountNumber: '{~D:Record.AccountNumber~}',
						CompanyName:   '{~D:Record.CompanyName~}',
						ContactName:   '{~D:Record.ContactFirst~} {~D:Record.ContactLast~}',
						ContactEmail:  '{~D:Record.ContactEmail~}',
						BillingCity:   '{~D:Record.BillingCity~}',
						PaymentTerms:  '{~D:Record.PaymentTerms~}'
					}
			}
	}
];

// ── Destination table schemas ───────────────────────────────────────
//
// Without these, the lake/opdb databeacons would have no destination
// tables for Pull→Write to upsert into. PUT /1.0/<conn>/<Table>/Upserts
// returns HTTP 405 (no dynamic endpoint registered) even when the
// connection itself exists. We pre-create each table + enable its CRUD
// endpoint here so the demo is fully zero-touch — operator clicks Save &
// Launch once, then "Run all" once, and rows actually land.
//
// Mirror tables mirror the synth source columns 1:1 (the clones are pure
// pass-through Extractions). Cached views match the typed ops' projected
// columns. CustomerSummary matches the Mappings[0] projection above.
//
// Audit columns (IDxxx, GUIDxxx, CreateDate, UpdateDate, Deleted,
// CreatingIDUser, etc.) are added by Meadow's standard "Default" set —
// repeated explicitly here so the schema is self-describing.
function _auditColumns(pTable)
{
	return [
		{ Column: 'ID' + pTable,         Type: 'AutoIdentity', Size: 'Default' },
		{ Column: 'GUID' + pTable,       Type: 'AutoGUID',     Size: '36' },
		{ Column: 'CreateDate',          Type: 'CreateDate',   Size: 'Default' },
		{ Column: 'CreatingIDUser',      Type: 'CreateIDUser', Size: 'int' },
		{ Column: 'UpdateDate',          Type: 'UpdateDate',   Size: 'Default' },
		{ Column: 'UpdatingIDUser',      Type: 'UpdateIDUser', Size: 'int' },
		{ Column: 'Deleted',             Type: 'Deleted',      Size: 'Default' },
		{ Column: 'DeleteDate',          Type: 'DeleteDate',   Size: 'Default' },
		{ Column: 'DeletingIDUser',      Type: 'DeleteIDUser', Size: 'int' }
	];
}

const TABLE_SCHEMAS =
[
	{
		BeaconName: LAKE_BEACON, ConnectionName: LAKE_CONNECTION,
		SchemaName: 'synth-demo-CustomerMirror',
		Table: 'CustomerMirror',
		Columns:
		[
			// Source-side identifiers preserved as regular columns. The
			// table's own AutoIdentity is IDCustomerMirror (added by
			// _auditColumns); IDCustomer/GUIDCustomer here keep the
			// originating row's identity for joins back to the source.
			{ Column: 'IDCustomer',    Type: 'Integer', Size: 'int' },
			{ Column: 'GUIDCustomer',  Type: 'String',  Size: '36'  },
			{ Column: 'AccountNumber', Type: 'String',  Size: '64'  },
			{ Column: 'CompanyName',   Type: 'String',  Size: '200' },
			{ Column: 'ContactFirst',  Type: 'String',  Size: '100' },
			{ Column: 'ContactLast',   Type: 'String',  Size: '100' },
			{ Column: 'ContactEmail',  Type: 'String',  Size: '200' },
			{ Column: 'ContactPhone',  Type: 'String',  Size: '64'  },
			{ Column: 'BillingCity',   Type: 'String',  Size: '120' },
			{ Column: 'BillingState',  Type: 'String',  Size: '8'   },
			{ Column: 'BillingPostal', Type: 'String',  Size: '32'  },
			{ Column: 'PaymentTerms',  Type: 'String',  Size: '32'  },
			{ Column: 'CreditLimitUSD',Type: 'Integer', Size: 'int' },
			{ Column: 'CustomerSince', Type: 'DateTime', Size: 'Default' }
		]
	},
	{
		BeaconName: LAKE_BEACON, ConnectionName: LAKE_CONNECTION,
		SchemaName: 'synth-demo-SalesOrderMirror',
		Table: 'SalesOrderMirror',
		Columns:
		[
			{ Column: 'IDSalesOrder',   Type: 'Integer', Size: 'int' },
			{ Column: 'GUIDSalesOrder', Type: 'String',  Size: '36'  },
			{ Column: 'OrderNumber',    Type: 'String',  Size: '64'  },
			{ Column: 'IDCustomer',     Type: 'Integer', Size: 'int' },
			{ Column: 'IDSalesRep',     Type: 'Integer', Size: 'int' },
			{ Column: 'OrderDate',      Type: 'DateTime', Size: 'Default' },
			{ Column: 'ShipDate',       Type: 'DateTime', Size: 'Default' },
			{ Column: 'Status',         Type: 'String',  Size: '32'  },
			{ Column: 'TotalUSD',       Type: 'Decimal', Size: '14,2'},
			{ Column: 'ShippingUSD',    Type: 'Decimal', Size: '10,2'},
			{ Column: 'TaxUSD',         Type: 'Decimal', Size: '10,2'},
			{ Column: 'Channel',        Type: 'String',  Size: '32'  }
		]
	},
	{
		BeaconName: LAKE_BEACON, ConnectionName: LAKE_CONNECTION,
		SchemaName: 'synth-demo-SalesOrderLineMirror',
		Table: 'SalesOrderLineMirror',
		Columns:
		[
			{ Column: 'IDSalesOrderLine',   Type: 'Integer', Size: 'int' },
			{ Column: 'GUIDSalesOrderLine', Type: 'String',  Size: '36'  },
			{ Column: 'IDSalesOrder',       Type: 'Integer', Size: 'int' },
			{ Column: 'IDProduct',          Type: 'Integer', Size: 'int' },
			{ Column: 'LineNumber',         Type: 'Integer', Size: 'int' },
			{ Column: 'Quantity',           Type: 'Integer', Size: 'int' },
			{ Column: 'UnitPriceUSD',       Type: 'Decimal', Size: '12,2' },
			{ Column: 'DiscountPercent',    Type: 'Integer', Size: 'int' },
			{ Column: 'ExtendedUSD',        Type: 'Decimal', Size: '14,2' }
		]
	},
	{
		BeaconName: DASHBOARD_BEACON, ConnectionName: DASHBOARD_CONNECTION,
		SchemaName: 'synth-demo-CachedView_CustomersByPaymentTerms',
		Table: 'CachedView_CustomersByPaymentTerms',
		Columns:
		[
			{ Column: 'PaymentTerms',   Type: 'String',  Size: '32'   },
			{ Column: 'CustomerCount',  Type: 'Integer', Size: 'int'  },
			{ Column: 'TotalCredit',    Type: 'Decimal', Size: '18,2' },
			{ Column: 'AvgCredit',      Type: 'Decimal', Size: '18,4' },
			{ Column: 'MaxCredit',      Type: 'Integer', Size: 'int'  }
		]
	},
	{
		// Side-by-side target for the SQLAggregate (streaming-layout) variant
		// of Customers-by-Payment-Terms. Same shape as the Aggregation table
		// above so the comparison is apples-to-apples; different name so
		// re-runs of either op don't trample the other's rows.
		BeaconName: DASHBOARD_BEACON, ConnectionName: DASHBOARD_CONNECTION,
		SchemaName: 'synth-demo-CachedView_CustomersByPaymentTerms_SQL',
		Table: 'CachedView_CustomersByPaymentTerms_SQL',
		Columns:
		[
			{ Column: 'PaymentTerms',   Type: 'String',  Size: '32'   },
			{ Column: 'CustomerCount',  Type: 'Integer', Size: 'int'  },
			{ Column: 'TotalCredit',    Type: 'Decimal', Size: '18,2' },
			{ Column: 'AvgCredit',      Type: 'Decimal', Size: '18,4' },
			{ Column: 'MaxCredit',      Type: 'Integer', Size: 'int'  }
		]
	},
	{
		BeaconName: DASHBOARD_BEACON, ConnectionName: DASHBOARD_CONNECTION,
		SchemaName: 'synth-demo-CachedView_OrdersByMonth',
		Table: 'CachedView_OrdersByMonth',
		Columns:
		[
			{ Column: 'BucketKey',     Type: 'String',  Size: '32'   },
			{ Column: 'Month',         Type: 'String',  Size: '32'   },
			{ Column: 'OrderCount',    Type: 'Integer', Size: 'int'  },
			{ Column: 'TotalRevenue',  Type: 'Decimal', Size: '18,2' }
		]
	},
	{
		BeaconName: DASHBOARD_BEACON, ConnectionName: DASHBOARD_CONNECTION,
		SchemaName: 'synth-demo-CachedView_OrderLinesEnriched',
		Table: 'CachedView_OrderLinesEnriched',
		Columns:
		[
			{ Column: 'IDSalesOrderLine', Type: 'Integer', Size: 'int' },
			{ Column: 'LineNumber',       Type: 'Integer', Size: 'int' },
			{ Column: 'Quantity',         Type: 'Integer', Size: 'int' },
			{ Column: 'ExtendedUSD',      Type: 'Decimal', Size: '14,2' },
			{ Column: 'OrderNumber',      Type: 'String',  Size: '64'  },
			// OrderDate stored as String, not DateTime: postgres source
			// returns ISO-8601 with 'T' / 'Z' (e.g. 2024-04-14T22:35:31.224Z)
			// which MySQL's DATETIME column rejects with "Incorrect datetime
			// value". Cross-DB datetime normalization is meadow's
			// responsibility — until that lands upstream, store as a string.
			{ Column: 'OrderDate',        Type: 'String',  Size: '64'  },
			{ Column: 'OrderStatus',      Type: 'String',  Size: '32'  },
			{ Column: 'IDCustomer',       Type: 'Integer', Size: 'int' }
		]
	},
	{
		// Side-by-side target for the SQLJoin (streaming-layout) variant
		// of OrderLines+Orders. Same column shape as the Intersection table
		// so the comparison stays apples-to-apples.
		BeaconName: DASHBOARD_BEACON, ConnectionName: DASHBOARD_CONNECTION,
		SchemaName: 'synth-demo-CachedView_OrderLinesEnriched_SQL',
		Table: 'CachedView_OrderLinesEnriched_SQL',
		Columns:
		[
			{ Column: 'IDSalesOrderLine', Type: 'Integer', Size: 'int' },
			{ Column: 'LineNumber',       Type: 'Integer', Size: 'int' },
			{ Column: 'Quantity',         Type: 'Integer', Size: 'int' },
			{ Column: 'ExtendedUSD',      Type: 'Decimal', Size: '14,2' },
			{ Column: 'OrderNumber',      Type: 'String',  Size: '64'  },
			{ Column: 'OrderDate',        Type: 'String',  Size: '64'  },
			{ Column: 'OrderStatus',      Type: 'String',  Size: '32'  },
			{ Column: 'IDCustomer',       Type: 'Integer', Size: 'int' }
		]
	},
	{
		BeaconName: OPDB_BEACON, ConnectionName: OPDB_CONNECTION,
		SchemaName: 'synth-demo-CustomerSummary',
		Table: 'CustomerSummary',
		Columns:
		[
			{ Column: 'AccountNumber', Type: 'String', Size: '64'  },
			{ Column: 'CompanyName',   Type: 'String', Size: '200' },
			{ Column: 'ContactName',   Type: 'String', Size: '200' },
			{ Column: 'ContactEmail',  Type: 'String', Size: '200' },
			{ Column: 'BillingCity',   Type: 'String', Size: '120' },
			{ Column: 'PaymentTerms',  Type: 'String', Size: '32'  }
		]
	}
];

// One demo DashboardConfig so the Dashboards tab isn't empty. Layout
// renders three list-paged panels backed by the three CachedView_* tables
// produced by the typed-op transforms — operator clicks "Run all" first,
// then opens this dashboard to see the materialized rows.
const DASHBOARDS =
[
	{
		Hash:  'synth-demo-overview',
		Title: 'Synth Demo — Operations Dashboard',
		Layout:
		{
			Type: 'column',
			Children:
			[
				{
					Type:           'list-paged',
					Title:          'Customers by Payment Terms (Aggregation)',
					BeaconName:     DASHBOARD_BEACON,
					ConnectionName: DASHBOARD_CONNECTION,
					// Endpoint is the singular table name — the data-mapper's
					// /dashboard/panel-data handler appends 's' for the meadow
					// plural-collection URL convention.
					Endpoint:       'CachedView_CustomersByPaymentTerms',
					Columns:        ['PaymentTerms', 'CustomerCount', 'TotalCredit', 'AvgCredit', 'MaxCredit'],
					PageSize:       10
				},
				{
					Type:           'list-paged',
					Title:          'Orders by Month (Histogram)',
					BeaconName:     DASHBOARD_BEACON,
					ConnectionName: DASHBOARD_CONNECTION,
					Endpoint:       'CachedView_OrdersByMonth',
					Columns:        ['Month', 'OrderCount', 'TotalRevenue'],
					PageSize:       12
				},
				{
					Type:           'list-paged',
					Title:          'OrderLines with Order Headers (Intersection — first 25 rows)',
					BeaconName:     DASHBOARD_BEACON,
					ConnectionName: DASHBOARD_CONNECTION,
					Endpoint:       'CachedView_OrderLinesEnriched',
					Columns:        ['IDSalesOrderLine', 'OrderNumber', 'OrderDate', 'OrderStatus', 'IDCustomer', 'Quantity', 'ExtendedUSD'],
					PageSize:       25,
					MaxRows:        25
				}
			]
		}
	}
];

// ── HTTP helpers ────────────────────────────────────────────────────

function request(pMethod, pPath, pBody)
{
	let tmpUrl = libUrl.parse(MAPPER_BASE + pPath);
	let tmpData = pBody ? JSON.stringify(pBody) : '';
	let tmpHeaders = { 'Content-Type': 'application/json' };
	if (tmpData) tmpHeaders['Content-Length'] = Buffer.byteLength(tmpData);

	return new Promise((pResolve, pReject) =>
	{
		let tmpReq = libHttp.request(
			{
				hostname: tmpUrl.hostname,
				port:     tmpUrl.port,
				path:     tmpUrl.path,
				method:   pMethod,
				headers:  tmpHeaders
			},
			(pRes) =>
			{
				let tmpBuf = '';
				pRes.on('data', (pChunk) => { tmpBuf += pChunk; });
				pRes.on('end', () =>
				{
					let tmpJson = null;
					try { tmpJson = JSON.parse(tmpBuf); } catch (pErr) { /* not json */ }
					pResolve({ status: pRes.statusCode, body: tmpJson || tmpBuf });
				});
			});
		tmpReq.on('error', pReject);
		if (tmpData) tmpReq.write(tmpData);
		tmpReq.end();
	});
}

async function waitUntilReady()
{
	for (let i = 0; i < READY_RETRIES; i++)
	{
		try
		{
			let tmpRes = await request('GET', '/mapper/operations?scope=' + encodeURIComponent(SCOPE));
			if (tmpRes.status === 200) return true;
			console.log(`  data-mapper not ready yet (status ${tmpRes.status}), retrying…`);
		}
		catch (pErr)
		{
			console.log(`  data-mapper unreachable (${pErr.code || pErr.message}), retrying…`);
		}
		await new Promise((pR) => setTimeout(pR, READY_DELAY_MS));
	}
	throw new Error('data-mapper did not become ready within ' + (READY_RETRIES * READY_DELAY_MS / 1000) + 's');
}

// ── Builders ────────────────────────────────────────────────────────

function buildClone(pClone)
{
	let tmpProjection = {};
	for (let i = 0; i < pClone.Projection.length; i++)
	{
		let tmpCol = pClone.Projection[i];
		tmpProjection[tmpCol] = '{~D:Record.' + tmpCol + '~}';
	}
	// Build the destination GUID from the source's deterministic primary key
	// (RecordIndex+1 in the synth spec) prefixed with the entity name. Earlier
	// versions used '{~D:Record.GUID<Entity>~}' — a straight copy of synth's
	// random GUID — which made the comprehension's dedup-by-GUID silently drop
	// rows on any synth_guid() collision (rare but real at 50K+ rows).
	// Constructing the GUID here makes uniqueness a property of the FORMAT,
	// not of the source's RNG.
	let tmpIDField = 'ID' + pClone.Entity;
	let tmpGUIDPrefix = pClone.Entity.toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_';
	// PassthroughClone — streaming pull-batch + write-batch loop. Different
	// graph layout than Extraction: no Comprehension stage, the State edge
	// never carries the full record array, working memory stays at one
	// batch even at 100x scale (2.5M rows). The destination's GUIDxxxMirror
	// upsert key handles dedup naturally on the write side.
	//
	// SortField is omitted here so the executor's default ('ID' + SourceEntity)
	// kicks in for postgres-backed mirrors. For the synth source it falls
	// back to plain pagination after the first /FilteredTo 404.
	return {
		Hash:                  pClone.Hash,
		Name:                  pClone.Name,
		Description:           pClone.Description,
		OperationType:         'PassthroughClone',
		SourceBeaconName:      SOURCE_BEACON,
		SourceConnectionHash:  SOURCE_CONNECTION,
		SourceEntity:          pClone.Entity,
		TargetBeaconName:      LAKE_BEACON,
		TargetConnectionHash:  LAKE_CONNECTION,
		TargetTable:           pClone.TargetTable,
		Scope:                 SCOPE,
		OperationConfiguration:
			{
				Entity:        pClone.TargetTable,
				GUIDName:      'GUID' + pClone.TargetTable,
				GUIDTemplate:  tmpGUIDPrefix + '{~D:Record.' + tmpIDField + '~}',
				BatchSize:     500,
				Projection:    tmpProjection
			}
	};
}

function buildTypedOp(pOp)
{
	return {
		Hash:                  pOp.Hash,
		Name:                  pOp.Name,
		Description:           pOp.Description,
		OperationType:         pOp.OperationType,
		SourceBeaconName:      pOp.Source.Beacon,
		SourceConnectionHash:  pOp.Source.Connection,
		SourceEntity:          pOp.Source.Entity,
		TargetBeaconName:      pOp.Target.Beacon,
		TargetConnectionHash:  pOp.Target.Connection,
		TargetTable:           pOp.Target.Table,
		Scope:                 SCOPE,
		DependsOn:             pOp.DependsOn || [],
		OperationConfiguration: pOp.OperationConfiguration
	};
}

// ── Schema provisioning ─────────────────────────────────────────────
//
// Resolves ConnectionName→IDBeaconConnection, then dispatches
// EnsureSchema + EnableEndpoint per declared TABLE_SCHEMAS entry.
// Idempotent: EnsureSchema is a no-op when the table already matches;
// EnableEndpoint either flips the table on or reports it was already on.

async function _resolveConnectionId(pBeaconName, pConnectionName)
{
	let tmpRes = await request('GET', '/mapper/beacon/' + encodeURIComponent(pBeaconName) + '/connections');
	if (tmpRes.status !== 200)
	{
		throw new Error('list connections on ' + pBeaconName + ' failed: HTTP ' + tmpRes.status + ' ' + JSON.stringify(tmpRes.body));
	}
	let tmpConns = (tmpRes.body && tmpRes.body.Connections) || [];
	let tmpMatch = tmpConns.find((c) => c && c.Name === pConnectionName);
	if (!tmpMatch)
	{
		throw new Error('no connection named "' + pConnectionName + '" on beacon "' + pBeaconName + '" — bootstrap may not have provisioned it; check the data-mapper logs for [' + pBeaconName + '/' + pConnectionName + ']');
	}
	return tmpMatch.IDBeaconConnection;
}

async function ensureTableSchema(pSchemaSpec)
{
	let tmpId = await _resolveConnectionId(pSchemaSpec.BeaconName, pSchemaSpec.ConnectionName);
	let tmpSchemaJSON =
		{
			SchemaName: pSchemaSpec.SchemaName,
			Version:    1,
			Tables:
			[
				{
					Scope:             pSchemaSpec.Table,
					DefaultIdentifier: 'ID' + pSchemaSpec.Table,
					Domain:            'Default',
					Schema:            _auditColumns(pSchemaSpec.Table).concat(pSchemaSpec.Columns),
					DefaultObject:     {}
				}
			]
		};
	let tmpRes = await request('POST', '/mapper/admin/ensure-schema',
		{
			BeaconName:         pSchemaSpec.BeaconName,
			IDBeaconConnection: tmpId,
			SchemaName:         pSchemaSpec.SchemaName,
			SchemaJSON:         tmpSchemaJSON,
			AutoEnable:         true
		});
	if (tmpRes.status >= 200 && tmpRes.status < 300)
	{
		let tmpReport = tmpRes.body || {};
		let tmpTables = (tmpReport.TablesCreated || []).join(',');
		console.log('  ✓ ' + pSchemaSpec.BeaconName + '/' + pSchemaSpec.ConnectionName + '/' + pSchemaSpec.Table + (tmpTables ? ' (created: ' + tmpTables + ')' : ' (already present)'));
		return { ok: true };
	}
	let tmpMsg = (tmpRes.body && tmpRes.body.Error) || JSON.stringify(tmpRes.body || tmpRes.status);
	console.log('  ✗ ' + pSchemaSpec.BeaconName + '/' + pSchemaSpec.ConnectionName + '/' + pSchemaSpec.Table + ' — HTTP ' + tmpRes.status + ': ' + tmpMsg);
	return { ok: false, error: tmpMsg };
}

// ── Driver ──────────────────────────────────────────────────────────

async function postRecord(pPath, pPayload, pLabel)
{
	let tmpRes = await request('POST', pPath, pPayload);
	if (tmpRes.status >= 200 && tmpRes.status < 300)
	{
		console.log('  ✓ ' + pLabel);
		return { ok: true };
	}
	// Treat unique-hash collisions as success (idempotent re-seed).
	let tmpMsg = (tmpRes.body && tmpRes.body.Error) || JSON.stringify(tmpRes.body || tmpRes.status);
	if (tmpRes.status === 409 || /already exists|duplicate|UNIQUE/i.test(String(tmpMsg)))
	{
		console.log('  · ' + pLabel + ' (already present)');
		return { ok: true };
	}
	console.log('  ✗ ' + pLabel + ' — HTTP ' + tmpRes.status + ': ' + tmpMsg);
	return { ok: false, error: tmpMsg };
}

(async function main()
{
	console.log('Retold Data Mapper — Synth-Demo Seeder');
	console.log('  target:  ' + MAPPER_BASE);
	console.log('  scope:   "' + SCOPE + '"');
	console.log('');
	console.log('Waiting for data-mapper to be ready…');
	await waitUntilReady();
	console.log('  ready.');
	console.log('');

	let tmpFails = 0;

	// Tables first — operations that POST/PUT into a missing table
	// would 405 forever. The data-mapper bootstrap creates the
	// connections; we create the destination tables + endpoints.
	console.log('Ensuring ' + TABLE_SCHEMAS.length + ' destination table(s):');
	for (let i = 0; i < TABLE_SCHEMAS.length; i++)
	{
		try
		{
			let tmpRes = await ensureTableSchema(TABLE_SCHEMAS[i]);
			if (!tmpRes.ok) tmpFails++;
		}
		catch (pErr)
		{
			console.log('  ✗ ' + TABLE_SCHEMAS[i].BeaconName + '/' + TABLE_SCHEMAS[i].ConnectionName + '/' + TABLE_SCHEMAS[i].Table + ' — ' + pErr.message);
			tmpFails++;
		}
	}

	console.log('');
	console.log('Seeding ' + CLONES.length + ' clone operations:');
	for (let i = 0; i < CLONES.length; i++)
	{
		let tmpRes = await postRecord('/mapper/operations', buildClone(CLONES[i]), CLONES[i].Hash);
		if (!tmpRes.ok) tmpFails++;
	}

	console.log('');
	console.log('Seeding ' + TYPED_OPS.length + ' typed-op transforms:');
	for (let i = 0; i < TYPED_OPS.length; i++)
	{
		let tmpRes = await postRecord('/mapper/operations', buildTypedOp(TYPED_OPS[i]), TYPED_OPS[i].Hash);
		if (!tmpRes.ok) tmpFails++;
	}

	console.log('');
	console.log('Seeding ' + MAPPINGS.length + ' mapping(s):');
	for (let i = 0; i < MAPPINGS.length; i++)
	{
		let tmpMapping = Object.assign({}, MAPPINGS[i], { Scope: SCOPE });
		let tmpRes = await postRecord('/mapper/mappings', tmpMapping, MAPPINGS[i].Name);
		if (!tmpRes.ok) tmpFails++;
	}

	console.log('');
	console.log('Seeding ' + DASHBOARDS.length + ' dashboard(s):');
	for (let i = 0; i < DASHBOARDS.length; i++)
	{
		let tmpDash = Object.assign({}, DASHBOARDS[i], { Scope: SCOPE });
		let tmpRes = await postRecord('/mapper/dashboards', tmpDash, DASHBOARDS[i].Hash);
		if (!tmpRes.ok) tmpFails++;
	}

	console.log('');
	if (tmpFails === 0)
	{
		console.log('✓ Seeded successfully. Open the mapper UI and:');
		console.log('  1. Operations tab — set scope to "' + SCOPE + '" or "*"');
		console.log('  2. Click "Run all (in order)" — clones run first, then typed-op transforms.');
		console.log('  3. Mappings tab — one mapping (CustomerMirror → opdb CustomerSummary) is ready to Run after the clone completes.');
		console.log('  4. Dashboards tab — open "Synth Demo — Operations Dashboard" once all clones + typed ops have run.');
		process.exit(0);
	}
	else
	{
		console.error('✗ Seeded with ' + tmpFails + ' failure(s) — see output above.');
		process.exit(1);
	}
})().catch((pErr) =>
{
	console.error('Fatal:', pErr.message || pErr);
	process.exit(1);
});
