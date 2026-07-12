import { fireEvent, render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import LatestNewsCard from '@/views/home/LatestNewsCard.vue'

const mocks = vi.hoisted(() => ({ getLatest: vi.fn() }))
vi.mock('@/api/news', () => ({ newsApi: { getLatest: mocks.getLatest } }))

const renderOptions = {
  global: {
    stubs: { RouterLink: { template: '<a><slot /></a>' } },
  },
}

describe('LatestNewsCard', () => {
  beforeEach(() => mocks.getLatest.mockReset())

  it('최신 뉴스를 기다리는 동안 loading 상태를 표시한다', async () => {
    let resolveLatest: ((items: readonly never[]) => void) | undefined
    mocks.getLatest.mockReturnValue(
      new Promise<readonly never[]>((resolve) => {
        resolveLatest = resolve
      }),
    )
    render(LatestNewsCard, renderOptions)

    expect(screen.getByRole('status')).toHaveTextContent('최신 뉴스를 불러오는 중')
    resolveLatest?.([])
    expect(await screen.findByText('수집된 뉴스가 없습니다.')).toBeInTheDocument()
  })

  it('수집된 뉴스가 없으면 empty 상태를 표시한다', async () => {
    mocks.getLatest.mockResolvedValue([])
    render(LatestNewsCard, renderOptions)

    expect(await screen.findByText('수집된 뉴스가 없습니다.')).toBeInTheDocument()
  })

  it('조회 오류를 표시하고 재시도한다', async () => {
    mocks.getLatest.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([])
    render(LatestNewsCard, renderOptions)

    expect(await screen.findByRole('alert')).toHaveTextContent('최신 뉴스를 불러오지 못했습니다.')
    await fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('수집된 뉴스가 없습니다.')).toBeInTheDocument()
    expect(mocks.getLatest).toHaveBeenCalledTimes(2)
  })
})
