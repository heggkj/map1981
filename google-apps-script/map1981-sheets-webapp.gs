const MAP1981 = {
  spreadsheetId: "1L7vu8ZUEM-vCEqqAlpDwuSnoeHBs-tcAOQ_fWKnwGDM",
  commentsSheetName: "Comments",
  tileDataSheetName: "TileData",
  secretProperty: "MAP1981_WEBHOOK_SECRET",
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
  "caption",
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

function setupMap1981Sheets() {
  const spreadsheet = getSpreadsheet_();
  const commentsSheet = ensureSheet_(spreadsheet, MAP1981.commentsSheetName, COMMENT_HEADERS);
  const tileDataSheet = ensureSheet_(spreadsheet, MAP1981.tileDataSheetName, TILE_DATA_HEADERS);

  formatSheet_(commentsSheet, COMMENT_HEADERS.length);
  formatSheet_(tileDataSheet, TILE_DATA_HEADERS.length);
  setDropdown_(commentsSheet, 2, ["pending", "approved", "rejected", "needs_followup"]);
  setDropdown_(tileDataSheet, 8, ["draft", "reviewed", "published", "hidden"]);
  applyThumbnailFormulas_(tileDataSheet);
  commentsSheet.setColumnWidth(7, 340);
  tileDataSheet.setColumnWidth(4, 420);
  tileDataSheet.setColumnWidth(5, 140);
}

function setMap1981Secret() {
  PropertiesService.getScriptProperties().setProperty(
    MAP1981.secretProperty,
    "replace-this-with-a-long-random-secret"
  );
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
      caption: row.caption,
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
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
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

function getSpreadsheet_() {
  return SpreadsheetApp.openById(MAP1981.spreadsheetId);
}

function json_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
