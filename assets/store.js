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
    knownProducts: new Map(),
    search: '',
    category: 'all',
    sort: 'name_asc',
    availability: 'all',
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
  const productDialog = $('productDialog');
  const productDialogContent = $('productDialogContent');
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
    // Keep only selected-product snapshots so the cart survives catalog filters and reloads.
    const selected = [...state.cart.keys()]
      .map(id => productById(id))
      .filter(Boolean)
      .map(({ id, name, price, unit }) => ({ id, name, price, unit }));
    localStorage.setItem(`${storageKey}:products`, JSON.stringify(selected));
  }

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || '[]');
      state.cart = new Map(raw.map(([id, qty]) => [Number(id), Number(qty)]).filter(([id, qty]) => Number.isFinite(id) && Number.isFinite(qty) && qty > 0));
      const cached = JSON.parse(localStorage.getItem(`${storageKey}:products`) || '[]');
      if (Array.isArray(cached)) cached.forEach(item => {
        if (Number.isFinite(Number(item.id))) state.knownProducts.set(Number(item.id), item);
      });
    } catch (_) {
      state.cart = new Map();
    }
  }

  function productById(id) {
    return state.offerings.find(item => Number(item.id) === Number(id))
      || state.knownProducts.get(Number(id));
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

  function renderProductActions(actions, item) {
    actions.replaceChildren();
    const qty = state.cart.get(Number(item.id)) || 0;
    actions.classList.toggle('has-quantity', qty > 0);

    if (item.available === false) {
      const unavailable = document.createElement('button');
      unavailable.className = 'add-button';
      unavailable.type = 'button';
      unavailable.disabled = true;
      unavailable.textContent = 'No disponible';
      actions.append(unavailable);
      return;
    }

    if (!qty) {
      const add = document.createElement('button');
      add.className = 'add-button';
      add.type = 'button';
      add.textContent = '+ Agregar';
      add.setAttribute('aria-label', `Agregar ${item.name} al pedido`);
      add.addEventListener('click', () => changeQty(item.id, 1));
      actions.append(add);
      return;
    }

    const minus = document.createElement('button');
    minus.className = 'product-qty-button';
    minus.type = 'button';
    minus.textContent = '−';
    minus.setAttribute('aria-label', `Quitar una unidad de ${item.name}`);
    minus.addEventListener('click', () => changeQty(item.id, -1));

    const count = document.createElement('span');
    count.className = 'product-qty-count';
    count.textContent = String(qty);
    count.setAttribute('aria-label', `${qty} unidades de ${item.name} en el pedido`);

    const plus = document.createElement('button');
    plus.className = 'product-qty-button';
    plus.type = 'button';
    plus.textContent = '+';
    plus.setAttribute('aria-label', `Agregar otra unidad de ${item.name}`);
    plus.addEventListener('click', () => changeQty(item.id, 1));
    actions.append(minus, count, plus);
  }

  function syncCatalogQuantities() {
    catalog.querySelectorAll('[data-product-actions]').forEach(actions => {
      const item = productById(actions.dataset.productActions);
      if (!item) return;
      renderProductActions(actions, item);
      actions.closest('.product')?.classList.toggle('in-order', (state.cart.get(Number(item.id)) || 0) > 0);
    });
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

    rows.forEach(item => {
      const card = document.createElement('article');
      card.className = 'product';
      card.classList.toggle('in-order', (state.cart.get(Number(item.id)) || 0) > 0);

      // Preview and purchase controls are separate: tapping Add never opens the detail.
      const preview = document.createElement('button');
      preview.className = 'product-preview';
      preview.type = 'button';
      preview.setAttribute('aria-label', `Ver detalles de ${item.name}`);
      preview.addEventListener('click', () => openProduct(item));

      const media = document.createElement('div');
      media.className = 'product-media';
      if (item.image_url) {
        const img = document.createElement('img');
        img.src = item.image_url;
        img.alt = item.name;
        img.loading = 'lazy';
        img.addEventListener('error', () => img.replaceWith(makePlaceholder(item.name)));
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
      preview.append(media);

      const body = document.createElement('div');
      body.className = 'product-body';
      const meta = document.createElement('div');
      meta.className = 'product-meta';
      const category = document.createElement('span');
      category.className = 'product-type';
      category.textContent = item.category?.name || (item.type === 'service' ? 'Servicio' : 'Producto');
      meta.append(category);

      const title = document.createElement('h3');
      const titleButton = document.createElement('button');
      titleButton.className = 'product-title-button';
      titleButton.type = 'button';
      titleButton.textContent = item.name;
      titleButton.addEventListener('click', () => openProduct(item));
      title.append(titleButton);

      const desc = item.description?.trim() ? document.createElement('p') : null;
      if (desc) {
        desc.className = 'product-desc';
        desc.textContent = item.description.trim();
      }

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

      const actions = document.createElement('div');
      actions.className = 'product-actions';
      actions.dataset.productActions = String(item.id);
      renderProductActions(actions, item);

      foot.append(price, actions);
      body.append(meta, title);
      if (desc) body.append(desc);
      body.append(foot);
      card.append(preview, body);
      catalog.append(card);
    });

    loadMoreButton.hidden = !state.hasMore || state.loading;
  }

  function openProduct(item) {
    productDialogContent.replaceChildren();

    const layout = document.createElement('div');
    layout.className = 'product-detail-grid';

    const visual = document.createElement('div');
    visual.className = 'product-detail-media';
    if (item.image_url) {
      const img = document.createElement('img');
      img.src = item.image_url;
      img.alt = item.name;
      img.addEventListener('error', () => img.replaceWith(makePlaceholder(item.name)));
      visual.append(img);
    } else {
      visual.append(makePlaceholder(item.name));
    }

    const info = document.createElement('div');
    info.className = 'product-detail-info';

    const meta = document.createElement('div');
    meta.className = 'product-meta';
    const category = document.createElement('span');
    category.className = 'product-type';
    category.textContent = item.category?.name || 'Producto';
    meta.append(category);

    const title = document.createElement('h2');
    title.textContent = item.name;

    const desc = item.description?.trim() ? document.createElement('p') : null;
    if (desc) {
      desc.className = 'product-detail-description';
      desc.textContent = item.description.trim();
    }

    const price = document.createElement('div');
    price.className = 'product-detail-price';
    if (item.list_price != null && Number(item.list_price) > Number(item.price)) {
      const old = document.createElement('small');
      old.className = 'old-price';
      old.textContent = money(Number(item.list_price));
      price.append(old);
    }
    const strong = document.createElement('strong');
    strong.textContent = money(Number(item.price));
    price.append(strong);

    const availability = document.createElement('p');
    availability.className = item.available === false ? 'detail-stock unavailable-text' : 'detail-stock';
    availability.textContent = item.available === false ? 'No disponible' : 'Disponible';

    const add = document.createElement('button');
    add.className = 'checkout-button detail-add';
    add.type = 'button';
    add.disabled = item.available === false;
    add.textContent = item.available === false ? 'No disponible' : 'Agregar al pedido';
    add.addEventListener('click', () => {
      changeQty(item.id, 1);
      productDialog.close();
      openCart();
    });

    info.append(meta, title);
    if (desc) info.append(desc);
    info.append(price, availability, add);
    layout.append(visual, info);
    productDialogContent.append(layout);
    productDialog.showModal();
  }

  function makePlaceholder(name) {
    const el = document.createElement('span');
    el.className = 'placeholder';
    el.textContent = String(name || '?').slice(0, 1).toUpperCase();
    return el;
  }

  function renderCategories() {
    if (!categoryFilters) return;
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
    syncCatalogQuantities();
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
      available: state.availability
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
      incoming.forEach(item => state.knownProducts.set(Number(item.id), item));
      if (state.cart.size) saveCart();
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
      const heroCount = $('heroCount');
      if (heroCount) heroCount.textContent = new Intl.NumberFormat('es-AR').format(state.total);

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
      const emailText = result.email_sent ? ' · enviado por email' : '';
      formMessage.replaceChildren();
      const text = document.createElement('span');
      text.textContent = `Pedido recibido. Código ${String(result.order_id || '').slice(0, 8)}${finalTotal}${customerPricing}${emailText}.`;
      formMessage.append(text);
      if (result.whatsapp_url) {
        const link = document.createElement('a');
        link.className = 'whatsapp-order-link';
        link.href = result.whatsapp_url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'Enviar también por WhatsApp';
        formMessage.append(document.createElement('br'), link);
      }
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
  $('closeProductDialog').addEventListener('click', () => productDialog.close());
  productDialog.addEventListener('click', e => {
    if (e.target === productDialog) productDialog.close();
  });
  $('checkoutForm').addEventListener('submit', e => { e.preventDefault(); sendOrder(); });
  sendOrderButton.addEventListener('click', sendOrder);
  $('searchInput').addEventListener('input', e => {
    state.search = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadCatalog({ reset: true }), 280);
  });
  const sortSelect = $('sortSelect');
  if (sortSelect) sortSelect.addEventListener('change', e => {
    state.sort = e.target.value;
    loadCatalog({ reset: true });
  });
  const availabilitySelect = $('availabilitySelect');
  if (availabilitySelect) availabilitySelect.addEventListener('change', e => {
    state.availability = e.target.value;
    loadCatalog({ reset: true });
  });
  if (categoryFilters) categoryFilters.addEventListener('click', e => {
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