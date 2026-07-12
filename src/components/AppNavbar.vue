<script setup lang="ts">
import { RouterLink } from 'vue-router'

const brandIconUrl = `${import.meta.env.BASE_URL}android-chrome-192x192.png`
</script>

<template>
  <nav class="navbar navbar-expand-lg bg-white border-bottom" aria-label="주요 메뉴">
    <div class="container-xl py-2">
      <RouterLink class="navbar-brand d-inline-flex align-items-center gap-2 fw-bold" to="/">
        <img
          class="brand-icon"
          :src="brandIconUrl"
          alt=""
          width="96"
          height="96"
          aria-hidden="true"
        />
        <span>SAVER</span>
      </RouterLink>
      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#primary-navigation"
        aria-controls="primary-navigation"
        aria-expanded="false"
        aria-label="메뉴 열기"
      >
        <span class="navbar-toggler-icon"></span>
      </button>
      <div id="primary-navigation" class="collapse navbar-collapse">
        <ul class="navbar-nav ms-auto gap-lg-2">
          <li class="nav-item">
            <RouterLink class="nav-link" to="/special-days">기념일</RouterLink>
          </li>
          <li class="nav-item">
            <RouterLink class="nav-link" to="/news">뉴스</RouterLink>
          </li>
          <li class="nav-item">
            <RouterLink class="nav-link" to="/blog">블로그</RouterLink>
          </li>
          <li class="nav-item">
            <RouterLink class="nav-link" to="/about">서비스 소개</RouterLink>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.navbar-brand {
  letter-spacing: 0;
}

.brand-icon {
  width: 2rem;
  height: 2rem;
  object-fit: contain;
}

.router-link-active:not(.navbar-brand) {
  color: var(--bs-primary);
  font-weight: 600;
}
</style>
