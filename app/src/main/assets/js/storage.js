/* NoteForge - persistence layer: localStorage state + File System Access API */
(function (global) {
  "use strict";

  var LS_KEYS = {
    TABS: "noteforge.tabs.v1",
    SETTINGS: "noteforge.settings.v1",
    RECENT: "noteforge.recent.v1",
    LAYOUT: "noteforge.layout.v1"
  };

  var DEFAULT_SETTINGS = {
    theme: "dark",
    fontSize: 14,
    fontFamily: "'Cascadia Code','Consolas',monospace",
    tabSize: 4,
    indentType: "spaces",
    wordWrap: false,
    lineNumbers: true,
    brackets: true,
    autoSave: false,
    layout: "normal",
    previewAutoRefresh: true,
    minimap: false
  };

  function safeParse(str, fallback) {
    try {
      var v = JSON.parse(str);
      return v === null || v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function loadSettings() {
    var raw = localStorage.getItem(LS_KEYS.SETTINGS);
    var loaded = safeParse(raw, {});
    var merged = {};
    for (var k in DEFAULT_SETTINGS) merged[k] = (k in loaded) ? loaded[k] : DEFAULT_SETTINGS[k];
    return merged;
  }

  function saveSettings(settings) {
    localStorage.setItem(LS_KEYS.SETTINGS, JSON.stringify(settings));
  }

  function loadTabs() {
    return safeParse(localStorage.getItem(LS_KEYS.TABS), null);
  }

  function saveTabs(tabsState) {
    try {
      localStorage.setItem(LS_KEYS.TABS, JSON.stringify(tabsState));
    } catch (e) {
      console.warn("NoteForge: could not persist tabs (storage full?)", e);
    }
  }

  function loadRecent() {
    return safeParse(localStorage.getItem(LS_KEYS.RECENT), []);
  }

  function saveRecent(list) {
    localStorage.setItem(LS_KEYS.RECENT, JSON.stringify(list.slice(0, 20)));
  }

  function pushRecent(name) {
    var list = loadRecent().filter(function (n) { return n !== name; });
    list.unshift(name);
    saveRecent(list);
    return list;
  }

  function loadLayout() {
    return safeParse(localStorage.getItem(LS_KEYS.LAYOUT), { sidebarWidth: 250, bottomHeight: 190, previewWidth: 45 });
  }

  function saveLayout(layout) {
    localStorage.setItem(LS_KEYS.LAYOUT, JSON.stringify(layout));
  }

  var hasFSAccess = !!(global.showOpenFilePicker && global.showSaveFilePicker);

  async function pickAndOpenFiles() {
    if (!hasFSAccess) return null;
    var handles = await global.showOpenFilePicker({ multiple: true });
    var results = [];
    for (var i = 0; i < handles.length; i++) {
      var handle = handles[i];
      var file = await handle.getFile();
      var text = await file.text();
      results.push({ name: file.name, content: text, handle: handle });
    }
    return results;
  }

  async function pickFolder() {
    if (!global.showDirectoryPicker) return null;
    var dirHandle = await global.showDirectoryPicker();
    var entries = [];
    for await (var [name, handle] of dirHandle.entries()) {
      entries.push({ name: name, kind: handle.kind, handle: handle });
    }
    return { dirHandle: dirHandle, entries: entries };
  }

  async function saveWithPicker(suggestedName, content) {
    if (!global.showSaveFilePicker) return null;
    var handle = await global.showSaveFilePicker({ suggestedName: suggestedName || "untitled.txt" });
    var writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    return handle;
  }

  async function writeToHandle(handle, content) {
    var writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  function downloadAsFile(filename, content) {
    var blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename || "untitled.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  global.NFStorage = {
    hasFSAccess: hasFSAccess,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    defaultSettings: DEFAULT_SETTINGS,
    loadTabs: loadTabs,
    saveTabs: saveTabs,
    loadRecent: loadRecent,
    saveRecent: saveRecent,
    pushRecent: pushRecent,
    loadLayout: loadLayout,
    saveLayout: saveLayout,
    pickAndOpenFiles: pickAndOpenFiles,
    pickFolder: pickFolder,
    saveWithPicker: saveWithPicker,
    writeToHandle: writeToHandle,
    downloadAsFile: downloadAsFile
  };
})(window);
