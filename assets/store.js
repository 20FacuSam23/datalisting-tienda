(() => {
  'use strict';

  const config = window.DATALISTING_STORE || {};

  // Datalisting storefront privacy guard.
  // Web browsers cannot fully block OS screenshots, but this reduces accidental capture/copy/print.
  const privacyShield = document.getElementById('privacyShield');

  function setPrivacyHidden(hidden) {
    document.body.classList.toggle('privacy-hidden', Boolean(hidden));
    if (privacyShield) {
      privacyShield.setAttribute('aria-hidden', hidden ? 'false' : 'true');
    }
  }

  window.addEventListener('blur', () => setPrivacyHidden(true));
  window.addEventListener('focus', () => setPrivacyHidden(false));
  document.addEventListener('visibilitychange', () => {
    setPrivacyHidden(document.hidden);
  });

  document.addEventListener('contextmenu', (event) => {
    if (!event.target.closest('input, textarea')) event.preventDefault();
  });

  document.addEventListener('copy', (event) => {
    if (!event.target.closest('input, textarea')) event.preventDefault();
  });

  document.addEventListener('cut', (event) => {
    if (!event.target.closest('input, textarea')) event.preventDefault();
  });

  window.addEventListener('beforeprint', () => setPrivacyHidden(true));
  window.addEventListener('afterprint', () => setPrivacyHidden(false));

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'p') {
      event.preventDefault();
      setPrivacyHidden(true);
      setTimeout(() => setPrivacyHidden(false), 900);
    }
  });

  const API_BASE = String(config.API_BASE_URL || '').replace(/\/$/, '');
  const query=new URLSearchParams(location.search);const portal=query.get('portal')||config.PORTAL_SLUG;const selectedOrg=query.get('org');
  const ORG = String(selectedOrg&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(selectedOrg)?selectedOrg:(config.ORGANIZATION_SLUG || ''));
  const ENDPOINT=portal&&!selectedOrg?`${API_BASE}/api/portales/${encodeURIComponent(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(portal)?portal:'tienda-generica')}`:`${API_BASE}/api/storefront/${encodeURIComponent(ORG)}`;
  if(portal&&!selectedOrg)fetch(`${API_BASE}/api/portales/${encodeURIComponent(portal)}/brand`).then(r=>r.ok?r.json():null).then(d=>{if(d?.hosted_url&&location.hostname.endsWith('github.io'))location.replace(d.hosted_url);}).catch(()=>{});
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
  const storageKey = `datalisting-cart:${portal&&!selectedOrg?portal:ORG}`;

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
    let cents=0;const eligible=[];let count=0;
    state.cart.forEach((qty,id)=>{const p=productById(id);if(!p)return;const price=Math.round(Number(p.price)*100);cents+=price*qty;if((p.type||'product')==='product'&&Number.isInteger(qty)&&qty>0){eligible.push({price,qty});count+=qty;}});
    const promo=state.store.promotion;if(!promo||(promo.ends_at&&Date.now()>Date.parse(promo.ends_at)))return cents/100;
    if(count===2)cents-=eligible.reduce((sum,p)=>sum+Math.round(p.price*p.qty*Number(promo.two_discount_percent||0)/100),0);
    else if(promo.buy_three_pay_two){let free=Math.floor(count/3);for(const p of eligible.sort((a,b)=>a.price-b.price)){const n=Math.min(free,p.qty);cents-=n*p.price;free-=n;}}
    return Math.max(0,cents/100);
  }
  function renderPromotion(){
    const box=$('promotionBuilder');if(!box)return;const p=state.store.promotion;box.hidden=!p;if(!p)return;
    box.replaceChildren();const title=document.createElement('h2');title.textContent=p.title;box.append(title);const note=document.createElement('p');note.textContent=[p.buy_three_pay_two?'Llevando 3, pagás 2 · gratis los de menor precio':null,p.two_discount_percent?`Llevando 2, ${p.two_discount_percent}% de descuento`:null].filter(Boolean).join(' · ');box.append(note);
    if(p.ends_at){const end=document.createElement('small');end.textContent='Vigente hasta '+new Date(p.ends_at).toLocaleString('es-AR');box.append(end);}
    const options=document.createElement('div');options.className='promotion-options';const fields=document.createElement('div');let selected=1;
    const renderFields=()=>{fields.replaceChildren();for(let i=0;i<selected;i++){const label=document.createElement('label');label.textContent='Producto '+(i+1);const select=document.createElement('select');select.required=true;select.append(new Option('Seleccionar producto',''));state.offerings.filter(x=>x.available!==false&&(x.type||'product')==='product').forEach(item=>select.append(new Option(item.name+' · '+money(Number(item.price)),item.id)));label.append(select);fields.append(label);}};
    [1,2,3].forEach(n=>{const button=document.createElement('button');button.type='button';button.textContent=n+' '+(n===1?'producto':'productos');button.setAttribute('aria-pressed',String(n===1));button.onclick=()=>{selected=n;options.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderFields();};options.append(button);});
    const add=document.createElement('button');add.type='button';add.className='primary-link';add.textContent='Agregar selección al pedido';add.onclick=()=>{const selections=[...fields.querySelectorAll('select')];if(selections.some(e=>!e.value)){selections.find(e=>!e.value).reportValidity();return;}for(const e of selections){const id=Number(e.value);state.cart.set(id,(state.cart.get(id)||0)+1);}saveCart();renderCart();openCart();};box.append(options,fields,add);renderFields();
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
      if(state.availability==='available')rows=rows.filter(i=>i.available!==false);
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
    if(config.CATALOG_READ_ONLY||state.store.catalog_read_only){const label=document.createElement('span');label.textContent=item.available===false?'No disponible':'Catálogo de consulta';actions.append(label);return;}
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
    const allRows = filteredLocalRows();
    const rows = state.serverPaging?allRows:allRows.slice(0,state.page*state.perPage);
    if(!state.serverPaging)state.hasMore=rows.length<allRows.length;
    const shown = rows.length;
    const total = state.serverPaging ? state.total : allRows.length;
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
    add.disabled = item.available === false || !!config.CATALOG_READ_ONLY || !!state.store.catalog_read_only;
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
    checkoutButton.disabled = count === 0 || !!state.store.catalog_read_only || !!config.CATALOG_READ_ONLY;
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
    if (!API_BASE || (!portal&&(!ORG || ORG === 'TU_SLUG'))) {
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
      let response;try{response = await fetch(`${ENDPOINT}/catalog?${params}`, {
        headers: { Accept: 'application/json',...(portal&&sessionStorage.getItem('store-owner-'+portal)?{Authorization:'Bearer '+sessionStorage.getItem('store-owner-'+portal)}:{}) }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      }catch(error){if(!config.CATALOG_SNAPSHOT)throw error;response=await fetch(config.CATALOG_SNAPSHOT,{cache:'no-store'});if(!response.ok)throw Error('No se pudo cargar la última consulta del catálogo.');}
      let data = await response.json();
      if(config.CATALOG_SNAPSHOT&&(!Array.isArray(data.offerings)||!data.offerings.length)){const fallback=await fetch(config.CATALOG_SNAPSHOT,{cache:'no-store'});if(fallback.ok)data=await fallback.json();}
      if(data.hosted_url&&location.hostname.endsWith('github.io')){location.replace(data.hosted_url);return;}state.store = data.store || state.store;if(data.snapshot)state.store={...state.store,catalog_read_only:true};if(config.BRAND_NAME){state.store={...state.store,name:config.BRAND_NAME,headline:config.BRAND_HEADLINE||state.store.headline,logo_url:config.BRAND_LOGO_URL||null};const mark=document.querySelector('.brand-mark');if(mark)mark.textContent=config.BRAND_INITIAL||config.BRAND_NAME.slice(0,1);const tagline=document.querySelector('.brand small');if(tagline&&config.BRAND_TAGLINE)tagline.textContent=config.BRAND_TAGLINE;}if(data.demo){const b=document.querySelector('.store-announcement');if(b)b.textContent='Tienda de demostración · Pedidos simulados · Sin cobros reales';}
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

      document.title = state.store.name || 'Tienda';if(/^https:\/\//.test(state.store.logo_url||'')){let logo=document.getElementById('storeLogo');if(!logo){logo=document.createElement('img');logo.id='storeLogo';logo.className='store-logo';logo.alt='Logotipo';document.querySelector('.brand').prepend(logo);}logo.src=state.store.logo_url;}
      $('storeName').textContent = state.store.name || 'Tienda';
      $('footerStore').textContent = state.store.name || 'Tienda';
      if($('headline'))$('headline').textContent = state.store.headline || 'Productos y servicios';

      if(/^#[0-9a-f]{6}$/i.test(state.store.brand_color||''))document.documentElement.style.setProperty('--store-accent',state.store.brand_color);
      if(portal==='nutrigo-parana'){const banner=document.querySelector('.store-announcement');if(banner){const date=state.store.last_synced_at?new Date(state.store.last_synced_at).toLocaleString('es-AR'):'';banner.textContent=(data.snapshot?'Última consulta del catálogo':'Catálogo actualizado')+(date?' · '+date:'')+(state.store.catalog_read_only||config.CATALOG_READ_ONLY?' · Solo consulta':' · Armá tu pedido');}}
      renderPromotion();
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
      const response = await fetch(`${ENDPOINT}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json',...(portal&&sessionStorage.getItem('store-owner-'+portal)?{Authorization:'Bearer '+sessionStorage.getItem('store-owner-'+portal)}:{}) },
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
      const emailText = result.email_sent ? ' · enviado por email' : '';const pendingText=!result.simulated&&!result.email_sent?' El pedido quedó registrado para revisión; el pago aún no se realizó.':'';
      formMessage.replaceChildren();
      const text = document.createElement('span');
      text.textContent = `${result.simulated?'Pedido de demostración registrado. No se realizó ningún cobro.':'Pedido recibido.'} Código ${String(result.order_id || '').slice(0, 8)}${finalTotal}${customerPricing}${emailText}.${pendingText}`;
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

  function refreshCatalog(){if(state.offerings.length&&!state.serverPaging){state.page=1;renderCatalog();}else loadCatalog({reset:true});}
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
    searchTimer = setTimeout(() => refreshCatalog(), 280);
  });
  const sortSelect = $('sortSelect');
  if (sortSelect) sortSelect.addEventListener('change', e => {
    state.sort = e.target.value;
    refreshCatalog();
  });
  const availabilitySelect = $('availabilitySelect');
  if (availabilitySelect) availabilitySelect.addEventListener('change', e => {
    state.availability = e.target.value;
    refreshCatalog();
  });
  if (categoryFilters) categoryFilters.addEventListener('click', e => {
    const button = e.target.closest('[data-category]');
    if (!button) return;
    state.category = button.dataset.category;
    refreshCatalog();
  });
  loadMoreButton.addEventListener('click', () => {
    state.page += 1;
    if(!state.serverPaging)renderCatalog();else loadCatalog({ reset: false });
  });

  loadCart();
  renderCart();
  refreshCatalog();
})();
