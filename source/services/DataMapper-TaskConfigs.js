/**
 * DataMapper Task Configs
 *
 * Exports an array of { Definition, Execute } config objects suitable
 * for Ultravisor's TaskTypeRegistry.registerTaskTypesFromConfigArray().
 *
 * Each entry pairs a JSON task-type definition with its executor
 * function. When registered, these appear as cards in the Ultravisor
 * flow editor palette under the "Data Mapper" capability.
 *
 * @author Steven Velozo <steven@velozo.com>
 * @license MIT
 */

module.exports =
[
	{
		Definition: require('./definitions/data-mapper-source.json'),
		Execute: require('./executors/Execute-Source.js')
	},
	{
		Definition: require('./definitions/data-mapper-pull-records.json'),
		Execute: require('./executors/Execute-PullRecords.js')
	},
	{
		Definition: require('./definitions/data-mapper-record-gen.json'),
		Execute: require('./executors/Execute-RecordGen.js')
	},
	{
		Definition: require('./definitions/data-mapper-comprehension.json'),
		Execute: require('./executors/Execute-Comprehension.js')
	},
	{
		Definition: require('./definitions/data-mapper-write-target.json'),
		Execute: require('./executors/Execute-WriteTarget.js')
	},
	{
		Definition: require('./definitions/data-mapper-write-target-raw.json'),
		Execute: require('./executors/Execute-WriteTargetRaw.js')
	}
];
