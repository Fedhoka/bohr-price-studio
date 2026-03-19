// ─── STATE ────────────────────────────────────────────────
let state = {
    listTypes: ['Mayorista', 'Minorista', 'Distribuidores', 'Amigos'],
    products: [],
    history: [],          // { id, date, line, listType, label, products[] }
    settings: {
        footerText: 'CONTACTO / REDES SOCIALES',
        customImages: {}  // [listType][line] = base64
    }
};

let currentLine     = 'barriles';
let currentListType = 'Mayorista';

// ─── PERSIST — archivo JSON via pywebview (desktop) o localStorage (web) ──
async function loadState() {
    let raw = null;

    // Primero intentar pywebview API (app de escritorio)
    if (window.pywebview && window.pywebview.api) {
        try { raw = await window.pywebview.api.load_data(); } catch(e) { console.warn('pywebview load:', e); }
    }

    // Fallback: localStorage (browser / web app)
    if (!raw) raw = localStorage.getItem('bohr_v2');

    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            state = { ...state, ...parsed };
            if (!state.listTypes || !state.listTypes.length)
                state.listTypes = ['Mayorista', 'Minorista', 'Distribuidores', 'Amigos'];
            if (!state.settings) state.settings = { footerText: 'CONTACTO / REDES SOCIALES', customImages: {} };
            if (!state.settings.customImages) state.settings.customImages = {};
            if (!state.history) state.history = [];
        } catch(e) { console.warn('State parse error', e); }
    }
    currentListType = state.listTypes[0] || 'Mayorista';
}

async function saveState() {
    const json = JSON.stringify(state);

    // Guardar en archivo JSON via pywebview (persistencia real en escritorio)
    if (window.pywebview && window.pywebview.api) {
        try { await window.pywebview.api.save_data(json); } catch(e) { console.warn('pywebview save:', e); }
    }

    // Siempre guardar en localStorage también (backup + web app)
    try {
        localStorage.setItem('bohr_v2', json);
    } catch(e) {
        // localStorage lleno (imágenes grandes) — intentar sin imágenes
        try {
            const slim = { ...state, settings: { ...state.settings, customImages: {} } };
            localStorage.setItem('bohr_v2', JSON.stringify(slim));
            showToast('⚠️ Espacio lleno: imágenes no guardadas en browser');
        } catch(e2) { console.warn('Cannot save to localStorage:', e2); }
    }
}

// ─── INIT ─────────────────────────────────────────────────
async function init() {
    // Esperar a que pywebview esté listo si estamos en desktop
    if (window.location.protocol === 'file:') {
        await new Promise(resolve => {
            if (window.pywebview) { resolve(); return; }
            window.addEventListener('pywebviewready', resolve, { once: true });
            setTimeout(resolve, 600); // máximo 600ms de espera
        });
    }

    await loadState();
    setupEvents();
    renderSidebar();
    renderAll();
}

function setupEvents() {
    // Line navigation
    document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-item[data-view]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentLine = btn.dataset.view;
            renderAll();
        });
    });

    // Add product
    document.getElementById('btnAddProduct').onclick = () => openProductModal();

    // Add list type
    document.getElementById('btnAddListType').onclick = () => {
        document.getElementById('fListName').value = '';
        document.getElementById('modalListType').classList.remove('hidden');
        setTimeout(() => document.getElementById('fListName').focus(), 50);
    };

    // Settings
    document.getElementById('btnSettings').onclick = () => {
        document.getElementById('fFooter').value = state.settings.footerText || '';
        document.getElementById('modalSettings').classList.remove('hidden');
    };

    // History
    document.getElementById('btnHistory').onclick = openHistoryModal;
    document.getElementById('btnSaveSnapshot').onclick = saveSnapshot;

    // Generate JPG
    document.getElementById('btnGenerate').onclick = generateJpg;

    // Preview image upload
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

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.addEventListener('click', e => { if (e.target === m) closeAllModals(); });
    });

    // ESC key
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
    const count = getFiltered().length;
    document.getElementById('pageSubCount').textContent = `${count} producto${count !== 1 ? 's' : ''}`;
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
    const tbody = document.getElementById('productsTbody');
    const empty = document.getElementById('emptyState');
    const table = document.getElementById('productsTable');
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
            tr.innerHTML = `
                <td>
                    <div class="td-name">${p.name}</div>
                    ${p.description ? `<div style="font-size:0.75rem;color:var(--text-3);margin-top:2px;">${p.description}</div>` : ''}
                </td>
                <td>${p.format}</td>
                <td><span class="tag">${p.abv || '—'}</span></td>
                <td><span class="tag">${p.ibu || '—'}</span></td>
                <td class="td-price">$${Number(p.price).toLocaleString('es-AR')}</td>
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
    const filtered = getFiltered();
    const img = getCurrentImage();

    const bgEl   = document.getElementById('previewBgImg');
    const overlay = document.getElementById('previewOverlay');
    const inner  = document.getElementById('previewInner');

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

    // Logo: natural on image bg (white letters show), all-black on solid bg
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

    // Badge text
    badgeEl.textContent = `${currentListType} · ${currentLine === 'barriles' ? 'Barriles' : 'Latas'}`;

    // Prices box
    const box = document.getElementById('pvPricesBox');
    if (filtered.length === 0) {
        box.innerHTML = '<div class="preview-empty-msg">Sin productos aún</div>';
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
    const img = getCurrentImage();
    const zone = document.getElementById('uploadZone');
    const status = document.getElementById('imageStatus');
    if (img) {
        zone.style.display = 'none';
        status.classList.remove('hidden');
    } else {
        zone.style.display = '';
        status.classList.add('hidden');
    }
}

function renderHistory() {
    const relevant = state.history
        .filter(h => h.line === currentLine && h.listType === currentListType)
        .sort((a, b) => b.date - a.date)
        .slice(0, 5);

    const container = document.getElementById('historyList');
    if (relevant.length === 0) {
        container.innerHTML = '<div style="font-size:0.8rem; color:var(--text-3); padding:10px 0;">Sin versiones aún. Guardá una versión para trackear cambios de precio.</div>';
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
    const modal = document.getElementById('modalProduct');
    const editing = id ? state.products.find(p => p.id === id) : null;

    document.getElementById('modalProductTitle').textContent = editing ? 'Editar Producto' : 'Nuevo Producto';
    document.getElementById('fId').value = editing ? editing.id : '';
    document.getElementById('fName').value = editing ? editing.name : '';
    document.getElementById('fFormat').value = editing ? editing.format : '';
    document.getElementById('fPrice').value = editing ? editing.price : '';
    document.getElementById('fAbv').value = editing ? (editing.abv || '') : '';
    document.getElementById('fIbu').value = editing ? (editing.ibu || '') : '';
    document.getElementById('fDesc').value = editing ? (editing.description || '') : '';

    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('fName').focus(), 50);
}

function submitProduct() {
    const id    = document.getElementById('fId').value || Date.now().toString();
    const name  = document.getElementById('fName').value.trim();
    const format= document.getElementById('fFormat').value.trim();
    const price = parseFloat(document.getElementById('fPrice').value);
    const abv   = document.getElementById('fAbv').value.trim();
    const ibu   = document.getElementById('fIbu').value.trim();
    const desc  = document.getElementById('fDesc').value.trim();

    if (!name || !format || isNaN(price)) {
        alert('Completá al menos Nombre, Formato y Precio.');
        return;
    }

    const existing = state.products.findIndex(p => p.id === id);
    const product = { id, line: currentLine, listType: currentListType, name, format, price, abv, ibu, description: desc };

    if (existing > -1) state.products[existing] = product;
    else state.products.push(product);

    saveState();
    closeAllModals();
    renderAll();
}

window.editProduct = id => openProductModal(id);

window.deleteProduct = id => {
    if (confirm('¿Eliminar este producto?')) {
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
    const filtered = getFiltered();
    if (filtered.length === 0) { alert('No hay productos en la lista actual para guardar.'); return; }

    const label = `${currentLine === 'barriles' ? 'Barriles' : 'Latas'} · ${currentListType}`;
    const snap = {
        id: Date.now().toString(),
        date: Date.now(),
        line: currentLine,
        listType: currentListType,
        label,
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

    if (all.length === 0) {
        container.innerHTML = '<div style="color:var(--text-3); font-size:0.85rem; padding:20px; text-align:center;">Sin versiones guardadas todavía.</div>';
    } else {
        container.innerHTML = all.map(h => `
            <div class="history-modal-item">
                <div>
                    <div style="font-weight:600; font-size:0.9rem;">${h.label}</div>
                    <div class="history-modal-meta">${formatDate(h.date)} · ${h.products.length} productos</div>
                    <div style="font-size:0.75rem; color:var(--text-3); margin-top:6px;">
                        ${h.products.map(p => `${p.name} <strong style="color:var(--amber);">$${Number(p.price).toLocaleString('es-AR')}</strong>`).join(' · ')}
                    </div>
                </div>
                <button class="btn btn-ghost" style="font-size:0.75rem; white-space:nowrap;" onclick="restoreSnapshot('${h.id}')">
                    ${window.getIconSVG('fa-rotate-left')} Restaurar
                </button>
            </div>`).join('');
    }
    document.getElementById('modalHistory').classList.remove('hidden');
}

window.restoreSnapshot = function(id) {
    const snap = state.history.find(h => h.id === id);
    if (!snap) return;
    if (!confirm(`¿Restaurar la versión del ${formatDate(snap.date)}? Se reemplazarán los productos actuales de ${snap.listType} (${snap.line}).`)) return;

    state.products = state.products.filter(p => !(p.line === snap.line && p.listType === snap.listType));
    state.products.push(...snap.products);
    currentLine = snap.line;
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

// ─── IMAGES ───────────────────────────────────────────────
function getCurrentImage() {
    return state.settings.customImages[currentListType]?.[currentLine] || '';
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
            const canvas = document.createElement('canvas');
            canvas.width = TARGET_W;
            canvas.height = TARGET_H;
            const ctx = canvas.getContext('2d');

            const scaleX = TARGET_W / img.width;
            const scaleY = TARGET_H / img.height;
            const scale = Math.max(scaleX, scaleY);
            const drawW = img.width * scale;
            const drawH = img.height * scale;
            const offsetX = (TARGET_W - drawW) / 2;
            const offsetY = (TARGET_H - drawH) / 2;

            ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
            cb(canvas.toDataURL('image/jpeg', 0.88));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ─── EXPORT / GENERATE JPG ────────────────────────────────
function generateJpg() {
    const filtered = getFiltered();
    const wrap  = document.getElementById('exportWrap');
    const canvas = document.getElementById('exportCanvas');
    const img   = getCurrentImage();
    const solidBg = currentLine === 'barriles' ? '#ffd85e' : '#f2a99d';

    canvas.style.backgroundColor = solidBg;

    const ecBg = document.getElementById('ecBgImg');
    const ecOverlay = document.querySelector('#exportCanvas .ec-overlay');
    if (img) {
        ecBg.src = img;
        ecBg.style.display = '';
        if (ecOverlay) ecOverlay.style.display = '';
    } else {
        ecBg.src = '';
        ecBg.style.display = 'none';
        if (ecOverlay) ecOverlay.style.display = 'none';
    }

    document.getElementById('ecLineLabel').textContent  = currentLine === 'barriles' ? 'BARRIL' : 'LATA';
    document.getElementById('ecListBadge').textContent  = currentListType.toUpperCase();

    const logoImg = document.getElementById('ecLogoImg');
    const lineEl  = document.getElementById('ecLineLabel');
    const badgeEl = document.getElementById('ecListBadge');
    const footerEl = document.getElementById('ecFooter');

    if (img) {
        if (logoImg) logoImg.style.filter = 'none';
        if (lineEl)  lineEl.style.color   = 'rgba(255,255,255,0.75)';
        if (badgeEl) { badgeEl.style.color = 'white'; badgeEl.style.background = 'rgba(255,255,255,0.15)'; badgeEl.style.borderColor = 'rgba(255,255,255,0.3)'; }
        if (footerEl) footerEl.style.color = 'rgba(255,255,255,0.7)';
    } else {
        if (logoImg) logoImg.style.filter = 'brightness(0)';
        if (lineEl)  lineEl.style.color   = '#666666';
        if (badgeEl) { badgeEl.style.color = '#222'; badgeEl.style.background = 'rgba(0,0,0,0.10)'; badgeEl.style.borderColor = 'rgba(0,0,0,0.12)'; }
        if (footerEl) footerEl.style.color = '#555555';
    }
    if (footerEl) footerEl.textContent = state.settings.footerText || '';

    const pricesEl = document.getElementById('ecPrices');
    if (filtered.length === 0) {
        pricesEl.innerHTML = '<div style="text-align:center; font-size:1.5rem; color:#888; padding:30px;">Lista vacía</div>';
    } else {
        pricesEl.innerHTML = filtered.map(p => `
            <div class="ec-price-row">
                <div>
                    <span class="ec-price-name">${p.name}</span>
                    ${p.format ? `<span class="ec-price-extras">${p.format}</span>` : ''}
                    ${p.abv    ? `<span class="ec-price-extras">${p.abv}</span>`    : ''}
                </div>
                <span class="ec-price-val">$${Number(p.price).toLocaleString('es-AR')}</span>
            </div>`).join('');
    }

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
                    .then(ok => { if (ok) showToast('✓ Imagen guardada'); })
                    .catch(() => alert('Error al guardar.'));
            } else {
                const a = document.createElement('a');
                a.download = filename;
                a.href = dataUrl;
                a.click();
            }
        });
    };

    if (img && ecBg.src) {
        if (ecBg.complete && ecBg.naturalWidth > 0) {
            setTimeout(doCapture, 100);
        } else {
            ecBg.onload  = () => setTimeout(doCapture, 100);
            ecBg.onerror = () => setTimeout(doCapture, 100);
        }
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
    const d = new Date(ts);
    return d.toLocaleString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

const style = document.createElement('style');
style.textContent = '@keyframes fadeInUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }';
document.head.appendChild(style);

// ─── BOOT ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
