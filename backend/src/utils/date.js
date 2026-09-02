import { config } from '../config.js'

const dateParts = (value, timeZone = config.businessTimezone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(value))
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
}

export function businessDateKey(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const { year, month, day } = dateParts(value)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function addBusinessDays(date, days) {
  const [year, month, day] = businessDateKey(date).split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days, 12))
  return next.toISOString().slice(0, 10)
}

export function databaseDate(value) {
  return new Date(`${businessDateKey(value)}T00:00:00.000Z`)
}

function zonedMidnightUtc(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const guess = Date.UTC(year, month - 1, day)
  const local = dateParts(new Date(guess))
  const offset = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second) - guess
  return new Date(guess - offset)
}

export function businessDayRange(value = new Date()) {
  const key = businessDateKey(value)
  return { start: zonedMidnightUtc(key), end: zonedMidnightUtc(addBusinessDays(key, 1)) }
}
