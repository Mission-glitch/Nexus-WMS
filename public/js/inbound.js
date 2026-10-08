/**
 * Nexus WMS - Inbound Receiving & Stock Replenishment Module
 */
const Inbound = (() => {
  let activeTab = 'replenish'; // 'replenish' | 'new-sku' | 'relocate'
  let selectedReplenishSku = null;
  let selectedRelocateSku = null;
  let selectedTargetZone = 'A';
  let selectedTargetRack = '01';
  let selectedTargetSlot = '01';

  const DEFAULT_IMG = "https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&w=600&q=80";

  function init() {
    renderReplenishProductDropdown();
    renderRelocateProductDropdown();
    loadRelocateHistory();

    // Live WebSocket listener for location changes
    if (typeof API !== 'undefined' && API.on) {
      API.on('LOCATION_MOVED', async (payload) => {
        await Store.reloadProducts();
        renderRelocateProductDropdown();
        renderReplenishProductDropdown();
        renderInteractiveSlotMap();
        loadRelocateHistory();
        if (typeof Picking !== 'undefined' && Picking.renderWarehouseShelves) {
          Picking.renderWarehouseShelves();
        }
      });
    }
  }

  function switchInboundTab(tabId) {
    activeTab = tabId;
    const btnReplenish = document.getElementById('tab-inbound-replenish');
    const btnNew = document.getElementById('tab-inbound-new');
    const btnRelocate = document.getElementById('tab-inbound-relocate');
    const secReplenish = document.getElementById('sec-inbound-replenish');
    const secNew = document.getElementById('sec-inbound-new');
    const secRelocate = document.getElementById('sec-inbound-relocate');

    if (btnReplenish) btnReplenish.classList.toggle('active', tabId === 'replenish');
    if (btnNew) btnNew.classList.toggle('active', tabId === 'new-sku');
    if (btnRelocate) btnRelocate.classList.toggle('active', tabId === 'relocate');

    if (secReplenish) secReplenish.style.display = (tabId === 'replenish') ? 'block' : 'none';
    if (secNew) secNew.style.display = (tabId === 'new-sku') ? 'block' : 'none';
    if (secRelocate) secRelocate.style.display = (tabId === 'relocate') ? 'block' : 'none';

    if (tabId === 'replenish') {
      try { renderReplenishProductDropdown(); } catch (e) { console.error('renderReplenishProductDropdown error:', e); }
    } else if (tabId === 'relocate') {
      try { renderRelocateProductDropdown(); } catch (e) { console.error('renderRelocateProductDropdown error:', e); }
      try { renderInteractiveSlotMap(); } catch (e) { console.error('renderInteractiveSlotMap error:', e); }
      try { loadRelocateHistory(); } catch (e) { console.error('loadRelocateHistory error:', e); }
    }
  }

  function renderReplenishProductDropdown() {
    const select = document.getElementById('restock-sku-select');
    if (!select) return;

    const products = (typeof Store !== 'undefined' && Store.getProducts) ? Store.getProducts() : [];
    if (products.length === 0) {
      select.innerHTML = '<option value="">-- ไม่พบรายการสินค้าในระบบ --</option>';
      return;
    }

    const currentVal = select.value;
    select.innerHTML = '<option value="">-- ค้นหา/เลือกสินค้าที่ต้องการเติมสต็อก --</option>' +
      products.map(p => `
        <option value="${p.id}" ${currentVal === p.id ? 'selected' : ''}>
          [${p.id}] ${p.name} (สต็อก: ${p.stock} | สำรอง: ${p.reserve || 0} | ${p.loc})
        </option>
      `).join('');

    if (currentVal) {
      onSelectReplenishProduct(currentVal);
    } else if (products.length > 0 && !selectedReplenishSku) {
      onSelectReplenishProduct(products[0].id);
      select.value = products[0].id;
    }
  }

  function onSelectReplenishProduct(skuId) {
    if (!skuId) {
      selectedReplenishSku = null;
      const preview = document.getElementById('restock-product-preview');
      if (preview) preview.style.display = 'none';
      return;
    }

    const products = (typeof Store !== 'undefined' && Store.getProducts) ? Store.getProducts() : [];
    const item = products.find(p => p.id === skuId || p.barcode === skuId);
    if (!item) return;

    selectedReplenishSku = item;
    const select = document.getElementById('restock-sku-select');
    if (select && select.value !== item.id) select.value = item.id;

    const preview = document.getElementById('restock-product-preview');
    if (preview) {
      preview.style.display = 'flex';
      preview.innerHTML = `
        <img src="${item.image || DEFAULT_IMG}" style="width:72px; height:72px; border-radius:8px; object-fit:cover; border:1px solid #374151;" onerror="this.src='${DEFAULT_IMG}'">
        <div style="flex:1;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <strong style="font-size:15px; color:var(--text-main);">${item.name}</strong>
              <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                หมวดหมู่: <span style="color:var(--text-main);">${item.cat || '-'}</span> | พิกัดเชลฟ์: <strong style="color:var(--accent-orange); font-family:monospace;">${item.loc}</strong> (โซน ${item.zone})
              </div>
              <div style="font-size:11px; color:var(--accent-cyan); font-family:monospace; margin-top:2px;">
                Barcode: ${item.barcode} | SKU: ${item.id}
              </div>
            </div>
            <div style="text-align:right;">
              <span style="font-size:12px; color:var(--text-muted);">ราคาชิ้นละ</span>
              <div style="font-size:16px; font-weight:bold; color:var(--success);">฿${item.price}</div>
            </div>
          </div>
          <div style="display:flex; gap:12px; margin-top:10px;">
            <div style="background:#000; border:1px solid var(--border); padding:6px 12px; border-radius:6px; font-size:12px;">
              สต็อกพร้อมหยิบหน้าร้าน: <strong style="color:var(--accent-orange); font-size:14px;">${item.stock} ชิ้น</strong>
            </div>
            <div style="background:#000; border:1px solid var(--border); padding:6px 12px; border-radius:6px; font-size:12px;">
              สต็อกสำรองหลังคลัง: <strong style="color:var(--accent-cyan); font-size:14px;">${item.reserve || 0} ชิ้น</strong>
            </div>
          </div>
        </div>
      `;
    }
  }

  function handleRestockBarcodeScan(barcodeVal) {
    if (!barcodeVal) return;
    const clean = barcodeVal.trim();
    const products = Store.getProducts();
    const found = products.find(p => p.barcode === clean || p.id.toUpperCase() === clean.toUpperCase());

    if (found) {
      App.playBeep(true);
      onSelectReplenishProduct(found.id);
      document.getElementById('restock-barcode-input').value = '';
    } else {
      App.playBeep(false);
      alert(`ไม่พบรหัสสินค้า "${clean}" ในคลัง หากเป็นสินค้าใหม่ให้เลือกแท็บ "ลงทะเบียนสินค้าใหม่"`);
    }
  }

  function setRestockQty(qty) {
    const input = document.getElementById('restock-qty-input');
    if (input) {
      input.value = Math.max(1, parseInt(qty, 10) || 1);
    }
  }

  function adjustRestockQty(delta) {
    const input = document.getElementById('restock-qty-input');
    if (input) {
      const current = parseInt(input.value, 10) || 10;
      input.value = Math.max(1, current + delta);
    }
  }

  async function handleReplenishSubmit() {
    if (!selectedReplenishSku) {
      return alert("กรุณาเลือกหรือสแกนสินค้าที่ต้องการเติมสต็อก");
    }

    const qty = parseInt(document.getElementById('restock-qty-input')?.value, 10);
    const target = document.querySelector('input[name="restock-target"]:checked')?.value || 'stock';
    const note = document.getElementById('restock-notes')?.value.trim() || '';

    if (isNaN(qty) || qty <= 0) {
      return alert("กรุณาระบุจำนวนสินค้าที่ต้องการเติมให้ถูกต้อง (มากกว่า 0)");
    }

    const targetLabel = (target === 'reserve') ? 'สต็อกสำรองหลังคลัง' : 'สต็อกพร้อมหยิบหน้าร้าน';

    try {
      const res = await API.replenishStock({
        id: selectedReplenishSku.id,
        qty,
        target,
        note
      });

      App.playBeep(true);
      alert(`✔ เติมสต็อกสำเร็จ!\nสินค้า: ${res.product.name}\nจำนวน: +${qty} ชิ้น เข้า${targetLabel}\nสต็อกรวมล่าสุด: ${target === 'reserve' ? res.product.reserve : res.product.stock} ชิ้น`);

      // Refresh cache and views
      await Store.reloadProducts();
      onSelectReplenishProduct(res.product.id);
      Store.renderCatalog('All');
      Picking.renderWarehouseShelves();
      Analytics.refresh();

      // Reset qty
      document.getElementById('restock-qty-input').value = '10';
      if (document.getElementById('restock-notes')) document.getElementById('restock-notes').value = '';
    } catch (err) {
      console.warn('API replenishStock failed, running local fallback:', err);
      const products = Store.getProducts();
      const item = products.find(p => p.id === selectedReplenishSku.id);
      if (item) {
        if (target === 'reserve') {
          item.reserve = (item.reserve || 0) + qty;
        } else {
          item.stock = (item.stock || 0) + qty;
        }

        try { localStorage.setItem('nexus_products_cache', JSON.stringify(products)); } catch(e) {}

        App.playBeep(true);
        alert(`✔ [Local Mode] เติมสต็อกสำเร็จ!\nสินค้า: ${item.name}\nจำนวน: +${qty} ชิ้น เข้า${targetLabel}\nสต็อกรวมล่าสุด: ${target === 'reserve' ? item.reserve : item.stock} ชิ้น`);

        onSelectReplenishProduct(item.id);
        Store.renderCatalog('All');
        Picking.renderWarehouseShelves();
        Analytics.refresh();

        document.getElementById('restock-qty-input').value = '10';
        if (document.getElementById('restock-notes')) document.getElementById('restock-notes').value = '';
      }
    }
  }

  // Quick Modal Replenish (callable from Storefront or Analytics)
  function openReplenishModal(skuId) {
    const products = Store.getProducts();
    const item = products.find(p => p.id === skuId);
    if (!item) return;

    const modal = document.getElementById('modal-quick-replenish');
    if (!modal) return;

    document.getElementById('m-replenish-sku-id').value = item.id;
    document.getElementById('m-replenish-sku-name').innerText = item.name;
    document.getElementById('m-replenish-sku-code').innerText = `${item.id} | ${item.barcode} | ${item.loc}`;
    document.getElementById('m-replenish-current-stock').innerText = `${item.stock} ชิ้น`;
    document.getElementById('m-replenish-current-reserve').innerText = `${item.reserve || 0} ชิ้น`;
    document.getElementById('m-replenish-img').src = item.image || DEFAULT_IMG;
    document.getElementById('m-replenish-qty').value = '10';

    modal.style.display = 'flex';
  }

  function closeReplenishModal() {
    const modal = document.getElementById('modal-quick-replenish');
    if (modal) modal.style.display = 'none';
  }

  async function submitModalReplenish() {
    const skuId = document.getElementById('m-replenish-sku-id')?.value;
    const qty = parseInt(document.getElementById('m-replenish-qty')?.value, 10);
    const target = document.querySelector('input[name="m-replenish-target"]:checked')?.value || 'stock';

    if (!skuId || isNaN(qty) || qty <= 0) {
      return alert("กรุณาระบุจำนวนสต็อกที่ต้องการเติม");
    }

    try {
      await API.replenishStock({ id: skuId, qty, target, note: 'Quick Restock Modal' });
      closeReplenishModal();
      App.playBeep(true);
      alert(`✔ เติมสต็อกสินค้าสำเร็จ (+${qty} ชิ้น)`);

      await Store.reloadProducts();
      Store.renderCatalog('All');
      Picking.renderWarehouseShelves();
      Analytics.refresh();
      if (selectedReplenishSku && selectedReplenishSku.id === skuId) {
        onSelectReplenishProduct(skuId);
      }
    } catch (err) {
      console.warn('API modal replenish fallback:', err);
      const products = Store.getProducts();
      const item = products.find(p => p.id === skuId);
      if (item) {
        if (target === 'reserve') item.reserve = (item.reserve || 0) + qty;
        else item.stock = (item.stock || 0) + qty;

        try { localStorage.setItem('nexus_products_cache', JSON.stringify(products)); } catch(e) {}
        closeReplenishModal();
        App.playBeep(true);
        alert(`✔ [Local] เติมสต็อกสินค้าสำเร็จ (+${qty} ชิ้น)`);

        Store.renderCatalog('All');
        Picking.renderWarehouseShelves();
        Analytics.refresh();
      }
    }
  }

  // Legacy barcode check for new SKU tab
  function checkInboundBarcode(barcodeVal) {
    if (!barcodeVal) return;
    const products = Store.getProducts();
    const existing = products.find(s => s.barcode === barcodeVal || s.id.toUpperCase() === barcodeVal.toUpperCase());

    if (existing) {
      document.getElementById('inbound-name').value = existing.name;
      document.getElementById('inbound-zone').value = existing.zone;
      document.getElementById('inbound-loc').value = existing.loc;
      document.getElementById('inbound-cat').value = existing.cat;
      document.getElementById('inbound-price').value = existing.price;
      const imgInput = document.getElementById('inbound-image');
      if (imgInput && existing.image) imgInput.value = existing.image;
      const descInput = document.getElementById('inbound-desc');
      if (descInput && existing.description) descInput.value = existing.description;

      App.playBeep(true);
      alert(`พบสินค้าเดิมในระบบ: ${existing.name}\nคุณสามารถเติมสต็อกได้ทันที หรือสลับไปที่แท็บ "เติมสต็อกสินค้าเดิม"`);
    } else {
      App.playBeep(true);
    }
  }

  async function handleInboundSubmit() {
    let barcode = document.getElementById('inbound-barcode').value.trim();
    let name = document.getElementById('inbound-name').value.trim();
    let zone = document.getElementById('inbound-zone').value;
    let loc = document.getElementById('inbound-loc').value.trim().toUpperCase();
    let cat = document.getElementById('inbound-cat').value;
    let price = parseFloat(document.getElementById('inbound-price').value);
    let qty = parseInt(document.getElementById('inbound-qty').value, 10);
    let image = document.getElementById('inbound-image')?.value.trim();
    let description = document.getElementById('inbound-desc')?.value.trim();

    if (!barcode || !name || !loc || isNaN(qty) || isNaN(price)) {
      return alert("กรุณากรอกข้อมูลรับเข้าให้ครบถ้วน");
    }

    try {
      const res = await API.inboundReceive({
        barcode,
        name,
        zone,
        loc,
        cat,
        price,
        qty,
        image,
        description
      });

      if (res.action === 'updated') {
        alert(`อัปเดตสต็อก ${res.product.name} สำเร็จ (+${qty} ชิ้น)`);
      } else {
        alert(`เพิ่มสินค้าใหม่ "${name}" เข้าระบบคลังสินค้าสำเร็จ!`);
      }

      document.getElementById('inbound-barcode').value = "";
      document.getElementById('inbound-name').value = "";
      document.getElementById('inbound-loc').value = "";
      document.getElementById('inbound-qty').value = "10";
      if (document.getElementById('inbound-image')) document.getElementById('inbound-image').value = "";
      if (document.getElementById('inbound-desc')) document.getElementById('inbound-desc').value = "";

      // Refresh store catalog & warehouse racks
      await Store.reloadProducts();
      renderReplenishProductDropdown();
      Store.renderCatalog('All');
      Picking.renderWarehouseShelves();
    } catch (err) {
      console.warn('API inboundReceive failed, updating local products:', err);
      const products = Store.getProducts();
      let existing = products.find(s => s.barcode === barcode || s.id.toUpperCase() === barcode.toUpperCase());
      if (existing) {
        existing.stock = (existing.stock || 0) + qty;
        if (image) existing.image = image;
        if (description) existing.description = description;
        alert(`อัปเดตสต็อก ${existing.name} สำเร็จ (โหมด Local) (+${qty} ชิ้น)`);
      } else {
        const newSku = {
          id: `SKU-${zone}-${String(products.length + 1).padStart(3, '0')}`,
          barcode,
          name,
          cat,
          price,
          loc,
          zone,
          stock: qty,
          reserve: 50,
          picks: 0,
          weight: 1,
          size: "M",
          image: image || DEFAULT_IMG,
          description: description || name,
          rating: 5.0,
          reviews: 1
        };
        products.push(newSku);
        alert(`เพิ่มสินค้าใหม่ "${name}" สำเร็จ (โหมด Local)!`);
      }
      try { localStorage.setItem('nexus_products_cache', JSON.stringify(products)); } catch(e) {}

      document.getElementById('inbound-barcode').value = "";
      document.getElementById('inbound-name').value = "";
      document.getElementById('inbound-loc').value = "";
      document.getElementById('inbound-qty').value = "10";
      if (document.getElementById('inbound-image')) document.getElementById('inbound-image').value = "";
      if (document.getElementById('inbound-desc')) document.getElementById('inbound-desc').value = "";

      renderReplenishProductDropdown();
      Store.renderCatalog('All');
      Picking.renderWarehouseShelves();
    }
  }

  // ==========================================
  // LOCATION MANAGEMENT & RELOCATION METHODS
  // ==========================================

  function getSafeProducts() {
    let list = (typeof Store !== 'undefined' && Store.getProducts) ? Store.getProducts() : [];
    if (!list || list.length === 0) {
      if (typeof DEFAULT_SKU_MASTER !== 'undefined' && Array.isArray(DEFAULT_SKU_MASTER)) {
        list = DEFAULT_SKU_MASTER;
      }
    }
    return list || [];
  }

  function renderRelocateProductDropdown() {
    const select = document.getElementById('relocate-sku-select');
    if (!select) return;

    const products = getSafeProducts();
    if (products.length === 0) {
      select.innerHTML = '<option value="">-- ไม่พบรายการสินค้าในระบบ --</option>';
      return;
    }

    const currentVal = select.value;
    select.innerHTML = '<option value="">-- ค้นหา/เลือกสินค้าที่ต้องการย้ายตำแหน่ง --</option>' +
      products.map(p => `
        <option value="${p.id}" ${currentVal === p.id ? 'selected' : ''}>
          [${p.id}] ${p.name} (พิกัดปัจจุบัน: ${p.loc} | โซน ${p.zone} | สต็อก: ${p.stock} ชิ้น)
        </option>
      `).join('');

    if (currentVal) {
      onSelectRelocateProduct(currentVal);
    } else if (products.length > 0 && !selectedRelocateSku) {
      onSelectRelocateProduct(products[0].id);
      select.value = products[0].id;
    }
  }

  function onSelectRelocateProduct(skuId) {
    if (!skuId) {
      selectedRelocateSku = null;
      const preview = document.getElementById('relocate-product-preview');
      if (preview) preview.style.display = 'none';
      return;
    }

    const products = getSafeProducts();
    const item = products.find(p => p && (p.id === skuId || p.barcode === skuId));
    if (!item) return;

    selectedRelocateSku = item;
    const select = document.getElementById('relocate-sku-select');
    if (select && select.value !== item.id) select.value = item.id;

    // Show preview card
    const preview = document.getElementById('relocate-product-preview');
    if (preview) {
      preview.style.display = 'flex';
      preview.innerHTML = `
        <img src="${item.image || DEFAULT_IMG}" style="width:78px; height:78px; border-radius:8px; object-fit:cover; border:1px solid #374151;" onerror="this.src='${DEFAULT_IMG}'">
        <div style="flex:1;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
            <div>
              <strong style="font-size:15px; color:var(--text-main);">${item.name}</strong>
              <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">
                หมวดหมู่: <span style="color:var(--text-main); font-weight:600;">${item.cat || '-'}</span> | ขนาด: <span style="color:var(--text-main);">${item.size || 'S'}</span> | น้ำหนัก: <span style="color:var(--text-main);">${item.weight || 1} kg</span>
              </div>
              <div style="font-size:12px; color:var(--accent-cyan); font-family:monospace; margin-top:3px;">
                SKU: <strong>${item.id}</strong> | บาร์โค้ด: ${item.barcode}
              </div>
            </div>
            <div style="text-align:right;">
              <span style="font-size:11px; color:var(--text-muted); text-transform:uppercase;">ตำแหน่งปัจจุบัน</span>
              <div style="font-size:22px; font-weight:900; color:var(--accent-orange); font-family:monospace; letter-spacing:0.5px;">${item.loc}</div>
              <span style="background:rgba(249, 115, 22, 0.15); color:var(--accent-orange); border:1px solid var(--accent-orange); font-size:10px; font-weight:bold; padding:2px 8px; border-radius:4px;">
                โซน ${item.zone} (${item.zone === 'A' ? 'ออกเร็ว Fast' : item.zone === 'B' ? 'ปานกลาง Medium' : 'ออกช้า/Bulky'})
              </span>
            </div>
          </div>
          <div style="display:flex; gap:12px; margin-top:12px; flex-wrap:wrap;">
            <div style="background:#000; border:1px solid var(--border); padding:6px 14px; border-radius:6px; font-size:12px;">
              สต็อกหน้าเชลฟ์: <strong style="color:var(--accent-orange); font-size:14px;">${item.stock} ชิ้น</strong>
            </div>
            <div style="background:#000; border:1px solid var(--border); padding:6px 14px; border-radius:6px; font-size:12px;">
              สต็อกสำรอง: <strong style="color:var(--accent-cyan); font-size:14px;">${item.reserve || 0} ชิ้น</strong>
            </div>
            <div style="background:#000; border:1px solid var(--border); padding:6px 14px; border-radius:6px; font-size:12px;">
              ยอดหยิบสะสม: <strong style="color:var(--success); font-size:14px;">${item.picks || 0} ครั้ง</strong>
            </div>
          </div>
        </div>
      `;
    }

    // Default target suggestion
    const parts = (item.loc || 'A-01-01').split('-');
    selectedTargetZone = parts[0] || 'A';
    selectedTargetRack = parts[1] || '01';
    selectedTargetSlot = parts[2] || '01';

    updateTargetLocationInput();
    renderInteractiveSlotMap();
  }

  function handleRelocateBarcodeScan(barcodeVal) {
    if (!barcodeVal) return;
    const clean = barcodeVal.trim();
    const products = (typeof Store !== 'undefined' && Store.getProducts) ? Store.getProducts() : [];
    const found = products.find(p => p.barcode === clean || p.id.toUpperCase() === clean.toUpperCase());

    if (found) {
      if (typeof App !== 'undefined' && App.playBeep) App.playBeep(true);
      onSelectRelocateProduct(found.id);
      const input = document.getElementById('relocate-barcode-input');
      if (input) input.value = '';
    } else {
      if (typeof App !== 'undefined' && App.playBeep) App.playBeep(false);
      alert(`ไม่พบรหัสสินค้า "${clean}" ในคลัง`);
    }
  }

  function setTargetZone(zone) {
    selectedTargetZone = zone.toUpperCase();
    document.querySelectorAll('.btn-zone-target').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-zone') === selectedTargetZone);
    });
    updateTargetLocationInput();
  }

  function setTargetRack(rack) {
    selectedTargetRack = String(rack).padStart(2, '0');
    document.querySelectorAll('.btn-rack-target').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-rack') === selectedTargetRack);
    });
    updateTargetLocationInput();
  }

  function setTargetSlot(slot) {
    selectedTargetSlot = String(slot).padStart(2, '0');
    document.querySelectorAll('.btn-slot-target').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-slot') === selectedTargetSlot);
    });
    updateTargetLocationInput();
  }

  function updateTargetLocationInput() {
    const loc = `${selectedTargetZone}-${selectedTargetRack}-${selectedTargetSlot}`;
    const input = document.getElementById('relocate-target-loc');
    if (input) input.value = loc;

    // Sync button states
    document.querySelectorAll('.btn-zone-target').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-zone') === selectedTargetZone);
    });
    document.querySelectorAll('.btn-rack-target').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-rack') === selectedTargetRack);
    });
    document.querySelectorAll('.btn-slot-target').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-slot') === selectedTargetSlot);
    });

    checkTargetSlotOccupancy();
  }

  function onTargetLocInputChange(val) {
    if (!val) return;
    const clean = val.trim().toUpperCase();
    const parts = clean.split('-');
    if (parts.length >= 3) {
      selectedTargetZone = parts[0];
      selectedTargetRack = parts[1];
      selectedTargetSlot = parts[2];
      document.querySelectorAll('.btn-zone-target').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-zone') === selectedTargetZone);
      });
      document.querySelectorAll('.btn-rack-target').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-rack') === selectedTargetRack);
      });
      document.querySelectorAll('.btn-slot-target').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-slot') === selectedTargetSlot);
      });
    }
    checkTargetSlotOccupancy();
  }

  function checkTargetSlotOccupancy() {
    const statusBox = document.getElementById('relocate-slot-status');
    if (!statusBox) return;

    const input = document.getElementById('relocate-target-loc');
    const targetLoc = (input ? input.value : `${selectedTargetZone}-${selectedTargetRack}-${selectedTargetSlot}`).trim().toUpperCase();

    if (!targetLoc) {
      statusBox.innerHTML = '';
      return;
    }

    const products = (typeof Store !== 'undefined' && Store.getProducts) ? Store.getProducts() : [];
    const currentSkuId = selectedRelocateSku ? selectedRelocateSku.id : null;

    if (selectedRelocateSku && selectedRelocateSku.loc === targetLoc) {
      statusBox.innerHTML = `
        <div style="background:rgba(59, 130, 246, 0.15); border:1px solid #3b82f6; border-radius:6px; padding:10px 14px; color:#93c5fd; font-size:12px; display:flex; align-items:center; gap:8px;">
          <span>ℹ️</span>
          <span><strong>พิกัดนี้คือตำแหน่งปัจจุบัน</strong> ของสินค้านี้อยู่แล้ว (${targetLoc})</span>
        </div>
      `;
      return;
    }

    const occupiedBy = products.find(p => p.loc === targetLoc && p.id !== currentSkuId);

    if (occupiedBy) {
      statusBox.innerHTML = `
        <div style="background:rgba(245, 158, 11, 0.15); border:1px solid #f59e0b; border-radius:6px; padding:10px 14px; color:#fbbf24; font-size:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span>⚠️</span>
            <div>
              <strong>ช่องนี้มีสินค้าจัดเก็บอยู่:</strong> [${occupiedBy.id}] ${occupiedBy.name} (สต็อก: ${occupiedBy.stock} ชิ้น)
              <div style="color:var(--text-muted); font-size:11px; margin-top:2px;">
                ระบบอนุญาตให้จัดเก็บร่วมกัน (Shared Slot) หรือสามารถกดสลับพิกัดกันได้
              </div>
            </div>
          </div>
          <button type="button" class="btn-action" style="background:#f59e0b; color:#000; font-weight:bold; font-size:11px; padding:4px 10px;" onclick="Inbound.handleSwapLocations('${currentSkuId}', '${occupiedBy.id}')">
            🔄 สลับพิกัด (Swap Slots)
          </button>
        </div>
      `;
    } else {
      statusBox.innerHTML = `
        <div style="background:rgba(16, 185, 129, 0.15); border:1px solid #10b981; border-radius:6px; padding:10px 14px; color:#34d399; font-size:12px; display:flex; align-items:center; gap:8px;">
          <span>✅</span>
          <span><strong>ช่องว่างพร้อมจัดเก็บ (Empty Slot Available)</strong>: ไม่มีสินค้าอื่นวางอยู่ในพิกัด ${targetLoc}</span>
        </div>
      `;
    }
  }

  function setRelocateReason(reasonText) {
    const input = document.getElementById('relocate-reason-input');
    if (input) input.value = reasonText;
  }

  async function handleRelocateSubmit() {
    if (!selectedRelocateSku) {
      return alert("กรุณาเลือกหรือสแกนสินค้าที่ต้องการย้ายตำแหน่ง");
    }

    const input = document.getElementById('relocate-target-loc');
    const targetLoc = (input ? input.value : `${selectedTargetZone}-${selectedTargetRack}-${selectedTargetSlot}`).trim().toUpperCase();
    const reasonInput = document.getElementById('relocate-reason-input');
    const reason = (reasonInput ? reasonInput.value.trim() : '') || 'ย้ายปรับปรุงพื้นที่จัดเก็บ (Warehouse Optimization)';
    const movedByInput = document.getElementById('relocate-moved-by-input');
    const currentWorker = (typeof Worker !== 'undefined' && Worker.getCurrentWorker) ? Worker.getCurrentWorker() : null;
    const movedBy = (movedByInput ? movedByInput.value.trim() : '') || (currentWorker ? currentWorker.name : 'เจ้าหน้าที่คลังสินค้า');

    if (!targetLoc) {
      return alert("กรุณาระบุพิกัดตำแหน่งปลายทาง (Location)");
    }

    if (targetLoc === selectedRelocateSku.loc) {
      return alert(`สินค้าอยู่ที่ตำแหน่ง ${targetLoc} อยู่แล้ว กรุณาเลือกพิกัดใหม่`);
    }

    const newZone = targetLoc.charAt(0).toUpperCase();
    if (!['A', 'B', 'C'].includes(newZone)) {
      return alert("โซนของพิกัดต้องขึ้นต้นด้วย A, B หรือ C เช่น A-01-01, B-03-02, C-05-01");
    }

    const oldLoc = selectedRelocateSku.loc;
    const oldZone = selectedRelocateSku.zone;
    const skuName = selectedRelocateSku.name;
    const skuId = selectedRelocateSku.id;

    try {
      const res = await API.relocateProduct({
        id: skuId,
        newLoc: targetLoc,
        newZone,
        reason,
        movedBy
      });

      if (typeof App !== 'undefined' && App.playBeep) App.playBeep(true);
      alert(`✔ ย้ายตำแหน่งสินค้าสำเร็จ!\nสินค้า: ${skuName} [${skuId}]\nพิกัดเดิม: ${oldLoc} (โซน ${oldZone})\nพิกัดใหม่: ${targetLoc} (โซน ${newZone})\nเหตุผล: ${reason}`);

      // Refresh products and UI
      await Store.reloadProducts();
      onSelectRelocateProduct(skuId);
      Store.renderCatalog('All');
      if (typeof Picking !== 'undefined' && Picking.renderWarehouseShelves) {
        Picking.renderWarehouseShelves();
      }
      renderInteractiveSlotMap();
      loadRelocateHistory();
      renderReplenishProductDropdown();
    } catch (err) {
      console.warn('API relocateProduct failed, using local storage fallback:', err);
      // Local fallback
      const products = Store.getProducts();
      const item = products.find(p => p.id === skuId);
      if (item) {
        item.loc = targetLoc;
        item.zone = newZone;
        try { localStorage.setItem('nexus_products_cache', JSON.stringify(products)); } catch(e) {}

        // Update local waves
        try {
          const localWaves = JSON.parse(localStorage.getItem('nexus_local_waves') || '[]');
          localWaves.forEach(w => {
            (w.pickList || []).forEach(t => {
              if (t.skuId === skuId) {
                t.loc = targetLoc;
                t.zone = newZone;
              }
            });
          });
          localStorage.setItem('nexus_local_waves', JSON.stringify(localWaves));
        } catch(e) {}

        // Save local history
        const localHist = JSON.parse(localStorage.getItem('nexus_location_moves') || '[]');
        localHist.unshift({
          id: Date.now(),
          sku_id: skuId,
          sku_name: skuName,
          from_loc: oldLoc,
          to_loc: targetLoc,
          from_zone: oldZone,
          to_zone: newZone,
          reason,
          moved_by: movedBy,
          created_at: Date.now()
        });
        try { localStorage.setItem('nexus_location_moves', JSON.stringify(localHist.slice(0, 50))); } catch(e) {}

        if (typeof App !== 'undefined' && App.playBeep) App.playBeep(true);
        alert(`✔ [Local Mode] ย้ายตำแหน่งสินค้าสำเร็จ!\nสินค้า: ${skuName}\nพิกัดเดิม: ${oldLoc} -> พิกัดใหม่: ${targetLoc}\nเหตุผล: ${reason}`);

        onSelectRelocateProduct(skuId);
        Store.renderCatalog('All');
        if (typeof Picking !== 'undefined' && Picking.renderWarehouseShelves) {
          Picking.renderWarehouseShelves();
        }
        renderInteractiveSlotMap();
        loadRelocateHistory();
        renderReplenishProductDropdown();
      }
    }
  }

  async function handleSwapLocations(skuId1, skuId2) {
    const products = Store.getProducts();
    const p1 = products.find(p => p.id === skuId1);
    const p2 = products.find(p => p.id === skuId2);
    if (!p1 || !p2) return;

    if (!confirm(`คุณต้องการสลับพิกัดระหว่าง:\n1. [${p1.id}] ${p1.name} (ปัจจุบัน: ${p1.loc})\nกับ\n2. [${p2.id}] ${p2.name} (ปัจจุบัน: ${p2.loc})\nใช่หรือไม่?`)) {
      return;
    }

    const loc1 = p1.loc;
    const zone1 = p1.zone;
    const loc2 = p2.loc;
    const zone2 = p2.zone;

    try {
      await API.relocateProduct({ id: p1.id, newLoc: loc2, newZone: zone2, reason: `สลับตำแหน่งกับ ${p2.id}`, movedBy: 'สลับตำแหน่งอัตโนมัติ' });
      await API.relocateProduct({ id: p2.id, newLoc: loc1, newZone: zone1, reason: `สลับตำแหน่งกับ ${p1.id}`, movedBy: 'สลับตำแหน่งอัตโนมัติ' });
      if (typeof App !== 'undefined' && App.playBeep) App.playBeep(true);
      alert(`✔ สลับตำแหน่งสินค้าทั้ง 2 รายการเรียบร้อยแล้ว!`);
      await Store.reloadProducts();
      onSelectRelocateProduct(p1.id);
      Store.renderCatalog('All');
      if (typeof Picking !== 'undefined' && Picking.renderWarehouseShelves) {
        Picking.renderWarehouseShelves();
      }
      renderInteractiveSlotMap();
      loadRelocateHistory();
    } catch(err) {
      console.warn('API swap failed, doing local swap:', err);
      p1.loc = loc2; p1.zone = zone2;
      p2.loc = loc1; p2.zone = zone1;
      try { localStorage.setItem('nexus_products_cache', JSON.stringify(products)); } catch(e) {}
      if (typeof App !== 'undefined' && App.playBeep) App.playBeep(true);
      alert(`✔ [Local] สลับตำแหน่งสินค้าทั้ง 2 รายการเรียบร้อยแล้ว!`);
      onSelectRelocateProduct(p1.id);
      Store.renderCatalog('All');
      if (typeof Picking !== 'undefined' && Picking.renderWarehouseShelves) {
        Picking.renderWarehouseShelves();
      }
      renderInteractiveSlotMap();
      loadRelocateHistory();
    }
  }

  async function loadRelocateHistory() {
    const tbody = document.getElementById('relocate-history-tbody');
    if (!tbody) return;

    let history = [];
    try {
      if (typeof API !== 'undefined' && API.getLocationHistory) {
        history = await API.getLocationHistory(30);
      }
    } catch (e) {
      // Silently fall through to local storage fallback
    }

    if (!Array.isArray(history) || history.length === 0) {
      try {
        const raw = localStorage.getItem('nexus_location_moves');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) history = parsed;
        }
      } catch (err) {
        console.warn('Failed parsing local nexus_location_moves:', err);
      }
    }

    if (!Array.isArray(history) || history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:24px;">ยังไม่มีประวัติการย้ายตำแหน่งสินค้า</td></tr>`;
      return;
    }

    tbody.innerHTML = history.map(h => {
      const dt = new Date(h.created_at || Date.now());
      const timeStr = `${dt.getHours().toString().padStart(2,'0')}:${dt.getMinutes().toString().padStart(2,'0')}`;
      const dateStr = `${dt.getDate()}/${dt.getMonth()+1}`;
      const isZoneChange = h.from_zone !== h.to_zone;

      return `
        <tr>
          <td style="color:var(--text-muted); font-size:12px; white-space:nowrap;">
            ${dateStr} <strong style="color:var(--text-main);">${timeStr}</strong>
          </td>
          <td>
            <strong style="color:var(--accent-cyan); font-family:monospace;">${h.sku_id || '-'}</strong>
            <div style="font-size:11px; color:var(--text-muted);">${h.sku_name || ''}</div>
          </td>
          <td>
            <span style="font-family:monospace; background:#000; border:1px solid #4b5563; padding:2px 6px; border-radius:4px; font-weight:bold; color:#cbd5e1;">${h.from_loc || '-'}</span>
            <small style="color:var(--text-muted); display:block; font-size:10px;">โซน ${h.from_zone || '-'}</small>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="color:var(--accent-orange); font-size:14px;">➔</span>
              <span style="font-family:monospace; background:rgba(249, 115, 22, 0.15); border:1px solid var(--accent-orange); padding:2px 8px; border-radius:4px; font-weight:bold; color:var(--accent-orange);">${h.to_loc || '-'}</span>
              ${isZoneChange ? `<span style="background:rgba(239, 68, 68, 0.2); color:#f87171; border:1px solid #f87171; font-size:9px; padding:1px 4px; border-radius:3px; font-weight:bold;">ข้ามโซน</span>` : ''}
            </div>
            <small style="color:var(--text-muted); display:block; font-size:10px;">โซน ${h.to_zone || '-'}</small>
          </td>
          <td>
            <span style="color:var(--text-main); font-size:12px;">${h.reason || '-'}</span>
          </td>
          <td style="color:var(--text-muted); font-size:12px; white-space:nowrap;">
            👤 ${h.moved_by || 'เจ้าหน้าที่'}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderInteractiveSlotMap() {
    const mapBox = document.getElementById('relocate-interactive-map');
    if (!mapBox) return;

    const products = (typeof Store !== 'undefined' && Store.getProducts) ? Store.getProducts() : (typeof DEFAULT_SKU_MASTER !== 'undefined' ? DEFAULT_SKU_MASTER : []);
    const currentLoc = selectedRelocateSku ? selectedRelocateSku.loc : '';
    const targetLoc = `${selectedTargetZone}-${selectedTargetRack}-${selectedTargetSlot}`;

    const zones = ['A', 'B', 'C'];
    mapBox.innerHTML = zones.map(z => {
      let slotsHtml = '';
      for (let r = 1; r <= 6; r++) {
        const rackStr = String(r).padStart(2, '0');
        for (let s = 1; s <= 3; s++) {
          const slotStr = String(s).padStart(2, '0');
          const locStr = `${z}-${rackStr}-${slotStr}`;
          const item = (products || []).find(p => p && p.loc === locStr);
          const isCurrent = (locStr === currentLoc);
          const isTarget = (locStr === targetLoc);

          let borderStyle = 'border:1px dashed #374151; background:rgba(0,0,0,0.3);';
          let title = `${locStr} (ว่าง)`;
          let slotLabel = 'ว่าง';

          if (item) {
            borderStyle = 'border:1px solid #4b5563; background:#1e293b;';
            const safeName = String(item.name || '').replace(/"/g, '&quot;');
            title = `${locStr}: [${item.id}] ${safeName} (${item.stock} ชิ้น)`;
            slotLabel = String(item.id || '').replace('SKU-', '');
          }
          if (isCurrent) {
            borderStyle = 'border:2px solid var(--accent-orange); background:rgba(249, 115, 22, 0.2);';
            const safeItemName = String(item?.name || 'สินค้านี้').replace(/"/g, '&quot;');
            title = `${locStr}: ตำแหน่งปัจจุบันของ ${safeItemName}`;
            slotLabel = '📌 เดิม';
          }
          if (isTarget) {
            borderStyle = 'border:2px solid var(--accent-cyan); background:rgba(6, 182, 212, 0.25); box-shadow:0 0 10px rgba(6, 182, 212, 0.5);';
            slotLabel = '🎯 เป้าหมาย';
          }

          slotsHtml += `
            <div onclick="Inbound.selectSlotFromMap('${z}', '${rackStr}', '${slotStr}')"
                 title="${title}"
                 style="cursor:pointer; padding:6px 4px; border-radius:4px; text-align:center; font-size:10px; font-family:monospace; transition:all 0.15s; ${borderStyle}">
              <div style="font-weight:bold; color:${isTarget ? 'var(--accent-cyan)' : isCurrent ? 'var(--accent-orange)' : item ? '#e2e8f0' : '#64748b'};">${rackStr}-${slotStr}</div>
              <div style="font-size:9px; color:${item ? 'var(--accent-orange)' : '#475569'}; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${slotLabel}
              </div>
            </div>
          `;
        }
      }

      const zoneTitle = z === 'A' ? 'โซน A (Fast Movers)' : z === 'B' ? 'โซน B (Medium Movers)' : 'โซน C (Slow / Bulky)';
      return `
        <div style="background:#090d16; border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="font-size:12px; color:${z === 'A' ? 'var(--accent-orange)' : z === 'B' ? 'var(--accent-cyan)' : '#a78bfa'};">${zoneTitle}</strong>
            <span style="font-size:11px; color:var(--text-muted);">18 ช่อง (Racks 01-06)</span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:6px;">
            ${slotsHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  function selectSlotFromMap(zone, rack, slot) {
    selectedTargetZone = zone;
    selectedTargetRack = rack;
    selectedTargetSlot = slot;
    updateTargetLocationInput();
    renderInteractiveSlotMap();
  }

  // Quick Modal Relocation
  function openQuickRelocateModal(skuId) {
    const products = (typeof Store !== 'undefined' && Store.getProducts) ? Store.getProducts() : [];
    const item = products.find(p => p.id === skuId);
    if (!item) return;

    selectedRelocateSku = item;
    const modal = document.getElementById('modal-quick-relocate');
    if (!modal) return;

    document.getElementById('qm-relocate-sku-id').value = item.id;
    document.getElementById('qm-relocate-sku-name').innerText = item.name;
    document.getElementById('qm-relocate-sku-code').innerText = `${item.id} | ${item.barcode} | โซน ${item.zone}`;
    document.getElementById('qm-relocate-current-loc').innerText = item.loc;
    document.getElementById('qm-relocate-current-stock').innerText = `${item.stock} ชิ้น`;
    document.getElementById('qm-relocate-img').src = item.image || DEFAULT_IMG;

    const parts = (item.loc || 'A-01-01').split('-');
    document.getElementById('qm-relocate-zone').value = parts[0] || 'A';
    document.getElementById('qm-relocate-rack').value = parts[1] || '01';
    document.getElementById('qm-relocate-slot').value = parts[2] || '01';
    document.getElementById('qm-relocate-reason').value = 'ย้ายปรับปรุงพื้นที่จัดเก็บ';

    modal.style.display = 'flex';
  }

  function closeQuickRelocateModal() {
    const modal = document.getElementById('modal-quick-relocate');
    if (modal) modal.style.display = 'none';
  }

  async function submitQuickRelocateModal() {
    const skuId = document.getElementById('qm-relocate-sku-id')?.value;
    const zone = document.getElementById('qm-relocate-zone')?.value || 'A';
    const rack = document.getElementById('qm-relocate-rack')?.value || '01';
    const slot = document.getElementById('qm-relocate-slot')?.value || '01';
    const reason = document.getElementById('qm-relocate-reason')?.value || 'ย้ายปรับปรุงพื้นที่จัดเก็บ';
    const currentWorker = (typeof Worker !== 'undefined' && Worker.getCurrentWorker) ? Worker.getCurrentWorker() : null;
    const movedBy = currentWorker ? currentWorker.name : 'เจ้าหน้าที่คลัง';

    const targetLoc = `${zone}-${String(rack).padStart(2, '0')}-${String(slot).padStart(2, '0')}`;

    if (!skuId || !targetLoc) return;

    try {
      await API.relocateProduct({
        id: skuId,
        newLoc: targetLoc,
        newZone: zone,
        reason,
        movedBy
      });

      closeQuickRelocateModal();
      if (typeof App !== 'undefined' && App.playBeep) App.playBeep(true);
      alert(`✔ ย้ายตำแหน่ง ${skuId} ไปยัง ${targetLoc} สำเร็จ!`);

      await Store.reloadProducts();
      Store.renderCatalog('All');
      if (typeof Picking !== 'undefined' && Picking.renderWarehouseShelves) {
        Picking.renderWarehouseShelves();
      }
      renderRelocateProductDropdown();
      renderInteractiveSlotMap();
      loadRelocateHistory();
    } catch (err) {
      console.warn('API quick relocate fallback:', err);
      const products = Store.getProducts();
      const item = products.find(p => p.id === skuId);
      if (item) {
        item.loc = targetLoc;
        item.zone = zone;
        try { localStorage.setItem('nexus_products_cache', JSON.stringify(products)); } catch(e) {}
        closeQuickRelocateModal();
        if (typeof App !== 'undefined' && App.playBeep) App.playBeep(true);
        alert(`✔ [Local] ย้ายตำแหน่ง ${skuId} ไปยัง ${targetLoc} สำเร็จ!`);
        Store.renderCatalog('All');
        if (typeof Picking !== 'undefined' && Picking.renderWarehouseShelves) {
          Picking.renderWarehouseShelves();
        }
      }
    }
  }

  return {
    init,
    switchInboundTab,
    renderReplenishProductDropdown,
    onSelectReplenishProduct,
    handleRestockBarcodeScan,
    setRestockQty,
    adjustRestockQty,
    handleReplenishSubmit,
    openReplenishModal,
    closeReplenishModal,
    submitModalReplenish,
    checkInboundBarcode,
    handleInboundSubmit,

    // Relocation methods
    renderRelocateProductDropdown,
    onSelectRelocateProduct,
    handleRelocateBarcodeScan,
    setTargetZone,
    setTargetRack,
    setTargetSlot,
    updateTargetLocationInput,
    onTargetLocInputChange,
    checkTargetSlotOccupancy,
    setRelocateReason,
    handleRelocateSubmit,
    handleSwapLocations,
    loadRelocateHistory,
    renderInteractiveSlotMap,
    selectSlotFromMap,
    openQuickRelocateModal,
    closeQuickRelocateModal,
    submitQuickRelocateModal
  };
})();

if (typeof window !== 'undefined') {
  window.Inbound = Inbound;
}
