/*
 *  This Source Code Form is subject to the terms of the Mozilla Public
 *  License, v. 2.0. If a copy of the MPL was not distributed with this
 *  file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 *  Contributor(s):
 *  - LouCypher (original code)
 */

Components.utils.import("resource://gre/modules/Services.jsm");

const {
  startup: startup, obs: obs, wm: wm, prefs: prefs,
  prompt: promptSvc, urlFormatter: format
} = Services;

let _inputData = document.getElementById("data");
let _inputURL = document.getElementById("url");
let _button = document.getElementById("inspect-url");

function getString(aKey) document.getElementById("stringbundle").getString(aKey);

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
  if (cancelQuit.data)
    return;

  obs.notifyObservers(null, "quit-application-granted", null);

  let window = wm.getEnumerator(null);

  while (window.hasMoreElements()) {
    let win = window.getNext();
    if ("tryToClose" in win && !win.tryToClose())
      return;
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
        win.content.location.assign("https://addons.mozilla.org/firefox/downloads/latest/6622/" +
                                    "?src=external-JSON-Inspector");
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

function copyData(aData) {
  let isJSON = true;
  try {
    let obj = JSON.parse(aData);
  } catch(ex) {
    isJSON = false;
  }
  switch (prefs.getIntPref("extensions.json-inspector@loucypher.copyResponse")) {
    case 2:
      _inputData.value = aData;
      break;
    case 1:
      if (isJSON) _inputData.value = aData;
    default:
  }
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

function updateAttributes(aRestore, aURL) {
  if (aRestore) {
    _inputURL.value = aURL;
    _inputURL.removeAttribute("disabled");
    _button.removeAttribute("disabled");
    _button.setAttribute("label", getString("inspect"));
  }

  else {
    _button.setAttribute("label", getString("wait"));
    _button.setAttribute("disabled", "true");
    _inputURL.setAttribute("disabled", "true");
    _inputURL.value = getString("processing");
  }
}

function inspectURL() {
  let url = _inputURL.value;
  if (isEmpty(url))
    return;

  if (!/^((htt|f)tps?|chrome|resource|about|data|file):/.test(url))
    url = "http://" + url;

  updateAttributes();
  let xhr = new XMLHttpRequest();
  xhr.onload = function() {
    updateAttributes(true, url);
    if (xhr.status >= 400) {
      alertBox(xhr.statusText)
      return;
    }
    inspectJSONObject(xhr.responseText);
    copyData(xhr.responseText);
  }
  xhr.onerror = function() {
    updateAttributes(true, url);
    alertBox("Error " + xhr.status);
    return;
  }
  xhr.open("GET", url);
  xhr.send();
}

function keyboardAction() {
  let { focusedElement } = document.commandDispatcher;
  if (focusedElement instanceof HTMLInputElement)
    inspectURL();
  if (focusedElement instanceof HTMLTextAreaElement)
    inspectData();
}
