import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiHttpError } from '@/api/client'
import SearchView from '@/views/SearchView.vue'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getLoginUrl: vi.fn(() => '/authorize'),
  runSearchPolling: vi.fn(),
}))

vi.mock('@/api/auth', () => ({
  authApi: {
    getCurrentUser: mocks.getCurrentUser,
    getLoginUrl: mocks.getLoginUrl,
  },
}))

vi.mock('@/composables/search-polling', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/composables/search-polling')>()
  return { ...original, runSearchPolling: mocks.runSearchPolling }
})

function createSearchRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/search', name: 'search', component: SearchView }],
  })
}

async function renderSearch(path = '/search') {
  const router = createSearchRouter()
  await router.push(path)
  await router.isReady()
  const rendered = render(SearchView, { global: { plugins: [router] } })
  return { ...rendered, router }
}

const searchResult = {
  elapsedMilliseconds: 25,
  items: [
    {
      imageUrl: null,
      snippet: '검색 결과 설명',
      title: '한국외대 검색 결과',
      url: 'https://example.com/result',
    },
  ],
  relatedSearches: ['한국외대 뉴스'],
}

describe('SearchView', () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockReset().mockResolvedValue({
      id: 1,
      nickname: 'Saver 사용자',
      profileImage: 'https://example.com/profile.png',
    })
    mocks.runSearchPolling.mockReset().mockResolvedValue(searchResult)
  })

  // 인증 확인 전에는 검색 API 흐름을 시작하지 않는지 보호한다.
  it('로그인하지 않은 사용자에게 로그인 진입점만 제공한다', async () => {
    mocks.getCurrentUser.mockRejectedValue(new ApiHttpError(401, undefined))
    await renderSearch('/search?q=비공개검색')

    expect(await screen.findByText('검색은 로그인한 사용자만 이용할 수 있습니다.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '카카오 로그인' })).toHaveAttribute('href', '/authorize')
    expect(mocks.runSearchPolling).not.toHaveBeenCalled()
  })

  it('route 검색어로 polling을 시작하고 완료 결과와 관련 검색어를 표시한다', async () => {
    await renderSearch('/search?q=한국외대')

    expect(await screen.findByRole('link', { name: '한국외대 검색 결과' })).toHaveAttribute(
      'href',
      'https://example.com/result',
    )
    expect(screen.getByText('검색 결과 설명')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '한국외대 뉴스' })).toHaveAttribute(
      'href',
      '/search?q=%ED%95%9C%EA%B5%AD%EC%99%B8%EB%8C%80+%EB%89%B4%EC%8A%A4',
    )
    expect(mocks.runSearchPolling).toHaveBeenCalledWith('한국외대', {
      signal: expect.any(AbortSignal),
    })
  })

  it('검색어를 정규화해 새 route에서 검색하고 중복 제출을 막는다', async () => {
    let resolveSearch: ((value: typeof searchResult) => void) | undefined
    mocks.runSearchPolling.mockImplementation(
      () => new Promise((resolve) => (resolveSearch = resolve)),
    )
    const { router } = await renderSearch()
    await screen.findByRole('searchbox', { name: '통합 검색' })

    await fireEvent.update(screen.getByRole('searchbox', { name: '통합 검색' }), '  한국외대   소식  ')
    await fireEvent.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() => expect(router.currentRoute.value.query.q).toBe('한국외대 소식'))
    expect(screen.getByRole('button', { name: '검색' })).toBeDisabled()
    await fireEvent.click(screen.getByRole('button', { name: '검색' }))
    expect(mocks.runSearchPolling).toHaveBeenCalledTimes(1)
    resolveSearch?.(searchResult)
  })

  it('빈 결과와 magicCode 만료 오류에 각각 복구 안내를 제공한다', async () => {
    mocks.runSearchPolling
      .mockResolvedValueOnce({ ...searchResult, items: [] })
      .mockRejectedValueOnce(new ApiHttpError(404, undefined))
    const { router } = await renderSearch('/search?q=없는검색')

    expect(await screen.findByText(/검색 결과가 없습니다/)).toBeInTheDocument()
    await router.push('/search?q=만료검색')

    expect(await screen.findByRole('alert')).toHaveTextContent('검색 결과의 유효 시간이 만료되었습니다.')
    expect(screen.getByRole('button', { name: '새 검색으로 다시 시도' })).toBeInTheDocument()
  })

  it('검색을 취소하면 실행 중인 polling signal을 중단한다', async () => {
    let pollingSignal: AbortSignal | undefined
    mocks.runSearchPolling.mockImplementation(
      (_query: string, options: { signal?: AbortSignal }) => {
        pollingSignal = options.signal
        return new Promise(() => undefined)
      },
    )
    await renderSearch('/search?q=취소검색')

    await fireEvent.click(await screen.findByRole('button', { name: '검색 취소' }))

    expect(pollingSignal?.aborted).toBe(true)
    expect(screen.getByText('검색어를 입력하면 통합 검색 결과를 확인할 수 있습니다.')).toBeInTheDocument()
  })
})
