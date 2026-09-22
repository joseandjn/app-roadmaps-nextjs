// Icon catalog for the roles list (Settings → Roles). Kept small and
// curated rather than exposing all of lucide-react: each entry needs a
// stable `key` (persisted on Role.icon), a component, a short label (for
// the picker's tooltip), and the keywords iconForRoleName() matches
// against when a role is first created, so typing "Android" or "Backend"
// suggests a sensible icon without the user having to pick one by hand.
//
// lucide-react has no literal Android/Apple/API brand marks (trademarked
// logos aren't included) — Bot and Apple are the closest stand-ins in
// common use, and Webhook reads as "API" better than anything literal.
import {
  Apple, Bot, Bug, Circle, CircleUserRound, Cloud, Code, Compass, Database,
  Globe, Layers, LifeBuoy, Megaphone, Palette, Puzzle, Rocket, Server,
  ShieldCheck, Smartphone, TestTube, TrendingUp, Users, Webhook,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface RoleIconDef {
  key: string
  Icon: LucideIcon
  label: string
  keywords: string[]
}

export const DEFAULT_ROLE_ICON = 'circle'

// Order matters: iconForRoleName() returns the first keyword match, so more
// specific entries (android, ios, api...) come before broader ones
// (engineering, infra...) that would otherwise shadow them.
export const ROLE_ICONS: RoleIconDef[] = [
  { key: 'bot', Icon: Bot, label: 'Android', keywords: ['android'] },
  { key: 'apple', Icon: Apple, label: 'iOS / Apple', keywords: ['ios', 'iphone', 'ipad', 'apple', 'macos'] },
  { key: 'webhook', Icon: Webhook, label: 'API / Backend', keywords: ['api', 'backend', 'back-end', 'back end'] },
  { key: 'test-tube', Icon: TestTube, label: 'QA / Testing', keywords: ['qa', 'test', 'prueba', 'automation', 'automatizacion', 'automatización'] },
  { key: 'bug', Icon: Bug, label: 'Bugs', keywords: ['bug', 'debug'] },
  { key: 'globe', Icon: Globe, label: 'Web / Frontend', keywords: ['web', 'frontend', 'front-end', 'front end'] },
  { key: 'code', Icon: Code, label: 'Engineering', keywords: ['engineering', 'ingenieria', 'ingeniería', 'developer', 'dev', 'software'] },
  { key: 'server', Icon: Server, label: 'Infrastructure', keywords: ['infra', 'infrastructure', 'infraestructura', 'devops', 'sre', 'ops'] },
  { key: 'cloud', Icon: Cloud, label: 'Cloud', keywords: ['cloud', 'nube', 'aws', 'azure', 'gcp'] },
  { key: 'database', Icon: Database, label: 'Data', keywords: ['data', 'datos', 'database', 'analytics', 'analitica', 'analítica'] },
  { key: 'shield-check', Icon: ShieldCheck, label: 'Security', keywords: ['security', 'seguridad'] },
  { key: 'smartphone', Icon: Smartphone, label: 'Mobile', keywords: ['mobile', 'movil', 'móvil'] },
  { key: 'palette', Icon: Palette, label: 'Design', keywords: ['design', 'diseno', 'diseño', 'ux', 'ui'] },
  { key: 'compass', Icon: Compass, label: 'Product', keywords: ['product', 'producto'] },
  { key: 'layers', Icon: Layers, label: 'Platform', keywords: ['platform', 'plataforma'] },
  { key: 'trending-up', Icon: TrendingUp, label: 'Growth', keywords: ['growth', 'crecimiento'] },
  { key: 'megaphone', Icon: Megaphone, label: 'Marketing', keywords: ['marketing'] },
  { key: 'rocket', Icon: Rocket, label: 'Launch', keywords: ['launch', 'lanzamiento'] },
  { key: 'life-buoy', Icon: LifeBuoy, label: 'Support', keywords: ['support', 'soporte'] },
  { key: 'puzzle', Icon: Puzzle, label: 'Integrations', keywords: ['integration', 'integracion', 'integración', 'plugin'] },
  { key: 'users', Icon: Users, label: 'People / Management', keywords: ['management', 'gestion', 'gestión', 'lead', 'people', 'hr'] },
  { key: 'circle-user-round', Icon: CircleUserRound, label: 'Generic', keywords: [] },
  { key: DEFAULT_ROLE_ICON, Icon: Circle, label: 'Plain', keywords: [] },
]

const ICON_BY_KEY = new Map(ROLE_ICONS.map(d => [d.key, d]))

export function roleIconDef(key: string | undefined): RoleIconDef {
  return (key && ICON_BY_KEY.get(key)) || ICON_BY_KEY.get(DEFAULT_ROLE_ICON)!
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Best-effort icon guess from a role's name, used to pre-fill the picker
// when a role is created — never blocks manually picking a different one.
export function iconForRoleName(name: string): string {
  const n = normalize(name)
  for (const def of ROLE_ICONS) {
    if (def.keywords.some(k => n.includes(normalize(k)))) return def.key
  }
  return DEFAULT_ROLE_ICON
}
