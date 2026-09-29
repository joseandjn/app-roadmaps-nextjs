import type { Dependency, Item, Project, Resource, Role, ScenarioData } from '@/types'

// Copying tasks from one scenario into another ("Copy to…",
// docs/timeline-order-and-copy-backlog.md, S2). Scenarios duplicated from
// each other share ids, so a task that already exists in the target is the
// same task: it's replaced. Projects, people and roles the tasks need come
// along only when the target doesn't have them. Pure: the client uses it
// for the preview and the server to apply the copy.

export interface CopyPayload {
  items: Item[]
  // The copied tasks' own dependencies ("Depends on": `from` is a copied task).
  deps: Dependency[]
  // Titles of the tasks those dependencies point to, for the summary when the
  // target doesn't have them.
  depTitles: Record<string, string>
  projects: Project[]
  resources: Resource[]
  roles: Role[]
}

export interface CopySummary {
  added: string[] // titles
  replaced: string[]
  projectsAdded: string[]
  resourcesAdded: string[]
  rolesAdded: string[]
  depsAdded: number
  // Dependencies on tasks the target doesn't have: "task → what it depended on".
  depsDropped: { from: string; to: string }[]
}

// What travels with the selected tasks.
export function buildCopyPayload(source: ScenarioData, itemIds: string[]): CopyPayload {
  const ids = new Set(itemIds)
  const items = source.items.filter(i => ids.has(i.id))
  const projectIds = new Set(items.map(i => i.projectId))
  const resourceIds = new Set(items.flatMap(i => i.assignments.map(a => a.r)))
  const resources = source.resources.filter(r => resourceIds.has(r.id))
  const roleNames = new Set([...items.flatMap(i => i.requiredRoles ?? []), ...resources.map(r => r.role)])
  const deps = source.deps.filter(e => ids.has(e.from))
  const targets = new Set(deps.map(e => e.to))
  return {
    items,
    deps,
    depTitles: Object.fromEntries(source.items.filter(i => targets.has(i.id)).map(i => [i.id, i.title])),
    projects: source.projects.filter(p => projectIds.has(p.id)),
    resources,
    roles: (source.roles ?? []).filter(r => roleNames.has(r.name)),
  }
}

export function applyCopy(target: ScenarioData, payload: CopyPayload): { data: ScenarioData; summary: CopySummary } {
  const summary: CopySummary = { added: [], replaced: [], projectsAdded: [], resourcesAdded: [], rolesAdded: [], depsAdded: 0, depsDropped: [] }

  const incoming = new Map(payload.items.map(i => [i.id, i]))
  const items = target.items.map(i => {
    const next = incoming.get(i.id)
    if (!next) return i
    summary.replaced.push(next.title)
    return next
  })
  const existing = new Set(target.items.map(i => i.id))
  for (const it of payload.items) {
    if (existing.has(it.id)) continue
    items.push(it)
    summary.added.push(it.title)
  }

  const projectIds = new Set(target.projects.map(p => p.id))
  const projects = [...target.projects]
  for (const p of payload.projects) {
    if (projectIds.has(p.id)) continue
    projects.push(p)
    summary.projectsAdded.push(p.name)
  }

  const resourceIds = new Set(target.resources.map(r => r.id))
  const resources = [...target.resources]
  for (const r of payload.resources) {
    if (resourceIds.has(r.id)) continue
    resources.push(r)
    summary.resourcesAdded.push(r.name)
  }

  const roleNames = new Set((target.roles ?? []).map(r => r.name))
  const roles = [...(target.roles ?? [])]
  for (const r of payload.roles) {
    if (roleNames.has(r.name)) continue
    roles.push(r)
    summary.rolesAdded.push(r.name)
  }

  // A copied task's "Depends on" is replaced by the source's: its old
  // dependencies in the target go, dependencies of others on it stay.
  const itemIds = new Set(items.map(i => i.id))
  const titleOf = (id: string) => items.find(i => i.id === id)?.title ?? payload.depTitles?.[id] ?? id
  const deps = target.deps.filter(e => !incoming.has(e.from))
  const depIds = new Set(deps.map(e => e.id))
  let n = 0
  for (const e of payload.deps) {
    if (!itemIds.has(e.from) || !itemIds.has(e.to)) {
      summary.depsDropped.push({ from: titleOf(e.from), to: titleOf(e.to) })
      continue
    }
    const id = depIds.has(e.id) ? `${e.id}_c${++n}` : e.id
    depIds.add(id)
    deps.push({ ...e, id })
    summary.depsAdded++
  }

  return { data: { ...target, items, projects, resources, roles, deps }, summary }
}

// A payload from the network, checked just enough that applying it can't
// corrupt a scenario: the right shapes and the ids the merge relies on.
export function isCopyPayload(v: unknown): v is CopyPayload {
  if (!v || typeof v !== 'object') return false
  const p = v as Record<string, unknown>
  const arr = (x: unknown): x is Record<string, unknown>[] => Array.isArray(x) && x.every(e => !!e && typeof e === 'object')
  if (!arr(p.items) || !arr(p.deps) || !arr(p.projects) || !arr(p.resources) || !arr(p.roles)) return false
  if (!p.depTitles || typeof p.depTitles !== 'object' || !Object.values(p.depTitles).every(t => typeof t === 'string')) return false
  const str = (x: unknown) => typeof x === 'string' && x.length > 0
  const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x)
  return p.items.length > 0
    && p.items.every(i => str(i.id) && str(i.projectId) && typeof i.title === 'string' && num(i.startDay) && num(i.dur) && Array.isArray(i.assignments))
    && p.deps.every(e => str(e.id) && str(e.from) && str(e.to))
    && p.projects.every(x => str(x.id) && typeof x.name === 'string')
    && p.resources.every(x => str(x.id) && typeof x.name === 'string')
    && p.roles.every(x => str(x.name))
}
