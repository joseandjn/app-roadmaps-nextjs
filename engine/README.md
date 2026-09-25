# Roadmap engine

Analyzes a roadmap and reports where it is inefficient or at risk. It lives
inside the app's repo but is **independent of the web**: no React, no Next.js,
no imports from `src/`. That is enforced by ESLint (`no-restricted-imports`
for `engine/**`) and by its own `tsconfig.json` (no DOM types), so the folder
can be lifted into a standalone API service later without changes.

## How it works

```
RoadmapSnapshot ──► analyzers (deterministic) ──► ranked Findings ──► narrate (optional LLM)
```

1. **Analyzers** compute facts from the data. Nothing is guessed, so the numbers
   can be trusted and are what the LLM is given as ground truth.
   - `overload` — stretches where a person's concurrent assignments exceed their
     capacity: their `availability` (share of their time available for this roadmap,
     0-100, default 100). Severity is relative to that capacity. Only working days count (weekends/holidays per `settings`); finished items
     and days before `todayDay` are ignored. Days a person is away are skipped: work then is a time-off conflict.
   - `timeoff` — work assigned on working days a person is away (`time_off_conflict`,
     one finding per time-off entry), with the items and person-days involved. Severity by
     person-days (≥5 high, ≥2 medium). Same scope as overload.
   - `schedule` — dependency conflicts (a dependent starts before what it waits
     on ends), dependency cycles, and one **critical path** per group of linked
     items: the chain of dependencies leading to the item that finishes last,
     with the idle working days between links.
   - `idle` — paid capacity nobody is scheduled to use: a run of 5+ working days
     between two pieces of one person's work (`idle_capacity`), and everyone with
     no unfinished work at all, grouped into one finding (`unassigned_resources`).
     Both are priced from each person's rate scaled by their availability (a rate of
     0 counts as "no rate"); people with 0% availability are never reported as idle. They are
     cross-checked against overloads, so free people during someone's overload are
     linked to it. Time after someone's last item is not reported. Time off is never idle:
     an absence inside a gap splits it, and unassigned people are priced only for the days
     they are around.
   - `sprints` — tasks that would fit in one sprint but straddle its boundary
     (`sprint_spillover`, one finding per sprint) and tasks longer than their sprint
     (`oversized_items`). Epics, milestones, finished tasks and past sprints are exempt.
   - Cost has no analyzer of its own: without a per-task value model, the honest
     deterministic cost signal is paid idle time, so it lives in the idle findings
     and in `summary.idleCost`.
2. **Findings** are ranked by severity, then kind, then score. Titles and
   details are produced in the requested locale (`es` / `en`).
3. **Narrator** (optional) asks an LLM to prioritize and explain the findings.
   It only suggests; any finding id it cites that doesn't exist is dropped, and
   if the LLM fails the deterministic findings are still returned.

Dependency direction: an edge `{ from, to }` means `from` depends on `to`.
Dates are integer day offsets from `originDate`, like in the app.

## Entry points

- `analyzeRoadmap(snapshot, { originDate, locale, todayDay })` — pure, synchronous.
- `handleAnalyzeRequest(rawBody, { llm })` — validates an untrusted JSON body and
  returns `{ status, body }`. Any HTTP layer only maps that onto its own
  response type. The Next.js route `src/app/api/analyze/route.ts` is 5 lines.
- `createLlmFromEnv(env)` — Ollama by default; `LLM_PROVIDER=anthropic` with
  `ANTHROPIC_API_KEY` (optional `ANTHROPIC_MODEL`, default `claude-opus-5`)
  uses Claude. `OLLAMA_BASE_URL` / `OLLAMA_MODEL` configure Ollama.

Request body (`POST /api/analyze`): `{ snapshot, originDate, locale?, todayDay?, narrate? }`.
`snapshot.sprints` and the resources' `role`/`cost`/`costUnit`/`availability`/`timeOff` are optional; without
them the sprint and cost analyses are simply skipped.
Send `narrate: false` for an instant, LLM-free reply and `narrate: true` to also
get `narrative` (or `narrativeError` if the LLM is unavailable).

## Commands

```
npm run engine:typecheck   # strict, no DOM lib
npm run engine:test        # node --test, TypeScript run natively by Node
```

Source files import each other with explicit `.ts` extensions so Node can run
them without a build step.

## Extracting it into its own service

Copy `engine/`, run `npm install` there (its `package.json` already declares
`@anthropic-ai/sdk`), and wrap `handleAnalyzeRequest` in any HTTP server: parse
the JSON body, call it with `{ llm: createLlmFromEnv(process.env) }`, and
return `body` with `status`.

## Not built yet

Applying suggestions (for example into a new scenario). Each analyzer returns
`Finding[]`, so a new one is one file in `analyzers/`, a finding type in
`findings.ts`, and a line in `analyze.ts`.
