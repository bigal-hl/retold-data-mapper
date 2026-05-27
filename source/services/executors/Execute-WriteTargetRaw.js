/**
 * Executor: Write to Target Beacon (Raw JSON) (data-mapper-write-target-raw)
 *
 * Iterates the comprehension and POSTs each record to the target
 * entity on a DataBeacon via MeadowProxy:Request, wrapping each record
 * into the raw-archive row shape:
 *   { Identity, RawJSON, RecordMD5, IngestedAt, SourceTable }
 *
 * Mirrors Execute-WriteTarget.js record-by-record dispatch; only the
 * payload-shaping step differs.
 *
 * @author Steven Velozo <steven@velozo.com>
 * @license MIT
 */

const libCrypto = require('crypto');

function _getService(pTask, pTypeName)
{
	return pTask.fable.servicesMap[pTypeName]
		? Object.values(pTask.fable.servicesMap[pTypeName])[0]
		: null;
}

function _md5Hex(pString)
{
	return libCrypto.createHash('md5').update(pString).digest('hex');
}

function Execute(pTask, pResolvedSettings, pExecutionContext, fCallback)
{
	let tmpCoordinator = _getService(pTask, 'UltravisorBeaconCoordinator');

	if (!tmpCoordinator)
	{
		return fCallback(null, {
			EventToFire: 'Error',
			Outputs: { Written: 0, Errors: 0, ErrorLog: [] },
			Log: ['Write Target Raw: BeaconCoordinator service not found.']
		});
	}

	let tmpBeaconName = pResolvedSettings.BeaconName;
	let tmpConnectionHash = pResolvedSettings.ConnectionHash;
	let tmpEntity = pResolvedSettings.Entity;
	let tmpComprehension = pResolvedSettings.Comprehension;
	let tmpIdentityField = pResolvedSettings.IdentityField || '';
	let tmpSourceTable = pResolvedSettings.SourceTable || '';
	let tmpSyncMode = pResolvedSettings.SyncMode || 'InsertOnly';

	if (!tmpBeaconName || !tmpConnectionHash || !tmpEntity)
	{
		return fCallback(null, {
			EventToFire: 'Error',
			Outputs: { Written: 0, Errors: 0, ErrorLog: [] },
			Log: ['Write Target Raw: BeaconName, ConnectionHash, and Entity are all required.']
		});
	}

	if (!tmpComprehension || typeof (tmpComprehension) !== 'object')
	{
		return fCallback(null, {
			EventToFire: 'Error',
			Outputs: { Written: 0, Errors: 0, ErrorLog: [] },
			Log: ['Write Target Raw: Comprehension is required.']
		});
	}

	// Find the entity sub-object inside the comprehension. The first key
	// match wins to tolerate consumers passing either { TargetEntity: ... }
	// or { SourceEntity: ... } — the raw write doesn't need the comprehension
	// key to match the destination table name.
	let tmpEntityData = tmpComprehension[tmpEntity];
	if (!tmpEntityData || typeof (tmpEntityData) !== 'object')
	{
		let tmpKeys = Object.keys(tmpComprehension);
		for (let i = 0; i < tmpKeys.length; i++)
		{
			if (tmpComprehension[tmpKeys[i]] && typeof (tmpComprehension[tmpKeys[i]]) === 'object')
			{
				tmpEntityData = tmpComprehension[tmpKeys[i]];
				break;
			}
		}
	}

	let tmpSourceRecords = [];
	let tmpSourceKeys = [];
	if (tmpEntityData && typeof (tmpEntityData) === 'object')
	{
		let tmpKeys = Object.keys(tmpEntityData);
		for (let i = 0; i < tmpKeys.length; i++)
		{
			tmpSourceKeys.push(tmpKeys[i]);
			tmpSourceRecords.push(tmpEntityData[tmpKeys[i]]);
		}
	}

	if (tmpSourceRecords.length === 0)
	{
		return fCallback(null, {
			EventToFire: 'Complete',
			Outputs: { Written: 0, Errors: 0, ErrorLog: [] },
			Log: [`Write Target Raw: no records in comprehension for entity [${tmpEntity}].`]
		});
	}

	let tmpIngestedAt = new Date().toISOString();

	let tmpWritten = 0;
	let tmpErrors = 0;
	let tmpErrorLog = [];
	let tmpRecordIndex = 0;

	let fWriteNext = () =>
	{
		if (tmpRecordIndex >= tmpSourceRecords.length)
		{
			let tmpHasErrors = tmpErrors > 0;
			return fCallback(null, {
				EventToFire: tmpHasErrors ? 'Error' : 'Complete',
				Outputs: { Written: tmpWritten, Errors: tmpErrors, ErrorLog: tmpErrorLog },
				Log: [`Write Target Raw: ${tmpWritten} written, ${tmpErrors} errors out of ${tmpSourceRecords.length} records on beacon [${tmpBeaconName}] entity [${tmpEntity}] sourceTable [${tmpSourceTable}].`]
			});
		}

		let tmpSourceRecord = tmpSourceRecords[tmpRecordIndex];
		let tmpComprehensionKey = tmpSourceKeys[tmpRecordIndex];
		tmpRecordIndex++;

		let tmpIdentity = null;
		if (tmpIdentityField && tmpSourceRecord && Object.prototype.hasOwnProperty.call(tmpSourceRecord, tmpIdentityField))
		{
			tmpIdentity = tmpSourceRecord[tmpIdentityField];
		}
		if (tmpIdentity === null || typeof (tmpIdentity) === 'undefined')
		{
			tmpIdentity = tmpComprehensionKey;
		}

		let tmpRawJSON = JSON.stringify(tmpSourceRecord);
		let tmpRecordMD5 = _md5Hex(tmpRawJSON);

		let tmpRawRecord =
		{
			Identity:    tmpIdentity,
			RawJSON:     tmpRawJSON,
			RecordMD5:   tmpRecordMD5,
			IngestedAt:  tmpIngestedAt,
			SourceTable: tmpSourceTable
		};

		let tmpPath = `/1.0/${tmpConnectionHash}/${tmpEntity}`;
		let tmpWorkItem = {
			Capability: 'MeadowProxy',
			Action: 'Request',
			Settings:
			{
				Method: 'POST',
				Path: tmpPath,
				Body: JSON.stringify(tmpRawRecord),
				RemoteUser: ''
			},
			AffinityKey: tmpBeaconName,
			TimeoutMs: 30000
		};

		tmpCoordinator.dispatchAndWait(tmpWorkItem,
			(pError, pResult) =>
			{
				if (pError)
				{
					tmpErrors++;
					tmpErrorLog.push({ Index: tmpRecordIndex - 1, Error: pError.message });
				}
				else
				{
					let tmpOutputs = (pResult && pResult.Outputs) || pResult || {};
					let tmpStatus = tmpOutputs.Status;
					if (typeof (tmpStatus) === 'number' && tmpStatus >= 400)
					{
						tmpErrors++;
						tmpErrorLog.push({ Index: tmpRecordIndex - 1, Error: `HTTP ${tmpStatus}` });
					}
					else
					{
						tmpWritten++;
					}
				}

				fWriteNext();
			});
	};

	fWriteNext();
}

module.exports = Execute;
