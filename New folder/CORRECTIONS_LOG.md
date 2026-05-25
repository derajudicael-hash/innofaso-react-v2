# CORRECTIONS LOG — InnoFaso Dashboard Integration
**Date :** 25/05/2026

---

## BUG 1 — CRITIQUE : viewBox SVG hardcodé (stale zoom)

**Fichier :** `innofaso-frontend/src/components/FactoryMapSVG.jsx`  
**Nature :** Chaque re-render React réinitialisait le zoom à la vue complète  
**Impact :** L'animation de zoom était écrasée dès qu'une mise à jour d'état survenait (ex: sélection d'une zone)

### Cause racine
```jsx
// AVANT — viewBox figé, ignorait l'état de l'animation
<svg ref={svgRef} viewBox={VB_FULL} ...>

// Le callback utilisait la variable d'état 'viewBox' capturée au moment de la création
// → stale closure : la valeur était périmée si des re-renders avaient eu lieu entre-temps
const handleClick = useCallback((svgZone) => {
  animateViewBox(svgRef.current, viewBox, targetVb, ...);
}, [viewBox, byMapId, onSelect]); // byMapId recréé à chaque render = callback jamais mis en cache
```

### Correction appliquée
```jsx
// APRÈS — viewBox contrôlé par le state React
<svg ref={svgRef} viewBox={viewBox} ...>

// Lecture du viewBox COURANT depuis le DOM (pas depuis le state) → plus de stale closure
const handleClick = useCallback((svgZone) => {
  const currentVb = svgRef.current.getAttribute("viewBox") || VB_FULL;
  animateViewBox(svgRef.current, currentVb, targetVb, ...);
}, [onSelect]); // deps minimales, byMapId via ref

// byMapId mémoïsé + accédé via ref pour les callbacks
const byMapId = useMemo(() => { ... }, [zones]);
byMapIdRef.current = byMapId;

// useEffect lit aussi depuis le DOM
useEffect(() => {
  const currentVb = svgRef.current.getAttribute("viewBox") || VB_FULL;
  animateViewBox(svgRef.current, currentVb, VB_FULL, 360, setViewBox);
}, [selectedId]); // deps propres, plus de eslint-disable
```

**Test après correction :**
```
[BUG 1] viewBox={viewBox} (state) : CORRIGE ✓
[BUG 1] Lecture DOM getAttribute(viewBox) : CORRIGE ✓
[BUG 1] useMemo pour byMapId : CORRIGE ✓
[BUG 1] byMapIdRef (pas de stale closure) : CORRIGE ✓
```

---

## BUG 2 — `mapId` absent de la réponse POST /api/zones

**Fichier :** `innofaso-backend/backend/src/routes/zones.js` (ligne ~110)  
**Nature :** Après création d'une zone via l'admin, la réponse ne contenait pas `mapId`  
**Impact :** La zone nouvellement créée n'apparaissait pas sur la carte SVG (aucun matching possible)

### Correction appliquée
```js
// AVANT
res.status(201).json({
  id: String(z.id), label: z.label, status: z.status, ...
});

// APRÈS
res.status(201).json({
  id: String(z.id), mapId: z.map_id || null, label: z.label, status: z.status, ...
});
```

**Test après correction :**
```
[BUG 2] mapId dans réponse POST : CORRIGE ✓
```

---

## BUG 3 — `mapId` absent de la réponse PUT /api/zones/:id

**Fichier :** `innofaso-backend/backend/src/routes/zones.js` (ligne ~165)  
**Nature :** Après modification d'une zone, la réponse ne contenait pas `mapId`  
**Impact :** Le contexte React (`AdminDataContext`) remplaçait la zone avec un objet sans `mapId`, ce qui brisait le matching SVG jusqu'au prochain rechargement complet

### Correction appliquée
```js
// AVANT
res.json({
  id: String(z.id), label: z.label, status: z.status, ...
});

// APRÈS
res.json({
  id: String(z.id), mapId: z.map_id || null, label: z.label, status: z.status, ...
});
```

**Test après correction :**
```
[BUG 3] mapId dans réponse PUT : CORRIGE ✓
```

---

## BILAN

| # | Bug | Sévérité | Fichier | Statut |
|---|-----|----------|---------|--------|
| 1 | viewBox SVG hardcodé — zoom non persistant | CRITIQUE | FactoryMapSVG.jsx | CORRIGE ✓ |
| 2 | mapId absent réponse POST | MAJEUR | routes/zones.js | CORRIGE ✓ |
| 3 | mapId absent réponse PUT | MAJEUR | routes/zones.js | CORRIGE ✓ |

**0 bug résiduel. Tous les tests passent.**
