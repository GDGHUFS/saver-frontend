import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
}

const specialDayDto = {
  id: 1,
  observed_date: '2026-07-17',
  date_kind: '기념일',
  date_name: '제헌절',
  is_holiday: false,
}

describe('specialDaysApi', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllGlobals())

  it('연월별 특일 응답을 검증해 domain 타입으로 변환한다', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse([specialDayDto]))
    vi.stubGlobal('fetch', fetchImplementation)
    const { specialDaysApi } = await import('@/api/special-days')

    await expect(specialDaysApi.getByMonth('2026-07')).resolves.toEqual([
      {
        dateKind: '기념일',
        dateName: '제헌절',
        id: 1,
        isHoliday: false,
        observedDate: '2026-07-17',
      },
    ])
    expect(fetchImplementation.mock.calls[0]?.[0]).toMatch(/\/special-days\/2026-07$/)
    expect(fetchImplementation.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'include',
      method: 'GET',
    })
  })

  it('유효하지 않은 연월은 요청 전에 거부한다', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>())
    const { specialDaysApi } = await import('@/api/special-days')

    expect(() => specialDaysApi.getByMonth('2026-7')).toThrow(RangeError)
    expect(() => specialDaysApi.getByMonth('2026-13')).toThrow(RangeError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('요청한 달과 다른 날짜, 실제로 존재하지 않는 날짜 및 알 수 없는 분류를 거부한다', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([{ ...specialDayDto, observed_date: '2026-08-17' }]))
      .mockResolvedValueOnce(jsonResponse([{ ...specialDayDto, observed_date: '2026-07-32' }]))
      .mockResolvedValueOnce(jsonResponse([{ ...specialDayDto, date_kind: '알 수 없음' }]))
    vi.stubGlobal('fetch', fetchImplementation)
    const { specialDaysApi } = await import('@/api/special-days')

    await expect(specialDaysApi.getByMonth('2026-07')).rejects.toMatchObject({
      name: 'ApiResponseError',
    })
    await expect(specialDaysApi.getByMonth('2026-07')).rejects.toMatchObject({
      name: 'ApiResponseError',
    })
    await expect(specialDaysApi.getByMonth('2026-07')).rejects.toMatchObject({
      name: 'ApiResponseError',
    })
  })
})
