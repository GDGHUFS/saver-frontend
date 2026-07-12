export function extractPlainText(value: string | null): string {
  if (value === null || value.length === 0) {
    return ''
  }

  const document = new DOMParser().parseFromString(value, 'text/html')
  document.querySelectorAll('script, style, noscript').forEach((element) => element.remove())
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}
