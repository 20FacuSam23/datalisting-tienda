(() => {
  'use strict';

  let lastAttempt = 0;
  let pending = null;

  function configureAccess(portal) {
    if (portal !== 'nuts') return;
    const help = document.getElementById('loginHelp');
    if (help) help.textContent = 'Configurá el acceso de Nuts desde tu Matriz, en Portales y propuestas. En la ficha de Nuts, usá Crear cuenta o restablecer su contraseña y el permiso Dueño / administrador.';
    const access = document.getElementById('nutsMatrixAccessRow');
    if (access) access.hidden = false;
    for (const id of ['matrixRecoveryRow', 'matrixLoginRow']) {
      const row = document.getElementById(id);
      if (row) row.hidden = true;
    }
    const brand = document.getElementById('brandName');
    if (brand) brand.textContent = 'Nuts';
    document.title = 'Administrar Nuts';
  }

  async function refreshCatalogIfDue({ portal, data, api, notify, now = Date.now() }) {
    if (portal !== 'nuts' || !data?.settings?.fudo?.enabled) return data;
    const syncedAt = Date.parse(data.settings.fudo.last_synced_at || '');
    if (Number.isFinite(syncedAt) && now - syncedAt < 6 * 60 * 60 * 1000) return data;
    if (pending) return pending;
    if (lastAttempt && now - lastAttempt < 60000) return data;
    lastAttempt = now;
    const run = (async () => {
      try {
        notify('Actualizando los productos de Nuts…');
        // Esta llamada usa la sesión administradora comprobada por /auth/me y /manage.
        await api('/manage/fudo/sync', {});
        const updated = await api('/manage');
        notify('Catálogo de Nuts actualizado.');
        return updated;
      } catch (_) {
        notify('No se pudo actualizar el catálogo. Se conserva la información anterior; podés reintentar con Actualizar catálogo.');
        return data;
      }
    })();
    pending = run;
    try {
      return await run;
    } finally {
      if (pending === run) pending = null;
    }
  }

  window.DatalistingNutsOwner = { configureAccess, refreshCatalogIfDue };
})();
