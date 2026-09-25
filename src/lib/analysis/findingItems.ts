import type { Finding } from '@engine/index'

// The roadmap items a finding is about, for "Show in Timeline". Findings
// about people with no work (unassigned_resources) have none.
export function findingItemIds(f: Finding): string[] {
  const ids = (() => {
    switch (f.kind) {
      case 'overload': return f.evidence.items.map(i => i.id)
      case 'time_off_conflict': return f.evidence.items.map(i => i.id)
      case 'dependency_conflict': return [f.evidence.predecessor.id, f.evidence.successor.id]
      case 'dependency_cycle': return f.evidence.items.map(i => i.id)
      case 'critical_path': return f.evidence.chain.map(i => i.id)
      case 'idle_capacity': return [f.evidence.beforeItem.id, f.evidence.afterItem.id]
      case 'unassigned_resources': return []
      case 'sprint_spillover': return f.evidence.items.map(i => i.id)
      case 'oversized_items': return f.evidence.items.map(i => i.id)
    }
  })()
  return [...new Set(ids)]
}
