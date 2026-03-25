import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './db/schema'
import authRoutes from './routes/auth'

export type Env = {
  Bindings: {
    DB: D1Database
  }
  Variables: {
    db: ReturnType<typeof drizzle<typeof schema>>
    user: typeof schema.user.$inferSelect | null
  }
}

const app = new Hono<Env>()

// ── Middleware ─────────────────────────────────────────────────────────────────

app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:8787'],
  credentials: true,
}))

// Inject Drizzle DB instance
app.use('/api/*', async (c, next) => {
  const db = drizzle(c.env.DB, { schema })
  c.set('db', db)
  await next()
})

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// ── Routes ────────────────────────────────────────────────────────────────────

app.route('/api/v1/auth', authRoutes)

app.get('/api/v1/editions/current', async (c) => {
  const db = c.get('db')
  const editions = await db.select().from(schema.edition).limit(1)
  if (editions.length === 0) {
    return c.json({ error: 'No edition configured' }, 404)
  }
  return c.json(editions[0])
})

app.get('/api/v1/events', async (c) => {
  const db = c.get('db')
  const events = await db.select().from(schema.event)
  return c.json(events)
})

export default app
