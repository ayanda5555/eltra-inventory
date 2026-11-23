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

// --- DROPDOWNS ---
async function loadDropdowns() {
    const resItems = await apiRequest('getItems');
    if (resItems.success) {
        cachedItems = resItems.data;
        let html = '<option value="">-- Select Item --</option>';
        cachedItems.forEach(i => html += `<option value="${i.ItemID}">${i.ItemName} (Stock: ${i.CurrentStock})</option>`);
        if(document.getElementById('rec-item')) document.getElementById('rec-item').innerHTML = html;
        if(document.getElementById('iss-item')) document.getElementById('iss-item').innerHTML = html;
        if(document.getElementById('req-item')) document.getElementById('req-item').innerHTML = html;
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
        let html = '<option value="">-- Select Supplier (Optional) --</option>';
        resSup.data.forEach(s => html += `<option value="${s.SupplierID}">${s.SupplierName}</option>`);
        document.getElementById('add-supplier').innerHTML = html;
    }
}

// --- SUBMIT FORMS ---
async function submitItem() {
    const code = document.getElementById('add-code').value;
    const name = document.getElementById('add-name').value;
    const cat = document.getElementById('add-category').value;
    const sup = document.getElementById('add-supplier').value;
    const uom = document.getElementById('add-uom').value;
    const min = document.getElementById('add-min').value;
    const cost = document.getElementById('add-cost').value;
    const brand = document.getElementById('add-brand').value;

    if (!code || !name || !cat || !uom || !min) { alert("Please fill in all required fields"); return; }

    const payload = { 
        ItemCode: code, ItemName: name, CategoryID: cat, Supplier: sup, 
        UnitOfMeasure: uom, MinimumStockLevel: min, UnitCost: cost, Brand: brand 
    };
    
    const res = await apiRequest('addItem', payload);
    if (res.success) { 
        alert(`Item Added! Generated Code: ${res.qrCode}`); 
        showScreen('screen-dashboard'); 
        initDashboard(); 
    } else { 
        alert("Error: " + res.message); 
    }
}

async function submitReceive() {
    const itemId = document.getElementById('rec-item').value;
    const qty = document.getElementById('rec-qty').value;
    const ref = document.getElementById('rec-ref').value;
    if (!itemId || !qty) { alert("Select item and quantity"); return; }
    const payload = { ItemID: itemId, Quantity: qty, MovementType: 'RECEIVE', ReferenceNumber: ref, ToLocationID: 'LOC-001' };
    const res = await apiRequest('stockMovement', payload);
    if (res.success) { alert("Stock Received!"); showScreen('screen-dashboard'); initDashboard(); } 
    else { alert("Error: " + res.message); }
}

async function submitIssue() {
    const itemId = document.getElementById('iss-item').value;
    const qty = document.getElementById('iss-qty').value;
    if (!itemId || !qty) { alert("Select item and quantity"); return; }
    const payload = { ItemID: itemId, Quantity: qty, MovementType: 'ISSUE', FromLocationID: 'LOC-001' };
    const res = await apiRequest('stockMovement', payload);
    if (res.success) { alert("Stock Issued!"); showScreen('screen-dashboard'); initDashboard(); } 
    else { alert("Error: " + res.message); }
}

async function submitRequest() {
    const itemId = document.getElementById('req-item').value;
    const qty = document.getElementById('req-qty').value;
    const priority = document.getElementById('req-priority').value;
    if (!itemId || !qty) { alert("Select item and quantity"); return; }
    const payload = { ItemID: itemId, Quantity: qty, Priority: priority };
    const res = await apiRequest('createRequest', payload);
    if (res.success) { alert("Request Submitted!"); showScreen('screen-dashboard'); } 
    else { alert("Error: " + res.message); }
}

async function loadAssets() {
    const resAssets = await apiRequest('getAssets');
    if (resAssets.success) {
        cachedAssets = resAssets.data;
        let html = '<option value="">-- Select Asset --</option>';
        cachedAssets.forEach(a => html += `<option value="${a.AssetID}">${a.ItemName} (${a.Status})</option>`);
        if(document.getElementById('asset-select')) document.getElementById('asset-select').innerHTML = html;
        if(document.getElementById('maint-asset')) document.getElementById('maint-asset').innerHTML = html;
    }
}

async function submitAssetAssignment() {
    const assetId = document.getElementById('asset-select').value;
    const userId = document.getElementById('asset-user').value;
    const condition = document.getElementById('asset-condition').value;
    if (!assetId) { alert("Select an asset first"); return; }
    let payload = { AssetID: assetId, Condition: condition };
    if (userId.trim() === '') {
        payload.ToUserID = ''; payload.ToLocationID = 'LOC-001'; payload.Status = 'Available'; payload.MovementType = 'RETURN';
    } else {
        payload.ToUserID = userId.trim(); payload.ToLocationID = 'LOC-005'; payload.Status = 'Assigned'; payload.MovementType = 'ASSIGN';
    }
    const res = await apiRequest('assetMovement', payload);
    if (res.success) { alert("Asset Updated!"); showScreen('screen-dashboard'); initDashboard(); } 
    else { alert("Error: " + res.message); }
}

async function submitMaintenance() {
    const assetId = document.getElementById('maint-asset').value;
    const fault = document.getElementById('maint-fault').value;
    const work = document.getElementById('maint-work').value;
    const cost = document.getElementById('maint-cost').value;
    if (!assetId || !fault) { alert("Select asset and enter fault"); return; }
    const payload = { AssetID: assetId, FaultReported: fault, WorkDone: work, Cost: cost };
    const res = await apiRequest('logMaintenance', payload);
    if (res.success) { alert("Maintenance Logged!"); showScreen('screen-dashboard'); initDashboard(); } 
    else { alert("Error: " + res.message); }
}

async function downloadReport(type) {
    try {
        const res = await apiRequest('getReport', { reportType: type });
        if (res.success) {
            const blob = new Blob([res.csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('hidden', '');
            a.setAttribute('href', url);
            a.setAttribute('download', res.filename);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            alert("Error generating report: " + res.message);
        }
    } catch (e) {
        alert("Network error while downloading report.");
    }
}

window.onload = () => { if (sessionToken) initDashboard(); else showScreen('screen-login'); };