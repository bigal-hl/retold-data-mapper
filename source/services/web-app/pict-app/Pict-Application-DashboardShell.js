/**
 * Retold DataMapper — Dashboard Shell Pict Application
 *
 * One-view application that mounts pict-section-dashboard in `manage`
 * mode. Used by dashboards.html. The same section is also available
 * for embedding into other Pict applications (set Mode='render-only'
 * to hide the CRUD chrome and just render dashboards in place).
 */
const libPictApplication = require('pict-application');
const libSectionDashboard = require('./vendor/pict-section-dashboard/source/Pict-Section-Dashboard.js');
const libSectionModal = require('pict-section-modal');
const libLoginHelper = require('./_mapper-login-helper.js');

class DashboardShellApplication extends libPictApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'DashboardShellApplication';

		// Modal/toast section — pict-section-dashboard uses it for delete
		// confirmations and success toasts. Registering under the name
		// 'Modal' matches the lookup pattern in the section
		// (this.pict.views.Modal).
		this.pict.addView('Modal', {}, libSectionModal);

		this.pict.addView(
			'Dashboards',
			Object.assign({}, libSectionDashboard.default_configuration,
				{
					// pict-section-dashboard reads `ContentDestinationAddress`
					// at render time (Pict-Section-Dashboard.js:155). Setting
					// only DefaultDestinationAddress here was a no-op — the
					// section fell back to '#Pict-Section-Dashboard' (the
					// default) which doesn't exist in dashboards.html, so
					// the page hung at the "Loading dashboards…" placeholder
					// forever. Set both keys so consumers using either
					// convention get the correct mount point.
					ContentDestinationAddress: '#dashboard-section',
					DefaultDestinationAddress: '#dashboard-section',
					APIBaseUrl:                '/mapper',
					Mode:                      'manage',
					ShowToolbar:               true,
					AutoRender:                true
				}),
			libSectionDashboard);

		// Beacon login overlay + boot-gate helper (shared across all
		// data-mapper shells; see _mapper-login-helper.js).
		libLoginHelper.install(this);
	}

	onAfterInitializeAsync(fCallback)
	{
		// First render paints the section into #dashboard-section. The
		// section's own onAfterRender takes over from there.
		if (this.pict.views && this.pict.views.Dashboards)
		{
			this.pict.views.Dashboards.render();
		}
		libLoginHelper.gate(this);
		return super.onAfterInitializeAsync(fCallback);
	}
}

module.exports = DashboardShellApplication;
