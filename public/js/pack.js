/**
 * Nexus WMS - Pack Station, Put-Wall & Order Slip Module
 */
const Pack = (() => {
  let orders = [];
  let history = [];

  function formatLeadTimeSec(sec) {
    if (sec < 0) return "00:00";
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  async function init() {
    await reloadData();
    renderPackStation();
    renderHistoryTable();

    // Start timer interval for live order times
    setInterval(() => {
      orders.forEach(o => {
        if (o.startedAt && !o.packedAt) {
          const el = document.getElementById(`lt-badge-${o.orderId}`);
          if (el) {
            el.innerText = formatLeadTimeSec(Math.floor((Date.now() - o.startedAt) / 1000));
          }
        }
      });
    }, 1000);

    // Real-time synchronization
    API.on('ORDER_CREATED', async () => {
      await reloadData();
      renderPackStation();
    });

    API.on('PICK_SCANNED', async () => {
      await reloadData();
      renderPackStation();
    });

    API.on('ORDER_PACKED', async () => {
      await reloadData();
      renderPackStation();
      renderHistoryTable();
    });
  }

  async function reloadData() {
    try {
      orders = await API.getOrders();
      history = await API.getOrderHistory();
      updatePackStats();
      return;
    } catch (err) {
      console.warn('API getOrders unavailable, using local orders:', err);
    }

    try {
      const localOrders = JSON.parse(localStorage.getItem('nexus_local_orders') || '[]');
      orders = localOrders.map(o => ({
        orderId: o.orderId,
        putWallSlot: 'Slot-P1',
        status: o.status === 'Packed' ? 'Packed' : 'Ready to Pack',
        zones: ['A'],
        zonesCompleted: ['A'],
        startedAt: o.startedAt || (Date.now() - 60000),
        packedAt: o.packedAt || null,
        items: o.items || {}
      }));
      history = JSON.parse(localStorage.getItem('nexus_local_history') || '[]');
      updatePackStats();
    } catch(e) {
      orders = [];
      history = [];
    }
  }

  function updatePackStats() {
    const totalPackedEl = document.getElementById('stat-total-packed');
    const avgLeadTimeEl = document.getElementById('stat-avg-leadtime');

    let totalLeadTimeMs = 0;
    history.forEach(h => { totalLeadTimeMs += h.lead_time_ms; });
    const avgMs = history.length > 0 ? (totalLeadTimeMs / history.length) : 0;

    if (totalPackedEl) totalPackedEl.innerText = history.length;
    if (avgLeadTimeEl) avgLeadTimeEl.innerText = formatLeadTimeSec(Math.floor(avgMs / 1000));
  }

  function renderPackStation() {
    const tbody = document.getElementById('pack-table-body');
    if (!tbody) return;

    // Filter to active orders not yet removed or packed
    const activeOrders = orders.filter(o => o.status !== 'Packed');

    if (activeOrders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">ไม่มีรายการคำสั่งซื้อค้างบนโต๊ะ</td></tr>`;
      return;
    }

    tbody.innerHTML = activeOrders.map(o => {
      let badgeClass = "timer-badge";
      let timeDisplay = "รอดำเนินการ";

      if (o.packedAt && o.startedAt) {
        badgeClass += " completed";
        timeDisplay = formatLeadTimeSec(Math.floor((o.packedAt - o.startedAt) / 1000));
      } else if (o.startedAt && !o.packedAt) {
        badgeClass += " active";
        timeDisplay = formatLeadTimeSec(Math.floor((Date.now() - o.startedAt) / 1000));
      }

      let statusText = o.status === 'Packed'
        ? '<span style="color:var(--success);">✔ ปิดกล่องแล้ว</span>'
        : o.status === 'Backordered'
          ? '<span style="background:rgba(239, 68, 68, 0.2); color:#f87171; border:1px solid #f87171; font-size:11px; padding:3px 8px; border-radius:4px; font-weight:bold;">⏳ จอง Order (รอสินค้าเติม)</span>'
          : o.status === 'Ready to Pack'
            ? '<span style="color:var(--warning); font-weight:bold;">กองครบ พร้อมแพ็ก</span>'
            : `<span style="color:var(--text-muted);">รอรวมของ (${(o.zonesCompleted || []).length}/${(o.zones || []).length} โซน)</span>`;

      return `
        <tr>
          <td><strong>${o.orderId}</strong></td>
          <td><strong style="color:var(--accent-cyan); font-size:15px;">${o.putWallSlot}</strong></td>
          <td>${statusText}</td>
          <td><span id="lt-badge-${o.orderId}" class="${badgeClass}">${timeDisplay}</span></td>
          <td>
            <div style="display:flex; gap:8px;">
              <button class="btn-action" style="padding:4px 10px; font-size:12px; background:var(--bg-surface); border-color:var(--accent-cyan); color:var(--accent-cyan);" onclick="Pack.printOrderSlip('${o.orderId}')">
                🖨 พิมพ์ใบสั่งงาน
              </button>
              <button class="btn-action" style="padding:4px 12px; font-size:12px; background:var(--success); color:white; font-weight:bold;" ${o.status !== 'Ready to Pack' ? 'disabled' : ''} onclick="Pack.openQCModal('${o.orderId}')">
                ${o.status === 'Packed' ? '✔ เรียบร้อย' : '🔍 ตรวจ QC & ปิดกล่อง'}
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  function renderHistoryTable() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    if (history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">ยังไม่มีประวัติการจัดส่ง</td></tr>`;
      return;
    }

    tbody.innerHTML = history.map(h => {
      return `
        <tr>
          <td style="color:var(--text-muted);">${new Date(h.packed_at).toLocaleTimeString('th-TH')}</td>
          <td><strong>${h.order_id}</strong></td>
          <td><span style="color:var(--accent-cyan); font-weight:bold;">${h.put_wall_slot}</span></td>
          <td><span class="tote-chip" style="background:rgba(245, 158, 11, 0.15); color:var(--warning); border-color:var(--warning);">${h.item_summary}</span></td>
          <td style="color:var(--success); font-weight:bold;">${formatLeadTimeSec(Math.floor(h.lead_time_ms / 1000))}</td>
        </tr>`;
    }).join('');
  }

  let activeQcOrderId = null;

  function openQCModal(orderId) {
    const ord = orders.find(o => o.orderId === orderId);
    if (!ord) return;
    activeQcOrderId = orderId;

    const modal = document.getElementById('modal-qc-pack');
    const orderIdEl = document.getElementById('qc-modal-order-id');
    const slotEl = document.getElementById('qc-modal-slot');
    const itemListEl = document.getElementById('qc-modal-item-list');
    const inspectorEl = document.getElementById('qc-inspector');
    const notesEl = document.getElementById('qc-notes');

    if (orderIdEl) orderIdEl.innerText = ord.orderId;
    if (slotEl) slotEl.innerText = ord.putWallSlot || 'PW-1';
    if (notesEl) notesEl.value = '';

    // Set default inspector from current clocked in worker
    if (inspectorEl) {
      const currentWorker = (typeof Worker !== 'undefined' && Worker.getCurrentWorker) ? Worker.getCurrentWorker() : null;
      inspectorEl.value = currentWorker ? `${currentWorker.name} (${currentWorker.id})` : 'พนักงานโต๊ะแพ็ก';
    }

    // Render items checklist
    if (itemListEl) {
      const products = (typeof Store !== 'undefined' && Store.getProducts) ? Store.getProducts() : [];
      itemListEl.innerHTML = Object.entries(ord.items).map(([skuId, qty], idx) => {
        const itemInfo = products.find(p => p.id === skuId) || { name: skuId, barcode: '-', loc: '-' };
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; background:#111827; padding:10px 12px; border-radius:6px; border:1px solid #374151;">
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
              <input type="checkbox" checked style="width:16px; height:16px; accent-color:var(--success);">
              <div>
                <div style="font-weight:600; font-size:13px; color:var(--text-main);">${itemInfo.name}</div>
                <div style="font-size:11px; color:var(--text-muted);">SKU: <strong style="color:var(--accent-cyan);">${skuId}</strong> | Barcode: ${itemInfo.barcode} | พิกัด: ${itemInfo.loc}</div>
              </div>
            </label>
            <div style="background:rgba(245, 158, 11, 0.2); color:#fbbf24; padding:4px 10px; border-radius:4px; font-weight:bold; font-size:14px;">
              × ${qty}
            </div>
          </div>`;
      }).join('');
    }

    // Reset status to PASS
    const passRadio = document.querySelector('input[name="qc-status"][value="PASS"]');
    if (passRadio) passRadio.checked = true;
    handleQCStatusChange('PASS');

    if (modal) modal.style.display = 'flex';
  }

  function closeQCModal() {
    const modal = document.getElementById('modal-qc-pack');
    if (modal) modal.style.display = 'none';
    activeQcOrderId = null;
  }

  function handleQCStatusChange(status) {
    const defectDetails = document.getElementById('qc-defect-details');
    if (!defectDetails) return;
    defectDetails.style.display = (status === 'FAIL') ? 'block' : 'none';
  }

  function handleQCDefectChange(val) {
    const customInput = document.getElementById('qc-custom-defect');
    if (customInput) {
      customInput.style.display = (val === 'CUSTOM') ? 'block' : 'none';
      if (val === 'CUSTOM') customInput.focus();
    }
  }

  async function submitQCAndPack() {
    if (!activeQcOrderId) return;
    const orderId = activeQcOrderId;

    const statusRadio = document.querySelector('input[name="qc-status"]:checked');
    const qcStatus = statusRadio ? statusRadio.value : 'PASS';
    let defectType = 'NONE';

    if (qcStatus === 'FAIL') {
      const selected = document.getElementById('qc-defect-type')?.value || 'WRONG_SKU';
      if (selected === 'CUSTOM') {
        defectType = document.getElementById('qc-custom-defect')?.value.trim() || 'OTHER_DEFECT';
      } else {
        defectType = selected;
      }
    }

    const defectNotes = document.getElementById('qc-notes')?.value || '';
    const inspectorName = document.getElementById('qc-inspector')?.value || 'พนักงานโต๊ะแพ็ก';

    const qcData = {
      inspectorName,
      status: qcStatus,
      defectType,
      defectNotes
    };

    closeQCModal();
    await packOrder(orderId, qcData);
  }

  async function packOrder(orderId, qcData = null) {
    try {
      const res = await API.packOrder(orderId, qcData);
      const qcMsg = (qcData && qcData.status === 'FAIL') ? ' (บันทึกข้อบกพร่อง QC เรียบร้อย)' : ' (ผ่านการตรวจ QC 100%)';
      alert(`📦 ออเดอร์ ${orderId} ตรวจ QC และปิดกล่องเรียบร้อย!${qcMsg}`);
      await reloadData();
      renderPackStation();
      renderHistoryTable();
      if (typeof Analytics !== 'undefined' && Analytics.refresh) Analytics.refresh();
    } catch (err) {
      console.warn('API packOrder failed, saving local pack:', err);
      const ord = orders.find(o => o.orderId === orderId);
      if (ord) {
        ord.status = 'Packed';
        ord.packedAt = Date.now();
        const duration = ord.packedAt - ord.startedAt;
        const products = (typeof Store !== 'undefined' && Store.getProducts) ? Store.getProducts() : [];
        const itemSummary = Object.keys(ord.items).map(k => {
          const p = products.find(x => x.id === k);
          return `${p?.name || k} (${ord.items[k]})`;
        }).join(', ');

        const histItem = {
          order_id: ord.orderId,
          put_wall_slot: ord.putWallSlot || 'Slot-P1',
          item_summary: itemSummary,
          lead_time_ms: duration,
          packed_at: new Date().toISOString()
        };
        history.unshift(histItem);

        if (qcData) {
          try {
            const localQcLogs = JSON.parse(localStorage.getItem('nexus_local_qc_logs') || '[]');
            const totalUnits = Object.values(ord.items || {}).reduce((a, b) => a + b, 0) || 1;
            localQcLogs.unshift({
              id: Date.now(),
              order_id: ord.orderId,
              inspector_name: qcData.inspectorName || 'พนักงานโต๊ะแพ็ก',
              status: qcData.status || 'PASS',
              defect_type: qcData.defectType || 'NONE',
              defect_notes: qcData.defectNotes || '',
              items_checked: totalUnits,
              inspected_at: Date.now()
            });
            localStorage.setItem('nexus_local_qc_logs', JSON.stringify(localQcLogs));
          } catch(e) {}
        }

        try {
          localStorage.setItem('nexus_local_history', JSON.stringify(history));
          localStorage.setItem('nexus_local_orders', JSON.stringify(orders));
        } catch(e) {}

        alert(`📦 ออเดอร์ ${orderId} ปิดกล่องสำเร็จ (โหมด Local)!`);
        updatePackStats();
        renderPackStation();
        renderHistoryTable();
        if (typeof Analytics !== 'undefined' && Analytics.refresh) Analytics.refresh();
      }
    }
  }

  function printOrderSlip(orderId) {
    const ord = orders.find(o => o.orderId === orderId);
    if (!ord) return;

    const products = Store.getProducts();
    const slipDiv = document.getElementById('print-section');
    if (!slipDiv) return;

    let itemsHtml = '';
    let grandTotal = 0;

    for (let [skuId, qty] of Object.entries(ord.items)) {
      let info = products.find(s => s.id === skuId) || { name: skuId, loc: '-', barcode: '-', price: 0 };
      let lineTotal = info.price * qty;
      grandTotal += lineTotal;
      itemsHtml += `
        <tr>
          <td style="padding:10px; border:1px solid #000; color:#000; text-align:center;">${info.loc}</td>
          <td style="padding:10px; border:1px solid #000; color:#000; font-family:monospace; text-align:center;">${info.barcode}</td>
          <td style="padding:10px; border:1px solid #000; color:#000;">
            <div style="display:flex; align-items:center; gap:8px;">
              <img src="${info.image || 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&w=600&q=80'}" style="width:34px; height:34px; object-fit:cover; border-radius:4px; border:1px solid #ccc;" onerror="this.style.display='none'">
              <span>${info.name}</span>
            </div>
          </td>
          <td style="padding:10px; border:1px solid #000; color:#000; text-align:right;">฿${info.price.toFixed(2)}</td>
          <td style="padding:10px; text-align:center; border:1px solid #000; font-weight:bold; color:#000;">${qty}</td>
          <td style="padding:10px; border:1px solid #000; color:#000; text-align:right; font-weight:bold;">฿${lineTotal.toFixed(2)}</td>
        </tr>`;
    }

    itemsHtml += `
      <tr style="background:#f3f4f6 !important;">
        <td colspan="5" style="padding:12px; border:1px solid #000; text-align:right; font-weight:bold; color:#000; font-size:16px;">ยอดรวมสุทธิ (Grand Total):</td>
        <td style="padding:12px; border:1px solid #000; text-align:right; font-weight:bold; color:#d97706; font-size:18px;">฿${grandTotal.toFixed(2)}</td>
      </tr>
    `;

    slipDiv.innerHTML = `
      <div style="font-family: sans-serif; color: black; background: white; padding: 20px;">
        <h2 style="text-align:center; margin-bottom:10px; font-size:24px; color:black;">ใบสั่งเบิกสินค้า (Pick Slip / Invoice)</h2>
        <div style="text-align:center; margin-bottom: 20px;"><svg id="print-barcode"></svg></div>
        <div style="display:flex; justify-content:space-between; margin-bottom: 20px; font-size:14px; color:black;">
          <div>
            <p style="margin-bottom:6px;"><strong>Order ID:</strong> ${ord.orderId}</p>
            <p style="margin-bottom:6px;"><strong>Put-Wall Slot (จุดรวมของ):</strong> ${ord.putWallSlot}</p>
            <p><strong>โซนที่เกี่ยวข้อง:</strong> ${ord.zones.join(', ')}</p>
          </div>
          <div style="text-align:right;">
            <p style="margin-bottom:6px;"><strong>วันที่พิมพ์:</strong> ${new Date().toLocaleString('th-TH')}</p>
            <p><strong>อุปกรณ์แนะนำ (MHE):</strong> ${ord.mhe.name}</p>
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; text-align:left; color:black;">
          <thead>
            <tr style="background: #e5e7eb !important; color:black;">
              <th style="padding:10px; border:1px solid #000; text-align:center;">พิกัด Location</th>
              <th style="padding:10px; border:1px solid #000; text-align:center;">EAN / Barcode</th>
              <th style="padding:10px; border:1px solid #000;">ชื่อสินค้า</th>
              <th style="padding:10px; border:1px solid #000; text-align:right;">ราคา/ชิ้น</th>
              <th style="padding:10px; border:1px solid #000; text-align:center;">จำนวน</th>
              <th style="padding:10px; border:1px solid #000; text-align:right;">รวม (บาท)</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
      </div>
    `;

    setTimeout(() => {
      JsBarcode("#print-barcode", ord.orderId, {
        format: "CODE128",
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 16,
        lineColor: "#000"
      });
      window.print();
      setTimeout(() => { slipDiv.innerHTML = ''; }, 1000);
    }, 300);
  }

  return {
    init,
    reloadData,
    renderPackStation,
    renderHistoryTable,
    packOrder,
    openQCModal,
    closeQCModal,
    handleQCStatusChange,
    handleQCDefectChange,
    submitQCAndPack,
    printOrderSlip
  };
})();

if (typeof window !== 'undefined') {
  window.Pack = Pack;
}
