import { load, save, exportBackup, importBackup } from './storage.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

let state = load();

// Ensure schema has orderOwner
if (!('orderOwner' in state)) state.orderOwner = '';

function uid() { return Math.random().toString(36).slice(2, 9); }
function fmtDate(d=new Date()) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle:'short', timeStyle:'short' }).format(d);
}

function setToday() { $('#today').textContent = fmtDate(); }
setToday(); setInterval(setToday, 60_000);

/* Tabs */
$$('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    $$('.tab').forEach(b=>{ b.classList.toggle('active', b===btn); b.setAttribute('aria-selected', b===btn); });
    $$('.tab-panel').forEach(p=>{ p.classList.toggle('active', p.id===btn.dataset.tab); p.setAttribute('aria-hidden', p.id!==btn.dataset.tab); });
  });
});

/* Summary */
function updateSummary() {
  const total = state.products.length;
  const need = state.products.filter(p => (p.count ?? 0) < (p.max ?? 0)).length;
  $('#summary').textContent = `${total} produtos • ${need} com reposição`;
}

/* Products rendering */
function renderProducts(filter='') {
  const tbody = $('#productsTable');
  tbody.innerHTML = '';
  const q = filter.trim().toLowerCase();
  const selectedCat = $('#filterCategory') ? $('#filterCategory').value : '';

  // Group products by category
  const groups = new Map();
  state.products
    .filter(p => (!q || p.name.toLowerCase().includes(q)) && (!selectedCat || (p.category || 'Sem categoria') === selectedCat))
    .forEach(p=>{
      const cat = p.category || 'Sem categoria';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(p);
    });

  // Sort categories and products
  const categories = Array.from(groups.keys()).sort((a,b)=>a.localeCompare(b));
  categories.forEach(cat=>{
    const items = groups.get(cat).sort((a,b)=>a.name.localeCompare(b.name));

    // Skip empty groups (in case of filter)
    if (!items.length) return;

    // Category header row
    const catTr = document.createElement('tr');
    catTr.className = 'cat-row';
    catTr.innerHTML = `<td colspan="4">${cat}</td>`;
    tbody.appendChild(catTr);

    // Render products for this category
    items.forEach(p=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="name">${p.name}</span></td>
        <td><span class="max">${p.max}</span></td>
        <td>${p.count ?? 0} ${p.countedAt ? `<span class="muted">(${new Intl.DateTimeFormat('pt-BR',{dateStyle:'short'}).format(p.countedAt)})</span>`:''}</td>
        <td>
          <div class="row-actions">
            <button class="ghost small edit" aria-label="Editar">Editar</button>
            <button class="ghost small del" aria-label="Excluir">Excluir</button>
          </div>
        </td>
      `;
      // edit handlers
      tr.querySelector('.edit').addEventListener('click', ()=>{
        if (tr.classList.contains('editing')) return;
        tr.classList.add('editing');
        tr.children[0].innerHTML = `<input type="text" value="${p.name}">`;
        tr.children[1].innerHTML = `<input type="number" min="0" step="1" value="${p.max}">`;
        tr.children[3].innerHTML = `
          <div class="row-actions">
            <button class="primary small save">Salvar</button>
            <button class="ghost small cancel">Cancelar</button>
          </div>
        `;
        tr.querySelector('.save').addEventListener('click', ()=>{
          const n = tr.children[0].querySelector('input').value.trim();
          const m = parseInt(tr.children[1].querySelector('input').value,10);
          if (!n || isNaN(m) || m<0) return;
          p.name=n; p.max=m;
          state = save(state);
          renderProducts($('#searchProducts').value);
          renderCount($('#searchCount').value);
          renderReport();
          updateSummary();
        });
        tr.querySelector('.cancel').addEventListener('click', ()=>renderProducts($('#searchProducts').value));
      });
      tr.querySelector('.del').addEventListener('click', ()=>{
        if (!confirm('Excluir este produto?')) return;
        state.products = state.products.filter(x=>x.id!==p.id);
        state = save(state);
        renderProducts($('#searchProducts').value);
        renderCount($('#searchCount').value);
        renderReport();
        updateSummary();
      });
      tbody.appendChild(tr);
    });
  });
}

/* Product form */
$('#product-form').addEventListener('submit', (e)=>{
  e.preventDefault();
  const name = $('#pName').value.trim();
  const max = parseInt($('#pMax').value,10);
  const category = $('#pCategory').value;
  if (!name || isNaN(max) || max<0 || !category) return;
  state.products.push({ id: uid(), name, max, count: 0, countedAt: null, category });
  state = save(state);
  e.target.reset();
  renderProducts($('#searchProducts').value);
  renderCount($('#searchCount').value);
  renderReport();
  updateSummary();
});
$('#searchProducts').addEventListener('input', e=>renderProducts(e.target.value));
$('#filterCategory')?.addEventListener('change', ()=>renderProducts($('#searchProducts').value));

// Set and persist collaborator name
const ownerInput = $('#orderOwner');
if (ownerInput) {
  ownerInput.value = state.orderOwner || '';
  ownerInput.addEventListener('input', (e)=>{
    state.orderOwner = e.target.value.trim();
    state = save(state);
    renderReport();
  });
}

/* Count rendering */
function renderCount(filter='') {
  const tbody = $('#countTable');
  tbody.innerHTML = '';
  const q = filter.trim().toLowerCase();
  state.products
    .filter(p => !q || p.name.toLowerCase().includes(q))
    .sort((a,b)=>a.name.localeCompare(b.name))
    .forEach(p=>{
      const tr = document.createElement('tr');
      const real = p.count ?? 0;
      const diff = real - (p.max ?? 0);
      tr.innerHTML = `
        <td>${p.name}</td>
        <td>${p.max}</td>
        <td><input class="qty-input" type="number" min="0" step="1" value="${real}" data-id="${p.id}"></td>
        <td><span class="${diff<0?'badge':''}">${diff}</span></td>
      `;
      const input = tr.querySelector('input');
      input.addEventListener('input', ()=>{
        const v = parseInt(input.value||'0',10);
        const d = (isNaN(v)?0:v) - p.max;
        tr.querySelector('td:last-child').innerHTML = `<span class="${d<0?'badge':''}">${d}</span>`;
      });
      tbody.appendChild(tr);
    });
}
$('#searchCount').addEventListener('input', e=>renderCount(e.target.value));

$('#saveAllCounts').addEventListener('click', ()=>{
  const inputs = $$('#countTable input[type="number"]');
  inputs.forEach(inp=>{
    const id = inp.dataset.id;
    const p = state.products.find(x=>x.id===id);
    if (!p) return;
    const v = parseInt(inp.value||'0',10);
    p.count = isNaN(v)?0:v;
    p.countedAt = Date.now();
  });
  state = save(state);
  renderProducts($('#searchProducts').value);
  renderReport();
  updateSummary();
  alert('Contagens salvas.');
});

/* Report generation */
function computeReport() {
  const items = state.products
    .map(p=>({ ...p, toBuy: Math.max(0, (p.max ?? 0) - (p.count ?? 0)) }))
    .filter(p=>p.toBuy>0)
    .sort((a,b)=>a.name.localeCompare(b.name));
  return items;
}

function renderReport() {
  const tbody = $('#reportTable');
  const empty = $('#reportEmpty');
  const items = computeReport();
  tbody.innerHTML = '';
  // Owner line on-screen
  const ownerLine = $('#reportOwnerLine');
  if (ownerLine) {
    ownerLine.textContent = state.orderOwner ? `Colaborador: ${state.orderOwner}` : '';
  }
  if (!items.length) {
    empty.style.display = 'block';
    $('#reportList').style.display = 'none';
  } else {
    empty.style.display = 'none';
    $('#reportList').style.display = 'block';
    const groups = new Map();
    items.forEach(p => {
      const cat = p.category || 'Sem categoria';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(p);
    });
    Array.from(groups.keys()).sort((a,b)=>a.localeCompare(b)).forEach(cat=>{
      const catTr = document.createElement('tr');
      catTr.className = 'cat-row';
      catTr.innerHTML = `<td colspan="3">${cat}</td>`;
      tbody.appendChild(catTr);
      groups.get(cat).sort((a,b)=>a.name.localeCompare(b.name)).forEach(p=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${p.name}</td><td>${p.count ?? 0}</td><td>${p.toBuy}</td>`;
        tbody.appendChild(tr);
      });
    });
  }
  buildReceipt(items);
  buildShare(items);
}

function buildReceipt(items) {
  $('#receiptStore').textContent = 'DISTRIBUIDORA THS';
  $('#receiptDate').textContent = `RELATÓRIO DE PEDIDO   DATA: ${fmtDate()}`;
  const owner = state.orderOwner?.trim();
  const ownerEl = $('#receiptOwner');
  ownerEl.textContent = owner ? `Colaborador: ${owner}` : '';
  const body = $('#receiptBody');
  body.innerHTML = '';
  if (!items.length) {
    body.innerHTML = '<div class="line"><span>Sem itens para repor</span></div>';
    return;
  }
  const groups = new Map();
  items.forEach(p=>{
    const cat = p.category || 'Sem categoria';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(p);
  });
  Array.from(groups.keys()).sort((a,b)=>a.localeCompare(b)).forEach(cat=>{
    const head = document.createElement('div');
    head.className = 'line category';
    head.innerHTML = `<span>${cat}</span><span></span>`;
    body.appendChild(head);
    groups.get(cat).sort((a,b)=>a.name.localeCompare(b.name)).forEach(p=>{
      const line = document.createElement('div');
      line.className = 'line';
      line.innerHTML = `<span>${p.name}</span><span>${p.toBuy}</span>`;
      body.appendChild(line);
    });
  });
  const total = items.reduce((a,b)=>a+b.toBuy,0);
  const totalEl = document.createElement('div');
  totalEl.className = 'total';
  totalEl.textContent = `Total itens a comprar: ${total}`;
  body.appendChild(totalEl);
}

function buildShare(items) {
  const header1 = '*DISTRIBUIDORA THS*';
  const header2 = `*RELATÓRIO DE PEDIDO   DATA:${fmtDate()}*`;
  const owner = state.orderOwner?.trim();
  let text = `${header1}\n${header2}\n${owner ? `Colaborador: ${owner}\n` : ''}-------------------------\n`;
  if (!items.length) text += 'Sem itens para repor.\n';
  else {
    const groups = new Map();
    items.forEach(p=>{
      const cat = p.category || 'Sem categoria';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(p);
    });
    Array.from(groups.keys()).sort((a,b)=>a.localeCompare(b)).forEach(cat=>{
      text += `\n*${cat}*\n`;
      groups.get(cat).sort((a,b)=>a.name.localeCompare(b.name)).forEach(p=>{
        text += `• ${p.name} – comprar *${p.toBuy}*\n`;
      });
    });
    const total = items.reduce((a,b)=>a+b.toBuy,0);
    text += `-------------------------\nTotal a comprar: ${total}\n`;
  }
  const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const wa = $('#waShare');
  wa.href = waUrl;
  wa.textContent = 'Enviar por WhatsApp';
  $('#copyReport').onclick = async ()=>{
    try { await navigator.clipboard.writeText(text); alert('Relatório copiado.'); }
    catch { alert('Não foi possível copiar.'); }
  };
  $('#printReport').onclick = ()=>window.print();
}

$('#refreshReport').addEventListener('click', renderReport);

/* Backup/Restore */
$('#backupBtn').addEventListener('click', exportBackup);
$('#restoreBtn').addEventListener('click', ()=>$('#restoreFile').click());
$('#restoreFile').addEventListener('change', async (e)=>{
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    await importBackup(file);
    state = load();
    renderProducts($('#searchProducts').value);
    renderCount($('#searchCount').value);
    renderReport();
    updateSummary();
    alert('Dados restaurados com sucesso.');
  } catch (err) {
    alert('Falha ao restaurar: ' + err.message);
  } finally {
    e.target.value = '';
  }
});

/* Init demo (optional empty state) */
function ensureSeed() {
  if (state.products.length) return;
  state.products = [
    { id: uid(), name: 'Água 500ml', sku: '7890000000001', max: 120, count: 80, countedAt: Date.now(), category: 'Água Mineral' },
    { id: uid(), name: 'Refrigerante 2L', sku: '7890000000002', max: 60, count: 45, countedAt: Date.now(), category: 'Refrigerante' },
    { id: uid(), name: 'Cerveja Lata', sku: '7890000000003', max: 300, count: 280, countedAt: Date.now(), category: 'Cerveja' }
  ];
  state = save(state);
}

ensureSeed();
renderProducts();
renderCount();
renderReport();
updateSummary();