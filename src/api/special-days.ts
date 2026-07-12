import { apiClient } from '@/api/client'
import { isYearMonth } from '@/utils/calendar-date'

export const SPECIAL_DAY_KINDS = ['국경일', '기념일', '24절기', '잡절'] as const
export type SpecialDayKind = (typeof SPECIAL_DAY_KINDS)[number]

export interface SpecialDay {
  dateKind: SpecialDayKind
  dateName: string
  id: number
  isHoliday: boolean
  observedDate: string
}

const isoDatePattern = /^([1-9][0-9]{3})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function decodeObservedDate(value: unknown, requestedYearMonth: string): string {
  if (typeof value !== 'string') {
    throw new Error('observed_date must be a string')
  }
  const match = isoDatePattern.exec(value)
  if (match === null || !value.startsWith(`${requestedYearMonth}-`)) {
    throw new Error('observed_date must be a valid date in the requested month')
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
    throw new Error('observed_date must be a real calendar date')
  }
  return value
}

function decodeSpecialDayKind(value: unknown): SpecialDayKind {
  switch (value) {
    case '국경일':
    case '기념일':
    case '24절기':
    case '잡절':
      return value
    default:
      throw new Error('date_kind is invalid')
  }
}

function decodeSpecialDay(value: unknown, requestedYearMonth: string): SpecialDay {
  if (!isRecord(value)) {
    throw new Error('special day must be an object')
  }
  if (typeof value.id !== 'number' || !Number.isSafeInteger(value.id)) {
    throw new Error('special day id must be an integer')
  }
  if (typeof value.date_name !== 'string' || value.date_name.length === 0) {
    throw new Error('date_name must be a non-empty string')
  }
  if (typeof value.is_holiday !== 'boolean') {
    throw new Error('is_holiday must be a boolean')
  }

  return {
    dateKind: decodeSpecialDayKind(value.date_kind),
    dateName: value.date_name,
    id: value.id,
    isHoliday: value.is_holiday,
    observedDate: decodeObservedDate(value.observed_date, requestedYearMonth),
  }
}

function decodeSpecialDays(value: unknown, requestedYearMonth: string): readonly SpecialDay[] {
  if (!Array.isArray(value)) {
    throw new Error('special days response must be an array')
  }
  return value.map((item) => decodeSpecialDay(item, requestedYearMonth))
}

export const specialDaysApi = {
  getByMonth(yearMonth: string, signal?: AbortSignal): Promise<readonly SpecialDay[]> {
    if (!isYearMonth(yearMonth)) {
      throw new RangeError('yearMonth must use the YYYY-MM format')
    }

    return apiClient.request(`/special-days/${yearMonth}`, {
      decoder: (value) => decodeSpecialDays(value, yearMonth),
      signal,
    })
  },
}
