import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const magicCode = 'A'.repeat(43)

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

const completedResult = {
  magicCode,
  status: 'COMPLETED',
  result: {
    data: {
      search: [
        {
          url: 'https://example.com/result',
          title: '검색 결과',
          snippet: '결과 설명',
          image: { url: 'https://example.com/image.png' },
        },
      ],
      related_search: [{ title: '관련 검색어' }],
    },
    meta: { ms: 42 },
  },
}

describe('searchApi', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllGlobals())

  // 검색 접수와 결과 조회가 서로 다른 HTTP 상태 및 DTO 계약을 유지하는지 보호한다.
  it('검색을 접수하고 pending과 completed 응답을 구분해 변환한다', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ magicCode, status: 'PENDING' }, 202))
      .mockResolvedValueOnce(jsonResponse({ magicCode, status: 'PENDING' }, 202))
      .mockResolvedValueOnce(jsonResponse(completedResult, 200))
    vi.stubGlobal('fetch', fetchImplementation)
    const { searchApi } = await import('@/api/search')

    await expect(searchApi.submit('  한국외대   뉴스  ')).resolves.toEqual({
      magicCode,
      status: 'PENDING',
    })
    await expect(searchApi.getResult(magicCode)).resolves.toEqual({
      magicCode,
      status: 'PENDING',
    })
    await expect(searchApi.getResult(magicCode)).resolves.toEqual({
      magicCode,
      status: 'COMPLETED',
      result: {
        elapsedMilliseconds: 42,
        items: [
          {
            imageUrl: 'https://example.com/image.png',
            snippet: '결과 설명',
            title: '검색 결과',
            url: 'https://example.com/result',
          },
        ],
        relatedSearches: ['관련 검색어'],
      },
    })

    const submitCall = fetchImplementation.mock.calls[0]
    expect(submitCall?.[0]).toMatch(/\/search$/)
    expect(submitCall?.[1]).toMatchObject({
      body: JSON.stringify({ query: '한국외대 뉴스' }),
      credentials: 'include',
      method: 'POST',
    })
    expect(fetchImplementation.mock.calls[1]?.[0]).toMatch(new RegExp(`/search/${magicCode}$`))
  })

  it('선택 필드가 생략된 빈 검색 결과를 계약에 맞게 처리한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          {
            magicCode,
            result: { data: {}, meta: { ms: 0 } },
          },
          200,
        ),
      ),
    )
    const { searchApi } = await import('@/api/search')

    await expect(searchApi.getResult(magicCode)).resolves.toMatchObject({
      result: { items: [], relatedSearches: [] },
      status: 'COMPLETED',
    })
  })

  it('잘못된 query, magicCode와 계약에 맞지 않는 응답을 거부한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({ magicCode, status: 'COMPLETED', result: { data: {}, meta: { ms: -1 } } }, 200),
      ),
    )
    const { searchApi } = await import('@/api/search')

    expect(() => searchApi.submit('   ')).toThrow(RangeError)
    expect(() => searchApi.getResult('not-a-magic-code')).toThrow(RangeError)
    await expect(searchApi.getResult(magicCode)).rejects.toMatchObject({
      name: 'ApiResponseError',
    })
  })
})
