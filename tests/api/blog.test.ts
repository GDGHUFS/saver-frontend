import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

const summaryDto = {
  id: 7,
  title: 'Saver 개발 기록',
  created_at: '2026-07-12T09:00:00+09:00',
  updated_at: '2026-07-12T10:00:00+09:00',
  author_id: 123456789,
  nickname: 'Saver 사용자',
  profile_image: 'https://example.com/profile.png',
}

describe('blogApi', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('최신 글 목록을 count query와 함께 조회하고 응답을 변환한다', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([summaryDto]))
    vi.stubGlobal('fetch', fetchImplementation)
    const { blogApi } = await import('@/api/blog')

    await expect(blogApi.getLatest(3)).resolves.toEqual([
      {
        author: {
          id: 123456789,
          nickname: 'Saver 사용자',
          profileImage: 'https://example.com/profile.png',
        },
        createdAt: '2026-07-12T09:00:00+09:00',
        id: 7,
        title: 'Saver 개발 기록',
        updatedAt: '2026-07-12T10:00:00+09:00',
      },
    ])
    expect(fetchImplementation).toHaveBeenCalledWith(
      expect.stringMatching(/\/blog\/latest\?count=3$/),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('작성자 목록과 글 상세 endpoint를 검증된 ID로 조회한다', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([summaryDto]))
      .mockResolvedValueOnce(jsonResponse({ ...summaryDto, content: '# 본문' }))
    vi.stubGlobal('fetch', fetchImplementation)
    const { blogApi } = await import('@/api/blog')

    await expect(blogApi.getByAuthor(123456789)).resolves.toHaveLength(1)
    await expect(blogApi.getById(7)).resolves.toMatchObject({ content: '# 본문', id: 7 })
    expect(fetchImplementation.mock.calls[0]?.[0]).toMatch(/\/blog\/author\/123456789$/)
    expect(fetchImplementation.mock.calls[1]?.[0]).toMatch(/\/blog\/7$/)
  })

  it('글 작성 후 Location 헤더에서 생성된 글 정보를 반환한다', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { headers: { Location: '/blog/7' }, status: 201 }),
    )
    vi.stubGlobal('fetch', fetchImplementation)
    const { blogApi } = await import('@/api/blog')

    await expect(blogApi.create({ title: '제목', content: '본문' })).resolves.toEqual({
      id: 7,
      location: '/blog/7',
    })
    expect(fetchImplementation).toHaveBeenCalledWith(
      expect.stringMatching(/\/blog\/$/),
      expect.objectContaining({
        body: JSON.stringify({ title: '제목', content: '본문' }),
        method: 'POST',
      }),
    )
  })

  it('수정은 PUT으로 전체 본문을 보내고 삭제는 DELETE로 요청한다', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchImplementation)
    const { blogApi } = await import('@/api/blog')

    await blogApi.update(7, { title: '바뀐 제목', content: '전체 본문' })
    await blogApi.delete(7)

    expect(fetchImplementation.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ title: '바뀐 제목', content: '전체 본문' }),
        method: 'PUT',
      }),
    )
    expect(fetchImplementation.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('계약과 다른 응답 및 유효하지 않은 ID와 count를 거부한다', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([{ id: '7' }])))
    const { BLOG_LATEST_MAX_COUNT, blogApi } = await import('@/api/blog')

    await expect(blogApi.getLatest(3)).rejects.toMatchObject({ name: 'ApiResponseError' })
    expect(() => blogApi.getLatest(BLOG_LATEST_MAX_COUNT + 1)).toThrow(RangeError)
    expect(() => blogApi.getById(0)).toThrow(RangeError)
  })
})
