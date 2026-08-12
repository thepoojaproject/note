/* NoteForge - language detection & configuration */
(function (global) {
  "use strict";

  // Ordered list shown in the Language menu
  var LANGUAGES = [
    { id: "htmlmixed", label: "HTML", ext: ["html", "htm"] },
    { id: "css", label: "CSS", ext: ["css"] },
    { id: "javascript", label: "JavaScript", ext: ["js", "mjs", "cjs"], mime: "text/javascript" },
    { id: "json", label: "JSON", ext: ["json"], mime: "application/json" },
    { id: "xml", label: "XML", ext: ["xml"], mime: "application/xml" },
    { id: "markdown", label: "Markdown", ext: ["md", "markdown"] },
    { id: "python", label: "Python", ext: ["py", "pyw"] },
    { id: "text/x-java", label: "Java", ext: ["java"], mime: "text/x-java" },
    { id: "text/x-csrc", label: "C", ext: ["c", "h"], mime: "text/x-csrc" },
    { id: "text/x-c++src", label: "C++", ext: ["cpp", "cc", "cxx", "hpp"], mime: "text/x-c++src" },
    { id: "php", label: "PHP", ext: ["php"], mime: "application/x-httpd-php" },
    { id: "sql", label: "SQL", ext: ["sql"] },
    { id: "shell", label: "Bash", ext: ["sh", "bash"] },
    { id: "text/plain", label: "Plain Text", ext: ["txt", ""], mime: "text/plain" }
  ];

  var EXT_TO_LANG = {};
  LANGUAGES.forEach(function (lang) {
    lang.ext.forEach(function (e) { EXT_TO_LANG[e] = lang; });
  });

  var ICONS = {
    html: "🌐", htm: "🌐", css: "🎨", js: "📜", mjs: "📜", cjs: "📜",
    json: "🧩", xml: "📰", md: "📝", markdown: "📝", py: "🐍", pyw: "🐍",
    java: "☕", c: "🔧", h: "🔧", cpp: "🔧", cc: "🔧", cxx: "🔧", hpp: "🔧",
    php: "🐘", sql: "🗄", sh: "💻", bash: "💻", txt: "📄"
  };

  function extOf(filename) {
    var parts = (filename || "").split(".");
    if (parts.length < 2) return "";
    return parts[parts.length - 1].toLowerCase();
  }

  function detect(filename) {
    var ext = extOf(filename);
    return EXT_TO_LANG[ext] || EXT_TO_LANG[""];
  }

  function iconFor(filename) {
    var ext = extOf(filename);
    return ICONS[ext] || "📄";
  }

  global.NFLanguages = {
    all: LANGUAGES,
    detect: detect,
    extOf: extOf,
    iconFor: iconFor
  };
})(window);
