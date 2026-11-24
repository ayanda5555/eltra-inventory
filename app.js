const API_URL = "https://script.google.com/macros/s/AKfycbyDcuWuG2Ho6Qq4X9XJ_-zZPmSjxKRYEFqJbBo4aASlimQCfnjregH2bv5a04GLwlH8/exec";
let sessionToken = localStorage.getItem('eltra_token');
let currentUser = JSON.parse(localStorage.getItem('eltra_user'));

// --- OFFLINE DB SETUP ---
let db;
const dbRequest = indexedDB.open("EltraDB", 1);
dbRequest.onupgradeneeded = function(e) {
    let db = e.target.result;
    if (!db.objectStoreNames.contains('syncQueue')) db.createObjectStore('syncQueue', { keyPath: 'offlineId' });
};
dbRequest.onsuccess = function(e) { db = e.target.result; checkNetwork(); };
window.addEventListener('online', checkNetwork);
window.addEventListener('offline', checkNetwork);

function checkNetwork() {
    document.getElementById('offline-banner').style.display = navigator.onLine ? 'none' : 'block';
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

async function apiRequest(action, payload = {}) {
    const res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: action, token: sessionToken, payload: payload })
    });
    return await res.json();
}

// --- AUTH ---
async function doLogin() {
    const code = document.getElementById('login-user').value;
    const pin = document.getElementById('login-pin').value;
    if (!code || !pin) return alert("Enter ID and PIN");

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', payload: { userCode: code, pin: pin } })
        });
        const result = await res.json();
        if (result.success) {
            localStorage.setItem('eltra_token', result.token);
            localStorage.setItem('eltra_user', JSON.stringify(result.user));
            sessionToken = result.token; currentUser = result.user;
            initDashboard();
        } else { alert(result.message); }
    } catch (e) { alert("Network error. Check connection."); }
}

function doLogout() { localStorage.clear(); sessionToken = null; showScreen('screen-login'); }

// --- DASHBOARD ---
async function initDashboard() {
    showScreen('screen-dashboard');
    document.getElementById('welcome-text').innerText = `Hi, ${currentUser.name.split(' ')[0]}`;
    try {
        const result = await apiRequest('getDashboard');
        if (result.success) {
            document.getElementById('stat-items').innerText = result.data.totalItems;
            const ul = document.getElementById('low-stock-list');
            ul.innerHTML = result.data.lowStockAlerts.length === 0 ? '<li>All stock is fine!</li>' : '';
            result.data.lowStockAlerts.forEach(i => ul.innerHTML += `<li><span>${i.name}</span> <strong>${i.stock} / ${i.min}</strong></li>`);
        }
    } catch(e) { console.log("Offline, using cached dashboard"); }
}

// --- DROPDOWNS ---
async function loadDropdowns() {
    const res = await apiRequest('getItems');
    if (res.success) {
        let html = '<option value="">-- Select Item --</option>';
        res.data.forEach(i => html += `<option value="${i.ItemID}">${i.ItemName} (Stock: ${i.CurrentStock})</option>`);
        if(document.getElementById('iss-item')) document.getElementById('iss-item').innerHTML = html;
    }
}

async function loadReceiveForm() {
    const res = await apiRequest('getItems');
    if (res.success) {
        let html = '<option value="">-- Select Item --</option>';
        res.data.forEach(i => html += `<option value="${i.ItemID}">${i.ItemName} (Stock: ${i.CurrentStock})</option>`);
        document.getElementById('rec-item').innerHTML = html;
    }
}

async function loadCategoriesAndSuppliers() {
    const resCat = await apiRequest('getCategories');
    if (resCat.success) {
        let html = '<option value="">-- Select Category --</option>';
        resCat.data.forEach(c => html += `<option value="${c.CategoryID}">${c.CategoryName}</option>`);
        document.getElementById('add-category').innerHTML = html;
    }
    const resSup = await apiRequest('getSuppliers');
    if (resSup.success) {
        let html = '<option value="">-- Select Supplier --</option>';
        resSup.data.forEach(s => html += `<option value="${s.SupplierID}">${s.SupplierName}</option>`);
        document.getElementById('add-supplier').innerHTML = html;
    }
}

// --- FORMS ---
async function submitItem() {
    const payload = { 
        ItemCode: document.getElementById('add-code').value, 
        ItemName: document.getElementById('add-name').value, 
        CategoryID: document.getElementById('add-category').value, 
        Supplier: document.getElementById('add-supplier').value, 
        UnitOfMeasure: document.getElementById('add-uom').value, 
        MinimumStockLevel: document.getElementById('add-min').value, 
        UnitCost: document.getElementById('add-cost').value, 
        Brand: document.getElementById('add-brand').value 
    };
    const res = await apiRequest('addItem', payload);
    if (res.success) { alert(`Item Added! Code: ${res.qrCode}`); showScreen('screen-dashboard'); initDashboard(); } 
    else { alert("Error: " + res.message); }
}

async function submitReceive() {
    const itemId = document.getElementById('rec-item').value;
    const qty = document.getElementById('rec-qty').value;
    const ref = document.getElementById('rec-ref').value;
    const cost = document.getElementById('rec-cost').value;
    const photoInput = document.getElementById('rec-photo');
    
    if (!itemId || !qty) return alert("Select item and quantity");

    const btn = event.target;
    btn.innerText = "Saving..."; btn.disabled = true;

    let photoUrl = "";
    let offlineId = 'OFF-' + new Date().getTime() + '-' + Math.random().toString(36).substring(7);

    if (photoInput.files.length > 0 && navigator.onLine) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const upRes = await apiRequest('uploadPhoto', { base64: e.target.result, filename: photoInput.files[0].name });
            if (upRes.success) photoUrl = upRes.url;
            executeSave(itemId, qty, ref, cost, photoUrl, offlineId, btn);
        };
        reader.readAsDataURL(photoInput.files[0]);
    } else {
        executeSave(itemId, qty, ref, cost, "", offlineId, btn);
    }
}

async function executeSave(itemId, qty, ref, cost, photoUrl, offlineId, btn) {
    let finalNotes = `Ref: ${ref} | Cost: $${cost} | Photo: ${photoUrl} | OfflineID: ${offlineId}`;
    const payload = { ItemID: itemId, Quantity: qty, MovementType: 'RECEIVE', Notes: finalNotes };

    if (navigator.onLine) {
        try {
            const res = await apiRequest('stockMovement', payload);
            if (res.success) { alert("Stock Saved!"); showScreen('screen-dashboard'); initDashboard(); }
            else { alert("Error: " + res.message); }
        } catch(e) { saveOffline(itemId, qty, 'RECEIVE', finalNotes, offlineId); }
    } else {
        saveOffline(itemId, qty, 'RECEIVE', finalNotes, offlineId);
    }
    btn.innerText = "Record Receipt"; btn.disabled = false;
}

async function submitIssue() {
    const itemId = document.getElementById('iss-item').value;
    const qty = document.getElementById('iss-qty').value;
    if (!itemId || !qty) return alert("Select item and quantity");
    
    const res = await apiRequest('stockMovement', { ItemID: itemId, Quantity: qty, MovementType: 'ISSUE' });
    if (res.success) { alert("Stock Issued!"); showScreen('screen-dashboard'); initDashboard(); } 
    else { alert("Error: " + res.message); }
}

function saveOffline(itemId, qty, type, notes, offlineId) {
    const tx = db.transaction(["syncQueue"], "readwrite");
    tx.objectStore("syncQueue").add({ offlineId: offlineId, ItemID: itemId, Quantity: qty, MovementType: type, Notes: notes, UserID: currentUser.id });
    tx.oncomplete = function() {
        alert("📶 Offline! Saved to phone. Will sync when internet returns.");
        showScreen('screen-dashboard');
    };
}

async function syncOfflineData() {
    if (!navigator.onLine) return alert("Cannot sync. No internet.");
    const tx = db.transaction(["syncQueue"], "readonly");
    const req = tx.objectStore("syncQueue").getAll();
    
    req.onsuccess = async function() {
        const queue = req.result;
        if (queue.length === 0) return alert("No offline data to sync.");
        
        document.getElementById('sync-btn').innerText = "Syncing...";
        const res = await apiRequest('syncOfflineQueue', queue);
        if (res.success) {
            const clearTx = db.transaction(["syncQueue"], "readwrite");
            clearTx.objectStore("syncQueue").clear();
            alert("✅ " + res.message);
            initDashboard();
        }
        document.getElementById('sync-btn').innerText = "🔄 Sync";
    };
}

async function downloadReport(type) {
    const res = await apiRequest('getReport', { reportType: type });
    if (res.success) {
        const blob = new Blob([res.csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = window.URL.createObjectURL(blob); a.download = res.filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
}

window.onload = () => { if (sessionToken) initDashboard(); else showScreen('screen-login'); };