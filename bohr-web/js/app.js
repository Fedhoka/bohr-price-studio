// ─── CONSTANTS ────────────────────────────────────────────
const DEFAULT_BEER_STYLES = [
    'PILSEN', 'SCOTTISH', 'HONEY', 'DRY STOUT', 'JAMMIN IPA',
    'SESSION IPA', 'COCO AMBER ALE', 'SOUR', 'BARLEY WINE',
    'DOBLE JAMMIN IPA', 'CAIPI LAGER'
];

const DEFAULT_IMAGES = {
    barriles: {
        'Mayorista': 'assets/backgrounds/1.jpg',
        'Minorista': 'assets/backgrounds/2.jpg',
        'Amigos':    'assets/backgrounds/3.jpg'
    },
    latas: {
        'Mayorista': 'assets/backgrounds/4.jpg',
        'Minorista': 'assets/backgrounds/5.jpg',
        'Amigos':    'assets/backgrounds/6.jpg'
    }
};

// ─── STATE ────────────────────────────────────────────────
let state = {
    listTypes: ['Mayorista', 'Minorista', 'Distribuidores', 'Amigos'],
    products: [],
    history: [],
    defaultsLoaded: false,
    settings: {
        footerText: 'CONTACTO / REDES SOCIALES',
        customImages: {}
    }
};

let currentLine     = 'barriles';
let currentListType = 'Mayorista';
let increaseType    = 'percent';

// ─── DEFAULTS ─────────────────────────────────────────────
function initDefaultProducts() {
    const formats = { barriles: 'Barril 50L', latas: 'Lata 473cc' };
    ['barriles', 'latas'].forEach(line => {
        state.listTypes.forEach(listType => {
            DEFAULT_BEER_STYLES.forEach((name, idx) => {
                state.products.push({
                    id: `default_${line}_${listType}_${idx}`,
                    line, listType, name,
                    format: formats[line],
                    price: 0, abv: '', ibu: '', description: ''
                });
            });
        });
    });
}

// ─── PERSIST ─────────────────────────────────────────────
async function loadState() {
    let raw = null;
    if (window.pywebview && window.pywebview.api) {
        try { raw = await window.pywebview.api.load_data(); } catch(e) {}
    }
    if (!raw) raw = localStorage.getItem('bohr_v2');

    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            state = { ...state, ...parsed };
            if (!state.listTypes?.length) state.listTypes = ['Mayorista', 'Minorista', 'Distribuidores', 'Amigos'];
            if (!state.settings) state.settings = { footerText: 'CONTACTO / REDES SOCIALES', customImages: {} };
            if (!state.settings.customImages) state.settings.customImages = {};
            if (!state.history) state.history = [];
        } catch(e) { console.warn('State parse error', e); }
    }

    if (!state.defaultsLoaded) {
        initDefaultProducts();
        state.defaultsLoaded = true;
        await saveState();
    }

    currentListType = state.listTypes[0] || 'Mayorista';
}

async function saveState() {
    const json = JSON.stringify(state);
    if (window.pywebview && window.pywebview.api) {
        try { await window.pywebview.api.save_data(json); } catch(e) {}
    }
    try {
        localStorage.setItem('bohr_v2', json);
    } catch(e) {
        try {
            const slim = { ...state, settings: { ...state.settings, customImages: {} } };
            localStorage.setItem('bohr_v2', JSON.stringify(slim));
            showToast('⚠️ Espacio lleno: imágenes no guardadas');
        } catch(e2) { console.error('Cannot save state:', e2); }
    }
}

// ─── INIT ─────────────────────────────────────────────────
async function init() {
    if (window.location.protocol === 'file:') {
        await new Promise(resolve => {
            if (window.pywebview) { resolve(); return; }
            window.addEventListener('pywebviewready', resolve, { once: true });
            setTimeout(resolve, 600);
        });
    }
    await loadState();
    setupEvents();
    renderSidebar();
    renderAll();
}

function setupEvents() {
    document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-item[data-view]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentLine = btn.dataset.view;
            renderAll();
        });
    });

    document.getElementById('btnAddProduct').onclick   = () => openProductModal();
    document.getElementById('btnAddListType').onclick  = () => {
        document.getElementById('fListName').value = '';
        document.getElementById('modalListType').classList.remove('hidden');
        setTimeout(() => document.getElementById('fListName').focus(), 50);
    };
    document.getElementById('btnSettings').onclick    = () => {
        document.getElementById('fFooter').value = state.settings.footerText || '';
        document.getElementById('modalSettings').classList.remove('hidden');
    };
    document.getElementById('btnHistory').onclick      = openHistoryModal;
    document.getElementById('btnSaveSnapshot').onclick = saveSnapshot;
    document.getElementById('btnGenerate').onclick     = generateJpg;
    document.getElementById('btnIncrease').onclick     = openIncreaseModal;

    document.getElementById('previewImageInput').onchange = function() {
        if (this.files && this.files[0]) {
            processImage(this.files[0], base64 => {
                if (!state.settings.customImages[currentListType])
                    state.settings.customImages[currentListType] = {};
                state.settings.customImages[currentListType][currentLine] = base64;
                saveState();
                this.value = '';
                renderAll();
            });
        }
    };

    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.addEventListener('click', e => { if (e.target === m) closeAllModals(); });
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });
}

// ─── RENDER ───────────────────────────────────────────────
function renderAll() {
    renderTopbar();
    renderProducts();
    renderPreview();
    renderHistory();
    renderImageStatus();
}

function renderTopbar() {
    document.getElementById('titleLine').textContent = currentLine === 'barriles' ? 'Barriles' : 'Latas';
    document.getElementById('titleList').textContent = currentListType;
    const all    = getFiltered();
    const priced = all.filter(p => p.price > 0);
    document.getElementById('pageSubCount').textContent =
        `${all.length} estilos · ${priced.length} con precio`;
}

function renderSidebar() {
    const container = document.getElementById('listTypesNav');
    container.innerHTML = '';
    state.listTypes.forEach(type => {
        const btn = document.createElement('button');
        btn.className = `nav-item ${type === currentListType ? 'active' : ''}`;
        btn.innerHTML = `${window.getIconSVG('fa-list-ul')} ${type}`;
        if (state.listTypes.length > 1) {
            const del = document.createElement('span');
            del.className = 'del-list';
            del.innerHTML = '&times;';
            del.title = 'Eliminar lista';
            del.onclick = e => {
                e.stopPropagation();
                if (confirm(`¿Eliminar "${type}" y todos sus productos?`)) deleteListType(type);
            };
            btn.appendChild(del);
        }
        btn.onclick = () => { currentListType = type; renderSidebar(); renderAll(); };
        container.appendChild(btn);
    });
}

function renderProducts() {
    const tbody    = document.getElementById('productsTbody');
    const empty    = document.getElementById('emptyState');
    const table    = document.getElementById('productsTable');
    const filtered = getFiltered();

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        empty.classList.remove('hidden');
        table.style.display = 'none';
    } else {
        empty.classList.add('hidden');
        table.style.display = '';
        filtered.forEach(p => {
            const tr = document.createElement('tr');
            const priceDisplay = p.price > 0
                ? `<span class="td-price">$${Number(p.price).toLocaleString('es-AR')}</span>`
                : `<span style="color:var(--text-3);font-size:0.82rem;font-style:italic;">Sin precio</span>`;
            tr.innerHTML = `
                <td>
                    <div class="td-name">${p.name}</div>
                    ${p.description ? `<div style="font-size:0.75rem;color:var(--text-3);margin-top:2px;">${p.description}</div>` : ''}
                </td>
                <td>${p.format}</td>
                <td><span class="tag">${p.abv || '—'}</span></td>
                <td><span class="tag">${p.ibu || '—'}</span></td>
                <td>${priceDisplay}</td>
                <td class="td-actions">
                    <div class="row-actions">
                        <button class="btn-row" onclick="editProduct('${p.id}')" title="Editar">${window.getIconSVG('fa-pen')}</button>
                        <button class="btn-row del" onclick="deleteProduct('${p.id}')" title="Eliminar">${window.getIconSVG('fa-trash')}</button>
                    </div>
                </td>`;
            tbody.appendChild(tr);
        });
    }
}

function renderPreview() {
    const filtered = getFiltered().filter(p => p.price > 0);
    const img      = getCurrentImage();

    const bgEl    = document.getElementById('previewBgImg');
    const overlay = document.getElementById('previewOverlay');
    const inner   = document.getElementById('previewInner');

    if (img) {
        bgEl.src = img;
        bgEl.style.display = '';
        overlay.style.display = '';
        inner.style.background = 'transparent';
    } else {
        bgEl.style.display = 'none';
        overlay.style.display = 'none';
        inner.style.background = currentLine === 'barriles' ? '#ffd85e' : '#f2a99d';
    }

    const logoImg = document.getElementById('pvLogoImg');
    const badgeEl = document.getElementById('pvBadge');
    if (img) {
        if (logoImg) logoImg.style.filter = 'none';
        badgeEl.style.color = 'white';
        badgeEl.style.background = 'rgba(0,0,0,0.3)';
        badgeEl.style.borderColor = 'rgba(255,255,255,0.2)';
    } else {
        if (logoImg) logoImg.style.filter = 'brightness(0)';
        badgeEl.style.color = '#333';
        badgeEl.style.background = 'rgba(0,0,0,0.1)';
        badgeEl.style.borderColor = 'rgba(0,0,0,0.15)';
    }
    badgeEl.textContent = currentListType.toUpperCase();

    const box = document.getElementById('pvPricesBox');
    if (filtered.length === 0) {
        box.innerHTML = '<div class="preview-empty-msg">Cargá precios para ver la preview</div>';
    } else {
        box.innerHTML = filtered.map(p => `
            <div class="preview-price-row">
                <div>
                    <span class="preview-price-name">${p.name}</span>
                    <span class="preview-price-fmt">${p.format}</span>
                </div>
                <span class="preview-price-val">$${Number(p.price).toLocaleString('es-AR')}</span>
            </div>`).join('');
    }
}

function renderImageStatus() {
    const custom     = state.settings.customImages[currentListType]?.[currentLine];
    const hasDefault = !!(DEFAULT_IMAGES[currentLine]?.[currentListType]);
    const zone       = document.getElementById('uploadZone');
    const status     = document.getElementById('imageStatus');
    const statusText = document.getElementById('imageStatusText');

    if (custom) {
        zone.style.display = 'none';
        status.classList.remove('hidden');
        if (statusText) statusText.textContent = 'Imagen personalizada activa';
    } else if (hasDefault) {
        zone.style.display = 'none';
        status.classList.remove('hidden');
        if (statusText) statusText.textContent = 'Imagen predeterminada activa';
    } else {
        zone.style.display = '';
        status.classList.add('hidden');
    }
}

function renderHistory() {
    const relevant = state.history
        .filter(h => h.line === currentLine && h.listType === currentListType)
        .sort((a, b) => b.date - a.date).slice(0, 5);

    const container = document.getElementById('historyList');
    if (relevant.length === 0) {
        container.innerHTML = '<div style="font-size:0.8rem; color:var(--text-3); padding:10px 0;">Sin versiones. Guardá antes de cambiar precios.</div>';
        return;
    }
    container.innerHTML = relevant.map(h => `
        <div class="history-item">
            <div>
                <div class="history-name">${h.label}</div>
                <div class="history-meta">${formatDate(h.date)}</div>
            </div>
            <span class="badge-count">${h.products.length} prod.</span>
        </div>`).join('');
}

// ─── PRODUCTS CRUD ────────────────────────────────────────
function openProductModal(id) {
    const modal   = document.getElementById('modalProduct');
    const editing = id ? state.products.find(p => p.id === id) : null;

    document.getElementById('modalProductTitle').textContent = editing ? 'Editar Producto' : 'Nuevo Producto';
    document.getElementById('fId').value     = editing ? editing.id : '';
    document.getElementById('fName').value   = editing ? editing.name : '';
    document.getElementById('fFormat').value = editing ? editing.format : (currentLine === 'barriles' ? 'Barril 50L' : 'Lata 473cc');
    document.getElementById('fPrice').value  = editing && editing.price > 0 ? editing.price : '';
    document.getElementById('fAbv').value    = editing ? (editing.abv || '') : '';
    document.getElementById('fIbu').value    = editing ? (editing.ibu || '') : '';
    document.getElementById('fDesc').value   = editing ? (editing.description || '') : '';

    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('fPrice').focus(), 50);
}

function submitProduct() {
    const id     = document.getElementById('fId').value || Date.now().toString();
    const name   = document.getElementById('fName').value.trim();
    const format = document.getElementById('fFormat').value.trim();
    const price  = parseFloat(document.getElementById('fPrice').value) || 0;
    const abv    = document.getElementById('fAbv').value.trim();
    const ibu    = document.getElementById('fIbu').value.trim();
    const desc   = document.getElementById('fDesc').value.trim();

    if (!name || !format) { alert('Completá al menos Nombre y Formato.'); return; }

    const existing = state.products.findIndex(p => p.id === id);
    const product  = { id, line: currentLine, listType: currentListType, name, format, price, abv, ibu, description: desc };

    if (existing > -1) state.products[existing] = product;
    else state.products.push(product);

    saveState();
    closeAllModals();
    renderAll();
}

window.editProduct   = id => openProductModal(id);
window.deleteProduct = id => {
    if (confirm('¿Eliminar este estilo de la lista?')) {
        state.products = state.products.filter(p => p.id !== id);
        saveState();
        renderAll();
    }
};

// ─── LIST TYPES ───────────────────────────────────────────
function submitListType() {
    const name = document.getElementById('fListName').value.trim();
    if (!name) return;
    if (state.listTypes.includes(name)) { alert('Ya existe una lista con ese nombre.'); return; }

    state.listTypes.push(name);
    const formats = { barriles: 'Barril 50L', latas: 'Lata 473cc' };
    ['barriles', 'latas'].forEach(line => {
        DEFAULT_BEER_STYLES.forEach((styleName, idx) => {
            state.products.push({
                id: `${line}_${name}_${idx}_${Date.now()}`,
                line, listType: name, name: styleName,
                format: formats[line],
                price: 0, abv: '', ibu: '', description: ''
            });
        });
    });

    currentListType = name;
    saveState();
    closeAllModals();
    renderSidebar();
    renderAll();
}

function deleteListType(type) {
    state.listTypes = state.listTypes.filter(t => t !== type);
    state.products  = state.products.filter(p => p.listType !== type);
    state.history   = state.history.filter(h => h.listType !== type);
    delete state.settings.customImages[type];
    currentListType = state.listTypes[0] || '';
    saveState();
    renderSidebar();
    renderAll();
}

// ─── SETTINGS ─────────────────────────────────────────────
function saveSettings() {
    state.settings.footerText = document.getElementById('fFooter').value;
    saveState();
    closeAllModals();
}

// ─── HISTORY ──────────────────────────────────────────────
function saveSnapshot() {
    const filtered = getFiltered().filter(p => p.price > 0);
    if (filtered.length === 0) { alert('No hay precios en esta lista para guardar.'); return; }

    const label = `${currentLine === 'barriles' ? 'Barriles' : 'Latas'} · ${currentListType}`;
    const snap  = {
        id: Date.now().toString(), date: Date.now(),
        line: currentLine, listType: currentListType, label,
        products: JSON.parse(JSON.stringify(filtered))
    };
    state.history.unshift(snap);
    if (state.history.length > 50) state.history = state.history.slice(0, 50);
    saveState();
    renderAll();
    showToast('✓ Versión guardada');
}

function openHistoryModal() {
    const container = document.getElementById('historyModalList');
    const all       = [...state.history].sort((a, b) => b.date - a.date);

    container.innerHTML = all.length === 0
        ? '<div style="color:var(--text-3);font-size:0.85rem;padding:20px;text-align:center;">Sin versiones guardadas todavía.</div>'
        : all.map(h => `
            <div class="history-modal-item">
                <div>
                    <div style="font-weight:600;font-size:0.9rem;">${h.label}</div>
                    <div class="history-modal-meta">${formatDate(h.date)} · ${h.products.length} productos</div>
                    <div style="font-size:0.75rem;color:var(--text-3);margin-top:6px;">
                        ${h.products.map(p => `${p.name} <strong style="color:var(--amber);">$${Number(p.price).toLocaleString('es-AR')}</strong>`).join(' · ')}
                    </div>
                </div>
                <button class="btn btn-ghost" style="font-size:0.75rem;white-space:nowrap;" onclick="restoreSnapshot('${h.id}')">
                    ${window.getIconSVG('fa-rotate-left')} Restaurar
                </button>
            </div>`).join('');

    document.getElementById('modalHistory').classList.remove('hidden');
}

window.restoreSnapshot = function(id) {
    const snap = state.history.find(h => h.id === id);
    if (!snap || !confirm(`¿Restaurar precios del ${formatDate(snap.date)}?`)) return;

    snap.products.forEach(sp => {
        const idx = state.products.findIndex(p =>
            p.name === sp.name && p.line === sp.line && p.listType === sp.listType);
        if (idx > -1) state.products[idx].price = sp.price;
        else state.products.push({ ...sp });
    });

    currentLine     = snap.line;
    currentListType = snap.listType;
    saveState();
    closeAllModals();
    renderSidebar();
    document.querySelectorAll('.nav-item[data-view]').forEach(b => {
        b.classList.toggle('active', b.dataset.view === currentLine);
    });
    renderAll();
    showToast('✓ Versión restaurada');
};

// ─── PRICE INCREASE ───────────────────────────────────────
function roundUpTo50(value) {
    return Math.ceil(value / 50) * 50;
}

function setIncreaseType(type) {
    increaseType = type;
    document.getElementById('increaseLabel').textContent =
        type === 'percent' ? 'Porcentaje de aumento (%)' : 'Monto fijo a agregar ($)';
    document.getElementById('btnTogglePercent').className =
        `btn ${type === 'percent' ? 'btn-primary' : 'btn-secondary'}`;
    document.getElementById('btnToggleFixed').className =
        `btn ${type === 'fixed' ? 'btn-primary' : 'btn-secondary'}`;
    updateIncreasePreview();
}

function getProductsForScope() {
    const scope = document.getElementById('fIncreaseScope').value;
    if (scope === 'current') return getFiltered().filter(p => p.price > 0);
    if (scope === 'line')    return state.products.filter(p => p.line === currentLine && p.price > 0);
    return state.products.filter(p => p.price > 0);
}

function calcNewPrice(oldPrice, val) {
    if (!oldPrice || oldPrice <= 0) return 0;
    const raw = increaseType === 'percent'
        ? oldPrice * (1 + val / 100)
        : oldPrice + val;
    return roundUpTo50(raw);
}

function updateIncreasePreview() {
    const val     = parseFloat(document.getElementById('fIncreaseValue').value);
    const preview = document.getElementById('increasePreview');
    const prods   = getProductsForScope();

    if (!val || val <= 0 || prods.length === 0) {
        preview.innerHTML = `<div style="color:var(--text-3);font-size:0.8rem;text-align:center;padding:16px;">Ingresá un valor para ver la previsualización</div>`;
        return;
    }

    const rows = prods.slice(0, 12).map(p => {
        const np = calcNewPrice(p.price, val);
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.8rem;">
            <span style="color:var(--text-2);">${p.name}</span>
            <span>
                <span style="color:var(--text-3);text-decoration:line-through;margin-right:8px;">$${Number(p.price).toLocaleString('es-AR')}</span>
                <span style="color:var(--green);font-weight:700;">$${Number(np).toLocaleString('es-AR')}</span>
            </span>
        </div>`;
    }).join('');

    const extra = prods.length > 12
        ? `<div style="color:var(--text-3);font-size:0.75rem;text-align:center;padding:6px;">+ ${prods.length - 12} más</div>`
        : '';

    preview.innerHTML = rows + extra;
}

function openIncreaseModal() {
    const lineLabel = currentLine === 'barriles' ? 'Barriles' : 'Latas';
    document.getElementById('fIncreaseScope').innerHTML = `
        <option value="current">Esta lista — ${lineLabel} · ${currentListType}</option>
        <option value="line">Toda la línea — ${lineLabel}</option>
        <option value="all">Todas las listas</option>`;
    document.getElementById('fIncreaseValue').value = '';
    document.getElementById('increasePreview').innerHTML =
        `<div style="color:var(--text-3);font-size:0.8rem;text-align:center;padding:16px;">Ingresá un valor para ver la previsualización</div>`;
    setIncreaseType('percent');
    document.getElementById('modalIncrease').classList.remove('hidden');
    setTimeout(() => document.getElementById('fIncreaseValue').focus(), 50);
}

async function confirmIncrease() {
    const val = parseFloat(document.getElementById('fIncreaseValue').value);
    if (!val || val <= 0) { alert('Ingresá un valor mayor a 0.'); return; }

    const prods = getProductsForScope();
    if (prods.length === 0) { alert('No hay precios para actualizar en el alcance seleccionado.'); return; }

    prods.forEach(p => {
        const idx = state.products.findIndex(x => x.id === p.id);
        if (idx > -1) state.products[idx].price = calcNewPrice(p.price, val);
    });

    await saveState();
    closeAllModals();
    renderAll();
    showToast(`✓ ${prods.length} precios actualizados`);
}

// ─── IMAGES ───────────────────────────────────────────────
function getCurrentImage() {
    const custom = state.settings.customImages[currentListType]?.[currentLine];
    if (custom) return custom;
    return DEFAULT_IMAGES[currentLine]?.[currentListType] || '';
}

window.clearCurrentImage = function() {
    if (state.settings.customImages[currentListType]) {
        state.settings.customImages[currentListType][currentLine] = '';
    }
    saveState();
    renderAll();
};

function processImage(file, cb) {
    const reader = new FileReader();
    reader.onload = e => {
        const img = new Image();
        img.onload = () => {
            const TARGET_W = 1080, TARGET_H = 1920;
            const canvas   = document.createElement('canvas');
            canvas.width   = TARGET_W;
            canvas.height  = TARGET_H;
            const ctx      = canvas.getContext('2d');
            const scale    = Math.max(TARGET_W / img.width, TARGET_H / img.height);
            const drawW    = img.width  * scale;
            const drawH    = img.height * scale;
            ctx.drawImage(img, (TARGET_W - drawW) / 2, (TARGET_H - drawH) / 2, drawW, drawH);
            cb(canvas.toDataURL('image/jpeg', 0.88));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ─── EXPORT ───────────────────────────────────────────────
async function generateJpg() {
    const filtered = getFiltered().filter(p => p.price > 0);
    if (filtered.length === 0) { alert('No hay precios cargados para exportar.'); return; }

    const wrap    = document.getElementById('exportWrap');
    const canvas  = document.getElementById('exportCanvas');
    const imgSrc  = getCurrentImage();
    const solidBg = currentLine === 'barriles' ? '#ffd85e' : '#f2a99d';

    canvas.style.backgroundColor = solidBg;

    const ecBg      = document.getElementById('ecBgImg');
    const ecOverlay = document.querySelector('#exportCanvas .ec-overlay');

    if (imgSrc) {
        ecBg.crossOrigin = 'anonymous';
        ecBg.src = imgSrc;
        ecBg.style.display = '';
        if (ecOverlay) ecOverlay.style.display = '';
    } else {
        ecBg.src = '';
        ecBg.style.display = 'none';
        if (ecOverlay) ecOverlay.style.display = 'none';
    }

    document.getElementById('ecListBadge').textContent = currentListType.toUpperCase();
    document.getElementById('ecLineLabel').textContent  = currentLine === 'barriles' ? 'BARRIL' : 'LATA';

    const logoImg  = document.getElementById('ecLogoImg');
    const lineEl   = document.getElementById('ecLineLabel');
    const badgeEl  = document.getElementById('ecListBadge');
    const footerEl = document.getElementById('ecFooter');

    if (imgSrc) {
        if (logoImg)  logoImg.style.filter  = 'none';
        if (lineEl)   lineEl.style.color    = 'rgba(255,255,255,0.75)';
        if (badgeEl)  { badgeEl.style.color = 'white'; badgeEl.style.background = 'rgba(255,255,255,0.15)'; badgeEl.style.borderColor = 'rgba(255,255,255,0.3)'; }
        if (footerEl) footerEl.style.color  = 'rgba(255,255,255,0.7)';
    } else {
        if (logoImg)  logoImg.style.filter  = 'brightness(0)';
        if (lineEl)   lineEl.style.color    = '#666666';
        if (badgeEl)  { badgeEl.style.color = '#222'; badgeEl.style.background = 'rgba(0,0,0,0.10)'; badgeEl.style.borderColor = 'rgba(0,0,0,0.12)'; }
        if (footerEl) footerEl.style.color  = '#555555';
    }
    if (footerEl) footerEl.textContent = state.settings.footerText || '';

    document.getElementById('ecPrices').innerHTML = filtered.map(p => `
        <div class="ec-price-row">
            <div>
                <span class="ec-price-name">${p.name}</span>
                ${p.format ? `<span class="ec-price-extras">${p.format}</span>` : ''}
                ${p.abv    ? `<span class="ec-price-extras">${p.abv}</span>`    : ''}
            </div>
            <span class="ec-price-val">$${Number(p.price).toLocaleString('es-AR')}</span>
        </div>`).join('');

    wrap.style.left    = '0';
    wrap.style.top     = '0';
    wrap.style.opacity = '1';
    wrap.style.zIndex  = '-9999';

    const filename = `Lista_Bohr_${currentLine}_${currentListType}_${new Date().toLocaleDateString('es-AR').replace(/\//g,'-')}.jpg`;

    const doCapture = () => {
        html2canvas(canvas, { scale: 2, useCORS: true, allowTaint: true, logging: false }).then(c => {
            wrap.style.left    = '-9999px';
            wrap.style.opacity = '0';
            const dataUrl = c.toDataURL('image/jpeg', 0.92);
            if (window.pywebview && window.pywebview.api) {
                window.pywebview.api.save_image(dataUrl, filename)
                    .then(ok => { if (ok) showToast('✓ Imagen guardada'); });
            } else {
                const a = document.createElement('a');
                a.download = filename;
                a.href = dataUrl;
                a.click();
                showToast('✓ JPG descargado');
            }
        });
    };

    if (imgSrc && !imgSrc.startsWith('data:')) {
        if (ecBg.complete && ecBg.naturalWidth > 0) setTimeout(doCapture, 150);
        else { ecBg.onload = () => setTimeout(doCapture, 150); ecBg.onerror = () => setTimeout(doCapture, 150); }
    } else {
        setTimeout(doCapture, 100);
    }
}

// ─── MODALS ───────────────────────────────────────────────
window.closeAllModals = function() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
};

// ─── HELPERS ──────────────────────────────────────────────
function getFiltered() {
    return state.products.filter(p => p.line === currentLine && p.listType === currentListType);
}

function formatDate(ts) {
    return new Date(ts).toLocaleString('es-AR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function showToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
        position: 'fixed', bottom: '28px', right: '28px',
        background: '#3ecf8e', color: '#0d0f14',
        padding: '12px 20px', borderRadius: '8px',
        fontWeight: '600', fontSize: '0.88rem',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        zIndex: '9999', animation: 'fadeInUp 0.3s ease'
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

const _style = document.createElement('style');
_style.textContent = '@keyframes fadeInUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }';
document.head.appendChild(_style);

window.addEventListener('DOMContentLoaded', init);
