<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import AccountCard from '@/views/home/AccountCard.vue'
import LatestBlogCard from '@/views/home/LatestBlogCard.vue'
import LatestNewsCard from '@/views/home/LatestNewsCard.vue'
import UpcomingSpecialDaysCard from '@/views/home/UpcomingSpecialDaysCard.vue'
import HomeWeatherCard from '@/views/home/HomeWeatherCard.vue'

const router = useRouter()
const query = ref('')

interface Service {
  description: string
  title: string
  to: string
}

const informationService: Service = {
  title: '서비스 안내',
  description: '서비스 소개와 개인정보처리방침을 확인합니다.',
  to: '/about',
}

async function submitSearch(): Promise<void> {
  const normalizedQuery = query.value.trim().replace(/\s+/g, ' ')
  if (normalizedQuery.length === 0) {
    return
  }

  await router.push({ name: 'search', query: { q: normalizedQuery } })
}
</script>

<template>
  <section class="home-intro border-bottom bg-white">
    <div class="container-xl py-5 py-md-6">
      <h1 class="display-5 fw-bold mb-4">SAVER</h1>
      <form class="search-form" role="search" @submit.prevent="submitSearch">
        <label class="visually-hidden" for="portal-search">통합 검색</label>
        <div class="input-group input-group-lg shadow-sm">
          <input
            id="portal-search"
            v-model="query"
            class="form-control border-end-0"
            type="search"
            name="q"
            maxlength="200"
            autocomplete="off"
            placeholder="검색어를 입력하세요"
          />
          <button class="btn btn-primary px-4" type="submit">검색</button>
        </div>
      </form>
    </div>
  </section>

  <section class="container-xl py-5" aria-labelledby="services-heading">
    <h2 id="services-heading" class="h4 fw-bold mb-4">서비스</h2>
    <div class="row g-3 g-lg-4">
      <div class="col-12 col-md-6 col-lg-4">
        <AccountCard />
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <HomeWeatherCard />
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <UpcomingSpecialDaysCard />
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <LatestNewsCard />
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <LatestBlogCard />
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <RouterLink
          class="service-card card h-100 text-decoration-none"
          :to="informationService.to"
        >
          <span class="card-body p-4">
            <strong class="d-block h5 text-body mb-2">{{ informationService.title }}</strong>
            <span class="text-body-secondary">{{ informationService.description }}</span>
          </span>
        </RouterLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.py-md-6 {
  padding-block: 5rem;
}

.search-form {
  max-width: 46rem;
}

.search-form .form-control,
.search-form .btn {
  min-height: 3.5rem;
}

.service-card {
  border-color: var(--bs-border-color);
  border-radius: 0.5rem;
  transition:
    border-color 120ms ease,
    box-shadow 120ms ease,
    transform 120ms ease;
}

.service-card:hover,
.service-card:focus-visible {
  border-color: var(--bs-primary);
  box-shadow: var(--bs-box-shadow-sm);
  transform: translateY(-2px);
}

@media (max-width: 575.98px) {
  .search-form .input-group {
    flex-wrap: nowrap;
  }

  .search-form .btn {
    padding-inline: 1rem !important;
  }
}
</style>
