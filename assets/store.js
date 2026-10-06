(() => {
  'use strict';

  const config = window.DATALISTING_STORE || {};
  const API_BASE = String(config.API_BASE_URL || '').replace(/\/$/, '');
  const ORG = String(config.ORGANIZATION_SLUG || '');
  const state = {
    store: { currency: 'ARS', name: 'Tienda' },
    offerings: [],
    categories: [],
    cart: new Map(),
    search: '',
    category: 'all',
    sort: 'name_asc',
    page: 1,
    perPage: 24,
    hasMore: false,
    total: 0,
    serverPaging: false,
    loading: false,
  };

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
  const categoryFilters = $('categoryFilters');
  const loadMoreButton = $('loadMoreButton');
  const storageKey = `datalisting-cart:${ORG}`;

  function money(value) {
    try {
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: state.store.currency || 'ARS',
        maximumFractionDigits: 2
      }).format(value);
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

  function productById(id) {
    return state.offerings.find((item) => Number(item.id) === Number(id));
  }

  function cartTotal() {
    let total = 0;
    state.cart.forEach((qty, id) => {
      const p = productById(id);
      if (p) total += Number(p.price) * qty;
    });
    return total;
  }

  function filteredLocalRows() {
    let rows = [...state.offerings];
    if (!state.serverPaging) {
      const q = state.search.trim().toLocaleLowerCase('es');
      if (q) rows = rows.filter(item =>
        `${item.name} ${item.description || ''}`.toLocaleLowerCase('es').includes(q)
      );
      if (state.category !== 'all') {
        rows = rows.filter(item => item.category?.slug === state.category || String(item.category?.id || '') === state.category);
      }
      rows.sort((a, b) => {
        if (state.sort === 'price_asc') return Number(a.price) - Number(b.price);
        if (state.sort === 'price_desc') return Number(b.price) - Number(a.price);
        const cmp = String(a.name).localeCompare(String(b.name), 'es', { sensitivity: 'base' });
        return state.sort === 'name_desc' ? -cmp : cmp;
      });
    }
    return rows;
  }

  function renderCatalog() {
    catalog.replaceChildren();
    const rows = filteredLocalRows();
    const shown = rows.length;
    const total = state.serverPaging ? state.total : shown;
    status.textContent = state.loading
      ? 'Actualizando catálogo…'
      : total
        ? `${shown} de ${total} ${total === 1 ? 'producto' : 'productos'}`
        : 'No encontramos coincidencias.';

    rows.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'product';

      const media = document.createElement('div');
      media.className = 'product-media';
      if (item.image_url) {
        const img = document.createElement('img');
        img.src = item.image_url;
        img.alt = item.name;
        img.loading = 'lazy';
        img.addEventListener('error', () => media.replaceChildren(makePlaceholder(item.name)));
        media.append(img);
      } else {
        media.append(makePlaceholder(item.name));
      }

      if (item.available === false) {
        const stock = document.createElement('span');
        stock.className = 'availability unavailable';
        stock.textContent = 'No disponible';
        media.append(stock);
      }

      const body = document.createElement('div');
      body.className = 'product-body';

      const meta = document.createElement('div');
      meta.className = 'product-meta';
      const category = document.createElement('span');
      category.className = 'product-type';
      category.textContent = item.category?.name || (item.type === 'service' ? 'Servicio' : 'Producto');
      meta.append(category);
      if (item.source) {
        const source = document.createElement('span');
        source.className = 'source-tag';
        source.textContent = String(item.source).toUpperCase();
        meta.append(source);
      }

      const title = document.createElement('h3');
      title.textContent = item.name;
      const desc = document.createElement('p');
      desc.className = 'product-desc';
      desc.textContent = item.description || 'Sin descripción.';

      const foot = document.createElement('div');
      foot.className = 'product-foot';
      const price = document.createElement('div');
      price.className = 'price';
      if (item.list_price != null && Number(item.list_price) > Number(item.price)) {
        const old = document.createElement('small');
        old.className = 'old-price';
        old.textContent = money(Number(item.list_price));
        price.append(old);
      }
      const strong = document.createElement('strong');
      strong.textContent = money(Number(item.price));
      const small = document.createElement('small');
      small.textContent = item.unit ? `por ${item.unit}` : 'precio unitario';
      price.append(strong, small);

      const add = document.createElement('button');
      add.className = 'add-button';
      add.type = 'button';
      add.textContent = item.available === false ? 'No disponible' : 'Agregar';
      add.disabled = item.available === false;
      add.addEventListener('click', () => changeQty(item.id, 1));

      foot.append(price, add);
      body.append(meta, title, desc, foot);
      card.append(media, body);
      catalog.append(card);
    });

    loadMoreButton.hidden = !state.hasMore || state.loading;
  }

  function makePlaceholder(name) {
    const el = document.createElement('span');
    el.className = 'placeholder';
    el.textContent = String(name || '?').slice(0, 1).toUpperCase();
    return el;
  }

  function renderCategories() {
    categoryFilters.replaceChildren();
    const all = document.createElement('button');
    all.className = `filter ${state.category === 'all' ? 'active' : ''}`;
    all.dataset.category = 'all';
    all.type = 'button';
    all.textContent = 'Todos';
    categoryFilters.append(all);

    state.categories.forEach(c => {
      const b = document.createElement('button');
      b.className = `filter ${state.category === c.slug ? 'active' : ''}`;
      b.dataset.category = c.slug;
      b.type = 'button';
      b.textContent = c.name;
      categoryFilters.append(b);
    });
  }

  function changeQty(id, delta) {
    const current = state.cart.get(Number(id)) || 0;
    const next = Math.max(0, current + delta);
    if (next === 0) state.cart.delete(Number(id));
    else state.cart.set(Number(id), next);
    saveCart();
    renderCart();
  }

  function renderCart() {
    cartItems.replaceChildren();
    let count = 0;
    state.cart.forEach((qty, id) => {
      const item = productById(id);
      if (!item) return;
      count += qty;
      const row = document.createElement('div');
      row.className = 'cart-item';
      const left = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = item.name;
      const subtotal = document.createElement('small');
      subtotal.textContent = `${money(Number(item.price))} · ${money(Number(item.price) * qty)}`;
      const controls = document.createElement('div');
      controls.className = 'qty';
      const minus = document.createElement('button');
      minus.type = 'button'; minus.textContent = '−';
      minus.addEventListener('click', () => changeQty(id, -1));
      const number = document.createElement('span');
      number.textContent = String(qty);
      const plus = document.createElement('button');
      plus.type = 'button'; plus.textContent = '+';
      plus.addEventListener('click', () => changeQty(id, 1));
      controls.append(minus, number, plus);
      left.append(name, subtotal, controls);
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'remove'; remove.textContent = 'Quitar';
      remove.addEventListener('click', () => {
        state.cart.delete(Number(id));
        saveCart();
        renderCart();
      });
      row.append(left, remove);
      cartItems.append(row);
    });
    $('cartCount').textContent = String(count);
    $('cartTotal').textContent = money(cartTotal());
    $('checkoutTotal').textContent = money(cartTotal());
    cartEmpty.hidden = count > 0;
    checkoutButton.disabled = count === 0;
  }

  function openCart() {
    cartDrawer.classList.add('open');
    cartDrawer.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('show');
  }
  function closeCart() {
    cartDrawer.classList.remove('open');
    cartDrawer.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('show');
  }

  async function loadCatalog({ reset = true } = {}) {
    if (!API_BASE || !ORG || ORG === 'TU_SLUG') {
      status.textContent = 'Falta configurar ORGANIZATION_SLUG en config.js.';
      return;
    }
    if (state.loading) return;
    state.loading = true;
    if (reset) {
      state.page = 1;
      state.offerings = [];
    }
    renderCatalog();

    const params = new URLSearchParams({
      page: String(state.page),
      per_page: String(state.perPage),
      sort: state.sort,
      available: '1'
    });
    if (state.search.trim()) params.set('search', state.search.trim());
    if (state.category !== 'all') params.set('category', state.category);

    try {
      const response = await fetch(`${API_BASE}/api/storefront/${encodeURIComponent(ORG)}/catalog?${params}`, {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      state.store = data.store || state.store;
      const incoming = Array.isArray(data.offerings) ? data.offerings : [];
      state.serverPaging = Boolean(data.pagination);
      state.offerings = reset ? incoming : [...state.offerings, ...incoming.filter(x => !state.offerings.some(y => Number(y.id) === Number(x.id)))];
      state.categories = Array.isArray(data.categories) ? data.categories : state.categories;
      if (!state.categories.length) {
        const derived = new Map();
        state.offerings.forEach(x => { if (x.category?.slug) derived.set(x.category.slug, x.category); });
        state.categories = [...derived.values()];
      }
      state.total = data.pagination?.total ?? state.offerings.length;
      state.hasMore = data.pagination?.has_more ?? false;

      document.title = state.store.name || 'Tienda';
      $('storeName').textContent = state.store.name || 'Tienda';
      $('footerStore').textContent = state.store.name || 'Tienda';
      $('headline').textContent = state.store.headline || 'Productos y servicios';

      renderCategories();
      renderCatalog();
      renderCart();
    } catch (error) {
      status.textContent = 'No se pudo cargar el catálogo. Revisá el backend o intentá nuevamente.';
      console.error(error);
    } finally {
      state.loading = false;
      renderCatalog();
    }
  }

  async function sendOrder() {
    formMessage.className = 'form-message';
    formMessage.textContent = '';
    if (!state.cart.size) return;
    const form = $('checkoutForm');
    const data = new FormData(form);
    const email = String(data.get('customer_email') || '').trim();
    const phone = String(data.get('customer_phone') || '').trim();
    if (!form.reportValidity()) return;
    if (!email && !phone) {
      formMessage.classList.add('error');
      formMessage.textContent = 'Ingresá email o teléfono.';
      return;
    }
    const payload = {
      customer_name: String(data.get('customer_name') || '').trim(),
      customer_email: email || null,
      customer_phone: phone || null,
      notes: String(data.get('notes') || '').trim() || null,
      items: [...state.cart.entries()].map(([offering_id, quantity]) => ({ offering_id, quantity })),
    };
    sendOrderButton.disabled = true;
    sendOrderButton.textContent = 'Enviando…';
    try {
      const response = await fetch(`${API_BASE}/api/storefront/${encodeURIComponent(ORG)}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const first = result?.errors ? Object.values(result.errors).flat()[0] : result.message;
        throw new Error(first || 'No se pudo enviar el pedido.');
      }
      state.cart.clear();
      saveCart();
      renderCart();
      form.reset();
      formMessage.classList.add('success');
      const finalTotal = result.total != null ? ` · total confirmado ${money(Number(result.total))}` : '';
      const customerPricing = result.customer_pricing_applied ? ' · se aplicó tu condición comercial' : '';
      formMessage.textContent = `Pedido enviado. Código ${String(result.order_id || '').slice(0, 8)}${finalTotal}${customerPricing}.`;
    } catch (error) {
      formMessage.classList.add('error');
      formMessage.textContent = error.message || 'No se pudo enviar el pedido.';
    } finally {
      sendOrderButton.disabled = false;
      sendOrderButton.textContent = 'Enviar pedido';
    }
  }

  let searchTimer;
  $('cartButton').addEventListener('click', openCart);
  $('closeCart').addEventListener('click', closeCart);
  backdrop.addEventListener('click', closeCart);
  checkoutButton.addEventListener('click', () => { closeCart(); checkoutDialog.showModal(); });
  $('closeCheckout').addEventListener('click', () => checkoutDialog.close());
  $('checkoutForm').addEventListener('submit', e => { e.preventDefault(); sendOrder(); });
  sendOrderButton.addEventListener('click', sendOrder);
  $('searchInput').addEventListener('input', e => {
    state.search = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadCatalog({ reset: true }), 280);
  });
  $('sortSelect').addEventListener('change', e => {
    state.sort = e.target.value;
    loadCatalog({ reset: true });
  });
  categoryFilters.addEventListener('click', e => {
    const button = e.target.closest('[data-category]');
    if (!button) return;
    state.category = button.dataset.category;
    loadCatalog({ reset: true });
  });
  loadMoreButton.addEventListener('click', () => {
    state.page += 1;
    loadCatalog({ reset: false });
  });

  loadCart();
  renderCart();
  loadCatalog({ reset: true });
})();