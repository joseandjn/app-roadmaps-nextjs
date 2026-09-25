# Time off

Each person can have absences — vacation, leave, sick days — as date ranges
with an optional note. On those days their capacity is 0: any work assigned
to them then is flagged as a problem. Nothing is moved automatically; the
plan only tells you where it no longer holds.

## Functional description

### Entering time off

| Where | Best for |
|---|---|
| **Resource form** (Edit person → "Absences") | Reviewing or fixing one person's list: add, edit dates/note, remove. Shows working days per entry. |
| **Drag on the Resources grid** | Quick one-offs: drag across a person's row, release, type the note, Enter. Click a striped band to edit or remove it. A plain click still opens the cell panel. |
| **Import** (calendar button at the bottom of the people list) | The yearly HR calendar: paste rows from Excel/Google Sheets or load a CSV (`person, from, to, note`). A preview shows what will be imported, what's already there and what's wrong, row by row. |
| **Voice** | "Jhonly is on vacation from October 19th to the 25th". See `docs/voice-agent.md` → Time off. |

Dates are inclusive everywhere in the UI. Every change is one undo step
(Cmd+Z), including a whole import.

**Import format.** Tab, `;` or `,` separated (quotes respected), dates as
`YYYY-MM-DD` or `DD/MM/YYYY`, header row optional. People are matched by
name ignoring case, accents and punctuation ("Soto, Luis" = Luis Soto), or
by a unique partial match; a name matching two people is an error rather
than a guess. A row equal to an existing absence (or repeated in the paste)
is skipped as "already loaded".

### What it changes

| Place | Effect |
|---|---|
| Resources grid | Striped band over the exact days, with the note. A cell with work assigned during an absence turns amber (like an overload), with the working days in its tooltip. |
| Person panel | Current and upcoming absences, plus which tasks land on them. |
| Cell panel | "Away N working days in this period (note)", and a badge on each affected task. |
| Task panel | "away N days" next to the assignee, dates in the tooltip; recalculated as you move the task. |
| Timeline | "Time off" badge in the bar's hover card. |
| **Only issues** | Tasks with someone assigned on a working day they're away count as issues. |
| Overload | Days away don't count as overload — the work there is reported as a time-off conflict instead. |
| Costs | Unchanged by default (time off is paid). Settings → General → **"Time off reduces cost"** makes a person's working days away stop adding cost to their assignments, in Costs, KPIs, checkpoints and Compare. |
| Analysis | New finding "X has work assigned during time off", one per absence, with working days, person-days and tasks; "Show in Timeline" highlights them. Time off is never reported as idle capacity. See `engine/README.md`. |
| Compare scenarios | A person whose absences differ shows "Time off: X → Y days". |

Only **working days** count (weekends and holidays per Settings), both for
conflicts and for cost.

## Technical description

### Data

`Resource.timeOff?: TimeOff[]` with `TimeOff { id, startDay, dur, note? }`
— same day math as items (`startDay` offset from `START_DATE`, `dur`
calendar days, end exclusive). It lives in the scenario file with the rest
of the person, so a duplicated scenario copies it. `cleanTimeOff` (store)
sorts entries, drops a blank note and stores an empty list as absent.
`Settings.timeOffReducesCost?` (missing = `false`) is per scenario like the
rest of the settings.

### Files

| File | Role |
|---|---|
| `src/lib/roadmapUtils.ts` | `timeOffOn`, `capacityOn`, `timeOffWorkingDays` (overlapping entries count once), `assignedDuringTimeOff`, `sameTimeOff`; `assignmentCostsInRange` applies the cost setting |
| `src/lib/filters.ts` | `IssueKind` `'timeoff'` in `itemIssues` (takes `settings` for working days) |
| `src/store/useRoadmapStore.ts` | `rform.timeOff` for the resource form; `saveTimeOff`, `deleteTimeOff`, `importTimeOff` (one `set` each, so one undo step; import assigns ids) |
| `src/components/modals/ResourceModal.tsx` | "Absences" section |
| `src/components/views/ResourcesView.tsx` | Bands, flagged cells, drag-to-create |
| `src/components/TimeOffPopover.tsx` | Quick form for drag/click on the grid |
| `src/lib/timeOffImport.ts` | Pure parser for pasted/CSV rows (no app imports) |
| `src/components/modals/ImportTimeOffModal.tsx` | Paste/CSV dialog with preview |
| `src/components/RightPanel.tsx` | Person, cell and task panel details |
| `src/lib/agent/shared.ts`, `src/lib/voice/useVoiceCommand.ts` | `add_time_off` tool and executor |
| `engine/analyzers/timeoff.ts` | `time_off_conflict` finding |

### Rules worth knowing

- **Conflicts use every item**, not only the filtered ones — like the full
  load, so a filter never hides one.
- **`overloadedItemIds`** skips days the person is away; `resPeak` and the
  scenario's `overallocated` metric measure load, not daily capacity, so
  they're unchanged.
- **Drag vs. click**: the grid starts a selection on pointer down and only
  treats it as a drag after 5px of movement; the click that follows a
  drag is swallowed in the capture phase so the cell panel doesn't open.
- **Voice name check**: the tool's `resourceId` is an enum, so the model
  always returns a real id — even for someone not on the team. The hook
  refuses unless the chosen name appears in the transcript (fuzzy).
