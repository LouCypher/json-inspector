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
Cu.import("resource://gre/modules/FileUtils.jsm");

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

function resProtocolHandler(aResourceName, aURI) {
  Services.io.getProtocolHandler("resource")
             .QueryInterface(Ci.nsIResProtocolHandler)
             .setSubstitution(aResourceName, aURI, null)
}

let RESOURCE_NAME;

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

function initJSONI(aWindow) {
  const {document} = aWindow;

  function $(aId) document.getElementById(aId);

  function addCommand(aId, aLabel, aCallback) {
    let commandset = $("mainCommandSet") || // Firefox and SeaMonkey
                     $("mailCommands");     // Thunderbird

    let command = commandset.appendChild(document.createElement("command"));
    command.id = aId;
    command.className = "json-inspector";
    command.setAttribute("label", aLabel);
    command.addEventListener("command", aCallback);
  }

  function addMenuitem(aCommand) {
    let menuitem = document.createElement("menuitem");
    menuitem.setAttribute("command", aCommand);
    menuitem.setAttribute("image", "chrome://json-inspector/skin/json.png");
    menuitem.className = "json-inspector menuitem-iconic";
    return menuitem;
  }

  // Insert commands to main commandset
  addCommand("JSONInspector:open", "JSON Inspector", jsonInspector);
  addCommand("JSONInspector:option", "JSON Inspector Options", function() {
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
      dtSep.parentNode.insertBefore(addMenuitem("JSONInspector:open"), dtSep);
  };

  // SeaMonkey
  // Insert menuitem to Web Development menu
  let toolsPopup = $("toolsPopup");
  if (toolsPopup)
    toolsPopup.appendChild(addMenuitem("JSONInspector:open"));

  // Thunderbird
  // Insert menuitem to Tools menu
  let prefSep = document.querySelector("#taskPopup #prefSep");
  if (prefSep) {
    prefSep.parentNode.insertBefore(addMenuitem("JSONInspector:open"), prefSep);
  }

  // Sidebar
  // Add broadcaster
  let broadcasterset = $("mainBroadcasterSet");
  if (broadcasterset) {
    let broadcaster = broadcasterset.appendChild(document.createElement("broadcaster"));
    broadcaster.id = "json-inspector-sidebar";
    broadcaster.className = "json-inspector";
    broadcaster.setAttribute("label", "JSON Inspector");
    broadcaster.setAttribute("sidebartitle", "JSON Inspector");
    broadcaster.setAttribute("sidebarurl", "chrome://json-inspector/content/sidebar.xul");
    broadcaster.setAttribute("oncommand", "toggleSidebar('json-inspector-sidebar');");
    broadcaster.setAttribute("type", "checkbox");
    broadcaster.setAttribute("group", "sidebar");
    broadcaster.setAttribute("autoCheck", "false");
  }
  // Add menuitem
  let sidebarmenu = $("viewSidebarMenu");
  if (sidebarmenu) {
    let menuitem = sidebarmenu.appendChild(document.createElement("menuitem"));
    menuitem.setAttribute("observes", "json-inspector-sidebar");
  }

  // Add options menu
  let appPrefSep = document.querySelector("#appmenu_customizeMenu menuseparator:not([id]):not([class])");
  //log(appPrefSep);
  if (appPrefSep)
    appPrefSep.parentNode.insertBefore(addMenuitem("JSONInspector:option"), appPrefSep);

  let menupref = $("menu_preferences");
  if (menupref)
    menupref.parentNode.insertBefore(addMenuitem("JSONInspector:option"), menupref);

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

  RESOURCE_NAME = data.id.toLowerCase().match(/[^\@]+/).toString();
  //log(RESOURCE_NAME);

  // Add resource alias
  resProtocolHandler(RESOURCE_NAME, data.resourceURI);

  // Load module
  Cu.import("resource://" + RESOURCE_NAME + "/modules/watchwindows.jsm");

  addonId = data.id;

  watchWindows(initJSONI);
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
  Cu.unload("resource://" + RESOURCE_NAME + "/modules/watchwindows.jsm");
  
  // Remove resource
  resProtocolHandler(RESOURCE_NAME, null);
}

function getIconFileName() {
  let {OS} = Services.appinfo;
  if (!(OS == "WINNT" || OS == "Linux"))
    return null;

  let fileName = "json-inspector";
  if (OS == "WINNT")
    fileName += ".ico";
  else
    fileName += ".png";

  return fileName;
}

/**
 * Handle the add-on being installed
 */
function install(data, reason) {
  // Close existing JSON Inspector window
  closeJSIwindow();

  let fileName = getIconFileName();
  if (!fileName)
    return;

  let targetFile = FileUtils.getFile("AChrom", ["icons", "default", fileName], false);
  let {installPath} = data;
  //log(installPath.path);

  if (/.xpi$/.test(installPath.path)) { // If unpack
    // Extract icon from installPath
    const ZipReader = Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(Ci.nsIZipReader);
    ZipReader.open(installPath);
    let entry;
    let entries = ZipReader.findEntries("chrome/skin/classic/" + fileName);
    while (entries.hasMore())
      entry = entries.getNext();

    if (!targetFile.exists())
      ZipReader.extract(entry, targetFile);

    ZipReader.close();
  }

  else {
    // Copy icon from installPath
    let iconPath = installPath.path + "\\chrome\\skin\\classic\\" + fileName;
    let iconFile = new FileUtils.File(iconPath);
    let targetDir = FileUtils.getFile("AChrom", ["icons", "default"], true);
    if (!targetFile.exists())
      iconFile.copyTo(targetDir, "");
  }
}

/**
 * Handle the add-on being uninstalled
 */
function uninstall(data, reason) {
  // Close existing JSON Inspector window
  closeJSIwindow();

  // Remove icon
  let fileName = getIconFileName();
  if (!fileName)
    return;

  let iconFile = FileUtils.getFile("AChrom", ["icons", "default", fileName], false);
  if (iconFile.exists()) {
    iconFile.permissions = 0777; // On Firefox 19+, the exctracted file's attribute
                                 // is read-only so we change it before removing the file
    iconFile.remove(false);
  }
}
