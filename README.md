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

`/nuts/` presenta el catálogo de productos naturales y dietéticos. Prioriza los datos sincronizados de Datalisting y dispone de una copia de consulta fechada.

La administración de la tienda permite actualizar el catálogo y conservar los productos y precios cargados manualmente.
