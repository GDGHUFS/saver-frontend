import { ApiHttpError, ApiNetworkError } from '@/api/client'
import { searchApi, type SearchResult } from '@/api/search'

export const SEARCH_POLL_INTERVAL_MS = 1_000
export const SEARCH_POLL_MAX_WAIT_MS = 60_000
export const SEARCH_POLL_MAX_CONSECUTIVE_FAILURES = 3

export class SearchPollingTimeoutError extends Error {
  constructor() {
    super('Search polling exceeded its maximum wait time')
    this.name = 'SearchPollingTimeoutError'
  }
}

export interface SearchPollingOptions {
  intervalMs?: number
  maxConsecutiveFailures?: number
  maxWaitMs?: number
  now?: () => number
  signal?: AbortSignal
}

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted', 'AbortError')
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError(signal))
      return
    }

    const handleAbort = (): void => {
      window.clearTimeout(timeoutId)
      reject(abortError(signal))
    }
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort)
      resolve()
    }, milliseconds)
    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

function isRetryablePollingFailure(error: unknown): boolean {
  return error instanceof ApiNetworkError || (error instanceof ApiHttpError && error.status === 503)
}

export async function runSearchPolling(
  query: string,
  options: SearchPollingOptions = {},
): Promise<SearchResult> {
  const signal = options.signal ?? new AbortController().signal
  const intervalMs = options.intervalMs ?? SEARCH_POLL_INTERVAL_MS
  const maxWaitMs = options.maxWaitMs ?? SEARCH_POLL_MAX_WAIT_MS
  const maxConsecutiveFailures =
    options.maxConsecutiveFailures ?? SEARCH_POLL_MAX_CONSECUTIVE_FAILURES
  const now = options.now ?? Date.now

  if (signal.aborted) {
    throw abortError(signal)
  }

  const accepted = await searchApi.submit(query, signal)
  const deadline = now() + maxWaitMs
  let consecutiveFailures = 0

  while (now() < deadline) {
    try {
      const response = await searchApi.getResult(accepted.magicCode, signal)
      if (response.magicCode !== accepted.magicCode) {
        throw new Error('search poll response returned a different magicCode')
      }
      consecutiveFailures = 0
      if (response.status !== 'PENDING') {
        return response.result
      }
    } catch (error: unknown) {
      if (signal.aborted || !isRetryablePollingFailure(error)) {
        throw error
      }
      consecutiveFailures += 1
      if (consecutiveFailures > maxConsecutiveFailures) {
        throw error
      }
    }

    const remainingMs = deadline - now()
    if (remainingMs <= 0) {
      break
    }
    const backoffMultiplier = consecutiveFailures === 0 ? 1 : 2 ** (consecutiveFailures - 1)
    await wait(Math.min(intervalMs * backoffMultiplier, remainingMs), signal)
  }

  throw new SearchPollingTimeoutError()
}
