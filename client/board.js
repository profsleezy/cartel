// client/board.js
// Responsible only for rendering district DOM nodes and updating them.
// Rules:
// - Only this module touches district DOM visuals via updateDistrict(id, data)
// - renderBoard creates containers and delegates visual updates to updateDistrict

export function renderBoard(districts){
  const board = document.getElementById('board');
  if(!board) return;
  board.innerHTML = '';

  districts.forEach(d => {
    // create a container element for each district with data-id
    const el = document.createElement('div');
    el.dataset.id = d.id;
    el.className = 'district';
    // do not set owner classes or inner content here — use updateDistrict
    board.appendChild(el);
    // call updateDistrict to apply visual state
    updateDistrict(d.id, d);
  });
}

export function updateDistrict(districtId, newData){
  const board = document.getElementById('board');
  if(!board) return;
  const el = board.querySelector(`[data-id="${districtId}"]`);
  if(!el) return;

  // clear previous owner classes
  el.classList.remove('owned','neutral','enemy');

  // apply owner class if provided (expected: 'owned'|'neutral'|'enemy')
  if(newData && newData.owner){
    el.classList.add(newData.owner);
  }

  // Update inner content (name, owner label, buildings count, per-type inventory)
  const name = newData && newData.name ? newData.name : districtId;
  const ownerLabel = newData && newData.owner ? newData.owner : '';
  const buildings = newData && Array.isArray(newData.buildings) ? newData.buildings : [];

  // building count
  const buildingsHtml = `<div class="buildings">Buildings: ${buildings.length}/5</div>`;

  // per-type inventory icons removed from tiles — inventory is now shown in the sidebar
  const prodHtml = '';
  const heat = newData && typeof newData.heat === 'number' ? newData.heat : 0;
  const HEAT_CAP = 20; // probabilistic system uses cap of 20
  const heatPct = Math.min(100, Math.round((heat / HEAT_CAP) * 100));
  // label the bar 'Risk' and fill proportional to heat / 20
  const heatHtml = `
    <div class="risk-label">Risk</div>
    <div class="heat"><div class="heat-fill" style="width:${heatPct}%;background:linear-gradient(90deg,var(--heat-low),var(--heat-high))"></div></div>
  `;

  // raided visual
  if(newData && newData.raided){
    el.classList.add('raided');
  } else {
    el.classList.remove('raided');
  }

  const raidLabelHtml = newData && newData.raided ? `<div class="raid-label">RAIDED</div>` : '';

  el.innerHTML = `
    <div>
      <div class="name">${escapeHtml(name)}</div>
      <div class="owner">${escapeHtml(ownerLabel)}</div>
    </div>
    ${buildingsHtml}
    ${prodHtml}
    ${heatHtml}
    ${raidLabelHtml}
  `;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}
