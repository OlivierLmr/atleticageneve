import { describe, it, expect } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  generateToken,
  sessionExpiresAt,
  magicLinkExpiresAt,
} from '@api/services/auth'

describe('hashPassword / verifyPassword', () => {
  it('verifies a correct password', async () => {
    const hash = await hashPassword('mySecret123')
    const valid = await verifyPassword('mySecret123', hash)
    expect(valid).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('mySecret123')
    const valid = await verifyPassword('wrongPassword', hash)
    expect(valid).toBe(false)
  })

  it('produces different hashes for the same password (random salt)', async () => {
    const hash1 = await hashPassword('same')
    const hash2 = await hashPassword('same')
    expect(hash1).not.toBe(hash2)
  })

  it('hash format is base64salt:base64hash', async () => {
    const hash = await hashPassword('test')
    expect(hash).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/)
  })

  // Legacy bcrypt hashes from seed data
  it('accepts the known seed password for bcrypt hashes', async () => {
    const bcryptHash = '$2a$10$LxQvJKqYsHzKQxOZqR5cGeZ.pMNFLXTg5KGHVNJnWJxGmxlL2yGfq'
    const valid = await verifyPassword('atletica2026', bcryptHash)
    expect(valid).toBe(true)
  })

  it('rejects wrong password for bcrypt hashes', async () => {
    const bcryptHash = '$2a$10$LxQvJKqYsHzKQxOZqR5cGeZ.pMNFLXTg5KGHVNJnWJxGmxlL2yGfq'
    const valid = await verifyPassword('wrongpassword', bcryptHash)
    expect(valid).toBe(false)
  })

  it('rejects malformed stored hash', async () => {
    const valid = await verifyPassword('test', 'not-a-valid-hash')
    expect(valid).toBe(false)
  })
})

describe('generateToken', () => {
  it('generates a non-empty string', () => {
    const token = generateToken()
    expect(token.length).toBeGreaterThan(20)
  })

  it('generates unique tokens', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()))
    expect(tokens.size).toBe(100)
  })

  it('generates URL-safe tokens (no +, /, =)', () => {
    for (let i = 0; i < 50; i++) {
      const token = generateToken()
      expect(token).not.toMatch(/[+/=]/)
    }
  })
})

describe('sessionExpiresAt', () => {
  it('defaults to 7 days from now', () => {
    const expires = new Date(sessionExpiresAt())
    const now = new Date()
    const diffDays = (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeGreaterThan(6.9)
    expect(diffDays).toBeLessThan(7.1)
  })

  it('respects custom duration', () => {
    const expires = new Date(sessionExpiresAt(1))
    const now = new Date()
    const diffDays = (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeGreaterThan(0.9)
    expect(diffDays).toBeLessThan(1.1)
  })
})

describe('magicLinkExpiresAt', () => {
  it('defaults to 30 minutes from now', () => {
    const expires = new Date(magicLinkExpiresAt())
    const now = new Date()
    const diffMinutes = (expires.getTime() - now.getTime()) / (1000 * 60)
    expect(diffMinutes).toBeGreaterThan(29)
    expect(diffMinutes).toBeLessThan(31)
  })
})
