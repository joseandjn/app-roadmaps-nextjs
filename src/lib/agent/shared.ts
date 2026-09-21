import { ROLES, CATEGORIES, STATUS_ORDER, ITEM_TYPES, getTodayDay } from '@/data/initialData'
import { dateStr } from '@/lib/roadmapUtils'

export type VoiceCommandResult =
  | { type: 'action'; name: string; input: Record<string, unknown> }
  | { type: 'message'; text: string }

export interface AgentToolDef {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema
}

export interface ResourceContext {
  id: string
  name: string
  role: string
  cost: number
  costUnit: 'month' | 'hour'
}

export interface ProjectContext {
  id: string
  name: string
  owner: string
  category: string
  status: string
}

export interface ItemContext {
  id: string
  title: string
  projectId: string
  type: string
  status: string
}

export const AGENT_TOOLS: AgentToolDef[] = [
  {
    name: 'create_resource',
    description: 'Add a new person to the roadmap as a resource.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: "The person's full name" },
        role: { type: 'string', enum: [...ROLES] },
        cost: { type: 'number', description: 'Cost rate in USD, in the unit given by costUnit. Use 0 if not mentioned.' },
        costUnit: { type: 'string', enum: ['month', 'hour'], description: 'Whether cost is a monthly or hourly rate. Defaults to month if not mentioned.' },
      },
      required: ['name', 'role', 'cost'],
    },
  },
  {
    name: 'update_resource',
    description: "Update an existing person's role and/or monthly cost. Only include fields the user actually wants changed.",
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id of the resource to update, from the existing resources list' },
        name: { type: 'string' },
        role: { type: 'string', enum: [...ROLES] },
        cost: { type: 'number', description: 'Cost rate in USD, in the unit given by costUnit' },
        costUnit: { type: 'string', enum: ['month', 'hour'], description: 'Whether cost is a monthly or hourly rate' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_project',
    description: 'Create a new project on the roadmap.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        desc: { type: 'string', description: 'Short one-sentence description' },
        owner: { type: 'string', description: 'id of the owning resource, from the existing resources list' },
        category: { type: 'string', enum: [...CATEGORIES] },
        status: { type: 'string', enum: [...STATUS_ORDER] },
      },
      required: ['name', 'owner'],
    },
  },
  {
    name: 'update_project',
    description: "Update an existing project's name, description, owner, category, and/or status. Only include fields the user actually wants changed.",
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id of the project to update, from the existing projects list' },
        name: { type: 'string' },
        desc: { type: 'string' },
        owner: { type: 'string', description: 'id of the owning resource, from the existing resources list' },
        category: { type: 'string', enum: [...CATEGORIES] },
        status: { type: 'string', enum: [...STATUS_ORDER] },
      },
      required: ['id'],
    },
  },
  {
    name: 'show_resource',
    description: 'Show an existing resource\'s summary (peak allocation, assigned projects). Use for "show me X" / "what does X have going on" requests.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id of the resource, from the existing resources list' },
      },
      required: ['id'],
    },
  },
  {
    name: 'show_project',
    description: 'Show an existing project\'s details. Use for "show me project X" / "open X" requests.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id of the project, from the existing projects list' },
      },
      required: ['id'],
    },
  },
  {
    name: 'go_to_date',
    description: 'Jump the roadmap view to a specific date, e.g. "go to July 2026" or "show me next month". Resolve relative dates using today\'s date given below.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Target date in YYYY-MM-DD format' },
      },
      required: ['date'],
    },
  },
  {
    name: 'delete_resource',
    description: 'Request deletion of an existing resource. This does NOT delete anything by itself — it only opens a confirmation panel that a human must explicitly approve.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id of the resource to delete, from the existing resources list' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_project',
    description: 'Request deletion of an existing project. This does NOT delete anything by itself — it only opens a confirmation panel that a human must explicitly approve.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id of the project to delete, from the existing projects list' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_item',
    description: 'Add a new task/epic/milestone/release to an existing project on the Timeline.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'id of the project this belongs to, from the existing projects list' },
        title: { type: 'string' },
        type: { type: 'string', enum: [...ITEM_TYPES], description: 'milestone and release are instants with no end date; epic and task span a date range' },
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format. Omit for milestone/release, or if not mentioned (defaults to a 3-week span).' },
        status: { type: 'string', enum: [...STATUS_ORDER], description: 'Defaults to Planned if not mentioned' },
      },
      required: ['projectId', 'title', 'type', 'startDate'],
    },
  },
  {
    name: 'update_item',
    description: 'Update an existing task/epic/milestone/release — rename, change status/type, or move/resize its dates. Only include fields the user actually wants changed. To move an item, give only startDate (keeps its current duration); to resize, give endDate; give both to reposition entirely.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id of the item to update, from the existing items list' },
        title: { type: 'string' },
        type: { type: 'string', enum: [...ITEM_TYPES] },
        status: { type: 'string', enum: [...STATUS_ORDER] },
        startDate: { type: 'string', description: 'New start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'New end date in YYYY-MM-DD format' },
      },
      required: ['id'],
    },
  },
  {
    name: 'show_item',
    description: 'Select and show an existing task/epic/milestone/release\'s details. Use for "select X" / "show me X" / "open X" requests about a task.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id of the item, from the existing items list' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_item',
    description: 'Request deletion of an existing task/epic/milestone/release. This does NOT delete anything by itself — it only opens a confirmation panel that a human must explicitly approve.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id of the item to delete, from the existing items list' },
      },
      required: ['id'],
    },
  },
]

export function buildSystemPrompt(
  resources: ResourceContext[],
  projects: ProjectContext[],
  items: ItemContext[]
): string {
  return `You are a voice command interpreter for a roadmap planning app. \
The user speaks a single command about people (resources), projects, or tasks/epics/milestones/ \
releases (items) on the Timeline. Call exactly one tool that matches their intent, resolving any \
name they say to the matching "id" in the lists below. If the request doesn't clearly map to one \
of the available tools (e.g. it's about dependencies between items, or is unclear), or if it \
names a person/project/item that isn't in the lists below, do NOT call a tool and never invent \
an id — respond with one short plain-text sentence instead, saying what you can help with or \
that you couldn't find that person/project/item.

delete_resource, delete_project, and delete_item only open a confirmation panel — a human still
has to click "Remove"/"Delete" themselves, so it's safe to call them whenever the user clearly
asks to delete/remove something; you are never directly destroying data.

Today's date, for resolving relative dates like "next month" or "in two weeks": ${dateStr(getTodayDay())}

Existing resources: ${JSON.stringify(resources)}
Existing projects: ${JSON.stringify(projects)}
Existing items (tasks/epics/milestones/releases): ${JSON.stringify(items)}`
}
