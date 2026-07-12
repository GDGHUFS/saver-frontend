import { describe, expect, it } from 'vitest'

import {
  createCalendarWeeks,
  differenceInCalendarDays,
  formatKoreanCalendarDate,
  shiftYearMonth,
} from '@/utils/calendar-date'

describe('calendar date utilities', () => {
  it('윤년과 요일에 맞춰 월간 달력 주를 만든다', () => {
    const weeks = createCalendarWeeks('2024-02')
    const days = weeks.flat().filter((day) => day !== null)

    expect(days).toHaveLength(29)
    expect(days[0]).toEqual({ day: 1, isoDate: '2024-02-01', weekday: 4 })
    expect(weeks.every((week) => week.length === 7)).toBe(true)
  })

  it('연도 경계를 넘어 월을 이동한다', () => {
    expect(shiftYearMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftYearMonth('2026-01', -1)).toBe('2025-12')
  })

  it('브라우저 시간대와 무관하게 달력 날짜 차이와 한국어 날짜를 계산한다', () => {
    expect(differenceInCalendarDays('2026-08-01', '2026-07-31')).toBe(1)
    expect(formatKoreanCalendarDate('2026-07-12')).toBe('7월 12일')
    expect(() => differenceInCalendarDays('2026-02-30', '2026-02-01')).toThrow(RangeError)
  })
})
