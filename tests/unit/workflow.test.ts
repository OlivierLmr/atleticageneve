import { describe, it, expect } from 'vitest'
import { VALID_TRANSITIONS } from '@shared/constants'
import type { ApplicationStatus } from '@shared/types'

describe('Workflow transition validation', () => {
  function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false
  }

  // Valid transitions
  it('to_review → contract_sent is valid', () => {
    expect(canTransition('to_review', 'contract_sent')).toBe(true)
  })

  it('to_review → rejected is valid', () => {
    expect(canTransition('to_review', 'rejected')).toBe(true)
  })

  it('contract_sent → accepted is valid', () => {
    expect(canTransition('contract_sent', 'accepted')).toBe(true)
  })

  it('contract_sent → counter_offer is valid', () => {
    expect(canTransition('contract_sent', 'counter_offer')).toBe(true)
  })

  it('contract_sent → withdrawn is valid', () => {
    expect(canTransition('contract_sent', 'withdrawn')).toBe(true)
  })

  it('counter_offer → contract_sent is valid (re-send)', () => {
    expect(canTransition('counter_offer', 'contract_sent')).toBe(true)
  })

  it('accepted → withdrawn is valid', () => {
    expect(canTransition('accepted', 'withdrawn')).toBe(true)
  })

  // Invalid transitions
  it('to_review → accepted is invalid (must send contract first)', () => {
    expect(canTransition('to_review', 'accepted')).toBe(false)
  })

  it('to_review → counter_offer is invalid', () => {
    expect(canTransition('to_review', 'counter_offer')).toBe(false)
  })

  it('counter_offer → accepted is invalid (org must re-send contract)', () => {
    expect(canTransition('counter_offer', 'accepted')).toBe(false)
  })

  it('rejected → anything is invalid (terminal state)', () => {
    for (const status of ['to_review', 'contract_sent', 'counter_offer', 'accepted', 'withdrawn'] as ApplicationStatus[]) {
      expect(canTransition('rejected', status)).toBe(false)
    }
  })

  it('withdrawn → anything is invalid (terminal state)', () => {
    for (const status of ['to_review', 'contract_sent', 'counter_offer', 'accepted', 'rejected'] as ApplicationStatus[]) {
      expect(canTransition('withdrawn', status)).toBe(false)
    }
  })
})
