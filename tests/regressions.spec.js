const { test, expect } = require('@playwright/test');

/**
 * Stub for Wise Old Man, which these tests used to call for real.
 *
 * WOM is a free, volunteer-run community service. Firing live player lookups at it on
 * every `npm test` is load they absorb for nothing, and it made the suite non-deterministic
 * in the worst way: a run that tripped their rate limiter came back HTTP 429 and failed
 * tests that had nothing to do with the change being tested. (That is not hypothetical -
 * it is how this stub came to be written.)
 *
 * The fixture is deliberately shaped to exercise the pluralization edge case the first
 * test is actually about: one group with exactly one member.
 */
const WOM_PLAYER = {
  username: 'zezima',
  displayName: 'Zezima',
  type: 'regular',
  latestSnapshot: { data: { skills: {}, bosses: {}, activities: {} } },
};

const WOM_GROUPS = [
  { role: 'member', group: { id: 1, name: 'Solo Clan', memberCount: 1, verified: false } },
  { role: 'administrator', group: { id: 2, name: 'Big Clan', memberCount: 250, verified: true } },
];

async function stubWiseOldMan(page) {
  await page.route('https://api.wiseoldman.net/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/groups')) {
      await route.fulfill({ json: WOM_GROUPS });
      return;
    }
    await route.fulfill({ json: WOM_PLAYER });
  });
}

test('index.html: WOM group member count is pluralized correctly', async ({ page }) => {
  await stubWiseOldMan(page);
  await page.goto('/index.html');
  await page.fill('#statsUsername', 'Zezima');
  await page.click('#statsLookupBtn');
  await expect(page.locator('#statsStatus')).toContainText('Loaded', { timeout: 15000 });

  const text = await page.locator('.clan-list').innerText();
  expect(text).not.toMatch(/\b1 members\b/);
});

test('index.html: player lookup links out to the correct RuneProfile page', async ({ page }) => {
  await stubWiseOldMan(page);
  await page.goto('/index.html');
  await page.fill('#statsUsername', 'Zezima');
  await page.click('#statsLookupBtn');
  await expect(page.locator('#statsStatus')).toContainText('Loaded', { timeout: 15000 });

  const link = page.locator('.runeprofile-link');
  await expect(link).toHaveAttribute('href', 'https://www.runeprofile.com/zezima');
  await expect(link).toHaveAttribute('target', '_blank');
});

test('farming planner: Oak tree bank tag export does not skip Basket of tomatoes', async ({ page }) => {
  await page.goto('/osrs-farming-planner.html');
  await expect(page.locator('body')).toContainText('Live prices loaded', { timeout: 15000 });

  // Expand to the Oak tree run's inventory/export panel.
  await page.getByText('Step-by-Step Run Guide', { exact: false }).click();
  await page.getByText('Regular Tree Run', { exact: false }).click();

  const copyButtons = page.locator('text=Copy — "Import tag tab"');
  await expect(copyButtons.first()).not.toContainText('item skipped');
});

const TOOL_PAGES = [
  'osrs-ge-tracker.html',
  'osrs-skill-profit.html',
  'osrs-training-planner.html',
  'osrs-farming-planner.html',
  'osrs-herblore-planner.html',
  'osrs-prayer-planner.html',
];

for (const toolPage of TOOL_PAGES) {
  test(`${toolPage}: header logo links back to index.html`, async ({ page }) => {
    await page.goto(`/${toolPage}`);
    await expect(page.locator('a.logo')).toHaveAttribute('href', 'index.html');
  });
}

const EXPECTED_ACTIVE_NAV_LABEL = {
  'osrs-ge-tracker.html': 'GE Tracker',
  'osrs-skill-profit.html': 'Skill Profits',
  'osrs-training-planner.html': 'Construction',
  'osrs-farming-planner.html': 'Farming',
  'osrs-herblore-planner.html': 'Herblore',
  'osrs-prayer-planner.html': 'Prayer',
};
const ALL_NAV_LABELS = ['GE Tracker', 'Skill Profits', 'Construction', 'Farming', 'Herblore', 'Prayer', 'Smithing', 'Fletching', 'Cooking', 'Crafting'];

for (const toolPage of TOOL_PAGES) {
  test(`${toolPage}: standardized sidebar nav has the full tool list with the right item active`, async ({ page }) => {
    await page.goto(`/${toolPage}`);
    await expect(page.locator('.skill-nav-title')).toHaveText('OSRS Tools');

    const labels = await page.locator('.skill-nav .skill-btn').allInnerTexts();
    for (const label of ALL_NAV_LABELS) {
      expect(labels.some(l => l.includes(label))).toBe(true);
    }

    const active = page.locator('.skill-nav .skill-btn.active');
    await expect(active).toHaveCount(1);
    await expect(active).toContainText(EXPECTED_ACTIVE_NAV_LABEL[toolPage]);
  });
}

// A saved WOM username (set by visiting any page, or index.html's own lookup) previously only
// pre-filled the username field on these 4 planners — the actual level/XP never re-fetched until
// the user manually clicked "Fetch Stats" again, so it looked like nothing carried over between
// pages. Match on "Loaded" or "⚠" (a real API error, e.g. an unranked skill) rather than exact
// numbers, since this hits the live Wise Old Man API and stats/rankings can change over time.
const WOM_AUTOFETCH_STATUS_SELECTOR = {
  'osrs-training-planner.html': '#fetchStatus',
  'osrs-farming-planner.html': '#womStatus',
  'osrs-herblore-planner.html': '#womStatus',
  'osrs-prayer-planner.html': '#womStatus',
};

for (const [toolPage, statusSelector] of Object.entries(WOM_AUTOFETCH_STATUS_SELECTOR)) {
  test(`${toolPage}: auto-fetches WOM stats on load when a username is already saved`, async ({ page }) => {
    await stubWiseOldMan(page);
    await page.goto(`/${toolPage}`);
    await page.evaluate(() => localStorage.setItem('osrs_wom_username', 'Zezima'));
    await page.reload();
    await expect(page.locator(statusSelector)).toContainText(/Loaded|⚠/, { timeout: 15000 });
  });
}
