import { onBeforeUnmount, onMounted, readonly, ref } from 'vue'

import { authApi, type AuthUser } from '@/api/auth'
import { ApiHttpError } from '@/api/client'
import type { AsyncStatus } from '@/types/async-state'

export function useCurrentUser() {
  const status = ref<AsyncStatus>('loading')
  const user = ref<AuthUser | null>(null)
  let sequence = 0
  let controller: AbortController | null = null

  async function load(): Promise<void> {
    const requestSequence = ++sequence
    controller?.abort()
    const requestController = new AbortController()
    controller = requestController
    status.value = 'loading'
    user.value = null

    try {
      const currentUser = await authApi.getCurrentUser(requestController.signal)
      if (requestSequence !== sequence) {
        return
      }

      user.value = currentUser
      status.value = 'success'
    } catch (error: unknown) {
      if (requestController.signal.aborted || requestSequence !== sequence) {
        return
      }

      status.value = error instanceof ApiHttpError && error.status === 401 ? 'empty' : 'error'
    } finally {
      if (requestSequence === sequence) {
        controller = null
      }
    }
  }

  onMounted(() => {
    void load()
  })

  onBeforeUnmount(() => {
    sequence += 1
    controller?.abort()
  })

  return {
    load,
    status: readonly(status),
    user: readonly(user),
  }
}
