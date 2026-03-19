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
