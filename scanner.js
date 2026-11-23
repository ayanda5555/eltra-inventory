let html5QrCode;

async function openScanner() {
    showScreen('screen-scanner');
    document.getElementById('scan-result').classList.add('hidden');
    document.getElementById('reader').classList.remove('hidden');

    html5QrCode = new Html5Qrcode("reader");
    try {
        await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, onScanSuccess);
    } catch (err) { alert("Camera error: " + err); }
}

async function onScanSuccess(decodedText, decodedResult) {
    await html5QrCode.stop();
    document.getElementById('reader').classList.add('hidden');
    
    const resultBox = document.getElementById('scan-result');
    const actionsBox = document.getElementById('scan-actions');
    
    resultBox.classList.remove('hidden');
    actionsBox.innerHTML = ''; 
    document.getElementById('scanned-title').innerText = "Looking up...";
    document.getElementById('scanned-details').innerText = decodedText;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'lookupQR', token: sessionToken, payload: { qrCode: decodedText } })
        });
        const result = await response.json();

        if (result.success) {
            const data = result.data;
            if (result.type === 'ITEM') {
                document.getElementById('scanned-title').innerText = data.ItemName;
                document.getElementById('scanned-details').innerHTML = `<strong>Type:</strong> Item<br><strong>Stock:</strong> ${data.CurrentStock}<br><strong>Code:</strong> ${data.ItemCode}`;
                actionsBox.innerHTML = `<button onclick="scanActionIssue('${data.ItemID}')" class="btn primary">📤 Issue This Item</button>`;
            } else {
                document.getElementById('scanned-title').innerText = data.ItemName;
                document.getElementById('scanned-details').innerHTML = `<strong>Type:</strong> Asset<br><strong>Status:</strong> ${data.Status}<br><strong>Assigned To:</strong> ${data.AssignedUserID || 'Nobody'}`;
                actionsBox.innerHTML = `<button onclick="scanActionAssignAsset('${data.AssetID}')" class="btn primary">🛠️ Assign / Return Asset</button>`;
            }
        } else {
            document.getElementById('scanned-title').innerText = "Not Found";
            document.getElementById('scanned-details').innerText = result.message;
        }
    } catch (e) {
        document.getElementById('scanned-title').innerText = "Error";
        document.getElementById('scanned-details').innerText = "Could not connect to server.";
    }
}

async function closeScanner() {
    if (html5QrCode && html5QrCode.isScanning) { await html5QrCode.stop(); }
    showScreen('screen-dashboard');
}

async function scanActionIssue(itemId) {
    const qty = prompt("Enter quantity to issue:");
    if (!qty || isNaN(qty) || qty <= 0) return;
    const payload = { ItemID: itemId, Quantity: qty, MovementType: 'ISSUE', FromLocationID: 'LOC-001' };
    const res = await apiRequest('stockMovement', payload);
    if (res.success) { alert("Stock Issued!"); closeScanner(); initDashboard(); } 
    else { alert("Error: " + res.message); }
}

async function scanActionAssignAsset(assetId) {
    const technicianId = prompt("Enter Technician User ID (e.g. USR-003)\nOR leave blank and click OK to Return to Store:");
    if (technicianId === null) return; 
    let payload = { AssetID: assetId, Condition: 'Good', MovementType: 'ASSIGN' };
    if (technicianId.trim() === '') {
        payload.ToUserID = ''; payload.ToLocationID = 'LOC-001'; payload.Status = 'Available'; payload.MovementType = 'RETURN';
    } else {
        payload.ToUserID = technicianId.trim(); payload.ToLocationID = 'LOC-005'; payload.Status = 'Assigned';
    }
    const res = await apiRequest('assetMovement', payload);
    if (res.success) { alert("Asset Updated!"); closeScanner(); initDashboard(); } 
    else { alert("Error: " + res.message); }
}