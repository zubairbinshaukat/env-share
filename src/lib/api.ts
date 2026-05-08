/**
 * API client placeholder for env CRUD and share links.
 * Wire this to `/api` serverless routes or a backend later.
 */

export const api = {
  async health(): Promise<{ ok: true }> {
    return { ok: true }
  },
} as const
