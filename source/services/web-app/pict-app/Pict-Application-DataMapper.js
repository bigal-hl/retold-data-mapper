/**
 * Retold DataMapper — Pict Application
 *
 * Shell for the visual mapping editor. Registers the MapperAPI provider
 * and all views, seeds AppData, and renders the Layout view.
 */
const libPictApplication = require('pict-application');

const libMapperAPIProvider = require('./providers/Pict-Provider-MapperAPI.js');
const libLoginHelper = require('./_mapper-login-helper.js');

const libViewLayout = require('./views/PictView-Mapper-Layout.js');
const libViewBeaconBrowser = require('./views/PictView-Mapper-BeaconBrowser.js');
const libViewFieldMapper = require('./views/PictView-Mapper-FieldMapper.js');
const libViewMappingList = require('./views/PictView-Mapper-MappingList.js');
const libViewJSONEditor = require('./views/PictView-Mapper-JSONEditor.js');

class DataMapperApplication extends libPictApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'DataMapperApplication';

		this.pict.addProvider('MapperAPI', libMapperAPIProvider.default_configuration, libMapperAPIProvider);

		this.pict.addView('Mapper-Layout', libViewLayout.default_configuration, libViewLayout);
		this.pict.addView('Mapper-BeaconBrowser', libViewBeaconBrowser.default_configuration, libViewBeaconBrowser);
		this.pict.addView('Mapper-FieldMapper', libViewFieldMapper.default_configuration, libViewFieldMapper);
		this.pict.addView('Mapper-MappingList', libViewMappingList.default_configuration, libViewMappingList);
		this.pict.addView('Mapper-JSONEditor', libViewJSONEditor.default_configuration, libViewJSONEditor);

		// Beacon login overlay + boot-gate helper.  Shared across every
		// data-mapper shell; see _mapper-login-helper.js.
		libLoginHelper.install(this);
	}

	onAfterInitializeAsync(fCallback)
	{
		if (!this.pict.AppData) this.pict.AppData = {};

		this.pict.AppData.Mapper =
		{
			UltravisorURL: '',
			UltravisorStatus: 'Disconnected',
			UltravisorStatusLabel: 'Disconnected',
			UltravisorBadgeClass: 'badge-neutral',

			Beacons: [],
			SourceBeacons: [],
			TargetBeacons: [],

			SourceBeaconName: '',
			SourceConnections: [],
			SourceConnectionID: null,
			SourceConnectionHash: '',
			SourceEntities: [],
			SourceEntity: '',
			SourceFields: [],

			TargetBeaconName: '',
			TargetConnections: [],
			TargetConnectionID: null,
			TargetConnectionHash: '',
			TargetEntities: [],
			TargetEntity: '',
			TargetFields: [],

			SelectedSourceField: '',
			Mappings: [],
			SavedMappings: [],

			ActivePanel: 'mapper',  // mapper | mappings | json

			StatusMessage: 'Ready',
			JSONText: ''
		};

		if (typeof window !== 'undefined') window.DataMapperApp = this;

		this.pict.views['Mapper-Layout'].render();

		// Boot gate: poll /status and overlay the login screen when UV
		// is in authenticated mode.  Non-blocking — runs in parallel
		// with the data loads below.
		libLoginHelper.gate(this);

		let tmpProvider = this.pict.providers.MapperAPI;
		if (tmpProvider)
		{
			tmpProvider.loadUltravisorStatus(() =>
			{
				tmpProvider.loadBeacons();
				tmpProvider.loadSavedMappings();
			});
		}

		return super.onAfterInitializeAsync(fCallback);
	}

	setActivePanel(pPanelName)
	{
		if (this.pict.views['Mapper-Layout'] && typeof this.pict.views['Mapper-Layout'].setActivePanel === 'function')
		{
			this.pict.views['Mapper-Layout'].setActivePanel(pPanelName);
		}
	}
}

module.exports = DataMapperApplication;
module.exports.default_configuration = {};
