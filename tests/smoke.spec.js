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

for (const page of PAGES) {
  test(`${page} loads with no console errors`, async ({ page: browserPage }) => {
    const errors = [];
    browserPage.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    browserPage.on('pageerror', (err) => errors.push(err.message));

    await browserPage.goto(`/${page}`);
    await browserPage.waitForLoadState('networkidle');

    expect(errors, `console errors on ${page}`).toEqual([]);
  });
}
