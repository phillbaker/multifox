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



function removeTldData_LS(tld) {
 // TODO del localStorage
}



function copyCookieToNewHost(cookie, newHost) {
 var expiryTime = cookie.isSession ? 4611686018427388 : cookie.expiry; // Math.pow(2, 62)=4611686018427388000
 var mgr = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager2);
 mgr.add(newHost,         cookie.path,
         cookie.name,     cookie.value,
         cookie.isSecure, cookie.isHttpOnly, cookie.isSession, expiryTime);

 //console.log("/copyCookieToNewHost exp", newHost, cookie.name, cookie.isSession, cookie.expiry, expiryTime, new Date(1000 * expiryTime));
}


function removeTldData_cookies(tld) { // TODO del ".multifox-anon-1" + ".multifox-auth-1"
 var all = getAllCookiesFromHost(tld);
 console.log('removeCookies n=', all.length, tld);

 var mgr = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager2);
 var cookie;
 for (var idx = all.length - 1; idx > -1; idx--) {
   cookie = all[idx];
   mgr.remove(cookie.host, cookie.name, cookie.path, false);
 }
 return all;
}


function getAllCookiesFromHost(h) {
 var rv = [];
 var mgr = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager2);
 var COOKIE = Ci.nsICookie2;

 var _qty = 0;
 var _t = new Date().getTime();

 // TODO use mgr.getCookiesFromHost when it doesn't have bugs
 var all = mgr.enumerator;
 while (all.hasMoreElements()) {
   var cookie = all.getNext().QueryInterface(COOKIE);
   _qty++;
   if (hasRootDomain(h, cookie.host)) {
     rv.push(cookie);
   }
 }

 console.log("getAllCookiesFromHost time=" + (new Date().getTime() - _t) + "ms -- len parsed=" + _qty + " -- len rv=" + rv.length);
 return rv;
}


//getLoginFromInternalHost 1 .google.com.x-tab.x-session.jrklas.x-tab.x-session.google.com.x-tab.x-session4 - false
/*
multifox[04:06:42.337] getLoginFromInternalHost    .google.com.x-tab.x-session.jrklas.x-tab.x-session.google.com.x-tab.x-session
[".google.com",
 ".jrklas",
 ".google.com",
 ""
]

multifox[04:06:42.337] getLoginFromInternalHost .statcounter.com.x-tab.x-session.gihfgmhegngbgogo.statcounter.com.x-tab.x-session
[".statcounter.com",
 ".gihfgmhegngbgogo.statcounter.com",
 ""
]

*/


function hasRootDomain(domain, host) {
 if (host === domain) {
   return true;
 }

 var idx = host.lastIndexOf(domain);
 if (idx === -1) {
   return false;
 }

 //return (index == (this.length - aDomain.length)) && (prevChar == "." || prevChar == "/");
 if ((host.length - domain.length) === idx) {
   return host[idx - 1] === ".";// || prev === "/";
 }

 return false;
}