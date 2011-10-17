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

BROWSING PROTOCOL


UPDATING TAB ATTRIBUTES: "multifox-tab-id-provider-tld-enc" + "multifox-tab-id-provider-user-enc"
========================================================================

*** START => SUBMIT
- in progress => user/pw submitted and copied to tab attr: "multifox-login-submit-domain" + "multifox-login-submit-user"

*** END => submitLandPageFound
- remove attrs multifox-login-submit-*
- success => commit: setLogin
- fail => restore data domain

*** REQUEST
- login in progress?
  - channel: LOAD_DOCUMENT_URI + top document (ignore subdocs)
  - POST request detected ==> onNewDoc_moveData_loginSubmitted
  - move cookies/data to a namespace


*** RESPONSE



*** DOCUMENT CREATED
*/

/*
function getChannelResponseLogin(channel, win) {
  var tabLogin = TabLogin.getFromDomWindow(win);
  if (tabLogin === null) {
    return null; // tab not found: request from chrome (favicon, updates, <link rel="next"...)
  }


  if (isWindowChannel(channel)) {
    if (tabLogin.isLoginInProgress) {
      return TabLogin.getLoginInProgress(tabLogin.tabElement);
    }

    if (isTopWindow(win)) {
      return tabLogin; // channel will replace window
    }
    return getSubElementLogin(channel.URI, tabLogin, null);

  } else {
    return getSubElementLogin(channel.URI, tabLogin, win);
  }

  if (tabLogin.isLoggedIn === false) {
    return null;
  }

}
*/


function getRequestChannelUser(channel, win) {
  var tabLogin = TabLogin.getFromDomWindow(win);
  if (tabLogin === null) {
    var chromeWin = WindowParents.getChromeWindow(win);
    if (chromeWin && (chromeWin.document.documentURI === "chrome://global/content/viewSource.xul")) {
      // view source window
      return OpenerWindowIdentity.findFromOpenerSelectedTab(win);
    }
    //console.log("getRequestChannelUser", "NO TAB", channel.URI.spec);
    return null; // tab not found: request from chrome (favicon, updates, <link rel="next"...)
  }


  var requestUri = channel.URI;
  if (isSupportedScheme(requestUri.scheme) === false) {
    // tabLogin is invalid ==> use default session
    tab.removeAttribute("multifox-tab-current-tld");
    tabLogin.setTabAsAnon();
    return null;
  }


  if (isWindowChannel(channel)) {
    // channel will create a document (top or frame)
    if (tabLogin.isLoginInProgress) { // flagged by SubmitObserver
      console.log('isLoginInProgress new doc', channel.URI.spec);
      // obs: getLoginInProgress and getFromDomWindow may both be valid (and different)
      tabLogin = TabLogin.getLoginInProgress(tabLogin.tabElement);
      onNewDoc_moveData_loginSubmitted(tabLogin); // login may be successful, so move cookies now. it may be canceled later.
      return tabLogin;
    }

    if (isTopWindow(win)) {
      // channel will replace the current top document
      return defineTopWindowLogin(requestUri, tabLogin);
    } else {
      // frames shouldn't modify tab identity (obs: frames may have a login, e.g. facebook)
      return getSubElementLogin(requestUri, tabLogin, null);
    }

  } else {
    // img, css, xhr...
    if (tabLogin.isLoginInProgress) {
      // A XHR may set a cookie in default session after a login is detected.
      // We should use login for subelements only after data is moved to a Multifox session.
      if (tabLogin.hasLoginInProgressMoveData) {
        tabLogin = TabLogin.getLoginInProgress(tabLogin.tabElement);
      }
    }
    return getSubElementLogin(requestUri, tabLogin, win);
  }
}


function defineTopWindowLogin(requestUri, prevLogin) {//TODO come here on new tab and enter URL
  console.log("defineTopWindowLogin", requestUri.spec);
  var tab = prevLogin.tabElement;
  var redirInvalidated = tab.hasAttribute("multifox-redir-invalidate");
  if (redirInvalidated) {
    RedirDetector.resetTab(tab);
  }

  var requestTld = getTldFromHost(requestUri.host);
  var prevTopTld = null; // null => new tab or unsupported scheme
  if (tab.hasAttribute("multifox-tab-current-tld")) {
    prevTopTld = tab.getAttribute("multifox-tab-current-tld");
    if (prevTopTld === requestTld) {
      console.log("prevTopTLD === requestTld")
      // prevLogin is still valid!
      // BUG login happens in another tab => this one will keep anonymous (LoginData.getDefaultLogin is never called)
      return prevLogin.isNewUser ? null : prevLogin;
    }
  }

  // New TLD! (prevLogin is [probably] invalid for the new top document)

  var newLogin = defineNewTldLogin(requestTld, tab, prevLogin, prevTopTld, redirInvalidated);
  if (newLogin === null) {
    console.log('requestTld',requestTld);
    prevLogin.setTabAsAnon(); // there is no login provider for requestTld
  } else {
    newLogin.saveToTab();
  }
  updateUI(tab); // show new user now (instead of waiting new dom)
  return newLogin;
}


function defineNewTldLogin(requestTld, tab, prevLogin, prevTopTld, redirInvalidated) {
  var prevPrevTopTld = tab.hasAttribute("multifox-tab-previous-tld")
                     ? tab.getAttribute("multifox-tab-previous-tld") : null;

  // we know 3 TLDs:
  //   requestTld     - new tld
  //   prevTopTld     - previous tld (associated with prevLogin)
  //   prevPrevTopTld - previous to previous tld

  tab.setAttribute("multifox-tab-previous-tld", prevTopTld);
  tab.setAttribute("multifox-tab-current-tld", requestTld);

  console.log('new tld ', prevPrevTopTld, "==>", prevTopTld, '==>', requestTld);

  // cross login in progress
  var commitCrossLogin = inheritFromPreviousTld(redirInvalidated, prevPrevTopTld, prevTopTld, requestTld, prevLogin);
  if (commitCrossLogin) {
    console.log("COMMITCROSSLOGIN", redirInvalidated, prevPrevTopTld, prevTopTld, requestTld, prevLogin);
    //tab.ownerDocument.defaultView.alert("commitCrossLogin "+ "\n"+redirInvalidated+ "\n"+ prevPrevTopTld+ "\n"+ prevTopTld+ "\n"+ requestTld+ "\n"+ prevLogin);
    copyData_fromDefault(requestTld, prevLogin); // requestTld=default
    tab.setAttribute("multifox-cross-login-commited-wait-landing-page", "true");
    tab.linkedBrowser.addEventListener("DOMContentLoaded", checkEmptyPage, false);
    return prevLogin;
  }

  // cross login done
  if (tab.hasAttribute("multifox-cross-login-commited-wait-landing-page")) {
    return prevLogin;
  }

  // popups
  if (tab.ownerDocument.documentElement.hasAttribute("multifox-window-uninitialized")) { // BUG com sessionrestore, vai processar ao abrir nova aba; considerar o no. de abas?
    tab.ownerDocument.documentElement.removeAttribute("multifox-window-uninitialized");
    // prevLogin is from opener
    var openerPrevLogin = OpenerWindowIdentity.findFromWindow(tab.linkedBrowser.contentWindow);
    if (openerPrevLogin !== null) {
      // opener tab found
      prevLogin = TabLogin.create(tab, openerPrevLogin.encodedUser, openerPrevLogin.encodedTld);
    }
  }

  // prevLogin: may keep user => different tld, same login
  return LoginData.getDefaultLogin(requestTld, prevLogin);
}



function getJsCookieLogin(domWin) { // getJsMethodLogin
  // tabLogin can be anon and the new tabLogin can be a different login (e.g. domWin=facebook iframe)
  var tabLogin = TabLogin.getFromDomWindow(domWin);
  console.assert(tabLogin !== null, "is contentDoc not from a tab?");


  if (isTopWindow(domWin)) {
    if (tabLogin.isLoginInProgress) {
      if (tabLogin.hasLoginInProgressMoveData) {
        // data already moved to new user
        tabLogin = TabLogin.getLoginInProgress(tabLogin.tabElement);
      }
    }
    return tabLogin;
  }


  // domWin=iframe


  if (tabLogin.isLoginInProgress) {
    if (tabLogin.hasLoginInProgressMoveData) {
      return TabLogin.getLoginInProgress(tabLogin.tabElement);
    } else {
      return tabLogin;
    }
  }



  var tld = getTldFromHost(domWin.document.location.hostname);
  var iframeLogin = LoginData.getDefaultLogin(tld, tabLogin);
  if (iframeLogin !== null) {
    return iframeLogin;

  } else {
    // iframe tld is not a consumer ==> third party iframe
    console.log('getJsCookieLogin - executing method from anon iframe', tld, '- top ', domWin.top.document.location);
    return tabLogin.toAnon();
  }
}


// tab element = css, img, iframe, ... ==> not called for top doc, so tabLogin is already valid
function getSubElementLogin(elemUri, tabLogin, elementWindow) {
  var tldElem = getTldFromHost(elemUri.host); // TODO enviar ja como tld

  if (elementWindow === null) {
    // elemUri is an iframe!
    var a = LoginData.getDefaultLogin(tldElem, tabLogin); // tabLogin = dummy value
    if (a !== null) {
      // frame has a known login
      console.log("getSubElementLogin iframe login found!", tldElem);
      return a;
    }

    // resource
    //console.log("getSubElementLogin anonResource", tldElem);
    return tabLogin.toAnon();
  }


  // ==> img/style/script

  if (isTopWindow(elementWindow) === false) {
    // elemUri = elem inside elementWindow (an iframe) ==> different TLD from tab?
    // elementWindow.documentURIObject may be null
    var iframe = elementWindow.location;
    var schFrame = iframe.protocol.substr(0, iframe.protocol.length - 1);
    //console.log("getSubElementLogin element/iframe", tldElem, elementWindow, schFrame, elementWindow.location, "/", elementWindow.documentURIObject === null, elementWindow.documentURIObject);
    if (isSupportedScheme(schFrame) === false) {
      return null;
    }
    var iframeLogin = LoginData.getDefaultLogin(getTldFromHost(iframe.hostname), tabLogin); // tabLogin = dummy value

    if (iframeLogin !== null) {
      if (iframeLogin.isNewUser) {
        return null;
      }
      if (LoginData.providerHasThisConsumer(stringToHex(tldElem), iframeLogin.encodedUser, iframeLogin.encodedTld)) { // WTF
        return iframeLogin;
      }
    }

    // resource
    //console.log("getSubElementLogin anonResource", tldElem);
    return tabLogin.toAnon();
  }


  // resource (css/js) from top window

  if (tabLogin.isLoggedIn === false) {
    return null;
  }

  // tldLogin = google.com
  // tab host = www.youtube.com
  // elemUri  = img.youtube.com
  if (tldElem === tabLogin.plainTld) {
    return tabLogin;
  }

  var tabTld = tabLogin.getTabTld(); //= tabLogin.tabElement.getAttribute("multifox-tab-current-tld");
  if (tldElem === tabTld) {
    return tabLogin;
  }

  // tldElem != tabLogin.plainTld ==> is tldElem logged in?

  if (LoginData.providerHasThisConsumer(stringToHex(tldElem), tabLogin.encodedUser, tabLogin.encodedTld)) {
    return tabLogin;
  }

  // resource
  return tabLogin.toAnon();
}


/*
CROSS-TLD LOGIN PROTOCOL
TLD COPY LOGIN PROTOCOL
========================
*/

function inheritFromPreviousTld(redirInvalidated, prevPrevTopTld, prevTopTld, requestTld, prevLogin) {
  if (redirInvalidated ||
     (prevPrevTopTld === null) || (prevTopTld === null) ||
     (prevLogin === null)      || (prevLogin.isLoggedIn === false)) {
    return false;
  }

  console.log('REDIR! 0');
  return (prevPrevTopTld === requestTld) &&
         (LoginData.hasConsumer(stringToHex(requestTld)) === false) &&
         LoginData.hasConsumer(stringToHex(prevTopTld));
}


function checkEmptyPage(evt) { // DOMContentLoaded
  var contentDoc = evt.target;
  console.log('checkEmptyPage top=', contentDoc.defaultView === contentDoc.defaultView.top, contentDoc.location);
  if (isEmptyPage(contentDoc)) {
    return;
  }
  var tab = WindowParents.getTabElement(contentDoc.defaultView);
  //var tabLogin = TabLogin.getFromDomWindow(contentDoc.defaultView);
  //var tab = tabLogin.tabElement;
  tab.removeAttribute("multifox-cross-login-commited-wait-landing-page");
  tab.linkedBrowser.removeEventListener("DOMContentLoaded", checkEmptyPage, false);
}


// ugly workaround, but it works most of the time
const RedirDetector = {

  onMouseDown: function(evt) {
    //console.log('onmouse', evt.currentTarget, evt.originalTarget, evt.target.ownerDocument.location, evt.altKey, evt.ctrlKey, evt.keyCode, evt.charCode, evt.keyCode !== 0);
    if (evt.button === 0) {
      var win = evt.currentTarget;
      RedirDetector._invalidateSelectedTab(win);
    }
  },

  onKeyDown: function(evt) {
    // keypress--> charCode=0
    //console.log('onkey', evt.currentTarget, evt.originalTarget, evt.target.ownerDocument.location, evt.altKey, evt.ctrlKey, evt.keyCode, evt.charCode, evt.keyCode !== 0);
    var k = Ci.nsIDOMKeyEvent;
    //if (evt.altKey || evt.ctrlKey || (evt.keyCode !== 0) || (evt.charCode === k.DOM_VK_SPACE)) {
    if (evt.keyCode < 33) {
      // keyCode ==> backspace, enter
      // DOM_VK_SPACE ==> submit form
      var win = evt.currentTarget;
      RedirDetector._invalidateSelectedTab(win);
    }
  },

  _invalidateSelectedTab: function(win) {
    if (win === null) {
      return;
    }
    var tab = WindowParents.getTabElement(win);
    /*
    var tab = null;
    var tabLogin = TabLogin.getFromDomWindow(win); // BUG win: chrome or dom?
    if (tabLogin === null) {
      if ("getBrowser" in win) {
        tab = win.getBrowser().selectedTab;
      }
    } else {
      tab = tabLogin.tabElement; // BUG se tab nao tem login, precisa invalidar?
    }*/
    RedirDetector.invalidateTab(tab);
  },

  invalidateTab: function(tab) {
    if ((tab === null) || tab.hasAttribute("multifox-redir-invalidate")) {
      return;
    }

    tab.setAttribute("multifox-redir-invalidate", "true");
  },

  resetTab: function(tab) {
    tab.removeAttribute("multifox-redir-invalidate");
  }
};


function isWindowChannel(channel) {
  return (channel.loadFlags & Ci.nsIChannel.LOAD_DOCUMENT_URI) !== 0;
}


function isTopWindow(win) {
  return win === win.top;
}


function isEmptyPage(contentDoc) {
  //var a = contentDoc.getElementsByTagName("head")[0].getElementsByTagName("*").length;
  var body = contentDoc.getElementsByTagName("body");
  var tags = body.length > 0 ? body[0].getElementsByTagName("*").length : 0;

  // TODO
  /*
  var all = contentDoc.forms;
  var qty = 0;
  for (var idx = all.length - 1; idx > -1; idx--) {
    qty += countPasswordFields(all[idx], ???);
  }
  */
  console.log("isEmptyPage", tags < 15, contentDoc.location);
  return tags < 15;
}





/*
FORM LOGIN
  SUBMIT
    Land Page
      Fail
      Success




browse ANON_TLD
[...]

browser AUTH_TLD
save multifox-cross-login-try-anon-tld=ANON_TLD
[...]

returns to ANON_TLD. Should add ANON_TLD to AUTH_TLD space?
- redir? yes!
- just made a login in AUTH_TLD? yes!
- How?
  - click on last page?
  - redir

- redir se nao houve click/key/fav na last page setAtribute("multifox-last-page-had-user-action", "") (nao contar chrome ev)



ANON_TLD_2 (logged or not)
  - set watched-tld="new_tld_1"
  - land page:
    - login form => abort() (use form protocol)
  - redirect to "new_tld_1"

ANON_TLD_1
*/