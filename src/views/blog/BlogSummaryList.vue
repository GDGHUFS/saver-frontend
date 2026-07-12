<script setup lang="ts">
import type { BlogSummary } from '@/api/blog'
import { formatDateTime } from '@/utils/date-time'

withDefaults(
  defineProps<{
    compact?: boolean
    posts: readonly BlogSummary[]
  }>(),
  { compact: false },
)
</script>

<template>
  <ul class="list-group list-group-flush" :class="{ 'compact-blog-list': compact }">
    <li v-for="post in posts" :key="post.id" class="list-group-item px-0 py-3">
      <div class="d-flex align-items-start gap-3">
        <img
          class="blog-author-image flex-shrink-0"
          :src="post.author.profileImage"
          alt=""
          loading="lazy"
        />
        <div class="min-w-0 flex-grow-1">
          <RouterLink
            class="blog-title-link d-block fw-semibold text-body text-decoration-none text-break"
            :to="{ name: 'blog-detail', params: { blogId: post.id } }"
          >
            {{ post.title }}
          </RouterLink>
          <div class="d-flex flex-wrap align-items-center gap-x-2 small text-body-secondary mt-1">
            <RouterLink
              class="text-body-secondary"
              :to="{ name: 'blog-author', params: { userId: post.author.id } }"
            >
              {{ post.author.nickname }}
            </RouterLink>
            <span aria-hidden="true">·</span>
            <time :datetime="post.createdAt">{{ formatDateTime(post.createdAt) }}</time>
          </div>
        </div>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.blog-author-image {
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 50%;
  object-fit: cover;
}

.blog-title-link:hover,
.blog-title-link:focus-visible {
  color: var(--bs-primary) !important;
  text-decoration: underline !important;
}

.min-w-0 {
  min-width: 0;
}

.gap-x-2 {
  column-gap: 0.5rem;
}

.compact-blog-list .list-group-item:first-child {
  padding-top: 0 !important;
}
</style>
