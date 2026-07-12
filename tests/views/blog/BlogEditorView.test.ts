import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiHttpError } from '@/api/client'
import BlogEditorView from '@/views/blog/BlogEditorView.vue'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  getById: vi.fn(),
  getCurrentUser: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/api/blog', () => ({
  blogApi: {
    create: mocks.create,
    getById: mocks.getById,
    update: mocks.update,
  },
}))

vi.mock('@/api/auth', () => ({
  authApi: { getCurrentUser: mocks.getCurrentUser },
}))

const currentUser = {
  id: 123456789,
  nickname: 'Saver 사용자',
  profileImage: 'https://example.com/profile.png',
}

const post = {
  author: currentUser,
  content: '기존 **전체 본문**',
  createdAt: '2026-07-12T09:00:00+09:00',
  id: 7,
  title: '기존 제목',
  updatedAt: '2026-07-12T10:00:00+09:00',
}

function createEditorRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>홈</div>' } },
      { path: '/blog', name: 'blog', component: { template: '<div>목록</div>' } },
      { path: '/blog/new', name: 'blog-new', component: BlogEditorView },
      { path: '/blog/:blogId/edit', name: 'blog-edit', component: BlogEditorView },
      {
        path: '/blog/:blogId',
        name: 'blog-detail',
        component: { template: '<div>상세</div>' },
      },
    ],
  })
}

describe('BlogEditorView', () => {
  beforeEach(() => {
    mocks.create.mockReset()
    mocks.getById.mockReset()
    mocks.getCurrentUser.mockReset()
    mocks.update.mockReset()
    mocks.getCurrentUser.mockResolvedValue(currentUser)
  })

  it('로그인 사용자가 Markdown 글을 작성하고 생성된 상세로 이동한다', async () => {
    mocks.create.mockResolvedValue({ id: 9, location: '/blog/9' })
    const router = createEditorRouter()
    await router.push('/blog/new')
    await router.isReady()

    render(BlogEditorView, { global: { plugins: [router] } })

    await fireEvent.update(await screen.findByLabelText('제목'), '  새 글 제목  ')
    await fireEvent.update(screen.getByLabelText('본문'), '  # 새 본문  ')
    expect(screen.getByRole('heading', { name: '새 본문' })).toBeInTheDocument()
    await fireEvent.click(screen.getByRole('button', { name: '글 작성' }))

    await waitFor(() => expect(router.currentRoute.value.path).toBe('/blog/9'))
    expect(mocks.create).toHaveBeenCalledWith({ title: '새 글 제목', content: '# 새 본문' })
  })

  it('수정 시 기존 글을 채우고 변경한 제목과 본문 전체를 PUT 입력으로 전달한다', async () => {
    mocks.getById.mockResolvedValue(post)
    mocks.update.mockResolvedValue(undefined)
    const router = createEditorRouter()
    await router.push('/blog/7/edit')
    await router.isReady()

    render(BlogEditorView, { global: { plugins: [router] } })

    const titleInput = await screen.findByDisplayValue('기존 제목')
    expect(screen.getByDisplayValue('기존 **전체 본문**')).toBeInTheDocument()
    await fireEvent.update(titleInput, '수정 제목')
    await fireEvent.update(screen.getByLabelText('본문'), '수정한 전체 본문')
    await fireEvent.click(screen.getByRole('button', { name: '전체 내용 수정' }))

    await waitFor(() => expect(router.currentRoute.value.path).toBe('/blog/7'))
    expect(mocks.update).toHaveBeenCalledWith(7, {
      title: '수정 제목',
      content: '수정한 전체 본문',
    })
  })

  it('다른 사용자의 글은 수정 폼을 표시하지 않는다', async () => {
    mocks.getById.mockResolvedValue(post)
    mocks.getCurrentUser.mockResolvedValue({
      id: 999,
      nickname: '다른 사용자',
      profileImage: 'https://example.com/other.png',
    })
    const router = createEditorRouter()
    await router.push('/blog/7/edit')
    await router.isReady()

    render(BlogEditorView, { global: { plugins: [router] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('수정할 권한이 없습니다.')
    expect(screen.queryByLabelText('제목')).not.toBeInTheDocument()
  })

  it('로그인하지 않은 사용자의 직접 접근을 차단한다', async () => {
    mocks.getCurrentUser.mockRejectedValue(new ApiHttpError(401, undefined))
    const router = createEditorRouter()
    await router.push('/blog/new')
    await router.isReady()

    render(BlogEditorView, { global: { plugins: [router] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('로그인이 필요합니다.')
    expect(screen.getByRole('link', { name: '로그인하러 가기' })).toHaveAttribute('href', '/')
  })
})
