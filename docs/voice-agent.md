# Voice Agent

Lets you speak a command ("add a new resource named Alex, mobile developer,
twelve thousand a month") and have it turned into an actual action on
resources, projects, or Timeline tasks — no typing, no forms, no clicking.
An LLM (local Ollama by default, Claude optionally) interprets the
transcript and picks one of fifteen supported actions; the app applies it
through the same store the UI already uses.

## Functional description

### What you can do

- **Create a resource**: "Add a new person, Jordan Blake, QA, nine thousand
  five hundred a month."
- **Update a resource**: "Change Sara Klein's cost to fifteen thousand" /
  "Make Tom Becker a Platform engineer."
- **Create a project**: "Create a new project called Mobile Redesign, owned
  by Lena Roth, category Mobile."
- **Update a project**: "Set the Apollo project's status to At Risk."
- **Show a resource**: "Show me Sara Klein" → opens her read-only summary
  panel (peak allocation, assigned projects).
- **Show a project**: "Show me the Apollo project" → opens its detail panel.
- **Jump to a date**: "Go to July 2026" / "show me next month" → moves the
  visible window there (relative phrases resolve against the roadmap's
  internal "Today," not your device clock — see System prompt / grounding).
- **Delete a resource or project**: "Delete Tom Becker" / "remove the Apollo
  project" — **does not delete anything by itself.** It opens the same
  edit panel the UI's own "Edit" button opens (with its "Remove" button
  available), and a human still has to click it. See "Delete = HITL"
  below — this is deliberate, not a shortcut that got skipped.
- **Add a task**: "Add a task called Design review to Apollo, starting
  August 1st, ending August 15th." Works for epics, tasks, milestones, and
  releases — milestones/releases are instants (no end date needed).
- **Move or resize a task**: "Move Design review to start September 1st"
  (shifts it, keeps its length) / "extend Design review to end October
  1st" (resizes) — give both a start and an end to reposition it entirely.
- **Select a task**: "Select Design review" / "show me the Cart redesign
  task" → opens its edit panel, highlighted, exactly like clicking its bar
  on the Timeline.
- **Delete a task**: "Delete Design review" — same HITL pattern as
  resources/projects: opens the item's edit panel with Delete visible; a
  human still has to click it.

- **Filter the view**: "Show me only Diego's work" / "what's at risk in
  Modulo de seguridad" / "only milestones" / "remove the filters" → sets
  the same filters as the FilterBar chips and confirms with a toast
  ("Filtered: Modulo de seguridad · At Risk"). A new request replaces the
  current filters; "also…" / "además…" refines them instead.

- **Record time off**: "Jhonly is on vacation from October 19th to the
  25th" / "Elvis is on sick leave on November 3rd" → adds the absence to
  that person and confirms with the dates, working days and how many
  tasks are assigned on those days.

That's the full action surface — **not** covered: dependencies between
tasks, assigning resources/percentages to a task, or any other app setting.
A command outside this scope (or one that's just unclear) gets a short
spoken-back clarification instead of silently doing something wrong.

### How it feels

1. Click the mic icon in the Toolbar (next to the zoom controls) to **start
   a voice session**. It only appears in browsers that support the Web
   Speech API (Chrome/Edge) — silently absent elsewhere rather than showing
   a dead button. Recognition uses your browser's own language
   (`navigator.language`) — dictate in whatever language your browser is
   set to, not just English.
2. The icon turns red/pink ("Listening…"). Speak a command; it briefly
   switches to a spinner ("Interpreting…") while that phrase is sent off,
   then goes back to "Listening…" — **the mic stays open**, so you can
   speak another command right away without clicking again.
3. After each phrase, a toast reports that command's outcome: what was
   created/updated/shown, a "couldn't find that" if you referenced
   someone/something that doesn't exist, or a plain-language explanation
   if the request didn't match a supported action.
4. Click the icon again (from either "Listening…" or "Interpreting…") to
   end the session.

This is a continuous session, not one-click-per-command — the mic keeps
listening across multiple commands (`recognition.continuous = true`) until
you explicitly stop it. See "Continuous session" below for how that's kept
alive and how commands in flight don't fight over the button's state.

## Technical description

### Files involved

| File | Role |
|---|---|
| `src/lib/agent/shared.ts` | The 15 tool definitions (JSON Schema), context types, system-prompt builder — the single source of truth both providers read from |
| `src/lib/agent/providers/ollama.ts` | Calls local Ollama's `/api/chat` with tools |
| `src/lib/agent/providers/anthropic.ts` | Calls Claude's Messages API with tools (optional alternative) |
| `src/lib/agent/roadmapAgent.ts` | Picks the active provider, loads current resources/projects/items as context, dispatches |
| `src/app/api/voice-command/route.ts` | `POST { transcript }` → runs the agent, returns a structured result |
| `src/lib/voice/speechRecognition.ts` | Minimal ambient types for the (non-standard) Web Speech API |
| `src/lib/voice/useVoiceCommand.ts` | Client hook: mic capture, calls the route, dispatches the result into the store |
| `src/store/useRoadmapStore.ts` | `agentCreateResource` / `agentUpdateResource` / `agentCreateProject` / `agentUpdateProject` / `agentCreateItem` / `agentUpdateItem` |
| `src/components/Toolbar.tsx` | The mic button (idle / listening / thinking states) |

### Provider abstraction

`roadmapAgent.ts` is a thin dispatcher:

```ts
export function activeProvider(): 'ollama' | 'anthropic' {
  return process.env.LLM_PROVIDER === 'anthropic' ? 'anthropic' : 'ollama'
}
```

**Default: local Ollama** — no API key, no per-request cost, nothing leaves
the machine. Set `LLM_PROVIDER=anthropic` (+ `ANTHROPIC_API_KEY`) to use
Claude instead — e.g. if a stronger model is worth the cost/latency
tradeoff for a given deployment. Both providers return the exact same
shape (`VoiceCommandResult`, defined in `shared.ts`), so nothing downstream
(the route, the hook, the store) needs to know which one ran.

`shared.ts` defines each tool once as `{ name, description, parameters }`
(plain JSON Schema); each provider file adapts that into its own wire
format — Anthropic's `{name, description, input_schema}` vs. Ollama's
OpenAI-style `{type:'function', function:{name, description, parameters}}`
— rather than maintaining two parallel copies of the same 15 schemas.

### Ollama provider

```ts
POST {OLLAMA_BASE_URL}/api/chat   // default http://localhost:11434
{
  model: OLLAMA_MODEL,            // default "qwen2.5:latest"
  stream: false,
  messages: [{role:'system', content: systemPrompt}, {role:'user', content: transcript}],
  tools: [...],
}
```

Response parsing was written against the *actual* response shape from a
live local Ollama instance (verified directly, not assumed from docs):
`message.tool_calls[0].function.arguments` arrives as an already-parsed
object (unlike OpenAI, which returns `arguments` as a JSON string — no
`JSON.parse` needed here). If `tool_calls` is absent, `message.content`
holds the plain-text fallback.

Requires a locally-running Ollama with a **tool-capable** model pulled
(`ollama list` shows a `tools` capability per model — verified against
`qwen2.5:latest` and `gemma4:e4b` in this environment; vision-only models
like `llava`/`moondream` don't support tools and won't work here). Override
via `OLLAMA_MODEL` / `OLLAMA_BASE_URL` env vars.

### Anthropic provider

Unchanged in behavior from the original implementation — the model is
`ANTHROPIC_MODEL` (default `claude-opus-5`, shared with the analysis and the
estimate assistant through `LLM_DEFAULTS` in `engine/llm/fromEnv.ts`),
`output_config: { effort: 'low' }` (this is simple intent/argument
extraction, not a task needing deep reasoning), tools built from the same
`shared.ts` definitions. See git history / `docs/persistence.md`-adjacent
context if you need the original single-provider version for reference.

### System prompt / grounding

Both providers get the same system prompt: the full list of current
resources (`id`, `name`, `role`, `cost`), projects (`id`, `name`, `owner`,
`category`, `status`), and items (`id`, `title`, `projectId`, `type`,
`status`) as JSON, plus an instruction to resolve spoken names to those
exact ids and to respond in plain text (no tool call, no invented id) if
the request doesn't clearly match one of the tools, or names a
person/project/item that isn't in those lists. This comes from
`readScenario()` on the active scenario in `view.json` — the same
persisted files the `/api/scenarios` routes use (see
`docs/persistence.md`) — so the agent is always grounded
in what's actually on the board, not the seed data. Item dates
(`startDay`/`dur`) are deliberately left out of this context — the model
never needs to know an item's *current* dates to compute a *new* one from
what the user said, and leaving them out keeps the prompt leaner as the
item list grows.

For `go_to_date`, the prompt also includes **the roadmap's internal
"Today"** — `dateStr(TODAY_DAY)` from `initialData.ts` — so the model can
resolve "next month" / "in two weeks" correctly. This is deliberately
*not* the real wall-clock date: `TODAY_DAY` is what the app's own red
"Today" line on the Gantt charts is anchored to, and it's a fixed point in
the roadmap's timeline, not `new Date()`. Grounding relative-date
resolution in anything else would make "next month" resolve to a date the
rest of the UI doesn't consider "next month" from.

### Read / navigate actions (`show_resource`, `show_project`, `show_item`, `go_to_date`)

These four don't have any new UI behind them — they just drive existing
store actions directly, the same ones the sidebar/click UI already calls:

- `show_resource` → `openRes(id)` — the same read-only summary panel
  opened by clicking a person in the sidebar (see `docs/resources-view.md`).
- `show_project` → `editProject(id)`. There's no separate read-only
  project detail view in this app (clicking a project in the sidebar
  already opens this same edit form) — so voice "show" reuses it too,
  consistent with how the rest of the UI already works. It happens to be
  the *same* underlying call `delete_project` makes (see below); only the
  toast wording differs ("Showing X" vs. "Confirm deleting X").
- `show_item` → `openItem(id)` — the same call a click on a Timeline bar
  makes (`docs/timeline-view.md` → Editing flow): opens the item editor
  *and* gives the bar its selected-outline highlight, since that highlight
  is driven by `draft?.id === it.id` — voice selection looks identical to
  a mouse click.
- `go_to_date` → `setFilter(offFromStr(date), null)` — reuses the
  existing date-range filter (`docs/components.md` → FilterBar) rather
  than adding new scroll-to-date plumbing to the three Gantt views. This
  means "go to X" also **narrows what's rendered** to `[X, end)`, same as
  typing that date into the FilterBar's start field — it's not a pure
  camera pan. The existing "Reset" button in FilterBar clears it. The
  `date` the LLM returns is a `YYYY-MM-DD` string, converted to the
  app's internal day-offset client-side via `offFromStr()`
  (`roadmapUtils.ts`) before calling `setFilter`.

### Filters (`set_filters`)

`set_filters` takes optional `projectIds`, `resourceIds`, `roles`,
`statuses`, `types`, `onlyIssues`, `unassigned` and `uncovered`, plus two
flags. Project and resource ids are enums built per request, like roles,
so the model can only pick real ones (`buildAgentTools(roleNames,
resourceIds, projectIds)`).

- **Replace by default.** Without `refine`, the hook resets `filters` to
  `EMPTY_FILTERS` and shows all projects, then applies what was named. The
  date range is kept, since `go_to_date` owns it. The model can't see the
  current filters, so a voice question ("what's at risk in X") should get
  a fresh answer, not one narrowed by an earlier request.
- **`refine: true`** ("also", "además") keeps the current filters and only
  changes the dimensions given.
- **`clear: true`** calls `clearFilter`, the same as the Reset button, so
  it also clears the date range.
- **Sanitized on the client.** Values that don't exist are dropped. A list
  whose values were all invalid is ignored rather than treated as "no
  restriction". If nothing valid is left, the filters stay as they were and
  the toast says so.
- Projects go through `setVisibleProjects`, since `visible` is the source
  of truth for projects (see `docs/filters-backlog.md`).

With `qwen2.5:latest`, "what's at risk" usually comes back as
`onlyIssues` instead of `statuses: ['At Risk']`. That filter is a superset
(it includes At Risk items), so the answer is broader, not wrong.

### Time off (`add_time_off`)

`add_time_off { resourceId, startDate, endDate, note? }` — dates inclusive,
`resourceId` an enum of the real ids. The hook converts the dates to a
`startDay`/`dur` entry and calls `saveTimeOff` (one undo step). A reversed
range is read the right way round; anything that isn't `YYYY-MM-DD` is
refused. The toast gives the dates and working days, and how many tasks
are assigned on those days, since that's what needs attention.

**Name check.** Because `resourceId` is an enum, a model asked about
someone who isn't on the team still has to return *some* real id — with
`qwen2.5` "Persona Inventada está de vacaciones" came back as Diego
Alcala. Unlike deletes, this action writes directly, so the hook checks
that a word of the chosen person's name appears in the transcript
(accents ignored, edit distance ≤ 1, or ≤ 2 for words of 6+ letters, so
"Johnly" still matches Jhonly). If not, nothing is saved: "Couldn't find
that person".

**Relative dates.** The prompt gives today's weekday and the exact dates
of this week and next week (Monday–Sunday). Without them `qwen2.5` read
"la próxima semana" as Friday–Tuesday. "Esta semana" can still come back
a day long; the toast shows the dates and Cmd+Z undoes it.

### Item actions (`create_item`, `update_item`)

Unlike the read/navigate actions above, these two *do* have new store
logic (`agentCreateItem`/`agentUpdateItem` — see "Store actions" below),
because — unlike resources/projects — an item's dates need conversion
between the `YYYY-MM-DD` strings the LLM outputs and the integer
`startDay`/`dur` day-offsets the app's data model actually uses
(`docs/timeline-view.md` covers why items use day offsets rather than
`Date` objects). That conversion happens client-side in
`useVoiceCommand.ts`, not in the store — the store actions stay purely in
day-offset terms, same as every other store action.

- **`create_item`**: `type` picks the shape. `milestone`/`release` always
  get `dur: 0` (they're instants) regardless of what `endDate` says.
  `epic`/`task` compute `dur = endDate - startDate` when `endDate` is
  given, or default to a 21-day span when it's omitted — the same default
  the UI's own "+" new-item button uses (`newItem()` in the store), so a
  vaguely-specified voice-created item lands with the same "reasonable
  default" length a manually-created one would.
- **`update_item`** infers move vs. resize vs. reposition from *which*
  date fields are present, mirroring how a person would phrase each:
  - Only `startDate` → **move**: shift the item, keep its current
    duration (`endDay` moves by the same amount `startDay` did).
  - Only `endDate` → **resize**: keep the current start, change the
    duration to match the new end.
  - Both → **reposition**: set both explicitly, duration follows from
    the two dates given.
  - Neither (only `title`/`status`/`type` changing) → dates untouched.

  If `type` changes to `milestone`/`release` (or already was one),
  `dur` is forced to `0` regardless of any date fields — an instant can't
  have a duration, same rule `create_item` follows.

### Delete = HITL, by construction

`delete_resource(id)` / `delete_project(id)` / `delete_item(id)`
intentionally do **not** call any deleting store action. They call
`editResource(id)` / `editProject(id)` / `openItem(id)` — the exact same
calls `show_resource`/`show_project`/`show_item` and the UI's own
click-to-edit already make — which open `ResourceModal`/`ProjectModal`
(with `canDelete: true`, i.e. their "Remove" button visible) or
`RightPanel`'s item editor (whose "Delete" button is conditional on
`draftOrig` being set — i.e. editing an existing item, exactly the state
`openItem(id)` puts it in). A toast makes the intent explicit ("Confirm
deleting X — click Remove/Delete in the panel, or Cancel"), but the
actual deletion still goes through `onRDelete`/`onPDelete`/`onDeleteItem`
only when a human clicks that button in the panel. Voice can *open the
door*; it can never walk through it. This was a deliberate design choice
to get a real confirmation gate for free, reusing already-tested UI
flows, instead of building a new one-off "are you sure?" component per
entity type.

**This safety net earned its keep in testing, not just in theory.** With a
small local model (`qwen2.5:latest`) and only two real projects on the
board, asking to delete a project by a name that didn't match either one
("delete the Apollo project," after the seed data had already been
replaced) still produced a *confident* `delete_project` tool call — with
the *other* real project's id, not a refusal. The system prompt was
tightened afterward to explicitly forbid inventing/guessing an id, but
that alone isn't a reliable guarantee with a 7B model (see "Known
limitations" below). Because delete only opens a panel, that failure mode
surfaces as: the confirmation panel shows the *wrong* project's real name
and fields, plainly visible before any click — not a silent wrong
deletion. That gap between "what was said" and "what the panel shows" is
exactly the check a human confirmation step exists to catch.

### Route handler

`src/app/api/voice-command/route.ts`: validates the transcript is present,
checks `ANTHROPIC_API_KEY` **only** when the Anthropic provider is
selected (Ollama needs no key), runs the agent, and maps errors to status
codes — `Anthropic.APIError` → 502 with the SDK's message, anything else →
500 with `err.message` when available (useful for surfacing e.g. "Ollama
request failed (404): model not found" back to the toast — acceptable to
expose here since this is a local, single-user tool with no external
callers, same threat model as the persistence layer).

### Client hook (`useVoiceCommand.ts`)

- Wraps `window.SpeechRecognition` / `window.webkitSpeechRecognition` (no
  built-in TS types for this API — `speechRecognition.ts` declares a
  minimal ambient interface covering just what's used: `start`/`stop`,
  `onresult`/`onerror`/`onend`, `lang`/`interimResults`/`continuous`).
- **Browser-support detection uses `useSyncExternalStore`, not
  `useEffect` + `setState`.** The naive version
  (`useState(() => hasSpeechRecognition())`) causes a hydration mismatch —
  SSR has no `window`, so the server-rendered HTML never has the mic
  button, but a synchronous client-side check during the initial render
  says `true`, and React throws a hydration error at that boundary. Fixing
  that with `useEffect(() => setSupported(...), [])` avoids the mismatch
  but trips `eslint-plugin-react-hooks`'s `set-state-in-effect` rule
  (calling `setState` synchronously inside an effect body). Both were hit
  and fixed during development — `useSyncExternalStore` with a no-op
  `subscribe` (support never changes after mount) and a `() => false`
  server snapshot is the correct tool for "read a browser-only value
  without diverging from the server-rendered HTML."
- On result, calls `POST /api/voice-command`, then dispatches by
  `data.name` into the matching `agent*` store action, or shows the
  route's `message`/`error` as a toast.

### Continuous session

`recognition.continuous = true` keeps the mic open across multiple spoken
commands instead of closing after one. `event.results` grows across a
continuous session (Chrome appends each newly-recognized phrase rather
than replacing the list), but `onresult` firing means there's always a
newly-completed phrase at `results[results.length - 1]` — so grabbing just
the last entry each time is correct with or without continuous mode; no
new parsing logic was needed for this, just the one flag flip.

Everything else about continuous mode is state-machine bookkeeping, tracked
via `sessionActiveRef` (a ref, not state — it doesn't need to trigger
renders, `status` already does):

- **`status` no longer drops to `'idle'` between commands.** `runCommand`'s
  `finally` used to hard-reset to `'idle'`; now it sets
  `sessionActiveRef.current ? 'listening' : 'idle'`, so after a command
  finishes processing, the button reflects "still listening" rather than
  looking like the session ended.
- **The Toolbar's click handler switched from `status === 'listening' ?
  stop : start` to `status === 'idle' ? start : stop`.** With the old
  logic, clicking while `status === 'thinking'` (mid-command) would have
  called `start()` again — spinning up a second `SpeechRecognition`
  instance on top of the one already running. Since a session is "active"
  in both the `'listening'` and `'thinking'` states now, the click target
  had to become "anything non-idle stops the session," not just
  `'listening'` specifically.
- **Chrome can end a continuous session on its own** — a silence timeout
  or a minor network hiccup fires `onend` without the user asking to stop.
  `onend` now checks `sessionActiveRef.current`: if the session is still
  supposed to be active, it calls `recognition.start()` again to resume
  (wrapped in `try/catch` — calling `start()` while already
  starting/started throws, which is fine to swallow here); only sets
  `status` to `'idle'` when the stop was actually requested.
- **`no-speech`/`aborted` errors are swallowed, not surfaced.** A pause
  between spoken commands routinely produces a `no-speech` error in
  continuous mode — that's normal mid-session silence, not a failure, and
  Chrome typically follows it with the `onend` → auto-restart above
  anyway. Toasting "could not hear you" on every pause would make a
  multi-command session unusable; only errors *other* than those two end
  the session and notify the user.
- **`stop()` sets `sessionActiveRef.current = false` before calling
  `recognition.stop()`** — order matters here: the ref has to already say
  "not active" by the time the resulting `onend` fires, or `onend` would
  see a stale `true` and auto-restart the very session `stop()` was just
  asked to end.

No new server-side plumbing was needed for this — "streaming" here means
the mic session stays open and feeds a sequence of independent one-shot
requests to `/api/voice-command` as phrases complete, not a persistent
socket/SSE connection to the server. Each phrase is still a fully separate
`fetch` → interpret → dispatch cycle, same as the original single-shot
version; overlapping in-flight requests (speaking a second command before
the first one's response comes back) are handled independently and don't
block each other, though the button's `'thinking'` vs. `'listening'`
display can briefly show the wrong one if that happens (cosmetic only —
not tracked per-command, since it wasn't worth a request-counting ref for
what's a rare, harmless glitch).

### Store actions

`agentCreateResource` / `agentUpdateResource` / `agentCreateProject` /
`agentUpdateProject` / `agentCreateItem` / `agentUpdateItem` in
`useRoadmapStore.ts` mirror the mutation logic `onRSave`/`onPSave` (and,
for items, the plain array-append/map an `onSaveItem`→`commitItem` cycle
would eventually do) already had, but operate on plain arguments instead
of staged `rform`/`pform`/`draft` state — since this input comes from
structured LLM output (plus, for items, the client-side date-conversion
step described above), not a form the user is actively typing into.
`agentUpdateResource`, `agentUpdateProject`, and `agentUpdateItem` all
no-op with a "couldn't find that" toast if the LLM's returned `id` doesn't
match anything current (defensive: nothing guarantees the model didn't
hallucinate or reference something stale). No new store actions were
needed for `show_resource`/`show_project`/`show_item`/`go_to_date`/
`delete_resource`/`delete_project`/`delete_item` — they all dispatch to
`openRes`/`editResource`/`editProject`/`openItem`/`setFilter`, which
already existed for the UI's own use (see the previous two sections).

## Localization (EN/ES)

The voice agent's toasts are localized alongside the rest of the app —
worth documenting here even though the localization layer itself
(`src/lib/i18n/`) is shared, app-wide infrastructure, not something that
lives inside the voice agent's own directory. This section covers how
voice specifically plugs into it; see `src/lib/i18n/` for the mechanism
itself (also referenced from `docs/components.md`'s Toolbar coverage).

### What's localized here

- **Every toast the voice agent shows** — both the store's `agent*`
  actions (`"Added {name}"`, `"Couldn't find that project"`, etc.) and
  `useVoiceCommand.ts`'s own toasts (`"Showing {name}"`, `"Confirm
  deleting {name} — click Remove in the panel, or Cancel"`, `"Voice
  command failed"`, …) — render in whichever language is currently
  active, same as the rest of the UI chrome.
- **Speech *recognition* language** (`recognition.lang = navigator.language`
  in `useVoiceCommand.ts`) is separate from and unaffected by the EN/ES
  *display* toggle — it always follows the browser's own language
  setting, not the toggle state. Switching the toggle to Spanish doesn't
  make the mic start listening for Spanish if your browser is set to
  English; it only changes what language the toasts/UI render in. See
  "Can you use my voice in Spanish" earlier in this doc's history — that
  fix and this feature are related but independent: one is what the mic
  *hears*, the other is what the app *displays*.
- **Not localized**: the LLM's own clarification text (the `message`
  variant of `VoiceCommandResult`, shown verbatim when a command doesn't
  match a tool) and server-thrown config/connection errors (e.g. missing
  `ANTHROPIC_API_KEY`, an Ollama connection failure) — both are dynamic
  content generated outside `src/lib/i18n/`'s dictionary, and forcing them
  through translation would mean either sending locale to the API route
  or re-prompting the LLM in a target language, neither of which was in
  scope for this pass.

### How the toasts get translated

`useVoiceCommand.ts` and the store both import `t` directly from
`@/lib/i18n/translations` — the **non-hook** variant — rather than
`useTranslation()`'s hook. `runCommand` is a plain callback, not JSX, so
there's nothing to re-render when the locale changes mid-call; it just
needs the *current* locale at the moment each toast is composed, which
`t(text, params)` (a thin wrapper over `translate(getLocale(), text,
params)`) provides directly. Example, from the `show_resource` case:

```ts
showToast(t('Showing {name}', { name: r.name }))
```

`'Showing {name}'` is simultaneously the English display text (used as-is
when the locale is `'en'`) and the lookup key into the `es` dictionary —
see `src/lib/i18n/translations.ts`'s "English text is its own key" design
note for why there's no separate key namespace to maintain across ~35
toast strings.

### Same hydration-safety pattern as browser-support detection

`useTranslation()` (the hook variant, used by every *component* — not the
voice hook) reads the current locale via `useSyncExternalStore` with a
fixed `'en'` server snapshot, exactly the same technique this doc's
"Client hook" section describes for the mic button's browser-support
check: SSR has no `navigator`/`localStorage`, so the server-rendered HTML
must default to something fixed, and swapping to the real detected value
happens client-side through the external-store subscription rather than a
`useEffect` + `setState` (which would trip `set-state-in-effect`, per
that same earlier section). The difference in stakes: getting the mic
button's support flag wrong for one tick is invisible; getting the
*locale* wrong for one tick would flash the entire UI in the wrong
language on every load, so this was worth getting right the same way the
first time rather than rediscovering the pattern.

## Known limitations

- **Scope is intentionally narrow**: the 15 actions above and nothing
  else — no dependencies between items, no assigning resources/percentages
  to a task, no other app settings. Those have a meaningfully larger field
  surface (and, for dependencies, a clash/cycle-preview UX the item-edit
  panel already has for mouse-driven edits — see `docs/timeline-view.md`)
  that would need its own tool design.
- **Local model quality varies — confirmed, not just a theoretical
  caveat.** A 7–8B local model is noticeably less reliable at this kind
  of structured extraction than Claude, especially for ambiguous or
  multi-part commands or resolving a name to the *right* id when several
  are in play — see the delete-HITL section above for a concrete
  hallucination hit during testing. If accuracy matters more than
  cost/privacy for a given use, switch to the Anthropic provider.
- **No interim feedback** — nothing shows what was heard before it's sent
  off for interpretation (`interimResults` stays `false`); a misheard word
  just produces a wrong or "couldn't understand" result after the fact,
  discovered only from the toast.
- **Overlapping commands can show the wrong transient icon.** If a second
  command is spoken before the first one's response comes back, both are
  processed independently and correctly, but the button's
  `'thinking'`/`'listening'` display isn't tracked per-command — it can
  briefly show "listening" while a command is technically still in
  flight. Cosmetic only.
- **Chrome/Edge only** (Web Speech API support); the mic button simply
  doesn't render elsewhere.
- **The EN/ES display toggle and the mic's recognition language are
  independent** — switching the toggle doesn't change what the mic
  listens for, and a browser set to English won't get Spanish speech
  recognition just because the toggle is set to Spanish. See
  "Localization (EN/ES)" above.
- **Only delete is confirmation-gated.** Create/update/show/go-to-date all
  apply immediately, same as before — there's no "preview impact" pause
  like the item-edit flow gets (`docs/timeline-view.md` → Editing flow).
  Delete is the one place a voice command can't complete itself, by
  design (see "Delete = HITL" above).
- **`show_X`/`delete_X` open the same panel**, for both projects and
  items. Neither has a separate read-only detail view (see "Read /
  navigate actions" above), so a mis-transcribed "show" that actually got
  heard as "delete" (or vice versa) still lands you in the same panel
  either way — the toast wording is the only differentiator before you
  look at which button you're about to click.
- **Item tools weren't spared the local-model reliability caveat
  either — verified, not assumed.** Testing `create_item`/`update_item`/
  `show_item`/`delete_item` against the real current board (two real
  projects, one real task, all Spanish-named) with `qwen2.5:latest`
  produced correct results across a create, a move, a select, and a
  delete in one pass — better than the resource/project hallucination hit
  documented above, but that's one test session's worth of confidence,
  not a guarantee across every phrasing. The same "switch to Anthropic if
  accuracy matters more" advice applies here too.
