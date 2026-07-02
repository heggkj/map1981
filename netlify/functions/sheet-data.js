function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }

  if (event.httpMethod !== "GET") {
    return json(405, { error: "Use GET." });
  }

  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!webhookUrl) {
    return json(200, { ok: true, configured: false, tileData: [], comments: [] });
  }

  try {
    const url = new URL(webhookUrl);
    url.searchParams.set("action", "publicData");
    url.searchParams.set("secret", process.env.GOOGLE_SHEET_WEBHOOK_SECRET || "");

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return json(502, { error: "The sheet data endpoint did not respond." });
    }

    const data = await response.json();
    if (data.ok === false) {
      return json(502, { error: data.error || "The sheet data endpoint returned an error." });
    }

    return json(200, {
      ok: true,
      configured: true,
      tileData: Array.isArray(data.tileData) ? data.tileData : [],
      comments: Array.isArray(data.comments) ? data.comments : [],
    });
  } catch {
    return json(502, { error: "The sheet data endpoint could not be reached." });
  }
};
