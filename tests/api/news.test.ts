import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
}

const itemDto = {
  id: 1,
  publisher: '한국외대 학보',
  feed_title: '학보 RSS',
  title: '새로운 소식',
  link: 'https://example.com/news/1',
  description: '<p>뉴스 설명</p>',
  author: '기자',
  comments: null,
  enclosure_url: null,
  enclosure_length: null,
  enclosure_type: null,
  guid: 'news-1',
  guid_is_permalink: false,
  pub_date: '2026-07-12T09:00:00+09:00',
  source_name: null,
  source_url: null,
  categories: ['대학'],
}

const publisherDto = {
  id: 1,
  publisher: '한국외대 학보',
  feed_url: 'https://example.com/rss.xml',
  title: '학보 RSS',
  link: 'https://example.com',
  description: '학보 뉴스',
  language: 'ko',
  copyright: null,
  managing_editor: null,
  web_master: null,
  pub_date: null,
  last_build_date: '2026-07-12T09:00:00+09:00',
  generator: null,
  docs: null,
  ttl: 60,
  image: null,
  rating: null,
  categories: ['대학'],
}

describe('newsApi', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllGlobals())

  it('최신 뉴스와 발행자 목록 응답을 검증해 변환한다', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([itemDto]))
      .mockResolvedValueOnce(jsonResponse([publisherDto]))
    vi.stubGlobal('fetch', fetchImplementation)
    const { newsApi } = await import('@/api/news')

    await expect(newsApi.getLatest(3)).resolves.toMatchObject([
      { id: 1, publisher: '한국외대 학보', title: '새로운 소식' },
    ])
    await expect(newsApi.getPublishers()).resolves.toMatchObject([
      { id: 1, publisher: '한국외대 학보', title: '학보 RSS' },
    ])
    expect(fetchImplementation.mock.calls[0]?.[0]).toMatch(/\/news\/latest\?count=3$/)
    expect(fetchImplementation.mock.calls[1]?.[0]).toMatch(/\/news\/publishers$/)
  })

  it('발행자 이름을 path와 query에서 안전하게 인코딩한다', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(publisherDto))
      .mockResolvedValueOnce(jsonResponse([itemDto]))
    vi.stubGlobal('fetch', fetchImplementation)
    const { newsApi } = await import('@/api/news')

    await newsApi.getPublisher(' 한국외대 학보 ')
    await newsApi.getLatest(10, '한국외대 학보')

    expect(fetchImplementation.mock.calls[0]?.[0]).toMatch(
      /\/news\/publishers\/%ED%95%9C%EA%B5%AD%EC%99%B8%EB%8C%80%20%ED%95%99%EB%B3%B4$/,
    )
    expect(fetchImplementation.mock.calls[1]?.[0]).toContain(
      'publisher=%ED%95%9C%EA%B5%AD%EC%99%B8%EB%8C%80+%ED%95%99%EB%B3%B4',
    )
  })

  it('서버가 발급한 cursor를 변경하지 않고 다음 페이지 요청에 전달한다', async () => {
    const cursor = 'opaque_cursor-value'
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        items: [itemDto],
        next_cursor: 'next_cursor-value',
        has_more: true,
        page_size: 20,
        order: 'pub_date DESC NULLS LAST, id DESC',
      }),
    )
    vi.stubGlobal('fetch', fetchImplementation)
    const { newsApi } = await import('@/api/news')

    await expect(newsApi.getPage({ cursor, pageSize: 20 })).resolves.toMatchObject({
      hasMore: true,
      nextCursor: 'next_cursor-value',
      pageSize: 20,
    })
    expect(fetchImplementation.mock.calls[0]?.[0]).toContain(`cursor=${cursor}`)
  })

  it('계약과 다른 응답 및 유효하지 않은 query를 거부한다', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ items: 'invalid' })))
    const { newsApi } = await import('@/api/news')

    await expect(newsApi.getPage()).rejects.toMatchObject({ name: 'ApiResponseError' })
    expect(() => newsApi.getLatest(101)).toThrow(RangeError)
    expect(() => newsApi.getPage({ cursor: '' })).toThrow(RangeError)
  })
})
