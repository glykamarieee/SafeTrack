#!/usr/bin/env bash
# Builds the SafeTrack web app and deploys it to Vercel (https://safetrack-omega.vercel.app).
# Vercel never uploads folders named node_modules, but Expo puts the icon and font files under
# dist/assets/node_modules; they are moved to dist/assets/nm and vercel.json routes the old paths there.
set -euo pipefail
cd "$(dirname "$0")/.."
npx expo export --platform web
mv dist/assets/node_modules dist/assets/nm
cp web-deploy/vercel.json dist/vercel.json
printf '.env*\n' > dist/.vercelignore
mkdir -p dist/.vercel && cp web-deploy/.vercel/project.json dist/.vercel/project.json
cd dist && npx --yes vercel@latest deploy --prod --yes
rm -f .env.local   # vercel may drop a token file here; never keep it next to the site files
