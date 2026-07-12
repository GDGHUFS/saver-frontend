import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import NewsView from '@/views/NewsView.vue'

const mocks = vi.hoisted(() => ({
  getPage: vi.fn(),
  getPublisher: vi.fn(),
  getPublishers: vi.fn(),
}))

vi.mock('@/api/news', () => ({
  NEWS_DEFAULT_PAGE_SIZE: 20,
  newsApi: {
    getPage: mocks.getPage,
    getPublisher: mocks.getPublisher,
    getPublishers: mocks.getPublishers,
  },
}))

const publisher = {
  categories: ['대학'],
  copyright: null,
  description: '학보 뉴스',
  docs: null,
  feedUrl: 'https://example.com/rss.xml',
  generator: null,
  id: 1,
  image: null,
  language: 'ko',
  lastBuildDate: '2026-07-12T09:00:00+09:00',
  link: 'https://example.com',
  managingEditor: null,
  pubDate: null,
  publisher: '한국외대 학보',
  rating: null,
  title: '학보 RSS',
  ttl: 60,
  webMaster: null,
}

const item = {
  author: '기자',
  categories: ['대학'],
  comments: null,
  description: '<p>뉴스 설명</p>',
  enclosureLength: null,
  enclosureType: null,
  enclosureUrl: null,
  feedTitle: '학보 RSS',
  guid: 'news-1',
  guidIsPermalink: false,
  id: 1,
  link: 'https://example.com/news/1',
  pubDate: '2026-07-12T09:00:00+09:00',
  publisher: '한국외대 학보',
  sourceName: null,
  sourceUrl: null,
  title: '첫 페이지 뉴스',
}

function page(items = [item], nextCursor: string | null = null) {
  return { hasMore: nextCursor !== null, items, nextCursor, order: null, pageSize: 20 }
}

describe('NewsView', () => {
  beforeEach(() => {
    mocks.getPage.mockReset()
    mocks.getPublisher.mockReset()
    mocks.getPublishers.mockReset()
    mocks.getPublishers.mockResolvedValue([publisher])
    mocks.getPublisher.mockResolvedValue(publisher)
    mocks.getPage.mockResolvedValue(page())
  })

  it('발행자와 첫 뉴스 페이지를 인증 없이 조회한다', async () => {
    render(NewsView)

    expect(await screen.findByRole('link', { name: /첫 페이지 뉴스/ })).toHaveAttribute(
      'href',
      'https://example.com/news/1',
    )
    expect(screen.getByRole('option', { name: '한국외대 학보' })).toBeInTheDocument()
    expect(mocks.getPage).toHaveBeenCalledWith({
      cursor: null,
      pageSize: 20,
      publisher: null,
      signal: expect.any(AbortSignal),
    })
  })

  it('next_cursor를 그대로 사용하고 이전 페이지 cursor를 기억한다', async () => {
    mocks.getPage
      .mockResolvedValueOnce(page([item], 'opaque-next-cursor'))
      .mockResolvedValueOnce(page([{ ...item, id: 2, title: '두 번째 페이지 뉴스' }]))
      .mockResolvedValueOnce(page([item], 'opaque-next-cursor'))
    render(NewsView)

    await screen.findByRole('link', { name: /첫 페이지 뉴스/ })
    await fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))

    expect(await screen.findByRole('link', { name: /두 번째 페이지 뉴스/ })).toBeInTheDocument()
    expect(mocks.getPage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: 'opaque-next-cursor' }),
    )
    await fireEvent.click(screen.getByRole('button', { name: '이전 페이지' }))

    expect(await screen.findByRole('link', { name: /첫 페이지 뉴스/ })).toBeInTheDocument()
    expect(mocks.getPage).toHaveBeenNthCalledWith(3, expect.objectContaining({ cursor: null }))
  })

  it('발행자 필터를 바꾸면 상세를 조회하고 cursor 없이 첫 페이지부터 다시 시작한다', async () => {
    mocks.getPage.mockResolvedValueOnce(page([item], 'old-cursor')).mockResolvedValueOnce(page())
    render(NewsView)
    await screen.findByRole('link', { name: /첫 페이지 뉴스/ })

    await fireEvent.update(screen.getByLabelText('뉴스 발행자 선택'), '한국외대 학보')

    expect(await screen.findByRole('heading', { name: '한국외대 학보' })).toBeInTheDocument()
    expect(mocks.getPublisher).toHaveBeenCalledWith('한국외대 학보', expect.any(AbortSignal))
    await waitFor(() => {
      expect(mocks.getPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ cursor: null, publisher: '한국외대 학보' }),
      )
    })
  })

  it('empty와 error를 구분하고 실패한 페이지를 재시도한다', async () => {
    mocks.getPublishers.mockResolvedValue([])
    mocks.getPage.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(page([]))
    render(NewsView)

    expect(await screen.findByRole('alert')).toHaveTextContent('뉴스를 불러오지 못했습니다.')
    await fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('조건에 맞는 뉴스가 없습니다.')).toBeInTheDocument()
    expect(mocks.getPage).toHaveBeenCalledTimes(2)
  })
})
