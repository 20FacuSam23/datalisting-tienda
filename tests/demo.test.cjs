const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../assets/demo.js'), 'utf8');

function sample() {
  let network = 0;
  const context = vm.createContext({
    window: {}, document: { body: {}, querySelectorAll: () => [] },
    MutationObserver: class { observe() {} disconnect() {} },
    URL, Response, FormData, location: { href: 'https://ejemplo.test/' },
    fetch() { network++; throw Error('La muestra intentó usar la red.'); },
  });
  vm.runInContext(source, context);
  return { create: () => context.window.DatalistingDemo.create({ slug: 'muestra', kind: 'aula', name: 'Ejemplo' }), network: () => network };
}

test('el acceso de ejemplo no genera credenciales ni usa la red', async () => {
  const environment = sample(), demo = environment.create();
  await assert.rejects(demo.fetch('https://datalisting.info/api/portales/muestra/manage'));
  demo.start();
  const data = await (await demo.fetch('https://datalisting.info/api/portales/muestra/auth/me')).json();
  assert.equal(data.user.is_demo, true);
  assert.equal(data.token, undefined);
  assert.equal(environment.network(), 0);
  demo.stop();
  await assert.rejects(demo.fetch('https://datalisting.info/api/portales/muestra/manage'));
});

test('los cambios de ejemplo no pasan a una sesión nueva', async () => {
  const environment = sample(), first = environment.create();
  first.start();
  await first.fetch('https://datalisting.info/api/portales/muestra/manage/courses', { method: 'POST', body: JSON.stringify({ name: 'Nuevo', slug: 'nuevo', active: true }) });
  assert.equal((await (await first.fetch('https://datalisting.info/api/portales/muestra/learning/courses')).json()).courses.length, 2);
  const next = environment.create(); next.start();
  assert.equal((await (await next.fetch('https://datalisting.info/api/portales/muestra/learning/courses')).json()).courses.length, 1);
  assert.equal(environment.network(), 0);
});

test('la muestra no puede cambiar claves ni acceder a otro portal o a Matriz', async () => {
  const environment = sample(), demo = environment.create(); demo.start();
  for (const route of ['/api/portales/otro/manage', '/api/portales/muestra-ajena/manage', '/api/matriz/accesos', '/api/portales/muestra/auth/password', '/api/portales/muestra/operacion-inexistente']) {
    const response = await demo.fetch('https://datalisting.info' + route, { method: 'POST', body: '{}' });
    assert.equal(response.status, 403, route);
  }
  assert.equal(environment.network(), 0);
});
