(() => {
  'use strict';

  let lastAttempt = 0;
  let pending = null;

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

  window.DatalistingNutsOwner = { refreshCatalogIfDue };
})();
