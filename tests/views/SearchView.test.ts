import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiHttpError } from '@/api/client'
import SearchView from '@/views/SearchView.vue'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getLoginUrl: vi.fn(() => '/authorize'),
  researchSearch: vi.fn(),
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

vi.mock('@/api/research-search', () => ({
  researchSearchApi: {
    search: mocks.researchSearch,
  },
}))

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
  aiSummary: '한국외대의 최신 소식과 주요 정보를 간단히 정리한 내용입니다.',
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

const researchSearchResult = {
  items: [
    {
      author: '외대학보 기자',
      category: '대학보도',
      chunk: {
        chunkId: 244,
        chunkIndex: 1,
        excerpt: '도서관 이용 시간과 학습 공간을 안내합니다.',
        heading: '도서관 이용',
        sectionPath: '캠퍼스 생활 > 도서관',
      },
      documentId: 37,
      matchedBy: ['keyword', 'dense'] as const,
      publishedAt: '2026-07-20',
      rank: 1,
      score: 0.0325,
      sourceId: 101,
      sourceType: 'hufspress' as const,
      title: '방학 중 도서관 이용 안내',
      topics: ['도서관', '학사'],
    },
  ],
  noResult: false,
  normalizedQuery: '도서관',
  query: '도서관',
  resultCount: 1,
  similarityThreshold: 0.35,
}

describe('SearchView', () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockReset().mockResolvedValue({
      id: 1,
      nickname: 'Saver 사용자',
      profileImage: 'https://example.com/profile.png',
    })
    mocks.runSearchPolling.mockReset().mockResolvedValue(searchResult)
    mocks.researchSearch.mockReset().mockResolvedValue(researchSearchResult)
  })

  // 인증 확인 전에는 검색 API 흐름을 시작하지 않는지 보호한다.
  it('로그인하지 않은 사용자에게 로그인 진입점만 제공한다', async () => {
    mocks.getCurrentUser.mockRejectedValue(new ApiHttpError(401, undefined))
    await renderSearch('/search?q=비공개검색')

    expect(
      await screen.findByText('포털 검색은 로그인한 사용자만 이용할 수 있습니다.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '카카오 로그인' })).toHaveAttribute('href', '/authorize')
    expect(mocks.runSearchPolling).not.toHaveBeenCalled()
    expect(mocks.researchSearch).not.toHaveBeenCalled()
  })

  it('로그인하지 않아도 자체 검색엔진 결과와 자료 출처를 표시한다', async () => {
    mocks.getCurrentUser.mockRejectedValue(new ApiHttpError(401, undefined))
    await renderSearch('/search?engine=research&q=도서관')

    expect(
      await screen.findByRole('heading', { name: '도서관 자체 검색 결과' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '검색 자료 출처' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '개인 블로그' })).toHaveAttribute(
      'href',
      'https://blog.sonjaehyuk.me/',
    )
    expect(
      screen
        .getAllByRole('link', { name: '외대학보' })
        .every((link) => link.getAttribute('href') === 'http://www.hufspress.net/'),
    ).toBe(true)
    expect(screen.getByRole('heading', { name: '방학 중 도서관 이용 안내' })).toBeInTheDocument()
    expect(screen.getByText('도서관 이용 시간과 학습 공간을 안내합니다.')).toBeInTheDocument()
    expect(screen.getByText('상대 점수 0.0325')).toBeInTheDocument()
    expect(screen.getByText('키워드 + 의미 검색')).toBeInTheDocument()
    expect(mocks.researchSearch).toHaveBeenCalledWith('도서관', expect.any(AbortSignal))
    expect(mocks.runSearchPolling).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'AI 간단 요약' })).not.toBeInTheDocument()
  })

  it('검색 방식을 전환하면 이전 결과와 병행하지 않고 선택한 방식만 표시한다', async () => {
    mocks.getCurrentUser.mockRejectedValue(new ApiHttpError(401, undefined))
    const { router } = await renderSearch('/search?engine=research&q=도서관')
    await screen.findByRole('heading', { name: '도서관 자체 검색 결과' })

    await fireEvent.click(screen.getByRole('radio', { name: '포털 검색' }))

    await waitFor(() => expect(router.currentRoute.value.query.engine).toBeUndefined())
    expect(
      await screen.findByText('포털 검색은 로그인한 사용자만 이용할 수 있습니다.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: '도서관 자체 검색 결과' }),
    ).not.toBeInTheDocument()
    expect(mocks.runSearchPolling).not.toHaveBeenCalled()

    await fireEvent.click(screen.getByRole('radio', { name: /자체 검색엔진/ }))

    expect(
      await screen.findByRole('heading', { name: '도서관 자체 검색 결과' }),
    ).toBeInTheDocument()
    expect(mocks.researchSearch).toHaveBeenCalledTimes(2)
  })

  it('자체 검색의 loading과 취소 상태를 제공하고 실행 중인 요청을 중단한다', async () => {
    let searchSignal: AbortSignal | undefined
    mocks.researchSearch.mockImplementation(
      (_query: string, signal?: AbortSignal) => {
        searchSignal = signal
        return new Promise(() => undefined)
      },
    )
    await renderSearch('/search?engine=research&q=검색실험')

    expect(await screen.findByText('검색 실험을 실행하고 있습니다.')).toBeInTheDocument()
    await fireEvent.click(screen.getByRole('button', { name: '검색 취소' }))

    expect(searchSignal?.aborted).toBe(true)
    expect(
      screen.getByText('검색어를 입력하면 자체 검색엔진 결과를 확인할 수 있습니다.'),
    ).toBeInTheDocument()
  })

  it('자체 검색의 빈 결과와 API 오류에 각각 복구 안내를 제공한다', async () => {
    mocks.researchSearch
      .mockResolvedValueOnce({
        ...researchSearchResult,
        items: [],
        noResult: true,
        resultCount: 0,
      })
      .mockRejectedValueOnce(new ApiHttpError(503, undefined))
    const { router } = await renderSearch('/search?engine=research&q=없는검색')

    expect(await screen.findByText(/검색 결과가 없습니다/)).toBeInTheDocument()
    await router.push('/search?engine=research&q=오류검색')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '자체 검색엔진을 일시적으로 사용할 수 없습니다.',
    )
    expect(screen.getByRole('button', { name: '새 검색으로 다시 시도' })).toBeInTheDocument()
  })

  it('route 검색어로 polling을 시작하고 완료 결과와 관련 검색어를 표시한다', async () => {
    await renderSearch('/search?q=한국외대')

    const aiSummaryHeading = await screen.findByRole('heading', { name: 'AI 간단 요약' })
    expect(screen.getByText(searchResult.aiSummary)).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: '한국외대 검색 결과' })).toHaveAttribute(
      'href',
      'https://example.com/result',
    )
    const resultHeading = document.querySelector('#search-results-heading')
    if (resultHeading === null) {
      throw new Error('검색 결과 제목을 찾을 수 없습니다.')
    }
    expect(
      aiSummaryHeading.compareDocumentPosition(resultHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByText('검색 결과 설명')).toBeInTheDocument()
    expect(document.querySelector('.result-favicon-image')).toHaveAttribute(
      'src',
      'https://example.com/favicon.ico',
    )
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
      .mockResolvedValueOnce({ ...searchResult, aiSummary: null, items: [] })
      .mockRejectedValueOnce(new ApiHttpError(404, undefined))
    const { router } = await renderSearch('/search?q=없는검색')

    expect(await screen.findByText(/검색 결과가 없습니다/)).toBeInTheDocument()
    await router.push('/search?q=만료검색')

    expect(await screen.findByRole('alert')).toHaveTextContent('검색 결과의 유효 시간이 만료되었습니다.')
    expect(screen.getByRole('button', { name: '새 검색으로 다시 시도' })).toBeInTheDocument()
  })

  it('AI 요약만 완료된 partial 결과를 빈 결과로 처리하지 않는다', async () => {
    mocks.runSearchPolling.mockResolvedValue({
      ...searchResult,
      items: [],
      relatedSearches: [],
    })

    await renderSearch('/search?q=요약검색')

    expect(await screen.findByRole('heading', { name: 'AI 간단 요약' })).toBeInTheDocument()
    expect(screen.queryByText('다른 검색어로 다시 시도해 보세요.')).not.toBeInTheDocument()
    expect(screen.getByText('함께 표시할 일반 검색 결과가 없습니다.')).toBeInTheDocument()
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
