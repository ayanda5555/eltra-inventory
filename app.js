const API_URL = "https://script.google.com/macros/s/AKfycbyDcuWuG2Ho6Qq4X9XJ_-zZPmSjxKRYEFqJbBo4aASlimQCfnjregH2bv5a04GLwlH8/exec";
let sessionToken = localStorage.getItem('eltra_token');
let currentUser = JSON.parse(localStorage.getItem('eltra_user'));
let currentPOItems = [];
let cachedUsers = [];

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
    const isOnline = navigator.onLine;
    document.getElementById('offline-banner').style.display = isOnline ? 'none' : 'block';
    const netEl = document.getElementById('net-status');
    if (netEl) {
        netEl.innerHTML = isOnline ? '🟢 Online' : '🔴 Offline';
        netEl.style.color = isOnline ? '#28a745' : '#dc3545';
    }
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
    } catch (e) { alert("Network error."); }
}

function doLogout() { localStorage.clear(); sessionToken = null; showScreen('screen-login'); }

// --- DASHBOARD ---
async function initDashboard() {
    showScreen('screen-dashboard');
    document.getElementById('welcome-text').innerText = currentUser.name.split(' ')[0];
    checkNetwork();

    // HIDE ADMIN TAB FOR NON-ADMINS
    if (currentUser.role === 'Admin' || currentUser.role === 'IT Admin') {
        document.getElementById('admin-section').style.display = 'block';
    } else {
        document.getElementById('admin-section').style.display = 'none';
    }
    
    try {
        const result = await apiRequest('getDashboard');
        if (result.success) {
            document.getElementById('stat-items').innerText = result.data.totalItems;
            document.getElementById('stat-assets').innerText = result.data.activeAssignments || 0;
            document.getElementById('stat-approvals').innerText = result.data.pendingApprovals || 0;
            
            const lowCount = result.data.lowStockAlerts.length;
            document.getElementById('stat-low-stock').innerText = lowCount;

            const ul = document.getElementById('attention-list');
            if (lowCount === 0) {
                ul.innerHTML = '<li style="padding:10px 0; color:#666;">✅ No critical alerts. All stock levels are fine!</li>';
            } else {
                ul.innerHTML = '';
                result.data.lowStockAlerts.forEach(i => {
                    const uom = i.uom || 'units';
                    ul.innerHTML += `
                        <li style="padding:10px 0; border-bottom:1px solid #eee; font-size:13px;">
                            <strong style="color:var(--danger);">${i.name}</strong> (${i.code})<br>
                            <span style="color:#555;">Available: ${i.stock} ${uom} | Minimum: ${i.min} ${uom}</span>
                        </li>
                    `;
                });
            }
            
            document.getElementById('last-sync').innerText = "Last synced: Just now";
        }
    } catch(e) { console.log("Offline, using cached dashboard"); }
}

// --- DROPDOWNS & LISTS ---
async function loadDropdowns() {
    const res = await apiRequest('getItems');
    if (res.success) {
        let html = '<option value="">-- Select Item --</option>';
        res.data.forEach(i => html += `<option value="${i.ItemID}">${i.ItemName} (Stock: ${i.CurrentStock})</option>`);
        if(document.getElementById('iss-item')) document.getElementById('iss-item').innerHTML = html;
        if(document.getElementById('req-item')) document.getElementById('req-item').innerHTML = html;
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

async function loadAssets() {
    const resAssets = await apiRequest('getAssets');
    if (resAssets.success) {
        let html = '<option value="">-- Select Asset --</option>';
        resAssets.data.forEach(a => html += `<option value="${a.AssetID}">${a.ItemName} (${a.Status})</option>`);
        if(document.getElementById('asset-select')) document.getElementById('asset-select').innerHTML = html;
        if(document.getElementById('maint-asset')) document.getElementById('maint-asset').innerHTML = html;
    }
}

async function loadSupplierList() {
    const res = await apiRequest('getSuppliers');
    if (res.success) {
        let html = '';
        res.data.forEach(s => html += `<li style="padding:10px 0; border-bottom:1px solid #eee;"><span>${s.SupplierName}</span> <strong>${s.Phone || ''}</strong></li>`);
        document.getElementById('supplier-list').innerHTML = html || '<li>No suppliers found.</li>';
    }
}

// --- USER MANAGEMENT WITH EDIT & FILTER ---
async function loadUserList() {
    const res = await apiRequest('getUsers');
    if (res.success) {
        // Only keep users where Active is TRUE
        cachedUsers = res.data.filter(u => u.Active === true || u.Active === 'TRUE');
        
        let html = '';
        cachedUsers.forEach(u => {
            html += `<li style="padding:10px 0; border-bottom:1px solid #eee;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${u.EmployeeName}</strong> (${u.UserID})<br>
                        <span style="font-size:12px; color:#666;">Role: ${u.Role} | Phone: ${u.Phone || 'N/A'}</span>
                    </div>
                    <button class="btn small" style="background:#0056b3; color:white;" onclick="editUser('${u.UserID}')">Edit</button>
                </div>
            </li>`;
        });
        document.getElementById('user-list').innerHTML = html || '<li>No active users found.</li>';
    }
}

function editUser(userId) {
    const user = cachedUsers.find(u => u.UserID === userId);
    if (!user) return;

    document.getElementById('user-form-title').innerText = "Edit User: " + user.UserID;
    document.getElementById('usr-edit-id').value = user.UserID;
    document.getElementById('usr-id').value = user.UserID;
    document.getElementById('usr-id').disabled = true; // Cannot change ID
    document.getElementById('usr-name').value = user.EmployeeName;
    document.getElementById('usr-role').value = user.Role;
    document.getElementById('usr-phone').value = user.Phone;
    document.getElementById('usr-email').value = user.Email;
    document.getElementById('usr-pin').value = ''; // Blank so it doesn't overwrite unless typed

    document.getElementById('user-save-btn').innerText = "Update User";
    document.getElementById('user-cancel-btn').style.display = 'block';
    document.getElementById('user-form-box').scrollIntoView({ behavior: 'smooth' });
}

function resetUserForm() {
    document.getElementById('user-form-title').innerText = "Create New User";
    document.getElementById('usr-edit-id').value = "";
    document.getElementById('usr-id').value = "";
    document.getElementById('usr-id').disabled = false;
    document.getElementById('usr-name').value = "";
    document.getElementById('usr-role').value = "Admin";
    document.getElementById('usr-phone').value = "";
    document.getElementById('usr-email').value = "";
    document.getElementById('usr-pin').value = "";

    document.getElementById('user-save-btn').innerText = "Create User";
    document.getElementById('user-cancel-btn').style.display = 'none';
}

async function submitUser() {
    const editId = document.getElementById('usr-edit-id').value;
    const payload = {
        UserID: document.getElementById('usr-id').value,
        EmployeeName: document.getElementById('usr-name').value,
        Role: document.getElementById('usr-role').value,
        Phone: document.getElementById('usr-phone').value,
        Email: document.getElementById('usr-email').value,
        PIN: document.getElementById('usr-pin').value
    };

    if (!payload.UserID || !payload.EmployeeName) {
        return alert("User ID and Name are required.");
    }
    if (!editId && !payload.PIN) {
        return alert("PIN is required for new users.");
    }

    let res;
    if (editId) {
        res = await apiRequest('updateUser', payload);
    } else {
        res = await apiRequest('addUser', payload);
    }

    if (res.success) {
        alert("✅ " + res.message);
        resetUserForm();
        loadUserList();
    } else {
        alert("Error: " + res.message);
    }
}

// --- PURCHASE ORDERS ---
async function loadPOList() {
    const res = await apiRequest('getPOs');
    if (res.success) {
        let html = '';
        res.data.forEach(po => {
            html += `
                <li style="padding:10px 0; border-bottom:1px solid #eee;">
                    <strong>${po.PONumber}</strong> - ${po.SupplierName}<br>
                    <span style="font-size:12px; color:#666;">Status: ${po.Status} | Total: $${po.TotalAmount || 0}</span>
                </li>
            `;
        });
        document.getElementById('po-list').innerHTML = html || '<li>No Purchase Orders found.</li>';
    }
}

async function loadPOListForReceiving() {
    const res = await apiRequest('getPOs');
    if (res.success) {
        let html = '<option value="">-- Select Purchase Order --</option>';
        res.data.forEach(po => html += `<option value="${po.PurchaseOrderID}">${po.PONumber} - ${po.SupplierName}</option>`);
        document.getElementById('rec-po-select').innerHTML = html;
        document.getElementById('po-items-container').innerHTML = '<p>Select a PO to load items</p>';
    }
}

// --- FORMS ---
async function submitSupplier() {
    const name = document.getElementById('sup-name').value;
    const contact = document.getElementById('sup-contact').value;
    const phone = document.getElementById('sup-phone').value;
    if (!name) return alert("Enter Supplier Name");
    const res = await apiRequest('addSupplier', { SupplierName: name, ContactPerson: contact, Phone: phone });
    if (res.success) { alert("Supplier Saved!"); document.getElementById('sup-name').value = ''; loadSupplierList(); }
}

async function loadPOForm() {
    const resSup = await apiRequest('getSuppliers');
    if (resSup.success) {
        let html = '<option value="">-- Select Supplier --</option>';
        resSup.data.forEach(s => html += `<option value="${s.SupplierID}">${s.SupplierName}</option>`);
        document.getElementById('po-supplier').innerHTML = html;
    }
    const resItems = await apiRequest('getItems');
    if (resItems.success) {
        let html = '<option value="">-- Select Item --</option>';
        resItems.data.forEach(i => html += `<option value="${i.ItemID}">${i.ItemName}</option>`);
        document.getElementById('po-item').innerHTML = html;
    }
}

async function submitPO() {
    const supplierId = document.getElementById('po-supplier').value;
    const date = document.getElementById('po-date').value;
    const itemId = document.getElementById('po-item').value;
    const qty = document.getElementById('po-qty').value;
    const price = document.getElementById('po-price').value;
    if (!supplierId || !itemId || !qty) return alert("Fill in all fields");
    
    const supplierName = document.getElementById('po-supplier').options[document.getElementById('po-supplier').selectedIndex].text;
    const itemName = document.getElementById('po-item').options[document.getElementById('po-item').selectedIndex].text;

    const payload = {
        SupplierID: supplierId, SupplierName: supplierName, ExpectedDelivery: date,
        Items: [{ ItemID: itemId, ItemName: itemName, Quantity: Number(qty), UnitPrice: Number(price) }]
    };
    const res = await apiRequest('createPO', payload);
    if (res.success) { alert(`PO Generated: ${res.poNumber}`); showScreen('screen-po-list'); loadPOList(); }
}

async function loadPOItemsForReceive() {
    const poId = document.getElementById('rec-po-select').value;
    if (!poId) return;
    const res = await apiRequest('getPOItems');
    if (res.success) {
        const items = res.data.filter(i => i.PurchaseOrderID === poId);
        currentPOItems = items;
        let html = '';
        items.forEach((item, index) => {
            html += `
                <div style="border-bottom:1px solid #ccc; padding:10px 0;">
                    <strong>${item.ItemName}</strong> (Ordered: ${item.QuantityOrdered})<br>
                    <label style="font-size:12px; margin-top:5px; display:block;">Qty Received:</label>
                    <input type="number" id="rec-qty-${index}" value="${item.QuantityOrdered}" style="width:100%; padding:5px; margin-bottom:5px;">
                    <label style="font-size:12px; display:block;">Qty Rejected/Damaged:</label>
                    <input type="number" id="rec-rej-${index}" value="0" style="width:100%; padding:5px;">
                </div>
            `;
        });
        document.getElementById('po-items-container').innerHTML = html || '<p>No items found for this PO.</p>';
    }
}

async function submitGoodsReceived() {
    const poId = document.getElementById('rec-po-select').value;
    const poNumber = document.getElementById('rec-po-select').options[document.getElementById('rec-po-select').selectedIndex].text;
    if (!poId) return alert("Select a PO");

    let receivedItems = [];
    currentPOItems.forEach((item, index) => {
        const qtyRec = Number(document.getElementById(`rec-qty-${index}`).value);
        const qtyRej = Number(document.getElementById(`rec-rej-${index}`).value);
        if (qtyRec > 0) {
            receivedItems.push({ ItemID: item.ItemID, ItemCode: item.ItemCode, ItemName: item.ItemName, QtyReceived: qtyRec, QtyRejected: qtyRej, UnitPrice: item.UnitPrice });
        }
    });
    if (receivedItems.length === 0) return alert("Enter at least one received quantity");

    const payload = { POID: poId, PONumber: poNumber, Items: receivedItems };
    const btn = event.target; btn.innerText = "Saving..."; btn.disabled = true;
    const res = await apiRequest('receiveGoods', payload);
    btn.innerText = "Confirm Receipt"; btn.disabled = false;

    if (res.success) { alert("✅ Goods Received! Stock updated."); showScreen('screen-po-list'); initDashboard(); }
}

async function submitItem() {
    const payload = { 
        ItemCode: document.getElementById('add-code').value, ItemName: document.getElementById('add-name').value, 
        CategoryID: document.getElementById('add-category').value, Supplier: document.getElementById('add-supplier').value, 
        UnitOfMeasure: document.getElementById('add-uom').value, MinimumStockLevel: document.getElementById('add-min').value, 
        UnitCost: document.getElementById('add-cost').value 
    };
    const res = await apiRequest('addItem', payload);
    if (res.success) { alert(`Item Added!`); showScreen('screen-dashboard'); initDashboard(); } 
}

async function submitReceive() {
    const itemId = document.getElementById('rec-item').value;
    const qty = document.getElementById('rec-qty').value;
    if (!itemId || !qty) return alert("Select item and quantity");
    const payload = { ItemID: itemId, Quantity: qty, MovementType: 'RECEIVE', Notes: document.getElementById('rec-ref').value };
    const res = await apiRequest('stockMovement', payload);
    if (res.success) { alert("Stock Saved!"); showScreen('screen-dashboard'); initDashboard(); }
}

async function submitIssue() {
    const itemId = document.getElementById('iss-item').value;
    const qty = document.getElementById('iss-qty').value;
    if (!itemId || !qty) return alert("Select item and quantity");
    const res = await apiRequest('stockMovement', { ItemID: itemId, Quantity: qty, MovementType: 'ISSUE' });
    if (res.success) { alert("Stock Issued!"); showScreen('screen-dashboard'); initDashboard(); } 
}

async function submitRequest() {
    const itemId = document.getElementById('req-item').value;
    const qty = document.getElementById('req-qty').value;
    if (!itemId || !qty) return alert("Select item and quantity");
    const res = await apiRequest('createRequest', { ItemID: itemId, Quantity: qty });
    if (res.success) { alert("Request Submitted!"); showScreen('screen-dashboard'); } 
}

async function submitAssetAssignment() {
    const assetId = document.getElementById('asset-select').value;
    const userId = document.getElementById('asset-user').value;
    if (!assetId) return alert("Select an asset first");
    let payload = { AssetID: assetId, Condition: 'Good' };
    if (userId.trim() === '') {
        payload.ToUserID = ''; payload.ToLocationID = 'LOC-001'; payload.Status = 'Available'; payload.MovementType = 'RETURN';
    } else {
        payload.ToUserID = userId.trim(); payload.ToLocationID = 'LOC-005'; payload.Status = 'Assigned'; payload.MovementType = 'ASSIGN';
    }
    const res = await apiRequest('assetMovement', payload);
    if (res.success) { alert("Asset Updated!"); showScreen('screen-dashboard'); initDashboard(); } 
}

async function submitMaintenance() {
    const assetId = document.getElementById('maint-asset').value;
    const fault = document.getElementById('maint-fault').value;
    const work = document.getElementById('maint-work').value;
    const cost = document.getElementById('maint-cost').value;
    if (!assetId || !fault) return alert("Select asset and enter fault");
    const res = await apiRequest('logMaintenance', { AssetID: assetId, FaultReported: fault, WorkDone: work, Cost: cost });
    if (res.success) { alert("Maintenance Logged!"); showScreen('screen-dashboard'); initDashboard(); } 
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