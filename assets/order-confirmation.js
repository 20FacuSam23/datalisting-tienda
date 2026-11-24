(() => {
  'use strict';

  const shippingFee = 2000;
  const shippingLine = 'Entrega: Envío a domicilio (+ $2.000).';
  const noShippingLine = 'Entrega: Sin envío (a coordinar).';

  function withDelivery(notes, data) {
    const shipping = data.get('nuts_shipping') === '1';
    const address = String(data.get('delivery_address') || '').replace(/\s+/g, ' ').trim();
    const delivery = shipping ? shippingLine + '\nDirección de entrega: ' + address : noShippingLine;
    return [String(notes || '').trim(), delivery].filter(Boolean).join('\n\n');
  }

  // Conserva la elección de entrega junto al pedido en el sistema existente.
  function deliveryFromNotes(notes) {
    const text = String(notes || '').replace(/\r\n/g, '\n').trim();
    const blocks = text.split('\n\n');
    const last = blocks.at(-1);
    if (last === noShippingLine) return { fee: 0, address: '', notes: blocks.slice(0, -1).join('\n\n') };
    if (last?.startsWith(shippingLine + '\nDirección de entrega: ')) {
      return { fee: shippingFee, address: last.slice((shippingLine + '\nDirección de entrega: ').length),
        notes: blocks.slice(0, -1).join('\n\n') };
    }
    return { fee: 0, address: '', notes: text };
  }

  function totals(productsTotal, notes) {
    const products = Number(productsTotal);
    const delivery = deliveryFromNotes(notes);
    return { products, shipping: delivery.fee, total: products + delivery.fee };
  }

  function create({ portal, config, checkoutDialog, money, getSubtotal = () => 0 }) {
    if (portal !== 'nuts') return null;
    const dialog = document.getElementById('orderReceiptDialog');
    const content = document.getElementById('orderReceiptContent');
    const lastOrderButton = document.getElementById('lastOrderButton');
    const lastOrderNav = document.getElementById('lastOrderNav');
    if (!dialog || !content || !lastOrderButton) return null;

    const welcome = document.getElementById('nutsWelcome');
    if (welcome) {
      welcome.hidden = false;
      const dismissWelcome = () => {
        welcome.hidden = true;
        document.removeEventListener('pointerdown', dismissWelcome, true);
        document.removeEventListener('keydown', dismissWelcome, true);
      };
      document.addEventListener('pointerdown', dismissWelcome, { capture: true, passive: true });
      document.addEventListener('keydown', dismissWelcome, { capture: true });
    }

    function syncDelivery(subtotal = getSubtotal()) {
      const shipping = Boolean(document.getElementById('nutsShipping')?.checked);
      const addressRow = document.getElementById('deliveryAddressRow');
      const address = document.getElementById('deliveryAddress');
      const summary = document.getElementById('shippingSummary');
      if (addressRow) addressRow.hidden = !shipping;
      if (address) address.required = shipping;
      if (summary) summary.hidden = !shipping;
      const productsTotal = document.getElementById('checkoutProductsTotal');
      if (productsTotal) productsTotal.textContent = money(subtotal);
      const total = document.getElementById('checkoutTotal');
      if (total) total.textContent = money(subtotal + (shipping ? shippingFee : 0));
    }
    document.getElementById('nutsShipping')?.addEventListener('change', () => syncDelivery());
    document.getElementById('checkoutForm')?.addEventListener('reset', () => queueMicrotask(() => syncDelivery()));
    syncDelivery();

    const storageKey = 'datalisting:last-order:nuts';
    const maxAge = 24 * 60 * 60 * 1000;
    let lastOrder = null;

    // El destino pertenece a Nuts. Nunca se toma del catálogo ni de su proveedor.
    function whatsappNumber() {
      const number = String(config.ORDER_WHATSAPP || '').replace(/[+\s().-]/g, '');
      return /^[1-9][0-9]{7,14}$/.test(number) ? number : null;
    }

    function messageFor(result, customer, items) {
      const delivery = deliveryFromNotes(customer.notes);
      const lines = ['Hola Nuts, este es mi pedido.', 'Pedido: ' + result.order_id,
        'Nombre: ' + customer.customer_name];
      if (customer.customer_phone) lines.push('Teléfono: ' + customer.customer_phone);
      if (customer.customer_email) lines.push('Email: ' + customer.customer_email);
      lines.push('');
      items.forEach(item => lines.push(item.quantity + ' × ' + item.name));
      if (result.total != null && Number.isFinite(Number(result.total))) {
        const amounts = totals(result.total, customer.notes);
        lines.push('', 'Productos: ' + money(amounts.products));
        if (amounts.shipping) lines.push('Envío: ' + money(amounts.shipping));
        lines.push('Total del pedido: ' + money(amounts.total));
      }
      lines.push(delivery.fee ? 'Entrega: Envío a domicilio.' : 'Entrega: Sin envío (a coordinar).');
      if (delivery.address) lines.push('Dirección de entrega: ' + delivery.address);
      if (delivery.notes) lines.push('Observaciones: ' + delivery.notes);
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
      withDelivery,
      syncDelivery,
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
  window.DatalistingOrderDelivery = { withDelivery, deliveryFromNotes, totals, shippingFee };
})();
