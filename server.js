const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const {
  ProductDAO,
  OrderDAO,
  WaveDAO,
  WorkerDAO,
  QCDAO,
  PurchasePlanDAO,
  LocationMoveDAO
} = require('./database.js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('error', () => {
  // Handled at server level
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Broadcast to all connected WebSocket clients
function broadcast(type, payload = {}) {
  const message = JSON.stringify({ type, payload, timestamp: Date.now() });
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'CONNECTED', payload: { message: 'Connected to Nexus WMS Live Service' } }));
});

// Helper for MHE calculation
function calculateMHE(items, products) {
  let totalWeight = 0;
  let hasBulky = false;
  let totalQty = 0;

  for (const [skuId, qty] of Object.entries(items)) {
    const item = products.find(s => s.id === skuId);
    if (item) {
      totalWeight += (item.weight * qty);
      totalQty += qty;
      if (item.size === 'Bulky') hasBulky = true;
    }
  }

  if (hasBulky || totalWeight >= 20) {
    return { name: "รถลากพาเลท", style: "background:rgba(239, 68, 68, 0.2); color:#f87171; border:1px solid #f87171;" };
  }
  if (totalWeight >= 5 || totalQty >= 10) {
    return { name: "รถเข็นหลายชั้น", style: "background:rgba(245, 158, 11, 0.2); color:#fbbf24; border:1px solid #fbbf24;" };
  }
  return { name: "ตะกร้าหิ้ว", style: "background:rgba(16, 185, 129, 0.2); color:#34d399; border:1px solid #34d399;" };
}

// ======================== API ROUTES ========================

// 1. Products
app.get('/api/products', (req, res) => {
  try {
    const products = ProductDAO.getAll();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products/inbound', (req, res) => {
  try {
    const { barcode, name, cat, price, loc, zone, qty, image, description } = req.body;
    if (!barcode || !name || !loc || isNaN(qty) || isNaN(price)) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลรับเข้าให้ครบถ้วน' });
    }

    const result = ProductDAO.addOrUpdateInbound({
      barcode: barcode.trim(),
      name: name.trim(),
      cat,
      price: parseFloat(price),
      loc: loc.trim().toUpperCase(),
      zone,
      qty: parseInt(qty, 10),
      image: image ? image.trim() : null,
      description: description ? description.trim() : null
    });

    broadcast('INBOUND_RECEIVED', result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products/replenish', (req, res) => {
  try {
    const { id, qty, target = 'stock', note } = req.body;
    if (!id || isNaN(qty) || parseInt(qty, 10) <= 0) {
      return res.status(400).json({ error: 'กรุณาระบุรหัสสินค้าและจำนวนที่ถูกต้อง' });
    }

    const updated = ProductDAO.addStock(id, parseInt(qty, 10), target);
    if (!updated) {
      return res.status(404).json({ error: 'ไม่พบรหัสสินค้าที่ระบุ' });
    }

    const resultPayload = {
      product: updated,
      target,
      qtyAdded: parseInt(qty, 10),
      note: note || '',
      updatedAt: Date.now()
    };

    broadcast('STOCK_UPDATED', resultPayload);
    broadcast('INBOUND_RECEIVED', { action: 'replenished', product: updated });
    res.json({ success: true, ...resultPayload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products/relocate', (req, res) => {
  try {
    const { id, newLoc, newZone, reason, movedBy } = req.body;
    if (!id || !newLoc) {
      return res.status(400).json({ error: 'กรุณาระบุรหัสสินค้า (SKU) และพิกัดตำแหน่งใหม่' });
    }

    const result = ProductDAO.relocateProduct({
      id: id.trim(),
      newLoc: newLoc.trim().toUpperCase(),
      newZone: newZone ? newZone.trim().toUpperCase() : null,
      reason: reason ? reason.trim() : 'ย้ายปรับปรุงพื้นที่จัดเก็บ',
      movedBy: movedBy ? movedBy.trim() : 'เจ้าหน้าที่คลัง'
    });

    if (!result) {
      return res.status(404).json({ error: 'ไม่พบรหัสสินค้าที่ต้องการย้ายตำแหน่ง' });
    }

    // Broadcast location update so Picking, Store, and Inbound views refresh instantly
    broadcast('LOCATION_MOVED', result);
    broadcast('STOCK_UPDATED', { product: result.product, updatedAt: Date.now() });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/location-history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const history = LocationMoveDAO.getHistory(limit);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Orders & Checkout
app.get('/api/orders', (req, res) => {
  try {
    const orders = OrderDAO.getAll();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/history', (req, res) => {
  try {
    const history = OrderDAO.getHistory();
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Build wave picking groups for queued orders
function buildWavesForQueuedOrders(queuedOrders) {
  if (!queuedOrders || queuedOrders.length === 0) return [];
  const products = ProductDAO.getAll();
  const createdWaves = [];

  ['A', 'B', 'C'].forEach(zone => {
    const pickList = [];
    const involvedOrders = [];

    queuedOrders.forEach(ord => {
      if (ord.zones && ord.zones.includes(zone)) {
        involvedOrders.push(ord);
        for (const [skuId, qty] of Object.entries(ord.items)) {
          const info = products.find(s => s.id === skuId);
          if (info && info.zone === zone) {
            pickList.push({
              orderId: ord.orderId,
              targetSlot: ord.putWallSlot,
              skuId: skuId,
              skuName: info.name,
              barcode: info.barcode,
              loc: info.loc,
              zone: info.zone,
              qty: qty,
              pickedUnits: 0
            });
          }
        }
      }
    });

    if (pickList.length > 0) {
      pickList.sort((a, b) => a.loc.localeCompare(b.loc));
      const waveId = `W-ZONE-${zone}-${Math.floor(100 + Math.random() * 900)}`;
      const wave = WaveDAO.saveWave({
        waveId,
        zone,
        pickList,
        orders: involvedOrders
      });
      createdWaves.push(wave);
    }
  });

  queuedOrders.forEach(o => OrderDAO.updateStatus(o.orderId, 'In-Progress'));
  return createdWaves;
}

app.post('/api/orders', (req, res) => {
  try {
    const { cart } = req.body;
    if (!cart || typeof cart !== 'object') {
      return res.status(400).json({ error: 'Cart is empty or invalid' });
    }

    const activeKeys = Object.keys(cart).filter(k => cart[k] > 0);
    if (activeKeys.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const products = ProductDAO.getAll();
    const orderId = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
    const zones = [...new Set(activeKeys.map(id => {
      const prod = products.find(s => s.id === id);
      return prod ? prod.zone : 'A';
    }))];

    const itemsToOrder = {};
    activeKeys.forEach(k => { itemsToOrder[k] = cart[k]; });

    // Check if any product has shortage (Ordered qty > available stock)
    let isBackorder = false;
    const backorderItems = {};

    for (const [skuId, qty] of Object.entries(itemsToOrder)) {
      const prod = products.find(s => s.id === skuId);
      const currentStock = prod ? prod.stock : 0;
      if (qty > currentStock) {
        isBackorder = true;
        backorderItems[skuId] = qty - Math.max(0, currentStock);
      }
    }

    const putWallSlot = 'PW-' + (Math.floor(Math.random() * 15) + 1);
    const mhe = calculateMHE(itemsToOrder, products);

    const newOrder = OrderDAO.create({
      orderId,
      items: itemsToOrder,
      zones,
      putWallSlot,
      mhe,
      status: isBackorder ? 'Backordered' : 'Queued',
      backorderItems
    });

    if (isBackorder) {
      broadcast('ORDER_BACKORDERED', { order: newOrder, backorderItems });
      broadcast('ORDER_CREATED', { order: newOrder, isBackorder: true, waves: [] });
      return res.json({
        order: newOrder,
        isBackorder: true,
        backorderItems,
        message: 'สินค้าบางรายการไม่พอในสต็อก ระบบได้บันทึกเป็นการจอง Order (Backorder) ไว้เรียบร้อยแล้ว'
      });
    }

    // Build wave picking groups for newly queued orders
    const allQueued = OrderDAO.getAll().filter(o => o.status === 'Queued');
    const createdWaves = buildWavesForQueuedOrders(allQueued);

    broadcast('ORDER_CREATED', { order: newOrder, isBackorder: false, waves: createdWaves });
    res.json({ order: newOrder, isBackorder: false, waves: createdWaves });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================== PROCUREMENT (แผนการสั่งซื้อ) ========================
app.get('/api/procurement/plans', (req, res) => {
  try {
    const plans = PurchasePlanDAO.getAll();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/procurement/plans/:id', (req, res) => {
  try {
    const plan = PurchasePlanDAO.getById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'ไม่พบแผนการสั่งซื้อ' });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/procurement/suggestions', (req, res) => {
  try {
    const suggestions = PurchasePlanDAO.getSuggestions();
    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/procurement/plans', (req, res) => {
  try {
    const { title, supplier, items, etaMinutes, notes, status } = req.body;
    if (!title || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อแผนและเลือกสินค้าอย่างน้อย 1 รายการ' });
    }

    const newPlan = PurchasePlanDAO.create({
      title: title.trim(),
      supplier: supplier ? supplier.trim() : 'ซัพพลายเออร์ทั่วไป (General Supplier)',
      items,
      etaMinutes: parseInt(etaMinutes, 10) || 5,
      notes: notes ? notes.trim() : '',
      status: status || 'Ordered'
    });

    broadcast('PURCHASE_PLAN_CREATED', newPlan);
    res.json(newPlan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/procurement/plans/:id/order', (req, res) => {
  try {
    const { id } = req.params;
    const { etaMinutes } = req.body || {};
    const updated = PurchasePlanDAO.placeOrder(id, etaMinutes || 5);
    if (!updated) return res.status(404).json({ error: 'ไม่พบแผนการสั่งซื้อ' });

    broadcast('PURCHASE_PLAN_ORDERED', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/procurement/plans/:id/receive', (req, res) => {
  try {
    const { id } = req.params;
    const result = PurchasePlanDAO.receiveGoods(id);
    if (!result || !result.plan) {
      return res.status(404).json({ error: 'ไม่พบแผนการสั่งซื้อ' });
    }

    let createdWaves = [];
    if (result.unblockedOrders && result.unblockedOrders.length > 0) {
      createdWaves = buildWavesForQueuedOrders(result.unblockedOrders);
    }

    broadcast('PURCHASE_PLAN_RECEIVED', {
      plan: result.plan,
      updatedProducts: result.updatedProducts,
      unblockedOrders: result.unblockedOrders,
      createdWaves
    });
    broadcast('STOCK_UPDATED', { action: 'goods_received', planId: id });
    if (result.unblockedOrders && result.unblockedOrders.length > 0) {
      broadcast('ORDER_UNBLOCKED', { unblockedOrders: result.unblockedOrders, createdWaves });
    }

    res.json({
      success: true,
      plan: result.plan,
      unblockedOrders: result.unblockedOrders,
      createdWaves,
      message: `รับสินค้าตามแผน ${result.plan.id} เรียบร้อยแล้ว! เติมสต็อกสินค้า และปลดล็อกคำสั่งซื้อจอง ${result.unblockedOrders.length} รายการ`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/procurement/plans/:id', (req, res) => {
  try {
    const { id } = req.params;
    PurchasePlanDAO.delete(id);
    broadcast('PURCHASE_PLAN_DELETED', { id });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders/:id/pack', (req, res) => {
  try {
    const { id } = req.params;
    const { qcData } = req.body || {};
    const result = OrderDAO.packOrder(id, qcData);
    if (!result) {
      return res.status(404).json({ error: 'Order not found' });
    }

    broadcast('ORDER_PACKED', result);
    broadcast('QC_UPDATED', QCDAO.getStats());
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Picking & Waves
app.get('/api/waves', (req, res) => {
  try {
    const waves = WaveDAO.getAll();
    res.json(waves);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/picking/scan', (req, res) => {
  try {
    const { scannedCode, workerId, isMultiWaveMode, activeWaveId, pickQty = 1 } = req.body;
    if (!scannedCode) {
      return res.status(400).json({ success: false, error: 'No barcode provided' });
    }

    const qtyToPick = Math.max(1, parseInt(pickQty, 10) || 1);
    const matchedSku = ProductDAO.getByBarcodeOrId(scannedCode);
    const internalId = matchedSku ? matchedSku.id : scannedCode.trim().toUpperCase();

    const waves = WaveDAO.getAll();
    let targetTask = null;
    let targetWave = null;

    if (isMultiWaveMode) {
      for (const w of waves) {
        const found = w.pickList.find(t => t.skuId === internalId && t.pickedUnits < t.qty);
        if (found) {
          targetTask = found;
          targetWave = w;
          break;
        }
      }
    } else {
      const currentWave = waves.find(w => w.waveId === activeWaveId);
      if (currentWave && !currentWave.completed) {
        targetTask = currentWave.pickList.find(t => t.pickedUnits < t.qty);
        if (targetTask && targetTask.skuId === internalId) {
          targetWave = currentWave;
        } else if (targetTask) {
          targetTask = null; // Scanned item is out of sequence
        }
      }
    }

    if (!targetTask) {
      return res.json({
        success: false,
        error: `✖ สแกนผิดพลาด หรือผิดลำดับการเดิน! [${scannedCode}]`
      });
    }

    // Set startedAt on parent order if first pick
    OrderDAO.setStartedAtIfNull(targetTask.orderId, Date.now());

    // Calculate actual units to pick (not exceeding needed amount)
    const needed = targetTask.qty - targetTask.pickedUnits;
    const actualPicked = Math.min(qtyToPick, needed);

    // Update task
    targetTask.pickedUnits += actualPicked;

    // Decrement product stock & increment picks
    const updatedProduct = ProductDAO.decrementStockIncrementPicksBy
      ? ProductDAO.decrementStockIncrementPicksBy(targetTask.skuId, actualPicked)
      : ProductDAO.decrementStockIncrementPicks(targetTask.skuId);

    // Attribute pick to worker if provided
    if (workerId) {
      if (WorkerDAO.incrementUnitsPickedBy) {
        WorkerDAO.incrementUnitsPickedBy(workerId, actualPicked);
      } else {
        WorkerDAO.incrementUnitsPicked(workerId);
      }
    }

    // Check if wave is completed
    const isWaveComplete = targetWave.pickList.every(t => t.pickedUnits >= t.qty);
    if (isWaveComplete) {
      targetWave.completed = true;
      const orderIds = [...new Set(targetWave.pickList.map(t => t.orderId))];
      orderIds.forEach(oId => {
        OrderDAO.addZoneCompleted(oId, targetWave.zone);
      });
    }

    // Save wave update
    WaveDAO.updatePickList(targetWave.waveId, targetWave.pickList, targetWave.completed);

    const broadcastPayload = {
      task: targetTask,
      wave: targetWave,
      completedWave: isWaveComplete,
      product: updatedProduct,
      unitsPickedThisScan: actualPicked
    };

    broadcast('PICK_SCANNED', broadcastPayload);

    res.json({
      success: true,
      task: targetTask,
      wave: targetWave,
      completedWave: isWaveComplete,
      actualPicked,
      message: `✔ สแกนถูกต้อง: ${targetTask.skuName} (+${actualPicked} ชิ้น) (${targetTask.pickedUnits}/${targetTask.qty}) ➔ วางช่อง ${targetTask.targetSlot}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Workers
app.get('/api/workers', (req, res) => {
  try {
    const workers = WorkerDAO.getAll();
    res.json(workers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workers/clock-in', (req, res) => {
  try {
    let { id, name } = req.body;
    if (!id) return res.status(400).json({ error: 'กรุณาระบุเลขรหัสพนักงาน' });

    let rawId = id.trim();
    if (!rawId.toUpperCase().startsWith('NEXUS-')) {
      rawId = 'NEXUS-' + rawId;
    }
    const staffId = rawId.toUpperCase();

    const existing = WorkerDAO.getById(staffId);
    if (!existing && !name) {
      return res.status(400).json({ error: `รหัส ${staffId} เป็นพนักงานใหม่: กรุณาระบุชื่อ-นามสกุล` });
    }

    const result = WorkerDAO.clockIn(staffId, name ? name.trim() : '');
    broadcast('WORKER_UPDATED', result.worker);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workers/clock-out', (req, res) => {
  try {
    let { id } = req.body;
    if (!id) return res.status(400).json({ error: 'กรุณาระบุเลขรหัสพนักงาน' });

    let rawId = id.trim();
    if (!rawId.toUpperCase().startsWith('NEXUS-')) {
      rawId = 'NEXUS-' + rawId;
    }
    const staffId = rawId.toUpperCase();

    const worker = WorkerDAO.clockOut(staffId);
    if (!worker) {
      return res.status(404).json({ error: 'ไม่พบพนักงาน หรือพนักงานยังไม่ได้เข้ากะ' });
    }

    broadcast('WORKER_UPDATED', worker);
    res.json({ worker });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. QC Inspection APIs
app.post('/api/qc/inspect', (req, res) => {
  try {
    const { orderId, inspectorName, status, defectType, defectNotes, itemsChecked } = req.body;
    if (!orderId) return res.status(400).json({ error: 'กรุณาระบุ Order ID' });

    const log = QCDAO.recordInspection({
      orderId,
      inspectorName,
      status,
      defectType,
      defectNotes,
      itemsChecked
    });

    const stats = QCDAO.getStats();
    broadcast('QC_INSPECTED', { log, stats });
    res.json({ log, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/qc/stats', (req, res) => {
  try {
    res.json(QCDAO.getStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/qc/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    res.json(QCDAO.getLogs(limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/qc/logs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status, defectType, defectNotes, inspectorName, itemsChecked } = req.body;

    const updatedLog = QCDAO.updateLog(parseInt(id, 10), {
      status,
      defectType,
      defectNotes,
      inspectorName,
      itemsChecked
    });

    if (!updatedLog) {
      return res.status(404).json({ error: 'ไม่พบบันทึกประวัติ QC ที่ระบุ' });
    }

    const stats = QCDAO.getStats();
    broadcast('QC_LOG_UPDATED', { log: updatedLog, stats });
    broadcast('QC_UPDATED', stats);
    res.json({ success: true, log: updatedLog, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Analytics & Dashboard Metrics
app.get('/api/analytics', (req, res) => {
  try {
    const products = ProductDAO.getAll();
    const history = OrderDAO.getHistory();
    const workers = WorkerDAO.getAll();
    const qcStats = QCDAO.getStats();
    const qcLogs = QCDAO.getLogs(20);

    // 1. Zone & Picks
    const zoneData = { A: 0, B: 0, C: 0 };
    let totalPicks = 0;
    products.forEach(item => {
      zoneData[item.zone] = (zoneData[item.zone] || 0) + item.picks;
      totalPicks += item.picks;
    });

    // 2. ABC Classification with Shelf Levels & Recommendations
    const sortedProducts = [...products].sort((a, b) => b.picks - a.picks);
    let cumulativePicks = 0;
    const enrichedProducts = sortedProducts.map((p, idx) => {
      cumulativePicks += p.picks;
      const pickShare = totalPicks > 0 ? (cumulativePicks / totalPicks) * 100 : 0;

      // Dynamic ABC Class based on pick frequency / Pareto 80-15-5
      let abcClass = 'C';
      if (idx < 12 || pickShare <= 75) {
        abcClass = 'A';
      } else if (idx < 28 || pickShare <= 92) {
        abcClass = 'B';
      }

      // Parse shelf location (e.g., A-01-02)
      const locParts = (p.loc || '').split('-');
      const aisle = locParts[0] ? `Rack ${locParts[0]}` : 'Rack A';
      const bay = locParts[1] ? `Bay ${locParts[1]}` : 'Bay 01';
      const binNum = parseInt(locParts[2] || '1', 10);

      let levelNumber = 2;
      let levelDesc = 'Level 2 (ระดับเอว)';
      let isGoldenZone = true;

      if (binNum === 1) {
        levelNumber = 1;
        levelDesc = 'Level 1 (ชั้นล่างสุด)';
        isGoldenZone = false;
      } else if (binNum === 2) {
        levelNumber = 2;
        levelDesc = 'Level 2 (ระดับเอว)';
        isGoldenZone = true;
      } else if (binNum === 3) {
        levelNumber = 3;
        levelDesc = 'Level 3 (ระดับสายตา)';
        isGoldenZone = true;
      } else {
        levelNumber = 4;
        levelDesc = 'Level 4 (ชั้นบนสุด)';
        isGoldenZone = false;
      }

      // Slotting Recommendation
      let slottingStatus = 'OPTIMAL';
      let slottingRecommendation = 'ตำแหน่งจัดเก็บเหมาะสม (Optimal)';
      if (abcClass === 'A' && !isGoldenZone) {
        slottingStatus = 'SUBOPTIMAL';
        slottingRecommendation = '⚠️ สินค้าขายดี ควรย้ายมา Golden Zone (ชั้น 2-3) เพื่อลดเวลาเดินหยิบ';
      } else if (abcClass === 'C' && isGoldenZone) {
        slottingStatus = 'INEFFICIENT';
        slottingRecommendation = 'ℹ️ สินค้าหมุนช้า ควรย้ายไปชั้นบน (ชั้น 4) เพื่อคืนพื้นที่ Golden Zone';
      }

      return {
        ...p,
        abcClass,
        aisle,
        bay,
        shelfLevel: levelNumber,
        shelfLevelDesc: levelDesc,
        isGoldenZone,
        slottingStatus,
        slottingRecommendation
      };
    });

    const topSkus = enrichedProducts.slice(0, 5);

    // 3. Order Cycle Time / Lead Time KPI
    let totalLeadTimeMs = 0;
    let minLeadTimeMs = history.length > 0 ? history[0].lead_time_ms : 0;
    let maxLeadTimeMs = history.length > 0 ? history[0].lead_time_ms : 0;
    let onTimeSlaCount = 0;
    const SLA_TARGET_MS = 180000; // SLA Target: <= 3 นาที

    const timeDistribution = {
      under2Min: 0,
      between2And3Min: 0,
      between3And5Min: 0,
      over5Min: 0
    };

    history.forEach(h => {
      totalLeadTimeMs += h.lead_time_ms;
      if (h.lead_time_ms < minLeadTimeMs) minLeadTimeMs = h.lead_time_ms;
      if (h.lead_time_ms > maxLeadTimeMs) maxLeadTimeMs = h.lead_time_ms;

      if (h.lead_time_ms <= SLA_TARGET_MS) onTimeSlaCount++;

      if (h.lead_time_ms < 120000) {
        timeDistribution.under2Min++;
      } else if (h.lead_time_ms <= 180000) {
        timeDistribution.between2And3Min++;
      } else if (h.lead_time_ms <= 300000) {
        timeDistribution.between3And5Min++;
      } else {
        timeDistribution.over5Min++;
      }
    });

    const avgLeadTimeMs = history.length > 0 ? Math.round(totalLeadTimeMs / history.length) : 0;
    const slaComplianceRate = history.length > 0 ? parseFloat(((onTimeSlaCount / history.length) * 100).toFixed(1)) : 100.0;

    // 4. Labor & Workforce Tracking
    let totalUnitsPicked = 0;
    let activeWorkers = 0;
    let totalHoursAll = 0;
    const now = Date.now();

    const workerStats = workers.map(w => {
      totalUnitsPicked += w.units_picked;
      if (w.clocked_in) activeWorkers++;
      let ms = w.total_time_ms;
      if (w.clocked_in && w.last_clock_in_at) {
        ms += (now - w.last_clock_in_at);
      }
      const hrs = (ms / (1000 * 3600));
      totalHoursAll += hrs;
      const workerUph = hrs > 0 ? parseFloat((w.units_picked / hrs).toFixed(1)) : 0;
      return {
        ...w,
        current_time_ms: ms,
        work_hours: parseFloat(hrs.toFixed(2)),
        uph: workerUph
      };
    });

    const totalHoursFormatted = parseFloat(totalHoursAll.toFixed(2));
    const uph = totalHoursAll > 0 ? (totalUnitsPicked / totalHoursAll).toFixed(1) : '0.0';
    const opmh = totalHoursAll > 0 ? (history.length / totalHoursAll).toFixed(1) : '0.0';

    res.json({
      zoneData,
      totalPicks,
      topSkus,
      totalPacked: history.length,
      avgLeadTimeMs,
      minLeadTimeMs,
      maxLeadTimeMs,
      slaTargetMs: SLA_TARGET_MS,
      slaComplianceRate,
      timeDistribution,
      activeWorkers,
      totalWorkers: workers.length,
      totalHoursAll: totalHoursFormatted,
      totalUnitsPicked,
      uph,
      opmh,
      workerStats,
      qcStats,
      qcLogs,
      storageSlotting: {
        totalSkus: products.length,
        classA: enrichedProducts.filter(p => p.abcClass === 'A'),
        classB: enrichedProducts.filter(p => p.abcClass === 'B'),
        classC: enrichedProducts.filter(p => p.abcClass === 'C'),
        allProducts: enrichedProducts
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint for client auto-detection
app.get('/api/health', (req, res) => {
  res.json({
    app: 'nexus-wms',
    status: 'ok',
    version: '2.0.0',
    port: req.socket.localPort,
    db: 'sqlite'
  });
});

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3300;

function startServer(port, remainingAttempts = 10) {
  const onError = (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ [PORT ${port} IN USE] พอร์ต ${port} กำลังถูกใช้งานอยู่`);
      if (remainingAttempts > 0) {
        const nextPort = port + 1;
        console.log(`🔄 กำลังสลับไปรันที่พอร์ตสำรองอัตโนมัติ: http://localhost:${nextPort}...`);
        server.removeListener('error', onError);
        startServer(nextPort, remainingAttempts - 1);
      } else {
        console.error(`❌ ไม่สามารถเปิดเซิร์ฟเวอร์ได้เนื่องจากพอร์ตเต็ม`);
        process.exit(1);
      }
    } else {
      console.error('Server error:', err);
    }
  };

  server.once('error', onError);

  server.listen(port, '0.0.0.0', () => {
    server.removeListener('error', onError);
    console.log(`====================================================`);
    console.log(`🚀 Nexus WMS Server running on: http://localhost:${port}`);
    console.log(`📱 Connect mobile scanners via: http://<YOUR_LAN_IP>:${port}`);
    console.log(`💾 SQLite persistent database: nexus_wms.db`);
    console.log(`====================================================`);
  });
}

startServer(DEFAULT_PORT);

