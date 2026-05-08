import { Redis } from "@upstash/redis"

let client: Redis | null = null

export function getRedis(): Redis {
  if (client) return client

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!redisUrl || !redisToken) {
    throw new Error(
      "Missing Upstash configuration. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    )
  }

  client = new Redis({
    url: redisUrl,
    token: redisToken,
  })
  return client
}
