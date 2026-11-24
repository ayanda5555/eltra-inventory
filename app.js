const API_URL = "https://script.google.com/macros/s/AKfycbyDcuWuG2Ho6Qq4X9XJ_-zZPmSjxKRYEFqJbBo4aASlimQCfnjregH2bv5a04GLwlH8/exec";
let sessionToken = localStorage.getItem('eltra_token');
let currentUser = JSON.parse(localStorage.getItem('eltra_user'));
let currentPOItems = [];

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
    document.getElementById('welcome-text').innerText = `Hi, ${currentUser.name.split(' ')[0]}`;
    try {
        const result = await apiRequest('getDashboard');
        if (result.success) {
            document.getElementById('stat-items').innerText = result.data.totalItems;
            const ul = document.getElementById('low-stock-list');
            ul.innerHTML = result.data.lowStockAlerts.length === 0 ? '<li>All stock is fine!</li>' : '';
            result.data.lowStockAlerts.forEach(i => ul.innerHTML += `<li><span>${i.name}</span> <strong>${i.stock} / ${i.min}</strong></li>`);
        }
    } catch(e) { console.log("Offline"); }
}

// --- SUPPLIERS & PO LOGIC (NEW) ---
async function loadSupplierList() {
    const res = await apiRequest('getSuppliers');
    if (res.success) {
        let html = '';
        res.data.forEach(s => html += `<li><span>${s.SupplierName}</span> <strong>${s.Phone || ''}</strong></li>`);
        document.getElementById('supplier-list').innerHTML = html || '<li>No suppliers found.</li>';
    }
}

async function submitSupplier() {
    const name = document.getElementById('sup-name').value;
    const contact = document.getElementById('sup-contact').value;
    const phone = document.getElementById('sup-phone').value;
    if (!name) return alert("Enter Supplier Name");
    
    const res = await apiRequest('addSupplier', { SupplierName: name, ContactPerson: contact, Phone: phone });
    if (res.success) { alert("Supplier Saved!"); document.getElementById('sup-name').value = ''; loadSupplierList(); }
    else { alert("Error: " + res.message); }
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
    if (res.success) { alert(`PO Generated: ${res.poNumber}`); showScreen('screen-dashboard'); }
    else { alert("Error: " + res.message); }
}

async function loadPOList() {
    const res = await apiRequest('getPOs');
    if (res.success) {
        let html = '<option value="">-- Select Purchase Order --</option>';
        res.data.forEach(po => html += `<option value="${po.PurchaseOrderID}">${po.PONumber} - ${po.SupplierName}</option>`);
        document.getElementById('rec-po-select').innerHTML = html;
        document.getElementById('po-items-container').innerHTML = '<p>Select a PO to load items</p>';
    }
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
            receivedItems.push({
                ItemID: item.ItemID, ItemCode: item.ItemCode, ItemName: item.ItemName,
                QtyReceived: qtyRec, QtyRejected: qtyRej, UnitPrice: item.UnitPrice
            });
        }
    });

    if (receivedItems.length === 0) return alert("Enter at least one received quantity");

    const payload = { POID: poId, PONumber: poNumber, Items: receivedItems };
    const btn = event.target; btn.innerText = "Saving..."; btn.disabled = true;

    const res = await apiRequest('receiveGoods', payload);
    btn.innerText = "Confirm Receipt"; btn.disabled = false;

    if (res.success) {
        alert("✅ Goods Received! Stock updated.");
        showScreen('screen-dashboard'); initDashboard();
    } else { alert("Error: " + res.message); }
}

// --- STANDARD INVENTORY LOGIC ---
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

async function submitItem() {
    const payload = { 
        ItemCode: document.getElementById('add-code').value, 
        ItemName: document.getElementById('add-name').value, 
        CategoryID: document.getElementById('add-category').value, 
        Supplier: document.getElementById('add-supplier').value, 
        UnitOfMeasure: document.getElementById('add-uom').value, 
        MinimumStockLevel: document.getElementById('add-min').value, 
        UnitCost: document.getElementById('add-cost').value 
    };
    const res = await apiRequest('addItem', payload);
    if (res.success) { alert(`Item Added!`); showScreen('screen-dashboard'); initDashboard(); } 
    else { alert("Error: " + res.message); }
}

async function submitReceive() {
    const itemId = document.getElementById('rec-item').value;
    const qty = document.getElementById('rec-qty').value;
    if (!itemId || !qty) return alert("Select item and quantity");

    const payload = { ItemID: itemId, Quantity: qty, MovementType: 'RECEIVE', Notes: document.getElementById('rec-ref').value };
    const res = await apiRequest('stockMovement', payload);
    if (res.success) { alert("Stock Saved!"); showScreen('screen-dashboard'); initDashboard(); }
    else { alert("Error: " + res.message); }
}

async function submitIssue() {
    const itemId = document.getElementById('iss-item').value;
    const qty = document.getElementById('iss-qty').value;
    if (!itemId || !qty) return alert("Select item and quantity");
    const res = await apiRequest('stockMovement', { ItemID: itemId, Quantity: qty, MovementType: 'ISSUE' });
    if (res.success) { alert("Stock Issued!"); showScreen('screen-dashboard'); initDashboard(); } 
    else { alert("Error: " + res.message); }
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