let html5QrCode;

async function openScanner() {
    showScreen('screen-scanner');
    document.getElementById('scan-result').classList.add('hidden');
    document.getElementById('reader').classList.remove('hidden');

    html5QrCode = new Html5Qrcode("reader");
    
    try {
        await html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onScanSuccess
        );
    } catch (err) {
        alert("Camera error: " + err);
    }
}

async function onScanSuccess(decodedText, decodedResult) {
    await html5QrCode.stop();
    document.getElementById('reader').classList.add('hidden');
    
    const resultBox = document.getElementById('scan-result');
    resultBox.classList.remove('hidden');
    document.getElementById('scanned-title').innerText = "Looking up...";
    document.getElementById('scanned-details').innerText = decodedText;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'lookupQR',
                token: sessionToken,
                payload: { qrCode: decodedText }
            })
        });
        const result = await response.json();

        if (result.success) {
            if (result.type === 'ITEM') {
                document.getElementById('scanned-title').innerText = result.data.ItemName;
                document.getElementById('scanned-details').innerHTML = 
                    `Type: Item<br>Stock: ${result.data.CurrentStock}<br>Code: ${result.data.ItemCode}`;
            } else {
                document.getElementById('scanned-title').innerText = result.data.ItemName;
                document.getElementById('scanned-details').innerHTML = 
                    `Type: Asset<br>Status: ${result.data.Status}<br>Tag: ${result.data.AssetTag}`;
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
    if (html5QrCode && html5QrCode.isScanning) {
        await html5QrCode.stop();
    }
    showScreen('screen-dashboard');
}