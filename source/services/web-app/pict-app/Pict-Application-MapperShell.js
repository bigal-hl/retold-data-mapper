/**
 * Retold DataMapper — Cohesive MapperShell Application
 *
 * Single-page app that mounts all four mapper sections behind a top-nav:
 *   Connections (placeholder for Phase 4) | Mappings | Operations | Dashboards
 *
 * State (pict.AppData.MapperShell):
 *   ActiveTab    — 'connections' | 'mappings' | 'operations' | 'dashboards'
 *   Scope        — string; pushed into all four section providers
 *   Tabs         — TopNav's pre-decorated tab records (built in onBeforeRender)
 *
 * The shell's main viewport renders the layout (top-nav slot + four
 * destination divs); each section is registered with a destination
 * address pointing at its own div. CSS on the shell root toggles which
 * section pane is visible based on `data-active-tab`. Sections stay
 * mounted between tab switches — no rebuild churn.
 */
'use strict';

const libPictApplication = require('pict-application');

const libSectionMapping   = require('./vendor/pict-section-mapping/source/Pict-Section-Mapping.js');
const libSectionOperation = require('./vendor/pict-section-operation/source/Pict-Section-Operation.js');
const libSectionDashboard = require('./vendor/pict-section-dashboard/source/Pict-Section-Dashboard.js');
const libSectionModal     = require('pict-section-modal');

const libLayoutView      = require('./views/PictView-MapperShell-Layout.js');
const libTopNavView      = require('./views/PictView-MapperShell-TopNav.js');
const libConnectionsView = require('./views/PictView-MapperShell-Connections.js');
const libLoginHelper     = require('./_mapper-login-helper.js');

const SCOPE_STORAGE_KEY = 'retold.dataMapper.activeScope';

const _DefaultConfiguration =
{
	Name:                                'MapperShell',
	MainViewportViewIdentifier:          'MapperShell-Layout',
	MainViewportRenderableHash:          'MapperShell-Layout-Renderable',
	MainViewportDestinationAddress:      '#MapperShell',
	AutoSolveAfterInitialize:            true,
	AutoRenderMainViewportViewAfterInitialize: true
};

class MapperShellApplication extends libPictApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DefaultConfiguration, pOptions || {});
		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'MapperShellApplication';

		this._seedAppData();

		// Modal first — sections look it up under 'Pict-Section-Modal' or 'Modal'.
		this.pict.addView('Modal', {}, libSectionModal);

		// Layout, top-nav, and connections placeholder.
		this.pict.addView('MapperShell-Layout',      libLayoutView.default_configuration,      libLayoutView);
		this.pict.addView('MapperShell-TopNav',      libTopNavView.default_configuration,      libTopNavView);
		this.pict.addView('MapperShell-Connections', libConnectionsView.default_configuration, libConnectionsView);

		// Three sections — each pointed at its own destination div within the layout.
		// Same shared scope (read from localStorage) so the picker in the top-nav
		// hits all of them at once.
		// Section configs read DefaultDestinationAddress as the view-level
		// destination; ContentDestinationAddress is a per-renderable concept
		// and is a no-op at this level. Setting only the right key keeps
		// the override surface honest.
		this.pict.addView(
			'Pict-Section-Mapping',
			Object.assign({}, libSectionMapping.default_configuration,
				{
					DefaultDestinationAddress: '#MapperShell-Mappings',
					APIBaseUrl:                '/mapper',
					Mode:                      'manage',
					ShowToolbar:               false,    // shell owns the scope picker
					AutoRender:                false
				}),
			libSectionMapping);

		this.pict.addView(
			'Pict-Section-Operation',
			Object.assign({}, libSectionOperation.default_configuration,
				{
					DefaultDestinationAddress: '#MapperShell-Operations',
					APIBaseUrl:                '/mapper',
					Mode:                      'manage',
					ShowToolbar:               false,
					AutoRender:                false
				}),
			libSectionOperation);

		this.pict.addView(
			'Pict-Section-Dashboard',
			Object.assign({}, libSectionDashboard.default_configuration,
				{
					DefaultDestinationAddress: '#MapperShell-Dashboards',
					APIBaseUrl:                '/mapper',
					Mode:                      'manage',
					ShowToolbar:               false,
					AutoRender:                false
				}),
			libSectionDashboard);

		// Beacon login overlay + boot-gate (shared with the other
		// data-mapper shells; see _mapper-login-helper.js).
		libLoginHelper.install(this);
	}

	_seedAppData()
	{
		if (!this.pict.AppData) this.pict.AppData = {};
		this.pict.AppData.MapperShell =
			{
				ActiveTab:    'mappings',           // start on Mappings (most-used surface)
				Scope:        this._readScope(),
				Tabs:         []
			};
	}

	_readScope()
	{
		try
		{
			if (typeof localStorage !== 'undefined')
			{
				let tmpStored = localStorage.getItem(SCOPE_STORAGE_KEY);
				if (tmpStored !== null) return tmpStored;
			}
		}
		catch (pErr) { /* opaque origin — fall through */ }
		return '';
	}

	_writeScope(pScope)
	{
		try
		{
			if (typeof localStorage !== 'undefined')
			{
				if (pScope) localStorage.setItem(SCOPE_STORAGE_KEY, pScope);
				else localStorage.removeItem(SCOPE_STORAGE_KEY);
			}
		}
		catch (pErr) { /* opaque origin — keep in-memory only */ }
	}

	// ── Lifecycle ────────────────────────────────────────────────────

	// Called by the layout view's onAfterRender (the only point at which
	// the destination divs are guaranteed to be in the DOM). The
	// application's own onAfterInitializeAsync fires *before* the
	// main-viewport auto-render lands, so wiring children here instead.
	renderChildren()
	{
		if (this.pict.views['MapperShell-TopNav']) this.pict.views['MapperShell-TopNav'].render();
		this._renderActiveSection();
		// Boot gate runs once layout children are guaranteed in the DOM
		// — same timing as the section renders, which means the overlay
		// will stack on top of whatever finished painting just before.
		libLoginHelper.gate(this);
	}

	// ── Public API (called from inline handlers in TopNav) ───────────

	selectTab(pKey)
	{
		this.pict.AppData.MapperShell.ActiveTab = pKey;
		// Re-render the layout so its `data-active-tab` attribute updates
		// (CSS uses it to swap which pane is visible). Then re-render
		// the top-nav so the active tab styling flips. Finally trigger
		// the active section's render in case it hasn't loaded yet.
		if (this.pict.views['MapperShell-Layout']) this.pict.views['MapperShell-Layout'].render();
		if (this.pict.views['MapperShell-TopNav']) this.pict.views['MapperShell-TopNav'].render();
		this._renderActiveSection();
	}

	onScopeInput(pValue)
	{
		let tmpValue = (pValue == null) ? '' : String(pValue).trim();
		this.pict.AppData.MapperShell.Scope = tmpValue;
		this._writeScope(tmpValue);

		// Push scope into each section's API provider, then re-render
		// whichever sections have already loaded so they reflect the new
		// scope's data.
		this._pushScopeIntoSections(tmpValue);
		this._renderActiveSection();
	}

	_pushScopeIntoSections(pScope)
	{
		let tmpKeys = ['Pict-Section-Mapping', 'Pict-Section-Operation', 'Pict-Section-Dashboard'];
		for (let i = 0; i < tmpKeys.length; i++)
		{
			let tmpView = this.pict.views[tmpKeys[i]];
			if (tmpView && tmpView._API && typeof tmpView._API.setScope === 'function')
			{
				tmpView._API.setScope(pScope);
			}
		}
	}

	_renderActiveSection()
	{
		let tmpActive = this.pict.AppData.MapperShell.ActiveTab;
		let tmpView = null;
		switch (tmpActive)
		{
			case 'connections': tmpView = this.pict.views['MapperShell-Connections']; break;
			case 'mappings':    tmpView = this.pict.views['Pict-Section-Mapping'];    break;
			case 'operations':  tmpView = this.pict.views['Pict-Section-Operation'];  break;
			case 'dashboards':  tmpView = this.pict.views['Pict-Section-Dashboard'];  break;
		}
		if (tmpView && typeof tmpView.render === 'function') tmpView.render();
	}
}

module.exports = MapperShellApplication;
module.exports.default_configuration = _DefaultConfiguration;
