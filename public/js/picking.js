/**
 * Nexus WMS - Zone Picking Hub & Scanner Module
 */
const Picking = (() => {
  let waves = [];
  let activeWaveId = null;
  let isMultiWaveMode = false;

  async function init() {
    await reloadWaves();
    renderWarehouseShelves();
    updateTaskConsole();
    renderWaveCards();
    updateHeadcountPlanner();

    // Real-time synchronization
    API.on('ORDER_CREATED', async () => {
      await reloadWaves();
      renderWarehouseShelves();
      updateTaskConsole();
      renderWaveCards();
      updateHeadcountPlanner();
    });

    API.on('PICK_SCANNED', async (payload) => {
      await reloadWaves();
      renderWarehouseShelves();
      updateTaskConsole();
      renderWaveCards();
      updateHeadcountPlanner();
    });

    API.on('ORDER_PACKED', async () => {
      await reloadWaves();
      renderWarehouseShelves();
      updateTaskConsole();
      renderWaveCards();
      updateHeadcountPlanner();
    });

    API.on('LOCATION_MOVED', async () => {
      await reloadWaves();
      renderWarehouseShelves();
      updateTaskConsole();
      renderWaveCards();
    });
  }

  async function reloadWaves() {
    try {
      const data = await API.getWaves();
      if (Array.isArray(data) && data.length > 0) {
        waves = data;
        if (!activeWaveId || !waves.some(w => w.waveId === activeWaveId && !w.completed)) {
          activeWaveId = waves.find(w => !w.completed)?.waveId || null;
        }
        return;
      }
    } catch (err) {
      console.warn('API getWaves unavailable, checking local storage:', err);
    }

    // Local waves fallback
    try {
      const localWaves = JSON.parse(localStorage.getItem('nexus_local_waves') || '[]');
      if (Array.isArray(localWaves) && localWaves.length > 0) {
        waves = localWaves;
      } else {
        waves = [
          {
            waveId: 'WV-1001',
            zone: 'A',
            completed: false,
            mhe: { name: 'ตะกร้าหิ้ว', style: 'background:rgba(16, 185, 129, 0.2); color:#34d399; border:1px solid #34d399;' },
            orders: ['ORD-99001'],
            totalUnits: 3,
            pickedUnits: 0,
            pickList: [
              { skuId: 'SKU-A-001', name: 'เครื่องดื่มชูกำลัง (Pack 6)', barcode: '8850000000010', loc: 'A-01-01', zone: 'A', qty: 2, pickedUnits: 0, completed: false },
              { skuId: 'SKU-A-002', name: 'น้ำแร่ธรรมชาติ 1.5L', barcode: '8850000000027', loc: 'A-01-02', zone: 'A', qty: 1, pickedUnits: 0, completed: false }
            ]
          }
        ];
        try { localStorage.setItem('nexus_local_waves', JSON.stringify(waves)); } catch(e) {}
      }
    } catch(e) {
      waves = [];
    }

    if (!activeWaveId || !waves.some(w => w.waveId === activeWaveId && !w.completed)) {
      activeWaveId = waves.find(w => !w.completed)?.waveId || (waves[0]?.waveId || null);
    }
  }

  function getHumanReadableLocation(loc) {
    if (!loc) return '';
    const parts = loc.split('-');
    if (parts.length >= 3) return `โซน ${parts[1]} - ล็อก ${parseInt(parts[2], 10)}`;
    return loc;
  }

  function toggleMultiWaveMode() {
    isMultiWaveMode = !isMultiWaveMode;
    const btn = document.getElementById('btn-toggle-multi-wave');
    const mapTitle = document.getElementById('map-mode-title');

    if (isMultiWaveMode) {
      btn.innerText = "← กลับมาทำทีละ Order";
      btn.style.background = "var(--accent-orange)";
      btn.style.color = "white";
      mapTitle.innerText = "ภาพรวมค้างหยิบบนเชลฟ์";
    } else {
      btn.innerText = "⚡ เปิด Parallel Picking";
      btn.style.background = "var(--bg-surface-soft)";
      btn.style.color = "var(--text-main)";
      mapTitle.innerText = activeWaveId ? `เฉพาะงาน: ${activeWaveId}` : "ยังไม่ได้เลือกงาน";
    }

    renderWarehouseShelves();
    updateTaskConsole();
  }

  function switchWave(waveId) {
    activeWaveId = waveId;
    renderWaveCards();
    updateTaskConsole();
    renderWarehouseShelves();
    const input = document.getElementById('scanner-input');
    if (input) input.focus();
  }

  function getPickQty() {
    const input = document.getElementById('pick-qty-input');
    return input ? Math.max(1, parseInt(input.value, 10) || 1) : 1;
  }

  function setPickQty(n) {
    const input = document.getElementById('pick-qty-input');
    if (input) {
      if (n === 'ALL') {
        // If current task is active, set to remaining needed
        const task = getCurrentTargetTask();
        if (task) {
          const remain = Math.max(1, task.qty - task.pickedUnits);
          input.value = remain;
        } else {
          input.value = 10;
        }
      } else {
        input.value = Math.max(1, parseInt(n, 10) || 1);
      }
      updatePickQtyPresets();
    }
  }

  function adjustPickQty(delta) {
    const input = document.getElementById('pick-qty-input');
    if (input) {
      const current = parseInt(input.value, 10) || 1;
      input.value = Math.max(1, current + delta);
      updatePickQtyPresets();
    }
  }

  function updatePickQtyPresets() {
    const val = getPickQty();
    document.querySelectorAll('.pick-qty-preset-btn').forEach(b => {
      const pVal = b.getAttribute('data-qty');
      b.classList.toggle('active', pVal == val);
    });
  }

  function getCurrentTargetTask() {
    const currentWave = waves.find(w => w.waveId === activeWaveId && !w.completed);
    if (currentWave) {
      return currentWave.pickList.find(t => (t.pickedUnits || 0) < t.qty);
    }
    return null;
  }

  function handleScannerInput(event) {
    if (event.key === 'Enter') {
      const input = document.getElementById('scanner-input');
      const val = input.value.trim();
      input.value = "";
      if (val) processScannedCode(val);
    }
  }

  async function processScannedCode(scannedCode) {
    const logBox = document.getElementById('scanner-status-log');
    const worker = Worker.getCurrentWorker();
    const pickQty = getPickQty();

    try {
      const res = await API.scanPick({
        scannedCode,
        workerId: worker ? worker.id : null,
        isMultiWaveMode,
        activeWaveId,
        pickQty
      });

      if (res.success) {
        App.playBeep(true);
        logBox.innerHTML = `<span style="color:var(--success)">${res.message}</span>`;

        if (res.completedWave) {
          alert(`🎉 งานกลุ่มโซน ${res.wave.zone} เสร็จสิ้น! ให้นำของไปรวมที่โต๊ะ Put-Wall`);
        }

        await reloadWaves();
        renderWarehouseShelves();
        updateTaskConsole();
        renderWaveCards();
        updateHeadcountPlanner();
      } else {
        App.playBeep(false);
        logBox.innerHTML = `<span style="color:var(--danger)">${res.error}</span>`;
      }
    } catch (err) {
      console.warn('API scanPick failed, performing local scan:', err);
      let targetWave = waves.find(w => w.waveId === activeWaveId && !w.completed);
      if (isMultiWaveMode || !targetWave) {
        targetWave = waves.find(w => !w.completed && w.pickList.some(t => !t.completed && (t.barcode === scannedCode || (t.skuId && t.skuId.toLowerCase() === scannedCode.toLowerCase()))));
      }

      if (!targetWave) {
        App.playBeep(false);
        logBox.innerHTML = `<span style="color:var(--danger)">ไม่พบงานหรือบาร์โค้ดไม่ถูกต้อง: ${scannedCode}</span>`;
        return;
      }

      const task = targetWave.pickList.find(t => !t.completed && (t.barcode === scannedCode || (t.skuId && t.skuId.toLowerCase() === scannedCode.toLowerCase())));
      if (!task) {
        App.playBeep(false);
        logBox.innerHTML = `<span style="color:var(--danger)">บาร์โค้ด ${scannedCode} ไม่ตรงกับสินค้าในใบหยิบนี้</span>`;
        return;
      }

      const remaining = task.qty - (task.pickedUnits || 0);
      const actual = Math.min(pickQty, remaining);
      task.pickedUnits = (task.pickedUnits || 0) + actual;
      targetWave.pickedUnits = (targetWave.pickedUnits || 0) + actual;
      if (task.pickedUnits >= task.qty) {
        task.completed = true;
      }
      if (targetWave.pickList.every(t => t.completed || t.pickedUnits >= t.qty)) {
        targetWave.completed = true;
      }

      // Update worker units picked locally
      if (worker) {
        worker.units_picked = (worker.units_picked || 0) + actual;
        try { localStorage.setItem('nexus_current_scanner_user', JSON.stringify(worker)); } catch(e) {}
      }

      // Decrement product stock locally
      const products = (typeof Store !== 'undefined' && Store.getProducts) ? Store.getProducts() : [];
      const prod = products.find(p => p.id === task.skuId || p.barcode === task.barcode);
      if (prod) {
        prod.stock = Math.max(0, (prod.stock || 0) - actual);
        prod.picks = (prod.picks || 0) + actual;
        try { localStorage.setItem('nexus_products_cache', JSON.stringify(products)); } catch(e) {}
      }

      try { localStorage.setItem('nexus_local_waves', JSON.stringify(waves)); } catch (e) {}

      App.playBeep(true);
      logBox.innerHTML = `<span style="color:var(--success)">✅ [Local] หยิบสำเร็จ: ${task.name || task.skuName} (+${actual} ชิ้น) (${task.pickedUnits}/${task.qty}) ➔ ช่อง ${task.targetSlot || 'PW-1'}</span>`;
      if (targetWave.completed) {
        alert(`🎉 งานกลุ่มโซน ${targetWave.zone} เสร็จสิ้น! ให้นำของไปรวมที่โต๊ะ Put-Wall`);
      }

      renderWarehouseShelves();
      updateTaskConsole();
      renderWaveCards();
      updateHeadcountPlanner();
    }
  }

  function updateHeadcountPlanner() {
    let remain = { A: 0, B: 0, C: 0 };
    waves.filter(w => !w.completed).forEach(w => {
      w.pickList.forEach(t => {
        remain[t.zone] = (remain[t.zone] || 0) + (t.qty - t.pickedUnits);
      });
    });

    ['A', 'B', 'C'].forEach(zone => {
      const valEl = document.getElementById(`hc-${zone.toLowerCase()}-val`);
      const descEl = document.getElementById(`hc-${zone.toLowerCase()}-desc`);
      if (valEl && descEl) {
        const headcount = Math.ceil(remain[zone] / 50) || 1;
        valEl.innerText = remain[zone] === 0 ? "0 คน" : `${headcount} คน`;
        descEl.innerText = `ค้าง ${remain[zone]} ชิ้น`;
      }
    });
  }

  function updateTaskConsole() {
    const consoleBox = document.getElementById('task-step-details');
    if (!consoleBox) return;

    let targetTask = null;
    let targetWaveId = activeWaveId;

    if (isMultiWaveMode) {
      for (const w of waves.filter(w => !w.completed)) {
        const t = w.pickList.find(i => i.pickedUnits < i.qty);
        if (t) {
          targetTask = t;
          targetWaveId = w.waveId;
          break;
        }
      }
    } else {
      const currentWave = waves.find(w => w.waveId === activeWaveId);
      if (currentWave && !currentWave.completed) {
        targetTask = currentWave.pickList.find(i => i.pickedUnits < i.qty);
      }
    }

    if (!targetTask) {
      consoleBox.innerHTML = `<div style="color: var(--success); font-weight: bold; font-size: 14px;">✔ ไม่มีรายการหยิบค้างในขณะนี้</div>`;
      return;
    }

    const products = Store.getProducts();
    const itemInfo = products.find(s => s.id === targetTask.skuId) || {};
    const percent = Math.round((targetTask.pickedUnits / targetTask.qty) * 100);
    const humanLocText = getHumanReadableLocation(targetTask.loc);

    consoleBox.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
        <div>
          <span style="font-size:11px; color:var(--accent-orange); font-weight:bold; display:block; margin-bottom:4px;">🎯 จุดที่ต้องเดินไป [${targetWaveId}]</span>
          <div class="human-loc">📍 ${humanLocText}</div>
          <div style="font-size:24px; font-weight:800; color:var(--text-main);">${targetTask.loc}</div>
        </div>
        <div style="text-align:right;">
          <span class="tote-chip">ปลายทาง: ${targetTask.targetSlot}</span>
          <div style="margin-top:12px;">
            <button class="btn-danger" onclick="App.playBeep(false); alert('แจ้งของขาดสต็อกเรียบร้อย');">⚠️ แจ้งของขาด</button>
          </div>
        </div>
      </div>
      <div style="display:flex; gap:14px; margin-top:12px; align-items:center; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; border:1px solid var(--border);">
        <img src="${itemInfo.image || 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&w=600&q=80'}" style="width:72px; height:72px; border-radius:8px; object-fit:cover; border:1px solid #374151; flex-shrink:0;" alt="${targetTask.skuName}" onerror="this.src='https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&w=600&q=80'">
        <div style="flex:1; min-width:0;">
          <div style="font-size:14px; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${targetTask.skuName}</div>
          <div style="font-size:12px; color:var(--warning); font-family:monospace; margin-top:3px;">[ บาร์โค้ด EAN: ${itemInfo.barcode || targetTask.barcode} ]</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">น้ำหนัก: ${itemInfo.weight || 1} kg | ขนาด: ${itemInfo.size || 'S'}</div>
        </div>
      </div>
      <div style="font-size:15px; font-weight:bold; color:var(--text-main); margin-top:12px;">
        ความคืบหน้า: <span style="color:var(--accent-orange); font-size:20px;">${targetTask.pickedUnits}</span> / ${targetTask.qty} ชิ้น
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar-fill" style="width: ${percent}%;"></div>
      </div>
    `;
  }

  function renderWarehouseShelves() {
    let targetItems = {};
    if (isMultiWaveMode) {
      waves.filter(w => !w.completed).forEach(w => {
        w.pickList.filter(i => i.pickedUnits < i.qty).forEach(t => {
          targetItems[t.skuId] = (targetItems[t.skuId] || 0) + (t.qty - t.pickedUnits);
        });
      });
    } else {
      const currentWave = waves.find(w => w.waveId === activeWaveId);
      if (currentWave && !currentWave.completed) {
        currentWave.pickList.filter(i => i.pickedUnits < i.qty).forEach(t => {
          targetItems[t.skuId] = (targetItems[t.skuId] || 0) + (t.qty - t.pickedUnits);
        });
      }
    }

    const products = Store.getProducts();

    ['A', 'B', 'C'].forEach(zone => {
      const rackEl = document.getElementById(`shelf-rack-${zone}`);
      if (!rackEl) return;

      const items = products.filter(s => s.zone === zone);
      rackEl.innerHTML = items.map(item => {
        const count = targetItems[item.id] || 0;
        const isTarget = count > 0;
        const imgUrl = item.image || 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&w=600&q=80';
        return `
          <div class="shelf-slot ${isTarget ? 'target-active' : ''}" 
               onclick="if(typeof Inbound !== 'undefined') Inbound.openQuickRelocateModal('${item.id}')"
               title="${getHumanReadableLocation(item.loc)} - คลิกเพื่อย้ายตำแหน่ง (Relocate)">
            <div class="slot-led"></div>
            ${isTarget ? `<div class="counter-badge">${count}</div>` : ''}
            <div style="position:absolute; top:2px; right:4px; font-size:10px; opacity:0.6;" title="คลิกเพื่อย้ายตำแหน่ง">📍</div>
            <img src="${imgUrl}" style="width:36px; height:36px; border-radius:4px; object-fit:cover; margin:0 auto 3px auto; display:block;" onerror="this.style.display='none'">
            <div style="font-size:11px; font-weight:bold; color:${isTarget ? 'var(--accent-orange)' : 'var(--accent-cyan)'};">${item.loc}</div>
            <div style="font-size:10px; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</div>
            <div style="font-size:9px; color:var(--text-muted); margin-top:1px;">สต็อก: ${item.stock}</div>
          </div>`;
      }).join('');
    });
  }

  function renderWaveCards() {
    const container = document.getElementById('wave-list-box');
    const counterEl = document.getElementById('wave-counter');
    if (!container) return;

    const activeWaves = waves.filter(w => !w.completed);
    if (counterEl) counterEl.innerText = `${activeWaves.length} งาน`;

    if (activeWaves.length === 0) {
      container.innerHTML = `<p style="color:var(--text-muted); font-size:12px;">ไม่มีรอบงานค้าง</p>`;
      return;
    }

    container.innerHTML = activeWaves.map(w => {
      const isActive = w.waveId === activeWaveId;
      const totalUnits = w.pickList.reduce((acc, cur) => acc + cur.qty, 0);
      const pickedUnits = w.pickList.reduce((acc, cur) => acc + cur.pickedUnits, 0);

      return `
        <div class="wave-tile ${isActive && !isMultiWaveMode ? 'active-wave' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:13px; color:${isActive ? 'var(--accent-cyan)' : 'var(--text-main)'}">${w.waveId}</strong>
            <span style="font-size:11px; color:var(--accent-orange);">หยิบแล้ว ${pickedUnits}/${totalUnits} ชิ้น</span>
          </div>
          ${!w.completed && !isMultiWaveMode ? `
            <button class="btn-action" style="margin-top:8px; width:100%; font-size:11px;" onclick="Picking.switchWave('${w.waveId}')">
              ${isActive ? 'กำลังทำโซนนี้' : 'สลับมาทำโซนนี้'}
            </button>` : ''}
        </div>`;
    }).join('');
  }

  return {
    init,
    reloadWaves,
    toggleMultiWaveMode,
    switchWave,
    handleScannerInput,
    processScannedCode,
    renderWarehouseShelves,
    updateTaskConsole,
    renderWaveCards,
    updateHeadcountPlanner,
    setPickQty,
    adjustPickQty,
    getPickQty
  };
})();

if (typeof window !== 'undefined') {
  window.Picking = Picking;
}
