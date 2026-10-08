/**
 * Nexus WMS - Storefront & Product Detail Module (Amazon UI)
 */
const Store = (() => {
  // Initial product list with fallback to DEFAULT_SKU_MASTER and cached data
  let products = (typeof DEFAULT_SKU_MASTER !== 'undefined' && Array.isArray(DEFAULT_SKU_MASTER))
    ? JSON.parse(JSON.stringify(DEFAULT_SKU_MASTER))
    : [];

  try {
    const cached = localStorage.getItem('nexus_products_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) products = parsed;
    }
  } catch (e) {}

  let cart = {};
  let currentFilter = 'All';
  let searchQuery = '';
  let activeDetailSku = null;
  let activeDetailQty = 1;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Fallback image in case of network issue
  const DEFAULT_IMG = "https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&w=600&q=80";

  // Load saved cart from localStorage if present
  try {
    const savedCart = localStorage.getItem('nexus_wms_cart');
    if (savedCart) cart = JSON.parse(savedCart);
  } catch (e) {}

  function saveCart() {
    try {
      localStorage.setItem('nexus_wms_cart', JSON.stringify(cart));
    } catch (e) {}
  }

  async function init() {
    // Immediate render so user never sees a blank screen
    renderCatalog(currentFilter);
    updateCartSummary();

    // Fetch fresh data from backend
    await reloadProducts();
    renderCatalog(currentFilter);
    updateCartSummary();

    // Listen to real-time events
    API.on('INBOUND_RECEIVED', async () => {
      await reloadProducts();
      renderCatalog(currentFilter);
    });

    API.on('LOCATION_MOVED', async () => {
      await reloadProducts();
      renderCatalog(currentFilter);
    });

    API.on('PICK_SCANNED', (data) => {
      if (data.product) {
        const item = products.find(p => p.id === data.product.id);
        if (item) {
          item.stock = data.product.stock;
          item.picks = data.product.picks;
          // Soft update stock display without resetting whole UI
          const stockEl = document.getElementById(`stock-display-${item.id}`);
          if (stockEl) {
            stockEl.innerText = `In Stock (เหลือ ${item.stock} ชิ้น)`;
            if (item.stock <= 10) stockEl.classList.add('low-stock');
          }
          // If product detail is currently open for this SKU, update stock there too
          if (activeDetailSku && activeDetailSku.id === item.id) {
            const detailStockEl = document.getElementById('pdetail-stock-val');
            if (detailStockEl) {
              detailStockEl.innerText = `สถานะสต็อก: เหลือ ${item.stock} ชิ้นในคลัง`;
            }
          }
        }
      }
    });

    // Close detail modal on ESC key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeProductDetail();
        closeCartModal();
      }
    });
  }

  async function reloadProducts() {
    try {
      const data = await API.getProducts();
      if (Array.isArray(data) && data.length > 0) {
        products = data;
        try { localStorage.setItem('nexus_products_cache', JSON.stringify(products)); } catch (e) {}
        return products;
      }
    } catch (err) {
      console.warn('API getProducts unavailable, using fallback data:', err);
    }

    if (!products || products.length === 0) {
      if (typeof DEFAULT_SKU_MASTER !== 'undefined' && Array.isArray(DEFAULT_SKU_MASTER)) {
        products = JSON.parse(JSON.stringify(DEFAULT_SKU_MASTER));
      }
    }
    return products;
  }

  function getProducts() {
    return products;
  }

  function filterCatalog(category) {
    currentFilter = category;
    document.querySelectorAll('.amz-nav-item').forEach(b => b.classList.remove('active'));

    const navItems = document.querySelectorAll('.amz-nav-item');
    navItems.forEach(item => {
      if (item.innerText.trim() === category) {
        item.classList.add('active');
      }
    });

    const catSelect = document.getElementById('store-search-category');
    if (catSelect && catSelect.value !== category) {
      catSelect.value = category;
    }

    renderCatalog(category);
  }

  function onSearchCategoryChange(cat) {
    filterCatalog(cat);
  }

  function handleSearch(query) {
    searchQuery = (query || '').trim();
    const clearBtn = document.getElementById('store-search-clear');
    if (clearBtn) {
      clearBtn.style.display = searchQuery ? 'flex' : 'none';
    }
    renderCatalog(currentFilter);
  }

  function clearSearch() {
    searchQuery = '';
    const input = document.getElementById('store-search-input');
    if (input) {
      input.value = '';
      input.focus();
    }
    const clearBtn = document.getElementById('store-search-clear');
    if (clearBtn) clearBtn.style.display = 'none';
    renderCatalog(currentFilter);
  }

  function executeSearch() {
    const input = document.getElementById('store-search-input');
    if (input) {
      handleSearch(input.value);
    }
  }

  function renderCatalog(filterCat = 'All') {
    const container = document.getElementById('store-content-area');
    if (!container) return;

    const q = (searchQuery || '').toLowerCase();
    const isSearching = q.length > 0;

    let html = '';

    if (!isSearching && filterCat === 'All') {
      html += `
        <div class="amz-hero-scroll">
          <div class="amz-hero-card kitchen" onclick="Store.filterCatalog('ของใช้ในบ้าน')">
            <span>Shop kitchen & home must-haves</span>
            <div class="amz-hero-img-box">
              <img src="https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80" class="amz-hero-img" alt="Kitchen" onerror="this.src='${DEFAULT_IMG}'">
            </div>
          </div>
          <div class="amz-hero-card beauty" onclick="Store.filterCatalog('สุขภาพและความงาม')">
            <span>Shop all things beauty & health</span>
            <div class="amz-hero-img-box">
              <img src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80" class="amz-hero-img" alt="Beauty" onerror="this.src='${DEFAULT_IMG}'">
            </div>
          </div>
          <div class="amz-hero-card fashion" onclick="Store.filterCatalog('เครื่องใช้ไฟฟ้า')">
            <span>Top electronics & smart devices</span>
            <div class="amz-hero-img-box">
              <img src="https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?auto=format&fit=crop&w=600&q=80" class="amz-hero-img" alt="Electronics" onerror="this.src='${DEFAULT_IMG}'">
            </div>
          </div>
          <div class="amz-hero-card delivery" onclick="Store.filterCatalog('อาหารและเครื่องดื่ม')">
            <span>Food, snacks & beverages</span>
            <div class="amz-hero-img-box">
              <img src="https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80" class="amz-hero-img" alt="Food" onerror="this.src='${DEFAULT_IMG}'">
            </div>
          </div>
          <div class="amz-hero-card toys" onclick="Store.filterCatalog('แคมป์ปิ้งและเครื่องมือ')">
            <span>Outdoor, camping & tools</span>
            <div class="amz-hero-img-box">
              <img src="https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=600&q=80" class="amz-hero-img" alt="Camping" onerror="this.src='${DEFAULT_IMG}'">
            </div>
          </div>
        </div>
      `;

      html += `<div class="amz-quad-grid">`;

      const elec = products.filter(s => s.cat === "เครื่องใช้ไฟฟ้า").slice(0, 4);
      if (elec.length >= 4) {
        html += `
          <div class="amz-quad-card">
            <div class="amz-quad-title">Plug in with electronics</div>
            <div class="amz-quad-items">
              ${elec.map(item => `
                <div class="amz-quad-item-box" onclick="Store.openProductDetail('${item.id}')" title="${item.name}">
                  <img src="${item.image || DEFAULT_IMG}" class="amz-quad-item-img" alt="${item.name}" onerror="this.src='${DEFAULT_IMG}'">
                  <span class="amz-quad-item-label">${item.name}</span>
                </div>
              `).join('')}
            </div>
            <a class="amz-link" onclick="Store.filterCatalog('เครื่องใช้ไฟฟ้า')">Shop electronics &rsaquo;</a>
          </div>`;
      }

      const home = products.filter(s => s.cat === "ของใช้ในบ้าน").slice(0, 4);
      if (home.length >= 4) {
        html += `
          <div class="amz-quad-card">
            <div class="amz-quad-title">Refresh your space</div>
            <div class="amz-quad-items">
              ${home.map(item => `
                <div class="amz-quad-item-box" onclick="Store.openProductDetail('${item.id}')" title="${item.name}">
                  <img src="${item.image || DEFAULT_IMG}" class="amz-quad-item-img" alt="${item.name}" onerror="this.src='${DEFAULT_IMG}'">
                  <span class="amz-quad-item-label">${item.name}</span>
                </div>
              `).join('')}
            </div>
            <a class="amz-link" onclick="Store.filterCatalog('ของใช้ในบ้าน')">Shop home goods &rsaquo;</a>
          </div>`;
      }

      const beauty = products.filter(s => s.cat === "สุขภาพและความงาม").slice(0, 4);
      if (beauty.length >= 4) {
        html += `
          <div class="amz-quad-card">
            <div class="amz-quad-title">Health & Beauty basics</div>
            <div class="amz-quad-items">
              ${beauty.map(item => `
                <div class="amz-quad-item-box" onclick="Store.openProductDetail('${item.id}')" title="${item.name}">
                  <img src="${item.image || DEFAULT_IMG}" class="amz-quad-item-img" alt="${item.name}" onerror="this.src='${DEFAULT_IMG}'">
                  <span class="amz-quad-item-label">${item.name}</span>
                </div>
              `).join('')}
            </div>
            <a class="amz-link" onclick="Store.filterCatalog('สุขภาพและความงาม')">Shop beauty &rsaquo;</a>
          </div>`;
      }

      const it = products.filter(s => s.cat === "อุปกรณ์ไอที").slice(0, 4);
      if (it.length >= 4) {
        html += `
          <div class="amz-quad-card">
            <div class="amz-quad-title">Top PC & Gadget picks</div>
            <div class="amz-quad-items">
              ${it.map(item => `
                <div class="amz-quad-item-box" onclick="Store.openProductDetail('${item.id}')" title="${item.name}">
                  <img src="${item.image || DEFAULT_IMG}" class="amz-quad-item-img" alt="${item.name}" onerror="this.src='${DEFAULT_IMG}'">
                  <span class="amz-quad-item-label">${item.name}</span>
                </div>
              `).join('')}
            </div>
            <a class="amz-link" onclick="Store.filterCatalog('อุปกรณ์ไอที')">Shop PC & IT &rsaquo;</a>
          </div>`;
      }
      html += `</div><h3 style="margin-top:16px; margin-bottom:12px; font-size:22px; font-weight:700;">Explore all products</h3>`;
    }

    let items = products;
    if (filterCat !== 'All') {
      items = items.filter(s => s.cat === filterCat);
    }

    if (isSearching) {
      const terms = q.split(/\s+/).filter(Boolean);
      items = items.filter(item => {
        const text = `${item.name || ''} ${item.id || ''} ${item.barcode || ''} ${item.cat || ''} ${item.description || ''} ${item.loc || ''} ${item.zone || ''}`.toLowerCase();
        return terms.every(t => text.includes(t));
      });
    }

    // Update stats count in search header
    const statsEl = document.getElementById('store-total-sku-count');
    if (statsEl) {
      statsEl.innerText = `${items.length} รายการ`;
    }

    if (isSearching) {
      html += `
        <div class="amz-search-results-banner">
          <div class="search-banner-left">
            <span class="search-result-title">🔍 ผลการค้นหา: <strong>"${escapeHtml(searchQuery)}"</strong></span>
            ${filterCat !== 'All' ? `<span class="search-cat-badge">หมวดหมู่: ${escapeHtml(filterCat)}</span>` : ''}
            <span class="search-count-badge">พบ ${items.length} รายการ</span>
          </div>
          <button class="amz-btn-clear-search" onclick="Store.clearSearch()">✕ ล้างการค้นหา</button>
        </div>
      `;
    } else if (filterCat !== 'All') {
      html += `
        <div style="margin-bottom:16px; display:flex; align-items:center; justify-content:space-between;">
          <h2 style="font-size:20px; font-weight:700; color:#111827;">หมวดหมู่: ${escapeHtml(filterCat)} (${items.length} รายการ)</h2>
          <button onclick="Store.filterCatalog('All')" style="background:none; border:none; color:var(--amz-link); cursor:pointer; font-weight:600;">← ดูสินค้าทั้งหมด</button>
        </div>
      `;
    }

    html += `<div class="amz-product-grid">`;
    if (items.length === 0) {
      if (isSearching) {
        html += `
          <div class="amz-no-results-box">
            <div style="font-size:42px; margin-bottom:12px;">🔍</div>
            <h3 style="font-size:18px; font-weight:700; color:#111827; margin-bottom:8px;">
              ไม่พบสินค้าที่ตรงกับคำค้นหา "${escapeHtml(searchQuery)}"
            </h3>
            <p style="color:#6b7280; font-size:14px; margin-bottom:18px;">
              ลองตรวจสอบตัวสะกด หรือค้นหาด้วยคำอื่น เช่น รหัส SKU, หมวดหมู่สินค้า หรือคำทั่วไป
            </p>
            <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
              <button onclick="Store.clearSearch()" class="amz-btn-reset-search">
                ล้างคำค้นหา (แสดงสินค้าทั้งหมด)
              </button>
              ${filterCat !== 'All' ? `
                <button onclick="Store.filterCatalog('All')" class="amz-btn-reset-search" style="background:#f3f4f6; border-color:#d1d5db; color:#374151;">
                  ค้นหาในทุกหมวดหมู่ (All)
                </button>` : ''}
            </div>
          </div>`;
      } else {
        html += `
          <div style="grid-column:1/-1; text-align:center; padding:60px 20px; background:white; border-radius:12px; color:#6b7280; font-size:16px; border:1px solid #e5e7eb;">
            🛒 ไม่พบสินค้าในหมวดหมู่นี้<br>
            <button onclick="Store.filterCatalog('All')" style="margin-top:12px; padding:8px 16px; background:#ffd814; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">
              กลับไปดูสินค้าทั้งหมด
            </button>
          </div>`;
      }
    } else {
      html += items.map(item => {
      const isLowStock = item.stock <= 10;
      const zoneTagClass = item.zone === 'A' ? 'zone-A-badge' : item.zone === 'B' ? 'zone-B-badge' : 'zone-C-badge';
      const rating = item.rating || 4.8;
      const reviews = item.reviews || 120;
      const imgUrl = item.image || DEFAULT_IMG;

      return `
      <div class="amz-product-card">
        <div class="amz-img-box" onclick="Store.openProductDetail('${item.id}')">
          <div class="amz-cat-badge">${item.cat}</div>
          <div class="amz-zone-badge ${zoneTagClass}">Zone ${item.zone}</div>
          <img src="${imgUrl}" class="amz-product-img" alt="${item.name}" onerror="this.src='${DEFAULT_IMG}'" loading="lazy">
        </div>

        <div class="amz-rating-row">
          <span class="amz-stars">★★★★★</span>
          <span style="font-weight:700; color:#374151;">${rating.toFixed(1)}</span>
          <span class="amz-review-count">(${reviews})</span>
        </div>

        <div class="amz-title" onclick="Store.openProductDetail('${item.id}')" title="คลิกเพื่อดูรายละเอียด: ${item.name}">
          ${item.name}
        </div>

        <div class="amz-price-box">
          <span class="amz-price-sym">฿</span>
          <span class="amz-price">${item.price.toFixed(2)}</span>
        </div>

        <div class="amz-prime">
          prime <span>★</span> <span style="font-size:11px; color:#565959; font-style:normal; margin-left:4px;">ส่งฟรีวันพรุ่งนี้</span>
        </div>

        <div class="amz-stock ${item.stock <= 0 ? 'out-of-stock' : isLowStock ? 'low-stock' : ''}" id="stock-display-${item.id}">
          ${item.stock <= 0 ? '🔴 หมดชั่วคราว (สั่งจอง Order ได้)' : `In Stock (เหลือ ${item.stock} ชิ้น)`}
        </div>

        <div class="amz-card-actions">
          <div class="amz-qty-row">
            <span style="font-size:12px; color:#565959;">จำนวน:</span>
            <input type="number" id="custom-qty-${item.id}" value="1" min="1" max="999" class="amz-qty-input" title="หากสั่งเกินสต็อก ระบบจะบันทึกเป็นการจอง Order">
          </div>
          <div class="amz-btn-group">
            <button class="amz-btn-detail" onclick="Store.openProductDetail('${item.id}')" title="ดูรายละเอียดสินค้า">
              🔍 รายละเอียด
            </button>
            <button class="amz-btn-add" onclick="Store.addCustomQtyToCart('${item.id}')">
              ${item.stock <= 0 ? '⏳ จอง Order' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>`;
    }).join('');
    }
    html += `</div>`;

    container.innerHTML = html;
    if (filterCat !== 'All') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==================== PRODUCT DETAIL MODAL ====================

  function openProductDetail(skuId) {
    const item = products.find(s => s.id === skuId);
    if (!item) return;

    activeDetailSku = item;
    activeDetailQty = 1;

    const modal = document.getElementById('product-detail-modal');
    const container = document.getElementById('product-detail-container');
    if (!modal || !container) return;

    const imgUrl = item.image || DEFAULT_IMG;
    const rating = item.rating || 4.8;
    const reviews = item.reviews || 120;
    const zoneColor = item.zone === 'A' ? '#ef4444' : item.zone === 'B' ? '#f59e0b' : '#6b7280';
    const isLowStock = item.stock <= 10;

    let mheName = "ตะกร้าหิ้ว";
    if (item.size === 'Bulky' || item.weight >= 10) mheName = "รถลากพาเลท (Pallet Jack)";
    else if (item.weight >= 3) mheName = "รถเข็นหลายชั้น (Multi-tier Trolley)";

    container.innerHTML = `
      <div class="pdetail-grid">
        <!-- Left: Image Box -->
        <div class="pdetail-left">
          <div class="pdetail-main-img-box">
            <img src="${imgUrl}" class="pdetail-main-img" id="pdetail-zoom-img" alt="${item.name}" onerror="this.src='${DEFAULT_IMG}'">
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:10px 14px; border-radius:10px; border:1px solid #e5e7eb;">
            <div style="font-size:12px; color:#6b7280;">พิกัดในคลัง: <strong style="color:var(--accent-cyan); font-family:monospace;">${item.loc}</strong></div>
            <div style="font-size:12px; color:#6b7280;">EAN-13: <strong style="font-family:monospace; color:#111827;">${item.barcode}</strong></div>
          </div>
        </div>

        <!-- Right: Information & Buy Box -->
        <div class="pdetail-right">
          <div class="pdetail-badges-row">
            <div class="pdetail-choice-badge">NEXUS <span>Choice</span></div>
            <div style="background:rgba(0, 168, 225, 0.1); color:#00a8e1; font-weight:bold; font-size:12px; padding:3px 8px; border-radius:4px;">
              prime <span>★</span> Free Delivery
            </div>
            <div style="background:rgba(249, 115, 22, 0.1); color:${zoneColor}; font-weight:bold; font-size:12px; padding:3px 8px; border-radius:4px; border:1px solid ${zoneColor};">
              โซนจัดเก็บ ${item.zone}
            </div>
          </div>

          <h1 class="pdetail-title">${item.name}</h1>

          <div class="pdetail-rating-box">
            <span class="amz-stars" style="font-size:16px;">★★★★★</span>
            <strong style="color:#111827; font-size:14px;">${rating.toFixed(1)} คะแนน</strong>
            <span style="color:#6b7280;">|</span>
            <a style="color:var(--amz-link); font-weight:600; text-decoration:none;">${reviews.toLocaleString()} ความคิดเห็นจากผู้ซื้อ</a>
          </div>

          <div class="pdetail-price-box">
            <div class="pdetail-price-row">
              <span class="pdetail-price-curr">฿</span>
              <span class="pdetail-price-val">${item.price.toFixed(2)}</span>
              <span style="color:#16a34a; font-weight:bold; font-size:13px; margin-left:8px;">(ประหยัด 15% จากราคาปกติ)</span>
            </div>
            <div class="pdetail-vat-tag">ราคารวมภาษีมูลค่าเพิ่มแล้ว • สามารถออกใบกำกับภาษีได้</div>
          </div>

          <div class="pdetail-desc">
            <div style="font-weight:700; color:#111827; margin-bottom:4px;">รายละเอียดสินค้า:</div>
            <p style="color:#4b5563;">${item.description || item.name}</p>
          </div>

          <!-- WMS Logistics Information -->
          <div class="pdetail-wms-info">
            <div class="pdetail-wms-item">
              <span>รหัสสินค้า (SKU)</span>
              <span>${item.id}</span>
            </div>
            <div class="pdetail-wms-item">
              <span>ตำแหน่งเชลฟ์ (Shelf Location)</span>
              <span style="color:var(--accent-orange); font-family:monospace;">${item.loc}</span>
            </div>
            <div class="pdetail-wms-item">
              <span>น้ำหนักพัสดุ (Weight)</span>
              <span>${item.weight} กิโลกรัม</span>
            </div>
            <div class="pdetail-wms-item">
              <span>ขนาดพัสดุ (Package Size)</span>
              <span>${item.size === 'Bulky' ? 'ขนาดใหญ่พิเศษ (Bulky)' : item.size === 'M' ? 'ขนาดกลาง (Medium)' : 'ขนาดกะทัดรัด (Small)'}</span>
            </div>
            <div class="pdetail-wms-item">
              <span>อุปกรณ์เคลื่อนย้ายแนะนำ</span>
              <span>${mheName}</span>
            </div>
            <div class="pdetail-wms-item">
              <span>สต็อกสำรอง (Reserve)</span>
              <span>${item.reserve} ชิ้น</span>
            </div>
          </div>

          <!-- Interactive Action Card -->
          <div class="pdetail-action-card">
            <div style="font-size:14px; font-weight:700; color:${item.stock <= 0 ? '#ef4444' : isLowStock ? '#c2410c' : '#15803d'};" id="pdetail-stock-val">
              ${item.stock <= 0 ? '⚠️ สถานะสต็อก: สินค้าหมดชั่วคราว (สามารถสั่งจอง Order ได้)' : `✔ สถานะสต็อก: เหลือ ${item.stock} ชิ้นในคลังสินค้า`}
            </div>

            <div id="pdetail-backorder-note" style="display:none; font-size:12px; color:#c2410c; background:#fff7ed; border:1px solid #fdba74; padding:8px 10px; border-radius:6px; margin-top:8px;"></div>

            <div class="pdetail-qty-control">
              <span style="font-weight:600; font-size:14px;">เลือกจำนวน:</span>
              <div class="pdetail-qty-btn-group">
                <button class="pdetail-qty-btn" onclick="Store.updateDetailQty(-1)">-</button>
                <span class="pdetail-qty-num" id="pdetail-qty-display">1</span>
                <button class="pdetail-qty-btn" onclick="Store.updateDetailQty(1)">+</button>
              </div>
              <div class="pdetail-subtotal-text">
                ยอดรวม: ฿<strong id="pdetail-subtotal-val">${item.price.toFixed(2)}</strong>
              </div>
            </div>

              <button class="pdetail-btn-cart" onclick="Store.addDetailToCart()">
                ${item.stock <= 0 ? '⏳ เพิ่มลงตะกร้า (จอง Order)' : '🛒 เพิ่มลงในตะกร้า'}
              </button>
              <button class="pdetail-btn-buy" onclick="Store.buyNowFromDetail()">
                ${item.stock <= 0 ? '⏳ สั่งจองทันที (Pre-order)' : '⚡ สั่งซื้อทันที (Buy Now)'}
              </button>
              <button class="pdetail-btn-cart" style="background:#1e293b; color:var(--accent-cyan); border:1px solid var(--accent-cyan); font-weight:600; font-size:13px;" onclick="Store.closeProductDetail(); Inbound.openReplenishModal('${item.id}')">
                📦 เติมสต็อกสินค้า SKU นี้ (Restock)
              </button>
              <button class="pdetail-btn-cart" style="background:#1e293b; color:var(--accent-orange); border:1px solid var(--accent-orange); font-weight:600; font-size:13px; margin-top:6px;" onclick="Store.closeProductDetail(); Inbound.openQuickRelocateModal('${item.id}')">
                📍 จัดการย้ายตำแหน่งสินค้า (Relocate SKU)
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  }

  function closeProductDetail() {
    const modal = document.getElementById('product-detail-modal');
    if (modal) modal.style.display = 'none';
    activeDetailSku = null;
    activeDetailQty = 1;
  }

  function updateDetailQty(change) {
    if (!activeDetailSku) return;
    activeDetailQty += change;
    if (activeDetailQty < 1) activeDetailQty = 1;
    if (activeDetailQty > 999) activeDetailQty = 999;

    const display = document.getElementById('pdetail-qty-display');
    const subtotal = document.getElementById('pdetail-subtotal-val');
    const note = document.getElementById('pdetail-backorder-note');

    if (display) display.innerText = activeDetailQty;
    if (subtotal) subtotal.innerText = (activeDetailSku.price * activeDetailQty).toFixed(2);

    const isBackorder = activeDetailQty > (activeDetailSku.stock || 0);
    if (note) {
      if (isBackorder) {
        const shortUnits = activeDetailQty - Math.max(0, activeDetailSku.stock || 0);
        note.style.display = 'block';
        note.innerHTML = `⚠️ จำนวนเกินสต็อกที่มี (${activeDetailSku.stock || 0} ชิ้น)<br>ระบบจะทำการ <strong>จอง Order (ขาด ${shortUnits} ชิ้น)</strong> และรอจัดทำแผนสั่งซื้อ`;
      } else {
        note.style.display = 'none';
      }
    }
  }

  function addDetailToCart() {
    if (!activeDetailSku) return;
    addItemsToCart(activeDetailSku.id, activeDetailQty);
    alert(`🛒 เพิ่ม "${activeDetailSku.name}" จำนวน ${activeDetailQty} ชิ้น ลงตะกร้าเรียบร้อย!`);
    closeProductDetail();
  }

  async function buyNowFromDetail() {
    if (!activeDetailSku) return;
    addItemsToCart(activeDetailSku.id, activeDetailQty);
    closeProductDetail();
    await placeOrder();
  }

  // ==================== CART FUNCTIONS ====================

  function addItemsToCart(skuId, qty) {
    cart[skuId] = (cart[skuId] || 0) + qty;
    saveCart();
    updateCartSummary();
  }

  function addCustomQtyToCart(skuId) {
    const inputEl = document.getElementById(`custom-qty-${skuId}`);
    const val = parseInt(inputEl.value, 10);
    if (isNaN(val) || val <= 0) return alert("กรุณาระบุจำนวนที่ถูกต้อง");
    addItemsToCart(skuId, val);
    inputEl.value = 1;
  }

  function updateCartSummary() {
    const activeKeys = Object.keys(cart).filter(k => cart[k] > 0);
    const count = activeKeys.reduce((a, b) => a + cart[b], 0);
    let totalPrice = 0;

    activeKeys.forEach(k => {
      const item = products.find(s => s.id === k);
      if (item) totalPrice += (item.price * cart[k]);
    });

    const lbl = document.getElementById('cart-lbl');
    const totPrice = document.getElementById('cart-total-price');
    const modalTotPrice = document.getElementById('modal-total-price');

    if (lbl) lbl.innerText = `${count} items`;
    if (totPrice) totPrice.innerText = totalPrice.toFixed(2);
    if (modalTotPrice) modalTotPrice.innerText = totalPrice.toFixed(2);
  }

  function openCartModal() {
    renderCartModalItems();
    document.getElementById('cart-modal').style.display = 'flex';
  }

  function closeCartModal() {
    document.getElementById('cart-modal').style.display = 'none';
  }

  function renderCartModalItems() {
    const container = document.getElementById('cart-modal-items');
    const itemKeys = Object.keys(cart).filter(k => cart[k] > 0);
    if (itemKeys.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); font-size:16px;">Your Amazon Cart is empty.</div>`;
      return;
    }

    let hasAnyBackorder = false;

    const itemsHtml = itemKeys.map(skuId => {
      const item = products.find(s => s.id === skuId);
      if (!item) return '';
      const imgUrl = item.image || DEFAULT_IMG;
      const currentStock = item.stock || 0;
      const isShort = cart[skuId] > currentStock;
      if (isShort) hasAnyBackorder = true;

      return `
        <div class="cart-edit-row">
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="${imgUrl}" style="width:48px; height:48px; border-radius:6px; object-fit:cover;" onerror="this.src='${DEFAULT_IMG}'">
            <div>
              <div style="font-weight:bold; font-size:14px; color:var(--text-main);">
                ${item.name}
                ${isShort ? `<span style="background:rgba(239, 68, 68, 0.2); color:#f87171; border:1px solid #f87171; font-size:11px; padding:2px 6px; border-radius:4px; margin-left:6px;">⏳ จอง Order (เกินสต็อก ${cart[skuId] - currentStock} ชิ้น)</span>` : ''}
              </div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                ฿${item.price.toFixed(2)} / ชิ้น | มีในคลัง: <strong style="color:${currentStock <= 5 ? '#f59e0b' : '#10b981'};">${currentStock}</strong> ชิ้น
              </div>
            </div>
          </div>
          <div class="cart-edit-controls">
            <button class="btn-edit-qty" onclick="Store.modifyCartQty('${skuId}', -1)">-</button>
            <strong style="color:var(--accent-orange); min-width:24px; text-align:center;">${cart[skuId]}</strong>
            <button class="btn-edit-qty" onclick="Store.modifyCartQty('${skuId}', 1)">+</button>
            <button class="btn-del-item" onclick="Store.deleteItem('${skuId}')">Delete</button>
          </div>
        </div>`;
    }).join('');

    const noticeHtml = hasAnyBackorder ? `
      <div style="background:rgba(249, 115, 22, 0.15); border:1px solid var(--accent-orange); border-radius:8px; padding:12px 16px; margin-bottom:16px; font-size:13px; color:#fdba74;">
        ℹ️ <strong>แจ้งเตือนการสั่งจองสินค้า (Backorder):</strong> ตะกร้าของคุณมีสินค้าที่เกินจำนวนสต็อกที่มี คำสั่งซื้อนี้จะถูกบันทึกเป็น <strong>"คำสั่งซื้อจอง (Backorder)"</strong> และส่งเข้าแผนจัดซื้อทันที
      </div>
    ` : '';

    container.innerHTML = noticeHtml + itemsHtml;
  }

  function modifyCartQty(skuId, change) {
    if (!cart[skuId]) return;
    cart[skuId] += change;
    if (cart[skuId] <= 0) delete cart[skuId];
    saveCart();
    updateCartSummary();
    renderCartModalItems();
  }

  function deleteItem(skuId) {
    delete cart[skuId];
    saveCart();
    updateCartSummary();
    renderCartModalItems();
  }

  function saveLocalOrder(orderId, orderCart) {
    let orders = [];
    try {
      orders = JSON.parse(localStorage.getItem('nexus_local_orders') || '[]');
    } catch (e) { orders = []; }

    const newOrder = {
      orderId,
      customer: "ลูกค้าหน้าร้าน (Online)",
      items: { ...orderCart },
      startedAt: Date.now(),
      packedAt: null,
      status: "pending"
    };
    orders.unshift(newOrder);
    try { localStorage.setItem('nexus_local_orders', JSON.stringify(orders)); } catch (e) {}

    // Group items into wave pick tasks for local picking
    let waves = [];
    try {
      waves = JSON.parse(localStorage.getItem('nexus_local_waves') || '[]');
    } catch (e) { waves = []; }

    const pickList = Object.entries(orderCart).map(([skuId, qty]) => {
      const p = products.find(x => x.id === skuId) || {};
      return {
        skuId,
        name: p.name || skuId,
        barcode: p.barcode || '',
        loc: p.loc || 'A-01-01',
        zone: p.zone || 'A',
        qty,
        pickedUnits: 0,
        completed: false
      };
    });

    const waveId = 'WV-' + Math.floor(1000 + Math.random() * 9000);
    const newWave = {
      waveId,
      zone: pickList[0]?.zone || 'A',
      pickList,
      totalUnits: Object.values(orderCart).reduce((a, b) => a + b, 0),
      pickedUnits: 0,
      completed: false,
      mhe: { name: "ตะกร้าหิ้ว", style: "background:rgba(16, 185, 129, 0.2); color:#34d399; border:1px solid #34d399;" },
      orders: [orderId]
    };
    waves.unshift(newWave);
    try { localStorage.setItem('nexus_local_waves', JSON.stringify(waves)); } catch (e) {}
  }

  async function placeOrder() {
    const activeKeys = Object.keys(cart).filter(k => cart[k] > 0);
    if (activeKeys.length === 0) return alert("ตะกร้าสินค้าว่างเปล่า กรุณาเลือกสินค้าก่อนทำการสั่งซื้อ");

    // Check if any item in cart exceeds current stock
    let hasBackorder = false;
    const backorderItems = {};
    activeKeys.forEach(skuId => {
      const p = products.find(x => x.id === skuId);
      const curStock = p ? (p.stock || 0) : 0;
      if (cart[skuId] > curStock) {
        hasBackorder = true;
        backorderItems[skuId] = cart[skuId] - Math.max(0, curStock);
      }
    });

    try {
      const res = await API.createOrder(cart);
      const orderId = res.order ? res.order.orderId : 'ORD-' + Math.floor(100000 + Math.random() * 900000);
      cart = {};
      saveCart();
      updateCartSummary();
      closeCartModal();

      if (res.isBackorder || hasBackorder) {
        App.playBeep(true);
        alert(
          `⏳ บันทึกคำสั่งซื้อเป็นการจองสินค้า (Backorder) สำเร็จ!\n\n` +
          `รหัสคำสั่งซื้อ: ${orderId}\n` +
          `สถานะ: ⏳ จอง Order (รอสินค้ามาเติม)\n\n` +
          `เนื่องจากสินค้าบางรายการสั่งเกินสต็อกที่มี คำสั่งซื้อถูกบันทึกเข้าสู่ระบบแผนจัดซื้อ (Procurement) เรียบร้อยแล้ว ` +
          `เมื่อสินค้ามาเติมเข้าคลัง ระบบจะปลดล็อกออเดอร์นี้และส่งไปสแกนหยิบทันที!`
        );
        App.navigate('page-procurement');
      } else {
        alert(`✅ สั่งซื้อสินค้าเรียบร้อยแล้ว!\nรหัสอ้างอิง: ${orderId}\nข้อมูลบันทึกลงระบบ และส่งไปสแกนหยิบ (Picking) เรียบร้อย!`);
        App.navigate('page-hub');
      }
    } catch (err) {
      console.warn('API createOrder failed, simulating order locally:', err);
      const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
      const orderCart = { ...cart };

      if (hasBackorder) {
        // Save local order with status: 'Backordered'
        saveLocalBackorder(orderId, orderCart, backorderItems);

        cart = {};
        saveCart();
        updateCartSummary();
        closeCartModal();
        renderCatalog(currentFilter);

        App.playBeep(true);
        alert(
          `⏳ บันทึกคำสั่งซื้อเป็นการจองสินค้า (Backorder) สำเร็จ!\n\n` +
          `รหัสคำสั่งซื้อ: ${orderId}\n` +
          `สถานะ: ⏳ จอง Order (รอสินค้ามาเติม)\n\n` +
          `สินค้าเกินสต็อก ระบบได้บันทึกเข้าสู่ระบบแผนจัดซื้อ (Procurement) แล้ว ` +
          `คุณสามารถไปที่แท็บ "แผนการสั่งซื้อ" เพื่อจัดทำแผนสั่งของมาเติมได้ทันที!`
        );
        App.navigate('page-procurement');
      } else {
        // Deduct local stock
        Object.keys(orderCart).forEach(skuId => {
          const item = products.find(p => p.id === skuId);
          if (item) {
            item.stock = Math.max(0, item.stock - orderCart[skuId]);
            item.picks = (item.picks || 0) + orderCart[skuId];
          }
        });
        try { localStorage.setItem('nexus_products_cache', JSON.stringify(products)); } catch (e) {}

        saveLocalOrder(orderId, orderCart);

        cart = {};
        saveCart();
        updateCartSummary();
        closeCartModal();
        renderCatalog(currentFilter);

        alert(`✅ สั่งซื้อสินค้าสำเร็จ!\nรหัสคำสั่งซื้อ: ${orderId}\nระบบได้ตัดสต็อกและส่งรายการไปที่แท็บ "สแกนหยิบ (Picking)" เรียบร้อยแล้ว!`);
        App.navigate('page-hub');
      }
    }
  }

  function saveLocalBackorder(orderId, orderCart, backorderItems) {
    let orders = [];
    try {
      orders = JSON.parse(localStorage.getItem('nexus_local_orders') || '[]');
    } catch (e) { orders = []; }

    const newOrder = {
      orderId,
      customer: "ลูกค้าหน้าร้าน (Online)",
      items: { ...orderCart },
      backorderItems: { ...backorderItems },
      startedAt: null,
      packedAt: null,
      status: "Backordered",
      putWallSlot: 'PW-' + (Math.floor(Math.random() * 15) + 1),
      createdAt: Date.now()
    };
    orders.unshift(newOrder);
    try { localStorage.setItem('nexus_local_orders', JSON.stringify(orders)); } catch (e) {}
  }

  return {
    init,
    reloadProducts,
    getProducts,
    filterCatalog,
    renderCatalog,
    openProductDetail,
    closeProductDetail,
    updateDetailQty,
    addDetailToCart,
    buyNowFromDetail,
    addCustomQtyToCart,
    modifyCartQty,
    deleteItem,
    openCartModal,
    closeCartModal,
    placeOrder,
    handleSearch,
    executeSearch,
    clearSearch,
    onSearchCategoryChange
  };
})();

if (typeof window !== 'undefined') {
  window.Store = Store;
}
