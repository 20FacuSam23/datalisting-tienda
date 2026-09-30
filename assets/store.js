(() => {
  'use strict';

  const config = window.DATALISTING_STORE || {};
  const API_BASE = String(config.API_BASE_URL || '').replace(/\/$/, '');
  const ORG = String(config.ORGANIZATION_SLUG || '');
  const state = { store: { currency: 'ARS', name: 'Tienda' }, offerings: [], cart: new Map(), filter: 'all', search: '' };

  const $ = (id) => document.getElementById(id);
  const catalog = $('catalog');
  const status = $('status');
  const cartDrawer = $('cartDrawer');
  const backdrop = $('backdrop');
  const cartItems = $('cartItems');
  const cartEmpty = $('cartEmpty');
  const checkoutButton = $('checkoutButton');
  const checkoutDialog = $('checkoutDialog');
  const formMessage = $('formMessage');
  const sendOrderButton = $('sendOrderButton');

  const storageKey = `datalisting-cart:${ORG}`;

  function money(value) {
    try {
      return new Intl.NumberFormat('es-AR', { style: 'currency', currency: state.store.currency || 'ARS', maximumFractionDigits: 2 }).format(value);
    } catch (_) {
      return `$ ${Number(value).toFixed(2)}`;
    }
  }

  function saveCart() {
    localStorage.setItem(storageKey, JSON.stringify([...state.cart.entries()]));
  }

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || '[]');
      state.cart = new Map(raw.map(([id, qty]) => [Number(id), Number(qty)]).filter(([, qty]) => qty > 0));
    } catch (_) {
      state.cart = new Map();
    }
  }

  function productById(id) { return state.offerings.find((item) => Number(item.id) === Number(id)); }

  function cartTotal() {
    let total = 0;
    state.cart.forEach((qty, id) => { const p = productById(id); if (p) total += Number(p.price) * qty; });
    return total;
  }

  function renderCatalog() {
    catalog.replaceChildren();
    const query = state.search.trim().toLocaleLowerCase('es');
    const rows = state.offerings.filter((item) => {
      if (state.filter !== 'all' && item.type !== state.filter) return false;
      if (!query) return true;
      return `${item.name} ${item.description || ''}`.toLocaleLowerCase('es').includes(query);
    });

    status.textContent = rows.length ? `${rows.length} ${rows.length === 1 ? 'opción' : 'opciones'}` : 'No encontramos coincidencias.';

    rows.forEach((item) => {
      const card = document.createElement('article'); card.className = 'product';
      const media = document.createElement('div'); media.className = 'product-media';
      if (item.image_url) {
        const img = document.createElement('img'); img.src = item.image_url; img.alt = item.name; img.loading = 'lazy';
        img.addEventListener('error', () => { media.replaceChildren(makePlaceholder(item.name)); }); media.append(img);
      } else media.append(makePlaceholder(item.name));

      const body = document.createElement('div'); body.className = 'product-body';
      const type = document.createElement('div'); type.className = 'product-type'; type.textContent = item.type === 'service' ? 'Servicio' : 'Producto';
      const title = document.createElement('h3'); title.textContent = item.name;
      const desc = document.createElement('p'); desc.className = 'product-desc'; desc.textContent = item.description || 'Sin descripción.';
      const foot = document.createElement('div'); foot.className = 'product-foot';
      const price = document.createElement('div'); price.className = 'price';
      const strong = document.createElement('strong'); strong.textContent = money(Number(item.price));
      const small = document.createElement('small'); small.textContent = item.unit ? `por ${item.unit}` : 'precio unitario'; price.append(strong, small);
      const add = document.createElement('button'); add.className = 'add-button'; add.type = 'button'; add.textContent = 'Agregar';
      add.addEventListener('click', () => changeQty(item.id, 1));
      foot.append(price, add); body.append(type, title, desc, foot); card.append(media, body); catalog.append(card);
    });
  }

  function makePlaceholder(name) {
    const el = document.createElement('span'); el.className = 'placeholder'; el.textContent = String(name || '?').slice(0, 1).toUpperCase(); return el;
  }

  function changeQty(id, delta) {
    const current = state.cart.get(Number(id)) || 0;
    const next = Math.max(0, current + delta);
    if (next === 0) state.cart.delete(Number(id)); else state.cart.set(Number(id), next);
    saveCart(); renderCart();
  }

  function renderCart() {
    cartItems.replaceChildren();
    let count = 0;
    state.cart.forEach((qty, id) => {
      const item = productById(id);
      if (!item) { state.cart.delete(id); return; }
      count += qty;
      const row = document.createElement('div'); row.className = 'cart-item';
      const left = document.createElement('div');
      const name = document.createElement('strong'); name.textContent = item.name;
      const subtotal = document.createElement('small'); subtotal.textContent = `${money(Number(item.price))} · ${money(Number(item.price) * qty)}`;
      const controls = document.createElement('div'); controls.className = 'qty';
      const minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '−'; minus.addEventListener('click', () => changeQty(id, -1));
      const number = document.createElement('span'); number.textContent = String(qty);
      const plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+'; plus.addEventListener('click', () => changeQty(id, 1));
      controls.append(minus, number, plus); left.append(name, subtotal, controls);
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove'; remove.textContent = 'Quitar'; remove.addEventListener('click', () => { state.cart.delete(Number(id)); saveCart(); renderCart(); });
      row.append(left, remove); cartItems.append(row);
    });
    saveCart();
    $('cartCount').textContent = String(count);
    $('cartTotal').textContent = money(cartTotal());
    $('checkoutTotal').textContent = money(cartTotal());
    cartEmpty.hidden = state.cart.size > 0;
    checkoutButton.disabled = state.cart.size === 0;
  }

  function openCart() { cartDrawer.classList.add('open'); cartDrawer.setAttribute('aria-hidden', 'false'); backdrop.classList.add('show'); }
  function closeCart() { cartDrawer.classList.remove('open'); cartDrawer.setAttribute('aria-hidden', 'true'); backdrop.classList.remove('show'); }

  async function loadCatalog() {
    if (!API_BASE || !ORG || ORG === 'TU_SLUG') {
      status.textContent = 'Falta configurar ORGANIZATION_SLUG en config.js.'; return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/storefront/${encodeURIComponent(ORG)}/catalog`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json(); state.store = data.store || state.store; state.offerings = Array.isArray(data.offerings) ? data.offerings : [];
      document.title = state.store.name || 'Tienda'; $('storeName').textContent = state.store.name || 'Tienda'; $('footerStore').textContent = state.store.name || 'Tienda'; $('headline').textContent = state.store.headline || 'Productos y servicios';
      renderCatalog(); renderCart();
    } catch (error) {
      status.textContent = 'No se pudo cargar el catálogo. Revisá la URL del backend, el slug y CORS.';
      console.error(error);
    }
  }

  async function sendOrder() {
    formMessage.className = 'form-message'; formMessage.textContent = '';
    if (!state.cart.size) return;
    const form = $('checkoutForm'); const data = new FormData(form);
    const email = String(data.get('customer_email') || '').trim(); const phone = String(data.get('customer_phone') || '').trim();
    if (!form.reportValidity()) return;
    if (!email && !phone) { formMessage.classList.add('error'); formMessage.textContent = 'Ingresá email o teléfono.'; return; }
    const payload = {
      customer_name: String(data.get('customer_name') || '').trim(), customer_email: email || null, customer_phone: phone || null,
      notes: String(data.get('notes') || '').trim() || null,
      items: [...state.cart.entries()].map(([offering_id, quantity]) => ({ offering_id, quantity })),
    };
    sendOrderButton.disabled = true; sendOrderButton.textContent = 'Enviando…';
    try {
      const response = await fetch(`${API_BASE}/api/storefront/${encodeURIComponent(ORG)}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const first = result?.errors ? Object.values(result.errors).flat()[0] : result.message;
        throw new Error(first || 'No se pudo enviar el pedido.');
      }
      state.cart.clear(); saveCart(); renderCart(); form.reset();
      formMessage.classList.add('success'); formMessage.textContent = `Pedido enviado. Código ${String(result.order_id || '').slice(0, 8)}.`;
    } catch (error) {
      formMessage.classList.add('error'); formMessage.textContent = error.message || 'No se pudo enviar el pedido.';
    } finally { sendOrderButton.disabled = false; sendOrderButton.textContent = 'Enviar pedido'; }
  }

  $('cartButton').addEventListener('click', openCart); $('closeCart').addEventListener('click', closeCart); backdrop.addEventListener('click', closeCart);
  checkoutButton.addEventListener('click', () => { closeCart(); checkoutDialog.showModal(); });
  $('closeCheckout').addEventListener('click', () => checkoutDialog.close());
  $('checkoutForm').addEventListener('submit', (event) => { event.preventDefault(); sendOrder(); });
  sendOrderButton.addEventListener('click', sendOrder);
  $('searchInput').addEventListener('input', (event) => { state.search = event.target.value; renderCatalog(); });
  document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('.filter').forEach((b) => b.classList.remove('active')); button.classList.add('active'); state.filter = button.dataset.filter; renderCatalog(); }));
  loadCart(); renderCart(); loadCatalog();
})();
