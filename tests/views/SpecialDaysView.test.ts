import { fireEvent, render, screen, waitFor, within } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiHttpError } from '@/api/client'
import SpecialDaysView from '@/views/SpecialDaysView.vue'

const mocks = vi.hoisted(() => ({
  getByMonth: vi.fn(),
  getCurrentUser: vi.fn(),
}))

vi.mock('@/api/special-days', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/special-days')>()
  return { ...original, specialDaysApi: { getByMonth: mocks.getByMonth } }
})

vi.mock('@/api/auth', () => ({
  authApi: {
    getCurrentUser: mocks.getCurrentUser,
  },
}))

const specialDays = [
  {
    dateKind: '기념일',
    dateName: '제헌절',
    id: 1,
    isHoliday: false,
    observedDate: '2026-07-17',
  },
  {
    dateKind: '24절기',
    dateName: '대서',
    id: 2,
    isHoliday: false,
    observedDate: '2026-07-23',
  },
] as const

function createSpecialDaysRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/special-days', name: 'special-days', component: SpecialDaysView },
      { path: '/search', name: 'search', component: { template: '<div>검색</div>' } },
    ],
  })
}

async function renderSpecialDays(path = '/special-days?month=2026-07') {
  const router = createSpecialDaysRouter()
  await router.push(path)
  await router.isReady()
  const rendered = render(SpecialDaysView, { global: { plugins: [router] } })
  return { ...rendered, router }
}

describe('SpecialDaysView', () => {
  beforeEach(() => {
    mocks.getByMonth.mockReset().mockResolvedValue(specialDays)
    mocks.getCurrentUser.mockReset().mockResolvedValue({
      id: 1,
      nickname: 'Saver 사용자',
      profileImage: 'https://example.com/profile.png',
    })
  })

  it('월별 응답을 기다리는 동안 달력 대신 진행 상태를 표시한다', async () => {
    let resolveDays: ((days: typeof specialDays) => void) | undefined
    mocks.getByMonth.mockImplementation(
      () => new Promise((resolve) => (resolveDays = resolve)),
    )
    await renderSpecialDays()

    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중')
    expect(screen.queryByRole('button', { name: '2026-07-17, 제헌절' })).not.toBeInTheDocument()

    resolveDays?.(specialDays)
    expect(await screen.findByRole('button', { name: '2026-07-17, 제헌절' })).toBeInTheDocument()
  })

  // 로그인한 사용자가 특일 날짜를 선택하면 검색 API를 직접 호출하지 않고 검색 route 제안을 받는지 보호한다.
  it('특일을 달력에 표시하고 선택한 기념일의 검색 제안을 제공한다', async () => {
    await renderSpecialDays()

    await fireEvent.click(await screen.findByRole('button', { name: '2026-07-17, 제헌절' }))

    expect(screen.getByText('7월 17일')).toBeInTheDocument()
    const selectedDateCard = screen.getByRole('heading', { name: '선택한 날짜' }).closest('.card')
    expect(selectedDateCard).not.toBeNull()
    expect(within(selectedDateCard as HTMLElement).getByText('기념일')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: '제헌절 검색' })).toHaveAttribute(
      'href',
      '/search?q=%EC%A0%9C%ED%97%8C%EC%A0%88',
    )
    expect(mocks.getByMonth).toHaveBeenCalledWith('2026-07', expect.any(AbortSignal))
  })

  it('로그인하지 않은 사용자에게 검색 링크를 노출하지 않는다', async () => {
    mocks.getCurrentUser.mockRejectedValue(new ApiHttpError(401, undefined))
    await renderSpecialDays()

    await fireEvent.click(await screen.findByRole('button', { name: '2026-07-17, 제헌절' }))

    expect(await screen.findByText('로그인하면 이 기념일을 바로 검색할 수 있습니다.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '제헌절 검색' })).not.toBeInTheDocument()
  })

  it('이전·다음 월 이동을 route와 동기화하고 새 달을 조회한다', async () => {
    mocks.getByMonth.mockResolvedValueOnce(specialDays).mockResolvedValueOnce([])
    const { router } = await renderSpecialDays()
    await screen.findByRole('button', { name: '2026-07-17, 제헌절' })

    await fireEvent.click(screen.getByRole('button', { name: '다음 달' }))

    await waitFor(() => expect(router.currentRoute.value.query.month).toBe('2026-08'))
    expect(await screen.findByText('이 달에 등록된 기념일이 없습니다.')).toBeInTheDocument()
    expect(mocks.getByMonth).toHaveBeenLastCalledWith('2026-08', expect.any(AbortSignal))
  })

  it('카드 route의 날짜를 자동 선택하고 일반 날짜 선택도 상세에 반영한다', async () => {
    const { router } = await renderSpecialDays('/special-days?month=2026-07&date=2026-07-23')

    expect(await screen.findByText('7월 23일')).toBeInTheDocument()
    const selectedDateCard = screen.getByRole('heading', { name: '선택한 날짜' }).closest('.card')
    expect(selectedDateCard).not.toBeNull()
    expect(within(selectedDateCard as HTMLElement).getByText('대서')).toBeInTheDocument()
    await fireEvent.click(screen.getByRole('button', { name: '2026-07-24' }))

    expect(screen.getByText('7월 24일')).toBeInTheDocument()
    expect(screen.getByText('등록된 기념일이 없습니다.')).toBeInTheDocument()
    await waitFor(() => expect(router.currentRoute.value.query.date).toBe('2026-07-24'))
  })

  it('오류를 표시하고 같은 달을 다시 조회할 수 있다', async () => {
    mocks.getByMonth
      .mockRejectedValueOnce(new ApiHttpError(503, undefined))
      .mockResolvedValueOnce(specialDays)
    await renderSpecialDays()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '기념일 저장소를 일시적으로 사용할 수 없습니다.',
    )
    await fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByRole('button', { name: '2026-07-17, 제헌절' })).toBeInTheDocument()
    expect(mocks.getByMonth).toHaveBeenCalledTimes(2)
  })
})
