import { test, expect } from '@playwright/test'
import { loginAsCollaborator } from './helpers'

test.describe('Selection Console', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCollaborator(page)
  })

  test('candidates page loads with athletes', async ({ page }) => {
    await expect(page.getByText(/candidates/i)).toBeVisible()
    // Should have at least one athlete row
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10_000 })
  })

  test('can filter by event', async ({ page }) => {
    // Wait for the table to load
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10_000 })
    // Find the event filter select
    const selects = page.locator('select')
    const eventSelect = selects.first()
    // Get options
    const optionCount = await eventSelect.locator('option').count()
    expect(optionCount).toBeGreaterThan(1)
  })

  test('clicking an athlete opens detail page', async ({ page }) => {
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10_000 })
    // Click first athlete row link
    await page.locator('table tbody tr').first().locator('a').first().click()
    // Should navigate to athlete detail
    await page.waitForURL(/\/collaborator\/athletes\//)
    // Should show athlete details
    await expect(page.getByText(/details/i)).toBeVisible()
  })

  test('athlete detail page shows scoring and actions', async ({ page }) => {
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10_000 })
    await page.locator('table tbody tr').first().locator('a').first().click()
    await page.waitForURL(/\/collaborator\/athletes\//)

    // Should have scoring section
    await expect(page.getByText(/scoring/i)).toBeVisible()
    // Should have actions section
    await expect(page.getByText(/actions/i)).toBeVisible()
    // Should have timeline section
    await expect(page.getByText(/timeline/i)).toBeVisible()
  })
})
