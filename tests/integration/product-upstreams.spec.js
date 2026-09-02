const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const {
  setupErrorTracking,
  logCapturedErrors,
  pageHasContent,
  pageLoadComplete,
  mainContentIsVisible,
  countDisabledNavItems
} = require('./helpers');

/**
 * Integration tests for Product Upstreams
 *
 * Tag: @product-upstreams
 * Usage: npx playwright test --grep @product-upstreams
 */

test.describe('Product Upstreams Module @product-upstreams', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should be visible in sidebar navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const moduleNav = page.locator('aside nav').filter({ hasText: 'Product Upstreams' });
    expect(await moduleNav.count()).toBeGreaterThan(0);
    await expect(moduleNav.first()).toBeVisible();
    expect(page.errors).toHaveLength(0);
  });

  test('should load the products view with tiles and origin text', async ({ page }) => {
    await page.goto('/#/product-upstreams/products');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.url()).toMatch(/product-upstreams\/products/);
    await expect(page.getByRole('heading', { name: 'Product Upstreams', level: 1 })).toBeVisible();
    await expect(page.getByTestId('data-origin-callout').first()).toBeVisible();
    await expect(page.getByText('Red Hat OSAIPO').first()).toBeVisible();
    await expect(page.getByTestId('feature-request-link').first()).toBeVisible();
    await expect(page.getByTestId('custom-data-request-link').first()).toBeVisible();
    await expect(page.getByTestId('product-tile-grid')).toBeVisible();
    await expect(page.getByTestId('product-tile-rhaiis')).toBeVisible();
    await expect(page.getByTestId('product-tile-llama-stack')).toHaveAttribute('data-available', 'false');

    expect(await mainContentIsVisible(page)).toBe(true);
    expect(await pageHasContent(page)).toBe(true);
    expect(await pageLoadComplete(page)).toBe(true);
    expect(page.errors).toHaveLength(0);
  });

  test('should show upstreams after selecting an available product', async ({ page }) => {
    await page.goto('/#/product-upstreams/products');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await page.getByTestId('product-tile-rhaiis').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.url()).toMatch(/product-upstreams\/product-detail/);
    await expect(page.getByTestId('upstream-list')).toBeVisible();
    await expect(page.getByText('vLLM').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /github.com\/vllm-project\/vllm/ })).toBeVisible();
    expect(page.errors).toHaveLength(0);
  });

  test('should search packages and show product plus upstream URL', async ({ page }) => {
    await page.goto('/#/product-upstreams/search');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.getByRole('heading', { name: 'Package Search' })).toBeVisible();
    await page.getByTestId('package-search-input').fill('vllm');
    await page.waitForTimeout(500);

    const results = page.getByTestId('package-search-results');
    await expect(results).toBeVisible();
    await expect(results).toContainText('vllm');
    await expect(results).toContainText('Red Hat AI Inference Server');
    await expect(results).toContainText('https://github.com/vllm-project/vllm');
    expect(page.errors).toHaveLength(0);
  });

  test('should fetch catalog data from the module API', async ({ page }) => {
    const apiResponses = [];
    page.on('response', response => {
      if (response.url().includes('/api/modules/product-upstreams/')) {
        apiResponses.push({ url: response.url(), status: response.status() });
      }
    });

    await page.goto('/#/product-upstreams/products');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const catalogHit = apiResponses.find(r => r.url.includes('/catalog') && r.status === 200);
    expect(catalogHit).toBeDefined();
    expect(page.errors).toHaveLength(0);
  });
});

test.describe('Product Upstreams Disabled Menu Items @product-upstreams', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should have no disabled menu items', async ({ page }) => {
    await page.goto('/#/product-upstreams/products');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const disabledCount = await countDisabledNavItems(page, 'Product Upstreams');
    expect(disabledCount).toBe(0);
    expect(page.errors).toHaveLength(0);
  });
});
