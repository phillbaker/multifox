/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Multifox.
 *
 * The Initial Developer of the Original Code is
 * Jeferson Hultmann <hultmann@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var m_runner = null;

const BrowserWindow = {

 register: function(win) {
   console.log("BrowserWindow.register");

   if (m_runner === null) {
     // first multifox tab!
     m_runner = new MultifoxRunner();
   }


   // some MultifoxContentEvent_* listeners are not called when
   // there are "unload" listeners with useCapture=true. o_O
   // But they are called if event listener is an anonymous function.
   win.addEventListener("unload", ChromeWindowEvents, false);
   win.addEventListener("activate", ChromeWindowEvents, false);
   win.addEventListener(m_runner.eventSentByContent, onContentEvent, false, true);
   win.addEventListener("mousedown", RedirDetector.onMouseDown, false); // command/click listeners can be called after network request
   win.addEventListener("keydown", RedirDetector.onKeyDown, false);

   var tabbrowser = win.getBrowser();
   tabbrowser.addEventListener("pageshow", updateNonNetworkDocuments, false);

   var container = tabbrowser.tabContainer;
   container.addEventListener("TabSelect", TabContainerEvents, false);
   container.addEventListener("TabClose", TabContainerEvents, false);
   container.addEventListener("SSTabRestoring", TabContainerEvents, false);

   // restore icon after toolbar customization
   var toolbox = win.document.getElementById("navigator-toolbox");
   toolbox.addEventListener("DOMNodeInserted", customizeToolbar, false);


   win.document.documentElement.setAttribute("multifox-window-uninitialized", "true");
 },


 unregister: function(win) {
   console.log("BrowserWindow.unregister");

   win.removeEventListener("unload", ChromeWindowEvents, false);
   win.removeEventListener("activate", ChromeWindowEvents, false);
   win.removeEventListener(m_runner.eventSentByContent, onContentEvent, false);
   win.removeEventListener("mousedown", RedirDetector.onMouseDown, false);
   win.removeEventListener("keydown", RedirDetector.onKeyDown, false);

   var tabbrowser = win.getBrowser();
   tabbrowser.removeEventListener("pageshow", updateNonNetworkDocuments, false);

   var container = tabbrowser.tabContainer;
   container.removeEventListener("TabSelect", TabContainerEvents, false);
   container.removeEventListener("TabClose", TabContainerEvents, false);
   container.removeEventListener("SSTabRestoring", TabContainerEvents, false);

   var toolbox = win.document.getElementById("navigator-toolbox");
   toolbox.removeEventListener("DOMNodeInserted", customizeToolbar, false);

   // TODO last window?
   /*
   if () {
     m_runner.shutdown();
     m_runner = null;
   }
   */
 }
};


var ChromeWindowEvents = {
 handleEvent: function(evt) {
   try {
     this[evt.type](evt);
   } catch (ex) {
     Cu.reportError(ex);
     throw new Error("ChromeWindowEvents exception " + ex);
   }
 },

 unload: function(evt) {
   var win = evt.currentTarget;
   BrowserWindow.unregister(win);
 },

 activate: function(evt) {
   var win = evt.currentTarget;
   var tab = win.getBrowser().selectedTab;
   LoginData.setTabAsDefaultLogin(tab);//BUG init m_welcomeMode, mas falta attr current-tld

   //console.log('win activate', m_welcomeMode);
   LoginData._ensureValid(); // BUG workaround to display welcome icon
   if (m_welcomeMode) {
     updateUI(tab, true);
   }
 }
}


const TabContainerEvents = {//TODO put something here to add if its an app tab
 handleEvent: function(evt) {
   try {
     this[evt.type](evt);
   } catch (ex) {
     Cu.reportError(ex);
     throw new Error("TabContainerEvents exception " + ex);
   }
 },

 TabClose: function(evt) {
   var tab = evt.originalTarget;
   MoveTabWindows.tabCloseSaveId(tab);
 },

 TabSelect: function(evt) {
   var tab = evt.originalTarget;
   MoveTabWindows.tabSelectDetectMove(tab); // moved tab: set id
   updateUI(tab, true);
 },

 SSTabRestoring: function(evt) {
   var tab = evt.originalTarget;
   updateUI(tab, true);
 }
};


// first run?
function onStart() {
 var prefName = "extensions.multifox@hultmann.currentVersion";
 var prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch2);
 var ver = prefs.prefHasUserValue(prefName) ? prefs.getCharPref(prefName) : "";
 if (ver === "2.0b3") {
   return;
 }
 prefs.setCharPref(prefName, "2.0b3");


 // TODO ss.deleteWindowValue(doc.defaultView, "multifox-dom-identity-id");

 // remove Multifox 1.x cookies
 var profileId = 2;
 var all;
 do {
   all = removeTldData_cookies("multifox-profile-" + profileId);
   console.log("Migrating: removing cookies 1.x", profileId, ":", all.length);
   profileId++;
 } while ((profileId < 20) || (all.length > 0));


 // remove Multifox 2.x beta 1 cookies
 all = removeTldData_cookies("x-content.x-namespace");
 console.log("Migrating: removing cookies 2.0b1", all.length);

 // remove Multifox 2.x beta 2 cookies
 all = removeTldData_cookies("-.x-namespace");
 console.log("Migrating: removing cookies 2.0b2", all.length);

 // remove Multifox 2.x beta 3 cookies
 //all = removeTldData_cookies("multifox-auth-1");
 //var all2 = removeTldData_cookies("multifox-anon-1");
 //console.log("Migrating: removing cookies 2.0b3", all.length + all2.length);
}


function customizeToolbar(evt) {
 var node = evt.target;
 if ((node.id === "urlbar-container") && (node.parentNode.tagName === "toolbar")) {
   var tab = node.ownerDocument.defaultView.getBrowser().selectedTab;
   updateUI(tab, true);
 }
}


function onContentEvent(evt) {
 evt.stopPropagation();

 var obj = JSON.parse(evt.data);
 var contentDoc = evt.target;
 var rv;
 //console.log('onContentEvent', obj.from);

 switch (obj.from) {
   case "cookie":
     rv = documentCookie(obj, contentDoc);
     //console.log('documentCookie ',obj.cmd,typeof rv,rv,contentDoc.location);
     break;
   case "localStorage":
     rv = windowLocalStorage(obj, contentDoc);
     break;
   case "error":
     showError(contentDoc.defaultView, obj.cmd, "-");
     break;
   default:
     throw new Error("onContentEvent: " + obj.from);
 }

 if (rv === undefined) {
   // no response
   return;
 }

 // send data to content
 var evt2 = contentDoc.createEvent("MessageEvent");
 evt2.initMessageEvent(m_runner.eventSentByChrome, false, false, rv, null, null, null);
 var success = contentDoc.dispatchEvent(evt2);
}


function MultifoxRunner() {
 console.log("MultifoxRunner");
 //m_cookieMgr = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager2); // TODO


 this._sentByChrome  = "multifox-chrome_event-"  + Math.random().toString(36).substr(2);
 this._sentByContent = "multifox-content_event-" + Math.random().toString(36).substr(2);
 this._inject = new DocStartScriptInjection();

 var obs = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
 obs.addObserver(SubmitObserver, "earlyformsubmit", false);
 obs.addObserver(LoginData.onCookieRejected, "cookie-rejected", false);
 obs.addObserver(LoginData.onCookieChanged, "cookie-changed", false);

 Cookies.start();
 util.networkListeners.enable(httpListeners.request, httpListeners.response);

 onStart();
}


MultifoxRunner.prototype = {
 get eventSentByChrome() {
   return this._sentByChrome;
 },

 get eventSentByContent() {
   return this._sentByContent;
 },

 shutdown: function() {
   console.log("MultifoxRunner.shutdown");
   util.networkListeners.disable();
   this._inject.stop();
   Cookies.stop();
   LoginData.shutdown();

   var obs = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
   obs.removeObserver(SubmitObserver, "earlyformsubmit");
   obs.removeObserver(LoginData.onCookieRejected, "cookie-rejected");
   obs.removeObserver(LoginData.onCookieChanged, "cookie-changed");
 }
};


function showError(contentWin, notSupportedFeature, details) {
 var msg = [];
 msg.push("ERROR=" + notSupportedFeature);
 msg.push(details);
 if (contentWin.document) {
   msg.push("location=" + contentWin.document.location);
   if (contentWin.document.documentURIObject) {
     msg.push("uri=     " + contentWin.document.documentURIObject.spec);
   }
 }
 msg.push("title=[" + contentWin.document.title + "]");
 console.log(msg.join("\n"));

 var tab = WindowParents.getTabElement(contentWin);
 tab.setAttribute("multifox-tab-error", notSupportedFeature);
 updateUI(tab, true);
}