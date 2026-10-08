/**
 * Nexus WMS - Enterprise Operational Analytics & KPI Module
 * 1. ข้อมูลจัดเก็บสินค้าตามกลุ่ม ABC กำกับชั้นวางและข้อเสนอแนะ Slotting
 * 2. KPI QC คุณภาพการหยิบ-แพ็ก (Pass Rate, Dynamic Defect Breakdown, Audit Logs)
 * 3. KPI เวลาการทำงานต่อ 1 Order (Cycle Time, Avg Lead Time, SLA Compliance)
 * 4. ติดตามการใช้คนและเวลาตัวเลขเพื่อคำนวณการทำงาน (Labor Tracking & Capacity Calculator)
 * 5. Background Operations & QC Audit Logs พร้อมระบบแก้ไขหัวข้อข้อผิดพลาดและซิงค์ KPI อัตโนมัติ
 */
const Analytics = (() => {
  let pickChart = null;
  let qcRatioChart = null;
  let qcDefectChart = null;
  let leadTimeChart = null;

  let currentTab = 'storage';
  let storageFilter = 'ALL';
  let storageSearch = '';
  let cachedAnalytics = null;

  // Logs filter states
  let logStatusFilter = 'ALL';
  let logDefectFilter = 'ALL';
  let logSearchQuery = '';

  const DEFAULT_IMG = "https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&w=600&q=80";

  const DEFECT_LABELS = {
    'NONE': '✅ สมบูรณ์ (ไม่มีข้อบกพร่อง)',
    'WRONG_SKU': '❌ หยิบสินค้าผิด SKU (Wrong Item)',
    'WRONG_QTY': '⚠️ จำนวนสินค้าไม่ตรง / ไม่ครบ (Short/Over Quantity)',
    'DAMAGED_ITEM': '📦 สินค้าชำรุด / กล่องบุบแตก (Damaged)',
    'DEFECTIVE_BARCODE': '🏷️ บาร์โค้ดเสียหาย / สแกนไม่ติด (Defective Barcode)',
    'EXPIRED_ITEM': '⏳ สินค้าหมดอายุ / เสื่อมสภาพ (Expired Item)',
    'PACKAGING_TORN': '🛍️ บรรจุภัณฑ์ฉีกขาด / ซีลหลุด (Damaged Packaging)',
    'WRONG_SLOT': '📍 วางผิดช่อง Put-Wall (Wrong Slot)'
  };

  function getDefectLabel(code) {
    if (!code || code === 'NONE') return '✅ สมบูรณ์ (ไม่มีข้อบกพร่อง)';
    return DEFECT_LABELS[code] || `📝 ${code}`;
  }

  function formatSec(sec) {
    if (isNaN(sec) || sec < 0) return "00:00";
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  async function init() {
    await refresh();

    // Listen to real-time events to auto-refresh KPI metrics
    if (typeof API !== 'undefined' && API.on) {
      API.on('PICK_SCANNED', () => refresh());
      API.on('ORDER_CREATED', () => refresh());
      API.on('ORDER_PACKED', () => refresh());
      API.on('QC_INSPECTED', () => refresh());
      API.on('QC_LOG_UPDATED', () => refresh());
      API.on('QC_UPDATED', () => refresh());
      API.on('STOCK_UPDATED', () => refresh());
      API.on('WORKER_UPDATED', () => refresh());
    }

    // Initialize labor calculator defaults
    calculateLabor();
  }

  async function refresh() {
    try {
      if (typeof API !== 'undefined' && API.getAnalytics) {
        cachedAnalytics = await API.getAnalytics();
      }
    } catch (err) {
      console.warn('API getAnalytics error, using local fallback:', err);
    }

    if (!cachedAnalytics) {
      cachedAnalytics = buildLocalAnalytics();
    }

    renderCurrentTab();
  }

  function buildLocalAnalytics() {
    const products = (typeof Store !== 'undefined' && Store.getProducts) ? Store.getProducts() : [];
    const localHistory = JSON.parse(localStorage.getItem('nexus_local_history') || '[]');
    const localWorkers = JSON.parse(localStorage.getItem('nexus_local_workers') || '[]');

    let totalPicks = 0;
    const zoneData = { A: 0, B: 0, C: 0 };
    products.forEach(p => {
      zoneData[p.zone] = (zoneData[p.zone] || 0) + (p.picks || 0);
      totalPicks += (p.picks || 0);
    });

    const sorted = [...products].sort((a, b) => (b.picks || 0) - (a.picks || 0));
    let cumPicks = 0;
    const enriched = sorted.map((p, idx) => {
      cumPicks += (p.picks || 0);
      const share = totalPicks > 0 ? (cumPicks / totalPicks) * 100 : 0;
      let abcClass = 'C';
      if (idx < 12 || share <= 75) abcClass = 'A';
      else if (idx < 28 || share <= 92) abcClass = 'B';

      const parts = (p.loc || '').split('-');
      const binNum = parseInt(parts[2] || '1', 10);
      let levelNumber = 2;
      let levelDesc = 'Level 2 (ระดับเอว)';
      let isGoldenZone = true;

      if (binNum === 1) {
        levelNumber = 1; levelDesc = 'Level 1 (ชั้นล่าง)'; isGoldenZone = false;
      } else if (binNum === 2) {
        levelNumber = 2; levelDesc = 'Level 2 (ระดับเอว)'; isGoldenZone = true;
      } else if (binNum === 3) {
        levelNumber = 3; levelDesc = 'Level 3 (ระดับสายตา)'; isGoldenZone = true;
      } else {
        levelNumber = 4; levelDesc = 'Level 4 (ชั้นบนสุด)'; isGoldenZone = false;
      }

      let slottingStatus = 'OPTIMAL';
      let slottingRecommendation = 'ตำแหน่งจัดเก็บเหมาะสม (Optimal)';
      if (abcClass === 'A' && !isGoldenZone) {
        slottingStatus = 'SUBOPTIMAL';
        slottingRecommendation = '⚠️ สินค้าขายดี ควรย้ายมา Golden Zone (ชั้น 2-3)';
      } else if (abcClass === 'C' && isGoldenZone) {
        slottingStatus = 'INEFFICIENT';
        slottingRecommendation = 'ℹ️ สินค้าหมุนช้า ควรย้ายไปชั้นบน (ชั้น 4)';
      }

      return {
        ...p,
        abcClass,
        shelfLevel: levelNumber,
        shelfLevelDesc: levelDesc,
        isGoldenZone,
        slottingStatus,
        slottingRecommendation
      };
    });

    let totalLeadTimeMs = 0;
    let minMs = localHistory.length > 0 ? localHistory[0].lead_time_ms : 0;
    let maxMs = localHistory.length > 0 ? localHistory[0].lead_time_ms : 0;
    let onTimeCount = 0;
    const timeDist = { under2Min: 0, between2And3Min: 0, between3And5Min: 0, over5Min: 0 };

    localHistory.forEach(h => {
      const ms = h.lead_time_ms || 120000;
      totalLeadTimeMs += ms;
      if (ms < minMs) minMs = ms;
      if (ms > maxMs) maxMs = ms;
      if (ms <= 180000) onTimeCount++;

      if (ms < 120000) timeDist.under2Min++;
      else if (ms <= 180000) timeDist.between2And3Min++;
      else if (ms <= 300000) timeDist.between3And5Min++;
      else timeDist.over5Min++;
    });

    const avgMs = localHistory.length > 0 ? Math.round(totalLeadTimeMs / localHistory.length) : 0;
    const slaCompliance = localHistory.length > 0 ? parseFloat(((onTimeCount / localHistory.length) * 100).toFixed(1)) : 100.0;

    let activeWk = 0;
    let totalHrs = 0;
    let unitsTotal = 0;
    const now = Date.now();

    const workerStats = localWorkers.map(w => {
      unitsTotal += (w.units_picked || 0);
      if (w.clocked_in) activeWk++;
      let ms = w.total_time_ms || 0;
      if (w.clocked_in && w.last_clock_in_at) ms += (now - w.last_clock_in_at);
      const hrs = (ms / (1000 * 3600));
      totalHrs += hrs;
      return {
        ...w,
        work_hours: parseFloat(hrs.toFixed(2)),
        uph: hrs > 0 ? parseFloat((w.units_picked / hrs).toFixed(1)) : 0
      };
    });

    // Local QC Logs
    let localQCLogs = JSON.parse(localStorage.getItem('nexus_local_qc_logs') || 'null');
    if (!localQCLogs || !Array.isArray(localQCLogs) || localQCLogs.length === 0) {
      localQCLogs = [
        { id: 1, order_id: 'ORD-9801', inspector_name: 'วิชัย แพ็กแม่นยำ', status: 'PASS', defect_type: 'NONE', defect_notes: 'สินค้าครบถ้วน บาร์โค้ดถูกต้อง', items_checked: 3, inspected_at: now - 45 * 60 * 1000 },
        { id: 2, order_id: 'ORD-9802', inspector_name: 'สมศรี จัดของไว', status: 'PASS', defect_type: 'NONE', defect_notes: 'ตรวจสอบผ่าน 100%', items_checked: 2, inspected_at: now - 38 * 60 * 1000 },
        { id: 3, order_id: 'ORD-9803', inspector_name: 'วิชัย แพ็กแม่นยำ', status: 'FAIL', defect_type: 'WRONG_SKU', defect_notes: 'หยิบผิดกล่อง จาก SKU-A-003 เป็น SKU-A-004', items_checked: 4, inspected_at: now - 30 * 60 * 1000 },
        { id: 4, order_id: 'ORD-9804', inspector_name: 'สมชาย ว่องไว', status: 'PASS', defect_type: 'NONE', defect_notes: 'ตรวจเช็คเรียบร้อย', items_checked: 5, inspected_at: now - 25 * 60 * 1000 },
        { id: 5, order_id: 'ORD-9805', inspector_name: 'วิชัย แพ็กแม่นยำ', status: 'PASS', defect_type: 'NONE', defect_notes: 'สภาพกล่องและฉลากสมบูรณ์', items_checked: 1, inspected_at: now - 18 * 60 * 1000 },
        { id: 6, order_id: 'ORD-9806', inspector_name: 'สมศรี จัดของไว', status: 'PASS', defect_type: 'NONE', defect_notes: 'ผ่าน QC', items_checked: 3, inspected_at: now - 12 * 60 * 1000 },
        { id: 7, order_id: 'ORD-9807', inspector_name: 'สมชาย ว่องไว', status: 'FAIL', defect_type: 'DAMAGED_ITEM', defect_notes: 'มุมกล่องพัสดุบุบ มีรอยกดทับ', items_checked: 2, inspected_at: now - 6 * 60 * 1000 },
        { id: 8, order_id: 'ORD-9808', inspector_name: 'วิชัย แพ็กแม่นยำ', status: 'PASS', defect_type: 'NONE', defect_notes: 'ผ่านการตรวจสอบคุณภาพ', items_checked: 4, inspected_at: now - 2 * 60 * 1000 }
      ];
      try { localStorage.setItem('nexus_local_qc_logs', JSON.stringify(localQCLogs)); } catch(e) {}
    }

    const qcTotal = localQCLogs.length;
    const qcPass = localQCLogs.filter(l => l.status === 'PASS').length;
    const qcFail = localQCLogs.filter(l => l.status === 'FAIL').length;
    const qcPassRate = qcTotal > 0 ? parseFloat(((qcPass / qcTotal) * 100).toFixed(1)) : 100.0;
    const defectBreakdown = {
      WRONG_SKU: 0,
      WRONG_QTY: 0,
      DAMAGED_ITEM: 0,
      DEFECTIVE_BARCODE: 0
    };
    localQCLogs.forEach(l => {
      if (l.status === 'FAIL' && l.defect_type && l.defect_type !== 'NONE') {
        defectBreakdown[l.defect_type] = (defectBreakdown[l.defect_type] || 0) + 1;
      }
    });

    return {
      zoneData,
      totalPicks,
      topSkus: enriched.slice(0, 5),
      totalPacked: localHistory.length,
      avgLeadTimeMs: avgMs,
      minLeadTimeMs: minMs,
      maxLeadTimeMs: maxMs,
      slaTargetMs: 180000,
      slaComplianceRate: slaCompliance,
      timeDistribution: timeDist,
      activeWorkers: activeWk,
      totalWorkers: localWorkers.length,
      totalHoursAll: parseFloat(totalHrs.toFixed(2)),
      totalUnitsPicked: unitsTotal,
      uph: totalHrs > 0 ? (unitsTotal / totalHrs).toFixed(1) : '0.0',
      opmh: totalHrs > 0 ? (localHistory.length / totalHrs).toFixed(1) : '0.0',
      workerStats,
      qcStats: {
        totalInspected: qcTotal,
        passCount: qcPass,
        failCount: qcFail,
        passRate: qcPassRate,
        defectBreakdown
      },
      qcLogs: localQCLogs,
      storageSlotting: {
        totalSkus: enriched.length,
        classA: enriched.filter(p => p.abcClass === 'A'),
        classB: enriched.filter(p => p.abcClass === 'B'),
        classC: enriched.filter(p => p.abcClass === 'C'),
        allProducts: enriched
      }
    };
  }

  function switchTab(tabId) {
    currentTab = tabId;
    ['storage', 'qc', 'leadtime', 'labor', 'logs'].forEach(id => {
      const btn = document.getElementById(`tab-btn-${id}`);
      const sec = document.getElementById(`analytics-section-${id}`);
      if (btn) btn.classList.toggle('active', id === tabId);
      if (sec) sec.style.display = (id === tabId) ? 'block' : 'none';
    });

    renderCurrentTab();
  }

  function renderCurrentTab() {
    if (!cachedAnalytics) return;

    if (currentTab === 'storage') {
      renderStorageTab();
    } else if (currentTab === 'qc') {
      renderQCTab();
    } else if (currentTab === 'leadtime') {
      renderLeadTimeTab();
    } else if (currentTab === 'labor') {
      renderLaborTab();
    } else if (currentTab === 'logs') {
      renderLogsTab();
    }
  }

  // ================= 1. TAB: ข้อมูลจัดเก็บสินค้าตาม ABC & ชั้นวาง =================
  function renderStorageTab() {
    const data = cachedAnalytics;
    const slotting = data.storageSlotting || { allProducts: [], classA: [], classB: [], classC: [] };
    const all = slotting.allProducts || [];

    const kpiA = document.getElementById('kpi-sku-class-a');
    const kpiB = document.getElementById('kpi-sku-class-b');
    const kpiC = document.getElementById('kpi-sku-class-c');
    const kpiGZ = document.getElementById('kpi-golden-zone-ratio');

    if (kpiA) kpiA.innerText = `${slotting.classA.length} SKU`;
    if (kpiB) kpiB.innerText = `${slotting.classB.length} SKU`;
    if (kpiC) kpiC.innerText = `${slotting.classC.length} SKU`;

    const goldenCount = all.filter(p => p.isGoldenZone).length;
    const goldenRatio = all.length > 0 ? ((goldenCount / all.length) * 100).toFixed(1) : 0;
    if (kpiGZ) kpiGZ.innerText = `${goldenRatio}% (${goldenCount}/${all.length})`;

    renderPickChart();
    renderTopSkus(data.topSkus || []);
    renderStorageTable();
  }

  function renderPickChart() {
    const canvas = document.getElementById('pickFrequencyChart');
    if (!canvas || !cachedAnalytics) return;
    const ctx = canvas.getContext('2d');
    const zoneData = cachedAnalytics.zoneData || { A: 0, B: 0, C: 0 };

    if (pickChart) pickChart.destroy();

    pickChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [
          `Zone A (หมุนเร็ว): ${zoneData.A} ชิ้น`,
          `Zone B (ปานกลาง): ${zoneData.B} ชิ้น`,
          `Zone C (เคลื่อนไหวช้า): ${zoneData.C} ชิ้น`
        ],
        datasets: [{
          data: [zoneData.A, zoneData.B, zoneData.C],
          backgroundColor: ['#ef4444', '#f59e0b', '#6b7280'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#f3f4f6', font: { size: 11 } } }
        },
        cutout: '70%'
      }
    });

    const totalEl = document.getElementById('chart-total-picks');
    if (totalEl) {
      totalEl.innerText = `ยอดหยิบรวมทั้งหมด: ${cachedAnalytics.totalPicks} ชิ้น (100%)`;
    }
  }

  function renderTopSkus(topList) {
    const container = document.getElementById('top-sku-list');
    if (!container) return;

    if (!topList || topList.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted); font-size:12px;">ยังไม่มีข้อมูลการหยิบ</p>';
      return;
    }

    container.innerHTML = topList.map((item, idx) => `
      <div class="top-sku-card">
        <div class="top-sku-rank">#${idx + 1}</div>
        <img src="${item.image || DEFAULT_IMG}" style="width:40px; height:40px; border-radius:6px; object-fit:cover;" onerror="this.src='${DEFAULT_IMG}'">
        <div style="flex:1;">
          <div style="font-weight:600; font-size:13px; color:var(--text-main);">${item.name}</div>
          <div style="font-size:11px; color:var(--text-muted);">พิกัด: <strong style="color:var(--accent-orange); font-family:monospace;">${item.loc}</strong> | โซน ${item.zone}</div>
        </div>
        <div style="text-align:right;">
          <div style="color:var(--accent-orange); font-weight:bold; font-size:14px;">${item.picks} picks</div>
          <span class="badge-zone zone-${item.abcClass}-tag">Class ${item.abcClass}</span>
        </div>
      </div>
    `).join('');
  }

  function filterStorage(cls) {
    storageFilter = cls;
    document.querySelectorAll('.filter-storage-btn').forEach(b => {
      const onclickVal = b.getAttribute('onclick') || '';
      b.classList.toggle('active', onclickVal.includes(`'${cls}'`));
    });
    renderStorageTable();
  }

  function searchStorage(query) {
    storageSearch = query.trim().toLowerCase();
    renderStorageTable();
  }

  function renderStorageTable() {
    const tbody = document.getElementById('storage-slotting-table-body');
    if (!tbody || !cachedAnalytics) return;

    let items = (cachedAnalytics.storageSlotting && cachedAnalytics.storageSlotting.allProducts)
      ? cachedAnalytics.storageSlotting.allProducts
      : [];

    if (storageFilter !== 'ALL') {
      items = items.filter(s => s.abcClass === storageFilter);
    }

    if (storageSearch) {
      items = items.filter(s =>
        (s.name && s.name.toLowerCase().includes(storageSearch)) ||
        (s.id && s.id.toLowerCase().includes(storageSearch)) ||
        (s.barcode && s.barcode.includes(storageSearch)) ||
        (s.loc && s.loc.toLowerCase().includes(storageSearch))
      );
    }

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:20px;">ไม่พบรายการสินค้าตามเงื่อนไข</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(item => {
      let recHtml = `<span class="slot-opt-optimal">เหมาะสม (Optimal)</span>`;
      if (item.slottingStatus === 'SUBOPTIMAL') {
        recHtml = `<span class="slot-opt-suboptimal">${item.slottingRecommendation}</span>`;
      } else if (item.slottingStatus === 'INEFFICIENT') {
        recHtml = `<span class="slot-opt-inefficient">${item.slottingRecommendation}</span>`;
      }

      const levelTag = item.isGoldenZone
        ? `<span class="golden-zone-tag">⭐ ${item.shelfLevelDesc}</span>`
        : `<span class="level-tag">${item.shelfLevelDesc}</span>`;

      return `
        <tr>
          <td>
            <strong>${item.id}</strong><br>
            <span style="font-size:11px; color:var(--accent-cyan); font-family:monospace;">${item.barcode}</span>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <img src="${item.image || DEFAULT_IMG}" style="width:36px; height:36px; border-radius:6px; object-fit:cover; border:1px solid #374151;" onerror="this.src='${DEFAULT_IMG}'">
              <div>
                <span style="font-weight:500;">${item.name}</span><br>
                <span style="font-size:10px; color:var(--text-muted);">${item.cat || '-'}</span>
              </div>
            </div>
          </td>
          <td>
            <strong style="color:var(--accent-cyan); font-family:monospace; font-size:14px;">${item.loc}</strong>
          </td>
          <td>${levelTag}</td>
          <td style="font-weight:bold;">${item.stock} ชิ้น</td>
          <td style="color:var(--accent-orange); font-weight:bold;">${item.picks || 0} ชิ้น</td>
          <td>
            <span class="badge-zone zone-${item.abcClass}-tag">CLASS ${item.abcClass}</span>
          </td>
          <td>${recHtml}</td>
        </tr>`;
    }).join('');
  }

  // ================= 2. TAB: KPI QC & ความแม่นยำ =================
  function renderQCTab() {
    const data = cachedAnalytics;
    const qc = data.qcStats || { totalInspected: 0, passCount: 0, failCount: 0, passRate: 100, defectBreakdown: {} };

    const passRateEl = document.getElementById('kpi-qc-pass-rate');
    const passSubEl = document.getElementById('kpi-qc-pass-sub');
    const inspectedEl = document.getElementById('kpi-qc-total-inspected');
    const defectsEl = document.getElementById('kpi-qc-total-defects');
    const defectRateEl = document.getElementById('kpi-qc-defect-rate');
    const accuracyEl = document.getElementById('kpi-qc-accuracy');

    const passRateVal = parseFloat(qc.passRate) || 100.0;
    const defectRateVal = qc.totalInspected > 0 ? ((qc.failCount / qc.totalInspected) * 100).toFixed(1) : 0.0;

    if (passRateEl) {
      passRateEl.innerText = `${passRateVal}%`;
      passRateEl.style.color = passRateVal >= 98 ? 'var(--success)' : passRateVal >= 95 ? 'var(--warning)' : 'var(--danger)';
    }
    if (passSubEl) passSubEl.innerText = `ตรวจผ่าน ${qc.passCount} จาก ${qc.totalInspected} ออเดอร์`;
    if (inspectedEl) inspectedEl.innerText = qc.totalInspected;
    if (defectsEl) defectsEl.innerText = qc.failCount;
    if (defectRateEl) defectRateEl.innerText = `อัตราผิดพลาด: ${defectRateVal}%`;
    if (accuracyEl) accuracyEl.innerText = `${passRateVal}%`;

    renderQCRatioChart(qc.passCount, qc.failCount);
    renderQCDefectChart(qc.defectBreakdown || {});
    renderQCLogsTable(data.qcLogs || []);
  }

  function renderQCRatioChart(pass, fail) {
    const canvas = document.getElementById('qcRatioChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (qcRatioChart) qcRatioChart.destroy();

    qcRatioChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [`ผ่าน QC (${pass} รายการ)`, `พบข้อผิดพลาด (${fail} รายการ)`],
        datasets: [{
          data: [pass, fail],
          backgroundColor: ['#10b981', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#f3f4f6', font: { size: 12 } } }
        },
        cutout: '65%'
      }
    });
  }

  function renderQCDefectChart(breakdown) {
    const canvas = document.getElementById('qcDefectChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (qcDefectChart) qcDefectChart.destroy();

    // Dynamically take all keys from breakdown
    let keys = Object.keys(breakdown || {}).filter(k => k !== 'NONE');
    if (keys.length === 0) {
      keys = ['WRONG_SKU', 'WRONG_QTY', 'DAMAGED_ITEM', 'DEFECTIVE_BARCODE'];
    }

    const labels = keys.map(k => getDefectLabel(k));
    const dataVals = keys.map(k => breakdown[k] || 0);

    const palette = ['#f87171', '#fbbf24', '#f97316', '#a78bfa', '#ec4899', '#06b6d4', '#84cc16', '#3b82f6'];
    const bgColors = keys.map((_, i) => palette[i % palette.length]);

    qcDefectChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'จำนวนข้อผิดพลาดที่พบ (ครั้ง)',
          data: dataVals,
          backgroundColor: bgColors,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { precision: 0, color: '#9ca3af' },
            grid: { color: 'rgba(255,255,255,0.06)' }
          },
          y: {
            ticks: { color: '#f3f4f6', font: { size: 11 } },
            grid: { display: false }
          }
        }
      }
    });
  }

  function renderQCLogsTable(logs) {
    const tbody = document.getElementById('qc-logs-table-body');
    if (!tbody) return;

    if (!logs || logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:20px;">ยังไม่มีประวัติการตรวจสอบคุณภาพ</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => {
      const isPass = (l.status === 'PASS');
      const statusBadge = isPass
        ? `<span class="badge-defect badge-defect-pass">🟢 PASS</span>`
        : `<span class="badge-defect badge-defect-fail">🔴 FAIL</span>`;

      return `
        <tr>
          <td style="color:var(--text-muted); font-size:12px;">${new Date(l.inspected_at).toLocaleTimeString('th-TH')}</td>
          <td><strong>${l.order_id}</strong></td>
          <td>${statusBadge}</td>
          <td style="font-size:12px; color:${isPass ? 'var(--text-muted)' : '#fca5a5'}; font-weight:500;">
            ${getDefectLabel(l.defect_type)}
          </td>
          <td style="text-align:center;">${l.items_checked || 1} ชิ้น</td>
          <td><strong style="color:var(--accent-cyan);">${l.inspector_name || 'Inspector'}</strong></td>
          <td style="font-size:12px; color:var(--text-muted);">${l.defect_notes || '-'}</td>
          <td>
            <button class="btn-table-action" onclick="Analytics.openEditQCModal(${l.id})">
              ✏️ แก้ไขข้อผิดพลาด
            </button>
          </td>
        </tr>`;
    }).join('');
  }

  // ================= 5. TAB: Background Operations & QC Audit Logs =================
  function filterLogs(status) {
    logStatusFilter = status;
    document.querySelectorAll('.filter-log-status-btn').forEach(b => {
      const onclickAttr = b.getAttribute('onclick') || '';
      b.classList.toggle('active', onclickAttr.includes(`'${status}'`));
    });
    renderLogsTab();
  }

  function filterLogDefect(cat) {
    logDefectFilter = cat;
    renderLogsTab();
  }

  function searchLogs(query) {
    logSearchQuery = query.trim().toLowerCase();
    renderLogsTab();
  }

  function renderLogsTab() {
    const tbody = document.getElementById('audit-logs-table-body');
    if (!tbody || !cachedAnalytics) return;

    let logs = cachedAnalytics.qcLogs || [];

    // Filter by status
    if (logStatusFilter !== 'ALL') {
      logs = logs.filter(l => l.status === logStatusFilter);
    }

    // Filter by defect category
    if (logDefectFilter !== 'ALL') {
      logs = logs.filter(l => l.defect_type === logDefectFilter);
    }

    // Search query
    if (logSearchQuery) {
      logs = logs.filter(l =>
        (l.order_id && l.order_id.toLowerCase().includes(logSearchQuery)) ||
        (l.inspector_name && l.inspector_name.toLowerCase().includes(logSearchQuery)) ||
        (l.defect_notes && l.defect_notes.toLowerCase().includes(logSearchQuery)) ||
        (l.defect_type && l.defect_type.toLowerCase().includes(logSearchQuery))
      );
    }

    // Summary counts
    const allLogs = cachedAnalytics.qcLogs || [];
    const totalCount = allLogs.length;
    const passCount = allLogs.filter(l => l.status === 'PASS').length;
    const failCount = allLogs.filter(l => l.status === 'FAIL').length;
    const rateVal = totalCount > 0 ? ((failCount / totalCount) * 100).toFixed(1) : 0.0;

    const elTotal = document.getElementById('audit-count-total');
    const elPass = document.getElementById('audit-count-pass');
    const elFail = document.getElementById('audit-count-fail');
    const elRate = document.getElementById('audit-count-rate');

    if (elTotal) elTotal.innerText = `${totalCount} รายการ`;
    if (elPass) elPass.innerText = `${passCount} รายการ`;
    if (elFail) elFail.innerText = `${failCount} รายการ`;
    if (elRate) elRate.innerText = `${rateVal}%`;

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:30px;">ไม่พบบันทึกประวัติการทำงานตามตัวกรองที่เลือก</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => {
      const isPass = (l.status === 'PASS');
      const statusBadge = isPass
        ? `<span class="badge-defect badge-defect-pass">🟢 PASS</span>`
        : `<span class="badge-defect badge-defect-fail">🔴 FAIL</span>`;

      return `
        <tr>
          <td style="color:var(--text-muted); font-size:12px;">${new Date(l.inspected_at).toLocaleString('th-TH')}</td>
          <td><strong style="color:var(--text-main); font-size:13px;">${l.order_id}</strong></td>
          <td>${statusBadge}</td>
          <td>
            <span style="font-weight:600; color:${isPass ? 'var(--text-muted)' : '#fca5a5'}; font-size:13px;">
              ${getDefectLabel(l.defect_type)}
            </span>
          </td>
          <td style="text-align:center;">${l.items_checked || 1} ชิ้น</td>
          <td><strong style="color:var(--accent-cyan);">${l.inspector_name || 'Inspector'}</strong></td>
          <td style="font-size:12px; color:var(--text-muted); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${l.defect_notes || ''}">
            ${l.defect_notes || '-'}
          </td>
          <td>
            <button class="btn-table-action" onclick="Analytics.openEditQCModal(${l.id})">
              ✏️ แก้ไขข้อผิดพลาด
            </button>
          </td>
        </tr>`;
    }).join('');
  }

  // ================= QC LOG EDIT MODAL CONTROLLERS =================
  function openEditQCModal(logId) {
    const logs = (cachedAnalytics && cachedAnalytics.qcLogs) ? cachedAnalytics.qcLogs : [];
    const log = logs.find(l => l.id == logId);
    if (!log) return;

    const modal = document.getElementById('modal-edit-qc-log');
    if (!modal) return;

    document.getElementById('edit-qc-id').value = log.id;
    document.getElementById('edit-qc-order-id-display').innerText = log.order_id;
    document.getElementById('edit-qc-time-display').innerText = new Date(log.inspected_at).toLocaleString('th-TH');

    // Status radio
    const isPass = (log.status === 'PASS');
    const radioPass = document.querySelector('input[name="edit-qc-status"][value="PASS"]');
    const radioFail = document.querySelector('input[name="edit-qc-status"][value="FAIL"]');
    if (isPass && radioPass) radioPass.checked = true;
    if (!isPass && radioFail) radioFail.checked = true;

    // Defect Type
    const select = document.getElementById('edit-qc-defect-type');
    const customInput = document.getElementById('edit-qc-custom-defect');
    const standardKeys = ['NONE', 'WRONG_SKU', 'WRONG_QTY', 'DAMAGED_ITEM', 'DEFECTIVE_BARCODE', 'EXPIRED_ITEM', 'PACKAGING_TORN', 'WRONG_SLOT'];

    if (standardKeys.includes(log.defect_type)) {
      select.value = log.defect_type;
      if (customInput) {
        customInput.style.display = 'none';
        customInput.value = '';
      }
    } else {
      select.value = 'CUSTOM';
      if (customInput) {
        customInput.style.display = 'block';
        customInput.value = log.defect_type || '';
      }
    }

    document.getElementById('edit-qc-notes').value = log.defect_notes || '';
    document.getElementById('edit-qc-inspector').value = log.inspector_name || '';
    document.getElementById('edit-qc-items').value = log.items_checked || 1;

    handleEditQCStatusChange(log.status);

    modal.style.display = 'flex';
  }

  function closeEditQCModal() {
    const modal = document.getElementById('modal-edit-qc-log');
    if (modal) modal.style.display = 'none';
  }

  function handleEditQCStatusChange(status) {
    const details = document.getElementById('edit-qc-defect-fields');
    if (!details) return;
    details.style.display = (status === 'FAIL') ? 'block' : 'none';
  }

  function handleEditQCDefectChange(val) {
    const customInput = document.getElementById('edit-qc-custom-defect');
    if (customInput) {
      customInput.style.display = (val === 'CUSTOM') ? 'block' : 'none';
      if (val === 'CUSTOM') customInput.focus();
    }
  }

  async function saveEditQCLog() {
    const id = document.getElementById('edit-qc-id').value;
    const statusRadio = document.querySelector('input[name="edit-qc-status"]:checked');
    const status = statusRadio ? statusRadio.value : 'PASS';
    let defectType = document.getElementById('edit-qc-defect-type').value;

    if (status === 'PASS') {
      defectType = 'NONE';
    } else if (defectType === 'CUSTOM') {
      const customVal = document.getElementById('edit-qc-custom-defect').value.trim();
      defectType = customVal || 'OTHER_DEFECT';
    }

    const defectNotes = document.getElementById('edit-qc-notes').value.trim();
    const inspectorName = document.getElementById('edit-qc-inspector').value.trim();
    const itemsChecked = parseInt(document.getElementById('edit-qc-items').value, 10) || 1;

    try {
      await API.updateQCLog(id, {
        status,
        defectType,
        defectNotes,
        inspectorName,
        itemsChecked
      });

      closeEditQCModal();
      App.playBeep(true);
      alert("✔ บันทึกการแก้ไขข้อผิดพลาดสำเร็จ และอัปเดตดัชนี KPI บนแดชบอร์ดเรียบร้อยแล้ว!");

      await refresh();
    } catch (err) {
      console.warn('API updateQCLog failed, updating local logs:', err);
      // Local fallback
      let localLogs = JSON.parse(localStorage.getItem('nexus_local_qc_logs') || '[]');
      const found = localLogs.find(l => l.id == id);
      if (found) {
        found.status = status;
        found.defect_type = defectType;
        found.defect_notes = defectNotes;
        found.inspector_name = inspectorName;
        found.items_checked = itemsChecked;
      }
      try { localStorage.setItem('nexus_local_qc_logs', JSON.stringify(localLogs)); } catch(e) {}

      closeEditQCModal();
      App.playBeep(true);
      alert("✔ [Local Mode] แก้ไขข้อผิดพลาดสำเร็จ และอัปเดตดัชนี KPI บนแดชบอร์ดเรียบร้อยแล้ว!");

      await refresh();
    }
  }

  // ================= 3. TAB: KPI เวลาต่อ 1 Order (Cycle Time & SLA) =================
  function renderLeadTimeTab() {
    const data = cachedAnalytics;
    const avgSec = Math.floor((data.avgLeadTimeMs || 0) / 1000);
    const minSec = Math.floor((data.minLeadTimeMs || 0) / 1000);
    const maxSec = Math.floor((data.maxLeadTimeMs || 0) / 1000);

    const avgEl = document.getElementById('kpi-order-avg-time');
    const slaEl = document.getElementById('kpi-order-sla-rate');
    const fastEl = document.getElementById('kpi-order-fastest');
    const slowEl = document.getElementById('kpi-order-slowest');

    if (avgEl) avgEl.innerText = formatSec(avgSec);
    if (slaEl) {
      const rate = data.slaComplianceRate !== undefined ? data.slaComplianceRate : 100.0;
      slaEl.innerText = `${rate}%`;
      slaEl.style.color = rate >= 90 ? 'var(--success)' : rate >= 75 ? 'var(--warning)' : 'var(--danger)';
    }
    if (fastEl) fastEl.innerText = formatSec(minSec);
    if (slowEl) slowEl.innerText = formatSec(maxSec);

    renderLeadTimeDistChart(data.timeDistribution || {});
    renderOrderLeadTimeTable();
  }

  function renderLeadTimeDistChart(dist) {
    const canvas = document.getElementById('leadTimeDistChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (leadTimeChart) leadTimeChart.destroy();

    leadTimeChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['< 2 นาที (Fast)', '2 - 3 นาที (On SLA)', '3 - 5 นาที (Warning)', '> 5 นาที (Breached)'],
        datasets: [{
          label: 'จำนวนออเดอร์',
          data: [
            dist.under2Min || 0,
            dist.between2And3Min || 0,
            dist.between3And5Min || 0,
            dist.over5Min || 0
          ],
          backgroundColor: ['#10b981', '#34d399', '#fbbf24', '#ef4444'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0, color: '#9ca3af' },
            grid: { color: 'rgba(255,255,255,0.06)' }
          },
          x: {
            ticks: { color: '#f3f4f6', font: { size: 11 } },
            grid: { display: false }
          }
        }
      }
    });
  }

  async function renderOrderLeadTimeTable() {
    const tbody = document.getElementById('order-leadtime-table-body');
    if (!tbody) return;

    let history = [];
    try {
      if (typeof API !== 'undefined' && API.getOrderHistory) {
        history = await API.getOrderHistory();
      }
    } catch (e) {}

    if (!history || history.length === 0) {
      history = JSON.parse(localStorage.getItem('nexus_local_history') || '[]');
    }

    if (history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">ยังไม่มีประวัติออเดอร์จัดส่ง</td></tr>`;
      return;
    }

    tbody.innerHTML = history.map(h => {
      const sec = Math.floor((h.lead_time_ms || 0) / 1000);
      let slaBadge = `<span style="background:rgba(16,185,129,0.2); color:#34d399; border:1px solid #10b981; padding:3px 8px; border-radius:4px; font-weight:bold; font-size:11px;">🟢 On SLA (< 3 นาที)</span>`;

      if (sec > 300) {
        slaBadge = `<span style="background:rgba(239,68,68,0.2); color:#f87171; border:1px solid #ef4444; padding:3px 8px; border-radius:4px; font-weight:bold; font-size:11px;">🔴 Breached (> 5 นาที)</span>`;
      } else if (sec > 180) {
        slaBadge = `<span style="background:rgba(245,158,11,0.2); color:#fbbf24; border:1px solid #f59e0b; padding:3px 8px; border-radius:4px; font-weight:bold; font-size:11px;">🟡 Warning (3-5 นาที)</span>`;
      }

      return `
        <tr>
          <td><strong>${h.order_id}</strong></td>
          <td><span style="color:var(--accent-cyan); font-weight:bold;">${h.put_wall_slot}</span></td>
          <td><span class="tote-chip" style="background:rgba(245, 158, 11, 0.15); color:var(--warning); border-color:var(--warning);">${h.item_summary}</span></td>
          <td style="font-weight:bold; color:${sec <= 180 ? 'var(--success)' : sec <= 300 ? 'var(--warning)' : 'var(--danger)'}; font-family:monospace; font-size:14px;">
            ${formatSec(sec)}
          </td>
          <td>${slaBadge}</td>
          <td style="color:var(--text-muted); font-size:12px;">${new Date(h.packed_at).toLocaleString('th-TH')}</td>
        </tr>`;
    }).join('');
  }

  // ================= 4. TAB: ติดตามคน & คำนวณการทำงาน =================
  function renderLaborTab() {
    const data = cachedAnalytics;

    const activeEl = document.getElementById('kpi-labor-active-workers');
    const totalWkEl = document.getElementById('kpi-labor-total-workers');
    const totalHrsEl = document.getElementById('kpi-labor-total-hours');
    const uphEl = document.getElementById('kpi-labor-uph');
    const opmhEl = document.getElementById('kpi-labor-opmh');

    if (activeEl) activeEl.innerText = `${data.activeWorkers || 0} คน`;
    if (totalWkEl) totalWkEl.innerText = `จากพนักงานทั้งหมด ${data.totalWorkers || 0} คน`;
    if (totalHrsEl) totalHrsEl.innerText = `${data.totalHoursAll || 0} ชม.`;
    if (uphEl) uphEl.innerText = `${data.uph || '0.0'} ชิ้น/ชม.`;
    if (opmhEl) opmhEl.innerText = `${data.opmh || '0.0'} Order/ชม.`;

    renderLaborWorkersTable(data.workerStats || []);
    calculateLabor();
  }

  function renderLaborWorkersTable(workerStats) {
    const tbody = document.getElementById('labor-workers-table-body');
    if (!tbody) return;

    if (!workerStats || workerStats.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:20px;">ไม่มีข้อมูลพนักงาน</td></tr>`;
      return;
    }

    tbody.innerHTML = workerStats.map(w => {
      let gradeHtml = `<span style="color:var(--text-muted);">🟡 กำลังพัฒนา (UPH < 25)</span>`;
      if (w.uph >= 35) {
        gradeHtml = `<span style="color:var(--accent-orange); font-weight:bold;">⭐ ยอดเยี่ยม (Top Performer)</span>`;
      } else if (w.uph >= 20) {
        gradeHtml = `<span style="color:var(--success); font-weight:bold;">🟢 ตามเป้าหมาย (Standard)</span>`;
      }

      return `
        <tr>
          <td><strong>${w.id}</strong></td>
          <td><strong style="color:var(--text-main);">${w.name}</strong></td>
          <td>
            ${w.clocked_in
              ? '<span style="color:var(--success); font-weight:bold;">● ปฏิบัติงานจริง</span>'
              : '<span style="color:var(--text-muted)">ออกกะแล้ว</span>'}
          </td>
          <td style="font-family:monospace; font-size:13px;">${w.work_hours || 0} ชม.</td>
          <td style="font-weight:bold; color:var(--accent-cyan);">${w.units_picked || 0} ชิ้น</td>
          <td style="font-weight:900; color:var(--accent-orange); font-size:15px; font-family:monospace;">${w.uph}</td>
          <td>${gradeHtml}</td>
        </tr>`;
    }).join('');
  }

  function calculateLabor() {
    const targetOrders = parseFloat(document.getElementById('calc-target-orders')?.value) || 100;
    const workers = parseFloat(document.getElementById('calc-workers-count')?.value) || 3;
    const shiftHours = parseFloat(document.getElementById('calc-shift-hours')?.value) || 8;
    const estUph = parseFloat(document.getElementById('calc-avg-uph')?.value) || 35;

    const UNITS_PER_ORDER = 6;
    const availableManHours = workers * shiftHours;
    const maxUnits = availableManHours * estUph;
    const maxOrders = Math.floor(maxUnits / UNITS_PER_ORDER);

    const requiredUnits = targetOrders * UNITS_PER_ORDER;
    const requiredManHours = requiredUnits / estUph;
    const hoursPerPerson = workers > 0 ? (requiredManHours / workers) : 0;
    const timePerOrderMin = targetOrders > 0 ? (requiredManHours * 60 / targetOrders) : 0;

    const resCapacity = document.getElementById('calc-res-capacity');
    const resUnits = document.getElementById('calc-res-units');
    const resManHours = document.getElementById('calc-res-manhours');
    const resTimePerOrder = document.getElementById('calc-res-time-per-order');
    const resHoursPerPerson = document.getElementById('calc-res-hours-per-person');
    const resStatus = document.getElementById('calc-res-status');
    const resAdvice = document.getElementById('calc-res-advice');

    if (resCapacity) resCapacity.innerText = `${maxOrders} Orders`;
    if (resUnits) resUnits.innerText = `รองรับได้สูงสุด ~${Math.round(maxUnits)} ชิ้น`;
    if (resManHours) resManHours.innerText = `${requiredManHours.toFixed(1)} ชม.`;
    if (resTimePerOrder) resTimePerOrder.innerText = `เฉลี่ย ${timePerOrderMin.toFixed(1)} นาที/คน/Order`;
    if (resHoursPerPerson) resHoursPerPerson.innerText = `${hoursPerPerson.toFixed(1)} ชม./คน`;

    if (resStatus && resAdvice) {
      if (maxOrders >= targetOrders) {
        const surplusPercent = Math.round(((maxOrders - targetOrders) / targetOrders) * 100);
        resStatus.innerHTML = `🟢 กำลังคนเพียงพอ! สามารถรองรับได้เกินเป้าหมาย (+${surplusPercent}%)`;
        resStatus.style.color = 'var(--success)';
        resAdvice.innerText = `พนักงาน ${workers} คนทำงาน ${hoursPerPerson.toFixed(1)} ชม./คน ก็สำเร็จเป้าหมาย มีเวลาสำรองรองรับงานด่วน`;
      } else {
        const shortageOrders = targetOrders - maxOrders;
        const neededWorkers = Math.ceil(requiredManHours / shiftHours);
        const extraWorkers = neededWorkers - workers;
        resStatus.innerHTML = `🔴 กำลังคนไม่เพียงพอ! ขาดการรองรับอีก ${shortageOrders} Orders`;
        resStatus.style.color = 'var(--danger)';
        resAdvice.innerText = `แนะนำเพิ่มพนักงานอีก ${extraWorkers} คน หรือทำล่วงเวลาเพิ่มคนละ ${(hoursPerPerson - shiftHours).toFixed(1)} ชั่วโมง`;
      }
    }
  }

  return {
    init,
    refresh,
    switchTab,
    filterStorage,
    searchStorage,
    filterLogs,
    filterLogDefect,
    searchLogs,
    openEditQCModal,
    closeEditQCModal,
    handleEditQCStatusChange,
    handleEditQCDefectChange,
    saveEditQCLog,
    calculateLabor,
    renderAnalytics: refresh,
    updateCharts: renderCurrentTab
  };
})();

if (typeof window !== 'undefined') {
  window.Analytics = Analytics;
}
