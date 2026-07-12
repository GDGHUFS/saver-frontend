import { render, screen } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import AppNavbar from '@/components/AppNavbar.vue'

function createNavbarRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/special-days', component: { template: '<div />' } },
      { path: '/news', component: { template: '<div />' } },
      { path: '/blog', component: { template: '<div />' } },
      { path: '/about', component: { template: '<div />' } },
    ],
  })
}

describe('AppNavbar', () => {
  it('홈 브랜드 링크에 장식용 Saver favicon을 표시한다', async () => {
    const router = createNavbarRouter()
    await router.push('/')
    await router.isReady()
    render(AppNavbar, { global: { plugins: [router] } })

    const brandLink = screen.getByRole('link', { name: 'Saver' })
    const brandIcon = brandLink.querySelector('img')
    expect(brandLink).toHaveAttribute('href', '/')
    expect(brandIcon).toHaveAttribute('src', '/favicon-32x32.png')
    expect(brandIcon).toHaveAttribute('alt', '')
    expect(brandIcon).toHaveAttribute('width', '32')
    expect(brandIcon).toHaveAttribute('height', '32')
  })
})
