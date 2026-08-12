# NoteForge proguard rules

# Keep WebView JavaScript interface methods (none are used yet, but keep this
# in place for forward compatibility if a JS bridge is added later).
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep the main activity class name stable for the launcher intent.
-keep class com.noteforge.editor.MainActivity { *; }
