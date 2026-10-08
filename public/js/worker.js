/**
 * Nexus WMS - Worker Shift & Productivity Module
 */
const Worker = (() => {
  let workers = [];
  let currentScannerUser = null;

  // Restore current scanner user from localStorage if saved
  try {
    const saved = localStorage.getItem('nexus_current_scanner_user');
    if (saved) currentScannerUser = JSON.parse(saved);
  } catch (e) {}

  function formatLeadTimeSec(sec) {
    if (sec < 0) return "00:00";
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  async function init() {
    await reloadWorkers();
    renderWorkerTable();
    updateHeaderUserBadge();

    // Live update elapsed time every second
    setInterval(() => {
      if (workers.some(w => w.clocked_in)) {
        renderWorkerTable();
      }
    }, 1000);

    API.on('WORKER_UPDATED', async (updatedWorker) => {
      await reloadWorkers();
      if (currentScannerUser && currentScannerUser.id === updatedWorker.id) {
        currentScannerUser = updatedWorker;
        localStorage.setItem('nexus_current_scanner_user', JSON.stringify(currentScannerUser));
        updateHeaderUserBadge();
      }
      renderWorkerTable();
    });

    API.on('PICK_SCANNED', async () => {
      await reloadWorkers();
      renderWorkerTable();
    });
  }

  const DEFAULT_WORKERS = [
    { id: 'WK-01', name: 'สมชาย สายหยิบ', clocked_in: 0, total_time_ms: 3600000, units_picked: 140, last_clock_in_at: null },
    { id: 'WK-02', name: 'สมศรี จัดของไว', clocked_in: 0, total_time_ms: 7200000, units_picked: 280, last_clock_in_at: null },
    { id: 'WK-03', name: 'วิชัย แพ็กแม่นยำ', clocked_in: 0, total_time_ms: 5400000, units_picked: 190, last_clock_in_at: null }
  ];

  async function reloadWorkers() {
    try {
      const data = await API.getWorkers();
      if (Array.isArray(data) && data.length > 0) {
        workers = data;
        try { localStorage.setItem('nexus_local_workers', JSON.stringify(workers)); } catch(e) {}
        if (currentScannerUser) {
          const found = workers.find(w => w.id === currentScannerUser.id);
          if (found) {
            currentScannerUser = found;
            localStorage.setItem('nexus_current_scanner_user', JSON.stringify(currentScannerUser));
          }
        }
        updateHeaderUserBadge();
        return;
      }
    } catch (err) {
      console.warn('API getWorkers unavailable, using local worker data:', err);
    }

    try {
      const cached = JSON.parse(localStorage.getItem('nexus_local_workers') || 'null');
      workers = (Array.isArray(cached) && cached.length > 0) ? cached : JSON.parse(JSON.stringify(DEFAULT_WORKERS));
    } catch(e) {
      workers = JSON.parse(JSON.stringify(DEFAULT_WORKERS));
    }

    if (currentScannerUser) {
      const found = workers.find(w => w.id === currentScannerUser.id);
      if (found) {
        currentScannerUser = found;
      }
    }
    updateHeaderUserBadge();
  }

  function getCurrentWorker() {
    return currentScannerUser;
  }

  function updateHeaderUserBadge() {
    const dot = document.getElementById('header-status-dot');
    const nameEl = document.getElementById('header-user-name');
    if (!dot || !nameEl) return;

    if (currentScannerUser && currentScannerUser.clocked_in) {
      dot.className = 'status-dot active';
      nameEl.innerText = `${currentScannerUser.name} (Online)`;
    } else {
      dot.className = 'status-dot';
      nameEl.innerText = 'กรุณาเข้ากะ';
    }
  }

  async function handleClockIn() {
    let rawId = document.getElementById('input-staff-id').value.trim();
    const staffName = document.getElementById('input-staff-name').value.trim();

    if (!rawId) return alert("กรุณาระบุเลขรหัสพนักงาน");

    try {
      const res = await API.clockIn(rawId, staffName);
      if (res.alreadyIn) {
        alert("พนักงานท่านนี้เข้ากะอยู่แล้ว");
      } else {
        alert(`บันทึกเข้ากะ: คุณ ${res.worker.name}`);
      }

      currentScannerUser = res.worker;
      localStorage.setItem('nexus_current_scanner_user', JSON.stringify(currentScannerUser));

      document.getElementById('input-staff-id').value = "";
      document.getElementById('input-staff-name').value = "";

      await reloadWorkers();
      renderWorkerTable();
    } catch (err) {
      console.warn('API clockIn failed, running in local mode:', err);
      let worker = workers.find(w => w.id === rawId);
      if (!worker) {
        worker = { id: rawId, name: staffName || rawId, clocked_in: 0, total_time_ms: 0, units_picked: 0, last_clock_in_at: null };
        workers.push(worker);
      }
      worker.clocked_in = 1;
      worker.last_clock_in_at = Date.now();
      currentScannerUser = worker;
      try {
        localStorage.setItem('nexus_current_scanner_user', JSON.stringify(currentScannerUser));
        localStorage.setItem('nexus_local_workers', JSON.stringify(workers));
      } catch(e) {}
      alert(`บันทึกเข้ากะ (โหมด Local): คุณ ${worker.name}`);
      document.getElementById('input-staff-id').value = "";
      document.getElementById('input-staff-name').value = "";
      updateHeaderUserBadge();
      renderWorkerTable();
    }
  }

  async function handleClockOut() {
    let rawId = document.getElementById('input-staff-id').value.trim();
    if (!rawId && currentScannerUser) {
      rawId = currentScannerUser.id;
    }
    if (!rawId) return alert("กรุณาระบุเลขรหัสพนักงาน");

    try {
      const res = await API.clockOut(rawId);
      alert(`บันทึกออกกะ: คุณ ${res.worker.name}`);

      if (currentScannerUser && currentScannerUser.id === res.worker.id) {
        currentScannerUser = null;
        localStorage.removeItem('nexus_current_scanner_user');
      }

      document.getElementById('input-staff-id').value = "";
      document.getElementById('input-staff-name').value = "";

      await reloadWorkers();
      renderWorkerTable();
    } catch (err) {
      console.warn('API clockOut failed, running in local mode:', err);
      let worker = workers.find(w => w.id === rawId);
      if (worker && worker.clocked_in) {
        worker.clocked_in = 0;
        if (worker.last_clock_in_at) {
          worker.total_time_ms += (Date.now() - worker.last_clock_in_at);
          worker.last_clock_in_at = null;
        }
        if (currentScannerUser && currentScannerUser.id === worker.id) {
          currentScannerUser = null;
          try { localStorage.removeItem('nexus_current_scanner_user'); } catch(e) {}
        }
        try { localStorage.setItem('nexus_local_workers', JSON.stringify(workers)); } catch(e) {}
        alert(`บันทึกออกกะ (โหมด Local): คุณ ${worker.name}`);
        document.getElementById('input-staff-id').value = "";
        document.getElementById('input-staff-name').value = "";
        updateHeaderUserBadge();
        renderWorkerTable();
      } else {
        alert("ไม่พบพนักงานหรือยังไม่ได้เข้ากะ");
      }
    }
  }

  function renderWorkerTable() {
    const tbody = document.getElementById('worker-table-body');
    if (!tbody) return;

    const now = Date.now();
    tbody.innerHTML = workers.map(w => {
      let currentMs = w.total_time_ms;
      if (w.clocked_in && w.last_clock_in_at) {
        currentMs += (now - w.last_clock_in_at);
      }
      const hrs = currentMs / (1000 * 3600);
      const isMe = (currentScannerUser && currentScannerUser.id === w.id);

      return `
        <tr style="${isMe ? 'background:rgba(6, 182, 212, 0.1);' : ''}">
          <td>
            <strong>${w.id}</strong>
            ${isMe ? '<span style="font-size:10px; color:var(--accent-cyan);">(ถือสแกนอยู่)</span>' : ''}
          </td>
          <td>${w.name}</td>
          <td>
            ${w.clocked_in
              ? '<span style="color:var(--success); font-weight:bold;">● ทำงาน</span>'
              : '<span style="color:var(--text-muted)">ออกกะ</span>'}
          </td>
          <td>${formatLeadTimeSec(Math.floor(currentMs / 1000))}</td>
          <td><strong>${w.units_picked}</strong> ชิ้น</td>
          <td style="color:var(--accent-orange); font-weight:bold;">
            ${hrs > 0 ? (w.units_picked / hrs).toFixed(1) : "0.0"}
          </td>
        </tr>`;
    }).join('');
  }

  return {
    init,
    getCurrentWorker,
    handleClockIn,
    handleClockOut,
    renderWorkerTable
  };
})();

if (typeof window !== 'undefined') {
  window.WorkerModule = Worker;
  window.Worker = Worker;
}
