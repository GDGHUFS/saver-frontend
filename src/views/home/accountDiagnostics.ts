import { ApiHttpError, ApiNetworkError, ApiResponseError } from '@/api/client'

type AccountOperation = 'load-current-user' | 'logout'
type HttpMethod = 'GET' | 'POST'

interface AccountRequestContext {
  method: HttpMethod
  operation: AccountOperation
  path: string
}

interface ErrorCauseDiagnostic {
  message: string
  name: string
}

interface ErrorDiagnostic {
  cause?: ErrorCauseDiagnostic
  httpStatus?: number
  kind: 'http' | 'network' | 'response' | 'unknown'
  message: string
  name: string
}

function getApiOrigin(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? window.location.origin

  try {
    return new URL(baseUrl, window.location.href).origin
  } catch {
    return 'invalid-api-base-url'
  }
}

function getCauseDiagnostic(error: Error): ErrorCauseDiagnostic | undefined {
  if (!(error.cause instanceof Error)) {
    return undefined
  }

  return {
    message: error.cause.message,
    name: error.cause.name,
  }
}

function getErrorDiagnostic(error: unknown): ErrorDiagnostic {
  if (error instanceof ApiHttpError) {
    return {
      httpStatus: error.status,
      kind: 'http',
      message: error.message,
      name: error.name,
    }
  }

  if (error instanceof ApiNetworkError) {
    return {
      cause: getCauseDiagnostic(error),
      kind: 'network',
      message: error.message,
      name: error.name,
    }
  }

  if (error instanceof ApiResponseError) {
    return {
      cause: getCauseDiagnostic(error),
      kind: 'response',
      message: error.message,
      name: error.name,
    }
  }

  if (error instanceof Error) {
    return {
      cause: getCauseDiagnostic(error),
      kind: 'unknown',
      message: error.message,
      name: error.name,
    }
  }

  return {
    kind: 'unknown',
    message: 'An unknown non-Error value was thrown',
    name: 'UnknownError',
  }
}

export function reportAccountFailure(context: AccountRequestContext, error: unknown): void {
  console.error('[Saver] 사용자 계정 요청 실패', {
    apiOrigin: getApiOrigin(),
    component: 'AccountCard',
    error: getErrorDiagnostic(error),
    frontendOrigin: window.location.origin,
    occurredAt: new Date().toISOString(),
    request: {
      method: context.method,
      path: context.path,
    },
    operation: context.operation,
  })
}
