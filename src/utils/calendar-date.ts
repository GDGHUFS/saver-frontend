export interface CalendarDay {
  day: number
  isoDate: string
  weekday: number
}

export interface YearMonthParts {
  month: number
  year: number
}

const isoDatePattern = /^([1-9][0-9]{3})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/
const yearMonthPattern = /^[1-9][0-9]{3}-(0[1-9]|1[0-2])$/

function padTwo(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatYearMonth(year: number, month: number): string {
  if (!Number.isSafeInteger(year) || year < 1000 || year > 9999 || month < 1 || month > 12) {
    throw new RangeError('year and month are outside the supported calendar range')
  }
  return `${year}-${padTwo(month)}`
}

export function isYearMonth(value: string): boolean {
  return yearMonthPattern.test(value)
}

export function parseYearMonth(yearMonth: string): YearMonthParts | null {
  if (!isYearMonth(yearMonth)) {
    return null
  }
  return { month: Number(yearMonth.slice(5, 7)), year: Number(yearMonth.slice(0, 4)) }
}

export function getLocalTodayIsoDate(now = new Date()): string {
  return `${now.getFullYear()}-${padTwo(now.getMonth() + 1)}-${padTwo(now.getDate())}`
}

export function getLocalYearMonth(now = new Date()): string {
  return formatYearMonth(now.getFullYear(), now.getMonth() + 1)
}

export function shiftYearMonth(yearMonth: string, offset: number): string {
  const parsed = parseYearMonth(yearMonth)
  if (parsed === null || !Number.isSafeInteger(offset)) {
    throw new RangeError('yearMonth or offset is invalid')
  }
  const zeroBasedMonth = parsed.year * 12 + parsed.month - 1 + offset
  const year = Math.floor(zeroBasedMonth / 12)
  const month = (zeroBasedMonth % 12) + 1
  return formatYearMonth(year, month)
}

export function createCalendarWeeks(yearMonth: string): readonly (readonly (CalendarDay | null)[])[] {
  const parsed = parseYearMonth(yearMonth)
  if (parsed === null) {
    throw new RangeError('yearMonth is invalid')
  }

  const firstWeekday = new Date(Date.UTC(parsed.year, parsed.month - 1, 1)).getUTCDay()
  const lastDay = new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate()
  const cells: (CalendarDay | null)[] = Array.from({ length: firstWeekday }, () => null)
  for (let day = 1; day <= lastDay; day += 1) {
    cells.push({
      day,
      isoDate: `${yearMonth}-${padTwo(day)}`,
      weekday: (firstWeekday + day - 1) % 7,
    })
  }
  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  const weeks: (readonly (CalendarDay | null)[])[] = []
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7))
  }
  return weeks
}

function isoDateToUtcMilliseconds(isoDate: string): number {
  const match = isoDatePattern.exec(isoDate)
  if (match === null) {
    throw new RangeError('isoDate is invalid')
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError('isoDate is not a real calendar date')
  }
  return date.getTime()
}

export function differenceInCalendarDays(laterIsoDate: string, earlierIsoDate: string): number {
  return (isoDateToUtcMilliseconds(laterIsoDate) - isoDateToUtcMilliseconds(earlierIsoDate)) / 86_400_000
}

export function formatKoreanCalendarDate(isoDate: string): string {
  const match = isoDatePattern.exec(isoDate)
  if (match === null) {
    throw new RangeError('isoDate is invalid')
  }
  isoDateToUtcMilliseconds(isoDate)
  return `${Number(match[2])}월 ${Number(match[3])}일`
}
