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


const httpListeners = {
 request: {
   QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),

   // nsIObserver
   observe: function REQUEST(aSubject, aTopic, aData) {

try{

     var httpChannel = aSubject.QueryInterface(Ci.nsIHttpChannel);
     var win = getChannelWindow(httpChannel);

     if (win === null) {
       // safebrowsing, http://wpad/wpad.dat
       return;
     }

     var isWin = isWindowChannel(httpChannel);
     var isXhr = false;
     if (httpChannel.notificationCallbacks) {
       isXhr = httpChannel.notificationCallbacks instanceof Ci.nsIXMLHttpRequest;
       try{
         isXhr = httpChannel.notificationCallbacks.getInterface(Ci.nsIXMLHttpRequest) != null;
       }catch(ex){
       }
     }

     /*
     if (isWin || isXhr) {
       console.log("===>request", isWin ? "DOC" : "ELEM", isXhr ? "(XHR)" : "",
                   "\n", httpChannel.requestMethod, httpChannel.URI.spec,
                   "\n", "WIN", win === win.top ? "top" : "frame", win.document.documentURI, win.document.href);
     }
     */

     var tabLogin = getRequestChannelUser(httpChannel, win); // TODO requestLogin
     if ((tabLogin === null) || (tabLogin.isLoggedIn === false)) {
       /*
       console.log("===>request DEFAULT", isWin ? "DOC" : "ELEM", isXhr ? "(XHR)" : "",
                   "\n", httpChannel.requestMethod, httpChannel.URI.spec,
                   "\n", "WIN", win === win.top ? "top" : "frame", win.document.documentURI, win.document.href);
       */
       return; // use default session
     }

     var myHeaders = HttpHeaders.fromRequest(httpChannel);
     if (myHeaders["authorization"] !== null) {
       showError(win, "authorization", "-");
       return;
     }


     RequestLogin.save(tabLogin, httpChannel);


     var cook = Cookies.getCookie(false, httpChannel.URI, tabLogin);
     httpChannel.setRequestHeader("Cookie", cook, false);



}catch(ex){
 console.trace();
 Cu.reportError(ex);
}


   }
 },

 response: {
   QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),

   // nsIObserver
   observe: function RESPONSE(aSubject, aTopic, aData) {
     var httpChannel = aSubject.QueryInterface(Ci.nsIHttpChannel);
     var tabLogin = RequestLogin.get(httpChannel);

     if (tabLogin === null) {
       var win2 = getChannelWindow(httpChannel);
       var myHeaders = HttpHeaders.fromResponse(httpChannel);
       //console.log('response ANON ', (win2?win2.document.location:'NULL?'), myHeaders["set-cookie"], httpChannel.URI.spec);
       RequestLogin.findSavedLogin_byurl(httpChannel.URI.spec);
       return; // use original Set-Cookie
     }

     var myHeaders = HttpHeaders.fromResponse(httpChannel);
     if (myHeaders["www-authenticate"] !== null) {
       var win = getChannelWindow(httpChannel);
       if (win === null) {
         return;
       }
       showError(win, "www-authenticate", "-");
       return;
     }

     var setCookies = myHeaders["set-cookie"];
     if (setCookies === null) {
       return;
     }

     // replace "Set-Cookie"
     httpChannel.setResponseHeader("Set-Cookie", null, false);
     Cookies.setCookie(tabLogin, httpChannel.URI, setCookies, false);
   }
 }
};


const RequestLogin = {
 _logins:   [],
 _channels: [],

 save: function(tabLogin, request) {
   this._logins.push(tabLogin);
   this._channels.push(Cu.getWeakReference(request));
 },

 get: function(response) {
   //var response = Cu.getWeakReference(channel).get();
   var chann = this._channels;
   for (var idx = chann.length - 1; idx > -1; idx--) {
     var request = chann[idx].get();
     if (request !== null) {
       if (request === response) {
         chann.splice(idx, 1);
         return this._logins.splice(idx, 1)[0];
       }
     } else {
       // remove request without response (from cache)?
       chann.splice(idx, 1);
       this._logins.splice(idx, 1);
     }
   }
   return null;
 },


 findSavedLogin_byurl: function(url) {
   for (var idx = this._channels.length - 1; idx > -1; idx--) {
     var request = this._channels[idx].get();
     if (request) {
       if (request.URI.spec == url) {
         console.log('findSavedLogin_byurl', url);
       }
     }
   }
 }


};


// pageshow event => call updateUI for non http/https protocols and cached pages
function updateNonNetworkDocuments(evt) {//TODO also come here a lot
 var doc = evt.target;
 var uri = doc.documentURIObject; // TODO pegar doc.location?
 if (isTopWindow(doc.defaultView) === false) {
   return;
 }

 if (isSupportedScheme(uri.scheme)) {
   // BUG rightclick>show image ==> evt.persisted=false
   // BUG google => br.mozdev=>back=>fw fica login do goog
   if (evt.persisted) {
     // http top doc from cache
     var tabLogin = TabLogin.getFromDomWindow(doc.defaultView);
     if (tabLogin !== null) {
       var tab = tabLogin.tabElement;
       RedirDetector.invalidateTab(tab); // invalidate redir before calling defineTopWindowLogin
       var dummy = defineTopWindowLogin(uri, tabLogin);
       updateUI(tab);
     }
   }

 } else { // about: etc
   // request listener was not called
   var tabLogin = TabLogin.getFromDomWindow(doc.defaultView);
   if (tabLogin !== null) {
     console.log('updateNonNetworkDocuments del',uri.scheme);
     var tab = tabLogin.tabElement;
     tab.removeAttribute("multifox-tab-current-tld");
     RedirDetector.resetTab(tab);
     tabLogin.setTabAsAnon();
     updateUI(tab);
   }
 }

}


const HttpHeaders = {
 visitLoop: {
   values: null,
   visitHeader: function(name, value) {
     var n = name.toLowerCase();
     if (n in this.values) {
       this.values[n] = value;
     }
   }
 },

 fromRequest: function(request) {
   var nameValues = {
     //"cookie": null, //for debug only
     "authorization": null
   }
   this.visitLoop.values = nameValues;
   request.visitRequestHeaders(this.visitLoop);
   return nameValues;
 },

 fromResponse: function(response) {
   var nameValues = {
     "set-cookie": null,
     "www-authenticate": null
   }
   this.visitLoop.values = nameValues;
   response.visitResponseHeaders(this.visitLoop);
   return nameValues;
 }
};


function getChannelWindow(channel) {
 if (channel.notificationCallbacks) {
   try {
     return channel
             .notificationCallbacks
             .getInterface(Ci.nsILoadContext)
             .associatedWindow;
   } catch (ex) {
     //util2.logEx("channel.notificationCallbacks ", channel.notificationCallbacks, channel.URI.spec, ex);
   }
 }

 if (channel.loadGroup && channel.loadGroup.notificationCallbacks) {
   try {
     return channel
             .loadGroup
             .notificationCallbacks
             .getInterface(Ci.nsILoadContext)
             .associatedWindow;
   } catch (ex) {
     util2.logEx("channel.loadGroup", channel.loadGroup, channel.URI.spec, ex);
   }
 }

 //var isChrome = context.associatedWindow instanceof Ci.nsIDOMChromeWindow;
 //return context.isContent ? context.associatedWindow : null;
 //console.log("LOAD CONTEXT FAIL " + channel.URI.spec);
 return null; // e.g. <link rel=prefetch> <link rel=next> ...
}