import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiHttpError } from '@/api/client'
import AccountCard from '@/views/home/AccountCard.vue'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getLoginUrl: vi.fn(() => 'https://api.example.com/authorize'),
  getWithdrawalUrl: vi.fn(() => 'https://api.example.com/auth/withdraw/authorize'),
  logout: vi.fn(),
  navigateToExternal: vi.fn(),
}))

vi.mock('@/api/auth', () => ({
  authApi: {
    getCurrentUser: mocks.getCurrentUser,
    getLoginUrl: mocks.getLoginUrl,
    getWithdrawalUrl: mocks.getWithdrawalUrl,
    logout: mocks.logout,
  },
}))

vi.mock('@/utils/navigation', () => ({
  navigateToExternal: mocks.navigateToExternal,
}))

const user = {
  id: 123456789,
  nickname: '아주 긴 Saver 사용자 닉네임',
  profileImage: 'https://example.com/profile.png',
}

describe('AccountCard', () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockReset()
    mocks.getLoginUrl.mockClear()
    mocks.getWithdrawalUrl.mockClear()
    mocks.logout.mockReset()
    mocks.navigateToExternal.mockReset()
  })

  // 세션 확인 중에는 이전 사용자나 로그인 버튼을 성급하게 노출하지 않는지 보호한다.
  it('현재 사용자 확인이 끝날 때까지 loading 상태를 표시한다', () => {
    mocks.getCurrentUser.mockReturnValue(new Promise(() => undefined))

    render(AccountCard)

    expect(screen.getByRole('status')).toHaveTextContent('로그인 상태를 확인하고 있습니다.')
    expect(screen.queryByRole('link', { name: '카카오로 로그인' })).not.toBeInTheDocument()
  })

  it('세션 쿠키가 없거나 잘못되면 backend 로그인 진입점을 표시한다', async () => {
    mocks.getCurrentUser.mockRejectedValue(new ApiHttpError(401, undefined))

    render(AccountCard)

    const loginLink = await screen.findByRole('link', { name: '카카오로 로그인' })
    expect(loginLink).toHaveAttribute('href', 'https://api.example.com/authorize')
  })

  it('세션 확인 실패를 로그인 필요 상태와 구분하고 재시도한다', async () => {
    mocks.getCurrentUser.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(user)

    render(AccountCard)

    expect(await screen.findByRole('alert')).toHaveTextContent('로그인 상태를 확인하지 못했습니다.')
    await fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText(user.nickname)).toBeInTheDocument()
    expect(mocks.getCurrentUser).toHaveBeenCalledTimes(2)
  })

  it('로그인 사용자의 프로필을 표시하고 로그아웃 결과를 알린다', async () => {
    mocks.getCurrentUser.mockResolvedValue(user)
    mocks.logout.mockResolvedValue(undefined)

    render(AccountCard)

    expect(await screen.findByText(user.nickname)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: `${user.nickname}님의 프로필 사진` })).toHaveAttribute(
      'src',
      user.profileImage,
    )
    await fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))

    expect(await screen.findByRole('status')).toHaveTextContent('로그아웃되었습니다.')
    expect(mocks.logout).toHaveBeenCalledOnce()
  })

  it('로그아웃 실패 시 사용자 정보를 유지하고 다시 시도할 수 있게 한다', async () => {
    mocks.getCurrentUser.mockResolvedValue(user)
    mocks.logout.mockRejectedValue(new Error('offline'))

    render(AccountCard)
    await screen.findByText(user.nickname)
    await fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('로그아웃하지 못했습니다.')
    expect(screen.getByText(user.nickname)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeEnabled()
  })

  it('탈퇴 확인 전에는 이동하지 않고 확정 후 재인증 endpoint로 이동한다', async () => {
    mocks.getCurrentUser.mockResolvedValue(user)

    render(AccountCard)
    await screen.findByText(user.nickname)
    await fireEvent.click(screen.getByRole('button', { name: '회원 탈퇴' }))

    const dialog = screen.getByRole('dialog', { name: '정말 탈퇴하시겠어요?' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus()
    expect(mocks.navigateToExternal).not.toHaveBeenCalled()

    await fireEvent.click(screen.getByRole('button', { name: '탈퇴 계속하기' }))

    await waitFor(() => {
      expect(mocks.navigateToExternal).toHaveBeenCalledWith(
        'https://api.example.com/auth/withdraw/authorize',
      )
    })
  })
})
