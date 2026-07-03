# Harrisonburg/JMU 1981 Map Explorer

Single-page web app for exploring the edited 1981 Harrisonburg/JMU illustrated map.

## Local Preview

Run a local static server from this folder:

```powershell
python -m http.server 5173
```

Then open:

```text
http://localhost:5173/
```

The app loads `harisonburg-map/harrisonburg_1981_overlay-edited.svg`, `harrisonburg_1981_hotspots.json`, and the regenerated tiles in `tiles-edited/`.

## Regenerating Map Data

If polygon geometry or titles change in the SVG:

```powershell
python scripts/normalize_svg_hotspots.py
python scripts/generate_map_assets.py
```

`normalize_svg_hotspots.py` keeps SVG path IDs, `data-id`, labels, and titles aligned. `generate_map_assets.py` writes:

- `harrisonburg_1981_hotspots.json`
- `harrisonburg_1981_hotspots.csv`
- `tiles-edited/*.webp`

## Comments & Memories Moderation

The browser posts comments and memories to `/.netlify/functions/comment`. Locally, if that function is not running, clean submissions are saved in browser local storage for testing. On Netlify, functions proxy both comment submission and public sheet reads so Google secrets never appear in the browser.

For production on Netlify, add environment variables:

```text
GOOGLE_SHEET_WEBHOOK_URL=your_private_google_apps_script_web_app_url
GOOGLE_SHEET_WEBHOOK_SECRET=your_long_random_shared_secret
```

The Netlify Function screens profanity before sending a submission to the moderation queue. Submissions that fail the language screen are rejected before they reach the sheet. The visitor-facing app reads approved comments and editable tile copy from `/.netlify/functions/sheet-data`, which calls the same Google Apps Script web app.

Do not share a Gmail password for this. Use a Google Apps Script web app deployed from the sheet:

1. Open the Google Sheet.
2. Go to **Extensions > Apps Script**.
3. Paste in `google-apps-script/map1981-sheets-webapp.gs`.
4. In Apps Script, open **Project Settings > Script Properties** and add `MAP1981_WEBHOOK_SECRET` with the same secret you will put in Netlify. Do not paste the secret into the script or README.
5. Run `setupMap1981Sheets()`.
6. Deploy as a Web App, executing as you, with access set to anyone with the link.
7. Copy the `/exec` Web App URL into `GOOGLE_SHEET_WEBHOOK_URL`.

If you prefer a prompt instead of Project Settings, run `setMap1981Secret()` manually from the Apps Script editor.

If running `setMap1981Secret()` from the Apps Script editor shows an unknown error, skip that function and use **Project Settings > Script Properties** instead.

## Google Sheet Format

Use a tab named `Comments` with these columns in row 1:

```text
submitted_at
moderation_status
profanity_screen
hotspot_id
hotspot_title
commenter_name
comment
word_count
page_url
user_agent
moderator_notes
approved_at
approved_by
public_comment_id
```

Use `moderation_status` values like `pending`, `approved`, `rejected`, or `needs_followup`.

Use a tab named `TileData` with these columns in row 1:

```text
hotspot_id
title
description
thumbnail
tile_path
thumbnail_url
status
needs_review
challenge_prompt
center_x
center_y
```

The app uses `hotspot_id` to match rows to polygons. Edit `title`, `description`, and optional `challenge_prompt` in the sheet. Keep `tile_path` as the local tile path unless you later provide a custom public `thumbnail_url`. The `thumbnail` column is a formula column that displays the image from `thumbnail_url` once the tiles are hosted at a public URL. Use `status=hidden` if a polygon should not be selectable.

After deployment, fill `thumbnail_url` from `tile_path`, for example by putting this in `F2` and filling down:

```text
=IF(LEN(E2),"https://your-site-name.netlify.app/"&E2,"")
```

If you are using the included Apps Script menu, use **Map1981 > Refresh tile thumbnails** after deployment to fill the public URLs and thumbnail previews automatically.

## Safer Editing Workflow

Do not put an editable Google Sheet URL in the public app header. For easier editing, create a private AppSheet app from the same Google Sheet and require Google sign-in for the allowed editors.

The Apps Script file adds a `Map1981` menu in the Google Sheet with editor launchpad items:

- `Open TileData editor`
- `Open Comments moderator`
- `Configure AppSheet links`
- `AppSheet setup guide`

The AppSheet launch links open the regular desktop views, with the first available row selected where AppSheet has a stable key. They are not meant to force detail-only views.

Recommended AppSheet views:

- `TileData`: after changing Sheet columns, use AppSheet's **Data > Columns > TileData > Regenerate Structure** so stale fields like `caption` disappear. Set `thumbnail_url` to an image/thumbnail type, give it the display name `Thumbnail`, and show it with `hotspot_id`, `title`, `description`, `challenge_prompt`, `status`, and `needs_review`. Hide the spreadsheet-only `thumbnail` formula column in AppSheet if it shows warning icons. Keep `hotspot_id`, `tile_path`, `thumbnail_url`, `center_x`, and `center_y` read-only.
- `Comments`: show `submitted_at`, `moderation_status`, `hotspot_id`, `hotspot_title`, `commenter_name`, `comment`, `moderator_notes`, `approved_at`, and `approved_by`. Use quick filters for `pending` and `approved`.

Once those editor URLs exist, keep them in a private document or behind Netlify Access/Identity rather than linking them from the public visitor page.

Approved comments and memories can still be tested without Netlify by copying public submissions into `comments-approved.json` using this shape:

```json
[
  {
    "hotspot_id": "welcome-to-harrisonburg-sign",
    "status": "approved",
    "name": "Visitor name",
    "comment": "Helpful correction or memory."
  }
]
```

## Notes

The working folder is named `harisonburg-map` on disk. The app follows that existing spelling so paths resolve locally.
