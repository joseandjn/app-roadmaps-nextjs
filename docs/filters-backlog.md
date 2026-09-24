# Backlog: Filtros para análisis y visibilidad del plan

Lista de trabajo para agregar filtros al roadmap, de a una tarea por vez.
Cada tarea es independiente dentro de su orden. Incluye el contexto, los
archivos involucrados, las decisiones ya tomadas y los criterios de
aceptación, para poder retomarla sin volver a investigar el código.

> Estado: `[ ]` pendiente · `[~]` en curso · `[x]` hecha

---

## Contexto general (leer antes de cualquier tarea)

### Qué existe hoy

| Filtro | Dónde vive | Quién lo respeta |
|---|---|---|
| Rango de fechas | `filterStartDay` / `filterEndDay` en `useRoadmapStore`, UI en `src/components/FilterBar.tsx` | Timeline, Cross, Resources, Costs. **No** Compare (a propósito, ver `CompareView.tsx:64`) |
| Visibilidad por proyecto | `visible: Set<string>` en el store, se cambia con `toggleProject(id)` desde el cuadrito de color del `LeftRail` | **Solo** Timeline (`visProjects`) y Cross (`CrossView.tsx:46`). Resources, Costs y el `LeftRail` de Resources (`resPeak`) **lo ignoran** |

- El rango de fechas se guarda en `storage/view.json` a través de `/api/view`
  (`src/lib/persistence/viewFile.ts`, `src/app/api/view/route.ts`, y el
  `subscribe` de `useRoadmapPersistence.ts`, que hace el guardado con debounce).
- `visible` **no** se guarda: al cargar un escenario se reinicia con todos los proyectos visibles
  (`useRoadmapStore.ts:263`). Al restaurar un checkpoint, los proyectos
  nuevos se marcan como visibles (`:202`), y crear un proyecto también lo marca (`:504`, `:692`).
- El undo/redo **no** registra el estado de UI (filtros incluidos),
  `useRoadmapStore.ts:141`. Hay que mantenerlo así.
- i18n: cada texto en inglés es su propia clave. Solo hay que agregar la traducción `es`
  en `src/lib/i18n/translations.ts` (hay una sección `// FilterBar`).
- Las vistas pintan con estilos inline y valores fijos
  (`#ececec`, `#fafafa`, `#71717a`, `#3b6ef5`…). El `FilterBar` usa Tailwind con
  esos mismos colores. Hay que copiar ese estilo.
- **No hay test runner para `src/`**. Solo `engine/` tiene `node --test`
  (`npm run engine:test`). Para validar, usar `npm run lint`, `npx tsc --noEmit`
  y probar en la app con `npm run dev`.
- `AGENTS.md`: esta versión de Next.js (16.x) tiene cambios incompatibles.
  Antes de tocar rutas de API o archivos de `app/`, revisar `node_modules/next/dist/docs/`.

### Datos disponibles para filtrar (`src/types/index.ts`)

- `Project`: `id, name, owner (resource id), category, color, status`
- `Item`: `projectId, status, type ('epic'|'task'|'milestone'|'release'), assignments[{r, pct}], requiredRoles?[]`
  (`requiredRoles` vacío o ausente = acepta cualquier rol)
- `Resource`: `id, name, role, availability?` (si falta, vale 100)
- `Dependency`: `from` depende de `to` (`to` es la predecesora; hay conflicto si `itemEnd(to) > from.startDay`)

### Decisiones de diseño ya acordadas

1. **Un solo lugar para la lógica.** Todo pasa por `src/lib/filters.ts`. Las
   vistas no reimplementan reglas de filtrado.
2. **Ocultar o atenuar.**
   - Proyectos, Estado y Tipo **ocultan**.
   - Personas y Roles **atenúan** en Timeline y Cross (opacidad ~0.25, siguen siendo clickeables)
     para no perder el contexto de las dependencias. En Resources **ocultan** filas.
3. **Métricas.** Costs y los KPIs se recalculan con los filtros activos y lo indican
   con el badge "filtrado". Compare, los checkpoints (`computeScenarioMetrics`) y el
   Analysis modal **ignoran** los filtros: miden el plan completo, igual que hoy con las fechas.
4. **Semántica entre filtros:** AND entre dimensiones distintas, OR dentro de la misma
   (ej. `Estado ∈ {At Risk, In Progress}` **y** `Persona ∈ {Ana, Luis}`).
5. **Proyectos:** `visible` sigue siendo la fuente de verdad para no romper
   los flujos de crear, restaurar y cargar. Los filtros por categoría u owner son atajos que
   modifican `visible`.

---

## F1 · Base: estado de filtros + helper central + componente chip `[x]`

> **Hecho.** Lo que quedó implementado (difiere un poco del plan original):
> - `Filters` y `FilterListKey` en `src/types/index.ts`; `filters` en el store con
>   `setFilters`, `toggleFilterValue`, y `clearFilter` que ahora limpia todo (incluye `visible`).
> - `src/lib/filters.ts`: `EMPTY_FILTERS`, `itemMatch` (por ahora solo `visible`),
>   `itemsForMetrics`, `activeFilterCount`, `pruneFilters`. `resourceMatches` **no** se creó:
>   se agrega en F4 cuando tenga reglas reales.
> - Limpieza de referencias: en vez de tocar cada acción, un único `subscribe` al final del
>   store llama a `pruneFilters` cuando cambian `items`/`resources`/`roles` (cubre borrar,
>   undo/redo, restaurar checkpoint y cambiar de escenario). `renameRole` renombra el rol en el filtro.
> - `src/components/filters/FilterChip.tsx`: popover propio (click fuera / Esc cierran), **sin**
>   dependencia nueva. Props: `label, options[{value,label,hint?,color?,icon?}], selected, onToggle,
>   onSetAll, header?`. "Vacío = sin restricción".
> - `FilterBar`: badge "filtrado · N" y "Restablecer" basados en `activeFilterCount`.
>   Todavía no hay chips montados (se agregan desde F2).
> - i18n: `Search…`, `No matches`, `Select all`, `Clear`.
> - Verificado en el navegador con un chip temporal (popover, contador, Restablecer, proyecto oculto → badge).
>
> Plan original de referencia:

**Objetivo:** dejar la infraestructura para que las tareas siguientes solo
agreguen una dimensión cada una. Esta tarea no cambia nada visible.

**Cambios**

1. `src/types/index.ts`: agregar
   ```ts
   export interface Filters {
     resourceIds: string[]   // Personas
     roles: string[]         // nombres de rol del catálogo
     statuses: StatusKey[]
     types: ItemType[]
     onlyIssues: boolean
     unassigned: boolean
     focusItemId: string | null   // ruta de dependencias (F9)
     text: string                 // búsqueda (F12)
   }
   ```
   y `filters: Filters` en `RoadmapState`. Los proyectos siguen en `visible`.
2. `src/store/useRoadmapStore.ts`:
   - `EMPTY_FILTERS` y estado inicial `filters: EMPTY_FILTERS`.
   - Acciones `setFilters(patch: Partial<Filters>)` y `toggleFilterValue(key, value)`
     para los arrays. `clearFilter` pasa a limpiar **todo**: fechas, `filters` y `visible` con todos los proyectos.
   - Ninguna de estas acciones debe pasar por el historial de undo.
   - En `loadScenario` / hidratación, limpiar las referencias que ya no existen
     (resourceIds borrados, roles eliminados, focusItemId de un item borrado). También en `removeResource`,
     `deleteRole`, `deleteItem`, y al restaurar un checkpoint.
3. `src/lib/filters.ts` (nuevo, funciones puras sin React ni store):
   - `activeFilterCount(filters, visible, projects, dateRange)`: número de filtros activos para el badge.
   - `itemMatch(item, ctx): 'show' | 'dim' | 'hide'`, donde `ctx = { filters, visible, resources, deps, items, derived }`.
     Por ahora solo aplica `visible`. Las demás dimensiones se agregan en F3–F12.
   - `resourceMatches(resource, ctx): boolean` (para las filas de Resources).
   - `itemsForMetrics(items, ctx): Item[]` devuelve los items que cuentan para carga y costo
     (los `'hide'` quedan afuera y los `'dim'` cuentan).
4. `src/components/filters/FilterChip.tsx` (nuevo): botón tipo chip con popover
   multi-select, con checkboxes, búsqueda interna si hay más de 8 opciones, "Seleccionar todo / ninguno"
   y un contador en el chip ("Personas · 2"). Se puede reusar `@radix-ui/react-*`,
   que ya está instalado (select y dialog). Si hace falta un popover, evaluar
   `@radix-ui/react-popover`, que es una dependencia nueva y hay que confirmarla antes.
5. `FilterBar.tsx`: reorganizar en `[Rango de fechas] [chips…] [Restablecer] [badge filtrado]`.
   El `isActive` actual pasa a ser `activeFilterCount(...) > 0`.

**Criterios de aceptación**
- La app se ve y funciona igual que antes. `npm run lint` y `npx tsc --noEmit` pasan limpios.
- "Restablecer" limpia también `visible` (hoy no lo hace).
- Undo/redo no registra cambios de filtros.

**Fuera de alcance:** persistir los filtros (F10).

---

## F2 · Proyectos: aplicar en todas las vistas + chip en el FilterBar `[x]`

> **Hecho.** Resumen de lo implementado:
> - Resources (celdas y barrita por proyecto), `LeftRail` en modo Resources, los paneles de persona
>   y de celda, y Costs usan `itemsForMetrics`. Costs lista solo los proyectos visibles y, si hay
>   items filtrados, el run-rate muestra la nota "Todo el equipo, sin filtrar".
> - Se aplicó la decisión recomendada sobre la carga: el número es la carga filtrada, el color usa
>   `colorLoad()` (la carga total si esa supera la capacidad), las celdas con carga fuera del filtro
>   tienen borde punteado y tooltip, y los paneles muestran la carga o el pico total.
> - Se corrigió un bug previo: el panel de celda no sumaba `filterStartDay` al bucket, así que con un
>   rango de fechas mostraba otros items que la celda.
> - `setVisibleProjects(ids)` en el store (`[]` = todos). `ProjectsFilter.tsx` envuelve `FilterChip`
>   con atajos "Por categoría" y "Por responsable" (los owners que no existen salen como "Sin responsable").
> - `FilterChip` ahora usa `ChevronDown` de lucide-react.
> - Documentado en `docs/resources-view.md` (sección "Filters"). `cross-view.md` no cambió porque
>   Cross ya respetaba `visible`.
>
> Plan original de referencia:

**Problema actual:** si ocultas un proyecto en el `LeftRail`, desaparece de Timeline
y Cross, pero Resources y Costs siguen contando sus asignaciones y costos.

**Cambios**
1. `ResourcesView.tsx`: en el loop de celdas (`for (const it of items)`, ~línea 70)
   usar `itemsForMetrics`. La barrita de colores por proyecto y el % de la celda
   solo reflejan los proyectos visibles.
2. `CostsView.tsx`:
   - `byProject`, `byResource` y `total` se calculan sobre los items filtrados.
   - `projectRows` solo con proyectos visibles.
   - `runRate`: se calcula sobre todas las personas y no depende de los
     proyectos. Dejarlo así, pero si hay filtros activos mostrar un subtítulo
     "(equipo completo)" para que no se lea como filtrado.
3. `LeftRail.tsx` (modo Resources): `resPeak(r.id, items)` pasa a usar los items filtrados.
4. `RightPanel.tsx` (panel `res` y `cell`): revisar que el detalle de una persona o celda
   use los mismos items filtrados. Si no, los números del panel no coinciden con la celda.
5. Chip **Proyectos** en el `FilterBar`: multi-select sincronizado con `visible`
   (usa `toggleProject`). Ojo: en `FilterChip` "vacío = sin restricción", pero en proyectos
   `visible` vacío = nada visible. Pasar `selected` = ids visibles solo si hay alguno oculto
   (si están todos, `[]` para que el chip se vea inactivo), y agregar una acción
   `setVisibleProjects(ids)` en el store para `onSetAll` (con `[]` → todos visibles). Adentro, dos secciones de atajos:
   - **Por categoría** (`Project.category`): marca solo los proyectos de esa categoría.
   - **Por owner** (`Project.owner` → nombre del resource).
   - **Por estado del proyecto** (`Project.status`), opcional si queda simple.
6. `LeftRail`: el contador `visCount/projects.length` ya existe y queda como está.

**Decisión abierta: carga en Resources.** Con un filtro de proyectos, ¿la celda
muestra solo la carga de esos proyectos o la carga total de la persona?
- **Recomendación:** mostrar la carga filtrada (responde "cuánto de Ana consume
  este subconjunto"). Si la persona tiene carga fuera del filtro, agregar un borde punteado a la celda
  y, en el panel de la celda, la línea "Carga total: X% (Y% fuera del filtro)".
  La sobrecarga (color ámbar) se sigue evaluando con la **carga total**, para que
  un filtro no esconda una sobrecarga real.

**Criterios de aceptación**
- Si ocultas un proyecto, desaparece también de Resources (celdas y barrita) y de Costs (filas y totales).
- El total de Costs con todos los proyectos visibles es igual al de hoy.
- El chip y el `LeftRail` siempre muestran la misma selección.
- `docs/resources-view.md` y `docs/cross-view.md` quedan actualizados con el comportamiento nuevo.

---

## F3 · Filtro por Estado del item `[x]`

> **Hecho.** Resumen de lo implementado:
> - `itemMatch` oculta los items cuyo estado no está en `filters.statuses`. `hidesItems(filters)` indica
>   si algún filtro oculta items sueltos (por ahora solo el de estado; F6 y siguientes lo amplían).
> - Timeline y Cross trabajan sobre los items que pasan el filtro (`shown`): `pack()` compacta las filas,
>   los envelopes y ticks de Cross se recalculan y el conteo "N items" de cada lane es el filtrado.
>   Si un filtro de items deja un lane vacío, el lane se omite. Los conflictos de dependencias se siguen
>   calculando con todos los items, y las flechas con un extremo oculto no se dibujan (ya pasaba).
>   El hover card de proyecto sigue resumiendo el proyecto completo.
> - Resources y Costs lo respetan solos, porque usan `itemsForMetrics` desde F2.
> - `StatusFilter.tsx`: chip con el punto de color de cada estado y el atajo "Ocultar completados".
> - Se adelantó una parte de F14: `FilterEmptyState.tsx` muestra "Ninguna tarea coincide con los filtros"
>   y el botón Restablecer cuando Timeline o Cross quedan vacíos por un filtro.
> - Verificado: "Ocultar completados" deja 35 de 45 barras (hay 10 en Done) y los lanes con solo tareas
>   Done desaparecen. "En riesgo" no deja ninguna barra, porque hoy no hay tareas en ese estado. Costs pasa
>   de S/225,494 a S/125,595 y vuelve al restablecer.
>
> Plan original de referencia:

**Pregunta que responde:** "¿Qué está en riesgo?", "Ocultar lo terminado".

**Cambios**
1. `filters.statuses` (vacío = todos). Regla en `itemMatch`: si el estado no está incluido, se oculta (`'hide'`).
2. Chip **Estado** con los 4 valores de `STATUS_ORDER` y su punto de color
   (`STATUS_CONFIG[s].dot`), igual que la leyenda del `LeftRail`.
3. Atajo de un clic: "Ocultar Done", porque va a ser el uso más común.
4. Timeline: el `pack()` recibe solo los items visibles, así se compactan las filas y no quedan huecos.
   Ojo: `pack` hoy recibe `items.filter(i => i.projectId === p.id)` (`TimelineView.tsx:183`).
5. Cross: el envelope y los ticks usan solo los items que pasan el filtro. Si un proyecto
   se queda sin items, se omite su lane (hoy ya se omiten los proyectos sin items).
6. Dependencias: si se oculta un extremo de una flecha, la flecha no se dibuja.
   El cálculo de `conflictedIds` sigue hecho sobre **todos** los items, para no perder la señal de conflicto.

**Criterios de aceptación**
- Con "At Risk" seleccionado, en Timeline solo se ven los items en riesgo, sin filas vacías.
- Resources y Costs dejan de contar los items ocultos.

---

## F4 · Filtro por Personas `[x]`

> **Hecho.** Resumen de lo implementado:
> - `itemMatch` devuelve `'dim'` si ninguna asignación del item es de las personas elegidas.
>   `resourceMatches(r, filters)` indica si una persona pasa el filtro (F5 le suma la regla de roles).
> - Timeline y Cross atenúan con `DIM_OPACITY = 0.25` (barras, milestones, ticks y barras expandidas).
>   El item seleccionado nunca se atenúa. Los items atenuados siguen siendo clickeables y arrastrables.
> - Resources muestra solo las filas de esas personas. El `LeftRail` sigue listando a todos, porque
>   es donde se eligen, y cada fila tiene un botón de embudo para agregar o quitar a esa persona del filtro.
> - Costs calcula todo con `assignmentCostsInRange` sobre las personas que pasan el filtro. Así el
>   costo por proyecto y el total suman solo sus asignaciones, y "Costo por persona" lista solo a ellas.
>   Sin filtros el total no cambia (S/225,494). Con Cristian y Jhonly da S/69,092 = 37,632 + 31,460.
> - `PeopleFilter.tsx`: chip con iniciales, nombre y rol, y búsqueda (hay 18 personas).
>
> Plan original de referencia:

**Pregunta que responde:** "¿En qué está metida Ana?", "¿Qué hacen Ana y Luis esta semana?"

**Regla:** un item coincide si alguna de sus `assignments[].r` está en `filters.resourceIds`.
- Timeline y Cross: si no coincide, se atenúa (`'dim'`). Hay que agregar `opacity` al estilo de la barra
  y del milestone. Si la persona está asignada a un epic y a sus tasks, se resaltan todos.
- Resources: se muestran solo las filas de las personas seleccionadas (`resourceMatches`).
- Costs: `byResource` solo con esas personas. `byProject` y `total` suman **solo los costos de las
  asignaciones de esas personas**. Usar `assignmentCostsInRange`
  (`roadmapUtils.ts:93`), que ya devuelve el costo por `rid`.

**UI**
- Chip **Personas**: opciones con iniciales, nombre y rol. Búsqueda interna.
- Acceso rápido: en el `LeftRail` de Resources, un botón o ícono "Filtrar por esta persona" en cada fila.
  El clic actual abre el panel, así que **no** hay que cambiarlo.
- Opcional: opción "Sin asignar" dentro del mismo chip. Mejor dejarla para F8.

**Criterios de aceptación**
- Con Ana seleccionada, en Timeline se leen claramente sus barras y el resto queda atenuado pero visible.
- En Costs, el total coincide con la suma de sus asignaciones en el rango.
- Si se borra una persona que estaba seleccionada, sale del filtro sin errores.

---

## F5 · Filtro por Roles `[x]`

> **Hecho.** Resumen de lo implementado:
> - `itemMatch` atenúa (`'dim'`) los items que no tienen el rol: un item lo tiene si lo incluye en
>   `requiredRoles` o si alguien asignado tiene ese rol. `FilterContext` ahora incluye `resources`
>   para poder resolver el rol de cada asignación, y todos los llamadores se actualizaron.
> - `resourceMatches` también exige que el rol de la persona esté en el filtro. Con eso, Resources
>   muestra solo esas filas y Costs suma solo sus asignaciones, sin cambios en esas vistas.
> - `RolesFilter.tsx`: chip con el ícono de cada rol del catálogo y una nota que explica la regla.
> - **No se hizo** el toggle "Coincidir por: rol requerido / rol de la persona / ambos". Siempre se usa
>   *Ambos*. Si hace falta, se agrega un campo `roleMatch` en `Filters`.
> - De paso, `TimelineView` lee `resources` y `roles` del hook del store en vez de `getState()`, que no
>   se actualizaba en pantalla si cambiaban.
> - Verificado con el rol QA: 9 de 45 items resaltados (lo mismo que da el cálculo directo sobre los datos),
>   Resources muestra a Cristian y Macarena, y Costs da S/56,976 = 37,632 + 19,344.
>
> Plan original de referencia:

**Pregunta que responde:** "¿Cuánta demanda de Backend hay y quién la cubre?"

**Regla** (dos lados del rol, hay que dejarlo explícito en la UI):
- Un item coincide con el rol R si `requiredRoles` incluye R, **o** si alguna persona asignada tiene
  `role === R`. Los items con `requiredRoles` vacío solo coinciden por asignación.
- Timeline y Cross: atenuar (`'dim'`), igual que en F4.
- Resources: filas de las personas con `role ∈ filters.roles`.
- Costs: costo de las asignaciones de personas con ese rol.

**UI**
- Chip **Roles** con el ícono de cada rol (`src/data/roleIcons.ts`, catálogo `roles` del store).
- Un toggle dentro del chip: "Coincidir por: [Rol requerido] [Rol de la persona] [Ambos]".
  El default es *Ambos*. Si complica mucho, dejar solo *Ambos* y anotarlo.

**Relación con F4:** Personas y Roles se combinan con AND. Por ejemplo "Backend" + "Ana"
muestra los items de Ana que además son de Backend.

**Criterios de aceptación**
- Un item que requiere "Designer" pero tiene asignado a un "Frontend" aparece con los
  dos filtros: con Designer por el rol requerido y con Frontend por la persona.
- Si se borra un rol en Settings → Roles, sale del filtro.

---

## F6 · Filtro por Tipo de item `[x]`

> **Hecho.** Resumen de lo implementado:
> - `itemMatch` oculta los items cuyo tipo no está en `filters.types`, y `hidesItems` lo incluye, así que
>   Timeline y Cross compactan filas, omiten lanes vacíos y muestran el estado vacío igual que con Estado.
> - `TypeFilter.tsx`: chip con los 4 tipos y el atajo "Vista ejecutiva" (epic, milestone, release).
> - Refactor: el botón de atajo que estaba repetido en Proyectos, Estado y Tipo pasó a ser `FilterShortcut`,
>   exportado desde `FilterChip.tsx`.
> - Verificado: "Vista ejecutiva" deja las 6 barras de milestones y releases (los datos actuales no tienen
>   epics: 39 tasks, 3 milestones y 3 releases). Los atajos de Estado (35 barras) y Proyectos siguen funcionando.
>
> Plan original de referencia:

**Pregunta que responde:** "Vista ejecutiva: solo hitos y releases" o "solo epics".

**Cambios**
- `filters.types`, que oculta. Chip **Tipo** con 4 opciones.
- Atajo "Vista ejecutiva" = `['milestone', 'release', 'epic']`.
- Los items de duración 0 (milestone o release) no suman carga ni costo. Filtrarlos no cambia las métricas, y es correcto que así sea.

**Criterios de aceptación**
- Con solo milestone y release, el Timeline muestra los diamantes en filas compactas.

---

## F7 · "Solo con problemas" `[x]`

> **Hecho.** Resumen de lo implementado:
> - `roadmapUtils.ts` tiene tres helpers nuevos:
>   - `dependencyIssues(items, deps)`: se extrajo de `TimelineView`, que ahora lo usa.
>   - `overloadedItemIds(items, resources)`: carga diaria por persona contra su disponibilidad, en los días que dura el item.
>   - `roleMismatch(item, resource)`: `RightPanel` ahora lo usa en lugar de repetir la regla.
> - `filters.ts` tiene `itemIssues()`, que devuelve un `Map<itemId, IssueKind[]>` con los tipos
>   `'dependency' | 'overload' | 'role' | 'risk'`. `itemMatch` oculta los items sin problemas cuando
>   `onlyIssues` está activo, y `hidesItems` lo incluye.
> - Hook nuevo, `src/lib/useFilterContext.ts`: arma el `FilterContext` (filters, visible, resources, issues)
>   con memo, así los problemas se recalculan solo cuando cambian los datos. Las 6 vistas y paneles lo usan
>   en vez de armar el contexto a mano.
> - `IssuesToggle.tsx`: botón "Solo problemas N". N es cuántos items se verían al activarlo, respetando los
>   demás filtros.
> - Hover card del Timeline: además de "Conflicto", muestra "Sobrecarga" y "Rol distinto".
> - **No se hizo** el link desde el `AnalysisModal` ("Ver en el Timeline"). Queda como mejora opcional.
> - Verificado: el contador muestra 8, igual que el cálculo independiente sobre los datos (4 por sobrecarga,
>   5 por rol distinto, 0 por dependencias, 0 en riesgo; algunos items tienen más de un problema).
>
> Plan original de referencia:

**Pregunta que responde:** "Muéstrame solo lo que necesita atención".

**Qué cuenta como problema** (cálculo en el cliente, sin llamar a `/api/analyze`):
1. **Conflicto de dependencias o ciclo.** Hoy se calcula dentro de `TimelineView.tsx` (~líneas 125–150,
   `depAdj`, `depCycles`, `conflictedIds`). **Extraerlo** a
   `roadmapUtils.ts` como `dependencyConflicts(items, deps): Set<string>` y
   usarlo en Timeline y en `filters.ts`.
2. **Persona sobrecargada durante el item.** Algún `assignments[].r` cuya carga diaria total
   supera `resourceCapacity(r)` en algún día del rango del item. Crear
   `overloadedItemIds(items, resources): Set<string>` en `roadmapUtils.ts`, que reutiliza
   la lógica de `resPeak` / `isOverloaded`, pero por día y no solo como pico global.
3. **Rol no compatible.** Hay alguna asignación con `requiredRoles.length > 0 && !requiredRoles.includes(r.role)`.
   Es la misma regla que `RightPanel.tsx:111` (`roleMismatch`). Extraerla a un helper
   `roleMismatch(item, resource)` y usarla en los dos lugares.
4. **Estado At Risk.**

**Cambios**
- `derived` en el `ctx` de `filters.ts`, memoizado con `useMemo` en cada vista (o un selector
  compartido `useFilterContext()` en `src/lib/filters.ts` o un hook aparte, para no recalcular 4 veces).
- Toggle **"Solo con problemas"** en el `FilterBar`, con el contador al lado ("⚠ 7").
- Tooltip o `title` en cada barra que explique por qué aparece (conflicto, sobrecarga, rol).
- Opcional: link desde el `AnalysisModal`. En cada hallazgo (`engine/findings.ts`, `ItemRef`)
  poner un botón "Ver en el Timeline" que aplique `focusItemId` o un filtro por esos ids. Si se
  hace, agregar `filters.itemIds?: string[]` como filtro temporal.

**Nota:** el motor (`engine/analyzers/*`) tiene reglas más completas (idle, sprint spillover, critical path).
Este filtro usa a propósito solo las señales baratas y en vivo. Documentar la diferencia.

**Criterios de aceptación**
- Arrastrar una tarea hasta crear un conflicto la hace aparecer en el filtro al instante.
- El contador del toggle coincide con el número de items que se muestran.

---

## F8 · "Sin asignar" / "Rol sin cubrir" `[x]`

> **Hecho.** Resumen de lo implementado:
> - `Filters.uncovered` es nuevo (se suma a `unassigned`). `filters.ts` exporta `isUnassigned(item)` e
>   `isRoleUncovered(item, resources)`. Los dos filtros ocultan items, se combinan con OR entre sí y con AND
>   con el resto. `hidesItems` los incluye, y en el badge cuentan como un solo filtro.
> - `GapsFilter.tsx`: chip "Huecos" que reutiliza `FilterChip` con dos opciones. Cada opción muestra cuántos
>   items dejaría a la vista, respetando los demás filtros.
> - **No se hizo** el resumen de demanda sin cubrir por rol en Resources ("Backend: 3 items / 18 días").
>   Conviene hacerlo como tarea aparte, junto con un análisis de capacidad por rol.
> - Verificado contra los datos: 8 sin asignar, 5 con rol sin cubrir y 13 con cualquiera de los dos.
>   Lo de crear un item desde el menú contextual no se probó en el navegador, para no modificar el escenario
>   real. La regla lo cubre, porque un item nuevo tiene `assignments: []`.
>
> Plan original de referencia:

**Pregunta que responde:** "¿Qué huecos tiene el plan?"

**Reglas**
- **Sin asignar:** `type` es `epic` o `task`, `dur > 0` y `assignments.length === 0`.
  Los milestones y releases no cuentan.
- **Rol sin cubrir:** `requiredRoles.length > 0` y ninguna persona asignada tiene un rol incluido
  (o sea, no hay asignaciones o todas son incompatibles).

**UI:** dos toggles dentro de un chip **Huecos** (o dentro de "+ Más"). Se combinan con
OR entre sí y con AND con el resto.

**Extra de valor:** en Resources, si el filtro "Rol sin cubrir" está activo, mostrar arriba
un resumen del tipo "Backend: 3 items / 18 días sin cubrir". Esto anticipa el análisis de capacidad por rol,
así que evaluar si conviene hacerlo en esta tarea o en una aparte.

**Criterios de aceptación**
- Un item nuevo creado desde el menú contextual (sin asignaciones) aparece en "Sin asignar".

---

## F9 · Ruta de dependencias de un item `[x]`

> **Hecho.** Resumen de lo implementado:
> - `dependencyChain(itemId, deps)` en `filters.ts` recorre los predecesores y sucesores transitivos, y es
>   seguro ante ciclos. `useFilterContext` lo memoiza como `ctx.chain`, e `itemMatch` atenúa lo que queda
>   fuera de la cadena.
> - Timeline: mientras hay una ruta activa se dibujan **solo** las flechas de la cadena, aunque el toggle
>   de dependencias esté apagado. La preferencia `showDeps` no cambia.
> - Se activa desde el menú contextual ("Ver ruta de dependencias") o desde el panel del item (un link bajo
>   "Depende de", solo en items ya guardados).
> - `PathChip.tsx` muestra "Ruta: <título> ✕". Se sale con ✕, con Esc (se ignora si hay un menú, un diálogo
>   o un campo de texto con foco) o con Restablecer. Si se borra el item, `pruneFilters` limpia la ruta.
> - Verificado con "Merge 23.7": 10 items resaltados, igual que el cálculo sobre los datos, y 11 flechas.
>   Esc restaura la vista.
> - Pendiente para F14: con todos los chips, la barra de filtros ya ocupa casi todo el ancho.
>
> Plan original de referencia:

**Pregunta que responde:** "Si esta tarea se atrasa, ¿qué arrastra?" y "¿de qué depende?"

**Cambios**
- `filters.focusItemId`. En `filters.ts`, `dependencyChain(itemId, deps)` devuelve
  `{ upstream: Set, downstream: Set }` recorriendo `deps` en las dos direcciones (con protección contra ciclos).
- Todo lo que queda fuera de la cadena se atenúa (no se oculta, para mantener la posición en el tiempo).
- Se activa desde el menú contextual de un item (`ContextMenu.tsx`: "Mostrar ruta de dependencias")
  y desde el `RightPanel` del item. Se sale con Esc, con "Restablecer" o con un chip "Ruta: <título> ✕".
- Mientras la ruta está activa, se fuerza `showDeps = true` solo para esa vista, **sin** cambiar la preferencia guardada.
  Otra opción es dibujar solo las flechas de la cadena.

**Criterios de aceptación**
- En una cadena A → B → C, al enfocar B se resaltan A, B y C, y lo demás queda atenuado.
- Un ciclo no cuelga la app.

---

## F10 · Persistir los filtros en la vista `[x]`

> **Hecho.** Resumen de lo implementado:
> - `PersistedFilters` (en `types`) es `Filters` sin `focusItemId` ni `text`. `ViewState` ahora incluye
>   `filters` y `hiddenProjectIds`.
> - `viewFile.ts` agrega `sanitizeFilters` y `sanitizeIds`, que se usan al leer y al escribir. La ruta PUT
>   ya no rechaza payloads sin esos campos: los sanitiza. Así un `view.json` viejo carga con los defaults.
> - `viewPayload.ts` arma el body en un solo lugar, y lo usan el hook de persistencia y `scenarioActions`.
>   El `subscribe` guarda cuando cambian las fechas, `filters` o `visible`.
> - Boot: ahora el orden es escenario activo → lista → datos → `hydrateView`. La vista se aplica después de
>   los datos para poder descartar ids inexistentes (`pruneFilters`) y ocultar solo proyectos que existen.
> - Decisión: los filtros son **globales**. Al cambiar de escenario, `hydrateScenario` mantiene ocultos los
>   proyectos que el nuevo escenario también tiene (los escenarios duplicados comparten ids).
> - `docs/persistence.md` tiene una sección nueva sobre `view.json`. El resto de ese doc está desactualizado
>   desde que existen escenarios; se marcó con una nota y queda para F14.
> - Verificado: Estado + Persona + un proyecto oculto sobreviven al recargar. Un PUT con valores inválidos
>   se guarda sanitizado.
>
> Plan original de referencia:

**Objetivo:** que al recargar se mantengan los filtros, como ya pasa con el rango de fechas.

**Cambios**
1. `viewFile.ts`: `ViewState` agrega `filters?: Filters` y `hiddenProjectIds?: string[]`.
   Se guarda la lista de **ocultos** y no la de visibles, para que los proyectos nuevos aparezcan por defecto.
   Al leer, completar lo que falte con los defaults (compatibilidad con `view.json` viejos).
2. `api/view/route.ts`: ampliar `isValidViewState` (con validación de tipos, sin confiar en el body).
3. `useRoadmapPersistence.ts`:
   - `saveView` envía también `filters` y `hiddenProjectIds`.
   - El `subscribe` dispara el guardado cuando cambian `filters` o `visible` (hoy solo mira las fechas).
   - En el boot, aplicar la vista **después** de cargar el escenario y limpiar los ids que ya no existen.
4. `store.hydrateView` acepta los campos nuevos.
5. `scenarioActions.ts:7` también manda el view. Actualizarlo.
6. **Decisión:** ¿los filtros son por escenario o globales? Recomendación: **globales**, que
   es como funciona hoy el rango de fechas. Si al cambiar de escenario desaparecen ids, se limpian solos.
7. `focusItemId` y `text` **no** se persisten, porque son efímeros.
8. Actualizar `docs/persistence.md`.

**Criterios de aceptación**
- Filtrar por Ana + At Risk y recargar deja la misma vista.
- Un `view.json` sin los campos nuevos sigue cargando.

---

## F11 · Vistas guardadas (presets) `[x]`

> **Hecho.** Resumen de lo implementado:
> - Tipos nuevos: `ViewSnapshot` (fechas, `PersistedFilters`, `hiddenProjectIds`) y `SavedView` (snapshot + `id` y
>   `name`). El store tiene `savedViews`, `activeViewId` y las acciones `applyView`, `saveCurrentView`,
>   `renameSavedView` y `deleteSavedView`. `clearFilter` borra `activeViewId`.
> - `filters.ts` agrega `persistedFilters`, `currentViewSnapshot`, `sameViewSnapshot` (compara sin importar el
>   orden, para marcar "(modificada)") y `BUILTIN_VIEWS`. Las vistas predefinidas son "Riesgos y problemas"
>   (solo problemas), "Ejecutiva" (epic, milestone, release) y "Huecos" (sin asignar + rol sin cubrir), y
>   parten del plan completo, sin fechas ni proyectos ocultos. Cambio respecto al plan: "Riesgos" no
>   combina At Risk con Solo problemas, porque At Risk ya es un tipo de problema.
> - Aplicar una vista reemplaza fechas, filtros y proyectos ocultos (`snapshotState`, compartido con
>   `hydrateView`) y descarta ids que no existen en el escenario.
> - `view.json` guarda `savedViews`, sanitizadas con `sanitizeSavedViews`. `viewPayload` usa
>   `currentViewSnapshot`, así que ya no duplica la lista de campos.
> - `ViewsMenu.tsx`: primer botón del `FilterBar`, con secciones Predefinidas / Mis vistas (aplicar, renombrar
>   en línea, borrar) y un campo para guardar la vista actual.
> - `activeViewId` no se persiste: al recargar, el menú vuelve a decir "Vistas" aunque los filtros sigan aplicados.
> - Verificado: la vista predefinida aplica Tipo · 3 (6 barras) y cambiar un filtro la marca como
>   "(modificada)". Una vista propia se guardó, sobrevivió a una recarga y restauró Roles · 1 después de
>   Restablecer. Renombrar y borrar también funcionan.
>
> Plan original de referencia:

**Depende de:** F10.

**Objetivo:** guardar combinaciones con nombre ("Equipo Backend Q4", "Riesgos", "Ejecutivo").

**Cambios**
- Tipo `SavedView { id, name, dateRange, filters, hiddenProjectIds }`.
- Se guardan en `view.json` (lista `savedViews`), porque son globales como el resto de la vista.
- UI: dropdown "Vistas ▾" al inicio del `FilterBar`: aplicar, guardar la actual, renombrar, borrar.
  Se puede usar el `ScenarioSwitcher.tsx` como referencia de estilo.
- Presets de fábrica, no editables: "Riesgos" (At Risk + solo con problemas), "Ejecutivo"
  (milestone, release, epic) y "Huecos" (sin asignar + rol sin cubrir).
- Si los filtros actuales ya no coinciden con el preset aplicado, mostrar "Nombre (modificada)".

**Criterios de aceptación**
- Guardar, recargar y aplicar devuelve exactamente el mismo estado de filtros.

---

## F12 · Búsqueda por texto `[x]`

> **Hecho.** Resumen de lo implementado:
> - `filters.ts`: `normalizeText` (minúsculas, sin acentos) y `matchesText`, que busca en el título y en el
>   nombre del proyecto. `itemMatch` atenúa lo que no coincide. `FilterContext` ahora incluye `projects`.
> - `SearchBox.tsx` es el primer control de los chips del `FilterBar`. Tiene estado local con debounce de
>   150 ms y se sincroniza cuando el texto cambia desde afuera (Restablecer, aplicar una vista). Muestra el
>   contador ("5" o "2/5"). El contador y Enter usan el valor tipeado, así que no esperan el debounce.
> - Enter salta a la siguiente coincidencia dibujada en la vista (Shift+Enter a la anterior), en orden
>   temporal. Solo desplaza el contenedor `.overflow-auto` de la vista (`scrollIntoView` corría ancestros y
>   cortaba la columna fija) y marca el item con un destello. Cross ahora pone `data-item-id` en sus
>   barras y ticks.
> - `/` y Cmd/Ctrl+F ponen el foco en el campo, salvo si ya se está escribiendo o hay un diálogo abierto.
>   Esc borra la búsqueda.
> - Verificado: "merge" deja 5 barras resaltadas y 38 atenuadas, y Enter recorre las coincidencias.
>   "certificacion" encuentra "Certificación" y "prevencion" los 12 items del proyecto. También funciona
>   en Cross. Restablecer y Esc limpian el campo.
> - Pendiente: cambiar solo el texto dispara un guardado de `view.json` con el mismo contenido. No
>   afecta el comportamiento.
>
> Plan original de referencia:

- `filters.text`, con debounce de ~150 ms. Busca en `item.title` y en el nombre del proyecto,
  sin distinguir mayúsculas ni acentos (`normalize('NFD')`).
- Los items que coinciden se resaltan y el resto se atenúa. Enter centra el scroll en el primero y
  Enter otra vez va al siguiente.
- Atajo `/` o `Cmd+F` para enfocar el input, sin interferir con `useUndoShortcuts`.
- No se persiste.

---

## F13 · Filtros por voz / agente `[ ]`

**Contexto:** el agente de voz (`src/lib/agent/shared.ts`, con tools como `go_to_date`,
`show_resource`…) y el ejecutor `src/lib/voice/useVoiceCommand.ts`.
Ver `docs/voice-agent.md`.

**Cambios**
- Tool nueva `set_filters` con `{ projectIds?, resourceIds?, roles?, statuses?, types?, onlyIssues?, unassigned?, clear? }`,
  usando enums con los ids y roles reales (igual que `roleEnum` en `shared.ts:173`).
- Implementarla en los dos proveedores (`providers/anthropic.ts`, `providers/ollama.ts`) si
  tienen listas de tools separadas.
- Ejemplos de prueba: "muéstrame solo lo de Ana", "qué está en riesgo en el proyecto X",
  "quita los filtros".
- Toast de confirmación con el resumen de lo aplicado.

---

## F14 · Pulido y documentación `[ ]`

- `docs/filters.md` (nuevo): reglas de cada filtro, la tabla de ocultar/atenuar y qué métricas
  respetan filtros y cuáles no.
- Actualizar `docs/timeline-view.md`, `docs/cross-view.md`, `docs/resources-view.md`,
  `docs/components.md` y `ARCHITECTURE.md`.
- Revisar el responsive del `FilterBar` (hay commits recientes de ajustes responsive en el toolbar):
  en pantallas angostas, los chips se agrupan en "Filtros · N".
- Estado vacío: si los filtros no dejan nada visible, mostrar el mensaje
  "Ningún item coincide con los filtros" con el botón **Restablecer** en cada vista.
- Revisar todas las traducciones `es` nuevas.

---

## Orden sugerido y dependencias

```
F1 ──► F2 ──► F3 ──► F4 ──► F5 ──► F6
                         └─► F7 ──► F8
                         └─► F9
F1..F8 ──► F10 ──► F11
F12, F13 y F14 en cualquier momento después de F4
```

| Tarea | Tamaño aprox. | Valor |
|---|---|---|
| F1 Base | M | Habilita todo |
| F2 Proyectos | M | Alto (corrige una inconsistencia actual) |
| F3 Estado | S | Alto |
| F4 Personas | M | Alto |
| F5 Roles | M | Alto |
| F6 Tipo | S | Medio |
| F7 Solo problemas | L | Muy alto para análisis |
| F8 Huecos | S | Alto |
| F9 Ruta de dependencias | M | Medio-alto |
| F10 Persistencia | S | Medio |
| F11 Presets | M | Medio |
| F12 Búsqueda | S | Medio |
| F13 Voz | S | Bajo-medio |
| F14 Pulido/docs | S | Necesario |
