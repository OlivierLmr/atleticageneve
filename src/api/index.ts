import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './db/schema'
import { ensureMigrated } from './db/migrate'
import authRoutes from './routes/auth'
import athleteRoutes from './routes/athletes'
import eventRoutes from './routes/events'
import managerRoutes from './routes/managers'
import applicationRoutes from './routes/applications'
import agreementRoutes from './routes/agreements'
import portalRoutes from './routes/portal'
import dashboardRoutes from './routes/dashboard'
import hotelRoutes from './routes/hotels'
import waPerformanceRoutes from './routes/wa-performance'
import editionRoutes from './routes/editions'
import eventCatalogRoutes from './routes/event-catalog'
import countryRoutes from './routes/countries'
import eapCityRoutes from './routes/eap-cities'
import hotelRoomRoutes from './routes/hotel-rooms'
import emailRoutes from './routes/emails'
import userRoutes from './routes/users'

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
  origin: (origin) => {
    // Allow any localhost origin in dev, plus the production domain
    if (!origin) return 'https://atleticageneve.pages.dev'
    if (origin.startsWith('http://localhost:')) return origin
    if (origin === 'https://atleticageneve.pages.dev') return origin
    return null as unknown as string
  },
  credentials: true,
}))

// Ensure D1 schema is up to date on every Worker cold-start.
app.use('/api/*', async (c, next) => {
  await ensureMigrated(c.env.DB)
  const db = drizzle(c.env.DB, { schema })
  c.set('db', db)
  await next()
})

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// ── Routes ────────────────────────────────────────────────────────────────────

app.route('/api/v1/auth', authRoutes)
app.route('/api/v1/athletes', athleteRoutes)
app.route('/api/v1/events', eventRoutes)
app.route('/api/v1/managers', managerRoutes)
app.route('/api/v1/applications', applicationRoutes)
app.route('/api/v1/athletes', agreementRoutes)
app.route('/api/v1/portal', portalRoutes)
app.route('/api/v1/dashboard', dashboardRoutes)
app.route('/api/v1/hotels', hotelRoutes)
app.route('/api/v1/wa-performance', waPerformanceRoutes)
app.route('/api/v1/editions', editionRoutes)
app.route('/api/v1/event-catalog', eventCatalogRoutes)
app.route('/api/v1/countries', countryRoutes)
app.route('/api/v1/eap-cities', eapCityRoutes)
app.route('/api/v1/hotel-rooms', hotelRoomRoutes)
app.route('/api/v1/emails', emailRoutes)
app.route('/api/v1/users', userRoutes)

export default app
