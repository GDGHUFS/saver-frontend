<script setup lang="ts">
import { RouterView } from 'vue-router'

import AppNavbar from '@/components/AppNavbar.vue'
</script>

<template>
  <a class="skip-link" href="#main-content">본문으로 건너뛰기</a>
  <AppNavbar />
  <main id="main-content">
    <RouterView />
  </main>
</template>
