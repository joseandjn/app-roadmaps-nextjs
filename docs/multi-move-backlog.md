# Backlog: Mover varias tareas a la vez

Dos formas de reprogramar más de una tarea, pedidas el 2026-09-29:

1. **Mover la selección:** arrastrar (o mover con el teclado) una tarea seleccionada
   mueve todas las seleccionadas los mismos días.
2. **Mover con dependientes:** mover una tarea junto con todo lo que depende de ella,
   en cadena, sin tener que seleccionarlo a mano.

> Estado: `[ ]` pendiente · `[~]` en curso · `[x]` hecha
>
> **Estado general:** M1–M4 hechas el 2026-09-29. Plan armado el 2026-09-29 sobre `main` en `ea15e16`.

---

## Resumen

| Tarea | Qué logra | Estimado |
|---|---|---|
| M1 | Arrastrar una tarea seleccionada mueve todas las seleccionadas | 0,5 día |
| M2 | ← / → mueven la selección 1 día; Shift + ← / →, 1 semana | 0,25 día |
| M3 | ⌥ + arrastrar mueve la tarea con sus dependientes; "Seleccionar con dependientes" en el menú | 0,5 día |
| M4 | Pruebas y documentación | 0,25 día |

---

## Decisiones

1. **Todas se mueven los mismos días**, así se mantienen las distancias entre ellas.
   Funciona entre proyectos distintos y con hitos.
2. **Con varias tareas, el arrastre es solo horizontal.** Las filas son por proyecto;
   mover varias en vertical queda fuera (ver "Fuera de este plan").
3. **Se mueve lo que se ve:** de la selección, solo las tareas que muestran los filtros.
   Una tarea seleccionada que después quedó oculta por un filtro no se mueve sin que
   la veas.
4. **Arrastrar una tarea que no está en la selección mueve solo esa**, como hoy.
   Cambiar la duración (borde derecho) siempre es de una sola tarea.
5. **Dependientes = todo lo que depende de la tarea, en cadena** (si B depende de A y C
   de B, mover A con dependientes mueve A, B y C). Se incluyen aunque estén en
   proyectos ocultos, porque son parte de la cadena; el aviso dice cuántas se movieron.
6. **⌥ (Option) + arrastrar** mueve con dependientes. Shift ya está tomado por la
   selección. El menú contextual ofrece además "Seleccionar con dependientes", para
   después moverlas con el mouse o el teclado.
7. **Un arrastre = un paso de deshacer**; cada pulsación de flecha, también.
8. **El aviso al soltar** cuenta cuántas tareas se movieron y los conflictos nuevos
   (dependencias que ahora chocan y personas que quedan sobreasignadas).
9. **El cierre real no cambia al mover** (`completedDay`): mover una tarea terminada
   cambia su duración real, igual que hoy con una sola tarea.

---

## Contexto (leer antes de cualquier tarea)

- `startDrag(id, mode, clientX, rows)` en `src/store/useRoadmapStore.ts`: cada
  movimiento del puntero parte del estado al empezar el arrastre (`before`), así ir y
  volver no acumula; `beginGesture`/`endGesture` hacen de todo el gesto un solo paso
  de deshacer; `didDrag()` evita que soltar cuente como clic.
- `computeImpact` calcula el impacto de **una** tarea (dependencias y personas). Para
  varias hace falta comparar el plan completo antes y después.
- Dependencias: `Dependency { from, to }`, `from` depende de `to`. Los dependientes de
  X son las tareas con `to = X`, y así en cadena. Puede haber ciclos
  (`dependencyIssues` los marca): el recorrido tiene que cortarlos.
- Selección: `selectedIds` en el store, `onBarClick` en `TimelineView.tsx` (Cmd/Ctrl/
  Shift + clic no arrastra), teclas en `SelectionBar.tsx` (Esc, Enter).
- Tests puros con `npm run lib:test`; i18n en `src/lib/i18n/translations.ts`.

---

## M1 · Arrastrar la selección `[x]`

- `startDrag` recibe un grupo de ids. Si la tarea arrastrada está en la selección y
  hay 2 o más visibles, el grupo son esas; si no, solo ella.
- Con grupo: todas se mueven los mismos días desde su posición inicial; el movimiento
  vertical se ignora. Si el panel está abierto sobre una de ellas, su borrador también
  se actualiza.
- Aviso: "N tareas reprogramadas · M conflictos".

**Criterios:** arrastrar una de tres seleccionadas mueve las tres igual; Cmd+Z las
vuelve a su lugar en un paso; una tarea no seleccionada sigue moviéndose sola.

## M2 · Mover con el teclado `[x]`

- ← / → mueven la selección visible 1 día; Shift + ← / →, 7 días. No actúa si el
  foco está en un campo, un botón o un diálogo.

**Criterios:** cada pulsación mueve y se puede deshacer; las flechas no desplazan la
vista del timeline mientras hay selección.

## M3 · Mover con dependientes `[x]`

- Módulo puro `dependentsOf(deps, id)` (en cadena, con corte de ciclos) con tests.
- ⌥ + arrastrar una tarea: el grupo es la tarea más sus dependientes.
- Menú contextual de una tarea: "Seleccionar con dependientes".

**Criterios:** A ← B ← C: ⌥ + arrastrar A mueve las tres; con un ciclo no se cuelga;
el menú selecciona la cadena completa.

## M4 · Pruebas y documentación `[x]`

- Probar en la app sobre una copia de los datos: selección entre proyectos, con
  filtros, con el panel abierto, deshacer, teclado, ⌥ + arrastrar.
- Actualizar `docs/timeline-view.md` y este backlog.

**Cómo quedó:** `src/lib/dependents.ts` (tests en `dependents.test.ts`); en el store,
`startDrag(…, group)`, `nudgeItems` y `newConflicts`; el grupo se arma en
`TimelineView.tsx` (`dragGroup`); flechas en `SelectionBar.tsx`; "Seleccionar con
dependientes" en `ContextMenu.tsx`. Probado sobre una copia de los datos, verificando
los días guardados:
- Selección de 3 tareas en 3 proyectos distintos arrastrada → las 3 +10 días, nada más
  cambió; Cmd+Z las devolvió en un paso.
- → y Shift + → → +8 días en las 3; deshacer, dos pasos.
- ⌥ + arrastrar "Desarrollo Backend" → las 7 de la cadena +11 días, aviso "7 tareas
  reprogramadas, sin conflictos".
- "Seleccionar con dependientes" selecciona las 7; arrastrar una tarea fuera de la
  selección mueve solo esa.

---

## Fuera de este plan

- Mover varias tareas en vertical (cambiar de fila en bloque).
- Cambiar la duración de varias a la vez.
- Diálogo "Mover N días / a tal fecha".
