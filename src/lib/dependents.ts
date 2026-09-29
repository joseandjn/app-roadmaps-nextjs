import type { Dependency } from '@/types'

// Everything that depends on item `id`, directly or down the chain: with
// B depending on A and C on B, the dependents of A are B and C. A dependency
// `{ from, to }` means `from` depends on `to`. Cycles are cut (each item is
// visited once) and `id` itself is never included. Nearest first.
export function dependentsOf(deps: Dependency[], id: string): string[] {
  const dependentsByItem = new Map<string, string[]>()
  for (const e of deps) {
    const list = dependentsByItem.get(e.to)
    if (list) list.push(e.from)
    else dependentsByItem.set(e.to, [e.from])
  }
  const seen = new Set([id])
  const out: string[] = []
  const queue = [id]
  while (queue.length) {
    for (const next of dependentsByItem.get(queue.shift()!) ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      out.push(next)
      queue.push(next)
    }
  }
  return out
}
