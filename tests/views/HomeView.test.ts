import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiHttpError } from '@/api/client'
import HomeView from '@/views/HomeView.vue'

const authApiMocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getLoginUrl: vi.fn(() => '/authorize'),
  getWithdrawalUrl: vi.fn(() => '/auth/withdraw/authorize'),
  logout: vi.fn(),
}))

const blogApiMocks = vi.hoisted(() => ({
  getLatest: vi.fn(),
}))

const newsApiMocks = vi.hoisted(() => ({
  getLatest: vi.fn(),
}))

vi.mock('@/api/auth', () => ({ authApi: authApiMocks }))
vi.mock('@/api/blog', () => ({ blogApi: blogApiMocks }))
vi.mock('@/api/news', () => ({ newsApi: newsApiMocks }))

const latestPost = {
  author: {
    id: 123456789,
    nickname: 'Saver 사용자',
    profileImage: 'https://example.com/profile.png',
  },
  createdAt: '2026-07-12T09:00:00+09:00',
  id: 7,
  title: '메인에서 보는 최신 글',
  updatedAt: '2026-07-12T09:00:00+09:00',
}

function createHomeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/search', name: 'search', component: { template: '<div>검색 결과</div>' } },
      { path: '/blog', name: 'blog', component: { template: '<div>블로그</div>' } },
      { path: '/news', name: 'news', component: { template: '<div>뉴스</div>' } },
      {
        path: '/blog/author/:userId',
        name: 'blog-author',
        component: { template: '<div>작성자 글</div>' },
      },
      {
        path: '/blog/:blogId',
        name: 'blog-detail',
        component: { template: '<div>글 상세</div>' },
      },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  })
}

describe('HomeView', () => {
  beforeEach(() => {
    authApiMocks.getCurrentUser.mockRejectedValue(new ApiHttpError(401, undefined))
    blogApiMocks.getLatest.mockResolvedValue([])
    newsApiMocks.getLatest.mockResolvedValue([])
  })

  // 메인 검색 입력이 backend 계약과 같은 방식으로 공백을 정리해 결과 라우트로 전달하는지 보호한다.
  it('검색어를 정규화해 검색 결과 라우트로 이동한다', async () => {
    const router = createHomeRouter()
    await router.push('/')
    await router.isReady()
    render(HomeView, { global: { plugins: [router] } })

    await fireEvent.update(screen.getByRole('searchbox', { name: '통합 검색' }), '  한국외대   뉴스  ')
    await fireEvent.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() => {
      expect(router.currentRoute.value.query.q).toBe('한국외대 뉴스')
      expect(router.currentRoute.value.path).toBe('/search')
    })
  })

  it('메인 블로그 카드에서 최신 글 3개와 전체 보기 링크를 제공한다', async () => {
    blogApiMocks.getLatest.mockResolvedValue([latestPost])
    const router = createHomeRouter()
    await router.push('/')
    await router.isReady()

    render(HomeView, { global: { plugins: [router] } })

    expect(await screen.findByRole('link', { name: latestPost.title })).toHaveAttribute(
      'href',
      '/blog/7',
    )
    expect(
      screen.getAllByRole('link', { name: '전체 보기' }).some((link) => link.getAttribute('href') === '/blog'),
    ).toBe(true)
    expect(blogApiMocks.getLatest).toHaveBeenCalledWith(3, expect.any(AbortSignal))
  })

  it('메인 뉴스 카드에서 인증 없이 최신 뉴스 3개를 제공한다', async () => {
    newsApiMocks.getLatest.mockResolvedValue([
      {
        author: null,
        categories: [],
        comments: null,
        description: '뉴스 설명',
        enclosureLength: null,
        enclosureType: null,
        enclosureUrl: null,
        feedTitle: 'RSS',
        guid: null,
        guidIsPermalink: null,
        id: 1,
        link: 'https://example.com/news/1',
        pubDate: '2026-07-12T09:00:00+09:00',
        publisher: '한국외대 학보',
        sourceName: null,
        sourceUrl: null,
        title: '메인 최신 뉴스',
      },
    ])
    const router = createHomeRouter()
    await router.push('/')
    await router.isReady()

    render(HomeView, { global: { plugins: [router] } })

    expect(await screen.findByRole('link', { name: /메인 최신 뉴스/ })).toHaveAttribute(
      'href',
      'https://example.com/news/1',
    )
    expect(newsApiMocks.getLatest).toHaveBeenCalledWith(3, null, expect.any(AbortSignal))
  })
})
