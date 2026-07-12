import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiHttpError } from '@/api/client'
import BlogView from '@/views/BlogView.vue'

const mocks = vi.hoisted(() => ({
  getByAuthor: vi.fn(),
  getCurrentUser: vi.fn(),
  getLatest: vi.fn(),
}))

vi.mock('@/api/blog', () => ({
  BLOG_LATEST_MAX_COUNT: 100,
  blogApi: {
    getByAuthor: mocks.getByAuthor,
    getLatest: mocks.getLatest,
  },
}))

vi.mock('@/api/auth', () => ({
  authApi: { getCurrentUser: mocks.getCurrentUser },
}))

const post = {
  author: {
    id: 123456789,
    nickname: 'Saver 사용자',
    profileImage: 'https://example.com/profile.png',
  },
  createdAt: '2026-07-12T09:00:00+09:00',
  id: 7,
  title: '블로그 목록 글',
  updatedAt: '2026-07-12T10:00:00+09:00',
}

function createBlogRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>홈</div>' } },
      { path: '/blog', name: 'blog', component: BlogView },
      { path: '/blog/new', name: 'blog-new', component: { template: '<div>새 글</div>' } },
      { path: '/blog/author/:userId', name: 'blog-author', component: BlogView },
      {
        path: '/blog/:blogId',
        name: 'blog-detail',
        component: { template: '<div>상세</div>' },
      },
    ],
  })
}

describe('BlogView', () => {
  beforeEach(() => {
    mocks.getByAuthor.mockReset()
    mocks.getCurrentUser.mockReset()
    mocks.getLatest.mockReset()
    mocks.getCurrentUser.mockRejectedValue(new ApiHttpError(401, undefined))
  })

  it('최댓값으로 최신 글을 조회하고 로그인하지 않은 사용자에게 로그인 동선을 제공한다', async () => {
    mocks.getLatest.mockResolvedValue([post])
    const router = createBlogRouter()
    await router.push('/blog')
    await router.isReady()

    render(BlogView, { global: { plugins: [router] } })

    expect(await screen.findByRole('link', { name: post.title })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '로그인하고 글쓰기' })).toHaveAttribute('href', '/')
    expect(mocks.getLatest).toHaveBeenCalledWith(100, expect.any(AbortSignal))
  })

  it('로그인 사용자는 새 글 작성 링크를 사용할 수 있다', async () => {
    mocks.getLatest.mockResolvedValue([])
    mocks.getCurrentUser.mockResolvedValue({
      id: 123456789,
      nickname: 'Saver 사용자',
      profileImage: 'https://example.com/profile.png',
    })
    const router = createBlogRouter()
    await router.push('/blog')
    await router.isReady()

    render(BlogView, { global: { plugins: [router] } })

    expect(await screen.findByRole('link', { name: '새 글 작성' })).toHaveAttribute(
      'href',
      '/blog/new',
    )
    expect(await screen.findByText('표시할 블로그 글이 없습니다.')).toBeInTheDocument()
  })

  it('작성자 ID로 해당 사용자의 글을 조회한다', async () => {
    mocks.getByAuthor.mockResolvedValue([post])
    const router = createBlogRouter()
    await router.push('/blog/author/123456789')
    await router.isReady()

    render(BlogView, { global: { plugins: [router] } })

    expect(await screen.findByRole('heading', { name: 'Saver 사용자님의 글' })).toBeInTheDocument()
    expect(mocks.getByAuthor).toHaveBeenCalledWith(123456789, expect.any(AbortSignal))
  })

  it('목록 오류를 표시하고 재시도한다', async () => {
    mocks.getLatest.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([post])
    const router = createBlogRouter()
    await router.push('/blog')
    await router.isReady()

    render(BlogView, { global: { plugins: [router] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('블로그 글을 불러오지 못했습니다.')
    await fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(screen.getByRole('link', { name: post.title })).toBeInTheDocument())
    expect(mocks.getLatest).toHaveBeenCalledTimes(2)
  })
})
