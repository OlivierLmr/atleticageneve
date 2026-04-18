import { test, expect } from '@playwright/test'

test.describe('Registration Flow', () => {
  test('signup page shows athlete and manager options', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByText(/I'm an Athlete/i)).toBeVisible()
    await expect(page.getByText(/Manager/i)).toBeVisible()
  })

  test('athlete registration form loads with step indicator', async ({ page }) => {
    await page.goto('/athlete/register')
    await expect(page.getByText(/registration/i)).toBeVisible()
    // Should have name fields (first step is athlete info)
    await expect(page.locator('input').first()).toBeVisible()
  })

  test('athlete registration step 1 has required fields', async ({ page }) => {
    await page.goto('/athlete/register')
    // First name, last name, email, gender, nationality are required on step 1
    await expect(page.getByText(/first name/i).first()).toBeVisible()
    await expect(page.getByText(/last name/i).first()).toBeVisible()
    await expect(page.getByText(/email/i).first()).toBeVisible()
    await expect(page.getByText(/category/i)).toBeVisible()
    await expect(page.getByText(/nationality/i)).toBeVisible()
  })

  test('athlete registration has no logistics fields on application', async ({ page }) => {
    await page.goto('/athlete/register')
    // In v3, logistics (flights, accommodation) are NOT on the application form
    // The simplified flow is: athlete info -> competition -> compliance -> travel (notes only)
    // Verify no flight/accommodation fields on the first step
    await expect(page.getByText(/flight number/i)).not.toBeVisible()
    await expect(page.getByText(/accommodation/i)).not.toBeVisible()
  })

  test('manager signup form loads', async ({ page }) => {
    await page.goto('/manager/signup')
    await expect(page.getByText(/manager/i)).toBeVisible()
  })

  test('register link on home page navigates to signup', async ({ page }) => {
    await page.goto('/')
    await page.getByText(/athlete.*manager/i).click()
    await page.getByRole('link', { name: /register/i }).click()
    await page.waitForURL(/\/signup/)
    await expect(page).toHaveURL(/\/signup/)
  })
})
