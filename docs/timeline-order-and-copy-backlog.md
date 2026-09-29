# Backlog: Orden manual en el timeline y copia de tareas entre roadmaps

Dos mejoras pedidas el 2026-09-29:

1. **Orden vertical:** que las tareas queden en la fila donde las pones al
   arrastrarlas de arriba a abajo, en vez de que la app decida la fila sola.
2. **"Súper copia":** seleccionar varias tareas de un roadmap (escenario) y
   llevarlas a otro.

Cada tarea incluye el contexto, los archivos y los criterios para poder retomarla
sin volver a investigar.

> Estado: `[ ]` pendiente · `[~]` en curso · `[x]` hecha
>
> **Estado general:** parte 1 (O1–O4) hecha el 2026-09-29; sigue la parte 2. Plan armado el 2026-09-29 sobre `main` en `6dcbbed`.

---

## Resumen

| Parte | Qué logra | Tareas | Estimado (1 persona) |
|---|---|---|---|
| **1 · Orden manual** | Arrastrar una tarea hacia arriba o abajo la deja en esa fila; las demás se mantienen. Se puede volver al orden automático. | O1–O4 | 2 días |
| **2 · Copiar a otro roadmap** | Seleccionar varias tareas y copiarlas a otro escenario, con su proyecto, personas y dependencias. | S1–S5 | 3–4 días |

La parte 1 va primero: es más chica y se nota al instante.

---

## Decisiones

1. **Fila guardada en la tarea.** `Item.lane?: number` (fila dentro de su
   proyecto, desde 0). Opcional: los datos actuales no cambian y siguen con el
   orden automático hasta que se mueva algo en vertical.
2. **Soltar sobre una fila ocupada inserta:** la tarea queda donde la soltaste y
   la que ocupaba esas fechas en esa fila baja una fila.
3. **Congelar al primer movimiento vertical.** La primera vez que mueves una tarea
   en vertical dentro de un proyecto, todas las tareas visibles de ese proyecto
   guardan la fila en la que se ven. Si no, al fijar una las demás se
   reacomodarían y parecería que saltan.
4. **Tareas sin fila** (nuevas, o las que estaban ocultas por un filtro al
   congelar) van a la primera fila libre, como hoy.
5. **Filas vacías se compactan.** Si un filtro oculta tareas, no quedan huecos;
   el orden relativo se mantiene.
6. **"Orden automático"** por proyecto borra las filas guardadas y vuelve al
   comportamiento actual.
7. **Copiar una tarea que ya existe en el destino la reemplaza** (decidido el
   2026-09-29). Los escenarios duplicados comparten ids, así que es la misma tarea:
   copiarla lleva los cambios al otro roadmap.
8. **Lo que falte en el destino viaja con la tarea:** proyecto, personas
   asignadas (con sus ausencias) y roles. Las dependencias entre tareas copiadas
   se copian; las que apuntan a tareas que no existen en el destino se descartan
   con aviso.
9. **Checkpoint antes de copiar.** El destino guarda un checkpoint "Antes de copiar
   desde X": el deshacer de tu pestaña no alcanza a otro escenario.

---

## Contexto (leer antes de cualquier tarea)

**Filas del timeline**
- `pack(list, ppd)` (`src/lib/roadmapUtils.ts:139`) ordena por `startDay` y pone
  cada tarea en la primera fila libre, en píxeles: una barra ocupa
  `dur * ppd` (mín. 7 px) y un hito o release, 132 px por su etiqueta, más 8 px de
  margen. Por eso la ocupación depende del zoom.
- La usan `TimelineView.tsx:173` (por proyecto, sobre las tareas visibles según
  los filtros) y `CrossView.tsx:75` (proyecto expandido).
- En el timeline, cada fila mide `ROW = 32` px; la barra, `BAR_H = 22`.

**Arrastre**
- `startDrag(id, mode, clientX)` en `src/store/useRoadmapStore.ts` solo mira el eje
  X. Usa `beginGesture`/`endGesture` para que todo el arrastre sea un solo paso de
  deshacer, y `dragMoved`/`didDrag()` para que soltar no abra el panel.
- Si el panel de la tarea está abierto, el arrastre también actualiza el
  borrador (`draft`). `commitItem` guarda el borrador entero: un campo que el panel
  no edita (como `lane`) tiene que tomarse de la tarea actual, no del borrador.

**Escenarios**: ver `docs/persistence.md`. Cada escenario es un JSON completo en
`storage/scenarios/<id>.json`, con revisión (`ETag`) y cola de escritura por
escenario (`scenarioFile.ts`). Checkpoints en `checkpointFile.ts`.

**Entorno**: i18n en `src/lib/i18n/translations.ts`; tests puros con
`npm run lib:test`; antes de rutas nuevas, leer `node_modules/next/dist/docs/`.

---

## Parte 1 · Orden manual

### O1 · Filas guardadas `[x]`

- `lane?: number` en `Item`.
- Módulo puro `src/lib/lanes.ts`: primero ubica las tareas con fila (por fila y
  luego por inicio; si su fila está ocupada en esas fechas, baja a la siguiente
  libre), después las que no tienen fila en la primera libre, y al final compacta
  las filas vacías. Devuelve la fila visible y la fila guardada de cada tarea, y
  qué fila guardada representa cada fila visible.
- `pack()` lo usa, así Timeline y Cross respetan el orden.
- Tests con `node --test`.

**Criterios:** sin `lane` el resultado es igual al de hoy; con `lane` cada tarea
queda en su fila o, si choca, en la siguiente libre; los filtros no dejan huecos.
**Estimado:** 0,5 día.

### O2 · Arrastrar en vertical `[x]`

- `startDrag` recibe también la posición Y y la distribución de filas del
  proyecto (desde `TimelineView`). Mover medio alto de fila o más cambia de fila;
  se puede mover en horizontal y vertical a la vez.
- Al primer cambio de fila, congela las filas del proyecto (decisión 3); la tarea
  toma la fila destino y las que chocan en esa fila bajan una (decisión 2). Se
  calcula desde el estado al empezar el arrastre, así ir y volver no acumula
  cambios.
- Se puede soltar una fila por debajo de la última (fila nueva); no por encima de
  la primera.
- `commitItem` conserva la `lane` actual de la tarea (el panel no la edita).
- Mover solo en vertical no muestra el aviso de "reprogramado".

**Criterios:** mover una tarea a otra fila y recargar la deja ahí; las demás no
cambian de fila salvo la que se desplaza; Cmd+Z lo revierte en un paso; el
arrastre horizontal sigue igual.
**Estimado:** 1 día.

### O3 · Volver al orden automático `[x]`

- En el modal del proyecto, si alguna tarea tiene fila guardada: "Volver al orden
  automático" borra las filas de ese proyecto.

**Criterios:** después de usarlo, el proyecto se ve como antes de mover nada.
**Estimado:** 0,25 día.

### O4 · Pruebas y documentación `[x]`

- Probar en la app sobre una copia de los datos: mover en vertical, en diagonal,
  a una fila nueva, con filtros activos, con el panel abierto, deshacer.
- Actualizar `docs/timeline-view.md`.

**Estimado:** 0,25 día.

**Cómo quedó (parte 1):** probado en la app sobre una copia de los datos: subir y
bajar filas (también dos filas de una vez), recargar, deshacer, arrastre
horizontal, "Orden automático" y guardar el panel después de arrastrar con el panel
abierto. Diferencia con lo planeado: la tarea desplazada puede a su vez empujar a
otra solo visualmente (por ejemplo, la etiqueta de un hito que choca con la barra
de al lado); queda guardada en su fila y se ve una más abajo mientras choque.

---

## Parte 2 · Copiar a otro roadmap

### S1 · Selección múltiple `[ ]`

- Cmd/Ctrl + clic o Shift + clic en una barra la agrega o quita de la selección
  (sin abrir el panel). "Seleccionar tareas" en el menú contextual del proyecto
  selecciona todas las visibles.
- Barra flotante: "N seleccionadas · Copiar a… · Limpiar". Esc limpia.
- La selección no se guarda ni entra en el deshacer.

**Criterios:** seleccionar y deseleccionar no modifica datos; clic normal sigue
abriendo el panel.
**Estimado:** 1 día.

### S2 · Copia en el servidor `[ ]`

- `POST /api/scenarios/[id]/import` con `{ items, deps, projects, resources, roles, sourceName }`,
  dentro de la cola de escritura del destino:
  - Tareas: agrega las nuevas y reemplaza las que ya existen (decisión 7).
  - Proyectos, personas y roles: agrega solo los que faltan (no pisa los del
    destino).
  - Dependencias: agrega las que tienen sus dos extremos en el destino; devuelve
    las descartadas.
  - Crea antes el checkpoint (decisión 9).
- Lógica en un módulo puro con tests; la ruta solo lee, aplica y escribe.

**Criterios:** copiar tareas nuevas y existentes da el resultado esperado; el
checkpoint permite volver atrás; una escritura concurrente no se pierde.
**Estimado:** 1 día.

### S3 · Diálogo "Copiar a…" `[ ]`

- Lista de escenarios (sin el actual). Al elegir uno, un resumen calculado con el
  mismo módulo de S2: "3 nuevas, 1 se reemplaza, 1 proyecto y 2 personas se
  agregan, 1 dependencia se descarta".
- Confirmar → S2 → aviso con el resultado y opción de ir a ese escenario.

**Criterios:** el resumen coincide con lo que se aplica; errores con aviso claro.
**Estimado:** 1 día.

### S4 · Recibir la copia en otra pestaña `[ ]`

- Si el destino está abierto en otra pestaña, recibe los cambios con el mecanismo
  de siempre (revisión al enfocar / aviso). Verificar que no se pierde nada si esa
  pestaña tenía cambios sin guardar.

**Estimado:** 0,25 día.

### S5 · Pruebas y documentación `[ ]`

- Probar sobre una copia de los datos: tareas nuevas, existentes, con proyecto
  nuevo, con personas nuevas, con dependencias hacia afuera; restaurar el
  checkpoint.
- Actualizar `docs/persistence.md` y este backlog.

**Estimado:** 0,5 día.

---

## Fuera de este plan

- Reordenar proyectos (filas de proyectos) arrastrando.
- Mover tareas de un proyecto a otro arrastrando en vertical.
- Copiar sprints, feriados o configuración entre escenarios.
- Sincronizar escenarios automáticamente (la copia es una acción puntual).
