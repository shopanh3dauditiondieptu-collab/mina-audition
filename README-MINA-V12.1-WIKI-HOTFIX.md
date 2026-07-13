# Mina V12.1 Wiki Display Hotfix

- Wikipedia loads `/database/master-skills.json` first, so API 500 cannot block display.
- `/api/wiki-skills` returns bundled local data when GitHub variables/API are unavailable.
- Removed public HTML/SEO references to Mina logo image paths.
- Updated Wiki cache-busting version.
- No Firestore post data is modified.
