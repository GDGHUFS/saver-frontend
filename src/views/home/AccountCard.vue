<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import { authApi, type AuthUser } from '@/api/auth'
import { ApiHttpError } from '@/api/client'
import type { AsyncStatus } from '@/types/async-state'
import { navigateToExternal } from '@/utils/navigation'
import { reportAccountFailure } from '@/views/home/accountDiagnostics'

const status = ref<AsyncStatus>('loading')
const user = ref<AuthUser | null>(null)
const isLoggingOut = ref(false)
const isWithdrawalModalOpen = ref(false)
const isStartingWithdrawal = ref(false)
const actionError = ref('')
const actionMessage = ref('')
const withdrawalTrigger = ref<HTMLButtonElement | null>(null)
const withdrawalCancelButton = ref<HTMLButtonElement | null>(null)
const withdrawalConfirmButton = ref<HTMLButtonElement | null>(null)

let loadSequence = 0
let loadController: AbortController | null = null

async function loadCurrentUser(): Promise<void> {
  const requestSequence = ++loadSequence
  loadController?.abort()
  const controller = new AbortController()
  loadController = controller
  status.value = 'loading'
  user.value = null
  actionError.value = ''

  try {
    const currentUser = await authApi.getCurrentUser(controller.signal)
    if (requestSequence !== loadSequence) {
      return
    }

    user.value = currentUser
    status.value = 'success'
  } catch (error: unknown) {
    if (controller.signal.aborted || requestSequence !== loadSequence) {
      return
    }

    if (error instanceof ApiHttpError && error.status === 401) {
      status.value = 'empty'
      return
    }

    reportAccountFailure(
      { method: 'GET', operation: 'load-current-user', path: '/auth/me' },
      error,
    )
    status.value = 'error'
  } finally {
    if (requestSequence === loadSequence) {
      loadController = null
    }
  }
}

async function logout(): Promise<void> {
  if (isLoggingOut.value) {
    return
  }

  isLoggingOut.value = true
  actionError.value = ''
  actionMessage.value = ''

  try {
    await authApi.logout()
    user.value = null
    status.value = 'empty'
    actionMessage.value = '로그아웃되었습니다.'
  } catch (error: unknown) {
    reportAccountFailure({ method: 'POST', operation: 'logout', path: '/auth/logout' }, error)
    actionError.value = '로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    isLoggingOut.value = false
  }
}

async function openWithdrawalModal(): Promise<void> {
  actionError.value = ''
  actionMessage.value = ''
  isWithdrawalModalOpen.value = true
  await nextTick()
  withdrawalCancelButton.value?.focus()
}

function closeWithdrawalModal(): void {
  if (isStartingWithdrawal.value) {
    return
  }

  isWithdrawalModalOpen.value = false
  void nextTick(() => withdrawalTrigger.value?.focus())
}

function keepFocusInWithdrawalModal(event: KeyboardEvent): void {
  if (event.shiftKey && document.activeElement === withdrawalCancelButton.value) {
    event.preventDefault()
    withdrawalConfirmButton.value?.focus()
  } else if (!event.shiftKey && document.activeElement === withdrawalConfirmButton.value) {
    event.preventDefault()
    withdrawalCancelButton.value?.focus()
  }
}

function startWithdrawal(): void {
  if (isStartingWithdrawal.value) {
    return
  }

  isStartingWithdrawal.value = true
  navigateToExternal(authApi.getWithdrawalUrl())
}

onMounted(() => {
  void loadCurrentUser()
})

onBeforeUnmount(() => {
  loadSequence += 1
  loadController?.abort()
})
</script>

<template>
  <article class="account-card card h-100" aria-labelledby="account-card-title">
    <div class="card-body d-flex flex-column p-4">
      <h3 id="account-card-title" class="h5 mb-3">사용자 계정</h3>

      <div
        v-if="status === 'loading'"
        class="d-flex flex-grow-1 align-items-center gap-3 text-body-secondary"
        role="status"
        aria-live="polite"
      >
        <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
        <span>로그인 상태를 확인하고 있습니다.</span>
      </div>

      <template v-else-if="status === 'empty'">
        <div v-if="actionMessage" class="alert alert-success py-2" role="status">
          {{ actionMessage }}
        </div>
        <p class="text-body-secondary flex-grow-1">
          카카오 계정으로 로그인하고 Saver 서비스를 이용해 보세요.
        </p>
        <a class="btn kakao-login-button fw-semibold" :href="authApi.getLoginUrl()">
          카카오로 로그인
        </a>
      </template>

      <template v-else-if="status === 'error'">
        <div class="alert alert-danger mb-3" role="alert">
          로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.
        </div>
        <button class="btn btn-outline-danger mt-auto" type="button" @click="loadCurrentUser">
          다시 시도
        </button>
      </template>

      <template v-else-if="user !== null">
        <div class="d-flex align-items-center gap-3 mb-4">
          <img
            class="account-profile-image flex-shrink-0"
            :src="user.profileImage"
            :alt="`${user.nickname}님의 프로필 사진`"
          />
          <div class="min-w-0">
            <p class="fw-semibold text-break mb-1">{{ user.nickname }}</p>
            <p class="small text-body-secondary mb-0">카카오 계정으로 로그인 중</p>
          </div>
        </div>

        <div v-if="actionMessage" class="alert alert-success py-2" role="status">
          {{ actionMessage }}
        </div>
        <div v-if="actionError" class="alert alert-danger py-2" role="alert">
          {{ actionError }}
        </div>

        <div class="d-flex flex-column flex-sm-row gap-2 mt-auto">
          <button
            class="btn btn-outline-secondary flex-sm-fill"
            type="button"
            :disabled="isLoggingOut"
            @click="logout"
          >
            <span
              v-if="isLoggingOut"
              class="spinner-border spinner-border-sm me-2"
              aria-hidden="true"
            ></span>
            {{ isLoggingOut ? '로그아웃 중' : '로그아웃' }}
          </button>
          <button
            ref="withdrawalTrigger"
            class="btn btn-outline-danger flex-sm-fill"
            type="button"
            :disabled="isLoggingOut"
            @click="openWithdrawalModal"
          >
            회원 탈퇴
          </button>
        </div>
      </template>
    </div>
  </article>

  <Teleport to="body">
    <template v-if="isWithdrawalModalOpen">
      <div
        class="modal fade show d-block"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdrawal-modal-title"
        aria-describedby="withdrawal-modal-description"
        @keydown.esc="closeWithdrawalModal"
        @keydown.tab="keepFocusInWithdrawalModal"
      >
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h2 id="withdrawal-modal-title" class="modal-title fs-5">정말 탈퇴하시겠어요?</h2>
            </div>
            <div class="modal-body">
              <p id="withdrawal-modal-description" class="mb-0">
                카카오 재인증 후 Saver 계정이 삭제되고 카카오 연결이 해제됩니다. 이 작업은
                되돌릴 수 없습니다.
              </p>
            </div>
            <div class="modal-footer">
              <button
                ref="withdrawalCancelButton"
                class="btn btn-secondary"
                type="button"
                :disabled="isStartingWithdrawal"
                @click="closeWithdrawalModal"
              >
                취소
              </button>
              <button
                ref="withdrawalConfirmButton"
                class="btn btn-danger"
                type="button"
                :disabled="isStartingWithdrawal"
                @click="startWithdrawal"
              >
                <span
                  v-if="isStartingWithdrawal"
                  class="spinner-border spinner-border-sm me-2"
                  aria-hidden="true"
                ></span>
                {{ isStartingWithdrawal ? '카카오로 이동 중' : '탈퇴 계속하기' }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show"></div>
    </template>
  </Teleport>
</template>

<style scoped>
.account-card {
  border-color: var(--bs-border-color);
  border-radius: 0.5rem;
}

.account-profile-image {
  width: 4rem;
  height: 4rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 50%;
  object-fit: cover;
}

.min-w-0 {
  min-width: 0;
}

.kakao-login-button {
  --bs-btn-color: #191919;
  --bs-btn-bg: #fee500;
  --bs-btn-border-color: #fee500;
  --bs-btn-hover-color: #191919;
  --bs-btn-hover-bg: #ead300;
  --bs-btn-hover-border-color: #ead300;
  --bs-btn-focus-shadow-rgb: 254, 229, 0;
  --bs-btn-active-color: #191919;
  --bs-btn-active-bg: #dac500;
  --bs-btn-active-border-color: #dac500;
}
</style>
