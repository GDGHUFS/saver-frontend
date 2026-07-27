import type { ResearchSearchSource } from '@/api/research-search'

export interface ResearchSourcePresentation {
  description: string
  label: string
  type: ResearchSearchSource
  url: string
}

const hufspressSource: ResearchSourcePresentation = {
  description: '한국외국어대학교의 학내외 소식과 기사를 제공합니다.',
  label: '외대학보',
  type: 'hufspress',
  url: 'http://www.hufspress.net/',
}

const blogSource: ResearchSourcePresentation = {
  description: '서비스 운영자의 개인 기술 블로그 글을 제공합니다.',
  label: '개인 블로그',
  type: 'blog',
  url: 'https://blog.sonjaehyuk.me/',
}

export const researchSources: readonly ResearchSourcePresentation[] = [
  hufspressSource,
  blogSource,
]

const researchSourceByType: Readonly<
  Record<ResearchSearchSource, ResearchSourcePresentation>
> = {
  blog: blogSource,
  hufspress: hufspressSource,
}

export function getResearchSource(
  sourceType: ResearchSearchSource,
): ResearchSourcePresentation {
  return researchSourceByType[sourceType]
}
