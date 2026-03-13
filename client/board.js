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

  // Update inner content (name + owner label)
  const name = newData && newData.name ? newData.name : districtId;
  const ownerLabel = newData && newData.owner ? newData.owner : '';

  el.innerHTML = `<div class="name">${escapeHtml(name)}</div><div class="owner">${escapeHtml(ownerLabel)}</div>`;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}
