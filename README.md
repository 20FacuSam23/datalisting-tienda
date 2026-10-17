# Tienda Datalisting

Catálogo de la organización configurada en `config.js`. Puede elegirse otra con `?org=su-identificador`.

Requiere el backend 2026.10.17-integrada.4 para las promociones. La identidad, los productos, precios y promociones se cargan desde Datalisting. El servidor recalcula el pedido y no confía en precios enviados desde el navegador.

En Configuración de tienda se activa la promoción, su vencimiento y sus reglas. El 3x2 descuenta las unidades más económicas del conjunto de productos; con exactamente dos unidades puede aplicarse el porcentaje configurado. No se acumulan ambas reglas. Los servicios y cantidades fraccionarias quedan fuera de estas promociones.

No contiene credenciales. Los pedidos se reciben en Datalisting; esta interfaz no modifica la configuración de los proveedores de pago.
