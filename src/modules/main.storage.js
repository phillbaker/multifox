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
 * Portions created by the Initial Developer are Copyright (C) 2010
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


function windowLocalStorage(obj, contentDoc) {
 if (contentDoc.documentURI === "about:blank") { // BUG 1.9.2
   console.log("windowLocalStorage doc=", contentDoc.documentURI, "/", contentDoc.location);
   return "";
 }

 //var tabLogin = TabLogin.getFromDomWindow(contentDoc.defaultView);
 //console.assert(tabLogin !== null, "is contentDoc not from a tab?");

 var tabLogin = getJsCookieLogin(contentDoc.defaultView);

 var uri = tabLogin.formatUri(contentDoc.documentURIObject);

 var principal = Cc["@mozilla.org/scriptsecuritymanager;1"]
                 .getService(Ci.nsIScriptSecurityManager)
                 .getCodebasePrincipal(uri);

 var storage = Cc["@mozilla.org/dom/storagemanager;1"]
               .getService(Ci.nsIDOMStorageManager)
               .getLocalStorageForPrincipal(principal, "");

 var rv = undefined;
 switch (obj.cmd) {
   case "clear":
     storage.clear();
     break;
   case "removeItem":
     storage.removeItem(obj.key);
     break;
   case "setItem":
     storage.setItem(obj.key, obj.val); // BUG it's ignoring https
     break;
   case "getItem":
     rv = storage.getItem(obj.key);
     break;
   case "key":
     rv = storage.key(obj.index);
     break;
   case "length":
     rv = storage.length;
     break;
   default:
     throw new Error("localStorage interface unknown: " + obj.cmd);
 }

 //console.log("localStorage " + uri.spec + "\n"+JSON.stringify(obj, null, 2) + "\n=====\nreturn " + rv);
 return rv;
}




/*
const DomApi = {

 cookie: function() {

 },
 localStorage:

};
*/
/*
multifox[02:23:12.196] documentCookie _ __utma=254116750.112059089.1311479066.1311479066.1311479066.1; __utmz=254116750.1311479066.1.1.utmccn=(direct)|utmcsr=(direct)|utmcmd=(none); OSN=ID=F9WhqZm8iWI=:S=1F2IwB1IboiQ6sO0:; lobo=ut=1311484527180:tl=0:ct=0:; TZ=180; frame=C=CommMsgs%3Fcmm%3D698395%26tid%3D5629481869631749514 string [object Object] http://www.orkut.com.br/Main#CommMsgs?cmm=698395&tid=5628823300692608797
*/
function documentCookie(obj, contentDoc) {
 switch (obj.cmd) {
   case "set":
     documentCookieSetter(obj, contentDoc);
     return undefined;
   case "get":
     var xx=99;
     try{
     xx=documentCookieGetter(obj, contentDoc);
     return xx;
     }catch(ex){
       console.trace(ex);
     } finally {
       //console.log('documentCookie _',typeof xx,xx,obj, contentDoc.location);
     }
   default:
     throw new Error("documentCookie " + obj.cmd);
 }
}


function documentCookieSetter(obj, contentDoc) {
 //var tabLogin = TabLogin.getFromDomWindow(contentDoc.defaultView);
 //console.assert(tabLogin !== null, "not a tab document?");
 //if (tabLogin.isLoginInProgress) {
 //  tabLogin = TabLogin.getLoginInProgress(tabLogin.tabElement);
 //}

 // tabLogin can be anon and the new tabLogin can be a different login (e.g. facebook iframe)
 var tabLogin = getJsCookieLogin(contentDoc.defaultView);
 console.assert(tabLogin.isLoggedIn, "documentCookieSetter not logged in=" + tabLogin.toString()); // login cancelado, mas document já foi interceptado
 Cookies.setCookie(tabLogin, contentDoc.documentURIObject, obj.value, true);
}


function documentCookieGetter(obj, contentDoc) {
 //var tabLogin = TabLogin.getFromDomWindow(contentDoc.defaultView);
 //console.assert(tabLogin !== null, "not a tab document?");
 //if (tabLogin.isLoginInProgress) {
 //  tabLogin = TabLogin.getLoginInProgress(tabLogin.tabElement);
 //}

 var tabLogin = getJsCookieLogin(contentDoc.defaultView);
 console.assert(tabLogin.isLoggedIn, "documentCookieGetter not logged=" + tabLogin.toString() + "," + contentDoc.documentURI);

 var cookie2 = Cookies.getCookie(true, contentDoc.documentURIObject, tabLogin);
 var cookie = cookie2 === null ? "" : cookie2;
 return cookie; // send cookie value to content
}
