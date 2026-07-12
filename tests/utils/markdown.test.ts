import { describe, expect, it } from 'vitest'

import { renderMarkdown } from '@/utils/markdown'

describe('renderMarkdown', () => {
  it('Markdown 서식을 렌더링한다', () => {
    const rendered = renderMarkdown('# 제목\n\n**굵게**와 `코드`')

    expect(rendered).toContain('<h1>제목</h1>')
    expect(rendered).toContain('<strong>굵게</strong>')
    expect(rendered).toContain('<code>코드</code>')
  })

  // 사용자 본문에 포함된 HTML과 위험한 링크가 실행 가능한 DOM으로 변환되지 않는지 보호한다.
  it('원시 HTML과 위험한 URL을 실행 가능한 태그로 렌더링하지 않는다', () => {
    const rendered = renderMarkdown(
      '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[위험](javascript:alert(1))',
    )

    expect(rendered).not.toContain('<script>')
    expect(rendered).not.toContain('<img')
    expect(rendered).not.toContain('href="javascript:')
    expect(rendered).toContain('&lt;script&gt;')
  })
})
