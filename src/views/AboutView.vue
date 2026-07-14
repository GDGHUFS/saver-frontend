<script setup lang="ts">
import { RouterLink } from 'vue-router'

import PageScaffold from '@/components/PageScaffold.vue'
const brandIconUrl = `${import.meta.env.BASE_URL}android-chrome-512x512.png`
</script>

<template>
  <PageScaffold title="서비스 소개">
    <section class="mb-5">
      <h1>SAVER</h1>
      <img
          class="brand-icon img-fluid"
          :src="brandIconUrl"
          alt="SAVER의 로고입니다."
          aria-hidden="true"
      />
    </section>
    <RouterLink to="/privacy">개인정보처리방침</RouterLink>
  </PageScaffold>
</template>
