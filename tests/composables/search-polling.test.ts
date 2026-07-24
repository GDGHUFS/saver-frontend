import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiHttpError, ApiNetworkError } from '@/api/client'
import { runSearchPolling, SearchPollingTimeoutError } from '@/composables/search-polling'

const magicCode = 'A'.repeat(43)
const result = {
  aiSummary: null,
  elapsedMilliseconds: 10,
  items: [],
  relatedSearches: [],
}
const mocks = vi.hoisted(() => ({
  getResult: vi.fn(),
  submit: vi.fn(),
}))

vi.mock('@/api/search', () => ({
  searchApi: {
    getResult: mocks.getResult,
    submit: mocks.submit,
  },
}))

describe('runSearchPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.submit.mockReset().mockResolvedValue({ magicCode, status: 'PENDING' })
    mocks.getResult.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // pending 작업이 완료될 때까지 서버가 발급한 불투명 magicCode를 그대로 재사용하는지 보호한다.
  it('pending 이후 completed 결과를 반환한다', async () => {
    mocks.getResult
      .mockResolvedValueOnce({ magicCode, status: 'PENDING' })
      .mockResolvedValueOnce({ magicCode, status: 'COMPLETED', result })

    const polling = runSearchPolling('검색어')
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(polling).resolves.toBe(result)
    expect(mocks.submit).toHaveBeenCalledTimes(1)
    expect(mocks.getResult).toHaveBeenNthCalledWith(1, magicCode, expect.any(AbortSignal))
    expect(mocks.getResult).toHaveBeenNthCalledWith(2, magicCode, expect.any(AbortSignal))
  })

  it('두 검색 분기 중 하나만 완료된 partial 결과도 반환한다', async () => {
    mocks.getResult.mockResolvedValueOnce({ magicCode, status: 'PARTIAL', result })

    await expect(runSearchPolling('검색어')).resolves.toBe(result)
    expect(mocks.getResult).toHaveBeenCalledTimes(1)
  })

  it('일시적인 503과 네트워크 실패는 backoff 후 같은 작업을 다시 조회한다', async () => {
    mocks.getResult
      .mockRejectedValueOnce(new ApiHttpError(503, undefined))
      .mockRejectedValueOnce(new ApiNetworkError('offline'))
      .mockResolvedValueOnce({ magicCode, status: 'COMPLETED', result })

    const polling = runSearchPolling('검색어')
    await vi.advanceTimersByTimeAsync(3_000)

    await expect(polling).resolves.toBe(result)
    expect(mocks.submit).toHaveBeenCalledTimes(1)
    expect(mocks.getResult).toHaveBeenCalledTimes(3)
  })

  it('404처럼 복구할 수 없는 조회 실패는 즉시 전달한다', async () => {
    const expired = new ApiHttpError(404, undefined)
    mocks.getResult.mockRejectedValue(expired)

    await expect(runSearchPolling('검색어')).rejects.toBe(expired)
    expect(mocks.getResult).toHaveBeenCalledTimes(1)
  })

  it('최대 대기 시간이 지나면 polling을 만료시킨다', async () => {
    mocks.getResult.mockResolvedValue({ magicCode, status: 'PENDING' })

    const polling = runSearchPolling('검색어', { maxWaitMs: 2_000 })
    const expectation = expect(polling).rejects.toBeInstanceOf(SearchPollingTimeoutError)
    await vi.advanceTimersByTimeAsync(2_000)

    await expectation
    expect(mocks.getResult).toHaveBeenCalledTimes(2)
  })

  it('호출자가 취소하면 다음 조회를 실행하지 않는다', async () => {
    mocks.getResult.mockResolvedValue({ magicCode, status: 'PENDING' })
    const controller = new AbortController()
    const polling = runSearchPolling('검색어', { signal: controller.signal })
    await vi.advanceTimersByTimeAsync(0)
    const expectation = expect(polling).rejects.toMatchObject({ name: 'AbortError' })

    controller.abort()

    await expectation
    expect(mocks.getResult).toHaveBeenCalledTimes(1)
  })
})
