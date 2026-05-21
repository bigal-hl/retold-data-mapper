/**
 * Retold DataMapper — Mapping Shell Pict Application
 *
 * One-view application that mounts pict-section-mapping in `manage`
 * mode. Used by mappings.html. The visual field-mapping editor lives
 * separately at index.html (DataMapperApplication); this shell is the
 * lightweight CRUD-and-Run surface.
 */
const libPictApplication = require('pict-application');
const libSectionMapping = require('./vendor/pict-section-mapping/source/Pict-Section-Mapping.js');
const libSectionModal = require('pict-section-modal');
const libLoginHelper = require('./_mapper-login-helper.js');

class MappingShellApplication extends libPictApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'MappingShellApplication';

		this.pict.addView('Modal', {}, libSectionModal);

		this.pict.addView(
			'Mappings',
			Object.assign({}, libSectionMapping.default_configuration,
				{
					// Section reads `DefaultDestinationAddress` (per its
					// default config). Setting `ContentDestinationAddress`
					// here was a quiet no-op — section kept mounting at its
					// default `#Pict-Section-Mapping` element which the page
					// HTML doesn't have, so the "Loading mappings…"
					// placeholder in `#mapping-section` never got replaced.
					DefaultDestinationAddress: '#mapping-section',
					APIBaseUrl:                '/mapper',
					Mode:                      'manage',
					ShowToolbar:               true,
					AutoRender:                true
				}),
			libSectionMapping);

		libLoginHelper.install(this);
	}

	onAfterInitializeAsync(fCallback)
	{
		if (this.pict.views && this.pict.views.Mappings)
		{
			this.pict.views.Mappings.render();
		}
		libLoginHelper.gate(this);
		return super.onAfterInitializeAsync(fCallback);
	}
}

module.exports = MappingShellApplication;
