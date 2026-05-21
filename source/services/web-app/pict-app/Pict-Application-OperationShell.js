/**
 * Retold DataMapper — Operation Shell Pict Application
 *
 * One-view application that mounts pict-section-operation in `manage`
 * mode. Used by operations.html. Replaces the prior 434-line vanilla-JS
 * hand-rolled editor that lived in operations.html itself.
 *
 * The section handles list / edit / run / delete + tabbed type filter;
 * this shell only registers it against the page's destination div and
 * makes pict-section-modal available so the section's confirms / toasts
 * / show calls have a real implementation rather than the no-op fallback.
 */
const libPictApplication = require('pict-application');
const libSectionOperation = require('./vendor/pict-section-operation/source/Pict-Section-Operation.js');
const libSectionModal = require('pict-section-modal');
const libLoginHelper = require('./_mapper-login-helper.js');

class OperationShellApplication extends libPictApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'OperationShellApplication';

		this.pict.addView('Modal', {}, libSectionModal);

		this.pict.addView(
			'Pict-Section-Operation',
			Object.assign({}, libSectionOperation.default_configuration,
				{
					DefaultDestinationAddress: '#operation-section',
					APIBaseUrl:                '/mapper',
					Mode:                      'manage',
					ShowToolbar:               true,
					AutoRender:                true
				}),
			libSectionOperation);

		libLoginHelper.install(this);
	}

	onAfterInitializeAsync(fCallback)
	{
		if (this.pict.views && this.pict.views['Pict-Section-Operation'])
		{
			this.pict.views['Pict-Section-Operation'].render();
		}
		libLoginHelper.gate(this);
		return super.onAfterInitializeAsync(fCallback);
	}
}

module.exports = OperationShellApplication;
