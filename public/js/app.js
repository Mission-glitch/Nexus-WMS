/**
 * Nexus WMS - Main Application Controller
 */
const App = (() => {
  // Web Audio Context for Scanner Beeps
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playBeep(isSuccess) {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isSuccess) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn('Audio playback error', e);
    }
  }

  // Camera Scanner
  let html5QrcodeScanner = null;
  let activeCameraCallback = null;

  function openCamera(callback) {
    activeCameraCallback = callback;
    document.getElementById('camera-modal').style.display = 'flex';
    if (typeof Html5QrcodeScanner !== 'undefined') {
      html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      }, false);

      html5QrcodeScanner.render((decodedText) => {
        closeCamera();
        if (activeCameraCallback) activeCameraCallback(decodedText);
      }, (error) => {});
    }
  }

  function closeCamera() {
    document.getElementById('camera-modal').style.display = 'none';
    if (html5QrcodeScanner) {
      html5QrcodeScanner.clear().catch(e => console.log(e));
    }
  }

  // Page Navigation
  function navigate(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tabs button').forEach(b => b.classList.remove('active'));

    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add('active');

    // Highlight active nav button
    document.querySelectorAll('.nav-tabs button').forEach(b => {
      const onclickAttr = b.getAttribute('onclick');
      if (onclickAttr && onclickAttr.includes(pageId)) {
        b.classList.add('active');
      }
    });

    const mainContainer = document.getElementById('main-container');
    if (mainContainer) {
      mainContainer.style.padding = (pageId === 'page-store') ? '0' : '24px';
    }

    if (pageId === 'page-barcodes') setTimeout(Barcodes.renderBarcodeSheet, 100);
    if (pageId === 'page-analytics') {
      Analytics.renderAnalytics();
      Analytics.updateCharts();
    }
    if (pageId === 'page-pack') Pack.renderPackStation();
    if (pageId === 'page-worker') Worker.renderWorkerTable();
    if (pageId === 'page-inbound') {
      if (typeof Inbound !== 'undefined' && Inbound.init) Inbound.init();
    }
    if (pageId === 'page-procurement') {
      if (typeof Procurement !== 'undefined' && Procurement.reloadAll) {
        Procurement.reloadAll();
      }
    }
    if (pageId === 'page-hub') {
      Picking.renderWarehouseShelves();
      Picking.updateTaskConsole();
      Picking.renderWaveCards();
      Picking.updateHeadcountPlanner();
      setTimeout(() => {
        const input = document.getElementById('scanner-input');
        if (input) input.focus();
      }, 100);
    }
  }

  // Bootstrap Application
  async function init() {
    console.log('🚀 Initializing Nexus WMS Modules...');

    await Store.init();
    await Picking.init();
    await Pack.init();
    await Analytics.init();
    await Worker.init();
    if (typeof Inbound !== 'undefined' && Inbound.init) {
      Inbound.init();
    }
    if (typeof Procurement !== 'undefined' && Procurement.init) {
      await Procurement.init();
    }

    // Setup input enter events
    const scannerInput = document.getElementById('scanner-input');
    if (scannerInput) {
      scannerInput.addEventListener('keydown', Picking.handleScannerInput);
    }

    const inboundBarcodeInput = document.getElementById('inbound-barcode');
    if (inboundBarcodeInput) {
      inboundBarcodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          Inbound.checkInboundBarcode(e.target.value.trim());
        }
      });
    }

    console.log('✅ Nexus WMS ready with full SQLite persistence & WebSocket real-time sync.');
  }

  return {
    init,
    navigate,
    playBeep,
    openCamera,
    closeCamera
  };
})();

if (typeof window !== 'undefined') {
  window.App = App;
}

// Auto initialize on DOMContentLoaded
window.addEventListener('DOMContentLoaded', App.init);
