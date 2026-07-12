import { describe, expect, it } from 'vitest'

import { renderMarkdown } from '@/utils/markdown'

describe('renderMarkdown', () => {
  it('기본 Markdown 서식을 렌더링한다', () => {
    const rendered = renderMarkdown('# 제목\n\n**굵게**와 `코드`')

    expect(rendered).toContain('<h1>제목</h1>')
    expect(rendered).toContain('<strong>굵게</strong>')
    expect(rendered).toContain('<code>코드</code>')
  })

  it('GFM 표, 취소선, 자동 링크, blockquote와 작업 목록을 렌더링한다', () => {
    const rendered = renderMarkdown(`
| 기능 | 상태 |
| --- | --- |
| GFM | 완료 |

~~취소된 내용~~

https://example.com

> 인용문

- [x] 완료한 작업
- [ ] 남은 작업
`)

    expect(rendered).toContain('<table>')
    expect(rendered).toContain('<s>취소된 내용</s>')
    expect(rendered).toContain('<a href="https://example.com">https://example.com</a>')
    expect(rendered).toContain('<blockquote>')
    expect(rendered).toContain('class="task-list-item"')
    expect(rendered).toContain('class="task-list-item-checkbox" checked="" disabled=""')
    expect(rendered).toContain('class="task-list-item-checkbox" disabled=""')
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
