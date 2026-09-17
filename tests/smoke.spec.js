const { test, expect } = require('@playwright/test');

const PAGES = [
  'index.html',
  'osrs-ge-tracker.html',
  'osrs-skill-profit.html',
  'osrs-training-planner.html',
  'osrs-farming-planner.html',
  'osrs-herblore-planner.html',
  'osrs-prayer-planner.html',
];

/**
 * Smoke tests check that a page boots without console errors - they don't assert on
 * real market data, so there is no reason for them to reach out to anyone's live API.
 *
 * Two reasons this matters. First, etiquette: `npm test` used to fire a mapping +
 * latest fetch at the OSRS Wiki's donation-funded price API for every page, times
 * every parallel worker, on every run - load their volunteers absorb for nothing.
 * Second, determinism: those live calls made the suite flaky, failing with
 * ERR_CONNECTION_RESET whenever the network hiccuped mid-run.
 *
 * `calculations.spec.js` already stubbed the price API for the same reason; this
 * just applies it to the rest, plus Wise Old Man (another volunteer-run service)
 * and Google Fonts.
 */
async function stubExternalServices(page) {
  await page.route('https://prices.runescape.wiki/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/mapping')) {
      await route.fulfill({ json: [] });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });

  await page.route('https://api.wiseoldman.net/**', async (route) => {
    await route.fulfill({ status: 404, json: { message: 'stubbed in tests' } });
  });

  // Remote fonts and item sprites: irrelevant to "does this page boot", and a
  // network blip on one of them shouldn't read as a page error. These are fulfilled
  // rather than aborted - an aborted request logs its own console error, which is
  // exactly what these tests assert against.
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'font/woff2', body: '' }));

  // 1x1 transparent GIF for any remote item sprite.
  const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  const servePixel = (route) =>
    route.fulfill({ status: 200, contentType: 'image/gif', body: PIXEL });
  await page.route('https://secure.runescape.com/**', servePixel);
  await page.route('https://oldschool.runescape.wiki/**', servePixel);
}

for (const page of PAGES) {
  test(`${page} loads with no console errors`, async ({ page: browserPage }) => {
    const errors = [];
    browserPage.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    browserPage.on('pageerror', (err) => errors.push(err.message));

    await stubExternalServices(browserPage);

    await browserPage.goto(`/${page}`);
    await browserPage.waitForLoadState('networkidle');

    expect(errors, `console errors on ${page}`).toEqual([]);
  });
}
