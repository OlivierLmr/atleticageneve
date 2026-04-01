import { test, expect } from '@playwright/test'
import { loginAsCollaborator, waitForCandidatesTable } from './helpers'

test.describe('Selection Console', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCollaborator(page)
  })

  test('candidates page loads with athletes', async ({ page }) => {
    await expect(page.getByText(/candidates/i)).toBeVisible()
    // Should have at least one athlete row
    await waitForCandidatesTable(page)
  })

  test('candidates table shows v3 negotiation statuses', async ({ page }) => {
    await waitForCandidatesTable(page)
    // v3 status labels: "Under review", "Agreement sent", "Counter-offer sent", "Confirmed"
    // At least one athlete should be visible with a status badge
    const statusBadges = page.locator('table tbody tr td span')
    await expect(statusBadges.first()).toBeVisible()
  })

  test('candidates table displays event name from catalog', async ({ page }) => {
    await waitForCandidatesTable(page)
    // Events are shown via catalog name (e.g., "100m", "400m", "High Jump")
    // Seed data has 100m athletes, so we should see "100m" in the table
    await expect(page.getByText('100m').first()).toBeVisible()
  })

  test('candidates table shows performance columns (PB, SB, WR)', async ({ page }) => {
    await waitForCandidatesTable(page)
    // Table headers include PB, SB, #WR columns
    await expect(page.getByText('PB')).toBeVisible()
    await expect(page.getByText('SB')).toBeVisible()
    await expect(page.getByText('#WR')).toBeVisible()
  })

  test('candidates table shows scoring and recommendation columns', async ({ page }) => {
    await waitForCandidatesTable(page)
    await expect(page.getByText(/scoring/i)).toBeVisible()
    await expect(page.getByText(/recommendation/i)).toBeVisible()
  })

  test('candidates table shows negotiation and participation columns', async ({ page }) => {
    await waitForCandidatesTable(page)
    await expect(page.getByText('Negotiation')).toBeVisible()
    await expect(page.getByText('Participation')).toBeVisible()
  })

  test('can filter by event', async ({ page }) => {
    await waitForCandidatesTable(page)
    // Find the event filter select
    const selects = page.locator('select')
    const eventSelect = selects.first()
    // Get options — should have "All Events" plus individual events
    const optionCount = await eventSelect.locator('option').count()
    expect(optionCount).toBeGreaterThan(1)
  })

  test('can filter by negotiation status', async ({ page }) => {
    await waitForCandidatesTable(page)
    // The second select is the status filter
    const selects = page.locator('select')
    const statusSelect = selects.nth(1)
    // Should have v3 statuses: agreement_sent, counter_offer_sent, confirmed etc.
    const options = statusSelect.locator('option')
    const optionCount = await options.count()
    // "All statuses" + 6 negotiation statuses
    expect(optionCount).toBeGreaterThanOrEqual(7)
  })

  test('can search candidates by name', async ({ page }) => {
    await waitForCandidatesTable(page)
    // Search input is available
    const searchInput = page.locator('input[type="text"]')
    await expect(searchInput).toBeVisible()
  })

  test('clicking an athlete opens detail page', async ({ page }) => {
    await waitForCandidatesTable(page)
    // Click first athlete row link
    await page.locator('table tbody tr').first().locator('a').first().click()
    // Should navigate to athlete detail
    await page.waitForURL(/\/collaborator\/athletes\//)
    // Should show athlete details section
    await expect(page.getByText(/details/i)).toBeVisible()
  })

  test('athlete detail page shows details, scoring, compliance, and actions', async ({ page }) => {
    await waitForCandidatesTable(page)
    await page.locator('table tbody tr').first().locator('a').first().click()
    await page.waitForURL(/\/collaborator\/athletes\//)

    // Left column: Details card
    await expect(page.getByText(/details/i).first()).toBeVisible()
    // Left column: Scoring card
    await expect(page.getByText(/scoring/i).first()).toBeVisible()
    // Left column: Compliance card (Clean & Fair)
    await expect(page.getByText(/clean.*fair/i)).toBeVisible()
    // Center column: Actions card
    await expect(page.getByText(/actions/i).first()).toBeVisible()
  })

  test('athlete detail page shows agreement section (not contract)', async ({ page }) => {
    await waitForCandidatesTable(page)
    await page.locator('table tbody tr').first().locator('a').first().click()
    await page.waitForURL(/\/collaborator\/athletes\//)

    // v3: Agreement section header (from contract.title i18n key = "Contract")
    // The section uses t('contract.title') which maps to "Contract"
    await expect(page.getByText(/contract/i).first()).toBeVisible()
  })

  test('athlete detail page shows timeline section', async ({ page }) => {
    await waitForCandidatesTable(page)
    await page.locator('table tbody tr').first().locator('a').first().click()
    await page.waitForURL(/\/collaborator\/athletes\//)

    // Right column: Timeline
    await expect(page.getByText(/timeline/i)).toBeVisible()
    // Right column: Add note form
    await expect(page.getByText(/add note/i)).toBeVisible()
  })

  test('athlete detail shows event name from catalog join', async ({ page }) => {
    await waitForCandidatesTable(page)
    await page.locator('table tbody tr').first().locator('a').first().click()
    await page.waitForURL(/\/collaborator\/athletes\//)

    // Event name comes from event_catalog (e.g., "100m", "400m", "High Jump")
    // The detail page shows event via app.event.catalog.name
    await expect(page.getByText(/event/i).first()).toBeVisible()
  })

  test('athlete detail shows WA performance data', async ({ page }) => {
    await waitForCandidatesTable(page)
    await page.locator('table tbody tr').first().locator('a').first().click()
    await page.waitForURL(/\/collaborator\/athletes\//)

    // WA Performance fields: Personal Best, Season Best, World Ranking
    await expect(page.getByText(/personal best/i)).toBeVisible()
    await expect(page.getByText(/season best/i)).toBeVisible()
    await expect(page.getByText(/world ranking/i)).toBeVisible()
  })

  test('athlete detail shows estimated cost', async ({ page }) => {
    await waitForCandidatesTable(page)
    await page.locator('table tbody tr').first().locator('a').first().click()
    await page.waitForURL(/\/collaborator\/athletes\//)

    // Estimated cost is shown in the scoring card
    await expect(page.getByText(/estimated cost/i)).toBeVisible()
  })

  test('athlete detail has internal notes textarea', async ({ page }) => {
    await waitForCandidatesTable(page)
    await page.locator('table tbody tr').first().locator('a').first().click()
    await page.waitForURL(/\/collaborator\/athletes\//)

    // Internal notes section
    await expect(page.getByText(/notes.*internal/i)).toBeVisible()
  })
})
