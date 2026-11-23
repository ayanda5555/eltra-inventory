async function loadLabels() {
    const container = document.getElementById('label-container');
    container.innerHTML = "<p>Loading items and generating QR codes...</p>";

    try {
        const res = await apiRequest('getItems');
        
        if (res.success && res.data.length > 0) {
            container.innerHTML = '';
            
            res.data.forEach(item => {
                const card = document.createElement('div');
                card.className = 'label-card';
                
                const qrText = item.QRCode || item.ItemID; 
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrText)}`;
                
                card.innerHTML = `
                    <h4>ELTRA-CONNECT</h4>
                    <img class="qr-img" src="${qrUrl}" alt="QR Code" crossorigin="anonymous">
                    <p style="font-weight:bold; margin-top:5px;">${item.ItemName}</p>
                    <p style="font-size:8px; color:#555;">${item.ItemCode} | ${qrText}</p>
                `;
                container.appendChild(card);
            });
        } else {
            container.innerHTML = "<p>No items found to print.</p>";
        }
    } catch (error) {
        container.innerHTML = "<p>Error loading items. Check your internet connection.</p>";
    }
}