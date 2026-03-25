import type { Context, Next } from 'hono'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import type { Env } from '../index'
import type { UserRole } from '@shared/types'

/**
 * Auth middleware that validates the session token and optionally checks roles.
 * Sets c.set('user', user) on success.
 */
export function requireAuth(...roles: UserRole[]) {
  return async (c: Context<Env>, next: Next) => {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const db = c.get('db')
    const sessions = await db
      .select()
      .from(schema.session)
      .where(eq(schema.session.token, token))
      .limit(1)

    if (sessions.length === 0) {
      return c.json({ error: 'Invalid session' }, 401)
    }

    const sess = sessions[0]
    if (new Date(sess.expiresAt) < new Date()) {
      // Clean up expired session
      await db.delete(schema.session).where(eq(schema.session.id, sess.id))
      return c.json({ error: 'Session expired' }, 401)
    }

    const users = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, sess.userId))
      .limit(1)

    if (users.length === 0 || !users[0].isActive) {
      return c.json({ error: 'User not found or inactive' }, 401)
    }

    const user = users[0]

    if (roles.length > 0 && !roles.includes(user.role as UserRole)) {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }

    c.set('user', user)
    await next()
  }
}

/**
 * Optional auth — sets user if token present, but doesn't require it.
 */
export function optionalAuth() {
  return async (c: Context<Env>, next: Next) => {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (token) {
      const db = c.get('db')
      const sessions = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.token, token))
        .limit(1)

      if (sessions.length > 0 && new Date(sessions[0].expiresAt) >= new Date()) {
        const users = await db
          .select()
          .from(schema.user)
          .where(eq(schema.user.id, sessions[0].userId))
          .limit(1)

        if (users.length > 0 && users[0].isActive) {
          c.set('user', users[0])
        }
      }
    } else {
      c.set('user', null)
    }

    await next()
  }
}
