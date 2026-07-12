import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SearchResultFavicon from '@/views/search/SearchResultFavicon.vue'

describe('SearchResultFavicon', () => {
  it('검색 결과 URL의 origin에서 favicon을 불러오고 referrer를 보내지 않는다', () => {
    const { container } = render(SearchResultFavicon, {
      props: { pageUrl: 'https://docs.example.com/guides/start?from=search' },
    })
    const image = container.querySelector('img')

    expect(image).toHaveAttribute('src', 'https://docs.example.com/favicon.ico')
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer')
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(image).toHaveAttribute('alt', '')
  })

  it('favicon 로딩이 실패하면 도메인의 첫 글자를 대체 표시한다', async () => {
    const { container } = render(SearchResultFavicon, {
      props: { pageUrl: 'https://example.com/result' },
    })
    const image = container.querySelector('img')
    if (!(image instanceof HTMLImageElement)) {
      throw new Error('favicon image was not rendered')
    }

    await fireEvent.error(image)

    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('E')).toBeInTheDocument()
  })

  it('HTTP가 아닌 URL에는 외부 이미지를 요청하지 않고 기본 fallback을 표시한다', () => {
    const { container } = render(SearchResultFavicon, {
      props: { pageUrl: 'javascript:alert(1)' },
    })

    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('?')).toBeInTheDocument()
  })
})
