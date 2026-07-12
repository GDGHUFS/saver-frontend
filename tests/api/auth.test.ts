import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

describe('authApi', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // 외부 사용자 응답이 컴포넌트에 전달되기 전에 검증되고 프런트 모델로 변환되는지 보호한다.
  it('현재 사용자를 조회하고 profile_image 필드를 변환한다', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        id: 123456789,
        nickname: 'Saver 사용자',
        profile_image: 'https://example.com/profile.png',
      }),
    )
    vi.stubGlobal('fetch', fetchImplementation)
    const { authApi } = await import('@/api/auth')

    await expect(authApi.getCurrentUser()).resolves.toEqual({
      id: 123456789,
      nickname: 'Saver 사용자',
      profileImage: 'https://example.com/profile.png',
    })
    expect(fetchImplementation).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/me$/),
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    )
  })

  it('계약과 다른 사용자 응답을 거부한다', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ id: 'invalid' })))
    const { authApi } = await import('@/api/auth')

    await expect(authApi.getCurrentUser()).rejects.toMatchObject({ name: 'ApiResponseError' })
  })

  it('로그아웃을 POST 요청으로 보내고 OAuth 진입 URL을 제공한다', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 204 }),
    )
    vi.stubGlobal('fetch', fetchImplementation)
    const { authApi } = await import('@/api/auth')

    expect(authApi.getLoginUrl()).toMatch(/\/authorize$/)
    expect(authApi.getWithdrawalUrl()).toMatch(/\/auth\/withdraw\/authorize$/)
    await authApi.logout()

    expect(fetchImplementation).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/logout$/),
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    )
  })
})
