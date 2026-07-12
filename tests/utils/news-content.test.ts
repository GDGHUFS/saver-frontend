import { describe, expect, it } from 'vitest'

import { extractPlainText } from '@/utils/plain-text'
import { getSafeExternalUrl } from '@/utils/safe-url'

describe('뉴스 외부 콘텐츠 유틸리티', () => {
  it('RSS 설명의 HTML을 실행하지 않고 읽을 수 있는 텍스트로 변환한다', () => {
    expect(extractPlainText('<p>뉴스 <strong>설명</strong></p><script>alert(1)</script>')).toBe(
      '뉴스 설명',
    )
  })

  it('HTTP(S) 외부 링크만 허용한다', () => {
    expect(getSafeExternalUrl('https://example.com/news')).toBe('https://example.com/news')
    expect(getSafeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(getSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(getSafeExternalUrl('not a url')).toBeNull()
  })
})
