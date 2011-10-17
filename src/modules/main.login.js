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
 
 

 /*
 LOGIN
 =====
   post + login form: submit detected
     save username
       request will isolate data to login tld
       wait land page (it can be in another tld)
         success: commit
         fail: undo move data
 */

 const SubmitObserver = {
   QueryInterface: XPCOMUtils.generateQI([Ci.nsIFormSubmitObserver]),

   notify: function (form, win, actionURI, cancelSubmit) {
     console.assert(form.ownerDocument.defaultView === win, "form.ownerDocument.defaultView != win");
     this._notify(form, win);
     return true;
   },

   _notify: function(form, win) {
     if (form.method.toUpperCase() !== "POST") {
       return;
     }

     /*//pspb-----------------//or only add the listener to app-tabs?
     if (win.pinned !== true) {
         return;
     }
     //---------------------*/

     var locWin = win.document.location;
     var schWin = locWin.protocol.substr(0, locWin.protocol.length - 1);
     //var uri = win.document.documentURIObject;
     //console.log('_notify', uri.scheme, uri.spec, isSupportedScheme(uri.scheme), '*',win.document.location.href);
     if (isSupportedScheme(schWin) === false) {
       console.log('_notify false ', isSupportedScheme(schWin));
       return;
     }

     var tab = WindowParents.getTabElement(win);
     if (tab === null) {
       return null; // chrome form?
     }
     /*
     var tabLogin = TabLogin.getFromDomWindow(win);
     if (tabLogin === null) {
       tab = WindowParents.getTabElement(win);
       if (tab === null) {
         return null; // chrome form?
       }
     } else {
       tab = tabLogin.tabElement;
     }
     */

     if (countPasswordFields(form, true) === 0) {
       return; // no password provided => not a login form
     }

     var username = findUserName(form);
     if (username === null) {
       console.log("SubmitObserver: NOP, username not found, confirm pw form?");
       return; // TODO username = "random" or error message (icon);
     }
     /*
     if (username === null) {
       if (tabLogin.isLoggedIn) {
         console.log("SubmitObserver: NOP (username not found, confirm pw form?)");
       } else {
         console.log("SubmitObserver: NOP (username not found)");
       }
       return; // TODO username = "random" or error message (icon);
     }
     console.assert(username.length > 0, "SubmitObserver: findUserName");

     var d=stringToHex(username);
     console.log('username hex', username, d, hexToString(d));
     */
     // keep tab identity, request will need to copy its cookies
     TabLogin.setLoginInProgress(username, locWin.hostname, tab);
     tab.linkedBrowser.addEventListener("DOMContentLoaded", SubmitObserver._detectSubmitLandPage, false);
   },


   _detectSubmitLandPage: function(evt) { // DOMContentLoaded
     var contentDoc = evt.target;
     if (isEmptyPage(contentDoc)) {
       return;
     }

     // land page found!
     var tab = WindowParents.getTabElement(contentDoc.defaultView);
     //var tabLogin = TabLogin.getFromDomWindow(contentDoc.defaultView);
     //var tab = tabLogin.tabElement;
     tab.linkedBrowser.removeEventListener("DOMContentLoaded", SubmitObserver._detectSubmitLandPage, false);


     var newLogin = TabLogin.getLoginInProgress(tab);
     var moveMode = TabLogin.removeLoginInProgress(tab);
     console.assert(newLogin.plainTld  !== null, "multifox-login-submit-domain");
     console.assert(newLogin.plainUser !== null, "multifox-login-submit-user");


     if (hasLoginForm(contentDoc)) {
       console.log("submitLandPageFound", "login error detected", contentDoc.documentURI);
       // cancel login
       if (moveMode === "user") {
         moveMultifoxDomainDataToAnotherUser_cancel_login(newLogin);
       } else {
         SubmitObserver._moveDomainDataToDefault_cancel_login(newLogin);
       }

     } else {
       // commit login!
       console.log("submitLandPageFound", "login successful detected", contentDoc.documentURI);
       newLogin.saveToTab();
       updateUI(tab, true);
     }
   },

   // TODO moveDomainDataTo ... ***previous domain***
   _moveDomainDataToDefault_cancel_login: function(tabLogin) { // restoreDataDomain
     var srcHost = tabLogin.formatHost(tabLogin.plainTld);
     var all = removeTldData_cookies(srcHost);

     console.log('===>_moveDomainDataToDefault_cancel_login ', tabLogin.toString(), "=", srcHost, "_", all.length);

     for (var idx = all.length - 1; idx > -1; idx--) {
       var cookie = all[idx];
       var hostData = InternalHost.parseHost(cookie.host);
       if (hostData !== null) {
         copyCookieToNewHost(cookie, hostData.realHost);
       }
     }

     var all2 = removeTldData_LS(srcHost);

   }

 };


 function moveMultifoxDomainDataToAnotherUser_cancel_login(tabLogin) { // TODO
 }



 function copyDataToAnotherUser(tabTld, newLogin, prevLogin) {
   console.assert(prevLogin.plainTld === newLogin.plainTld, "copyDataToAnotherUser tld");
   if (prevLogin.equals(newLogin)) {
     return; // same user, do nothing
   }

   var tld = prevLogin.formatHost(tabTld);
   // don't remove data from current user, it may be still valid
   // some cookies may be unrelated to this login
   var all = getAllCookiesFromHost(tld);
   //var all = removeTldData_cookies(tld);

   console.log("copyDataToAnotherUser", tabTld, all.length, "cookies.", prevLogin.toString(), newLogin.toString());
   var cookie;
   var hostData;
   for (var idx = all.length - 1; idx > -1; idx--) {
     cookie = all[idx];
     hostData = InternalHost.parseHost(cookie.host);
     if (hostData !== null) {
       copyCookieToNewHost(cookie, newLogin.formatHost(hostData.realHost));
     }
   }

   //var all2 = removeTldData_LS(tld);
 }


 // isolate cookies from domain
 function copyData_fromDefault(domain, tabLogin) { // BUG se tabLogin.plainUser="" vai pensar NewAccount
   var all = getAllCookiesFromHost(domain);
   //var all = removeTldData_cookies(domain);

   console.log('===>copyData_fromDefault ', domain, tabLogin.toString(), "cookies:", all.length);
   var cookie;
   for (var idx = all.length - 1; idx > -1; idx--) {
     cookie = all[idx];
     //console.trace(toInternalHost(cookie.host, tabLogin) + cookie.host);
     console.log('->copyData_fromDefault ', cookie.host, tabLogin, tabLogin.formatHost(cookie.host));
     copyCookieToNewHost(cookie, tabLogin.formatHost(cookie.host));
   }

   console.log('copyData_fromDefault 2');
   var all2 = removeTldData_LS(domain);
   console.log('/===>copyData_fromDefault ');
 }


 function hasLoginForm(doc) { // TODO check frames; doesn't work on some facebook stuff
   if ("forms" in doc === false) {
     return false; // xml
   }

   var all = doc.forms;
   for (var idx = all.length - 1; idx > -1; idx--) {//TODO not a very intelligent way to do this, doesn't FF have something built in for its own password manager?
     var qty = countPasswordFields(all[idx], false);
     if (qty > 0) {
       return true;
     }
   }

   return false;
 }


 function countPasswordFields(form, populatedOnly) {
   var qty = 0;
   var all = form.elements;
   var INPUT = Ci.nsIDOMHTMLInputElement;
   for (var idx = all.length - 1; idx > -1; idx--) {
     var elem = all[idx];
     if ((elem instanceof INPUT) && (elem.type === "password")) {
       if (isElementVisible(elem)) {
         if (populatedOnly && (elem.value.trim().length === 0)) {
           continue;
         }
         qty++;
       }
     }
   }
   return qty;
 }


 function findUserName(form) {
   console.log("findUserName");
   var INPUT = Ci.nsIDOMHTMLInputElement;
   var lastTextField = null;
   var all = form.elements;
   var elem;

   for (var idx = 0, len = all.length; idx < len; idx++) {
     elem = all[idx];
     if ((elem instanceof INPUT) === false) {
       continue;
     }
     switch (elem.type) {
       case "text":
       case "email":
       case "url":
       case "tel":
       case "number":
       case "password":
         break;
       default:
         continue;
     }
     if ((elem.value.trim().length === 0) || isElementVisible(elem) === false) {
       // ignore empty/hidden fields
       console.log("findUserName", "element ignored", elem.name);
       continue;
     }
     if (elem.type === "password") {
       if (lastTextField !== null) {
         return lastTextField;
       }
     } else {
       lastTextField = elem.value;
       console.log("findUserName", "found", lastTextField);
     }
   }
   return lastTextField;
 }


 function isElementVisible(elem) {
   // some elements with display:none/visibility:hidden are already removed from form
   var win = elem.ownerDocument.defaultView;
   var val = win.getComputedStyle(elem, "").getPropertyValue("visibility");
   console.assert(val === "visible", "visibility", val);
   console.log('isElementVisible', "getBoundingClientRect().width " + elem.getBoundingClientRect().width, typeof elem.getBoundingClientRect().width, elem.tagName, elem.type, " name:" + elem.name);// + "=" + elem.value);

   return elem.getBoundingClientRect().width > 0;
   //return elem.value.trim().length > 0;
 }


 function onNewDoc_moveData_loginSubmitted(newLogin) {
   if (newLogin.hasLoginInProgressMoveData) {
     return;// newLogin;
   }

   console.log("onNewDoc_moveData_loginSubmitted");
   var currentLogin = new TabInfo(newLogin.tabElement); // TODO currentLogin is tabLogin?
   currentLogin.setTabAsAnon();

   // new login from a logged in tab
   if (currentLogin.isLoggedIn) {
     // tab is marked as logged in, but it is currently logged out (there is a login form...)
     currentLogin.setLoginInProgressMoveData("user");
     console.log("copyDataToAnotherUser logged=", currentLogin.toString(), newLogin.toString());
     copyDataToAnotherUser(newLogin.plainTld, newLogin, currentLogin);

   // "New Account" tab
   } else if (currentLogin.isNewUser) {
     currentLogin.setLoginInProgressMoveData("default");
     console.log("copyData_fromDefault logged=NewAccount");
     copyData_fromDefault(newLogin.plainTld, newLogin);

   // anonymous tab
   } else {
     currentLogin.setLoginInProgressMoveData("default");
     console.log("copyData_fromDefault logged=anon");
     copyData_fromDefault(newLogin.plainTld, newLogin);
   }

   //return newLogin;
 }