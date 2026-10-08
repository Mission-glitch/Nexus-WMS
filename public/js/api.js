/**
 * Nexus WMS - API & WebSocket Client Module
 * Supports automatic fallback between SQLite backend (http://localhost:3000) and Local Standalone mode.
 */
const API = (() => {
  // Determine effective backend base URL
  function getEffectiveBaseUrl() {
    if (typeof window === 'undefined') return 'http://localhost:3300';
    if (window.location.protocol.startsWith('http')) {
      // Always use current serving origin when loaded over HTTP/HTTPS
      return window.location.origin;
    }
    // file: protocol or local file view
    return 'http://localhost:3300';
  }

  const BASE_URL = getEffectiveBaseUrl();
  const listeners = {};

  let ws = null;
  let reconnectTimer = null;
  let isConnected = false;

  function initWebSocket() {
    let wsUrl = 'ws://localhost:3300';

    if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}`;
    }

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket Connected to', wsUrl);
        isConnected = true;
        updateWsIndicator(true);
        hideOfflineNotice();
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          dispatch(msg.type, msg.payload);
        } catch (e) {
          console.error('Invalid WS message', e);
        }
      };

      ws.onclose = () => {
        isConnected = false;
        updateWsIndicator(false);
        showOfflineNotice();
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(initWebSocket, 4000);
        }
      };

      ws.onerror = () => {
        isConnected = false;
        updateWsIndicator(false);
        showOfflineNotice();
      };
    } catch (e) {
      isConnected = false;
      updateWsIndicator(false);
      showOfflineNotice();
      if (!reconnectTimer) reconnectTimer = setTimeout(initWebSocket, 5000);
    }
  }

  function showOfflineNotice() {
    const banner = document.getElementById('system-notice-banner');
    if (banner && (window.location.protocol === 'file:' || !isConnected)) {
      banner.style.display = 'flex';
    }
  }

  function hideOfflineNotice() {
    const banner = document.getElementById('system-notice-banner');
    if (banner) {
      banner.style.display = 'none';
    }
  }

  function updateWsIndicator(online) {
    const dot = document.getElementById('ws-status-dot');
    const txt = document.getElementById('ws-status-text');
    if (dot) {
      dot.className = online ? 'status-dot active' : 'status-dot';
      dot.style.background = online ? '#10b981' : '#f59e0b';
    }
    if (txt) {
      txt.innerText = online ? 'Live Sync (SQLite)' : 'Offline (Local Ready)';
      txt.style.color = online ? '#10b981' : '#f59e0b';
    }
  }

  function on(eventType, callback) {
    if (!listeners[eventType]) listeners[eventType] = [];
    listeners[eventType].push(callback);
  }

  function dispatch(eventType, payload) {
    if (listeners[eventType]) {
      listeners[eventType].forEach(cb => cb(payload));
    }
    if (listeners['*']) {
      listeners['*'].forEach(cb => cb(eventType, payload));
    }
  }

  // Generic Request Helper with timeout abort to avoid blocking UI
  async function request(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      signal: controller.signal,
      ...options
    };

    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, config);
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${res.status}`);
      }
      isConnected = true;
      updateWsIndicator(true);
      return res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  // Initialize WS on load
  if (typeof window !== 'undefined') {
    initWebSocket();
  }

  return {
    on,
    isOnline: () => isConnected,
    // Products
    getProducts: () => request('/api/products'),
    inboundReceive: (data) => request('/api/products/inbound', { method: 'POST', body: JSON.stringify(data) }),
    replenishStock: (data) => request('/api/products/replenish', { method: 'POST', body: JSON.stringify(data) }),
    relocateProduct: (data) => request('/api/products/relocate', { method: 'POST', body: JSON.stringify(data) }),
    getLocationHistory: (limit = 50) => request(`/api/products/location-history?limit=${limit}`),

    // Orders
    getOrders: () => request('/api/orders'),
    getOrderHistory: () => request('/api/orders/history'),
    createOrder: (cart) => request('/api/orders', { method: 'POST', body: JSON.stringify({ cart }) }),
    packOrder: (orderId, qcData = null) => request(`/api/orders/${orderId}/pack`, { method: 'POST', body: JSON.stringify({ qcData }) }),

    // QC Inspection
    inspectQC: (data) => request('/api/qc/inspect', { method: 'POST', body: JSON.stringify(data) }),
    getQCStats: () => request('/api/qc/stats'),
    getQCLogs: (limit = 50) => request(`/api/qc/logs?limit=${limit}`),
    updateQCLog: (id, data) => request(`/api/qc/logs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    // Picking
    getWaves: () => request('/api/waves'),
    scanPick: (data) => request('/api/picking/scan', { method: 'POST', body: JSON.stringify(data) }),

    // Workers
    getWorkers: () => request('/api/workers'),
    clockIn: (id, name) => request('/api/workers/clock-in', { method: 'POST', body: JSON.stringify({ id, name }) }),
    clockOut: (id) => request('/api/workers/clock-out', { method: 'POST', body: JSON.stringify({ id }) }),

    // Analytics
    getAnalytics: () => request('/api/analytics'),

    // Procurement (แผนการสั่งซื้อ & จัดการของขาด)
    getPurchasePlans: () => request('/api/procurement/plans'),
    getProcurementSuggestions: () => request('/api/procurement/suggestions'),
    createPurchasePlan: (data) => request('/api/procurement/plans', { method: 'POST', body: JSON.stringify(data) }),
    orderPurchasePlan: (id, etaMinutes) => request(`/api/procurement/plans/${id}/order`, { method: 'POST', body: JSON.stringify({ etaMinutes }) }),
    receivePurchasePlan: (id) => request(`/api/procurement/plans/${id}/receive`, { method: 'POST' }),
    deletePurchasePlan: (id) => request(`/api/procurement/plans/${id}`, { method: 'DELETE' })
  };
})();

if (typeof window !== 'undefined') {
  window.API = API;
}
