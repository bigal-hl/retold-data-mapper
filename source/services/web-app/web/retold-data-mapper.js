"use strict";(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f();}else if(typeof define==="function"&&define.amd){define([],f);}else{var g;if(typeof window!=="undefined"){g=window;}else if(typeof global!=="undefined"){g=global;}else if(typeof self!=="undefined"){g=self;}else{g=this;}g.retoldDataMapper=f();}})(function(){var define,module,exports;return function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a;}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r);},p,p.exports,r,e,n,t);}return n[i].exports;}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o;}return r;}()({1:[function(require,module,exports){module.exports={"name":"fable-serviceproviderbase","version":"3.0.19","description":"Simple base classes for fable services.","main":"source/Fable-ServiceProviderBase.js","scripts":{"start":"node source/Fable-ServiceProviderBase.js","test":"npx quack test","tests":"npx quack test -g","coverage":"npx quack coverage","build":"npx quack build","types":"tsc -p ./tsconfig.build.json","check":"tsc -p . --noEmit"},"types":"types/source/Fable-ServiceProviderBase.d.ts","mocha":{"diff":true,"extension":["js"],"package":"./package.json","reporter":"spec","slow":"75","timeout":"5000","ui":"tdd","watch-files":["source/**/*.js","test/**/*.js"],"watch-ignore":["lib/vendor"]},"repository":{"type":"git","url":"https://github.com/stevenvelozo/fable-serviceproviderbase.git"},"keywords":["entity","behavior"],"author":"Steven Velozo <steven@velozo.com> (http://velozo.com/)","license":"MIT","bugs":{"url":"https://github.com/stevenvelozo/fable-serviceproviderbase/issues"},"homepage":"https://github.com/stevenvelozo/fable-serviceproviderbase","devDependencies":{"@types/mocha":"^10.0.10","fable":"^3.1.62","quackage":"^1.0.58","typescript":"^5.9.3"}};},{}],2:[function(require,module,exports){/**
* Fable Service Base
* @author <steven@velozo.com>
*/const libPackage=require('../package.json');class FableServiceProviderBase{/**
	 * The constructor can be used in two ways:
	 * 1) With a fable, options object and service hash (the options object and service hash are optional)a
	 * 2) With an object or nothing as the first parameter, where it will be treated as the options object
	 *
	 * @param {import('fable')|Record<string, any>} [pFable] - (optional) The fable instance, or the options object if there is no fable
	 * @param {Record<string, any>|string} [pOptions] - (optional) The options object, or the service hash if there is no fable
	 * @param {string} [pServiceHash] - (optional) The service hash to identify this service instance
	 */constructor(pFable,pOptions,pServiceHash){/** @type {import('fable')} */this.fable;/** @type {string} */this.UUID;/** @type {Record<string, any>} */this.options;/** @type {Record<string, any>} */this.services;/** @type {Record<string, any>} */this.servicesMap;// Check if a fable was passed in; connect it if so
if(typeof pFable==='object'&&pFable.isFable){this.connectFable(pFable);}else{this.fable=false;}// Initialize the services map if it wasn't passed in
/** @type {Record<string, any>} */this._PackageFableServiceProvider=libPackage;// initialize options and UUID based on whether the fable was passed in or not.
if(this.fable){this.UUID=pFable.getUUID();this.options=typeof pOptions==='object'?pOptions:{};}else{// With no fable, check to see if there was an object passed into either of the first two
// Parameters, and if so, treat it as the options object
this.options=typeof pFable==='object'&&!pFable.isFable?pFable:typeof pOptions==='object'?pOptions:{};this.UUID=`CORE-SVC-${Math.floor(Math.random()*(99999-10000)+10000)}`;}// It's expected that the deriving class will set this
this.serviceType=`Unknown-${this.UUID}`;// The service hash is used to identify the specific instantiation of the service in the services map
this.Hash=typeof pServiceHash==='string'?pServiceHash:!this.fable&&typeof pOptions==='string'?pOptions:`${this.UUID}`;}/**
	 * @param {import('fable')} pFable
	 */connectFable(pFable){if(typeof pFable!=='object'||!pFable.isFable){let tmpErrorMessage=`Fable Service Provider Base: Cannot connect to Fable, invalid Fable object passed in.  The pFable parameter was a [${typeof pFable}].}`;console.log(tmpErrorMessage);return new Error(tmpErrorMessage);}if(!this.fable){this.fable=pFable;}if(!this.log){this.log=this.fable.Logging;}if(!this.services){this.services=this.fable.services;}if(!this.servicesMap){this.servicesMap=this.fable.servicesMap;}return true;}static isFableService=true;}module.exports=FableServiceProviderBase;// This is left here in case we want to go back to having different code/base class for "core" services
module.exports.CoreServiceProviderBase=FableServiceProviderBase;},{"../package.json":1}],3:[function(require,module,exports){module.exports={"name":"pict-application","version":"1.0.34","description":"Application base class for a pict view-based application","main":"source/Pict-Application.js","scripts":{"test":"npx quack test","start":"node source/Pict-Application.js","coverage":"npx quack coverage","build":"npx quack build","docker-dev-build":"docker build ./ -f Dockerfile_LUXURYCode -t pict-application-image:local","docker-dev-run":"docker run -it -d --name pict-application-dev -p 30001:8080 -p 38086:8086 -v \"$PWD/.config:/home/coder/.config\"  -v \"$PWD:/home/coder/pict-application\" -u \"$(id -u):$(id -g)\" -e \"DOCKER_USER=$USER\" pict-application-image:local","docker-dev-shell":"docker exec -it pict-application-dev /bin/bash","tests":"npx quack test -g","lint":"eslint source/**","types":"tsc -p ."},"types":"types/source/Pict-Application.d.ts","repository":{"type":"git","url":"git+https://github.com/stevenvelozo/pict-application.git"},"author":"steven velozo <steven@velozo.com>","license":"MIT","bugs":{"url":"https://github.com/stevenvelozo/pict-application/issues"},"homepage":"https://github.com/stevenvelozo/pict-application#readme","devDependencies":{"@eslint/js":"^9.28.0","browser-env":"^3.3.0","eslint":"^9.28.0","pict":"^1.0.348","pict-docuserve":"^0.1.5","pict-provider":"^1.0.10","pict-view":"^1.0.66","quackage":"^1.1.0","typescript":"^5.9.3"},"mocha":{"diff":true,"extension":["js"],"package":"./package.json","reporter":"spec","slow":"75","timeout":"5000","ui":"tdd","watch-files":["source/**/*.js","test/**/*.js"],"watch-ignore":["lib/vendor"]},"dependencies":{"fable-serviceproviderbase":"^3.0.19"}};},{}],4:[function(require,module,exports){const libFableServiceBase=require('fable-serviceproviderbase');const libPackage=require('../package.json');const defaultPictSettings={Name:'DefaultPictApplication',// The main "viewport" is the view that is used to host our application
MainViewportViewIdentifier:'Default-View',MainViewportRenderableHash:false,MainViewportDestinationAddress:false,MainViewportDefaultDataAddress:false,// Whether or not we should automatically render the main viewport and other autorender views after we initialize the pict application
AutoSolveAfterInitialize:true,AutoRenderMainViewportViewAfterInitialize:true,AutoRenderViewsAfterInitialize:false,AutoLoginAfterInitialize:false,AutoLoadDataAfterLogin:false,ConfigurationOnlyViews:[],Manifests:{},// The prefix to prepend on all template destination hashes
IdentifierAddressPrefix:'PICT-'};/**
 * Base class for pict applications.
 */class PictApplication extends libFableServiceBase{/**
	 * @param {import('fable')} pFable
	 * @param {Record<string, any>} [pOptions]
	 * @param {string} [pServiceHash]
	 */constructor(pFable,pOptions,pServiceHash){let tmpCarryOverConfiguration=typeof pFable.settings.PictApplicationConfiguration==='object'?pFable.settings.PictApplicationConfiguration:{};let tmpOptions=Object.assign({},JSON.parse(JSON.stringify(defaultPictSettings)),tmpCarryOverConfiguration,pOptions);super(pFable,tmpOptions,pServiceHash);/** @type {any} */this.options;/** @type {any} */this.log;/** @type {import('pict') & import('fable')} */this.fable;/** @type {string} */this.UUID;/** @type {string} */this.Hash;/**
		 * @type {{ [key: string]: any }}
		 */this.servicesMap;this.serviceType='PictApplication';/** @type {Record<string, any>} */this._Package=libPackage;// Convenience and consistency naming
this.pict=this.fable;// Wire in the essential Pict state
/** @type {Record<string, any>} */this.AppData=this.fable.AppData;/** @type {Record<string, any>} */this.Bundle=this.fable.Bundle;/** @type {number} */this.initializeTimestamp;/** @type {number} */this.lastSolvedTimestamp;/** @type {number} */this.lastLoginTimestamp;/** @type {number} */this.lastMarshalFromViewsTimestamp;/** @type {number} */this.lastMarshalToViewsTimestamp;/** @type {number} */this.lastAutoRenderTimestamp;/** @type {number} */this.lastLoadDataTimestamp;// Load all the manifests for the application
let tmpManifestKeys=Object.keys(this.options.Manifests);if(tmpManifestKeys.length>0){for(let i=0;i<tmpManifestKeys.length;i++){// Load each manifest
let tmpManifestKey=tmpManifestKeys[i];this.fable.instantiateServiceProvider('Manifest',this.options.Manifests[tmpManifestKey],tmpManifestKey);}}}/* -------------------------------------------------------------------------- *//*                     Code Section: Solve All Views                          *//* -------------------------------------------------------------------------- *//**
	 * @return {boolean}
	 */onPreSolve(){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onPreSolve:`);}return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */onPreSolveAsync(fCallback){this.onPreSolve();return fCallback();}/**
	 * @return {boolean}
	 */onBeforeSolve(){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onBeforeSolve:`);}return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */onBeforeSolveAsync(fCallback){this.onBeforeSolve();return fCallback();}/**
	 * @return {boolean}
	 */onSolve(){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onSolve:`);}return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */onSolveAsync(fCallback){this.onSolve();return fCallback();}/**
	 * @return {boolean}
	 */solve(){if(this.pict.LogNoisiness>2){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} executing solve() function...`);}// Walk through any loaded providers and solve them as well.
let tmpLoadedProviders=Object.keys(this.pict.providers);let tmpProvidersToSolve=[];for(let i=0;i<tmpLoadedProviders.length;i++){let tmpProvider=this.pict.providers[tmpLoadedProviders[i]];if(tmpProvider.options.AutoSolveWithApp){tmpProvidersToSolve.push(tmpProvider);}}// Sort the providers by their priority (if they are all priority 0, it will end up being add order due to JSON Object Property Key order stuff)
tmpProvidersToSolve.sort((a,b)=>{return a.options.AutoSolveOrdinal-b.options.AutoSolveOrdinal;});for(let i=0;i<tmpProvidersToSolve.length;i++){tmpProvidersToSolve[i].solve(tmpProvidersToSolve[i]);}this.onBeforeSolve();// Now walk through any loaded views and initialize them as well.
let tmpLoadedViews=Object.keys(this.pict.views);let tmpViewsToSolve=[];for(let i=0;i<tmpLoadedViews.length;i++){let tmpView=this.pict.views[tmpLoadedViews[i]];if(tmpView.options.AutoInitialize){tmpViewsToSolve.push(tmpView);}}// Sort the views by their priority (if they are all priority 0, it will end up being add order due to JSON Object Property Key order stuff)
tmpViewsToSolve.sort((a,b)=>{return a.options.AutoInitializeOrdinal-b.options.AutoInitializeOrdinal;});for(let i=0;i<tmpViewsToSolve.length;i++){tmpViewsToSolve[i].solve();}this.onSolve();this.onAfterSolve();this.lastSolvedTimestamp=this.fable.log.getTimeStamp();return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */solveAsync(fCallback){let tmpAnticipate=this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');tmpAnticipate.anticipate(this.onBeforeSolveAsync.bind(this));// Allow the callback to be passed in as the last parameter no matter what
let tmpCallback=typeof fCallback==='function'?fCallback:false;if(!tmpCallback){this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} solveAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);tmpCallback=pError=>{if(pError){this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} solveAsync Auto Callback Error: ${pError}`,pError);}};}// Walk through any loaded providers and solve them as well.
let tmpLoadedProviders=Object.keys(this.pict.providers);let tmpProvidersToSolve=[];for(let i=0;i<tmpLoadedProviders.length;i++){let tmpProvider=this.pict.providers[tmpLoadedProviders[i]];if(tmpProvider.options.AutoSolveWithApp){tmpProvidersToSolve.push(tmpProvider);}}// Sort the providers by their priority (if they are all priority 0, it will end up being add order due to JSON Object Property Key order stuff)
tmpProvidersToSolve.sort((a,b)=>{return a.options.AutoSolveOrdinal-b.options.AutoSolveOrdinal;});for(let i=0;i<tmpProvidersToSolve.length;i++){tmpAnticipate.anticipate(tmpProvidersToSolve[i].solveAsync.bind(tmpProvidersToSolve[i]));}// Walk through any loaded views and solve them as well.
let tmpLoadedViews=Object.keys(this.pict.views);let tmpViewsToSolve=[];for(let i=0;i<tmpLoadedViews.length;i++){let tmpView=this.pict.views[tmpLoadedViews[i]];if(tmpView.options.AutoSolveWithApp){tmpViewsToSolve.push(tmpView);}}// Sort the views by their priority (if they are all priority 0, it will end up being add order due to JSON Object Property Key order stuff)
tmpViewsToSolve.sort((a,b)=>{return a.options.AutoSolveOrdinal-b.options.AutoSolveOrdinal;});for(let i=0;i<tmpViewsToSolve.length;i++){tmpAnticipate.anticipate(tmpViewsToSolve[i].solveAsync.bind(tmpViewsToSolve[i]));}tmpAnticipate.anticipate(this.onSolveAsync.bind(this));tmpAnticipate.anticipate(this.onAfterSolveAsync.bind(this));tmpAnticipate.wait(pError=>{if(this.pict.LogNoisiness>2){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} solveAsync() complete.`);}this.lastSolvedTimestamp=this.fable.log.getTimeStamp();return tmpCallback(pError);});}/**
	 * @return {boolean}
	 */onAfterSolve(){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onAfterSolve:`);}return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */onAfterSolveAsync(fCallback){this.onAfterSolve();return fCallback();}/* -------------------------------------------------------------------------- *//*                     Code Section: Application Login                        *//* -------------------------------------------------------------------------- *//**
	 * @param {(error?: Error) => void} fCallback
	 */onBeforeLoginAsync(fCallback){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onBeforeLoginAsync:`);}return fCallback();}/**
	 * @param {(error?: Error) => void} fCallback
	 */onLoginAsync(fCallback){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onLoginAsync:`);}return fCallback();}/**
	 * @param {(error?: Error) => void} fCallback
	 */loginAsync(fCallback){const tmpAnticipate=this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');let tmpCallback=fCallback;if(typeof tmpCallback!=='function'){this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} loginAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);tmpCallback=pError=>{if(pError){this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} loginAsync Auto Callback Error: ${pError}`,pError);}};}tmpAnticipate.anticipate(this.onBeforeLoginAsync.bind(this));tmpAnticipate.anticipate(this.onLoginAsync.bind(this));tmpAnticipate.anticipate(this.onAfterLoginAsync.bind(this));// check and see if we should automatically trigger a data load
if(this.options.AutoLoadDataAfterLogin){tmpAnticipate.anticipate(fNext=>{if(!this.isLoggedIn()){return fNext();}if(this.pict.LogNoisiness>1){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} auto loading data after login...`);}//TODO: should data load errors funnel here? this creates a weird coupling between login and data load callbacks
this.loadDataAsync(pError=>{fNext(pError);});});}tmpAnticipate.wait(pError=>{if(this.pict.LogNoisiness>2){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} loginAsync() complete.`);}this.lastLoginTimestamp=this.fable.log.getTimeStamp();return tmpCallback(pError);});}/**
	 * Check if the application state is logged in. Defaults to true. Override this method in your application based on login requirements.
	 *
	 * @return {boolean}
	 */isLoggedIn(){return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */onAfterLoginAsync(fCallback){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onAfterLoginAsync:`);}return fCallback();}/* -------------------------------------------------------------------------- *//*                     Code Section: Application LoadData                     *//* -------------------------------------------------------------------------- *//**
	 * @param {(error?: Error) => void} fCallback
	 */onBeforeLoadDataAsync(fCallback){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onBeforeLoadDataAsync:`);}return fCallback();}/**
	 * @param {(error?: Error) => void} fCallback
	 */onLoadDataAsync(fCallback){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onLoadDataAsync:`);}return fCallback();}/**
	 * @param {(error?: Error) => void} fCallback
	 */loadDataAsync(fCallback){const tmpAnticipate=this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');let tmpCallback=fCallback;if(typeof tmpCallback!=='function'){this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} loadDataAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);tmpCallback=pError=>{if(pError){this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} loadDataAsync Auto Callback Error: ${pError}`,pError);}};}tmpAnticipate.anticipate(this.onBeforeLoadDataAsync.bind(this));// Walk through any loaded providers and load their data as well.
let tmpLoadedProviders=Object.keys(this.pict.providers);let tmpProvidersToLoadData=[];for(let i=0;i<tmpLoadedProviders.length;i++){let tmpProvider=this.pict.providers[tmpLoadedProviders[i]];if(tmpProvider.options.AutoLoadDataWithApp){tmpProvidersToLoadData.push(tmpProvider);}}// Sort the providers by their priority (if they are all priority 0, it will end up being add order due to JSON Object Property Key order stuff)
tmpProvidersToLoadData.sort((a,b)=>{return a.options.AutoLoadDataOrdinal-b.options.AutoLoadDataOrdinal;});for(const tmpProvider of tmpProvidersToLoadData){tmpAnticipate.anticipate(tmpProvider.onBeforeLoadDataAsync.bind(tmpProvider));}tmpAnticipate.anticipate(this.onLoadDataAsync.bind(this));//TODO: think about ways to parallelize these
for(const tmpProvider of tmpProvidersToLoadData){tmpAnticipate.anticipate(tmpProvider.onLoadDataAsync.bind(tmpProvider));}tmpAnticipate.anticipate(this.onAfterLoadDataAsync.bind(this));for(const tmpProvider of tmpProvidersToLoadData){tmpAnticipate.anticipate(tmpProvider.onAfterLoadDataAsync.bind(tmpProvider));}tmpAnticipate.wait(/** @param {Error} [pError] */pError=>{if(this.pict.LogNoisiness>2){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} loadDataAsync() complete.`);}this.lastLoadDataTimestamp=this.fable.log.getTimeStamp();return tmpCallback(pError);});}/**
	 * @param {(error?: Error) => void} fCallback
	 */onAfterLoadDataAsync(fCallback){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onAfterLoadDataAsync:`);}return fCallback();}/* -------------------------------------------------------------------------- *//*                     Code Section: Application SaveData                     *//* -------------------------------------------------------------------------- *//**
	 * @param {(error?: Error) => void} fCallback
	 */onBeforeSaveDataAsync(fCallback){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onBeforeSaveDataAsync:`);}return fCallback();}/**
	 * @param {(error?: Error) => void} fCallback
	 */onSaveDataAsync(fCallback){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onSaveDataAsync:`);}return fCallback();}/**
	 * @param {(error?: Error) => void} fCallback
	 */saveDataAsync(fCallback){const tmpAnticipate=this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');let tmpCallback=fCallback;if(typeof tmpCallback!=='function'){this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} saveDataAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);tmpCallback=pError=>{if(pError){this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} saveDataAsync Auto Callback Error: ${pError}`,pError);}};}tmpAnticipate.anticipate(this.onBeforeSaveDataAsync.bind(this));// Walk through any loaded providers and load their data as well.
let tmpLoadedProviders=Object.keys(this.pict.providers);let tmpProvidersToSaveData=[];for(let i=0;i<tmpLoadedProviders.length;i++){let tmpProvider=this.pict.providers[tmpLoadedProviders[i]];if(tmpProvider.options.AutoSaveDataWithApp){tmpProvidersToSaveData.push(tmpProvider);}}// Sort the providers by their priority (if they are all priority 0, it will end up being add order due to JSON Object Property Key order stuff)
tmpProvidersToSaveData.sort((a,b)=>{return a.options.AutoSaveDataOrdinal-b.options.AutoSaveDataOrdinal;});for(const tmpProvider of tmpProvidersToSaveData){tmpAnticipate.anticipate(tmpProvider.onBeforeSaveDataAsync.bind(tmpProvider));}tmpAnticipate.anticipate(this.onSaveDataAsync.bind(this));//TODO: think about ways to parallelize these
for(const tmpProvider of tmpProvidersToSaveData){tmpAnticipate.anticipate(tmpProvider.onSaveDataAsync.bind(tmpProvider));}tmpAnticipate.anticipate(this.onAfterSaveDataAsync.bind(this));for(const tmpProvider of tmpProvidersToSaveData){tmpAnticipate.anticipate(tmpProvider.onAfterSaveDataAsync.bind(tmpProvider));}tmpAnticipate.wait(/** @param {Error} [pError] */pError=>{if(this.pict.LogNoisiness>2){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} saveDataAsync() complete.`);}this.lastSaveDataTimestamp=this.fable.log.getTimeStamp();return tmpCallback(pError);});}/**
	 * @param {(error?: Error) => void} fCallback
	 */onAfterSaveDataAsync(fCallback){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onAfterSaveDataAsync:`);}return fCallback();}/* -------------------------------------------------------------------------- *//*                     Code Section: Initialize Application                   *//* -------------------------------------------------------------------------- *//**
	 * @return {boolean}
	 */onBeforeInitialize(){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onBeforeInitialize:`);}return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */onBeforeInitializeAsync(fCallback){this.onBeforeInitialize();return fCallback();}/**
	 * @return {boolean}
	 */onInitialize(){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onInitialize:`);}return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */onInitializeAsync(fCallback){this.onInitialize();return fCallback();}/**
	 * @return {boolean}
	 */initialize(){if(this.pict.LogControlFlow){this.log.trace(`PICT-ControlFlow APPLICATION [${this.UUID}]::[${this.Hash}] ${this.options.Name} initialize:`);}if(!this.initializeTimestamp){this.onBeforeInitialize();if('ConfigurationOnlyViews'in this.options){// Load all the configuration only views
for(let i=0;i<this.options.ConfigurationOnlyViews.length;i++){let tmpViewIdentifier=typeof this.options.ConfigurationOnlyViews[i].ViewIdentifier==='undefined'?`AutoView-${this.fable.getUUID()}`:this.options.ConfigurationOnlyViews[i].ViewIdentifier;this.log.info(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} adding configuration only view: ${tmpViewIdentifier}`);this.pict.addView(tmpViewIdentifier,this.options.ConfigurationOnlyViews[i]);}}this.onInitialize();// Walk through any loaded providers and initialize them as well.
let tmpLoadedProviders=Object.keys(this.pict.providers);let tmpProvidersToInitialize=[];for(let i=0;i<tmpLoadedProviders.length;i++){let tmpProvider=this.pict.providers[tmpLoadedProviders[i]];if(tmpProvider.options.AutoInitialize){tmpProvidersToInitialize.push(tmpProvider);}}// Sort the providers by their priority (if they are all priority 0, it will end up being add order due to JSON Object Property Key order stuff)
tmpProvidersToInitialize.sort((a,b)=>{return a.options.AutoInitializeOrdinal-b.options.AutoInitializeOrdinal;});for(let i=0;i<tmpProvidersToInitialize.length;i++){tmpProvidersToInitialize[i].initialize();}// Now walk through any loaded views and initialize them as well.
let tmpLoadedViews=Object.keys(this.pict.views);let tmpViewsToInitialize=[];for(let i=0;i<tmpLoadedViews.length;i++){let tmpView=this.pict.views[tmpLoadedViews[i]];if(tmpView.options.AutoInitialize){tmpViewsToInitialize.push(tmpView);}}// Sort the views by their priority (if they are all priority 0, it will end up being add order due to JSON Object Property Key order stuff)
tmpViewsToInitialize.sort((a,b)=>{return a.options.AutoInitializeOrdinal-b.options.AutoInitializeOrdinal;});for(let i=0;i<tmpViewsToInitialize.length;i++){tmpViewsToInitialize[i].initialize();}this.onAfterInitialize();if(this.options.AutoSolveAfterInitialize){if(this.pict.LogNoisiness>1){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} auto solving after initialization...`);}// Solve the template synchronously
this.solve();}// Now check and see if we should automatically render as well
if(this.options.AutoRenderMainViewportViewAfterInitialize){if(this.pict.LogNoisiness>1){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} auto rendering after initialization...`);}// Render the template synchronously
this.render();}this.initializeTimestamp=this.fable.log.getTimeStamp();this.onCompletionOfInitialize();return true;}else{this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} initialize called but initialization is already completed.  Aborting.`);return false;}}/**
	 * @param {(error?: Error) => void} fCallback
	 */initializeAsync(fCallback){if(this.pict.LogControlFlow){this.log.trace(`PICT-ControlFlow APPLICATION [${this.UUID}]::[${this.Hash}] ${this.options.Name} initializeAsync:`);}// Allow the callback to be passed in as the last parameter no matter what
let tmpCallback=typeof fCallback==='function'?fCallback:false;if(!tmpCallback){this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} initializeAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);tmpCallback=pError=>{if(pError){this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} initializeAsync Auto Callback Error: ${pError}`,pError);}};}if(!this.initializeTimestamp){let tmpAnticipate=this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} beginning initialization...`);}if('ConfigurationOnlyViews'in this.options){// Load all the configuration only views
for(let i=0;i<this.options.ConfigurationOnlyViews.length;i++){let tmpViewIdentifier=typeof this.options.ConfigurationOnlyViews[i].ViewIdentifier==='undefined'?`AutoView-${this.fable.getUUID()}`:this.options.ConfigurationOnlyViews[i].ViewIdentifier;this.log.info(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} adding configuration only view: ${tmpViewIdentifier}`);this.pict.addView(tmpViewIdentifier,this.options.ConfigurationOnlyViews[i]);}}tmpAnticipate.anticipate(this.onBeforeInitializeAsync.bind(this));tmpAnticipate.anticipate(this.onInitializeAsync.bind(this));// Walk through any loaded providers and solve them as well.
let tmpLoadedProviders=Object.keys(this.pict.providers);let tmpProvidersToInitialize=[];for(let i=0;i<tmpLoadedProviders.length;i++){let tmpProvider=this.pict.providers[tmpLoadedProviders[i]];if(tmpProvider.options.AutoInitialize){tmpProvidersToInitialize.push(tmpProvider);}}// Sort the providers by their priority (if they are all priority 0, it will end up being add order due to JSON Object Property Key order stuff)
tmpProvidersToInitialize.sort((a,b)=>{return a.options.AutoInitializeOrdinal-b.options.AutoInitializeOrdinal;});for(let i=0;i<tmpProvidersToInitialize.length;i++){tmpAnticipate.anticipate(tmpProvidersToInitialize[i].initializeAsync.bind(tmpProvidersToInitialize[i]));}// Now walk through any loaded views and initialize them as well.
// TODO: Some optimization cleverness could be gained by grouping them into a parallelized async operation, by ordinal.
let tmpLoadedViews=Object.keys(this.pict.views);let tmpViewsToInitialize=[];for(let i=0;i<tmpLoadedViews.length;i++){let tmpView=this.pict.views[tmpLoadedViews[i]];if(tmpView.options.AutoInitialize){tmpViewsToInitialize.push(tmpView);}}// Sort the views by their priority
// If they are all the default priority 0, it will end up being add order due to JSON Object Property Key order stuff
tmpViewsToInitialize.sort((a,b)=>{return a.options.AutoInitializeOrdinal-b.options.AutoInitializeOrdinal;});for(let i=0;i<tmpViewsToInitialize.length;i++){let tmpView=tmpViewsToInitialize[i];tmpAnticipate.anticipate(tmpView.initializeAsync.bind(tmpView));}tmpAnticipate.anticipate(this.onAfterInitializeAsync.bind(this));if(this.options.AutoLoginAfterInitialize){if(this.pict.LogNoisiness>1){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} auto login (asynchronously) after initialization...`);}tmpAnticipate.anticipate(this.loginAsync.bind(this));}if(this.options.AutoSolveAfterInitialize){if(this.pict.LogNoisiness>1){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} auto solving (asynchronously) after initialization...`);}tmpAnticipate.anticipate(this.solveAsync.bind(this));}if(this.options.AutoRenderMainViewportViewAfterInitialize){if(this.pict.LogNoisiness>1){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} auto rendering (asynchronously) after initialization...`);}tmpAnticipate.anticipate(this.renderMainViewportAsync.bind(this));}tmpAnticipate.wait(pError=>{if(pError){this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} initializeAsync Error: ${pError.message||pError}`,{stack:pError.stack});}this.initializeTimestamp=this.fable.log.getTimeStamp();if(this.pict.LogNoisiness>2){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} initialization complete.`);}return tmpCallback();});}else{this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} async initialize called but initialization is already completed.  Aborting.`);// TODO: Should this be an error?
return this.onCompletionOfInitializeAsync(tmpCallback);}}/**
	 * @return {boolean}
	 */onAfterInitialize(){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onAfterInitialize:`);}return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */onAfterInitializeAsync(fCallback){this.onAfterInitialize();return fCallback();}/**
	 * @return {boolean}
	 */onCompletionOfInitialize(){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onCompletionOfInitialize:`);}return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */onCompletionOfInitializeAsync(fCallback){this.onCompletionOfInitialize();return fCallback();}/* -------------------------------------------------------------------------- *//*                     Code Section: Marshal Data From All Views              *//* -------------------------------------------------------------------------- *//**
	 * @return {boolean}
	 */onBeforeMarshalFromViews(){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onBeforeMarshalFromViews:`);}return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */onBeforeMarshalFromViewsAsync(fCallback){this.onBeforeMarshalFromViews();return fCallback();}/**
	 * @return {boolean}
	 */onMarshalFromViews(){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onMarshalFromViews:`);}return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */onMarshalFromViewsAsync(fCallback){this.onMarshalFromViews();return fCallback();}/**
	 * @return {boolean}
	 */marshalFromViews(){if(this.pict.LogNoisiness>2){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} executing marshalFromViews() function...`);}this.onBeforeMarshalFromViews();// Now walk through any loaded views and initialize them as well.
let tmpLoadedViews=Object.keys(this.pict.views);let tmpViewsToMarshalFromViews=[];for(let i=0;i<tmpLoadedViews.length;i++){let tmpView=this.pict.views[tmpLoadedViews[i]];tmpViewsToMarshalFromViews.push(tmpView);}for(let i=0;i<tmpViewsToMarshalFromViews.length;i++){tmpViewsToMarshalFromViews[i].marshalFromView();}this.onMarshalFromViews();this.onAfterMarshalFromViews();this.lastMarshalFromViewsTimestamp=this.fable.log.getTimeStamp();return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */marshalFromViewsAsync(fCallback){let tmpAnticipate=this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');// Allow the callback to be passed in as the last parameter no matter what
let tmpCallback=typeof fCallback==='function'?fCallback:false;if(!tmpCallback){this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalFromViewsAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);tmpCallback=pError=>{if(pError){this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalFromViewsAsync Auto Callback Error: ${pError}`,pError);}};}tmpAnticipate.anticipate(this.onBeforeMarshalFromViewsAsync.bind(this));// Walk through any loaded views and marshalFromViews them as well.
let tmpLoadedViews=Object.keys(this.pict.views);let tmpViewsToMarshalFromViews=[];for(let i=0;i<tmpLoadedViews.length;i++){let tmpView=this.pict.views[tmpLoadedViews[i]];tmpViewsToMarshalFromViews.push(tmpView);}for(let i=0;i<tmpViewsToMarshalFromViews.length;i++){tmpAnticipate.anticipate(tmpViewsToMarshalFromViews[i].marshalFromViewAsync.bind(tmpViewsToMarshalFromViews[i]));}tmpAnticipate.anticipate(this.onMarshalFromViewsAsync.bind(this));tmpAnticipate.anticipate(this.onAfterMarshalFromViewsAsync.bind(this));tmpAnticipate.wait(pError=>{if(this.pict.LogNoisiness>2){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalFromViewsAsync() complete.`);}this.lastMarshalFromViewsTimestamp=this.fable.log.getTimeStamp();return tmpCallback(pError);});}/**
	 * @return {boolean}
	 */onAfterMarshalFromViews(){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onAfterMarshalFromViews:`);}return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */onAfterMarshalFromViewsAsync(fCallback){this.onAfterMarshalFromViews();return fCallback();}/* -------------------------------------------------------------------------- *//*                     Code Section: Marshal Data To All Views                *//* -------------------------------------------------------------------------- *//**
	 * @return {boolean}
	 */onBeforeMarshalToViews(){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onBeforeMarshalToViews:`);}return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */onBeforeMarshalToViewsAsync(fCallback){this.onBeforeMarshalToViews();return fCallback();}/**
	 * @return {boolean}
	 */onMarshalToViews(){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onMarshalToViews:`);}return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */onMarshalToViewsAsync(fCallback){this.onMarshalToViews();return fCallback();}/**
	 * @return {boolean}
	 */marshalToViews(){if(this.pict.LogNoisiness>2){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} executing marshalToViews() function...`);}this.onBeforeMarshalToViews();// Now walk through any loaded views and initialize them as well.
let tmpLoadedViews=Object.keys(this.pict.views);let tmpViewsToMarshalToViews=[];for(let i=0;i<tmpLoadedViews.length;i++){let tmpView=this.pict.views[tmpLoadedViews[i]];tmpViewsToMarshalToViews.push(tmpView);}for(let i=0;i<tmpViewsToMarshalToViews.length;i++){tmpViewsToMarshalToViews[i].marshalToView();}this.onMarshalToViews();this.onAfterMarshalToViews();this.lastMarshalToViewsTimestamp=this.fable.log.getTimeStamp();return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */marshalToViewsAsync(fCallback){let tmpAnticipate=this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');// Allow the callback to be passed in as the last parameter no matter what
let tmpCallback=typeof fCallback==='function'?fCallback:false;if(!tmpCallback){this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalToViewsAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);tmpCallback=pError=>{if(pError){this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalToViewsAsync Auto Callback Error: ${pError}`,pError);}};}tmpAnticipate.anticipate(this.onBeforeMarshalToViewsAsync.bind(this));// Walk through any loaded views and marshalToViews them as well.
let tmpLoadedViews=Object.keys(this.pict.views);let tmpViewsToMarshalToViews=[];for(let i=0;i<tmpLoadedViews.length;i++){let tmpView=this.pict.views[tmpLoadedViews[i]];tmpViewsToMarshalToViews.push(tmpView);}for(let i=0;i<tmpViewsToMarshalToViews.length;i++){tmpAnticipate.anticipate(tmpViewsToMarshalToViews[i].marshalToViewAsync.bind(tmpViewsToMarshalToViews[i]));}tmpAnticipate.anticipate(this.onMarshalToViewsAsync.bind(this));tmpAnticipate.anticipate(this.onAfterMarshalToViewsAsync.bind(this));tmpAnticipate.wait(pError=>{if(this.pict.LogNoisiness>2){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalToViewsAsync() complete.`);}this.lastMarshalToViewsTimestamp=this.fable.log.getTimeStamp();return tmpCallback(pError);});}/**
	 * @return {boolean}
	 */onAfterMarshalToViews(){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onAfterMarshalToViews:`);}return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */onAfterMarshalToViewsAsync(fCallback){this.onAfterMarshalToViews();return fCallback();}/* -------------------------------------------------------------------------- *//*                     Code Section: Render View                              *//* -------------------------------------------------------------------------- *//**
	 * @return {boolean}
	 */onBeforeRender(){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onBeforeRender:`);}return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */onBeforeRenderAsync(fCallback){this.onBeforeRender();return fCallback();}/**
	 * @param {string} [pViewIdentifier] - The hash of the view to render. By default, the main viewport view is rendered.
	 * @param {string} [pRenderableHash] - The hash of the renderable to render.
	 * @param {string} [pRenderDestinationAddress] - The address where the renderable will be rendered.
	 * @param {string} [pTemplateDataAddress] - The address where the data for the template is stored.
	 *
	 * TODO: Should we support objects for pTemplateDataAddress for parity with pict-view?
	 */render(pViewIdentifier,pRenderableHash,pRenderDestinationAddress,pTemplateDataAddress){let tmpViewIdentifier=typeof pViewIdentifier!=='string'?this.options.MainViewportViewIdentifier:pViewIdentifier;let tmpRenderableHash=typeof pRenderableHash!=='string'?this.options.MainViewportRenderableHash:pRenderableHash;let tmpRenderDestinationAddress=typeof pRenderDestinationAddress!=='string'?this.options.MainViewportDestinationAddress:pRenderDestinationAddress;let tmpTemplateDataAddress=typeof pTemplateDataAddress!=='string'?this.options.MainViewportDefaultDataAddress:pTemplateDataAddress;if(this.pict.LogControlFlow){this.log.trace(`PICT-ControlFlow APPLICATION [${this.UUID}]::[${this.Hash}] ${this.options.Name} VIEW Renderable[${tmpRenderableHash}] Destination[${tmpRenderDestinationAddress}] TemplateDataAddress[${tmpTemplateDataAddress}] render:`);}this.onBeforeRender();// Now get the view (by hash) from the loaded views
let tmpView=typeof tmpViewIdentifier==='string'?this.servicesMap.PictView[tmpViewIdentifier]:false;if(!tmpView){this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} could not render from View ${tmpViewIdentifier} because it is not a valid view.`);return false;}this.onRender();tmpView.render(tmpRenderableHash,tmpRenderDestinationAddress,tmpTemplateDataAddress);this.onAfterRender();return true;}/**
	 * @return {boolean}
	 */onRender(){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onRender:`);}return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */onRenderAsync(fCallback){this.onRender();return fCallback();}/**
	 * @param {string|((error?: Error) => void)} pViewIdentifier - The hash of the view to render. By default, the main viewport view is rendered. (or the callback)
	 * @param {string|((error?: Error) => void)} [pRenderableHash] - The hash of the renderable to render. (or the callback)
	 * @param {string|((error?: Error) => void)} [pRenderDestinationAddress] - The address where the renderable will be rendered. (or the callback)
	 * @param {string|((error?: Error) => void)} [pTemplateDataAddress] - The address where the data for the template is stored. (or the callback)
	 * @param {(error?: Error) => void} [fCallback] - The callback, if all other parameters are provided.
	 *
	 * TODO: Should we support objects for pTemplateDataAddress for parity with pict-view?
	 */renderAsync(pViewIdentifier,pRenderableHash,pRenderDestinationAddress,pTemplateDataAddress,fCallback){let tmpViewIdentifier=typeof pViewIdentifier!=='string'?this.options.MainViewportViewIdentifier:pViewIdentifier;let tmpRenderableHash=typeof pRenderableHash!=='string'?this.options.MainViewportRenderableHash:pRenderableHash;let tmpRenderDestinationAddress=typeof pRenderDestinationAddress!=='string'?this.options.MainViewportDestinationAddress:pRenderDestinationAddress;let tmpTemplateDataAddress=typeof pTemplateDataAddress!=='string'?this.options.MainViewportDefaultDataAddress:pTemplateDataAddress;// Allow the callback to be passed in as the last parameter no matter what
let tmpCallback=typeof fCallback==='function'?fCallback:typeof pTemplateDataAddress==='function'?pTemplateDataAddress:typeof pRenderDestinationAddress==='function'?pRenderDestinationAddress:typeof pRenderableHash==='function'?pRenderableHash:typeof pViewIdentifier==='function'?pViewIdentifier:false;if(!tmpCallback){this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);tmpCallback=pError=>{if(pError){this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderAsync Auto Callback Error: ${pError}`,pError);}};}if(this.pict.LogControlFlow){this.log.trace(`PICT-ControlFlow APPLICATION [${this.UUID}]::[${this.Hash}] ${this.options.Name} VIEW Renderable[${tmpRenderableHash}] Destination[${tmpRenderDestinationAddress}] TemplateDataAddress[${tmpTemplateDataAddress}] renderAsync:`);}let tmpRenderAnticipate=this.fable.newAnticipate();tmpRenderAnticipate.anticipate(this.onBeforeRenderAsync.bind(this));let tmpView=typeof tmpViewIdentifier==='string'?this.servicesMap.PictView[tmpViewIdentifier]:false;if(!tmpView){let tmpErrorMessage=`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} could not asynchronously render from View ${tmpViewIdentifier} because it is not a valid view.`;if(this.pict.LogNoisiness>3){this.log.error(tmpErrorMessage);}return tmpCallback(new Error(tmpErrorMessage));}tmpRenderAnticipate.anticipate(this.onRenderAsync.bind(this));tmpRenderAnticipate.anticipate(fNext=>{tmpView.renderAsync.call(tmpView,tmpRenderableHash,tmpRenderDestinationAddress,tmpTemplateDataAddress,fNext);});tmpRenderAnticipate.anticipate(this.onAfterRenderAsync.bind(this));return tmpRenderAnticipate.wait(tmpCallback);}/**
	 * @return {boolean}
	 */onAfterRender(){if(this.pict.LogNoisiness>3){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onAfterRender:`);}return true;}/**
	 * @param {(error?: Error) => void} fCallback
	 */onAfterRenderAsync(fCallback){this.onAfterRender();return fCallback();}/**
	 * @return {boolean}
	 */renderMainViewport(){if(this.pict.LogControlFlow){this.log.trace(`PICT-ControlFlow APPLICATION [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderMainViewport:`);}return this.render();}/**
	 * @param {(error?: Error) => void} fCallback
	 */renderMainViewportAsync(fCallback){if(this.pict.LogControlFlow){this.log.trace(`PICT-ControlFlow APPLICATION [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderMainViewportAsync:`);}return this.renderAsync(fCallback);}/**
	 * @return {void}
	 */renderAutoViews(){if(this.pict.LogNoisiness>0){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} beginning renderAutoViews...`);}// Now walk through any loaded views and sort them by the AutoRender ordinal
let tmpLoadedViews=Object.keys(this.pict.views);// Sort the views by their priority
// If they are all the default priority 0, it will end up being add order due to JSON Object Property Key order stuff
tmpLoadedViews.sort((a,b)=>{return this.pict.views[a].options.AutoRenderOrdinal-this.pict.views[b].options.AutoRenderOrdinal;});for(let i=0;i<tmpLoadedViews.length;i++){let tmpView=this.pict.views[tmpLoadedViews[i]];if(tmpView.options.AutoRender){tmpView.render();}}if(this.pict.LogNoisiness>0){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderAutoViewsAsync complete.`);}}/**
	 * @param {(error?: Error) => void} fCallback
	 */renderAutoViewsAsync(fCallback){let tmpAnticipate=this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');// Allow the callback to be passed in as the last parameter no matter what
let tmpCallback=typeof fCallback==='function'?fCallback:false;if(!tmpCallback){this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderAutoViewsAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);tmpCallback=pError=>{if(pError){this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderAutoViewsAsync Auto Callback Error: ${pError}`,pError);}};}if(this.pict.LogNoisiness>0){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} beginning renderAutoViewsAsync...`);}// Now walk through any loaded views and sort them by the AutoRender ordinal
// TODO: Some optimization cleverness could be gained by grouping them into a parallelized async operation, by ordinal.
let tmpLoadedViews=Object.keys(this.pict.views);// Sort the views by their priority
// If they are all the default priority 0, it will end up being add order due to JSON Object Property Key order stuff
tmpLoadedViews.sort((a,b)=>{return this.pict.views[a].options.AutoRenderOrdinal-this.pict.views[b].options.AutoRenderOrdinal;});for(let i=0;i<tmpLoadedViews.length;i++){let tmpView=this.pict.views[tmpLoadedViews[i]];if(tmpView.options.AutoRender){tmpAnticipate.anticipate(tmpView.renderAsync.bind(tmpView));}}tmpAnticipate.wait(pError=>{this.lastAutoRenderTimestamp=this.fable.log.getTimeStamp();if(this.pict.LogNoisiness>0){this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderAutoViewsAsync complete.`);}return tmpCallback(pError);});}/**
	 * @return {boolean}
	 */get isPictApplication(){return true;}}module.exports=PictApplication;},{"../package.json":3,"fable-serviceproviderbase":2}],5:[function(require,module,exports){module.exports={"RenderOnLoad":true,"DefaultRenderable":"Login-Container","DefaultDestinationAddress":"#Pict-Login-Container","TargetElementAddress":"#Pict-Login-Container",// ----- Endpoint Configuration -----
// Defaults match orator-authentication routes.
// Override these to point at any custom backend.
"LoginEndpoint":"/1.0/Authenticate",// "POST" sends JSON body { UserName, Password }.
// "GET"  appends /:username/:password to LoginEndpoint.
"LoginMethod":"POST","LogoutEndpoint":"/1.0/Deauthenticate","CheckSessionEndpoint":"/1.0/CheckSession","OAuthProvidersEndpoint":"/1.0/OAuth/Providers","OAuthBeginEndpoint":"/1.0/OAuth/Begin",// ----- Behavior -----
"CheckSessionOnLoad":true,"ShowOAuthProviders":false,// ----- Data Address -----
// Where session state is stored in the Pict address space.
"SessionDataAddress":"AppData.Session",// ----- Templates -----
"Templates":[{"Hash":"Pict-Login-Template-Wrapper","Template":"<div class=\"pict-login-card\"><div id=\"pict-login-error\" class=\"pict-login-error\" style=\"display:none\"></div><div id=\"pict-login-form-area\"></div><div id=\"pict-login-oauth-area\"></div><div id=\"pict-login-status-area\" style=\"display:none\"></div></div>"},{"Hash":"Pict-Login-Template-Form","Template":"<form id=\"pict-login-form\" class=\"pict-login-form\"><label class=\"pict-login-label\" for=\"pict-login-username\">Username</label><input class=\"pict-login-input\" type=\"text\" id=\"pict-login-username\" name=\"username\" autocomplete=\"username\" placeholder=\"Enter username\" /><label class=\"pict-login-label\" for=\"pict-login-password\">Password</label><input class=\"pict-login-input\" type=\"password\" id=\"pict-login-password\" name=\"password\" autocomplete=\"current-password\" placeholder=\"Enter password\" /><button class=\"pict-login-submit\" type=\"submit\">Log In</button></form>"},{"Hash":"Pict-Login-Template-Status","Template":"<div class=\"pict-login-status\"><span class=\"pict-login-dot pict-login-dot--on\"></span><span class=\"pict-login-user-label\">Logged in as <strong id=\"pict-login-display-name\"></strong></span><span class=\"pict-login-user-id\" id=\"pict-login-display-id\"></span><button class=\"pict-login-logout-btn\" id=\"pict-login-logout\" type=\"button\">Log out</button></div>"},{"Hash":"Pict-Login-Template-OAuthProviders","Template":"<div class=\"pict-login-oauth\"><div class=\"pict-login-oauth-divider\"><span>or sign in with</span></div><div class=\"pict-login-oauth-buttons\" id=\"pict-login-oauth-buttons\"></div></div>"},{"Hash":"Pict-Login-Template-Error","Template":"<div class=\"pict-login-error-message\">{~D:Record.Message~}</div>"}],// ----- Renderables -----
"Renderables":[{"RenderableHash":"Login-Container","TemplateHash":"Pict-Login-Template-Wrapper","DestinationAddress":"#Pict-Login-Container"}],// ----- CSS -----
"CSS":`.pict-login-card
{
	max-width: 400px;
	margin: 2rem auto;
	background: var(--theme-color-background-panel, #fff);
	border: 1px solid var(--theme-color-border-default, #D4A373);
	border-top: 4px solid var(--theme-color-brand-primary, #E76F51);
	border-radius: 6px;
	padding: 1.5rem;
	box-shadow: 0 2px 8px rgba(38,70,83,0.08);
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
	color: var(--theme-color-text-primary, #264653);
}

/* ----- Form ----- */
.pict-login-form
{
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}
.pict-login-label
{
	font-weight: 600;
	font-size: 0.85rem;
	color: var(--theme-color-text-primary, #264653);
}
.pict-login-input
{
	border: 1px solid var(--theme-color-border-light, #D4C4A8);
	background: var(--theme-color-background-secondary, #FFFCF7);
	padding: 0.55rem 0.7rem;
	border-radius: 4px;
	font-size: 0.9rem;
	color: var(--theme-color-text-primary, #264653);
	width: 100%;
	box-sizing: border-box;
}
.pict-login-input:focus
{
	outline: none;
	border-color: var(--theme-color-brand-primary, #E76F51);
	box-shadow: 0 0 0 2px rgba(231,111,81,0.15);
}
.pict-login-submit
{
	background: var(--theme-color-brand-primary, #E76F51);
	color: var(--theme-color-text-on-brand, #fff);
	border: none;
	padding: 0.6rem 1.25rem;
	border-radius: 4px;
	font-size: 0.9rem;
	font-weight: 600;
	cursor: pointer;
	margin-top: 0.25rem;
}
.pict-login-submit:hover
{
	background: var(--theme-color-brand-primary-hover, #C45A3E);
}
.pict-login-submit:disabled
{
	opacity: 0.6;
	cursor: not-allowed;
}

/* ----- Error ----- */
.pict-login-error
{
	background: var(--theme-color-background-tertiary, #FDECEA);
	border: 1px solid var(--theme-color-brand-primary, #E76F51);
	color: var(--theme-color-status-error, #8B2500);
	border-radius: 4px;
	padding: 0.6rem 0.8rem;
	font-size: 0.85rem;
	margin-bottom: 0.75rem;
}

/* ----- Logged-In Status ----- */
.pict-login-status
{
	display: flex;
	align-items: center;
	gap: 0.5rem;
	flex-wrap: wrap;
}
.pict-login-dot
{
	width: 10px;
	height: 10px;
	border-radius: 50%;
	flex-shrink: 0;
}
.pict-login-dot--on
{
	background: var(--theme-color-status-success, #2A9D8F);
	box-shadow: 0 0 4px rgba(42,157,143,0.5);
}
.pict-login-dot--off
{
	background: var(--theme-color-text-muted, #999);
}
.pict-login-user-label
{
	font-size: 0.9rem;
}
.pict-login-user-id
{
	background: var(--theme-color-text-primary, #264653);
	color: var(--theme-color-text-on-brand, #FAEDCD);
	font-size: 0.7rem;
	font-weight: 700;
	padding: 0.15rem 0.5rem;
	border-radius: 9999px;
}
.pict-login-logout-btn
{
	margin-left: auto;
	background: var(--theme-color-text-primary, #264653);
	color: var(--theme-color-text-on-brand, #FAEDCD);
	border: none;
	padding: 0.4rem 1rem;
	border-radius: 4px;
	font-size: 0.8rem;
	font-weight: 600;
	cursor: pointer;
}
.pict-login-logout-btn:hover
{
	background: var(--theme-color-text-primary, #1A3340);
}

/* ----- OAuth ----- */
.pict-login-oauth
{
	margin-top: 1rem;
}
.pict-login-oauth-divider
{
	display: flex;
	align-items: center;
	gap: 0.75rem;
	margin-bottom: 0.75rem;
	color: var(--theme-color-text-muted, #999);
	font-size: 0.8rem;
}
.pict-login-oauth-divider::before,
.pict-login-oauth-divider::after
{
	content: '';
	flex: 1;
	height: 1px;
	background: var(--theme-color-border-light, #D4C4A8);
}
.pict-login-oauth-buttons
{
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}
.pict-login-oauth-btn
{
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	padding: 0.55rem 1rem;
	border-radius: 4px;
	font-size: 0.85rem;
	font-weight: 600;
	cursor: pointer;
	text-decoration: none;
	border: 1px solid var(--theme-color-border-light, #D4C4A8);
	background: var(--theme-color-background-panel, #fff);
	color: var(--theme-color-text-primary, #264653);
}
.pict-login-oauth-btn:hover
{
	background: var(--theme-color-background-secondary, #F5F0E8);
}
.pict-login-oauth-btn--google
{
	border-color: #4285F4;
	color: #4285F4;
}
.pict-login-oauth-btn--google:hover
{
	background: #EBF2FE;
}
.pict-login-oauth-btn--microsoft
{
	border-color: #00A4EF;
	color: #00A4EF;
}
.pict-login-oauth-btn--microsoft:hover
{
	background: #E6F6FE;
}
`};},{}],6:[function(require,module,exports){const libPictViewClass=require('pict-view');const _DefaultConfiguration=require('./Pict-Section-Login-DefaultConfiguration.js');class PictSectionLogin extends libPictViewClass{constructor(pFable,pOptions,pServiceHash){let tmpOptions=Object.assign({},_DefaultConfiguration,pOptions);super(pFable,tmpOptions,pServiceHash);// --- State ---
this.authenticated=false;this.sessionData=null;this.oauthProviders=[];this.initialRenderComplete=false;}// ===== Lifecycle Hooks =====
onBeforeInitialize(){return super.onBeforeInitialize();}onAfterRender(pRenderable){// Inject all registered CSS into the DOM
this.pict.CSSMap.injectCSS();if(!this.initialRenderComplete){this.onAfterInitialRender();this.initialRenderComplete=true;}return super.onAfterRender(pRenderable);}onAfterInitialRender(){// Populate the form (or status) into the wrapper placeholders
this._updateView();if(this.options.CheckSessionOnLoad){this.checkSession();}if(this.options.ShowOAuthProviders){this.loadOAuthProviders();}}// ===== Public API =====
/**
	 * Authenticate with username and password.
	 *
	 * @param {string} pUsername - The username / login ID
	 * @param {string} pPassword - The password
	 * @param {function} [fCallback] - Optional callback(pError, pSessionData)
	 */login(pUsername,pPassword,fCallback){if(typeof fCallback!=='function'){fCallback=()=>{};}this._clearError();let tmpFetchOptions={};let tmpURL=this.options.LoginEndpoint;if(this.options.LoginMethod==='GET'){tmpURL=tmpURL+'/'+encodeURIComponent(pUsername)+'/'+encodeURIComponent(pPassword);tmpFetchOptions.method='GET';}else{tmpFetchOptions.method='POST';tmpFetchOptions.headers={'Content-Type':'application/json'};tmpFetchOptions.body=JSON.stringify({UserName:pUsername,Password:pPassword});}fetch(tmpURL,tmpFetchOptions).then(pResponse=>{return pResponse.json();}).then(pData=>{if(pData&&pData.LoggedIn){this.authenticated=true;this.sessionData=pData;this._storeSessionData(pData);this._updateView();this.onLoginSuccess(pData);this._solveApp();return fCallback(null,pData);}else{let tmpError=pData&&pData.Error?pData.Error:'Authentication failed.';this._displayError(tmpError);this.onLoginFailed(tmpError);return fCallback(tmpError);}}).catch(pError=>{let tmpMessage='Login request failed.';this.log.error('PictSectionLogin login error: '+pError.message);this._displayError(tmpMessage);this.onLoginFailed(tmpMessage);return fCallback(tmpMessage);});}/**
	 * End the current session.
	 *
	 * @param {function} [fCallback] - Optional callback(pError)
	 */logout(fCallback){if(typeof fCallback!=='function'){fCallback=()=>{};}fetch(this.options.LogoutEndpoint).then(pResponse=>{return pResponse.json();}).then(()=>{this.authenticated=false;this.sessionData=null;this._storeSessionData(null);this._updateView();this.onLogout();this._solveApp();return fCallback(null);}).catch(pError=>{this.log.error('PictSectionLogin logout error: '+pError.message);// Clear local state even if network failed
this.authenticated=false;this.sessionData=null;this._storeSessionData(null);this._updateView();this.onLogout();this._solveApp();return fCallback(pError.message);});}/**
	 * Check whether an existing session is active (e.g. from a cookie).
	 *
	 * @param {function} [fCallback] - Optional callback(pError, pSessionData)
	 */checkSession(fCallback){if(typeof fCallback!=='function'){fCallback=()=>{};}fetch(this.options.CheckSessionEndpoint).then(pResponse=>{return pResponse.json();}).then(pData=>{if(pData&&pData.LoggedIn){this.authenticated=true;this.sessionData=pData;this._storeSessionData(pData);this._updateView();}this.onSessionChecked(pData);this._solveApp();return fCallback(null,pData);}).catch(pError=>{this.log.error('PictSectionLogin checkSession error: '+pError.message);this.onSessionChecked(null);return fCallback(pError.message);});}/**
	 * Fetch available OAuth providers and render buttons.
	 *
	 * @param {function} [fCallback] - Optional callback(pError, pProviders)
	 */loadOAuthProviders(fCallback){if(typeof fCallback!=='function'){fCallback=()=>{};}fetch(this.options.OAuthProvidersEndpoint).then(pResponse=>{return pResponse.json();}).then(pData=>{if(pData&&Array.isArray(pData.Providers)){this.oauthProviders=pData.Providers;this._renderOAuthButtons();}return fCallback(null,this.oauthProviders);}).catch(pError=>{this.log.warn('PictSectionLogin loadOAuthProviders: '+pError.message);return fCallback(pError.message);});}// ===== Overridable Hooks =====
// Developers override these for custom post-login/logout behavior.
/**
	 * Called after a successful login.
	 * @param {object} pSessionData - The session data from the server
	 */onLoginSuccess(pSessionData){// Override in subclass or instance
}/**
	 * Called after a failed login attempt.
	 * @param {string} pError - The error message
	 */onLoginFailed(pError){// Override in subclass or instance
}/**
	 * Called after a successful logout.
	 */onLogout(){// Override in subclass or instance
}/**
	 * Called after a session check completes.
	 * @param {object|null} pSessionData - The session data, or null on error
	 */onSessionChecked(pSessionData){// Override in subclass or instance
}// ===== Internal Helpers =====
/**
	 * Wire up DOM event handlers on the login form and logout button.
	 */_wireFormEvents(){let tmpFormElements=this.services.ContentAssignment.getElement('#pict-login-form');if(tmpFormElements&&tmpFormElements.length>0){let tmpForm=tmpFormElements[0];tmpForm.addEventListener('submit',pEvent=>{pEvent.preventDefault();let tmpUsernameInput=tmpForm.querySelector('#pict-login-username');let tmpPasswordInput=tmpForm.querySelector('#pict-login-password');let tmpUsername=tmpUsernameInput?tmpUsernameInput.value:'';let tmpPassword=tmpPasswordInput?tmpPasswordInput.value:'';if(!tmpUsername){this._displayError('Please enter a username.');return;}this.login(tmpUsername,tmpPassword);});}let tmpLogoutElements=this.services.ContentAssignment.getElement('#pict-login-logout');if(tmpLogoutElements&&tmpLogoutElements.length>0){tmpLogoutElements[0].addEventListener('click',()=>{this.logout();});}}/**
	 * Show an error message in the error area.
	 * @param {string} pMessage - The error text
	 */_displayError(pMessage){let tmpErrorElements=this.services.ContentAssignment.getElement('#pict-login-error');if(tmpErrorElements&&tmpErrorElements.length>0){let tmpErrorEl=tmpErrorElements[0];tmpErrorEl.textContent=pMessage;tmpErrorEl.style.display='block';}}/**
	 * Hide the error area.
	 */_clearError(){let tmpErrorElements=this.services.ContentAssignment.getElement('#pict-login-error');if(tmpErrorElements&&tmpErrorElements.length>0){let tmpErrorEl=tmpErrorElements[0];tmpErrorEl.textContent='';tmpErrorEl.style.display='none';}}/**
	 * Re-render the view to reflect current authentication state.
	 * Shows the login form when unauthenticated, or the status bar when authenticated.
	 */_updateView(){let tmpFormAreaElements=this.services.ContentAssignment.getElement('#pict-login-form-area');let tmpStatusAreaElements=this.services.ContentAssignment.getElement('#pict-login-status-area');let tmpOAuthAreaElements=this.services.ContentAssignment.getElement('#pict-login-oauth-area');if(this.authenticated&&this.sessionData){// --- Authenticated: show status, hide form ---
if(tmpFormAreaElements&&tmpFormAreaElements.length>0){tmpFormAreaElements[0].style.display='none';}if(tmpOAuthAreaElements&&tmpOAuthAreaElements.length>0){tmpOAuthAreaElements[0].style.display='none';}if(tmpStatusAreaElements&&tmpStatusAreaElements.length>0){let tmpStatusArea=tmpStatusAreaElements[0];tmpStatusArea.style.display='block';// Render the status template
let tmpStatusHTML=this.pict.parseTemplateByHash('Pict-Login-Template-Status',{});tmpStatusArea.innerHTML=tmpStatusHTML;// Populate display values
let tmpDisplayName='';let tmpDisplayID='';if(this.sessionData.UserRecord){tmpDisplayName=this.sessionData.UserRecord.FullName||this.sessionData.UserRecord.LoginID||this.sessionData.UserRecord.Email||'';tmpDisplayID=this.sessionData.UserRecord.IDUser||this.sessionData.UserID||'';}else if(this.sessionData.UserID){tmpDisplayID=this.sessionData.UserID;}let tmpNameElements=tmpStatusArea.querySelectorAll('#pict-login-display-name');if(tmpNameElements.length>0){tmpNameElements[0].textContent=tmpDisplayName;}let tmpIDElements=tmpStatusArea.querySelectorAll('#pict-login-display-id');if(tmpIDElements.length>0){if(tmpDisplayID){tmpIDElements[0].textContent='ID '+tmpDisplayID;}else{tmpIDElements[0].style.display='none';}}// Wire logout button
let tmpLogoutBtn=tmpStatusArea.querySelector('#pict-login-logout');if(tmpLogoutBtn){tmpLogoutBtn.addEventListener('click',()=>{this.logout();});}}this._clearError();}else{// --- Unauthenticated: show form, hide status ---
if(tmpStatusAreaElements&&tmpStatusAreaElements.length>0){tmpStatusAreaElements[0].style.display='none';tmpStatusAreaElements[0].innerHTML='';}if(tmpFormAreaElements&&tmpFormAreaElements.length>0){let tmpFormArea=tmpFormAreaElements[0];tmpFormArea.style.display='block';// Re-render form if empty
if(!tmpFormArea.querySelector('#pict-login-form')){let tmpFormHTML=this.pict.parseTemplateByHash('Pict-Login-Template-Form',{});tmpFormArea.innerHTML=tmpFormHTML;this._wireFormEvents();}}if(tmpOAuthAreaElements&&tmpOAuthAreaElements.length>0){if(this.options.ShowOAuthProviders&&this.oauthProviders.length>0){tmpOAuthAreaElements[0].style.display='block';}else{tmpOAuthAreaElements[0].style.display='none';}}}}/**
	 * Render OAuth provider buttons into the OAuth area.
	 */_renderOAuthButtons(){let tmpOAuthAreaElements=this.services.ContentAssignment.getElement('#pict-login-oauth-area');if(!tmpOAuthAreaElements||tmpOAuthAreaElements.length<1){return;}if(!this.oauthProviders||this.oauthProviders.length<1){tmpOAuthAreaElements[0].style.display='none';return;}// Render the OAuth container template
let tmpOAuthHTML=this.pict.parseTemplateByHash('Pict-Login-Template-OAuthProviders',{});tmpOAuthAreaElements[0].innerHTML=tmpOAuthHTML;tmpOAuthAreaElements[0].style.display='block';// Build individual provider buttons
let tmpButtonContainer=tmpOAuthAreaElements[0].querySelector('#pict-login-oauth-buttons');if(!tmpButtonContainer){return;}let tmpButtonsHTML='';for(let i=0;i<this.oauthProviders.length;i++){let tmpProvider=this.oauthProviders[i];let tmpName=tmpProvider.Name||'provider';let tmpBeginURL=tmpProvider.BeginURL||this.options.OAuthBeginEndpoint+'/'+tmpName;let tmpDisplayName=tmpName.charAt(0).toUpperCase()+tmpName.slice(1);let tmpCSSModifier=tmpName.toLowerCase();tmpButtonsHTML+='<a class="pict-login-oauth-btn pict-login-oauth-btn--'+tmpCSSModifier+'" href="'+tmpBeginURL+'">Sign in with '+tmpDisplayName+'</a>';}tmpButtonContainer.innerHTML=tmpButtonsHTML;}/**
	 * Store session data at the configured Pict address.
	 * @param {object|null} pData - Session data to store
	 */_storeSessionData(pData){if(this.options.SessionDataAddress){let tmpAddressSpace={Fable:this.fable,Pict:this.fable,AppData:this.pict.AppData,Bundle:this.pict.Bundle};this.fable.manifest.setValueByHash(tmpAddressSpace,this.options.SessionDataAddress,pData);}}/**
	 * Trigger a solve on the PictApplication if one exists.
	 */_solveApp(){if(this.pict&&this.pict.PictApplication&&typeof this.pict.PictApplication.solve==='function'){this.pict.PictApplication.solve();}}}module.exports=PictSectionLogin;module.exports.default_configuration=_DefaultConfiguration;},{"./Pict-Section-Login-DefaultConfiguration.js":5,"pict-view":18}],7:[function(require,module,exports){/**
 * Pict-Modal-Confirm
 *
 * Builds confirm and double-confirm dialog DOM, returns Promises.
 */class PictModalConfirm{constructor(pModal){this._modal=pModal;}/**
	 * Show a single-step confirmation dialog.
	 *
	 * @param {string} pMessage - The confirmation message
	 * @param {object} [pOptions] - Options (title, confirmLabel, cancelLabel, dangerous)
	 * @returns {Promise<boolean>}
	 */confirm(pMessage,pOptions){let tmpOptions=Object.assign({},this._modal.options.DefaultConfirmOptions,pOptions);return new Promise(fResolve=>{let tmpDialog=this._buildDialog(tmpOptions.title,pMessage,fResolve,tmpOptions);this._showDialog(tmpDialog,fResolve);});}/**
	 * Show a two-step confirmation dialog.
	 *
	 * If confirmPhrase is provided, user must type it to enable the confirm button.
	 * Otherwise, first click changes button text, second click confirms.
	 *
	 * @param {string} pMessage - The confirmation message
	 * @param {object} [pOptions] - Options (title, confirmPhrase, phrasePrompt, confirmLabel, cancelLabel)
	 * @returns {Promise<boolean>}
	 */doubleConfirm(pMessage,pOptions){let tmpOptions=Object.assign({},this._modal.options.DefaultDoubleConfirmOptions,pOptions);return new Promise(fResolve=>{let tmpDialog=this._buildDoubleConfirmDialog(tmpOptions.title,pMessage,fResolve,tmpOptions);this._showDialog(tmpDialog,fResolve);});}/**
	 * Build a standard confirm dialog element.
	 *
	 * @param {string} pTitle
	 * @param {string} pMessage
	 * @param {function} fResolve - Promise resolver
	 * @param {object} pOptions
	 * @returns {HTMLElement}
	 */_buildDialog(pTitle,pMessage,fResolve,pOptions){let tmpId=this._modal._nextId();let tmpBtnStyle=pOptions.dangerous?'danger':'primary';let tmpDialog=document.createElement('div');tmpDialog.className='pict-modal-dialog';if(pOptions.unbounded){tmpDialog.className+=' pict-modal-dialog--unbounded';}tmpDialog.id='pict-modal-'+tmpId;tmpDialog.setAttribute('role','dialog');tmpDialog.setAttribute('aria-modal','true');tmpDialog.style.width='420px';tmpDialog.innerHTML='<div class="pict-modal-dialog-header">'+'<span class="pict-modal-dialog-title">'+this._escapeHTML(pTitle)+'</span>'+'<button class="pict-modal-dialog-close" aria-label="Close">&times;</button>'+'</div>'+'<div class="pict-modal-dialog-body">'+'<p>'+this._escapeHTML(pMessage)+'</p>'+'</div>'+'<div class="pict-modal-dialog-footer">'+'<button class="pict-modal-btn" data-action="cancel">'+this._escapeHTML(pOptions.cancelLabel)+'</button>'+'<button class="pict-modal-btn pict-modal-btn--'+tmpBtnStyle+'" data-action="confirm">'+this._escapeHTML(pOptions.confirmLabel)+'</button>'+'</div>';let tmpCloseBtn=tmpDialog.querySelector('.pict-modal-dialog-close');let tmpCancelBtn=tmpDialog.querySelector('[data-action="cancel"]');let tmpConfirmBtn=tmpDialog.querySelector('[data-action="confirm"]');let tmpDismiss=pResult=>{this._dismissDialog(tmpDialog,pResult,fResolve);};tmpCloseBtn.addEventListener('click',()=>{tmpDismiss(false);});tmpCancelBtn.addEventListener('click',()=>{tmpDismiss(false);});tmpConfirmBtn.addEventListener('click',()=>{tmpDismiss(true);});tmpDialog._dismiss=tmpDismiss;tmpDialog._focusTarget=tmpCancelBtn;return tmpDialog;}/**
	 * Build a double-confirm dialog element.
	 *
	 * @param {string} pTitle
	 * @param {string} pMessage
	 * @param {function} fResolve - Promise resolver
	 * @param {object} pOptions
	 * @returns {HTMLElement}
	 */_buildDoubleConfirmDialog(pTitle,pMessage,fResolve,pOptions){let tmpId=this._modal._nextId();let tmpHasPhrase=typeof pOptions.confirmPhrase==='string'&&pOptions.confirmPhrase.length>0;let tmpDialog=document.createElement('div');tmpDialog.className='pict-modal-dialog';if(pOptions.unbounded){tmpDialog.className+=' pict-modal-dialog--unbounded';}tmpDialog.id='pict-modal-'+tmpId;tmpDialog.setAttribute('role','dialog');tmpDialog.setAttribute('aria-modal','true');tmpDialog.style.width='420px';let tmpBodyContent='<p>'+this._escapeHTML(pMessage)+'</p>';if(tmpHasPhrase){let tmpPromptText=pOptions.phrasePrompt.replace('{phrase}',pOptions.confirmPhrase);tmpBodyContent+='<div class="pict-modal-confirm-prompt">'+this._escapeHTML(tmpPromptText)+'</div>'+'<input type="text" class="pict-modal-confirm-input" autocomplete="off" spellcheck="false" />';}tmpDialog.innerHTML='<div class="pict-modal-dialog-header">'+'<span class="pict-modal-dialog-title">'+this._escapeHTML(pTitle)+'</span>'+'<button class="pict-modal-dialog-close" aria-label="Close">&times;</button>'+'</div>'+'<div class="pict-modal-dialog-body">'+tmpBodyContent+'</div>'+'<div class="pict-modal-dialog-footer">'+'<button class="pict-modal-btn" data-action="cancel">'+this._escapeHTML(pOptions.cancelLabel)+'</button>'+'<button class="pict-modal-btn pict-modal-btn--danger" data-action="confirm" disabled>'+this._escapeHTML(pOptions.confirmLabel)+'</button>'+'</div>';let tmpCloseBtn=tmpDialog.querySelector('.pict-modal-dialog-close');let tmpCancelBtn=tmpDialog.querySelector('[data-action="cancel"]');let tmpConfirmBtn=tmpDialog.querySelector('[data-action="confirm"]');let tmpDismiss=pResult=>{this._dismissDialog(tmpDialog,pResult,fResolve);};tmpCloseBtn.addEventListener('click',()=>{tmpDismiss(false);});tmpCancelBtn.addEventListener('click',()=>{tmpDismiss(false);});if(tmpHasPhrase){// Phrase-based: enable confirm button when input matches
let tmpInput=tmpDialog.querySelector('.pict-modal-confirm-input');tmpInput.addEventListener('input',()=>{tmpConfirmBtn.disabled=tmpInput.value!==pOptions.confirmPhrase;});tmpConfirmBtn.addEventListener('click',()=>{if(!tmpConfirmBtn.disabled){tmpDismiss(true);}});tmpDialog._focusTarget=tmpInput;}else{// Two-click: first click changes label, second click confirms
let tmpClickCount=0;let tmpOriginalLabel=pOptions.confirmLabel;tmpConfirmBtn.disabled=false;tmpConfirmBtn.addEventListener('click',()=>{tmpClickCount++;if(tmpClickCount===1){tmpConfirmBtn.textContent='Click again to confirm';}else{tmpDismiss(true);}});tmpDialog._focusTarget=tmpCancelBtn;}tmpDialog._dismiss=tmpDismiss;return tmpDialog;}/**
	 * Show a dialog element: append to body, show overlay, animate in.
	 *
	 * @param {HTMLElement} pDialog
	 * @param {function} fResolve - Promise resolver (for overlay click dismiss)
	 */_showDialog(pDialog,fResolve){let tmpModalEntry={element:pDialog,dismiss:pDialog._dismiss,type:'confirm'};// Show overlay
let tmpOverlayClickHandler=null;if(this._modal.options.OverlayClickDismisses){tmpOverlayClickHandler=()=>{pDialog._dismiss(false);};}this._modal._overlay.show(tmpOverlayClickHandler);// Append to body
document.body.appendChild(pDialog);// Track active modal
this._modal._activeModals.push(tmpModalEntry);// Animate in
void pDialog.offsetHeight;pDialog.classList.add('pict-modal-visible');// Focus
if(pDialog._focusTarget){pDialog._focusTarget.focus();}// Keyboard handler
pDialog._keyHandler=pEvent=>{if(pEvent.key==='Escape'){pDialog._dismiss(false);}};document.addEventListener('keydown',pDialog._keyHandler);}/**
	 * Dismiss a dialog: animate out, remove from DOM, hide overlay.
	 *
	 * @param {HTMLElement} pDialog
	 * @param {*} pResult - Value to resolve the promise with
	 * @param {function} fResolve - Promise resolver
	 */_dismissDialog(pDialog,pResult,fResolve){// Prevent double-dismiss
if(pDialog._dismissed){return;}pDialog._dismissed=true;// Remove keyboard handler
if(pDialog._keyHandler){document.removeEventListener('keydown',pDialog._keyHandler);}// Animate out
pDialog.classList.remove('pict-modal-visible');// Remove from active modals
this._modal._activeModals=this._modal._activeModals.filter(pEntry=>{return pEntry.element!==pDialog;});// Update overlay click handler to point to new topmost modal
if(this._modal._activeModals.length>0){let tmpTopModal=this._modal._activeModals[this._modal._activeModals.length-1];this._modal._overlay.updateClickHandler(this._modal.options.OverlayClickDismisses?tmpTopModal.dismiss:null);}// Hide overlay
this._modal._overlay.hide();// Remove from DOM after transition
setTimeout(()=>{if(pDialog.parentNode){pDialog.parentNode.removeChild(pDialog);}},220);// Resolve promise
fResolve(pResult);}/**
	 * Escape HTML special characters.
	 *
	 * @param {string} pText
	 * @returns {string}
	 */_escapeHTML(pText){if(typeof pText!=='string'){return'';}return pText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}}module.exports=PictModalConfirm;},{}],8:[function(require,module,exports){/**
 * Pict-Modal-Dropdown
 *
 * Anchor-positioned menu that behaves like a dropdown / popover. Handy for:
 *   - nav menus that hang off a header link or button
 *   - "split button" style addenda (a primary action paired with a chevron
 *     that opens a list of related/alternate actions)
 *   - any "more options" affordance where a full modal would be heavy
 *
 * Differences from the modal Window helper:
 *   - No backdrop overlay — the rest of the page stays interactive.
 *   - Positioned next to the anchor element, not centered.
 *   - Auto-flips above when there isn't room below; clamps inside the viewport.
 *   - Click outside or Escape dismisses (matches native menu conventions).
 *
 * Usage:
 *     modal.dropdown(anchorEl, {
 *         items:
 *         [
 *             { Hash: 'edit',   Label: 'Edit'                    },
 *             { Hash: 'rename', Label: 'Rename...'                },
 *             { Separator: true                                   },
 *             { Hash: 'delete', Label: 'Delete', Style: 'danger'  },
 *             { Hash: 'archive',Label: 'Archive', Disabled: true,
 *               Tooltip: 'Already archived'                       }
 *         ],
 *         align: 'left'        // 'left' | 'right' (relative to anchor)
 *     }).then((pChoice) => { ... });
 *
 * Returns a Promise that resolves with `{ Hash, Item }` on selection or
 * `null` on dismiss.
 */class PictModalDropdown{constructor(pModal){this._modal=pModal;this._activeMenu=null;}/**
	 * Open a dropdown menu anchored to an element.
	 *
	 * @param {HTMLElement|string|object} pAnchor - Element, CSS selector, or
	 *   a rect-like { left, top, width, height } anchor (handy for context menus).
	 * @param {object} pOptions
	 * @param {Array}    pOptions.items     - [{ Hash, Label, Style?, Disabled?, Tooltip?, Icon?, Separator? }]
	 * @param {string}   [pOptions.align]   - 'left'|'right' (default 'left')
	 * @param {string}   [pOptions.position]- 'auto'|'below'|'above' (default 'auto')
	 * @param {string}   [pOptions.minWidth]- CSS minWidth (default: anchor width if known, else '160px')
	 * @param {string}   [pOptions.maxHeight]- CSS maxHeight (default '60vh')
	 * @param {string}   [pOptions.className]- extra class(es) for the menu element
	 * @param {boolean}  [pOptions.closeOnSelect] - default true
	 * @param {function} [pOptions.onSelect]- called with (Hash, Item) on selection
	 * @param {function} [pOptions.onClose] - called after dismiss
	 * @returns {Promise<{Hash: string, Item: object}|null>}
	 */dropdown(pAnchor,pOptions){let tmpOptions=Object.assign({align:'left',position:'auto',maxHeight:'60vh',closeOnSelect:true},pOptions||{});let tmpAnchorEl=this._resolveAnchor(pAnchor);let tmpAnchorRect=this._anchorRect(pAnchor,tmpAnchorEl);if(!tmpAnchorRect){return Promise.resolve(null);}// Re-opening the same menu is a no-op; closing-then-reopening is a
// caller decision (just call dismissDropdown() first).
if(this._activeMenu&&this._activeMenu.anchor===tmpAnchorEl){return this._activeMenu.promise;}// Only one dropdown at a time keeps focus / keyboard handling sane.
this.dismissAll();let tmpItems=Array.isArray(tmpOptions.items)?tmpOptions.items:[];let tmpResolveOuter;let tmpPromise=new Promise(fResolve=>{tmpResolveOuter=fResolve;});let tmpMenu=this._buildMenu(tmpItems,tmpOptions);document.body.appendChild(tmpMenu);this._positionMenu(tmpMenu,tmpAnchorRect,tmpOptions);// Animate in on the next frame.
void tmpMenu.offsetHeight;tmpMenu.classList.add('pict-modal-visible');let tmpDismiss=pResult=>{if(tmpMenu._dismissed){return;}tmpMenu._dismissed=true;document.removeEventListener('mousedown',tmpOutsideHandler,true);document.removeEventListener('keydown',tmpKeyHandler,true);window.removeEventListener('resize',tmpRepositionHandler);window.removeEventListener('scroll',tmpRepositionHandler,true);tmpMenu.classList.remove('pict-modal-visible');setTimeout(()=>{if(tmpMenu.parentNode){tmpMenu.parentNode.removeChild(tmpMenu);}},180);if(this._activeMenu&&this._activeMenu.element===tmpMenu){this._activeMenu=null;}if(typeof tmpOptions.onClose==='function'){tmpOptions.onClose(pResult);}tmpResolveOuter(pResult);};// Wire item clicks (each item element carries a data-hash; separators
// and disabled items are skipped).
let tmpItemEls=tmpMenu.querySelectorAll('[data-pict-modal-dropdown-item]');for(let i=0;i<tmpItemEls.length;i++){let tmpEl=tmpItemEls[i];tmpEl.addEventListener('click',pEvent=>{if(tmpEl.hasAttribute('data-disabled')){return;}pEvent.stopPropagation();let tmpIdx=parseInt(tmpEl.getAttribute('data-index'),10);let tmpItem=tmpItems[tmpIdx];let tmpHash=tmpEl.getAttribute('data-hash');if(typeof tmpOptions.onSelect==='function'){tmpOptions.onSelect(tmpHash,tmpItem);}if(tmpOptions.closeOnSelect!==false){tmpDismiss({Hash:tmpHash,Item:tmpItem});}});}// Click anywhere outside the menu (and outside the anchor) → dismiss.
// Use mousedown/capture so we beat any per-element click handlers.
let tmpOutsideHandler=pEvent=>{if(tmpMenu.contains(pEvent.target)){return;}if(tmpAnchorEl&&tmpAnchorEl.contains&&tmpAnchorEl.contains(pEvent.target)){return;}tmpDismiss(null);};document.addEventListener('mousedown',tmpOutsideHandler,true);// Esc dismisses; arrow keys navigate items (skipping disabled/separator).
let tmpKeyHandler=pEvent=>{if(pEvent.key==='Escape'){pEvent.stopPropagation();tmpDismiss(null);return;}if(pEvent.key==='ArrowDown'||pEvent.key==='ArrowUp'){pEvent.preventDefault();this._focusNeighbor(tmpMenu,pEvent.key==='ArrowDown'?1:-1);}else if(pEvent.key==='Enter'||pEvent.key===' '){let tmpFocused=document.activeElement;if(tmpFocused&&tmpMenu.contains(tmpFocused)&&tmpFocused.hasAttribute('data-pict-modal-dropdown-item')){pEvent.preventDefault();tmpFocused.click();}}};document.addEventListener('keydown',tmpKeyHandler,true);// Reposition on viewport resize / scroll so the menu doesn't drift
// off the anchor.
let tmpRepositionHandler=()=>{let tmpRect=this._anchorRect(pAnchor,tmpAnchorEl);if(tmpRect){this._positionMenu(tmpMenu,tmpRect,tmpOptions);}};window.addEventListener('resize',tmpRepositionHandler);window.addEventListener('scroll',tmpRepositionHandler,true);// Move keyboard focus to the first enabled item so arrows / Enter work
// without an extra click.
setTimeout(()=>{this._focusFirstEnabled(tmpMenu);},0);this._activeMenu={element:tmpMenu,anchor:tmpAnchorEl,promise:tmpPromise,dismiss:tmpDismiss};return tmpPromise;}/**
	 * Dismiss the currently-open dropdown (if any).
	 */dismissAll(){if(this._activeMenu){let tmpDismiss=this._activeMenu.dismiss;this._activeMenu=null;tmpDismiss(null);}}// ─────────────────────────────────────────────
//  Internals
// ─────────────────────────────────────────────
_resolveAnchor(pAnchor){if(!pAnchor){return null;}if(typeof pAnchor==='string'){return document.querySelector(pAnchor);}if(pAnchor.nodeType===1){return pAnchor;}// rect-like — no element to attach focus / outside-click ignore to,
// but that's fine, the caller knows what they're doing.
return null;}_anchorRect(pAnchor,pAnchorEl){if(pAnchorEl&&typeof pAnchorEl.getBoundingClientRect==='function'){return pAnchorEl.getBoundingClientRect();}if(pAnchor&&typeof pAnchor==='object'&&typeof pAnchor.left==='number'&&typeof pAnchor.top==='number'){return{left:pAnchor.left,top:pAnchor.top,width:pAnchor.width||0,height:pAnchor.height||0,right:pAnchor.left+(pAnchor.width||0),bottom:pAnchor.top+(pAnchor.height||0)};}return null;}_buildMenu(pItems,pOptions){let tmpId=this._modal._nextId();let tmpMenu=document.createElement('div');tmpMenu.className='pict-modal-dropdown';if(pOptions.className){tmpMenu.className+=' '+pOptions.className;}tmpMenu.id='pict-modal-dropdown-'+tmpId;tmpMenu.setAttribute('role','menu');tmpMenu.style.maxHeight=pOptions.maxHeight;let tmpHtml='';for(let i=0;i<pItems.length;i++){let tmpItem=pItems[i];if(tmpItem.Separator){tmpHtml+='<div class="pict-modal-dropdown-separator" role="separator"></div>';continue;}if(tmpItem.Header){tmpHtml+='<div class="pict-modal-dropdown-header">'+this._escapeHTML(tmpItem.Header)+'</div>';continue;}let tmpCls='pict-modal-dropdown-item';if(tmpItem.Style){tmpCls+=' pict-modal-dropdown-item--'+tmpItem.Style;}if(tmpItem.Disabled){tmpCls+=' pict-modal-dropdown-item--disabled';}let tmpAttrs=''+' data-pict-modal-dropdown-item'+' data-index="'+i+'"'+' data-hash="'+this._escapeHTML(tmpItem.Hash||'')+'"'+' role="menuitem"'+' tabindex="-1"';if(tmpItem.Disabled){tmpAttrs+=' aria-disabled="true" data-disabled';}if(tmpItem.Tooltip){tmpAttrs+=' title="'+this._escapeHTML(tmpItem.Tooltip)+'"';}let tmpIcon=tmpItem.Icon?'<span class="pict-modal-dropdown-item-icon">'+tmpItem.Icon+'</span>':'';let tmpHint=tmpItem.Hint?'<span class="pict-modal-dropdown-item-hint">'+this._escapeHTML(tmpItem.Hint)+'</span>':'';tmpHtml+='<div class="'+tmpCls+'"'+tmpAttrs+'>'+tmpIcon+'<span class="pict-modal-dropdown-item-label">'+this._escapeHTML(tmpItem.Label||'')+'</span>'+tmpHint+'</div>';}tmpMenu.innerHTML=tmpHtml;return tmpMenu;}_positionMenu(pMenu,pAnchorRect,pOptions){// Apply min-width before measuring so the menu's natural size accounts
// for the constraint.
let tmpMinWidth=pOptions.minWidth||(pAnchorRect.width>=80?Math.ceil(pAnchorRect.width)+'px':'160px');pMenu.style.minWidth=tmpMinWidth;// Measure after attaching.
let tmpMenuRect=pMenu.getBoundingClientRect();let tmpVw=window.innerWidth||document.documentElement.clientWidth;let tmpVh=window.innerHeight||document.documentElement.clientHeight;let tmpGap=4;// breathing room between anchor and menu
// Vertical: prefer below; flip above when not enough room and there's
// more above. 'below'/'above' overrides force the side.
let tmpRoomBelow=tmpVh-pAnchorRect.bottom-tmpGap;let tmpRoomAbove=pAnchorRect.top-tmpGap;let tmpPlaceAbove;if(pOptions.position==='above'){tmpPlaceAbove=true;}else if(pOptions.position==='below'){tmpPlaceAbove=false;}else{tmpPlaceAbove=tmpMenuRect.height>tmpRoomBelow&&tmpRoomAbove>tmpRoomBelow;}// Cap height to whichever side we landed on so the menu can scroll
// internally instead of running off the screen.
let tmpCap=Math.max(80,(tmpPlaceAbove?tmpRoomAbove:tmpRoomBelow)-8);pMenu.style.maxHeight=tmpCap+'px';// Horizontal alignment to the anchor, then clamp inside the viewport.
let tmpLeft;if(pOptions.align==='right'){tmpLeft=pAnchorRect.right-tmpMenuRect.width;}else if(pOptions.align==='center'){tmpLeft=pAnchorRect.left+(pAnchorRect.width-tmpMenuRect.width)/2;}else{tmpLeft=pAnchorRect.left;}tmpLeft=Math.min(tmpLeft,tmpVw-tmpMenuRect.width-4);tmpLeft=Math.max(4,tmpLeft);let tmpTop;if(tmpPlaceAbove){tmpTop=Math.max(4,pAnchorRect.top-tmpMenuRect.height-tmpGap);pMenu.classList.add('pict-modal-dropdown--above');}else{tmpTop=pAnchorRect.bottom+tmpGap;pMenu.classList.remove('pict-modal-dropdown--above');}pMenu.style.left=Math.round(tmpLeft)+'px';pMenu.style.top=Math.round(tmpTop)+'px';}_focusFirstEnabled(pMenu){let tmpItems=pMenu.querySelectorAll('[data-pict-modal-dropdown-item]:not([data-disabled])');if(tmpItems.length){tmpItems[0].focus();}}_focusNeighbor(pMenu,pDirection){let tmpItems=Array.prototype.slice.call(pMenu.querySelectorAll('[data-pict-modal-dropdown-item]:not([data-disabled])'));if(!tmpItems.length){return;}let tmpActive=document.activeElement;let tmpIdx=tmpItems.indexOf(tmpActive);let tmpNext=tmpIdx===-1?pDirection>0?0:tmpItems.length-1:(tmpIdx+pDirection+tmpItems.length)%tmpItems.length;tmpItems[tmpNext].focus();}_escapeHTML(pText){if(typeof pText!=='string'){return'';}return pText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}}module.exports=PictModalDropdown;},{}],9:[function(require,module,exports){/**
 * Pict-Modal-Overlay
 *
 * Manages a shared backdrop overlay element appended to document.body.
 * Reference-counted — created on first modal open, removed when last closes.
 */class PictModalOverlay{constructor(pModal){this._modal=pModal;this._element=null;this._refCount=0;}/**
	 * Show the overlay (incrementing reference count).
	 * Creates the DOM element on first call.
	 *
	 * @param {function} [fOnClick] - Optional click handler (e.g. dismiss topmost modal)
	 */show(fOnClick){this._refCount++;if(!this._element){this._element=document.createElement('div');this._element.className='pict-modal-overlay';document.body.appendChild(this._element);// Force reflow so the transition animates
void this._element.offsetHeight;this._element.classList.add('pict-modal-visible');}if(fOnClick){// Store the latest click handler (for the topmost modal)
this._currentClickHandler=fOnClick;this._element.onclick=pEvent=>{if(pEvent.target===this._element&&this._currentClickHandler){this._currentClickHandler();}};}}/**
	 * Update the overlay click handler (e.g. when topmost modal changes).
	 *
	 * @param {function} [fOnClick] - New click handler
	 */updateClickHandler(fOnClick){this._currentClickHandler=fOnClick||null;}/**
	 * Hide the overlay (decrementing reference count).
	 * Removes the DOM element when reference count reaches zero.
	 */hide(){this._refCount--;if(this._refCount<=0){this._refCount=0;if(this._element){this._element.classList.remove('pict-modal-visible');let tmpElement=this._element;// Remove after transition
setTimeout(()=>{if(tmpElement.parentNode){tmpElement.parentNode.removeChild(tmpElement);}},220);this._element=null;this._currentClickHandler=null;}}}/**
	 * Force-remove the overlay regardless of reference count.
	 */destroy(){this._refCount=0;if(this._element&&this._element.parentNode){this._element.parentNode.removeChild(this._element);}this._element=null;this._currentClickHandler=null;}}module.exports=PictModalOverlay;},{}],10:[function(require,module,exports){/**
 * Pict-Modal-Panel
 *
 * Adds resizable and collapsible panel behavior to any DOM element.
 * Follows the handler composition pattern used by the other modal
 * handlers (confirm, window, toast, tooltip).
 *
 * Usage:
 *   let handle = modal.panel('#my-panel', { position: 'right', width: 340 });
 *   handle.toggle();
 *   handle.destroy();
 */class PictModalPanel{constructor(pModal){this._modal=pModal;this._panels=[];}/**
	 * Attach resizable/collapsible panel behavior to an element.
	 *
	 * @param {string} pTargetSelector - CSS selector for the panel element
	 * @param {object} [pOptions] - Panel options
	 * @returns {{ collapse, expand, toggle, setWidth, destroy }} Panel handle
	 */create(pTargetSelector,pOptions){let tmpDefaults=this._modal&&this._modal.options&&this._modal.options.DefaultPanelOptions||{};let tmpOptions=Object.assign({},{position:'right',width:340,minWidth:200,maxWidth:600,collapsible:true,collapsed:false,persist:false,persistKey:'',onResize:null,onToggle:null},tmpDefaults,pOptions);if(typeof document==='undefined')return this._nullHandle();let tmpTarget=document.querySelector(pTargetSelector);if(!tmpTarget)return this._nullHandle();let tmpId=this._modal._nextId();let tmpIsRight=tmpOptions.position==='right';let tmpIsCollapsed=false;let tmpCurrentWidth=tmpOptions.width;let tmpDestroyed=false;// Restore persisted state
if(tmpOptions.persist&&tmpOptions.persistKey){try{let tmpStored=localStorage.getItem('pict-panel-'+tmpOptions.persistKey);if(tmpStored){let tmpParsed=JSON.parse(tmpStored);if(typeof tmpParsed.width==='number')tmpCurrentWidth=tmpParsed.width;if(typeof tmpParsed.collapsed==='boolean')tmpOptions.collapsed=tmpParsed.collapsed;}}catch(e){/* ignore */}}// Apply classes and initial width
tmpTarget.classList.add('pict-panel');tmpTarget.classList.add(tmpIsRight?'pict-panel-right':'pict-panel-left');tmpTarget.style.width=tmpCurrentWidth+'px';// Remove display:none if present — panel uses width collapse instead
if(tmpTarget.style.display==='none'){tmpTarget.style.display='';}// ── Create the edge container ───────────────────────
let tmpEdge=document.createElement('div');tmpEdge.className='pict-panel-edge '+(tmpIsRight?'pict-panel-edge-right':'pict-panel-edge-left');// Resize handle
let tmpResize=document.createElement('div');tmpResize.className='pict-panel-resize';tmpEdge.appendChild(tmpResize);// Collapse tab (chevron SVG)
let tmpTab=null;if(tmpOptions.collapsible){tmpTab=document.createElement('div');tmpTab.className='pict-panel-tab';tmpTab.title='Toggle panel';tmpEdge.appendChild(tmpTab);}// Insert edge as a sibling so it is not clipped by the
// panel's own overflow (e.g. overflow-y: auto for scrolling).
// Right panels: edge goes BEFORE the panel (left side).
// Left panels: edge goes AFTER the panel (right side).
if(tmpTarget.parentNode){if(tmpIsRight){tmpTarget.parentNode.insertBefore(tmpEdge,tmpTarget);}else{tmpTarget.parentNode.insertBefore(tmpEdge,tmpTarget.nextSibling);}}else{tmpTarget.insertBefore(tmpEdge,tmpTarget.firstChild);}// ── Chevron lookup via pict.providers.Icon ──────────
// Both directions come from the core registry (`{~I:ChevronLeft~}`
// / `{~I:ChevronRight~}`).  Resolved per-render so a theme that
// re-registers the chevron variant picks up automatically.  Empty
// fallback in the unlikely case pict is missing the Icon provider
// (very old pict versions; current minimum is 1.0.368).
let tmpPictHandle=typeof window!=='undefined'&&window.pict?window.pict:null;let tmpIcon=pName=>tmpPictHandle&&typeof tmpPictHandle.icon==='function'?tmpPictHandle.icon(pName):'';let tmpUpdateChevron=()=>{if(!tmpTab)return;let tmpChevronRight=tmpIcon('ChevronRight');let tmpChevronLeft=tmpIcon('ChevronLeft');if(tmpIsRight){tmpTab.innerHTML=tmpIsCollapsed?tmpChevronLeft:tmpChevronRight;}else{tmpTab.innerHTML=tmpIsCollapsed?tmpChevronRight:tmpChevronLeft;}};// ── Persist helper ──────────────────────────────────
let tmpPersist=()=>{if(!tmpOptions.persist||!tmpOptions.persistKey)return;try{localStorage.setItem('pict-panel-'+tmpOptions.persistKey,JSON.stringify({width:tmpCurrentWidth,collapsed:tmpIsCollapsed}));}catch(e){/* ignore */}};// ── Collapse / expand ───────────────────────────────
let tmpCollapse=()=>{if(tmpIsCollapsed||tmpDestroyed)return;tmpIsCollapsed=true;tmpTarget.classList.add('pict-panel-collapsed');tmpEdge.classList.add('pict-panel-edge-collapsed');tmpUpdateChevron();tmpPersist();if(typeof tmpOptions.onToggle==='function')tmpOptions.onToggle(true);};let tmpExpand=()=>{if(!tmpIsCollapsed||tmpDestroyed)return;tmpIsCollapsed=false;tmpEdge.classList.remove('pict-panel-edge-collapsed');tmpTarget.classList.remove('pict-panel-collapsed');tmpTarget.style.width=tmpCurrentWidth+'px';tmpUpdateChevron();tmpPersist();if(typeof tmpOptions.onToggle==='function')tmpOptions.onToggle(false);};let tmpToggle=()=>{if(tmpIsCollapsed)tmpExpand();else tmpCollapse();};let tmpSetWidth=pWidth=>{if(tmpDestroyed)return;let tmpWidth=Math.max(tmpOptions.minWidth,Math.min(tmpOptions.maxWidth,pWidth));tmpCurrentWidth=tmpWidth;if(!tmpIsCollapsed){tmpTarget.style.width=tmpWidth+'px';}tmpPersist();if(typeof tmpOptions.onResize==='function')tmpOptions.onResize(tmpWidth);};// ── Tab click ───────────────────────────────────────
if(tmpTab){tmpTab.addEventListener('click',pEvent=>{pEvent.stopPropagation();tmpToggle();});}// ── Resize drag ─────────────────────────────────────
let tmpOnMouseDown=pEvent=>{if(tmpIsCollapsed)return;pEvent.preventDefault();let tmpStartX=pEvent.clientX;let tmpStartWidth=tmpTarget.offsetWidth;tmpResize.classList.add('dragging');tmpTarget.style.transition='none';document.body.style.userSelect='none';document.body.style.cursor='col-resize';let tmpOnMouseMove=pMoveEvent=>{let tmpDelta=tmpIsRight?tmpStartX-pMoveEvent.clientX:pMoveEvent.clientX-tmpStartX;let tmpNewWidth=Math.max(tmpOptions.minWidth,Math.min(tmpOptions.maxWidth,tmpStartWidth+tmpDelta));tmpTarget.style.width=tmpNewWidth+'px';};let tmpOnMouseUp=pUpEvent=>{document.removeEventListener('mousemove',tmpOnMouseMove);document.removeEventListener('mouseup',tmpOnMouseUp);tmpResize.classList.remove('dragging');tmpTarget.style.transition='';document.body.style.userSelect='';document.body.style.cursor='';// Capture the final width
tmpCurrentWidth=tmpTarget.offsetWidth;tmpPersist();if(typeof tmpOptions.onResize==='function')tmpOptions.onResize(tmpCurrentWidth);};document.addEventListener('mousemove',tmpOnMouseMove);document.addEventListener('mouseup',tmpOnMouseUp);};tmpResize.addEventListener('mousedown',tmpOnMouseDown);// ── Initial state ───────────────────────────────────
tmpUpdateChevron();if(tmpOptions.collapsed){tmpIsCollapsed=true;tmpTarget.classList.add('pict-panel-collapsed');tmpEdge.classList.add('pict-panel-edge-collapsed');tmpUpdateChevron();}// ── Destroy ─────────────────────────────────────────
let tmpDestroy=()=>{if(tmpDestroyed)return;tmpDestroyed=true;tmpResize.removeEventListener('mousedown',tmpOnMouseDown);if(tmpEdge.parentNode)tmpEdge.remove();tmpTarget.classList.remove('pict-panel','pict-panel-right','pict-panel-left','pict-panel-collapsed');tmpTarget.style.width='';tmpTarget.style.transition='';let tmpIdx=this._panels.indexOf(tmpHandle);if(tmpIdx>=0)this._panels.splice(tmpIdx,1);};// ── Return handle ───────────────────────────────────
let tmpHandle={id:tmpId,collapse:tmpCollapse,expand:tmpExpand,toggle:tmpToggle,setWidth:tmpSetWidth,destroy:tmpDestroy};this._panels.push(tmpHandle);return tmpHandle;}/**
	 * Return a no-op handle for server-side or missing-element cases.
	 */_nullHandle(){return{id:0,collapse:()=>{},expand:()=>{},toggle:()=>{},setWidth:()=>{},destroy:()=>{}};}/**
	 * Destroy all active panels.
	 */destroyAll(){let tmpPanels=this._panels.slice();for(let i=0;i<tmpPanels.length;i++){tmpPanels[i].destroy();}}}module.exports=PictModalPanel;},{}],11:[function(require,module,exports){/**
 * Pict-Modal-Shell — viewport-managing layout system for top / right /
 * bottom / left panels around a center.
 *
 * # What this is for
 *
 * Most apps grow a chrome of stacked bars: a topbar, sometimes a
 * sub-nav, sometimes a bottom status bar, often a left sidebar, maybe
 * a right inspector. Each one has its own collapse / resize / persist
 * concerns, and apps end up reinventing the layout glue + the chrome
 * controls per-app.
 *
 * The Shell solves this once. The host calls `modal.shell(viewport)`,
 * adds panels in the order they should stack from each edge, and the
 * Shell manages:
 *
 *   - DOM structure (a flex tree wrapping the viewport)
 *   - Layout placement (multiple panels per side, each in registration order)
 *   - Collapse / expand chrome (a thin tab strip when collapsed)
 *   - Resize chrome (drag handle on the inner edge)
 *   - Pinned (in-flow) vs overlay (absolutely-positioned) panels
 *   - Persistence (per-panel collapsed + size, scoped by host or custom key)
 *   - Center destination (the workspace area between all panels)
 *
 * # Usage
 *
 *   let tmpShell = modal.shell('#App-Container', { PersistenceKey: 'my-app' });
 *
 *   tmpShell.addPanel({
 *       Hash: 'topbar', Side: 'top', Mode: 'fixed', Size: 60,
 *       ContentDestinationId: 'App-TopBar'
 *   });
 *   tmpShell.addPanel({
 *       Hash: 'statusbar', Side: 'bottom', Mode: 'fixed', Size: 28,
 *       ContentDestinationId: 'App-StatusBar'
 *   });
 *   tmpShell.addPanel({
 *       Hash: 'sidebar', Side: 'left', Mode: 'resizable', Size: 280,
 *       MinSize: 180, MaxSize: 480, Title: 'Modules',
 *       ContentDestinationId: 'App-Sidebar'
 *   });
 *
 *   let tmpCenter = tmpShell.center({ ContentDestinationId: 'App-Workspace' });
 *
 *   // Render into the destinations the same way as any other Pict view.
 *   pict.ContentAssignment.assignContent('#App-Sidebar', tmpHTML);
 *
 * # Panel options
 *
 *   Hash:                 unique id within the shell (auto-generated if omitted).
 *                         Used as the localStorage key suffix and for getPanel().
 *   Side:                 'top' | 'right' | 'bottom' | 'left'.
 *   Mode:                 'fixed' (no chrome), 'collapsible' (collapse tab),
 *                         'resizable' (collapse tab + drag handle).
 *   Position:             'pinned' (default; takes layout space) or 'overlay'
 *                         (absolutely positioned over the center / siblings).
 *   Scope:                'shell' (default) | 'center'.
 *                         When 'shell', the panel mounts in one of the
 *                         outer rows / side stacks (Side decides which).
 *                         When 'center', the panel mounts INSIDE the
 *                         center column instead — useful for bars that
 *                         should align with the content area only, not
 *                         span across the sidebars.  Only Side='top' and
 *                         Side='bottom' are supported with Scope='center'.
 *                         The center auto-switches to a flex-column
 *                         layout so the content destination + inner
 *                         panels stack vertically.
 *   Size:                 initial px (height for top/bottom, width for left/right).
 *                         Default: 200 for sides, 60 for top/bottom.
 *   MinSize, MaxSize:     drag clamp for resizable panels.
 *   Collapsed:            initial state. Persisted state overrides this.
 *   CollapsedSize:        px the panel becomes when collapsed (default 24).
 *   Title:                shown in the collapse tab.
 *   Icon:                 optional inline SVG / HTML for the collapse tab.
 *   ContentDestinationId: id given to the inner content div so the host can
 *                         reach it via #ContentDestinationId selectors.
 *   ContentView:          ViewIdentifier (string) of a registered Pict view
 *                         that owns this panel's content. When set, the
 *                         shell auto-renders the view once at panel creation
 *                         (so the destination is filled before the user
 *                         opens the panel) AND again on every expand
 *                         transition (so freshly-streamed state shows up).
 *                         Centralises the "I created a panel — now I have
 *                         to remember to render the view into it" boilerplate.
 *   Persist:              default true; pass false to skip save/load for this
 *                         panel even when the shell has persistence enabled.
 *   Hidden:               default false. When true, the collapsed state has
 *                         NO visible chrome — no collapse tab, no edge
 *                         affordance, the panel root is display: none. The
 *                         only way to reveal it is a programmatic
 *                         expand()/toggle() from elsewhere (e.g. a topbar
 *                         gear). Mode still controls the EXPANDED chrome —
 *                         pass Mode: 'resizable' to keep the drag handle
 *                         while open, then vanish on collapse.
 *   OnExpand, OnCollapse: callbacks that fire ONLY on transitions
 *                         (collapsed→expanded or expanded→collapsed).
 *                         Cleaner than OnToggle which fires for both
 *                         directions and forces callers to inspect the
 *                         bool. OnToggle is kept for back-compat.
 *
 * # Persistence
 *
 *   Storage key:  'pict-modal-shell:' + <PersistenceKey or hostname or 'default'>
 *   Value shape:  { Version: 1, Panels: { <hash>: { Collapsed: bool, Size: number } } }
 */const STORAGE_PREFIX='pict-modal-shell:';const SCHEMA_VERSION=1;const DEFAULT_COLLAPSED_SIZE=24;const DEFAULT_SIZE_SIDE=240;const DEFAULT_SIZE_TOPBOTTOM=60;class PictModalShell{constructor(pModalSection,pViewportEl,pOptions){this._modal=pModalSection;this._viewport=pViewportEl;this._options=pOptions||{};this._panels=[];this._panelsByHash={};this._centerDestinationEl=null;this._idCounter=0;this._activeDrag=null;this._persistenceEnabled=this._options.Persistence!==false;this._persistenceKey=this._persistenceEnabled?this._resolvePersistenceKey(this._options.PersistenceKey):null;// Build the wrapper DOM inside the viewport.
this._buildSkeleton();}// ────────────────────────────────────────────────────────────────
//  Public API
// ────────────────────────────────────────────────────────────────
addPanel(pConfig){let tmpPanel=new ShellPanel(this,pConfig||{});this._panels.push(tmpPanel);this._panelsByHash[tmpPanel.Hash]=tmpPanel;this._mountPanel(tmpPanel);// Render the bound ContentView once now so the destination has
// content even before the user opens the panel. This is the
// "create" half of the unified create-and-popup pattern — hosts
// no longer need to chase down each panel and call view.render()
// manually after addPanel().
tmpPanel._renderContentView();return tmpPanel;}getPanel(pHash){return this._panelsByHash[pHash]||null;}getPanels(){return this._panels.slice();}/**
	 * Convenience for cross-view popup triggers. Equivalent to
	 * `shell.getPanel(hash).popup()`. Silently no-ops when the hash
	 * doesn't match a registered panel (so callers don't have to
	 * null-check during boot races).
	 */openPanel(pHash){let tmpPanel=this._panelsByHash[pHash];if(tmpPanel){tmpPanel.popup();}return tmpPanel||null;}/**
	 * Configure the center area. Optional; if never called, the center
	 * still exists but has no host-supplied destination id (host can
	 * still reach it via .pict-modal-shell-center).
	 */center(pOptions){pOptions=pOptions||{};if(pOptions.ContentDestinationId){// Remove any previously-created destination so center() is
// idempotent across reconfigurations.  We don't blow away
// the whole center via innerHTML='' anymore: Scope:'center'
// panels mounted by earlier addPanel() calls need to stay
// in place.  Find the right insertion point so the
// destination sits between any top-scoped panels and any
// bottom-scoped panels.
if(this._centerDestinationEl&&this._centerDestinationEl.parentNode===this._centerEl){this._centerEl.removeChild(this._centerDestinationEl);}let tmpInner=document.createElement('div');tmpInner.id=pOptions.ContentDestinationId;tmpInner.className='pict-modal-shell-center-content';let tmpFirstBottomScoped=null;let tmpChildren=this._centerEl.children;for(let i=0;i<tmpChildren.length;i++){let tmpCandidate=tmpChildren[i];if(tmpCandidate.classList&&tmpCandidate.classList.contains('pict-modal-shell-panel-bottom')){tmpFirstBottomScoped=tmpCandidate;break;}}if(tmpFirstBottomScoped){this._centerEl.insertBefore(tmpInner,tmpFirstBottomScoped);}else{this._centerEl.appendChild(tmpInner);}this._centerDestinationEl=tmpInner;}return this._centerEl;}getCenterEl(){return this._centerEl;}destroy(){for(let i=0;i<this._panels.length;i++){this._panels[i].destroy(true);}this._panels=[];this._panelsByHash={};if(this._wrapperEl&&this._wrapperEl.parentNode){this._wrapperEl.parentNode.removeChild(this._wrapperEl);}this._detachDragHandlers();}// ────────────────────────────────────────────────────────────────
//  Persistence
// ────────────────────────────────────────────────────────────────
_resolvePersistenceKey(pUserKey){if(typeof pUserKey==='string'&&pUserKey.length>0)return STORAGE_PREFIX+pUserKey;try{if(typeof window!=='undefined'&&window.location&&window.location.hostname){return STORAGE_PREFIX+window.location.hostname;}}catch(pErr){/* fall through */}return STORAGE_PREFIX+'default';}_loadState(){if(!this._persistenceKey)return null;try{let tmpStore=typeof window!=='undefined'?window.localStorage:null;if(!tmpStore)return null;let tmpRaw=tmpStore.getItem(this._persistenceKey);if(!tmpRaw)return null;let tmpParsed=JSON.parse(tmpRaw);if(!tmpParsed||tmpParsed.Version!==SCHEMA_VERSION)return null;return tmpParsed.Panels&&typeof tmpParsed.Panels==='object'?tmpParsed.Panels:{};}catch(pErr){return null;}}_loadPanelState(pHash){let tmpAll=this._loadState();if(!tmpAll)return null;return tmpAll[pHash]||null;}_savePanelState(pHash,pState){if(!this._persistenceKey)return;try{let tmpStore=typeof window!=='undefined'?window.localStorage:null;if(!tmpStore)return;let tmpAll=this._loadState()||{};tmpAll[pHash]=pState;tmpStore.setItem(this._persistenceKey,JSON.stringify({Version:SCHEMA_VERSION,Panels:tmpAll,SavedAt:new Date().toISOString()}));}catch(pErr){/* swallow */}}// ────────────────────────────────────────────────────────────────
//  DOM scaffolding
// ────────────────────────────────────────────────────────────────
_buildSkeleton(){// Wipe whatever was inside the viewport — the host opted into
// the shell taking ownership of layout.
this._viewport.innerHTML='';this._viewport.classList.add('pict-modal-shell-host');this._wrapperEl=document.createElement('div');this._wrapperEl.className='pict-modal-shell';this._topRow=document.createElement('div');this._topRow.className='pict-modal-shell-row pict-modal-shell-row-top';this._wrapperEl.appendChild(this._topRow);this._middleRow=document.createElement('div');this._middleRow.className='pict-modal-shell-row pict-modal-shell-row-middle';this._wrapperEl.appendChild(this._middleRow);this._leftStack=document.createElement('div');this._leftStack.className='pict-modal-shell-side pict-modal-shell-side-left';this._middleRow.appendChild(this._leftStack);this._centerEl=document.createElement('div');this._centerEl.className='pict-modal-shell-center';this._middleRow.appendChild(this._centerEl);this._rightStack=document.createElement('div');this._rightStack.className='pict-modal-shell-side pict-modal-shell-side-right';this._middleRow.appendChild(this._rightStack);this._bottomRow=document.createElement('div');this._bottomRow.className='pict-modal-shell-row pict-modal-shell-row-bottom';this._wrapperEl.appendChild(this._bottomRow);// Overlay layer for overlay-position panels (absolute over middle row)
this._overlayLayer=document.createElement('div');this._overlayLayer.className='pict-modal-shell-overlay-layer';this._middleRow.appendChild(this._overlayLayer);this._viewport.appendChild(this._wrapperEl);}_mountPanel(pPanel){if(pPanel.Position==='overlay'){this._overlayLayer.appendChild(pPanel.El);return;}if(pPanel.Scope==='center'){// Center-scoped panels mount inside the center column.
// The column switches to flex-column so the content
// destination + the panel(s) stack vertically.
this._centerEl.classList.add('pict-modal-shell-center-with-inner-panel');if(pPanel.Side==='top'){// Top-scoped panels go above the content destination.
// If center() hasn't run yet, this still works — we
// insert before whatever's first (or just append to an
// empty center, which leaves us above any subsequent
// content destination).
this._centerEl.insertBefore(pPanel.El,this._centerEl.firstChild);}else{// Side === 'bottom' (the Scope guard already filtered
// left/right).  Append to the bottom of the center.
this._centerEl.appendChild(pPanel.El);}return;}let tmpHost;if(pPanel.Side==='top')tmpHost=this._topRow;else if(pPanel.Side==='bottom')tmpHost=this._bottomRow;else if(pPanel.Side==='left')tmpHost=this._leftStack;else if(pPanel.Side==='right')tmpHost=this._rightStack;else tmpHost=this._wrapperEl;tmpHost.appendChild(pPanel.El);}// ────────────────────────────────────────────────────────────────
//  Drag (resize) machinery — shared across all resizable panels.
// ────────────────────────────────────────────────────────────────
_attachDragStart(pPanel,pEvent){pEvent.preventDefault();let tmpAxis=pPanel.Side==='top'||pPanel.Side==='bottom'?'y':'x';this._activeDrag={Panel:pPanel,Axis:tmpAxis,StartCoord:tmpAxis==='x'?pEvent.clientX:pEvent.clientY,StartSize:pPanel.Size,Direction:pPanel.Side==='left'||pPanel.Side==='top'?1:-1,PendingSize:null,RAFId:0};document.body.classList.add(tmpAxis==='x'?'pict-modal-shell-dragging-x':'pict-modal-shell-dragging-y');// Suppress the panel's collapse/expand width/height transition for
// the duration of the drag — without this, every pointermove kicks
// off a fresh 140ms transition that stacks up and renders the
// resize as visibly laggy ("choppy"). With the transition off the
// panel snaps to each new size in the same frame as the pointer.
pPanel.El.classList.add('pict-modal-shell-panel-resizing');// Capture the pointer so dragging works even when the cursor leaves
// the resize handle (otherwise the user has to keep the cursor
// exactly on the 6 px strip — feels twitchy).
try{pEvent.target.setPointerCapture&&pEvent.target.setPointerCapture(pEvent.pointerId);}catch(pErr){/* not supported in old browsers — fine */}document.addEventListener('pointermove',this._onDragMove);document.addEventListener('pointerup',this._onDragEnd);}// Pointer events fire at the device's input rate (often 240 Hz+ on
// modern trackpads / mice) but we only paint at the display's refresh
// rate (60–120 Hz). Coalesce multiple pointermoves per frame into a
// single setSize() call via requestAnimationFrame — this drops the
// per-frame work to one DOM mutation regardless of pointer rate.
_onDragMove=pEvent=>{if(!this._activeDrag)return;let tmpD=this._activeDrag;let tmpCoord=tmpD.Axis==='x'?pEvent.clientX:pEvent.clientY;let tmpDelta=(tmpCoord-tmpD.StartCoord)*tmpD.Direction;tmpD.PendingSize=tmpD.StartSize+tmpDelta;if(!tmpD.RAFId){let tmpSelf=this;tmpD.RAFId=typeof window!=='undefined'&&window.requestAnimationFrame?window.requestAnimationFrame(function(){tmpSelf._flushDrag();}):setTimeout(function(){tmpSelf._flushDrag();},16);}};_flushDrag(){let tmpD=this._activeDrag;if(!tmpD)return;tmpD.RAFId=0;if(tmpD.PendingSize!==null){tmpD.Panel.setSize(tmpD.PendingSize);tmpD.PendingSize=null;}}_onDragEnd=()=>{if(!this._activeDrag)return;let tmpD=this._activeDrag;// Flush any pending pointermove that hadn't painted yet so the
// final size matches the actual cursor position, not the last
// rAF-aligned value.
if(tmpD.PendingSize!==null){this._flushDrag();}if(tmpD.RAFId&&typeof window!=='undefined'&&window.cancelAnimationFrame){window.cancelAnimationFrame(tmpD.RAFId);}document.body.classList.remove('pict-modal-shell-dragging-x');document.body.classList.remove('pict-modal-shell-dragging-y');tmpD.Panel.El.classList.remove('pict-modal-shell-panel-resizing');document.removeEventListener('pointermove',this._onDragMove);document.removeEventListener('pointerup',this._onDragEnd);// Persist final size.
tmpD.Panel._persist();this._activeDrag=null;};_detachDragHandlers(){document.removeEventListener('pointermove',this._onDragMove);document.removeEventListener('pointerup',this._onDragEnd);}}// ════════════════════════════════════════════════════════════════════
//  ShellPanel — one panel within a Shell
// ════════════════════════════════════════════════════════════════════
class ShellPanel{constructor(pShell,pConfig){this._shell=pShell;this._config=pConfig;this.Hash=pConfig.Hash||'panel-'+ ++pShell._idCounter;this.Side=pConfig.Side==='right'||pConfig.Side==='bottom'||pConfig.Side==='left'?pConfig.Side:'top';this.Mode=pConfig.Mode==='collapsible'||pConfig.Mode==='resizable'?pConfig.Mode:'fixed';this.Position=pConfig.Position==='overlay'?'overlay':'pinned';// Scope: 'center' opts the panel into the center column instead
// of the shell's outer rows.  Only valid for Side='top'/'bottom'
// (left/right inside center would need a separate axis we don't
// support).  Invalid combinations silently fall back to 'shell'.
this.Scope=pConfig.Scope==='center'&&(this.Side==='top'||this.Side==='bottom')?'center':'shell';this.Title=pConfig.Title||'';this.Icon=pConfig.Icon||'';this.MinSize=typeof pConfig.MinSize==='number'?pConfig.MinSize:40;this.MaxSize=typeof pConfig.MaxSize==='number'?pConfig.MaxSize:1200;// `Hidden: true` is a panel that has NO visible chrome in its collapsed
// state — no collapse tab sliver, no resize handle, no edge marker, and
// (via CSS) display: none on the panel root. The only way to reveal it
// is a programmatic expand()/toggle() called from elsewhere in the app
// (e.g. a gear button in the topbar). Useful when the host wants a
// fully-shaped panel but doesn't want an always-visible affordance for
// discovering it. The Mode is still honoured for the EXPANDED state —
// pass Mode: 'resizable' to keep the drag handle while the panel is
// open, while still vanishing entirely when collapsed.
this.Hidden=!!pConfig.Hidden;this.CollapsedSize=typeof pConfig.CollapsedSize==='number'?pConfig.CollapsedSize:this.Hidden?0:DEFAULT_COLLAPSED_SIZE;this.PersistEnabled=pShell._persistenceEnabled&&pConfig.Persist!==false;let tmpDefaultSize=this.Side==='left'||this.Side==='right'?DEFAULT_SIZE_SIDE:DEFAULT_SIZE_TOPBOTTOM;this.Size=typeof pConfig.Size==='number'?pConfig.Size:tmpDefaultSize;this.Collapsed=!!pConfig.Collapsed;// Persisted state overrides initial Size/Collapsed.
if(this.PersistEnabled){let tmpSaved=pShell._loadPanelState(this.Hash);if(tmpSaved){if(typeof tmpSaved.Size==='number')this.Size=tmpSaved.Size;if(typeof tmpSaved.Collapsed==='boolean')this.Collapsed=tmpSaved.Collapsed;}}this._clampSize();// Build the panel DOM.
this._buildEl(pConfig);this._applySize();this._applyCollapsedClass();// Responsive drawer — at narrow viewports, flip a docked side
// panel into a "top drawer" by adding a class to the middle row
// that toggles flex-direction from row to column. The panel
// stretches to full width and trades its inline `width` for a
// configurable drawer `height`. The user's collapse/expand
// keeps working: collapsed in drawer mode just gives the panel
// height: 0 (so only the collapse tab remains visible at the
// top of the content), expanded restores the drawer height.
// Pass `0` or omit to disable. Mirrors retold-remote's
// `.content-editor-body { flex-direction: column }` pattern.
this.ResponsiveDrawer=typeof pConfig.ResponsiveDrawer==='number'&&pConfig.ResponsiveDrawer>0?pConfig.ResponsiveDrawer:0;// Drawer height — applied as `height` to the panel in drawer
// mode. CSS units (px / vh / %) accepted. Default 33vh which
// gives the panel roughly a third of the viewport height and
// leaves comfortable room for the workspace below.
this.DrawerHeight=typeof pConfig.DrawerHeight==='string'&&pConfig.DrawerHeight?pConfig.DrawerHeight:'33vh';this._mediaQuery=null;this._mediaQueryHandler=null;if(this.ResponsiveDrawer>0){this._wireResponsiveDrawer();}}// ───────────── public ─────────────
getContentEl(){return this._contentEl;}/**
	 * Returns the currently-bound ContentView Pict view instance, or
	 * null if no ContentView is configured / the view isn't registered
	 * yet.
	 */getContentView(){if(!this._config.ContentView)return null;let tmpPict=this._shell._modal&&this._shell._modal.pict;if(!tmpPict||!tmpPict.views)return null;return tmpPict.views[this._config.ContentView]||null;}collapse(){this._setCollapsed(true);}expand(){this._setCollapsed(false);}toggle(){this._setCollapsed(!this.Collapsed);}/**
	 * Unified "show this panel" affordance — this is the shared
	 * codepath every popup trigger should funnel through. Behavior:
	 *
	 *   - If collapsed → expand (which fires OnExpand + re-renders the
	 *     ContentView via the shared transition machinery).
	 *   - If already open → re-render the ContentView (so any newly-
	 *     streamed state is visible) AND briefly flash the panel
	 *     border so the user notices that the existing panel just
	 *     received attention. Avoids the "I clicked a button but
	 *     nothing happened" feeling when the panel was already open.
	 *
	 * Idempotent — safe to call from any number of triggers without
	 * stacking effects.
	 */popup(){if(this.Collapsed){this._setCollapsed(false);}else{// Already open — refresh content + flash for attention.
this._renderContentView();this._flash();}}setSize(pSize){if(typeof pSize!=='number'||!isFinite(pSize))return;this.Size=pSize;this._clampSize();this._applySize();}destroy(pSkipFromShell){this._unwireResponsiveDrawer();if(this.El&&this.El.parentNode)this.El.parentNode.removeChild(this.El);if(!pSkipFromShell){let tmpIdx=this._shell._panels.indexOf(this);if(tmpIdx>=0)this._shell._panels.splice(tmpIdx,1);delete this._shell._panelsByHash[this.Hash];}}// ───────────── internals ─────────────
_clampSize(){if(this.Size<this.MinSize)this.Size=this.MinSize;if(this.Size>this.MaxSize)this.Size=this.MaxSize;}// Responsive drawer — sets up a matchMedia listener for
// `(max-width: <ResponsiveDrawer>px)`. Each crossing flips the
// shell's middle row between row layout (wide) and column layout
// (narrow) by toggling the `pict-modal-shell-drawer-active` class
// on the middle row. The matching CSS makes side panels expand to
// full width with a fixed `DrawerHeight`, becoming top/bottom
// drawers above/below the workspace center. Collapsed in drawer
// mode collapses to height: 0, leaving only the collapse tab.
//
// This pattern is the conventional "responsive sidebar" approach
// (used by retold-remote's content editor) — the user keeps their
// sidebar accessible at narrow widths but it gives the workspace
// room to breathe.
_wireResponsiveDrawer(){if(typeof window==='undefined'||!window.matchMedia)return;this._mediaQuery=window.matchMedia('(max-width: '+this.ResponsiveDrawer+'px)');// Apply the drawer height as a CSS variable on the panel
// element so the static CSS rules can read it. Doing this once
// here avoids per-event JS style writes.
if(this.El){this.El.style.setProperty('--pict-modal-drawer-height',this.DrawerHeight);}let tmpSelf=this;this._mediaQueryHandler=function(pEvent){let tmpNarrow=pEvent&&typeof pEvent.matches==='boolean'?pEvent.matches:tmpSelf._mediaQuery.matches;tmpSelf._setDrawerMode(tmpNarrow);};// Apply the current state immediately (handles the case where the
// page loads already-narrow). Newer browsers use addEventListener;
// older ones use addListener.
if(this._mediaQuery.addEventListener){this._mediaQuery.addEventListener('change',this._mediaQueryHandler);}else if(this._mediaQuery.addListener){this._mediaQuery.addListener(this._mediaQueryHandler);}this._mediaQueryHandler({matches:this._mediaQuery.matches});// Belt + suspenders: also listen to window resize and re-sync.
// `matchMedia.change` is supposed to be reliable on every
// boundary crossing, but in real-world testing (esp. when the
// user is dragging DevTools to resize the inner viewport, or
// going through fast successive crossings) we've seen the
// change event silently miss. A plain resize listener is
// cheap and the handler is idempotent — if matches state
// hasn't actually changed the body of `_setDrawerMode` is a
// no-op (it short-circuits when classes are already correct).
this._resizeHandler=function(){tmpSelf._setDrawerMode(tmpSelf._mediaQuery.matches);};window.addEventListener('resize',this._resizeHandler);}_unwireResponsiveDrawer(){if(this._resizeHandler&&typeof window!=='undefined'){window.removeEventListener('resize',this._resizeHandler);this._resizeHandler=null;}if(!this._mediaQuery||!this._mediaQueryHandler)return;if(this._mediaQuery.removeEventListener){this._mediaQuery.removeEventListener('change',this._mediaQueryHandler);}else if(this._mediaQuery.removeListener){this._mediaQuery.removeListener(this._mediaQueryHandler);}this._mediaQuery=null;this._mediaQueryHandler=null;}// Toggle drawer mode by adding / removing a class on the shell's
// middle row. The CSS rule for `.pict-modal-shell-drawer-active`
// flips flex-direction column, makes side panels full-width, and
// applies the panel's `--pict-modal-drawer-height` for sizing.
// Also tags the panel itself so per-panel CSS can target it.
// Re-applies the inline size at the end so the wide-mode crossing
// gets a clean width back (drawer mode forced width: 100% via CSS
// !important; the inline style was stale).
_setDrawerMode(pDrawer){if(!this._shell||!this._shell._middleRow)return;// Idempotent — short-circuit when the panel's drawer state
// already matches the target. Keeps the resize-event fallback
// (which fires constantly during drag-resize) from doing
// pointless DOM thrash + style re-application every frame.
let tmpCurrentlyDrawer=!!(this.El&&this.El.classList.contains('pict-modal-shell-panel-drawer'));if(tmpCurrentlyDrawer===!!pDrawer)return;if(pDrawer){this._shell._middleRow.classList.add('pict-modal-shell-drawer-active');if(this.El){this.El.classList.add('pict-modal-shell-panel-drawer');}}else{// Only remove the row-level class if NO other panel still
// wants drawer mode. Multi-panel hosts can safely each opt
// in independently this way.
let tmpStillNarrow=false;let tmpPanels=this._shell._panels||[];for(let i=0;i<tmpPanels.length;i++){let tmpP=tmpPanels[i];if(tmpP!==this&&tmpP._mediaQuery&&tmpP._mediaQuery.matches&&tmpP.ResponsiveDrawer>0){tmpStillNarrow=true;break;}}if(!tmpStillNarrow){this._shell._middleRow.classList.remove('pict-modal-shell-drawer-active');}if(this.El){this.El.classList.remove('pict-modal-shell-panel-drawer');}}// Re-apply inline size. In drawer mode the CSS !important
// rule overrides this anyway, but on the wide crossing we
// need the inline width to be correct so the panel shows up
// at its proper docked / collapsed-docked size rather than
// inheriting any stale state.
this._applySize();}_buildEl(pConfig){let tmpRoot=document.createElement('div');tmpRoot.className='pict-modal-shell-panel pict-modal-shell-panel-'+this.Side+' pict-modal-shell-panel-mode-'+this.Mode+(this.Position==='overlay'?' pict-modal-shell-panel-overlay':'')+(this.Hidden?' pict-modal-shell-panel-hidden':'');tmpRoot.setAttribute('data-shell-panel-hash',this.Hash);tmpRoot.setAttribute('data-shell-panel-side',this.Side);tmpRoot.setAttribute('data-shell-panel-mode',this.Mode);// Content area — hosts render their stuff into the inner #id div.
let tmpContentWrap=document.createElement('div');tmpContentWrap.className='pict-modal-shell-panel-content';this._contentEl=document.createElement('div');if(pConfig.ContentDestinationId){this._contentEl.id=pConfig.ContentDestinationId;}this._contentEl.className='pict-modal-shell-panel-content-inner';tmpContentWrap.appendChild(this._contentEl);tmpRoot.appendChild(tmpContentWrap);// Collapse tab — shown when collapsible / resizable. Lives at the
// inner edge so it's always reachable when the panel is collapsed.
// Hidden panels skip the tab entirely — the only path back from
// collapsed → expanded is a programmatic expand() / toggle() call
// from the host (e.g. a topbar gear button).
if((this.Mode==='collapsible'||this.Mode==='resizable')&&!this.Hidden){this._collapseTab=document.createElement('button');this._collapseTab.type='button';this._collapseTab.className='pict-modal-shell-panel-collapse-tab';this._collapseTab.setAttribute('aria-label',this.Title?'Toggle '+this.Title:'Toggle panel');this._collapseTab.title=this.Title||'Toggle';this._collapseTab.innerHTML=''+(this.Icon?'<span class="pict-modal-shell-panel-collapse-tab-icon">'+this.Icon+'</span>':'')+(this.Title?'<span class="pict-modal-shell-panel-collapse-tab-title">'+this._escape(this.Title)+'</span>':'');let tmpSelf=this;this._collapseTab.addEventListener('click',function(){tmpSelf.toggle();});tmpRoot.appendChild(this._collapseTab);}// Resize handle — only when resizable. Positioned via CSS based
// on side.
if(this.Mode==='resizable'){this._resizeHandle=document.createElement('div');this._resizeHandle.className='pict-modal-shell-panel-resize-handle';this._resizeHandle.setAttribute('aria-hidden','true');let tmpSelf=this;this._resizeHandle.addEventListener('pointerdown',function(pEvent){if(tmpSelf.Collapsed)return;tmpSelf._shell._attachDragStart(tmpSelf,pEvent);});tmpRoot.appendChild(this._resizeHandle);}this.El=tmpRoot;}_applySize(){let tmpEffective=this.Collapsed?this.CollapsedSize:this.Size;if(this.Side==='left'||this.Side==='right'){this.El.style.width=tmpEffective+'px';this.El.style.height='';}else{this.El.style.height=tmpEffective+'px';this.El.style.width='';}}_applyCollapsedClass(){if(this.Collapsed)this.El.classList.add('pict-modal-shell-panel-collapsed');else this.El.classList.remove('pict-modal-shell-panel-collapsed');}_setCollapsed(pBool){if(this.Collapsed===!!pBool)return;let tmpWasCollapsed=this.Collapsed;this.Collapsed=!!pBool;this._applyCollapsedClass();this._applySize();this._persist();// Transition-specific hooks fire BEFORE OnToggle so OnExpand
// callers can mutate state (e.g. set focus, re-fetch data) and
// have it reflected by any OnToggle observer that runs after.
if(tmpWasCollapsed&&!this.Collapsed){// collapsed → expanded. Render the bound ContentView so
// freshly-streamed state shows up the moment the panel
// becomes visible (replaces the manual view.render() dance
// hosts used to do in their own runAction-style helpers).
this._renderContentView();this._fireHook('OnExpand');}else if(!tmpWasCollapsed&&this.Collapsed){this._fireHook('OnCollapse');}// Back-compat: OnToggle still fires for both directions.
this._fireHook('OnToggle',this.Collapsed);}_fireHook(pName,pArg){let tmpFn=this._config[pName];if(typeof tmpFn!=='function')return;try{if(typeof pArg!=='undefined'){tmpFn(pArg,this);}else{tmpFn(this);}}catch(pErr){/* host hook failure must not break the panel */}}/**
	 * Render the bound ContentView (if any) into this panel's
	 * destination. Called by the shell on panel creation + on every
	 * collapsed→expanded transition + by popup() when re-flashing an
	 * already-open panel. Silently no-ops when no ContentView is
	 * configured or the view isn't registered yet (boot races).
	 */_renderContentView(){let tmpView=this.getContentView();if(tmpView&&typeof tmpView.render==='function'){try{tmpView.render();}catch(pErr){/* view render failure shouldn't break the panel chrome */}}}/**
	 * Briefly highlight the panel — used by popup() when called on an
	 * already-open panel so the user sees that their click landed.
	 * The class is removed after the CSS animation completes; safe to
	 * re-trigger (timeouts overlap, last one wins on the trailing edge).
	 */_flash(){if(!this.El)return;this.El.classList.add('pict-modal-shell-panel-flash');let tmpSelf=this;clearTimeout(this._flashTimer);this._flashTimer=setTimeout(function(){if(tmpSelf.El)tmpSelf.El.classList.remove('pict-modal-shell-panel-flash');},700);}_persist(){if(!this.PersistEnabled)return;this._shell._savePanelState(this.Hash,{Collapsed:this.Collapsed,Size:this.Size});}_escape(pStr){return String(pStr||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}}// ════════════════════════════════════════════════════════════════════
//  Module exports — used internally by Pict-Section-Modal.shell()
// ════════════════════════════════════════════════════════════════════
class PictModalShellManager{constructor(pModalSection){this._modal=pModalSection;this._shellsByViewport=new WeakMap();}/**
	 * Idempotent — calling shell() twice with the same viewport returns
	 * the same instance.
	 */shell(pViewportSelectorOrEl,pOptions){let tmpEl=typeof pViewportSelectorOrEl==='string'?document.querySelector(pViewportSelectorOrEl):pViewportSelectorOrEl;if(!tmpEl){throw new Error('Pict-Modal-Shell.shell: viewport not found for '+pViewportSelectorOrEl);}let tmpExisting=this._shellsByViewport.get(tmpEl);if(tmpExisting)return tmpExisting;let tmpShell=new PictModalShell(this._modal,tmpEl,pOptions);this._shellsByViewport.set(tmpEl,tmpShell);return tmpShell;}}module.exports=PictModalShellManager;module.exports.PictModalShell=PictModalShell;module.exports.ShellPanel=ShellPanel;module.exports.STORAGE_PREFIX=STORAGE_PREFIX;module.exports.SCHEMA_VERSION=SCHEMA_VERSION;},{}],12:[function(require,module,exports){/**
 * Pict-Modal-Toast
 *
 * Manages toast notification elements with auto-dismiss and stacking.
 */class PictModalToast{constructor(pModal){this._modal=pModal;this._containers={};}/**
	 * Show a toast notification.
	 *
	 * @param {string} pMessage - Toast message text
	 * @param {object} [pOptions] - Options (type, duration, position, dismissible)
	 * @returns {{ dismiss: function }} Handle with dismiss method
	 */toast(pMessage,pOptions){let tmpOptions=Object.assign({},this._modal.options.DefaultToastOptions,pOptions);let tmpContainer=this._getContainer(tmpOptions.position);let tmpId=this._modal._nextId();let tmpToast=document.createElement('div');tmpToast.className='pict-modal-toast pict-modal-toast--'+tmpOptions.type;tmpToast.id='pict-modal-toast-'+tmpId;let tmpContent='<span class="pict-modal-toast-message">'+this._escapeHTML(pMessage)+'</span>';if(tmpOptions.dismissible){tmpContent+='<button class="pict-modal-toast-dismiss" aria-label="Dismiss">&times;</button>';}tmpToast.innerHTML=tmpContent;// Create handle
let tmpDismissed=false;let tmpTimeoutHandle=null;let tmpDismiss=()=>{if(tmpDismissed){return;}tmpDismissed=true;if(tmpTimeoutHandle){clearTimeout(tmpTimeoutHandle);}// Exit animation
tmpToast.classList.remove('pict-modal-visible');tmpToast.classList.add('pict-modal-toast-exit');// Remove from active list
this._modal._activeToasts=this._modal._activeToasts.filter(pEntry=>{return pEntry.element!==tmpToast;});// Remove from DOM after transition
setTimeout(()=>{if(tmpToast.parentNode){tmpToast.parentNode.removeChild(tmpToast);}this._cleanupContainer(tmpOptions.position);},220);};let tmpHandle={dismiss:tmpDismiss};// Wire dismiss button
if(tmpOptions.dismissible){let tmpDismissBtn=tmpToast.querySelector('.pict-modal-toast-dismiss');if(tmpDismissBtn){tmpDismissBtn.addEventListener('click',tmpDismiss);}}// Append to container
tmpContainer.appendChild(tmpToast);// Track
let tmpEntry={element:tmpToast,dismiss:tmpDismiss,handle:tmpHandle};this._modal._activeToasts.push(tmpEntry);// Animate in
void tmpToast.offsetHeight;tmpToast.classList.add('pict-modal-visible');// Auto-dismiss
if(tmpOptions.duration>0){tmpTimeoutHandle=setTimeout(tmpDismiss,tmpOptions.duration);}return tmpHandle;}/**
	 * Get or create a toast container for the given position.
	 *
	 * @param {string} pPosition - Position key (e.g. 'top-right')
	 * @returns {HTMLElement}
	 */_getContainer(pPosition){if(this._containers[pPosition]){return this._containers[pPosition];}let tmpContainer=document.createElement('div');tmpContainer.className='pict-modal-toast-container pict-modal-toast-container--'+pPosition;document.body.appendChild(tmpContainer);this._containers[pPosition]=tmpContainer;return tmpContainer;}/**
	 * Remove a container if it has no more toasts.
	 *
	 * @param {string} pPosition
	 */_cleanupContainer(pPosition){let tmpContainer=this._containers[pPosition];if(tmpContainer&&tmpContainer.children.length===0){if(tmpContainer.parentNode){tmpContainer.parentNode.removeChild(tmpContainer);}delete this._containers[pPosition];}}/**
	 * Dismiss all active toasts.
	 */dismissAll(){let tmpToasts=this._modal._activeToasts.slice();for(let i=0;i<tmpToasts.length;i++){tmpToasts[i].dismiss();}}/**
	 * Destroy all containers.
	 */destroy(){this.dismissAll();let tmpPositions=Object.keys(this._containers);for(let i=0;i<tmpPositions.length;i++){let tmpContainer=this._containers[tmpPositions[i]];if(tmpContainer&&tmpContainer.parentNode){tmpContainer.parentNode.removeChild(tmpContainer);}}this._containers={};}/**
	 * Escape HTML special characters.
	 *
	 * @param {string} pText
	 * @returns {string}
	 */_escapeHTML(pText){if(typeof pText!=='string'){return'';}return pText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}}module.exports=PictModalToast;},{}],13:[function(require,module,exports){/**
 * Pict-Modal-Tooltip
 *
 * Manages simple text and rich HTML tooltips with positioning and auto-flip.
 */class PictModalTooltip{constructor(pModal){this._modal=pModal;}/**
	 * Attach a simple text tooltip to an element.
	 *
	 * @param {HTMLElement} pElement - Target element
	 * @param {string} pText - Tooltip text
	 * @param {object} [pOptions] - Options (position, delay, maxWidth)
	 * @returns {{ destroy: function }} Handle to remove the tooltip
	 */tooltip(pElement,pText,pOptions){let tmpOptions=Object.assign({},this._modal.options.DefaultTooltipOptions,pOptions);return this._attachTooltip(pElement,pText,false,tmpOptions);}/**
	 * Attach a rich HTML tooltip to an element.
	 *
	 * @param {HTMLElement} pElement - Target element
	 * @param {string} pHTMLContent - HTML content for the tooltip
	 * @param {object} [pOptions] - Options (position, delay, maxWidth, interactive)
	 * @returns {{ destroy: function }} Handle to remove the tooltip
	 */richTooltip(pElement,pHTMLContent,pOptions){let tmpOptions=Object.assign({},this._modal.options.DefaultTooltipOptions,pOptions);return this._attachTooltip(pElement,pHTMLContent,true,tmpOptions);}/**
	 * Internal: attach tooltip event listeners to an element.
	 *
	 * @param {HTMLElement} pElement
	 * @param {string} pContent
	 * @param {boolean} pIsHTML
	 * @param {object} pOptions
	 * @returns {{ destroy: function }}
	 */_attachTooltip(pElement,pContent,pIsHTML,pOptions){let tmpTooltipElement=null;let tmpShowTimeout=null;let tmpHideTimeout=null;let tmpDestroyed=false;let tmpId=this._modal._nextId();let tmpShow=()=>{if(tmpDestroyed||tmpTooltipElement){return;}tmpTooltipElement=document.createElement('div');tmpTooltipElement.className='pict-modal-tooltip pict-modal-tooltip--'+pOptions.position;tmpTooltipElement.id='pict-modal-tooltip-'+tmpId;tmpTooltipElement.setAttribute('role','tooltip');tmpTooltipElement.style.maxWidth=pOptions.maxWidth;if(pOptions.interactive){tmpTooltipElement.classList.add('pict-modal-tooltip-interactive');}// Arrow
let tmpArrow=document.createElement('div');tmpArrow.className='pict-modal-tooltip-arrow';// Content
let tmpContentDiv=document.createElement('div');if(pIsHTML){tmpContentDiv.innerHTML=pContent;}else{tmpContentDiv.textContent=pContent;}tmpTooltipElement.appendChild(tmpArrow);tmpTooltipElement.appendChild(tmpContentDiv);document.body.appendChild(tmpTooltipElement);// Set aria-describedby on target
pElement.setAttribute('aria-describedby',tmpTooltipElement.id);// Position
this._positionTooltip(tmpTooltipElement,pElement,pOptions.position);// Animate in
void tmpTooltipElement.offsetHeight;tmpTooltipElement.classList.add('pict-modal-visible');// Track
this._modal._activeTooltips.push({element:tmpTooltipElement,targetElement:pElement,destroy:tmpDestroy});// For interactive tooltips, allow hovering over the tooltip itself
if(pOptions.interactive&&tmpTooltipElement){tmpTooltipElement.addEventListener('mouseenter',()=>{if(tmpHideTimeout){clearTimeout(tmpHideTimeout);tmpHideTimeout=null;}});tmpTooltipElement.addEventListener('mouseleave',()=>{tmpHide();});}};let tmpHide=()=>{if(!tmpTooltipElement){return;}tmpTooltipElement.classList.remove('pict-modal-visible');let tmpEl=tmpTooltipElement;tmpTooltipElement=null;// Remove aria
pElement.removeAttribute('aria-describedby');// Remove from tracking
this._modal._activeTooltips=this._modal._activeTooltips.filter(pEntry=>{return pEntry.element!==tmpEl;});setTimeout(()=>{if(tmpEl.parentNode){tmpEl.parentNode.removeChild(tmpEl);}},220);};let tmpOnMouseEnter=()=>{if(tmpHideTimeout){clearTimeout(tmpHideTimeout);tmpHideTimeout=null;}tmpShowTimeout=setTimeout(tmpShow,pOptions.delay);};let tmpOnMouseLeave=()=>{if(tmpShowTimeout){clearTimeout(tmpShowTimeout);tmpShowTimeout=null;}// Small delay before hiding to allow moving to interactive tooltip
if(pOptions.interactive){tmpHideTimeout=setTimeout(tmpHide,100);}else{tmpHide();}};let tmpOnFocusIn=()=>{tmpShowTimeout=setTimeout(tmpShow,pOptions.delay);};let tmpOnFocusOut=()=>{if(tmpShowTimeout){clearTimeout(tmpShowTimeout);tmpShowTimeout=null;}tmpHide();};// Attach listeners
pElement.addEventListener('mouseenter',tmpOnMouseEnter);pElement.addEventListener('mouseleave',tmpOnMouseLeave);pElement.addEventListener('focusin',tmpOnFocusIn);pElement.addEventListener('focusout',tmpOnFocusOut);let tmpDestroy=()=>{if(tmpDestroyed){return;}tmpDestroyed=true;if(tmpShowTimeout){clearTimeout(tmpShowTimeout);}if(tmpHideTimeout){clearTimeout(tmpHideTimeout);}tmpHide();pElement.removeEventListener('mouseenter',tmpOnMouseEnter);pElement.removeEventListener('mouseleave',tmpOnMouseLeave);pElement.removeEventListener('focusin',tmpOnFocusIn);pElement.removeEventListener('focusout',tmpOnFocusOut);};return{destroy:tmpDestroy};}/**
	 * Position a tooltip element relative to the target element.
	 * Flips direction if the tooltip would overflow the viewport.
	 *
	 * @param {HTMLElement} pTooltip
	 * @param {HTMLElement} pTarget
	 * @param {string} pPosition - 'top', 'bottom', 'left', 'right'
	 */_positionTooltip(pTooltip,pTarget,pPosition){let tmpTargetRect=pTarget.getBoundingClientRect();let tmpTooltipRect=pTooltip.getBoundingClientRect();let tmpGap=8;let tmpPosition=pPosition;// Flip if needed
if(tmpPosition==='top'&&tmpTargetRect.top<tmpTooltipRect.height+tmpGap){tmpPosition='bottom';}else if(tmpPosition==='bottom'&&window.innerHeight-tmpTargetRect.bottom<tmpTooltipRect.height+tmpGap){tmpPosition='top';}else if(tmpPosition==='left'&&tmpTargetRect.left<tmpTooltipRect.width+tmpGap){tmpPosition='right';}else if(tmpPosition==='right'&&window.innerWidth-tmpTargetRect.right<tmpTooltipRect.width+tmpGap){tmpPosition='left';}// Update class for arrow direction
pTooltip.className=pTooltip.className.replace(/pict-modal-tooltip--\w+/,'pict-modal-tooltip--'+tmpPosition);let tmpTop=0;let tmpLeft=0;switch(tmpPosition){case'top':tmpTop=tmpTargetRect.top-tmpTooltipRect.height-tmpGap;tmpLeft=tmpTargetRect.left+tmpTargetRect.width/2-tmpTooltipRect.width/2;break;case'bottom':tmpTop=tmpTargetRect.bottom+tmpGap;tmpLeft=tmpTargetRect.left+tmpTargetRect.width/2-tmpTooltipRect.width/2;break;case'left':tmpTop=tmpTargetRect.top+tmpTargetRect.height/2-tmpTooltipRect.height/2;tmpLeft=tmpTargetRect.left-tmpTooltipRect.width-tmpGap;break;case'right':tmpTop=tmpTargetRect.top+tmpTargetRect.height/2-tmpTooltipRect.height/2;tmpLeft=tmpTargetRect.right+tmpGap;break;}// Clamp to viewport
tmpLeft=Math.max(4,Math.min(tmpLeft,window.innerWidth-tmpTooltipRect.width-4));tmpTop=Math.max(4,Math.min(tmpTop,window.innerHeight-tmpTooltipRect.height-4));pTooltip.style.top=tmpTop+'px';pTooltip.style.left=tmpLeft+'px';}/**
	 * Dismiss all active tooltips.
	 */dismissAll(){let tmpTooltips=this._modal._activeTooltips.slice();for(let i=0;i<tmpTooltips.length;i++){tmpTooltips[i].destroy();}}}module.exports=PictModalTooltip;},{}],14:[function(require,module,exports){/**
 * Pict-Modal-Window
 *
 * Builds custom floating modal windows with arbitrary content and buttons.
 */class PictModalWindow{constructor(pModal){this._modal=pModal;}/**
	 * Show a custom modal window.
	 *
	 * @param {object} [pOptions] - Options
	 * @param {string} [pOptions.title] - Dialog title
	 * @param {string} [pOptions.content] - HTML content for the body
	 * @param {Array} [pOptions.buttons] - Array of { Hash, Label, Style }
	 * @param {boolean} [pOptions.closeable] - Whether the close button and overlay dismiss are enabled
	 * @param {string} [pOptions.width] - CSS width value
	 * @param {boolean} [pOptions.unbounded] - If true, removes the default 90vh/90vw viewport cap. The dialog will grow with its content and may extend beyond the viewport.
	 * @param {function} [pOptions.onOpen] - Called after dialog is shown, receives dialog element
	 * @param {function} [pOptions.onClose] - Called after dialog is dismissed
	 * @returns {Promise<string|null>} Resolves with clicked button Hash, or null on close
	 */show(pOptions){let tmpOptions=Object.assign({},this._modal.options.DefaultModalOptions,pOptions);return new Promise(fResolve=>{let tmpDialog=this._buildDialog(tmpOptions,fResolve);this._showDialog(tmpDialog,tmpOptions,fResolve);});}/**
	 * Build the modal dialog element.
	 *
	 * @param {object} pOptions
	 * @param {function} fResolve
	 * @returns {HTMLElement}
	 */_buildDialog(pOptions,fResolve){let tmpId=this._modal._nextId();let tmpDialog=document.createElement('div');tmpDialog.className='pict-modal-dialog';if(pOptions.unbounded){tmpDialog.className+=' pict-modal-dialog--unbounded';}tmpDialog.id='pict-modal-'+tmpId;tmpDialog.setAttribute('role','dialog');tmpDialog.setAttribute('aria-modal','true');tmpDialog.style.width=pOptions.width;// Header
let tmpHeaderHTML='';if(pOptions.title||pOptions.closeable){tmpHeaderHTML='<div class="pict-modal-dialog-header">';tmpHeaderHTML+='<span class="pict-modal-dialog-title">'+this._escapeHTML(pOptions.title)+'</span>';if(pOptions.closeable){tmpHeaderHTML+='<button class="pict-modal-dialog-close" aria-label="Close">&times;</button>';}tmpHeaderHTML+='</div>';}// Body
let tmpBodyHTML='<div class="pict-modal-dialog-body">'+(pOptions.content||'')+'</div>';// Footer with buttons
let tmpFooterHTML='';if(pOptions.buttons&&pOptions.buttons.length>0){tmpFooterHTML='<div class="pict-modal-dialog-footer">';for(let i=0;i<pOptions.buttons.length;i++){let tmpButton=pOptions.buttons[i];let tmpBtnClass='pict-modal-btn';if(tmpButton.Style){tmpBtnClass+=' pict-modal-btn--'+tmpButton.Style;}tmpFooterHTML+='<button class="'+tmpBtnClass+'" data-hash="'+this._escapeHTML(tmpButton.Hash)+'">'+this._escapeHTML(tmpButton.Label)+'</button>';}tmpFooterHTML+='</div>';}tmpDialog.innerHTML=tmpHeaderHTML+tmpBodyHTML+tmpFooterHTML;let tmpDismiss=pResult=>{this._dismissDialog(tmpDialog,pResult,fResolve,pOptions);};// Wire close button
if(pOptions.closeable){let tmpCloseBtn=tmpDialog.querySelector('.pict-modal-dialog-close');if(tmpCloseBtn){tmpCloseBtn.addEventListener('click',()=>{tmpDismiss(null);});}}// Wire action buttons
let tmpActionButtons=tmpDialog.querySelectorAll('[data-hash]');for(let i=0;i<tmpActionButtons.length;i++){let tmpBtn=tmpActionButtons[i];tmpBtn.addEventListener('click',()=>{tmpDismiss(tmpBtn.getAttribute('data-hash'));});}tmpDialog._dismiss=tmpDismiss;return tmpDialog;}/**
	 * Show the dialog: append to body, show overlay, animate in.
	 *
	 * @param {HTMLElement} pDialog
	 * @param {object} pOptions
	 * @param {function} fResolve
	 */_showDialog(pDialog,pOptions,fResolve){let tmpModalEntry={element:pDialog,dismiss:pDialog._dismiss,type:'window'};// Show overlay
let tmpOverlayClickHandler=null;if(this._modal.options.OverlayClickDismisses&&pOptions.closeable){tmpOverlayClickHandler=()=>{pDialog._dismiss(null);};}this._modal._overlay.show(tmpOverlayClickHandler);// Append to body
document.body.appendChild(pDialog);// Track
this._modal._activeModals.push(tmpModalEntry);// Animate in
void pDialog.offsetHeight;pDialog.classList.add('pict-modal-visible');// Focus first button or close button
let tmpFocusTarget=pDialog.querySelector('.pict-modal-btn')||pDialog.querySelector('.pict-modal-dialog-close');if(tmpFocusTarget){tmpFocusTarget.focus();}// Keyboard handler
pDialog._keyHandler=pEvent=>{if(pEvent.key==='Escape'&&pOptions.closeable){pDialog._dismiss(null);}};document.addEventListener('keydown',pDialog._keyHandler);// onOpen callback
if(typeof pOptions.onOpen==='function'){pOptions.onOpen(pDialog);}}/**
	 * Dismiss the dialog: animate out, remove from DOM, hide overlay.
	 *
	 * @param {HTMLElement} pDialog
	 * @param {*} pResult
	 * @param {function} fResolve
	 * @param {object} pOptions
	 */_dismissDialog(pDialog,pResult,fResolve,pOptions){if(pDialog._dismissed){return;}pDialog._dismissed=true;if(pDialog._keyHandler){document.removeEventListener('keydown',pDialog._keyHandler);}pDialog.classList.remove('pict-modal-visible');this._modal._activeModals=this._modal._activeModals.filter(pEntry=>{return pEntry.element!==pDialog;});if(this._modal._activeModals.length>0){let tmpTopModal=this._modal._activeModals[this._modal._activeModals.length-1];this._modal._overlay.updateClickHandler(this._modal.options.OverlayClickDismisses?tmpTopModal.dismiss:null);}this._modal._overlay.hide();setTimeout(()=>{if(pDialog.parentNode){pDialog.parentNode.removeChild(pDialog);}},220);if(typeof pOptions.onClose==='function'){pOptions.onClose(pResult);}fResolve(pResult);}/**
	 * Escape HTML special characters.
	 *
	 * @param {string} pText
	 * @returns {string}
	 */_escapeHTML(pText){if(typeof pText!=='string'){return'';}return pText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}}module.exports=PictModalWindow;},{}],15:[function(require,module,exports){module.exports={"AutoInitialize":true,"AutoRender":false,"AutoSolveWithApp":false,"ViewIdentifier":"Pict-Section-Modal","OverlayClickDismisses":true,"DefaultConfirmOptions":{"title":"Confirm","confirmLabel":"OK","cancelLabel":"Cancel","dangerous":false,"unbounded":false},"DefaultDoubleConfirmOptions":{"title":"Are you sure?","confirmLabel":"Confirm","cancelLabel":"Cancel","phrasePrompt":"Type \"{phrase}\" to confirm:","confirmPhrase":"","unbounded":false},"DefaultModalOptions":{"title":"","content":"","buttons":[],"closeable":true,"width":"480px","unbounded":false},"DefaultTooltipOptions":{"position":"top","delay":200,"maxWidth":"300px","interactive":false},"DefaultToastOptions":{"type":"info","duration":3000,"position":"top-right","dismissible":true},"DefaultPanelOptions":{"position":"right","width":340,"minWidth":200,"maxWidth":600,"collapsible":true,"collapsed":false,"persist":false,"persistKey":""},"Templates":[],"Renderables":[],"CSS":/*css*/`
/* pict-section-modal */
.pict-modal-root
{
	/* Defaults are routed through pict-provider-theme tokens so apps
	   using the theme provider get themed modals automatically.  Each
	   var() carries its original hex as the fallback so apps that don't
	   install pict-provider-theme look exactly as before.  Apps may
	   still override any --pict-modal-* var directly to layer over the
	   theme-driven defaults. */

	/* Overlay */
	--pict-modal-overlay-bg: rgba(0, 0, 0, 0.5);

	/* Dialog */
	--pict-modal-bg:                  var(--theme-color-background-panel,  #ffffff);
	--pict-modal-fg:                  var(--theme-color-text-primary,      #1a1a1a);
	--pict-modal-border:              var(--theme-color-border-default,    #e0e0e0);
	--pict-modal-border-radius:       8px;
	--pict-modal-shadow:              0 4px 24px rgba(0, 0, 0, 0.15);
	--pict-modal-header-bg:           var(--theme-color-background-secondary, #f5f5f5);
	--pict-modal-header-fg:           var(--theme-color-text-primary,      #1a1a1a);
	--pict-modal-header-border:       var(--theme-color-border-default,    #e0e0e0);

	/* Buttons */
	--pict-modal-btn-bg:              var(--theme-color-background-secondary, #e0e0e0);
	--pict-modal-btn-fg:              var(--theme-color-text-primary,      #1a1a1a);
	--pict-modal-btn-hover-bg:        var(--theme-color-background-hover,  #d0d0d0);
	--pict-modal-btn-primary-bg:      var(--theme-color-brand-primary,     #2563eb);
	--pict-modal-btn-primary-fg:      var(--theme-color-text-on-brand,     #ffffff);
	--pict-modal-btn-primary-hover-bg:var(--theme-color-brand-primary-hover,#1d4ed8);
	--pict-modal-btn-danger-bg:       var(--theme-color-status-error,      #dc2626);
	--pict-modal-btn-danger-fg:       var(--theme-color-text-on-brand,     #ffffff);
	--pict-modal-btn-danger-hover-bg: var(--theme-color-status-error,      #b91c1c);
	--pict-modal-btn-border-radius:   4px;

	/* Toast */
	--pict-modal-toast-bg:            var(--theme-color-background-panel,  #333333);
	--pict-modal-toast-fg:            var(--theme-color-text-primary,      #ffffff);
	--pict-modal-toast-success-bg:    var(--theme-color-status-success,    #16a34a);
	--pict-modal-toast-warning-bg:    var(--theme-color-status-warning,    #d97706);
	--pict-modal-toast-error-bg:      var(--theme-color-status-error,      #dc2626);
	--pict-modal-toast-info-bg:       var(--theme-color-status-info,       #2563eb);
	--pict-modal-toast-border-radius: 6px;
	--pict-modal-toast-shadow:        0 2px 12px rgba(0, 0, 0, 0.15);

	/* Tooltip */
	--pict-modal-tooltip-bg:          var(--theme-color-background-tertiary,#1a1a1a);
	--pict-modal-tooltip-fg:          var(--theme-color-text-primary,      #ffffff);
	--pict-modal-tooltip-border-radius:4px;
	--pict-modal-tooltip-shadow:      0 2px 8px rgba(0, 0, 0, 0.15);

	/* Dropdown */
	--pict-modal-dropdown-bg:                 var(--theme-color-background-panel,  #ffffff);
	--pict-modal-dropdown-fg:                 var(--theme-color-text-primary,      #1a1a1a);
	--pict-modal-dropdown-border:             var(--theme-color-border-default,    #e0e0e0);
	--pict-modal-dropdown-border-radius:      6px;
	--pict-modal-dropdown-shadow:             0 6px 18px rgba(0, 0, 0, 0.18);
	--pict-modal-dropdown-item-hover-bg:      var(--theme-color-background-hover,  rgba(37, 99, 235, 0.10));
	--pict-modal-dropdown-item-hover-fg:      var(--theme-color-text-primary,      #1a1a1a);
	--pict-modal-dropdown-item-disabled-fg:   var(--theme-color-text-muted,        #9aa0a6);
	--pict-modal-dropdown-separator:          var(--theme-color-border-light,      #e8e8e8);
	--pict-modal-dropdown-header-fg:          var(--theme-color-text-secondary,    #6b7280);
	--pict-modal-dropdown-danger-fg:          var(--theme-color-status-error,      #dc2626);
	--pict-modal-dropdown-primary-fg:         var(--theme-color-brand-primary,     #2563eb);

	/* Typography */
	--pict-modal-font-family:         var(--theme-typography-family-sans,  system-ui, -apple-system, sans-serif);
	--pict-modal-font-size:           14px;
	--pict-modal-title-font-size:     16px;

	/* Animation */
	--pict-modal-transition-duration: 200ms;
}

/* Overlay */
.pict-modal-overlay
{
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 1000;
	background: var(--pict-modal-overlay-bg);
	opacity: 0;
	transition: opacity var(--pict-modal-transition-duration) ease;
}

.pict-modal-overlay.pict-modal-visible
{
	opacity: 1;
}

/* Dialog */
.pict-modal-dialog
{
	position: fixed;
	z-index: 1010;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%) translateY(-20px);
	opacity: 0;
	transition: opacity var(--pict-modal-transition-duration) ease,
	            transform var(--pict-modal-transition-duration) ease;

	max-width: 90vw;
	max-height: 90vh;
	display: flex;
	flex-direction: column;

	background: var(--pict-modal-bg);
	color: var(--pict-modal-fg);
	border: 1px solid var(--pict-modal-border);
	border-radius: var(--pict-modal-border-radius);
	box-shadow: var(--pict-modal-shadow);
	font-family: var(--pict-modal-font-family);
	font-size: var(--pict-modal-font-size);
}

.pict-modal-dialog.pict-modal-visible
{
	opacity: 1;
	transform: translate(-50%, -50%) translateY(0);
}

/* Unbounded modifier — lets callers opt out of the 90vh/90vw viewport cap.
   Use with caution: content taller than the viewport will push buttons
   below the fold. */
.pict-modal-dialog.pict-modal-dialog--unbounded
{
	max-height: none;
	max-width: none;
}

.pict-modal-dialog-header
{
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 16px;
	background: var(--pict-modal-header-bg);
	color: var(--pict-modal-header-fg);
	border-bottom: 1px solid var(--pict-modal-header-border);
	border-radius: var(--pict-modal-border-radius) var(--pict-modal-border-radius) 0 0;
}

.pict-modal-dialog-title
{
	font-size: var(--pict-modal-title-font-size);
	font-weight: 600;
}

.pict-modal-dialog-close
{
	background: none;
	border: none;
	font-size: 20px;
	cursor: pointer;
	color: var(--pict-modal-fg);
	padding: 0 4px;
	line-height: 1;
	opacity: 0.6;
}

.pict-modal-dialog-close:hover
{
	opacity: 1;
}

.pict-modal-dialog-body
{
	padding: 16px;
	overflow-y: auto;
	flex: 1;
}

.pict-modal-dialog-footer
{
	display: flex;
	justify-content: flex-end;
	gap: 8px;
	padding: 12px 16px;
	border-top: 1px solid var(--pict-modal-border);
}

/* Buttons */
.pict-modal-btn
{
	padding: 8px 16px;
	border: none;
	border-radius: var(--pict-modal-btn-border-radius);
	font-family: var(--pict-modal-font-family);
	font-size: var(--pict-modal-font-size);
	cursor: pointer;
	background: var(--pict-modal-btn-bg);
	color: var(--pict-modal-btn-fg);
	transition: background var(--pict-modal-transition-duration) ease;
}

.pict-modal-btn:hover
{
	background: var(--pict-modal-btn-hover-bg);
}

.pict-modal-btn:disabled
{
	opacity: 0.5;
	cursor: not-allowed;
}

.pict-modal-btn--primary
{
	background: var(--pict-modal-btn-primary-bg);
	color: var(--pict-modal-btn-primary-fg);
}

.pict-modal-btn--primary:hover
{
	background: var(--pict-modal-btn-primary-hover-bg);
}

.pict-modal-btn--danger
{
	background: var(--pict-modal-btn-danger-bg);
	color: var(--pict-modal-btn-danger-fg);
}

.pict-modal-btn--danger:hover
{
	background: var(--pict-modal-btn-danger-hover-bg);
}

/* Double confirm input */
.pict-modal-confirm-input
{
	width: 100%;
	padding: 8px 12px;
	margin-top: 12px;
	border: 1px solid var(--pict-modal-border);
	border-radius: var(--pict-modal-btn-border-radius);
	font-family: var(--pict-modal-font-family);
	font-size: var(--pict-modal-font-size);
	box-sizing: border-box;
}

.pict-modal-confirm-input:focus
{
	outline: 2px solid var(--pict-modal-btn-primary-bg);
	outline-offset: -1px;
}

.pict-modal-confirm-prompt
{
	margin-top: 12px;
	font-size: 13px;
	color: var(--pict-modal-fg);
	opacity: 0.7;
}

/* Toast container */
.pict-modal-toast-container
{
	position: fixed;
	z-index: 1030;
	display: flex;
	flex-direction: column;
	gap: 8px;
	pointer-events: none;
	max-width: 400px;
}

.pict-modal-toast-container--top-right
{
	top: 16px;
	right: 16px;
}

.pict-modal-toast-container--top-left
{
	top: 16px;
	left: 16px;
}

.pict-modal-toast-container--bottom-right
{
	bottom: 16px;
	right: 16px;
}

.pict-modal-toast-container--bottom-left
{
	bottom: 16px;
	left: 16px;
}

.pict-modal-toast-container--top-center
{
	top: 16px;
	left: 50%;
	transform: translateX(-50%);
}

.pict-modal-toast-container--bottom-center
{
	bottom: 16px;
	left: 50%;
	transform: translateX(-50%);
}

/* Toast */
.pict-modal-toast
{
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 12px 16px;
	border-radius: var(--pict-modal-toast-border-radius);
	box-shadow: var(--pict-modal-toast-shadow);
	font-family: var(--pict-modal-font-family);
	font-size: var(--pict-modal-font-size);
	background: var(--pict-modal-toast-bg);
	color: var(--pict-modal-toast-fg);
	pointer-events: auto;
	opacity: 0;
	transform: translateX(100%);
	transition: opacity var(--pict-modal-transition-duration) ease,
	            transform var(--pict-modal-transition-duration) ease;
}

.pict-modal-toast.pict-modal-visible
{
	opacity: 1;
	transform: translateX(0);
}

.pict-modal-toast.pict-modal-toast-exit
{
	opacity: 0;
	transform: translateX(100%);
}

.pict-modal-toast--info
{
	background: var(--pict-modal-toast-info-bg);
}

.pict-modal-toast--success
{
	background: var(--pict-modal-toast-success-bg);
}

.pict-modal-toast--warning
{
	background: var(--pict-modal-toast-warning-bg);
}

.pict-modal-toast--error
{
	background: var(--pict-modal-toast-error-bg);
}

.pict-modal-toast-message
{
	flex: 1;
}

.pict-modal-toast-dismiss
{
	background: none;
	border: none;
	color: inherit;
	font-size: 18px;
	cursor: pointer;
	padding: 0 2px;
	line-height: 1;
	opacity: 0.7;
}

.pict-modal-toast-dismiss:hover
{
	opacity: 1;
}

/* Tooltip */
.pict-modal-tooltip
{
	position: fixed;
	z-index: 1020;
	padding: 6px 10px;
	border-radius: var(--pict-modal-tooltip-border-radius);
	box-shadow: var(--pict-modal-tooltip-shadow);
	background: var(--pict-modal-tooltip-bg);
	color: var(--pict-modal-tooltip-fg);
	font-family: var(--pict-modal-font-family);
	font-size: 13px;
	pointer-events: none;
	opacity: 0;
	transition: opacity var(--pict-modal-transition-duration) ease;
	white-space: normal;
	word-wrap: break-word;
}

.pict-modal-tooltip.pict-modal-tooltip-interactive
{
	pointer-events: auto;
}

.pict-modal-tooltip.pict-modal-visible
{
	opacity: 1;
}

.pict-modal-tooltip-arrow
{
	position: absolute;
	width: 8px;
	height: 8px;
	background: var(--pict-modal-tooltip-bg);
	transform: rotate(45deg);
}

.pict-modal-tooltip--top .pict-modal-tooltip-arrow
{
	bottom: -4px;
	left: 50%;
	margin-left: -4px;
}

.pict-modal-tooltip--bottom .pict-modal-tooltip-arrow
{
	top: -4px;
	left: 50%;
	margin-left: -4px;
}

.pict-modal-tooltip--left .pict-modal-tooltip-arrow
{
	right: -4px;
	top: 50%;
	margin-top: -4px;
}

.pict-modal-tooltip--right .pict-modal-tooltip-arrow
{
	left: -4px;
	top: 50%;
	margin-top: -4px;
}

/* ── Dropdown ─────────────────────────────────────────────────────────
   Anchor-positioned menu (no overlay). Used for nav menus and
   "split button" addenda — see Pict-Modal-Dropdown.js.
*/
.pict-modal-dropdown
{
	position: fixed;
	z-index: 1025;
	min-width: 160px;
	max-width: 360px;
	max-height: 60vh;
	overflow-y: auto;
	background: var(--pict-modal-dropdown-bg);
	color: var(--pict-modal-dropdown-fg);
	border: 1px solid var(--pict-modal-dropdown-border);
	border-radius: var(--pict-modal-dropdown-border-radius);
	box-shadow: var(--pict-modal-dropdown-shadow);
	font-family: var(--pict-modal-font-family);
	font-size: var(--pict-modal-font-size);
	padding: 4px 0;
	opacity: 0;
	transform: translateY(-4px);
	transition: opacity var(--pict-modal-transition-duration) ease,
	            transform var(--pict-modal-transition-duration) ease;
}

.pict-modal-dropdown.pict-modal-dropdown--above { transform: translateY(4px); }

.pict-modal-dropdown.pict-modal-visible
{
	opacity: 1;
	transform: translateY(0);
}

.pict-modal-dropdown-item
{
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 7px 14px;
	cursor: pointer;
	user-select: none;
	color: inherit;
	outline: none;
}

.pict-modal-dropdown-item:hover,
.pict-modal-dropdown-item:focus
{
	background: var(--pict-modal-dropdown-item-hover-bg);
	color: var(--pict-modal-dropdown-item-hover-fg);
}

.pict-modal-dropdown-item--disabled
{
	cursor: not-allowed;
	color: var(--pict-modal-dropdown-item-disabled-fg);
}

.pict-modal-dropdown-item--disabled:hover,
.pict-modal-dropdown-item--disabled:focus
{
	background: transparent;
	color: var(--pict-modal-dropdown-item-disabled-fg);
}

.pict-modal-dropdown-item--primary { color: var(--pict-modal-dropdown-primary-fg); }
.pict-modal-dropdown-item--danger  { color: var(--pict-modal-dropdown-danger-fg); }

.pict-modal-dropdown-item-icon
{
	flex: 0 0 auto;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 16px;
	height: 16px;
}

.pict-modal-dropdown-item-icon svg { width: 100%; height: 100%; display: block; }

.pict-modal-dropdown-item-label { flex: 1 1 auto; min-width: 0; }

.pict-modal-dropdown-item-hint
{
	flex: 0 0 auto;
	font-size: 11px;
	opacity: 0.6;
	margin-left: 12px;
}

.pict-modal-dropdown-separator
{
	height: 1px;
	background: var(--pict-modal-dropdown-separator);
	margin: 4px 0;
}

.pict-modal-dropdown-header
{
	padding: 6px 14px 2px;
	font-size: 11px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--pict-modal-dropdown-header-fg);
}

/* ── Resizable / Collapsible Panels ──────────────── */
.pict-panel
{
	position: relative;
	transition: width 0.2s ease;
	flex-shrink: 0;
	overflow: visible;
}
.pict-panel-collapsed
{
	width: 0 !important;
	min-width: 0 !important;
	overflow: visible;
}
.pict-panel-collapsed > *:not(.pict-panel-edge)
{
	display: none;
}

/* Edge container — zero-width flex sibling of the panel.
   Sits next to the panel in the flex layout; children
   use absolute positioning to overlap the panel boundary. */
.pict-panel-edge
{
	position: relative;
	width: 0;
	flex-shrink: 0;
	z-index: 50;
	overflow: visible;
}

/* Resize handle — thin strip on the panel boundary */
.pict-panel-resize
{
	position: absolute;
	top: 0;
	bottom: 0;
	width: 4px;
	cursor: col-resize;
	background: transparent;
	transition: background 0.15s, width 0.15s;
}
.pict-panel-edge-right .pict-panel-resize
{
	right: 0;
	border-right: 1px solid var(--pict-panel-border, #DDD6CA);
}
.pict-panel-edge-left .pict-panel-resize
{
	left: 0;
	border-left: 1px solid var(--pict-panel-border, #DDD6CA);
}
.pict-panel-resize:hover,
.pict-panel-edge:hover .pict-panel-resize
{
	width: 5px;
	background: var(--pict-panel-accent, #2E7D74);
	opacity: 0.5;
}
.pict-panel-resize.dragging
{
	width: 5px;
	background: var(--pict-panel-accent, #2E7D74);
	opacity: 1;
	transition: none;
}
.pict-panel-edge-collapsed .pict-panel-resize
{
	display: none;
}

/* Collapse tab — tucked sliver at rest, slides out on hover */
.pict-panel-tab
{
	position: absolute;
	top: 8px;
	width: 8px;
	height: 24px;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	background: var(--pict-panel-border, #DDD6CA);
	border: 1px solid var(--pict-panel-border, #DDD6CA);
	cursor: pointer;
	color: var(--pict-panel-fg, #8A7F72);
	font-size: 10px;
	line-height: 1;
	opacity: 0.5;
	transition: opacity 0.25s, width 0.2s ease, height 0.2s ease, left 0.2s ease, right 0.2s ease, background 0.2s;
	z-index: 51;
}
.pict-panel-edge:hover .pict-panel-tab,
.pict-panel-tab:hover
{
	width: 20px;
	height: 32px;
	opacity: 1;
	overflow: visible;
	background: var(--pict-panel-bg, #FAF8F4);
}
/* Right panel: tab to the left of the edge */
.pict-panel-edge-right .pict-panel-tab
{
	right: 0;
	border-right: none;
	border-radius: 4px 0 0 4px;
}
.pict-panel-edge-right:hover .pict-panel-tab,
.pict-panel-edge-right .pict-panel-tab:hover
{
	right: 0;
}
/* Left panel: tab to the right of the edge */
.pict-panel-edge-left .pict-panel-tab
{
	left: 0;
	border-left: none;
	border-radius: 0 4px 4px 0;
}
.pict-panel-edge-left:hover .pict-panel-tab,
.pict-panel-edge-left .pict-panel-tab:hover
{
	left: 0;
}
/* When collapsed — more visible */
.pict-panel-edge-collapsed .pict-panel-tab
{
	width: 10px;
	height: 28px;
	opacity: 0.6;
}
.pict-panel-edge-collapsed .pict-panel-tab:hover,
.pict-panel-edge-collapsed:hover .pict-panel-tab
{
	width: 20px;
	height: 32px;
	opacity: 1;
	overflow: visible;
	background: var(--pict-panel-bg, #FAF8F4);
}

/* ───────────────────────────────────────────────────────────────────
 *  Pict-Modal-Shell — viewport-managing layout for top / right /
 *  bottom / left panels around a center.
 * ───────────────────────────────────────────────────────────────── */

.pict-modal-shell-host { display: block; height: 100%; min-height: 0; }
.pict-modal-shell
{
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	min-height: 0;
	position: relative;
	color: var(--pict-modal-fg, var(--theme-color-text-primary, #1a1a1a));
	background: var(--theme-color-background-primary, transparent);
}
.pict-modal-shell-row { display: flex; min-width: 0; min-height: 0; }
/* "First added = at the edge" convention is held by reversing the
   flex-direction on the bottom row + right side. That way, for ALL
   four sides, calling addPanel() N times stacks panel #1 against
   the viewport edge, panel #2 just inside it, panel #3 further in,
   and so on. Without these reverses, top + left worked that way but
   bottom + right inverted (first-added at content side, last-added
   at edge), which surprised callers. */
.pict-modal-shell-row-top    { flex: 0 0 auto; flex-direction: column; }
.pict-modal-shell-row-bottom { flex: 0 0 auto; flex-direction: column-reverse; }
.pict-modal-shell-row-middle
{
	flex: 1 1 0;
	flex-direction: row;
	min-height: 0;
	position: relative;
}
.pict-modal-shell-side
{
	display: flex;
	flex: 0 0 auto;
	min-height: 0;
}
.pict-modal-shell-side-left  { flex-direction: row; }
.pict-modal-shell-side-right { flex-direction: row-reverse; }
.pict-modal-shell-center
{
	flex: 1 1 0;
	min-width: 0;
	min-height: 0;
	overflow: auto;
	position: relative;
}
.pict-modal-shell-center-content
{
	min-height: 100%;
}
/* Center column gains this class when at least one Scope:'center'
   panel is added.  The center stops scrolling internally — that job
   moves to the content destination — and switches to a vertical flex
   so the destination and any inner panels stack cleanly. */
.pict-modal-shell-center.pict-modal-shell-center-with-inner-panel
{
	display: flex;
	flex-direction: column;
	overflow: hidden;
}
.pict-modal-shell-center.pict-modal-shell-center-with-inner-panel > .pict-modal-shell-center-content
{
	flex: 1 1 0;
	min-height: 0;
	overflow: auto;
}
.pict-modal-shell-center.pict-modal-shell-center-with-inner-panel > .pict-modal-shell-panel
{
	flex: 0 0 auto;
	width: 100%;
}

/* Panels — base */
.pict-modal-shell-panel
{
	/* How far the collapse-tab's panel-bg "merge bar" extends INTO
	   the panel past the tab's geometric edge. Painted via box-shadow
	   on the tab (no DOM impact), it masks any 1px theme border on an
	   inner element, content padding offset, or resize-handle hover
	   bleed in the strip between the tab's panel-facing edge and the
	   first real pixel of panel content. Consumers can bump this for
	   themes with thicker (2+px) inner borders. */
	--pict-modal-collapse-tab-merge: 2px;
	position: relative;
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
	background: var(--pict-modal-bg, var(--theme-color-background-panel, #ffffff));
	color: inherit;
	min-width: 0;
	min-height: 0;
	transition: width 140ms ease, height 140ms ease;
}
.pict-modal-shell-panel-content
{
	flex: 1 1 auto;
	min-width: 0;
	min-height: 0;
	overflow: auto;
}
/* Fixed-mode panels are pure chrome (topbars, status rows). Their
   content should fit the configured Size exactly — never scroll. The
   1px border that .pict-modal-shell-panel-mode-fixed adds on the
   inner edge shaves 1px off the content's available height, which
   then triggers a sliver-scrollbar on any inner widget with
   min-height matching the panel Size. overflow:hidden here suppresses
   that without affecting resizable/collapsible panels (sidebars,
   drawers) where scrollable content is the whole point. */
.pict-modal-shell-panel-mode-fixed > .pict-modal-shell-panel-content
{
	overflow: hidden;
}
.pict-modal-shell-panel-content-inner
{
	min-height: 100%;
}
/* Panel boundary — fixed-mode panels get a hairline border for explicit
   demarcation. Collapsible / resizable panels DROP the boundary border
   (background contrast separates them from the center anyway) so the
   collapse tab can pull out cleanly without a hairline cutting across
   it. The host stylesheet still gets full control via the panel's own
   background. */
.pict-modal-shell-panel-mode-fixed.pict-modal-shell-panel-top    { border-bottom: 1px solid var(--pict-modal-border, var(--theme-color-border-default, #e0e0e0)); }
.pict-modal-shell-panel-mode-fixed.pict-modal-shell-panel-bottom { border-top:    1px solid var(--pict-modal-border, var(--theme-color-border-default, #e0e0e0)); }
.pict-modal-shell-panel-mode-fixed.pict-modal-shell-panel-left   { border-right:  1px solid var(--pict-modal-border, var(--theme-color-border-default, #e0e0e0)); }
.pict-modal-shell-panel-mode-fixed.pict-modal-shell-panel-right  { border-left:   1px solid var(--pict-modal-border, var(--theme-color-border-default, #e0e0e0)); }

/* Resize handle — absolute on the inner edge of each panel. */
.pict-modal-shell-panel-resize-handle
{
	position: absolute;
	background: transparent;
	z-index: 5;
	transition: background-color 120ms ease;
}
/* Resize handle hover — use the active brand's mode-aware primary
   color (set by pict-section-theme's Brand provider as
   --brand-color-primary-mode) so the resize affordance picks up the
   app's wordmark color. Falls back to the theme's brand-primary
   token if no brand is registered. */
.pict-modal-shell-panel-resize-handle:hover
{
	background: var(--brand-color-primary-mode, var(--theme-color-brand-primary, #2563eb));
	opacity: 0.4;
}
.pict-modal-shell-panel-left   .pict-modal-shell-panel-resize-handle { right: -3px; top: 0; bottom: 0; width: 6px; cursor: col-resize; }
.pict-modal-shell-panel-right  .pict-modal-shell-panel-resize-handle { left:  -3px; top: 0; bottom: 0; width: 6px; cursor: col-resize; }
.pict-modal-shell-panel-top    .pict-modal-shell-panel-resize-handle { bottom:-3px; left: 0; right: 0; height: 6px; cursor: row-resize; }
.pict-modal-shell-panel-bottom .pict-modal-shell-panel-resize-handle { top:   -3px; left: 0; right: 0; height: 6px; cursor: row-resize; }

/* Collapse tab — slim sliver flush on the panel's OUTER boundary
   (where the resize handle sits), modelled on retold-content-system's
   sidebar tab. At rest it's a 6×28 px sliver; hover expands to
   18×36 px without overlapping the panel's own content. The tab is
   positioned with its center on the boundary so half pokes into the
   adjacent area — the only place we can safely take over without
   stepping on app UI inside the panel. Title text only renders in the
   collapsed state where there's room for it. */
.pict-modal-shell-panel-collapse-tab
{
	position: absolute;
	display: flex;            /* not inline-flex — avoids baseline alignment quirks */
	align-items: center;
	justify-content: center;
	overflow: hidden;
	border: 1px solid var(--pict-modal-border, var(--theme-color-border-default, #d0d7de));
	background: var(--pict-modal-bg, var(--theme-color-background-panel, #ffffff));
	color: var(--theme-color-text-muted, #6b7280);
	font: inherit;
	font-size: 10px;
	letter-spacing: 0.4px;
	text-transform: uppercase;
	cursor: pointer;
	z-index: 50;
	opacity: 0.55;
	padding: 0;
	box-sizing: border-box;
	line-height: 0;          /* keep child boxes from inflating around the rotated chevron */
	/* Geometry (width/height/right/left) is intentionally NOT animated.
	   Sliding the tab's outer edge inward on hover-out makes it look like
	   the tab is "sliding into" the panel content — weird visual.
	   Snapping the size change instead, and animating only the appearance
	   (opacity/color/shadow), gives a clean fade-in/out with no boundary
	   weirdness. */
	transition: opacity 160ms ease,
	            background-color 160ms ease, color 160ms ease,
	            border-color 160ms ease, box-shadow 160ms ease;
}
/* Hover state pulls accent color from the active brand (mode-aware,
   so it's legible in both light + dark) with theme brand-primary as
   fallback. The whole point of brand colors is that they show up
   across the app's chrome. */
.pict-modal-shell-panel-collapse-tab:hover,
.pict-modal-shell-panel:hover > .pict-modal-shell-panel-collapse-tab
{
	opacity: 1;
	color:        var(--brand-color-primary-mode, var(--theme-color-brand-primary, #2563eb));
	border-color: var(--brand-color-primary-mode, var(--theme-color-brand-primary, #2563eb));
}
/* Drop shadow casts AWAY from the panel so the tab feels pulled out
   (extension of the panel) rather than floating across the boundary.
   The tab itself is now positioned fully OUTSIDE the panel boundary
   (see the per-side rules below), so we don't need a merge-bar shadow
   to mask any in-panel overlap — only the drop shadow remains. */
.pict-modal-shell-panel-left:hover    > .pict-modal-shell-panel-collapse-tab,
.pict-modal-shell-panel-left    > .pict-modal-shell-panel-collapse-tab:hover
{
	box-shadow: 3px 0 6px -2px rgba(0, 0, 0, 0.18);
}
.pict-modal-shell-panel-right:hover   > .pict-modal-shell-panel-collapse-tab,
.pict-modal-shell-panel-right   > .pict-modal-shell-panel-collapse-tab:hover
{
	box-shadow: -3px 0 6px -2px rgba(0, 0, 0, 0.18);
}
.pict-modal-shell-panel-top:hover     > .pict-modal-shell-panel-collapse-tab,
.pict-modal-shell-panel-top     > .pict-modal-shell-panel-collapse-tab:hover
{
	box-shadow: 0 3px 6px -2px rgba(0, 0, 0, 0.18);
}
.pict-modal-shell-panel-bottom:hover  > .pict-modal-shell-panel-collapse-tab,
.pict-modal-shell-panel-bottom  > .pict-modal-shell-panel-collapse-tab:hover
{
	box-shadow: 0 -3px 6px -2px rgba(0, 0, 0, 0.18);
}

/* Per-side base positioning — the tab lives entirely OUTSIDE the
   panel's outer boundary.  Its panel-facing edge touches the boundary
   (offset = -tabThickness) and the rest of the tab pokes out into the
   adjacent area (center / sibling panel).  Border on the panel-facing
   edge is dropped so the tab looks attached to the panel rather than
   floating beside it.
   Why fully-outside?  Earlier iterations had the tab straddling the
   boundary (1px inside + 4px outside) with a panel-bg-colored merge-bar
   masking the in-panel half — that worked geometrically but visually
   read as "tab pinned into the panel," and any rendering inside the
   panel (especially custom borders or hover bleeds) could clip against
   the in-panel half.  Fully-external positioning eliminates the overlap
   class of bugs and lets the tab live entirely in the adjacent area
   where there's no app content to step on. */
.pict-modal-shell-panel-left  > .pict-modal-shell-panel-collapse-tab
{
	right: -6px; top: 14px; width: 6px; height: 28px;
	border-radius: 0 4px 4px 0;
	border-left: 0;
}
.pict-modal-shell-panel-right > .pict-modal-shell-panel-collapse-tab
{
	left:  -6px; top: 14px; width: 6px; height: 28px;
	border-radius: 4px 0 0 4px;
	border-right: 0;
}
.pict-modal-shell-panel-top    > .pict-modal-shell-panel-collapse-tab
{
	bottom: -6px; right: 14px; width: 28px; height: 6px;
	border-radius: 0 0 4px 4px;
	border-top: 0;
}
.pict-modal-shell-panel-bottom > .pict-modal-shell-panel-collapse-tab
{
	top:    -6px; right: 14px; width: 28px; height: 6px;
	border-radius: 4px 4px 0 0;
	border-bottom: 0;
}

/* Hover: tab grows OUTWARD into the adjacent area.  The panel-facing
   edge stays glued to the boundary (offset = -tabThickness), so the
   tab still looks attached on hover — only its outer dimension grows.
   For side panels the height also grows (28 → 36) downward; for top
   /bottom panels the width grows (28 → 36) — see the next block for
   the perpendicular-axis offsets. */
.pict-modal-shell-panel-left:hover  > .pict-modal-shell-panel-collapse-tab,
.pict-modal-shell-panel-left  > .pict-modal-shell-panel-collapse-tab:hover
{
	width: 18px; height: 36px; right: -18px;
}
.pict-modal-shell-panel-right:hover > .pict-modal-shell-panel-collapse-tab,
.pict-modal-shell-panel-right > .pict-modal-shell-panel-collapse-tab:hover
{
	width: 18px; height: 36px; left: -18px;
}
.pict-modal-shell-panel-top:hover    > .pict-modal-shell-panel-collapse-tab,
.pict-modal-shell-panel-top    > .pict-modal-shell-panel-collapse-tab:hover
{
	width: 36px; height: 18px; bottom: -18px;
}
.pict-modal-shell-panel-bottom:hover > .pict-modal-shell-panel-collapse-tab,
.pict-modal-shell-panel-bottom > .pict-modal-shell-panel-collapse-tab:hover
{
	width: 36px; height: 18px; top: -18px;
}

.pict-modal-shell-panel-collapse-tab-title { display: none; white-space: nowrap; }

/* Auto-generated chevron glyph inside the tab — only visible once the
   tab is wide / tall enough to show it (i.e. hover state, or when the
   panel is collapsed). Direction follows side + state.
   Sized 5×5 (down from 6) so even with rotation the visual stays
   well clear of the tab's overflow:hidden bounds at 18×36 hover and
   the 24px collapsed tab strip width. flex-shrink:0 ensures the
   pseudo never collapses to zero in tight tab dimensions. */
.pict-modal-shell-panel-collapse-tab::before
{
	content: '';
	display: block;
	width: 5px; height: 5px;
	flex-shrink: 0;
	opacity: 0;
	border-right: 1.5px solid currentColor;
	border-bottom: 1.5px solid currentColor;
	transform: rotate(135deg);
	transform-origin: center center;
	transition: opacity 160ms ease, transform 160ms ease;
}
.pict-modal-shell-panel:hover > .pict-modal-shell-panel-collapse-tab::before,
.pict-modal-shell-panel-collapse-tab:hover::before,
.pict-modal-shell-panel-collapsed > .pict-modal-shell-panel-collapse-tab::before
{
	opacity: 1;
}
.pict-modal-shell-panel-right                                       > .pict-modal-shell-panel-collapse-tab::before { transform: rotate(-45deg); }
.pict-modal-shell-panel-top                                         > .pict-modal-shell-panel-collapse-tab::before { transform: rotate(-135deg); }
.pict-modal-shell-panel-bottom                                      > .pict-modal-shell-panel-collapse-tab::before { transform: rotate(45deg); }
.pict-modal-shell-panel-left.pict-modal-shell-panel-collapsed       > .pict-modal-shell-panel-collapse-tab::before { transform: rotate(-45deg); }
.pict-modal-shell-panel-right.pict-modal-shell-panel-collapsed      > .pict-modal-shell-panel-collapse-tab::before { transform: rotate(135deg); }
.pict-modal-shell-panel-top.pict-modal-shell-panel-collapsed        > .pict-modal-shell-panel-collapse-tab::before { transform: rotate(45deg); }
.pict-modal-shell-panel-bottom.pict-modal-shell-panel-collapsed     > .pict-modal-shell-panel-collapse-tab::before { transform: rotate(-135deg); }

/* Collapsed state — content disappears, only the collapse tab remains. */
.pict-modal-shell-panel-collapsed > .pict-modal-shell-panel-content
{
	display: none;
}
.pict-modal-shell-panel-collapsed > .pict-modal-shell-panel-resize-handle
{
	display: none;
}
.pict-modal-shell-panel-left.pict-modal-shell-panel-collapsed,
.pict-modal-shell-panel-right.pict-modal-shell-panel-collapsed
{
	/* When collapsed, side panels rotate the title for vertical reading. */
	overflow: hidden;
}
/* When collapsed: the entire panel becomes the tab strip — full width
   for sides, full height for top/bottom — with the title visible
   vertically (sides) or horizontally (top/bottom). The little sliver
   tab on the boundary disappears (we don't need it anymore — clicking
   anywhere on the panel toggles it back open). */
.pict-modal-shell-panel-left.pict-modal-shell-panel-collapsed,
.pict-modal-shell-panel-right.pict-modal-shell-panel-collapsed,
.pict-modal-shell-panel-top.pict-modal-shell-panel-collapsed,
.pict-modal-shell-panel-bottom.pict-modal-shell-panel-collapsed
{
	overflow: hidden;
}
.pict-modal-shell-panel-collapsed > .pict-modal-shell-panel-collapse-tab
{
	/* Promote the tab to FILL the collapsed panel (not just hug its
	   content) so the centered chevron + title group sits in the middle
	   of the panel. Without explicit width/height: 100%, the position:
	   absolute element shrinks to its natural content size and the
	   group ends up flush at the top of the panel — where the chevron
	   gets clipped by the topbar. */
	position: absolute !important;
	top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important;
	width: 100% !important;
	height: 100% !important;
	border: 0;
	border-radius: 0;
	background: transparent;
	opacity: 0.85;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	padding: 12px 4px;        /* keeps chevron + title clear of edges */
	box-shadow: none;
	color: var(--theme-color-text-muted, #6b7280);
	box-sizing: border-box;
	overflow: hidden;
}
.pict-modal-shell-panel-collapsed > .pict-modal-shell-panel-collapse-tab:hover
{
	background: var(--theme-color-background-hover, var(--pict-modal-bg, #fff));
	color: var(--brand-color-primary-mode, var(--theme-color-brand-primary, #2563eb));
	box-shadow: none;
}
/* Side panels (collapsed): rotate the title for vertical reading. */
.pict-modal-shell-panel-left.pict-modal-shell-panel-collapsed   > .pict-modal-shell-panel-collapse-tab,
.pict-modal-shell-panel-right.pict-modal-shell-panel-collapsed  > .pict-modal-shell-panel-collapse-tab
{
	writing-mode: vertical-rl;
	text-orientation: mixed;
}
.pict-modal-shell-panel-collapsed .pict-modal-shell-panel-collapse-tab-title
{
	display: inline;
}

/* Hidden panels — when Hidden:true is passed to addPanel, the collapsed
   state has zero footprint: no collapse tab (the tab is never built),
   the panel root is display:none, and the resize handle vanishes. The
   only path to the open state is a programmatic expand()/toggle() from
   somewhere else in the app (e.g. a topbar gear button). When expanded,
   the panel renders normally — so resize/drag handles continue to work
   while the panel is open. */
.pict-modal-shell-panel-hidden.pict-modal-shell-panel-collapsed
{
	display: none !important;
}

/* Overlay panels — float over the middle row instead of taking layout
   space. The overlay layer is positioned absolutely inside the middle
   row; individual overlay panels stack with positive z-index. */
.pict-modal-shell-overlay-layer
{
	position: absolute;
	inset: 0;
	pointer-events: none;
	z-index: 10;
}
.pict-modal-shell-overlay-layer .pict-modal-shell-panel
{
	pointer-events: auto;
	position: absolute;
	box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
}
.pict-modal-shell-overlay-layer .pict-modal-shell-panel-left   { left:   0; top: 0; bottom: 0; }
.pict-modal-shell-overlay-layer .pict-modal-shell-panel-right  { right:  0; top: 0; bottom: 0; }
.pict-modal-shell-overlay-layer .pict-modal-shell-panel-top    { top:    0; left: 0; right: 0; }
.pict-modal-shell-overlay-layer .pict-modal-shell-panel-bottom { bottom: 0; left: 0; right: 0; }

/* ─────────────────────────────────────────────────────────────────
   Responsive drawer mode — .pict-modal-shell-drawer-active toggles
   onto the middle row when any panel with ResponsiveDrawer crosses
   below its breakpoint. Flips the row's flex-direction from row to
   column, stacking side panels above the center and stretching them
   to full width. Each opted-in panel itself gets the
   .pict-modal-shell-panel-drawer class so per-panel rules below
   target only the drawer-mode panels (right + non-drawer panels in
   the same row are unaffected). The drawer height is read from a
   per-panel --pict-modal-drawer-height CSS variable (default
   33vh, set in JS from the DrawerHeight option).
   ───────────────────────────────────────────────────────────────── */
.pict-modal-shell-row-middle.pict-modal-shell-drawer-active
{
	flex-direction: column;
	/* The drawer tab lives outside the drawer's bottom edge — ancestor
	   chain MUST allow it to escape clip. */
	overflow: visible;
}
.pict-modal-shell-row-middle.pict-modal-shell-drawer-active .pict-modal-shell-side
{
	/* Side stacks stretch full-width and lay out their panels as a
	   horizontal row of stacked drawers (so two drawers from the same
	   side don't end up overlapping). overflow: visible so the
	   per-panel tab can extend below the side stack into the workspace. */
	width: 100% !important;
	flex-direction: column;
	overflow: visible;
}
/* The drawer-tagged panel itself: kill the inline width set by
   _applySize (we override with !important since the inline style has
   higher specificity than a class selector), then size by height
   from the CSS variable. Resize handle is hidden in drawer mode
   because horizontal dragging doesn't translate to vertical sizing
   and the user already has the collapse tab to dismiss / restore.

   padding-bottom reserves an 18px strip at the bottom of the panel
   for the tab. The tab sits INSIDE the drawer's footprint — never
   below it — so the workspace header below the drawer is never in
   the same vertical band as the tab. (Previously the tab hung
   below the drawer's bottom edge into the workspace's top padding;
   that made the tab visually compete with the workspace header,
   even when the tab box-model bounds technically cleared the
   header.) box-sizing: border-box so the padding eats from the
   33vh, not adding to it. */
.pict-modal-shell-panel-drawer
{
	width: 100% !important;
	max-width: 100% !important;
	height: var(--pict-modal-drawer-height, 33vh);
	transition: height 140ms ease;
	padding-bottom: 18px;
	box-sizing: border-box;
	overflow: visible !important;
	/* Clip the panel bg to its CONTENT area only — the 18px
	   padding-bottom reserve (where the tab lives) becomes
	   transparent, so the middle row's primary background shows
	   through. Without this the reserve would render with the
	   panel's chrome bg, creating a visible "strip" between the
	   drawer content above and the workspace below — the tab would
	   look like it's sitting on its own miscoloured band rather
	   than at the seam between drawer and workspace. */
	background-clip: content-box;
}
.pict-modal-shell-panel-drawer.pict-modal-shell-panel-collapsed
{
	/* Collapsed = "just the tab strip is visible". 18px matches the
	   panel's tab reserve so the height is consistent across states.
	   When this is 0 the tab would have nowhere to render and the
	   user couldn't reopen the drawer. */
	height: 18px !important;
	padding-bottom: 0 !important;
	/* Drop the panel's bg in collapsed state — without this the 18px
	   strip shows the --pict-modal-bg (panel chrome) which doesn't
	   match the workspace --theme-color-background-primary below it,
	   creating a visible "drawer band" around the tab that breaks the
	   illusion of the tab belonging to the workspace area. With
	   transparent bg the middle row's primary background shows
	   through, the strip blends with the workspace, and the tab pill
	   reads as a free-floating handle. */
	background: transparent !important;
}
.pict-modal-shell-panel-drawer > .pict-modal-shell-panel-resize-handle
{
	display: none;
}
/* The drawer's collapse tab is a horizontal pill protruding from the
   bottom of the drawer (rather than the inner edge of a side panel).
   Override the side-panel positioning rules from above so the tab
   always sits at the drawer's bottom-center seam, in both expanded
   and collapsed states. The expand-from-zero affordance: when
   collapsed (height: 0), the tab still hangs below "where the
   drawer would be" — a small handle the user can click to pull
   the drawer back down. */
.pict-modal-shell-panel-drawer > .pict-modal-shell-panel-collapse-tab,
.pict-modal-shell-panel-drawer.pict-modal-shell-panel-collapsed > .pict-modal-shell-panel-collapse-tab
{
	position: absolute !important;
	/* Anchored to the panel's BOTTOM edge — the tab lives INSIDE the
	   drawer's footprint (in the 18px reserve at the bottom), never
	   below it into the workspace. This means the workspace below
	   the drawer is never sharing a vertical band with the tab, so
	   the workspace header doesn't optically compete with it.
	   bottom: 4px aligns the tab's top edge exactly with the panel's
	   CONTENT-AREA bottom (panel.height − padding-bottom 18px). With
	   border-top: 0 on the tab, the seam between the drawer content
	   above and the tab body is invisible — they share --pict-modal-bg
	   and merge into one shape, the tab reading as a labelled
	   extension of the drawer hanging downward. Collapsed state
	   keeps the smaller offset (overridden below) because its panel
	   has no padding-bottom, so the math doesn't apply. */
	top: auto !important;
	bottom: 4px !important;
	left: 50% !important;
	right: auto !important;
	transform: translate(-50%, 0) !important;
	width: 64px !important;
	height: 14px !important;
	/* CRITICAL: border-box + padding: 0 — the collapsed-state base
	   rule inherits "padding: 12px 4px" (so the chevron clears the
	   edges of a tab that fills a 24px-wide side strip). In drawer
	   mode the tab is a 14px tall pill, NOT a strip-fill, so that
	   12px vertical padding would balloon the tab's outer height to
	   ~38px and crash into the workspace header text. The chevron
	   is centered via flex anyway. */
	box-sizing: border-box !important;
	padding: 0 !important;
	/* Rounded BOTTOM corners + no top border — the tab looks like a
	   traditional drawer-handle/tab hanging from above. Its rounded
	   bottom curves face the workspace (the "open downward" affordance
	   for a top drawer). border-top: 0 lets the tab visually merge
	   with whatever's directly above it inside the panel (sidebar
	   content when expanded, the panel background when collapsed). */
	border-radius: 0 0 8px 8px;
	border: 1px solid var(--pict-modal-border, var(--theme-color-border-default, #cfd5dd));
	border-top: 0;
	background: var(--pict-modal-bg, var(--theme-color-background-panel, #fff));
	opacity: 0.95;
	z-index: 20;
	/* The default side-panel hover-grow values would yank the tab off
	   to the wrong spot in drawer mode — neutralise. */
	display: flex;
	align-items: center;
	justify-content: center;
}
.pict-modal-shell-panel-drawer > .pict-modal-shell-panel-collapse-tab:hover,
.pict-modal-shell-panel-drawer.pict-modal-shell-panel-collapsed > .pict-modal-shell-panel-collapse-tab:hover
{
	opacity: 1;
	width: 96px !important;
	/* height stays at 14px — the tab is anchored with bottom, so any
	   height growth would push the tab's TOP edge UPWARD past the
	   space available above it. In EXPANDED state that crashes into
	   the drawer content above; in COLLAPSED state it crashes into
	   the topbar's brand stripes. Width-only growth (64 to 96, +50%)
	   still gives the "tab is reaching toward me" affordance without
	   the encroachment. */
	color: var(--brand-color-primary-mode, var(--theme-color-brand-primary, #2563eb));
	border-color: var(--brand-color-primary-mode, var(--theme-color-brand-primary, #2563eb));
	box-shadow: 0 3px 6px -2px rgba(0, 0, 0, 0.18);
}
/* Collapsed-state bottom-offset override. Expanded panels have an
   18px padding-bottom reserve, and "bottom: 4px" anchors the tab's
   top edge exactly at the content-area boundary (so it merges
   visually with the drawer above). Collapsed panels have
   padding-bottom: 0 and a total height of 18px — "bottom: 4px"
   there would put the tab's top at the panel's actual top edge,
   crashing the (border-top: 0) tab into the topbar. The smaller
   "bottom: 2px" keeps the 14px tab vertically centered in the 18px
   strip with 2px margins on either side. */
.pict-modal-shell-panel-drawer.pict-modal-shell-panel-collapsed > .pict-modal-shell-panel-collapse-tab
{
	bottom: 2px !important;
}
/* Chevron inside the tab: point UP when expanded (the drawer
   collapses UP / out of view, so the arrow indicates "click me to
   send the drawer up"), DOWN when collapsed (the drawer expands DOWN
   into view). Rotations come from the existing top-panel chevron
   table: rotate(-135deg) → UP arrow, rotate(45deg) → DOWN arrow. */
.pict-modal-shell-panel-drawer > .pict-modal-shell-panel-collapse-tab::before
{
	transform: rotate(-135deg) !important;
}
.pict-modal-shell-panel-drawer.pict-modal-shell-panel-collapsed > .pict-modal-shell-panel-collapse-tab::before
{
	transform: rotate(45deg) !important;
}
/* The collapse tab's existing title-text span is hidden when reduced
   to a pill — there's no horizontal room. The chevron alone reads
   correctly. */
.pict-modal-shell-panel-drawer > .pict-modal-shell-panel-collapse-tab .pict-modal-shell-panel-collapse-tab-title,
.pict-modal-shell-panel-drawer > .pict-modal-shell-panel-collapse-tab .pict-modal-shell-panel-collapse-tab-icon
{
	display: none;
}

/* Drag-active state — disable text selection + change cursor globally
   so resize feels solid even when the cursor briefly leaves the handle. */
.pict-modal-shell-dragging-x, .pict-modal-shell-dragging-y { user-select: none; }
.pict-modal-shell-dragging-x * { cursor: col-resize !important; }
.pict-modal-shell-dragging-y * { cursor: row-resize !important; }

/* Per-panel resize-active state — kills the panel's collapse/expand
   width/height transition for the duration of a drag. Without this,
   every pointermove starts a fresh 140 ms transition and the resize
   visibly lags behind the cursor ("choppy"). With it disabled the
   panel snaps to the new size on the same frame as the pointer, which
   feels native. */
.pict-modal-shell-panel-resizing { transition: none !important; }
.pict-modal-shell-panel-resizing > .pict-modal-shell-panel-resize-handle
{
	background: var(--brand-color-primary-mode, var(--theme-color-brand-primary, #2563eb));
	opacity: 0.5;
}

/* Panel popup-attention flash — fires when popup() is called on an
   already-open panel. Brief brand-colored inset glow so the user sees
   that their click landed even though the panel didn't change shape.
   Class is added by the shell, auto-removed after ~700 ms. */
@keyframes pict-modal-shell-panel-flash
{
	0%   { box-shadow: inset 0 0 0 0 transparent; }
	30%  { box-shadow: inset 0 0 0 3px var(--brand-color-primary-mode, var(--theme-color-brand-primary, #2563eb)); }
	100% { box-shadow: inset 0 0 0 0 transparent; }
}
.pict-modal-shell-panel-flash
{
	animation: pict-modal-shell-panel-flash 600ms ease-out;
}
`};},{}],16:[function(require,module,exports){const libPictViewClass=require('pict-view');const libPictModalOverlay=require('./Pict-Modal-Overlay.js');const libPictModalConfirm=require('./Pict-Modal-Confirm.js');const libPictModalWindow=require('./Pict-Modal-Window.js');const libPictModalToast=require('./Pict-Modal-Toast.js');const libPictModalTooltip=require('./Pict-Modal-Tooltip.js');const libPictModalPanel=require('./Pict-Modal-Panel.js');const libPictModalDropdown=require('./Pict-Modal-Dropdown.js');const libPictModalShell=require('./Pict-Modal-Shell.js');const _DefaultConfiguration=require('./Pict-Section-Modal-DefaultConfiguration.js');class PictSectionModal extends libPictViewClass{constructor(pFable,pOptions,pServiceHash){let tmpOptions=Object.assign({},_DefaultConfiguration,pOptions);super(pFable,tmpOptions,pServiceHash);this._activeModals=[];this._activeTooltips=[];this._activeToasts=[];this._idCounter=0;this._overlay=new libPictModalOverlay(this);this._confirm=new libPictModalConfirm(this);this._window=new libPictModalWindow(this);this._toast=new libPictModalToast(this);this._tooltip=new libPictModalTooltip(this);this._panel=new libPictModalPanel(this);this._dropdown=new libPictModalDropdown(this);this._shell=new libPictModalShell(this);}onBeforeInitialize(){super.onBeforeInitialize();// Ensure the root class is on the body for CSS variable scoping
if(typeof document!=='undefined'&&document.body){if(!document.body.classList.contains('pict-modal-root')){document.body.classList.add('pict-modal-root');}}return super.onBeforeInitialize();}/**
	 * Generate a unique ID for DOM elements.
	 *
	 * @returns {number}
	 */_nextId(){this._idCounter++;return this._idCounter;}// -- Confirm API --
/**
	 * Show a confirmation dialog.
	 *
	 * @param {string} pMessage - The confirmation message
	 * @param {object} [pOptions] - Options { title, confirmLabel, cancelLabel, dangerous }
	 * @returns {Promise<boolean>}
	 */confirm(pMessage,pOptions){return this._confirm.confirm(pMessage,pOptions);}/**
	 * Show a two-step confirmation dialog.
	 *
	 * If confirmPhrase is set, the user must type it to enable the confirm button.
	 * If no confirmPhrase, the first click changes the button text and the second click confirms.
	 *
	 * @param {string} pMessage - The confirmation message
	 * @param {object} [pOptions] - Options { title, confirmPhrase, phrasePrompt, confirmLabel, cancelLabel }
	 * @returns {Promise<boolean>}
	 */doubleConfirm(pMessage,pOptions){return this._confirm.doubleConfirm(pMessage,pOptions);}// -- Modal Window API --
/**
	 * Show a custom modal window.
	 *
	 * @param {object} [pOptions] - Options { title, content, buttons, closeable, width, onOpen, onClose }
	 * @returns {Promise<string|null>} Resolves with the clicked button Hash, or null on close
	 */show(pOptions){return this._window.show(pOptions);}// -- Tooltip API --
/**
	 * Attach a simple text tooltip to an element.
	 *
	 * @param {HTMLElement} pElement - Target element
	 * @param {string} pText - Tooltip text
	 * @param {object} [pOptions] - Options { position, delay, maxWidth }
	 * @returns {{ destroy: function }}
	 */tooltip(pElement,pText,pOptions){return this._tooltip.tooltip(pElement,pText,pOptions);}/**
	 * Attach a rich HTML tooltip to an element.
	 *
	 * @param {HTMLElement} pElement - Target element
	 * @param {string} pHTMLContent - HTML content
	 * @param {object} [pOptions] - Options { position, delay, maxWidth, interactive }
	 * @returns {{ destroy: function }}
	 */richTooltip(pElement,pHTMLContent,pOptions){return this._tooltip.richTooltip(pElement,pHTMLContent,pOptions);}// -- Toast API --
/**
	 * Show a toast notification.
	 *
	 * @param {string} pMessage - Toast message
	 * @param {object} [pOptions] - Options { type, duration, position, dismissible }
	 * @returns {{ dismiss: function }}
	 */toast(pMessage,pOptions){return this._toast.toast(pMessage,pOptions);}// -- Dropdown API --
/**
	 * Open an anchor-positioned dropdown menu (no backdrop, click-outside
	 * dismisses). Useful for nav menus and split-button addenda.
	 *
	 * @param {HTMLElement|string|object} pAnchor - Element, CSS selector, or
	 *   { left, top, width, height } rect for context-menu style anchoring.
	 * @param {object} pOptions - { items, align, position, minWidth, maxHeight,
	 *   className, closeOnSelect, onSelect, onClose }
	 * @returns {Promise<{Hash, Item}|null>} Selection or null on dismiss.
	 */dropdown(pAnchor,pOptions){return this._dropdown.dropdown(pAnchor,pOptions);}/**
	 * Dismiss any open dropdown.
	 */dismissDropdowns(){this._dropdown.dismissAll();}// -- Panel API --
/**
	 * Attach resizable/collapsible panel behavior to a DOM element.
	 *
	 * @param {string} pTargetSelector - CSS selector for the panel element
	 * @param {object} [pOptions] - Options { position, width, minWidth, maxWidth, collapsible, collapsed, persist, persistKey, onResize, onToggle }
	 * @returns {{ collapse, expand, toggle, setWidth, destroy }} Panel handle
	 */panel(pTargetSelector,pOptions){return this._panel.create(pTargetSelector,pOptions);}// -- Shell API --
/**
	 * Get (or create) a layout shell for a viewport. Idempotent.
	 *
	 * The shell takes ownership of the viewport's contents and manages
	 * top / right / bottom / left panel placement plus a center area.
	 * See Pict-Modal-Shell.js for full panel-config semantics.
	 *
	 * @param {string|HTMLElement} pViewport - selector or element of the
	 *   container the shell should fill (commonly the app's root div).
	 * @param {object} [pOptions]
	 * @param {boolean} [pOptions.Persistence=true]   - autosave panel state to localStorage
	 * @param {string}  [pOptions.PersistenceKey=null]- override scope (default: hostname)
	 * @returns {PictModalShell}
	 */shell(pViewport,pOptions){return this._shell.shell(pViewport,pOptions);}// -- Cleanup API --
/**
	 * Dismiss all open modals.
	 */dismissModals(){let tmpModals=this._activeModals.slice();for(let i=tmpModals.length-1;i>=0;i--){tmpModals[i].dismiss(null);}}/**
	 * Dismiss all active tooltips.
	 */dismissTooltips(){this._tooltip.dismissAll();}/**
	 * Dismiss all active toasts.
	 */dismissToasts(){this._toast.dismissAll();}/**
	 * Dismiss everything: modals, tooltips, and toasts.
	 */dismissAll(){this.dismissModals();this.dismissTooltips();this.dismissToasts();this.dismissDropdowns();}/**
	 * Clean up all DOM elements when the view is destroyed.
	 *//**
	 * Destroy all active panels.
	 */destroyPanels(){this._panel.destroyAll();}destroy(){this.dismissAll();this.destroyPanels();this._overlay.destroy();this._toast.destroy();if(typeof super.destroy==='function'){return super.destroy();}}}module.exports=PictSectionModal;module.exports.default_configuration=_DefaultConfiguration;},{"./Pict-Modal-Confirm.js":7,"./Pict-Modal-Dropdown.js":8,"./Pict-Modal-Overlay.js":9,"./Pict-Modal-Panel.js":10,"./Pict-Modal-Shell.js":11,"./Pict-Modal-Toast.js":12,"./Pict-Modal-Tooltip.js":13,"./Pict-Modal-Window.js":14,"./Pict-Section-Modal-DefaultConfiguration.js":15,"pict-view":18}],17:[function(require,module,exports){module.exports={"name":"pict-view","version":"1.0.68","description":"Pict View Base Class","main":"source/Pict-View.js","scripts":{"test":"npx quack test","tests":"npx quack test -g","start":"node source/Pict-View.js","coverage":"npx quack coverage","build":"npx quack build","docker-dev-build":"docker build ./ -f Dockerfile_LUXURYCode -t pict-view-image:local","docker-dev-run":"docker run -it -d --name pict-view-dev -p 30001:8080 -p 38086:8086 -v \"$PWD/.config:/home/coder/.config\"  -v \"$PWD:/home/coder/pict-view\" -u \"$(id -u):$(id -g)\" -e \"DOCKER_USER=$USER\" pict-view-image:local","docker-dev-shell":"docker exec -it pict-view-dev /bin/bash","types":"tsc -p .","lint":"eslint source/**"},"types":"types/source/Pict-View.d.ts","repository":{"type":"git","url":"git+https://github.com/stevenvelozo/pict-view.git"},"author":"steven velozo <steven@velozo.com>","license":"MIT","bugs":{"url":"https://github.com/stevenvelozo/pict-view/issues"},"homepage":"https://github.com/stevenvelozo/pict-view#readme","devDependencies":{"@eslint/js":"^9.39.1","browser-env":"^3.3.0","eslint":"^9.39.1","pict":"^1.0.363","quackage":"^1.0.65","typescript":"^5.9.3"},"mocha":{"diff":true,"extension":["js"],"package":"./package.json","reporter":"spec","slow":"75","timeout":"5000","ui":"tdd","watch-files":["source/**/*.js","test/**/*.js"],"watch-ignore":["lib/vendor"]},"dependencies":{"fable":"^3.1.67","fable-serviceproviderbase":"^3.0.19"}};},{}],18:[function(require,module,exports){const libFableServiceBase=require('fable-serviceproviderbase');const libPackage=require('../package.json');const defaultPictViewSettings={DefaultRenderable:false,DefaultDestinationAddress:false,DefaultTemplateRecordAddress:false,ViewIdentifier:false,// If this is set to true, when the App initializes this will.
// After the App initializes, initialize will be called as soon as it's added.
AutoInitialize:true,AutoInitializeOrdinal:0,// If this is set to true, when the App autorenders (on load) this will.
// After the App initializes, render will be called as soon as it's added.
AutoRender:true,AutoRenderOrdinal:0,AutoSolveWithApp:true,AutoSolveOrdinal:0,CSSHash:false,CSS:false,CSSProvider:false,CSSPriority:500,Templates:[],DefaultTemplates:[],Renderables:[],Manifests:{}};/** @typedef {(error?: Error) => void} ErrorCallback *//** @typedef {number | boolean} PictTimestamp *//**
 * @typedef {'replace' | 'append' | 'prepend' | 'append_once' | 'virtual-assignment'} RenderMethod
 *//**
 * @typedef {Object} Renderable
 *
 * @property {string} RenderableHash - A unique hash for the renderable.
 * @property {string} TemplateHash - The hash of the template to use for rendering this renderable.
 * @property {string} [DefaultTemplateRecordAddress] - The default address for resolving the data record for this renderable.
 * @property {string} [ContentDestinationAddress] - The default address (DOM CSS selector) for rendering the content of this renderable.
 * @property {RenderMethod} [RenderMethod=replace] - The method to use when projecting the renderable to the DOM ('replace', 'append', 'prepend', 'append_once', 'virtual-assignment').
 * @property {string} [TestAddress] - The address to use for testing the renderable.
 * @property {string} [TransactionHash] - The transaction hash for the root renderable.
 * @property {string} [RootRenderableViewHash] - The hash of the root renderable.
 * @property {string} [Content] - The rendered content for this renderable, if applicable.
 *//**
 * Represents a view in the Pict ecosystem.
 */class PictView extends libFableServiceBase{/**
	 * @param {any} pFable - The Fable object that this service is attached to.
	 * @param {any} [pOptions] - (optional) The options for this service.
	 * @param {string} [pServiceHash] - (optional) The hash of the service.
	 */constructor(pFable,pOptions,pServiceHash){// Intersect default options, parent constructor, service information
let tmpOptions=Object.assign({},JSON.parse(JSON.stringify(defaultPictViewSettings)),pOptions);super(pFable,tmpOptions,pServiceHash);//FIXME: add types to fable and ancillaries
/** @type {any} */this.fable;/** @type {any} */this.options;/** @type {String} */this.UUID;/** @type {String} */this.Hash;/** @type {any} */this.log;const tmpHashIsUUID=this.Hash===this.UUID;//NOTE: since many places are using the view UUID as the HTML element ID, we prefix it to avoid starting with a number
this.UUID=`V-${this.UUID}`;if(tmpHashIsUUID){this.Hash=this.UUID;}if(!this.options.ViewIdentifier){this.options.ViewIdentifier=`AutoViewID-${this.fable.getUUID()}`;}this.serviceType='PictView';/** @type {Record<string, any>} */this._Package=libPackage;// Convenience and consistency naming
/** @type {import('pict') & { log: any, instantiateServiceProviderWithoutRegistration: (hash: String) => any, instantiateServiceProviderIfNotExists: (hash: string) => any, TransactionTracking: import('pict/types/source/services/Fable-Service-TransactionTracking') }} */this.pict=this.fable;// Wire in the essential Pict application state
this.AppData=this.pict.AppData;this.Bundle=this.pict.Bundle;/** @type {PictTimestamp} */this.initializeTimestamp=false;/** @type {PictTimestamp} */this.lastSolvedTimestamp=false;/** @type {PictTimestamp} */this.lastRenderedTimestamp=false;/** @type {PictTimestamp} */this.lastMarshalFromViewTimestamp=false;/** @type {PictTimestamp} */this.lastMarshalToViewTimestamp=false;this.pict.instantiateServiceProviderIfNotExists('TransactionTracking');// Load all templates from the array in the options
// Templates are in the form of {Hash:'Some-Template-Hash',Template:'Template content',Source:'TemplateSource'}
for(let i=0;i<this.options.Templates.length;i++){let tmpTemplate=this.options.Templates[i];if(!('Hash'in tmpTemplate)||!('Template'in tmpTemplate)){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not load Template ${i} in the options array.`,tmpTemplate);}else{if(!tmpTemplate.Source){tmpTemplate.Source=`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} options object.`;}this.pict.TemplateProvider.addTemplate(tmpTemplate.Hash,tmpTemplate.Template,tmpTemplate.Source);}}// Load all default templates from the array in the options
// Templates are in the form of {Prefix:'',Postfix:'-List-Row',Template:'Template content',Source:'TemplateSourceString'}
for(let i=0;i<this.options.DefaultTemplates.length;i++){let tmpDefaultTemplate=this.options.DefaultTemplates[i];if(!('Postfix'in tmpDefaultTemplate)||!('Template'in tmpDefaultTemplate)){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not load Default Template ${i} in the options array.`,tmpDefaultTemplate);}else{if(!tmpDefaultTemplate.Source){tmpDefaultTemplate.Source=`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} options object.`;}this.pict.TemplateProvider.addDefaultTemplate(tmpDefaultTemplate.Prefix,tmpDefaultTemplate.Postfix,tmpDefaultTemplate.Template,tmpDefaultTemplate.Source);}}// Load the CSS if it's available
if(this.options.CSS){let tmpCSSHash=this.options.CSSHash?this.options.CSSHash:`View-${this.options.ViewIdentifier}`;let tmpCSSProvider=this.options.CSSProvider?this.options.CSSProvider:tmpCSSHash;this.pict.CSSMap.addCSS(tmpCSSHash,this.options.CSS,tmpCSSProvider,this.options.CSSPriority);}// Load all renderables
// Renderables are launchable renderable instructions with templates
// They look as such: {Identifier:'ContentEntry', TemplateHash:'Content-Entry-Section-Main', ContentDestinationAddress:'#ContentSection', RecordAddress:'AppData.Content.DefaultText', ManifestTransformation:'ManyfestHash', ManifestDestinationAddress:'AppData.Content.DataToTransformContent'}
// The only parts that are necessary are Identifier and Template
// A developer can then do render('ContentEntry') and it just kinda works.  Or they can override the ContentDestinationAddress
/** @type {Record<String, Renderable>} */this.renderables={};for(let i=0;i<this.options.Renderables.length;i++){/** @type {Renderable} */let tmpRenderable=this.options.Renderables[i];this.addRenderable(tmpRenderable);}}/**
	 * Adds a renderable to the view.
	 *
	 * @param {string | Renderable} pRenderableHash - The hash of the renderable, or a renderable object.
	 * @param {string} [pTemplateHash] - (optional) The hash of the template for the renderable.
	 * @param {string} [pDefaultTemplateRecordAddress] - (optional) The default data address for the template.
	 * @param {string} [pDefaultDestinationAddress] - (optional) The default destination address for the renderable.
	 * @param {RenderMethod} [pRenderMethod=replace] - (optional) The method to use when rendering the renderable (ex. 'replace').
	 */addRenderable(pRenderableHash,pTemplateHash,pDefaultTemplateRecordAddress,pDefaultDestinationAddress,pRenderMethod){/** @type {Renderable} */let tmpRenderable;if(typeof pRenderableHash=='object'){// The developer passed in the renderable as an object.
// Use theirs instead!
tmpRenderable=pRenderableHash;}else{/** @type {RenderMethod} */let tmpRenderMethod=typeof pRenderMethod!=='string'?pRenderMethod:'replace';tmpRenderable={RenderableHash:pRenderableHash,TemplateHash:pTemplateHash,DefaultTemplateRecordAddress:pDefaultTemplateRecordAddress,ContentDestinationAddress:pDefaultDestinationAddress,RenderMethod:tmpRenderMethod};}if(typeof tmpRenderable.RenderableHash!='string'||typeof tmpRenderable.TemplateHash!='string'){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not load Renderable; RenderableHash or TemplateHash are invalid.`,tmpRenderable);}else{if(this.pict.LogNoisiness>0){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} adding renderable [${tmpRenderable.RenderableHash}] pointed to template ${tmpRenderable.TemplateHash}.`);}this.renderables[tmpRenderable.RenderableHash]=tmpRenderable;}}/* -------------------------------------------------------------------------- *//*                        Code Section: Initialization                        *//* -------------------------------------------------------------------------- *//**
	 * Lifecycle hook that triggers before the view is initialized.
	 */onBeforeInitialize(){if(this.pict.LogNoisiness>3){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onBeforeInitialize:`);}return true;}/**
	 * Lifecycle hook that triggers before the view is initialized (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 */onBeforeInitializeAsync(fCallback){this.onBeforeInitialize();return fCallback();}/**
	 * Lifecycle hook that triggers when the view is initialized.
	 */onInitialize(){if(this.pict.LogNoisiness>3){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onInitialize:`);}return true;}/**
	 * Lifecycle hook that triggers when the view is initialized (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 */onInitializeAsync(fCallback){this.onInitialize();return fCallback();}/**
	 * Performs view initialization.
	 */initialize(){if(this.pict.LogControlFlow){this.log.trace(`PICT-ControlFlow VIEW [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} initialize:`);}if(!this.initializeTimestamp){this.onBeforeInitialize();this.onInitialize();this.onAfterInitialize();this.initializeTimestamp=this.pict.log.getTimeStamp();return true;}else{this.log.warn(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} initialize called but initialization is already completed.  Aborting.`);return false;}}/**
	 * Performs view initialization (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 */initializeAsync(fCallback){if(this.pict.LogControlFlow){this.log.trace(`PICT-ControlFlow VIEW [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} initializeAsync:`);}if(!this.initializeTimestamp){let tmpAnticipate=this.pict.instantiateServiceProviderWithoutRegistration('Anticipate');if(this.pict.LogNoisiness>0){this.log.info(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} beginning initialization...`);}tmpAnticipate.anticipate(this.onBeforeInitializeAsync.bind(this));tmpAnticipate.anticipate(this.onInitializeAsync.bind(this));tmpAnticipate.anticipate(this.onAfterInitializeAsync.bind(this));tmpAnticipate.wait(/** @param {Error} pError */pError=>{if(pError){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} initialization failed: ${pError.message||pError}`,{stack:pError.stack});}this.initializeTimestamp=this.pict.log.getTimeStamp();if(this.pict.LogNoisiness>0){this.log.info(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} initialization complete.`);}return fCallback();});}else{this.log.warn(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} async initialize called but initialization is already completed.  Aborting.`);// TODO: Should this be an error?
return fCallback();}}onAfterInitialize(){if(this.pict.LogNoisiness>3){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onAfterInitialize:`);}return true;}/**
	 * Lifecycle hook that triggers after the view is initialized (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 */onAfterInitializeAsync(fCallback){this.onAfterInitialize();return fCallback();}/* -------------------------------------------------------------------------- *//*                            Code Section: Render                            *//* -------------------------------------------------------------------------- *//**
	 * Lifecycle hook that triggers before the view is rendered.
	 *
	 * @param {Renderable} pRenderable - The renderable that will be rendered.
	 */onBeforeRender(pRenderable){// Overload this to mess with stuff before the content gets generated from the template
if(this.pict.LogNoisiness>3){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onBeforeRender:`);}return true;}/**
	 * Lifecycle hook that triggers before the view is rendered (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 * @param {Renderable} pRenderable - The renderable that will be rendered.
	 */onBeforeRenderAsync(fCallback,pRenderable){this.onBeforeRender(pRenderable);return fCallback();}/**
	 * Lifecycle hook that triggers before the view is projected into the DOM.
	 *
	 * @param {Renderable} pRenderable - The renderable that will be projected.
	 */onBeforeProject(pRenderable){// Overload this to mess with stuff before the content gets generated from the template
if(this.pict.LogNoisiness>3){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onBeforeProject:`);}return true;}/**
	 * Lifecycle hook that triggers before the view is projected into the DOM (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 * @param {Renderable} pRenderable - The renderable that will be projected.
	 */onBeforeProjectAsync(fCallback,pRenderable){this.onBeforeProject(pRenderable);return fCallback();}/**
	 * Builds the render options for a renderable.
	 *
	 * For DRY purposes on the three flavors of render.
	 *
	 * @param {string|ErrorCallback} [pRenderableHash] - The hash of the renderable to render.
	 * @param {string|ErrorCallback} [pRenderDestinationAddress] - The address where the renderable will be rendered.
	 * @param {string|object|ErrorCallback} [pTemplateRecordAddress] - The address of (or actual obejct) where the data for the template is stored.
	 */buildRenderOptions(pRenderableHash,pRenderDestinationAddress,pTemplateRecordAddress){let tmpRenderOptions={Valid:true};tmpRenderOptions.RenderableHash=typeof pRenderableHash==='string'?pRenderableHash:typeof this.options.DefaultRenderable=='string'?this.options.DefaultRenderable:false;if(!tmpRenderOptions.RenderableHash){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not find a suitable RenderableHash ${tmpRenderOptions.RenderableHash} (param ${pRenderableHash}because it is not a valid renderable.`);tmpRenderOptions.Valid=false;}tmpRenderOptions.Renderable=this.renderables[tmpRenderOptions.RenderableHash];if(!tmpRenderOptions.Renderable){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render ${tmpRenderOptions.RenderableHash} (param ${pRenderableHash}) because it does not exist.`);tmpRenderOptions.Valid=false;}tmpRenderOptions.DestinationAddress=typeof pRenderDestinationAddress==='string'?pRenderDestinationAddress:typeof tmpRenderOptions.Renderable.ContentDestinationAddress==='string'?tmpRenderOptions.Renderable.ContentDestinationAddress:typeof this.options.DefaultDestinationAddress==='string'?this.options.DefaultDestinationAddress:false;if(!tmpRenderOptions.DestinationAddress){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render ${tmpRenderOptions.RenderableHash} (param ${pRenderableHash}) because it does not have a valid destination address (param ${pRenderDestinationAddress}).`);tmpRenderOptions.Valid=false;}if(typeof pTemplateRecordAddress==='object'){tmpRenderOptions.RecordAddress='Passed in as object';tmpRenderOptions.Record=pTemplateRecordAddress;}else{tmpRenderOptions.RecordAddress=typeof pTemplateRecordAddress==='string'?pTemplateRecordAddress:typeof tmpRenderOptions.Renderable.DefaultTemplateRecordAddress==='string'?tmpRenderOptions.Renderable.DefaultTemplateRecordAddress:typeof this.options.DefaultTemplateRecordAddress==='string'?this.options.DefaultTemplateRecordAddress:false;tmpRenderOptions.Record=typeof tmpRenderOptions.RecordAddress==='string'?this.pict.DataProvider.getDataByAddress(tmpRenderOptions.RecordAddress):undefined;}return tmpRenderOptions;}/**
	 * Assigns the content to the destination address.
	 *
	 * For DRY purposes on the three flavors of render.
	 *
	 * @param {Renderable} pRenderable - The renderable to render.
	 * @param {string} pRenderDestinationAddress - The address where the renderable will be rendered.
	 * @param {string} pContent - The content to render.
	 * @returns {boolean} - Returns true if the content was assigned successfully.
	 * @memberof PictView
	 */assignRenderContent(pRenderable,pRenderDestinationAddress,pContent){return this.pict.ContentAssignment.projectContent(pRenderable.RenderMethod,pRenderDestinationAddress,pContent,pRenderable.TestAddress);}/**
	 * Render a renderable from this view.
	 *
	 * @param {string} [pRenderableHash] - The hash of the renderable to render.
	 * @param {string} [pRenderDestinationAddress] - The address where the renderable will be rendered.
	 * @param {string|object} [pTemplateRecordAddress] - The address where the data for the template is stored.
	 * @param {Renderable} [pRootRenderable] - The root renderable for the render operation, if applicable.
	 * @return {boolean}
	 */render(pRenderableHash,pRenderDestinationAddress,pTemplateRecordAddress,pRootRenderable){return this.renderWithScope(this,pRenderableHash,pRenderDestinationAddress,pTemplateRecordAddress,pRootRenderable);}/**
	 * Render a renderable from this view, providing a specifici scope for the template.
	 *
	 * @param {any} pScope - The scope to use for the template rendering.
	 * @param {string} [pRenderableHash] - The hash of the renderable to render.
	 * @param {string} [pRenderDestinationAddress] - The address where the renderable will be rendered.
	 * @param {string|object} [pTemplateRecordAddress] - The address where the data for the template is stored.
	 * @param {Renderable} [pRootRenderable] - The root renderable for the render operation, if applicable.
	 * @return {boolean}
	 */renderWithScope(pScope,pRenderableHash,pRenderDestinationAddress,pTemplateRecordAddress,pRootRenderable){let tmpRenderableHash=typeof pRenderableHash==='string'?pRenderableHash:typeof this.options.DefaultRenderable=='string'?this.options.DefaultRenderable:false;if(!tmpRenderableHash){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render ${tmpRenderableHash} (param ${pRenderableHash}) because it is not a valid renderable.`);return false;}/** @type {Renderable} */let tmpRenderable;if(tmpRenderableHash=='__Virtual'){tmpRenderable={RenderableHash:'__Virtual',TemplateHash:this.renderables[this.options.DefaultRenderable].TemplateHash,ContentDestinationAddress:typeof pRenderDestinationAddress==='string'?pRenderDestinationAddress:typeof tmpRenderable.ContentDestinationAddress==='string'?tmpRenderable.ContentDestinationAddress:typeof this.options.DefaultDestinationAddress==='string'?this.options.DefaultDestinationAddress:null,RenderMethod:'virtual-assignment',TransactionHash:pRootRenderable&&pRootRenderable.TransactionHash,RootRenderableViewHash:pRootRenderable&&pRootRenderable.RootRenderableViewHash};}else{tmpRenderable=Object.assign({},this.renderables[tmpRenderableHash]);tmpRenderable.ContentDestinationAddress=typeof pRenderDestinationAddress==='string'?pRenderDestinationAddress:typeof tmpRenderable.ContentDestinationAddress==='string'?tmpRenderable.ContentDestinationAddress:typeof this.options.DefaultDestinationAddress==='string'?this.options.DefaultDestinationAddress:null;}if(!tmpRenderable.TransactionHash){tmpRenderable.TransactionHash=`ViewRender-V-${this.options.ViewIdentifier}-R-${tmpRenderableHash}-U-${this.pict.getUUID()}`;tmpRenderable.RootRenderableViewHash=this.Hash;this.pict.TransactionTracking.registerTransaction(tmpRenderable.TransactionHash);}if(!tmpRenderable){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render ${tmpRenderableHash} (param ${pRenderableHash}) because it does not exist.`);return false;}if(!tmpRenderable.ContentDestinationAddress){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render ${tmpRenderableHash} (param ${pRenderableHash}) because it does not have a valid destination address.`);return false;}let tmpRecordAddress;let tmpRecord;if(typeof pTemplateRecordAddress==='object'){tmpRecord=pTemplateRecordAddress;tmpRecordAddress='Passed in as object';}else{tmpRecordAddress=typeof pTemplateRecordAddress==='string'?pTemplateRecordAddress:typeof tmpRenderable.DefaultTemplateRecordAddress==='string'?tmpRenderable.DefaultTemplateRecordAddress:typeof this.options.DefaultTemplateRecordAddress==='string'?this.options.DefaultTemplateRecordAddress:false;tmpRecord=typeof tmpRecordAddress==='string'?this.pict.DataProvider.getDataByAddress(tmpRecordAddress):undefined;}// Execute the developer-overridable pre-render behavior
this.onBeforeRender(tmpRenderable);if(this.pict.LogControlFlow){this.log.trace(`PICT-ControlFlow VIEW [${this.UUID}]::[${this.Hash}] Renderable[${tmpRenderableHash}] Destination[${tmpRenderable.ContentDestinationAddress}] TemplateRecordAddress[${tmpRecordAddress}] render:`);}if(this.pict.LogNoisiness>0){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} Beginning Render of Renderable[${tmpRenderableHash}] to Destination [${tmpRenderable.ContentDestinationAddress}]...`);}// Generate the content output from the template and data
tmpRenderable.Content=this.pict.parseTemplateByHash(tmpRenderable.TemplateHash,tmpRecord,null,[this],pScope,{RootRenderable:typeof pRootRenderable==='object'?pRootRenderable:tmpRenderable});if(this.pict.LogNoisiness>0){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} Assigning Renderable[${tmpRenderableHash}] content length ${tmpRenderable.Content.length} to Destination [${tmpRenderable.ContentDestinationAddress}] using render method [${tmpRenderable.RenderMethod}].`);}this.onBeforeProject(tmpRenderable);this.onProject(tmpRenderable);if(tmpRenderable.RenderMethod!=='virtual-assignment'){this.onAfterProject(tmpRenderable);// Execute the developer-overridable post-render behavior
this.onAfterRender(tmpRenderable);}return true;}/**
	 * Render a renderable from this view.
	 *
	 * @param {string|ErrorCallback} [pRenderableHash] - The hash of the renderable to render.
	 * @param {string|ErrorCallback} [pRenderDestinationAddress] - The address where the renderable will be rendered.
	 * @param {string|object|ErrorCallback} [pTemplateRecordAddress] - The address where the data for the template is stored.
	 * @param {Renderable|ErrorCallback} [pRootRenderable] - The root renderable for the render operation, if applicable.
	 * @param {ErrorCallback} [fCallback] - The callback to call when the async operation is complete.
	 *
	 * @return {void}
	 */renderAsync(pRenderableHash,pRenderDestinationAddress,pTemplateRecordAddress,pRootRenderable,fCallback){return this.renderWithScopeAsync(this,pRenderableHash,pRenderDestinationAddress,pTemplateRecordAddress,pRootRenderable,fCallback);}/**
	 * Render a renderable from this view.
	 *
	 * @param {any} pScope - The scope to use for the template rendering.
	 * @param {string|ErrorCallback} [pRenderableHash] - The hash of the renderable to render.
	 * @param {string|ErrorCallback} [pRenderDestinationAddress] - The address where the renderable will be rendered.
	 * @param {string|object|ErrorCallback} [pTemplateRecordAddress] - The address where the data for the template is stored.
	 * @param {Renderable|ErrorCallback} [pRootRenderable] - The root renderable for the render operation, if applicable.
	 * @param {ErrorCallback} [fCallback] - The callback to call when the async operation is complete.
	 *
	 * @return {void}
	 */renderWithScopeAsync(pScope,pRenderableHash,pRenderDestinationAddress,pTemplateRecordAddress,pRootRenderable,fCallback){let tmpRenderableHash=typeof pRenderableHash==='string'?pRenderableHash:typeof this.options.DefaultRenderable=='string'?this.options.DefaultRenderable:false;// Allow the callback to be passed in as the last parameter no matter what
/** @type {ErrorCallback} */let tmpCallback=typeof fCallback==='function'?fCallback:typeof pTemplateRecordAddress==='function'?pTemplateRecordAddress:typeof pRenderDestinationAddress==='function'?pRenderDestinationAddress:typeof pRenderableHash==='function'?pRenderableHash:typeof pRootRenderable==='function'?pRootRenderable:null;if(!tmpCallback){this.log.warn(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);tmpCallback=pError=>{if(pError){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderAsync Auto Callback Error: ${pError}`,pError);}};}if(!tmpRenderableHash){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not asynchronously render ${tmpRenderableHash} (param ${pRenderableHash}because it is not a valid renderable.`);return tmpCallback(new Error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not asynchronously render ${tmpRenderableHash} (param ${pRenderableHash}because it is not a valid renderable.`));}/** @type {Renderable} */let tmpRenderable;if(tmpRenderableHash=='__Virtual'){tmpRenderable={RenderableHash:'__Virtual',TemplateHash:this.renderables[this.options.DefaultRenderable].TemplateHash,ContentDestinationAddress:typeof pRenderDestinationAddress==='string'?pRenderDestinationAddress:typeof this.options.DefaultDestinationAddress==='string'?this.options.DefaultDestinationAddress:null,RenderMethod:'virtual-assignment',TransactionHash:pRootRenderable&&typeof pRootRenderable!=='function'&&pRootRenderable.TransactionHash,RootRenderableViewHash:pRootRenderable&&typeof pRootRenderable!=='function'&&pRootRenderable.RootRenderableViewHash};}else{tmpRenderable=Object.assign({},this.renderables[tmpRenderableHash]);tmpRenderable.ContentDestinationAddress=typeof pRenderDestinationAddress==='string'?pRenderDestinationAddress:typeof tmpRenderable.ContentDestinationAddress==='string'?tmpRenderable.ContentDestinationAddress:typeof this.options.DefaultDestinationAddress==='string'?this.options.DefaultDestinationAddress:null;}if(!tmpRenderable.TransactionHash){tmpRenderable.TransactionHash=`ViewRender-V-${this.options.ViewIdentifier}-R-${tmpRenderableHash}-U-${this.pict.getUUID()}`;tmpRenderable.RootRenderableViewHash=this.Hash;this.pict.TransactionTracking.registerTransaction(tmpRenderable.TransactionHash);}if(!tmpRenderable){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render ${tmpRenderableHash} (param ${pRenderableHash}) because it does not exist.`);return tmpCallback(new Error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render ${tmpRenderableHash} (param ${pRenderableHash}) because it does not exist.`));}if(!tmpRenderable.ContentDestinationAddress){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render ${tmpRenderableHash} (param ${pRenderableHash}) because it does not have a valid destination address.`);return tmpCallback(new Error(`Could not render ${tmpRenderableHash}`));}let tmpRecordAddress;let tmpRecord;if(typeof pTemplateRecordAddress==='object'){tmpRecord=pTemplateRecordAddress;tmpRecordAddress='Passed in as object';}else{tmpRecordAddress=typeof pTemplateRecordAddress==='string'?pTemplateRecordAddress:typeof tmpRenderable.DefaultTemplateRecordAddress==='string'?tmpRenderable.DefaultTemplateRecordAddress:typeof this.options.DefaultTemplateRecordAddress==='string'?this.options.DefaultTemplateRecordAddress:false;tmpRecord=typeof tmpRecordAddress==='string'?this.pict.DataProvider.getDataByAddress(tmpRecordAddress):undefined;}if(this.pict.LogControlFlow){this.log.trace(`PICT-ControlFlow VIEW [${this.UUID}]::[${this.Hash}] Renderable[${tmpRenderableHash}] Destination[${tmpRenderable.ContentDestinationAddress}] TemplateRecordAddress[${tmpRecordAddress}] renderAsync:`);}if(this.pict.LogNoisiness>2){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} Beginning Asynchronous Render (callback-style)...`);}let tmpAnticipate=this.fable.newAnticipate();tmpAnticipate.anticipate(fOnBeforeRenderCallback=>{this.onBeforeRenderAsync(fOnBeforeRenderCallback,tmpRenderable);});tmpAnticipate.anticipate(fAsyncTemplateCallback=>{// Render the template (asynchronously)
this.pict.parseTemplateByHash(tmpRenderable.TemplateHash,tmpRecord,(pError,pContent)=>{if(pError){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render (asynchronously) ${tmpRenderableHash} (param ${pRenderableHash}) because it did not parse the template.`,pError);return fAsyncTemplateCallback(pError);}tmpRenderable.Content=pContent;return fAsyncTemplateCallback();},[this],pScope,{RootRenderable:typeof pRootRenderable==='object'?pRootRenderable:tmpRenderable});});tmpAnticipate.anticipate(fNext=>{this.onBeforeProjectAsync(fNext,tmpRenderable);});tmpAnticipate.anticipate(fNext=>{this.onProjectAsync(fNext,tmpRenderable);});if(tmpRenderable.RenderMethod!=='virtual-assignment'){tmpAnticipate.anticipate(fNext=>{this.onAfterProjectAsync(fNext,tmpRenderable);});// Execute the developer-overridable post-render behavior
tmpAnticipate.anticipate(fNext=>{this.onAfterRenderAsync(fNext,tmpRenderable);});}tmpAnticipate.wait(tmpCallback);}/**
	 * Renders the default renderable.
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 */renderDefaultAsync(fCallback){// Render the default renderable
this.renderAsync(fCallback);}/**
	 * @param {string} [pRenderableHash] - The hash of the renderable to render.
	 * @param {string} [pRenderDestinationAddress] - The address where the renderable will be rendered.
	 * @param {string|object} [pTemplateRecordAddress] - The address of (or actual obejct) where the data for the template is stored.
	 */basicRender(pRenderableHash,pRenderDestinationAddress,pTemplateRecordAddress){return this.basicRenderWithScope(this,pRenderableHash,pRenderDestinationAddress,pTemplateRecordAddress);}/**
	 * @param {any} pScope - The scope to use for the template rendering.
	 * @param {string} [pRenderableHash] - The hash of the renderable to render.
	 * @param {string} [pRenderDestinationAddress] - The address where the renderable will be rendered.
	 * @param {string|object} [pTemplateRecordAddress] - The address of (or actual obejct) where the data for the template is stored.
	 */basicRenderWithScope(pScope,pRenderableHash,pRenderDestinationAddress,pTemplateRecordAddress){let tmpRenderOptions=this.buildRenderOptions(pRenderableHash,pRenderDestinationAddress,pTemplateRecordAddress);if(tmpRenderOptions.Valid){this.assignRenderContent(tmpRenderOptions.Renderable,tmpRenderOptions.DestinationAddress,this.pict.parseTemplateByHash(tmpRenderOptions.Renderable.TemplateHash,tmpRenderOptions.Record,null,[this],pScope,{RootRenderable:tmpRenderOptions.Renderable}));return true;}else{this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not perform a basic render of ${tmpRenderOptions.RenderableHash} because it is not valid.`);return false;}}/**
	 * @param {string|ErrorCallback} [pRenderableHash] - The hash of the renderable to render.
	 * @param {string|ErrorCallback} [pRenderDestinationAddress] - The address where the renderable will be rendered.
	 * @param {string|Object|ErrorCallback} [pTemplateRecordAddress] - The address of (or actual obejct) where the data for the template is stored.
	 * @param {ErrorCallback} [fCallback] - The callback to call when the async operation is complete.
	 */basicRenderAsync(pRenderableHash,pRenderDestinationAddress,pTemplateRecordAddress,fCallback){return this.basicRenderWithScopeAsync(this,pRenderableHash,pRenderDestinationAddress,pTemplateRecordAddress,fCallback);}/**
	 * @param {any} pScope - The scope to use for the template rendering.
	 * @param {string|ErrorCallback} [pRenderableHash] - The hash of the renderable to render.
	 * @param {string|ErrorCallback} [pRenderDestinationAddress] - The address where the renderable will be rendered.
	 * @param {string|Object|ErrorCallback} [pTemplateRecordAddress] - The address of (or actual obejct) where the data for the template is stored.
	 * @param {ErrorCallback} [fCallback] - The callback to call when the async operation is complete.
	 */basicRenderWithScopeAsync(pScope,pRenderableHash,pRenderDestinationAddress,pTemplateRecordAddress,fCallback){// Allow the callback to be passed in as the last parameter no matter what
/** @type {ErrorCallback} */let tmpCallback=typeof fCallback==='function'?fCallback:typeof pTemplateRecordAddress==='function'?pTemplateRecordAddress:typeof pRenderDestinationAddress==='function'?pRenderDestinationAddress:typeof pRenderableHash==='function'?pRenderableHash:null;if(!tmpCallback){this.log.warn(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} basicRenderAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);tmpCallback=pError=>{if(pError){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} basicRenderAsync Auto Callback Error: ${pError}`,pError);}};}const tmpRenderOptions=this.buildRenderOptions(pRenderableHash,pRenderDestinationAddress,pTemplateRecordAddress);if(tmpRenderOptions.Valid){this.pict.parseTemplateByHash(tmpRenderOptions.Renderable.TemplateHash,tmpRenderOptions.Record,/**
				 * @param {Error} [pError] - The error that occurred during template parsing.
				 * @param {string} [pContent] - The content that was rendered from the template.
				 */(pError,pContent)=>{if(pError){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render (asynchronously) ${tmpRenderOptions.RenderableHash} because it did not parse the template.`,pError);return tmpCallback(pError);}this.assignRenderContent(tmpRenderOptions.Renderable,tmpRenderOptions.DestinationAddress,pContent);return tmpCallback();},[this],pScope,{RootRenderable:tmpRenderOptions.Renderable});}else{let tmpErrorMessage=`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not perform a basic render of ${tmpRenderOptions.RenderableHash} because it is not valid.`;this.log.error(tmpErrorMessage);return tmpCallback(new Error(tmpErrorMessage));}}/**
	 * @param {Renderable} pRenderable - The renderable that was rendered.
	 */onProject(pRenderable){if(this.pict.LogNoisiness>3){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onProject:`);}if(pRenderable.RenderMethod==='virtual-assignment'){this.pict.TransactionTracking.pushToTransactionQueue(pRenderable.TransactionHash,{ViewHash:this.Hash,Renderable:pRenderable},'Deferred-Post-Content-Assignment');}if(this.pict.LogNoisiness>0){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} Assigning Renderable[${pRenderable.RenderableHash}] content length ${pRenderable.Content.length} to Destination [${pRenderable.ContentDestinationAddress}] using Async render method ${pRenderable.RenderMethod}.`);}// Assign the content to the destination address
this.pict.ContentAssignment.projectContent(pRenderable.RenderMethod,pRenderable.ContentDestinationAddress,pRenderable.Content,pRenderable.TestAddress);this.lastRenderedTimestamp=this.pict.log.getTimeStamp();}/**
	 * Lifecycle hook that triggers after the view is projected into the DOM (async flow).
	 *
	 * @param {(error?: Error, content?: string) => void} fCallback - The callback to call when the async operation is complete.
	 * @param {Renderable} pRenderable - The renderable that is being projected.
	 */onProjectAsync(fCallback,pRenderable){this.onProject(pRenderable);return fCallback();}/**
	 * Lifecycle hook that triggers after the view is rendered.
	 *
	 * @param {Renderable} pRenderable - The renderable that was rendered.
	 */onAfterRender(pRenderable){if(this.pict.LogNoisiness>3){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onAfterRender:`);}if(pRenderable&&pRenderable.RootRenderableViewHash===this.Hash){const tmpTransactionQueue=this.pict.TransactionTracking.clearTransactionQueue(pRenderable.TransactionHash)||[];for(const tmpEvent of tmpTransactionQueue){const tmpView=this.pict.views[tmpEvent.Data.ViewHash];if(!tmpView){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onAfterRender: Could not find view for transaction hash ${pRenderable.TransactionHash} and ViewHash ${tmpEvent.Data.ViewHash}.`);continue;}tmpView.onAfterProject();// Execute the developer-overridable post-render behavior
tmpView.onAfterRender(tmpEvent.Data.Renderable);}// Queue is drained and nested child renders have each cleaned up
// their own transactions; remove this root render's entry from
// the tracking map so it does not leak.
this.pict.TransactionTracking.unregisterTransaction(pRenderable.TransactionHash);}return true;}/**
	 * Lifecycle hook that triggers after the view is rendered (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 * @param {Renderable} pRenderable - The renderable that was rendered.
	 */onAfterRenderAsync(fCallback,pRenderable){// NOTE: this.onAfterRender(pRenderable) will itself clear the
// transaction queue and unregister the transaction if this view is
// the root renderable - see onAfterRender above. So by the time the
// loop below runs, the queue is already empty and there is nothing
// to drain. Keeping the async queue walk here defensively in case
// future subclasses override onAfterRender in ways that skip the
// drain, but the common path is now "sync drain, async no-op".
this.onAfterRender(pRenderable);const tmpAnticipate=this.fable.newAnticipate();const tmpIsRootRenderable=pRenderable&&pRenderable.RootRenderableViewHash===this.Hash;if(tmpIsRootRenderable){const queue=this.pict.TransactionTracking.clearTransactionQueue(pRenderable.TransactionHash)||[];for(const event of queue){/** @type {PictView} */const tmpView=this.pict.views[event.Data.ViewHash];if(!tmpView){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onAfterRenderAsync: Could not find view for transaction hash ${pRenderable.TransactionHash} and ViewHash ${event.Data.ViewHash}.`);continue;}tmpAnticipate.anticipate(tmpView.onAfterProjectAsync.bind(tmpView));tmpAnticipate.anticipate(fNext=>{tmpView.onAfterRenderAsync(fNext,event.Data.Renderable);});// Execute the developer-overridable post-render behavior
}}return tmpAnticipate.wait(pError=>{// Nested virtual-assignment children have now settled their own
// onAfterRenderAsync chains (and unregistered their own
// transactions along the way). Ensure this root render's entry
// is also gone - unregisterTransaction is a no-op if the sync
// onAfterRender above already removed it, so this is safe to
// call unconditionally on the root path.
if(tmpIsRootRenderable&&pRenderable&&pRenderable.TransactionHash){this.pict.TransactionTracking.unregisterTransaction(pRenderable.TransactionHash);}return fCallback(pError);});}/**
	 * Lifecycle hook that triggers after the view is projected into the DOM.
	 *
	 * @param {Renderable} pRenderable - The renderable that was projected.
	 */onAfterProject(pRenderable){if(this.pict.LogNoisiness>3){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onAfterProject:`);}return true;}/**
	 * Lifecycle hook that triggers after the view is projected into the DOM (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 * @param {Renderable} pRenderable - The renderable that was projected.
	 */onAfterProjectAsync(fCallback,pRenderable){return fCallback();}/* -------------------------------------------------------------------------- *//*                            Code Section: Solver                            *//* -------------------------------------------------------------------------- *//**
	 * Lifecycle hook that triggers before the view is solved.
	 */onBeforeSolve(){if(this.pict.LogNoisiness>3){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onBeforeSolve:`);}return true;}/**
	 * Lifecycle hook that triggers before the view is solved (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 */onBeforeSolveAsync(fCallback){this.onBeforeSolve();return fCallback();}/**
	 * Lifecycle hook that triggers when the view is solved.
	 */onSolve(){if(this.pict.LogNoisiness>3){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onSolve:`);}return true;}/**
	 * Lifecycle hook that triggers when the view is solved (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 */onSolveAsync(fCallback){this.onSolve();return fCallback();}/**
	 * Performs view solving and triggers lifecycle hooks.
	 *
	 * @return {boolean} - True if the view was solved successfully, false otherwise.
	 */solve(){if(this.pict.LogNoisiness>2){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} executing solve() function...`);}this.onBeforeSolve();this.onSolve();this.onAfterSolve();this.lastSolvedTimestamp=this.pict.log.getTimeStamp();return true;}/**
	 * Performs view solving and triggers lifecycle hooks (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 */solveAsync(fCallback){let tmpAnticipate=this.pict.instantiateServiceProviderWithoutRegistration('Anticipate');/** @type {ErrorCallback} */let tmpCallback=typeof fCallback==='function'?fCallback:null;if(!tmpCallback){this.log.warn(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} solveAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);tmpCallback=pError=>{if(pError){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} solveAsync Auto Callback Error: ${pError}`,pError);}};}tmpAnticipate.anticipate(this.onBeforeSolveAsync.bind(this));tmpAnticipate.anticipate(this.onSolveAsync.bind(this));tmpAnticipate.anticipate(this.onAfterSolveAsync.bind(this));tmpAnticipate.wait(pError=>{if(this.pict.LogNoisiness>2){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} solveAsync() complete.`);}this.lastSolvedTimestamp=this.pict.log.getTimeStamp();return tmpCallback(pError);});}/**
	 * Lifecycle hook that triggers after the view is solved.
	 */onAfterSolve(){if(this.pict.LogNoisiness>3){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onAfterSolve:`);}return true;}/**
	 * Lifecycle hook that triggers after the view is solved (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 */onAfterSolveAsync(fCallback){this.onAfterSolve();return fCallback();}/* -------------------------------------------------------------------------- *//*                     Code Section: Marshal From View                        *//* -------------------------------------------------------------------------- *//**
	 * Lifecycle hook that triggers before data is marshaled from the view.
	 *
	 * @return {boolean} - True if the operation was successful, false otherwise.
	 */onBeforeMarshalFromView(){if(this.pict.LogNoisiness>3){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onBeforeMarshalFromView:`);}return true;}/**
	 * Lifecycle hook that triggers before data is marshaled from the view (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 */onBeforeMarshalFromViewAsync(fCallback){this.onBeforeMarshalFromView();return fCallback();}/**
	 * Lifecycle hook that triggers when data is marshaled from the view.
	 */onMarshalFromView(){if(this.pict.LogNoisiness>3){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onMarshalFromView:`);}return true;}/**
	 * Lifecycle hook that triggers when data is marshaled from the view (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 */onMarshalFromViewAsync(fCallback){this.onMarshalFromView();return fCallback();}/**
	 * Marshals data from the view.
	 *
	 * @return {boolean} - True if the operation was successful, false otherwise.
	 */marshalFromView(){if(this.pict.LogNoisiness>2){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} executing solve() function...`);}this.onBeforeMarshalFromView();this.onMarshalFromView();this.onAfterMarshalFromView();this.lastMarshalFromViewTimestamp=this.pict.log.getTimeStamp();return true;}/**
	 * Marshals data from the view (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 */marshalFromViewAsync(fCallback){let tmpAnticipate=this.pict.instantiateServiceProviderWithoutRegistration('Anticipate');/** @type {ErrorCallback} */let tmpCallback=typeof fCallback==='function'?fCallback:null;if(!tmpCallback){this.log.warn(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalFromViewAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);tmpCallback=pError=>{if(pError){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalFromViewAsync Auto Callback Error: ${pError}`,pError);}};}tmpAnticipate.anticipate(this.onBeforeMarshalFromViewAsync.bind(this));tmpAnticipate.anticipate(this.onMarshalFromViewAsync.bind(this));tmpAnticipate.anticipate(this.onAfterMarshalFromViewAsync.bind(this));tmpAnticipate.wait(pError=>{if(this.pict.LogNoisiness>2){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} marshalFromViewAsync() complete.`);}this.lastMarshalFromViewTimestamp=this.pict.log.getTimeStamp();return tmpCallback(pError);});}/**
	 * Lifecycle hook that triggers after data is marshaled from the view.
	 */onAfterMarshalFromView(){if(this.pict.LogNoisiness>3){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onAfterMarshalFromView:`);}return true;}/**
	 * Lifecycle hook that triggers after data is marshaled from the view (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 */onAfterMarshalFromViewAsync(fCallback){this.onAfterMarshalFromView();return fCallback();}/* -------------------------------------------------------------------------- *//*                     Code Section: Marshal To View                          *//* -------------------------------------------------------------------------- *//**
	 * Lifecycle hook that triggers before data is marshaled into the view.
	 */onBeforeMarshalToView(){if(this.pict.LogNoisiness>3){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onBeforeMarshalToView:`);}return true;}/**
	 * Lifecycle hook that triggers before data is marshaled into the view (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 */onBeforeMarshalToViewAsync(fCallback){this.onBeforeMarshalToView();return fCallback();}/**
	 * Lifecycle hook that triggers when data is marshaled into the view.
	 */onMarshalToView(){if(this.pict.LogNoisiness>3){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onMarshalToView:`);}return true;}/**
	 * Lifecycle hook that triggers when data is marshaled into the view (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 */onMarshalToViewAsync(fCallback){this.onMarshalToView();return fCallback();}/**
	 * Marshals data into the view.
	 *
	 * @return {boolean} - True if the operation was successful, false otherwise.
	 */marshalToView(){if(this.pict.LogNoisiness>2){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} executing solve() function...`);}this.onBeforeMarshalToView();this.onMarshalToView();this.onAfterMarshalToView();this.lastMarshalToViewTimestamp=this.pict.log.getTimeStamp();return true;}/**
	 * Marshals data into the view (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 */marshalToViewAsync(fCallback){let tmpAnticipate=this.pict.instantiateServiceProviderWithoutRegistration('Anticipate');/** @type {ErrorCallback} */let tmpCallback=typeof fCallback==='function'?fCallback:null;if(!tmpCallback){this.log.warn(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalToViewAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);tmpCallback=pError=>{if(pError){this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalToViewAsync Auto Callback Error: ${pError}`,pError);}};}tmpAnticipate.anticipate(this.onBeforeMarshalToViewAsync.bind(this));tmpAnticipate.anticipate(this.onMarshalToViewAsync.bind(this));tmpAnticipate.anticipate(this.onAfterMarshalToViewAsync.bind(this));tmpAnticipate.wait(pError=>{if(this.pict.LogNoisiness>2){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} marshalToViewAsync() complete.`);}this.lastMarshalToViewTimestamp=this.pict.log.getTimeStamp();return tmpCallback(pError);});}/**
	 * Lifecycle hook that triggers after data is marshaled into the view.
	 */onAfterMarshalToView(){if(this.pict.LogNoisiness>3){this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onAfterMarshalToView:`);}return true;}/**
	 * Lifecycle hook that triggers after data is marshaled into the view (async flow).
	 *
	 * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
	 */onAfterMarshalToViewAsync(fCallback){this.onAfterMarshalToView();return fCallback();}/** @return {boolean} - True if the object is a PictView. */get isPictView(){return true;}}module.exports=PictView;},{"../package.json":17,"fable-serviceproviderbase":2}],19:[function(require,module,exports){/**
 * Pict-Beacon-WebAuth-Client — pict-app helper for beacon login UIs
 *
 * Companion to Ultravisor-Beacon-WebAuth.cjs on the server side.  Any
 * beacon whose pict-app wants the same three-mode gate Ultravisor's UI
 * has (promiscuous → just works; authenticated → forced through login;
 * external-auth → in-app user mgmt hidden) imports this and calls
 * `install(pict, options)` from its application constructor.
 *
 * What this module does:
 *
 *   1. Registers `pict-section-login` as a view named `Pict-Section-Login`
 *      with endpoints + behaviour wired to the beacon's local proxy
 *      routes (which in turn talk to UV).  Mount target is the
 *      conventional `#Pict-Login-Container` div.
 *
 *   2. Monkey-patches `onLoginSuccess`/`onLogout`/`onSessionChecked` on
 *      the section instance so the host application's flow hooks run
 *      after the section's HTTP calls resolve (no subclass file needed).
 *
 *   3. Exposes `loadAuthStatus(callback)` for the host's
 *      `onAfterInitializeAsync` to fetch `/status` and populate
 *      `AppData.<AuthStateAddress>.Auth = { Mode, SupportsUserManagement,
 *      SessionChecked, Authenticated }`.  The host typically renders
 *      the layout after both this AND its task/data loading finish, then
 *      navigates to /Login when AuthMode === 'authenticated'.
 *
 * What this module does NOT do:
 *
 *   - Define a wrapper view (each beacon has its own ~20-line wrapper
 *     that paints `#Pict-Login-Container` inside its content panel).
 *   - Touch the host's router config.  The host adds a `/Login` route
 *     pointing at the wrapper view.
 *   - Force a particular AppData shape — `AuthStateAddress` is
 *     configurable so beacons that already use a nested namespace
 *     (e.g. `AppData.DataBeacon.Auth`) stay tidy.
 *
 * Usage:
 *
 *   const libBeaconWebAuthClient = require('ultravisor-beacon/webinterface/Pict-Beacon-WebAuth-Client.js');
 *
 *   libBeaconWebAuthClient.install(this.pict, {
 *       Section:              require('pict-section-login'),
 *       AuthStateAddress:     'AppData.DataBeacon.Auth',
 *       LoginRoute:           '/Login',
 *       HomeRoute:            '/Dashboard',
 *       StatusURL:            '/status',
 *       LoginEndpoint:        '/1.0/Authenticate',
 *       LogoutEndpoint:       '/1.0/Deauthenticate',
 *       CheckSessionEndpoint: '/1.0/CheckSession',
 *       OnAfterLogin:         (pSession) => app.refreshTopBarAndSidebar(),
 *       OnAfterLogout:        ()         => app.refreshTopBarAndSidebar(),
 *       OnSessionChecked:     (pSession) => { /* optional extra hook *\/ }
 *   });
 *
 * The Section module must be passed in by the host — this helper has
 * to live in a browser-loaded bundle so it can't require the pict
 * package at module-load time (the host's bundler resolves `pict-
 * section-login` against its own dependency tree).
 */'use strict';const DEFAULTS={SectionViewIdentifier:'Pict-Section-Login',AuthStateAddress:'AppData.Beacon.Auth',LoginRoute:'/Login',HomeRoute:'/Home',StatusURL:'/status',LoginEndpoint:'/1.0/Authenticate',LogoutEndpoint:'/1.0/Deauthenticate',CheckSessionEndpoint:'/1.0/CheckSession',CheckSessionOnLoad:true,ShowOAuthProviders:false};/**
 * Install the login section + return a small handle the host uses to
 * drive its boot gate.
 *
 * @param {object} pPict       — the live Pict instance
 * @param {object} pOptions    — see DEFAULTS for the full surface
 * @returns {object} handle    — { loadAuthStatus, navigateToLogin, ... }
 */function install(pPict,pOptions){if(!pPict||typeof pPict.addView!=='function'){throw new Error('Pict-Beacon-WebAuth-Client.install: pPict must be a Pict instance');}if(!pOptions||!pOptions.Section){throw new Error('Pict-Beacon-WebAuth-Client.install: pOptions.Section (the pict-section-login module) is required');}let tmpConfig=Object.assign({},DEFAULTS,pOptions);let libPictSectionLogin=tmpConfig.Section;// Register the section view.  CheckSessionOnLoad triggers the
// section's automatic session validation on its first render —
// which we use as the boot-gate's "is the cookie still good?" check.
pPict.addView(tmpConfig.SectionViewIdentifier,{LoginEndpoint:tmpConfig.LoginEndpoint,LogoutEndpoint:tmpConfig.LogoutEndpoint,CheckSessionEndpoint:tmpConfig.CheckSessionEndpoint,CheckSessionOnLoad:tmpConfig.CheckSessionOnLoad,ShowOAuthProviders:tmpConfig.ShowOAuthProviders},libPictSectionLogin);// Wire the section's overridable hooks to the host's flow.  Each
// hook also keeps the auth-state slot in AppData in sync so any
// view (top bar, sidebar, menus) can re-render off a single source.
let tmpLogin=pPict.views[tmpConfig.SectionViewIdentifier];if(tmpLogin){tmpLogin.onLoginSuccess=pSession=>_afterLogin(pPict,tmpConfig,pSession);tmpLogin.onLogout=()=>_afterLogout(pPict,tmpConfig);tmpLogin.onSessionChecked=pSession=>_afterSessionChecked(pPict,tmpConfig,pSession);}// Seed the auth-state slot with defaults so views that render
// before /status returns can read truthy/falsy values without
// optional-chaining.
_writeAuthState(pPict,tmpConfig,{Mode:'promiscuous',SupportsUserManagement:false,SessionChecked:false,Authenticated:false});return{/**
		 * Fetch /status and refresh AppData auth state.  Hosts call this
		 * inside `onAfterInitializeAsync` alongside their task/data load
		 * so route resolution + layout render only happen once both are
		 * complete.  fCallback(pError) — `pError` is non-fatal; on
		 * failure we keep the seeded defaults (promiscuous) so the UI
		 * still renders.
		 */loadAuthStatus:function(fCallback){fetch(tmpConfig.StatusURL,{credentials:'include'}).then(pResp=>pResp.ok?pResp.json():Promise.reject(new Error('HTTP '+pResp.status))).then(pBody=>{_writeAuthState(pPict,tmpConfig,{Mode:pBody&&pBody.AuthMode==='authenticated'?'authenticated':'promiscuous',SupportsUserManagement:!!(pBody&&pBody.SupportsUserManagement),SessionChecked:false,Authenticated:false});if(typeof fCallback==='function'){fCallback(null,pBody);}}).catch(pErr=>{if(typeof fCallback==='function'){fCallback(pErr);}});},/**
		 * Convenience: navigate to the configured /Login route.  Hosts
		 * use this from their bootGate when /status reports authenticated
		 * mode + the section's CheckSessionOnLoad has not yet confirmed
		 * a valid cookie.
		 */navigateToLogin:function(){if(pPict.PictApplication&&typeof pPict.PictApplication.navigateTo==='function'){pPict.PictApplication.navigateTo(tmpConfig.LoginRoute);}else if(pPict.providers&&pPict.providers.PictRouter){pPict.providers.PictRouter.navigate(tmpConfig.LoginRoute);}},/** True iff the user is currently authenticated (per local state). */isAuthenticated:function(){let tmpState=_readAuthState(pPict,tmpConfig);return!!(tmpState&&tmpState.Authenticated);},/** Current cached AuthMode. */getAuthMode:function(){let tmpState=_readAuthState(pPict,tmpConfig);return tmpState&&tmpState.Mode||'promiscuous';},/** Direct accessor to the AppData auth state (for views/templates). */getAuthState:function(){return _readAuthState(pPict,tmpConfig);}};}// ────────────────────────────────────────────────────────────────────────
// Hooks fired by the section view
// ────────────────────────────────────────────────────────────────────────
function _afterLogin(pPict,pConfig,pSession){_writeAuthState(pPict,pConfig,Object.assign({},_readAuthState(pPict,pConfig)||{},{Authenticated:true,SessionChecked:true}));if(typeof pConfig.OnAfterLogin==='function'){try{pConfig.OnAfterLogin(pSession);}catch(pErr){_warn(pPict,pErr);}}_safeNavigate(pPict,pConfig,pConfig.HomeRoute);}function _afterLogout(pPict,pConfig){_writeAuthState(pPict,pConfig,Object.assign({},_readAuthState(pPict,pConfig)||{},{Authenticated:false}));if(typeof pConfig.OnAfterLogout==='function'){try{pConfig.OnAfterLogout();}catch(pErr){_warn(pPict,pErr);}}_safeNavigate(pPict,pConfig,pConfig.LoginRoute);}function _afterSessionChecked(pPict,pConfig,pSession){let tmpLoggedIn=!!(pSession&&pSession.LoggedIn);_writeAuthState(pPict,pConfig,Object.assign({},_readAuthState(pPict,pConfig)||{},{SessionChecked:true,Authenticated:tmpLoggedIn}));if(typeof pConfig.OnSessionChecked==='function'){try{pConfig.OnSessionChecked(pSession);}catch(pErr){_warn(pPict,pErr);}}// Only redirect away from the login view when the user is currently
// looking at it (boot gate forced them there) AND auth-mode is on
// (otherwise we have no business bouncing them anywhere).  We read
// mode from AppData rather than pConfig because the gate hydrates
// the state at runtime via loadAuthStatus().
let tmpState=_readAuthState(pPict,pConfig)||{};let tmpOnLogin=pPict.AppData&&pPict.AppData.CurrentView==='Login'||_currentHashRoute()===pConfig.LoginRoute||_currentHashRoute()==='/'+pConfig.LoginRoute;if(tmpLoggedIn&&tmpState.Mode==='authenticated'&&tmpOnLogin){_safeNavigate(pPict,pConfig,pConfig.HomeRoute);}}// ────────────────────────────────────────────────────────────────────────
// AppData address resolution
// ────────────────────────────────────────────────────────────────────────
function _readAuthState(pPict,pConfig){let tmpParts=String(pConfig.AuthStateAddress||'').split('.');let tmpCursor=pPict;for(let i=0;i<tmpParts.length;i++){if(!tmpCursor||typeof tmpCursor!=='object'){return null;}tmpCursor=tmpCursor[tmpParts[i]];}return tmpCursor||null;}function _writeAuthState(pPict,pConfig,pValue){let tmpParts=String(pConfig.AuthStateAddress||'').split('.');if(tmpParts.length===0){return;}let tmpCursor=pPict;for(let i=0;i<tmpParts.length-1;i++){let tmpKey=tmpParts[i];if(!tmpCursor[tmpKey]||typeof tmpCursor[tmpKey]!=='object'){tmpCursor[tmpKey]={};}tmpCursor=tmpCursor[tmpKey];}tmpCursor[tmpParts[tmpParts.length-1]]=pValue;}// ────────────────────────────────────────────────────────────────────────
// Misc
// ────────────────────────────────────────────────────────────────────────
function _safeNavigate(pPict,pConfig,pRoute){if(!pRoute){return;}if(pPict.PictApplication&&typeof pPict.PictApplication.navigateTo==='function'){pPict.PictApplication.navigateTo(pRoute);}else if(pPict.providers&&pPict.providers.PictRouter&&typeof pPict.providers.PictRouter.navigate==='function'){pPict.providers.PictRouter.navigate(pRoute);}}function _currentHashRoute(){if(typeof window==='undefined'||!window.location){return'';}let tmpHash=window.location.hash||'';if(tmpHash.charAt(0)==='#'){tmpHash=tmpHash.slice(1);}return tmpHash||'/';}function _warn(pPict,pErr){let tmpLog=pPict&&pPict.log||console;let tmpFn=tmpLog&&(tmpLog.warn||tmpLog.error)||console.warn;tmpFn('[Pict-Beacon-WebAuth-Client] hook threw: '+(pErr&&pErr.message||pErr));}module.exports={install};},{}],20:[function(require,module,exports){/**
 * Retold DataMapper — Dashboard Shell Pict Application
 *
 * One-view application that mounts pict-section-dashboard in `manage`
 * mode. Used by dashboards.html. The same section is also available
 * for embedding into other Pict applications (set Mode='render-only'
 * to hide the CRUD chrome and just render dashboards in place).
 */const libPictApplication=require('pict-application');const libSectionDashboard=require('./vendor/pict-section-dashboard/source/Pict-Section-Dashboard.js');const libSectionModal=require('pict-section-modal');const libLoginHelper=require('./_mapper-login-helper.js');class DashboardShellApplication extends libPictApplication{constructor(pFable,pOptions,pServiceHash){super(pFable,pOptions,pServiceHash);this.serviceType='DashboardShellApplication';// Modal/toast section — pict-section-dashboard uses it for delete
// confirmations and success toasts. Registering under the name
// 'Modal' matches the lookup pattern in the section
// (this.pict.views.Modal).
this.pict.addView('Modal',{},libSectionModal);this.pict.addView('Dashboards',Object.assign({},libSectionDashboard.default_configuration,{// pict-section-dashboard reads `ContentDestinationAddress`
// at render time (Pict-Section-Dashboard.js:155). Setting
// only DefaultDestinationAddress here was a no-op — the
// section fell back to '#Pict-Section-Dashboard' (the
// default) which doesn't exist in dashboards.html, so
// the page hung at the "Loading dashboards…" placeholder
// forever. Set both keys so consumers using either
// convention get the correct mount point.
ContentDestinationAddress:'#dashboard-section',DefaultDestinationAddress:'#dashboard-section',APIBaseUrl:'/mapper',Mode:'manage',ShowToolbar:true,AutoRender:true}),libSectionDashboard);// Beacon login overlay + boot-gate helper (shared across all
// data-mapper shells; see _mapper-login-helper.js).
libLoginHelper.install(this);}onAfterInitializeAsync(fCallback){// First render paints the section into #dashboard-section. The
// section's own onAfterRender takes over from there.
if(this.pict.views&&this.pict.views.Dashboards){this.pict.views.Dashboards.render();}libLoginHelper.gate(this);return super.onAfterInitializeAsync(fCallback);}}module.exports=DashboardShellApplication;},{"./_mapper-login-helper.js":26,"./vendor/pict-section-dashboard/source/Pict-Section-Dashboard.js":30,"pict-application":4,"pict-section-modal":16}],21:[function(require,module,exports){/**
 * Retold DataMapper — Pict Application
 *
 * Shell for the visual mapping editor. Registers the MapperAPI provider
 * and all views, seeds AppData, and renders the Layout view.
 */const libPictApplication=require('pict-application');const libMapperAPIProvider=require('./providers/Pict-Provider-MapperAPI.js');const libLoginHelper=require('./_mapper-login-helper.js');const libViewLayout=require('./views/PictView-Mapper-Layout.js');const libViewBeaconBrowser=require('./views/PictView-Mapper-BeaconBrowser.js');const libViewFieldMapper=require('./views/PictView-Mapper-FieldMapper.js');const libViewMappingList=require('./views/PictView-Mapper-MappingList.js');const libViewJSONEditor=require('./views/PictView-Mapper-JSONEditor.js');class DataMapperApplication extends libPictApplication{constructor(pFable,pOptions,pServiceHash){super(pFable,pOptions,pServiceHash);this.serviceType='DataMapperApplication';this.pict.addProvider('MapperAPI',libMapperAPIProvider.default_configuration,libMapperAPIProvider);this.pict.addView('Mapper-Layout',libViewLayout.default_configuration,libViewLayout);this.pict.addView('Mapper-BeaconBrowser',libViewBeaconBrowser.default_configuration,libViewBeaconBrowser);this.pict.addView('Mapper-FieldMapper',libViewFieldMapper.default_configuration,libViewFieldMapper);this.pict.addView('Mapper-MappingList',libViewMappingList.default_configuration,libViewMappingList);this.pict.addView('Mapper-JSONEditor',libViewJSONEditor.default_configuration,libViewJSONEditor);// Beacon login overlay + boot-gate helper.  Shared across every
// data-mapper shell; see _mapper-login-helper.js.
libLoginHelper.install(this);}onAfterInitializeAsync(fCallback){if(!this.pict.AppData)this.pict.AppData={};this.pict.AppData.Mapper={UltravisorURL:'',UltravisorStatus:'Disconnected',UltravisorStatusLabel:'Disconnected',UltravisorBadgeClass:'badge-neutral',Beacons:[],SourceBeacons:[],TargetBeacons:[],SourceBeaconName:'',SourceConnections:[],SourceConnectionID:null,SourceConnectionHash:'',SourceEntities:[],SourceEntity:'',SourceFields:[],TargetBeaconName:'',TargetConnections:[],TargetConnectionID:null,TargetConnectionHash:'',TargetEntities:[],TargetEntity:'',TargetFields:[],SelectedSourceField:'',Mappings:[],SavedMappings:[],ActivePanel:'mapper',// mapper | mappings | json
StatusMessage:'Ready',JSONText:''};if(typeof window!=='undefined')window.DataMapperApp=this;this.pict.views['Mapper-Layout'].render();// Boot gate: poll /status and overlay the login screen when UV
// is in authenticated mode.  Non-blocking — runs in parallel
// with the data loads below.
libLoginHelper.gate(this);let tmpProvider=this.pict.providers.MapperAPI;if(tmpProvider){tmpProvider.loadUltravisorStatus(()=>{tmpProvider.loadBeacons();tmpProvider.loadSavedMappings();});}return super.onAfterInitializeAsync(fCallback);}setActivePanel(pPanelName){if(this.pict.views['Mapper-Layout']&&typeof this.pict.views['Mapper-Layout'].setActivePanel==='function'){this.pict.views['Mapper-Layout'].setActivePanel(pPanelName);}}}module.exports=DataMapperApplication;module.exports.default_configuration={};},{"./_mapper-login-helper.js":26,"./providers/Pict-Provider-MapperAPI.js":27,"./views/PictView-Mapper-BeaconBrowser.js":40,"./views/PictView-Mapper-FieldMapper.js":41,"./views/PictView-Mapper-JSONEditor.js":42,"./views/PictView-Mapper-Layout.js":43,"./views/PictView-Mapper-MappingList.js":44,"pict-application":4}],22:[function(require,module,exports){/**
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
 */'use strict';const libPictApplication=require('pict-application');const libSectionMapping=require('./vendor/pict-section-mapping/source/Pict-Section-Mapping.js');const libSectionOperation=require('./vendor/pict-section-operation/source/Pict-Section-Operation.js');const libSectionDashboard=require('./vendor/pict-section-dashboard/source/Pict-Section-Dashboard.js');const libSectionModal=require('pict-section-modal');const libLayoutView=require('./views/PictView-MapperShell-Layout.js');const libTopNavView=require('./views/PictView-MapperShell-TopNav.js');const libConnectionsView=require('./views/PictView-MapperShell-Connections.js');const libLoginHelper=require('./_mapper-login-helper.js');const SCOPE_STORAGE_KEY='retold.dataMapper.activeScope';const _DefaultConfiguration={Name:'MapperShell',MainViewportViewIdentifier:'MapperShell-Layout',MainViewportRenderableHash:'MapperShell-Layout-Renderable',MainViewportDestinationAddress:'#MapperShell',AutoSolveAfterInitialize:true,AutoRenderMainViewportViewAfterInitialize:true};class MapperShellApplication extends libPictApplication{constructor(pFable,pOptions,pServiceHash){let tmpOptions=Object.assign({},_DefaultConfiguration,pOptions||{});super(pFable,tmpOptions,pServiceHash);this.serviceType='MapperShellApplication';this._seedAppData();// Modal first — sections look it up under 'Pict-Section-Modal' or 'Modal'.
this.pict.addView('Modal',{},libSectionModal);// Layout, top-nav, and connections placeholder.
this.pict.addView('MapperShell-Layout',libLayoutView.default_configuration,libLayoutView);this.pict.addView('MapperShell-TopNav',libTopNavView.default_configuration,libTopNavView);this.pict.addView('MapperShell-Connections',libConnectionsView.default_configuration,libConnectionsView);// Three sections — each pointed at its own destination div within the layout.
// Same shared scope (read from localStorage) so the picker in the top-nav
// hits all of them at once.
// Section configs read DefaultDestinationAddress as the view-level
// destination; ContentDestinationAddress is a per-renderable concept
// and is a no-op at this level. Setting only the right key keeps
// the override surface honest.
this.pict.addView('Pict-Section-Mapping',Object.assign({},libSectionMapping.default_configuration,{DefaultDestinationAddress:'#MapperShell-Mappings',APIBaseUrl:'/mapper',Mode:'manage',ShowToolbar:false,// shell owns the scope picker
AutoRender:false}),libSectionMapping);this.pict.addView('Pict-Section-Operation',Object.assign({},libSectionOperation.default_configuration,{DefaultDestinationAddress:'#MapperShell-Operations',APIBaseUrl:'/mapper',Mode:'manage',ShowToolbar:false,AutoRender:false}),libSectionOperation);this.pict.addView('Pict-Section-Dashboard',Object.assign({},libSectionDashboard.default_configuration,{DefaultDestinationAddress:'#MapperShell-Dashboards',APIBaseUrl:'/mapper',Mode:'manage',ShowToolbar:false,AutoRender:false}),libSectionDashboard);// Beacon login overlay + boot-gate (shared with the other
// data-mapper shells; see _mapper-login-helper.js).
libLoginHelper.install(this);}_seedAppData(){if(!this.pict.AppData)this.pict.AppData={};this.pict.AppData.MapperShell={ActiveTab:'mappings',// start on Mappings (most-used surface)
Scope:this._readScope(),Tabs:[]};}_readScope(){try{if(typeof localStorage!=='undefined'){let tmpStored=localStorage.getItem(SCOPE_STORAGE_KEY);if(tmpStored!==null)return tmpStored;}}catch(pErr){/* opaque origin — fall through */}return'';}_writeScope(pScope){try{if(typeof localStorage!=='undefined'){if(pScope)localStorage.setItem(SCOPE_STORAGE_KEY,pScope);else localStorage.removeItem(SCOPE_STORAGE_KEY);}}catch(pErr){/* opaque origin — keep in-memory only */}}// ── Lifecycle ────────────────────────────────────────────────────
// Called by the layout view's onAfterRender (the only point at which
// the destination divs are guaranteed to be in the DOM). The
// application's own onAfterInitializeAsync fires *before* the
// main-viewport auto-render lands, so wiring children here instead.
renderChildren(){if(this.pict.views['MapperShell-TopNav'])this.pict.views['MapperShell-TopNav'].render();this._renderActiveSection();// Boot gate runs once layout children are guaranteed in the DOM
// — same timing as the section renders, which means the overlay
// will stack on top of whatever finished painting just before.
libLoginHelper.gate(this);}// ── Public API (called from inline handlers in TopNav) ───────────
selectTab(pKey){this.pict.AppData.MapperShell.ActiveTab=pKey;// Re-render the layout so its `data-active-tab` attribute updates
// (CSS uses it to swap which pane is visible). Then re-render
// the top-nav so the active tab styling flips. Finally trigger
// the active section's render in case it hasn't loaded yet.
if(this.pict.views['MapperShell-Layout'])this.pict.views['MapperShell-Layout'].render();if(this.pict.views['MapperShell-TopNav'])this.pict.views['MapperShell-TopNav'].render();this._renderActiveSection();}onScopeInput(pValue){let tmpValue=pValue==null?'':String(pValue).trim();this.pict.AppData.MapperShell.Scope=tmpValue;this._writeScope(tmpValue);// Push scope into each section's API provider, then re-render
// whichever sections have already loaded so they reflect the new
// scope's data.
this._pushScopeIntoSections(tmpValue);this._renderActiveSection();}_pushScopeIntoSections(pScope){let tmpKeys=['Pict-Section-Mapping','Pict-Section-Operation','Pict-Section-Dashboard'];for(let i=0;i<tmpKeys.length;i++){let tmpView=this.pict.views[tmpKeys[i]];if(tmpView&&tmpView._API&&typeof tmpView._API.setScope==='function'){tmpView._API.setScope(pScope);}}}_renderActiveSection(){let tmpActive=this.pict.AppData.MapperShell.ActiveTab;let tmpView=null;switch(tmpActive){case'connections':tmpView=this.pict.views['MapperShell-Connections'];break;case'mappings':tmpView=this.pict.views['Pict-Section-Mapping'];break;case'operations':tmpView=this.pict.views['Pict-Section-Operation'];break;case'dashboards':tmpView=this.pict.views['Pict-Section-Dashboard'];break;}if(tmpView&&typeof tmpView.render==='function')tmpView.render();}}module.exports=MapperShellApplication;module.exports.default_configuration=_DefaultConfiguration;},{"./_mapper-login-helper.js":26,"./vendor/pict-section-dashboard/source/Pict-Section-Dashboard.js":30,"./vendor/pict-section-mapping/source/Pict-Section-Mapping.js":34,"./vendor/pict-section-operation/source/Pict-Section-Operation.js":38,"./views/PictView-MapperShell-Connections.js":45,"./views/PictView-MapperShell-Layout.js":46,"./views/PictView-MapperShell-TopNav.js":47,"pict-application":4,"pict-section-modal":16}],23:[function(require,module,exports){/**
 * Retold DataMapper — Mapping Shell Pict Application
 *
 * One-view application that mounts pict-section-mapping in `manage`
 * mode. Used by mappings.html. The visual field-mapping editor lives
 * separately at index.html (DataMapperApplication); this shell is the
 * lightweight CRUD-and-Run surface.
 */const libPictApplication=require('pict-application');const libSectionMapping=require('./vendor/pict-section-mapping/source/Pict-Section-Mapping.js');const libSectionModal=require('pict-section-modal');const libLoginHelper=require('./_mapper-login-helper.js');class MappingShellApplication extends libPictApplication{constructor(pFable,pOptions,pServiceHash){super(pFable,pOptions,pServiceHash);this.serviceType='MappingShellApplication';this.pict.addView('Modal',{},libSectionModal);this.pict.addView('Mappings',Object.assign({},libSectionMapping.default_configuration,{// Section reads `DefaultDestinationAddress` (per its
// default config). Setting `ContentDestinationAddress`
// here was a quiet no-op — section kept mounting at its
// default `#Pict-Section-Mapping` element which the page
// HTML doesn't have, so the "Loading mappings…"
// placeholder in `#mapping-section` never got replaced.
DefaultDestinationAddress:'#mapping-section',APIBaseUrl:'/mapper',Mode:'manage',ShowToolbar:true,AutoRender:true}),libSectionMapping);libLoginHelper.install(this);}onAfterInitializeAsync(fCallback){if(this.pict.views&&this.pict.views.Mappings){this.pict.views.Mappings.render();}libLoginHelper.gate(this);return super.onAfterInitializeAsync(fCallback);}}module.exports=MappingShellApplication;},{"./_mapper-login-helper.js":26,"./vendor/pict-section-mapping/source/Pict-Section-Mapping.js":34,"pict-application":4,"pict-section-modal":16}],24:[function(require,module,exports){/**
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
 */const libPictApplication=require('pict-application');const libSectionOperation=require('./vendor/pict-section-operation/source/Pict-Section-Operation.js');const libSectionModal=require('pict-section-modal');const libLoginHelper=require('./_mapper-login-helper.js');class OperationShellApplication extends libPictApplication{constructor(pFable,pOptions,pServiceHash){super(pFable,pOptions,pServiceHash);this.serviceType='OperationShellApplication';this.pict.addView('Modal',{},libSectionModal);this.pict.addView('Pict-Section-Operation',Object.assign({},libSectionOperation.default_configuration,{DefaultDestinationAddress:'#operation-section',APIBaseUrl:'/mapper',Mode:'manage',ShowToolbar:true,AutoRender:true}),libSectionOperation);libLoginHelper.install(this);}onAfterInitializeAsync(fCallback){if(this.pict.views&&this.pict.views['Pict-Section-Operation']){this.pict.views['Pict-Section-Operation'].render();}libLoginHelper.gate(this);return super.onAfterInitializeAsync(fCallback);}}module.exports=OperationShellApplication;},{"./_mapper-login-helper.js":26,"./vendor/pict-section-operation/source/Pict-Section-Operation.js":38,"pict-application":4,"pict-section-modal":16}],25:[function(require,module,exports){/**
 * Retold DataMapper — Browser Bundle Entry
 *
 * Quackage (browserify) processes this file to produce retold-data-mapper.js.
 */let libPictApplication=require('pict-application');let libPictView=require('pict-view');let libDataMapperApplication=require('./Pict-Application-DataMapper.js');let libMapperAPIProvider=require('./providers/Pict-Provider-MapperAPI.js');let libViewLayout=require('./views/PictView-Mapper-Layout.js');let libViewBeaconBrowser=require('./views/PictView-Mapper-BeaconBrowser.js');let libViewFieldMapper=require('./views/PictView-Mapper-FieldMapper.js');let libViewMappingList=require('./views/PictView-Mapper-MappingList.js');let libViewJSONEditor=require('./views/PictView-Mapper-JSONEditor.js');// Embeddable Pict-section views — bundled here so standalone shell
// pages (dashboards.html, mappings.html, operations.html) can mount
// them, and so any "ENHANCE another product" host that consumes this
// bundle gets the sections via the global names below.
let libSectionDashboard=require('./vendor/pict-section-dashboard/source/Pict-Section-Dashboard.js');let libSectionMapping=require('./vendor/pict-section-mapping/source/Pict-Section-Mapping.js');let libSectionOperation=require('./vendor/pict-section-operation/source/Pict-Section-Operation.js');let libDashboardShellApp=require('./Pict-Application-DashboardShell.js');let libMappingShellApp=require('./Pict-Application-MappingShell.js');let libOperationShellApp=require('./Pict-Application-OperationShell.js');let libMapperShellApp=require('./Pict-Application-MapperShell.js');window.DataMapperApplication=libDataMapperApplication;window.PictSectionDashboard=libSectionDashboard;window.PictSectionMapping=libSectionMapping;window.PictSectionOperation=libSectionOperation;window.DashboardShellApplication=libDashboardShellApp;window.MappingShellApplication=libMappingShellApp;window.OperationShellApplication=libOperationShellApp;window.MapperShellApplication=libMapperShellApp;},{"./Pict-Application-DashboardShell.js":20,"./Pict-Application-DataMapper.js":21,"./Pict-Application-MapperShell.js":22,"./Pict-Application-MappingShell.js":23,"./Pict-Application-OperationShell.js":24,"./providers/Pict-Provider-MapperAPI.js":27,"./vendor/pict-section-dashboard/source/Pict-Section-Dashboard.js":30,"./vendor/pict-section-mapping/source/Pict-Section-Mapping.js":34,"./vendor/pict-section-operation/source/Pict-Section-Operation.js":38,"./views/PictView-Mapper-BeaconBrowser.js":40,"./views/PictView-Mapper-FieldMapper.js":41,"./views/PictView-Mapper-JSONEditor.js":42,"./views/PictView-Mapper-Layout.js":43,"./views/PictView-Mapper-MappingList.js":44,"pict-application":4,"pict-view":18}],26:[function(require,module,exports){/**
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
 */const libPictView=require('pict-view');const libPictSectionLogin=require('pict-section-login');const libBeaconWebAuthClient=require('ultravisor-beacon/webinterface/Pict-Beacon-WebAuth-Client.js');const _LoginViewConfig={ViewIdentifier:'DataMapper-Login',AutoInitialize:true,AutoRender:false,DefaultRenderable:'DataMapper-Login-Overlay',DefaultDestinationAddress:'#DataMapper-Login-Overlay',Templates:[{Hash:'DataMapper-Login-Overlay-Template',Template:/*html*/`<div class="data-mapper-login-overlay-card"><div id="Pict-Login-Container"></div></div>`}],Renderables:[{RenderableHash:'DataMapper-Login-Overlay',TemplateHash:'DataMapper-Login-Overlay-Template',ContentDestinationAddress:'#DataMapper-Login-Overlay',RenderMethod:'replace'}],CSS:/*css*/`
		#DataMapper-Login-Overlay
		{
			position: fixed; inset: 0; z-index: 9999; display: none;
			background: rgba(15, 19, 26, 0.92);
			align-items: center; justify-content: center; padding: 24px; overflow: auto;
		}
		#DataMapper-Login-Overlay.is-active { display: flex; }
		.data-mapper-login-overlay-card { width: 100%; max-width: 420px; }
	`};class DataMapperLoginView extends libPictView{onAfterRender(pRenderable,pAddress,pRecord,pContent){let tmpInner=this.pict&&this.pict.views&&this.pict.views['Pict-Section-Login'];if(tmpInner){tmpInner.render();}this.pict.CSSMap.injectCSS();return super.onAfterRender?super.onAfterRender(pRenderable,pAddress,pRecord,pContent):undefined;}}function _ensureOverlayMount(){if(typeof document==='undefined'){return;}if(document.getElementById('DataMapper-Login-Overlay')){return;}let tmpDiv=document.createElement('div');tmpDiv.id='DataMapper-Login-Overlay';document.body.appendChild(tmpDiv);}function _show(){let tmpEl=typeof document!=='undefined'&&document.getElementById('DataMapper-Login-Overlay');if(tmpEl){tmpEl.classList.add('is-active');}}function _hide(){let tmpEl=typeof document!=='undefined'&&document.getElementById('DataMapper-Login-Overlay');if(tmpEl){tmpEl.classList.remove('is-active');}}/**
 * Register the login wrapper view + pict-section-login + the boot-gate
 * client helper on the given Pict application's `pict` instance.  Stores
 * the helper handle on the app as `_WebAuthClient` so `gate()` can call
 * loadAuthStatus on it later.  Idempotent per Pict instance (registers
 * the views only once).
 */function install(pApp){if(!pApp||!pApp.pict){return;}let tmpPict=pApp.pict;if(!tmpPict.views||!tmpPict.views['DataMapper-Login']){tmpPict.addView('DataMapper-Login',_LoginViewConfig,DataMapperLoginView);}pApp._WebAuthClient=libBeaconWebAuthClient.install(tmpPict,{Section:libPictSectionLogin,AuthStateAddress:'AppData.DataMapper.Auth',LoginRoute:'DataMapper-Login',HomeRoute:'',StatusURL:'/status',LoginEndpoint:'/1.0/Authenticate',LogoutEndpoint:'/1.0/Deauthenticate',CheckSessionEndpoint:'/1.0/CheckSession',OnAfterLogin:()=>_hide(),OnAfterLogout:()=>_show(),OnSessionChecked:pSess=>{if(!(pSess&&pSess.LoggedIn)){_show();}else{_hide();}}});}/**
 * Mount the overlay container, fetch /status, and show the overlay
 * when UV is in authenticated mode.  Calls fCallback (may be omitted)
 * once the status fetch resolves.
 */function gate(pApp,fCallback){_ensureOverlayMount();if(!pApp||!pApp._WebAuthClient){if(typeof fCallback==='function'){fCallback(null);}return;}pApp._WebAuthClient.loadAuthStatus(pErr=>{if(pErr&&pApp.pict&&pApp.pict.log){pApp.pict.log.warn('[DataMapper login] /status fetch failed: '+pErr.message);}let tmpAuth=pApp.pict.AppData.DataMapper&&pApp.pict.AppData.DataMapper.Auth||{};if(tmpAuth.Mode==='authenticated'){_show();let tmpLoginView=pApp.pict.views['DataMapper-Login'];if(tmpLoginView){tmpLoginView.render();}}if(typeof fCallback==='function'){fCallback(null);}});}module.exports={install,gate};},{"pict-section-login":6,"pict-view":18,"ultravisor-beacon/webinterface/Pict-Beacon-WebAuth-Client.js":19}],27:[function(require,module,exports){/**
 * Retold DataMapper — API Provider
 *
 * Calls the DataMapper's own REST API at /mapper/* and stores results in
 * AppData. The server-side dispatches foreign-beacon calls through the
 * Ultravisor mesh, so this provider never has to know about mesh routing.
 */const libPictProvider=require('pict-view');class MapperAPIProvider extends libPictProvider{constructor(pFable,pOptions,pServiceHash){super(pFable,pOptions,pServiceHash);this.serviceType='MapperAPIProvider';}_apiCall(pMethod,pPath,pBody,fCallback){let tmpOptions={method:pMethod,headers:{'Content-Type':'application/json'}};if(pBody&&pMethod!=='GET'){tmpOptions.body=JSON.stringify(pBody);}fetch(pPath,tmpOptions).then(pResponse=>pResponse.json()).then(pData=>{if(fCallback)fCallback(null,pData);}).catch(pError=>{if(fCallback)fCallback(pError);});}// ── Ultravisor ──────────────────────────────────────────
loadUltravisorStatus(fCallback){this._apiCall('GET','/mapper/ultravisor/status',null,(pError,pData)=>{if(!pError&&pData){this._applyUltravisorStatus(pData);}this._renderLayout();if(fCallback)fCallback(pError,pData);});}connectUltravisor(pURL,pBeaconName,fCallback){this._apiCall('POST','/mapper/ultravisor/connect',{URL:pURL,BeaconName:pBeaconName||'retold-data-mapper'},(pError,pData)=>{if(!pError&&pData){this._applyUltravisorStatus(pData);}this._renderLayout();if(!pError&&pData&&pData.Success){this.loadBeacons();}if(fCallback)fCallback(pError,pData);});}disconnectUltravisor(fCallback){this._apiCall('POST','/mapper/ultravisor/disconnect',null,(pError,pData)=>{this.pict.AppData.Mapper.UltravisorStatus='Disconnected';this.pict.AppData.Mapper.UltravisorStatusLabel='Disconnected';this.pict.AppData.Mapper.UltravisorBadgeClass='badge-neutral';this.pict.AppData.Mapper.Beacons=[];this.pict.AppData.Mapper.SourceBeacons=[];this.pict.AppData.Mapper.TargetBeacons=[];this._renderLayout();this._renderBeaconBrowser();if(fCallback)fCallback(pError,pData);});}_applyUltravisorStatus(pData){let tmpStatus=pData.Status||(pData.Connected?'Connected':'Disconnected');let tmpLabel=tmpStatus;let tmpBadge='badge-neutral';if(pData.Connected){tmpBadge='badge-success';}else if(tmpStatus==='Failed'){tmpBadge='badge-error';}this.pict.AppData.Mapper.UltravisorStatus=tmpStatus;this.pict.AppData.Mapper.UltravisorStatusLabel=tmpLabel;this.pict.AppData.Mapper.UltravisorBadgeClass=tmpBadge;this.pict.AppData.Mapper.UltravisorURL=pData.URL||this.pict.AppData.Mapper.UltravisorURL;}// ── Beacons ─────────────────────────────────────────────
loadBeacons(fCallback){this._apiCall('GET','/mapper/beacons',null,(pError,pData)=>{if(!pError&&pData){this.pict.AppData.Mapper.Beacons=pData.Beacons||[];this._recomputeBeaconOptions();}this._renderBeaconBrowser();if(fCallback)fCallback(pError,pData);});}loadSourceConnections(pBeaconName,fCallback){this.pict.AppData.Mapper.SourceBeaconName=pBeaconName;this.pict.AppData.Mapper.SourceConnections=[];this.pict.AppData.Mapper.SourceConnectionID=null;this.pict.AppData.Mapper.SourceConnectionHash='';this.pict.AppData.Mapper.SourceEntities=[];this.pict.AppData.Mapper.SourceEntity='';this.pict.AppData.Mapper.SourceFields=[];if(!pBeaconName){this._recomputeBeaconOptions();this._renderBeaconBrowser();this._renderFieldMapper();if(fCallback)fCallback();return;}this._apiCall('GET',`/mapper/beacon/${encodeURIComponent(pBeaconName)}/connections`,null,(pError,pData)=>{if(!pError&&pData){this.pict.AppData.Mapper.SourceConnections=pData.Connections||[];}this._recomputeBeaconOptions();this._renderBeaconBrowser();this._renderFieldMapper();if(fCallback)fCallback(pError,pData);});}loadTargetConnections(pBeaconName,fCallback){this.pict.AppData.Mapper.TargetBeaconName=pBeaconName;this.pict.AppData.Mapper.TargetConnections=[];this.pict.AppData.Mapper.TargetConnectionID=null;this.pict.AppData.Mapper.TargetConnectionHash='';this.pict.AppData.Mapper.TargetEntities=[];this.pict.AppData.Mapper.TargetEntity='';this.pict.AppData.Mapper.TargetFields=[];if(!pBeaconName){this._recomputeBeaconOptions();this._renderBeaconBrowser();this._renderFieldMapper();if(fCallback)fCallback();return;}this._apiCall('GET',`/mapper/beacon/${encodeURIComponent(pBeaconName)}/connections`,null,(pError,pData)=>{if(!pError&&pData){this.pict.AppData.Mapper.TargetConnections=pData.Connections||[];}this._recomputeBeaconOptions();this._renderBeaconBrowser();this._renderFieldMapper();if(fCallback)fCallback(pError,pData);});}introspectSource(pIDBeaconConnection,fCallback){let tmpBeaconName=this.pict.AppData.Mapper.SourceBeaconName;if(!tmpBeaconName||!pIDBeaconConnection){if(fCallback)fCallback(new Error('beacon + id required'));return;}this.pict.AppData.Mapper.SourceConnectionID=pIDBeaconConnection;let tmpConn=this._findConnection(this.pict.AppData.Mapper.SourceConnections,pIDBeaconConnection);this.pict.AppData.Mapper.SourceConnectionHash=this._slugify(tmpConn?tmpConn.Name:'');this._apiCall('POST',`/mapper/beacon/${encodeURIComponent(tmpBeaconName)}/introspect`,{IDBeaconConnection:pIDBeaconConnection},(pError,pData)=>{if(!pError&&pData){this.pict.AppData.Mapper.SourceEntities=pData.Tables||[];if(pData.ConnectionHash){this.pict.AppData.Mapper.SourceConnectionHash=pData.ConnectionHash;}}this._recomputeBeaconOptions();this._renderBeaconBrowser();if(fCallback)fCallback(pError,pData);});}introspectTarget(pIDBeaconConnection,fCallback){let tmpBeaconName=this.pict.AppData.Mapper.TargetBeaconName;if(!tmpBeaconName||!pIDBeaconConnection){if(fCallback)fCallback(new Error('beacon + id required'));return;}this.pict.AppData.Mapper.TargetConnectionID=pIDBeaconConnection;let tmpConn=this._findConnection(this.pict.AppData.Mapper.TargetConnections,pIDBeaconConnection);this.pict.AppData.Mapper.TargetConnectionHash=this._slugify(tmpConn?tmpConn.Name:'');this._apiCall('POST',`/mapper/beacon/${encodeURIComponent(tmpBeaconName)}/introspect`,{IDBeaconConnection:pIDBeaconConnection},(pError,pData)=>{if(!pError&&pData){this.pict.AppData.Mapper.TargetEntities=pData.Tables||[];if(pData.ConnectionHash){this.pict.AppData.Mapper.TargetConnectionHash=pData.ConnectionHash;}}this._recomputeBeaconOptions();this._renderBeaconBrowser();if(fCallback)fCallback(pError,pData);});}setSourceEntity(pEntityName){this.pict.AppData.Mapper.SourceEntity=pEntityName;let tmpEntity=this._findEntity(this.pict.AppData.Mapper.SourceEntities,pEntityName);this.pict.AppData.Mapper.SourceFields=this._extractFields(tmpEntity);this._recomputeBeaconOptions();this._renderBeaconBrowser();this._renderFieldMapper();}setTargetEntity(pEntityName){this.pict.AppData.Mapper.TargetEntity=pEntityName;let tmpEntity=this._findEntity(this.pict.AppData.Mapper.TargetEntities,pEntityName);this.pict.AppData.Mapper.TargetFields=this._extractFields(tmpEntity);this._recomputeBeaconOptions();this._renderBeaconBrowser();this._renderFieldMapper();}// ── Mappings ────────────────────────────────────────────
selectSourceField(pFieldName){let tmpCurrent=this.pict.AppData.Mapper.SelectedSourceField;this.pict.AppData.Mapper.SelectedSourceField=tmpCurrent===pFieldName?'':pFieldName;this._renderFieldMapper();}addMapping(pSource,pTarget){if(!pSource||!pTarget){return;}let tmpMappings=this.pict.AppData.Mapper.Mappings||[];tmpMappings=tmpMappings.filter(pM=>pM.Target!==pTarget);tmpMappings.push({Source:pSource,Target:pTarget});this.pict.AppData.Mapper.Mappings=tmpMappings;this.pict.AppData.Mapper.SelectedSourceField='';this._regenerateJSON();this._renderFieldMapper();}removeMapping(pIndex){let tmpMappings=this.pict.AppData.Mapper.Mappings||[];tmpMappings.splice(pIndex,1);this.pict.AppData.Mapper.Mappings=tmpMappings;this._regenerateJSON();this._renderFieldMapper();}clearMappings(){this.pict.AppData.Mapper.Mappings=[];this.pict.AppData.Mapper.SelectedSourceField='';this._regenerateJSON();this._renderFieldMapper();}// ── Saved MappingConfigs (CRUD against our own SQLite) ──
loadSavedMappings(fCallback){this._apiCall('GET','/mapper/mappings',null,(pError,pData)=>{if(!pError&&pData){this.pict.AppData.Mapper.SavedMappings=pData.Mappings||[];}this._renderMappingList();if(fCallback)fCallback(pError,pData);});}saveMapping(fCallback){let tmpState=this.pict.AppData.Mapper;let tmpConfig=this._buildMappingConfiguration();let tmpBody={Name:tmpState.TargetEntity?`${tmpState.SourceEntity||'source'} → ${tmpState.TargetEntity}`:'Untitled Mapping',Description:'',SourceBeaconName:tmpState.SourceBeaconName,SourceConnectionHash:tmpState.SourceConnectionHash,SourceEntity:tmpState.SourceEntity,TargetBeaconName:tmpState.TargetBeaconName,TargetConnectionHash:tmpState.TargetConnectionHash,TargetEntity:tmpState.TargetEntity,MappingConfiguration:tmpConfig,FlowDiagramState:{}};this._apiCall('POST','/mapper/mappings',tmpBody,(pError,pData)=>{if(!pError&&pData&&pData.Success){this.pict.AppData.Mapper.StatusMessage='Mapping saved.';this.loadSavedMappings();}else{this.pict.AppData.Mapper.StatusMessage='Save failed.';}this._renderLayout();if(fCallback)fCallback(pError,pData);});}deleteSavedMapping(pID,fCallback){this._apiCall('DELETE',`/mapper/mapping/${pID}`,null,(pError,pData)=>{if(!pError){this.loadSavedMappings();}if(fCallback)fCallback(pError,pData);});}loadSavedMapping(pID,fCallback){this._apiCall('GET',`/mapper/mapping/${pID}`,null,(pError,pData)=>{if(!pError&&pData&&pData.Mapping){this._applySavedMapping(pData.Mapping);}if(fCallback)fCallback(pError,pData);});}_applySavedMapping(pRecord){let tmpState=this.pict.AppData.Mapper;tmpState.SourceBeaconName=pRecord.SourceBeaconName||'';tmpState.SourceConnectionHash=pRecord.SourceConnectionHash||'';tmpState.SourceEntity=pRecord.SourceEntity||'';tmpState.TargetBeaconName=pRecord.TargetBeaconName||'';tmpState.TargetConnectionHash=pRecord.TargetConnectionHash||'';tmpState.TargetEntity=pRecord.TargetEntity||'';let tmpConfig={};try{tmpConfig=JSON.parse(pRecord.MappingConfiguration||'{}');}catch(e){/* ignore */}tmpState.Mappings=this._mappingsFromConfig(tmpConfig);tmpState.JSONText=JSON.stringify(tmpConfig,null,'\t');tmpState.StatusMessage=`Loaded "${pRecord.Name}".`;tmpState.ActivePanel='mapper';// If source/target fields aren't loaded, derive placeholders from mappings
if(tmpState.SourceFields.length===0){let tmpSet={};tmpState.Mappings.forEach(pM=>{if(pM.Source)tmpSet[pM.Source]=true;});tmpState.SourceFields=Object.keys(tmpSet).map(pN=>({Name:pN,Type:''}));}if(tmpState.TargetFields.length===0){let tmpSet={};tmpState.Mappings.forEach(pM=>{if(pM.Target)tmpSet[pM.Target]=true;});tmpState.TargetFields=Object.keys(tmpSet).map(pN=>({Name:pN,Type:''}));}this._recomputeBeaconOptions();this._renderLayout();this._renderBeaconBrowser();this._renderFieldMapper();this._renderJSONEditor();}// ── JSON editor sync ────────────────────────────────────
applyJSONText(pText){let tmpParsed;try{tmpParsed=JSON.parse(pText);}catch(e){this.pict.AppData.Mapper.StatusMessage=`Invalid JSON: ${e.message}`;this._renderLayout();return false;}if(!tmpParsed||!tmpParsed.Mappings){this.pict.AppData.Mapper.StatusMessage='JSON must contain a "Mappings" object.';this._renderLayout();return false;}this.pict.AppData.Mapper.JSONText=JSON.stringify(tmpParsed,null,'\t');this.pict.AppData.Mapper.Mappings=this._mappingsFromConfig(tmpParsed);if(tmpParsed.Entity){this.pict.AppData.Mapper.TargetEntity=tmpParsed.Entity;}if(tmpParsed._meta){if(tmpParsed._meta.SourceBeacon)this.pict.AppData.Mapper.SourceBeaconName=tmpParsed._meta.SourceBeacon;if(tmpParsed._meta.SourceConnectionHash)this.pict.AppData.Mapper.SourceConnectionHash=tmpParsed._meta.SourceConnectionHash;if(tmpParsed._meta.TargetBeacon)this.pict.AppData.Mapper.TargetBeaconName=tmpParsed._meta.TargetBeacon;if(tmpParsed._meta.TargetConnectionHash)this.pict.AppData.Mapper.TargetConnectionHash=tmpParsed._meta.TargetConnectionHash;}this.pict.AppData.Mapper.StatusMessage=`Imported ${this.pict.AppData.Mapper.Mappings.length} mappings.`;this._renderLayout();this._renderBeaconBrowser();this._renderFieldMapper();return true;}// ── Helpers ─────────────────────────────────────────────
_buildMappingConfiguration(){let tmpState=this.pict.AppData.Mapper;let tmpMappings={};(tmpState.Mappings||[]).forEach(pM=>{tmpMappings[pM.Target]='{~D:Record.'+pM.Source+'~}';});let tmpEntity=tmpState.TargetEntity||'TargetEntity';return{Entity:tmpEntity,GUIDTemplate:'',GUIDName:'GUID'+tmpEntity,Mappings:tmpMappings,Solvers:[],_meta:{SourceBeacon:tmpState.SourceBeaconName,SourceConnectionHash:tmpState.SourceConnectionHash,SourceEntity:tmpState.SourceEntity,TargetBeacon:tmpState.TargetBeaconName,TargetConnectionHash:tmpState.TargetConnectionHash}};}_mappingsFromConfig(pConfig){let tmpMappings=[];let tmpSource=pConfig&&pConfig.Mappings?pConfig.Mappings:{};let tmpKeys=Object.keys(tmpSource);for(let i=0;i<tmpKeys.length;i++){let tmpTarget=tmpKeys[i];let tmpExpr=tmpSource[tmpTarget];let tmpMatch=typeof tmpExpr==='string'?tmpExpr.match(/^\{~D:Record\.(\w+)~\}$/):null;tmpMappings.push({Source:tmpMatch?tmpMatch[1]:String(tmpExpr),Target:tmpTarget});}return tmpMappings;}_regenerateJSON(){this.pict.AppData.Mapper.JSONText=JSON.stringify(this._buildMappingConfiguration(),null,'\t');}_slugify(pValue){return String(pValue||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}_findConnection(pConnections,pID){let tmpList=pConnections||[];for(let i=0;i<tmpList.length;i++){if(String(tmpList[i].IDBeaconConnection)===String(pID))return tmpList[i];}return null;}_findEntity(pEntities,pName){let tmpList=pEntities||[];for(let i=0;i<tmpList.length;i++){if(tmpList[i].TableName===pName)return tmpList[i];}return null;}_extractFields(pEntity){if(!pEntity)return[];let tmpCols=pEntity.Columns||[];let tmpFields=[];for(let i=0;i<tmpCols.length;i++){tmpFields.push({Name:tmpCols[i].Name||tmpCols[i].Column,Type:tmpCols[i].NativeType||tmpCols[i].MeadowType||''});}return tmpFields;}_recomputeBeaconOptions(){let tmpState=this.pict.AppData.Mapper;let tmpBeacons=tmpState.Beacons||[];tmpState.SourceBeacons=tmpBeacons.map(pB=>({Name:pB.Name,BeaconID:pB.BeaconID,SelectedAttr:pB.Name===tmpState.SourceBeaconName?'selected':''}));tmpState.TargetBeacons=tmpBeacons.map(pB=>({Name:pB.Name,BeaconID:pB.BeaconID,SelectedAttr:pB.Name===tmpState.TargetBeaconName?'selected':''}));tmpState.SourceConnectionsForTemplate=(tmpState.SourceConnections||[]).map(pC=>({IDBeaconConnection:pC.IDBeaconConnection,Name:pC.Name,Type:pC.Type,SelectedAttr:String(pC.IDBeaconConnection)===String(tmpState.SourceConnectionID)?'selected':''}));tmpState.TargetConnectionsForTemplate=(tmpState.TargetConnections||[]).map(pC=>({IDBeaconConnection:pC.IDBeaconConnection,Name:pC.Name,Type:pC.Type,SelectedAttr:String(pC.IDBeaconConnection)===String(tmpState.TargetConnectionID)?'selected':''}));tmpState.SourceEntitiesForTemplate=(tmpState.SourceEntities||[]).map(pE=>({TableName:pE.TableName,ColumnCount:(pE.Columns||[]).length,SelectedAttr:pE.TableName===tmpState.SourceEntity?'selected':''}));tmpState.TargetEntitiesForTemplate=(tmpState.TargetEntities||[]).map(pE=>({TableName:pE.TableName,ColumnCount:(pE.Columns||[]).length,SelectedAttr:pE.TableName===tmpState.TargetEntity?'selected':''}));}_renderLayout(){if(this.pict.views['Mapper-Layout'])this.pict.views['Mapper-Layout'].render();}_renderBeaconBrowser(){if(this.pict.views['Mapper-BeaconBrowser'])this.pict.views['Mapper-BeaconBrowser'].render();}_renderFieldMapper(){if(this.pict.views['Mapper-FieldMapper'])this.pict.views['Mapper-FieldMapper'].render();}_renderMappingList(){if(this.pict.views['Mapper-MappingList'])this.pict.views['Mapper-MappingList'].render();}_renderJSONEditor(){if(this.pict.views['Mapper-JSONEditor'])this.pict.views['Mapper-JSONEditor'].render();}}module.exports=MapperAPIProvider;module.exports.default_configuration={ProviderIdentifier:'MapperAPI',AutoInitialize:true,AutoRender:false};},{"pict-view":18}],28:[function(require,module,exports){/**
 * Pict-Section-Dashboard CSS
 *
 * All class names are prefixed with `psd-` (Pict Section Dashboard) so
 * the section can be mounted into any host application without bleeding
 * into the host's stylesheet. Colors are conservative defaults; the
 * host can override via CSS custom properties if it wants to re-theme.
 */'use strict';module.exports=`
.psd-root
{
	--psd-bg:           #0e1a2b;
	--psd-bg-elev:      #0a1525;
	--psd-bg-elev-2:    #0f172a;
	--psd-border:       #1e293b;
	--psd-border-soft:  #0f1c2f;
	--psd-fg:           #f8fafc;
	--psd-fg-soft:      #cbd5e1;
	--psd-fg-mute:      #94a3b8;
	--psd-fg-fade:      #64748b;
	--psd-accent:       #2563eb;
	--psd-accent-fg:    #ffffff;
	--psd-danger:       #b91c1c;
	--psd-danger-fg:    #fecaca;

	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	background: var(--psd-bg);
	color: var(--psd-fg);
	min-height: 100%;
}

.psd-toolbar
{
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 10px 16px;
	background: var(--psd-bg-elev);
	border-bottom: 1px solid var(--psd-border);
	flex-wrap: wrap;
}
.psd-toolbar h2 { margin: 0; font-size: 16px; font-weight: 600; }
.psd-toolbar .psd-toolbar-spacer { flex: 1; }
.psd-toolbar label { color: var(--psd-fg-mute); font-size: 12px; display: inline-flex; align-items: center; gap: 6px; }
.psd-toolbar input, .psd-toolbar select
{
	background: var(--psd-bg-elev-2);
	color: var(--psd-fg);
	border: 1px solid var(--psd-border);
	padding: 5px 9px;
	border-radius: 4px;
	font-size: 12px;
	font-family: inherit;
}
.psd-toolbar input[type=text].psd-scope-input
{
	width: 140px;
	font-family: monospace;
}
.psd-toolbar .psd-scope-hint { color: var(--psd-fg-fade); font-size: 11px; font-style: italic; }
.psd-btn
{
	background: var(--psd-bg-elev-2);
	color: var(--psd-fg-soft);
	border: 1px solid var(--psd-border);
	padding: 5px 11px;
	border-radius: 4px;
	font-size: 12px;
	cursor: pointer;
	text-decoration: none;
	display: inline-flex;
	align-items: center;
	gap: 4px;
}
.psd-btn:hover { background: #1e293b; color: var(--psd-fg); }
.psd-btn.psd-btn-primary { background: var(--psd-accent); border-color: var(--psd-accent); color: var(--psd-accent-fg); }
.psd-btn.psd-btn-primary:hover { background: var(--theme-color-brand-primary-hover, #1d4ed8); }
.psd-btn.psd-btn-danger { background: transparent; color: var(--psd-danger-fg); border-color: var(--psd-danger); }
.psd-btn.psd-btn-danger:hover { background: var(--psd-danger); color: var(--psd-accent-fg); }

.psd-content { padding: 16px; max-width: 1400px; margin: 0 auto; }

/* List view */
.psd-list { display: flex; flex-direction: column; gap: 8px; }
.psd-list-row
{
	display: grid;
	grid-template-columns: 1.5fr 2fr 100px auto;
	gap: 12px;
	padding: 12px 14px;
	background: var(--psd-bg-elev);
	border: 1px solid var(--psd-border);
	border-radius: 6px;
	align-items: center;
}
.psd-list-row .psd-row-hash { font-family: monospace; font-size: 13px; color: var(--psd-fg); font-weight: 600; }
.psd-list-row .psd-row-title { color: var(--psd-fg-soft); font-size: 13px; }
.psd-list-row .psd-row-scope { font-family: monospace; font-size: 11px; color: var(--psd-fg-mute); }
.psd-list-row .psd-row-scope.psd-scope-empty { color: var(--psd-fg-fade); font-style: italic; }
.psd-list-row .psd-row-actions { display: flex; gap: 6px; justify-content: flex-end; }

.psd-empty, .psd-error
{
	padding: 18px;
	text-align: center;
	color: var(--psd-fg-fade);
	font-size: 13px;
	border: 1px dashed var(--psd-border);
	border-radius: 6px;
	background: var(--psd-bg-elev);
}
.psd-error { color: #f87171; background: #2a1010; border-color: #2a1010; }

/* Editor */
.psd-editor { display: flex; flex-direction: column; gap: 14px; }
.psd-editor-header { display: flex; gap: 12px; align-items: center; }
.psd-editor-header h3 { margin: 0; font-size: 16px; }
.psd-editor-form { display: grid; grid-template-columns: 140px 1fr; gap: 10px 14px; align-items: center; }
.psd-editor-form label { color: var(--psd-fg-mute); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
.psd-editor-form input[type=text]
{
	background: var(--psd-bg-elev-2);
	color: var(--psd-fg);
	border: 1px solid var(--psd-border);
	padding: 6px 10px;
	border-radius: 4px;
	font-size: 13px;
	font-family: inherit;
}
.psd-editor-form .psd-help { color: var(--psd-fg-fade); font-size: 11px; font-style: italic; }
.psd-editor-form textarea
{
	background: var(--psd-bg-elev-2);
	color: var(--psd-fg);
	border: 1px solid var(--psd-border);
	padding: 8px 10px;
	border-radius: 4px;
	font-size: 12px;
	font-family: monospace;
	min-height: 280px;
	resize: vertical;
	width: 100%;
	box-sizing: border-box;
}
.psd-editor-actions { display: flex; gap: 8px; justify-content: flex-end; }
.psd-editor-error { color: #f87171; font-size: 12px; padding: 8px 12px; background: #2a1010; border-radius: 4px; }

/* Renderer */
.psd-render-title { font-size: 22px; margin: 0 0 4px 0; }
.psd-render-meta { color: var(--psd-fg-mute); font-size: 12px; margin: 0 0 18px 0; }
.psd-layout-column { display: flex; flex-direction: column; gap: 14px; }
.psd-layout-row { display: flex; flex-direction: row; gap: 14px; flex-wrap: wrap; }
.psd-layout-row > * { flex: 1; min-width: 320px; }
.psd-panel
{
	background: var(--psd-bg-elev);
	border: 1px solid var(--psd-border);
	border-radius: 6px;
	padding: 14px;
}
.psd-panel-title { font-size: 14px; font-weight: 600; margin: 0 0 10px 0; color: var(--psd-fg-soft); }
.psd-panel-meta { font-size: 11px; color: var(--psd-fg-fade); margin-bottom: 6px; }
table.psd-panel-table { width: 100%; border-collapse: collapse; font-size: 13px; }
table.psd-panel-table th
{
	text-align: left; padding: 7px 9px; border-bottom: 1px solid var(--psd-border);
	color: var(--psd-fg-mute); font-weight: 500; text-transform: uppercase; font-size: 11px;
}
table.psd-panel-table td { padding: 7px 9px; border-bottom: 1px solid var(--psd-border-soft); color: #e2e8f0; }
table.psd-panel-table tr:hover td { background: var(--psd-border-soft); }
.psd-pager { display: flex; gap: 8px; margin-top: 10px; align-items: center; font-size: 12px; }
.psd-pager .psd-pager-label { color: var(--psd-fg-mute); }

/* Section variants */
.psd-mode-render-only .psd-toolbar { padding: 8px 14px; }
.psd-mode-render-only .psd-list-row .psd-row-actions { display: none; }
`;},{}],29:[function(require,module,exports){/**
 * Pict-Section-Dashboard default configuration.
 *
 * Host applications override these via the options object passed to
 * pict.addView(...). Most useful overrides:
 *
 *   ContentDestinationAddress  CSS selector where the section mounts
 *   APIBaseUrl                 prefix for /dashboards, /dashboard/:hash, etc.
 *   Mode                       'manage' (default) or 'render-only'
 *   InitialDashboardHash       open this dashboard immediately (else show list)
 *   ShowToolbar                false to hide the section's own toolbar
 *                              (use when the host wants to drive scope itself)
 *   Scope                      pin to a specific scope, ignoring localStorage
 */'use strict';module.exports={ViewIdentifier:'Pict-Section-Dashboard',DefaultRenderable:'Pict-Section-Dashboard-Shell',DefaultDestinationAddress:'#Pict-Section-Dashboard',AutoRender:true,APIBaseUrl:'/mapper',Mode:'manage',InitialDashboardHash:null,ShowToolbar:true,Scope:null,// null = read from localStorage; '' = global; '<value>' = pinned
WriteToken:null,// bearer token for POST/PUT/DELETE when DATA_MAPPER_WRITE_TOKEN is set on the server
ListPageSize:25,// default panel paging when not specified by Layout
ListCompactRows:10// default cap for list-compact panels
};},{}],30:[function(require,module,exports){/**
 * Pict-Section-Dashboard
 *
 * An embeddable Pict view that provides:
 *   - a list of dashboards in the active scope (with new/edit/delete),
 *   - a layout-driven dashboard renderer (paged list and compact list
 *     panels, nested row/column containers), and
 *   - a JSON-form editor for the dashboard record itself.
 *
 * Two modes:
 *
 *   `manage`       full CRUD UI; this is the default and is meant for the
 *                  data-mapper "Dashboards" surface where dashboards ARE
 *                  the product.
 *
 *   `render-only`  no CRUD; the section just lists and renders. Use this
 *                  when embedding into another product where dashboards
 *                  are an enhancement rather than the main thing.
 *
 * Mounting:
 *
 *   const libDashboard = require('pict-section-dashboard');
 *   pict.addView(
 *     'Dashboards',
 *     {
 *       ContentDestinationAddress: '#my-dashboard-mount',
 *       APIBaseUrl: '/mapper',
 *       Mode: 'manage'
 *     },
 *     libDashboard);
 *
 * The view paints its toolbar + content into the destination element
 * via direct DOM manipulation (not Pict templates) because dashboard
 * layouts are arbitrary nested JSON and don't fit the template-engine
 * iteration model. State + lifecycle are still Pict-managed.
 *
 * **Documented exception to modules/pict/CLAUDE.md template conventions.**
 * The recursive layout dispatch (rows containing columns containing rows
 * containing panels — arbitrary depth) doesn't compose cleanly with the
 * `{~TS:RowTemplate:Address~}` iteration model, which has no recursive
 * "render this same template against my children" idiom. CLAUDE.md
 * explicitly allows legitimate exceptions; this is one. The toolbar /
 * list / editor sub-views could be template-driven (parallel to
 * pict-section-operation and pict-section-mapping); a follow-up refactor
 * may carve those out while keeping the panel-layout dispatcher imperative.
 */'use strict';const libPictView=require('pict-view');const libDefaultConf=require('./Pict-Section-Dashboard-DefaultConfiguration.js');const libCSS=require('./Pict-Section-Dashboard-CSS.js');const libAPIProvider=require('./providers/PictProvider-Dashboard-API.js');class PictSectionDashboard extends libPictView{constructor(pFable,pOptions,pServiceHash){let tmpOptions=Object.assign({},libDefaultConf,pOptions||{});super(pFable,tmpOptions,pServiceHash);this._API=new libAPIProvider({APIBaseUrl:this.options.APIBaseUrl,Scope:this.options.Scope,WriteToken:this.options.WriteToken});// Internal state (not exposed via AppData; this section is
// self-contained). Mode + selection drive what paints.
this._state={view:this.options.InitialDashboardHash?'render':'list',dashboards:[],currentHash:this.options.InitialDashboardHash||null,currentCfg:null,editing:null,// record being edited (or null for new)
lastError:null};// Per-panel paging, keyed by panel-id.
this._panelState={};// CSS fragment: register once with the host's CSSMap so the host's
// style cascade picks it up. addCSS is idempotent on hash.
if(this.pict&&this.pict.CSSMap&&typeof this.pict.CSSMap.addCSS==='function'){this.pict.CSSMap.addCSS('Pict-Section-Dashboard-CSS',libCSS,500);}}// ── Public API (host can call these to drive the section) ──────────
/** Switch to render mode for a specific dashboard. */openDashboard(pHash){this._state.currentHash=pHash;this._state.view='render';this.render();}/** Switch to list mode. */openList(){this._state.view='list';this._state.currentCfg=null;this.render();}/** Switch to editor mode. Pass null/undefined to create new. */openEditor(pRecord){this._state.editing=pRecord||null;this._state.view='edit';this.render();}/** Refresh the dashboard list from the API and re-paint. */refresh(){this.render();}// ── Lifecycle ─────────────────────────────────────────────────────
onAfterRender(pRenderable,pAddress,pRecord,pContent){this.pict.CSSMap.injectCSS();this._mount();return super.onAfterRender(pRenderable,pAddress,pRecord,pContent);}// ── DOM mount ─────────────────────────────────────────────────────
_mount(){let tmpDest=this._dest();if(!tmpDest)return;// Wipe + re-establish the section root
tmpDest.innerHTML='';tmpDest.classList.add('psd-root');tmpDest.classList.add('psd-mode-'+this.options.Mode);if(this.options.ShowToolbar)tmpDest.appendChild(this._buildToolbar());let tmpContent=document.createElement('div');tmpContent.className='psd-content';tmpDest.appendChild(tmpContent);if(this._state.view==='list')this._mountList(tmpContent);else if(this._state.view==='edit')this._mountEditor(tmpContent);else if(this._state.view==='render')this._mountRender(tmpContent);}_dest(){let tmpAddr=this.options.ContentDestinationAddress;if(!tmpAddr||typeof document==='undefined')return null;return document.querySelector(tmpAddr);}// ── Toolbar ───────────────────────────────────────────────────────
_buildToolbar(){let tmpBar=document.createElement('div');tmpBar.className='psd-toolbar';let tmpTitle=document.createElement('h2');tmpTitle.textContent='Dashboards';tmpBar.appendChild(tmpTitle);// Back-to-list link, only shown when not on list
if(this._state.view!=='list'){let tmpBack=document.createElement('a');tmpBack.className='psd-btn';tmpBack.textContent='← All dashboards';tmpBack.href='javascript:void(0)';tmpBack.onclick=()=>this.openList();tmpBar.appendChild(tmpBack);}let tmpSpacer=document.createElement('span');tmpSpacer.className='psd-toolbar-spacer';tmpBar.appendChild(tmpSpacer);// Scope selector
let tmpScopeLabel=document.createElement('label');tmpScopeLabel.textContent='scope';let tmpScopeInput=document.createElement('input');tmpScopeInput.type='text';tmpScopeInput.className='psd-scope-input';tmpScopeInput.placeholder='(global)';tmpScopeInput.spellcheck=false;tmpScopeInput.value=this._API.getScope();let tmpDebounce=null;tmpScopeInput.oninput=()=>{clearTimeout(tmpDebounce);tmpDebounce=setTimeout(()=>{this._API.setScope(tmpScopeInput.value.trim());// Switch back to list — what the user is currently
// viewing might not exist in the new scope.
this._state.view='list';this._state.currentHash=null;this._state.currentCfg=null;this.render();},300);};tmpScopeLabel.appendChild(tmpScopeInput);let tmpScopeHint=document.createElement('span');tmpScopeHint.className='psd-scope-hint';tmpScopeHint.textContent='empty = global • * = all';tmpScopeLabel.appendChild(tmpScopeHint);tmpBar.appendChild(tmpScopeLabel);// "+ New" button (manage mode only, when on list)
if(this.options.Mode==='manage'&&this._state.view==='list'){let tmpNew=document.createElement('a');tmpNew.className='psd-btn psd-btn-primary';tmpNew.textContent='+ New dashboard';tmpNew.href='javascript:void(0)';tmpNew.onclick=()=>this.openEditor(null);tmpBar.appendChild(tmpNew);}return tmpBar;}// ── List view ─────────────────────────────────────────────────────
_mountList(pHost){let tmpStatus=document.createElement('div');tmpStatus.className='psd-empty';tmpStatus.textContent='Loading…';pHost.appendChild(tmpStatus);this._API.listDashboards().then(pData=>{pHost.innerHTML='';let tmpRows=pData&&pData.Dashboards||[];this._state.dashboards=tmpRows;if(tmpRows.length===0){let tmpEmpty=document.createElement('div');tmpEmpty.className='psd-empty';let tmpScope=this._API.getScope();tmpEmpty.textContent='No dashboards in '+(tmpScope===''?'global scope':'scope "'+tmpScope+'"')+'. Use scope=* to see all.';pHost.appendChild(tmpEmpty);return;}let tmpList=document.createElement('div');tmpList.className='psd-list';for(let i=0;i<tmpRows.length;i++){tmpList.appendChild(this._buildListRow(tmpRows[i]));}pHost.appendChild(tmpList);}).catch(pErr=>{pHost.innerHTML='';let tmpErr=document.createElement('div');tmpErr.className='psd-error';tmpErr.textContent='Failed to load dashboards: '+pErr.message;pHost.appendChild(tmpErr);});}_buildListRow(pRow){let tmpRow=document.createElement('div');tmpRow.className='psd-list-row';let tmpHash=document.createElement('div');tmpHash.className='psd-row-hash';tmpHash.textContent=pRow.Hash;tmpRow.appendChild(tmpHash);let tmpTitle=document.createElement('div');tmpTitle.className='psd-row-title';tmpTitle.textContent=pRow.Title||'(untitled)';tmpRow.appendChild(tmpTitle);let tmpScope=document.createElement('div');tmpScope.className='psd-row-scope';if(pRow.Scope)tmpScope.textContent=pRow.Scope;else{tmpScope.textContent='global';tmpScope.classList.add('psd-scope-empty');}tmpRow.appendChild(tmpScope);let tmpActions=document.createElement('div');tmpActions.className='psd-row-actions';let tmpOpen=document.createElement('a');tmpOpen.className='psd-btn';tmpOpen.textContent='Open';tmpOpen.href='javascript:void(0)';tmpOpen.onclick=()=>this.openDashboard(pRow.Hash);tmpActions.appendChild(tmpOpen);if(this.options.Mode==='manage'){let tmpEdit=document.createElement('a');tmpEdit.className='psd-btn';tmpEdit.textContent='Edit';tmpEdit.href='javascript:void(0)';tmpEdit.onclick=()=>this._loadAndEdit(pRow.Hash);tmpActions.appendChild(tmpEdit);let tmpDel=document.createElement('a');tmpDel.className='psd-btn psd-btn-danger';tmpDel.textContent='Delete';tmpDel.href='javascript:void(0)';tmpDel.onclick=()=>this._confirmDelete(pRow);tmpActions.appendChild(tmpDel);}tmpRow.appendChild(tmpActions);return tmpRow;}_loadAndEdit(pHash){this._API.loadDashboard(pHash).then(pCfg=>{// loadDashboard returns the parsed Layout; we want raw JSON
// for the editor, plus the IDDashboardConfig for the PUT path.
// Re-fetch the raw record from the listDashboards cache, then
// merge the parsed Layout back as a string for the textarea.
let tmpListed=this._state.dashboards.find(d=>d.Hash===pCfg.Hash)||{};let tmpRecord=Object.assign({},tmpListed,pCfg);tmpRecord.LayoutText=JSON.stringify(pCfg.Layout||{},null,2);this.openEditor(tmpRecord);}).catch(pErr=>{this._toast('Load failed: '+pErr.message,'error');});}_confirmDelete(pRow){// Use pict-section-modal if available; else native confirm as a
// safety fallback (lab + data-mapper both register the modal).
let tmpModal=this.pict.views&&this.pict.views.Modal;if(tmpModal&&typeof tmpModal.confirm==='function'){tmpModal.confirm('Delete dashboard "'+(pRow.Title||pRow.Hash)+'"? This cannot be undone.',{confirmLabel:'Delete',cancelLabel:'Cancel',dangerous:true}).then(pOk=>{if(pOk)this._doDelete(pRow);});return;}// eslint-disable-next-line no-alert
if(typeof confirm==='function'&&confirm('Delete dashboard "'+(pRow.Title||pRow.Hash)+'"?')){this._doDelete(pRow);}}_doDelete(pRow){if(!pRow.IDDashboardConfig){this._toast('Delete failed: list row missing IDDashboardConfig','error');return;}this._API.deleteDashboard(pRow.IDDashboardConfig).then(()=>{this._toast('Dashboard deleted.','success');this.openList();}).catch(pErr=>this._toast('Delete failed: '+pErr.message,'error'));}_toast(pMsg,pType){let tmpModal=this.pict.views&&this.pict.views.Modal;if(tmpModal&&typeof tmpModal.toast==='function'){tmpModal.toast(pMsg,{type:pType||'info'});return;}// Last-resort alert
// eslint-disable-next-line no-console
console.log('[psd]',pMsg);}// ── Editor view ────────────────────────────────────────────────────
_mountEditor(pHost){let tmpRec=this._state.editing||{Hash:'',Title:'',Scope:this._API.getScope(),LayoutText:'{\n  "Type": "column",\n  "Children": []\n}'};let tmpIsNew=!(tmpRec&&tmpRec.IDDashboardConfig);let tmpWrap=document.createElement('div');tmpWrap.className='psd-editor';let tmpHeader=document.createElement('div');tmpHeader.className='psd-editor-header';let tmpHeaderTitle=document.createElement('h3');tmpHeaderTitle.textContent=tmpIsNew?'New dashboard':'Edit dashboard "'+tmpRec.Hash+'"';tmpHeader.appendChild(tmpHeaderTitle);tmpWrap.appendChild(tmpHeader);let tmpForm=document.createElement('div');tmpForm.className='psd-editor-form';// Hash
let tmpHashLbl=document.createElement('label');tmpHashLbl.textContent='Hash';let tmpHashInput=document.createElement('input');tmpHashInput.type='text';tmpHashInput.value=tmpRec.Hash||'';tmpHashInput.placeholder='short-identifier (no spaces)';if(!tmpIsNew)tmpHashInput.disabled=true;tmpForm.appendChild(tmpHashLbl);tmpForm.appendChild(tmpHashInput);// Title
let tmpTitleLbl=document.createElement('label');tmpTitleLbl.textContent='Title';let tmpTitleInput=document.createElement('input');tmpTitleInput.type='text';tmpTitleInput.value=tmpRec.Title||'';tmpTitleInput.placeholder='Human-readable title';tmpForm.appendChild(tmpTitleLbl);tmpForm.appendChild(tmpTitleInput);// Scope
let tmpScopeLbl=document.createElement('label');tmpScopeLbl.textContent='Scope';let tmpScopeInput=document.createElement('input');tmpScopeInput.type='text';tmpScopeInput.value=tmpRec.Scope||'';tmpScopeInput.placeholder='(empty = global)';tmpForm.appendChild(tmpScopeLbl);tmpForm.appendChild(tmpScopeInput);// Layout JSON
let tmpLayoutLbl=document.createElement('label');tmpLayoutLbl.textContent='Layout (JSON)';let tmpLayoutContainer=document.createElement('div');let tmpLayoutTA=document.createElement('textarea');tmpLayoutTA.spellcheck=false;tmpLayoutTA.value=tmpRec.LayoutText||JSON.stringify(tmpRec.Layout||{},null,2);let tmpLayoutHelp=document.createElement('div');tmpLayoutHelp.className='psd-help';tmpLayoutHelp.innerHTML='Recursive: <code>{ Type: "row" | "column", Children: [...] }</code> for containers; <code>{ Type: "list-paged" | "list-compact", Title, BeaconName, ConnectionName, Endpoint, Columns, PageSize | MaxRows }</code> for panels.';tmpLayoutContainer.appendChild(tmpLayoutTA);tmpLayoutContainer.appendChild(tmpLayoutHelp);tmpForm.appendChild(tmpLayoutLbl);tmpForm.appendChild(tmpLayoutContainer);tmpWrap.appendChild(tmpForm);let tmpErrBox=document.createElement('div');tmpErrBox.className='psd-editor-error';tmpErrBox.style.display='none';tmpWrap.appendChild(tmpErrBox);let tmpActions=document.createElement('div');tmpActions.className='psd-editor-actions';let tmpCancel=document.createElement('a');tmpCancel.className='psd-btn';tmpCancel.textContent='Cancel';tmpCancel.href='javascript:void(0)';tmpCancel.onclick=()=>this.openList();tmpActions.appendChild(tmpCancel);let tmpSave=document.createElement('a');tmpSave.className='psd-btn psd-btn-primary';tmpSave.textContent=tmpIsNew?'Create dashboard':'Save changes';tmpSave.href='javascript:void(0)';tmpSave.onclick=()=>{let tmpHash=tmpHashInput.value.trim();let tmpTitle=tmpTitleInput.value;let tmpScope=tmpScopeInput.value.trim();let tmpLayoutRaw=tmpLayoutTA.value;if(!tmpHash){this._showEditorError(tmpErrBox,'Hash is required.');return;}let tmpLayoutParsed;try{tmpLayoutParsed=JSON.parse(tmpLayoutRaw);}catch(pErr){this._showEditorError(tmpErrBox,'Layout is not valid JSON: '+pErr.message);return;}let tmpRecord={Hash:tmpHash,Title:tmpTitle,Scope:tmpScope,Layout:tmpLayoutParsed};if(!tmpIsNew&&tmpRec.IDDashboardConfig)tmpRecord.IDDashboardConfig=tmpRec.IDDashboardConfig;tmpSave.textContent='Saving…';this._API.saveDashboard(tmpRecord).then(()=>{this._toast(tmpIsNew?'Dashboard created.':'Dashboard saved.','success');this.openList();}).catch(pErr=>{tmpSave.textContent=tmpIsNew?'Create dashboard':'Save changes';this._showEditorError(tmpErrBox,pErr.message);});};tmpActions.appendChild(tmpSave);tmpWrap.appendChild(tmpActions);pHost.appendChild(tmpWrap);}_showEditorError(pBox,pMsg){pBox.textContent=pMsg;pBox.style.display='';}// ── Renderer view ──────────────────────────────────────────────────
_mountRender(pHost){let tmpHash=this._state.currentHash;if(!tmpHash){pHost.innerHTML='<div class="psd-empty">No dashboard selected.</div>';return;}let tmpStatus=document.createElement('div');tmpStatus.className='psd-empty';tmpStatus.textContent='Loading dashboard…';pHost.appendChild(tmpStatus);this._API.loadDashboard(tmpHash).then(pCfg=>{pHost.innerHTML='';this._state.currentCfg=pCfg;let tmpTitle=document.createElement('h2');tmpTitle.className='psd-render-title';tmpTitle.textContent=pCfg.Title||pCfg.Hash;pHost.appendChild(tmpTitle);let tmpMeta=document.createElement('p');tmpMeta.className='psd-render-meta';tmpMeta.textContent=pCfg.Hash+(pCfg.Scope?'  •  scope: '+pCfg.Scope:'');pHost.appendChild(tmpMeta);let tmpLayout=pCfg.Layout||{Type:'column',Children:[]};pHost.appendChild(this._renderLayoutNode(tmpLayout,['p']));}).catch(pErr=>{pHost.innerHTML='';let tmpErr=document.createElement('div');tmpErr.className='psd-error';tmpErr.textContent='Failed to load dashboard: '+pErr.message;pHost.appendChild(tmpErr);});}_renderLayoutNode(pNode,pPath){if(!pNode||typeof pNode!=='object'){let tmpErr=document.createElement('div');tmpErr.className='psd-error';tmpErr.textContent='Invalid layout node';return tmpErr;}if(pNode.Type==='row'||pNode.Type==='column'){let tmpWrap=document.createElement('div');tmpWrap.className=pNode.Type==='row'?'psd-layout-row':'psd-layout-column';let tmpChildren=pNode.Children||[];for(let i=0;i<tmpChildren.length;i++){tmpWrap.appendChild(this._renderLayoutNode(tmpChildren[i],pPath.concat([i])));}return tmpWrap;}return this._renderPanel(pNode,pPath.join('-'));}_renderPanel(pPanel,pPanelId){let tmpCard=document.createElement('div');tmpCard.className='psd-panel';let tmpTitle=document.createElement('div');tmpTitle.className='psd-panel-title';tmpTitle.textContent=pPanel.Title||pPanel.Endpoint||'(panel)';tmpCard.appendChild(tmpTitle);let tmpMeta=document.createElement('div');tmpMeta.className='psd-panel-meta';tmpMeta.textContent=(pPanel.Type||'?')+'  ←  '+(pPanel.BeaconName||'?')+'/'+(pPanel.ConnectionName||'?')+'/'+(pPanel.Endpoint||'?');tmpCard.appendChild(tmpMeta);let tmpBody=document.createElement('div');tmpCard.appendChild(tmpBody);if(pPanel.Type!=='list-paged'&&pPanel.Type!=='list-compact'){tmpBody.innerHTML='<div class="psd-empty">Panel type "'+(pPanel.Type||'?')+'" not yet supported in this renderer.</div>';return tmpCard;}this._panelState[pPanelId]=this._panelState[pPanelId]||{page:0};let tmpPageSize=pPanel.Type==='list-compact'?pPanel.MaxRows||this.options.ListCompactRows:pPanel.PageSize||this.options.ListPageSize;let _self=this;function fFetchPage(pPage){tmpBody.innerHTML='<div class="psd-empty">Loading…</div>';_self._API.fetchPanelData(pPanel,pPage,tmpPageSize).then(pData=>{_self._renderPanelTable(tmpBody,pPanel,pData.Rows||[],pPage,tmpPageSize,fFetchPage);}).catch(pErr=>{tmpBody.innerHTML='';let tmpErr=document.createElement('div');tmpErr.className='psd-error';tmpErr.textContent=pErr.message;tmpBody.appendChild(tmpErr);});}fFetchPage(this._panelState[pPanelId].page);return tmpCard;}_renderPanelTable(pHost,pPanel,pRows,pPage,pPageSize,fFetchPage){pHost.innerHTML='';if(pRows.length===0&&pPage===0){pHost.innerHTML='<div class="psd-empty">No rows.</div>';return;}let tmpCols=pPanel.Columns&&pPanel.Columns.length>0?pPanel.Columns:Object.keys(pRows[0]||{}).filter(k=>!/^(IDCachedView|GUIDCachedView|ID[A-Z]|GUID[A-Z]|Deleted|Delete|Create|Update|Creating|Updating|Deleting)/.test(k));let tmpTable=document.createElement('table');tmpTable.className='psd-panel-table';let tmpThead=document.createElement('thead');let tmpTrh=document.createElement('tr');for(let c=0;c<tmpCols.length;c++){let tmpTh=document.createElement('th');tmpTh.textContent=tmpCols[c];tmpTrh.appendChild(tmpTh);}tmpThead.appendChild(tmpTrh);tmpTable.appendChild(tmpThead);let tmpTbody=document.createElement('tbody');for(let r=0;r<pRows.length;r++){let tmpTr=document.createElement('tr');for(let c=0;c<tmpCols.length;c++){let tmpTd=document.createElement('td');let tmpV=pRows[r][tmpCols[c]];tmpTd.textContent=tmpV===null||tmpV===undefined?'':String(tmpV);tmpTr.appendChild(tmpTd);}tmpTbody.appendChild(tmpTr);}tmpTable.appendChild(tmpTbody);pHost.appendChild(tmpTable);if(pPanel.Type==='list-paged'){let tmpPager=document.createElement('div');tmpPager.className='psd-pager';let tmpPrev=document.createElement('a');tmpPrev.className='psd-btn';tmpPrev.textContent='← prev';tmpPrev.href='javascript:void(0)';if(pPage===0){tmpPrev.style.opacity='0.4';tmpPrev.style.pointerEvents='none';}else tmpPrev.onclick=()=>fFetchPage(pPage-1);let tmpNext=document.createElement('a');tmpNext.className='psd-btn';tmpNext.textContent='next →';tmpNext.href='javascript:void(0)';if(pRows.length<pPageSize){tmpNext.style.opacity='0.4';tmpNext.style.pointerEvents='none';}else tmpNext.onclick=()=>fFetchPage(pPage+1);let tmpLabel=document.createElement('span');tmpLabel.className='psd-pager-label';tmpLabel.textContent='page '+(pPage+1)+'  •  '+pRows.length+' rows';tmpPager.appendChild(tmpPrev);tmpPager.appendChild(tmpNext);tmpPager.appendChild(tmpLabel);pHost.appendChild(tmpPager);}}}// Static config templates. The Pict view base class needs at least
// minimal Templates / Renderables to call render() — it expects to
// substitute a template into a destination. We define a no-op shell
// template that just provides an anchor; everything visible is
// painted by _mount() in onAfterRender.
PictSectionDashboard.default_configuration=Object.assign({},libDefaultConf,{Templates:[{Hash:'Pict-Section-Dashboard-Shell',Template:'<div class="psd-shell-anchor"></div>'}],Renderables:[{RenderableHash:'Pict-Section-Dashboard-Shell',TemplateHash:'Pict-Section-Dashboard-Shell',ContentDestinationAddress:libDefaultConf.DefaultDestinationAddress}]});module.exports=PictSectionDashboard;module.exports.default_configuration=PictSectionDashboard.default_configuration;module.exports.APIProvider=libAPIProvider;},{"./Pict-Section-Dashboard-CSS.js":28,"./Pict-Section-Dashboard-DefaultConfiguration.js":29,"./providers/PictProvider-Dashboard-API.js":31,"pict-view":18}],31:[function(require,module,exports){/**
 * Pict-Section-Dashboard API Provider
 *
 * Thin REST client that talks to retold-data-mapper's /mapper/* surface.
 * Centralizes scope handling: the active scope is read from localStorage
 * (key `retold.dataMapper.activeScope`) but can be overridden per-call.
 *
 * The host application doesn't have to know how the data-mapper REST is
 * shaped — it just calls listDashboards / loadDashboard / saveDashboard /
 * deleteDashboard / fetchPanelData and gets a Promise back.
 *
 * Bearer-token write gate: when WriteToken is set, POST/PUT/DELETE carry
 * `Authorization: Bearer <token>` to satisfy the data-mapper's
 * DATA_MAPPER_WRITE_TOKEN env-driven gate (Phase 2b hardening).
 * GET stays open.
 */'use strict';const SCOPE_STORAGE_KEY='retold.dataMapper.activeScope';class DashboardAPIProvider{constructor(pOptions){let tmpOptions=pOptions||{};this._apiBaseUrl=tmpOptions.APIBaseUrl||'/mapper';this._scopeOverride=typeof tmpOptions.Scope==='string'?tmpOptions.Scope:null;this._writeToken=typeof tmpOptions.WriteToken==='string'&&tmpOptions.WriteToken.length>0?tmpOptions.WriteToken:null;}/**
	 * Resolve the active scope. Order: explicit per-call scope →
	 * provider option → localStorage → '' (global).
	 *
	 * localStorage access is wrapped in try/catch because some sandbox
	 * environments (jsdom with opaque origin, cross-origin iframes,
	 * private-mode browsers with quotas) throw on read.
	 */getScope(pCallScope){if(typeof pCallScope==='string')return pCallScope;if(typeof this._scopeOverride==='string')return this._scopeOverride;try{if(typeof localStorage!=='undefined'){let tmpStored=localStorage.getItem(SCOPE_STORAGE_KEY);if(tmpStored!==null)return tmpStored;}}catch(pErr){/* opaque origin or disabled storage — fall through */}return'';}setScope(pScope){try{if(typeof localStorage!=='undefined'){if(pScope)localStorage.setItem(SCOPE_STORAGE_KEY,pScope);else localStorage.removeItem(SCOPE_STORAGE_KEY);}}catch(pErr){/* opaque origin or disabled storage — keep in-memory only */}this._scopeOverride=typeof pScope==='string'?pScope:null;}setWriteToken(pToken){this._writeToken=typeof pToken==='string'&&pToken.length>0?pToken:null;}/**
	 * Internal fetch wrapper that surfaces non-2xx as rejected promises.
	 */_fetch(pMethod,pPath,pBody){let tmpOpts={method:pMethod,headers:{}};let tmpIsWrite=pMethod!=='GET'&&pMethod!=='HEAD';if(pBody!==undefined&&pBody!==null){tmpOpts.headers['Content-Type']='application/json';tmpOpts.body=JSON.stringify(pBody);}if(tmpIsWrite&&this._writeToken){tmpOpts.headers['Authorization']='Bearer '+this._writeToken;}return fetch(this._apiBaseUrl+pPath,tmpOpts).then(pRes=>{if(!pRes.ok){return pRes.text().then(pText=>{let tmpMsg=pText&&pText.length<300?pText:'HTTP '+pRes.status;throw new Error(tmpMsg);});}let tmpCT=pRes.headers.get('content-type')||'';if(tmpCT.indexOf('application/json')===0)return pRes.json();return pRes.text();});}_scopeQuery(pScope){let tmpScope=this.getScope(pScope);// Empty string scope is the default on the server; no need to send it.
// '*' explicitly asks for cross-scope listing.
if(tmpScope==='')return'';return'?scope='+encodeURIComponent(tmpScope);}listDashboards(pScope){return this._fetch('GET','/dashboards'+this._scopeQuery(pScope));}loadDashboard(pHash,pScope){return this._fetch('GET','/dashboard/'+encodeURIComponent(pHash)+this._scopeQuery(pScope));}saveDashboard(pRecord,pScope){// Caller's record can omit Scope; we inject the active one if so.
let tmpRecord=Object.assign({},pRecord);if(tmpRecord.Scope===undefined)tmpRecord.Scope=this.getScope(pScope);if(tmpRecord.IDDashboardConfig){let tmpID=tmpRecord.IDDashboardConfig;delete tmpRecord.IDDashboardConfig;return this._fetch('PUT','/dashboard/'+tmpID,tmpRecord);}return this._fetch('POST','/dashboards',tmpRecord);}deleteDashboard(pID){return this._fetch('DELETE','/dashboard/'+pID);}fetchPanelData(pPanel,pPage,pPageSize){return this._fetch('POST','/dashboard/panel-data',{BeaconName:pPanel.BeaconName,ConnectionName:pPanel.ConnectionName,Endpoint:pPanel.Endpoint,PageSize:pPageSize,Page:pPage});}}module.exports=DashboardAPIProvider;module.exports.SCOPE_STORAGE_KEY=SCOPE_STORAGE_KEY;},{}],32:[function(require,module,exports){/**
 * Pict-Section-Mapping CSS
 *
 * All class names prefixed `psm-` (Pict Section Mapping). Same color
 * palette + button styling as the dashboard / operation sections so a
 * host mounting all three sees a consistent look.
 */'use strict';module.exports=`
.psm-root
{
	--psm-bg:           #0e1a2b;
	--psm-bg-elev:      #0a1525;
	--psm-bg-elev-2:    #0f172a;
	--psm-border:       #1e293b;
	--psm-border-soft:  #0f1c2f;
	--psm-fg:           #f8fafc;
	--psm-fg-soft:      #cbd5e1;
	--psm-fg-mute:      #94a3b8;
	--psm-fg-fade:      #64748b;
	--psm-accent:       #2563eb;
	--psm-accent-fg:    #ffffff;
	--psm-success:      #16a34a;
	--psm-success-fg:   #dcfce7;
	--psm-danger:       #b91c1c;
	--psm-danger-fg:    #fecaca;

	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	background: var(--psm-bg);
	color: var(--psm-fg);
	min-height: 100%;
}

.psm-toolbar
{
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 10px 16px;
	background: var(--psm-bg-elev);
	border-bottom: 1px solid var(--psm-border);
	flex-wrap: wrap;
}
.psm-toolbar h2 { margin: 0; font-size: 16px; font-weight: 600; }
.psm-toolbar .psm-toolbar-spacer { flex: 1; }
.psm-toolbar label { color: var(--psm-fg-mute); font-size: 12px; display: inline-flex; align-items: center; gap: 6px; }
.psm-toolbar input
{
	background: var(--psm-bg-elev-2);
	color: var(--psm-fg);
	border: 1px solid var(--psm-border);
	padding: 5px 9px;
	border-radius: 4px;
	font-size: 12px;
	font-family: inherit;
}
.psm-toolbar input.psm-scope-input { width: 140px; font-family: monospace; }
.psm-toolbar .psm-scope-hint { color: var(--psm-fg-fade); font-size: 11px; font-style: italic; }
.psm-btn
{
	background: var(--psm-bg-elev-2);
	color: var(--psm-fg-soft);
	border: 1px solid var(--psm-border);
	padding: 5px 11px;
	border-radius: 4px;
	font-size: 12px;
	cursor: pointer;
	text-decoration: none;
	display: inline-flex;
	align-items: center;
	gap: 4px;
}
.psm-btn:hover { background: #1e293b; color: var(--psm-fg); }
.psm-btn.psm-btn-primary { background: var(--psm-accent); border-color: var(--psm-accent); color: var(--psm-accent-fg); }
.psm-btn.psm-btn-primary:hover { background: var(--theme-color-brand-primary-hover, #1d4ed8); }
.psm-btn.psm-btn-success { background: var(--psm-success); border-color: var(--psm-success); color: var(--psm-success-fg); }
.psm-btn.psm-btn-success:hover { background: var(--theme-color-status-success, #15803d); }
.psm-btn.psm-btn-danger { background: transparent; color: var(--psm-danger-fg); border-color: var(--psm-danger); }
.psm-btn.psm-btn-danger:hover { background: var(--psm-danger); color: var(--psm-accent-fg); }
.psm-btn[disabled], .psm-btn.psm-btn-disabled { opacity: 0.5; pointer-events: none; }

.psm-content { padding: 16px; max-width: 1400px; margin: 0 auto; }

/* List view */
.psm-list-wrap { display: flex; flex-direction: column; gap: 12px; }
.psm-list { display: flex; flex-direction: column; gap: 8px; }
.psm-list-row
{
	display: grid;
	grid-template-columns: 1.5fr 1.6fr 2fr auto;
	gap: 12px;
	padding: 10px 14px;
	background: var(--psm-bg-elev);
	border: 1px solid var(--psm-border);
	border-radius: 6px;
	align-items: center;
}
.psm-list-row .psm-row-name { font-family: monospace; font-size: 13px; color: var(--psm-fg); font-weight: 600; }
.psm-list-row .psm-row-name .psm-row-scope { color: var(--psm-fg-fade); font-style: italic; font-weight: 400; margin-left: 6px; font-size: 11px; }
.psm-list-row .psm-row-desc { color: var(--psm-fg-soft); font-size: 12px; }
.psm-list-row .psm-row-flow { font-size: 11px; color: var(--psm-fg-mute); font-family: monospace; }
.psm-list-row .psm-row-actions { display: flex; gap: 6px; justify-content: flex-end; }

.psm-empty, .psm-error
{
	padding: 18px;
	text-align: center;
	color: var(--psm-fg-fade);
	font-size: 13px;
	border: 1px dashed var(--psm-border);
	border-radius: 6px;
	background: var(--psm-bg-elev);
}
.psm-error { color: #f87171; background: #2a1010; border-color: #2a1010; }

/* Editor */
.psm-editor { display: flex; flex-direction: column; gap: 14px; }
.psm-editor-header { display: flex; gap: 12px; align-items: center; }
.psm-editor-header h3 { margin: 0; font-size: 16px; }
.psm-editor-form { display: grid; grid-template-columns: 160px 1fr; gap: 10px 14px; align-items: center; }
.psm-editor-form label { color: var(--psm-fg-mute); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
.psm-editor-form input[type=text]
{
	background: var(--psm-bg-elev-2);
	color: var(--psm-fg);
	border: 1px solid var(--psm-border);
	padding: 6px 10px;
	border-radius: 4px;
	font-size: 13px;
	font-family: inherit;
}
.psm-editor-form .psm-help { color: var(--psm-fg-fade); font-size: 11px; font-style: italic; }
.psm-editor-form textarea
{
	background: var(--psm-bg-elev-2);
	color: var(--psm-fg);
	border: 1px solid var(--psm-border);
	padding: 8px 10px;
	border-radius: 4px;
	font-size: 12px;
	font-family: monospace;
	min-height: 240px;
	resize: vertical;
	width: 100%;
	box-sizing: border-box;
}
.psm-editor-actions { display: flex; gap: 8px; justify-content: flex-end; }
.psm-editor-error { color: #f87171; font-size: 12px; padding: 8px 12px; background: #2a1010; border-radius: 4px; }
.psm-source-target
{
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 14px;
	padding: 12px;
	background: var(--psm-bg-elev-2);
	border: 1px solid var(--psm-border);
	border-radius: 4px;
}
.psm-source-target .psm-st-section h4 { margin: 0 0 8px 0; color: var(--psm-fg-mute); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
.psm-source-target .psm-st-row { display: grid; grid-template-columns: 90px 1fr; gap: 6px; margin-bottom: 6px; align-items: center; }
.psm-source-target .psm-st-row label { color: var(--psm-fg-fade); font-size: 11px; }

/* Run result */
.psm-run-result
{
	padding: 14px;
	background: var(--psm-bg-elev);
	border: 1px solid var(--psm-border);
	border-radius: 6px;
	margin-top: 10px;
	font-size: 13px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.psm-run-result h4 { margin: 0; font-size: 14px; color: var(--psm-fg-soft); }
.psm-run-result .psm-run-stats { display: flex; gap: 18px; flex-wrap: wrap; }
.psm-run-result .psm-run-stat { display: flex; flex-direction: column; }
.psm-run-result .psm-run-stat .psm-stat-label { font-size: 10px; color: var(--psm-fg-mute); text-transform: uppercase; letter-spacing: 0.5px; }
.psm-run-result .psm-run-stat .psm-stat-value { font-size: 16px; color: var(--psm-fg); font-family: monospace; font-weight: 600; }
.psm-run-result.psm-run-success { border-color: var(--psm-success); }
.psm-run-result.psm-run-error   { border-color: var(--psm-danger); }
.psm-run-result.psm-run-running { border-color: var(--psm-warning); }
.psm-run-result .psm-run-error-message
{
	color: var(--psm-danger-fg);
	font-family: monospace;
	font-size: 12px;
	white-space: pre-wrap;
}
`;},{}],33:[function(require,module,exports){/**
 * Pict-Section-Mapping default configuration.
 *
 * Template-driven view per modules/pict/CLAUDE.md conventions.
 */'use strict';const SHELL_TEMPLATE=/*html*/`
<div class="psm-root psm-mode-{~Data:AppData.Mapping.Mode~}">
	{~TS:Pict-Section-Mapping-Toolbar:AppData.Mapping.ToolbarSlot~}
	<div class="psm-content">
		{~TS:Pict-Section-Mapping-List:AppData.Mapping.ListSlot~}
		{~TS:Pict-Section-Mapping-Editor:AppData.Mapping.EditSlot~}
	</div>
</div>`;const TOOLBAR_TEMPLATE=/*html*/`
<div class="psm-toolbar">
	<h2>Mappings</h2>
	{~TS:Pict-Section-Mapping-Toolbar-BackLink:AppData.Mapping.BackLinkSlot~}
	<span class="psm-toolbar-spacer"></span>
	<label>scope
		<input type="text" class="psm-scope-input" spellcheck="false" placeholder="* (all scopes)"
			value="{~Data:AppData.Mapping.Scope~}"
			oninput="_Pict.views['Pict-Section-Mapping'].onScopeInput(this.value)" />
		<span class="psm-scope-hint">* = all • empty = global • any string = that scope</span>
	</label>
	{~TS:Pict-Section-Mapping-Toolbar-NewButton:AppData.Mapping.NewButtonSlot~}
</div>`;const TOOLBAR_BACKLINK_TEMPLATE=/*html*/`
<a class="psm-btn" href="javascript:void(0)"
	onclick="_Pict.views['Pict-Section-Mapping'].openList()">← All mappings</a>`;const TOOLBAR_NEWBUTTON_TEMPLATE=/*html*/`
<a class="psm-btn psm-btn-primary" href="javascript:void(0)"
	onclick="_Pict.views['Pict-Section-Mapping'].openEditor(null)">+ New mapping</a>`;const LIST_TEMPLATE=/*html*/`
<div class="psm-list-wrap">
	{~TS:Pict-Section-Mapping-LoadingState:AppData.Mapping.LoadingSlot~}
	{~TS:Pict-Section-Mapping-LoadError:AppData.Mapping.LoadErrorSlot~}
	{~TS:Pict-Section-Mapping-EmptyState:AppData.Mapping.EmptySlot~}
	{~TS:Pict-Section-Mapping-ListBody:AppData.Mapping.ListBodySlot~}
</div>`;const LOADING_TEMPLATE=/*html*/`<div class="psm-empty">Loading…</div>`;const LOAD_ERROR_TEMPLATE=/*html*/`
<div class="psm-error">Failed to load mappings: {~Data:Record.Message~}</div>`;const EMPTY_TEMPLATE=/*html*/`<div class="psm-empty">{~Data:Record.Message~}</div>`;const LIST_BODY_TEMPLATE=/*html*/`
<div class="psm-list">
	{~TS:Pict-Section-Mapping-ListRow:AppData.Mapping.Mappings~}
</div>`;const LIST_ROW_TEMPLATE=/*html*/`
<div class="psm-list-row" id="psm-row-{~Data:Record.IDMappingConfig~}">
	<div class="psm-row-name">{~Data:Record.NameOrUnnamed~}{~TS:Pict-Section-Mapping-RowScopeBadge:Record.ScopeBadgeSlot~}</div>
	<div class="psm-row-desc">{~Data:Record.Description~}</div>
	<div class="psm-row-flow">{~Data:Record.SourceLabel~} → {~Data:Record.TargetLabel~}</div>
	<div class="psm-row-actions">{~TS:Pict-Section-Mapping-RowAction:Record.ActionsSlot~}</div>
	{~TS:Pict-Section-Mapping-RunResult:Record.ResultSlot~}
</div>`;const ROW_SCOPE_BADGE_TEMPLATE=/*html*/`
<span class="psm-row-scope">· {~Data:Record.Scope~}</span>`;const ROW_ACTION_TEMPLATE=/*html*/`
<a class="psm-btn {~Data:Record.ButtonClass~}" href="javascript:void(0)"
	onclick="_Pict.views['Pict-Section-Mapping'].{~Data:Record.Method~}({~Data:Record.IDMappingConfig~})">{~Data:Record.Label~}</a>`;const RUN_RESULT_TEMPLATE=/*html*/`
<div class="psm-run-result {~Data:Record.StatusClass~}">
	<h4>{~Data:Record.Title~}</h4>
	{~TS:Pict-Section-Mapping-RunErrorMessage:Record.ErrorSlot~}
	{~TS:Pict-Section-Mapping-RunStat:Record.Stats~}
</div>`;const RUN_ERROR_TEMPLATE=/*html*/`
<div class="psm-run-error-message">{~Data:Record.Message~}</div>`;const RUN_STAT_TEMPLATE=/*html*/`
<div class="psm-run-stat">
	<span class="psm-stat-label">{~Data:Record.Label~}</span>
	<span class="psm-stat-value">{~Data:Record.Value~}</span>
</div>`;const EDITOR_TEMPLATE=/*html*/`
<div class="psm-editor">
	<div class="psm-editor-header">
		<h3>{~Data:Record.HeaderTitle~}</h3>
	</div>
	<div class="psm-editor-form">
		<label>Name</label>
		<input type="text" placeholder="Human-readable name (e.g. &quot;weather → WeatherSummary&quot;)"
			value="{~Data:Record.Name~}"
			onchange="_Pict.views['Pict-Section-Mapping'].setEditingField('Name', this.value)" />

		<label>Scope</label>
		<input type="text" placeholder="(empty = global)"
			value="{~Data:Record.Scope~}"
			onchange="_Pict.views['Pict-Section-Mapping'].setEditingField('Scope', this.value)" />

		<label>Description</label>
		<input type="text"
			value="{~Data:Record.Description~}"
			onchange="_Pict.views['Pict-Section-Mapping'].setEditingField('Description', this.value)" />

		<label>Source ↔ Target</label>
		<div class="psm-source-target">
			<div class="psm-st-section">
				<h4>Source</h4>
				{~TS:Pict-Section-Mapping-EditorSTRow:Record.SourceFields~}
			</div>
			<div class="psm-st-section">
				<h4>Target</h4>
				{~TS:Pict-Section-Mapping-EditorSTRow:Record.TargetFields~}
			</div>
		</div>

		<label>Configuration (JSON)</label>
		<div>
			<textarea spellcheck="false"
				onchange="_Pict.views['Pict-Section-Mapping'].setEditingField('MappingConfiguration', this.value)">{~Data:Record.MappingConfiguration~}</textarea>
			<div class="psm-help">
				meadow-integration shape: <code>{ Entity, GUIDName, GUIDTemplate, Mappings: { TargetField: "{~D:Record.SourceField~}" }, Solvers }</code>.
			</div>
		</div>
	</div>

	{~TS:Pict-Section-Mapping-EditorError:Record.ErrorSlot~}

	<div class="psm-editor-actions">
		<a class="psm-btn" href="javascript:void(0)"
			onclick="_Pict.views['Pict-Section-Mapping'].openList()">Cancel</a>
		<a class="psm-btn psm-btn-primary" href="javascript:void(0)"
			onclick="_Pict.views['Pict-Section-Mapping'].saveEditing()">{~Data:Record.SaveButtonLabel~}</a>
	</div>
</div>`;const EDITOR_ST_ROW_TEMPLATE=/*html*/`
<div class="psm-st-row">
	<label>{~Data:Record.Label~}</label>
	<input type="text" placeholder="{~Data:Record.Field~}"
		value="{~Data:Record.Value~}"
		onchange="_Pict.views['Pict-Section-Mapping'].setEditingField('{~Data:Record.Field~}', this.value)" />
</div>`;const EDITOR_ERROR_TEMPLATE=/*html*/`
<div class="psm-editor-error">{~Data:Record.Message~}</div>`;module.exports={ViewIdentifier:'Pict-Section-Mapping',DefaultRenderable:'Pict-Section-Mapping-Shell',DefaultDestinationAddress:'#Pict-Section-Mapping',DefaultTemplateRecordAddress:'AppData.Mapping',AutoRender:true,RenderOnLoad:false,APIBaseUrl:'/mapper',Mode:'manage',ShowToolbar:true,Scope:null,WriteToken:null,Templates:[{Hash:'Pict-Section-Mapping-Shell',Template:SHELL_TEMPLATE},{Hash:'Pict-Section-Mapping-Toolbar',Template:TOOLBAR_TEMPLATE},{Hash:'Pict-Section-Mapping-Toolbar-BackLink',Template:TOOLBAR_BACKLINK_TEMPLATE},{Hash:'Pict-Section-Mapping-Toolbar-NewButton',Template:TOOLBAR_NEWBUTTON_TEMPLATE},{Hash:'Pict-Section-Mapping-List',Template:LIST_TEMPLATE},{Hash:'Pict-Section-Mapping-LoadingState',Template:LOADING_TEMPLATE},{Hash:'Pict-Section-Mapping-LoadError',Template:LOAD_ERROR_TEMPLATE},{Hash:'Pict-Section-Mapping-EmptyState',Template:EMPTY_TEMPLATE},{Hash:'Pict-Section-Mapping-ListBody',Template:LIST_BODY_TEMPLATE},{Hash:'Pict-Section-Mapping-ListRow',Template:LIST_ROW_TEMPLATE},{Hash:'Pict-Section-Mapping-RowScopeBadge',Template:ROW_SCOPE_BADGE_TEMPLATE},{Hash:'Pict-Section-Mapping-RowAction',Template:ROW_ACTION_TEMPLATE},{Hash:'Pict-Section-Mapping-RunResult',Template:RUN_RESULT_TEMPLATE},{Hash:'Pict-Section-Mapping-RunErrorMessage',Template:RUN_ERROR_TEMPLATE},{Hash:'Pict-Section-Mapping-RunStat',Template:RUN_STAT_TEMPLATE},{Hash:'Pict-Section-Mapping-Editor',Template:EDITOR_TEMPLATE},{Hash:'Pict-Section-Mapping-EditorSTRow',Template:EDITOR_ST_ROW_TEMPLATE},{Hash:'Pict-Section-Mapping-EditorError',Template:EDITOR_ERROR_TEMPLATE}],Renderables:[{RenderableHash:'Pict-Section-Mapping-Shell',TemplateHash:'Pict-Section-Mapping-Shell',TemplateRecordAddress:'AppData.Mapping',DestinationAddress:'#Pict-Section-Mapping',RenderMethod:'replace'}]};},{}],34:[function(require,module,exports){/**
 * Pict-Section-Mapping
 *
 * Embeddable Pict view for Mapping CRUD + Run, surfacing the
 * retold-data-mapper /mapper/mapping* REST API.
 *
 * Template-driven per modules/pict/CLAUDE.md (mirrors pict-section-operation):
 *   - All state lives in pict.AppData.Mapping.*
 *   - Templates + Renderables; no document.createElement, no .onclick closures.
 *   - View switching uses single-element-array slots driven by {~TS:~}.
 *   - Modal interactions via pict-section-modal; no native popups.
 *
 * Modes:
 *   `manage`     full CRUD (default)
 *   `list-only`  list-only — Run/Edit/Delete + the New button are suppressed.
 *
 * Public API (called by host apps and inline template handlers):
 *   openList()
 *   openEditor(pRecOrID)        // null = new
 *   saveEditing()
 *   runMapping(pIDMappingConfig)
 *   deleteMapping(pIDMappingConfig)
 *   onScopeInput(pValue)
 *   setEditingField(pName, pValue)
 *   refresh()
 *
 * Note: the data-mapper also has a separate visual mapping editor
 * (the Pict app at index.html) for graphical field mapping. This
 * section is the lightweight CRUD + Run surface; the visual editor
 * is the richer alternative for editing MappingConfiguration.
 */'use strict';const libPictView=require('pict-view');const libDefaultConf=require('./Pict-Section-Mapping-DefaultConfiguration.js');const libCSS=require('./Pict-Section-Mapping-CSS.js');const libAPIProvider=require('./providers/PictProvider-Mapping-API.js');const DEFAULT_MAPPING_CONFIGURATION={Entity:'/* TargetEntity */',GUIDName:'GUID/* TargetEntity */',GUIDTemplate:'/* {~D:Record.SourceField~} for unique-per-row GUID */',Solvers:[],Mappings:{'/* TargetField */':'{~D:Record./* SourceField */~}'}};const DEFAULT_MAPPING_CONFIGURATION_TEXT=JSON.stringify(DEFAULT_MAPPING_CONFIGURATION,null,2);const RUN_STAT_FIELDS=['RowsRead','RowsMapped','RowsWritten','Errors','TargetEntity','ElapsedMs'];const SOURCE_EDITOR_FIELDS=[{Field:'SourceBeaconName',Label:'Beacon'},{Field:'SourceConnectionHash',Label:'Connection'},{Field:'SourceEntity',Label:'Entity'}];const TARGET_EDITOR_FIELDS=[{Field:'TargetBeaconName',Label:'Beacon'},{Field:'TargetConnectionHash',Label:'Connection'},{Field:'TargetEntity',Label:'Entity'}];class PictSectionMapping extends libPictView{constructor(pFable,pOptions,pServiceHash){let tmpOptions=Object.assign({},libDefaultConf,pOptions||{});super(pFable,tmpOptions,pServiceHash);this._API=new libAPIProvider({APIBaseUrl:this.options.APIBaseUrl,Scope:this.options.Scope,WriteToken:this.options.WriteToken});if(this.pict&&this.pict.CSSMap&&typeof this.pict.CSSMap.addCSS==='function'){this.pict.CSSMap.addCSS('Pict-Section-Mapping-CSS',libCSS,500);}this._seedAppData();this._scopeDebounce=null;}_seedAppData(){if(!this.pict.AppData)this.pict.AppData={};this.pict.AppData.Mapping=Object.assign({Mode:this.options.Mode||'manage',ShowToolbar:!!this.options.ShowToolbar,Scope:this._API.getScope(),View:'list',// 'list' | 'edit'
Mappings:[],Editing:null,EditorError:'',LoadState:'idle',// 'idle' | 'loading' | 'error' | 'empty' | 'ready'
LoadErrorMessage:'',EmptyMessage:'',RunResults:{},ToolbarSlot:[],BackLinkSlot:[],NewButtonSlot:[],ListSlot:[],EditSlot:[],LoadingSlot:[],LoadErrorSlot:[],EmptySlot:[],ListBodySlot:[]},this.pict.AppData.Mapping||{});}// ── Lifecycle ────────────────────────────────────────────────────
onAfterInitialize(){this._loadList();return super.onAfterInitialize();}onBeforeRender(pRenderable,pAddress,pRecord,pContent){this._populateSlots();return super.onBeforeRender(pRenderable,pAddress,pRecord,pContent);}onAfterRender(pRenderable,pAddress,pRecord,pContent){this.pict.CSSMap.injectCSS();return super.onAfterRender(pRenderable,pAddress,pRecord,pContent);}// ── Public API ───────────────────────────────────────────────────
openList(){this.pict.AppData.Mapping.View='list';this.pict.AppData.Mapping.Editing=null;this.pict.AppData.Mapping.EditorError='';this._loadList();}openEditor(pRecOrID){if(pRecOrID==null){this._openEditorWith(null);return;}if(typeof pRecOrID==='object'){this._openEditorWith(pRecOrID);return;}let tmpID=parseInt(pRecOrID,10);let tmpFound=this.pict.AppData.Mapping.Mappings.find(r=>r.IDMappingConfig===tmpID);this._openEditorWith(tmpFound||null);}saveEditing(){let tmpRec=this.pict.AppData.Mapping.Editing;if(!tmpRec){this._toast('Nothing to save.','error');return;}if(!tmpRec.Name||!tmpRec.Name.trim()){this._setEditorError('Name is required.');return;}let tmpConfRaw=typeof tmpRec.MappingConfiguration==='string'?tmpRec.MappingConfiguration:JSON.stringify(tmpRec.MappingConfiguration||{},null,2);let tmpConfParsed;try{tmpConfParsed=JSON.parse(tmpConfRaw);}catch(pErr){this._setEditorError('Configuration JSON parse error: '+pErr.message);return;}let tmpIsNew=!tmpRec.IDMappingConfig;let tmpPayload=Object.assign({},tmpRec,{MappingConfiguration:tmpConfParsed});this._API.saveMapping(tmpPayload).then(()=>{this._toast(tmpIsNew?'Mapping created.':'Mapping saved.','success');this.openList();}).catch(pErr=>this._setEditorError(pErr.message));}runMapping(pIDMappingConfig){let tmpID=parseInt(pIDMappingConfig,10);if(!tmpID){this._toast('Run failed: missing IDMappingConfig','error');return;}let tmpMap=this.pict.AppData.Mapping.Mappings.find(r=>r.IDMappingConfig===tmpID);let tmpName=tmpMap?tmpMap.Name||tmpMap.Hash||'mapping '+tmpID:'mapping '+tmpID;this.pict.AppData.Mapping.RunResults[tmpID]={Status:'Running'};this.render();this._API.runMapping(tmpID).then(pResult=>{this.pict.AppData.Mapping.RunResults[tmpID]=Object.assign({},pResult||{},{Status:'Success',Hash:tmpName});this.render();}).catch(pErr=>{this.pict.AppData.Mapping.RunResults[tmpID]={Status:'Error',Hash:tmpName,Error:pErr.message};this.render();});}deleteMapping(pIDMappingConfig){let tmpID=parseInt(pIDMappingConfig,10);if(!tmpID){this._toast('Delete failed: missing IDMappingConfig','error');return;}let tmpMap=this.pict.AppData.Mapping.Mappings.find(r=>r.IDMappingConfig===tmpID);let tmpLabel=tmpMap?tmpMap.Name||tmpMap.Hash||'mapping '+tmpID:'mapping '+tmpID;this._confirm('Delete mapping "'+tmpLabel+'"? This cannot be undone.',{title:'Delete mapping?',confirmLabel:'Delete',cancelLabel:'Cancel',dangerous:true}).then(pOk=>{if(!pOk)return;this._API.deleteMapping(tmpID).then(()=>{this._toast('Mapping deleted.','success');this._loadList();}).catch(pErr=>this._toast('Delete failed: '+pErr.message,'error'));});}onScopeInput(pValue){clearTimeout(this._scopeDebounce);let tmpValue=pValue==null?'':String(pValue).trim();this._scopeDebounce=setTimeout(()=>{this._API.setScope(tmpValue);this.pict.AppData.Mapping.Scope=tmpValue;this.pict.AppData.Mapping.View='list';this.pict.AppData.Mapping.Editing=null;this._loadList();},300);}setEditingField(pName,pValue){if(!this.pict.AppData.Mapping.Editing)return;this.pict.AppData.Mapping.Editing[pName]=pValue;// Silent — no render(), preserves cursor/selection state.
}refresh(){this._loadList();}// ── Internal ─────────────────────────────────────────────────────
_loadList(){this.pict.AppData.Mapping.View='list';this.pict.AppData.Mapping.LoadState='loading';this.pict.AppData.Mapping.LoadErrorMessage='';this.render();this._API.listMappings().then(pData=>{let tmpRows=pData&&pData.Mappings||[];this.pict.AppData.Mapping.Mappings=tmpRows;if(tmpRows.length===0){let tmpScope=this._API.getScope();this.pict.AppData.Mapping.LoadState='empty';if(tmpScope==='*'){this.pict.AppData.Mapping.EmptyMessage='No mappings yet across any scope. Click + New mapping above to create one, '+'or run a seed harness (e.g. npm run seed-synth-demo) to plant a sample set.';}else if(tmpScope===''){this.pict.AppData.Mapping.EmptyMessage='No mappings in global scope. Set scope to * to see scope-tagged mappings, '+'or click + New mapping above.';}else{this.pict.AppData.Mapping.EmptyMessage='No mappings in scope "'+tmpScope+'". '+'Set scope to * to see all scopes, or click + New mapping above.';}}else{this.pict.AppData.Mapping.LoadState='ready';}this.render();}).catch(pErr=>{this.pict.AppData.Mapping.LoadState='error';this.pict.AppData.Mapping.LoadErrorMessage=pErr.message||String(pErr);this.render();});}_openEditorWith(pRec){let tmpScope=this._API.getScope();let tmpEditing=pRec?Object.assign({},pRec,{MappingConfiguration:typeof pRec.MappingConfiguration==='string'?pRec.MappingConfiguration:JSON.stringify(pRec.MappingConfiguration||{},null,2)}):{Scope:tmpScope,Name:'',Description:'',SourceBeaconName:'',SourceConnectionHash:'',SourceEntity:'',TargetBeaconName:'',TargetConnectionHash:'',TargetEntity:'',MappingConfiguration:DEFAULT_MAPPING_CONFIGURATION_TEXT};this.pict.AppData.Mapping.Editing=tmpEditing;this.pict.AppData.Mapping.EditorError='';this.pict.AppData.Mapping.View='edit';this.render();}_setEditorError(pMessage){this.pict.AppData.Mapping.EditorError=pMessage||'';this.render();}_populateSlots(){let tmpData=this.pict.AppData.Mapping;let tmpView=tmpData.View||'list';let tmpMode=tmpData.Mode||'manage';let tmpShowToolbar=!!tmpData.ShowToolbar;tmpData.Scope=this._API.getScope();tmpData.ToolbarSlot=tmpShowToolbar?[{}]:[];tmpData.BackLinkSlot=tmpView!=='list'?[{}]:[];tmpData.NewButtonSlot=tmpMode==='manage'&&tmpView==='list'?[{}]:[];tmpData.ListSlot=tmpView==='list'?[{}]:[];tmpData.EditSlot=tmpView==='edit'&&tmpData.Editing?[this._buildEditorRecord(tmpData.Editing,tmpData.EditorError)]:[];let tmpState=tmpView==='list'?tmpData.LoadState||'idle':'hidden';tmpData.LoadingSlot=tmpState==='loading'?[{}]:[];tmpData.LoadErrorSlot=tmpState==='error'?[{Message:tmpData.LoadErrorMessage}]:[];tmpData.EmptySlot=tmpState==='empty'?[{Message:tmpData.EmptyMessage}]:[];tmpData.ListBodySlot=tmpState==='ready'?[{}]:[];if(tmpState==='ready'){tmpData.Mappings=(tmpData.Mappings||[]).map(m=>this._decorateMapping(m,tmpMode,tmpData.RunResults));}}_decorateMapping(pMapping,pMode,pRunResults){let tmpID=pMapping.IDMappingConfig;let tmpRunResult=pRunResults&&pRunResults[tmpID]?pRunResults[tmpID]:null;return Object.assign({},pMapping,{NameOrUnnamed:pMapping.Name||'(unnamed)',SourceLabel:(pMapping.SourceBeaconName||'?')+'/'+(pMapping.SourceEntity||'?'),TargetLabel:(pMapping.TargetBeaconName||'?')+'/'+(pMapping.TargetEntity||'?'),ScopeBadgeSlot:pMapping.Scope?[{Scope:pMapping.Scope}]:[],ActionsSlot:pMode==='manage'?this._buildRowActions(tmpID,tmpRunResult):[],ResultSlot:tmpRunResult?[this._buildRunResultRecord(tmpRunResult)]:[]});}_buildRowActions(pID,pRunResult){let tmpRunning=pRunResult&&pRunResult.Status==='Running';return[{IDMappingConfig:pID,Method:'runMapping',Label:tmpRunning?'Running…':'▶ Run',ButtonClass:tmpRunning?'psm-btn-success psm-btn-disabled':'psm-btn-success'},{IDMappingConfig:pID,Method:'openEditor',Label:'Edit',ButtonClass:''},{IDMappingConfig:pID,Method:'deleteMapping',Label:'Delete',ButtonClass:'psm-btn-danger'}];}_buildRunResultRecord(pRunResult){let tmpStatus=pRunResult.Status||'Success';let tmpStats=[];if(tmpStatus==='Success'){for(let i=0;i<RUN_STAT_FIELDS.length;i++){let tmpKey=RUN_STAT_FIELDS[i];if(pRunResult[tmpKey]===undefined||pRunResult[tmpKey]===null)continue;tmpStats.push({Label:tmpKey,Value:String(pRunResult[tmpKey])});}}let tmpName=pRunResult.Hash||'(mapping)';let tmpTitle=tmpStatus==='Error'?'✗  '+tmpName+' — failed':tmpStatus==='Running'?'… '+tmpName+' — running':'✓  '+tmpName+' — completed';let tmpStatusClass=tmpStatus==='Error'?'psm-run-error':tmpStatus==='Running'?'psm-run-running':'psm-run-success';let tmpErrorSlot=tmpStatus==='Error'&&pRunResult.Error?[{Message:pRunResult.Error}]:[];return{Title:tmpTitle,StatusClass:tmpStatusClass,Stats:tmpStats,ErrorSlot:tmpErrorSlot};}_buildEditorRecord(pEditing,pErrorMessage){let tmpIsNew=!pEditing.IDMappingConfig;let tmpSourceFields=SOURCE_EDITOR_FIELDS.map(f=>({Field:f.Field,Label:f.Label,Value:pEditing[f.Field]||''}));let tmpTargetFields=TARGET_EDITOR_FIELDS.map(f=>({Field:f.Field,Label:f.Label,Value:pEditing[f.Field]||''}));return{HeaderTitle:tmpIsNew?'New mapping':'Edit mapping "'+(pEditing.Name||pEditing.IDMappingConfig)+'"',Name:pEditing.Name||'',Scope:pEditing.Scope||'',Description:pEditing.Description||'',SourceFields:tmpSourceFields,TargetFields:tmpTargetFields,MappingConfiguration:pEditing.MappingConfiguration||'',SaveButtonLabel:tmpIsNew?'Create mapping':'Save changes',ErrorSlot:pErrorMessage?[{Message:pErrorMessage}]:[]};}// ── Modal ────────────────────────────────────────────────────────
_modal(){if(!this.pict||!this.pict.views)return null;return this.pict.views['Pict-Section-Modal']||this.pict.views.Modal||null;}_confirm(pMessage,pOptions){let tmpModal=this._modal();if(tmpModal&&typeof tmpModal.confirm==='function'){return tmpModal.confirm(pMessage,pOptions);}this.log.warn('Pict-Section-Mapping: pict-section-modal not present; auto-confirming "'+pMessage+'"');return Promise.resolve(true);}_toast(pMessage,pType){let tmpModal=this._modal();if(tmpModal&&typeof tmpModal.toast==='function'){tmpModal.toast(pMessage,{type:pType||'info'});return;}this.log.info('[pict-section-mapping] '+pMessage);}}module.exports=PictSectionMapping;module.exports.default_configuration=libDefaultConf;module.exports.APIProvider=libAPIProvider;module.exports.DEFAULT_MAPPING_CONFIGURATION=DEFAULT_MAPPING_CONFIGURATION;},{"./Pict-Section-Mapping-CSS.js":32,"./Pict-Section-Mapping-DefaultConfiguration.js":33,"./providers/PictProvider-Mapping-API.js":35,"pict-view":18}],35:[function(require,module,exports){/**
 * Pict-Section-Mapping API Provider
 *
 * REST client for the data-mapper /mapper/mapping* surface.
 * Uses the same active-scope localStorage key as the dashboard
 * and operation sections so a host mounting any combination
 * of them gets one coherent active scope.
 *
 * Bearer-token write gate: when WriteToken is set, POST/PUT/DELETE
 * carry `Authorization: Bearer <token>` to satisfy the data-mapper's
 * DATA_MAPPER_WRITE_TOKEN env-driven gate. GET stays open.
 */'use strict';const SCOPE_STORAGE_KEY='retold.dataMapper.activeScope';class MappingAPIProvider{constructor(pOptions){let tmpOptions=pOptions||{};this._apiBaseUrl=tmpOptions.APIBaseUrl||'/mapper';this._scopeOverride=typeof tmpOptions.Scope==='string'?tmpOptions.Scope:null;this._writeToken=typeof tmpOptions.WriteToken==='string'&&tmpOptions.WriteToken.length>0?tmpOptions.WriteToken:null;}getScope(pCallScope){if(typeof pCallScope==='string')return pCallScope;if(typeof this._scopeOverride==='string')return this._scopeOverride;try{if(typeof localStorage!=='undefined'){let tmpStored=localStorage.getItem(SCOPE_STORAGE_KEY);if(tmpStored!==null)return tmpStored;}}catch(pErr){/* opaque origin or disabled storage — fall through */}// First-load default: show everything. '' would have meant "global
// only", which silently hides scope-tagged seeds (e.g. the synth-
// demo bundle) from a fresh operator browsing the list. The picker
// can still narrow back down to '' or any specific scope.
return'*';}setScope(pScope){try{if(typeof localStorage!=='undefined'){if(pScope)localStorage.setItem(SCOPE_STORAGE_KEY,pScope);else localStorage.removeItem(SCOPE_STORAGE_KEY);}}catch(pErr){/* opaque origin or disabled storage — keep in-memory only */}this._scopeOverride=typeof pScope==='string'?pScope:null;}setWriteToken(pToken){this._writeToken=typeof pToken==='string'&&pToken.length>0?pToken:null;}_fetch(pMethod,pPath,pBody){let tmpOpts={method:pMethod,headers:{}};let tmpIsWrite=pMethod!=='GET'&&pMethod!=='HEAD';if(pBody!==undefined&&pBody!==null){tmpOpts.headers['Content-Type']='application/json';tmpOpts.body=JSON.stringify(pBody);}if(tmpIsWrite&&this._writeToken){tmpOpts.headers['Authorization']='Bearer '+this._writeToken;}return fetch(this._apiBaseUrl+pPath,tmpOpts).then(pRes=>{if(!pRes.ok){return pRes.text().then(pText=>{let tmpMsg=pText&&pText.length<400?pText:'HTTP '+pRes.status;throw new Error(tmpMsg);});}let tmpCT=pRes.headers.get('content-type')||'';if(tmpCT.indexOf('application/json')===0)return pRes.json();return pRes.text();});}_scopeQuery(pScope){let tmpScope=this.getScope(pScope);if(tmpScope==='')return'';return'?scope='+encodeURIComponent(tmpScope);}listMappings(pScope){return this._fetch('GET','/mappings'+this._scopeQuery(pScope));}getMapping(pHashOrID,pScope){return this._fetch('GET','/mapping/'+encodeURIComponent(pHashOrID)+this._scopeQuery(pScope));}saveMapping(pRecord,pScope){let tmpRecord=Object.assign({},pRecord);if(tmpRecord.Scope===undefined)tmpRecord.Scope=this.getScope(pScope);if(tmpRecord.IDMappingConfig){let tmpID=tmpRecord.IDMappingConfig;delete tmpRecord.IDMappingConfig;return this._fetch('PUT','/mapping/'+tmpID,tmpRecord);}return this._fetch('POST','/mappings',tmpRecord);}deleteMapping(pID){return this._fetch('DELETE','/mapping/'+pID);}// Run goes through UV — server route is /mapper/uv/run-mapping/:id.
// The previous implementation pointed at /mapping/:id/run which never
// existed; runs always returned 404.
runMapping(pID){return this._fetch('POST','/uv/run-mapping/'+pID,{});}// Lake-sample peek for editor convenience — render five rows from a
// beacon/connection/entity tuple.
peekTable(pBeaconName,pConnectionHash,pEntity,pPageSize,pPage){return this._fetch('POST','/dashboard/panel-data',{BeaconName:pBeaconName,ConnectionName:pConnectionHash,Endpoint:pEntity,PageSize:pPageSize||5,Page:pPage||0});}}module.exports=MappingAPIProvider;module.exports.SCOPE_STORAGE_KEY=SCOPE_STORAGE_KEY;},{}],36:[function(require,module,exports){/**
 * Pict-Section-Operation CSS
 *
 * All class names prefixed `pso-` (Pict Section Operation) so the
 * section can be mounted into any host app without bleeding into
 * its stylesheet. CSS variables let the host re-theme.
 */'use strict';module.exports=`
.pso-root
{
	--pso-bg:           #0e1a2b;
	--pso-bg-elev:      #0a1525;
	--pso-bg-elev-2:    #0f172a;
	--pso-border:       #1e293b;
	--pso-border-soft:  #0f1c2f;
	--pso-fg:           #f8fafc;
	--pso-fg-soft:      #cbd5e1;
	--pso-fg-mute:      #94a3b8;
	--pso-fg-fade:      #64748b;
	--pso-accent:       #2563eb;
	--pso-accent-fg:    #ffffff;
	--pso-success:      #16a34a;
	--pso-success-fg:   #dcfce7;
	--pso-danger:       #b91c1c;
	--pso-danger-fg:    #fecaca;
	--pso-warning:      #f59e0b;
	--pso-warning-fg:   #fef3c7;

	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	background: var(--pso-bg);
	color: var(--pso-fg);
	min-height: 100%;
}

.pso-toolbar
{
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 10px 16px;
	background: var(--pso-bg-elev);
	border-bottom: 1px solid var(--pso-border);
	flex-wrap: wrap;
}
.pso-toolbar h2 { margin: 0; font-size: 16px; font-weight: 600; }
.pso-toolbar .pso-toolbar-spacer { flex: 1; }
.pso-toolbar label { color: var(--pso-fg-mute); font-size: 12px; display: inline-flex; align-items: center; gap: 6px; }
.pso-toolbar input
{
	background: var(--pso-bg-elev-2);
	color: var(--pso-fg);
	border: 1px solid var(--pso-border);
	padding: 5px 9px;
	border-radius: 4px;
	font-size: 12px;
	font-family: inherit;
}
.pso-toolbar input.pso-scope-input { width: 140px; font-family: monospace; }
.pso-toolbar .pso-scope-hint { color: var(--pso-fg-fade); font-size: 11px; font-style: italic; }
.pso-btn
{
	background: var(--pso-bg-elev-2);
	color: var(--pso-fg-soft);
	border: 1px solid var(--pso-border);
	padding: 5px 11px;
	border-radius: 4px;
	font-size: 12px;
	cursor: pointer;
	text-decoration: none;
	display: inline-flex;
	align-items: center;
	gap: 4px;
}
.pso-btn:hover { background: #1e293b; color: var(--pso-fg); }
.pso-btn.pso-btn-primary { background: var(--pso-accent); border-color: var(--pso-accent); color: var(--pso-accent-fg); }
.pso-btn.pso-btn-primary:hover { background: var(--theme-color-brand-primary-hover, #1d4ed8); }
.pso-btn.pso-btn-success { background: var(--pso-success); border-color: var(--pso-success); color: var(--pso-success-fg); }
.pso-btn.pso-btn-success:hover { background: var(--theme-color-status-success, #15803d); }
.pso-btn.pso-btn-danger { background: transparent; color: var(--pso-danger-fg); border-color: var(--pso-danger); }
.pso-btn.pso-btn-danger:hover { background: var(--pso-danger); color: var(--pso-accent-fg); }
.pso-btn[disabled], .pso-btn.pso-btn-disabled { opacity: 0.5; pointer-events: none; }

.pso-content { padding: 16px; max-width: 1400px; margin: 0 auto; }

/* List view */
.pso-list-wrap { display: flex; flex-direction: column; gap: 12px; }
.pso-list-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.pso-tab
{
	padding: 5px 12px;
	border-radius: 4px;
	font-size: 12px;
	cursor: pointer;
	text-decoration: none;
	background: var(--pso-bg-elev);
	color: var(--pso-fg-soft);
	border: 1px solid var(--pso-border);
	display: inline-flex;
	align-items: center;
	gap: 6px;
}
.pso-tab:hover { background: var(--pso-bg-elev-2); color: var(--pso-fg); }
.pso-tab.pso-tab-active { background: var(--pso-accent); color: var(--pso-accent-fg); border-color: var(--pso-accent); }
.pso-tab .pso-tab-count
{
	font-size: 11px;
	background: rgba(0,0,0,.25);
	color: inherit;
	padding: 0 6px;
	border-radius: 8px;
	font-weight: 600;
}
.pso-list { display: flex; flex-direction: column; gap: 8px; }
.pso-list-row
{
	display: grid;
	grid-template-columns: 1.4fr 1.6fr 100px 2fr auto;
	gap: 12px;
	padding: 10px 14px;
	background: var(--pso-bg-elev);
	border: 1px solid var(--pso-border);
	border-radius: 6px;
	align-items: center;
}
.pso-list-row .pso-row-hash { font-family: monospace; font-size: 13px; color: var(--pso-fg); font-weight: 600; }
.pso-list-row .pso-row-name { color: var(--pso-fg-soft); font-size: 13px; }
.pso-list-row .pso-row-type
{
	font-size: 11px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	padding: 3px 8px;
	border-radius: 3px;
	background: var(--pso-bg-elev-2);
	color: var(--pso-fg-soft);
	border: 1px solid var(--pso-border);
	display: inline-block;
	text-align: center;
}
.pso-list-row .pso-row-type.pso-type-extraction  { color: #93c5fd; border-color: #1e3a8a; }
.pso-list-row .pso-row-type.pso-type-aggregation { color: #fcd34d; border-color: #78350f; }
.pso-list-row .pso-row-type.pso-type-histogram   { color: #c4b5fd; border-color: #4c1d95; }
.pso-list-row .pso-row-type.pso-type-intersection{ color: #fdba74; border-color: #7c2d12; }
.pso-list-row .pso-row-flow { font-size: 11px; color: var(--pso-fg-mute); font-family: monospace; }
.pso-list-row .pso-row-actions { display: flex; gap: 6px; justify-content: flex-end; }
.pso-list-row .pso-row-scope { font-size: 11px; color: var(--pso-fg-fade); font-style: italic; }

.pso-empty, .pso-error
{
	padding: 18px;
	text-align: center;
	color: var(--pso-fg-fade);
	font-size: 13px;
	border: 1px dashed var(--pso-border);
	border-radius: 6px;
	background: var(--pso-bg-elev);
}
.pso-error { color: #f87171; background: #2a1010; border-color: #2a1010; }

/* Editor */
.pso-editor { display: flex; flex-direction: column; gap: 14px; }
.pso-editor-header { display: flex; gap: 12px; align-items: center; }
.pso-editor-header h3 { margin: 0; font-size: 16px; }
.pso-editor-form { display: grid; grid-template-columns: 160px 1fr; gap: 10px 14px; align-items: center; }
.pso-editor-form label { color: var(--pso-fg-mute); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
.pso-editor-form input[type=text], .pso-editor-form select
{
	background: var(--pso-bg-elev-2);
	color: var(--pso-fg);
	border: 1px solid var(--pso-border);
	padding: 6px 10px;
	border-radius: 4px;
	font-size: 13px;
	font-family: inherit;
}
.pso-editor-form .pso-help { color: var(--pso-fg-fade); font-size: 11px; font-style: italic; }
.pso-editor-form textarea
{
	background: var(--pso-bg-elev-2);
	color: var(--pso-fg);
	border: 1px solid var(--pso-border);
	padding: 8px 10px;
	border-radius: 4px;
	font-size: 12px;
	font-family: monospace;
	min-height: 220px;
	resize: vertical;
	width: 100%;
	box-sizing: border-box;
}
.pso-editor-actions { display: flex; gap: 8px; justify-content: flex-end; }
.pso-editor-error { color: #f87171; font-size: 12px; padding: 8px 12px; background: #2a1010; border-radius: 4px; }

.pso-source-target
{
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 14px;
	padding: 12px;
	background: var(--pso-bg-elev-2);
	border: 1px solid var(--pso-border);
	border-radius: 4px;
}
.pso-source-target .pso-st-section h4 { margin: 0 0 8px 0; color: var(--pso-fg-mute); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
.pso-source-target .pso-st-row { display: grid; grid-template-columns: 90px 1fr; gap: 6px; margin-bottom: 6px; align-items: center; }
.pso-source-target .pso-st-row label { color: var(--pso-fg-fade); font-size: 11px; }

.pso-conf-template
{
	background: var(--pso-bg-elev-2);
	border: 1px solid var(--pso-border);
	border-radius: 4px;
	padding: 10px;
	font-size: 11px;
	color: var(--pso-fg-mute);
}
.pso-conf-template strong { color: var(--pso-fg-soft); display: block; margin-bottom: 6px; }
.pso-conf-template code { color: var(--pso-fg); background: var(--pso-bg-elev); padding: 1px 5px; border-radius: 2px; font-size: 11px; }

/* Run result */
.pso-run-result
{
	padding: 14px;
	background: var(--pso-bg-elev);
	border: 1px solid var(--pso-border);
	border-radius: 6px;
	margin-top: 10px;
	font-size: 13px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.pso-run-result h4 { margin: 0; font-size: 14px; color: var(--pso-fg-soft); }
.pso-run-result .pso-run-stats { display: flex; gap: 18px; flex-wrap: wrap; }
.pso-run-result .pso-run-stat { display: flex; flex-direction: column; }
.pso-run-result .pso-run-stat .pso-stat-label { font-size: 10px; color: var(--pso-fg-mute); text-transform: uppercase; letter-spacing: 0.5px; }
.pso-run-result .pso-run-stat .pso-stat-value { font-size: 16px; color: var(--pso-fg); font-family: monospace; font-weight: 600; }
.pso-run-result.pso-run-success { border-color: var(--pso-success); }
.pso-run-result.pso-run-error   { border-color: var(--pso-danger); }
.pso-run-result.pso-run-running { border-color: var(--pso-warning); }
.pso-run-result .pso-run-error-message
{
	color: var(--pso-danger-fg);
	font-family: monospace;
	font-size: 12px;
	white-space: pre-wrap;
}
`;},{}],37:[function(require,module,exports){/**
 * Pict-Section-Operation default configuration.
 *
 * Template-driven view per modules/pict/CLAUDE.md conventions:
 *   - All state lives in pict.AppData.Operation.*
 *   - View switching uses single-element-array slots (ListSlot / EditSlot)
 *     so the parent template iterates a 0-or-1 element array via {~TS:~};
 *     no JS-side conditionals that produce HTML strings.
 *   - All inline handlers reach the section via _Pict.views['Pict-Section-Operation'].method(args).
 *   - Modal interactions go through pict-section-modal (.confirm / .toast / .show).
 */'use strict';const SHELL_TEMPLATE=/*html*/`
<div class="pso-root pso-mode-{~Data:AppData.Operation.Mode~}">
	{~TS:Pict-Section-Operation-Toolbar:AppData.Operation.ToolbarSlot~}
	<div class="pso-content">
		{~TS:Pict-Section-Operation-List:AppData.Operation.ListSlot~}
		{~TS:Pict-Section-Operation-Editor:AppData.Operation.EditSlot~}
	</div>
</div>`;const TOOLBAR_TEMPLATE=/*html*/`
<div class="pso-toolbar">
	<h2>Operations</h2>
	{~TS:Pict-Section-Operation-Toolbar-BackLink:AppData.Operation.BackLinkSlot~}
	<span class="pso-toolbar-spacer"></span>
	<label>scope
		<input type="text" class="pso-scope-input" spellcheck="false" placeholder="(global)"
			value="{~Data:AppData.Operation.Scope~}"
			oninput="_Pict.views['Pict-Section-Operation'].onScopeInput(this.value)" />
		<span class="pso-scope-hint">empty = global • * = all</span>
	</label>
	{~TS:Pict-Section-Operation-Toolbar-NewButton:AppData.Operation.NewButtonSlot~}
</div>`;const TOOLBAR_BACKLINK_TEMPLATE=/*html*/`
<a class="pso-btn" href="javascript:void(0)"
	onclick="_Pict.views['Pict-Section-Operation'].openList()">← All operations</a>`;const TOOLBAR_NEWBUTTON_TEMPLATE=/*html*/`
<a class="pso-btn pso-btn-primary" href="javascript:void(0)"
	onclick="_Pict.views['Pict-Section-Operation'].openEditor(null)">+ New operation</a>`;const LIST_TEMPLATE=/*html*/`
<div class="pso-list-wrap">
	{~TS:Pict-Section-Operation-LoadingState:AppData.Operation.LoadingSlot~}
	{~TS:Pict-Section-Operation-LoadError:AppData.Operation.LoadErrorSlot~}
	{~TS:Pict-Section-Operation-EmptyState:AppData.Operation.EmptySlot~}
	{~TS:Pict-Section-Operation-ListBody:AppData.Operation.ListBodySlot~}
</div>`;const LOADING_TEMPLATE=/*html*/`
<div class="pso-empty">Loading…</div>`;const LOAD_ERROR_TEMPLATE=/*html*/`
<div class="pso-error">Failed to load operations: {~Data:Record.Message~}</div>`;const EMPTY_TEMPLATE=/*html*/`
<div class="pso-empty">{~Data:Record.Message~}</div>`;const LIST_BODY_TEMPLATE=/*html*/`
<div class="pso-list-tabs">
	{~TS:Pict-Section-Operation-Tab:AppData.Operation.Tabs~}
</div>
<div class="pso-list">
	{~TS:Pict-Section-Operation-FilteredEmpty:AppData.Operation.FilteredEmptySlot~}
	{~TS:Pict-Section-Operation-ListRow:AppData.Operation.FilteredOperations~}
</div>`;const TAB_TEMPLATE=/*html*/`
<a class="pso-tab pso-tab-{~Data:Record.ActiveClass~}" href="javascript:void(0)"
	onclick="_Pict.views['Pict-Section-Operation'].selectTab('{~Data:Record.Key~}')">
	{~Data:Record.Label~}<span class="pso-tab-count">{~Data:Record.Count~}</span>
</a>`;const FILTERED_EMPTY_TEMPLATE=/*html*/`
<div class="pso-empty">No operations in this tab. Switch to <strong>All</strong> to see everything.</div>`;const LIST_ROW_TEMPLATE=/*html*/`
<div class="pso-list-row" id="pso-row-{~Data:Record.IDOperationConfig~}">
	<div class="pso-row-hash">{~Data:Record.Hash~}{~TS:Pict-Section-Operation-RowScopeBadge:Record.ScopeBadgeSlot~}</div>
	<div class="pso-row-name">{~Data:Record.NameOrUnnamed~}</div>
	<div><span class="pso-row-type pso-type-{~Data:Record.OperationTypeLower~}">{~Data:Record.OperationType~}</span></div>
	<div class="pso-row-flow">{~Data:Record.SourceLabel~} → {~Data:Record.TargetLabel~}</div>
	<div class="pso-row-actions">{~TS:Pict-Section-Operation-RowAction:Record.ActionsSlot~}</div>
	{~TS:Pict-Section-Operation-RunResult:Record.ResultSlot~}
</div>`;const ROW_SCOPE_BADGE_TEMPLATE=/*html*/`
<span class="pso-row-scope">· {~Data:Record.Scope~}</span>`;const ROW_ACTION_TEMPLATE=/*html*/`
<a class="pso-btn {~Data:Record.ButtonClass~}" href="javascript:void(0)"
	onclick="_Pict.views['Pict-Section-Operation'].{~Data:Record.Method~}({~Data:Record.IDOperationConfig~})">{~Data:Record.Label~}</a>`;const RUN_RESULT_TEMPLATE=/*html*/`
<div class="pso-run-result {~Data:Record.StatusClass~}">
	<h4>{~Data:Record.Title~}</h4>
	{~TS:Pict-Section-Operation-RunErrorMessage:Record.ErrorSlot~}
	{~TS:Pict-Section-Operation-RunStat:Record.Stats~}
</div>`;const RUN_ERROR_TEMPLATE=/*html*/`
<div class="pso-run-error-message">{~Data:Record.Message~}</div>`;const RUN_STAT_TEMPLATE=/*html*/`
<div class="pso-run-stat">
	<span class="pso-stat-label">{~Data:Record.Label~}</span>
	<span class="pso-stat-value">{~Data:Record.Value~}</span>
</div>`;// Editor — the form is fully template-rendered. Inputs use onchange to
// push values back to AppData via setEditingField (no re-render — just
// a silent state update). The Save button reads from AppData.
const EDITOR_TEMPLATE=/*html*/`
<div class="pso-editor">
	<div class="pso-editor-header">
		<h3>{~Data:Record.HeaderTitle~}</h3>
	</div>
	<div class="pso-editor-form">
		<label>Hash</label>
		<input type="text" placeholder="short-identifier"
			value="{~Data:Record.Hash~}"
			{~Data:Record.HashDisabledAttr~}
			onchange="_Pict.views['Pict-Section-Operation'].setEditingField('Hash', this.value)" />

		<label>Scope</label>
		<input type="text" placeholder="(empty = global)"
			value="{~Data:Record.Scope~}"
			onchange="_Pict.views['Pict-Section-Operation'].setEditingField('Scope', this.value)" />

		<label>Name</label>
		<input type="text" placeholder="Human-readable name"
			value="{~Data:Record.Name~}"
			onchange="_Pict.views['Pict-Section-Operation'].setEditingField('Name', this.value)" />

		<label>Description</label>
		<input type="text"
			value="{~Data:Record.Description~}"
			onchange="_Pict.views['Pict-Section-Operation'].setEditingField('Description', this.value)" />

		<label>Type</label>
		<select onchange="_Pict.views['Pict-Section-Operation'].onTypeChange(this.value)">
			{~TS:Pict-Section-Operation-EditorTypeOption:Record.TypeOptions~}
		</select>

		<label>Source ↔ Target</label>
		<div class="pso-source-target">
			<div class="pso-st-section">
				<h4>Source</h4>
				{~TS:Pict-Section-Operation-EditorSTRow:Record.SourceFields~}
			</div>
			<div class="pso-st-section">
				<h4>Target</h4>
				{~TS:Pict-Section-Operation-EditorSTRow:Record.TargetFields~}
			</div>
		</div>

		<label>Configuration (JSON)</label>
		<div>
			<textarea spellcheck="false"
				onchange="_Pict.views['Pict-Section-Operation'].setEditingField('OperationConfiguration', this.value)">{~Data:Record.OperationConfiguration~}</textarea>
			<div class="pso-conf-template">
				<strong>{~Data:Record.OperationType~} shape:</strong>
				<div>{~Data:Record.TypeHelp~}</div>
			</div>
		</div>
	</div>

	{~TS:Pict-Section-Operation-EditorError:Record.ErrorSlot~}

	<div class="pso-editor-actions">
		<a class="pso-btn" href="javascript:void(0)"
			onclick="_Pict.views['Pict-Section-Operation'].openList()">Cancel</a>
		<a class="pso-btn pso-btn-primary" href="javascript:void(0)"
			onclick="_Pict.views['Pict-Section-Operation'].saveEditing()">{~Data:Record.SaveButtonLabel~}</a>
	</div>
</div>`;const EDITOR_TYPE_OPTION_TEMPLATE=/*html*/`
<option value="{~Data:Record.Value~}" {~Data:Record.SelectedAttr~}>{~Data:Record.Label~}</option>`;const EDITOR_ST_ROW_TEMPLATE=/*html*/`
<div class="pso-st-row">
	<label>{~Data:Record.Label~}</label>
	<input type="text" placeholder="{~Data:Record.Field~}"
		value="{~Data:Record.Value~}"
		onchange="_Pict.views['Pict-Section-Operation'].setEditingField('{~Data:Record.Field~}', this.value)" />
</div>`;const EDITOR_ERROR_TEMPLATE=/*html*/`
<div class="pso-editor-error">{~Data:Record.Message~}</div>`;module.exports={ViewIdentifier:'Pict-Section-Operation',DefaultRenderable:'Pict-Section-Operation-Shell',DefaultDestinationAddress:'#Pict-Section-Operation',DefaultTemplateRecordAddress:'AppData.Operation',AutoRender:true,RenderOnLoad:false,// Section-specific (read in the section class):
APIBaseUrl:'/mapper',Mode:'manage',// 'manage' | 'list-only'
ShowToolbar:true,Scope:null,WriteToken:null,// bearer token for POST/PUT/DELETE if DATA_MAPPER_WRITE_TOKEN is set on the server
Templates:[{Hash:'Pict-Section-Operation-Shell',Template:SHELL_TEMPLATE},{Hash:'Pict-Section-Operation-Toolbar',Template:TOOLBAR_TEMPLATE},{Hash:'Pict-Section-Operation-Toolbar-BackLink',Template:TOOLBAR_BACKLINK_TEMPLATE},{Hash:'Pict-Section-Operation-Toolbar-NewButton',Template:TOOLBAR_NEWBUTTON_TEMPLATE},{Hash:'Pict-Section-Operation-List',Template:LIST_TEMPLATE},{Hash:'Pict-Section-Operation-LoadingState',Template:LOADING_TEMPLATE},{Hash:'Pict-Section-Operation-LoadError',Template:LOAD_ERROR_TEMPLATE},{Hash:'Pict-Section-Operation-EmptyState',Template:EMPTY_TEMPLATE},{Hash:'Pict-Section-Operation-ListBody',Template:LIST_BODY_TEMPLATE},{Hash:'Pict-Section-Operation-Tab',Template:TAB_TEMPLATE},{Hash:'Pict-Section-Operation-FilteredEmpty',Template:FILTERED_EMPTY_TEMPLATE},{Hash:'Pict-Section-Operation-ListRow',Template:LIST_ROW_TEMPLATE},{Hash:'Pict-Section-Operation-RowScopeBadge',Template:ROW_SCOPE_BADGE_TEMPLATE},{Hash:'Pict-Section-Operation-RowAction',Template:ROW_ACTION_TEMPLATE},{Hash:'Pict-Section-Operation-RunResult',Template:RUN_RESULT_TEMPLATE},{Hash:'Pict-Section-Operation-RunErrorMessage',Template:RUN_ERROR_TEMPLATE},{Hash:'Pict-Section-Operation-RunStat',Template:RUN_STAT_TEMPLATE},{Hash:'Pict-Section-Operation-Editor',Template:EDITOR_TEMPLATE},{Hash:'Pict-Section-Operation-EditorTypeOption',Template:EDITOR_TYPE_OPTION_TEMPLATE},{Hash:'Pict-Section-Operation-EditorSTRow',Template:EDITOR_ST_ROW_TEMPLATE},{Hash:'Pict-Section-Operation-EditorError',Template:EDITOR_ERROR_TEMPLATE}],Renderables:[{RenderableHash:'Pict-Section-Operation-Shell',TemplateHash:'Pict-Section-Operation-Shell',TemplateRecordAddress:'AppData.Operation',DestinationAddress:'#Pict-Section-Operation',RenderMethod:'replace'}]};},{}],38:[function(require,module,exports){/**
 * Pict-Section-Operation
 *
 * Embeddable Pict view for Operation CRUD + Run, surfacing the
 * retold-data-mapper /mapper/operations* REST API.
 *
 * Template-driven per modules/pict/CLAUDE.md:
 *   - All state lives in pict.AppData.Operation.*
 *   - Templates + Renderables (no document.createElement, no .onclick closures
 *     attached in JS — every handler is inline in the template HTML and reaches
 *     the section via _Pict.views['Pict-Section-Operation'].method(args)).
 *   - View switching uses single-element-array slots driven by {~TS:~}.
 *   - Modal interactions go through pict-section-modal (the host's Modal view);
 *     no native window.confirm / alert / prompt anywhere.
 *
 * Modes:
 *   `manage`     full CRUD (default)
 *   `list-only`  list-only — Run/Edit/Delete + the New button are suppressed.
 *
 * Public API (called by host apps and inline template handlers):
 *   openList()
 *   openEditor(pRecOrID)        // null = new
 *   saveEditing()
 *   runOperation(pIDOperationConfig)
 *   deleteOperation(pIDOperationConfig)
 *   selectTab(pTabKey)
 *   onScopeInput(pValue)
 *   setEditingField(pName, pValue)
 *   onTypeChange(pNewType)
 *   refresh()
 *
 * The active-scope localStorage key is shared with pict-section-mapping
 * and pict-section-dashboard, so a host that mounts more than one gets a
 * single coherent scope context.
 */'use strict';const libPictView=require('pict-view');const libDefaultConf=require('./Pict-Section-Operation-DefaultConfiguration.js');const libCSS=require('./Pict-Section-Operation-CSS.js');const libAPIProvider=require('./providers/PictProvider-Operation-API.js');const KNOWN_TYPES=['Extraction','Aggregation','Histogram','Intersection'];const DEFAULT_CONF_BY_TYPE={Extraction:{Filter:{'/* column */':'/* value */'},Columns:['/* column-to-include */']},Aggregation:{GroupBy:['/* clustering-column */'],Aggregates:[{As:'/* AliasName */',Op:'COUNT',Column:'*'}]},Histogram:{Column:'/* column-to-bucket */',Buckets:10},Intersection:{LeftEntity:'/* other-entity-name */',JoinKey:'/* shared-column */',ResultColumns:[]}};const TYPE_HELP={Extraction:'Filter (where-clause) + Columns (select-list). Each row in the source that matches the filter becomes a row in the target.',Aggregation:'GroupBy (clustering keys) + Aggregates (COUNT/SUM/AVG/MIN/MAX over a Column, output as As). One row per unique GroupBy combination.',Histogram:'Bucket counts for a Column. The runner uses BucketKind (DateMonth/DateDay/DateYear/NumericRange) to decide bucketing strategy.',Intersection:'Join the source against another entity by JoinKey, project ResultColumns. Filters and OrderBy are honored.'};const SCAFFOLD_TEXT_BY_TYPE=function(){let tmpResult={};let tmpKeys=Object.keys(DEFAULT_CONF_BY_TYPE);for(let i=0;i<tmpKeys.length;i++){tmpResult[tmpKeys[i]]=JSON.stringify(DEFAULT_CONF_BY_TYPE[tmpKeys[i]],null,2);}return tmpResult;}();const SCAFFOLD_TEXT_VALUES=Object.values(SCAFFOLD_TEXT_BY_TYPE);const RUN_STAT_FIELDS=['RowsRead','GroupsBuilt','RowsWritten','Errors','TargetTable','ElapsedMs'];const SOURCE_EDITOR_FIELDS=[{Field:'SourceBeaconName',Label:'Beacon'},{Field:'SourceConnectionHash',Label:'Connection'},{Field:'SourceEntity',Label:'Entity'}];const TARGET_EDITOR_FIELDS=[{Field:'TargetBeaconName',Label:'Beacon'},{Field:'TargetConnectionHash',Label:'Connection'},{Field:'TargetTable',Label:'Table'}];class PictSectionOperation extends libPictView{constructor(pFable,pOptions,pServiceHash){let tmpOptions=Object.assign({},libDefaultConf,pOptions||{});super(pFable,tmpOptions,pServiceHash);this._API=new libAPIProvider({APIBaseUrl:this.options.APIBaseUrl,Scope:this.options.Scope,WriteToken:this.options.WriteToken});// CSS registration via the documented CSSMap API. Idempotent on hash.
if(this.pict&&this.pict.CSSMap&&typeof this.pict.CSSMap.addCSS==='function'){this.pict.CSSMap.addCSS('Pict-Section-Operation-CSS',libCSS,500);}// Seed the AppData shape this section reads from. Done in the
// constructor (rather than a lifecycle hook) so a host that calls
// methods like `setScope()` before the first render still hits a
// consistent shape.
this._seedAppData();// Debounce token for the scope input (CLAUDE.md says no
// addEventListener; the debounce lives in the public method).
this._scopeDebounce=null;}// ── Initialization ───────────────────────────────────────────────
_seedAppData(){if(!this.pict.AppData)this.pict.AppData={};this.pict.AppData.Operation=Object.assign({Mode:this.options.Mode||'manage',ShowToolbar:!!this.options.ShowToolbar,Scope:this._API.getScope(),View:'list',// 'list' | 'edit'
CurrentTab:'All',Operations:[],FilteredOperations:[],Tabs:[],Editing:null,EditorError:'',LoadState:'idle',// 'idle' | 'loading' | 'error' | 'empty' | 'ready'
LoadErrorMessage:'',EmptyMessage:'',RunResults:{},// keyed by IDOperationConfig
// Slots populated by onBeforeRender — do not write directly.
ToolbarSlot:[],BackLinkSlot:[],NewButtonSlot:[],ListSlot:[],EditSlot:[],LoadingSlot:[],LoadErrorSlot:[],EmptySlot:[],ListBodySlot:[],FilteredEmptySlot:[]},this.pict.AppData.Operation||{});}// ── Lifecycle ────────────────────────────────────────────────────
onAfterInitialize(){// First render kicks off the list load; subsequent reloads come
// from refresh() / scope changes / save+delete callbacks.
this._loadList();return super.onAfterInitialize();}onBeforeRender(pRenderable,pAddress,pRecord,pContent){this._populateSlots();return super.onBeforeRender(pRenderable,pAddress,pRecord,pContent);}onAfterRender(pRenderable,pAddress,pRecord,pContent){this.pict.CSSMap.injectCSS();return super.onAfterRender(pRenderable,pAddress,pRecord,pContent);}// ── Public API (called from inline template handlers + host apps) ────
openList(){this.pict.AppData.Operation.View='list';this.pict.AppData.Operation.Editing=null;this.pict.AppData.Operation.EditorError='';this._loadList();}openEditor(pRecOrID){// pRecOrID may be: null (new), a record object, or an integer
// IDOperationConfig (from inline onclick handlers, where the
// argument arrives as a number after template substitution).
if(pRecOrID==null){this._openEditorWith(null);return;}if(typeof pRecOrID==='object'){this._openEditorWith(pRecOrID);return;}// Numeric ID — look up the loaded record.
let tmpID=parseInt(pRecOrID,10);let tmpFound=this.pict.AppData.Operation.Operations.find(r=>r.IDOperationConfig===tmpID);this._openEditorWith(tmpFound||null);}saveEditing(){let tmpRec=this.pict.AppData.Operation.Editing;if(!tmpRec){this._toast('Nothing to save.','error');return;}if(!tmpRec.Hash||!tmpRec.Hash.trim()){this._setEditorError('Hash is required.');return;}let tmpConfRaw=typeof tmpRec.OperationConfiguration==='string'?tmpRec.OperationConfiguration:JSON.stringify(tmpRec.OperationConfiguration||{},null,2);let tmpConfParsed;try{tmpConfParsed=JSON.parse(tmpConfRaw);}catch(pErr){this._setEditorError('Configuration JSON parse error: '+pErr.message);return;}let tmpIsNew=!tmpRec.IDOperationConfig;let tmpPayload=Object.assign({},tmpRec,{OperationConfiguration:tmpConfParsed});this._API.saveOperation(tmpPayload).then(()=>{this._toast(tmpIsNew?'Operation created.':'Operation saved.','success');this.openList();}).catch(pErr=>this._setEditorError(pErr.message));}runOperation(pIDOperationConfig){let tmpID=parseInt(pIDOperationConfig,10);if(!tmpID){this._toast('Run failed: missing IDOperationConfig','error');return;}let tmpOp=this.pict.AppData.Operation.Operations.find(r=>r.IDOperationConfig===tmpID);let tmpHash=tmpOp?tmpOp.Hash:'id '+tmpID;// Mark this row as running so onBeforeRender's slot-builder can
// flip the button state on next render.
this.pict.AppData.Operation.RunResults[tmpID]={Status:'Running'};this.render();this._API.runOperation(tmpID).then(pResult=>{this.pict.AppData.Operation.RunResults[tmpID]=Object.assign({},pResult||{},{Status:'Success',Hash:tmpHash});this.render();}).catch(pErr=>{this.pict.AppData.Operation.RunResults[tmpID]={Status:'Error',Hash:tmpHash,Error:pErr.message};this.render();});}deleteOperation(pIDOperationConfig){let tmpID=parseInt(pIDOperationConfig,10);if(!tmpID){this._toast('Delete failed: missing IDOperationConfig','error');return;}let tmpOp=this.pict.AppData.Operation.Operations.find(r=>r.IDOperationConfig===tmpID);let tmpLabel=tmpOp?tmpOp.Name||tmpOp.Hash:'operation '+tmpID;this._confirm('Delete operation "'+tmpLabel+'"? This cannot be undone.',{title:'Delete operation?',confirmLabel:'Delete',cancelLabel:'Cancel',dangerous:true}).then(pOk=>{if(!pOk)return;this._API.deleteOperation(tmpID).then(()=>{this._toast('Operation deleted.','success');this._loadList();}).catch(pErr=>this._toast('Delete failed: '+pErr.message,'error'));});}selectTab(pTabKey){this.pict.AppData.Operation.CurrentTab=String(pTabKey||'All');this.render();}onScopeInput(pValue){// Debounce 300ms so typing doesn't fire a request per keystroke.
clearTimeout(this._scopeDebounce);let tmpValue=pValue==null?'':String(pValue).trim();this._scopeDebounce=setTimeout(()=>{this._API.setScope(tmpValue);this.pict.AppData.Operation.Scope=tmpValue;this.pict.AppData.Operation.View='list';this.pict.AppData.Operation.Editing=null;this._loadList();},300);}setEditingField(pName,pValue){if(!this.pict.AppData.Operation.Editing)return;this.pict.AppData.Operation.Editing[pName]=pValue;// Silent update — no render(). Re-rendering on every keystroke
// would clobber the input's cursor + selection state.
}onTypeChange(pNewType){if(!this.pict.AppData.Operation.Editing)return;let tmpNew=String(pNewType||'Extraction');this.pict.AppData.Operation.Editing.OperationType=tmpNew;// Reseed the JSON config if it currently matches one of the known
// scaffolds (i.e. the user hasn't customized it).
let tmpCurrent=(this.pict.AppData.Operation.Editing.OperationConfiguration||'').trim();if(!tmpCurrent||SCAFFOLD_TEXT_VALUES.indexOf(tmpCurrent)>=0){this.pict.AppData.Operation.Editing.OperationConfiguration=SCAFFOLD_TEXT_BY_TYPE[tmpNew]||'';}this.render();}refresh(){this._loadList();}// ── Internal helpers ─────────────────────────────────────────────
_loadList(){this.pict.AppData.Operation.View='list';this.pict.AppData.Operation.LoadState='loading';this.pict.AppData.Operation.LoadErrorMessage='';this.render();this._API.listOperations().then(pData=>{let tmpRows=pData&&pData.Operations||[];this.pict.AppData.Operation.Operations=tmpRows;if(tmpRows.length===0){let tmpScope=this._API.getScope();this.pict.AppData.Operation.LoadState='empty';this.pict.AppData.Operation.EmptyMessage='No operations in '+(tmpScope===''?'global scope':'scope "'+tmpScope+'"')+'. Use scope=* to see all.';}else{this.pict.AppData.Operation.LoadState='ready';}this.render();}).catch(pErr=>{this.pict.AppData.Operation.LoadState='error';this.pict.AppData.Operation.LoadErrorMessage=pErr.message||String(pErr);this.render();});}_openEditorWith(pRec){let tmpScope=this._API.getScope();let tmpEditing=pRec?Object.assign({},pRec,{OperationConfiguration:typeof pRec.OperationConfiguration==='string'?pRec.OperationConfiguration:JSON.stringify(pRec.OperationConfiguration||{},null,2)}):{Hash:'',Scope:tmpScope,Name:'',Description:'',OperationType:'Extraction',SourceBeaconName:'',SourceConnectionHash:'',SourceEntity:'',TargetBeaconName:'',TargetConnectionHash:'',TargetTable:'',OperationConfiguration:SCAFFOLD_TEXT_BY_TYPE.Extraction};this.pict.AppData.Operation.Editing=tmpEditing;this.pict.AppData.Operation.EditorError='';this.pict.AppData.Operation.View='edit';this.render();}_setEditorError(pMessage){this.pict.AppData.Operation.EditorError=pMessage||'';this.render();}// ── Slot population (the bridge from state to template) ──────────
_populateSlots(){let tmpData=this.pict.AppData.Operation;let tmpView=tmpData.View||'list';let tmpMode=tmpData.Mode||'manage';let tmpShowToolbar=!!tmpData.ShowToolbar;tmpData.Scope=this._API.getScope();// Toolbar: 0 or 1 element array (controls whether toolbar renders at all).
tmpData.ToolbarSlot=tmpShowToolbar?[{}]:[];// Toolbar's back link — only when not in list view.
tmpData.BackLinkSlot=tmpView!=='list'?[{}]:[];// Toolbar's "+ New" button — only in manage mode + list view.
tmpData.NewButtonSlot=tmpMode==='manage'&&tmpView==='list'?[{}]:[];// Body slots — exactly one of ListSlot / EditSlot is non-empty.
tmpData.ListSlot=tmpView==='list'?[{}]:[];tmpData.EditSlot=tmpView==='edit'&&tmpData.Editing?[this._buildEditorRecord(tmpData.Editing,tmpData.EditorError)]:[];// List-state slots — exactly one of LoadingSlot / LoadErrorSlot /
// EmptySlot / ListBodySlot is non-empty when in list view.
let tmpState=tmpView==='list'?tmpData.LoadState||'idle':'hidden';tmpData.LoadingSlot=tmpState==='loading'?[{}]:[];tmpData.LoadErrorSlot=tmpState==='error'?[{Message:tmpData.LoadErrorMessage}]:[];tmpData.EmptySlot=tmpState==='empty'?[{Message:tmpData.EmptyMessage}]:[];tmpData.ListBodySlot=tmpState==='ready'?[{}]:[];// Filtered operations + per-row decoration.
if(tmpState==='ready'){tmpData.Tabs=this._buildTabs(tmpData.Operations,tmpData.CurrentTab);tmpData.FilteredOperations=this._buildFilteredOperations(tmpData);tmpData.FilteredEmptySlot=tmpData.FilteredOperations.length===0?[{}]:[];}else{tmpData.Tabs=[];tmpData.FilteredOperations=[];tmpData.FilteredEmptySlot=[];}}_buildTabs(pOperations,pCurrentTab){let tmpCounts={All:pOperations.length};for(let i=0;i<KNOWN_TYPES.length;i++)tmpCounts[KNOWN_TYPES[i]]=0;for(let i=0;i<pOperations.length;i++){let tmpType=pOperations[i].OperationType;if(tmpType in tmpCounts)tmpCounts[tmpType]++;}let tmpKeys=['All'].concat(KNOWN_TYPES);let tmpResult=[];for(let i=0;i<tmpKeys.length;i++){let tmpKey=tmpKeys[i];tmpResult.push({Key:tmpKey,Label:tmpKey,Count:tmpCounts[tmpKey]||0,ActiveClass:tmpKey===pCurrentTab?'active':'inactive'});}return tmpResult;}_buildFilteredOperations(pData){let tmpMode=pData.Mode||'manage';let tmpCurrentTab=pData.CurrentTab||'All';let tmpResult=[];for(let i=0;i<pData.Operations.length;i++){let tmpOp=pData.Operations[i];if(tmpCurrentTab!=='All'&&tmpOp.OperationType!==tmpCurrentTab)continue;tmpResult.push(this._decorateOperation(tmpOp,tmpMode,pData.RunResults));}return tmpResult;}_decorateOperation(pOp,pMode,pRunResults){let tmpID=pOp.IDOperationConfig;let tmpRunResult=pRunResults&&pRunResults[tmpID]?pRunResults[tmpID]:null;return Object.assign({},pOp,{NameOrUnnamed:pOp.Name||'(unnamed)',OperationTypeLower:String(pOp.OperationType||'').toLowerCase(),SourceLabel:(pOp.SourceBeaconName||'?')+'/'+(pOp.SourceEntity||'?'),TargetLabel:(pOp.TargetBeaconName||'?')+'/'+(pOp.TargetTable||'?'),ScopeBadgeSlot:pOp.Scope?[{Scope:pOp.Scope}]:[],ActionsSlot:pMode==='manage'?this._buildRowActions(tmpID,tmpRunResult):[],ResultSlot:tmpRunResult?[this._buildRunResultRecord(tmpRunResult)]:[]});}_buildRowActions(pID,pRunResult){let tmpRunning=pRunResult&&pRunResult.Status==='Running';return[{IDOperationConfig:pID,Method:'runOperation',Label:tmpRunning?'Running…':'▶ Run',ButtonClass:tmpRunning?'pso-btn-success pso-btn-disabled':'pso-btn-success'},{IDOperationConfig:pID,Method:'openEditor',Label:'Edit',ButtonClass:''},{IDOperationConfig:pID,Method:'deleteOperation',Label:'Delete',ButtonClass:'pso-btn-danger'}];}_buildRunResultRecord(pRunResult){let tmpStatus=pRunResult.Status||'Success';let tmpStats=[];if(tmpStatus==='Success'||!pRunResult.Error&&tmpStatus!=='Error'){for(let i=0;i<RUN_STAT_FIELDS.length;i++){let tmpKey=RUN_STAT_FIELDS[i];if(pRunResult[tmpKey]===undefined||pRunResult[tmpKey]===null)continue;tmpStats.push({Label:tmpKey,Value:String(pRunResult[tmpKey])});}}let tmpHash=pRunResult.Hash||'(operation)';let tmpTitle=tmpStatus==='Error'?'✗  '+tmpHash+' — failed':tmpStatus==='Running'?'… '+tmpHash+' — running':'✓  '+tmpHash+' — completed';let tmpStatusClass=tmpStatus==='Error'?'pso-run-error':tmpStatus==='Running'?'pso-run-running':'pso-run-success';let tmpErrorSlot=tmpStatus==='Error'&&pRunResult.Error?[{Message:pRunResult.Error}]:[];return{Title:tmpTitle,StatusClass:tmpStatusClass,Stats:tmpStats,ErrorSlot:tmpErrorSlot};}_buildEditorRecord(pEditing,pErrorMessage){let tmpIsNew=!pEditing.IDOperationConfig;let tmpType=pEditing.OperationType||'Extraction';let tmpTypeOptions=[];for(let i=0;i<KNOWN_TYPES.length;i++){let tmpKey=KNOWN_TYPES[i];tmpTypeOptions.push({Value:tmpKey,Label:tmpKey,SelectedAttr:tmpKey===tmpType?'selected':''});}let tmpSourceFields=SOURCE_EDITOR_FIELDS.map(f=>({Field:f.Field,Label:f.Label,Value:pEditing[f.Field]||''}));let tmpTargetFields=TARGET_EDITOR_FIELDS.map(f=>({Field:f.Field,Label:f.Label,Value:pEditing[f.Field]||''}));return{HeaderTitle:tmpIsNew?'New operation':'Edit operation "'+pEditing.Hash+'"',Hash:pEditing.Hash||'',HashDisabledAttr:tmpIsNew?'':'disabled',Scope:pEditing.Scope||'',Name:pEditing.Name||'',Description:pEditing.Description||'',OperationType:tmpType,TypeOptions:tmpTypeOptions,SourceFields:tmpSourceFields,TargetFields:tmpTargetFields,OperationConfiguration:pEditing.OperationConfiguration||'',TypeHelp:TYPE_HELP[tmpType]||'',SaveButtonLabel:tmpIsNew?'Create operation':'Save changes',ErrorSlot:pErrorMessage?[{Message:pErrorMessage}]:[]};}// ── Modal access (pict-section-modal — never native popups) ──────
_modal(){// Section is registered as 'Pict-Section-Modal' (per CLAUDE.md examples).
// Hosts that haven't mounted a modal section degrade gracefully —
// inline confirms become "auto-confirmed", toasts log to console.
// Native window.confirm/alert/prompt are NEVER used.
if(!this.pict||!this.pict.views)return null;return this.pict.views['Pict-Section-Modal']||this.pict.views.Modal||null;}_confirm(pMessage,pOptions){let tmpModal=this._modal();if(tmpModal&&typeof tmpModal.confirm==='function'){return tmpModal.confirm(pMessage,pOptions);}// Without a modal section, log the prompt and auto-confirm. The host
// has chosen not to mount a modal; the alternative (blocking
// window.confirm) is forbidden by CLAUDE.md.
this.log.warn('Pict-Section-Operation: pict-section-modal not present; auto-confirming "'+pMessage+'"');return Promise.resolve(true);}_toast(pMessage,pType){let tmpModal=this._modal();if(tmpModal&&typeof tmpModal.toast==='function'){tmpModal.toast(pMessage,{type:pType||'info'});return;}this.log.info('[pict-section-operation] '+pMessage);}}module.exports=PictSectionOperation;module.exports.default_configuration=libDefaultConf;module.exports.APIProvider=libAPIProvider;module.exports.KNOWN_TYPES=KNOWN_TYPES;module.exports.DEFAULT_CONF_BY_TYPE=DEFAULT_CONF_BY_TYPE;module.exports.TYPE_HELP=TYPE_HELP;},{"./Pict-Section-Operation-CSS.js":36,"./Pict-Section-Operation-DefaultConfiguration.js":37,"./providers/PictProvider-Operation-API.js":39,"pict-view":18}],39:[function(require,module,exports){/**
 * Pict-Section-Operation API Provider
 *
 * Thin REST client over the data-mapper /mapper/operation* surface.
 * Centralizes scope handling: reads from localStorage by default
 * (key shared with pict-section-mapping and pict-section-dashboard),
 * can be overridden per section via constructor option, or per call.
 *
 * Bearer-token write gate: when a `WriteToken` is provided (matching
 * the data-mapper's DATA_MAPPER_WRITE_TOKEN env), the provider
 * injects `Authorization: Bearer <token>` on POST/PUT/DELETE.
 * GET stays open per the data-mapper's gate convention.
 */'use strict';const SCOPE_STORAGE_KEY='retold.dataMapper.activeScope';class OperationAPIProvider{constructor(pOptions){let tmpOptions=pOptions||{};this._apiBaseUrl=tmpOptions.APIBaseUrl||'/mapper';this._scopeOverride=typeof tmpOptions.Scope==='string'?tmpOptions.Scope:null;this._writeToken=typeof tmpOptions.WriteToken==='string'&&tmpOptions.WriteToken.length>0?tmpOptions.WriteToken:null;}getScope(pCallScope){if(typeof pCallScope==='string')return pCallScope;if(typeof this._scopeOverride==='string')return this._scopeOverride;// localStorage access can throw "SecurityError: localStorage is not
// available for opaque origins" in some sandbox/test environments,
// so guard with try/catch rather than just `typeof !== 'undefined'`.
try{if(typeof localStorage!=='undefined'){let tmpStored=localStorage.getItem(SCOPE_STORAGE_KEY);if(tmpStored!==null)return tmpStored;}}catch(pErr){/* opaque origin or disabled storage — fall through */}return'';}setScope(pScope){try{if(typeof localStorage!=='undefined'){if(pScope)localStorage.setItem(SCOPE_STORAGE_KEY,pScope);else localStorage.removeItem(SCOPE_STORAGE_KEY);}}catch(pErr){/* opaque origin or disabled storage — keep in-memory only */}this._scopeOverride=typeof pScope==='string'?pScope:null;}setWriteToken(pToken){this._writeToken=typeof pToken==='string'&&pToken.length>0?pToken:null;}_fetch(pMethod,pPath,pBody){let tmpOpts={method:pMethod,headers:{}};let tmpIsWrite=pMethod!=='GET'&&pMethod!=='HEAD';if(pBody!==undefined&&pBody!==null){tmpOpts.headers['Content-Type']='application/json';tmpOpts.body=JSON.stringify(pBody);}// Bearer-token injection on writes when configured. Server's
// DATA_MAPPER_WRITE_TOKEN gate (Phase 2b hardening) requires
// `Authorization: Bearer <token>` on every non-GET to /mapper/*.
if(tmpIsWrite&&this._writeToken){tmpOpts.headers['Authorization']='Bearer '+this._writeToken;}return fetch(this._apiBaseUrl+pPath,tmpOpts).then(pRes=>{if(!pRes.ok){return pRes.text().then(pText=>{let tmpMsg=pText&&pText.length<400?pText:'HTTP '+pRes.status;throw new Error(tmpMsg);});}let tmpCT=pRes.headers.get('content-type')||'';if(tmpCT.indexOf('application/json')===0)return pRes.json();return pRes.text();});}_scopeQuery(pScope){let tmpScope=this.getScope(pScope);if(tmpScope==='')return'';return'?scope='+encodeURIComponent(tmpScope);}listOperations(pScope){return this._fetch('GET','/operations'+this._scopeQuery(pScope));}getOperation(pHash,pScope){return this._fetch('GET','/operation/'+encodeURIComponent(pHash)+this._scopeQuery(pScope));}saveOperation(pRecord,pScope){let tmpRecord=Object.assign({},pRecord);if(tmpRecord.Scope===undefined)tmpRecord.Scope=this.getScope(pScope);if(tmpRecord.IDOperationConfig){let tmpID=tmpRecord.IDOperationConfig;delete tmpRecord.IDOperationConfig;return this._fetch('PUT','/operation/'+tmpID,tmpRecord);}return this._fetch('POST','/operations',tmpRecord);}deleteOperation(pID){return this._fetch('DELETE','/operation/'+pID);}// Run goes through UV — server route is /mapper/uv/run-operation/:id
// (Phase 2b). The previous implementation pointed at /operation/:id/run
// which never existed, so runs always returned a 404.
runOperation(pID){return this._fetch('POST','/uv/run-operation/'+pID,{});}// Lake-sample peek — same surface used by the dashboard panel data
// fetch. Renders five rows from a beacon/connection/table tuple so the
// section can show a "what does this target table look like?" preview.
peekTable(pBeaconName,pConnectionHash,pEntity,pPageSize,pPage){return this._fetch('POST','/dashboard/panel-data',{BeaconName:pBeaconName,ConnectionName:pConnectionHash,Endpoint:pEntity,PageSize:pPageSize||5,Page:pPage||0});}}module.exports=OperationAPIProvider;module.exports.SCOPE_STORAGE_KEY=SCOPE_STORAGE_KEY;},{}],40:[function(require,module,exports){/**
 * DataMapper BeaconBrowser View
 *
 * Two side-by-side selector rows (source + target): beacon → connection →
 * entity dropdowns. Dispatches happen via the MapperAPI provider; this view
 * just reads state and emits click/change events.
 */const libPictView=require('pict-view');const _ViewConfiguration={ViewIdentifier:'Mapper-BeaconBrowser',DefaultRenderable:'Mapper-BeaconBrowser-Content',DefaultDestinationAddress:'#DataMapper-BeaconBrowser-Slot',AutoRender:false,CSS:/*css*/`
			.beacon-browser { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 12px 16px; margin-bottom: 12px; }
			.bb-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
			.bb-row:last-child { margin-bottom: 0; }
			.bb-label { width: 64px; color: #8b949e; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
			.bb-divider { height: 1px; background: #30363d; margin: 10px 0; }
		`,Templates:[{Hash:'Mapper-BeaconBrowser-Template',Template:/*html*/`
<div class="beacon-browser">
	<div class="mapper-section-title">Beacon &amp; Entity Selection</div>
	<div class="bb-row">
		<span class="bb-label">Source</span>
		<select id="DataMapper-Source-Beacon"
			onchange="_Pict.views['Mapper-BeaconBrowser'].onSourceBeacon(this.value)">
			<option value="">— beacon —</option>
			{~TS:Mapper-BeaconBrowser-BeaconOpt:AppData.Mapper.SourceBeacons~}
		</select>
		<select id="DataMapper-Source-Connection"
			onchange="_Pict.views['Mapper-BeaconBrowser'].onSourceConnection(this.value)">
			<option value="">— connection —</option>
			{~TS:Mapper-BeaconBrowser-ConnOpt:AppData.Mapper.SourceConnectionsForTemplate~}
		</select>
		<select id="DataMapper-Source-Entity"
			onchange="_Pict.views['Mapper-BeaconBrowser'].onSourceEntity(this.value)">
			<option value="">— entity —</option>
			{~TS:Mapper-BeaconBrowser-EntityOpt:AppData.Mapper.SourceEntitiesForTemplate~}
		</select>
	</div>
	<div class="bb-divider"></div>
	<div class="bb-row">
		<span class="bb-label">Target</span>
		<select id="DataMapper-Target-Beacon"
			onchange="_Pict.views['Mapper-BeaconBrowser'].onTargetBeacon(this.value)">
			<option value="">— beacon —</option>
			{~TS:Mapper-BeaconBrowser-BeaconOpt:AppData.Mapper.TargetBeacons~}
		</select>
		<select id="DataMapper-Target-Connection"
			onchange="_Pict.views['Mapper-BeaconBrowser'].onTargetConnection(this.value)">
			<option value="">— connection —</option>
			{~TS:Mapper-BeaconBrowser-ConnOpt:AppData.Mapper.TargetConnectionsForTemplate~}
		</select>
		<select id="DataMapper-Target-Entity"
			onchange="_Pict.views['Mapper-BeaconBrowser'].onTargetEntity(this.value)">
			<option value="">— entity —</option>
			{~TS:Mapper-BeaconBrowser-EntityOpt:AppData.Mapper.TargetEntitiesForTemplate~}
		</select>
	</div>
</div>`},{Hash:'Mapper-BeaconBrowser-BeaconOpt',Template:/*html*/`<option value="{~D:Record.Name~}" {~D:Record.SelectedAttr~}>{~D:Record.Name~}</option>`},{Hash:'Mapper-BeaconBrowser-ConnOpt',Template:/*html*/`<option value="{~D:Record.IDBeaconConnection~}" {~D:Record.SelectedAttr~}>#{~D:Record.IDBeaconConnection~} {~D:Record.Name~} ({~D:Record.Type~})</option>`},{Hash:'Mapper-BeaconBrowser-EntityOpt',Template:/*html*/`<option value="{~D:Record.TableName~}" {~D:Record.SelectedAttr~}>{~D:Record.TableName~} ({~D:Record.ColumnCount~} cols)</option>`}],Renderables:[{RenderableHash:'Mapper-BeaconBrowser-Content',TemplateHash:'Mapper-BeaconBrowser-Template',ContentDestinationAddress:'#DataMapper-BeaconBrowser-Slot',RenderMethod:'replace'}]};class PictViewMapperBeaconBrowser extends libPictView{constructor(pFable,pOptions,pServiceHash){super(pFable,pOptions,pServiceHash);}// ── Inline-handler dispatchers (called from <select onchange="…">) ──
//
// Per modules/pict/CLAUDE.md, listeners attached via addEventListener
// in `onAfterRender` get thrown away on the next render(); inline
// `onchange=` handlers in the template HTML survive every re-render
// because they live in the template-emitted markup. Wire each select's
// onchange directly to one of these methods.
onSourceBeacon(pValue){this.pict.providers.MapperAPI.loadSourceConnections(pValue);}onSourceConnection(pValue){let tmpID=parseInt(pValue,10);if(tmpID)this.pict.providers.MapperAPI.introspectSource(tmpID);}onSourceEntity(pValue){this.pict.providers.MapperAPI.setSourceEntity(pValue);}onTargetBeacon(pValue){this.pict.providers.MapperAPI.loadTargetConnections(pValue);}onTargetConnection(pValue){let tmpID=parseInt(pValue,10);if(tmpID)this.pict.providers.MapperAPI.introspectTarget(tmpID);}onTargetEntity(pValue){this.pict.providers.MapperAPI.setTargetEntity(pValue);}}module.exports=PictViewMapperBeaconBrowser;module.exports.default_configuration=_ViewConfiguration;},{"pict-view":18}],41:[function(require,module,exports){/**
 * DataMapper FieldMapper View
 *
 * Three-column layout: source fields | mappings | target fields. Click a
 * source field, then click a target field, to create a mapping. Drag+drop
 * from source to target works too.
 */const libPictView=require('pict-view');const _ViewConfiguration={ViewIdentifier:'Mapper-FieldMapper',DefaultRenderable:'Mapper-FieldMapper-Content',DefaultDestinationAddress:'#DataMapper-FieldMapper-Slot',AutoRender:false,CSS:/*css*/`
			.field-mapper { display: grid; grid-template-columns: 1fr 1.3fr 1fr; gap: 10px; min-height: 360px; }
			.fm-panel { background: #161b22; border: 1px solid #30363d; border-radius: 6px; display: flex; flex-direction: column; overflow: hidden; }
			.fm-panel-header { padding: 10px 12px; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; }
			.fm-panel-body { flex: 1; overflow: auto; padding: 8px; }
			.fm-field { background: #0d1117; border: 1px solid #30363d; padding: 6px 10px; border-radius: 4px; margin-bottom: 4px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 13px; user-select: none; }
			.fm-field:hover { border-color: #484f58; }
			.fm-field.selected { border-color: #ff9800; background: #2d1f00; }
			.fm-field.mapped { border-color: #3fb950; }
			.fm-field .fm-type { color: #8b949e; font-size: 11px; }
			.fm-empty { color: #8b949e; padding: 16px; text-align: center; font-style: italic; font-size: 13px; }
			.fm-mapping-drop { border: 1px dashed #30363d; border-radius: 4px; padding: 10px; text-align: center; color: #8b949e; margin: 0 8px 8px 8px; font-size: 12px; }
			.fm-mapping-drop.active { border-color: #ff9800; color: #ff9800; background: #1a140a; }
			.fm-mapping-row { display: grid; grid-template-columns: 1fr auto 1fr auto; gap: 6px; align-items: center; padding: 6px 10px; margin-bottom: 4px; background: #0d1117; border: 1px solid #30363d; border-radius: 4px; font-size: 13px; }
			.fm-arrow { color: #ff9800; font-weight: bold; }
			.fm-remove { background: transparent; border: 0; color: #da3633; cursor: pointer; font-size: 16px; padding: 0 4px; }
			.fm-footer { padding: 8px 12px; border-top: 1px solid #30363d; display: flex; gap: 6px; align-items: center; }
		`,Templates:[{Hash:'Mapper-FieldMapper-Template',Template:/*html*/`
<div class="field-mapper">
	<div class="fm-panel">
		<div class="fm-panel-header">Source Fields <span>{~D:AppData.Mapper.SourceFieldCount~}</span></div>
		<div class="fm-panel-body" id="DataMapper-SourceFields-List">
			{~TS:Mapper-FieldMapper-SourceField:AppData.Mapper.SourceFieldsForTemplate~}
			{~TS:Mapper-FieldMapper-SourceEmpty:AppData.Mapper.SourceEmptySlot~}
		</div>
	</div>
	<div class="fm-panel">
		<div class="fm-panel-header">Field Mappings <span>{~D:AppData.Mapper.MappingCount~}</span></div>
		<div class="fm-mapping-drop {~D:AppData.Mapper.DropZoneClass~}">{~D:AppData.Mapper.DropZoneText~}</div>
		<div class="fm-panel-body" id="DataMapper-Mapping-List">
			{~TS:Mapper-FieldMapper-MappingRow:AppData.Mapper.MappingsForTemplate~}
		</div>
		<div class="fm-footer">
			<button class="btn primary" onclick="_Pict.views['Mapper-FieldMapper'].onSaveClick()">Save Mapping</button>
			<button class="btn" onclick="_Pict.views['Mapper-FieldMapper'].onClearClick()">Clear All</button>
		</div>
	</div>
	<div class="fm-panel">
		<div class="fm-panel-header">Target Fields <span>{~D:AppData.Mapper.TargetFieldCount~}</span></div>
		<div class="fm-panel-body" id="DataMapper-TargetFields-List">
			{~TS:Mapper-FieldMapper-TargetField:AppData.Mapper.TargetFieldsForTemplate~}
			{~TS:Mapper-FieldMapper-TargetEmpty:AppData.Mapper.TargetEmptySlot~}
		</div>
	</div>
</div>`},{Hash:'Mapper-FieldMapper-SourceField',Template:/*html*/`<div class="fm-field {~D:Record.SelectedClass~}" data-source-field="{~D:Record.Name~}" draggable="true" onclick="_Pict.views['Mapper-FieldMapper'].onSourceClick(this)" ondragstart="_Pict.views['Mapper-FieldMapper'].onSourceDragStart(event, this)"><span>{~D:Record.Name~}</span><span class="fm-type">{~D:Record.Type~}</span></div>`},{Hash:'Mapper-FieldMapper-TargetField',Template:/*html*/`<div class="fm-field {~D:Record.MappedClass~}" data-target-field="{~D:Record.Name~}" onclick="_Pict.views['Mapper-FieldMapper'].onTargetClick(this)" ondragover="event.preventDefault();" ondrop="_Pict.views['Mapper-FieldMapper'].onTargetDrop(event, this)"><span>{~D:Record.Name~}</span><span class="fm-type">{~D:Record.Type~}</span></div>`},{Hash:'Mapper-FieldMapper-MappingRow',Template:/*html*/`<div class="fm-mapping-row"><span>{~D:Record.Source~}</span><span class="fm-arrow">&rarr;</span><span>{~D:Record.Target~}</span><button class="fm-remove" onclick="_Pict.views['Mapper-FieldMapper'].onRemoveClick({~D:Record.Index~})">&times;</button></div>`},{// Empty-state placeholder for the source-fields panel.
// Driven by a single-element-array slot (SourceEmptySlot)
// on AppData rather than an HTML string in AppData —
// per modules/pict/CLAUDE.md "AppData stores data, not HTML".
Hash:'Mapper-FieldMapper-SourceEmpty',Template:/*html*/`<div class="fm-empty">Pick a source beacon, connection, and entity above.</div>`},{Hash:'Mapper-FieldMapper-TargetEmpty',Template:/*html*/`<div class="fm-empty">Pick a target beacon, connection, and entity above.</div>`}],Renderables:[{RenderableHash:'Mapper-FieldMapper-Content',TemplateHash:'Mapper-FieldMapper-Template',ContentDestinationAddress:'#DataMapper-FieldMapper-Slot',RenderMethod:'replace'}]};class PictViewMapperFieldMapper extends libPictView{constructor(pFable,pOptions,pServiceHash){super(pFable,pOptions,pServiceHash);}onBeforeRender(pRenderable){let tmpState=this.pict.AppData.Mapper;let tmpSelected=tmpState.SelectedSourceField||'';let tmpSources=tmpState.SourceFields||[];tmpState.SourceFieldCount=`${tmpSources.length} field${tmpSources.length===1?'':'s'}`;tmpState.SourceFieldsForTemplate=tmpSources.map(pF=>({Name:pF.Name,Type:pF.Type||'',SelectedClass:pF.Name===tmpSelected?'selected':''}));// Single-element-array slot drives the empty-state template via
// {~TS:~}; no HTML in AppData per CLAUDE.md.
tmpState.SourceEmptySlot=tmpSources.length===0?[{}]:[];let tmpMappings=tmpState.Mappings||[];let tmpMappedTargets={};for(let i=0;i<tmpMappings.length;i++){tmpMappedTargets[tmpMappings[i].Target]=true;}let tmpTargets=tmpState.TargetFields||[];tmpState.TargetFieldCount=`${tmpTargets.length} field${tmpTargets.length===1?'':'s'}`;tmpState.TargetFieldsForTemplate=tmpTargets.map(pF=>({Name:pF.Name,Type:pF.Type||'',MappedClass:tmpMappedTargets[pF.Name]?'mapped':''}));tmpState.TargetEmptySlot=tmpTargets.length===0?[{}]:[];tmpState.MappingCount=`${tmpMappings.length} mapping${tmpMappings.length===1?'':'s'}`;tmpState.MappingsForTemplate=tmpMappings.map((pM,pIdx)=>({Source:pM.Source,Target:pM.Target,Index:pIdx}));if(tmpSelected){tmpState.DropZoneClass='active';tmpState.DropZoneText=`Source "${tmpSelected}" selected — click a target field to map it`;}else{tmpState.DropZoneClass='';tmpState.DropZoneText='Click a source field, then click a target field';}return super.onBeforeRender(pRenderable);}// ── Inline-handler dispatchers (called from template onclick/ondragstart/ondrop=…) ──
onSourceClick(pFieldEl){this.pict.providers.MapperAPI.selectSourceField(pFieldEl.getAttribute('data-source-field'));}onSourceDragStart(pEvent,pFieldEl){let tmpName=pFieldEl.getAttribute('data-source-field');pEvent.dataTransfer.setData('text/plain',tmpName);this.pict.AppData.Mapper.SelectedSourceField=tmpName;}onTargetClick(pFieldEl){let tmpTarget=pFieldEl.getAttribute('data-target-field');let tmpSource=this.pict.AppData.Mapper.SelectedSourceField;if(tmpSource&&tmpTarget)this.pict.providers.MapperAPI.addMapping(tmpSource,tmpTarget);}onTargetDrop(pEvent,pFieldEl){pEvent.preventDefault();let tmpSource=pEvent.dataTransfer.getData('text/plain');let tmpTarget=pFieldEl.getAttribute('data-target-field');if(tmpSource&&tmpTarget)this.pict.providers.MapperAPI.addMapping(tmpSource,tmpTarget);}onRemoveClick(pIndex){let tmpIndex=parseInt(pIndex,10);this.pict.providers.MapperAPI.removeMapping(tmpIndex);}onSaveClick(){this.pict.providers.MapperAPI.saveMapping();}onClearClick(){this.pict.providers.MapperAPI.clearMappings();}}module.exports=PictViewMapperFieldMapper;module.exports.default_configuration=_ViewConfiguration;},{"pict-view":18}],42:[function(require,module,exports){/**
 * DataMapper JSONEditor View
 *
 * Dual-mode config editor: shows the generated MappingConfiguration JSON
 * and supports import via paste, file picker, or drag-drop onto the textarea.
 */const libPictView=require('pict-view');const _ViewConfiguration={ViewIdentifier:'Mapper-JSONEditor',DefaultRenderable:'Mapper-JSONEditor-Content',DefaultDestinationAddress:'#DataMapper-JSONEditor-Slot',AutoRender:false,CSS:/*css*/`
			.json-editor { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 12px 16px; }
			.json-editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
			.json-editor-header h2 { margin: 0; font-size: 14px; font-weight: 600; color: #e6edf3; }
			.json-editor-actions { display: flex; gap: 6px; }
			.json-editor textarea { width: 100%; min-height: 360px; background: #0d1117; color: #e6edf3; border: 1px solid #30363d; border-radius: 4px; font-family: 'Menlo', 'Monaco', 'Consolas', monospace; font-size: 12px; padding: 10px; resize: vertical; }
			.json-editor textarea.drop-active { border-color: #ff9800; }
		`,Templates:[{Hash:'Mapper-JSONEditor-Template',Template:/*html*/`
<div class="json-editor">
	<div class="json-editor-header">
		<h2>MappingConfiguration JSON</h2>
		<div class="json-editor-actions">
			<button class="btn" onclick="_Pict.views['Mapper-JSONEditor'].onRegenClick()">Regenerate</button>
			<button class="btn" onclick="_Pict.views['Mapper-JSONEditor'].onApplyClick()">Apply to Editor</button>
			<button class="btn" onclick="_Pict.views['Mapper-JSONEditor'].onCopyClick()">Copy</button>
			<button class="btn" onclick="_Pict.views['Mapper-JSONEditor'].onUploadClick()">Upload…</button>
			<input type="file" id="DataMapper-JSON-File" accept=".json" style="display:none"
				onchange="_Pict.views['Mapper-JSONEditor'].onFileChange(this)">
		</div>
	</div>
	<textarea id="DataMapper-JSON-Text" placeholder='{ "Entity":"MyEntity", "Mappings":{...} }'
		ondragover="event.preventDefault(); this.classList.add('drop-active');"
		ondragleave="this.classList.remove('drop-active');"
		ondrop="_Pict.views['Mapper-JSONEditor'].onTextareaDrop(event, this)">{~D:AppData.Mapper.JSONText~}</textarea>
</div>`}],Renderables:[{RenderableHash:'Mapper-JSONEditor-Content',TemplateHash:'Mapper-JSONEditor-Template',ContentDestinationAddress:'#DataMapper-JSONEditor-Slot',RenderMethod:'replace'}]};class PictViewMapperJSONEditor extends libPictView{constructor(pFable,pOptions,pServiceHash){super(pFable,pOptions,pServiceHash);}// ── Inline-handler dispatchers ──────────────────────────────────
//
// All button clicks, file-input change, and textarea drag/drop wire
// through inline attributes in the template HTML — survives every
// re-render because the markup itself carries the handler. Per
// modules/pict/CLAUDE.md, addEventListener in onAfterRender is banned
// (handlers vanish on re-render). Drag/drop has inline equivalents
// (ondragover/ondragleave/ondrop), so even those are template-side.
_textarea(){let tmpEl=this.pict.ContentAssignment.getElement('#DataMapper-JSON-Text');return tmpEl&&tmpEl.length?tmpEl[0]:null;}onRegenClick(){this.pict.providers.MapperAPI._regenerateJSON();let tmpTextarea=this._textarea();if(tmpTextarea)tmpTextarea.value=this.pict.AppData.Mapper.JSONText;}onApplyClick(){let tmpTextarea=this._textarea();if(tmpTextarea)this.pict.providers.MapperAPI.applyJSONText(tmpTextarea.value);}onCopyClick(){let tmpTextarea=this._textarea();if(!tmpTextarea)return;try{navigator.clipboard.writeText(tmpTextarea.value);this.pict.AppData.Mapper.StatusMessage='JSON copied.';}catch(pErr){tmpTextarea.select();document.execCommand('copy');this.pict.AppData.Mapper.StatusMessage='JSON copied.';}if(this.pict.views['Mapper-Layout'])this.pict.views['Mapper-Layout'].render();}onUploadClick(){// Programmatically click the hidden file input so the browser
// opens its native file-picker dialog. The picker fires onchange
// when the user picks a file — handled by onFileChange below.
let tmpEl=this.pict.ContentAssignment.getElement('#DataMapper-JSON-File');if(tmpEl&&tmpEl.length)tmpEl[0].click();}onFileChange(pInputEl){let tmpFile=pInputEl&&pInputEl.files&&pInputEl.files[0];if(!tmpFile)return;let _self=this;let tmpReader=new FileReader();tmpReader.onload=pLoadEvent=>{let tmpTextarea=_self._textarea();if(tmpTextarea)tmpTextarea.value=pLoadEvent.target.result;_self.pict.providers.MapperAPI.applyJSONText(pLoadEvent.target.result);};tmpReader.readAsText(tmpFile);pInputEl.value='';}onTextareaDrop(pEvent,pTextareaEl){pEvent.preventDefault();pTextareaEl.classList.remove('drop-active');let tmpFiles=pEvent.dataTransfer&&pEvent.dataTransfer.files;if(!tmpFiles||tmpFiles.length===0)return;let _self=this;let tmpReader=new FileReader();tmpReader.onload=pLoadEvent=>{pTextareaEl.value=pLoadEvent.target.result;_self.pict.providers.MapperAPI.applyJSONText(pLoadEvent.target.result);};tmpReader.readAsText(tmpFiles[0]);}}module.exports=PictViewMapperJSONEditor;module.exports.default_configuration=_ViewConfiguration;},{"pict-view":18}],43:[function(require,module,exports){/**
 * DataMapper Layout View
 *
 * Shell: header with Ultravisor controls + status, tab bar that switches
 * between mapper / saved-mappings / JSON panels, and mount-point divs
 * for the sub-views.
 */const libPictView=require('pict-view');const _PanelDefs=[{Key:'mapper',Label:'Visual Mapper'},{Key:'mappings',Label:'Saved Mappings'},{Key:'json',Label:'JSON Config'}];const _ViewConfiguration={ViewIdentifier:'Mapper-Layout',DefaultRenderable:'Mapper-Layout-Shell',DefaultDestinationAddress:'#DataMapper-App',AutoRender:false,CSS:/*css*/`
			body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #0d1117; color: #e6edf3; font-size: 14px; }
			.mapper-app { display: flex; flex-direction: column; height: 100vh; }
			.mapper-header { background: #161b22; border-bottom: 1px solid #30363d; padding: 10px 20px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
			.mapper-header h1 { margin: 0; font-size: 16px; font-weight: 600; color: #ff9800; }
			.mapper-uv-controls { display: flex; gap: 6px; align-items: center; flex: 1; }
			.mapper-uv-controls input { background: #0d1117; border: 1px solid #30363d; color: #e6edf3; padding: 4px 8px; border-radius: 4px; font-size: 13px; min-width: 220px; }
			.mapper-uv-controls button { background: #238636; color: var(--theme-color-background-panel, #fff); border: 0; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; }
			.mapper-uv-controls button.secondary { background: #30363d; }
			.mapper-uv-controls button:hover { filter: brightness(1.15); }
			.mapper-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
			.badge-neutral { background: #30363d; color: #8b949e; }
			.badge-success { background: #238636; color: var(--theme-color-background-panel, #fff); }
			.badge-error { background: #da3633; color: var(--theme-color-background-panel, #fff); }
			.badge-info { background: #1f6feb; color: var(--theme-color-background-panel, #fff); }
			.mapper-status { color: #8b949e; font-size: 12px; }
			.mapper-tabs { background: #161b22; border-bottom: 1px solid #30363d; padding: 0 20px; display: flex; gap: 2px; }
			.mapper-tab { background: transparent; border: 0; color: #8b949e; padding: 10px 16px; cursor: pointer; font-size: 13px; border-bottom: 2px solid transparent; }
			.mapper-tab.active { color: #ff9800; border-bottom-color: #ff9800; }
			.mapper-tab:hover { color: #e6edf3; }
			.mapper-main { flex: 1; overflow: auto; padding: 16px 20px; }
			.mapper-panel { display: none; }
			.mapper-panel.active { display: block; }
			.mapper-section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #8b949e; margin: 0 0 8px 0; }
			select, input[type="text"], textarea { background: #0d1117; border: 1px solid #30363d; color: #e6edf3; padding: 4px 8px; border-radius: 4px; font-size: 13px; }
			select { min-width: 160px; }
			button.btn { background: #30363d; color: #e6edf3; border: 0; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; }
			button.btn.primary { background: #ff9800; color: #0d1117; }
			button.btn.danger { background: #da3633; color: var(--theme-color-background-panel, #fff); }
			button.btn:hover { filter: brightness(1.15); }
			button.btn:disabled { opacity: 0.5; cursor: not-allowed; }
		`,Templates:[{Hash:'Mapper-Layout-Shell',Template:/*html*/`
<div class="mapper-app">
	<header class="mapper-header">
		<h1>Retold Data Mapper</h1>
		<div class="mapper-uv-controls">
			<label style="color:#8b949e; font-size:12px;">Ultravisor</label>
			<input type="text" id="DataMapper-UV-URL" placeholder="http://localhost:8422" value="{~D:AppData.Mapper.UltravisorURL~}">
			<button onclick="_Pict.views['Mapper-Layout'].onConnectClick()">Connect</button>
			<button class="secondary" onclick="_Pict.views['Mapper-Layout'].onDisconnectClick()">Disconnect</button>
			<span class="mapper-badge {~D:AppData.Mapper.UltravisorBadgeClass~}">{~D:AppData.Mapper.UltravisorStatusLabel~}</span>
		</div>
		<div class="mapper-status">{~D:AppData.Mapper.StatusMessage~}</div>
	</header>
	<nav class="mapper-tabs">{~TS:Mapper-Layout-Tab:AppData.Mapper.Tabs~}</nav>
	<main class="mapper-main">
		<div id="DataMapper-Panel-mapper" class="mapper-panel">
			<div id="DataMapper-BeaconBrowser-Slot"></div>
			<div id="DataMapper-FieldMapper-Slot"></div>
		</div>
		<div id="DataMapper-Panel-mappings" class="mapper-panel">
			<div id="DataMapper-MappingList-Slot"></div>
		</div>
		<div id="DataMapper-Panel-json" class="mapper-panel">
			<div id="DataMapper-JSONEditor-Slot"></div>
		</div>
	</main>
</div>`},{Hash:'Mapper-Layout-Tab',Template:/*html*/`<button class="mapper-tab {~D:Record.ActiveClass~}" data-mapper-panel="{~D:Record.Key~}" onclick="_Pict.views['Mapper-Layout'].setActivePanel('{~D:Record.Key~}')">{~D:Record.Label~}</button>`}],Renderables:[{RenderableHash:'Mapper-Layout-Shell',TemplateHash:'Mapper-Layout-Shell',ContentDestinationAddress:'#DataMapper-App',RenderMethod:'replace'}]};class PictViewMapperLayout extends libPictView{constructor(pFable,pOptions,pServiceHash){super(pFable,pOptions,pServiceHash);}onBeforeRender(pRenderable){let tmpActive=this.pict.AppData.Mapper&&this.pict.AppData.Mapper.ActivePanel||'mapper';this.pict.AppData.Mapper.Tabs=_PanelDefs.map(pP=>({Key:pP.Key,Label:pP.Label,ActiveClass:pP.Key===tmpActive?'active':''}));return super.onBeforeRender(pRenderable);}// ── Inline-handler dispatchers (called from template onclick=…) ──
onConnectClick(){let tmpURLInput=this.pict.ContentAssignment.getElement('#DataMapper-UV-URL');let tmpURL=tmpURLInput&&tmpURLInput.length?tmpURLInput[0].value:'';if(!tmpURL)return;this.pict.providers.MapperAPI.connectUltravisor(tmpURL);}onDisconnectClick(){this.pict.providers.MapperAPI.disconnectUltravisor();}onAfterRender(pRenderable,pRenderDestinationAddress,pRecord,pContent){// Render sub-views into their mount slots.
if(this.pict.views['Mapper-BeaconBrowser'])this.pict.views['Mapper-BeaconBrowser'].render();if(this.pict.views['Mapper-FieldMapper'])this.pict.views['Mapper-FieldMapper'].render();if(this.pict.views['Mapper-MappingList'])this.pict.views['Mapper-MappingList'].render();if(this.pict.views['Mapper-JSONEditor'])this.pict.views['Mapper-JSONEditor'].render();this._applyActivePanelVisibility();if(this.pict.CSSMap&&typeof this.pict.CSSMap.injectCSS==='function'){this.pict.CSSMap.injectCSS();}return super.onAfterRender(pRenderable,pRenderDestinationAddress,pRecord,pContent);}setActivePanel(pKey){this.pict.AppData.Mapper.ActivePanel=pKey;this._applyActivePanelVisibility();let tmpTabButtons=this.pict.ContentAssignment.getElement('[data-mapper-panel]');if(tmpTabButtons&&tmpTabButtons.length){for(let i=0;i<tmpTabButtons.length;i++){let tmpName=tmpTabButtons[i].getAttribute('data-mapper-panel');if(tmpName===pKey)tmpTabButtons[i].classList.add('active');else tmpTabButtons[i].classList.remove('active');}}}_applyActivePanelVisibility(){let tmpActive=this.pict.AppData.Mapper.ActivePanel||'mapper';for(let i=0;i<_PanelDefs.length;i++){let tmpKey=_PanelDefs[i].Key;let tmpPanelEl=this.pict.ContentAssignment.getElement(`#DataMapper-Panel-${tmpKey}`);if(tmpPanelEl&&tmpPanelEl.length){tmpPanelEl[0].classList.toggle('active',tmpKey===tmpActive);}}}}module.exports=PictViewMapperLayout;module.exports.default_configuration=_ViewConfiguration;},{"pict-view":18}],44:[function(require,module,exports){/**
 * DataMapper MappingList View
 *
 * Lists MappingConfig rows persisted in the mapper's internal SQLite. Click
 * to load into the editor; × to delete.
 */const libPictView=require('pict-view');const _ViewConfiguration={ViewIdentifier:'Mapper-MappingList',DefaultRenderable:'Mapper-MappingList-Content',DefaultDestinationAddress:'#DataMapper-MappingList-Slot',AutoRender:false,CSS:/*css*/`
			.mapping-list { background: #161b22; border: 1px solid #30363d; border-radius: 6px; }
			.ml-header { padding: 10px 16px; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; align-items: center; }
			.ml-header h2 { margin: 0; font-size: 14px; color: #e6edf3; font-weight: 600; }
			.ml-empty { padding: 16px; text-align: center; color: #8b949e; font-style: italic; }
			.ml-row { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; padding: 10px 16px; border-bottom: 1px solid #21262d; align-items: center; }
			.ml-row:last-child { border-bottom: 0; }
			.ml-row:hover { background: #1c2333; }
			.ml-name { font-size: 13px; color: #e6edf3; font-weight: 500; }
			.ml-sub { font-size: 12px; color: #8b949e; }
		`,Templates:[{Hash:'Mapper-MappingList-Template',Template:/*html*/`
<div class="mapping-list">
	<div class="ml-header">
		<h2>Saved Mappings</h2>
		<button class="btn" onclick="_Pict.views['Mapper-MappingList'].onRefreshClick()">Refresh</button>
	</div>
	{~TS:Mapper-MappingList-Row:AppData.Mapper.SavedMappingsForTemplate~}
	{~TS:Mapper-MappingList-Empty:AppData.Mapper.SavedMappingsEmptySlot~}
</div>`},{Hash:'Mapper-MappingList-Row',Template:/*html*/`
<div class="ml-row">
	<div>
		<div class="ml-name">{~D:Record.Name~}</div>
		<div class="ml-sub">{~D:Record.Subline~}</div>
	</div>
	<button class="btn" onclick="_Pict.views['Mapper-MappingList'].onLoadClick({~D:Record.IDMappingConfig~})">Load</button>
	<button class="btn danger" onclick="_Pict.views['Mapper-MappingList'].onDeleteClick({~D:Record.IDMappingConfig~})">&times;</button>
</div>`},{// Empty-state placeholder. Driven by a single-element-array
// slot rather than an HTML string in AppData, per
// modules/pict/CLAUDE.md "AppData stores data, not HTML".
Hash:'Mapper-MappingList-Empty',Template:/*html*/`<div class="ml-empty">No saved mappings yet. Save one from the Visual Mapper tab.</div>`}],Renderables:[{RenderableHash:'Mapper-MappingList-Content',TemplateHash:'Mapper-MappingList-Template',ContentDestinationAddress:'#DataMapper-MappingList-Slot',RenderMethod:'replace'}]};class PictViewMapperMappingList extends libPictView{constructor(pFable,pOptions,pServiceHash){super(pFable,pOptions,pServiceHash);}onBeforeRender(pRenderable){let tmpState=this.pict.AppData.Mapper;let tmpSaved=tmpState.SavedMappings||[];tmpState.SavedMappingsForTemplate=tmpSaved.map(pM=>{let tmpParts=[];if(pM.SourceBeaconName)tmpParts.push(`${pM.SourceBeaconName}${pM.SourceEntity?'/'+pM.SourceEntity:''}`);if(pM.TargetBeaconName)tmpParts.push(`${pM.TargetBeaconName}${pM.TargetEntity?'/'+pM.TargetEntity:''}`);return{IDMappingConfig:pM.IDMappingConfig,Name:pM.Name||'(unnamed)',Subline:tmpParts.join(' → ')};});tmpState.SavedMappingsEmptySlot=tmpSaved.length===0?[{}]:[];return super.onBeforeRender(pRenderable);}// ── Inline-handler dispatchers (called from template onclick=…) ──
onRefreshClick(){this.pict.providers.MapperAPI.loadSavedMappings();}onLoadClick(pIDMappingConfig){let tmpID=parseInt(pIDMappingConfig,10);if(tmpID)this.pict.providers.MapperAPI.loadSavedMapping(tmpID);}onDeleteClick(pIDMappingConfig){let tmpID=parseInt(pIDMappingConfig,10);if(tmpID)this.pict.providers.MapperAPI.deleteSavedMapping(tmpID);}}module.exports=PictViewMapperMappingList;module.exports.default_configuration=_ViewConfiguration;},{"pict-view":18}],45:[function(require,module,exports){/**
 * Retold DataMapper — Connection Discovery View (Phase 4)
 *
 * Single-page customer-beacon → lake clone wizard. Lives inside
 * retold-data-mapper (NOT a new pict-section-* module) per the
 * "no new pict-section-* modules" constraint for mapper-private views.
 *
 * Three things drive the view:
 *
 *   1. **Source side**  — pick a beacon visible in the UV mesh, then a
 *      connection on that beacon. Beacons come from `/mapper/beacons`,
 *      connections from `/mapper/beacon/:name/connections`.
 *   2. **Tables**       — Introspect the source connection; the response
 *      lists tables. The user picks a subset.
 *   3. **Target side**  — pick a beacon + connection to clone INTO
 *      (defaults to lake-databeacon / lake-main). Then "Create N
 *      operations" loops through the selected tables and POSTs an
 *      Extraction OperationConfig for each (Pull-from-source →
 *      Write-to-target with the table preserved).
 *
 * The created operations show up immediately in the Operations tab,
 * where the user can run them individually or via the "Run all in
 * dependency order" button on the section.
 *
 * State lives in pict.AppData.MapperShell.Connections.* — slot pattern
 * mirrors the section refactors so the template engine drives all
 * visibility/conditional rendering.
 */'use strict';const libPictView=require('pict-view');// ── Templates ──────────────────────────────────────────────────────
const SHELL_TEMPLATE=/*html*/`
<div class="msh-cd-root">
	<div class="msh-cd-header">
		<h2>Connection Discovery</h2>
		<p>Discover customer beacons in the UV mesh, introspect their tables, and bulk-create Pull→Write operations into the lake. The operations land in the Operations tab where you can run them individually or in dependency order.</p>
	</div>

	{~TS:MapperShell-Connections-LoadingBeacons:AppData.MapperShell.Connections.LoadingBeaconsSlot~}
	{~TS:MapperShell-Connections-LoadError:AppData.MapperShell.Connections.LoadErrorSlot~}

	<div class="msh-cd-grid">
		<div class="msh-cd-card msh-cd-source">
			<h3>1. Source</h3>
			<label>Beacon
				<select onchange="_Pict.views['MapperShell-Connections'].selectSourceBeacon(this.value)">
					<option value="">— pick a beacon —</option>
					{~TS:MapperShell-Connections-BeaconOption:AppData.MapperShell.Connections.SourceBeaconOptions~}
				</select>
			</label>
			<label>Connection
				<select onchange="_Pict.views['MapperShell-Connections'].selectSourceConnection(this.value)">
					<option value="">— pick a connection —</option>
					{~TS:MapperShell-Connections-ConnectionOption:AppData.MapperShell.Connections.SourceConnectionOptions~}
				</select>
			</label>
			<a class="msh-cd-btn msh-cd-btn-primary {~Data:AppData.MapperShell.Connections.IntrospectDisabled~}" href="javascript:void(0)"
				onclick="_Pict.views['MapperShell-Connections'].runIntrospect()">{~Data:AppData.MapperShell.Connections.IntrospectLabel~}</a>
		</div>

		<div class="msh-cd-card msh-cd-target">
			<h3>2. Target</h3>
			<label>Beacon
				<select onchange="_Pict.views['MapperShell-Connections'].selectTargetBeacon(this.value)">
					{~TS:MapperShell-Connections-BeaconOption:AppData.MapperShell.Connections.TargetBeaconOptions~}
				</select>
			</label>
			<label>Connection
				<select onchange="_Pict.views['MapperShell-Connections'].selectTargetConnection(this.value)">
					<option value="">— pick a connection —</option>
					{~TS:MapperShell-Connections-ConnectionOption:AppData.MapperShell.Connections.TargetConnectionOptions~}
				</select>
			</label>
			<div class="msh-cd-target-hint">Operations are created as Extractions (pass-through clone). Edit afterwards in the Operations tab if you need filters or column projections.</div>
		</div>
	</div>

	{~TS:MapperShell-Connections-Introspecting:AppData.MapperShell.Connections.IntrospectingSlot~}
	{~TS:MapperShell-Connections-IntrospectError:AppData.MapperShell.Connections.IntrospectErrorSlot~}

	<div class="msh-cd-tables-wrap">
		{~TS:MapperShell-Connections-TablesPanel:AppData.MapperShell.Connections.TablesPanelSlot~}
	</div>

	{~TS:MapperShell-Connections-Results:AppData.MapperShell.Connections.ResultsSlot~}
</div>`;const BEACON_OPTION_TEMPLATE=/*html*/`
<option value="{~Data:Record.Name~}" {~Data:Record.SelectedAttr~}>{~Data:Record.Name~}</option>`;const CONNECTION_OPTION_TEMPLATE=/*html*/`
<option value="{~Data:Record.Name~}" {~Data:Record.SelectedAttr~}>{~Data:Record.Label~}</option>`;const LOADING_BEACONS_TEMPLATE=/*html*/`
<div class="msh-cd-status">Loading beacons from UV mesh…</div>`;const LOAD_ERROR_TEMPLATE=/*html*/`
<div class="msh-cd-error">Failed to list beacons: {~Data:Record.Message~}</div>`;const INTROSPECTING_TEMPLATE=/*html*/`
<div class="msh-cd-status">Introspecting <code>{~Data:Record.Beacon~}</code> / <code>{~Data:Record.Connection~}</code>…</div>`;const INTROSPECT_ERROR_TEMPLATE=/*html*/`
<div class="msh-cd-error">Introspect failed: {~Data:Record.Message~}</div>`;const TABLES_PANEL_TEMPLATE=/*html*/`
<div class="msh-cd-tables">
	<div class="msh-cd-tables-header">
		<h3>3. Tables to clone <span class="msh-cd-count">({~Data:Record.SelectedCount~} of {~Data:Record.TotalCount~} selected)</span></h3>
		<div class="msh-cd-tables-actions">
			<a class="msh-cd-btn msh-cd-btn-link" href="javascript:void(0)"
				onclick="_Pict.views['MapperShell-Connections'].selectAllTables(true)">Select all</a>
			<a class="msh-cd-btn msh-cd-btn-link" href="javascript:void(0)"
				onclick="_Pict.views['MapperShell-Connections'].selectAllTables(false)">Select none</a>
		</div>
	</div>
	<div class="msh-cd-tables-list">
		{~TS:MapperShell-Connections-TableRow:Record.Tables~}
	</div>
	<div class="msh-cd-tables-footer">
		<a class="msh-cd-btn msh-cd-btn-success {~Data:Record.CreateDisabled~}" href="javascript:void(0)"
			onclick="_Pict.views['MapperShell-Connections'].runCloneAll()">{~Data:Record.CreateLabel~}</a>
	</div>
</div>`;const TABLE_ROW_TEMPLATE=/*html*/`
<label class="msh-cd-table-row">
	<input type="checkbox" {~Data:Record.CheckedAttr~}
		onchange="_Pict.views['MapperShell-Connections'].toggleTable('{~Data:Record.TableName~}', this.checked)" />
	<span class="msh-cd-table-name">{~Data:Record.TableName~}</span>
	<span class="msh-cd-table-meta">{~Data:Record.ColumnCountLabel~}</span>
</label>`;const RESULTS_PANEL_TEMPLATE=/*html*/`
<div class="msh-cd-results msh-cd-results-{~Data:Record.OverallStatusClass~}">
	<h3>{~Data:Record.HeaderLabel~}</h3>
	{~TS:MapperShell-Connections-ResultRow:Record.Items~}
	<div class="msh-cd-results-footer">
		<a class="msh-cd-btn" href="javascript:void(0)"
			onclick="_Pict.views['MapperShell-Connections'].dismissResults()">Dismiss</a>
		<a class="msh-cd-btn msh-cd-btn-primary" href="javascript:void(0)"
			onclick="_Pict.PictApplication.selectTab('operations')">Open Operations tab →</a>
	</div>
</div>`;const RESULT_ROW_TEMPLATE=/*html*/`
<div class="msh-cd-result-row msh-cd-result-{~Data:Record.StatusClass~}">
	<span class="msh-cd-result-icon">{~Data:Record.Icon~}</span>
	<span class="msh-cd-result-table">{~Data:Record.TableName~}</span>
	<span class="msh-cd-result-message">{~Data:Record.Message~}</span>
</div>`;// ── CSS ────────────────────────────────────────────────────────────
const CSS=/*css*/`
.msh-cd-root
{
	padding: 24px 32px;
	max-width: 1100px;
	margin: 0 auto;
	color: #cbd5e1;
}
.msh-cd-header h2 { color: #f8fafc; font-size: 20px; margin: 0 0 6px 0; }
.msh-cd-header p { font-size: 13px; line-height: 1.6; margin: 0 0 24px 0; color: #94a3b8; }

.msh-cd-grid
{
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 16px;
	margin-bottom: 18px;
}
.msh-cd-card
{
	background: #0a1525;
	border: 1px solid #1e293b;
	border-radius: 8px;
	padding: 18px 20px;
	display: flex;
	flex-direction: column;
	gap: 12px;
}
.msh-cd-card h3 { margin: 0 0 4px 0; font-size: 14px; color: #f8fafc; font-weight: 600; }
.msh-cd-card label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #94a3b8; }
.msh-cd-card select
{
	background: #0e1a2b;
	color: #f8fafc;
	border: 1px solid #1e293b;
	padding: 7px 10px;
	border-radius: 4px;
	font-size: 12px;
	font-family: inherit;
}
.msh-cd-target-hint { color: #64748b; font-size: 11px; font-style: italic; line-height: 1.5; margin-top: auto; }

.msh-cd-btn
{
	background: #16213e;
	color: #cbd5e1;
	border: 1px solid #1e293b;
	padding: 7px 14px;
	border-radius: 4px;
	font-size: 12px;
	cursor: pointer;
	text-decoration: none;
	display: inline-block;
	text-align: center;
}
.msh-cd-btn:hover { background: #1e293b; color: #f8fafc; }
.msh-cd-btn.msh-cd-btn-primary { background: var(--theme-color-brand-primary-hover, #1d4ed8); color: var(--theme-color-background-panel, #fff); border-color: var(--theme-color-brand-primary-hover, #1d4ed8); align-self: flex-start; }
.msh-cd-btn.msh-cd-btn-primary:hover { background: #1e40af; }
.msh-cd-btn.msh-cd-btn-success { background: var(--theme-color-status-success, #15803d); color: #dcfce7; border-color: #166534; }
.msh-cd-btn.msh-cd-btn-success:hover { background: #166534; }
.msh-cd-btn.msh-cd-btn-link { background: transparent; border: 0; color: #93c5fd; padding: 4px 8px; }
.msh-cd-btn.msh-cd-btn-link:hover { color: #bfdbfe; background: transparent; }
.msh-cd-btn.msh-cd-btn-disabled { opacity: 0.4; pointer-events: none; }

.msh-cd-status
{
	padding: 10px 14px;
	background: #0f172a;
	border: 1px solid #1e293b;
	border-radius: 4px;
	color: #94a3b8;
	font-size: 12px;
	margin-bottom: 12px;
}
.msh-cd-status code { color: #93c5fd; background: transparent; font-family: monospace; }
.msh-cd-error
{
	padding: 12px 14px;
	background: #2a1010;
	color: #fecaca;
	border: 1px solid var(--theme-color-status-error, #b91c1c);
	border-radius: 4px;
	font-size: 12px;
	margin-bottom: 12px;
}

.msh-cd-tables
{
	background: #0a1525;
	border: 1px solid #1e293b;
	border-radius: 8px;
	padding: 18px 20px;
}
.msh-cd-tables-header
{
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 12px;
	flex-wrap: wrap;
}
.msh-cd-tables-header h3 { margin: 0; font-size: 14px; color: #f8fafc; font-weight: 600; }
.msh-cd-tables-header .msh-cd-count { color: #94a3b8; font-weight: 400; font-size: 12px; margin-left: 8px; }
.msh-cd-tables-actions { display: flex; gap: 4px; }
.msh-cd-tables-list
{
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	gap: 4px 16px;
	padding: 8px 0;
	border-top: 1px solid #1e293b;
	border-bottom: 1px solid #1e293b;
	max-height: 360px;
	overflow-y: auto;
}
.msh-cd-table-row
{
	display: grid;
	grid-template-columns: 18px 1fr auto;
	align-items: center;
	gap: 8px;
	padding: 5px 8px;
	border-radius: 3px;
	cursor: pointer;
	font-size: 12px;
}
.msh-cd-table-row:hover { background: #16213e; }
.msh-cd-table-row .msh-cd-table-name { color: #f8fafc; font-family: monospace; }
.msh-cd-table-row .msh-cd-table-meta { color: #64748b; font-size: 11px; }
.msh-cd-tables-footer { padding-top: 14px; display: flex; justify-content: flex-end; }

.msh-cd-results
{
	margin-top: 18px;
	background: #0a1525;
	border: 1px solid #1e293b;
	border-radius: 8px;
	padding: 18px 20px;
}
.msh-cd-results.msh-cd-results-success { border-color: var(--theme-color-status-success, #15803d); }
.msh-cd-results.msh-cd-results-partial { border-color: #f59e0b; }
.msh-cd-results.msh-cd-results-error   { border-color: var(--theme-color-status-error, #b91c1c); }
.msh-cd-results h3 { margin: 0 0 12px 0; color: #f8fafc; font-size: 14px; }
.msh-cd-result-row
{
	display: grid;
	grid-template-columns: 24px 220px 1fr;
	gap: 10px;
	padding: 6px 4px;
	font-size: 12px;
	border-bottom: 1px solid #1e293b;
}
.msh-cd-result-row:last-child { border-bottom: 0; }
.msh-cd-result-row .msh-cd-result-icon { font-weight: 600; }
.msh-cd-result-row .msh-cd-result-table { font-family: monospace; color: #f8fafc; }
.msh-cd-result-row .msh-cd-result-message { color: #94a3b8; }
.msh-cd-result-row.msh-cd-result-success .msh-cd-result-icon { color: #4ade80; }
.msh-cd-result-row.msh-cd-result-error   .msh-cd-result-icon { color: #f87171; }
.msh-cd-result-row.msh-cd-result-error   .msh-cd-result-message { color: #fecaca; }
.msh-cd-results-footer { display: flex; gap: 8px; justify-content: flex-end; padding-top: 12px; margin-top: 12px; border-top: 1px solid #1e293b; }
`;// ── Configuration ──────────────────────────────────────────────────
const _Configuration={ViewIdentifier:'MapperShell-Connections',DefaultRenderable:'MapperShell-Connections-Renderable',DefaultDestinationAddress:'#MapperShell-Connections',DefaultTemplateRecordAddress:'AppData.MapperShell.Connections',AutoRender:false,RenderOnLoad:false,CSS:CSS,CSSPriority:500,Templates:[{Hash:'MapperShell-Connections-Shell',Template:SHELL_TEMPLATE},{Hash:'MapperShell-Connections-BeaconOption',Template:BEACON_OPTION_TEMPLATE},{Hash:'MapperShell-Connections-ConnectionOption',Template:CONNECTION_OPTION_TEMPLATE},{Hash:'MapperShell-Connections-LoadingBeacons',Template:LOADING_BEACONS_TEMPLATE},{Hash:'MapperShell-Connections-LoadError',Template:LOAD_ERROR_TEMPLATE},{Hash:'MapperShell-Connections-Introspecting',Template:INTROSPECTING_TEMPLATE},{Hash:'MapperShell-Connections-IntrospectError',Template:INTROSPECT_ERROR_TEMPLATE},{Hash:'MapperShell-Connections-TablesPanel',Template:TABLES_PANEL_TEMPLATE},{Hash:'MapperShell-Connections-TableRow',Template:TABLE_ROW_TEMPLATE},{Hash:'MapperShell-Connections-Results',Template:RESULTS_PANEL_TEMPLATE},{Hash:'MapperShell-Connections-ResultRow',Template:RESULT_ROW_TEMPLATE}],Renderables:[{RenderableHash:'MapperShell-Connections-Renderable',TemplateHash:'MapperShell-Connections-Shell',TemplateRecordAddress:'AppData.MapperShell.Connections',DestinationAddress:'#MapperShell-Connections',RenderMethod:'replace'}]};// ── View class ─────────────────────────────────────────────────────
class MapperShellConnectionsView extends libPictView{constructor(pFable,pOptions,pServiceHash){super(pFable,pOptions,pServiceHash);this._seedAppData();this._beaconsLoaded=false;}_seedAppData(){if(!this.pict.AppData)this.pict.AppData={};if(!this.pict.AppData.MapperShell)this.pict.AppData.MapperShell={};this.pict.AppData.MapperShell.Connections={Beacons:[],LoadState:'idle',// 'idle' | 'loading' | 'ready' | 'error'
LoadErrorMessage:'',SourceBeaconName:'',SourceConnections:[],SourceConnection:null,// selected connection record
TargetBeaconName:'lake-databeacon',TargetConnections:[],TargetConnection:null,TargetConnectionName:'lake-main',IntrospectState:'idle',// 'idle' | 'loading' | 'ready' | 'error'
IntrospectErrorMessage:'',TablesAvailable:[],// [{ TableName, Columns: [...] }]
SelectedTables:{},// { tableName: true }
CreateState:'idle',// 'idle' | 'creating' | 'done'
CreateResults:[],// [{ TableName, Status, Message }]
// Slots (computed in onBeforeRender):
SourceBeaconOptions:[],SourceConnectionOptions:[],TargetBeaconOptions:[],TargetConnectionOptions:[],LoadingBeaconsSlot:[],LoadErrorSlot:[],IntrospectingSlot:[],IntrospectErrorSlot:[],TablesPanelSlot:[],ResultsSlot:[],IntrospectDisabled:'msh-cd-btn-disabled',IntrospectLabel:'Introspect →'};}// ── Lifecycle ────────────────────────────────────────────────────
onBeforeRender(pRenderable,pAddress,pRecord,pContent){this._populateSlots();return super.onBeforeRender(pRenderable,pAddress,pRecord,pContent);}onAfterRender(pRenderable,pAddress,pRecord,pContent){this.pict.CSSMap.injectCSS();// Lazy-load the beacon list on first render. Subsequent renders
// reuse the cached list. Refresh is implicit on tab-leave/return.
if(!this._beaconsLoaded){this._beaconsLoaded=true;this._loadBeacons();}return super.onAfterRender(pRenderable,pAddress,pRecord,pContent);}// ── Public API (called from inline template handlers) ───────────
selectSourceBeacon(pName){let tmpData=this.pict.AppData.MapperShell.Connections;tmpData.SourceBeaconName=String(pName||'');tmpData.SourceConnections=[];tmpData.SourceConnection=null;tmpData.IntrospectState='idle';tmpData.TablesAvailable=[];tmpData.SelectedTables={};tmpData.CreateState='idle';tmpData.CreateResults=[];this.render();if(tmpData.SourceBeaconName)this._loadConnections(tmpData.SourceBeaconName,'source');}selectSourceConnection(pName){let tmpData=this.pict.AppData.MapperShell.Connections;let tmpFound=tmpData.SourceConnections.find(c=>c._Slug===pName||c.Name===pName);tmpData.SourceConnection=tmpFound||null;tmpData.IntrospectState='idle';tmpData.TablesAvailable=[];tmpData.SelectedTables={};this.render();}selectTargetBeacon(pName){let tmpData=this.pict.AppData.MapperShell.Connections;tmpData.TargetBeaconName=String(pName||'');tmpData.TargetConnections=[];tmpData.TargetConnection=null;tmpData.TargetConnectionName='';this.render();if(tmpData.TargetBeaconName)this._loadConnections(tmpData.TargetBeaconName,'target');}selectTargetConnection(pName){let tmpData=this.pict.AppData.MapperShell.Connections;tmpData.TargetConnectionName=String(pName||'');let tmpFound=tmpData.TargetConnections.find(c=>c._Slug===pName||c.Name===pName);tmpData.TargetConnection=tmpFound||null;this.render();}runIntrospect(){let tmpData=this.pict.AppData.MapperShell.Connections;if(!tmpData.SourceConnection||!tmpData.SourceConnection.IDBeaconConnection)return;tmpData.IntrospectState='loading';tmpData.IntrospectErrorMessage='';tmpData.TablesAvailable=[];tmpData.SelectedTables={};this.render();fetch('/mapper/beacon/'+encodeURIComponent(tmpData.SourceBeaconName)+'/introspect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({IDBeaconConnection:tmpData.SourceConnection.IDBeaconConnection})}).then(pRes=>pRes.ok?pRes.json():pRes.text().then(t=>Promise.reject(new Error(t)))).then(pData=>{tmpData.TablesAvailable=pData&&pData.Tables||[];// Default: all tables selected
tmpData.SelectedTables={};for(let i=0;i<tmpData.TablesAvailable.length;i++){let tmpName=tmpData.TablesAvailable[i].TableName||tmpData.TablesAvailable[i].Name;if(tmpName)tmpData.SelectedTables[tmpName]=true;}tmpData.IntrospectState='ready';this.render();}).catch(pErr=>{tmpData.IntrospectState='error';tmpData.IntrospectErrorMessage=pErr.message||String(pErr);this.render();});}toggleTable(pTableName,pChecked){let tmpData=this.pict.AppData.MapperShell.Connections;if(pChecked)tmpData.SelectedTables[pTableName]=true;else delete tmpData.SelectedTables[pTableName];this.render();}selectAllTables(pChecked){let tmpData=this.pict.AppData.MapperShell.Connections;tmpData.SelectedTables={};if(pChecked){for(let i=0;i<tmpData.TablesAvailable.length;i++){let tmpName=tmpData.TablesAvailable[i].TableName||tmpData.TablesAvailable[i].Name;if(tmpName)tmpData.SelectedTables[tmpName]=true;}}this.render();}runCloneAll(){let tmpData=this.pict.AppData.MapperShell.Connections;let tmpSelected=Object.keys(tmpData.SelectedTables).filter(k=>tmpData.SelectedTables[k]);if(tmpSelected.length===0)return;if(!tmpData.SourceConnection||!tmpData.TargetConnection)return;tmpData.CreateState='creating';tmpData.CreateResults=[];this.render();// Process serially so a failed creation doesn't race with later
// ones that depend on a stable IDOperationConfig allocation.
// Clone-of-table is small (one HTTP call each), so serial is fine.
let tmpSourceBeacon=tmpData.SourceBeaconName;let tmpSourceSlug=tmpData.SourceConnection._Slug||tmpData.SourceConnection.Name;let tmpTargetBeacon=tmpData.TargetBeaconName;let tmpTargetSlug=tmpData.TargetConnection._Slug||tmpData.TargetConnection.Name;let tmpResults=[];let _self=this;let _next=i=>{if(i>=tmpSelected.length){tmpData.CreateResults=tmpResults;tmpData.CreateState='done';_self.render();return;}let tmpTable=tmpSelected[i];let tmpTableMeta=(tmpData.TablesAvailable||[]).find(t=>t.TableName===tmpTable||t.Name===tmpTable);let tmpHashSafe=String(tmpTable).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');let tmpRecord={Hash:'clone-'+tmpSourceBeacon+'-'+tmpHashSafe,Name:'Clone '+tmpTable+' from '+tmpSourceBeacon,Description:'Auto-created from Connection Discovery wizard',OperationType:'Extraction',SourceBeaconName:tmpSourceBeacon,SourceConnectionHash:tmpSourceSlug,SourceEntity:tmpTable,TargetBeaconName:tmpTargetBeacon,TargetConnectionHash:tmpTargetSlug,TargetTable:tmpTable,OperationConfiguration:this._buildExtractionConfig(tmpTable,tmpTableMeta),Scope:''};fetch('/mapper/operations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(tmpRecord)}).then(pRes=>pRes.ok?pRes.json():pRes.text().then(t=>Promise.reject(new Error(t)))).then(()=>{tmpResults.push({TableName:tmpTable,Status:'success',Message:'Operation created.'});}).catch(pErr=>{tmpResults.push({TableName:tmpTable,Status:'error',Message:pErr.message||String(pErr)});}).then(()=>_next(i+1));};_next(0);}dismissResults(){let tmpData=this.pict.AppData.MapperShell.Connections;tmpData.CreateState='idle';tmpData.CreateResults=[];this.render();}// ── Internal ─────────────────────────────────────────────────────
_loadBeacons(){let tmpData=this.pict.AppData.MapperShell.Connections;tmpData.LoadState='loading';this.render();fetch('/mapper/beacons').then(pRes=>pRes.ok?pRes.json():pRes.text().then(t=>Promise.reject(new Error(t)))).then(pData=>{tmpData.Beacons=pData&&pData.Beacons||[];tmpData.LoadState='ready';// If target defaults are set, kick off the target connection list too.
if(tmpData.TargetBeaconName)this._loadConnections(tmpData.TargetBeaconName,'target');this.render();}).catch(pErr=>{tmpData.LoadState='error';tmpData.LoadErrorMessage=pErr.message||String(pErr);this.render();});}_loadConnections(pBeaconName,pSide){fetch('/mapper/beacon/'+encodeURIComponent(pBeaconName)+'/connections').then(pRes=>pRes.ok?pRes.json():pRes.text().then(t=>Promise.reject(new Error(t)))).then(pData=>{let tmpData=this.pict.AppData.MapperShell.Connections;let tmpConnections=(pData&&pData.Connections||[]).filter(c=>!c.Deleted).map(c=>Object.assign({},c,{_Slug:this._slug(c.Name)}));if(pSide==='source'){tmpData.SourceConnections=tmpConnections;// Auto-pick if there's exactly one connection (common case).
if(tmpConnections.length===1){tmpData.SourceConnection=tmpConnections[0];}}else{tmpData.TargetConnections=tmpConnections;// Auto-pick the saved TargetConnectionName if present in the loaded list.
if(tmpData.TargetConnectionName){let tmpFound=tmpConnections.find(c=>c._Slug===tmpData.TargetConnectionName||c.Name===tmpData.TargetConnectionName);if(tmpFound)tmpData.TargetConnection=tmpFound;}else if(tmpConnections.length===1){tmpData.TargetConnection=tmpConnections[0];tmpData.TargetConnectionName=tmpConnections[0]._Slug;}}this.render();}).catch(pErr=>{if(this.log&&this.log.warn)this.log.warn('MapperShell-Connections: list connections failed for '+pBeaconName+': '+(pErr.message||pErr));});}_slug(pName){return String(pName||'').toLowerCase().trim().replace(/\s+/g,'-');}/**
	 * Build a pass-through Extraction OperationConfiguration for a clone.
	 *
	 * Strategy:
	 *   - Entity      = target table name (we keep source naming; user
	 *                   can rename in the Operations editor afterwards).
	 *   - GUIDName    = source's AutoGUID column if present, else
	 *                   `GUID<Entity>` (Meadow convention).
	 *   - GUIDTemplate= `{~D:Record.<GUIDName>~}` — re-use the source's
	 *                   per-row GUID directly so the clone preserves
	 *                   identity across runs (Meadow's CollisionRename
	 *                   behavior handles soft-delete/re-insert cycles).
	 *   - Filter      = {} (clone everything)
	 *   - Projection  = every column 1:1, EXCLUDING the AutoIdentity PK
	 *                   (target side allocates its own).
	 *
	 * Falls back to a minimal `{ Entity, Filter, Projection: {} }` when
	 * no column metadata is available — the user can fill in the editor.
	 */_buildExtractionConfig(pTableName,pTableMeta){let tmpEntity=pTableName;let tmpColumns=pTableMeta&&pTableMeta.Columns||[];// Find the source's GUID column (Meadow's AutoGUID type) — used
// both as the clone's GUIDName (target column to write into) and
// the source field referenced by GUIDTemplate.
let tmpGuidCol=tmpColumns.find(c=>c&&c.MeadowType==='AutoGUID');let tmpGuidName=tmpGuidCol?tmpGuidCol.Name:'GUID'+tmpEntity;let tmpGuidTemplate='{~D:Record.'+tmpGuidName+'~}';// Projection: every column except the source's AutoIdentity PK
// (the target meadow will allocate its own IDxxx). Includes the
// GUID column, audit columns, and data columns — so the clone is
// a faithful row-for-row mirror.
let tmpProjection={};for(let i=0;i<tmpColumns.length;i++){let tmpCol=tmpColumns[i];if(!tmpCol||!tmpCol.Name)continue;if(tmpCol.MeadowType==='AutoIdentity')continue;tmpProjection[tmpCol.Name]='{~D:Record.'+tmpCol.Name+'~}';}return{Entity:tmpEntity,GUIDName:tmpGuidName,GUIDTemplate:tmpGuidTemplate,Filter:{},Projection:tmpProjection};}// ── Slot population ──────────────────────────────────────────────
_populateSlots(){let tmpData=this.pict.AppData.MapperShell.Connections;// Beacon-list state slots.
tmpData.LoadingBeaconsSlot=tmpData.LoadState==='loading'?[{}]:[];tmpData.LoadErrorSlot=tmpData.LoadState==='error'?[{Message:tmpData.LoadErrorMessage}]:[];// Beacon dropdown options (source has all beacons; target excludes
// the currently-picked source beacon so we don't accidentally
// clone a beacon onto itself).
let tmpBeacons=tmpData.Beacons||[];tmpData.SourceBeaconOptions=tmpBeacons.map(b=>({Name:b.Name,SelectedAttr:b.Name===tmpData.SourceBeaconName?'selected':''}));tmpData.TargetBeaconOptions=tmpBeacons.filter(b=>b.Name!==tmpData.SourceBeaconName).map(b=>({Name:b.Name,SelectedAttr:b.Name===tmpData.TargetBeaconName?'selected':''}));// Connection dropdown options.
tmpData.SourceConnectionOptions=(tmpData.SourceConnections||[]).map(c=>({Name:c._Slug,Label:c.Name+' ('+(c.Type||'?')+')',SelectedAttr:tmpData.SourceConnection&&c._Slug===tmpData.SourceConnection._Slug?'selected':''}));tmpData.TargetConnectionOptions=(tmpData.TargetConnections||[]).map(c=>({Name:c._Slug,Label:c.Name+' ('+(c.Type||'?')+')',SelectedAttr:tmpData.TargetConnection&&c._Slug===tmpData.TargetConnection._Slug?'selected':''}));// Introspect button state.
let tmpCanIntrospect=!!(tmpData.SourceConnection&&tmpData.SourceConnection.IDBeaconConnection);tmpData.IntrospectDisabled=tmpCanIntrospect?'':'msh-cd-btn-disabled';tmpData.IntrospectLabel=tmpData.IntrospectState==='loading'?'Introspecting…':'Introspect →';// Introspect state slots.
tmpData.IntrospectingSlot=tmpData.IntrospectState==='loading'?[{Beacon:tmpData.SourceBeaconName,Connection:tmpData.SourceConnection?tmpData.SourceConnection.Name||'':''}]:[];tmpData.IntrospectErrorSlot=tmpData.IntrospectState==='error'?[{Message:tmpData.IntrospectErrorMessage}]:[];// Tables panel slot — only when introspect is ready AND we have any tables.
if(tmpData.IntrospectState==='ready'){tmpData.TablesPanelSlot=[this._buildTablesPanelRecord(tmpData)];}else{tmpData.TablesPanelSlot=[];}// Results panel slot — when CreateState is done.
if(tmpData.CreateState==='done'){tmpData.ResultsSlot=[this._buildResultsRecord(tmpData)];}else{tmpData.ResultsSlot=[];}}_buildTablesPanelRecord(pData){let tmpRows=(pData.TablesAvailable||[]).map(t=>{let tmpName=t.TableName||t.Name||'';let tmpColCount=t.Columns&&t.Columns.length||0;return{TableName:tmpName,ColumnCountLabel:tmpColCount+' columns',CheckedAttr:pData.SelectedTables[tmpName]?'checked':''};});let tmpSelectedCount=Object.keys(pData.SelectedTables).filter(k=>pData.SelectedTables[k]).length;let tmpReady=tmpSelectedCount>0&&!!pData.TargetConnection&&!!pData.SourceConnection&&pData.CreateState!=='creating';return{Tables:tmpRows,TotalCount:tmpRows.length,SelectedCount:tmpSelectedCount,CreateLabel:pData.CreateState==='creating'?'Creating…':'Create '+tmpSelectedCount+' clone operation'+(tmpSelectedCount===1?'':'s'),CreateDisabled:tmpReady?'':'msh-cd-btn-disabled'};}_buildResultsRecord(pData){let tmpItems=(pData.CreateResults||[]).map(r=>{let tmpStatus=r.Status||'success';return{TableName:r.TableName,Message:r.Message||'',Icon:tmpStatus==='success'?'✓':'✗',StatusClass:tmpStatus};});let tmpFails=tmpItems.filter(r=>r.StatusClass==='error').length;let tmpOverall=tmpFails===0?'success':tmpFails===tmpItems.length?'error':'partial';let tmpHeader=tmpOverall==='success'?'✓  Created '+tmpItems.length+' clone operation'+(tmpItems.length===1?'':'s'):tmpOverall==='error'?'✗  All '+tmpItems.length+' creates failed':'Partial — '+(tmpItems.length-tmpFails)+' of '+tmpItems.length+' succeeded';return{Items:tmpItems,HeaderLabel:tmpHeader,OverallStatusClass:tmpOverall};}}module.exports=MapperShellConnectionsView;module.exports.default_configuration=_Configuration;},{"pict-view":18}],46:[function(require,module,exports){/**
 * Retold DataMapper — MapperShell Layout View
 *
 * Main viewport for the cohesive mapper shell. Template owns the
 * top-nav slot and the four section destination divs (one per tab);
 * which one is visible is driven by AppData.MapperShell.ActiveTab and
 * styled via CSS sibling selectors against `data-active-tab` on the
 * shell root.
 */'use strict';const libPictView=require('pict-view');const LAYOUT_TEMPLATE=/*html*/`
<div class="msh-root" data-active-tab="{~Data:AppData.MapperShell.ActiveTab~}">
	<div id="MapperShell-TopNav"></div>
	<div class="msh-pane msh-pane-connections" id="MapperShell-Connections"></div>
	<div class="msh-pane msh-pane-mappings"    id="MapperShell-Mappings"></div>
	<div class="msh-pane msh-pane-operations"  id="MapperShell-Operations"></div>
	<div class="msh-pane msh-pane-dashboards"  id="MapperShell-Dashboards"></div>
</div>`;const SHELL_CSS=/*css*/`
.msh-root
{
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	background: #0e1a2b;
	color: #f8fafc;
	min-height: 100vh;
	display: flex;
	flex-direction: column;
}
.msh-pane { display: none; flex: 1; min-height: 0; }
.msh-root[data-active-tab="connections"] .msh-pane-connections { display: block; }
.msh-root[data-active-tab="mappings"]    .msh-pane-mappings    { display: block; }
.msh-root[data-active-tab="operations"]  .msh-pane-operations  { display: block; }
.msh-root[data-active-tab="dashboards"]  .msh-pane-dashboards  { display: block; }
`;const _Configuration={ViewIdentifier:'MapperShell-Layout',DefaultRenderable:'MapperShell-Layout-Renderable',DefaultDestinationAddress:'#MapperShell',DefaultTemplateRecordAddress:'AppData.MapperShell',AutoRender:true,RenderOnLoad:true,CSS:SHELL_CSS,CSSPriority:500,Templates:[{Hash:'MapperShell-Layout-Template',Template:LAYOUT_TEMPLATE}],Renderables:[{RenderableHash:'MapperShell-Layout-Renderable',TemplateHash:'MapperShell-Layout-Template',TemplateRecordAddress:'AppData.MapperShell',DestinationAddress:'#MapperShell',RenderMethod:'replace'}]};class MapperShellLayoutView extends libPictView{onAfterRender(pRenderable,pAddress,pRecord,pContent){this.pict.CSSMap.injectCSS();// The layout's destination divs (top-nav slot + 4 section panes)
// only exist after THIS render lands in the DOM. Trigger the
// shell's child-render pass now, while the destinations are
// guaranteed-present, instead of in the application's
// onAfterInitializeAsync (which fires too early).
let tmpApp=this.pict.PictApplication;if(tmpApp&&typeof tmpApp.renderChildren==='function'){tmpApp.renderChildren();}return super.onAfterRender(pRenderable,pAddress,pRecord,pContent);}}module.exports=MapperShellLayoutView;module.exports.default_configuration=_Configuration;},{"pict-view":18}],47:[function(require,module,exports){/**
 * Retold DataMapper — MapperShell Top Navigation View
 *
 * Renders the navigation tabs at the top of the mapper shell. Tabs:
 * Connections | Mappings | Operations | Dashboards.
 *
 * Tab clicks route through the shell's `selectTab(key)` so the shell
 * can update `AppData.MapperShell.ActiveTab` (which the layout's CSS
 * picks up via `data-active-tab` to swap which pane is visible) and
 * trigger the relevant section's `render()` if it hasn't been yet.
 *
 * Scope picker is at the shell level — single source of truth across
 * all four sections via the shared `retold.dataMapper.activeScope`
 * localStorage key.
 */'use strict';const libPictView=require('pict-view');const TOPNAV_TEMPLATE=/*html*/`
<div class="msh-topnav">
	<h1 class="msh-title">Retold Data Mapper</h1>
	<div class="msh-tabs">
		{~TS:MapperShell-TopNav-Tab:AppData.MapperShell.Tabs~}
	</div>
	<div class="msh-spacer"></div>
	<label class="msh-scope-label">scope
		<input class="msh-scope-input" type="text" spellcheck="false" placeholder="(global)"
			value="{~Data:AppData.MapperShell.Scope~}"
			oninput="_Pict.views['MapperShell-TopNav'].onScopeInput(this.value)" />
	</label>
</div>`;const TAB_TEMPLATE=/*html*/`
<a class="msh-tab msh-tab-{~Data:Record.ActiveClass~}" href="javascript:void(0)"
	onclick="_Pict.views['MapperShell-TopNav'].selectTab('{~Data:Record.Key~}')">{~Data:Record.Label~}</a>`;const TOPNAV_CSS=/*css*/`
.msh-topnav
{
	display: flex;
	align-items: center;
	gap: 16px;
	padding: 10px 18px;
	background: #0a1525;
	border-bottom: 1px solid #1e293b;
	flex-wrap: wrap;
}
.msh-title { margin: 0; font-size: 15px; font-weight: 600; color: #f8fafc; letter-spacing: 0.3px; }
.msh-tabs { display: flex; gap: 4px; }
.msh-spacer { flex: 1; }
.msh-tab
{
	padding: 6px 14px;
	border-radius: 4px;
	font-size: 12px;
	cursor: pointer;
	text-decoration: none;
	background: #16213e;
	color: #cbd5e1;
	border: 1px solid #1e293b;
}
.msh-tab:hover { background: #1e293b; color: #f8fafc; }
.msh-tab.msh-tab-active { background: var(--theme-color-brand-primary-hover, #1d4ed8); color: var(--theme-color-background-panel, #fff); border-color: var(--theme-color-brand-primary-hover, #1d4ed8); }
.msh-scope-label { color: #94a3b8; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; }
.msh-scope-input
{
	background: #0f172a;
	color: #f8fafc;
	border: 1px solid #1e293b;
	padding: 5px 9px;
	border-radius: 4px;
	font-size: 12px;
	font-family: monospace;
	width: 140px;
}
`;const _TabKeys=['connections','mappings','operations','dashboards'];const _TabLabels={connections:'Connections',mappings:'Mappings',operations:'Operations',dashboards:'Dashboards'};const _Configuration={ViewIdentifier:'MapperShell-TopNav',DefaultRenderable:'MapperShell-TopNav-Renderable',DefaultDestinationAddress:'#MapperShell-TopNav',DefaultTemplateRecordAddress:'AppData.MapperShell',AutoRender:false,// shell triggers render after layout mounts
RenderOnLoad:false,CSS:TOPNAV_CSS,CSSPriority:500,Templates:[{Hash:'MapperShell-TopNav-Template',Template:TOPNAV_TEMPLATE},{Hash:'MapperShell-TopNav-Tab',Template:TAB_TEMPLATE}],Renderables:[{RenderableHash:'MapperShell-TopNav-Renderable',TemplateHash:'MapperShell-TopNav-Template',TemplateRecordAddress:'AppData.MapperShell',DestinationAddress:'#MapperShell-TopNav',RenderMethod:'replace'}]};class MapperShellTopNavView extends libPictView{onBeforeRender(pRenderable,pAddress,pRecord,pContent){this._populateTabs();return super.onBeforeRender(pRenderable,pAddress,pRecord,pContent);}onAfterRender(pRenderable,pAddress,pRecord,pContent){this.pict.CSSMap.injectCSS();return super.onAfterRender(pRenderable,pAddress,pRecord,pContent);}_populateTabs(){let tmpActive=this.pict.AppData.MapperShell&&this.pict.AppData.MapperShell.ActiveTab||'connections';let tmpTabs=[];for(let i=0;i<_TabKeys.length;i++){let tmpKey=_TabKeys[i];tmpTabs.push({Key:tmpKey,Label:_TabLabels[tmpKey],ActiveClass:tmpKey===tmpActive?'active':'inactive'});}this.pict.AppData.MapperShell.Tabs=tmpTabs;}// ── Public API (called from inline handlers) ─────────────────────
selectTab(pKey){let tmpKey=String(pKey||'connections');if(_TabKeys.indexOf(tmpKey)<0)return;let tmpApp=this.pict.PictApplication;if(tmpApp&&typeof tmpApp.selectTab==='function'){tmpApp.selectTab(tmpKey);return;}// Fallback: just update AppData + re-render this view.
this.pict.AppData.MapperShell.ActiveTab=tmpKey;this.render();}onScopeInput(pValue){let tmpApp=this.pict.PictApplication;if(tmpApp&&typeof tmpApp.onScopeInput==='function'){tmpApp.onScopeInput(pValue);}}}module.exports=MapperShellTopNavView;module.exports.default_configuration=_Configuration;module.exports.TabKeys=_TabKeys;},{"pict-view":18}]},{},[25])(25);});
//# sourceMappingURL=retold-data-mapper.js.map
