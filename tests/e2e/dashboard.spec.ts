import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Committee Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('dashboard loads with KPI cards', async ({ page }) => {
    await expect(page).toHaveURL(/\/committee\/dashboard/)
    // Should show KPI cards
    await expect(page.getByText(/confirmed/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/negotiation/i).first()).toBeVisible()
    await expect(page.getByText(/review/i).first()).toBeVisible()
  })

  test('dashboard shows event coverage table', async ({ page }) => {
    await expect(page.getByText(/event coverage/i)).toBeVisible({ timeout: 10_000 })
    // Should have at least one event row
    await expect(page.locator('table tbody tr').first()).toBeVisible()
  })
})
