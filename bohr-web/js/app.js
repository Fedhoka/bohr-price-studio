// ─── CONSTANTS ────────────────────────────────────────────
const DEFAULT_BEER_STYLES = [
    { name: 'PILSEN',             desc: '' },
    { name: 'SCOTTISH',           desc: '' },
    { name: 'HONEY 🍯',           desc: '' },
    { name: 'DRY STOUT',          desc: '' },
    { name: 'JAMMIN IPA',         desc: '' },
    { name: 'SESSION IPA',        desc: '' },
    { name: 'COCO AMBER ALE 🥥',  desc: '' },
    { name: 'SOUR',               desc: '' },
    { name: 'BARLEY WINE',        desc: '' },
    { name: 'DOBLE JAMMIN IPA',   desc: '' },
    { name: 'CAIPI LAGER 🍋',     desc: 'Lager fresca con Lima' },
    { name: 'KAI 0%',             desc: 'Session IPA sin alc.' },
];

// Maps Excel column names → app style names
const EXCEL_STYLE_MAP = {
    'jammin ipa':     'JAMMIN IPA',
    'scottish':       'SCOTTISH',
    'honey':          'HONEY 🍯',
    'pilsen':         'PILSEN',
    'summer ale':     'PILSEN',          // latas equivalent of Pilsen
    'session ipa':    'SESSION IPA',
    'dry stout':      'DRY STOUT',
    'coco amber ale': 'COCO AMBER ALE 🥥',
    'sour':           'SOUR',
    'barley':         'BARLEY WINE',
    'barley wine':    'BARLEY WINE',
    'kai':            'KAI 0%',
    'caipi lager':    'CAIPI LAGER 🍋',
};
const EXCEL_IGNORE = new Set([
    'ira', 'imperial stout', 'neipa', 'hazy dipa', 'triple a',
    'comentarios negrito', 'cliente', 'doble jammin ipa'
]);

const MONTHS_ES = {
    enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6,
    julio:7, agosto:8, septiembre:9, octubre:10, noviembre:11, diciembre:12
};

const DEFAULT_IMAGES = {
    barriles: { 'Mayorista': 'assets/backgrounds/1.jpg', 'Minorista': 'assets/backgrounds/2.jpg', 'Amigos': 'assets/backgrounds/3.jpg' },
    latas:    { 'Mayorista': 'assets/backgrounds/4.jpg', 'Minorista': 'assets/backgrounds/5.jpg', 'Amigos': 'assets/backgrounds/6.jpg' }
};

const BG_IMAGES_POOL = [
    'assets/backgrounds/1.jpg', 'assets/backgrounds/2.jpg',
    'assets/backgrounds/3.jpg', 'assets/backgrounds/4.jpg',
    'assets/backgrounds/5.jpg', 'assets/backgrounds/6.jpg'
];

// ─── STATE ────────────────────────────────────────────────
let state = {
    listTypes: ['Mayorista', 'Minorista', 'Distribuidores', 'Amigos'],
    products: [],
    history: [],
    defaultsLoaded: false,
    clientImageIndex: {},   // clientName → bgIndex (0-5)
    settings: { footerText: 'CONTACTO / REDES SOCIALES', customImages: {} }
};

let currentLine     = 'barriles';
let currentListType = 'Mayorista';
let increaseType    = 'percent';
let sidebarSearch   = '';

// ─── DEFAULTS ─────────────────────────────────────────────
function initDefaultProducts() {
    ['barriles', 'latas'].forEach(line => {
        state.listTypes.forEach(listType => {
            DEFAULT_BEER_STYLES.forEach((style, idx) => {
                state.products.push({
                    id: `default_${line}_${listType}_${idx}`,
                    line, listType,
                    name: style.name,
                    format: line === 'barriles' ? 'Barril 50L' : 'Lata 473cc',
                    price: 0, abv: '', ibu: '', description: style.desc
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
            if (!state.clientImageIndex) state.clientImageIndex = {};
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
            showToast('⚠️ Espacio lleno: imágenes custom no guardadas');
        } catch(e2) { console.error('Cannot save:', e2); }
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

    // Excel import
    document.getElementById('excelInput').onchange = async function() {
        if (this.files && this.files[0]) {
            const file = this.files[0];
            this.value = '';
            await importExcel(file);
        }
    };
    document.getElementById('btnImportExcel').onclick = () =>
        document.getElementById('excelInput').click();

    // Sidebar search
    document.getElementById('sidebarSearch').oninput = function() {
        sidebarSearch = this.value;
        renderSidebar();
    };

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

// ─── EXCEL IMPORT ────────────────────────────────────────
async function importExcel(file) {
    if (!window.XLSX) {
        alert('La librería de Excel no está cargada. Revisá tu conexión a internet.');
        return;
    }

    showToast('⏳ Procesando Excel...');

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data  = new Uint8Array(e.target.result);
                const wb    = XLSX.read(data, { type: 'array' });
                const found = findMostRecentSheets(wb);

                if (!found.barrilesSheet) {
                    alert('No se encontró una hoja de Barriles válida.\nAsegurate que el Excel tenga hojas con "Precios x Cliente" en el nombre.');
                    return;
                }

                let importedBarriles = 0, importedLatas = 0;

                importedBarriles = importSheetData(wb, found.barrilesSheet, 'barriles');
                if (found.latasSheet) {
                    importedLatas = importSheetData(wb, found.latasSheet, 'latas');
                }

                await saveState();
                renderSidebar();
                renderAll();

                const msg = `✓ ${importedBarriles} clientes en Barriles` +
                    (importedLatas ? `, ${importedLatas} en Latas` : '') +
                    ` — ${found.monthLabel}`;
                showToast(msg);
                resolve(importedBarriles + importedLatas);

            } catch(err) {
                console.error('Import error:', err);
                alert('Error al procesar el Excel:\n' + err.message);
                resolve(0);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

function findMostRecentSheets(wb) {
    let best = { score: -1, barrilesSheet: null, latasSheet: null, monthLabel: '' };

    wb.SheetNames.forEach((name, idx) => {
        const lower = name.toLowerCase();
        const isPriceSheet = lower.includes('precios x cliente') || lower.includes('precio x cliente');
        if (!isPriceSheet) return;

        // Parse month + year
        let monthNum = 0, year = 2025;
        for (const [m, n] of Object.entries(MONTHS_ES)) {
            if (lower.includes(m)) { monthNum = n; break; }
        }
        const yearMatch = name.match(/\d{4}/);
        if (yearMatch) year = parseInt(yearMatch[0]);

        const score = year * 12 + monthNum;
        if (score > best.score) {
            best.score        = score;
            best.barrilesSheet = name;
            best.monthLabel   = name.trim().replace(/\s+/g, ' ');
            best.latasSheet   = null;

            // Find next sheet with client data = LATAS
            for (let i = idx + 1; i < wb.SheetNames.length; i++) {
                const nextName = wb.SheetNames[i];
                const nextWs   = wb.Sheets[nextName];
                if (nextWs && sheetHasClientData(wb, nextName)) {
                    best.latasSheet = nextName;
                    break;
                }
            }
        }
    });

    return best;
}

function sheetHasClientData(wb, sheetName) {
    const ws = wb.Sheets[sheetName];
    if (!ws || !ws['!ref']) return false;
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let r = 3; r <= Math.min(range.e.r, 10); r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
        if (cell && cell.v) return true;
    }
    return false;
}

function importSheetData(wb, sheetName, line) {
    const ws = wb.Sheets[sheetName];
    if (!ws || !ws['!ref']) return 0;

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    if (rows.length < 4) return 0;

    // Row 3 (index 2) = headers
    const headers   = rows[2] || [];
    const clientCol = headers.findIndex(h => h && String(h).toLowerCase().trim() === 'cliente');
    if (clientCol === -1) return 0;

    // Build colIndex → appStyleName
    const colMap = {};
    headers.forEach((h, i) => {
        if (!h || i === clientCol || i === 0) return;
        const key = String(h).toLowerCase().trim();
        if (EXCEL_IGNORE.has(key)) return;
        const appStyle = EXCEL_STYLE_MAP[key];
        if (appStyle) colMap[i] = appStyle;
    });

    let importedCount = 0;
    // Rotating background index counter for new clients
    let newClientCount = Object.keys(state.clientImageIndex).length;

    for (let r = 3; r < rows.length; r++) {
        const row        = rows[r];
        const clientName = row[clientCol];
        if (!clientName) continue;
        const clientStr = String(clientName).trim();
        if (!clientStr) continue;

        // Create list type if not exists
        if (!state.listTypes.includes(clientStr)) {
            state.listTypes.push(clientStr);
            // Assign rotating background image
            if (!state.clientImageIndex[clientStr]) {
                state.clientImageIndex[clientStr] = newClientCount % BG_IMAGES_POOL.length;
                newClientCount++;
            }
            // Create default products for all lines/this client
            ['barriles', 'latas'].forEach(l => {
                DEFAULT_BEER_STYLES.forEach((style, idx) => {
                    state.products.push({
                        id: `${l}_${clientStr}_${idx}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                        line: l, listType: clientStr, name: style.name,
                        format: l === 'barriles' ? 'Barril 50L' : 'Lata 473cc',
                        price: 0, abv: '', ibu: '', description: style.desc || ''
                    });
                });
            });
        }

        // Update prices from this sheet
        let pilsenPrice = 0;

        Object.entries(colMap).forEach(([colIdx, appStyle]) => {
            const rawVal = row[parseInt(colIdx)];
            if (rawVal === null || rawVal === undefined) return;
            const price = parseFloat(rawVal) || 0;
            if (price <= 0) return;

            if (appStyle === 'PILSEN') pilsenPrice = price;

            const pIdx = state.products.findIndex(p =>
                p.line === line && p.listType === clientStr && p.name === appStyle);
            if (pIdx > -1) state.products[pIdx].price = price;
        });

        // CAIPI LAGER = Pilsen price if not in Excel or 0
        if (pilsenPrice > 0) {
            const cIdx = state.products.findIndex(p =>
                p.line === line && p.listType === clientStr && p.name === 'CAIPI LAGER 🍋');
            if (cIdx > -1 && state.products[cIdx].price === 0) {
                state.products[cIdx].price = pilsenPrice;
            }
        }

        importedCount++;
    }

    return importedCount;
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
    const query     = sidebarSearch.toLowerCase().trim();
    const visible   = query
        ? state.listTypes.filter(t => t.toLowerCase().includes(query))
        : state.listTypes;

    container.innerHTML = '';
    visible.forEach(type => {
        const btn = document.createElement('button');
        btn.className = `nav-item ${type === currentListType ? 'active' : ''}`;
        btn.innerHTML = `${window.getIconSVG('fa-list-ul')} <span class="nav-item-label">${type}</span>`;

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

    // Update count badge
    const badge = document.getElementById('listCountBadge');
    if (badge) {
        badge.textContent = query
            ? `${visible.length}/${state.listTypes.length}`
            : `${state.listTypes.length}`;
    }
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
                        <button class="btn-row" onclick="editProduct('${p.id}')">${window.getIconSVG('fa-pen')}</button>
                        <button class="btn-row del" onclick="deleteProduct('${p.id}')">${window.getIconSVG('fa-trash')}</button>
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
        bgEl.style.display  = '';
        overlay.style.display = '';
        inner.style.background = 'transparent';
    } else {
        bgEl.style.display  = 'none';
        overlay.style.display = 'none';
        inner.style.background = currentLine === 'barriles' ? '#ffd85e' : '#f2a99d';
    }

    const logoImg = document.getElementById('pvLogoImg');
    const badgeEl = document.getElementById('pvBadge');
    if (img) {
        if (logoImg) logoImg.style.filter = 'none';
        badgeEl.style.color = 'white';
        badgeEl.style.background  = 'rgba(0,0,0,0.3)';
        badgeEl.style.borderColor = 'rgba(255,255,255,0.2)';
    } else {
        if (logoImg) logoImg.style.filter = 'brightness(0)';
        badgeEl.style.color = '#333';
        badgeEl.style.background  = 'rgba(0,0,0,0.1)';
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
    const hasDefault = !!(getDefaultImageForCurrent());
    const zone   = document.getElementById('uploadZone');
    const status = document.getElementById('imageStatus');
    const txt    = document.getElementById('imageStatusText');

    if (custom) {
        zone.style.display = 'none';
        status.classList.remove('hidden');
        if (txt) txt.textContent = 'Imagen personalizada activa';
    } else if (hasDefault) {
        zone.style.display = 'none';
        status.classList.remove('hidden');
        if (txt) txt.textContent = 'Imagen predeterminada activa';
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
        container.innerHTML = '<div style="font-size:0.8rem;color:var(--text-3);padding:10px 0;">Sin versiones guardadas aún.</div>';
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

    document.getElementById('modalProductTitle').textContent = editing ? 'Editar Estilo' : 'Nuevo Estilo';
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

    if (!name || !format) { alert('Completá Nombre y Formato.'); return; }

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
    if (confirm('¿Eliminar este estilo?')) {
        state.products = state.products.filter(p => p.id !== id);
        saveState();
        renderAll();
    }
};

// ─── LIST TYPES ───────────────────────────────────────────
function submitListType() {
    const name = document.getElementById('fListName').value.trim();
    if (!name) return;
    if (state.listTypes.includes(name)) { alert('Ya existe.'); return; }

    state.listTypes.push(name);

    // Assign background image
    const usedCount = Object.keys(state.clientImageIndex).length;
    state.clientImageIndex[name] = usedCount % BG_IMAGES_POOL.length;

    // Create default products
    ['barriles', 'latas'].forEach(l => {
        DEFAULT_BEER_STYLES.forEach((style, idx) => {
            state.products.push({
                id: `${l}_${name}_${idx}_${Date.now()}`,
                line: l, listType: name, name: style.name,
                format: l === 'barriles' ? 'Barril 50L' : 'Lata 473cc',
                price: 0, abv: '', ibu: '', description: style.desc || ''
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
    delete state.clientImageIndex[type];
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
    if (filtered.length === 0) { alert('No hay precios para guardar.'); return; }
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
    const all = [...state.history].sort((a, b) => b.date - a.date);
    container.innerHTML = all.length === 0
        ? '<div style="color:var(--text-3);font-size:0.85rem;padding:20px;text-align:center;">Sin versiones guardadas.</div>'
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
    currentLine = snap.line;
    currentListType = snap.listType;
    saveState();
    closeAllModals();
    renderSidebar();
    document.querySelectorAll('.nav-item[data-view]').forEach(b =>
        b.classList.toggle('active', b.dataset.view === currentLine));
    renderAll();
    showToast('✓ Versión restaurada');
};

// ─── PRICE INCREASE ───────────────────────────────────────
function roundUpTo50(v) { return Math.ceil(v / 50) * 50; }

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

function calcNewPrice(old, val) {
    if (!old || old <= 0) return 0;
    const raw = increaseType === 'percent' ? old * (1 + val / 100) : old + val;
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
            </span></div>`;
    }).join('');
    const extra = prods.length > 12
        ? `<div style="color:var(--text-3);font-size:0.75rem;text-align:center;padding:6px;">+ ${prods.length - 12} más</div>` : '';
    preview.innerHTML = rows + extra;
}

function openIncreaseModal() {
    const lbl = currentLine === 'barriles' ? 'Barriles' : 'Latas';
    document.getElementById('fIncreaseScope').innerHTML = `
        <option value="current">Esta lista — ${lbl} · ${currentListType}</option>
        <option value="line">Toda la línea — ${lbl}</option>
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
    if (prods.length === 0) { alert('No hay precios para actualizar.'); return; }
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
function getDefaultImageForCurrent() {
    // Fixed lists use DEFAULT_IMAGES map
    const fixed = DEFAULT_IMAGES[currentLine]?.[currentListType];
    if (fixed) return fixed;
    // Client lists use rotating pool
    const idx = state.clientImageIndex?.[currentListType];
    if (idx !== undefined) return BG_IMAGES_POOL[idx % BG_IMAGES_POOL.length];
    return '';
}

function getCurrentImage() {
    const custom = state.settings.customImages[currentListType]?.[currentLine];
    if (custom) return custom;
    return getDefaultImageForCurrent();
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
            const TW = 1080, TH = 1920;
            const c  = document.createElement('canvas');
            c.width  = TW; c.height = TH;
            const ctx = c.getContext('2d');
            const sc  = Math.max(TW / img.width, TH / img.height);
            ctx.drawImage(img, (TW - img.width*sc)/2, (TH - img.height*sc)/2, img.width*sc, img.height*sc);
            cb(c.toDataURL('image/jpeg', 0.88));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ─── EXPORT ───────────────────────────────────────────────
async function generateJpg() {
    const filtered = getFiltered().filter(p => p.price > 0);
    if (filtered.length === 0) { alert('No hay precios para exportar.'); return; }

    const wrap    = document.getElementById('exportWrap');
    const canvas  = document.getElementById('exportCanvas');
    const imgSrc  = getCurrentImage();
    const solidBg = currentLine === 'barriles' ? '#ffd85e' : '#f2a99d';

    canvas.style.backgroundColor = solidBg;

    const ecBg      = document.getElementById('ecBgImg');
    const ecOverlay = document.querySelector('#exportCanvas .ec-overlay');

    if (imgSrc) {
        ecBg.crossOrigin  = 'anonymous';
        ecBg.src          = imgSrc;
        ecBg.style.display = '';
        if (ecOverlay) ecOverlay.style.display = '';
    } else {
        ecBg.src = '';
        ecBg.style.display = 'none';
        if (ecOverlay) ecOverlay.style.display = 'none';
    }

    document.getElementById('ecListBadge').textContent = currentListType.toUpperCase();
    document.getElementById('ecLineLabel').textContent = currentLine === 'barriles' ? 'BARRIL' : 'LATA';

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
        if (lineEl)   lineEl.style.color    = '#666';
        if (badgeEl)  { badgeEl.style.color = '#222'; badgeEl.style.background = 'rgba(0,0,0,0.10)'; badgeEl.style.borderColor = 'rgba(0,0,0,0.12)'; }
        if (footerEl) footerEl.style.color  = '#555';
    }
    if (footerEl) footerEl.textContent = state.settings.footerText || '';

    document.getElementById('ecPrices').innerHTML = filtered.map(p => `
        <div class="ec-price-row">
            <div>
                <span class="ec-price-name">${p.name}</span>
                ${p.format ? `<span class="ec-price-extras">${p.format}</span>` : ''}
                ${p.abv    ? `<span class="ec-price-extras">${p.abv}</span>` : ''}
            </div>
            <span class="ec-price-val">$${Number(p.price).toLocaleString('es-AR')}</span>
        </div>`).join('');

    wrap.style.cssText = 'position:fixed;top:0;left:0;opacity:1;z-index:-9999;pointer-events:none;';
    const filename = `Lista_Bohr_${currentLine}_${currentListType}_${new Date().toLocaleDateString('es-AR').replace(/\//g,'-')}.jpg`;

    const doCapture = () => {
        html2canvas(canvas, { scale: 2, useCORS: true, allowTaint: true, logging: false }).then(c => {
            wrap.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;pointer-events:none;';
            const dataUrl = c.toDataURL('image/jpeg', 0.92);
            if (window.pywebview && window.pywebview.api) {
                window.pywebview.api.save_image(dataUrl, filename).then(ok => { if (ok) showToast('✓ Imagen guardada'); });
            } else {
                const a = document.createElement('a');
                a.download = filename; a.href = dataUrl; a.click();
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
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
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
    setTimeout(() => t.remove(), 3000);
}

const _s = document.createElement('style');
_s.textContent = '@keyframes fadeInUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}';
document.head.appendChild(_s);

window.addEventListener('DOMContentLoaded', init);
