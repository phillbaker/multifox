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

this._counterTld= {
  "abcdefghj-iabc-abc": 5
}

this._providers = {
  "google.com": [
    "efghijklmnop",
    "abcdefghijkl"
  ],
  "twtter.com": [
    "efghijklmnop",
  ]


this._consumers = {
  "my-app.com": [
    "google.com",
    "facebook.com",
    "twitter.com"
  ],
  "orkut.com": [
    "google.com"
  ],
*/

const LoginData = {
  _providers: null,
  _consumers: null,
  _counterTld: null, // trigger _update
  _invalidated: true,

  _reset: function() {
    this._providers = { __proto__: null };
    this._consumers = { __proto__: null };
    this._counterTld = { __proto__: null };
    this._invalidated = false;
  },

  shutdown: function() {
    this._providers = null;
    this._consumers = null;
    this._counterTld = null;
  },

  _invalidate: function() {
    console.trace("_invalidate");
    this._invalidated = true;
  },

  _ensureValid: function() {
    if (this._invalidated) {
      this._update();
      this._invalidated = false;
    }
  },


  setTabAsDefaultLogin: function(tab) {
    var tabLogin = new TabInfo(tab);
    if (tabLogin.hasUser) {
      this.setDefaultLogin(tabLogin.getTabTldEncoded(), tabLogin.encodedUser, tabLogin.encodedTld);
    }
  },

  //setDefaultLoginForTab vs. setDefaultLoginForResource
  setDefaultLogin: function setDefaultLogin_(consumerTldEnc, providerUserEnc, providerTldEnc) {
    console.assert(typeof consumerTldEnc === "string", "consumerTldEnc=" + consumerTldEnc);
    console.assert(typeof providerUserEnc === "string",   "providerUserEnc=" + providerUserEnc);
    console.assert(typeof providerTldEnc === "string",    "providerTldEnc=" + providerTldEnc);
    //console.log("LoginData.setDefaultLogin", consumerTldEnc, providerUserEnc, providerTldEnc, hexToString(consumerTldEnc), hexToString(providerUserEnc), hexToString(providerTldEnc));

    this._ensureValid();

    if ((consumerTldEnc in this._consumers) === false) {
      console.log("LoginData.setDefaultLogin", "consumerTldEnc not found", consumerTldEnc);
      return;
    }

    if ((providerTldEnc in this._providers) === false) {
      console.log("LoginData.setDefaultLogin", "providerTldEnc not found", providerTldEnc, hexToString(providerTldEnc));
      return;
    }

    var consumerProviders = this._consumers[consumerTldEnc]; // usually len=1
    var idx2 = consumerProviders.indexOf(providerTldEnc);
    if (idx2 > 0) {                 // [0] => already the default
      consumerProviders.splice(idx, 1);
      consumerProviders.unshift(consumerTldEnc); // BUG consumerTldEnc ou providerTldEnc???
      console.log("LoginData.setDefaultLogin updated0", providerTldEnc, consumerTldEnc);
    }

    var allUsers = this._providers[providerTldEnc];
    var idx = allUsers.indexOf(providerUserEnc);
    switch (idx) {
      case 0:
        // nop: user is already the default
        break;
      case -1:
        // user not found (cookies cleared?)
        if (providerUserEnc === TabLogin.NewAccount) {
          console.log("LoginData.setDefaultLogin NewAccount", providerTldEnc, this._providers[providerTldEnc].toSource(), allUsers.toSource());
          console.trace();
          console.log('_update\nProviders:' + JSON.stringify(this._consumers, null, 2)
               + "\n==========\nConsumers:" + JSON.stringify(this._providers, null, 2)
                   + "\n==========\nHosts:" + JSON.stringify(this._counterTld, null, 2));


          allUsers.unshift(TabLogin.NewAccount);
        }
        break;
      default:
        allUsers.splice(idx, 1);
        allUsers.unshift(providerUserEnc); // [0] => default
        console.log("LoginData.setDefaultLogin updated1", hexToString(providerUserEnc), providerUserEnc, providerTldEnc, this._providers[providerTldEnc].toSource());
        break;
    }
  },

/*
  reuseTabInfo: function(tld, fallbackTabInfo) {
  getDefaultLogin: function(tld, tab) {

*/
  getDefaultLogin: function(tld, fallbackTabInfo) {
    this._ensureValid();

    var encTld = stringToHex(tld);
    if ((encTld in this._consumers) === false) {
      if (hexToString(encTld).indexOf('.faceboo') > -1) {
        console.trace(tld);
      }
      console.log("LoginData.getDefaultLogin - not a consumer", hexToString(encTld));
      return null;
    }

    // obs: loginUser16/loginTld may be null
    var loginTlds = this._consumers[encTld];
    var defaultFormTld = loginTlds[0];
    if (defaultFormTld === fallbackTabInfo.encodedTld) {
      //console.log("LoginData.getDefaultLogin", "don't change user", fallbackTabInfo.plainUser, fallbackTabInfo.plainTld);
      return fallbackTabInfo; // reuse/don't change current user
    }

    console.assert(defaultFormTld in this._providers, "this._providers " + defaultFormTld + "/" + tld);
    var users = this._providers[defaultFormTld];
    console.assert(users.length > 0, "users.length");
    var defaultUser = users[0];


    var newLogin = TabLogin.create(fallbackTabInfo.tabElement, defaultUser, defaultFormTld);

    /*
    if (defaultUser === TabLogin.NewAccount) {
      users.splice(0, 1); // workaround - middle click on "New Account" -- BUG next calls won't be NewAccount
      console.log("LoginData.getDefaultLogin", "user NEW ", defaultFormTld, fallbackTabInfo.toString());
    }
    */

    //console.log('_update\n' + JSON.stringify(this._consumers, null, 2) + "\n==========\n" + JSON.stringify(this._providers, null, 2));
    console.log("LoginData.getDefaultLogin0", "user found ", defaultUser, defaultFormTld);
    console.log("LoginData.getDefaultLogin1", "user found ", hexToString(defaultUser), hexToString(defaultFormTld));
    return newLogin;
  },


  addCookie: function(rawHost) {
    if (InternalHost.isInternalLoggedIn(rawHost) === false) {
      return;
    }

    var hostData = InternalHost.parseHost_enc(rawHost);
    var encStrip  = hostData.enc_data;
    if (encStrip in this._counterTld) {
      this._counterTld[encStrip]++;
    } else {
      this._counterTld[encStrip] = 1;
      this._invalidate(); // new login?
      console.log("cookie ADD _invalidate!", hostData.enc_realHostTld, hostData.enc_myUser);
    }

    //if (this.providerHasThisConsumer(hostData.enc_realHostTld, hostData.enc_myUser, hostData.enc_myTld) === false) {
    //  this._invalidate(); // login added
    //}
  },


  deleteCookie: function(rawHost) {
    if (InternalHost.isInternalLoggedIn(rawHost) === false) {
      return false;
    }
    var counter = this._counterTld;
    if (counter === null) {
      return false;
    }
    var hostData = InternalHost.parseHost_enc(rawHost);
    var encStrip = hostData.enc_data;
    console.assert(encStrip in counter, "!encStrip in this._counterTld " + encStrip);
    counter[encStrip]--;
    if (counter[encStrip] > 0) {
      return false;
    }
    delete counter[encStrip];
    this._invalidate(); // login removed?
    console.log('deleteCookie invalidated', rawHost, counter[encStrip], JSON.stringify(counter, null, 2));
    return true;
  },


  _update: function _update_() {
    console.trace("LoginData._update");
    var oldProviders = this._providers; // save current defaults
    var oldConsumers = this._consumers;
    this._reset();

    var hostData;
    var users;

    var all = InternalHost.getLoggedCookies();
    setWelcomeMode(all.length === 0);

    for (var idx = all.length - 1; idx > -1; idx--) {
      var rawHost = all[idx].host;

      hostData = InternalHost.parseHost_enc(rawHost);
      if (hostData === null) {
        continue;
      }

      var encStrip  = hostData.enc_data;
      var siteTld   = hostData.enc_realHostTld; // hostConsumer
      var loginUser = hostData.enc_myUser; // encUsrProvider
      var loginTld  = hostData.enc_myTld; //  encTldProvider

      if (encStrip in this._counterTld) {
        this._counterTld[encStrip]++;
      } else {
        this._counterTld[encStrip] = 1;
      }

      if (loginTld in this._providers) {
        var aa = this._providers[loginTld];
        if (aa.indexOf(loginUser) === -1) {
          aa.push(loginUser);
        }
      } else {
        this._providers[loginTld] = [loginUser];
      }


      if (siteTld in this._consumers) {
        var bb = this._consumers[siteTld];
        if (bb.indexOf(loginTld) === -1) {
          bb.push(loginTld);
        }
      } else {
        this._consumers[siteTld] = [loginTld];
      }

    }

    // keep default users
    for (var tabTld in oldConsumers) {
      var tld = oldConsumers[tabTld][0];
      var user = oldProviders[tld][0];
      this.setDefaultLogin(tabTld, user, tld);
    }

    console.log('_update\nProviders:' + JSON.stringify(this._consumers, null, 2)
         + "\n==========\nConsumers:" + JSON.stringify(this._providers, null, 2)
             + "\n==========\nHosts:" + JSON.stringify(this._counterTld, null, 2));
  },


  providerHasThisConsumer: function(consumerTldEncoded, providerUserEncoded, providerTldEncoded) {
    this._ensureValid();
    if (consumerTldEncoded in this._consumers) {
      var providers = this._consumers[consumerTldEncoded];
      var useProviderTld = providers.indexOf(providerTldEncoded) > -1;
      if (useProviderTld) {
        if (providerTldEncoded in this._providers) {
          if (this._providers[providerTldEncoded].indexOf(providerUserEncoded) > -1) {
            return true;
          }
        }
      }
    }
    return false;
  },

  hasConsumer: function(consumerTldEncoded) {
    this._ensureValid();
    return consumerTldEncoded in this._consumers;
  },

  getEncodedTldUsers: function(enc_tabTld) { // tabTld = "orkut.com.br" (login: "XYZ.google.com")
    this._ensureValid();
    if ((enc_tabTld in this._consumers) === false) {
      return [];
    }
    var tlds = this._consumers[enc_tabTld];

    // TODO test multiple sites eg bugzilla + amo
    var tabUsers = [];
    for (var idx1 = tlds.length - 1; idx1 > -1; idx1--) {
      var loginTld = tlds[idx1];
      var users = this._providers[loginTld];
      for (var idx2 = users.length - 1; idx2 > -1; idx2--) {
        var myUser = users[idx2];
        if (myUser === TabLogin.NewAccount) {
          continue;
        }
        tabUsers.push({ username5: myUser,
                        usernamePlain: hexToString(myUser),
                        tld: loginTld
        });
      }
    }

    // alphabetical sort
    tabUsers.sort(function(userA, userB) {
      return userB.usernamePlain.localeCompare(userA.usernamePlain);
    });

    return tabUsers;
  },


  onCookieRejected: {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
    observe: function(subject, topic, data) {
      console.log("cookie-rejected:");
      console.log("cookie-rejected\n", subject, "\n", topic, "\n", data, "\n", subject.QueryInterface(Ci.nsIURI).spec);
    }
  },

  onCookieChanged: { // onCookieChangedInvalidateLoginData
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
    observe: function(subject, topic, data) {
      if (LoginData._consumers === null) {
        return;
      }
      switch (data) {
        case "changed":
          //var cookie = subject.QueryInterface(Ci.nsICookie2);
          break;
        case "added":
          var cookie = subject.QueryInterface(Ci.nsICookie2);
          //console.log("cookie ADD", cookie.host, cookie.path, cookie.name, cookie.value);
          LoginData.addCookie(cookie.host);
          break;
        case "deleted":
          var cookie = subject.QueryInterface(Ci.nsICookie2);
          //console.trace("deleted "+cookie.host + "///"+cookie.name);
          LoginData.deleteCookie(cookie.host);
          break;

        case "batch-deleted":
          console.trace("batch-deleted");
          var all = subject.QueryInterface(Ci.nsIArray).enumerate();
          console.log("cookie BATCH-DELETED! " + data + all);
          while (all.hasMoreElements()) {
            var cookie = all.getNext().QueryInterface(Ci.nsICookie2);
            if (LoginData.deleteCookie(cookie.host)) {
              break; // invalidated, it is not necessary yo continue
            }
          }
          break;
        case "cleared":
          LoginData._reset();
          break;
        case "reload":
          LoginData._invalidate();
          break;
        default:
          LoginData._invalidate(); // ???
          break;
      }
    }
  }
};


/*
function checkExpBug(cookie) {
  console.log("cookie", cookie.name, new Date().getTime(), cookie.expiry, cookie.expires, "\n",
               cookie.host, cookie.path, cookie.value, cookie.rawHost, "\n",
               cookie.isDomain, cookie.isHttpOnly, new Date(1000*cookie.expiry), new Date(1000*cookie.expires), '//', new Date(cookie.creationTime), new Date(cookie.lastAccessed/1000), cookie.isSession, cookie.isSecure, cookie.policy, cookie.status);

  switch (cookie.name) {
    case "auth_token"://twttr
    case "datr"://fb
    case "GAPS"://goog
    case "PREF"://goog
    case "put_1430"://statc
    case "au"://statc
    case "__qca"://statc
    case "is_unique":
    case "is_unique_1":
    //case "twll":
    //case "_twitter_sess":
    //case "secure_session":
      break;
    default:
      return;
  }

  var hostData5 = getLoginFromInternalHost(cookie.host);
  var login5 = splitUserNameAndTld(hostData5.fullLogin);


  var h = "${INTERNAL__DOMAIN__PREFIX}." + hostData5.fullLogin + ".${INTERNAL__DOMAIN__ORIGIN_LOGIN}.${INTERNAL__DOMAIN__SUFFIX}";
  var all = getAllCookiesFromHost(h);
  console.log("checkExpBug USER", hexToString(login5[0]), "remain:", all.length, h);
  if (all.length === 0) {
    //var browserWin = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator).getMostRecentWindow("navigator:browser");
    //browserWin.alert("ZERO "+cookie.host);
  }

  var browserWin = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator).getMostRecentWindow("navigator:browser");
  browserWin.alert(cookie.name+" "+cookie.host + " * " + hexToString(login5[0]));

}

function splitUserNameAndTld(usrTld) {
  var idx = usrTld.indexOf(".");
  return [usrTld.substr(0, idx), usrTld.substr(idx + 1)];
}
* 