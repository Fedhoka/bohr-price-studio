# BOHR Price Studio — Web App

## Cómo subir a Vercel (5 minutos, gratis)

### Opción A: Drag & Drop (más fácil, sin cuenta GitHub)

1. Entrá a **https://vercel.com** y creá una cuenta gratis (con Google o GitHub)
2. En el dashboard, hacé click en **"Add New → Project"**
3. Elegí **"Deploy from your computer"** o arrastrá directamente esta carpeta
4. Vercel la despliega automáticamente
5. Te da una URL tipo `bohr-price-studio.vercel.app` — compartila con tu equipo

### Opción B: Via GitHub (recomendado para actualizar fácil)

1. Subí esta carpeta a un repo GitHub (puede ser privado)
2. En Vercel: **"Add New → Project" → Import Git Repository**
3. Conectás el repo y Vercel hace el deploy automático
4. Cada vez que actualizás el repo, la web se actualiza sola

---

## Importar el Excel

1. Click en **"Importar Excel"** y elegí el archivo.
2. Aparece un diálogo con las hojas encontradas (clientes, estilos y precio típico de cada una).
   **Confirmá cuál es Barriles y cuál es Latas** — viene pre-seleccionado, pero revisalo.
3. Al terminar se muestra un resumen: clientes y precios cargados, clientes/estilos nuevos y avisos.

Reglas del importador:

- **Manda el Excel.** Toda columna que no sea `Cliente` ni `Comentarios Negrito` se toma como un
  estilo, con el nombre y el precio tal cual figuran. No hay lista blanca de estilos.
- Celda vacía = ese cliente no tiene precio para ese estilo.
- Los nombres de cliente se comparan ignorando mayúsculas y espacios, así `Burden` y `burden`
  no generan dos listas separadas.
- Solo se leen las **hojas visibles**. Las hojas ocultas (meses viejos) se ignoran.

---

## ¿Dónde se guardan los datos?

Los datos (productos, listas, historial) se guardan en el **localStorage del browser**.

- ✅ Persisten entre sesiones en la misma PC y navegador
- ✅ No requieren servidor ni base de datos
- ⚠️  Son por navegador: si abrís desde otro browser o PC, empezás de cero
- 💡 Para compartir listas entre PCs: usá "Guardar versión" y exportá

---

## Estructura

```
bohr-web/
├── index.html          ← App principal
├── vercel.json         ← Config de Vercel
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   └── icons.js
└── assets/
    ├── bohr-logo.png
    └── fonts/
        └── CARROSSERIE_REGULAR.OTF
```
