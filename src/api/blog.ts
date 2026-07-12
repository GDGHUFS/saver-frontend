import { apiClient } from '@/api/client'

export const BLOG_LATEST_MAX_COUNT = 100

export interface BlogAuthor {
  id: number
  nickname: string
  profileImage: string
}

export interface BlogSummary {
  author: BlogAuthor
  createdAt: string
  id: number
  title: string
  updatedAt: string
}

export interface BlogPost extends BlogSummary {
  content: string
}

export interface BlogWriteInput {
  content: string
  title: string
}

export interface CreatedBlog {
  id: number
  location: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function decodePositiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer`)
  }

  return value
}

function decodeString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`)
  }

  return value
}

function decodeDateTime(value: unknown, field: string): string {
  const dateTime = decodeString(value, field)
  if (Number.isNaN(Date.parse(dateTime))) {
    throw new Error(`${field} must be an ISO 8601 date-time`)
  }

  return dateTime
}

function decodeBlogSummary(value: unknown): BlogSummary {
  if (!isRecord(value)) {
    throw new Error('blog summary must be an object')
  }

  return {
    author: {
      id: decodePositiveInteger(value.author_id, 'author_id'),
      nickname: decodeString(value.nickname, 'nickname'),
      profileImage: decodeString(value.profile_image, 'profile_image'),
    },
    createdAt: decodeDateTime(value.created_at, 'created_at'),
    id: decodePositiveInteger(value.id, 'id'),
    title: decodeString(value.title, 'title'),
    updatedAt: decodeDateTime(value.updated_at, 'updated_at'),
  }
}

function decodeBlogSummaries(value: unknown): readonly BlogSummary[] {
  if (!Array.isArray(value)) {
    throw new Error('blog summaries must be an array')
  }

  return value.map(decodeBlogSummary)
}

function decodeBlogPost(value: unknown): BlogPost {
  if (!isRecord(value)) {
    throw new Error('blog post must be an object')
  }

  return {
    ...decodeBlogSummary(value),
    content: decodeString(value.content, 'content'),
  }
}

function decodeCreatedBlog(_value: unknown, response: Response): CreatedBlog {
  const location = response.headers.get('Location')
  const match = location?.match(/^\/blog\/([1-9][0-9]*)$/)
  if (location === null || match === null || match === undefined) {
    throw new Error('Location header must contain the created blog path')
  }

  const id = Number(match[1])
  if (!Number.isSafeInteger(id)) {
    throw new Error('created blog id is invalid')
  }

  return { id, location }
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${field} must be a positive integer`)
  }
}

export const blogApi = {
  getLatest(count = 3, signal?: AbortSignal): Promise<readonly BlogSummary[]> {
    if (!Number.isSafeInteger(count) || count < 1 || count > BLOG_LATEST_MAX_COUNT) {
      throw new RangeError(`count must be between 1 and ${BLOG_LATEST_MAX_COUNT}`)
    }

    return apiClient.request('/blog/latest', {
      decoder: decodeBlogSummaries,
      query: { count },
      signal,
    })
  },

  getByAuthor(userId: number, signal?: AbortSignal): Promise<readonly BlogSummary[]> {
    assertPositiveInteger(userId, 'userId')
    return apiClient.request(`/blog/author/${userId}`, {
      decoder: decodeBlogSummaries,
      signal,
    })
  },

  getById(blogId: number, signal?: AbortSignal): Promise<BlogPost> {
    assertPositiveInteger(blogId, 'blogId')
    return apiClient.request(`/blog/${blogId}`, { decoder: decodeBlogPost, signal })
  },

  create(input: BlogWriteInput): Promise<CreatedBlog> {
    return apiClient.request('/blog/', {
      body: input,
      decoder: decodeCreatedBlog,
      method: 'POST',
    })
  },

  update(blogId: number, input: BlogWriteInput): Promise<void> {
    assertPositiveInteger(blogId, 'blogId')
    return apiClient.request(`/blog/${blogId}`, { body: input, method: 'PUT' })
  },

  delete(blogId: number): Promise<void> {
    assertPositiveInteger(blogId, 'blogId')
    return apiClient.request(`/blog/${blogId}`, { method: 'DELETE' })
  },
}
