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

"use strict";

Components.utils.import("resource://multifox-modules/new-window.js");
Cu.import("resource://multifox-modules/main.js");

// <vbox>  <== box
//   <hbox>  <== box2
//     <image/>
//     <vbox>  <== box3
//       <description/>
//       <hbox>  <== box4
//         <button/>

function appendErrorToPanel(box, panel, error) {
  var doc = box.ownerDocument;

  var box2 = box.appendChild(doc.createElement("hbox"));
  box2.setAttribute("align", "center");

  var img = box2.appendChild(doc.createElement("image"));
  img.setAttribute("src", "chrome://global/skin/icons/warning-large.png");
  img.setAttribute("width", "48");
  img.setAttribute("height", "48");
  img.style.marginRight = "8px";

  var box3 = box2.appendChild(doc.createElement("vbox"));
  box3.setAttribute("flex", "1");

  var txt = util.getText("icon.panel.unsupported-general.label", "Multifox (BETA)");
  box3.appendChild(doc.createElement("description"))
      .appendChild(doc.createTextNode(txt));

  switch (error) {
    case "localStorage":
      var info = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
      var msg = util.getText("icon.panel.unsupported-moz19.label", info.name, "4");
      box3.appendChild(doc.createElement("description"))
          .appendChild(doc.createTextNode(msg));
      break;
  }


  var but = box3.appendChild(doc.createElement("hbox")).appendChild(doc.createElement("button"));
  but.setAttribute("label", util.getText("icon.panel.make-tab-default.button.label", "Multifox (BETA)"));
  but.setAttribute("accesskey", util.getText("icon.panel.make-tab-default.button.accesskey"));
  but.addEventListener("command", function(evt) {
    panel.hidePopup();
    moveTabToDefault(but);
  }, false);

  return but;
}


function moveTabToDefault(button) {
  var win = button.ownerDocument.defaultView;
  var tab = win.getBrowser().selectedTab;
  var tabLogin = new TabInfo(tab);
  tabLogin.setTabAsAnon();
  moveData_toDefault(tabLogin.getTabTld(), tabLogin);
  tab.linkedBrowser.loadURIWithFlags(tab.linkedBrowser.contentDocument.documentURI, Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE);
}


function moveData_toDefault(tabTld, tabLogin) {
  //removeTldData_cookies(tabTld);

  var all = removeTldData_cookies(tabLogin.formatHost(tabTld));
  console.log('===>moveData_toDefault ', tabTld, tabLogin.toString(), "cookies:", all.length);
  var cookie;
  var hostData;
  for (var idx = all.length - 1; idx > -1; idx--) {
    cookie = all[idx];
    hostData = InternalHost.parseHost(cookie.host);
    if (hostData !== null) {
      copyCookieToNewHost(cookie, hostData.realHost);
    }
  }

  var all2 = removeTldData_LS(tabTld);
}
