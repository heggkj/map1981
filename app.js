const HOTSPOTS_URL = "harrisonburg_1981_hotspots.json";
const APPROVED_COMMENTS_URL = "comments-approved.json";
const COMMENT_ENDPOINT = "/.netlify/functions/comment";
const SHEET_DATA_ENDPOINT = "/.netlify/functions/sheet-data";
const MAX_WORDS = 300;

const profanityPatterns = [
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

const state = {
  data: null,
  hotspots: new Map(),
  comments: [],
  activeId: null,
  challengeId: null,
  zoom: 1,
  tileZoom: 1,
  tileOffsetX: 0,
  tileOffsetY: 0,
  fitWidth: 960,
  imageRatio: 2047 / 1726,
};

const els = {
  stage: document.querySelector("#mapStage"),
  scroll: document.querySelector("#mapScroll"),
  empty: document.querySelector("#emptyState"),
  panel: document.querySelector("#detailPanel"),
  tileViewport: document.querySelector("#detailTileViewport"),
  tile: document.querySelector("#detailTile"),
  tileZoomOut: document.querySelector("#tileZoomOut"),
  tileZoomIn: document.querySelector("#tileZoomIn"),
  tileReset: document.querySelector("#tileReset"),
  title: document.querySelector("#detailTitle"),
  description: document.querySelector("#detailDescription"),
  comments: document.querySelector("#approvedComments"),
  showForm: document.querySelector("#showCommentForm"),
  form: document.querySelector("#commentForm"),
  name: document.querySelector("#commentName"),
  text: document.querySelector("#commentText"),
  counter: document.querySelector("#wordCounter"),
  status: document.querySelector("#commentStatus"),
  challenge: document.querySelector("#challenge"),
  challengeText: document.querySelector("#challengeText"),
  challengeResult: document.querySelector("#challengeResult"),
  toggleChallenge: document.querySelector("#toggleChallenge"),
  about: document.querySelector("#aboutDialog"),
};

const panState = {
  active: false,
  moved: false,
  startX: 0,
  startY: 0,
  scrollLeft: 0,
  scrollTop: 0,
  suppressClick: false,
};

const tilePanState = {
  active: false,
  startX: 0,
  startY: 0,
  offsetX: 0,
  offsetY: 0,
};

function wordCount(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function hasProfanity(value) {
  return profanityPatterns.some((pattern) => pattern.test(value));
}

function todayIndex(length) {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = new Date() - start;
  const day = Math.floor(diff / 86400000);
  return day % length;
}

function chooseChallenge(random = false) {
  const candidates = state.data.hotspots.filter((hotspot) => !hotspot.hidden && hotspot.display_area < 50000);
  if (!candidates.length) return;
  const index = random ? Math.floor(Math.random() * candidates.length) : todayIndex(candidates.length);
  const target = candidates[index];
  state.challengeId = target.id;
  els.challengeText.textContent = target.challenge_prompt || `Can you find ${target.title}?`;
  document.querySelectorAll(".hotspot.is-target").forEach((node) => node.classList.remove("is-target"));
  updateChallengeResult();
}

function applyMapSize() {
  const width = state.fitWidth * state.zoom;
  const height = width / state.imageRatio;
  const scrollStyle = getComputedStyle(els.scroll);
  const paddingLeft = parseFloat(scrollStyle.paddingLeft) || 0;
  const paddingRight = parseFloat(scrollStyle.paddingRight) || 0;
  const paddingTop = parseFloat(scrollStyle.paddingTop) || 0;
  const paddingBottom = parseFloat(scrollStyle.paddingBottom) || 0;
  const availableWidth = els.scroll.clientWidth - paddingLeft - paddingRight;
  const availableHeight = els.scroll.clientHeight - paddingTop - paddingBottom;
  els.stage.style.width = `${width}px`;
  els.stage.style.marginLeft = `${Math.max(0, (availableWidth - width) / 2)}px`;
  els.stage.style.marginTop = `${Math.max(0, (availableHeight - height) / 2)}px`;
}

function fitMapToPane() {
  const scrollStyle = getComputedStyle(els.scroll);
  const paddingX = (parseFloat(scrollStyle.paddingLeft) || 0) + (parseFloat(scrollStyle.paddingRight) || 0);
  const paddingY = (parseFloat(scrollStyle.paddingTop) || 0) + (parseFloat(scrollStyle.paddingBottom) || 0);
  const availableWidth = Math.max(280, els.scroll.clientWidth - paddingX);
  const availableHeight = Math.max(240, els.scroll.clientHeight - paddingY);
  state.fitWidth = Math.min(availableWidth, availableHeight * state.imageRatio);
  applyMapSize();
}

function setZoom(nextZoom) {
  state.zoom = Math.min(3.5, Math.max(0.85, nextZoom));
  applyMapSize();
}

function normalizedWheelDelta(event) {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * els.scroll.clientHeight;
  return event.deltaY;
}

function zoomFromWheel(event) {
  if (event.target.closest("button, input, textarea, dialog")) return;
  event.preventDefault();

  const oldZoom = state.zoom;
  const delta = normalizedWheelDelta(event);
  const nextZoom = Math.min(3.5, Math.max(0.85, oldZoom * Math.exp(-delta * 0.0015)));
  if (Math.abs(nextZoom - oldZoom) < 0.001) return;

  const scrollRect = els.scroll.getBoundingClientRect();
  const stageRect = els.stage.getBoundingClientRect();
  const localX = (event.clientX - stageRect.left) / stageRect.width;
  const localY = (event.clientY - stageRect.top) / stageRect.height;

  setZoom(nextZoom);

  els.scroll.scrollLeft = localX * els.stage.offsetWidth - (event.clientX - scrollRect.left);
  els.scroll.scrollTop = localY * els.stage.offsetHeight - (event.clientY - scrollRect.top);
}

function resetMapView() {
  state.zoom = 1;
  fitMapToPane();
  els.scroll.scrollTo({ top: 0, left: 0, behavior: "smooth" });
}

function clampTileOffsets() {
  if (state.tileZoom <= 1) {
    state.tileOffsetX = 0;
    state.tileOffsetY = 0;
    return;
  }

  const rect = els.tileViewport.getBoundingClientRect();
  const maxX = (rect.width * (state.tileZoom - 1)) / 2;
  const maxY = (rect.height * (state.tileZoom - 1)) / 2;
  state.tileOffsetX = Math.min(maxX, Math.max(-maxX, state.tileOffsetX));
  state.tileOffsetY = Math.min(maxY, Math.max(-maxY, state.tileOffsetY));
}

function applyTileTransform() {
  clampTileOffsets();
  els.tile.style.transform = `translate(${state.tileOffsetX}px, ${state.tileOffsetY}px) scale(${state.tileZoom})`;
}

function resetTileView() {
  state.tileZoom = 1;
  state.tileOffsetX = 0;
  state.tileOffsetY = 0;
  applyTileTransform();
}

function setTileZoom(nextZoom, originX = 0.5, originY = 0.5) {
  const oldZoom = state.tileZoom;
  const zoom = Math.min(5, Math.max(1, nextZoom));
  if (Math.abs(zoom - oldZoom) < 0.001) return;

  const rect = els.tileViewport.getBoundingClientRect();
  const localX = (originX - 0.5) * rect.width;
  const localY = (originY - 0.5) * rect.height;
  const ratio = zoom / oldZoom;

  state.tileOffsetX = localX - (localX - state.tileOffsetX) * ratio;
  state.tileOffsetY = localY - (localY - state.tileOffsetY) * ratio;
  state.tileZoom = zoom;
  applyTileTransform();
}

function zoomTileFromWheel(event) {
  if (event.target.closest("button")) return;
  event.preventDefault();
  const rect = els.tileViewport.getBoundingClientRect();
  const originX = (event.clientX - rect.left) / rect.width;
  const originY = (event.clientY - rect.top) / rect.height;
  const delta = normalizedWheelDelta(event);
  setTileZoom(state.tileZoom * Math.exp(-delta * 0.0015), originX, originY);
}

function beginTilePan(event) {
  if (event.button !== 0 || event.target.closest("button") || state.tileZoom <= 1) return;
  tilePanState.active = true;
  tilePanState.startX = event.clientX;
  tilePanState.startY = event.clientY;
  tilePanState.offsetX = state.tileOffsetX;
  tilePanState.offsetY = state.tileOffsetY;
  els.tileViewport.classList.add("is-panning");
  els.tileViewport.setPointerCapture?.(event.pointerId);
}

function moveTilePan(event) {
  if (!tilePanState.active) return;
  state.tileOffsetX = tilePanState.offsetX + event.clientX - tilePanState.startX;
  state.tileOffsetY = tilePanState.offsetY + event.clientY - tilePanState.startY;
  applyTileTransform();
}

function endTilePan(event) {
  if (!tilePanState.active) return;
  tilePanState.active = false;
  els.tileViewport.classList.remove("is-panning");
  els.tileViewport.releasePointerCapture?.(event.pointerId);
}

function setChallengeCollapsed(collapsed) {
  els.challenge.classList.toggle("is-collapsed", collapsed);
  els.toggleChallenge.textContent = collapsed ? "Clue" : "Hide";
  els.toggleChallenge.setAttribute("aria-label", collapsed ? "Show clue" : "Collapse clue");
  els.toggleChallenge.title = collapsed ? "Show clue" : "Collapse clue";
}

function beginPan(event) {
  if (event.button !== 0 || event.target.closest("button, input, textarea, dialog")) return;
  panState.active = true;
  panState.moved = false;
  panState.startX = event.clientX;
  panState.startY = event.clientY;
  panState.scrollLeft = els.scroll.scrollLeft;
  panState.scrollTop = els.scroll.scrollTop;
}

function movePan(event) {
  if (!panState.active) return;
  const dx = event.clientX - panState.startX;
  const dy = event.clientY - panState.startY;
  if (Math.abs(dx) + Math.abs(dy) > 4) {
    panState.moved = true;
    els.scroll.classList.add("is-panning");
    els.scroll.scrollLeft = panState.scrollLeft - dx;
    els.scroll.scrollTop = panState.scrollTop - dy;
  }
}

function endPan(event) {
  if (!panState.active) return;
  panState.active = false;
  els.scroll.classList.remove("is-panning");
  if (panState.moved) {
    panState.suppressClick = true;
    window.setTimeout(() => {
      panState.suppressClick = false;
    }, 0);
  }
}

function renderApprovedComments(hotspotId) {
  const approved = state.comments.filter((comment) => comment.hotspot_id === hotspotId && comment.status === "approved");
  els.comments.innerHTML = "";
  els.showForm.hidden = !approved.length;
  els.form.hidden = approved.length > 0;

  if (!approved.length) {
    const empty = document.createElement("p");
    empty.className = "no-comments";
    empty.textContent = "No approved comments or memories yet.";
    els.comments.append(empty);
    return;
  }

  for (const comment of approved) {
    const item = document.createElement("p");
    item.className = "approved-comment";
    const name = document.createElement("strong");
    name.textContent = comment.name || "Anonymous";
    const body = document.createTextNode(comment.comment);
    item.append(name, body);
    els.comments.append(item);
  }
}

function applyTileData(rows) {
  if (!Array.isArray(rows)) return;

  for (const row of rows) {
    const hotspotId = String(row.hotspot_id || row.id || "").trim();
    const hotspot = state.hotspots.get(hotspotId);
    if (!hotspot) continue;

    const status = String(row.status || "").trim().toLowerCase();
    hotspot.hidden = status === "hidden";

    for (const key of ["title", "caption", "description", "challenge_prompt"]) {
      const value = String(row[key] || "").trim();
      if (value) hotspot[key] = value;
    }

    const tile = String(row.thumbnail_url || row.tile_path || "").trim();
    if (tile) hotspot.tile = tile;

    if (status) hotspot.status = status;
    if (row.needs_review !== undefined && row.needs_review !== "") {
      hotspot.needs_review = String(row.needs_review).toLowerCase() === "true";
    }
  }
}

function normalizeApprovedComments(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => ({
      hotspot_id: String(row.hotspot_id || "").trim(),
      status: String(row.status || row.moderation_status || "approved").trim().toLowerCase(),
      name: String(row.name || row.commenter_name || "").trim(),
      comment: String(row.comment || "").trim(),
    }))
    .filter((comment) => comment.hotspot_id && comment.comment && comment.status === "approved");
}

async function loadSheetData() {
  const response = await fetch(SHEET_DATA_ENDPOINT, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Sheet data endpoint unavailable");

  const data = await response.json();
  applyTileData(data.tileData);
  state.comments = normalizeApprovedComments(data.comments);
}

function updateChallengeResult() {
  if (!state.activeId || !state.challengeId) {
    els.challengeResult.hidden = true;
    return;
  }

  const activePath = document.querySelector(`.hotspot[data-id="${CSS.escape(state.activeId)}"]`);
  if (state.activeId === state.challengeId) {
    els.challengeResult.hidden = false;
    els.challengeResult.textContent = "Found it. That is today's target.";
    activePath?.classList.add("is-target");
  } else {
    els.challengeResult.hidden = true;
    document.querySelectorAll(".hotspot.is-target").forEach((node) => {
      if (node.dataset.id !== state.challengeId) node.classList.remove("is-target");
    });
  }
}

function focusHotspot(hotspotId) {
  const hotspot = state.hotspots.get(hotspotId);
  if (!hotspot || hotspot.hidden) return;

  state.activeId = hotspotId;
  document.querySelectorAll(".hotspot.is-active").forEach((node) => node.classList.remove("is-active"));
  document.querySelector(`.hotspot[data-id="${CSS.escape(hotspotId)}"]`)?.classList.add("is-active");

  els.empty.hidden = true;
  els.panel.hidden = false;
  els.tile.src = hotspot.tile;
  els.tile.alt = hotspot.title;
  resetTileView();
  els.title.textContent = hotspot.title;
  els.description.textContent = hotspot.description;
  els.status.textContent = "";
  els.form.reset();
  updateCounter();
  renderApprovedComments(hotspotId);
  updateChallengeResult();
}

function bindSvg() {
  const svg = els.stage.querySelector("svg");
  svg?.removeAttribute("width");
  svg?.removeAttribute("height");

  els.stage.querySelectorAll(".hotspot").forEach((path) => {
    const id = path.dataset.id || path.id?.replace(/^hotspot-/, "");
    if (!id || !state.hotspots.has(id)) return;
    const hotspot = state.hotspots.get(id);
    if (hotspot.hidden) {
      path.style.display = "none";
      path.setAttribute("aria-hidden", "true");
      return;
    }
    path.dataset.id = id;
    path.setAttribute("tabindex", "0");
    path.setAttribute("role", "button");
    path.setAttribute("aria-label", hotspot.title);
    path.addEventListener("click", () => focusHotspot(id));
    path.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        focusHotspot(id);
      }
    });
  });
}

function updateCounter() {
  const count = wordCount(els.text.value);
  els.counter.textContent = `${count} / ${MAX_WORDS} words`;
  els.counter.style.color = count > MAX_WORDS ? "#A4232B" : "";
}

function localQueue(comment) {
  const key = "harrisonburg-map-local-moderation";
  const queued = JSON.parse(localStorage.getItem(key) || "[]");
  queued.push(comment);
  localStorage.setItem(key, JSON.stringify(queued));
}

async function submitComment(event) {
  event.preventDefault();
  if (!state.activeId) return;

  const comment = els.text.value.trim();
  const name = els.name.value.trim();
  const count = wordCount(comment);

  if (!comment) {
    els.status.textContent = "Add a memory or comment before sending.";
    return;
  }
  if (count > MAX_WORDS) {
    els.status.textContent = "Please keep it at 300 words or fewer.";
    return;
  }
  if (hasProfanity(comment) || hasProfanity(name)) {
    els.status.textContent = "That submission needs cleaner language before it can enter moderation.";
    return;
  }

  const payload = {
    hotspot_id: state.activeId,
    hotspot_title: state.hotspots.get(state.activeId).title,
    name,
    comment,
    page_url: window.location.href,
    user_agent: navigator.userAgent,
    submitted_at: new Date().toISOString(),
  };

  els.status.textContent = "Sending...";
  try {
    const response = await fetch(COMMENT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("Comment endpoint unavailable");
    els.status.textContent = result.queued === false
      ? "Saved for testing. The sheet connection is not configured yet."
      : "Sent to moderation. Thank you.";
  } catch {
    localQueue({ ...payload, status: "pending_local" });
    els.status.textContent = "Saved locally for testing. Netlify will send it to the sheet later.";
  }
  els.form.reset();
  updateCounter();
}

async function loadApprovedComments() {
  try {
    const response = await fetch(APPROVED_COMMENTS_URL);
    if (!response.ok) throw new Error("No approved comments or memories file yet");
    state.comments = await response.json();
  } catch {
    state.comments = [];
  }
}

async function init() {
  const dataResponse = await fetch(HOTSPOTS_URL);
  state.data = await dataResponse.json();
  state.hotspots = new Map(state.data.hotspots.map((hotspot) => [hotspot.id, hotspot]));
  state.imageRatio = state.data.image.width / state.data.image.height;

  try {
    await loadSheetData();
  } catch {
    await loadApprovedComments();
  }

  const svgResponse = await fetch(state.data.image.overlay);
  els.stage.innerHTML = await svgResponse.text();
  bindSvg();
  chooseChallenge(false);
  resetMapView();
}

document.querySelector("#zoomIn").addEventListener("click", () => setZoom(state.zoom * 1.18));
document.querySelector("#zoomOut").addEventListener("click", () => setZoom(state.zoom / 1.18));
document.querySelector("#resetMap").addEventListener("click", resetMapView);
document.querySelector("#newChallenge").addEventListener("click", () => chooseChallenge(true));
els.toggleChallenge.addEventListener("click", () => setChallengeCollapsed(!els.challenge.classList.contains("is-collapsed")));
document.querySelector("#aboutButton").addEventListener("click", () => els.about.showModal());
document.querySelector("#closeAbout").addEventListener("click", () => els.about.close());
els.about.addEventListener("click", (event) => {
  if (event.target === els.about) els.about.close();
});
els.text.addEventListener("input", updateCounter);
els.form.addEventListener("submit", submitComment);
els.showForm.addEventListener("click", () => {
  els.form.hidden = false;
  els.showForm.hidden = true;
  els.status.textContent = "";
  els.text.focus();
});
els.tile.addEventListener("load", resetTileView);
els.tileZoomIn.addEventListener("click", () => setTileZoom(state.tileZoom * 1.22));
els.tileZoomOut.addEventListener("click", () => setTileZoom(state.tileZoom / 1.22));
els.tileReset.addEventListener("click", resetTileView);
els.tileViewport.addEventListener("wheel", zoomTileFromWheel, { passive: false });
els.tileViewport.addEventListener("pointerdown", beginTilePan);
els.tileViewport.addEventListener("pointermove", moveTilePan);
els.tileViewport.addEventListener("pointerup", endTilePan);
els.tileViewport.addEventListener("pointercancel", endTilePan);
els.scroll.addEventListener("pointerdown", beginPan);
els.scroll.addEventListener("pointermove", movePan);
els.scroll.addEventListener("pointerup", endPan);
els.scroll.addEventListener("pointercancel", endPan);
els.scroll.addEventListener("wheel", zoomFromWheel, { passive: false });
window.addEventListener("resize", () => {
  const previousZoom = state.zoom;
  fitMapToPane();
  state.zoom = previousZoom;
  applyMapSize();
  applyTileTransform();
});
els.stage.addEventListener(
  "click",
  (event) => {
    if (!panState.suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
  },
  true,
);

init().catch((error) => {
  els.stage.textContent = "The map could not load. Try running it from a local web server.";
  console.error(error);
});
