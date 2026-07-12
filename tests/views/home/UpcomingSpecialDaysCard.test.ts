import { fireEvent, render, screen } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import UpcomingSpecialDaysCard from '@/views/home/UpcomingSpecialDaysCard.vue'

const mocks = vi.hoisted(() => ({ getByMonth: vi.fn() }))

vi.mock('@/api/special-days', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/special-days')>()
  return { ...original, specialDaysApi: { getByMonth: mocks.getByMonth } }
})

function item(id: number, dateName: string, observedDate: string, isHoliday = false) {
  return { dateKind: '기념일', dateName, id, isHoliday, observedDate }
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/special-days', name: 'special-days', component: { template: '<div />' } },
  ],
})

describe('UpcomingSpecialDaysCard', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 12, 12, 0, 0))
    mocks.getByMonth.mockReset()
    await router.push('/')
    await router.isReady()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('현재와 다음 달에서 오늘 이후 가까운 기념일 3개를 표시한다', async () => {
    mocks.getByMonth
      .mockResolvedValueOnce([
        item(1, '지난 기념일', '2026-07-01'),
        item(2, '오늘 기념일', '2026-07-12'),
        item(3, '다가오는 기념일', '2026-07-20'),
      ])
      .mockResolvedValueOnce([
        item(4, '다음 달 첫 기념일', '2026-08-01', true),
        item(5, '네 번째 기념일', '2026-08-02'),
      ])
    render(UpcomingSpecialDaysCard, { global: { plugins: [router] } })

    expect(await screen.findByText('오늘 기념일')).toBeInTheDocument()
    expect(screen.queryByText('지난 기념일')).not.toBeInTheDocument()
    expect(screen.getByText('오늘')).toBeInTheDocument()
    expect(screen.getByText('D-8')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /다음 달 첫 기념일/ })).toHaveAttribute(
      'href',
      '/special-days?month=2026-08&date=2026-08-01',
    )
    expect(screen.queryByText('네 번째 기념일')).not.toBeInTheDocument()
    expect(mocks.getByMonth).toHaveBeenNthCalledWith(1, '2026-07', expect.any(AbortSignal))
    expect(mocks.getByMonth).toHaveBeenNthCalledWith(2, '2026-08', expect.any(AbortSignal))
  })

  it('불러오기 실패 후 다시 시도할 수 있다', async () => {
    mocks.getByMonth
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([item(2, '재시도 기념일', '2026-07-12')])
      .mockResolvedValueOnce([])
    render(UpcomingSpecialDaysCard, { global: { plugins: [router] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('가까운 기념일을 불러오지 못했습니다.')
    await fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('재시도 기념일')).toBeInTheDocument()
  })

  it('두 달 모두 다가오는 항목이 없으면 empty 상태를 표시한다', async () => {
    mocks.getByMonth.mockResolvedValue([])
    render(UpcomingSpecialDaysCard, { global: { plugins: [router] } })

    expect(await screen.findByText('가까운 기념일이 없습니다.')).toBeInTheDocument()
  })
})
