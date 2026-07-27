import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

const searchResponse = {
  no_result: false,
  normalized_query: '도서관 이용 시간',
  query: '도서관 이용 시간',
  result_count: 1,
  results: [
    {
      author: '외대학보 기자',
      category: '대학보도',
      chunk: {
        chunk_id: 244,
        chunk_index: 1,
        excerpt: '도서관 이용 시간과 학습 공간을 안내합니다.',
        heading: '도서관 이용',
        section_path: '캠퍼스 생활 > 도서관',
      },
      document_id: 37,
      matched_by: ['keyword', 'dense'],
      published_at: '2026-07-20',
      rank: 1,
      score: 0.0325,
      source_id: 101,
      source_type: 'hufspress',
      title: '방학 중 도서관 이용 안내',
      topics: ['도서관', '학사'],
    },
  ],
  search_mode: 'hybrid',
  similarity_threshold: 0.35,
}

describe('researchSearchApi', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_SEARCH_API_BASE_URL', 'https://search.example.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  // 독립 backend의 단일 frontend 계약과 credential 없는 교차 Origin 요청을 보호한다.
  it('POST /search/work 응답을 자체 검색 도메인 결과로 변환한다', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(searchResponse))
    vi.stubGlobal('fetch', fetchImplementation)
    const { researchSearchApi } = await import('@/api/research-search')

    await expect(researchSearchApi.search('  도서관   이용 시간  ')).resolves.toEqual({
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
          matchedBy: ['keyword', 'dense'],
          publishedAt: '2026-07-20',
          rank: 1,
          score: 0.0325,
          sourceId: 101,
          sourceType: 'hufspress',
          title: '방학 중 도서관 이용 안내',
          topics: ['도서관', '학사'],
        },
      ],
      noResult: false,
      normalizedQuery: '도서관 이용 시간',
      query: '도서관 이용 시간',
      resultCount: 1,
      similarityThreshold: 0.35,
    })
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://search.example.com/search/work',
      expect.objectContaining({
        body: JSON.stringify({ query: '도서관 이용 시간' }),
        credentials: 'omit',
        method: 'POST',
      }),
    )
  })

  it('no_result가 true인 정상 빈 결과를 반환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          ...searchResponse,
          no_result: true,
          result_count: 0,
          results: [],
        }),
      ),
    )
    const { researchSearchApi } = await import('@/api/research-search')

    await expect(researchSearchApi.search('없는 검색')).resolves.toMatchObject({
      items: [],
      noResult: true,
      resultCount: 0,
    })
  })

  it('결과 개수와 배열이 다르거나 필수 필드가 잘못된 응답을 거부한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          ...searchResponse,
          result_count: 2,
        }),
      ),
    )
    const { researchSearchApi } = await import('@/api/research-search')

    await expect(researchSearchApi.search('도서관')).rejects.toMatchObject({
      name: 'ApiResponseError',
    })
  })

  it('빈 검색어나 200자를 넘는 검색어를 요청 전에 거부한다', async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchImplementation)
    const { researchSearchApi } = await import('@/api/research-search')

    expect(() => researchSearchApi.search('   ')).toThrow(RangeError)
    expect(() => researchSearchApi.search('가'.repeat(201))).toThrow(RangeError)
    expect(fetchImplementation).not.toHaveBeenCalled()
  })
})
