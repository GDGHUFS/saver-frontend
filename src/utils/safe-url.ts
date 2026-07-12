export function getSafeExternalUrl(value: string | null): string | null {
  if (value === null) {
    return null
  }

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
