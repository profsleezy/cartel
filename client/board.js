// client/board.js
// Responsible only for rendering district DOM nodes and updating them.
// Rules:
// - Only this module touches district DOM visuals via updateDistrict(id, data)
// - renderBoard creates containers and delegates visual updates to updateDistrict
// - After render, computeGridAdjacency derives orthogonal neighbours from DOM
//   layout and writes them back onto each district object so combat.js can read them.

export function renderBoard(districts) {
  _districts = districts;
  const board = document.getElementById("board");
  if (!board) return;
  board.innerHTML = "";

  districts.forEach((d) => {
    // create a container element for each district with data-id
    const el = document.createElement("div");
    el.dataset.id = d.id;
    el.className = "district";
    // do not set owner classes or inner content here — use updateDistrict
    board.appendChild(el);
    // call updateDistrict to apply visual state
    updateDistrict(d.id, d);
  });

  // After the browser has laid out the grid, derive orthogonal adjacency from
  // actual DOM positions and store it on each district object.
  requestAnimationFrame(() => computeGridAdjacency(board, districts));
}

/**
 * Read each district tile's offsetTop / offsetLeft, cluster them into logical
 * grid rows and columns, then write the four orthogonal neighbours (up, down,
 * left, right) back onto district.adjacency.
 *
 * This runs entirely in the client (board.js is allowed DOM access) so that
 * combat.js can stay DOM-free and simply read district.adjacency.
 */
function computeGridAdjacency(board, districts) {
  const els = Array.from(board.querySelectorAll("[data-id]"));
  if (els.length === 0) return;

  // Collect raw pixel positions
  const positions = els.map((el) => ({
    id: el.dataset.id,
    top: el.offsetTop,
    left: el.offsetLeft,
  }));

  // Tolerance in px: two elements within THRESHOLD of each other share a row/col
  const THRESHOLD = 4;

  const uniqueTops = [...new Set(positions.map((p) => p.top))].sort(
    (a, b) => a - b,
  );
  const uniqueLefts = [...new Set(positions.map((p) => p.left))].sort(
    (a, b) => a - b,
  );

  const toRow = (top) =>
    uniqueTops.findIndex((t) => Math.abs(t - top) <= THRESHOLD);
  const toCol = (left) =>
    uniqueLefts.findIndex((l) => Math.abs(l - left) <= THRESHOLD);

  // Build a "row,col" → districtId lookup
  const posMap = new Map();
  positions.forEach((p) => {
    const r = toRow(p.top);
    const c = toCol(p.left);
    if (r >= 0 && c >= 0) posMap.set(`${r},${c}`, p.id);
  });

  // For every district, collect the four orthogonal neighbours that exist
  districts.forEach((d) => {
    const pos = positions.find((p) => p.id === d.id);
    if (!pos) return;
    const r = toRow(pos.top);
    const c = toCol(pos.left);
    d.adjacency = [
      posMap.get(`${r - 1},${c}`), // above
      posMap.get(`${r + 1},${c}`), // below
      posMap.get(`${r},${c - 1}`), // left
      posMap.get(`${r},${c + 1}`), // right
    ].filter(Boolean);
  });
}

export function updateDistrict(districtId, newData) {
  const board = document.getElementById("board");
  if (!board) return;
  const el = board.querySelector(`[data-id="${districtId}"]`);
  if (!el) return;

  // clear previous owner classes
  el.classList.remove("owner-player1", "owner-enemy1", "owner-enemy2", "owner-enemy3", "owner-neutral", "raided", "selected", "pending-attack");

  // apply owner class based on player ID
  const CURRENT_PLAYER_ID = "player1";
  if (newData && newData.owner) {
    if (newData.owner === CURRENT_PLAYER_ID) {
      el.classList.add("owner-player1");
    } else if (newData.owner === "neutral") {
      el.classList.add("owner-neutral");
    } else if (newData.owner === "enemy1") {
      el.classList.add("owner-enemy1");
    } else if (newData.owner === "enemy2") {
      el.classList.add("owner-enemy2");
    } else if (newData.owner === "enemy3") {
      el.classList.add("owner-enemy3");
    } else {
      el.classList.add("owner-neutral");
    }
  }

  // Update inner content (name, owner label, buildings count, per-type inventory)
  const name = newData && newData.name ? newData.name : districtId;
  // Map owner ID back to a human-readable label to keep visuals identical
  const ownerLabel =
    !newData || !newData.owner
      ? ""
      : newData.owner === CURRENT_PLAYER_ID
        ? "owned"
        : newData.owner === "neutral"
          ? "neutral"
          : "enemy";
  const buildings =
    newData && Array.isArray(newData.buildings) ? newData.buildings : [];

  // building count
  const thugs = newData && typeof newData.thugs === "number" ? newData.thugs : 0;
  const heat = newData && typeof newData.heat === "number" ? newData.heat : 0;
  const HEAT_CAP = 20;
  const heatPct = Math.min(100, Math.round((heat / HEAT_CAP) * 100));

  if (newData && newData.raided) {
    el.classList.add("raided");
  }

  if (newData && newData.pendingAttack) {
    el.classList.add("selected");
  }

  el.innerHTML = `
    <div class="d-inner">
      <div class="name">${escapeHtml(name)}</div>
      <div class="owner-tag">${escapeHtml(ownerLabel)}</div>
      <div class="stats-row">
        <div class="stat"><span class="value">${escapeHtml(thugs)}</span> THUGS</div>
        <div class="stat"><span class="value">${escapeHtml(buildings.length)}</span> BLD</div>
      </div>
      <div class="risk-wrap">
        <div class="risk-label">Risk</div>
        <div class="risk"><div class="risk-fill" style="width:${heatPct}%"></div></div>
      </div>
      ${newData && newData.raided ? `<div class="raid-label">RAIDED</div>` : ""}
    </div>
  `;
}

/** Recompute grid adjacency whenever the window is resized (column count may change). */
function _getBoard() {
  return document.getElementById("board");
}
// Keep a reference to the districts array so the resize handler can update it
let _districts = null;
window.addEventListener("resize", () => {
  const board = _getBoard();
  if (board && _districts) computeGridAdjacency(board, _districts);
});

/**
 * Highlight valid attack target districts and optionally mark one as selected.
 * districtIds  – array of valid target ids (red outline)
 * selectedId   – the currently chosen target id (gold outline, overrides highlight)
 */
export function highlightTargets(districtIds, selectedId = null) {
  const board = document.getElementById("board");
  if (!board) return;
  const all = Array.from(board.querySelectorAll("[data-id]"));
  all.forEach((el) => {
    const id = el.dataset.id;
    el.classList.remove("highlight", "highlight-selected");
    if (selectedId && id === selectedId) {
      el.classList.add("highlight-selected");
    } else if (districtIds && districtIds.includes(id)) {
      el.classList.add("highlight");
    }
  });
}

/** Add a sold-flash CSS class to a district element and remove it after 600ms. */
export function flashDistrict(districtId) {
  const board = document.getElementById("board");
  if (!board) return;
  const el = board.querySelector(`[data-id="${districtId}"]`);
  if (!el) return;
  el.classList.add("sold-flash");
  setTimeout(() => el.classList.remove("sold-flash"), 600);
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"]/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch],
  );
}
