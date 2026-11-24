(() => {
  'use strict';

  function create({ portal, config, checkoutDialog, money }) {
    if (portal !== 'nuts') return null;
    const dialog = document.getElementById('orderReceiptDialog');
    const content = document.getElementById('orderReceiptContent');
    const lastOrderButton = document.getElementById('lastOrderButton');
    const lastOrderNav = document.getElementById('lastOrderNav');
    if (!dialog || !content || !lastOrderButton) return null;

    const storageKey = 'datalisting:last-order:nuts';
    const maxAge = 24 * 60 * 60 * 1000;
    let lastOrder = null;

    // El destino pertenece a Nuts. Nunca se toma del catálogo ni de su proveedor.
    function whatsappNumber() {
      const number = String(config.ORDER_WHATSAPP || '').replace(/[+\s().-]/g, '');
      return /^[1-9][0-9]{7,14}$/.test(number) ? number : null;
    }

    function messageFor(result, customer, items) {
      const lines = ['Hola Nuts, este es mi pedido.', 'Pedido: ' + result.order_id,
        'Nombre: ' + customer.customer_name];
      if (customer.customer_phone) lines.push('Teléfono: ' + customer.customer_phone);
      if (customer.customer_email) lines.push('Email: ' + customer.customer_email);
      lines.push('');
      items.forEach(item => lines.push(item.quantity + ' × ' + item.name));
      if (result.total != null && Number.isFinite(Number(result.total))) {
        lines.push('', 'Total confirmado: ' + money(Number(result.total)));
      }
      if (customer.notes) lines.push('Observaciones: ' + customer.notes);
      lines.push('Quisiera coordinar entrega y forma de pago.');
      return lines.join('\n');
    }

    function readLastOrder() {
      try {
        const value = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
        if (value && typeof value.orderId === 'string' && value.orderId
            && typeof value.message === 'string' && Number.isFinite(value.savedAt)
            && value.savedAt <= Date.now() && Date.now() - value.savedAt < maxAge) {
          return value;
        }
        sessionStorage.removeItem(storageKey);
      } catch (_) {
        // La confirmación también funciona sin almacenamiento del navegador.
      }
      return null;
    }

    function remember(order) {
      lastOrder = order;
      try { sessionStorage.setItem(storageKey, JSON.stringify(order)); } catch (_) {}
      lastOrderButton.hidden = false;
      if (lastOrderNav) lastOrderNav.hidden = false;
    }

    function show(order, openWhatsApp) {
      const title = document.createElement('h2');
      title.textContent = order.simulated ? 'Pedido de demostración' : 'Pedido guardado en Nuts';
      const code = document.createElement('p');
      code.textContent = 'Código: ' + order.orderId;
      const detail = document.createElement('pre');
      detail.className = 'order-receipt-detail';
      detail.textContent = order.message;
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      const actions = document.createElement('div');
      actions.className = 'order-receipt-actions';
      const number = whatsappNumber();
      const url = !order.simulated && number
        ? 'https://wa.me/' + number + '?text=' + encodeURIComponent(order.message) : null;

      if (url) {
        status.textContent = 'En WhatsApp, tocá Enviar para que Nuts reciba el mensaje. Podés volver a abrir este pedido sin registrarlo otra vez.';
        const whatsapp = document.createElement('a');
        whatsapp.className = 'checkout-button';
        whatsapp.href = url;
        whatsapp.target = '_blank';
        whatsapp.rel = 'noopener';
        whatsapp.textContent = 'Abrir WhatsApp';
        actions.append(whatsapp);
      } else {
        status.textContent = order.simulated
          ? 'Este pedido es una demostración. No se envía por WhatsApp ni se realiza un cobro.'
          : 'Tu pedido está guardado. El envío por WhatsApp de Nuts todavía no está habilitado.';
      }
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'secondary-link';
      copy.textContent = 'Copiar detalle';
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(order.message);
          copy.textContent = 'Detalle copiado';
        } catch (_) {
          status.textContent = 'No se pudo copiar. El detalle del pedido sigue visible aquí.';
        }
      });
      actions.append(copy);
      content.replaceChildren(title, code, status, detail, actions);
      checkoutDialog.close();
      if (!dialog.open) dialog.showModal();
      if (openWhatsApp && url) {
        try { window.location.assign(url); } catch (_) {
          status.textContent = 'Tu pedido está guardado. Tocá Abrir WhatsApp y luego Enviar.';
        }
      }
    }

    document.getElementById('closeOrderReceipt')?.addEventListener('click', () => dialog.close());
    lastOrderButton.addEventListener('click', () => {
      if (lastOrder) show(lastOrder, false);
    });
    const saved = readLastOrder();
    if (saved) remember(saved);
    const submit = document.getElementById('sendOrderButton');
    if (submit && whatsappNumber()) submit.textContent = 'Confirmar y abrir WhatsApp';

    return {
      confirm(result, customer, items) {
        const order = {
          orderId: String(result.order_id),
          simulated: Boolean(result.simulated),
          message: messageFor(result, customer, items),
          savedAt: Date.now(),
        };
        remember(order);
        show(order, true);
      },
    };
  }

  window.DatalistingOrderConfirmation = { create };
})();
