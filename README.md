# Tiendas Datalisting

Frontend de tienda genérica y propuestas independientes en GitHub. Requiere backend 2026.10.17-integrada.5.

- Raíz: portal `tienda-generica`, catálogo ilustrativo, pedidos simulados y sin cobros reales.
- `?portal=identificador`: muestra una propuesta creada en Matriz, con su identidad y catálogo.
- `/gestion/?portal=identificador`: administración del dueño en GitHub: identidad, logotipo por enlace HTTPS, productos, promociones, pedidos y contraseña propia.
- `?org=identificador`: conserva el acceso anterior a tiendas de organizaciones definitivas. No convierte un negocio existente en prospecto.

Matriz mantiene la lógica y los módulos. Las propuestas tienen datos, cuentas y sesiones separados de las organizaciones definitivas. Se crean en `/matriz/portales`; no existe una organización por cada maqueta. El backend recalcula todos los pedidos y promociones sin confiar en precios del navegador.

La promoción 3x2 combina productos y descuenta las unidades más económicas. Con exactamente dos unidades puede aplicarse el porcentaje configurado. No se acumulan reglas. Los pedidos de propuesta se reciben para revisión; no ejecutan cobros automáticos.

Solo al confirmar la fidelización se incorpora el cliente: conserva catálogo, cuentas y pedidos, sincroniza los módulos operativos y se sirve la misma plataforma desde `https://datalisting.info/portales/identificador/`. La publicación requiere autorización. La página GitHub redirige al alojamiento propio después de incorporar.

No contiene claves privadas ni contraseñas. Las cuentas de propuesta cambian sus contraseñas dentro de su propia interfaz. Matriz puede restablecerlas y administrar cada portal.

## Nuts

`/nuts/` es la tienda de productos naturales y dietéticos, con identidad propia, catálogo, fichas de producto y carrito. El servidor confirma la disponibilidad y registra los pedidos cuando la tienda los tiene habilitados. El envío de un pedido no realiza un cobro automático.

Prioriza el catálogo sincronizado de Datalisting. Si el servidor no está disponible, muestra la última consulta guardada y su fecha; esa copia permite consultar productos y mantiene deshabilitado el envío de pedidos. Las imágenes conservan sus proporciones en las tarjetas y el detalle.

El enlace **Administrar tienda** abre la gestión de Nuts. El botón **Actualizar catálogo** sincroniza los productos; se conservan los productos manuales y los precios editados manualmente. Los identificadores internos de conexión mantienen la continuidad del catálogo, las cuentas y los pedidos.

## Muestras, accesos y pedidos por WhatsApp

La actualización de accesos permite probar la administración sin claves con ejemplos en memoria, únicamente cuando el backend confirma que es una muestra sin cuentas ni contenido propio. Las cuentas reales tienen recuperación por correo y control de reseteos desde Matriz.

En Nuts, el dueño configura el WhatsApp para recibir pedidos en su administración. El servidor guarda y calcula el pedido antes de abrir el chat, con código y total confirmado. Un doble toque o reintento con la misma clave de envío conserva el mismo registro. La persona confirma el envío dentro de WhatsApp; el pago permanece pendiente. Los pedidos simulados no abren chats ni realizan cobros.

Validación del recorrido de muestra: `node --test tests/demo.test.cjs`.
