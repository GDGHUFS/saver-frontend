import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import HomeView from '@/views/HomeView.vue'

describe('HomeView', () => {
  // 메인 검색 입력이 backend 계약과 같은 방식으로 공백을 정리해 결과 라우트로 전달하는지 보호한다.
  it('검색어를 정규화해 검색 결과 라우트로 이동한다', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: HomeView },
        {
          path: '/search',
          name: 'search',
          component: { template: '<div>검색 결과</div>' },
        },
        { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    await router.isReady()
    render(HomeView, { global: { plugins: [router] } })

    await fireEvent.update(screen.getByRole('searchbox', { name: '통합 검색' }), '  한국외대   뉴스  ')
    await fireEvent.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() => {
      expect(router.currentRoute.value.query.q).toBe('한국외대 뉴스')
      expect(router.currentRoute.value.path).toBe('/search')
    })
  })
})
