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


 const util2 = {

   logEx: function() {
     var buf = "logEx";// + this.logEx.caller + "\n";// + util2.throwStack._toString(false, Components.stack) + "===";
     for (var idx = 0, len = arguments.length; idx < len; idx++) {
       buf += "\n" + arguments[idx];// + "=" + this.caller[arguments[idx]];
     }

     buf += "\n====\n" + util2.throwStack._toString(false, Components.stack);
     console.log(buf);
   },

   throwStack: {

     go: function(txt) {
       console.log("Stack: " + txt + "\n" + this._toString(false, Components.stack));
       throw new Error(txt);
     },

     _toArray: function(webOnly, theStack) {
       var allItems = [];
       if (!theStack) {
         return allItems;
       }

       function StackItem() {}
       StackItem.prototype = {
         lang: "?",
         filename: "?",
         lineNumber: -1,
         name: "?"
       };

       // aparentemente é um bug que ocorre as vezes, todas as propriedades sao undefined
       if (theStack.languageName == undefined) {
         var item = new StackItem();
         item.name = theStack.toString();
         allItems.push(item);
       }

       // myStack.caller é quase sempre null, mas algumas vezes é undefined...
       for (var myStack = theStack; myStack; myStack = myStack.caller) {
         if (webOnly) {
           var n = myStack.filename;
           if (n === null) {
             continue;
           }

           if ((n.indexOf("http:") !== 0) && (n.indexOf("https:") !== 0)) {
             continue;
           }
         }


         var item = new StackItem();
         allItems.push(item);
         item.lang = myStack.languageName;
         item.filename = myStack.filename;
         item.lineNumber = myStack.lineNumber; // Valid line numbers begin at "1". "0" indicates unknown.
         item.name = myStack.name;
       }

       allItems.reverse();
       return allItems;
     },

     _toString: function(webOnly, theStack) {
       var arr = this._toArray(webOnly, theStack);
       var lines = new Array(arr.length);
       for (var idx = arr.length - 1, idx2 = 0; idx > -1; idx--) {
         var lang = webOnly ? "" : arr[idx].lang + " ";
         lines[idx2] = "[" + (idx + 1) + "] "
                     + lang
                     + arr[idx].filename + " "
                     + arr[idx].name + " ("
                     + arr[idx].lineNumber + ")";
         idx2++;
       }
       return lines.join("\n");
     }

   }
 };




 function endsWith(sufix, str) { // TODO usar hasRootDomain!!!
   var idx = str.lastIndexOf(sufix);
   if (idx === -1) {
     return false;
   }
   var idxMatch = str.length - sufix.length;
   return idx === idxMatch;
 }



 const InternalHost = {

   // .youtube.com ==> .youtube.com.<hexstrip>.multifox-anon-ns

   // .youtube.com ==> .youtube.com.<hex(youtube.com)>-<hex(user)>-<hex(tld)>.multifox-login-ns
   // www.yimg.com ==> www.yimg.com.<hex(www.yimg.com)>-<hex(user)>-<hex(tld)>.multifox-anon-ns
   //                                     ^^^-- TODO usar tld?


 /*
   decode: function(hex) {
     return hexToString(hex);
   },

   encode: function(txt) {
     return stringToHex(txt);
   },
 */


   isInternalLoggedIn: function(host) { // used by onCookieChanged
     return hasRootDomain("multifox-auth-1", host);
   },

   getLoggedCookies: function() {
     var all = getAllCookiesFromHost("multifox-auth-1");
     return all;
   },

   getUserCookies: function(encUser, encTld) {
     var rv = [];
     var hexlogin = "-" + encUser + "-" + encTld;
     this._getUserCookies(rv, hexlogin, "multifox-auth-1");
     this._getUserCookies(rv, hexlogin, "multifox-anon-1");
     console.log("getUserCookies", rv.length);
     return rv;
   },

   _getUserCookies: function(rv, hexlogin, ns) {
     var all = getAllCookiesFromHost(ns);
     var cookie;
     var suffix = hexlogin + "." + ns;
     for (var idx = all.length - 1; idx > -1; idx--) {
       cookie = all[idx];
       if (endsWith(suffix, cookie.host)) {
         rv.push(cookie);
       }
     }
   },


   parseHost_enc: function(internalHost) {
     var a = internalHost.split(".").reverse();
     console.assert(a[0] === "multifox-auth-1", "invalid 87");
     var strip = a[1].split("-");
     if (strip.length !== 3) {
       return null;
     }
     return {
       enc_data: a[1],
       enc_realHostTld:  strip[0],
       enc_myUser: strip[1],
       enc_myTld:  strip[2]
     };
   },


   //getRealHost: function(internalHost) {
   parseHost: function(internalHost) { // TODO users de parseHost soh querem realHost
     var suf = ".multifox-auth-1";
     if (endsWith(suf, internalHost) === false) {
       console.assert(endsWith(".multifox-anon-1", internalHost) === false, "invalid 88");
       return null;
     }

     var a = internalHost.split(".").reverse();
     console.assert(a[0] === "multifox-auth-1", "invalid 87");
     var strip = a[1].split("-");
     console.assert(strip.length === 3, "invalid 89");
     var host = a.slice(2).reverse().join(".");

     //console.log('InternalHost.parseHost', internalHost, strip, host);

     return {
       // TODO retornar tb realHost TLD? host = getTldFromHost(hostData.realHost);
       realHost:  host,
       myUser: hexToString(strip[1]),
       myTld:  hexToString(strip[2])
     };
   }

 };




 const TabLogin = { //TabLoginStatic IdProvider

   NewAccount: "",

   create: function(tabElement, encUser, encTld) {
     return new TabInfo(tabElement, encUser, encTld);
   },

   getLoginInProgress: function(tab) { // BUG should new TabLogin be aware it is LoginInProgress?
     //var tab = this.tabElement;
     if (tab.hasAttribute("multifox-login-submit-domain")) { // BUG tab undef ao verificar update
       var usr = tab.getAttribute("multifox-login-submit-user")
       var tld = tab.getAttribute("multifox-login-submit-domain");
       return TabLogin.create(tab, stringToHex(usr), stringToHex(tld));
     } else {
       return null;//TabLogin.create(tab, null, null);
     }
   },

   removeLoginInProgress: function(tab) {
     var moveMode = tab.getAttribute("multifox-login-submit-data-moved");
     tab.removeAttribute("multifox-login-submit-domain");
     tab.removeAttribute("multifox-login-submit-user");
     tab.removeAttribute("multifox-login-submit-data-moved");
     return moveMode;
   },

   setLoginInProgress: function(username, host, tab) {
     console.assert(username.length > 0, "no username");
     tab.setAttribute("multifox-login-submit-user", username);
     tab.setAttribute("multifox-login-submit-domain", getTldFromHost(host));
   },

   getFromDomWindow: function(contentWin) {
     if (contentWin === null) {
       return null;
     }

     var url = contentWin.document.documentURI;
     if (url.length === 0) {
       return null;
     }

     var tab = WindowParents.getTabElement(contentWin);
     return (tab === null) ? null : new TabInfo(tab);
   }

 };



 function TabInfo(tabElement, usr, tld) {
   console.assert(tabElement !== null, "tab is invalid");

   if (usr === undefined) {
     console.assert(tld === undefined, "usr=undefined");
     if (tabElement.hasAttribute("multifox-tab-id-provider-tld-enc")) {
       usr = tabElement.getAttribute("multifox-tab-id-provider-user-enc");
       tld = tabElement.getAttribute("multifox-tab-id-provider-tld-enc");
     } else {
       usr = null;
       tld = null;
     }
   }
   this._userEncoded = usr;
   this._tldEncoded = tld;
   this.tabElement = tabElement;
 }


 TabInfo.prototype = {

   formatUri: function(uri) {
     var u = uri.clone();
     u.host = this.formatHost(u.host);
     return u;
   },

   formatHost: function(host) {
     if (this.isNewUser) {
       //console.log('toInternalHost TabLogin.NewAccount', host, this._tldEncoded, this._userEncoded);
       return host;
     }

     console.assert(typeof host === "string", "invalid domain2 ="+host);
     console.assert(typeof this._userEncoded === "string", "invalid user=" + this._userEncoded);
     console.assert(typeof this._tldEncoded === "string", "invalid loginTld=" + this._tldEncoded);
     //console.assert(this._userEncoded.indexOf(".${INTERNAL__DOMAIN__SUFFIX}") === -1, "invalid user");

     // We need to use tld(host) ==> otherwise, we couldn't (easily) locate the cookie for different subdomains
     // TODO perf mandar TLD com params
     var hex = stringToHex(getTldFromHost(host)) + "-" + this._userEncoded + "-" + this._tldEncoded;
     var suffix = this.isExternalAnonResource ? ".multifox-anon-1" : ".multifox-auth-1";
     return host + "." + hex + suffix;
   },


   equals: function(tabLogin) {
     return (tabLogin._userEncoded === this._userEncoded) && (tabLogin._tldEncoded === this._tldEncoded);
   },

   toString: function() {
     return "loginTld=" + this.plainTld + " loginUser=" + this.plainUser;
   },

   get plainTld() {
     return this._tldEncoded === null ? null : hexToString(this._tldEncoded);
   },

   get plainUser() {
     return this._tldEncoded === null ? null : hexToString(this._userEncoded);
   },

   get encodedTld() {
     return this._tldEncoded;
   },

   get encodedUser() {
     return this._userEncoded;
   },


   get hasUser() {
     return this._userEncoded !== null;
   },

   get isNewUser() {
     return this._userEncoded === TabLogin.NewAccount;
   },

   get isLoggedIn() {
     var usr = this._userEncoded;
     return (usr !== null) && (usr !== TabLogin.NewAccount);
   },

   getTabTld: function() {
     // use "location", "documentURI" may not reflect changes in hash (e.g. Twitter)
     return getTldFromHost(this.tabElement.linkedBrowser.contentDocument.location.hostname);
   },
   getTabTldEncoded: function() {
     return stringToHex(this.getTabTld());
   },
 /*
   get loginObject
   updateIcon:
   setKey -- attr
 */
   toAnon: function() { // toUnlogged
     var tabLogin = new TabInfo(this.tabElement, this.encodedUser, this.encodedTld);
     tabLogin.anonResource = true;
     Object.freeze(tabLogin);
     return tabLogin;
   },

   get isExternalAnonResource() {
     return "anonResource" in this;//TODO come here on new tab
   },


   setTabAsAnon: function() {
     var tab = this.tabElement;
     console.trace("setTabAsAnon " + tab.getAttribute("multifox-tab-id-provider-tld-enc"));
     if (tab.hasAttribute("multifox-tab-id-provider-tld-enc")) {
       tab.removeAttribute("multifox-tab-id-provider-tld-enc");
       tab.removeAttribute("multifox-tab-id-provider-user-enc");
       invalidateUI(tab);
     }
   },

   saveToTab: function() { //apply
     var tab = this.tabElement;
     if (tab.hasAttribute("multifox-tab-error")) {
       // reset error icon
       tab.removeAttribute("multifox-tab-error");
     }

     var domain = this._tldEncoded;
     var user = this._userEncoded;

     //console.trace("commit login " + user + " at " + domain);

     console.assert(domain !== null, "setLogin tld=null");
     console.assert(typeof(domain) === "string", "setLogin tld="+domain);
     console.assert(typeof(user) === "string", "setLogin user="+user);

     if (tab.hasAttribute("multifox-tab-id-provider-tld-enc") === false) {
       tab.setAttribute("multifox-logging-in", "true"); // TODO
     }

     tab.setAttribute("multifox-tab-id-provider-tld-enc", domain);
     tab.setAttribute("multifox-tab-id-provider-user-enc", user);

     invalidateUI(tab);
   },


   get isLoginInProgress() {
     return this.tabElement.hasAttribute("multifox-login-submit-domain");
   },

   get hasLoginInProgressMoveData() {
     return this.tabElement.hasAttribute("multifox-login-submit-data-moved");
   },

   setLoginInProgressMoveData: function(mode) {
     this.tabElement.setAttribute("multifox-login-submit-data-moved", mode);
   }

 };


 const WindowParents = {

   getTabElement: function(contentWin) {
     var chromeWin = this.getChromeWindow(contentWin);
     if ((chromeWin !== null) && ("getBrowser" in chromeWin)) {
       var elem = chromeWin.getBrowser();
       switch (elem.tagName) {
         case "tabbrowser":
           var topDoc = contentWin.top.document;
           var idx = elem.getBrowserIndexForDocument(topDoc);
           if (idx > -1) {
             return getTabs(elem)[idx];
           }
           break;
         default: // view-source => tagName="browser"
           // Note that this file uses document.documentURI to get
           // the URL (with the format from above). This is because
           // document.location.href gets the current URI off the docshell,
           // which is the URL displayed in the location bar, i.e.
           // the URI that the user attempted to load.
           console.log("getTabElement=" + elem.tagName + "\n" +
                        contentWin.document.documentURI+ " " +chromeWin.document.location +"\n"+
                        contentWin.document.location   + " " +chromeWin.document.documentURI);
           break;
       }
     }
     return null;
   },

   getChromeWindow: function(contentWin) { // getTopWindowElement
     if (!contentWin) console.trace('contentWin='+contentWin);
     var qi = contentWin.QueryInterface;
     if (!qi) {
       return null;
     }

     if (contentWin instanceof Ci.nsIDOMChromeWindow) {
       // extensions.xul, updates.xul ...
       return contentWin;
     }

     var win = qi(Ci.nsIInterfaceRequestor)
                 .getInterface(Ci.nsIWebNavigation)
                 .QueryInterface(Ci.nsIDocShell)
                 .chromeEventHandler
                 .ownerDocument
                 .defaultView;
     // wrappedJSObject allows access to gBrowser etc
     // wrappedJSObject=undefined sometimes. e.g. contentWin=about:multifox
     var unwrapped = win.wrappedJSObject; // TODO XPCNativeWrapper.unwrap?
     return unwrapped ? unwrapped : win;
   }

 };




 const OpenerWindowIdentity = { // TODO move to TabLogin?

   findFromWindow: function(contentWin) {
     // popup via js/window.open?
     if (contentWin.opener) {
       //console.log("_getFromOpenerContent opener=" + contentWin.opener.document.location);
       var tabOpener = WindowParents.getTabElement(contentWin.opener);
       if (tabOpener) {
         return new TabInfo(tabOpener);
       }
     }

     //console.log("_getFromOpenerContent - no opener=" + contentWin.opener);

     // fx starting ==> opener=null
     return this.findFromOpenerSelectedTab(contentWin); // id from selected tab
   },


   findFromOpenerSelectedTab: function(contentWin) {
     var chromeWin = WindowParents.getChromeWindow(contentWin);
     if (chromeWin && chromeWin.opener) {
       var type = chromeWin.opener.document.documentElement.getAttribute("windowtype");
       if (type === "navigator:browser") {
         var selTab = chromeWin.opener.getBrowser().selectedTab;
         return new TabInfo(selTab);
       }
     }

     return null;
   }
 };



 function getTabs(tabbrowser) {
   return tabbrowser.mTabContainer.childNodes;
 }


 // var serialize = {
 function getUtf8Converter() {
   var conv = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
   conv.charset = "UTF-8";
   return conv;
 }


 function stringToBytes(str) {
   return getUtf8Converter().convertToByteArray(str, {});
 }


 function bytesToString(bytes) {
   return getUtf8Converter().convertFromByteArray(bytes, bytes.length);
 }



 function stringToHex(str) {
   var bin = stringToBytes(str); // "€".charCodeAt(0) = 8364
   var len = bin.length;
   var hex = new Array(len * 2);

   var j = 0;
   var alphabet = "abcdefghijklmnop";

   for (var idx = 0; idx < len; idx++) {
     var myByte = bin[idx];
     var nibble1 = (myByte & 0xf0) >> 4;
     var nibble0 =  myByte & 0x0f;
     hex[j++] = alphabet[nibble1];
     hex[j++] = alphabet[nibble0];
   }

   return hex.join("");
 }


 function hexToString(hex) { // stringDecode
   console.assert(typeof hex === "string", "hexToString val=" + hex);
   var len = hex.length / 2;
   if (len === 0) {
     return "";
   }

   console.assert((len % 1) === 0, "invalid hex string: " + hex);
   var bin = new Array(len);

   var j = 0;
   var offset = 97; // 97="abcdefghijklmnop".charCodeAt(0)

   for (var idx = 0; idx < len; idx++) {
     var nibble1 = hex.charCodeAt(j++) - offset;
     var nibble0 = hex.charCodeAt(j++) - offset;
     bin[idx] = (nibble1 << 4) | nibble0;
   }

   return bytesToString(bin);
 }



 function getTldFromHost(host) {
   /*
  if (host.indexOf(":") > - 1) {
     return host; // literal ipv6 (e.g. 3ffe:2a00:100:7031::1)
   }
   var first = host.charCodeAt(0);
   if ((first >= 48) && (first <= 57)) { // "0123456789"
     return host; // literal ipv4 (e.g. 127.0.0.1, 0x7f.0.0.1)
   }
   */

   var firstDot = host.indexOf(".");
   if (firstDot === -1) {
     return host; // "localhost"
   }

   // firstDot=0 ("...local.host") (e.g. from cookies)
   // OBS "..local.host" return "localhost"
   if (firstDot === 0) {
     return getTldFromHost(host.substr(1)); // recursive
   }

   //  "localhost" ==> -1 exception
   // ".localhost" ==>  0 exception
   // ".loc.al.ho.st" ==> 0 exception
   //  "local.host" ==> >0 OK
   try {
     return Services.eTLD.getBaseDomainFromHost(host);
   } catch (ex) {
     if (ex.result !== Components.results.NS_ERROR_HOST_IS_IP_ADDRESS) {
       console.trace(host + "/" + ex);
     }
     return host; // literal ipv4/ipv6?
   }
 }



 /*

 Cu.import("resource://gre/modules/Services.jsm");
 Services.eTLD.getBaseDomainFromHost("10.11.12.13");

 const Cc = Components.classes;
 const Ci = Components.interfaces;

 function getUtf8Converter() {
   var conv = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
   conv.charset = "UTF-8";
   return conv;
 }

 function bytesToString(bytes) {
   return getUtf8Converter().convertFromByteArray(bytes, bytes.length);
 }


 function hexToString(hex) {
   var len = hex.length / 2;
   var bin = new Array(len);

   var j = 0;
   var offset = 97;

   for (var idx = 0; idx < len; idx++) {
     var nibble1 = hex.charCodeAt(j++) - offset;
     var nibble0 = hex.charCodeAt(j++) - offset;
     bin[idx] = (nibble1 << 4) | nibble0;
   }

   return bytesToString(bin);
 }

 hexToString('gmgjgoglgfgegjgocogdgpgn');

 multifox[03:57:17.781] LoginData.setDefaultLogin user not found   ghgpgpghgmgfcogdgpgn ["gihfgmhegngbgogo"]

 gggbgdgfgcgpgpglcogdgpgn gihfgmhegngbgogoeaghgngbgjgmcogdgpgn gggbgdgfgcgpgpglcogdgpgn               hultmann@gmail.com facebook.com
 gggbgdgfgcgpgpglcogdgpgn gkgigmhegngogodcdc                   hehhgjhehegfhccogdgpgn    facebook.com jhltmnn22 twitter.com
 gggbgdgfgcgpgpglcogdgpgn gchcfpgngphkgegfhg                   hehhgjhehegfhccogdgpgn                 br_mozdev twitter.com


 gggbgdgfgcgpgpglcogdgpgn-gihfgmhegngbgogo                    -hdhegbhegdgphfgohegfhccogdgpgn statcounter.com
 gggbgdgfgcgpgpglcogdgpgn-gihfgmhegngbgogoeaghgngbgjgmcogdgpgn-gggbgdgfgcgpgpglcogdgpgn
 */