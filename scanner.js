let html5QrCode;
async function openScanner() {
    showScreen('screen-scanner');
    document.getElementById('scan-result').classList.add('hidden');
    document.getElementById('reader').classList.remove('hidden');

    html5QrCode = new Html5Qrcode("reader");
    try {
        await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, onScanSuccess);
    } catch (err) { alert("Camera error: " + err); }
}

async function onScanSuccess(decodedText) {
    await html5QrCode.stop();
    document.getElementById('reader').classList.add('hidden');
    document.getElementById('scan-result').classList.remove('hidden');
    document.getElementById('scanned-title').innerText = "Looking up...";
    document.getElementById('scanned-details').innerText = decodedText;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'lookupQR', token: sessionToken, payload: { qrCode: decodedText } })
        });
        const result = await response.json();

        if (result.success) {
            document.getElementById('scanned-title').innerText = result.data.ItemName;
            document.getElementById('scanned-details').innerHTML = `<strong>Stock:</strong> ${result.data.CurrentStock}<br><strong>Code:</strong> ${result.data.ItemCode}`;
        } else {
            document.getElementById('scanned-title').innerText = "Not Found";
            document.getElementById('scanned-details').innerText = result.message;
        }
    } catch (e) {
        document.getElementById('scanned-title').innerText = "Offline Error";
        document.getElementById('scanned-details').innerText = "Cannot lookup codes without internet.";
    }
}

async function closeScanner() {
    if (html5QrCode && html5QrCode.isScanning) { await html5QrCode.stop(); }
    showScreen('screen-dashboard');
}