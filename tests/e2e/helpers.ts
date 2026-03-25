import { type Page, expect } from '@playwright/test'

/** Login as admin (committee) via the home page */
export async function loginAsAdmin(page: Page, username = 'admin', password = 'atletica2026') {
  await page.goto('/')
  await page.getByText(/admin.*selector/i).click()
  await page.locator('input[type="text"]').fill(username)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  // Wait for redirect
  await page.waitForURL(/\/(committee|collaborator)\//)
}

/** Login as collaborator via the home page */
export async function loginAsCollaborator(page: Page, username = 'pierre', password = 'atletica2026') {
  await page.goto('/')
  await page.getByText(/admin.*selector/i).click()
  await page.locator('input[type="text"]').fill(username)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/collaborator\//)
}
