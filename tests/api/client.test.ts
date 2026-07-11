import { describe, expect, it, vi } from 'vitest'

import {
  ApiClient,
  ApiNetworkError,
  ApiResponseError,
} from '@/api/client'

interface MessageResponse {
  message: string
}

function decodeMessage(value: unknown): MessageResponse {
  if (typeof value !== 'object' || value === null || !('message' in value)) {
    throw new Error('message field is missing')
  }

  if (typeof value.message !== 'string') {
    throw new Error('message field is invalid')
  }

  return { message: value.message }
}

describe('ApiClient', () => {
  // 컴포넌트가 HTTP 세부사항을 다시 처리하지 않도록 공통 API 경계의 계약을 보호한다.
  it('검증 함수를 통과한 JSON 응답만 도메인 데이터로 반환한다', async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
    fetchImplementation.mockResolvedValue(
      new Response(JSON.stringify({ message: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    )
    const client = new ApiClient({ baseUrl: 'https://api.example.com', fetchImplementation })

    const result = await client.request('/health', { decoder: decodeMessage })

    expect(result).toEqual({ message: 'ok' })
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://api.example.com/health',
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    )
  })

  it('API 오류의 상태 코드와 응답 본문을 보존한다', async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
    fetchImplementation.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'unauthorized' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 401,
      }),
    )
    const client = new ApiClient({ fetchImplementation })

    const request = client.request('/auth/me', { decoder: decodeMessage })

    await expect(request).rejects.toMatchObject({
      name: 'ApiHttpError',
      payload: { detail: 'unauthorized' },
      status: 401,
    })
  })

  it('본문이 없는 204 응답을 별도 파싱 없이 처리한다', async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
    fetchImplementation.mockResolvedValue(new Response(null, { status: 204 }))
    const client = new ApiClient({ fetchImplementation })

    await expect(client.request('/auth/logout', { method: 'POST' })).resolves.toBeUndefined()
  })

  it('계약과 맞지 않는 성공 응답을 명시적인 응답 오류로 변환한다', async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
    fetchImplementation.mockResolvedValue(
      new Response(JSON.stringify({ unexpected: true }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    )
    const client = new ApiClient({ fetchImplementation })

    await expect(client.request('/health', { decoder: decodeMessage })).rejects.toBeInstanceOf(
      ApiResponseError,
    )
  })

  it('HTTP 응답을 받지 못한 실패를 네트워크 오류로 통일한다', async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
    fetchImplementation.mockRejectedValue(new TypeError('offline'))
    const client = new ApiClient({ fetchImplementation })

    await expect(client.request('/health')).rejects.toBeInstanceOf(ApiNetworkError)
  })
})
