import { apiClient } from '@/api/client'

export interface AuthUser {
  id: number
  nickname: string
  profileImage: string
}

function decodeAuthUser(value: unknown): AuthUser {
  if (typeof value !== 'object' || value === null) {
    throw new Error('user response must be an object')
  }

  if (!('id' in value) || typeof value.id !== 'number' || !Number.isSafeInteger(value.id)) {
    throw new Error('user id is invalid')
  }

  if (!('nickname' in value) || typeof value.nickname !== 'string') {
    throw new Error('user nickname is invalid')
  }

  if (!('profile_image' in value) || typeof value.profile_image !== 'string') {
    throw new Error('user profile image is invalid')
  }

  return {
    id: value.id,
    nickname: value.nickname,
    profileImage: value.profile_image,
  }
}

export const authApi = {
  getCurrentUser(signal?: AbortSignal): Promise<AuthUser> {
    return apiClient.request('/auth/me', { decoder: decodeAuthUser, signal })
  },

  getLoginUrl(): string {
    return apiClient.getUrl('/authorize')
  },

  getWithdrawalUrl(): string {
    return apiClient.getUrl('/auth/withdraw/authorize')
  },

  logout(): Promise<void> {
    return apiClient.request('/auth/logout', { method: 'POST' })
  },
}
