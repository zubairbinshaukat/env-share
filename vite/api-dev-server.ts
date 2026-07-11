import { readdirSync } from "node:fs"
import path from "node:path"
import type { IncomingMessage, ServerResponse } from "node:http"

import { loadEnv, type Plugin } from "vite"

/**
 * Runs the Vercel-style `/api/*` serverless functions during `vite dev`, so
 * `npm run dev` is full-stack without needing `vercel dev`. Each request is
 * routed to the matching handler file, which is invoked with request/response
 * objects shimmed to the shape Vercel's `@vercel/node` provides
 * (`req.query`, `req.body`, `res.status().json()`).
 *
 * This plugin is dev-only; production still runs the same files on Vercel.
 */

type RouteSegment = { literal: string } | { param: string }

interface ApiRoute {
  segments: RouteSegment[]
  file: string
}

const API_DIR = path.resolve(process.cwd(), "api")

/** Collect every handler file under api/, excluding _lib and _-prefixed files. */
function collectRoutes(dir: string, baseSegments: RouteSegment[] = []): ApiRoute[] {
  const routes: ApiRoute[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("_")) continue // _lib, _-prefixed helpers
    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      routes.push(...collectRoutes(full, [...baseSegments, toSegment(entry.name)]))
      continue
    }
    if (!entry.name.endsWith(".ts")) continue

    const bare = entry.name.slice(0, -".ts".length)
    // "index" is the directory route itself; other names add a segment.
    const segments =
      bare === "index" ? baseSegments : [...baseSegments, toSegment(bare)]
    routes.push({ segments, file: full })
  }
  return routes
}

/** Convert a path segment or filename into a literal or [param] route segment. */
function toSegment(name: string): RouteSegment {
  const match = /^\[(.+)\]$/.exec(name)
  return match ? { param: match[1] } : { literal: name }
}

/** Match a request path (segments after /api/) against the route table. */
function matchRoute(
  routes: ApiRoute[],
  pathSegments: string[],
): { route: ApiRoute; params: Record<string, string> } | null {
  // Prefer routes with fewer params (more specific) when several match.
  const sorted = [...routes].sort((a, b) => countParams(a) - countParams(b))
  for (const route of sorted) {
    if (route.segments.length !== pathSegments.length) continue
    const params: Record<string, string> = {}
    let ok = true
    for (let i = 0; i < route.segments.length; i++) {
      const seg = route.segments[i]
      const value = pathSegments[i]
      if ("literal" in seg) {
        if (seg.literal !== value) {
          ok = false
          break
        }
      } else {
        params[seg.param] = decodeURIComponent(value)
      }
    }
    if (ok) return { route, params }
  }
  return null
}

function countParams(route: ApiRoute): number {
  return route.segments.filter((s) => "param" in s).length
}

/** Read and JSON-parse the request body for methods that carry one. */
async function readBody(req: IncomingMessage): Promise<unknown> {
  const method = (req.method ?? "GET").toUpperCase()
  if (method === "GET" || method === "HEAD") return undefined
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  if (chunks.length === 0) return undefined
  const raw = Buffer.concat(chunks).toString("utf8")
  if (!raw) return undefined
  const contentType = String(req.headers["content-type"] ?? "")
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw)
    } catch {
      return undefined
    }
  }
  return raw
}

export function apiDevServer(): Plugin {
  return {
    name: "api-dev-server",
    apply: "serve",
    config(_config, { mode }) {
      // Vite only exposes VITE_* vars; the API handlers read process.env
      // (TURSO_*, CLERK_SECRET_KEY, ...), so load the full env into process.env.
      const env = loadEnv(mode, process.cwd(), "")
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ""
        if (!url.startsWith("/api/") && url !== "/api") return next()

        const parsed = new URL(url, "http://localhost")
        const pathname = parsed.pathname.replace(/^\/api\/?/, "")
        const pathSegments = pathname ? pathname.split("/").filter(Boolean) : []

        const routes = collectRoutes(API_DIR)
        const matched = matchRoute(routes, pathSegments)
        if (!matched) return next()

        // Shim req/res to the @vercel/node shape the handlers expect.
        const query: Record<string, string> = { ...matched.params }
        for (const [key, value] of parsed.searchParams.entries()) {
          query[key] = value
        }

        const vreq = req as IncomingMessage & {
          query: Record<string, string>
          body: unknown
        }
        vreq.query = query
        try {
          vreq.body = await readBody(req)
        } catch {
          vreq.body = undefined
        }

        const vres = res as ServerResponse & {
          status: (code: number) => typeof vres
          json: (body: unknown) => void
          send: (body: unknown) => void
        }
        vres.status = (code: number) => {
          vres.statusCode = code
          return vres
        }
        vres.json = (body: unknown) => {
          if (!vres.getHeader("content-type")) {
            vres.setHeader("content-type", "application/json; charset=utf-8")
          }
          vres.end(JSON.stringify(body))
        }
        vres.send = (body: unknown) => {
          vres.end(typeof body === "string" ? body : JSON.stringify(body))
        }

        try {
          const mod = await server.ssrLoadModule(matched.route.file)
          const handler = mod.default as (
            request: unknown,
            response: unknown,
          ) => unknown | Promise<unknown>
          if (typeof handler !== "function") {
            res.statusCode = 500
            res.end(
              JSON.stringify({
                error: { code: "no_handler", message: "Handler has no default export" },
              }),
            )
            return
          }
          await handler(vreq, vres)
        } catch (err) {
          server.ssrFixStacktrace(err as Error)
          res.statusCode = 500
          res.setHeader("content-type", "application/json; charset=utf-8")
          res.end(
            JSON.stringify({
              error: {
                code: "internal_error",
                message: err instanceof Error ? err.message : "Unexpected server error",
              },
            }),
          )
        }
      })
    },
  }
}
