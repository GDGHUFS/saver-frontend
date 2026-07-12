import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({
  breaks: true,
  html: false,
  linkify: true,
  typographer: false,
})

export function renderMarkdown(source: string): string {
  return markdown.render(source)
}
