import { test, expect } from '@playwright/test'

test.describe('Registration Flow', () => {
  test('signup page shows athlete and manager options', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByText(/I'm an Athlete/i)).toBeVisible()
    await expect(page.getByText(/Manager/i)).toBeVisible()
  })

  test('athlete registration form loads', async ({ page }) => {
    await page.goto('/athlete/register')
    await expect(page.getByText(/registration/i)).toBeVisible()
    // Should have name fields
    await expect(page.locator('input').first()).toBeVisible()
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
