# Backlog: Más opciones en Configuración

Opciones que hoy están fijas en el código y conviene poder configurar, ahora que
Configuración tiene sidebar (PR #29). Priorizadas el 2026-09-29; se hace de a una.

> Estado: `[ ]` pendiente · `[~]` en curso · `[x]` hecha
>
> **Estado general:** P1–P6 hechas (P5 y P6 el 2026-10-09). Quedan las opciones de "Después". Plan armado el 2026-09-29 sobre `main` en `988385c`.

---

## Resumen

| # | Opción | Grupo del sidebar | Estimado |
|---|---|---|---|
| P1 | Fechas en el idioma de la app + formato elegible | PREFERENCIAS (nuevo) | 0,5 día |
| P2 | Categorías de proyecto editables | PLAN | 0,5 día |
| P3 | Duración por defecto de cada tipo de tarea | PLAN | 0,25 día |
| P4 | Escenarios: renombrar, oficial, duplicar, eliminar | DATOS | 0,5 día |
| P5 | Respaldo: exportar e importar un roadmap | DATOS | 0,5 día |
| P6 | Asistente IA: modelo activo y probar conexión | ASISTENTE (nuevo) | 0,5 día |

**Después, si hacen falta:** plantilla de descripción, duración estándar de sprint,
valores por defecto de personas nuevas, umbrales del análisis, umbrales de desviación
y cantidad de tareas de referencia del asistente, vista inicial, tarjeta de
información (activar o cambiar la demora).

---

## Decisiones

1. **Preferencias vs. configuración del plan.** Lo que es del plan (categorías,
   duraciones, calendario…) se guarda en el escenario, como hoy `settings`. Lo que es
   de cada persona (formato de fecha, vista inicial…) se guarda en el navegador
   (`localStorage`) y va en un grupo nuevo **PREFERENCIAS**.
2. **La clave de la API de Claude sigue en `.env`.** Configuración muestra el estado y
   permite probar la conexión, pero nunca pide ni guarda la clave.
3. **Cada opción conserva el comportamiento actual por defecto**: los datos existentes
   no cambian hasta que alguien toque la opción.

---

## Contexto

- Sidebar y secciones: `src/components/settings/sections.ts` (registro) y
  `src/components/views/SettingsView.tsx`. Agregar una sección = componente + entrada
  en el registro.
- `Settings` del plan: `src/types/index.ts`, valores por defecto en
  `DEFAULT_SETTINGS` (`src/data/initialData.ts`), cambios con `patchSettings`.
- i18n: `src/lib/i18n/translations.ts`; idioma en `localeStore.ts` (el servidor
  siempre renderiza en inglés y el cliente cambia después de hidratar).

---

## P1 · Fechas en el idioma de la app `[x]`

Hoy, con la app en español, las fechas salen en inglés: "Oct 2, 26" (panel, chip de
arrastre, tarjeta, historial, feriados…) y los encabezados del cronograma dicen
"Jan Feb Mar…".

- `fmtDate` y los encabezados (`buildHeader`, cortes por semana/mes en
  `roadmapUtils.ts`) toman los nombres de meses y días del idioma activo.
- Preferencia **Formato de fecha** (nuevo grupo PREFERENCIAS, sección "Formato"):
  - *Según el idioma* (por defecto): "2 oct 26" en español, "Oct 2, 26" en inglés.
  - *Numérico*: "02/10/26" en español, "10/02/26" en inglés.
- Se guarda en el navegador. El servidor sigue en inglés; el cliente aplica el idioma
  y el formato después de hidratar, igual que los textos, para no romper la
  hidratación.

**Criterios:** en español no queda ningún mes en inglés en la app; cambiar el idioma o
el formato actualiza las fechas sin recargar; en inglés todo se ve igual que antes.

**Cómo quedó:** `src/lib/dateFormat.ts` (nombres de meses y días, "T" de trimestre en
español, formato "según el idioma" o numérico; tests en `dateFormat.test.ts`),
`src/lib/preferences.ts` (preferencias personales en `localStorage`),
`src/lib/useDateFormatSync.ts` (aplica idioma y formato después de hidratar) y la
sección PREFERENCIAS → Formato (`FormatSettings.tsx`), que también permite elegir el
idioma. Todo `fmtDate` y los encabezados de `roadmapUtils.ts` pasan por el módulo.
Probado en la app: encabezados "Dic, Ene…" y "T1 2027", feriados "28 jul 26" /
"28/07/26", inglés igual que antes, sin errores de hidratación.

## P2 · Categorías de proyecto `[x]`

- `CATEGORIES` pasa a `settings.categories` (sin valor → la lista actual).
- Sección en PLAN, parecida a Roles: agregar, renombrar (actualiza los proyectos que
  la usan) y eliminar (solo si ningún proyecto la usa, o pidiendo reemplazo).

**Cómo quedó:** `settings.categories` + `projectCategories()` en `roadmapUtils.ts` (la
lista del plan más cualquier categoría que use un proyecto y no esté en ella, así
nunca desaparece una); acciones `addCategory` / `renameCategory` / `removeCategory` en
el store; sección PLAN → Categorías (`CategoriesSettings.tsx`). Eliminar se bloquea
mientras un proyecto la usa (sin reemplazo automático). Los nombres de fábrica se
siguen mostrando traducidos y los duplicados se detectan por lo que se ve
("producto" = "Product"). El formulario de proyecto, el valor por defecto de un
proyecto nuevo y el agente de voz usan la lista del plan. Probado sobre una copia de
los datos: renombrar "Móvil" (sus 2 proyectos siguieron), eliminar, agregar, duplicado
rechazado y el formulario con la lista nueva.

## P3 · Duración por defecto de cada tipo `[x]`

- `settings.defaultDurations` por tipo (tarea, épica). Hoy hay 21 días desde "+" y en
  la voz, pero 14 desde el menú contextual: se unifica con estos valores.

**Cómo quedó:** `settings.defaultDurations` y `defaultDuration()` en `roadmapUtils.ts`
(sin valor: 21 días). Lo usan el botón +, el menú contextual, cambiar un hito a
tarea o épica en el panel, y el agente de voz. Se edita en PLAN → General. Cambio de
comportamiento: el menú contextual creaba tareas de 14 días; ahora usa el mismo valor
que el resto (21 por defecto). Probado sobre una copia: con Tarea = 10 y Épica = 30,
"+" crea 10 días, "Nueva épica" 30, y épica → hito → tarea queda en 10.

## P4 · Escenarios `[x]`

- Sección en DATOS con la lista de escenarios (nombre, nota, fecha, cuál es oficial)
  y acciones renombrar, marcar oficial, duplicar y eliminar (con las mismas reglas de
  hoy: no se elimina el oficial ni el último).

**Cómo quedó:** sección DATOS → Escenarios (`ScenariosSettings.tsx`): nombre y nota
editables en el lugar, fecha de creación y de qué escenario salió, marcas "Oficial" y
"Abierto", y acciones Abrir, Marcar como oficial, Duplicar (cualquiera, sin cambiar
al duplicado) y Eliminar (con confirmación; si es el abierto, primero se cambia al
oficial). Nuevo `PATCH /api/scenarios/[id]` para nombre y nota
(`updateScenarioMeta`). Probado sobre una copia de los datos: renombrar, nota,
duplicar, eliminar la copia, marcar otro como oficial y eliminar el abierto.

## P5 · Respaldo `[x]`

- Exportar el escenario activo (o todos) como archivo JSON; importar un archivo como
  escenario nuevo, validando su forma. Nunca pisa uno existente.

**Cómo quedó:** `src/lib/backup.ts` (formato `roadmap-backup` v1, nombre de archivo,
validación de los datos con el primer problema encontrado; tests en
`backup.test.ts`), `backupActions.ts` (exportar descarga un archivo; importar crea un
escenario por entrada) y sección DATOS → Respaldo. El servidor acepta
`POST /api/scenarios { name, note, data }` y vuelve a validar. También importa un
JSON de escenario suelto (el de `storage/scenarios/`). Probado sobre una copia de los
datos: exportar los 4 escenarios (idénticos a lo guardado), importarlos como 4
escenarios nuevos (idénticos a los originales vistos por la app) y un archivo
inválido rechazado sin crear nada.

## P6 · Asistente IA `[x]`

- Sección ASISTENTE: proveedor y modelo activos (de `.env`), botón "Probar conexión"
  (una llamada mínima al LLM) y cómo cambiarlo. La clave no se muestra ni se edita.

**Cómo quedó:** grupo ASISTENTE → Modelo de IA (`AssistantSettings.tsx`): proveedor,
modelo, servidor de Ollama (si responde y si el modelo está instalado, con la lista
de los disponibles) o si hay clave de Claude, en qué se usa, botón "Probar conexión"
y el bloque de `.env` para cambiarlo. Rutas `GET /api/llm` (nunca devuelve la clave)
y `POST /api/llm/test` (pide `{"ok": true}` y mide el tiempo). `describeLlmEnv` y
`LLM_DEFAULTS` en `engine/llm/fromEnv.ts` (tests en `engine/test/llmEnv.test.ts`).
Además, el agente de voz con Claude ahora respeta `ANTHROPIC_MODEL` (antes tenía el
modelo fijo) y una variable vacía en `.env` cae al valor por defecto. Probado contra el
Ollama real: estado, modelo instalado y conexión OK. No se probaron a mano los casos
de Ollama apagado o Claude sin clave (cubiertos por los tests de `describeLlmEnv`).
