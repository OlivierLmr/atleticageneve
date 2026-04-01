import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Committee Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('dashboard loads with KPI cards', async ({ page }) => {
    await expect(page).toHaveURL(/\/committee\/dashboard/)
    // v3 KPI cards: Athletes Confirmed, In Negotiation, To Review, Budget Committed, Budget Remaining, Athletes
    await expect(page.getByText(/confirmed/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/negotiation/i).first()).toBeVisible()
    await expect(page.getByText(/review/i).first()).toBeVisible()
  })

  test('dashboard shows budget KPIs', async ({ page }) => {
    await expect(page.getByText(/budget committed/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/budget remaining/i)).toBeVisible()
    // Budget values are displayed with CHF prefix
    await expect(page.getByText(/CHF/).first()).toBeVisible()
  })

  test('dashboard shows athlete count KPI', async ({ page }) => {
    await expect(page.getByText('Athletes').first()).toBeVisible({ timeout: 10_000 })
  })

  test('dashboard shows event coverage table', async ({ page }) => {
    await expect(page.getByText(/event coverage/i)).toBeVisible({ timeout: 10_000 })
    // Should have at least one event row
    await expect(page.locator('table tbody tr').first()).toBeVisible()
  })

  test('event coverage table shows fill rate and quotas', async ({ page }) => {
    await expect(page.getByText(/event coverage/i)).toBeVisible({ timeout: 10_000 })
    // Table headers: Event, Fill rate, Confirmed, In Neg., Swiss Quota, EAP Quota
    await expect(page.getByText(/fill rate/i)).toBeVisible()
    await expect(page.getByText(/swiss quota/i)).toBeVisible()
    await expect(page.getByText(/eap quota/i)).toBeVisible()
  })

  test('dashboard shows selector workload section', async ({ page }) => {
    await expect(page.getByText(/selectors/i).first()).toBeVisible({ timeout: 10_000 })
    // Selectors section shows rev/neg/conf counts
    // Pierre and Sophie should appear as selectors from seed data
  })

  test('dashboard shows application pipeline', async ({ page }) => {
    await expect(page.getByText(/application pipeline/i)).toBeVisible({ timeout: 10_000 })
    // Pipeline shows v3 statuses: To Review, In Negotiation, Confirmed, Not selected, Withdrawn
    await expect(page.getByText(/withdrawn/i).first()).toBeVisible()
  })

  test('dashboard shows edition name and year', async ({ page }) => {
    // The header shows edition info from the API
    await expect(page.getByText(/2026/).first()).toBeVisible({ timeout: 10_000 })
  })
})
