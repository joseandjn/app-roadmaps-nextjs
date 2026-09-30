# Backlog: Más opciones en Configuración

Opciones que hoy están fijas en el código y conviene poder configurar, ahora que
Configuración tiene sidebar (PR #29). Priorizadas el 2026-09-29; se hace de a una.

> Estado: `[ ]` pendiente · `[~]` en curso · `[x]` hecha
>
> **Estado general:** P1 hecha el 2026-09-29; sigue P2. Plan armado el 2026-09-29 sobre `main` en `988385c`.

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

## P2 · Categorías de proyecto `[ ]`

- `CATEGORIES` pasa a `settings.categories` (sin valor → la lista actual).
- Sección en PLAN, parecida a Roles: agregar, renombrar (actualiza los proyectos que
  la usan) y eliminar (solo si ningún proyecto la usa, o pidiendo reemplazo).

## P3 · Duración por defecto de cada tipo `[ ]`

- `settings.defaultDurations` por tipo (tarea, épica). Hoy hay 21 días desde "+" y en
  la voz, pero 14 desde el menú contextual: se unifica con estos valores.

## P4 · Escenarios `[ ]`

- Sección en DATOS con la lista de escenarios (nombre, nota, fecha, cuál es oficial)
  y acciones renombrar, marcar oficial, duplicar y eliminar (con las mismas reglas de
  hoy: no se elimina el oficial ni el último).

## P5 · Respaldo `[ ]`

- Exportar el escenario activo (o todos) como archivo JSON; importar un archivo como
  escenario nuevo, validando su forma. Nunca pisa uno existente.

## P6 · Asistente IA `[ ]`

- Sección ASISTENTE: proveedor y modelo activos (de `.env`), botón "Probar conexión"
  (una llamada mínima al LLM) y cómo cambiarlo. La clave no se muestra ni se edita.
