const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor() {
    this.children = [];
    this.events = {};
    this.textContent = '';
    this.hidden = true;
    this.open = false;
    this.classes = new Set();
    this.classList = { add: name => this.classes.add(name) };
  }
  set innerHTML(_) { throw new Error('Receipt content must use text nodes'); }
  setAttribute(name, value) { this[name] = value; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, fn) { this.events[name] = fn; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  click() { return this.events.click?.(); }
}

function textOf(element) {
  return element.textContent + element.children.map(textOf).join('\n');
}

function receiptHarness({ number = '', storage = new Map(), blockedStorage = false } = {}) {
  const nodes = Object.fromEntries(['orderReceiptDialog', 'orderReceiptContent', 'lastOrderButton',
    'lastOrderNav', 'closeOrderReceipt', 'sendOrderButton'].map(id => [id, new Element()]));
  const navigations = [];
  const copies = [];
  const document = { getElementById: id => nodes[id] || null, createElement: () => new Element() };
  const sessionStorage = {
    getItem: key => { if (blockedStorage) throw Error('Storage blocked'); return storage.get(key) || null; },
    setItem: (key, value) => { if (blockedStorage) throw Error('Storage blocked'); storage.set(key, value); },
    removeItem: key => storage.delete(key),
  };
  const window = { location: { assign: url => navigations.push(url) } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/order-confirmation.js'), 'utf8'), {
    window, document, sessionStorage, navigator: { clipboard: { writeText: async text => copies.push(text) } },
  });
  const options = { portal: 'nuts', config: { ORDER_WHATSAPP: number }, checkoutDialog: new Element(),
    money: amount => '$ ' + amount.toFixed(2) };
  return { nodes, navigations, storage, copies, options,
    receipt: window.DatalistingOrderConfirmation.create(options),
    create: window.DatalistingOrderConfirmation.create };
}

const customer = { customer_name: 'Cliente de prueba', customer_phone: '5493431111111',
  customer_email: 'cliente@example.test', notes: 'Retiro por la tarde' };
const items = [{ quantity: 2, name: 'Arándanos 100 g' }, { quantity: 1, name: 'Almendras' }];
const saved = { order_id: 'pedido-propio-de-nuts', total: 1234.5, simulated: false,
  whatsapp_url: 'https://wa.me/5493439999999?text=DestinoDelProveedor' };

test('Nuts abre solo su número confirmado y usa el total confirmado del pedido', () => {
  const h = receiptHarness({ number: '+54 9 343 000-0000' });
  h.receipt.confirm(saved, customer, items);
  assert.equal(h.navigations.length, 1);
  const url = new URL(h.navigations[0]);
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.pathname, '/5493430000000');
  assert.match(url.searchParams.get('text'), /2 × Arándanos 100 g/);
  assert.match(url.searchParams.get('text'), /Total confirmado: \$ 1234\.50/);
  assert.doesNotMatch(h.navigations[0], /5493439999999|DestinoDelProveedor/);
  assert.equal(h.nodes.orderReceiptDialog.open, true);
  assert.match(textOf(h.nodes.orderReceiptContent), /tocá Enviar/);
});

test('sin WhatsApp propio no se usa el del proveedor ni el teléfono del comprador', () => {
  const h = receiptHarness();
  h.receipt.confirm(saved, customer, items);
  assert.equal(h.navigations.length, 0);
  assert.match(textOf(h.nodes.orderReceiptContent), /todavía no está habilitado/);
  assert.equal(h.nodes.lastOrderButton.hidden, false);
  assert.equal(h.nodes.lastOrderNav.hidden, false);
});

test('reabrir el pedido tras recargar no genera otro pedido ni vuelve a abrir WhatsApp', () => {
  const first = receiptHarness({ number: '5493430000000' });
  first.receipt.confirm(saved, customer, items);
  const next = receiptHarness({ number: '5493430000000', storage: first.storage });
  assert.equal(next.nodes.lastOrderButton.hidden, false);
  next.nodes.lastOrderButton.click();
  assert.match(textOf(next.nodes.orderReceiptContent), /pedido-propio-de-nuts/);
  assert.equal(next.navigations.length, 0);
});

test('los pedidos simulados nunca abren WhatsApp', () => {
  const h = receiptHarness({ number: '5493430000000' });
  h.receipt.confirm({ ...saved, simulated: true }, customer, items);
  assert.equal(h.navigations.length, 0);
  assert.match(textOf(h.nodes.orderReceiptContent), /demostración/);
});

test('la confirmación funciona con almacenamiento bloqueado y contenido tratado como texto', async () => {
  const h = receiptHarness({ number: '5493430000000', blockedStorage: true });
  h.receipt.confirm(saved, { ...customer, notes: '<img src=x onerror=alert(1)>' }, items);
  assert.equal(h.navigations.length, 1);
  assert.match(textOf(h.nodes.orderReceiptContent), /<img src=x onerror=alert\(1\)>/);
  const actions = h.nodes.orderReceiptContent.children.at(-1);
  await actions.children.at(-1).click();
  assert.equal(h.copies.length, 1);
});

test('no se recuperan confirmaciones vencidas ni se activa el módulo en otra tienda', () => {
  const storage = new Map([['datalisting:last-order:nuts', JSON.stringify({ orderId: 'old', message: 'old',
    savedAt: Date.now() - 25 * 60 * 60 * 1000 })]]);
  const h = receiptHarness({ storage });
  assert.equal(h.nodes.lastOrderButton.hidden, true);
  assert.equal(storage.size, 0);
  assert.equal(h.create({ ...h.options, portal: 'otra-tienda' }), null);
});

function checkoutHarness() {
  const source = fs.readFileSync(path.join(__dirname, '../assets/store.js'), 'utf8');
  const begin = source.indexOf('  async function sendOrder() {');
  const end = source.indexOf('  function refreshCatalog()', begin);
  const nodes = { formMessage: new Element(), sendOrderButton: new Element(), checkoutForm: new Element() };
  nodes.checkoutForm.reportValidity = () => true;
  nodes.checkoutForm.reset = () => {};
  const requests = [];
  const confirmations = [];
  let respond;
  const context = vm.createContext({
    submittingOrder: false, formMessage: nodes.formMessage, sendOrderButton: nodes.sendOrderButton,
    idleOrderLabel: 'Confirmar pedido', state: { cart: new Map([[7, 2]]) },
    $: id => nodes[id], FormData: class { get(key) { return customer[key] || ''; } },
    publicText: value => String(value || ''), productById: () => ({ name: 'Arándanos 100 g' }),
    ENDPOINT: 'https://example.test/nuts', portal: 'nuts', apiPortal: 'nuts',
    sessionStorage: { getItem: () => null }, JSON, saveCart() {}, renderCart() {},
    orderConfirmation: { confirm: (...args) => confirmations.push(args) },
    fetch: (url, options) => { requests.push({ url, options }); return new Promise(resolve => { respond = resolve; }); },
  });
  vm.runInContext(source.slice(begin, end), context);
  return { context, nodes, requests, confirmations,
    send: () => vm.runInContext('sendOrder()', context),
    respond: (result, ok = true) => respond({ ok, json: async () => result }) };
}

test('dos intentos simultáneos confirman un único pedido y una única apertura de confirmación', async () => {
  const h = checkoutHarness();
  const first = h.send();
  await h.send();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, 'https://example.test/nuts/orders');
  h.respond(saved);
  await first;
  assert.equal(h.confirmations.length, 1);
  assert.equal(h.context.state.cart.size, 0);
  assert.equal(h.nodes.sendOrderButton.disabled, false);
});

test('si el servidor rechaza el pedido se conserva el carrito y no se abre WhatsApp', async () => {
  const h = checkoutHarness();
  const pending = h.send();
  h.respond({ message: 'El producto ya no está disponible.' }, false);
  await pending;
  assert.equal(h.context.state.cart.size, 1);
  assert.equal(h.confirmations.length, 0);
  assert.match(h.nodes.formMessage.textContent, /ya no está disponible/);
});

test('una respuesta sin código de pedido no borra el carrito ni afirma que se guardó', async () => {
  const h = checkoutHarness();
  const pending = h.send();
  h.respond({});
  await pending;
  assert.equal(h.context.state.cart.size, 1);
  assert.equal(h.confirmations.length, 0);
  assert.match(h.nodes.formMessage.textContent, /No se recibió la confirmación/);
});
