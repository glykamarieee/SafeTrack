// Expo config plugin: keeps the newest link intent on MainActivity.
//
// When Android has closed SafeTrack in the background and the guardian taps a
// password-reset or email-confirmation link, Android recreates the activity
// with its first (launcher) intent and delivers the link through
// onNewIntent. React Native's Linking.getInitialURL() reads getIntent(), so
// it returned no link and the app opened the start screen instead of Reset
// password (found on a Samsung Galaxy A07, 2026-11-13). setIntent() makes the
// link the activity's intent, so getInitialURL() sees it.
const { withMainActivity } = require("expo/config-plugins");

module.exports = function withLinkIntent(config) {
  return withMainActivity(config, (mod) => {
    let src = mod.modResults.contents;
    if (src.includes("setIntent(intent)")) return mod;
    if (!src.includes("import android.content.Intent")) {
      src = src.replace("import android.os.Bundle", "import android.content.Intent\nimport android.os.Bundle");
    }
    src = src.replace(
      /class MainActivity : ReactActivity\(\) \{/,
      `class MainActivity : ReactActivity() {
  // Keep the newest link (reset or confirmation email) for Linking.getInitialURL().
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
  }
`,
    );
    mod.modResults.contents = src;
    return mod;
  });
};
