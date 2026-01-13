const materialListEl = document.getElementById('materialList');
const addBtn = document.getElementById('addBtn');
const importBtn = document.getElementById('importBtn');
const nameInput = document.getElementById('materialName');
const amountInput = document.getElementById('materialAmount');
const importArea = document.getElementById('importList');

const editModal = document.getElementById('editModal');
const editName = document.getElementById('editName');
const editAmount = document.getElementById('editAmount');
const modalClose = document.getElementById('modalClose');
const modalCancel = document.getElementById('modalCancel');
const modalSave = document.getElementById('modalSave');

const totalItemsEl = document.getElementById('totalItems');
const totalAmountEl = document.getElementById('totalAmount');
const completedItemsEl = document.getElementById('completedItems');
const remainingItemsEl = document.getElementById('remainingItems');
const amountLeftEl = document.getElementById('amountLeft');
const amountCompletedEl = document.getElementById('amountCompleted');

const shareBtn = document.getElementById('shareBtn');
const copyPopup = document.getElementById('copyPopup');

const sessionInput = document.getElementById('sessionInput');
const loadSessionBtn = document.getElementById('loadSessionBtn');
const deleteSessionBtn = document.getElementById('deleteSessionBtn');
const createSessionBtn = document.getElementById('createSessionBtn');
const requestDeleteBtn = document.getElementById('requestDeleteBtn'); // new button
const deleteStatusEl = document.getElementById('deleteStatus'); // to show who requested delete
const currentSessionSpan = document.getElementById('currentSession');

const customAlertEl = document.getElementById('customAlert');
const customAlertMessage = document.getElementById('customAlertMessage');
const customAlertOk = document.getElementById('customAlertOk');
const customAlertCancel = document.getElementById('customAlertCancel');

function showAlert(message) {
    return new Promise(resolve => {
        customAlertMessage.textContent = message;
        customAlertCancel.style.display = 'none';
        customAlertEl.classList.add('show');
        customAlertOk.onclick = () => { customAlertEl.classList.remove('show'); resolve(true); };
    });
}

function showConfirm(message) {
    return new Promise(resolve => {
        customAlertMessage.textContent = message;
        customAlertCancel.style.display = 'inline-block';
        customAlertEl.classList.add('show');
        customAlertOk.onclick = () => { customAlertEl.classList.remove('show'); resolve(true); };
        customAlertCancel.onclick = () => { customAlertEl.classList.remove('show'); resolve(false); };
    });
}

let materials = [];
let editingIndex = null;
let sessionId = null;
let sse = null;
let deleteRequests = new Set();
let userId = localStorage.getItem('userId');
if (!userId) {
    userId = Math.random().toString(36).substring(2, 10);
    localStorage.setItem('userId', userId);
}

const apiBase = `http://localhost:3000/api/session`;

function updateUrlSession() {
    if (sessionId) {
        const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
        window.history.replaceState({}, "", url);
        currentSessionSpan.textContent = sessionId;
    } else {
        const url = `${window.location.origin}${window.location.pathname}`;
        window.history.replaceState({}, "", url);
        currentSessionSpan.textContent = '(none)';
    }
}

function clearSessionUI() {
    sessionId = null;
    deleteRequests.clear();
    lastDeleteRequestsSize = -1;
    lastConnected = -1;
    updateDeleteStatus(0);
    updateUrlSession();
}

async function createSessionOnServer() {
    if (!sessionId) sessionId = Math.random().toString(36).substring(2, 10);
    try {
        const res = await fetch(apiBase, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId })
        });
        const data = await res.json();
        if (data?.session?.materials) materials = data.session.materials;
        updateUrlSession();
        startSSE(sessionId);
        return sessionId;
    } catch (err) {
        console.warn("Failed to create session:", err);
        throw err;
    }
}

async function saveSession() {
    if (!sessionId) return;
    try {
        await fetch(`${apiBase}/${sessionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ materials })
        });
    } catch (err) {
        console.warn("Failed to save session:", err);
    }
}

async function loadSession(id) {
    if (!id) throw new Error("Missing session id");
    try {
        const res = await fetch(`${apiBase}/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        materials = data?.session?.materials || [];
        sessionId = id;
        updateUrlSession();
        startSSE(sessionId);
        return data.session;
    } catch (err) {
        console.warn("Failed to load session:", err);
        throw err;
    }
}

async function requestDeleteSession() {
    if (!sessionId) return await showAlert('No session active.');

    try {
        const res = await fetch(`${apiBase}/${sessionId}/request-delete`, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId })
        });
        const data = await res.json();
        deleteRequests = new Set(data.requests || []);
        updateDeleteStatus(data.connected);
        if (data.deleted) {
            materials = JSON.parse(localStorage.getItem('materials') || '[]');
            sessionId = null;
            clearSessionUI();
            updateUrlSession();
            await showAlert('Session deleted: all participants confirmed.');
            render();
        }
    } catch (err) {
        console.warn('Failed to request delete:', err);
        await showAlert('Failed to request delete. Please try again.');
    }
}

async function fetchDeleteRequests() {
    if (!sessionId) return;
    try {
        const res = await fetch(`${apiBase}/${sessionId}/request-delete`);
        const data = await res.json();
        deleteRequests = new Set(data.requests || []);
        updateDeleteStatus();
    } catch { }
}

let lastDeleteRequestsSize = -1;
let lastConnected = -1;

function updateDeleteStatus(connected = null) {
    if (!deleteStatusEl) return;

    if (connected === null) connected = lastConnected;

    if (deleteRequests.size === lastDeleteRequestsSize && connected === lastConnected) return;

    lastDeleteRequestsSize = deleteRequests.size;
    lastConnected = connected;

    deleteStatusEl.textContent = `Delete Session (${deleteRequests.size}/${connected})`;
}

function startSSE(id) {
    if (!id) return;
    if (sse) sse.close();

    sse = new EventSource(`${apiBase}/${id}/stream?userId=${userId}`);
    sse.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.materials && JSON.stringify(data.materials) !== JSON.stringify(materials)) {
                materials = data.materials;
                saveLocal();
                render();
            }

            deleteRequests = new Set(data.deleteRequests || []);
            updateDeleteStatus(data.connected);

            if (data.deleted) {
                materials = JSON.parse(localStorage.getItem('materials') || '[]');
                clearSessionUI();
                await showAlert('Session deleted: all participants confirmed.');
                render();
            }

        } catch (err) {
            console.error("Failed to parse SSE update:", err);
        }
    };
    sse.onerror = (err) => console.warn("SSE error:", err);
}

const urlParams = new URLSearchParams(window.location.search);
const sessionParam = urlParams.get('session');
const dataParam = urlParams.get('data');

(async () => {
    if (sessionParam) {
        try { await loadSession(sessionParam); }
        catch (e) { materials = JSON.parse(localStorage.getItem('materials') || '[]'); clearSessionUI(); }
    } else if (dataParam) {
        try { const imported = JSON.parse(LZString.decompressFromEncodedURIComponent(dataParam)); if (Array.isArray(imported)) materials = imported; }
        catch { materials = JSON.parse(localStorage.getItem('materials') || '[]'); }
    } else {
        materials = JSON.parse(localStorage.getItem('materials') || '[]');
        clearSessionUI();
    }
    render();
})();

setInterval(() => { saveLocal(); if (sessionId) saveSession(); fetchDeleteRequests(); }, 5000);

function render() {
    materialListEl.innerHTML = '';
    materials.forEach((m, idx) => {
        const item = document.createElement('div');
        item.className = 'material-item' + (m.checked ? ' checked' : '');
        item.setAttribute('data-index', idx);

        const left = document.createElement('div');
        left.className = 'material-left';
        left.innerHTML = `
      <input type="checkbox" ${m.checked ? 'checked' : ''} data-idx="${idx}" aria-label="Mark ${escapeHtml(m.name)} done">
      <div style="display:flex;flex-direction:column;min-width:0">
        <div class="material-name">${escapeHtml(m.name)}</div>
      </div>
    `;

        const right = document.createElement('div');
        right.style.display = 'flex';
        right.style.alignItems = 'center';
        right.style.gap = '0.8rem';

        const amount = document.createElement('div');
        amount.className = 'material-amount';
        const amt = parseInt(m.amount) || 0;
        let displayText = `x${amt}`;
        if (amt > 64) { const stacks = Math.ceil(amt / 64); displayText += ` (${stacks} stack${stacks > 1 ? 's' : ''})`; }
        amount.textContent = displayText;

        const actions = document.createElement('div');
        actions.className = 'actions';
        actions.innerHTML = `
      <button class="icon-btn edit" title="Edit" data-idx="${idx}"><i class="fa-solid fa-pen-to-square"></i></button>
      <button class="icon-btn remove" title="Remove" data-idx="${idx}"><i class="fa-solid fa-trash"></i></button>
    `;

        right.appendChild(amount); right.appendChild(actions);
        item.appendChild(left); item.appendChild(right);
        materialListEl.appendChild(item);
    });

    materialListEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', e => {
            const i = Number(cb.getAttribute('data-idx'));
            materials[i].checked = cb.checked;
            saveLocal();
            if (sessionId) saveSession();
            render();
        });
    });

    materialListEl.querySelectorAll('.edit').forEach(btn => btn.addEventListener('click', () => openEdit(Number(btn.dataset.idx))));
    materialListEl.querySelectorAll('.remove').forEach(btn => btn.addEventListener('click', () => {
        const i = Number(btn.dataset.idx); materials.splice(i, 1);
        saveLocal(); if (sessionId) saveSession(); render();
    }));

    updateStats();
}

function updateStats() {
    const totalItems = materials.length;
    const totalAmount = materials.reduce((sum, m) => sum + (parseInt(m.amount) || 0), 0);
    const completedItems = materials.filter(m => m.checked).length;
    const remainingItems = totalItems - completedItems;
    const totalAmountCompleted = materials.filter(m => m.checked).reduce((sum, m) => sum + (parseInt(m.amount) || 0), 0);
    const totalAmountLeft = materials.filter(m => !m.checked).reduce((sum, m) => sum + (parseInt(m.amount) || 0), 0);

    totalItemsEl.textContent = totalItems;
    totalAmountEl.textContent = totalAmount;
    completedItemsEl.textContent = completedItems;
    remainingItemsEl.textContent = remainingItems;
    amountCompletedEl.textContent = totalAmountCompleted;
    amountLeftEl.textContent = totalAmountLeft;
}

function saveLocal() { localStorage.setItem('materials', JSON.stringify(materials)); }
function escapeHtml(str) { return String(str).replace(/[&<>"'`=\/]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;' })[s]); }

const createSessionOnFirstEdit = true;

async function addMaterial() {
    const name = nameInput.value.trim();
    const amount = parseInt(amountInput.value);
    if (!name || isNaN(amount)) return;
    if (!sessionId && createSessionOnFirstEdit) { try { await createSessionOnServer(); } catch { } }
    materials.push({ name, amount, checked: false });
    saveLocal(); if (sessionId) await saveSession(); render();
    nameInput.value = ''; amountInput.value = ''; nameInput.focus();
}

addBtn.addEventListener('click', addMaterial);
[nameInput, amountInput].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addMaterial(); } }));

async function importMaterials() {
    const text = importArea.value.trim();
    if (!text) return;
    if (!sessionId && createSessionOnFirstEdit) { try { await createSessionOnServer(); } catch { } }

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach(line => {
        const cleaned = line.replace(/=/g, '-');
        const parts = cleaned.split('-').map(p => p.trim());
        if (parts.length >= 2) {
            const amt = parseInt(parts.slice(-1)[0]);
            const name = parts.slice(0, parts.length - 1).join(' - ');
            if (name && !isNaN(amt)) materials.push({ name, amount: amt, checked: false });
        }
    });
    importArea.value = '';
    saveLocal(); if (sessionId) await saveSession(); render();
}

importBtn.addEventListener('click', importMaterials);

function openEdit(index) { editingIndex = index; const m = materials[index] || { name: '', amount: 0 }; editName.value = m.name; editAmount.value = m.amount; showModal(); setTimeout(() => editName.focus(), 120); }
function showModal() { editModal.classList.add('show'); document.body.classList.add('modal-open'); editModal.setAttribute('aria-hidden', 'false'); document.addEventListener('keydown', modalKeyHandler); }
function hideModal() { editModal.classList.remove('show'); document.body.classList.remove('modal-open'); editModal.setAttribute('aria-hidden', 'true'); document.removeEventListener('keydown', modalKeyHandler); editingIndex = null; }
function modalKeyHandler(e) { if (e.key === 'Escape') { hideModal(); } if (e.key === 'Enter') { e.preventDefault(); modalSaveHandler(); } }
function modalSaveHandler() { if (editingIndex === null) return hideModal(); const name = editName.value.trim(); const amt = parseInt(editAmount.value); if (!name || isNaN(amt)) return; materials[editingIndex].name = name; materials[editingIndex].amount = amt; saveLocal(); if (sessionId) saveSession(); hideModal(); render(); }
modalClose.addEventListener('click', hideModal);
modalCancel.addEventListener('click', hideModal);
modalSave.addEventListener('click', modalSaveHandler);

function showCopyPopup() { copyPopup.style.opacity = '1'; copyPopup.style.transform = 'translateX(-50%) translateY(-10px)'; setTimeout(() => { copyPopup.style.opacity = '0'; copyPopup.style.transform = 'translateX(-50%) translateY(0)'; }, 1500); }
shareBtn.addEventListener('click', async () => {
    if (!materials.length) return await showAlert('Your checklist is empty.');
    if (!sessionId) {
        try { await createSessionOnServer(); } catch {
            try {
                const json = JSON.stringify(materials); const compressed = LZString.compressToEncodedURIComponent(json);
                const url = `${window.location.origin}${window.location.pathname}?data=${compressed}`;
                await navigator.clipboard.writeText(url); showCopyPopup(); return;
            } catch { return await showAlert('Failed to create share link.'); }
        }
    }
    const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
    try { await navigator.clipboard.writeText(url); showCopyPopup(); } catch { await showAlert('Failed to copy link.'); }
});

loadSessionBtn.addEventListener('click', async () => {
    const id = sessionInput.value.trim();
    if (!id) return await showAlert('Please enter a session ID.');
    try { await loadSession(id); saveLocal(); render(); await showAlert(`Session "${id}" loaded successfully.`); }
    catch { await showAlert('Failed to load session. Make sure the ID is correct and the server is reachable.'); }
});

createSessionBtn.addEventListener('click', async () => {
    if (sessionId) return await showAlert('A session is already active. Share it or delete it first.');
    try { await createSessionOnServer(); saveLocal(); render(); await showAlert(`Session created: ${sessionId}`); }
    catch { await showAlert('Failed to create session on server.'); }
});

deleteSessionBtn.addEventListener('click', async () => {
    if (!sessionId) return await showAlert('No session active.');
    const ok = await showConfirm('Are you sure you want to request deletion of this session? All participants must confirm.');
    if (!ok) return;
    await requestDeleteSession();
});

async function deleteSessionOnServer(id) {
    if (!id) throw new Error("Missing session id");
    const res = await fetch(`${apiBase}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    return await res.json();
}

currentSessionSpan.textContent = sessionParam || '(none)';

render();
