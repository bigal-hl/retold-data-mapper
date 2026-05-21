/**
 * _mapper-login-helper — single-line login wiring for data-mapper shells
 *
 * The data-mapper ships five HTML pages (index, app, dashboards,
 * mappings, operations) each loading a different shell application
 * from the same browserify bundle.  This helper keeps the
 * pict-section-login + boot-gate wiring identical across all of them
 * without copy-pasting fifty lines into each shell.
 *
 * Each shell calls `install(this)` from its constructor (after view
 * registrations), then `gate(this, cb)` from `onAfterInitializeAsync`.
 *
 *   install(pApp): registers pict-section-login + the overlay wrapper
 *                  view + hooks; safe to call once per app instance.
 *   gate(pApp, fCb): runs the /status fetch + shows/hides the overlay
 *                  based on auth mode.  fCb fires once gate work is
 *                  done (does not block on it).
 *
 * The overlay div (#DataMapper-Login-Overlay) is mounted in <body> by
 * install(); the wrapper view targets it.  CSS for the overlay is
 * shipped on the wrapper view's configuration so a single registration
 * covers every shell.
 */

const libPictView = require('pict-view');
const libPictSectionLogin = require('pict-section-login');
const libBeaconWebAuthClient = require('ultravisor-beacon/webinterface/Pict-Beacon-WebAuth-Client.js');

const _LoginViewConfig =
{
	ViewIdentifier: 'DataMapper-Login',
	AutoInitialize: true,
	AutoRender: false,
	DefaultRenderable: 'DataMapper-Login-Overlay',
	DefaultDestinationAddress: '#DataMapper-Login-Overlay',
	Templates:
	[
		{
			Hash: 'DataMapper-Login-Overlay-Template',
			Template: /*html*/`<div class="data-mapper-login-overlay-card"><div id="Pict-Login-Container"></div></div>`
		}
	],
	Renderables:
	[
		{
			RenderableHash: 'DataMapper-Login-Overlay',
			TemplateHash: 'DataMapper-Login-Overlay-Template',
			ContentDestinationAddress: '#DataMapper-Login-Overlay',
			RenderMethod: 'replace'
		}
	],
	CSS: /*css*/`
		#DataMapper-Login-Overlay
		{
			position: fixed; inset: 0; z-index: 9999; display: none;
			background: rgba(15, 19, 26, 0.92);
			align-items: center; justify-content: center; padding: 24px; overflow: auto;
		}
		#DataMapper-Login-Overlay.is-active { display: flex; }
		.data-mapper-login-overlay-card { width: 100%; max-width: 420px; }
	`
};

class DataMapperLoginView extends libPictView
{
	onAfterRender(pRenderable, pAddress, pRecord, pContent)
	{
		let tmpInner = this.pict && this.pict.views && this.pict.views['Pict-Section-Login'];
		if (tmpInner) { tmpInner.render(); }
		this.pict.CSSMap.injectCSS();
		return super.onAfterRender
			? super.onAfterRender(pRenderable, pAddress, pRecord, pContent)
			: undefined;
	}
}

function _ensureOverlayMount()
{
	if (typeof document === 'undefined') { return; }
	if (document.getElementById('DataMapper-Login-Overlay')) { return; }
	let tmpDiv = document.createElement('div');
	tmpDiv.id = 'DataMapper-Login-Overlay';
	document.body.appendChild(tmpDiv);
}

function _show()
{
	let tmpEl = (typeof document !== 'undefined') && document.getElementById('DataMapper-Login-Overlay');
	if (tmpEl) { tmpEl.classList.add('is-active'); }
}

function _hide()
{
	let tmpEl = (typeof document !== 'undefined') && document.getElementById('DataMapper-Login-Overlay');
	if (tmpEl) { tmpEl.classList.remove('is-active'); }
}

/**
 * Register the login wrapper view + pict-section-login + the boot-gate
 * client helper on the given Pict application's `pict` instance.  Stores
 * the helper handle on the app as `_WebAuthClient` so `gate()` can call
 * loadAuthStatus on it later.  Idempotent per Pict instance (registers
 * the views only once).
 */
function install(pApp)
{
	if (!pApp || !pApp.pict) { return; }
	let tmpPict = pApp.pict;
	if (!tmpPict.views || !tmpPict.views['DataMapper-Login'])
	{
		tmpPict.addView('DataMapper-Login', _LoginViewConfig, DataMapperLoginView);
	}
	pApp._WebAuthClient = libBeaconWebAuthClient.install(tmpPict,
		{
			Section:              libPictSectionLogin,
			AuthStateAddress:     'AppData.DataMapper.Auth',
			LoginRoute:           'DataMapper-Login',
			HomeRoute:            '',
			StatusURL:            '/status',
			LoginEndpoint:        '/1.0/Authenticate',
			LogoutEndpoint:       '/1.0/Deauthenticate',
			CheckSessionEndpoint: '/1.0/CheckSession',
			OnAfterLogin:         () => _hide(),
			OnAfterLogout:        () => _show(),
			OnSessionChecked:     (pSess) => { if (!(pSess && pSess.LoggedIn)) { _show(); } else { _hide(); } }
		});
}

/**
 * Mount the overlay container, fetch /status, and show the overlay
 * when UV is in authenticated mode.  Calls fCallback (may be omitted)
 * once the status fetch resolves.
 */
function gate(pApp, fCallback)
{
	_ensureOverlayMount();
	if (!pApp || !pApp._WebAuthClient)
	{
		if (typeof fCallback === 'function') { fCallback(null); }
		return;
	}
	pApp._WebAuthClient.loadAuthStatus((pErr) =>
		{
			if (pErr && pApp.pict && pApp.pict.log)
			{
				pApp.pict.log.warn('[DataMapper login] /status fetch failed: ' + pErr.message);
			}
			let tmpAuth = (pApp.pict.AppData.DataMapper && pApp.pict.AppData.DataMapper.Auth) || {};
			if (tmpAuth.Mode === 'authenticated')
			{
				_show();
				let tmpLoginView = pApp.pict.views['DataMapper-Login'];
				if (tmpLoginView) { tmpLoginView.render(); }
			}
			if (typeof fCallback === 'function') { fCallback(null); }
		});
}

module.exports = { install, gate };
