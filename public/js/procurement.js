/**
 * Nexus WMS - Procurement & Purchase Planning Module (แผนการสั่งซื้อ & จัดการสินค้าขาด)
 * Handles PO creation, low-stock reorders, ETA countdown, goods receipt, and auto-unblocking backorders.
 */
const Procurement = (() => {
  let plans = [];
  let suggestions = [];
  let backorderedOrders = [];
  let activeSubTab = 'active-pos'; // 'active-pos' | 'create-plan' | 'backorders' | 'history'
  let newPlanItems = [];
  let timerInterval = null;

  const DEFAULT_IMG = "https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&w=600&q=80";

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatPrice(val) {
    return (parseFloat(val) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' (' + d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' }) + ')';
  }

  async function init() {
    await reloadAll();

    // Start timer interval for countdowns
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateLiveCountdowns, 1000);

    // Event listeners
    API.on('PURCHASE_PLAN_CREATED', async () => { await reloadAll(); });
    API.on('PURCHASE_PLAN_ORDERED', async () => { await reloadAll(); });
    API.on('PURCHASE_PLAN_RECEIVED', async () => { await reloadAll(); });
    API.on('PURCHASE_PLAN_DELETED', async () => { await reloadAll(); });
    API.on('ORDER_CREATED', async () => { await reloadAll(); });
    API.on('ORDER_BACKORDERED', async () => { await reloadAll(); });
    API.on('ORDER_UNBLOCKED', async () => { await reloadAll(); });
    API.on('STOCK_UPDATED', async () => { await reloadAll(); });
  }

  async function reloadAll() {
    await Promise.all([
      loadPlans(),
      loadSuggestions(),
      loadBackorderedOrders()
    ]);

    renderKPIs();
    renderCurrentSubTab();
    updateNavBadge();
  }

  async function loadPlans() {
    try {
      const data = await API.getPurchasePlans();
      if (Array.isArray(data)) {
        plans = data;
        try { localStorage.setItem('nexus_procurement_plans', JSON.stringify(plans)); } catch (e) {}
        return;
      }
    } catch (err) {
      console.warn('API getPurchasePlans unavailable, using local plans fallback:', err);
    }

    // Local fallback
    try {
      const cached = localStorage.getItem('nexus_procurement_plans');
      if (cached) {
        plans = JSON.parse(cached);
      } else {
        const now = Date.now();
        plans = [
          {
            id: 'PO-2026-101',
            title: 'แผนสั่งซื้อด่วน: เติมสต็อกเครื่องดื่มหมวดขายดี',
            supplier: 'Thai Beverage & FMCG Distribution Co., Ltd.',
            status: 'Ordered',
            items: [
              { skuId: 'SKU-A-001', name: 'เครื่องดื่มชูกำลัง (Pack 6)', barcode: '8850000000010', qty: 25, unitPrice: 65, totalCost: 1625, reason: 'เติมสต็อกเครื่องดื่มยอดขายสูง' },
              { skuId: 'SKU-A-002', name: 'น้ำแร่ธรรมชาติ 1.5L', barcode: '8850000000027', qty: 30, unitPrice: 15, totalCost: 450, reason: 'เติมสต็อกน้ำดื่มขายดีประจำวัน' }
            ],
            totalQty: 55,
            totalCost: 2075,
            etaMs: now + (3 * 60 * 1000),
            etaMinutes: 3,
            orderedAt: now - 60000,
            receivedAt: null,
            notes: 'สั่งซื้อเร่งด่วนเพื่อรองรับคำสั่งซื้อหน้าร้าน',
            createdAt: now - 60000
          },
          {
            id: 'PO-2026-102',
            title: 'แผนจัดซื้อสินค้าของใช้ในบ้าน & ข้าวสารประจำสัปดาห์',
            supplier: 'Siam Distribution Logistics Thailand',
            status: 'Draft',
            items: [
              { skuId: 'SKU-A-009', name: 'กระดาษทิชชู่ม้วน (Pack 6)', barcode: '8850000000096', qty: 20, unitPrice: 89, totalCost: 1780, reason: 'เตรียมสำรองสินค้าของใช้ในบ้าน' },
              { skuId: 'SKU-B-003', name: 'ข้าวหอมมะลิ 5kg', barcode: '8850000000218', qty: 15, unitPrice: 199, totalCost: 2985, reason: 'เตรียมสำรองสินค้าหมวด B' }
            ],
            totalQty: 35,
            totalCost: 4765,
            etaMs: null,
            etaMinutes: 5,
            orderedAt: null,
            receivedAt: null,
            notes: 'รอตรวจนับและสรุปงบประมาณรอบถัดไป',
            createdAt: now - (2 * 3600 * 1000)
          }
        ];
        try { localStorage.setItem('nexus_procurement_plans', JSON.stringify(plans)); } catch (e) {}
      }
    } catch (e) {
      plans = [];
    }
  }

  async function loadSuggestions() {
    try {
      const data = await API.getProcurementSuggestions();
      if (Array.isArray(data)) {
        suggestions = data;
        return;
      }
    } catch (err) {
      console.warn('API getProcurementSuggestions unavailable, calculating locally:', err);
    }

    // Local calculation fallback
    const products = (typeof Store !== 'undefined' && Store.getProducts) ? Store.getProducts() : [];
    const boMap = {};
    backorderedOrders.forEach(ord => {
      const bItems = ord.backorderItems || {};
      for (const [skuId, qty] of Object.entries(bItems)) {
        boMap[skuId] = (boMap[skuId] || 0) + (parseInt(qty, 10) || 0);
      }
    });

    suggestions = [];
    products.forEach(p => {
      const boDemand = boMap[p.id] || 0;
      const isLow = (p.stock || 0) <= 10;
      if (boDemand > 0 || isLow) {
        let suggestedQty = 20;
        let priority = 'MEDIUM';
        let reason = '';

        if (boDemand > 0) {
          suggestedQty = boDemand + 20;
          priority = 'CRITICAL';
          reason = `🚨 มียอดสั่งจองค้างส่ง ${boDemand} ชิ้น (สต็อกเหลือ ${p.stock})`;
        } else if (p.stock <= 5) {
          suggestedQty = Math.max(30 - p.stock, 25);
          priority = 'HIGH';
          reason = `⚠️ สต็อกเหลือน้อยมาก (${p.stock} ชิ้น)`;
        } else if (p.stock <= 10) {
          suggestedQty = Math.max(20 - p.stock, 15);
          priority = 'MEDIUM';
          reason = `🟡 ต่ำกว่าจุดสั่งซื้อ Reorder Point (${p.stock} ชิ้น)`;
        }

        suggestions.push({
          skuId: p.id,
          name: p.name,
          barcode: p.barcode,
          loc: p.loc,
          zone: p.zone,
          stock: p.stock,
          backorderDemand: boDemand,
          suggestedQty,
          unitPrice: p.price,
          image: p.image,
          priority,
          reason
        });
      }
    });

    const weight = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 };
    suggestions.sort((a, b) => weight[b.priority] - weight[a.priority]);
  }

  async function loadBackorderedOrders() {
    try {
      const allOrders = await API.getOrders();
      if (Array.isArray(allOrders)) {
        backorderedOrders = allOrders.filter(o => o.status === 'Backordered');
        return;
      }
    } catch (err) {
      console.warn('API getOrders unavailable, using local orders for backorder check:', err);
    }

    try {
      const localOrders = JSON.parse(localStorage.getItem('nexus_local_orders') || '[]');
      backorderedOrders = localOrders.filter(o => o.status === 'Backordered');
    } catch (e) {
      backorderedOrders = [];
    }
  }

  function updateNavBadge() {
    const badge = document.getElementById('procurement-nav-badge');
    const totalUrgent = backorderedOrders.length + suggestions.filter(s => s.priority === 'CRITICAL' || s.priority === 'HIGH').length;
    if (badge) {
      if (totalUrgent > 0) {
        badge.style.display = 'inline-block';
        badge.innerText = totalUrgent;
      } else {
        badge.style.display = 'none';
      }
    }
  }

  function renderKPIs() {
    const totalBackorders = backorderedOrders.length;
    const lowStockCount = suggestions.filter(s => s.stock <= 10).length;
    const inTransitCount = plans.filter(p => p.status === 'Ordered').length;
    const receivedCount = plans.filter(p => p.status === 'Received').length;

    const elBO = document.getElementById('kpi-procurement-backorders');
    const elLow = document.getElementById('kpi-procurement-lowstock');
    const elTransit = document.getElementById('kpi-procurement-intransit');
    const elReceived = document.getElementById('kpi-procurement-received');

    if (elBO) elBO.innerText = `${totalBackorders} ออเดอร์`;
    if (elLow) elLow.innerText = `${lowStockCount} รายการ`;
    if (elTransit) elTransit.innerText = `${inTransitCount} แผน`;
    if (elReceived) elReceived.innerText = `${receivedCount} แผน`;
  }

  function switchSubTab(tabId) {
    activeSubTab = tabId;
    document.querySelectorAll('.proc-subtab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });

    document.querySelectorAll('.proc-tab-content').forEach(c => {
      c.style.display = (c.id === `proc-content-${tabId}`) ? 'block' : 'none';
    });

    renderCurrentSubTab();
  }

  function renderCurrentSubTab() {
    if (activeSubTab === 'active-pos') renderActivePOs();
    else if (activeSubTab === 'create-plan') renderCreatePlanView();
    else if (activeSubTab === 'backorders') renderBackordersQueue();
    else if (activeSubTab === 'history') renderHistoryView();
  }

  // ==================== 1. ACTIVE POS & ETA TRACKING ====================

  function renderActivePOs() {
    const container = document.getElementById('proc-active-pos-list');
    if (!container) return;

    const activeList = plans.filter(p => p.status === 'Ordered' || p.status === 'Draft');

    if (activeList.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:50px 20px; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius-md);">
          <div style="font-size:42px; margin-bottom:12px;">🚚</div>
          <h3 style="color:var(--text-main); font-size:18px; margin-bottom:8px;">ไม่มีแผนการสั่งซื้อที่กำลังจัดส่งในขณะนี้</h3>
          <p style="color:var(--text-muted); font-size:14px; margin-bottom:18px;">
            เมื่อมีสินค้าติดจอง หรือสินค้าสต็อกต่ำ คุณสามารถกดจัดทำแผนการสั่งซื้อได้ทันที
          </p>
          <div style="display:flex; justify-content:center; gap:12px;">
            <button class="btn-action" style="background:var(--accent-orange); color:white; padding:10px 20px;" onclick="Procurement.autoGeneratePlanFromShortages()">
              ⚡ สร้างแผนจัดซื้ออัจฉริยะ (Smart Reorder)
            </button>
            <button class="btn-action" style="background:#1e293b; color:var(--text-main); border:1px solid var(--border); padding:10px 20px;" onclick="Procurement.switchSubTab('create-plan')">
              ➕ สร้างแผนจัดซื้อใหม่เอง
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = activeList.map(plan => {
      const isOrdered = plan.status === 'Ordered';
      const isDraft = plan.status === 'Draft';
      const now = Date.now();
      let diffMs = plan.etaMs ? (plan.etaMs - now) : 0;
      let isArrived = isOrdered && diffMs <= 0;

      let countdownText = '-';
      if (isOrdered) {
        if (diffMs > 0) {
          const m = Math.floor(diffMs / 60000);
          const s = Math.floor((diffMs % 60000) / 1000);
          countdownText = `⏳ กำลังจัดส่ง: ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} นาที`;
        } else {
          countdownText = `🚚 สินค้าถึงคลังแล้ว (รอตรวจรับเข้าสต็อก)`;
        }
      }

      return `
        <div class="po-card ${isArrived ? 'po-arrived' : ''}" id="po-card-${plan.id}">
          <div class="po-header">
            <div class="po-title-block">
              <div class="po-badge-row">
                <span class="po-id-badge">${plan.id}</span>
                ${isDraft ? `<span class="po-status-badge po-draft">📝 แบบร่าง (Draft)</span>` : ''}
                ${isOrdered && !isArrived ? `<span class="po-status-badge po-in-transit">🚚 กำลังจัดส่ง (In Transit)</span>` : ''}
                ${isArrived ? `<span class="po-status-badge po-arrived-badge">✨ สินค้าถึงหน้าคลังแล้ว</span>` : ''}
                <span style="font-size:12px; color:var(--text-muted);">สร้างเมื่อ: ${formatTime(plan.createdAt)}</span>
              </div>
              <h3 class="po-title">${escapeHtml(plan.title)}</h3>
              <div class="po-supplier">🏢 ซัพพลายเออร์: <strong>${escapeHtml(plan.supplier)}</strong></div>
            </div>

            <!-- ETA and Action Controls -->
            <div class="po-action-block">
              ${isOrdered ? `
                <div class="po-eta-box">
                  <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">เวลาจัดส่งประมาณการ (ETA)</div>
                  <div class="po-countdown" id="countdown-${plan.id}">
                    ${countdownText}
                  </div>
                  <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                    ระยะเวลาขนส่ง: ${plan.etaMinutes || 5} นาที
                  </div>
                </div>
              ` : `
                <div style="text-align:right;">
                  <button class="btn-action" style="background:var(--accent-cyan); color:#000; font-weight:bold; padding:10px 16px;" onclick="Procurement.placePlanOrder('${plan.id}')">
                    🚀 สั่งซื้อทันที (เริ่มส่ง)
                  </button>
                </div>
              `}

              ${isOrdered ? `
                <button class="po-btn-receive" onclick="Procurement.confirmReceiveGoods('${plan.id}')" title="กดยืนยันการรับสินค้าเข้าสต็อกและปลดล็อกออเดอร์จอง">
                  📦 ยืนยันการรับของ (Confirm Receipt)
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Items Table inside PO -->
          <div class="po-items-table-wrapper">
            <table class="po-items-table">
              <thead>
                <tr>
                  <th style="width:50px;">ภาพ</th>
                  <th>รหัสสินค้า (SKU) / ชื่อสินค้า</th>
                  <th style="text-align:center; width:100px;">จำนวนสั่ง</th>
                  <th style="text-align:right; width:120px;">ราคาต่อหน่วย</th>
                  <th style="text-align:right; width:120px;">ราคารวม</th>
                  <th>เหตุผลการสั่งซื้อ</th>
                </tr>
              </thead>
              <tbody>
                ${(plan.items || []).map(item => `
                  <tr>
                    <td>
                      <img src="${item.image || DEFAULT_IMG}" style="width:36px; height:36px; border-radius:6px; object-fit:cover; border:1px solid #374151;" onerror="this.src='${DEFAULT_IMG}'">
                    </td>
                    <td>
                      <strong style="color:var(--text-main); font-size:13px;">${escapeHtml(item.name)}</strong>
                      <div style="font-size:11px; color:var(--accent-cyan); font-family:monospace;">${escapeHtml(item.skuId)} | Barcode: ${escapeHtml(item.barcode || '-')}</div>
                    </td>
                    <td style="text-align:center;">
                      <strong style="color:var(--accent-orange); font-size:15px;">+${item.qty}</strong> <span style="font-size:11px; color:var(--text-muted);">ชิ้น</span>
                    </td>
                    <td style="text-align:right; color:var(--text-muted); font-size:13px;">฿${formatPrice(item.unitPrice)}</td>
                    <td style="text-align:right; font-weight:bold; color:var(--success); font-size:14px;">฿${formatPrice(item.totalCost || (item.unitPrice * item.qty))}</td>
                    <td style="font-size:12px; color:var(--text-muted);">${escapeHtml(item.reason || '-')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- PO Summary Footer -->
          <div class="po-footer">
            <div style="font-size:13px; color:var(--text-muted);">
              ${plan.notes ? `💬 หมายเหตุ: <em>${escapeHtml(plan.notes)}</em>` : ''}
            </div>
            <div class="po-summary-numbers">
              <span>รวมสินค้า: <strong>${plan.totalQty} ชิ้น</strong></span>
              <span>มูลค่ารวม: <strong style="color:var(--success); font-size:16px;">฿${formatPrice(plan.totalCost)}</strong></span>
              ${isDraft ? `
                <button onclick="Procurement.deletePlan('${plan.id}')" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:12px; text-decoration:underline;">
                  ✕ ลบแผนร่างนี้
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function updateLiveCountdowns() {
    const now = Date.now();
    plans.forEach(plan => {
      if (plan.status === 'Ordered') {
        const el = document.getElementById(`countdown-${plan.id}`);
        const card = document.getElementById(`po-card-${plan.id}`);
        if (el) {
          const diffMs = plan.etaMs ? (plan.etaMs - now) : 0;
          if (diffMs > 0) {
            const m = Math.floor(diffMs / 60000);
            const s = Math.floor((diffMs % 60000) / 1000);
            el.innerHTML = `⏳ กำลังจัดส่ง: <strong>${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}</strong> นาที`;
            if (card) card.classList.remove('po-arrived');
          } else {
            el.innerHTML = `🚚 สินค้าถึงคลังแล้ว (รอตรวจรับเข้าสต็อก)`;
            if (card) card.classList.add('po-arrived');
          }
        }
      }
    });
  }

  // ==================== 2. CREATE PURCHASE PLAN ====================

  function renderCreatePlanView() {
    renderSuggestionsSidebar();
    renderNewPlanItemsTable();
  }

  function renderSuggestionsSidebar() {
    const container = document.getElementById('proc-suggestions-list');
    if (!container) return;

    if (suggestions.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:30px 10px; color:var(--text-muted); font-size:13px;">✅ สต็อกทุกรายการอยู่ในเกณฑ์ปกติ ไม่มีสินค้าติดจอง</div>`;
      return;
    }

    container.innerHTML = suggestions.map(s => {
      const isAdded = newPlanItems.some(item => item.skuId === s.skuId);
      const isCritical = s.priority === 'CRITICAL';
      const isHigh = s.priority === 'HIGH';

      return `
        <div class="sugg-card ${isCritical ? 'sugg-critical' : isHigh ? 'sugg-high' : ''}">
          <div style="display:flex; gap:10px; align-items:center;">
            <img src="${s.image || DEFAULT_IMG}" style="width:40px; height:40px; border-radius:6px; object-fit:cover;" onerror="this.src='${DEFAULT_IMG}'">
            <div style="flex:1;">
              <strong style="color:var(--text-main); font-size:13px;">${escapeHtml(s.name)}</strong>
              <div style="font-size:11px; color:var(--accent-cyan); font-family:monospace;">${s.skuId} | เชลฟ์ ${s.loc}</div>
              <div style="font-size:11px; color:${isCritical ? '#f87171' : isHigh ? '#fbbf24' : '#9ca3af'}; margin-top:2px;">
                ${s.reason}
              </div>
            </div>
            <div style="text-align:right;">
              <span style="font-size:11px; color:var(--text-muted);">สต็อก: ${s.stock}</span>
              ${s.backorderDemand > 0 ? `<div style="font-size:11px; color:var(--danger); font-weight:bold;">จองค้าง: ${s.backorderDemand}</div>` : ''}
              <button class="btn-action" style="margin-top:4px; font-size:11px; padding:4px 10px; background:${isAdded ? '#374151' : 'var(--accent-orange)'}; color:white;"
                onclick="Procurement.toggleAddSuggestion('${s.skuId}')">
                ${isAdded ? '✓ เพิ่มแล้ว' : '+ เพิ่มเข้าแผน'}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderNewPlanItemsTable() {
    const tbody = document.getElementById('proc-new-items-body');
    const totalQtyEl = document.getElementById('proc-new-total-qty');
    const totalCostEl = document.getElementById('proc-new-total-cost');
    if (!tbody) return;

    if (newPlanItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; color:var(--text-muted); padding:30px;">
            ยังไม่มีสินค้าในแผนจัดซื้อ<br>
            <span style="font-size:12px;">คลิกปุ่ม <strong>"+ เพิ่มเข้าแผน"</strong> จากแถบคำแนะนำด้านซ้าย หรือกดปุ่ม <strong>"⚡ ดึงสินค้าที่ต้องเติมทั้งหมด"</strong></span>
          </td>
        </tr>
      `;
      if (totalQtyEl) totalQtyEl.innerText = '0 ชิ้น';
      if (totalCostEl) totalCostEl.innerText = '฿0.00';
      return;
    }

    let sumQty = 0;
    let sumCost = 0;

    tbody.innerHTML = newPlanItems.map((item, idx) => {
      const total = (item.qty * item.unitPrice);
      sumQty += item.qty;
      sumCost += total;

      return `
        <tr>
          <td style="text-align:center; color:var(--text-muted);">${idx + 1}</td>
          <td>
            <strong style="color:var(--text-main); font-size:13px;">${escapeHtml(item.name)}</strong>
            <div style="font-size:11px; color:var(--accent-cyan); font-family:monospace;">${escapeHtml(item.skuId)}</div>
          </td>
          <td>
            <div style="font-size:12px;">สต็อกปัจจุบัน: <strong>${item.currentStock || 0}</strong> ชิ้น</div>
            ${item.backorderDemand > 0 ? `<div style="font-size:11px; color:var(--danger); font-weight:bold;">🚨 ลูกค้าจองรอ: ${item.backorderDemand} ชิ้น</div>` : ''}
          </td>
          <td style="width:140px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <button class="btn-action" style="padding:4px 8px; font-size:12px;" onclick="Procurement.updateItemQty('${item.skuId}', -5)">-5</button>
              <input type="number" value="${item.qty}" min="1" max="999" style="width:60px; text-align:center; background:#000; border:1px solid var(--border); color:white; border-radius:4px; padding:4px;"
                onchange="Procurement.setItemQty('${item.skuId}', this.value)">
              <button class="btn-action" style="padding:4px 8px; font-size:12px;" onclick="Procurement.updateItemQty('${item.skuId}', 5)">+5</button>
            </div>
          </td>
          <td style="text-align:right; font-size:13px; color:var(--text-muted);">฿${formatPrice(item.unitPrice)}</td>
          <td style="text-align:right; font-weight:bold; color:var(--success); font-size:14px;">฿${formatPrice(total)}</td>
          <td style="text-align:center;">
            <button onclick="Procurement.removeItemFromPlan('${item.skuId}')" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:16px;" title="ลบรายการนี้">✕</button>
          </td>
        </tr>
      `;
    }).join('');

    if (totalQtyEl) totalQtyEl.innerText = `${sumQty} ชิ้น`;
    if (totalCostEl) totalCostEl.innerText = `฿${formatPrice(sumCost)}`;
  }

  function autoGeneratePlanFromShortages() {
    newPlanItems = [];
    const products = (typeof Store !== 'undefined' && Store.getProducts) ? Store.getProducts() : [];

    suggestions.forEach(s => {
      const prod = products.find(p => p.id === s.skuId) || {};
      newPlanItems.push({
        skuId: s.skuId,
        name: s.name,
        barcode: s.barcode,
        qty: s.suggestedQty,
        unitPrice: s.unitPrice,
        image: s.image,
        currentStock: s.stock,
        backorderDemand: s.backorderDemand,
        reason: s.reason
      });
    });

    // Auto-fill form fields
    const titleInput = document.getElementById('proc-plan-title');
    const supplierInput = document.getElementById('proc-plan-supplier');
    if (titleInput) {
      const countBackorders = suggestions.filter(s => s.backorderDemand > 0).length;
      titleInput.value = countBackorders > 0
        ? `แผนสั่งซื้อเติมสต็อกด่วน & คืนของคำสั่งซื้อติดจอง (${new Date().toLocaleDateString('th-TH')})`
        : `แผนสั่งซื้อเติมสต็อกประจำสัปดาห์ (${new Date().toLocaleDateString('th-TH')})`;
    }
    if (supplierInput && !supplierInput.value) {
      supplierInput.value = 'CP All Logistics & Wholesale Hub';
    }

    switchSubTab('create-plan');
    App.playBeep(true);
    alert(`⚡ ดึงรายการสินค้าติดจองและสต็อกต่ำสำเร็จ! เพิ่มเข้าแผนสั่งซื้อทั้งหมด ${newPlanItems.length} รายการ พร้อมคำนวณจำนวนแนะนำ`);
  }

  function toggleAddSuggestion(skuId) {
    const existingIndex = newPlanItems.findIndex(i => i.skuId === skuId);
    if (existingIndex >= 0) {
      newPlanItems.splice(existingIndex, 1);
    } else {
      const s = suggestions.find(x => x.skuId === skuId);
      if (s) {
        newPlanItems.push({
          skuId: s.skuId,
          name: s.name,
          barcode: s.barcode,
          qty: s.suggestedQty,
          unitPrice: s.unitPrice,
          image: s.image,
          currentStock: s.stock,
          backorderDemand: s.backorderDemand,
          reason: s.reason
        });
      }
    }
    renderCreatePlanView();
  }

  function updateItemQty(skuId, change) {
    const item = newPlanItems.find(i => i.skuId === skuId);
    if (item) {
      item.qty = Math.max(1, item.qty + change);
      renderNewPlanItemsTable();
    }
  }

  function setItemQty(skuId, val) {
    const item = newPlanItems.find(i => i.skuId === skuId);
    if (item) {
      item.qty = Math.max(1, parseInt(val, 10) || 1);
      renderNewPlanItemsTable();
    }
  }

  function removeItemFromPlan(skuId) {
    newPlanItems = newPlanItems.filter(i => i.skuId !== skuId);
    renderCreatePlanView();
  }

  async function submitPlan(targetStatus = 'Ordered') {
    const titleInput = document.getElementById('proc-plan-title');
    const supplierInput = document.getElementById('proc-plan-supplier');
    const etaSelect = document.getElementById('proc-plan-eta');
    const notesInput = document.getElementById('proc-plan-notes');

    const title = titleInput ? titleInput.value.trim() : '';
    const supplier = supplierInput ? supplierInput.value.trim() : '';
    const etaMinutes = etaSelect ? (parseInt(etaSelect.value, 10) || 5) : 5;
    const notes = notesInput ? notesInput.value.trim() : '';

    if (!title) {
      return alert('กรุณาระบุชื่อแผนการสั่งซื้อ');
    }
    if (newPlanItems.length === 0) {
      return alert('กรุณาเลือกสินค้าเข้าแผนการสั่งซื้ออย่างน้อย 1 รายการ');
    }

    const planPayload = {
      title,
      supplier: supplier || 'ซัพพลายเออร์ทั่วไป (General Supplier)',
      items: newPlanItems.map(i => ({
        skuId: i.skuId,
        name: i.name,
        barcode: i.barcode,
        qty: i.qty,
        unitPrice: i.unitPrice,
        totalCost: i.qty * i.unitPrice,
        image: i.image,
        reason: i.reason || 'สั่งซื้อตามแผน'
      })),
      etaMinutes,
      notes,
      status: targetStatus
    };

    try {
      const res = await API.createPurchasePlan(planPayload);
      newPlanItems = [];
      if (titleInput) titleInput.value = '';
      if (notesInput) notesInput.value = '';

      App.playBeep(true);
      alert(`✅ บันทึกแผนการสั่งซื้อ ${res.id} สำเร็จ!\nสถานะ: ${targetStatus === 'Ordered' ? '🚚 กำลังจัดส่ง (เริ่มนับเวลา ETA)' : '📝 แบบร่าง'}`);
      switchSubTab('active-pos');
      await reloadAll();
    } catch (err) {
      console.warn('API createPurchasePlan failed, saving plan locally:', err);
      const planId = 'PO-' + Date.now().toString().slice(-6);
      const now = Date.now();
      const totalQty = planPayload.items.reduce((sum, i) => sum + i.qty, 0);
      const totalCost = planPayload.items.reduce((sum, i) => sum + i.totalCost, 0);

      const localPlan = {
        id: planId,
        title: planPayload.title,
        supplier: planPayload.supplier,
        status: targetStatus,
        items: planPayload.items,
        totalQty,
        totalCost,
        etaMs: (targetStatus === 'Ordered') ? (now + (etaMinutes * 60 * 1000)) : null,
        etaMinutes,
        orderedAt: (targetStatus === 'Ordered') ? now : null,
        receivedAt: null,
        notes: planPayload.notes,
        createdAt: now
      };

      plans.unshift(localPlan);
      try { localStorage.setItem('nexus_procurement_plans', JSON.stringify(plans)); } catch (e) {}

      newPlanItems = [];
      if (titleInput) titleInput.value = '';
      if (notesInput) notesInput.value = '';

      App.playBeep(true);
      alert(`✅ บันทึกแผนการสั่งซื้อ ${planId} สำเร็จ!\nสถานะ: ${targetStatus === 'Ordered' ? '🚚 กำลังจัดส่ง (เริ่มนับเวลา ETA)' : '📝 แบบร่าง'}`);
      switchSubTab('active-pos');
      await reloadAll();
    }
  }

  async function placePlanOrder(planId) {
    try {
      await API.orderPurchasePlan(planId, 5);
      await reloadAll();
      App.playBeep(true);
      alert(`🚀 ยืนยันการสั่งซื้อตามแผน ${planId} สำเร็จ! ระบบเริ่มนับเวลาจัดส่งประมาณการ (ETA) เรียบร้อย`);
    } catch (err) {
      console.warn('API orderPurchasePlan failed, updating locally:', err);
      const plan = plans.find(p => p.id === planId);
      if (plan) {
        plan.status = 'Ordered';
        plan.orderedAt = Date.now();
        plan.etaMinutes = 5;
        plan.etaMs = Date.now() + (5 * 60 * 1000);
        try { localStorage.setItem('nexus_procurement_plans', JSON.stringify(plans)); } catch (e) {}
        await reloadAll();
        App.playBeep(true);
        alert(`🚀 ยืนยันการสั่งซื้อตามแผน ${planId} สำเร็จ! ระบบเริ่มนับเวลาจัดส่งประมาณการ (ETA) เรียบร้อย`);
      }
    }
  }

  // ==================== 3. CONFIRM GOODS RECEIPT & UNBLOCK BACKORDERS ====================

  async function confirmReceiveGoods(planId) {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return alert('ไม่พบข้อมูลแผนการสั่งซื้อ');

    const confirmed = confirm(
      `📦 ยืนยันการรับสินค้าตามแผน ${planId} เข้าคลังใช่หรือไม่?\n\n` +
      `ผู้จัดจำหน่าย: ${plan.supplier}\n` +
      `จำนวนสินค้ารวม: ${plan.totalQty} ชิ้น\n\n` +
      `เมื่อกดยืนยัน สต็อกจะถูกเติมทันที และระบบจะตรวจสอบคำสั่งซื้อที่ติดจอง (Backorder) เพื่อปลดล็อกให้ดำเนินการต่ออัตโนมัติ!`
    );
    if (!confirmed) return;

    try {
      const res = await API.receivePurchasePlan(planId);
      App.playBeep(true);

      const unblockedCount = (res.unblockedOrders && res.unblockedOrders.length) || 0;
      let msg = `🎉 ยืนยันการรับของตามแผน ${planId} เรียบร้อยแล้ว!\n`;
      msg += `📦 เพิ่มสินค้าเข้าสต็อกทั้งหมด: ${plan.totalQty} ชิ้น\n`;

      if (unblockedCount > 0) {
        msg += `✨ ปลดล็อกคำสั่งซื้อที่ติดจองสำเร็จ: ${unblockedCount} ออเดอร์!\n`;
        msg += `(ระบบได้ส่งออเดอร์ไปแท็บ "สแกนหยิบ (Picking)" ให้เรียบร้อยแล้ว)`;
      } else {
        msg += `(ไม่มีคำสั่งซื้อจองค้างส่ง)`;
      }

      alert(msg);
      await reloadAll();
      if (typeof Store !== 'undefined' && Store.reloadProducts) await Store.reloadProducts();
      if (typeof Picking !== 'undefined' && Picking.reloadWaves) await Picking.reloadWaves();
      if (typeof Pack !== 'undefined' && Pack.reloadData) await Pack.reloadData();
    } catch (err) {
      console.warn('API receivePurchasePlan failed, processing locally:', err);
      // Standalone local execution
      const now = Date.now();
      plan.status = 'Received';
      plan.receivedAt = now;

      // Add stock
      const products = (typeof Store !== 'undefined' && Store.getProducts) ? Store.getProducts() : [];
      (plan.items || []).forEach(item => {
        const p = products.find(x => x.id === item.skuId);
        if (p) {
          p.stock = (p.stock || 0) + item.qty;
        }
      });
      try { localStorage.setItem('nexus_products_cache', JSON.stringify(products)); } catch (e) {}
      try { localStorage.setItem('nexus_procurement_plans', JSON.stringify(plans)); } catch (e) {}

      // Unblock local backorders
      let localOrders = [];
      try { localOrders = JSON.parse(localStorage.getItem('nexus_local_orders') || '[]'); } catch (e) {}
      let unblockedCount = 0;

      localOrders.forEach(ord => {
        if (ord.status === 'Backordered') {
          let canFulfill = true;
          for (const [skuId, qtyNeeded] of Object.entries(ord.items || {})) {
            const p = products.find(x => x.id === skuId);
            if (!p || p.stock < qtyNeeded) {
              canFulfill = false;
              break;
            }
          }
          if (canFulfill) {
            ord.status = 'Queued';
            ord.backorderItems = {};
            unblockedCount++;
          }
        }
      });

      try { localStorage.setItem('nexus_local_orders', JSON.stringify(localOrders)); } catch (e) {}

      App.playBeep(true);
      let msg = `🎉 ยืนยันการรับของตามแผน ${planId} เรียบร้อยแล้ว!\n`;
      msg += `📦 เพิ่มสินค้าเข้าสต็อกทั้งหมด: ${plan.totalQty} ชิ้น\n`;
      if (unblockedCount > 0) {
        msg += `✨ ปลดล็อกคำสั่งซื้อที่ติดจองสำเร็จ: ${unblockedCount} ออเดอร์!\n`;
        msg += `(ระบบได้ส่งออเดอร์ไปแท็บ "สแกนหยิบ (Picking)" ให้เรียบร้อยแล้ว)`;
      }
      alert(msg);

      await reloadAll();
      if (typeof Store !== 'undefined' && Store.reloadProducts) await Store.reloadProducts();
      if (typeof Picking !== 'undefined' && Picking.reloadWaves) await Picking.reloadWaves();
      if (typeof Pack !== 'undefined' && Pack.reloadData) await Pack.reloadData();
    }
  }

  async function deletePlan(planId) {
    if (!confirm(`ต้องการลบแผนร่าง ${planId} ใช่หรือไม่?`)) return;
    try {
      await API.deletePurchasePlan(planId);
      await reloadAll();
    } catch (err) {
      plans = plans.filter(p => p.id !== planId);
      try { localStorage.setItem('nexus_procurement_plans', JSON.stringify(plans)); } catch (e) {}
      await reloadAll();
    }
  }

  // ==================== 4. BACKORDERED ORDERS QUEUE ====================

  function renderBackordersQueue() {
    const container = document.getElementById('proc-backorders-container');
    if (!container) return;

    if (backorderedOrders.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:50px 20px; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius-md);">
          <div style="font-size:42px; margin-bottom:12px;">✅</div>
          <h3 style="color:var(--text-main); font-size:18px; margin-bottom:8px;">ไม่มีคำสั่งซื้อที่ติดจอง (No Backorders)</h3>
          <p style="color:var(--text-muted); font-size:14px;">
            เมื่อลูกค้าสั่งซื้อสินค้าเกินสต็อกที่มี คำสั่งซื้อจะปรากฏที่นี่โดยอัตโนมัติ เพื่อให้ฝ่ายจัดซื้อสร้างแผนสั่งของมาเติม
          </p>
        </div>
      `;
      return;
    }

    const products = (typeof Store !== 'undefined' && Store.getProducts) ? Store.getProducts() : [];

    container.innerHTML = `
      <div style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="font-size:16px; color:var(--text-main);">รายการคำสั่งซื้อของลูกค้าที่รอสินค้าเติม (ค้างส่ง)</h3>
          <p style="font-size:13px; color:var(--text-muted);">เมื่อสินค้าตามแผนสั่งซื้อถูกกดยืนยันรับเข้าคลัง ออเดอร์เหล่านี้จะถูกปลดล็อกทันที</p>
        </div>
        <button class="btn-action" style="background:var(--accent-orange); color:white; padding:8px 16px; font-weight:bold;" onclick="Procurement.autoGeneratePlanFromShortages()">
          ⚡ จัดทำแผนสั่งซื้อสำหรับออเดอร์ติดจองทั้งหมด
        </button>
      </div>

      <div class="bo-orders-grid">
        ${backorderedOrders.map(ord => {
          const shortageMap = ord.backorderItems || {};
          const shortageKeys = Object.keys(shortageMap);

          return `
            <div class="bo-card">
              <div class="bo-card-header">
                <div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <strong style="font-size:15px; color:var(--accent-cyan); font-family:monospace;">${ord.orderId}</strong>
                    <span class="bo-badge">⏳ จอง Order (รอสินค้า)</span>
                  </div>
                  <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                    ช่อง Put-Wall: <strong>${ord.putWallSlot || '-'}</strong> | วันที่: ${formatTime(ord.createdAt)}
                  </div>
                </div>
                <button class="btn-action" style="font-size:11px; padding:6px 12px; background:var(--accent-orange); color:white;" onclick="Procurement.createPlanForSingleOrder('${ord.orderId}')">
                  + จัดทำแผนสั่งซื้อออเดอร์นี้
                </button>
              </div>

              <div class="bo-items-list">
                <div style="font-size:12px; font-weight:bold; color:var(--text-muted); margin-bottom:8px;">รายการสินค้าในออเดอร์:</div>
                ${Object.entries(ord.items || {}).map(([skuId, qty]) => {
                  const p = products.find(x => x.id === skuId) || {};
                  const isShort = shortageMap[skuId] > 0 || (p.stock || 0) < qty;
                  const shortUnits = shortageMap[skuId] || Math.max(0, qty - (p.stock || 0));

                  return `
                    <div class="bo-item-row ${isShort ? 'item-shortage' : ''}">
                      <div style="display:flex; align-items:center; gap:8px;">
                        <img src="${p.image || DEFAULT_IMG}" style="width:32px; height:32px; border-radius:4px; object-fit:cover;" onerror="this.src='${DEFAULT_IMG}'">
                        <div>
                          <div style="font-size:13px; font-weight:bold; color:var(--text-main);">${escapeHtml(p.name || skuId)}</div>
                          <div style="font-size:11px; color:var(--text-muted);">สต็อกในคลัง: ${p.stock || 0} ชิ้น</div>
                        </div>
                      </div>
                      <div style="text-align:right;">
                        <span style="font-size:13px; font-weight:bold; color:var(--text-main);">สั่ง ${qty} ชิ้น</span>
                        ${isShort ? `<div style="font-size:11px; color:var(--danger); font-weight:bold;">ขาด ${shortUnits} ชิ้น</div>` : `<div style="font-size:11px; color:var(--success);">พร้อมส่ง</div>`}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function createPlanForSingleOrder(orderId) {
    const ord = backorderedOrders.find(o => o.orderId === orderId);
    if (!ord) return;

    const products = (typeof Store !== 'undefined' && Store.getProducts) ? Store.getProducts() : [];
    newPlanItems = [];

    const shortageMap = ord.backorderItems || {};
    Object.entries(ord.items || {}).forEach(([skuId, qty]) => {
      const p = products.find(x => x.id === skuId) || {};
      const shortQty = shortageMap[skuId] || Math.max(0, qty - (p.stock || 0));
      if (shortQty > 0 || (p.stock || 0) <= 5) {
        newPlanItems.push({
          skuId,
          name: p.name || skuId,
          barcode: p.barcode || '',
          qty: shortQty + 10, // order needed + safety stock
          unitPrice: p.price || 50,
          image: p.image,
          currentStock: p.stock || 0,
          backorderDemand: shortQty,
          reason: `เติมของเพื่อปลดล็อกคำสั่งซื้อ ${orderId} (ขาด ${shortQty} ชิ้น)`
        });
      }
    });

    const titleInput = document.getElementById('proc-plan-title');
    if (titleInput) titleInput.value = `แผนสั่งซื้อเติมสินค้าสำหรับออเดอร์ ${orderId}`;

    switchSubTab('create-plan');
    App.playBeep(true);
    alert(`⚡ สร้างแผนสั่งซื้อสำหรับออเดอร์ ${orderId} เรียบร้อยแล้ว!`);
  }

  // ==================== 5. HISTORY VIEW ====================

  function renderHistoryView() {
    const container = document.getElementById('proc-history-container');
    if (!container) return;

    const receivedPlans = plans.filter(p => p.status === 'Received');

    if (receivedPlans.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); font-size:14px;">ยังไม่มีประวัติการรับสินค้าเข้าคลัง</div>`;
      return;
    }

    container.innerHTML = `
      <div class="dark-table-container">
        <table>
          <thead>
            <tr>
              <th>รหัส PO</th>
              <th>ชื่อแผนการสั่งซื้อ</th>
              <th>ซัพพลายเออร์</th>
              <th style="text-align:center;">จำนวนสินค้ารวม</th>
              <th style="text-align:right;">มูลค่ารวม</th>
              <th>วันที่สั่งซื้อ</th>
              <th>วันที่ตรวจรับเข้าคลัง</th>
              <th style="text-align:center;">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            ${receivedPlans.map(p => `
              <tr>
                <td><strong style="color:var(--accent-cyan); font-family:monospace;">${p.id}</strong></td>
                <td><strong style="color:var(--text-main);">${escapeHtml(p.title)}</strong></td>
                <td>${escapeHtml(p.supplier)}</td>
                <td style="text-align:center;"><strong style="color:var(--accent-orange);">${p.totalQty}</strong> ชิ้น</td>
                <td style="text-align:right; font-weight:bold; color:var(--success);">฿${formatPrice(p.totalCost)}</td>
                <td style="font-size:12px; color:var(--text-muted);">${formatTime(p.orderedAt || p.createdAt)}</td>
                <td style="font-size:12px; color:var(--success); font-weight:bold;">${formatTime(p.receivedAt)}</td>
                <td style="text-align:center;">
                  <span style="background:rgba(16, 185, 129, 0.2); color:#34d399; border:1px solid #34d399; font-size:11px; padding:3px 8px; border-radius:4px;">
                    ✓ รับของแล้ว
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  return {
    init,
    reloadAll,
    switchSubTab,
    autoGeneratePlanFromShortages,
    toggleAddSuggestion,
    updateItemQty,
    setItemQty,
    removeItemFromPlan,
    submitPlan,
    placePlanOrder,
    confirmReceiveGoods,
    deletePlan,
    createPlanForSingleOrder,
    getPlans: () => plans,
    getSuggestions: () => suggestions,
    getBackorderedOrders: () => backorderedOrders
  };
})();

if (typeof window !== 'undefined') {
  window.Procurement = Procurement;
}
