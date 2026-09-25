# Backlog: Colaboración (varias personas editando a la vez)

Plan para que varias personas trabajen sobre el mismo roadmap al mismo tiempo sin
perder cambios y viendo los de los demás. Se hace de a una tarea por vez. Cada
tarea incluye el contexto, los archivos y los criterios para poder retomarla sin
volver a investigar.

> Estado: `[ ]` pendiente · `[~]` en curso · `[x]` hecha
>
> **Estado general:** sin empezar. Plan armado el 2026-09-25 sobre `main` en `f1c348c`.

---

## Resumen

Tres fases. Cada una se puede integrar y usar por separado.

| Fase | Qué logra | Tareas | Estimado (1 persona) |
|---|---|---|---|
| **0 · Base** | Ids que no chocan, comparación por campo y formularios que guardan solo lo que cambió. Sirve para cualquier nivel. | C1–C4 | 3–4 días |
| **A · Guardados parciales y al instante** (nivel 1) | Solo hay conflicto si dos personas tocan el mismo campo de la misma cosa. Los cambios de otros llegan en el momento. Deshacer revierte solo lo tuyo. Se ve quién está conectado. | C5–C11 | 6–8 días |
| **Punto de decisión D1** | Medir cuánto se edita a la vez antes de invertir en la fase B. | — | — |
| **B · Tiempo real** (nivel 2) | Edición simultánea estilo Google Docs con Yjs: sin conflictos, presencia por tarea y trabajo sin conexión. | C12–C20 | 15–20 días |

Total si se hace todo: **5–6,5 semanas**. Fase 0 + A: **~2 semanas**. La estimación
anterior de "1 a 1,5 semanas" para el nivel 1 no incluía deshacer por persona ni la
presencia, que acá quedan dentro de la fase A porque sin ellas la experiencia con
varias personas es confusa.

**Qué se reutiliza de A en B:** los ids (C1), el módulo de comparación (C2), el
guardado por campo de los formularios (C3), la identidad (C4) y la UI de presencia
(C10). **Qué se descarta:** el endpoint de cambios (C5), el canal SSE (C7) y el
deshacer por operaciones inversas (C9), unos 3–4 días de trabajo. Es el precio de
poder parar después de la fase A si alcanza.

---

## Decisiones a tomar (antes de empezar)

Cada una tiene una recomendación; confirmarlas o cambiarlas antes de C1.

1. **Alcance.** Recomendado: fase 0 + A, medir, y la fase B solo si D1 lo justifica.
2. **Granularidad del conflicto: por campo.** Si dos personas cambian campos
   distintos de la misma tarea, se combinan. Si cambian el mismo campo, en la fase A
   se rechaza el segundo cambio con aviso; en la fase B gana el último. Los textos
   (título, descripción) no se editan letra por letra entre dos personas: gana el
   último guardado del campo.
3. **Listas dentro de un campo son atómicas:** `assignments`, `requiredRoles`,
   `timeOff`, `settings.holidays`, `settings.defaultProjectTasks`. Dos cambios a la
   misma lista chocan como un solo campo. Separarlas en elementos se deja para
   después si molesta.
4. **Identidad sin contraseña mientras sea local.** Cada persona escribe su nombre la
   primera vez (se guarda en el navegador). Inicio de sesión real queda fuera de este
   plan y es obligatorio antes de abrir la app a la red (`BIND_ADDRESS=0.0.0.0`).
5. **Deshacer revierte solo tus cambios.** Si otra persona modificó después el mismo
   campo, tu deshacer de ese campo se descarta con aviso.
6. **Restaurar un checkpoint afecta a todos.** Pide confirmación mostrando quién está
   conectado, y los demás reciben el cambio con un aviso.
7. **Arrastrar una barra:** en la fase A los demás ven el resultado al soltar; en la
   fase B se ve en vivo (con un límite de envíos por segundo).

---

## Contexto (leer antes de cualquier tarea)

**Estado y cambios**
- Todo el estado vive en `src/store/useRoadmapStore.ts` (zustand, ~830 líneas). Los
  datos del plan son siete colecciones: `projects`, `items`, `resources`, `deps`,
  `sprints`, `roles` y `settings` (objeto).
- Las acciones actualizan de forma inmutable. Los cambios se detectan por
  referencia (`state.items !== prevState.items`) en un solo `subscribe`
  (`src/lib/persistence/useRoadmapPersistence.ts`). Esa costura es donde se conecta la
  sincronización sin tocar las 37 vistas y componentes que leen el store.
- **Ids:** 19 lugares crean ids con `'x' + Date.now()` (11 en el store, más
  `ResourceModal`, `ResourcesView`, `useVoiceCommand`, `scenarioFile`,
  `checkpointFile`). Dos personas creando algo en el mismo milisegundo generan el
  mismo id. Hoy no importa; con colaboración sí.
- **Orden:** no hay reordenamiento manual. Las listas mantienen el orden de creación
  (se agrega al final). Los sprints y la lógica de filas ordenan por `startDay`.
- **Editor de tareas:** `commitItem` reemplaza la tarea entera por el borrador
  (`draft`) y vuelve a crear todas sus dependencias con ids nuevos
  (`'e' + Date.now()`) en cada guardado. `onRSave` (personas) y `onPSave` (proyectos)
  también escriben todos los campos del formulario.
- **Deshacer:** fotos completas de las siete colecciones (`past`/`future`, hasta 100),
  con agrupación de gestos para el arrastre (`beginGesture`/`endGesture`).
  `hydrateScenario` reinicia el historial.

**Guardado (ver `docs/persistence.md`)**
- `src/lib/persistence/scenarioSync.ts`: cada carga recuerda la revisión (hash del
  archivo, enviada como `ETag`); cada guardado es un `PUT` del escenario completo con
  `If-Match`. Conflicto → 409 con los datos actuales, y se recarga con aviso. Avisa a
  las pestañas del mismo navegador por `BroadcastChannel` y revisa el disco al
  enfocar, al volver a la pestaña y cada 30 s.
- Servidor: `src/lib/persistence/scenarioFile.ts` (revisión, cola de escritura por
  escenario, escritura atómica) y `src/app/api/scenarios/[id]/route.ts`.
- Checkpoints: copia completa del escenario en `storage/scenarios/<id>.checkpoints.json`
  (`checkpointFile.ts`). Restaurar escribe sin revisión y avisa a las pestañas.

**Lo que no cambia**
- **Análisis:** el cliente manda los datos a `/api/analyze`
  (`src/lib/analysis/requestAnalysis.ts`), así que no depende de cómo se guarde.
- **Comparar escenarios** (`CompareView.tsx`) lee el JSON de cada escenario con `GET`.
  Hay que mantener ese JSON al día en todas las fases.
- **Voz:** el agente ejecuta acciones del store, así que sus cambios se sincronizan
  como cualquier otro.

**Entorno**
- Un solo contenedor Docker, datos en archivos, publicado en `127.0.0.1`
  (`docs/docker.md`). La fase B agrega un segundo servicio.
- Next 16.3: los Route Handlers no aceptan WebSockets. Sí permiten respuestas en
  streaming (SSE): leer `node_modules/next/dist/docs/01-app/02-guides/streaming.md`
  antes de C7.
- i18n: cada texto nuevo necesita su traducción `es` en
  `src/lib/i18n/translations.ts`.
- Tests: `npm run engine:test` usa `node --test` sobre `.ts`. Los módulos puros
  nuevos (C2) pueden testearse igual si no importan nada de la app.

---

## Fase 0 · Base

### C1 · Ids que no chocan `[ ]`

- Helper `newId(prefix)` en `src/lib/ids.ts`: el prefijo de siempre (`i`, `p`, `r`,
  `e`, `sp`, `o`…) más un sufijo aleatorio corto (`crypto.randomUUID()` recortado).
- Reemplazar los 19 usos de `Date.now()` como id. Los que agregan un contador
  (`'e' + de++`, `` `i${Date.now()}_${i}` ``) también.
- Los ids existentes no se tocan: siguen siendo válidos.

**Criterios:** crear dos tareas en el mismo milisegundo (test) da ids distintos; los
datos viejos cargan igual; `grep "+ Date.now()"` ya no encuentra ids.
**Estimado:** 0,5 día.

### C2 · Comparar y aplicar cambios por campo `[ ]`

- Módulo puro `src/lib/sync/ops.ts`, sin imports de la app:
  - `diffScenario(base, next) → Op[]`, con `Op` = `{ coll, id, kind: 'add' | 'remove' | 'update', fields?: { [campo]: { from, to } }, value? }`.
    `settings` se compara como una entidad única.
  - `applyOps(data, ops) → { data, rejected }`. Un `update` se rechaza campo por
    campo si el valor actual no es ni `from` ni `to` (alguien más lo cambió). Un
    `update` sobre algo borrado se rechaza. Un `add` con id existente se rechaza.
  - Aprovecha la inmutabilidad: si la referencia de una entidad no cambió, no se
    compara por dentro.
- Tests con `node --test` en `src/lib/sync/ops.test.ts`: altas, bajas, campos
  distintos que se combinan, mismo campo que choca, borrado contra edición, listas
  atómicas y orden preservado.

**Criterios:** `diff` + `apply` sobre la base reproduce `next` exacto; los casos de
conflicto devuelven qué se rechazó y por qué.
**Estimado:** 1,5 días.

### C3 · Los formularios guardan solo lo que cambió `[ ]`

- `commitItem`: comparar el borrador con `draftOrig` y actualizar solo esos campos
  sobre la tarea **actual** del store (no sobre la copia de cuando se abrió).
  Dependencias: agregar las nuevas y quitar las eliminadas, conservando el id de las
  que siguen (hoy se recrean todas).
- Mismo criterio en `onRSave` (guardar el formulario original en `rform`) y `onPSave`.
- Si la tarea o la persona se borró mientras el formulario estaba abierto: cerrar el
  editor con aviso en lugar de volver a crearla.

**Criterios:** con el editor abierto, un cambio de fechas hecho por fuera (otra
pestaña) sobrevive a guardar un cambio de título; guardar sin cambios no modifica
nada; las dependencias sin cambios conservan su id.
**Estimado:** 1 día.

### C4 · Identidad simple `[ ]`

- La primera vez, pedir el nombre (modal chico) y guardarlo en `localStorage` con un
  id aleatorio por navegador. Se puede cambiar desde el menú.
- Enviar `{ id, name }` en cada guardado (encabezado `X-Roadmap-User`).
- Sin contraseña: la decisión 4 aplica.

**Criterios:** el nombre persiste al recargar; los guardados lo llevan; si
`localStorage` falla, se pide cada vez sin romper nada.
**Estimado:** 0,5 día.

---

## Fase A · Guardados parciales y al instante (nivel 1)

### C5 · Endpoint de cambios `[ ]`

- `POST /api/scenarios/[id]/ops` con `{ ops }` y encabezado `If-Match`. El servidor
  aplica las operaciones con `applyOps` (C2) sobre la versión **actual** del disco,
  aunque la revisión no coincida, porque el conflicto ya se evalúa por campo.
  Responde `{ rev, applied, rejected }`.
- Dentro de la cola de escritura por escenario que ya existe (`queued` en
  `scenarioFile.ts`).
- El `PUT` completo se mantiene para restaurar checkpoints y como alternativa.
- Registro de cambios: agregar cada lote aplicado a
  `storage/scenarios/<id>.log.jsonl` (`{ at, user, ops }`), para C8.

**Criterios:** dos lotes sobre campos distintos con la misma revisión base se
aplican los dos; sobre el mismo campo, el segundo vuelve en `rejected`.
**Estimado:** 1 día.

### C6 · El cliente manda cambios, no el escenario `[ ]`

- `scenarioSync.ts` guarda la última versión sincronizada (`base`). Al guardar:
  `diffScenario(base, store)` → `POST …/ops`. Con la respuesta, `base` avanza.
- Si hay `rejected`: recargar esas entidades desde el servidor y avisar qué no se
  guardó ("Ana cambió las fechas de 'Certificación'; tu cambio de fechas no se
  guardó").
- El conflicto 409 del escenario completo deja de ser el caso normal.

**Criterios:** dos pestañas editando tareas distintas al mismo tiempo no generan
avisos; editando el mismo campo, la segunda recibe un aviso que nombra el campo.
**Estimado:** 1 día.

### C7 · Cambios al instante entre navegadores (SSE) `[ ]`

- `GET /api/scenarios/[id]/events`: respuesta en streaming (`text/event-stream`).
  Cada lote aplicado se emite a todos los conectados como `{ rev, ops, user }`
  (emisor en memoria del proceso: alcanza con un solo contenedor).
- El cliente aplica los lotes ajenos al store con la bandera `applying` (sin volver a
  guardarlos) y avanza `base`. Si detecta un salto de revisión, recarga completo.
- Reemplaza el `BroadcastChannel` y la consulta cada 30 s; la revisión al enfocar
  queda como respaldo al reconectar.
- Reconexión automática con espera creciente; un indicador discreto si se corta.

**Criterios:** un cambio en Chrome aparece en Safari en menos de 1 s; al cortar y
volver la red, la pestaña se pone al día sola.
**Estimado:** 1,5 días.

### C8 · Quién cambió qué `[ ]`

- Panel "Actividad" (junto a Checkpoints) que lee el registro de C5: últimos cambios
  con persona, hora y qué cambió ("Ana movió 'Certificación' al 12 oct").
- En el panel de la tarea: "Último cambio: Ana, hace 5 min".

**Criterios:** los cambios propios y ajenos aparecen con el nombre correcto; el
registro no crece sin límite (conservar los últimos N por escenario).
**Estimado:** 1 día.

### C9 · Deshacer solo lo tuyo `[ ]`

- Reemplazar las fotos completas por las operaciones propias (con `from`/`to`). Deshacer
  aplica la inversa como un lote más (C5), así que un campo que otra persona cambió
  después vuelve en `rejected` y se avisa.
- Mantener la agrupación del arrastre como un solo paso (`beginGesture`/`endGesture`).
- Los cambios que llegan de otros no entran en tu historial.

**Criterios:** A cambia una tarea, B otra; Cmd+Z en A revierte solo lo de A; si B
tocó el mismo campo después, A recibe un aviso y no se pisa el cambio de B.
**Estimado:** 1,5 días.

### C10 · Quién está conectado `[ ]`

- Las conexiones SSE (C7) llevan el usuario; el servidor emite la lista al entrar y
  salir alguien.
- Avatares con iniciales en el encabezado, con el nombre al pasar el mouse.

**Criterios:** abrir y cerrar pestañas actualiza la lista en todos; la misma persona
en dos pestañas cuenta una vez.
**Estimado:** 0,5 día.

### C11 · Pruebas y documentación de la fase A `[ ]`

- Pruebas con dos navegadores distintos y con tres pestañas: editar cosas distintas,
  el mismo campo, borrar lo que otro edita, deshacer cruzado, cortar la red.
- Cargar una copia de los datos reales (como en las pruebas anteriores, nunca sobre
  `storage/`).
- Actualizar `docs/persistence.md`, `docs/docker.md` y este backlog.

**Estimado:** 1 día.

---

## D1 · Punto de decisión: ¿hace falta la fase B? `[ ]`

Usar la fase A una o dos semanas con el equipo real y mirar:

- **Rechazos por campo** (contarlos en el registro de C5): si son más de unos pocos
  por semana, la edición simultánea sobre lo mismo es frecuente.
- **Si se pide ver a los demás "en vivo"** (arrastres, quién edita qué tarea).
- **Si hace falta trabajar sin conexión.**

Si nada de eso pasa, la fase A alcanza y la fase B se archiva.

---

## Fase B · Tiempo real con Yjs (nivel 2)

### C12 · Servidor de colaboración `[ ]`

- Evaluar **Hocuspocus** contra **y-websocket** (mantenimiento, persistencia,
  autenticación, hooks). Leer su documentación antes de decidir.
- Segundo servicio en `docker-compose.yml`, publicado también solo en `127.0.0.1`.
  El navegador se conecta a `ws://localhost:<puerto>` (con HTTPS, `wss://`).
- Persistencia: el estado binario de Yjs por escenario en
  `storage/scenarios/<id>.ydoc` y, con cada guardado (con demora), el JSON de siempre,
  para que Comparar, Checkpoints, los respaldos y el análisis sigan funcionando.
- Migración: si un escenario no tiene `.ydoc`, se crea a partir de su JSON al primer
  acceso.
- Identidad: el nombre de C4 viaja al conectarse.

**Criterios:** dos clientes Node conectados al servidor ven los cambios del otro; al
reiniciar el contenedor no se pierde nada; los escenarios existentes se migran solos.
**Estimado:** 3–4 días.

### C13 · Modelo del documento `[ ]`

- Por colección, un `Y.Map` de id → `Y.Map` de campos, más un `Y.Array` de ids con el
  orden. `settings` como un `Y.Map`.
- Las listas atómicas de la decisión 3 se guardan como un valor único por campo.
- Reutilizar el recorrido de C2 para convertir entre el JSON y el documento.

**Criterios:** JSON → documento → JSON da el mismo escenario (test con los
escenarios reales).
**Estimado:** 1 día.

### C14 · Puente entre el store y Yjs `[ ]`

- Reemplaza `scenarioSync.ts`. Hacia afuera: en el mismo `subscribe`, `diffScenario`
  (C2) → transacción de Yjs con origen `local`. Hacia adentro: `observeDeep` →
  reconstruir solo las colecciones afectadas, **conservando la referencia** de las
  entidades que no cambiaron (la detección de cambios y el rendimiento dependen de
  eso), con la bandera `applying`.
- Arrastre en vivo: enviar como máximo unas 20 actualizaciones por segundo.
- Retirar el endpoint de cambios, SSE, `ETag` de datos y `BroadcastChannel` (C19).

**Criterios:** arrastrar en una pestaña se ve fluido en la otra; ediciones
simultáneas en campos distintos de la misma tarea se combinan; nada se guarda dos
veces.
**Estimado:** 4–5 días.

### C15 · Deshacer con `Y.UndoManager` `[ ]`

- `trackedOrigins: ['local']`, agrupación por tiempo y `stopCapturing()` al terminar
  un arrastre. Reemplaza C9.
- Conectar a los atajos y botones de deshacer y rehacer que ya existen.

**Criterios:** los mismos escenarios de C9, ahora sin rechazos (Yjs resuelve).
**Estimado:** 1,5 días.

### C16 · Escenarios y checkpoints `[ ]`

- Cambiar de escenario = cambiar de documento (sala).
- Crear o duplicar: el servidor copia el documento.
- Guardar un checkpoint: el servidor toma el JSON del documento actual.
- Restaurar: el servidor reemplaza el contenido del documento en una transacción, así
  todos los conectados lo reciben (decisión 6).

**Criterios:** restaurar con dos personas conectadas actualiza a las dos, con aviso;
duplicar no afecta al original.
**Estimado:** 2–3 días.

### C17 · Presencia por tarea `[ ]`

- `awareness` de Yjs: quién está conectado y qué tarea o persona tiene abierta.
- Marca en la barra que otra persona está editando, y aviso en el editor ("Ana está
  editando esta tarea").

**Criterios:** abrir un editor se refleja en los demás en menos de 1 s y desaparece
al cerrarlo o desconectarse.
**Estimado:** 1,5 días.

### C18 · Sin conexión (opcional) `[ ]`

- `y-indexeddb`: seguir editando sin red y combinar al volver.
- Indicador de "sin conexión, los cambios se guardarán al reconectar".

**Estimado:** 1 día.

### C19 · Retirar lo que quedó de la fase A `[ ]`

- Borrar `/ops`, `/events`, el `BroadcastChannel`, la consulta al enfocar y la
  revisión por `ETag` de los datos del plan. Mantener el registro de actividad
  (C8) alimentado desde el servidor de colaboración.
- Actualizar `docs/persistence.md` (queda obsoleta buena parte) y `docs/docker.md`.

**Estimado:** 1 día.

### C20 · Pruebas de la fase B `[ ]`

- Test automatizado con varios clientes Yjs en Node contra el servidor: ediciones
  simultáneas, borrado contra edición, desconexión y reconexión.
- Pruebas manuales con tres navegadores y los datos reales copiados.
- Rendimiento: un escenario con 10 veces las tareas actuales sigue fluido.

**Estimado:** 2–3 días.

---

## Fuera de este plan

- **Inicio de sesión y permisos** (quién puede editar qué). Obligatorio antes de
  abrir la app a la red; conviene un backlog propio.
- **HTTPS** para usar la app desde otras máquinas (lo pide el micrófono y, en la fase
  B, `wss://`).
- **Edición de texto letra por letra entre dos personas** (decisión 2).
- **Más de un contenedor o réplicas:** con la fase A exige mover el emisor SSE a
  algo compartido (Redis); con la fase B, la extensión de Redis de Hocuspocus.
