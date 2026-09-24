# Backlog: Vacaciones y ausencias

Plan para registrar las vacaciones (y otras ausencias) de cada persona y que el
roadmap las tenga en cuenta. Se hace de a una tarea por vez. Cada tarea incluye el
contexto, los archivos y los criterios para poder retomarla sin volver a investigar.

> Estado: `[ ]` pendiente · `[~]` en curso · `[x]` hecha

---

## Decisiones acordadas

1. **Solo alertar.** Una tarea asignada a alguien durante sus vacaciones no se mueve
   ni se alarga. Se marca como problema: esos días la persona tiene capacidad 0.
2. **Costo configurable.** Una casilla en Configuración → General decide si los días de
   vacaciones descuentan costo. Por defecto **no** descuentan (vacaciones pagadas).
3. **Un solo tipo de ausencia**, con una nota opcional ("vacaciones", "licencia"…).
4. **Por escenario.** Las ausencias viven en cada `Resource` dentro del escenario, como
   el resto de los datos de la persona. Un escenario duplicado las copia.

## Contexto (leer antes de cualquier tarea)

- La capacidad hoy es fija por persona: `Resource.availability` (0–100, falta = 100),
  leída con `resourceCapacity(r)` en `roadmapUtils.ts`. La sobrecarga compara la carga
  diaria contra ese número (`isOverloaded`, `overloadedItemIds`, `resPeak`).
- Los feriados son globales (`settings.holidays`) y solo afectan los días hábiles
  (`isWorkingDay`): costo (`assignmentCostsInRange`) y el sombreado del Cronograma.
- Resources suma por bucket (`ResourcesView.tsx`); los paneles de persona y de celda
  están en `RightPanel.tsx`.
- "Solo problemas" usa `itemIssues()` en `filters.ts`; el hover del Cronograma muestra
  sus badges.
- El motor (`engine/`) recibe el snapshot por `/api/analyze`, valida en `engine/api.ts` y
  calcula la carga en `engine/analyzers/load.ts`. Tiene tests (`npm run engine:test`).
- Fechas: las tareas y sprints usan `startDay` + `dur` (días desde `START_DATE`, fin
  exclusivo). Las ausencias usan lo mismo.
- i18n: cada texto nuevo necesita su traducción `es` en `src/lib/i18n/translations.ts`.

---

## V1 · Modelo y carga de ausencias `[x]`

> **Hecho.** `TimeOff { id, startDay, dur, note? }` y `Resource.timeOff?`. `roadmapUtils.ts` agrega
> `timeOffOn`, `capacityOn` y `sameTimeOff`. El `ResourceModal` tiene la sección "Ausencias": desde y hasta
> (inclusive), nota y días hábiles de cada una. Si el fin queda antes del inicio, se iguala al inicio.
> Al guardar se ordenan por fecha, una lista vacía no se guarda y una nota en blanco se descarta
> (`cleanTimeOff`). El comparador de escenarios muestra "Ausencias: X → Y días". Verificado en el navegador
> sin tocar `storage/` (los guardados se interceptan): 3–14 ago = 10 días hábiles, sobrevive al recargar.

- Tipo `TimeOff { id, startDay, dur, note? }` y `Resource.timeOff?: TimeOff[]`.
- Helpers en `roadmapUtils.ts`: `timeOffOn(r, day)` y `capacityOn(r, day)` (0 si está
  ausente, si no `resourceCapacity(r)`).
- `ResourceModal`: sección "Ausencias" con la lista (desde, hasta inclusive, nota) para
  agregar, editar y quitar. Validar que hasta ≥ desde.
- `rform` y `onRSave` guardan `timeOff`. El resto de acciones que crean personas
  (`agentCreateResource`) no cambian.
- `scenarioDiff.ts` / `ScenarioDiffPanel`: mostrar cambios de ausencias al comparar.

**Criterios:** cargar, editar y borrar una ausencia desde el modal; sobrevive al recargar;
un escenario viejo sin el campo carga igual.

## V2 · Resources muestra las ausencias `[x]`

> **Hecho.** Cada ausencia se dibuja como una franja rayada sobre los días exactos de la fila (con la nota si
> entra), por encima de las celdas y sin bloquear los clics. Una celda con trabajo asignado durante una
> ausencia se pinta como problema (ámbar) y su tooltip dice cuántos días hábiles. Se calcula con todas las
> tareas, igual que la carga total, para que un filtro no lo oculte. Helpers nuevos: `timeOffWorkingDays`
> (cuenta una vez los días de ausencias superpuestas) y `assignedDuringTimeOff`. Panel de la persona:
> ausencias actuales y próximas, con aviso de las tareas asignadas encima. Panel de celda: "Ausente N días
> hábiles en este período (nota)" y un badge en cada tarea afectada. Verificado en Semana y Mes con datos de
> prueba en memoria.

- En la grilla, los días de ausencia se pintan con rayas en la fila de la persona
  (proporcional dentro de cada bucket).
- Si hay carga asignada durante una ausencia, la celda se marca como problema.
- Panel de la persona: lista de próximas ausencias. Panel de celda: aviso si la persona
  está ausente en parte de ese período.

**Criterios:** una ausencia de una semana se ve en la vista Semana y Mes; una tarea
asignada encima marca la celda.

## V3 · Alertas en tareas y filtros `[x]`

> **Hecho.** `IssueKind` `'timeoff'` en `itemIssues` (ahora recibe `settings` para contar días hábiles):
> entra en "Solo problemas" y su contador. `overloadedItemIds` ignora los días de ausencia, que ya se
> reportan como ausencia. `resPeak` y `overallocated` no cambian, porque miden la carga y no la
> capacidad del día. Cronograma: badge "Ausencia" en el hover. Panel de la tarea: "ausente N días" junto al
> asignado, con las fechas en el tooltip; se recalcula al mover las fechas. Verificado: "Solo problemas"
> pasa de 0 a 1 con una ausencia encima de una tarea y vuelve a 0 al quitarla.

- `IssueKind` nuevo, `'timeoff'`: la tarea tiene a alguien asignado en un día hábil de su
  ausencia. Entra en "Solo problemas" y en el conteo.
- Los días de ausencia no cuentan como sobrecarga (ya se reportan como ausencia) en
  `overloadedItemIds`; `computeScenarioMetrics.overallocated` tampoco los suma.
- Cronograma: badge "Ausencia" en el hover de la barra.
- `RightPanel` (tarea): junto al asignado, aviso "ausente N días" con las fechas.

**Criterios:** asignar a alguien en sus vacaciones hace aparecer la tarea en "Solo
problemas" al instante; quitar la ausencia la saca.

## V4 · Costo configurable `[ ]`

- `Settings.timeOffReducesCost?: boolean` (falta = `false`). Casilla en
  Configuración → General: "Las ausencias descuentan costo".
- `assignmentCostsInRange`: si está activa, los días hábiles de ausencia de esa persona
  no suman costo. Costs, KPIs, checkpoints y Compare usan esa misma función.

**Criterios:** con la casilla apagada el total de Costs no cambia; encendida, baja
exactamente el costo diario × % × días de ausencia dentro de la tarea.

## V5 · Motor de análisis `[ ]`

- `engine/api.ts` acepta y valida `timeOff` en cada persona; `domain.ts` lo tipa.
- Hallazgo nuevo `time_off_conflict`: la persona tiene trabajo asignado durante su
  ausencia (ventanas de días hábiles, tareas involucradas). Textos es/en.
- `overload` ignora los días de ausencia (los cubre el hallazgo nuevo); `idle` no cuenta
  la ausencia como capacidad ociosa.
- "Ver en el Cronograma" (`findingItemIds`) soporta el tipo nuevo.
- Tests en `engine/test`.

## V6 · Voz `[ ]`

- Tool `add_time_off { resourceId, startDate, endDate, note? }` ("Ana está de vacaciones
  del 1 al 15 de agosto"). Confirma con un toast.

## V7 · Documentación `[ ]`

- `docs/resources-view.md`, `docs/filters.md` (problemas), `docs/voice-agent.md`,
  `engine/README.md`, `ARCHITECTURE.md`. Revisar las traducciones nuevas.

---

## Orden y dependencias

```
V1 ──► V2 ──► V3 ──► V4
  └──────────► V5
V6 y V7 al final
```
