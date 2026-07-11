import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import AsyncState from '@/components/AsyncState.vue'

describe('AsyncState', () => {
  // 모든 API 페이지가 같은 상태 언어와 복구 동작을 유지하도록 공통 표현을 검증한다.
  it('API 화면이 공통 loading, empty, error, success 상태를 일관되게 표시한다', async () => {
    const view = render(AsyncState, {
      props: { status: 'loading' },
      slots: { default: '<p>완료된 내용</p>' },
    })

    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중')

    await view.rerender({ status: 'empty', emptyMessage: '검색 결과가 없습니다.' })
    expect(screen.getByText('검색 결과가 없습니다.')).toBeInTheDocument()

    await view.rerender({ status: 'error', errorMessage: '요청에 실패했습니다.' })
    expect(screen.getByRole('alert')).toHaveTextContent('요청에 실패했습니다.')
    await fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(view.emitted().retry).toHaveLength(1)

    await view.rerender({ status: 'success' })
    expect(screen.getByText('완료된 내용')).toBeInTheDocument()
  })
})
