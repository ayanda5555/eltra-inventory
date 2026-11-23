const API_URL = "https://script.google.com/macros/s/AKfycbyDcuWuG2Ho6Qq4X9XJ_-zZPmSjxKRYEFqJbBo4aASlimQCfnjregH2bv5a04GLwlH8/exec";

let sessionToken = localStorage.getItem('eltra_token');
let currentUser = JSON.parse(localStorage.getItem('eltra_user'));
let cachedItems = [];
let cachedAssets = [];

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

async function apiRequest(action, payload = {}) {
    const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: action, token: sessionToken, payload: payload })
    });
    return await response.json();
}

async function doLogin() {
    const userCode = document.getElementById('login-user').value;
    const pin = document.getElementById('login-pin').value;
    const errorEl = document.getElementById('login-error');
    
    if (!userCode || !pin) { errorEl.innerText = "Enter ID and PIN"; return; }
    errorEl.innerText = "Logging in...";

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', payload: { userCode, pin, deviceInfo: navigator.userAgent } })
        });
        const result = await res.json();

        if (result.success) {
            localStorage.setItem('eltra_token', result.token);
            localStorage.setItem('eltra_user', JSON.stringify(result.user));
            sessionToken = result.token;
            currentUser = result.user;
            initDashboard();
        } else {
            errorEl.innerText = result.message;
        }
    } catch (e) { errorEl.innerText = "Network error"; }
}

function doLogout() {
    localStorage.clear();
    sessionToken = null;
    showScreen('screen-login');
}

async function initDashboard() {
    showScreen('screen-dashboard');
    document.getElementById('welcome-text').innerText = `Hi, ${currentUser.name.split(' ')[0]}`;
    
    try {
        const result = await apiRequest('getDashboard');
        if (result.success) {
            document.getElementById('stat-items').innerText = result.data.totalItems;
            document.getElementById('stat-assets').innerText = result.data.activeAssignments;

            const ul = document.getElementById('low-stock-list');
            ul.innerHTML = '';
            if (result.data.lowStockAlerts.length === 0) {
                ul.innerHTML = '<li>All stock levels are fine!</li>';
            } else {
                result.data.lowStockAlerts.forEach(item => {
                    ul.innerHTML += `<li><span>${item.name}</span> <strong>${item.stock} / ${item.min}</strong></li>`;
                });
            }
        } else { doLogout(); }
    } catch (e) { console.error(e); }
}

// --- STOCK FORMS ---
async function loadDropdowns() {
    const resItems = await apiRequest('getItems');
    if (resItems.success) {
        cachedItems = resItems.data;
        let html = '<option value="">-- Select Item --</option>';
        cachedItems.forEach(i => html += `<option value="${i.ItemID}">${i.ItemName} (Stock: ${i.CurrentStock})</option>`);
        
        if(document.getElementById('rec-item')) document.getElementById('rec-item').innerHTML = html;
        if(document.getElementById('iss-item')) document.getElementById('iss-item').innerHTML = html;
    }
}

async function submitReceive() {
    const itemId = document.getElementById('rec-item').value;
    const qty = document.getElementById('rec-qty').value;
    const ref = document.getElementById('rec-ref').value;
    
    if (!itemId || !qty) { alert("Select item and quantity"); return; }

    const payload = { ItemID: itemId, Quantity: qty, MovementType: 'RECEIVE', ReferenceNumber: ref, ToLocationID: 'LOC-001' };
    const res = await apiRequest('stockMovement', payload);

    if (res.success) {
        alert("Stock Received Successfully!");
        showScreen('screen-dashboard');
        initDashboard();
    } else {
        alert("Error: " + res.message);
    }
}

async function submitIssue() {
    const itemId = document.getElementById('iss-item').value;
    const qty = document.getElementById('iss-qty').value;
    
    if (!itemId || !qty) { alert("Select item and quantity"); return; }

    const payload = { ItemID: itemId, Quantity: qty, MovementType: 'ISSUE', FromLocationID: 'LOC-001' };
    const res = await apiRequest('stockMovement', payload);

    if (res.success) {
        alert("Stock Issued Successfully!");
        showScreen('screen-dashboard');
        initDashboard();
    } else {
        alert("Error: " + res.message);
    }
}

// --- ASSET FORMS ---
async function loadAssets() {
    const resAssets = await apiRequest('getAssets');
    if (resAssets.success) {
        cachedAssets = resAssets.data;
        let html = '<option value="">-- Select Asset --</option>';
        cachedAssets.forEach(a => html += `<option value="${a.AssetID}">${a.ItemName} (${a.Status})</option>`);
        if(document.getElementById('asset-select')) document.getElementById('asset-select').innerHTML = html;
    }
}

async function submitAssetAssignment() {
    const assetId = document.getElementById('asset-select').value;
    const userId = document.getElementById('asset-user').value;
    const condition = document.getElementById('asset-condition').value;
    
    if (!assetId) { alert("Select an asset first"); return; }

    let payload = { AssetID: assetId, Condition: condition };

    if (userId.trim() === '') {
        // Returning to store
        payload.ToUserID = '';
        payload.ToLocationID = 'LOC-001';
        payload.Status = 'Available';
        payload.MovementType = 'RETURN';
    } else {
        // Assigning to technician
        payload.ToUserID = userId.trim();
        payload.ToLocationID = 'LOC-005'; // Project Site A
        payload.Status = 'Assigned';
        payload.MovementType = 'ASSIGN';
    }

    const res = await apiRequest('assetMovement', payload);

    if (res.success) {
        alert("Asset Updated Successfully!");
        showScreen('screen-dashboard');
        initDashboard();
    } else {
        alert("Error: " + res.message);
    }
}

window.onload = () => { if (sessionToken) initDashboard(); else showScreen('screen-login'); };