/**
 * Nexus WMS - Barcode & QR Code Label Generator Module
 */
const Barcodes = (() => {
  const DEFAULT_IMG = "https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&w=600&q=80";

  function renderBarcodeSheet() {
    const container = document.getElementById('barcode-container');
    if (!container) return;

    const products = Store.getProducts();

    container.innerHTML = products.map(item => `
      <div class="barcode-card">
        <img src="${item.image || DEFAULT_IMG}" style="width:52px; height:52px; border-radius:6px; object-fit:cover; border:1px solid #e5e7eb; flex-shrink:0;" onerror="this.style.display='none'">
        <div class="barcode-left">
          <div style="font-size:12px; font-weight:bold; margin-bottom:2px; color:black; text-align:center;">${item.name}</div>
          <div style="font-size:11px; color:#555; margin-bottom:4px;">เชลฟ์: <strong>${item.loc}</strong> (Zone ${item.zone})</div>
          <svg id="barcode-${item.id}"></svg>
        </div>
        <div class="qr-box" id="qr-${item.id}"></div>
      </div>
    `).join('');

    products.forEach(item => {
      try {
        JsBarcode(`#barcode-${item.id}`, item.barcode, {
          format: "EAN13",
          width: 1.5,
          height: 40,
          displayValue: true,
          fontSize: 10,
          lineColor: "#000"
        });
      } catch (e) {
        // Fallback to CODE128 if barcode format is not 13-digit EAN
        try {
          JsBarcode(`#barcode-${item.id}`, item.barcode, {
            format: "CODE128",
            width: 1.5,
            height: 40,
            displayValue: true,
            fontSize: 10,
            lineColor: "#000"
          });
        } catch (err) {}
      }

      const qrContainer = document.getElementById(`qr-${item.id}`);
      if (qrContainer && typeof QRCode !== 'undefined') {
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
          text: item.barcode,
          width: 70,
          height: 70,
          colorDark: "#000000",
          colorLight: "#ffffff"
        });
      }
    });
  }

  function printBarcodeSheet() {
    const slipDiv = document.getElementById('print-section');
    const barcodeContent = document.getElementById('barcode-container').innerHTML;

    slipDiv.innerHTML = `
      <div style="text-align:center; margin-bottom:20px; color:black;">
        <h2 style="font-size:24px;">ป้ายบาร์โค้ดสำหรับสแกนเข้าคลัง (Nexus WMS)</h2>
      </div>
      <div class="barcode-grid">${barcodeContent}</div>
    `;

    setTimeout(() => {
      window.print();
      slipDiv.innerHTML = '';
    }, 300);
  }

  // Real-time listener for location relocation
  if (typeof API !== 'undefined' && API.on) {
    API.on('LOCATION_MOVED', () => {
      const pageBarcodes = document.getElementById('page-barcodes');
      if (pageBarcodes && pageBarcodes.classList.contains('active')) {
        renderBarcodeSheet();
      }
    });
  }

  return {
    renderBarcodeSheet,
    printBarcodeSheet
  };
})();

if (typeof window !== 'undefined') {
  window.Barcodes = Barcodes;
}
