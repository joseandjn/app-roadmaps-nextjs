# Backlog: Descripción de tareas y base de conocimiento para estimar

Plan para que cada tarea tenga una descripción y quede registrado cuánto se estimó
y cuánto tomó de verdad. Con eso se arma una base de conocimiento que un LLM usa
para sugerir estimaciones de tareas nuevas. Se hace de a una tarea por vez. Cada
tarea incluye el contexto, los archivos y los criterios para poder retomarla sin
volver a investigar.

> Estado: `[ ]` pendiente · `[~]` en curso · `[x]` hecha
>
> **Estado general:** K1–K7 hechas el 2026-09-28. D1 se saltó a pedido (el asistente se construyó con datos
> simulados); K8 espera a que haya tareas terminadas reales para medir. Plan armado el 2026-09-28 sobre `main` en `7c5d4fa`.
> Las decisiones 1–9 se tomaron con la recomendación de cada una.

---

## Resumen

Con solo la descripción, el LLM sabría *qué* se hizo pero no *cuánto se desvió la
estimación*, que es lo que sirve para estimar mejor. Por eso el plan registra tres
cosas por tarea: qué era (descripción), cuánto se estimó y cuánto tomó.

| Fase | Qué logra | Tareas | Estimado (1 persona) |
|---|---|---|---|
| **A · Capturar los datos** | Descripción, estimación original, re-estimaciones y cierre real de cada tarea, visibles en el panel. | K1–K5 | 3 días |
| **Punto de decisión D1** | Esperar a tener suficientes tareas terminadas con datos completos. | — | — |
| **B · Base de conocimiento** | Exportar las tareas terminadas en un formato que un LLM (u otra herramienta) pueda leer. | K6 | 1 día |
| **C · Asistente de estimación** | Botón "Sugerir duración" que propone un rango con justificación y tareas de referencia. | K7–K8 | 3–4 días |

Total: **~1,5 semanas**, pero la fase A es la urgente: cada semana sin registrar
estimado y real son datos que no se pueden recuperar después. Las fases B y C
pueden esperar a D1.

---

## Decisiones a tomar (antes de empezar)

Cada una tiene una recomendación; confirmarlas o cambiarlas antes de K1.

1. **Formato de la descripción.** Recomendado: **texto libre con una plantilla
   sugerida** (en el placeholder y como texto inicial opcional). Los campos
   estructurados separados (complejidad como selector, etc.) son más fáciles de
   analizar, pero agregan fricción al escribir y el LLM entiende bien texto libre
   ordenado. Plantilla propuesta:
   - **Alcance:** qué incluye y qué no.
   - **Complejidad / incertidumbre:** baja / media / alta, y por qué.
   - **Supuestos y riesgos técnicos:** lo que no es trabajo planificable (una API
     que ya existe pero no se conoce, acceso pendiente a un sistema, tecnología
     nueva para el equipo…).
   - **Notas al cerrar:** qué salió distinto de lo planeado (se completa en K4).

   Las **dependencias** no van en la descripción: se cargan como tareas con
   "Depende de" (ver decisión 9).
2. **Historial de re-estimaciones.** Recomendado: **sí, con motivo**. Es una lista
   chica por tarea y el motivo ("se sumó el flujo de reintentos") es de lo más útil
   para la base de conocimiento. Si se descarta, K3 no se hace y queda solo la
   estimación original.
3. **Qué es "la estimación".** Recomendado: la duración con la que se **crea** la
   tarea (primer guardado del editor, del agente de voz o de las tareas por defecto
   de un proyecto). Mover o estirar la barra en el timeline **no** cambia la
   estimación: es replanificar, no re-estimar. Re-estimar es una acción explícita
   (K3).
4. **Qué es "el real".** Recomendado: al pasar la tarea a **Done** se guarda el día
   de cierre (`completedDay`) y el editor ofrece ajustar el fin de la barra a ese
   día. Duración real = `completedDay − startDay`. Volver a abrir la tarea (Done →
   otro estado) borra el cierre.
5. **Unidad.** Guardar todo en **días calendario**, igual que `dur`. Los días
   hábiles y los días-persona (según `assignments[].pct`) se calculan al exportar
   (K6) con el calendario que ya existe en `engine/calendar.ts`.
6. **Qué escenario cuenta.** La base de conocimiento lee **solo el escenario
   oficial**. Los escenarios son copias con los mismos ids: si se leyeran todos,
   cada tarea aparecería repetida.
7. **Tareas existentes.** No se completa la estimación de las tareas que ya
   existen: su `dur` actual ya no es la original. Quedan sin `estimates` y la base
   de conocimiento las excluye (o las incluye marcadas como "sin estimación", ver
   K6).
8. **Proveedor del LLM.** Usar el mismo que el resto de la app
   (`createLlmFromEnv`): Ollama local por defecto, Claude con
   `LLM_PROVIDER=anthropic`. Si las descripciones tienen información sensible,
   Ollama evita que salgan de la máquina.
9. **Dependencias como tareas, no como texto.** Todo lo que sea trabajo con fecha
   (otra tarea, una entrega de otro equipo, una certificación) se modela como tarea
   o hito y se enlaza con "Depende de". Lo externo que no es de ningún proyecto
   (un proveedor, otro equipo) puede ir como hito en un proyecto "Externos". Así la
   base de conocimiento sabe exactamente de qué dependía cada tarea y si esa
   dependencia llegó tarde (K6), algo que en texto libre no se puede medir.

---

## Contexto (leer antes de cualquier tarea)

**Modelo**
- `Item` en `src/types/index.ts:22`: `id`, `projectId`, `title`, `startDay`, `dur`,
  `status`, `type`, `assignments`, `requiredRoles?`. No tiene descripción ni nada
  sobre estimación o cierre.
- Día = desplazamiento desde `START_DATE` (`src/data/initialData.ts`); `dur` en días
  calendario, fin exclusivo. Hitos y releases tienen `dur: 0`: no se estiman y
  quedan fuera de todo este plan.
- Los campos nuevos son **opcionales**, así los escenarios y checkpoints guardados en
  `storage/` cargan sin migración.

**Dónde se crean y cambian tareas** (`src/store/useRoadmapStore.ts`)
- Editor: `newItemAt` / `newItemOfType` arman un `draft` (`_new: true`);
  `commitItem` (`:494`) lo guarda reemplazando la tarea entera. Es el lugar para
  fijar la estimación inicial y detectar el paso a Done.
- `duplicateItem` (`:411`) copia la tarea con `...it`: hay que **no** copiar el
  cierre ni el historial de estimaciones (la copia es una tarea nueva).
- Tareas por defecto al crear un proyecto (`:578`).
- Agente de voz: `agentCreateItem` / `agentUpdateItem` (`:122`), con las
  herramientas definidas en `src/lib/agent/shared.ts`. También puede pasar una
  tarea a Done.
- Arrastrar barras (`:525`, `:698`) solo cambia `startDay` / `dur`: no toca la
  estimación (decisión 3).

**Dependencias**
- `Dependency { id, from, to }` en `ScenarioData.deps`: `from` depende de `to`
  (empieza cuando `to` termina). En el editor es el campo "Depende de"
  (`draft._deps`, `RightPanel.tsx`), y `commitItem` las recrea al guardar.
- `dependencyIssues` (`src/lib/roadmapUtils.ts:232`) marca ciclos y tareas que
  empiezan antes de que termine aquello de lo que dependen.

**Pantallas**
- Panel de la tarea: `src/components/RightPanel.tsx` (bloque `Item panel`).
- Comparación de escenarios: `src/lib/scenarioDiff.ts` compara `title`, `status`,
  `type` y proyecto. Agregar `description` ahí es opcional.
- Búsqueda de texto: `matchesText` en `src/lib/filters.ts` busca en el título y el
  nombre del proyecto. Incluir la descripción queda fuera de este plan.

**LLM**
- `engine/llm/`: `LlmClient.completeJson({ system, user, schema })` con respuesta
  JSON validada por esquema; `createLlmFromEnv` elige Ollama o Anthropic.
- `/api/analyze` (`src/app/api/analyze/route.ts` + `engine/api.ts`) es el ejemplo a
  seguir para un endpoint que valida la entrada y llama al LLM. `engine/api.ts`
  valida campo por campo y descarta lo que no conoce, así que los campos nuevos no
  le afectan.

**Guardado**: ver `docs/persistence.md`. Escenarios en
`storage/scenarios/<id>.json`, el oficial marcado en `storage/scenarios/index.json`
(leer con `src/lib/persistence/scenarioFile.ts`).

**Entorno**
- Next 16.3: antes de crear rutas nuevas en `src/app/api/`, revisar
  `node_modules/next/dist/docs/` (ver `AGENTS.md`).
- i18n: cada texto nuevo necesita su traducción `es` en
  `src/lib/i18n/translations.ts`.
- Tests: `npm run engine:test` (`node --test`) para lo que viva en `engine/` o en
  módulos puros. Para `src/`: `npm run lint`, `npx tsc --noEmit` y probar en la app.
- **Colaboración** (`docs/collaboration-backlog.md`): si se hace antes o después,
  la descripción es un campo de texto más (decisión 2 de ese backlog: gana el último
  guardado) y `estimates` es una lista atómica.

---

## Fase A · Capturar los datos

**Cómo quedó:** la lógica está en `src/lib/estimates.ts` (con tests en
`src/lib/estimates.test.ts`, `npm run lib:test`), la sección del panel en
`src/components/ItemEstimates.tsx` y los cambios del store en `commitItem`,
`duplicateItem`, las tareas por defecto de un proyecto y `agentCreateItem` /
`agentUpdateItem`. Campos nuevos de `Item`: `description`, `estimates`
(`{ dur, at, reason? }[]`) y `completedDay`.

### K1 · Descripción de la tarea `[x]`

- `description?: string` en `Item`.
- Textarea en el panel de la tarea, debajo del título, con la plantilla de la
  decisión 1 como placeholder y un botón chico "Usar plantilla" que la inserta si el
  campo está vacío. Se guarda con `commitItem` como el resto del borrador.
- Recortar espacios al guardar; si queda vacía, no guardar el campo.
- `duplicateItem` copia la descripción (sirve como punto de partida).
- Agente de voz: aceptar `description` opcional en crear y actualizar tarea.

**Criterios:** escribir una descripción, guardar y recargar la conserva; los
escenarios viejos cargan igual; un texto largo con saltos de línea se ve y edita
bien.
**Estimado:** 0,5 día.

### K2 · Estimación original `[x]`

- `estimates?: { dur: number; at: string; reason?: string }[]` en `Item` (`at` =
  fecha ISO). El primero es la estimación original.
- Al crear una tarea (editor, agente de voz, tareas por defecto de un proyecto,
  duplicar), agregar `{ dur, at }` con la duración con la que nace. Hitos y
  releases no.
- `duplicateItem` arranca un historial nuevo con la duración de la copia.

**Criterios:** crear una tarea de 14 días y después estirarla a 20 deja la
estimación en 14; las tareas existentes no reciben estimación (decisión 7).
**Estimado:** 0,5 día.

### K3 · Re-estimar con motivo `[x]`

Depende de la decisión 2.

- Botón "Re-estimar" en el panel: pide la nueva duración y un motivo corto, agrega
  una entrada a `estimates` y, si se quiere, aplica la duración a la barra.
- Una tarea sin estimación (anterior a K2) puede recibir su primera estimación por
  acá.

**Criterios:** el historial muestra las entradas en orden con su motivo; deshacer
(Cmd+Z) revierte la re-estimación como cualquier otro cambio.
**Estimado:** 0,5 día.

### K4 · Cierre real `[x]`

- `completedDay?: number` en `Item` (mismo sistema de días que `startDay`).
- Al pasar a Done desde el editor (`commitItem`) o por voz (`agentUpdateItem`):
  guardar el día de hoy. Al salir de Done: borrarlo.
- En el editor, al elegir Done: aviso con dos opciones, "Terminó hoy (ajustar fin)"
  y "Terminó en la fecha planeada". La segunda guarda `completedDay` = fin de la
  barra.
- Resaltar la sección **Notas al cerrar** de la descripción para completarla en
  ese momento (sin obligar).

**Criterios:** marcar Done guarda el cierre y reabrir lo borra; la voz y el editor
se comportan igual; duplicar una tarea terminada no copia el cierre.
**Estimado:** 1 día.

### K5 · Estimado vs. real en el panel `[x]`

- En el panel de la tarea: estimación original, re-estimaciones, real (si está
  cerrada) y desviación en % respecto de la original y de la última estimación.
- Colores: verde si la desviación es ±10 %, ámbar hasta +30 %, rojo más allá (a
  confirmar en uso).

**Criterios:** los números coinciden con los datos guardados en tareas de prueba
con y sin re-estimaciones.
**Estimado:** 0,5 día.

---

## D1 · Punto de decisión: ¿hay datos suficientes? `[ ]`

Antes de la fase C, revisar el escenario oficial:

- ¿Cuántas tareas terminadas tienen descripción, estimación y cierre? Como
  referencia, **20–30** para empezar a ver patrones.
- ¿Las descripciones siguen la plantilla o hay que ajustarla?

La fase B (exportar) se puede hacer antes si sirve para revisar los datos.

---

## Fase B · Base de conocimiento

### K6 · Exportar las tareas terminadas `[x]`

**Cómo quedó:** `src/lib/knowledge.ts` (tests en `src/lib/knowledge.test.ts`),
`src/app/api/knowledge/route.ts` y la sección "Base de conocimiento de
estimaciones" en Configuración (`src/components/settings/KnowledgeSettings.tsx`).
Diferencias con lo planeado: las tareas Done **sin día de cierre** (las de antes
de K4) quedan siempre afuera porque no tienen duración real; los días-persona son
días hábiles × % asignado (no descuentan las ausencias); en el Markdown los
asignados iguales se agrupan ("QA 50% ×4") y las etiquetas salen en el idioma de
la app (`?lang=es`). El total va en el encabezado `X-Record-Count`.

- `GET /api/knowledge` lee el escenario **oficial** (decisión 6) y devuelve una
  línea JSON (JSONL) por tarea terminada:
  `id`, `project` (nombre, categoría), `title`, `type`, `description`,
  `requiredRoles`, `assignments` (rol y % de cada persona, sin costos),
  `estimates`, `startDate`, `completedDate`, duración real en días calendario y
  hábiles, días-persona, desviación contra la estimación original y la última.
- Por cada tarea, sus **dependencias** (`deps` donde `from` es la tarea): título,
  tipo y proyecto de cada una, su propia desviación (si tiene estimación y
  cierre) y si terminó después de que la tarea empezó, con cuántos días de
  espera. Así el LLM puede separar "la tarea se estimó mal" de "la tarea esperó a
  otra".
- `?format=md` devuelve lo mismo como Markdown (una sección por tarea), cómodo para
  pegar en un chat o cargar en otra herramienta.
- `?includeUnestimated=1` incluye las tareas terminadas sin estimación, marcadas.
- Lógica en un módulo puro (en `engine/` o `src/lib/knowledge/`) con tests de
  `node --test`; la ruta solo lee el archivo y responde.
- Botón "Exportar base de conocimiento" en Configuración.

**Criterios:** con un escenario de prueba, la salida tiene una línea por tarea Done
con estimación; los escenarios no oficiales no aparecen; los días hábiles respetan
feriados y `countWeekends`.
**Estimado:** 1 día.

---

## Fase C · Asistente de estimación

### K7 · Sugerir duración `[x]`

**Cómo quedó:** `src/lib/estimator.ts` (ranking de similares + prompt + validación
de la respuesta; tests con un LLM falso en `src/lib/estimator.test.ts`),
`src/app/api/estimate/route.ts` (errores con `code`: `bad_request`, `no_history`,
`no_llm`, `llm_failed`), `src/lib/requestEstimate.ts` y el bloque "Sugerir
duración" en `src/components/ItemEstimates.tsx`. Diferencias con lo planeado:
- La historia incluye también las tareas terminadas **sin** estimación: para
  sugerir importa su duración real. Se mandan las 25 más parecidas.
- Las referencias no abren la tarea: abrirla descartaría lo que se está editando.
- `Estimate.source = 'assistant'` marca las estimaciones que vienen del
  asistente (en una tarea nueva, solo si al crearla la duración sigue siendo la
  sugerida), para que K8 pueda comparar asistente contra estimación a mano. El
  export (K6) lo incluye.
- Probado de punta a punta con Ollama `qwen2.5` (7B, ~10 s): rango y referencias
  correctas, pero los "por qué" son repetitivos. Con Claude (`LLM_PROVIDER=anthropic`)
  deberían ser mejores.

- `POST /api/estimate` con la tarea en edición (título, descripción, tipo, roles,
  proyecto). El servidor:
  1. Toma la base de conocimiento de K6 y las dependencias de la tarea nueva (el
     LLM puede avisar si depende de algo que en el pasado llegó tarde).
  2. Elige las tareas más parecidas: mismo tipo, roles en común, misma categoría de
     proyecto y palabras en común en título y descripción. Mientras sean unos
     cientos de tareas, se pueden mandar todas al LLM y no hace falta una base
     vectorial. Si crece, agregar embeddings en una tarea aparte.
  3. Llama a `completeJson` con un esquema de respuesta:
     `{ optimistic, likely, pessimistic, rationale, references: [{ id, why }] }`
     (días calendario).
- En el panel: botón "Sugerir duración" junto a la duración. Muestra el rango, la
  justificación y las tareas de referencia (clic → abre esa tarea). Un botón
  "Usar" aplica el valor probable a la barra y a la estimación. **Nunca** se
  aplica solo.
- Sin LLM configurado o sin datos: el botón explica por qué no está disponible.

**Criterios:** con datos de prueba, la sugerencia cita tareas que existen y las
cifras son coherentes (`optimistic ≤ likely ≤ pessimistic`); un error del LLM
muestra un aviso sin romper el editor.
**Estimado:** 2–3 días.

### K8 · Medir si el asistente ayuda `[ ]`

Espera datos reales (ver D1). `suggestEstimate` ya acepta `id` para dejar afuera la
tarea que se está evaluando.

- Prueba "dejando una afuera": para cada tarea terminada, pedir la sugerencia
  usando solo las demás y comparar contra su duración real. Comparar el error con
  el de la estimación original que se hizo a mano.
- Script en `engine/` (no en la app), que se corre a mano con los datos reales
  copiados, nunca sobre `storage/`.
- Actualizar este backlog con los resultados y la documentación funcional
  (un `docs/estimation.md` nuevo).

**Criterios:** un número claro de error medio del asistente contra el error de las
estimaciones a mano.
**Estimado:** 1 día.

---

## Fuera de este plan

- **Buscar por descripción** en la barra de filtros (`matchesText`).
- **Embeddings / base vectorial**: solo si la cantidad de tareas no entra en el
  contexto del modelo.
- **Esfuerzo en horas** en vez de duración: hoy el modelo no tiene horas por tarea;
  se aproxima con días-persona en K6.
- **Completar estimaciones de tareas viejas** a partir de los checkpoints: posible,
  pero poco confiable (decisión 7).
