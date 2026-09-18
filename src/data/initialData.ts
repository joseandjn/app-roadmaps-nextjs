import type { Project, Item, Resource, Dependency, Sprint, Settings } from '@/types'

export const INITIAL_RESOURCES: Resource[] = [
  { id: 'r1', name: 'Sara Klein', role: 'Engineering', cost: 14000, costUnit: 'month' },
  { id: 'r2', name: 'Tom Becker', role: 'Engineering', cost: 13000, costUnit: 'month' },
  { id: 'r3', name: 'Raj Mehta', role: 'Infrastructure', cost: 14500, costUnit: 'month' },
  { id: 'r4', name: 'Ben Cole', role: 'Infrastructure', cost: 12500, costUnit: 'month' },
  { id: 'r5', name: 'Lena Roth', role: 'Mobile', cost: 13500, costUnit: 'month' },
  { id: 'r6', name: 'Diego Santos', role: 'Mobile', cost: 12000, costUnit: 'month' },
  { id: 'r7', name: 'Nina Park', role: 'Growth', cost: 11500, costUnit: 'month' },
  { id: 'r8', name: 'Maya Singh', role: 'Design', cost: 12500, costUnit: 'month' },
  { id: 'r9', name: 'Leo Fontaine', role: 'Design', cost: 11000, costUnit: 'month' },
  { id: 'r10', name: 'Priya Nair', role: 'Platform', cost: 13800, costUnit: 'month' },
]

export const INITIAL_PROJECTS: Project[] = [
  { id: 'p1', name: 'Apollo — Checkout Revamp', desc: 'Rebuild the end-to-end checkout and payments flow.', owner: 'r1', category: 'Product', color: '#3b6ef5', status: 'In Progress' },
  { id: 'p2', name: 'Helios — Platform Migration', desc: 'Migrate core services to the new platform.', owner: 'r3', category: 'Infra', color: '#0ea5e9', status: 'In Progress' },
  { id: 'p3', name: 'Orbit — Mobile Offline', desc: 'Offline-first sync for the mobile apps.', owner: 'r5', category: 'Mobile', color: '#8b5cf6', status: 'Planned' },
  { id: 'p4', name: 'Nova — Growth Experiments', desc: 'Referral, pricing and activation experiments.', owner: 'r7', category: 'Growth', color: '#e0902a', status: 'In Progress' },
  { id: 'p5', name: 'Atlas — Design System', desc: 'Ship Design System 2.0 across surfaces.', owner: 'r8', category: 'Design', color: '#14b8a6', status: 'In Progress' },
]

const BASE = new Date(2025, 8, 29) // Sep 29 2025

function D(
  pid: string, id: string, title: string, s: number, dur: number,
  st: Item['status'], type: Item['type'], asg: [string, number][] = []
): Item {
  return { id, projectId: pid, title, startDay: s, dur, status: st, type, assignments: asg.map(([r, pct]) => ({ r, pct })) }
}

const rawItems: Item[] = [
  D('p1','a1','Checkout API',170,50,'In Progress','epic',[['r1',60],['r2',40]]),
  D('p1','a2','Payment integration',200,45,'Planned','epic',[['r2',70],['r10',30]]),
  D('p1','a3','Cart redesign',185,40,'In Progress','task',[['r1',40],['r9',30]]),
  D('p1','a4','Checkout GA',250,0,'Planned','milestone',[]),
  D('p2','h1','API Gateway',120,70,'In Progress','epic',[['r3',50],['r4',50]]),
  D('p2','h2','Service migration',150,80,'In Progress','epic',[['r4',70],['r3',30]]),
  D('p2','h3','Production cutover',230,35,'Planned','task',[['r3',80]]),
  D('p2','h4','Platform GA',270,0,'Planned','release',[]),
  D('p3','o1','Sync engine',160,60,'In Progress','epic',[['r5',60],['r6',40]]),
  D('p3','o2','Conflict UI',215,40,'Planned','task',[['r6',70]]),
  D('p3','o3','Offline GA',262,0,'Planned','milestone',[]),
  D('p4','n1','Referral engine',140,55,'In Progress','epic',[['r7',80]]),
  D('p4','n2','Pricing A/B',205,50,'Planned','epic',[['r7',60],['r1',20]]),
  D('p4','n3','Paywall ship',260,0,'Planned','milestone',[]),
  D('p5','t1','Core components',130,90,'In Progress','epic',[['r8',50],['r9',60]]),
  D('p5','t2','Docs site',215,45,'Planned','task',[['r8',40],['r9',40]]),
  D('p5','t3','DS 2.0 launch',265,0,'Planned','release',[]),
]

// Shift items so the earliest starts at day 14
const minStart = Math.min(...rawItems.map(i => i.startDay))
const shift = minStart - 14
export const START_DATE = new Date(BASE.getTime() + shift * 86400000)

export const INITIAL_ITEMS: Item[] = rawItems.map(i => ({ ...i, startDay: i.startDay - shift }))

const maxEnd = Math.max(...INITIAL_ITEMS.map(i => i.startDay + i.dur))
export const TOTAL_DAYS = maxEnd + 180 // buffer past the last item so there's room to add future work

export const TODAY_DAY = Math.round((new Date().getTime() - START_DATE.getTime()) / 86400000)

let de = 1
const E = (from: string, to: string): Dependency => ({ id: 'e' + de++, from, to })
export const INITIAL_DEPS: Dependency[] = [
  E('a1','h1'), E('a2','a1'), E('a4','a2'), E('a3','t1'),
  E('o2','o1'), E('h3','h2'), E('h4','h3'), E('n2','n1'),
]

// Default cadence: consecutive 2-week sprints across the whole timeline.
// Adjust individual ones (1 or 3 weeks) by dragging or editing in the app.
export const INITIAL_SPRINTS: Sprint[] = (() => {
  const list: Sprint[] = []
  let day = 0, n = 1
  while (day < TOTAL_DAYS) {
    const dur = Math.min(14, TOTAL_DAYS - day)
    list.push({ id: `sp${n}`, name: `Sprint ${n}`, startDay: day, dur })
    day += 14
    n++
  }
  return list
})()

export const DEFAULT_SETTINGS: Settings = {
  workHoursPerDay: 8,
  currencyCode: 'USD',
  currencySymbol: '$',
  countWeekends: true,
  holidays: [],
}

export const CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: 'USD', symbol: '$', label: 'Dólar estadounidense (USD)' },
  { code: 'PEN', symbol: 'S/', label: 'Sol peruano (PEN)' },
  { code: 'EUR', symbol: '€', label: 'Euro (EUR)' },
  { code: 'MXN', symbol: '$', label: 'Peso mexicano (MXN)' },
  { code: 'COP', symbol: '$', label: 'Peso colombiano (COP)' },
  { code: 'ARS', symbol: '$', label: 'Peso argentino (ARS)' },
  { code: 'GBP', symbol: '£', label: 'Libra esterlina (GBP)' },
  { code: 'BRL', symbol: 'R$', label: 'Real brasileño (BRL)' },
]

export const STATUS_CONFIG = {
  'In Progress': { bg: '#eaf1ff', bd: '#c2d4ff', fg: '#1d4ed8', dot: '#3b6ef5' },
  'At Risk':     { bg: '#fdf1e3', bd: '#f1d3a8', fg: '#9a5b00', dot: '#e0902a' },
  'Planned':     { bg: '#f4f4f5', bd: '#e4e4e7', fg: '#52525b', dot: '#a1a1aa' },
  'Done':        { bg: '#ecf6ef', bd: '#cde7d4', fg: '#1f7a3d', dot: '#16a34a' },
} as const

export const STATUS_ORDER: Item['status'][] = ['In Progress', 'At Risk', 'Planned', 'Done']
export const ITEM_TYPES: Item['type'][] = ['epic', 'task', 'milestone', 'release']
export const CATEGORIES = ['Product', 'Infra', 'Mobile', 'Growth', 'Design']
export const DEFAULT_PROJECT_TASKS = ['Desarrollo', 'Certificación', 'Gestión de pase', 'Pase a PRD']
export const ROLES = ['Engineering', 'Infrastructure', 'Mobile', 'Growth', 'Design', 'Platform', 'Product', 'Data', 'QA']
export const SCALE_PRESETS = [46, 17, 6.5, 2.4]
export const PROJECT_COLORS = ['#3b6ef5','#0ea5e9','#8b5cf6','#e0902a','#14b8a6','#ef4444','#64748b']
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']
