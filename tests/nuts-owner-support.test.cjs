const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function helper() {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/nuts-owner-support.js'), 'utf8'), { window });
  return window.DatalistingNutsOwner.refreshCatalogIfDue;
}

const now = Date.parse('2026-11-24T16:00:00Z');
function catalog(date = '2026-10-18T07:30:59Z') {
  return { settings: { fudo: { enabled: true, last_synced_at: date } },
    products: [{ id: 1 }], orders: [{ id: 7, customer_name: 'Cliente de prueba' }] };
}

test('al ingresar a Nuts con catálogo antiguo, sincroniza y vuelve a leer la gestión', async () => {
  const refresh = helper();
  const calls = [];
  const updated = catalog('2026-11-24T16:00:00Z');
  const result = await refresh({ portal: 'nuts', data: catalog(), now, notify() {},
    api: async (route, body) => { calls.push({ route, body }); return route === '/manage' ? updated : {}; } });
  assert.deepEqual(calls.map(c => c.route), ['/manage/fudo/sync', '/manage']);
  assert.equal(result, updated);
});

test('un catálogo reciente no dispara importaciones adicionales', async () => {
  const refresh = helper();
  const data = catalog('2026-11-24T15:00:00Z');
  let calls = 0;
  const result = await refresh({ portal: 'nuts', data, now, notify() {}, api: async () => { calls++; } });
  assert.equal(result, data);
  assert.equal(calls, 0);
});

test('no sincroniza otras tiendas ni una conexión deshabilitada', async () => {
  const refresh = helper();
  let calls = 0;
  const api = async () => { calls++; };
  await refresh({ portal: 'punto-moda', data: catalog(), now, notify() {}, api });
  const disabled = catalog(); disabled.settings.fudo.enabled = false;
  await refresh({ portal: 'nuts', data: disabled, now, notify() {}, api });
  assert.equal(calls, 0);
});

test('si falla la sincronización, conserva catálogo y pedidos y permite reintentar después', async () => {
  const refresh = helper();
  const data = catalog();
  const messages = [];
  let calls = 0;
  const api = () => { calls++; throw Error('No disponible'); };
  const first = await refresh({ portal: 'nuts', data, now, api, notify: m => messages.push(m) });
  assert.equal(first, data);
  assert.equal(first.orders[0].id, 7);
  assert.match(messages.at(-1), /Se conserva la información anterior/);
  await refresh({ portal: 'nuts', data, now: now + 30000, api, notify() {} });
  assert.equal(calls, 1);
  await refresh({ portal: 'nuts', data, now: now + 61000, api, notify() {} });
  assert.equal(calls, 2);
});

test('dos cargas simultáneas comparten una única sincronización', async () => {
  const refresh = helper();
  let finish;
  let syncCalls = 0;
  const updated = catalog('2026-11-24T16:00:00Z');
  const api = async route => {
    if (route === '/manage') return updated;
    syncCalls++;
    return new Promise(resolve => { finish = resolve; });
  };
  const first = refresh({ portal: 'nuts', data: catalog(), now, api, notify() {} });
  const second = refresh({ portal: 'nuts', data: catalog(), now, api, notify() {} });
  finish({});
  const results = await Promise.all([first, second]);
  assert.equal(syncCalls, 1);
  assert.equal(results[0], updated);
  assert.equal(results[1], updated);
});


function accessPage() {
  const nodes = Object.fromEntries(['loginHelp', 'nutsMatrixAccessRow', 'matrixRecoveryRow', 'matrixLoginRow', 'brandName']
    .map(id => [id, { hidden: id === 'nutsMatrixAccessRow', textContent: 'Texto original' }]));
  const document = { title: 'Administrar tienda', getElementById: id => nodes[id] };
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/nuts-owner-support.js'), 'utf8'), { window, document });
  return { nodes, document, configure: window.DatalistingNutsOwner.configureAccess };
}

test('Nuts ofrece gestionar su cuenta desde Matriz y deja de indicar recuperar la contraseña central', () => {
  const p = accessPage();
  p.configure('nuts');
  assert.equal(p.nodes.nutsMatrixAccessRow.hidden, false);
  assert.equal(p.nodes.matrixRecoveryRow.hidden, true);
  assert.equal(p.nodes.matrixLoginRow.hidden, true);
  assert.match(p.nodes.loginHelp.textContent, /Crear cuenta o restablecer su contraseña/);
  assert.match(p.nodes.loginHelp.textContent, /Dueño \/ administrador/);
  assert.equal(p.document.title, 'Administrar Nuts');
});

test('la ayuda de Nuts no cambia el acceso de otras tiendas', () => {
  const p = accessPage();
  p.configure('punto-moda');
  assert.equal(p.nodes.nutsMatrixAccessRow.hidden, true);
  assert.equal(p.nodes.matrixRecoveryRow.hidden, false);
  assert.equal(p.nodes.loginHelp.textContent, 'Texto original');
  assert.equal(p.document.title, 'Administrar tienda');
});
