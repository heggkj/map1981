const MAP1981 = {
  spreadsheetId: "1L7vu8ZUEM-vCEqqAlpDwuSnoeHBs-tcAOQ_fWKnwGDM",
  commentsSheetName: "Comments",
  tileDataSheetName: "TileData",
  publicSiteUrl: "https://map1981.netlify.app/",
  secretProperty: "MAP1981_WEBHOOK_SECRET",
  appSheetTileUrlProperty: "MAP1981_APPSHEET_TILE_EDITOR_URL",
  appSheetCommentsUrlProperty: "MAP1981_APPSHEET_COMMENTS_MODERATOR_URL",
  appSheetTileDefaultUrl: "https://www.appsheet.com/start/7c462f89-411b-4d06-b794-c8da6ca302e5?platform=desktop#view=TileData%20editor&row=lincoln-homestead-sign",
  appSheetCommentsDefaultUrl: "https://www.appsheet.com/start/7c462f89-411b-4d06-b794-c8da6ca302e5?platform=desktop#view=Comments%20moderator",
};

const COMMENT_HEADERS = [
  "submitted_at",
  "moderation_status",
  "profanity_screen",
  "hotspot_id",
  "hotspot_title",
  "commenter_name",
  "comment",
  "word_count",
  "page_url",
  "user_agent",
  "moderator_notes",
  "approved_at",
  "approved_by",
  "public_comment_id",
];

const TILE_DATA_HEADERS = [
  "hotspot_id",
  "title",
  "description",
  "thumbnail",
  "tile_path",
  "thumbnail_url",
  "status",
  "needs_review",
  "challenge_prompt",
  "center_x",
  "center_y",
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Map1981")
    .addItem("Open TileData editor", "openTileDataEditorAppSheet")
    .addItem("Open Comments moderator", "openCommentsModeratorAppSheet")
    .addSeparator()
    .addItem("Refresh tile thumbnails", "refreshMap1981TileThumbnails")
    .addSeparator()
    .addItem("Configure AppSheet links", "configureAppSheetLinks")
    .addItem("AppSheet setup guide", "showAppSheetSetupGuide")
    .addToUi();
}

function installMap1981AppSheetLaunchpad() {
  setupMap1981Sheets();
  showAppSheetSetupGuide();
}

function openTileDataEditorAppSheet() {
  const rowKey = firstRowValue_(MAP1981.tileDataSheetName, "hotspot_id", "lincoln-homestead-sign");
  openConfiguredAppSheet_(MAP1981.appSheetTileUrlProperty, "TileData editor", MAP1981.appSheetTileDefaultUrl, "TileData editor", rowKey);
}

function openCommentsModeratorAppSheet() {
  const rowKey = firstRowValue_(MAP1981.commentsSheetName, "submitted_at", "");
  openConfiguredAppSheet_(MAP1981.appSheetCommentsUrlProperty, "Comments moderator", MAP1981.appSheetCommentsDefaultUrl, "Comments moderator", rowKey);
}

function configureAppSheetLinks() {
  const ui = SpreadsheetApp.getUi();
  const properties = PropertiesService.getScriptProperties();
  const tileResponse = ui.prompt(
    "TileData AppSheet URL",
    "Paste the AppSheet app URL or the AppSheet editor URL for the TileData view.",
    ui.ButtonSet.OK_CANCEL
  );
  if (tileResponse.getSelectedButton() !== ui.Button.OK) return;

  const commentsResponse = ui.prompt(
    "Comments moderator AppSheet URL",
    "Paste the AppSheet app URL or the AppSheet editor URL for the Comments moderator view.",
    ui.ButtonSet.OK_CANCEL
  );
  if (commentsResponse.getSelectedButton() !== ui.Button.OK) return;

  properties.setProperty(MAP1981.appSheetTileUrlProperty, String(tileResponse.getResponseText() || "").trim());
  properties.setProperty(MAP1981.appSheetCommentsUrlProperty, String(commentsResponse.getResponseText() || "").trim());
  ui.alert("AppSheet links saved. Reload the spreadsheet if the menu does not update immediately.");
}

function showAppSheetSetupGuide() {
  const spreadsheetUrl = getSpreadsheet_().getUrl();
  const html = HtmlService.createHtmlOutput(`
    <div style="font:14px Arial,sans-serif;line-height:1.45;padding:4px 2px 10px;color:#333">
      <p><strong>Recommended setup:</strong> create one private AppSheet app named <em>Map1981 Editor</em> from this Google Sheet, then add two views.</p>
      <ol>
        <li>In Google Sheets, use <strong>Extensions &gt; AppSheet &gt; Create an app</strong>, or open AppSheet and choose this spreadsheet.</li>
        <li>In AppSheet, open <strong>Data &gt; Columns &gt; TileData</strong>, regenerate the structure, and confirm that <code>caption</code> is gone.</li>
        <li>Set <code>thumbnail_url</code> to an image/thumbnail type and give it a display name like <strong>Thumbnail</strong>. Use that field in the TileData editor view. The <code>thumbnail</code> spreadsheet column is only a Google Sheets preview formula and can be hidden in AppSheet if it shows warning icons.</li>
        <li>Create a <strong>TileData editor</strong> view for the <code>TileData</code> tab. Editable fields: <code>title</code>, <code>description</code>, <code>status</code>, <code>needs_review</code>, <code>challenge_prompt</code>. Keep <code>thumbnail_url</code> visible but read-only.</li>
        <li>The menu opens the regular <code>TileData editor</code> table view with the first row selected. Adjust thumbnail/image size in AppSheet's column and detail/card view display settings.</li>
        <li>Create a <strong>Comments moderator</strong> view for the <code>Comments</code> tab. Editable fields: <code>moderation_status</code>, <code>moderator_notes</code>, <code>approved_at</code>, <code>approved_by</code>.</li>
        <li>Keep IDs, tile paths, centers, submitted dates, page URLs, and user agents read-only.</li>
        <li>Open each AppSheet view or editor view, copy its browser URL, then return here and use <strong>Map1981 &gt; Configure AppSheet links</strong>. Editor URLs are converted to app launch URLs automatically.</li>
      </ol>
      <p>
        <a href="${escapeHtml_(spreadsheetUrl)}" target="_blank">Open this spreadsheet</a>
        &nbsp;|&nbsp;
        <a href="https://www.appsheet.com/" target="_blank">Open AppSheet</a>
      </p>
    </div>
  `).setWidth(560).setHeight(420);

  SpreadsheetApp.getUi().showModalDialog(html, "Map1981 AppSheet setup");
}

function setupMap1981Sheets() {
  const spreadsheet = getSpreadsheet_();
  const commentsSheet = ensureSheet_(spreadsheet, MAP1981.commentsSheetName, COMMENT_HEADERS);
  const tileDataSheet = spreadsheet.getSheetByName(MAP1981.tileDataSheetName) || spreadsheet.insertSheet(MAP1981.tileDataSheetName);

  removeColumnByHeader_(tileDataSheet, "caption");
  ensureHeaders_(tileDataSheet, TILE_DATA_HEADERS);

  formatSheet_(commentsSheet, COMMENT_HEADERS.length);
  formatSheet_(tileDataSheet, TILE_DATA_HEADERS.length);
  setDropdown_(commentsSheet, 2, ["pending", "approved", "rejected", "needs_followup"]);
  setDropdown_(tileDataSheet, TILE_DATA_HEADERS.indexOf("status") + 1, ["draft", "reviewed", "published", "hidden"]);
  populateThumbnailUrls_(tileDataSheet);
  applyThumbnailFormulas_(tileDataSheet);
  sizeMap1981Sheets_(commentsSheet, tileDataSheet);
}

function refreshMap1981TileThumbnails() {
  const sheet = getSpreadsheet_().getSheetByName(MAP1981.tileDataSheetName);
  if (!sheet) {
    SpreadsheetApp.getUi().alert("TileData sheet was not found.");
    return;
  }

  removeColumnByHeader_(sheet, "caption");
  ensureHeaders_(sheet, TILE_DATA_HEADERS);
  populateThumbnailUrls_(sheet);
  applyThumbnailFormulas_(sheet);
  sizeMap1981Sheets_(null, sheet);
  SpreadsheetApp.getUi().alert("Tile thumbnail URLs and preview images were refreshed.");
}

function setMap1981Secret() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    "Set Map1981 webhook secret",
    "Paste the same secret you will store in Netlify as GOOGLE_SHEET_WEBHOOK_SECRET.",
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const secret = String(response.getResponseText() || "").trim();
  if (!secret || secret === "replace-this-with-a-long-random-secret") {
    ui.alert("Secret was not saved. Paste a real shared secret.");
    return;
  }

  saveMap1981Secret_(secret);
  ui.alert("Map1981 webhook secret saved.");
}

function doGet(event) {
  try {
    requireSecret_(event && event.parameter && event.parameter.secret);
    return json_({
      ok: true,
      tileData: readTileData_(),
      comments: readApprovedComments_(),
    });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function doPost(event) {
  try {
    const payload = JSON.parse((event.postData && event.postData.contents) || "{}");
    requireSecret_(payload.secret);

    if (payload.action && payload.action !== "submitComment") {
      throw new Error("Unsupported action.");
    }

    appendComment_(payload.row || {});
    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function appendComment_(row) {
  const spreadsheet = getSpreadsheet_();
  const sheet = ensureSheet_(spreadsheet, MAP1981.commentsSheetName, COMMENT_HEADERS);
  const values = COMMENT_HEADERS.map((header) => {
    if (header === "submitted_at") return row[header] || new Date().toISOString();
    if (header === "moderation_status") return row[header] || "pending";
    if (header === "profanity_screen") return row[header] || "passed";
    return row[header] || "";
  });

  sheet.appendRow(values);
}

function readTileData_() {
  const sheet = getSpreadsheet_().getSheetByName(MAP1981.tileDataSheetName);
  if (!sheet) return [];
  return rowsAsObjects_(sheet, TILE_DATA_HEADERS.length)
    .filter((row) => row.hotspot_id)
    .map((row) => ({
      hotspot_id: row.hotspot_id,
      title: row.title,
      description: row.description,
      tile_path: row.tile_path,
      thumbnail_url: row.thumbnail_url,
      status: row.status,
      needs_review: row.needs_review,
      challenge_prompt: row.challenge_prompt,
    }));
}

function readApprovedComments_() {
  const sheet = getSpreadsheet_().getSheetByName(MAP1981.commentsSheetName);
  if (!sheet) return [];
  return rowsAsObjects_(sheet, COMMENT_HEADERS.length)
    .filter((row) => String(row.moderation_status || "").toLowerCase() === "approved")
    .filter((row) => row.hotspot_id && row.comment)
    .map((row) => ({
      hotspot_id: row.hotspot_id,
      status: "approved",
      name: row.commenter_name,
      comment: row.comment,
      approved_at: row.approved_at,
      public_comment_id: row.public_comment_id,
    }));
}

function rowsAsObjects_(sheet, columnCount) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(1, 1, lastRow, columnCount).getDisplayValues();
  const headers = values.shift().map((header) => String(header || "").trim());
  return values.map((row) => {
    const object = {};
    headers.forEach((header, index) => {
      object[header] = String(row[index] || "").trim();
    });
    return object;
  });
}

function ensureSheet_(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  ensureHeaders_(sheet, headers);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function formatSheet_(sheet, columnCount) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, columnCount)
    .setBackground("#450084")
    .setFontColor("#ffffff")
    .setFontWeight("bold");
  sheet.autoResizeColumns(1, columnCount);
}

function setDropdown_(sheet, columnNumber, values) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, columnNumber, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(rule);
}

function applyThumbnailFormulas_(sheet) {
  const thumbnailColumn = TILE_DATA_HEADERS.indexOf("thumbnail") + 1;
  const thumbnailUrlColumn = TILE_DATA_HEADERS.indexOf("thumbnail_url") + 1;
  const thumbnailUrlLetter = columnLetter_(thumbnailUrlColumn);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const formulas = [];
  for (let row = 2; row <= lastRow; row += 1) {
    formulas.push([`=IF(LEN(${thumbnailUrlLetter}${row}),IMAGE(${thumbnailUrlLetter}${row},4,80,120),"")`]);
  }
  sheet.getRange(2, thumbnailColumn, formulas.length, 1).setFormulas(formulas);
}

function populateThumbnailUrls_(sheet) {
  const tilePathColumn = TILE_DATA_HEADERS.indexOf("tile_path") + 1;
  const thumbnailUrlColumn = TILE_DATA_HEADERS.indexOf("thumbnail_url") + 1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const tilePaths = sheet.getRange(2, tilePathColumn, lastRow - 1, 1).getDisplayValues();
  const thumbnailUrls = sheet.getRange(2, thumbnailUrlColumn, lastRow - 1, 1).getDisplayValues();
  const baseUrl = MAP1981.publicSiteUrl.replace(/\/?$/, "/");
  const values = tilePaths.map((row, index) => {
    const currentUrl = String(thumbnailUrls[index][0] || "").trim();
    const tilePath = String(row[0] || "").trim();
    if (currentUrl || !tilePath) return [currentUrl];
    return [baseUrl + tilePath.replace(/^\/+/, "")];
  });

  sheet.getRange(2, thumbnailUrlColumn, values.length, 1).setValues(values);
}

function removeColumnByHeader_(sheet, header) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return;

  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const index = headers.findIndex((value) => String(value || "").trim() === header);
  if (index >= 0) sheet.deleteColumn(index + 1);
}

function sizeMap1981Sheets_(commentsSheet, tileDataSheet) {
  if (commentsSheet) commentsSheet.setColumnWidth(7, 340);
  if (!tileDataSheet) return;

  tileDataSheet.setColumnWidth(TILE_DATA_HEADERS.indexOf("description") + 1, 420);
  tileDataSheet.setColumnWidth(TILE_DATA_HEADERS.indexOf("thumbnail") + 1, 140);
  tileDataSheet.setColumnWidth(TILE_DATA_HEADERS.indexOf("thumbnail_url") + 1, 330);
  if (tileDataSheet.getLastRow() > 1) {
    tileDataSheet.setRowHeights(2, tileDataSheet.getLastRow() - 1, 84);
  }
}

function columnLetter_(columnNumber) {
  let letter = "";
  let value = columnNumber;
  while (value > 0) {
    const modulo = (value - 1) % 26;
    letter = String.fromCharCode(65 + modulo) + letter;
    value = Math.floor((value - modulo) / 26);
  }
  return letter;
}

function requireSecret_(candidate) {
  const expected = PropertiesService.getScriptProperties().getProperty(MAP1981.secretProperty);
  if (!expected || expected === "replace-this-with-a-long-random-secret") {
    throw new Error("Set MAP1981_WEBHOOK_SECRET in Script Properties first.");
  }
  if (String(candidate || "") !== expected) {
    throw new Error("Invalid secret.");
  }
}

function saveMap1981Secret_(secret) {
  PropertiesService.getScriptProperties().setProperty(MAP1981.secretProperty, secret);
}

function openConfiguredAppSheet_(propertyName, label, defaultUrl, viewName, rowKey) {
  const configuredUrl = PropertiesService.getScriptProperties().getProperty(propertyName);
  const url = normalizeAppSheetLaunchUrl_(configuredUrl || defaultUrl, viewName, rowKey);
  if (!url) {
    SpreadsheetApp.getUi().alert(`${label} link is not configured yet. Use Map1981 > AppSheet setup guide, then Map1981 > Configure AppSheet links.`);
    return;
  }

  const safeUrl = escapeHtml_(url);
  const safeLabel = escapeHtml_(label);
  const html = HtmlService.createHtmlOutput(`
    <div style="font:14px Arial,sans-serif;line-height:1.45;padding:10px;color:#333">
      <p>Open the ${safeLabel} in AppSheet.</p>
      <p><a href="${safeUrl}" target="_blank" style="display:inline-block;padding:10px 14px;border-radius:6px;background:#450084;color:#fff;text-decoration:none;font-weight:700">Open ${safeLabel}</a></p>
      <p style="color:#666">If the button does not open a new tab, right-click it and choose open in a new tab.</p>
    </div>
  `).setWidth(380).setHeight(190);

  SpreadsheetApp.getUi().showModalDialog(html, `Open ${label}`);
}

function normalizeAppSheetLaunchUrl_(url, viewName, rowKey) {
  const value = String(url || "").trim();
  if (!value) return "";

  const appIdMatch = value.match(/[?&]appId=([^&#]+)/) || value.match(/\/start\/([^/?#]+)/);
  if (!appIdMatch) return value;

  const appId = decodeURIComponent(appIdMatch[1]);
  const hashParts = [];
  if (viewName) hashParts.push(`view=${encodeURIComponent(viewName)}`);
  if (rowKey) hashParts.push(`row=${encodeURIComponent(rowKey)}`);
  const hash = hashParts.length ? `#${hashParts.join("&")}` : "";
  return `https://www.appsheet.com/start/${encodeURIComponent(appId)}?platform=desktop${hash}`;
}

function firstRowValue_(sheetName, headerName, fallback) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return fallback || "";

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const columnIndex = headers.findIndex((header) => String(header || "").trim() === headerName);
  if (columnIndex < 0) return fallback || "";

  return String(sheet.getRange(2, columnIndex + 1).getDisplayValue() || "").trim() || fallback || "";
}

function escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(MAP1981.spreadsheetId);
}

function json_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
