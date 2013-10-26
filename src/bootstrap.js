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

function log(aString) {
  Services.console.logStringMessage("Bootstrap:\n" + aString);
}

function resProtocolHandler(aResourceName, aURI) {
  Services.io.getProtocolHandler("resource")
             .QueryInterface(Ci.nsIResProtocolHandler)
             .setSubstitution(aResourceName, aURI, null)
}

function addMenuItem(aDocument) {
  let menuitem = aDocument.createElement("menuitem");
  menuitem.setAttribute("label", "JSON Inspector");
  menuitem.setAttribute("command", "Tools:JSONInspector");
  menuitem.setAttribute("image", "chrome://json-inspector/skin/json.png");
  menuitem.className = "json-inspector menuitem-iconic";
  return menuitem;
}

function init(aWindow) {
  let document = aWindow.document;

  let commandset = document.getElementById("mainCommandSet") || // Firefox and SeaMonkey
                   document.getElementById("mailCommands");     // Thunderbird

  // Insert command to main commandset
  let command = commandset.appendChild(document.createElement("command"));
  command.id = "Tools:JSONInspector";
  command.className = "json-inspector";
  command.addEventListener("command", function() {
    let win = Services.wm.getMostRecentWindow("devtools:jsonInspector");
    if (win)
      win.focus();
    
    else
      aWindow.openDialog("chrome://json-inspector/content/", "json-inspector",
                         "chrome, dialog=no, centerscreen, minimizable, resizable");
  });

  // Firefox
  // Insert menuitem to Web Developer menu
  let devToolsSeparators = document.querySelectorAll("menuseparator[id$='devToolsEndSeparator']");
  for (let i = 0; i < devToolsSeparators.length; i++) {
    let separator = devToolsSeparators[i];
    if (separator)
      separator.parentNode.insertBefore(addMenuItem(document), separator);
  };

  // SeaMonkey
  // Insert menuitem to Web Development menu
  let toolsPopup = document.getElementById("toolsPopup");
  if (toolsPopup)
    toolsPopup.appendChild(addMenuItem(document));

  // Thunderbird
  // Insert menuitem to Tools menu
  let prefSep = document.getElementById("prefSep");
  if (prefSep)
    prefSep.parentNode.insertBefore(addMenuItem(document), prefSep);

  unload(function() {
    let items = document.querySelectorAll(".json-inspector");
    for (let i = 0; i < items.length; i++) {
      items[i].parentNode.removeChild(items[i]);
    }
  }, aWindow)
}

/**
 * Handle the add-on being activated on install/enable
 */
function startup(data, reason) {
  resourceName = data.id.toLowerCase().match(/[^\@]+/).toString();
  //log(resourceName);

  // Add `resource:` alias
  resProtocolHandler(resourceName, data.resourceURI);

  Cu.import("resource://" + resourceName + "/modules/watchwindows.jsm");
  watchWindows(init);
}

/**
 * Handle the add-on being deactivated on uninstall/disable
 */
function shutdown(data, reason) {
  // Clean up with unloaders when we're deactivating
  if (reason == APP_SHUTDOWN)
    return;

  unload();
  Cu.unload("resource://" + resourceName + "/modules/watchwindows.jsm");
  resProtocolHandler(resourceName, null); // Remove `resource:` alias
}

/**
 * Handle the add-on being installed
 */
function install(data, reason) {}

/**
 * Handle the add-on being uninstalled
 */
function uninstall(data, reason) {}
