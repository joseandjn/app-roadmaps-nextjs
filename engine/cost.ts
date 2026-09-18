import type { EngineResource, EngineSettings } from './domain.ts'

// Same proration the app's Costs view uses: a monthly rate is spread over the
// average calendar month, an hourly rate over the configured work hours.
const AVG_DAYS_PER_MONTH = 30.44

export function dailyRate(resource: EngineResource, settings: EngineSettings): number | null {
  if (resource.cost === undefined || resource.cost <= 0) return null
  return resource.costUnit === 'hour' ? resource.cost * (settings.workHoursPerDay ?? 8) : resource.cost / AVG_DAYS_PER_MONTH
}

export function fmtMoney(amount: number, symbol: string): string {
  return symbol + Math.round(amount).toLocaleString('en-US')
}
