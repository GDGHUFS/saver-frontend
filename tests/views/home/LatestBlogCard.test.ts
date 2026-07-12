import { fireEvent, render, screen } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import LatestBlogCard from '@/views/home/LatestBlogCard.vue'

const mocks = vi.hoisted(() => ({
  getLatest: vi.fn(),
}))

vi.mock('@/api/blog', () => ({ blogApi: { getLatest: mocks.getLatest } }))

function createBlogRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/blog', name: 'blog', component: { template: '<div>블로그</div>' } },
      {
        path: '/blog/author/:userId',
        name: 'blog-author',
        component: { template: '<div>작성자</div>' },
      },
      {
        path: '/blog/:blogId',
        name: 'blog-detail',
        component: { template: '<div>상세</div>' },
      },
    ],
  })
}

describe('LatestBlogCard', () => {
  beforeEach(() => {
    mocks.getLatest.mockReset()
  })

  it('최신 글을 기다리는 동안 loading 상태를 표시한다', () => {
    mocks.getLatest.mockReturnValue(new Promise(() => undefined))

    render(LatestBlogCard, { global: { plugins: [createBlogRouter()] } })

    expect(screen.getByRole('status')).toHaveTextContent('최신 글을 불러오는 중')
  })

  it('최신 글이 없으면 오류와 구분되는 empty 상태를 표시한다', async () => {
    mocks.getLatest.mockResolvedValue([])

    render(LatestBlogCard, { global: { plugins: [createBlogRouter()] } })

    expect(await screen.findByText('아직 작성된 블로그 글이 없습니다.')).toBeInTheDocument()
  })

  it('최신 글 조회 실패 후 다시 시도할 수 있다', async () => {
    mocks.getLatest.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([])

    render(LatestBlogCard, { global: { plugins: [createBlogRouter()] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('최신 글을 불러오지 못했습니다.')
    await fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('아직 작성된 블로그 글이 없습니다.')).toBeInTheDocument()
    expect(mocks.getLatest).toHaveBeenCalledTimes(2)
  })
})
