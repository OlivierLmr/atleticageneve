import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('home page shows role choice buttons', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Atletica Genève')).toBeVisible()
    await expect(page.getByText(/athlete.*manager/i)).toBeVisible()
    await expect(page.getByText(/admin.*selector/i)).toBeVisible()
  })

  test('admin login with valid credentials redirects to portal', async ({ page }) => {
    await page.goto('/')
    await page.getByText(/admin.*selector/i).click()
    await page.locator('input[type="text"]').fill('admin')
    await page.locator('input[type="password"]').fill('atletica2026')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/\/committee\/dashboard/)
    await expect(page).toHaveURL(/\/committee\/dashboard/)
  })

  test('admin login submits on Enter key', async ({ page }) => {
    await page.goto('/')
    await page.getByText(/admin.*selector/i).click()
    await page.locator('input[type="text"]').fill('admin')
    await page.locator('input[type="password"]').fill('atletica2026')
    await page.locator('input[type="password"]').press('Enter')
    await page.waitForURL(/\/committee\/dashboard/)
    await expect(page).toHaveURL(/\/committee\/dashboard/)
  })

  test('admin login with wrong password shows error', async ({ page }) => {
    await page.goto('/')
    await page.getByText(/admin.*selector/i).click()
    await page.locator('input[type="text"]').fill('admin')
    await page.locator('input[type="password"]').fill('wrongpass')
    await page.locator('button[type="submit"]').click()
    await expect(page.getByText(/invalid/i)).toBeVisible()
  })

  test('collaborator login redirects to candidates page', async ({ page }) => {
    await page.goto('/')
    await page.getByText(/admin.*selector/i).click()
    await page.locator('input[type="text"]').fill('pierre')
    await page.locator('input[type="password"]').fill('atletica2026')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/\/collaborator\/candidates/)
    await expect(page).toHaveURL(/\/collaborator\/candidates/)
  })

  test('athlete/manager path shows email field and register link', async ({ page }) => {
    await page.goto('/')
    await page.getByText(/athlete.*manager/i).click()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.getByRole('link', { name: /register/i })).toBeVisible()
  })

  test('unregistered email shows not-registered error', async ({ page }) => {
    await page.goto('/')
    await page.getByText(/athlete.*manager/i).click()
    await page.locator('input[type="email"]').fill('nobody@test.com')
    await page.locator('button[type="submit"]').click()
    await expect(page.getByText(/not registered/i)).toBeVisible()
  })

  test('language switcher toggles between EN and FR', async ({ page }) => {
    await page.goto('/')
    // Default may be EN or FR — click the switcher
    const switcher = page.getByRole('button', { name: /^(EN|FR)$/ })
    const initialText = await switcher.textContent()
    await switcher.click()
    const newText = await switcher.textContent()
    expect(newText).not.toBe(initialText)
  })
})
