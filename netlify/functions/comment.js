const PROFANITY_PATTERNS = [
  /\bfuck(?:er|ing|ed)?\b/i,
  /\bshit(?:ty)?\b/i,
  /\basshole\b/i,
  /\bbitch(?:es)?\b/i,
  /\bcunt\b/i,
  /\bdick\b/i,
  /\bpiss\b/i,
  /\bslut\b/i,
  /\bwhore\b/i,
  /\bfag(?:got)?\b/i,
  /\bnigg(?:er|a)\b/i,
];

const MAX_WORDS = 150;
const MAX_COMMENT_CHARS = 1800;
const MAX_NAME_CHARS = 80;
const MAX_META_CHARS = 500;

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function wordCount(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean).length;
}

function hasProfanity(value) {
  return PROFANITY_PATTERNS.some((pattern) => pattern.test(String(value || "")));
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Use POST." });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON." });
  }

  const comment = String(payload.comment || "").trim();
  const name = String(payload.name || "").trim().slice(0, MAX_NAME_CHARS);
  const hotspotId = String(payload.hotspot_id || "").trim().slice(0, MAX_META_CHARS);
  const hotspotTitle = String(payload.hotspot_title || "").trim().slice(0, MAX_META_CHARS);

  if (!hotspotId || !comment) {
    return json(400, { error: "Hotspot and comment are required." });
  }

  if (comment.length > MAX_COMMENT_CHARS) {
    return json(400, { error: "Comment is too long." });
  }

  if (wordCount(comment) > MAX_WORDS) {
    return json(400, { error: `Comment must be ${MAX_WORDS} words or fewer.` });
  }

  if (hasProfanity(comment) || hasProfanity(name)) {
    return json(400, { error: "Comment did not pass the language screen." });
  }

  const row = {
    submitted_at: new Date().toISOString(),
    moderation_status: "pending",
    profanity_screen: "passed",
    hotspot_id: hotspotId,
    hotspot_title: hotspotTitle,
    commenter_name: name,
    comment,
    word_count: wordCount(comment),
    page_url: String(payload.page_url || "").slice(0, MAX_META_CHARS),
    user_agent: String(payload.user_agent || event.headers["user-agent"] || "").slice(0, MAX_META_CHARS),
    moderator_notes: "",
    approved_at: "",
    approved_by: "",
    public_comment_id: "",
  };

  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!webhookUrl) {
    return json(202, { ok: true, queued: false, message: "No sheet webhook configured." });
  }

  let response;
  let result;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "submitComment",
        secret: process.env.GOOGLE_SHEET_WEBHOOK_SECRET || "",
        row,
      }),
    });
    result = await response.json().catch(() => ({}));
  } catch {
    return json(502, { error: "The moderation sheet could not be reached." });
  }

  if (!response.ok || result.ok === false) {
    return json(502, { error: "The moderation sheet did not accept the comment." });
  }

  return json(202, { ok: true, queued: true });
};
