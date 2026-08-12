# NoteForge

NoteForge is a lightweight, offline-first code editor for the browser and Android,
inspired by classic desktop code editors — dark IDE layout, tabs, a file explorer,
find/replace, live HTML/CSS/JS preview, and a simulated terminal/output panel.
No branding, logos, or icons from any existing editor are used; the UI is an
original design.

- **Frontend:** HTML5, CSS3, JavaScript, [CodeMirror](https://codemirror.net/5/) (vendored locally — works fully offline)
- **Android:** a small native WebView wrapper that loads the same web app from local assets (no server, no network calls)

---

## 1. Run the web version locally

No build step is required — it's static HTML/CSS/JS.

```bash
cd app/src/main/assets
python3 -m http.server 8080
# then open http://localhost:8080 in your browser
```

Or just open `app/src/main/assets/index.html` directly in a browser (some
browser File System Access features require `http://`/`https://`, so the local
server above is recommended for the full experience).

---

## 2. Build the Android APK from GitHub

1. Create a new GitHub repository.
2. Upload all project files to the repository root (keep the folder structure intact).
3. Commit to `main`.
4. Open the repository's **Actions** tab.
5. Select **"Build NoteForge APK"**.
6. Click **Run workflow**.
7. Wait for the green check mark.
8. Open the completed workflow run.
9. Download the **"NoteForge-debug-apk"** artifact.
10. Extract the downloaded ZIP — it contains `app-debug.apk`.
11. Transfer `app-debug.apk` to an Android device and install it (enable
    "Install unknown apps" for your file manager/browser if prompted).

A second workflow, **"Build NoteForge Release APK"**, produces an unsigned
release build (`app-release-unsigned.apk`) — trigger it manually from the
Actions tab or by publishing a GitHub release. Sign it with your own keystore
before distributing it.

---

## 3. Build the APK locally (optional)

Requirements: JDK 17, Android SDK (compileSdk 35), Gradle 8.9+.

```bash
gradle :app:assembleDebug --stacktrace --no-daemon
# Output: app/build/outputs/apk/debug/app-debug.apk
```

---

## Project structure

```
NoteForge/
├── app/
│   ├── src/main/
│   │   ├── java/com/noteforge/editor/MainActivity.java   # WebView wrapper
│   │   ├── res/                                           # icons, theme, strings
│   │   ├── assets/                                        # the full web app (offline)
│   │   │   ├── index.html
│   │   │   ├── css/style.css
│   │   │   ├── js/{app.js, languages.js, storage.js}
│   │   │   └── vendor/codemirror/                         # vendored CodeMirror 5
│   │   └── AndroidManifest.xml
│   ├── build.gradle
│   └── proguard-rules.pro
├── .github/workflows/
│   ├── build-apk.yml            # debug APK on push / manual run
│   └── build-apk-release.yml    # unsigned release APK on demand
├── build.gradle
├── settings.gradle
├── gradle.properties
└── README.md
```

## Features

- Menu bar (File, Edit, Search, View, Language, Tools, Settings, Help) and a toolbar
  with New / Open / Save / Save As / Undo / Redo / Cut / Copy / Paste / Find / Replace / Preview / Settings
- Multi-tab editing with unsaved-change indicators, double-click-to-rename, and
  tab restoration across reloads (via `localStorage`)
- File Explorer sidebar: open editors, recent files, and project-folder browsing
  (via the File System Access API where the browser supports it, with a
  download/upload fallback everywhere else)
- CodeMirror-powered editing: syntax highlighting, line numbers, current-line
  highlight, code folding, bracket matching, auto-indent, auto-closing
  brackets/tags, search & replace (with regex/case/whole-word options), go to
  line, word wrap toggle, and zoom in/out
- Automatic language detection from file extension for HTML, CSS, JavaScript,
  JSON, XML, Markdown, Python, Java, C, C++, PHP, SQL, Bash, and plain text
- Status bar: file type, line, column, character count, selection count,
  encoding, and indentation
- Sandboxed live preview for HTML/CSS/JS files, with refresh and
  open-in-new-tab actions
- A simulated Terminal/Output/Problems panel (the browser sandbox cannot run
  real shell commands, so this panel is clearly labeled as simulated/local)
- A settings modal (theme, font, tab size, word wrap, auto save, layout, etc.)
  persisted in `localStorage`, plus four built-in themes
- A responsive mobile layout for the Android WebView build: collapsible
  sidebar, horizontally scrollable tabs, larger touch targets, and safe-area
  support for notches

## Security & privacy notes

- The app never sends files or contents to any external server.
- The Android app does **not** request the `INTERNET` permission.
- The live preview renders inside a sandboxed `<iframe>`.
- The terminal is a simulated, local-only panel — it never executes real
  shell commands.
