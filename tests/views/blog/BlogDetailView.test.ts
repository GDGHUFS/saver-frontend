import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiHttpError } from '@/api/client'
import BlogDetailView from '@/views/blog/BlogDetailView.vue'

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  getById: vi.fn(),
  getCurrentUser: vi.fn(),
}))

vi.mock('@/api/blog', () => ({
  blogApi: {
    delete: mocks.delete,
    getById: mocks.getById,
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
  content: '# 안전한 본문\n\n**강조**\n\n<script>alert(1)</script>',
  createdAt: '2026-07-12T09:00:00+09:00',
  id: 7,
  title: '상세 블로그 글',
  updatedAt: '2026-07-12T10:00:00+09:00',
}

function createDetailRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/blog', name: 'blog', component: { template: '<div>목록</div>' } },
      {
        path: '/blog/author/:userId',
        name: 'blog-author',
        component: { template: '<div>작성자</div>' },
      },
      {
        path: '/blog/:blogId/edit',
        name: 'blog-edit',
        component: { template: '<div>수정</div>' },
      },
      { path: '/blog/:blogId', name: 'blog-detail', component: BlogDetailView },
    ],
  })
}

describe('BlogDetailView', () => {
  beforeEach(() => {
    mocks.delete.mockReset()
    mocks.getById.mockReset()
    mocks.getCurrentUser.mockReset()
    mocks.getById.mockResolvedValue(post)
    mocks.getCurrentUser.mockResolvedValue({
      id: post.author.id,
      nickname: post.author.nickname,
      profileImage: post.author.profileImage,
    })
  })

  it('글 상세를 Markdown으로 표시하되 원시 HTML은 실행하지 않는다', async () => {
    const router = createDetailRouter()
    await router.push('/blog/7')
    await router.isReady()

    render(BlogDetailView, { global: { plugins: [router] } })

    expect(await screen.findByRole('heading', { name: '상세 블로그 글' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '안전한 본문' })).toBeInTheDocument()
    expect(screen.getByText('강조').tagName).toBe('STRONG')
    expect(document.querySelector('script')).not.toBeInTheDocument()
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument()
    expect(mocks.getById).toHaveBeenCalledWith(7, expect.any(AbortSignal))
  })

  it('현재 작성자에게만 수정과 삭제 동작을 제공한다', async () => {
    const router = createDetailRouter()
    await router.push('/blog/7')
    await router.isReady()

    render(BlogDetailView, { global: { plugins: [router] } })

    expect(await screen.findByRole('link', { name: '수정' })).toHaveAttribute('href', '/blog/7/edit')
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
  })

  it('다른 사용자의 글에는 수정과 삭제 동작을 노출하지 않는다', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: 999,
      nickname: '다른 사용자',
      profileImage: 'https://example.com/other.png',
    })
    const router = createDetailRouter()
    await router.push('/blog/7')
    await router.isReady()

    render(BlogDetailView, { global: { plugins: [router] } })
    await screen.findByRole('heading', { name: '상세 블로그 글' })

    expect(screen.queryByRole('link', { name: '수정' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
  })

  it('삭제 확인 후 API를 호출하고 목록으로 이동한다', async () => {
    mocks.delete.mockResolvedValue(undefined)
    const router = createDetailRouter()
    await router.push('/blog/7')
    await router.isReady()

    render(BlogDetailView, { global: { plugins: [router] } })
    await fireEvent.click(await screen.findByRole('button', { name: '삭제' }))

    expect(screen.getByRole('dialog', { name: '블로그 글을 삭제할까요?' })).toBeInTheDocument()
    expect(mocks.delete).not.toHaveBeenCalled()
    await fireEvent.click(screen.getByRole('button', { name: '삭제하기' }))

    await waitFor(() => expect(router.currentRoute.value.name).toBe('blog'))
    expect(mocks.delete).toHaveBeenCalledWith(7)
  })

  it('없는 글을 일반 네트워크 오류와 구분해 안내한다', async () => {
    mocks.getById.mockRejectedValue(new ApiHttpError(404, undefined))
    const router = createDetailRouter()
    await router.push('/blog/404')
    await router.isReady()

    render(BlogDetailView, { global: { plugins: [router] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('블로그 글을 찾을 수 없습니다.')
  })
})
