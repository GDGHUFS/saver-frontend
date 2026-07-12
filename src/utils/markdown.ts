import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'

const markdown = new MarkdownIt({
  breaks: true,
  html: false,
  linkify: true,
  typographer: false,
}).use(taskLists, {
  enabled: false,
  label: true,
  labelAfter: true,
})

export function renderMarkdown(source: string): string {
  return markdown.render(source)
}
