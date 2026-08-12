/* NoteForge - main application logic */
(function () {
  "use strict";

  var settings = NFStorage.loadSettings();
  var layout = NFStorage.loadLayout();

  var tabs = [];          // { id, name, content, mode, dirty, handle, cursor, scrollTop }
  var activeTabId = null;
  var nextTabId = 1;
  var isAndroid = /wv|Android/i.test(navigator.userAgent) && !!window.NoteForgeNative;

  var themeMap = { dark: "dracula", darkblue: "material-darker", midnight: "midnight", light: "eclipse" };

  // ---------------------------------------------------------------
  // CodeMirror instance (single editor, content swapped per tab)
  // ---------------------------------------------------------------
  var cm = CodeMirror(document.getElementById("cm-container"), {
    value: "",
    lineNumbers: settings.lineNumbers,
    theme: themeMap[settings.theme] || "dracula",
    mode: "text/plain",
    indentUnit: settings.tabSize,
    tabSize: settings.tabSize,
    indentWithTabs: settings.indentType === "tabs",
    lineWrapping: settings.wordWrap,
    matchBrackets: settings.brackets,
    autoCloseBrackets: true,
    autoCloseTags: true,
    styleActiveLine: true,
    foldGutter: true,
    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
    highlightSelectionMatches: { showToken: /\w/, annotateScrollbar: false },
    extraKeys: {
      "Ctrl-Space": "autocomplete",
      "Ctrl-/": "toggleComment",
      "Cmd-/": "toggleComment"
    }
  });
  cm.getWrapperElement().style.fontSize = settings.fontSize + "px";
  cm.getWrapperElement().style.fontFamily = settings.fontFamily;

  // ---------------------------------------------------------------
  // Language menu (built from NFLanguages)
  // ---------------------------------------------------------------
  var langMenuEl = document.getElementById("language-menu");
  NFLanguages.all.forEach(function (lang) {
    var btn = document.createElement("button");
    btn.textContent = lang.label;
    btn.dataset.langId = lang.id;
    btn.dataset.langMime = lang.mime || lang.id;
    btn.addEventListener("click", function () {
      setModeForActiveTab(lang.mime || lang.id, lang.label);
      closeAllMenus();
    });
    langMenuEl.appendChild(btn);
  });

  function setModeForActiveTab(mime, label) {
    var tab = getActiveTab();
    if (!tab) return;
    tab.mode = mime;
    tab.langLabel = label;
    cm.setOption("mode", mime);
    document.getElementById("status-filetype").textContent = label;
  }

  // ---------------------------------------------------------------
  // Tab management
  // ---------------------------------------------------------------
  function newTab(opts) {
    opts = opts || {};
    var name = opts.name || "untitled-" + nextTabId + ".txt";
    var lang = NFLanguages.detect(name);
    var tab = {
      id: "t" + (nextTabId++),
      name: name,
      content: opts.content || "",
      mode: lang.mime || lang.id,
      langLabel: lang.label,
      dirty: !!opts.dirty,
      handle: opts.handle || null,
      cursor: { line: 0, ch: 0 },
      scrollTop: 0
    };
    tabs.push(tab);
    activateTab(tab.id);
    renderTabs();
    renderOpenFilesList();
    persistTabs();
    return tab;
  }

  function getActiveTab() {
    return tabs.find(function (t) { return t.id === activeTabId; });
  }

  function activateTab(id) {
    var prev = getActiveTab();
    if (prev) {
      prev.content = cm.getValue();
      prev.cursor = cm.getCursor();
      prev.scrollTop = cm.getScrollInfo().top;
    }
    activeTabId = id;
    var tab = getActiveTab();
    if (!tab) return;
    cm.setValue(tab.content);
    cm.setOption("mode", tab.mode);
    setTimeout(function () {
      cm.setCursor(tab.cursor || { line: 0, ch: 0 });
      cm.scrollTo(null, tab.scrollTop || 0);
      cm.focus();
    }, 0);
    document.getElementById("status-filetype").textContent = tab.langLabel || "Plain Text";
    renderTabs();
    renderOpenFilesList();
    updateStatusBar();
  }

  function closeTab(id, force) {
    var idx = tabs.findIndex(function (t) { return t.id === id; });
    if (idx === -1) return;
    var tab = tabs[idx];
    if (tab.dirty && !force) {
      var ok = confirm('"' + tab.name + '" has unsaved changes. Close anyway?');
      if (!ok) return;
    }
    tabs.splice(idx, 1);
    if (activeTabId === id) {
      var next = tabs[idx] || tabs[idx - 1];
      if (next) activateTab(next.id);
      else { activeTabId = null; cm.setValue(""); }
    }
    if (tabs.length === 0) newTab({ name: "untitled-" + (nextTabId) + ".txt" });
    renderTabs();
    renderOpenFilesList();
    persistTabs();
  }

  function renameTab(id, newName) {
    var tab = tabs.find(function (t) { return t.id === id; });
    if (!tab || !newName) return;
    tab.name = newName;
    var lang = NFLanguages.detect(newName);
    tab.mode = lang.mime || lang.id;
    tab.langLabel = lang.label;
    if (activeTabId === id) {
      cm.setOption("mode", tab.mode);
      document.getElementById("status-filetype").textContent = tab.langLabel;
    }
    renderTabs();
    renderOpenFilesList();
    persistTabs();
  }

  function markDirty(id, dirty) {
    var tab = tabs.find(function (t) { return t.id === id; });
    if (!tab) return;
    tab.dirty = dirty;
    renderTabs();
    renderOpenFilesList();
  }

  function renderTabs() {
    var bar = document.getElementById("tabbar");
    bar.innerHTML = "";
    tabs.forEach(function (tab) {
      var el = document.createElement("div");
      el.className = "tab" + (tab.id === activeTabId ? " active" : "");
      el.dataset.tabId = tab.id;

      var icon = document.createElement("span");
      icon.textContent = NFLanguages.iconFor(tab.name);
      el.appendChild(icon);

      var nameSpan = document.createElement("span");
      nameSpan.className = "tname";
      nameSpan.textContent = tab.name;
      el.appendChild(nameSpan);

      if (tab.dirty) {
        var dot = document.createElement("span");
        dot.className = "tdirty";
        el.appendChild(dot);
      }

      var closeBtn = document.createElement("button");
      closeBtn.className = "tclose";
      closeBtn.textContent = "✕";
      closeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        closeTab(tab.id);
      });
      el.appendChild(closeBtn);

      el.addEventListener("click", function () { activateTab(tab.id); });
      el.addEventListener("dblclick", function (e) {
        if (e.target === closeBtn) return;
        startRenameTab(tab.id, el, nameSpan);
      });

      bar.appendChild(el);
    });

    var newBtn = document.createElement("button");
    newBtn.className = "tab-new";
    newBtn.textContent = "＋";
    newBtn.title = "New Tab";
    newBtn.addEventListener("click", function () { newTab({}); });
    bar.appendChild(newBtn);
  }

  function startRenameTab(id, tabEl, nameSpan) {
    var tab = tabs.find(function (t) { return t.id === id; });
    if (!tab) return;
    var input = document.createElement("input");
    input.className = "rename-input";
    input.value = tab.name;
    nameSpan.replaceWith(input);
    input.focus();
    input.select();
    function commit() {
      renameTab(id, input.value.trim() || tab.name);
    }
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") input.blur();
      if (e.key === "Escape") { input.value = tab.name; input.blur(); }
    });
  }

  function renderOpenFilesList() {
    var ul = document.getElementById("open-files-list");
    ul.innerHTML = "";
    if (tabs.length === 0) {
      var li = document.createElement("li");
      li.className = "file-empty";
      li.textContent = "No open files";
      ul.appendChild(li);
      return;
    }
    tabs.forEach(function (tab) {
      var li = document.createElement("li");
      li.className = tab.id === activeTabId ? "active" : "";
      li.innerHTML = '<span class="ficon">' + NFLanguages.iconFor(tab.name) + '</span><span class="fname"></span>';
      li.querySelector(".fname").textContent = tab.name;
      if (tab.dirty) {
        var dirty = document.createElement("span");
        dirty.className = "fdirty";
        dirty.textContent = "●";
        li.appendChild(dirty);
      }
      li.addEventListener("click", function () { activateTab(tab.id); });
      ul.appendChild(li);
    });
  }

  function renderRecentList() {
    var ul = document.getElementById("recent-files-list");
    ul.innerHTML = "";
    var recent = NFStorage.loadRecent();
    if (recent.length === 0) {
      var li = document.createElement("li");
      li.className = "file-empty";
      li.textContent = "No recent files";
      ul.appendChild(li);
      return;
    }
    recent.forEach(function (name) {
      var li = document.createElement("li");
      li.innerHTML = '<span class="ficon">' + NFLanguages.iconFor(name) + '</span><span class="fname"></span>';
      li.querySelector(".fname").textContent = name;
      li.title = "Open a fresh tab named " + name;
      li.addEventListener("click", function () {
        var existing = tabs.find(function (t) { return t.name === name; });
        if (existing) return activateTab(existing.id);
        newTab({ name: name, content: "" });
      });
      ul.appendChild(li);
    });
  }

  function persistTabs() {
    var active = getActiveTab();
    if (active) { active.content = cm.getValue(); }
    var state = {
      activeTabId: activeTabId,
      nextTabId: nextTabId,
      tabs: tabs.map(function (t) {
        return { id: t.id, name: t.name, content: t.content, mode: t.mode, langLabel: t.langLabel, dirty: t.dirty };
      })
    };
    NFStorage.saveTabs(state);
  }

  function restoreTabs() {
    var state = NFStorage.loadTabs();
    if (state && state.tabs && state.tabs.length) {
      tabs = state.tabs.map(function (t) {
        return { id: t.id, name: t.name, content: t.content, mode: t.mode, langLabel: t.langLabel, dirty: t.dirty, handle: null, cursor: { line: 0, ch: 0 }, scrollTop: 0 };
      });
      nextTabId = state.nextTabId || (tabs.length + 1);
      renderTabs();
      renderOpenFilesList();
      activateTab(state.activeTabId && tabs.some(function (t) { return t.id === state.activeTabId; }) ? state.activeTabId : tabs[0].id);
    } else {
      newTab({
        name: "welcome.md",
        content: "# Welcome to NoteForge\n\nA fast, offline-first code editor.\n\n- Ctrl+N — New file\n- Ctrl+O — Open file\n- Ctrl+S — Save\n- Ctrl+P — Live Preview\n- Ctrl+F / Ctrl+H — Find / Replace\n\nStart typing, or open a file from the toolbar.\n"
      });
    }
  }

  // ---------------------------------------------------------------
  // Status bar
  // ---------------------------------------------------------------
  function updateStatusBar() {
    var cursor = cm.getCursor();
    var doc = cm.getDoc();
    var sel = doc.getSelection();
    document.getElementById("status-line").textContent = "Ln " + (cursor.line + 1);
    document.getElementById("status-col").textContent = "Col " + (cursor.ch + 1);
    document.getElementById("status-chars").textContent = cm.getValue().length + " chars";
    document.getElementById("status-selection").textContent = sel.length + " selected";
    document.getElementById("status-indent").textContent =
      (settings.indentType === "tabs" ? "Tabs: " : "Spaces: ") + settings.tabSize;
  }
  cm.on("cursorActivity", updateStatusBar);
  cm.on("change", function () {
    var tab = getActiveTab();
    if (tab) {
      var newContent = cm.getValue();
      if (newContent !== tab.content) {
        tab.content = newContent;
        markDirty(tab.id, true);
      }
    }
    if (settings.autoSave) debouncedAutoSave();
    updateStatusBar();
  });

  var autoSaveTimer = null;
  function debouncedAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(function () { saveFile(false); }, 900);
  }

  // ---------------------------------------------------------------
  // File operations
  // ---------------------------------------------------------------
  async function openFile() {
    if (NFStorage.hasFSAccess) {
      try {
        var files = await NFStorage.pickAndOpenFiles();
        if (!files) return;
        files.forEach(function (f) {
          var t = newTab({ name: f.name, content: f.content, handle: f.handle, dirty: false });
          NFStorage.pushRecent(f.name);
        });
        renderRecentList();
      } catch (e) { /* user cancelled */ }
    } else {
      document.getElementById("hidden-file-input").click();
    }
  }

  document.getElementById("hidden-file-input").addEventListener("change", function (e) {
    var files = Array.from(e.target.files || []);
    var remaining = files.length;
    if (!remaining) return;
    files.forEach(function (file) {
      var reader = new FileReader();
      reader.onload = function () {
        newTab({ name: file.name, content: reader.result, dirty: false });
        NFStorage.pushRecent(file.name);
        renderRecentList();
      };
      reader.readAsText(file);
    });
    e.target.value = "";
  });

  async function saveFile(showFeedback) {
    var tab = getActiveTab();
    if (!tab) return;
    tab.content = cm.getValue();
    if (tab.handle) {
      try {
        await NFStorage.writeToHandle(tab.handle, tab.content);
        markDirty(tab.id, false);
        persistTabs();
        if (showFeedback !== false) toast("Saved " + tab.name);
        return;
      } catch (e) { /* fall through to save-as behavior */ }
    }
    return saveAsFile();
  }

  async function saveAsFile() {
    var tab = getActiveTab();
    if (!tab) return;
    tab.content = cm.getValue();
    if (NFStorage.hasFSAccess) {
      try {
        var handle = await NFStorage.saveWithPicker(tab.name, tab.content);
        if (!handle) return;
        tab.handle = handle;
        tab.name = handle.name || tab.name;
        renameTab(tab.id, tab.name);
        markDirty(tab.id, false);
        persistTabs();
        NFStorage.pushRecent(tab.name);
        renderRecentList();
        toast("Saved " + tab.name);
        return;
      } catch (e) { return; /* user cancelled */ }
    }
    // Fallback: prompt for filename then trigger a download
    promptModal("Save As", tab.name, function (name) {
      if (!name) return;
      tab.name = name;
      renameTab(tab.id, name);
      NFStorage.downloadAsFile(name, tab.content);
      markDirty(tab.id, false);
      persistTabs();
      NFStorage.pushRecent(name);
      renderRecentList();
      toast("Downloaded " + name);
    });
  }

  function exportFile() {
    var tab = getActiveTab();
    if (!tab) return;
    NFStorage.downloadAsFile(tab.name, cm.getValue());
    toast("Exported " + tab.name);
  }

  async function openFolder() {
    if (!NFStorage.hasFSAccess) {
      toast("Folder access isn't supported in this browser. Use Open File instead.");
      return;
    }
    try {
      var result = await NFStorage.pickFolder();
      if (!result) return;
      var ul = document.getElementById("project-files-list");
      ul.innerHTML = "";
      var files = result.entries.filter(function (e) { return e.kind === "file"; });
      if (!files.length) {
        var li = document.createElement("li");
        li.className = "file-empty";
        li.textContent = "Folder is empty";
        ul.appendChild(li);
        return;
      }
      files.forEach(function (entry) {
        var li = document.createElement("li");
        li.innerHTML = '<span class="ficon">' + NFLanguages.iconFor(entry.name) + '</span><span class="fname"></span>';
        li.querySelector(".fname").textContent = entry.name;
        li.addEventListener("click", async function () {
          var file = await entry.handle.getFile();
          var text = await file.text();
          newTab({ name: file.name, content: text, handle: entry.handle, dirty: false });
        });
        ul.appendChild(li);
      });
    } catch (e) { /* user cancelled */ }
  }

  // ---------------------------------------------------------------
  // Edit actions
  // ---------------------------------------------------------------
  function doCut() {
    var sel = cm.getSelection();
    if (!sel) return;
    copyToClipboard(sel);
    cm.replaceSelection("");
  }
  function doCopy() {
    var sel = cm.getSelection();
    if (sel) copyToClipboard(sel);
  }
  async function doPaste() {
    try {
      var text = await navigator.clipboard.readText();
      cm.replaceSelection(text);
    } catch (e) {
      toast("Clipboard access blocked — use your device's paste gesture.");
    }
  }
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
    }
  }

  // ---------------------------------------------------------------
  // Search / Replace / Goto Line (CodeMirror search addon)
  // ---------------------------------------------------------------
  function doFind() { cm.execCommand("find"); }
  function doReplace() { cm.execCommand("replace"); }
  function doReplaceAll() { cm.execCommand("replaceAll"); }
  function doGotoLine() { cm.execCommand("jumpToLine"); }

  // ---------------------------------------------------------------
  // Live preview
  // ---------------------------------------------------------------
  function buildPreviewDoc() {
    var tab = getActiveTab();
    if (!tab) return "";
    var content = cm.getValue();
    var mode = tab.mode;
    if (mode === "htmlmixed" || /html/i.test(tab.langLabel || "")) {
      return content;
    }
    if (mode === "css") {
      return "<!doctype html><html><head><style>" + content + "</style></head><body><p>CSS preview — showing default markup styled with your CSS.</p><div class='box'>Box</div></body></html>";
    }
    if (mode === "javascript" || mode === "text/javascript") {
      return "<!doctype html><html><body><pre id='nf-console' style='font-family:monospace;white-space:pre-wrap;'></pre><script>\n" +
        "var out=document.getElementById('nf-console');\n" +
        "var _log=console.log;console.log=function(){out.textContent+=Array.prototype.slice.call(arguments).join(' ')+'\\n';_log.apply(console,arguments);};\n" +
        "try{\n" + content + "\n}catch(e){out.textContent+='Error: '+e.message;}\n<\/script></body></html>";
    }
    if (mode === "markdown") {
      return "<!doctype html><html><body><pre style='font-family:monospace;white-space:pre-wrap;padding:16px;'>" +
        content.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</pre></body></html>";
    }
    return "<!doctype html><html><body><pre style='font-family:monospace;white-space:pre-wrap;padding:16px;'>Preview is only available for HTML, CSS, JavaScript, and Markdown files.</pre></body></html>";
  }

  function showPreview() {
    document.getElementById("preview-pane").classList.remove("hidden");
    document.getElementById("preview-resizer").classList.remove("hidden");
    refreshPreview();
  }
  function hidePreview() {
    document.getElementById("preview-pane").classList.add("hidden");
    document.getElementById("preview-resizer").classList.add("hidden");
  }
  function togglePreview() {
    var pane = document.getElementById("preview-pane");
    if (pane.classList.contains("hidden")) showPreview(); else hidePreview();
  }
  function refreshPreview() {
    var frame = document.getElementById("preview-frame");
    frame.srcdoc = buildPreviewDoc();
  }
  function previewInNewTab() {
    var w = window.open("", "_blank");
    if (!w) { toast("Popup blocked — allow popups to preview in a new tab."); return; }
    w.document.open();
    w.document.write(buildPreviewDoc());
    w.document.close();
  }

  // ---------------------------------------------------------------
  // Terminal / Output / Problems panel
  // ---------------------------------------------------------------
  function termWrite(text, cls) {
    var out = document.getElementById("terminal-output");
    var line = document.createElement("div");
    if (cls) line.className = cls;
    line.textContent = text;
    out.appendChild(line);
    out.scrollTop = out.scrollHeight;
  }
  termWrite("NoteForge terminal (simulated — browser sandboxing prevents real shell access).");
  termWrite('Type "help" for available commands.');

  function runTerminalCommand(raw) {
    var cmdline = raw.trim();
    if (!cmdline) return;
    termWrite("noteforge> " + cmdline, "tl-cmd");
    var parts = cmdline.split(/\s+/);
    var cmd = parts[0].toLowerCase();
    var rest = cmdline.slice(cmd.length).trim();
    switch (cmd) {
      case "help":
        termWrite("Available: help, clear, echo <text>, date, whoami, files, run, version");
        break;
      case "clear":
        document.getElementById("terminal-output").innerHTML = "";
        break;
      case "echo":
        termWrite(rest);
        break;
      case "date":
        termWrite(new Date().toString());
        break;
      case "whoami":
        termWrite("noteforge-user");
        break;
      case "files":
        termWrite(tabs.map(function (t) { return t.name + (t.dirty ? " (unsaved)" : ""); }).join("\n") || "No open files");
        break;
      case "version":
        termWrite("NoteForge 1.0.0");
        break;
      case "run":
        runOutput();
        termWrite("Simulated run complete — see Output tab.", "tl-ok");
        break;
      default:
        termWrite(cmd + ": command not found (this is a sandboxed simulated terminal)", "tl-err");
    }
  }

  function runOutput() {
    var tab = getActiveTab();
    if (!tab) return;
    var content = cm.getValue();
    var out = document.getElementById("output-content");
    var lines = [];
    lines.push("[NoteForge simulated run] " + tab.name);
    lines.push("Language: " + (tab.langLabel || "Plain Text"));
    lines.push("Lines: " + cm.lineCount() + "  Characters: " + content.length);
    if (tab.mode === "javascript" || tab.mode === "text/javascript") {
      lines.push("--- console output ---");
      try {
        var logs = [];
        var fakeConsole = { log: function () { logs.push(Array.prototype.join.call(arguments, " ")); } };
        var fn = new Function("console", content);
        fn(fakeConsole);
        lines.push(logs.length ? logs.join("\n") : "(no console output)");
      } catch (e) {
        lines.push("Error: " + e.message);
        addProblem(tab.name, e.message);
      }
    } else if (tab.mode === "python" || tab.mode === "text/x-java" || tab.mode === "text/x-csrc" || tab.mode === "text/x-c++src") {
      lines.push("Real execution of " + (tab.langLabel || "this language") + " isn't available in a browser sandbox.");
      lines.push("Showing a static analysis instead: " + cm.lineCount() + " lines scanned, no syntax markers reported.");
    } else {
      lines.push("Nothing to execute for this file type — showing file contents summary only.");
    }
    out.textContent = lines.join("\n");
    switchBottomPanel("output");
  }

  function addProblem(file, message) {
    var el = document.getElementById("problems-content");
    if (el.textContent === "No problems detected.") el.textContent = "";
    var line = document.createElement("div");
    line.textContent = file + ": " + message;
    el.appendChild(line);
  }

  function switchBottomPanel(name) {
    document.querySelectorAll(".bottom-tab").forEach(function (b) {
      b.classList.toggle("active", b.dataset.panel === name);
    });
    document.querySelectorAll(".panel-view").forEach(function (v) {
      v.classList.toggle("active", v.id === "panel-" + name);
    });
  }

  document.querySelectorAll(".bottom-tab[data-panel]").forEach(function (btn) {
    btn.addEventListener("click", function () { switchBottomPanel(btn.dataset.panel); });
  });

  document.getElementById("terminal-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      runTerminalCommand(e.target.value);
      e.target.value = "";
    }
  });

  function toggleTerminalPanel() {
    document.getElementById("bottom-panel").classList.toggle("collapsed");
  }
  function clearTerminal() {
    document.getElementById("terminal-output").innerHTML = "";
  }

  // ---------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------
  function applySettings() {
    document.body.className = "theme-" + settings.theme;
    cm.setOption("theme", themeMap[settings.theme] || "dracula");
    cm.getWrapperElement().style.fontSize = settings.fontSize + "px";
    cm.getWrapperElement().style.fontFamily = settings.fontFamily;
    cm.setOption("indentUnit", settings.tabSize);
    cm.setOption("tabSize", settings.tabSize);
    cm.setOption("indentWithTabs", settings.indentType === "tabs");
    cm.setOption("lineWrapping", settings.wordWrap);
    cm.setOption("lineNumbers", settings.lineNumbers);
    cm.setOption("matchBrackets", settings.brackets);
    document.getElementById("workspace").dataset.layout = settings.layout;
    cm.refresh();
    updateStatusBar();
    NFStorage.saveSettings(settings);
  }

  function populateSettingsForm() {
    document.getElementById("setting-theme").value = settings.theme;
    document.getElementById("setting-fontsize").value = settings.fontSize;
    document.getElementById("setting-fontfamily").value = settings.fontFamily;
    document.getElementById("setting-tabsize").value = settings.tabSize;
    document.getElementById("setting-indent-type").value = settings.indentType;
    document.getElementById("setting-wordwrap").checked = settings.wordWrap;
    document.getElementById("setting-linenumbers").checked = settings.lineNumbers;
    document.getElementById("setting-brackets").checked = settings.brackets;
    document.getElementById("setting-autosave").checked = settings.autoSave;
    document.getElementById("setting-layout").value = settings.layout;
    document.getElementById("setting-preview-autorefresh").checked = settings.previewAutoRefresh;
  }

  function bindSettingsForm() {
    document.getElementById("setting-theme").addEventListener("change", function (e) { settings.theme = e.target.value; applySettings(); });
    document.getElementById("setting-fontsize").addEventListener("input", function (e) { settings.fontSize = parseInt(e.target.value, 10) || 14; applySettings(); });
    document.getElementById("setting-fontfamily").addEventListener("change", function (e) { settings.fontFamily = e.target.value; applySettings(); });
    document.getElementById("setting-tabsize").addEventListener("input", function (e) { settings.tabSize = parseInt(e.target.value, 10) || 4; applySettings(); });
    document.getElementById("setting-indent-type").addEventListener("change", function (e) { settings.indentType = e.target.value; applySettings(); });
    document.getElementById("setting-wordwrap").addEventListener("change", function (e) { settings.wordWrap = e.target.checked; applySettings(); });
    document.getElementById("setting-linenumbers").addEventListener("change", function (e) { settings.lineNumbers = e.target.checked; applySettings(); });
    document.getElementById("setting-brackets").addEventListener("change", function (e) { settings.brackets = e.target.checked; applySettings(); });
    document.getElementById("setting-autosave").addEventListener("change", function (e) { settings.autoSave = e.target.checked; applySettings(); });
    document.getElementById("setting-layout").addEventListener("change", function (e) { settings.layout = e.target.value; applySettings(); });
    document.getElementById("setting-preview-autorefresh").addEventListener("change", function (e) { settings.previewAutoRefresh = e.target.checked; applySettings(); });
  }

  // ---------------------------------------------------------------
  // Modals
  // ---------------------------------------------------------------
  function openModal(id) {
    document.getElementById("modal-backdrop").classList.remove("hidden");
    document.getElementById(id).classList.remove("hidden");
  }
  function closeModal(id) {
    document.getElementById(id).classList.add("hidden");
    if (!document.querySelectorAll(".modal:not(.hidden)").length) {
      document.getElementById("modal-backdrop").classList.add("hidden");
    }
  }
  document.getElementById("modal-backdrop").addEventListener("click", function () {
    document.querySelectorAll(".modal:not(.hidden)").forEach(function (m) { m.classList.add("hidden"); });
    document.getElementById("modal-backdrop").classList.add("hidden");
  });

  var promptCallback = null;
  function promptModal(title, defaultValue, callback) {
    document.getElementById("prompt-title").textContent = title;
    var input = document.getElementById("prompt-input");
    input.value = defaultValue || "";
    promptCallback = callback;
    openModal("prompt-modal");
    setTimeout(function () { input.focus(); input.select(); }, 0);
  }
  document.getElementById("prompt-ok").addEventListener("click", function () {
    var val = document.getElementById("prompt-input").value.trim();
    closeModal("prompt-modal");
    if (promptCallback) promptCallback(val);
  });
  document.getElementById("prompt-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") document.getElementById("prompt-ok").click();
    if (e.key === "Escape") closeModal("prompt-modal");
  });

  function toast(msg) {
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:fixed;bottom:40px;left:50%;transform:translateX(-50%);" +
      "background:var(--bg-3);color:var(--text);padding:8px 16px;border-radius:8px;" +
      "border:1px solid var(--border);font-size:12.5px;z-index:1000;box-shadow:0 8px 20px rgba(0,0,0,.4);";
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  // ---------------------------------------------------------------
  // Action dispatch (menus + toolbar share the same data-action map)
  // ---------------------------------------------------------------
  var actions = {
    "new-file": function () { promptModal("New File", "untitled.txt", function (name) { if (name) newTab({ name: name }); }); },
    "open-file": openFile,
    "open-folder": openFolder,
    "save-file": function () { saveFile(true); },
    "save-as-file": saveAsFile,
    "export-file": exportFile,
    "import-file": openFile,
    "close-tab": function () { if (activeTabId) closeTab(activeTabId); },
    "undo": function () { cm.execCommand("undo"); },
    "redo": function () { cm.execCommand("redo"); },
    "cut": doCut,
    "copy": doCopy,
    "paste": doPaste,
    "select-all": function () { cm.execCommand("selectAll"); },
    "toggle-comment": function () { cm.execCommand("toggleComment"); },
    "find": doFind,
    "replace": doReplace,
    "goto-line": doGotoLine,
    "toggle-sidebar": toggleSidebar,
    "toggle-terminal": toggleTerminalPanel,
    "toggle-wordwrap": function () { settings.wordWrap = !settings.wordWrap; applySettings(); },
    "toggle-minimap": function () { settings.minimap = !settings.minimap; toast("Minimap " + (settings.minimap ? "enabled" : "disabled") + " (simplified in this build)"); },
    "zoom-in": function () { settings.fontSize = Math.min(32, settings.fontSize + 1); applySettings(); },
    "zoom-out": function () { settings.fontSize = Math.max(10, settings.fontSize - 1); applySettings(); },
    "fullscreen": toggleFullscreen,
    "preview": togglePreview,
    "refresh-preview": refreshPreview,
    "preview-newtab": previewInNewTab,
    "close-preview": hidePreview,
    "run-output": runOutput,
    "clear-terminal": clearTerminal,
    "open-settings": function () { populateSettingsForm(); openModal("settings-modal"); },
    "close-settings": function () { closeModal("settings-modal"); },
    "reset-settings": function () {
      settings = Object.assign({}, NFStorage.defaultSettings);
      applySettings();
      populateSettingsForm();
    },
    "about": function () { openModal("about-modal"); },
    "close-about": function () { closeModal("about-modal"); },
    "shortcuts": function () { openModal("shortcuts-modal"); },
    "close-shortcuts": function () { closeModal("shortcuts-modal"); },
    "close-prompt": function () { closeModal("prompt-modal"); }
  };

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    var action = btn.dataset.action;
    if (actions[action]) actions[action]();
  });

  // ---------------------------------------------------------------
  // Menu open/close behavior
  // ---------------------------------------------------------------
  function closeAllMenus() {
    document.querySelectorAll(".menu.open").forEach(function (m) { m.classList.remove("open"); });
  }
  document.querySelectorAll(".menu").forEach(function (menu) {
    menu.addEventListener("click", function (e) {
      if (e.target.closest(".menu-dropdown button")) return; // handled by action dispatch
      var wasOpen = menu.classList.contains("open");
      closeAllMenus();
      if (!wasOpen) menu.classList.add("open");
    });
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".menu")) closeAllMenus();
  });

  document.getElementById("mobile-menu-toggle").addEventListener("click", function () {
    document.getElementById("menu-items").classList.toggle("open");
  });

  // ---------------------------------------------------------------
  // Sidebar toggle (desktop collapse / mobile slide-over)
  // ---------------------------------------------------------------
  function toggleSidebar() {
    var sidebar = document.getElementById("sidebar");
    if (window.innerWidth <= 820) {
      sidebar.classList.toggle("mobile-open");
    } else {
      sidebar.classList.toggle("collapsed");
    }
  }

  // ---------------------------------------------------------------
  // Fullscreen
  // ---------------------------------------------------------------
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function () {});
    } else {
      document.exitFullscreen().catch(function () {});
    }
  }

  // ---------------------------------------------------------------
  // Resizers
  // ---------------------------------------------------------------
  function makeResizer(handle, onDrag, onEnd) {
    var dragging = false;
    handle.addEventListener("pointerdown", function (e) {
      dragging = true;
      handle.classList.add("active");
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      onDrag(e);
    });
    ["pointerup", "pointercancel"].forEach(function (ev) {
      handle.addEventListener(ev, function () {
        if (!dragging) return;
        dragging = false;
        handle.classList.remove("active");
        if (onEnd) onEnd();
      });
    });
  }

  makeResizer(document.getElementById("sidebar-resizer"), function (e) {
    var sidebar = document.getElementById("sidebar");
    var rect = sidebar.getBoundingClientRect();
    var w = Math.min(500, Math.max(160, e.clientX - rect.left));
    sidebar.style.width = w + "px";
    layout.sidebarWidth = w;
  }, function () { NFStorage.saveLayout(layout); });

  makeResizer(document.getElementById("bottom-resizer"), function (e) {
    var panel = document.getElementById("bottom-panel");
    var rect = document.getElementById("workspace").getBoundingClientRect();
    var h = Math.min(rect.height - 120, Math.max(80, rect.bottom - e.clientY));
    panel.style.height = h + "px";
    layout.bottomHeight = h;
    cm.refresh();
  }, function () { NFStorage.saveLayout(layout); });

  makeResizer(document.getElementById("preview-resizer"), function (e) {
    var split = document.getElementById("editor-preview-split");
    var rect = split.getBoundingClientRect();
    var pct = Math.min(80, Math.max(20, ((rect.right - e.clientX) / rect.width) * 100));
    document.getElementById("preview-pane").style.width = pct + "%";
    layout.previewWidth = pct;
  }, function () { NFStorage.saveLayout(layout); cm.refresh(); });

  document.getElementById("sidebar").style.width = layout.sidebarWidth + "px";
  document.getElementById("bottom-panel").style.height = layout.bottomHeight + "px";
  document.getElementById("preview-pane").style.width = layout.previewWidth + "%";

  // ---------------------------------------------------------------
  // File search filter in sidebar
  // ---------------------------------------------------------------
  document.getElementById("file-search").addEventListener("input", function (e) {
    var q = e.target.value.toLowerCase();
    document.querySelectorAll(".file-list li").forEach(function (li) {
      var name = (li.querySelector(".fname") || li).textContent.toLowerCase();
      li.style.display = !q || name.indexOf(q) !== -1 ? "" : "none";
    });
  });

  // ---------------------------------------------------------------
  // Keyboard shortcuts (global)
  // ---------------------------------------------------------------
  document.addEventListener("keydown", function (e) {
    var ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === "n") { e.preventDefault(); actions["new-file"](); }
    else if (ctrl && e.key.toLowerCase() === "o") { e.preventDefault(); actions["open-file"](); }
    else if (ctrl && e.shiftKey && e.key.toLowerCase() === "s") { e.preventDefault(); actions["save-as-file"](); }
    else if (ctrl && e.key.toLowerCase() === "s") { e.preventDefault(); actions["save-file"](); }
    else if (ctrl && e.key.toLowerCase() === "w") { e.preventDefault(); actions["close-tab"](); }
    else if (ctrl && e.key.toLowerCase() === "p") { e.preventDefault(); actions["preview"](); }
    else if (ctrl && e.key.toLowerCase() === "g") { e.preventDefault(); actions["goto-line"](); }
    else if (ctrl && (e.key === "+" || e.key === "=")) { e.preventDefault(); actions["zoom-in"](); }
    else if (ctrl && e.key === "-") { e.preventDefault(); actions["zoom-out"](); }
    else if (e.key === "F11") { e.preventDefault(); actions["fullscreen"](); }
    // Ctrl+F / Ctrl+H / Ctrl+Z / Ctrl+Y are handled natively by CodeMirror when focused
  });

  // ---------------------------------------------------------------
  // Warn on unload if unsaved changes exist
  // ---------------------------------------------------------------
  window.addEventListener("beforeunload", function (e) {
    persistTabs();
    var hasDirty = tabs.some(function (t) { return t.dirty; });
    if (hasDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  window.addEventListener("resize", function () { cm.refresh(); });

  // Handle Android hardware back button (bridge calls window.NFHandleBack if present)
  window.NFHandleBack = function () {
    var sidebar = document.getElementById("sidebar");
    if (sidebar.classList.contains("mobile-open")) { sidebar.classList.remove("mobile-open"); return true; }
    if (!document.getElementById("preview-pane").classList.contains("hidden")) { hidePreview(); return true; }
    if (!document.getElementById("settings-modal").classList.contains("hidden")) { closeModal("settings-modal"); return true; }
    return false; // let native app decide (e.g. exit)
  };

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------
  applySettings();
  restoreTabs();
  renderRecentList();
  bindSettingsForm();
  updateStatusBar();
})();
