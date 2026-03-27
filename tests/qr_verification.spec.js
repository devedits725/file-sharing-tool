import { test, expect } from '@playwright/test';

test.describe('Filoop QR Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Set bypass flag to see UI without actual Supabase keys
    await page.addInitScript(() => {
      window.BYPASS_CONFIG = true;
    });
    await page.goto('http://localhost:5173/');
  });

  test('Receive page should have a toggle between Type and Scan modes', async ({ page }) => {
    await page.click('button:has-text("Receive")');

    // Check if toggle exists
    const typeBtn = page.locator('button:has-text("Type Code")');
    const scanBtn = page.locator('button:has-text("Scan QR Code")');

    await expect(typeBtn).toBeVisible();
    await expect(scanBtn).toBeVisible();

    // Default mode is Type
    await expect(page.locator('input[placeholder="E.G. XK92PL"]')).toBeVisible();

    // Switch to Scan mode
    await scanBtn.click();
    await expect(page.locator('#reader')).toBeVisible();
    await expect(page.locator('text=Point camera at a Filoop QR code')).toBeVisible();

    // Switch back to Type mode
    await typeBtn.click();
    await expect(page.locator('input[placeholder="E.G. XK92PL"]')).toBeVisible();
  });

  test('Room URL path should auto-navigate to Receive tab', async ({ page }) => {
    // Navigate to a specific room code
    await page.goto('http://localhost:5173/ABC123');

    // Should be on Receive tab
    const receiveTab = page.locator('button:has-text("Receive")');
    await expect(receiveTab).toHaveClass(/text-primary/);

    // Should show joining/loading state or error (since ABC123 likely doesn't exist in mock/test DB)
    // But the key is that it's on the Receive tab and trying to join
    await expect(page.locator('text=Ready to receive?')).toBeVisible();
  });
});
