export const SEARCH_MODE_QUERY_KEY = 'engine'

export type SearchMode = 'portal' | 'research'

export function readSearchMode(value: unknown): SearchMode {
  return value === 'research' ? 'research' : 'portal'
}

export function getSearchModeRouteQuery(mode: SearchMode): string | undefined {
  return mode === 'research' ? mode : undefined
}
