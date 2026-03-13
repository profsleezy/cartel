// client/ui.js
// Renders the non-board UI: sidebar, phase banner, timer.

export function renderSidebar(){
  const sidebar = document.getElementById('sidebar');
  if(!sidebar) return;

  sidebar.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = 'Player';

  const list = document.createElement('ul');

  const items = [
    ['Cash', '$1,200'],
    ['Heat', '12'],
    ['Product', '7']
  ];

  items.forEach(([label, value]) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = label;
    const strong = document.createElement('strong');
    strong.textContent = value;
    li.appendChild(span);
    li.appendChild(strong);
    list.appendChild(li);
  });

  const tip = document.createElement('div');
  tip.className = 'sidebar-tip';
  tip.textContent = 'Tips: Static UI — no interactions in Stage 1.';

  sidebar.appendChild(title);
  sidebar.appendChild(list);
  sidebar.appendChild(tip);
}

export function renderPhaseBanner(phase){
  const el = document.getElementById('phase-banner');
  if(!el) return;
  el.textContent = `Phase: ${phase}`;
}

export function renderTimer(seconds){
  const el = document.getElementById('timer');
  if(!el) return;
  el.textContent = `${seconds}s`;
}

