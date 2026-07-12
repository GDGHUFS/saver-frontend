import { createRouter, createWebHistory } from 'vue-router'

import AboutView from '@/views/AboutView.vue'
import BlogView from '@/views/BlogView.vue'
import HomeView from '@/views/HomeView.vue'
import NewsView from '@/views/NewsView.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import PrivacyView from '@/views/PrivacyView.vue'
import SearchView from '@/views/SearchView.vue'
import SpecialDaysView from '@/views/SpecialDaysView.vue'
import WeatherView from '@/views/WeatherView.vue'
import BlogDetailView from '@/views/blog/BlogDetailView.vue'
import BlogEditorView from '@/views/blog/BlogEditorView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/search', name: 'search', component: SearchView },
    { path: '/weather', name: 'weather', component: WeatherView },
    { path: '/special-days', name: 'special-days', component: SpecialDaysView },
    { path: '/news', name: 'news', component: NewsView },
    { path: '/blog', name: 'blog', component: BlogView },
    { path: '/blog/new', name: 'blog-new', component: BlogEditorView },
    { path: '/blog/author/:userId', name: 'blog-author', component: BlogView },
    { path: '/blog/:blogId/edit', name: 'blog-edit', component: BlogEditorView },
    { path: '/blog/:blogId', name: 'blog-detail', component: BlogDetailView },
    { path: '/about', name: 'about', component: AboutView },
    { path: '/privacy', name: 'privacy', component: PrivacyView },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

export default router
