<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import PageScaffold from '@/components/PageScaffold.vue'

const route = useRoute()
const query = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))
</script>

<template>
  <PageScaffold title="검색">
    <p v-if="query" class="lead text-body-secondary">{{ query }}</p>
  </PageScaffold>
</template>
