<script setup lang="ts">
import { RouterLink } from 'vue-router'

import PageScaffold from '@/components/PageScaffold.vue'
</script>

<template>
  <PageScaffold title="서비스 소개">
    <RouterLink to="/privacy">개인정보처리방침</RouterLink>
  </PageScaffold>
</template>
