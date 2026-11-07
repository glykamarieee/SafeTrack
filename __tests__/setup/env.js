// Unit tests talk to the real SafeTrack Supabase project, like the app does:
// the project URL and publishable (public) key are read from .env. Nothing is
// printed. The service-role key is never used here.
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "..", ".env");
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(EXPO_PUBLIC_[A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}
