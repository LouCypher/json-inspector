/*
 *  This Source Code Form is subject to the terms of the Mozilla Public
 *  License, v. 2.0. If a copy of the MPL was not distributed with this
 *  file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 *  Contributor(s):
 *  - LouCypher (original code)
 */

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
Cu.import("resource://gre/modules/Services.jsm");

/**
 * Start setting default preferences 
 * http://starkravingfinkle.org/blog/2011/01/restartless-add-ons-%e2%80%93-default-preferences/
 */
const PREF_BRANCH = "extensions.json-inspector@loucypher.";
const PREFS = {
  description: "chrome://json-inspector/locale/json-inspector.properties",
  //firstRun: true,
  copyResponse: 0
};

let addonId;

function setDefaultPrefs() {
  try {
    // Check for old pref from v1.0
    let prefs = Services.prefs.getBranch(PREF_BRANCH);
    if (prefs.getPrefType("copyResponse") == prefs.PREF_BOOL) {
      prefs.clearUserPref("copyResponse");  // Clear/remove old pref
      prefs.setIntPref("copyResponse", 2);  // Convert to new pref
    }
  } catch(ex) {
  }

  let branch = Services.prefs.getDefaultBranch(PREF_BRANCH);
  for (let [key, val] in Iterator(PREFS)) {
    switch (typeof val) {
      case "boolean":
        branch.setBoolPref(key, val);
        break;
      case "number":
        branch.setIntPref(key, val);
        break;
      case "string":
        branch.setCharPref(key, val);
        break;
    }
  }
}
/*
 * End setting default preferences 
 **/

function log(aString) {
  Services.console.logStringMessage("JSON Inspector:\n" + aString);
}

function setResourceName(aData) aData.id.toLowerCase().match(/[^\@]+/).toString()
                                                      .replace(/[^\w]/g, "");

function resProtocolHandler(aResourceName, aURI) {
  Services.io.getProtocolHandler("resource")
             .QueryInterface(Ci.nsIResProtocolHandler)
             .setSubstitution(aResourceName, aURI, null)
}

function getJSIwindow() Services.wm.getMostRecentWindow("devtools:jsonInspector");

function closeJSIwindow() {
  let win = getJSIwindow();
  if (win)
    win.close();
}

function jsonInspector(aEvent) {
  let win = getJSIwindow();
  if (win)
    win.focus();
  
  else {
    let node = aEvent.target;
    let globalWin = node.ownerGlobal ? node.ownerGlobal : node.ownerDocument.defaultView;
    globalWin.openDialog("chrome://json-inspector/content/", "json-inspector",
                         "chrome, dialog=no, centerscreen, minimizable, resizable");
  }
}

function addCommand(aDocument, aId, aLabel, aCallback) {
  let commandset = aDocument.getElementById("mainCommandSet") || // Firefox and SeaMonkey
                   aDocument.getElementById("mailCommands");     // Thunderbird

  let command = commandset.appendChild(aDocument.createElement("command"));
  command.id = aId;
  command.className = "json-inspector";
  command.setAttribute("label", aLabel);
  command.addEventListener("command", aCallback);
}

function addMenuitem(aDocument, aCommand) {
  let menuitem = aDocument.createElement("menuitem");
  menuitem.setAttribute("command", aCommand);
  menuitem.setAttribute("image", "chrome://json-inspector/skin/json.png");
  menuitem.className = "json-inspector menuitem-iconic";
  return menuitem;
}

function init(aWindow) {
  let document = aWindow.document;

  // Insert commands to main commandset
  addCommand(document, "Tools:JSONInspector", "JSON Inspector", jsonInspector);
  addCommand(document, "Tools:JSONInspectorPrefs", "JSON Inspector Options", function() {
    let view = "addons://detail/" + encodeURIComponent(addonId) + "/preferences";
    "toEM" in aWindow ? aWindow.toEM(view)
                      : "openAddonsMgr" in aWindow ? aWindow.openAddonsMgr(view)
                                                   : aWindow.BrowserOpenAddonsMgr(view);
  });

  // Firefox
  // Insert menuitem to Web Developer menu
  let devToolsSeparators = document.querySelectorAll("menuseparator[id$='devToolsEndSeparator']");
  for (let i = 0; i < devToolsSeparators.length; i++) {
    let dtSep = devToolsSeparators[i];
    if (dtSep)
      dtSep.parentNode.insertBefore(addMenuitem(document, "Tools:JSONInspector"), dtSep);
  };

  // SeaMonkey
  // Insert menuitem to Web Development menu
  let toolsPopup = document.getElementById("toolsPopup");
  if (toolsPopup)
    toolsPopup.appendChild(addMenuitem(document, "Tools:JSONInspector"));

  // Thunderbird
  // Insert menuitem to Tools menu
  let prefSep = document.querySelector("#taskPopup #prefSep");
  if (prefSep) {
    prefSep.parentNode.insertBefore(addMenuitem(document, "Tools:JSONInspector"), prefSep);
  }

  // Add options menu
  let appPrefSep = document.querySelector("#appmenu_customizeMenu menuseparator:not([id]):not([class])");
  //log(appPrefSep);
  if (appPrefSep)
    appPrefSep.parentNode.insertBefore(addMenuitem(document, "Tools:JSONInspectorPrefs"), appPrefSep);

  let menupref = document.getElementById("menu_preferences");
  if (menupref)
    menupref.parentNode.insertBefore(addMenuitem(document, "Tools:JSONInspectorPrefs"), menupref);

  let button = document.querySelector("#navigator-toolbox toolbarbutton.json-inspector");
  if (button && button.disabled)
    button.removeAttribute("disabled");

  unload(function() {
    let items = document.querySelectorAll(".json-inspector");
    for (let i = 0; i < items.length; i++) {
      if (items[i].localName != "toolbarbutton")
        items[i].parentNode.removeChild(items[i]);
      else
        items[i].setAttribute("disabled", "true");
    }
  }, aWindow)
}

/**
 * Handle the add-on being activated on install/enable
 */
function startup(data, reason) {
  setDefaultPrefs();

  // Add resource alias
  let resourceName = setResourceName(data);
  //log(resourceName);
  resProtocolHandler(resourceName, data.resourceURI);

  // Load module
  Cu.import("resource://" + resourceName + "/modules/watchwindows.jsm");

  addonId = data.id;

  watchWindows(init);
}

/**
 * Handle the add-on being deactivated on uninstall/disable
 */
function shutdown(data, reason) {
  // Clean up with unloaders when we're deactivating
  if (reason == APP_SHUTDOWN)
    return;

  // Close existing JSON Inspector window
  closeJSIwindow();

  unload();

  // Unload module
  Cu.unload("resource://" + resourceName + "/modules/watchwindows.jsm");
  
  // Remove resource
  resProtocolHandler(setResourceName(data), null);
}

/**
 * Handle the add-on being installed
 */
function install(data, reason) {
  // Close existing JSON Inspector window
  closeJSIwindow();

/*// Do something on first install only
  let prefs = Services.prefs.getBranch(PREF_BRANCH);
  if (prefs.getBoolPref("firstRun")) {
    // doSomething();
    prefs.setBoolPref("firstRun", false);
  }
*/
}

/**
 * Handle the add-on being uninstalled
 */
function uninstall(data, reason) {
  // Close existing JSON Inspector window
  closeJSIwindow();
}
