/*
 *  This Source Code Form is subject to the terms of the Mozilla Public
 *  License, v. 2.0. If a copy of the MPL was not distributed with this
 *  file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 *  Contributor(s):
 *  - LouCypher (original code)
 */

Components.utils.import("resource://gre/modules/Services.jsm");

const { startup: startup, obs: obs, wm: wm, prompt: promptSvc, urlFormatter: format } = Services;

let _inputData = document.getElementById("data");
let _inputURL = document.getElementById("url");
let _button = document.getElementById("inspect-url");
let strings = document.getElementById("stringbundle");

function getString(aKey) {
  return strings.getString(aKey);
}

function alertBox(aText) {
  promptSvc.alert(null, document.title, aText);
}

function confirmBox(aText, aButton1, aButton2) {
  let buttonFlags = (promptSvc.BUTTON_POS_0 * promptSvc.BUTTON_TITLE_IS_STRING) +
                    (promptSvc.BUTTON_POS_1 * promptSvc.BUTTON_TITLE_IS_STRING) +
                    promptSvc.BUTTON_POS_0_DEFAULT;

  let rv = promptSvc.confirmEx(null, document.title, aText, buttonFlags,
                               aButton1, aButton2, null, null, {});
  if (rv == 0)
    return true;
  else
    return false;
}

function restartApp() {
  let cancelQuit = Components.classes["@mozilla.org/supports-PRBool;1"]
                             .createInstance(Components.interfaces.nsISupportsPRBool);

  obs.notifyObservers(cancelQuit, "quit-application-requested", null);
  if (cancelQuit.data) {
    return;
  }
  obs.notifyObservers(null, "quit-application-granted", null);

  let window = wm.getEnumerator(null);

  while (window.hasMoreElements()) {
    let win = window.getNext();
    if ("tryToClose" in win && !win.tryToClose()) return;
  }

  startup.quit(startup.eRestart | startup.eAttemptQuit);
}

function checkForDOMI() {
  Components.utils.import("resource://gre/modules/AddonManager.jsm");

  // Check if DOMI is available
  if (typeof inspectObject == "function")
    return;  // DOMI is installed and is enabled

  // DOMI is not installed or is disabled
  AddonManager.getAddonByID("inspector@mozilla.org", function(addon) {
    let msg = getString("require") + "\n";

    if (addon) { // If DOMI is installed
      addon.userDisabled = false; // enable it
      // Ask to restart
      let restart = confirmBox(msg + getString("enable"),
                               getString("restart"), getString("undo"));
      if (restart)      // If 'Yes'
        restartApp();   // restart application
        //alert("restart");

      else                          // If 'No'
        addon.userDisabled = true;  // disable DOMI
    }

    else {  // If DOMI is not installed
      // Ask to install
      let install = confirmBox(msg + getString("installdomi"),
                               getString("install"), getString("cancel"));
      if (install) { // install DOMI latest version from AMO
        let win = wm.getMostRecentWindow("navigator:browser") ||
                  wm.getMostRecentWindow("mail:3pane");
        win.focus();

        let xpi = "https://addons.mozilla.org/firefox/downloads/latest/6622/" +
                  "addon-6622-latest.xpi?src=external-JSON-Inspector";

        if (typeof win.openContentTab == "function")
          win.openContentTab(xpi);
        else
          win.loadURI(xpi);
      }
    }
    window.close();
  })
}

function clear(aInputNode) {
  aInputNode.value = "";
}

function isEmpty(aString) {
  if (aString == "") {
    alertBox(getString("isempty"));
    return true;
  }
  return false;
}

function inspectJSONObject(aStrJSON) {
  try {
    inspectObject(JSON.parse(aStrJSON));
    //close();
  } catch (ex) {
    alertBox(ex);
  }
}

function inspectData() {
  let data = _inputData.value;
  if (isEmpty(data))
    return;

  inspectJSONObject(data);
}

function inspectURL() {
  let url = _inputURL.value;
  if (isEmpty(url))
    return;

  let label = _button.label;
  _button.setAttribute("label", getString("wait"));
  _button.setAttribute("disabled", "true");
  _inputURL.setAttribute("disabled", "true");

  if (!/^((ht|f)tps?|chrome|resource|about|data|file):/.test(url))
    url = "http://" + url;

  let xhr = new XMLHttpRequest();
  xhr.onload = function() {
    _inputURL.removeAttribute("disabled");
    _button.removeAttribute("disabled");
    _button.setAttribute("label", label);
    if (xhr.status >= 400) {
      alertBox("Error " + xhr.status)
      return;
    }
    inspectJSONObject(xhr.responseText);
  }
  xhr.open("GET", url);
  xhr.send();
}
