import { test, expect } from '@playwright/test'
import { loginAsCollaborator, waitForCandidatesTable } from './helpers'

test.describe('Selection Console', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCollaborator(page)
  })

  test('candidates page loads with athletes', async ({ page }) => {
    // Nav link and page title contain "Candidate(s)"
    await expect(page.getByText(/candidate/i).first()).toBeVisible()
    // Should have at least one athlete row
    await waitForCandidatesTable(page)
  })

  test('candidates table shows v3 negotiation statuses', async ({ page }) => {
    await waitForCandidatesTable(page)
    // At least one athlete should be visible with a status badge
    const statusBadges = page.locator('table tbody tr td span')
    await expect(statusBadges.first()).toBeVisible()
  })

  test('candidates table displays event name from catalog', async ({ page }) => {
    await waitForCandidatesTable(page)
    // Events are shown via catalog name (e.g., "100m", "400m", "High Jump")
    await expect(page.locator('table').getByText(/100m|400m|high jump/i).first()).toBeVisible()
  })

  test('candidates table shows performance columns', async ({ page }) => {
    await waitForCandidatesTable(page)
    // Table headers include Personal Best, Season Best, World Ranking columns
    await expect(page.getByText(/personal best/i)).toBeVisible()
    await expect(page.getByText(/season best/i)).toBeVisible()
    await expect(page.getByText(/world ranking/i)).toBeVisible()
  })

  test('candidates table shows scoring and recommendation columns', async ({ page }) => {
    await waitForCandidatesTable(page)
    await expect(page.getByText(/scoring/i)).toBeVisible()
    await expect(page.getByText(/recommendation/i)).toBeVisible()
  })

  test('candidates table shows negotiation and event selection columns', async ({ page }) => {
    await waitForCandidatesTable(page)
    await expect(page.getByText(/negotiation/i).first()).toBeVisible()
    await expect(page.getByText(/event selection/i)).toBeVisible()
  })

  test('can filter by event', async ({ page }) => {
    await waitForCandidatesTable(page)
    const selects = page.locator('select')
    const eventSelect = selects.first()
    const optionCount = await eventSelect.locator('option').count()
    expect(optionCount).toBeGreaterThan(1)
  })

  test('can filter by negotiation status', async ({ page }) => {
    await waitForCandidatesTable(page)
    // Status filter: find the select that contains "All statuses"
    const statusSelect = page.locator('select').filter({ hasText: /statuses/i })
    const options = statusSelect.locator('option')
    const optionCount = await options.count()
    // "All statuses" + 6 negotiation statuses
    expect(optionCount).toBeGreaterThanOrEqual(7)
  })

  test('can search candidates by name', async ({ page }) => {
    await waitForCandidatesTable(page)
    const searchInput = page.locator('input[type="text"]')
    await expect(searchInput).toBeVisible()
  })

  test('clicking an athlete opens detail page', async ({ page }) => {
    await waitForCandidatesTable(page)
    await page.locator('table tbody tr').first().locator('a').first().click()
    await page.waitForURL(/\/collaborator\/athletes\//)
    // Should show athlete banner with name
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('athlete detail page shows tab navigation', async ({ page }) => {
    await waitForCandidatesTable(page)
    await page.locator('table tbody tr').first().locator('a').first().click()
    await page.waitForURL(/\/collaborator\/athletes\//)

    // Two tabs: Personal Data and Agreement & Negotiation
    await expect(page.getByText(/personal data/i).first()).toBeVisible()
    await expect(page.getByText(/agreement.*negotiation/i).first()).toBeVisible()
  })

  test('athlete detail page shows agreement tab with timeline', async ({ page }) => {
    await waitForCandidatesTable(page)
    await page.locator('table tbody tr').first().locator('a').first().click()
    await page.waitForURL(/\/collaborator\/athletes\//)

    // Switch to negotiation tab
    await page.getByText(/agreement.*negotiation/i).first().click()
    // Timeline and add note form
    await expect(page.getByText(/timeline/i)).toBeVisible()
    await expect(page.getByText(/add note/i)).toBeVisible()
  })

  test('athlete detail shows event info in banner', async ({ page }) => {
    await waitForCandidatesTable(page)
    await page.locator('table tbody tr').first().locator('a').first().click()
    await page.waitForURL(/\/collaborator\/athletes\//)

    // Events are shown in the banner area
    await expect(page.getByText(/100m|400m|high jump|long jump/i).first()).toBeVisible()
  })

  test('athlete detail shows performance data in banner', async ({ page }) => {
    await waitForCandidatesTable(page)
    await page.locator('table tbody tr').first().locator('a').first().click()
    await page.waitForURL(/\/collaborator\/athletes\//)

    // WA Performance shown as PB/SB labels in event rows in the banner
    await expect(page.getByText(/PB|SB/i).first()).toBeVisible()
  })

  test('athlete detail shows cost info', async ({ page }) => {
    await waitForCandidatesTable(page)
    await page.locator('table tbody tr').first().locator('a').first().click()
    await page.waitForURL(/\/collaborator\/athletes\//)

    // Cost is shown in the banner — either "Estimated" label or "CHF" value
    await expect(page.getByText(/estimated|CHF/i).first()).toBeVisible()
  })

  test('athlete detail has notes section', async ({ page }) => {
    await waitForCandidatesTable(page)
    await page.locator('table tbody tr').first().locator('a').first().click()
    await page.waitForURL(/\/collaborator\/athletes\//)

    // Notes is a collapsible section on the personal data tab
    // Click it open to reveal internal notes
    await page.getByText('Notes').click()
    await expect(page.getByText(/internal notes/i)).toBeVisible()
  })
})
