<script setup lang="ts">
import { RouterLink } from 'vue-router'

import PageScaffold from '@/components/PageScaffold.vue'
</script>

<template>
  <PageScaffold title="페이지를 찾을 수 없습니다">
    <RouterLink class="btn btn-primary" to="/">홈으로 이동</RouterLink>
  </PageScaffold>
</template>
