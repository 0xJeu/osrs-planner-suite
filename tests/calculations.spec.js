const { test, expect } = require('@playwright/test');

async function stubWikiPrices(page, data = {}) {
  await page.route('https://prices.runescape.wiki/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/mapping')) {
      await route.fulfill({ json: [] });
      return;
    }
    await route.fulfill({ json: { data } });
  });
}

const TAX_PAGES = [
  'osrs-ge-tracker.html',
  'osrs-skill-profit.html',
  'osrs-farming-planner.html',
  'osrs-herblore-planner.html',
  'osrs-prayer-planner.html',
];

for (const toolPage of TAX_PAGES) {
  test(`${toolPage}: applies the current 2% GE tax per item with the 5m cap`, async ({ page }) => {
    await stubWikiPrices(page);
    await page.goto(`/${toolPage}`);

    const values = await page.evaluate(() => ({
      tax: [0, 49, 50, 100, 250_000_000, 300_000_000].map(geTax),
      net: [49, 50, 100, 300_000_000].map(afterGeTax),
    }));

    expect(values.tax).toEqual([0, 0, 1, 2, 5_000_000, 5_000_000]);
    expect(values.net).toEqual([49, 49, 98, 295_000_000]);
  });
}

test('GE Tracker: reverse calculator finds the minimum gross sale price after tax', async ({ page }) => {
  await stubWikiPrices(page);
  await page.goto('/osrs-ge-tracker.html');

  const results = await page.evaluate(() => [49, 50, 98, 245_000_000, 300_000_000].map(net => {
    const gross = grossSellPriceForNet(net);
    return { net, gross, received: afterGeTax(gross), previous: gross > 0 ? afterGeTax(gross - 1) : -1 };
  }));

  for (const result of results) {
    expect(result.received).toBeGreaterThanOrEqual(result.net);
    expect(result.previous).toBeLessThan(result.net);
  }
});

test('Skill Profit: buys at high, sells at low after tax, and respects quantities', async ({ page }) => {
  await stubWikiPrices(page);
  await page.goto('/osrs-skill-profit.html');

  const result = await page.evaluate(() => {
    priceBasis = 'spot';
    prices = {
      '1': { high: 120, low: 100 },
      '2': { high: 60, low: 50 },
    };
    return calcItem({
      name: 'Fixture', xp: 25, actionsPerHr: 100,
      inputs: [{ id: '1', qty: 2 }],
      output: { id: '2', qty: 3 },
    });
  });

  expect(result.inputCost).toBe(240);
  expect(result.outputRev).toBe(147);
  expect(result.profit).toBe(-93);
  expect(result.gpxp).toBeCloseTo(-3.72, 10);
  expect(result.xpHr).toBe(2500);
  expect(result.gpHr).toBe(-9300);
});

test('Skill Profit: averaged prices preserve high/low semantics and fall back to spot', async ({ page }) => {
  await stubWikiPrices(page);
  await page.goto('/osrs-skill-profit.html');

  const values = await page.evaluate(() => {
    priceBasis = '1h';
    prices = {'1': { high: 120, low: 100 }, '2': { high: 80, low: 70 }};
    avgPrices = {'1': { high: 130, low: 90 }};
    return {
      averagedBuy: buyPrice('1'),
      averagedNetSell: sellPrice('1'),
      fallbackBuy: buyPrice('2'),
      fallbackNetSell: sellPrice('2'),
    };
  });

  expect(values).toEqual({ averagedBuy: 130, averagedNetSell: 89, fallbackBuy: 80, fallbackNetSell: 69 });
});

for (const toolPage of [
  'osrs-training-planner.html',
  'osrs-farming-planner.html',
  'osrs-herblore-planner.html',
  'osrs-prayer-planner.html',
]) {
  test(`${toolPage}: uses exact OSRS XP thresholds`, async ({ page }) => {
    await stubWikiPrices(page);
    await page.goto(`/${toolPage}`);
    const values = await page.evaluate(() => ({
      thresholds: [1, 2, 50, 99].map(xpForLevel),
      levels: [0, 82, 83, 101_332, 101_333, 13_034_431].map(levelForXp),
    }));
    expect(values.thresholds).toEqual([0, 83, 101_333, 13_034_431]);
    expect(values.levels).toEqual([1, 1, 2, 49, 50, 99]);
  });
}

test('Construction: honors partial current-level XP and rounds furniture actions before materials', async ({ page }) => {
  await stubWikiPrices(page);
  await page.goto('/osrs-training-planner.html');

  const stop = await page.evaluate(() => {
    plankPrices = {'960': { high: 500, low: 450 }};
    return buildRoute(1, 2, 'fastest', 57)[0];
  });

  expect(stop.xpNeeded).toBe(26);
  expect(stop.actionsNeeded).toBe(1);
  expect(stop.planksNeeded).toBe(2);
  expect(stop.plankUnitPrice).toBe(500);
  expect(stop.totalCost).toBe(1000);
  expect(stop.butlerTrips).toBe(1);
  expect(stop.totalWithButler).toBe(2250);
});

test('Herblore: partial XP, four-secondary recipes, output tax, and action rounding compose correctly', async ({ page }) => {
  await stubWikiPrices(page);
  await page.goto('/osrs-herblore-planner.html');

  const result = await page.evaluate(() => {
    nameToId = {
      'antifire potion(4)': '1',
      'lava scale shard': '2',
      'extended antifire(4)': '3',
    };
    prices = {
      '1': { high: 1000, low: 900 },
      '2': { high: 100, low: 90 },
      '3': { high: 2100, low: 2000 },
    };
    pricesLoaded = true;
    const startingXp = xpForLevel(84) + 55;
    const stop = buildRoute(84, 85, 'budget', startingXp)[0];
    return { stop, expectedActions: Math.ceil((xpForLevel(85) - startingXp) / 110) };
  });

  expect(result.stop.xpNeeded).toBe(307_166);
  expect(result.stop.actionsNeeded).toBe(result.expectedActions);
  expect(result.stop.totalCost).toBe((1400 - 1960) * result.expectedActions);
});

test('Prayer: Chaos Altar models 350% XP and 50% average bone consumption independently', async ({ page }) => {
  await stubWikiPrices(page);
  await page.goto('/osrs-prayer-planner.html');

  const result = await page.evaluate(() => {
    nameToId = {'dragon bones': '1'};
    prices = {'1': { high: 1000, low: 900 }};
    const bone = BONES.find(item => item.name === 'Dragon bones');
    return boneEconomics(bone, { multiplierPct: 350, consumeChance: 0.5, offeringsPerHr: 1200 });
  });

  expect(result.perOffering).toBe(252);
  expect(result.xpPerBoneOwned).toBe(504);
  expect(result.costPerBone).toBe(1000);
  expect(result.gpPerXp).toBeCloseTo(1000 / 504, 10);
  expect(result.xpPerHr).toBe(302_400);
});

test('Farming: herb revenue uses instant-sell price after GE tax', async ({ page }) => {
  await stubWikiPrices(page);
  await page.goto('/osrs-farming-planner.html');

  const net = await page.evaluate(() => {
    nameToId = {'grimy ranarr weed': '1'};
    prices = {'1': { high: 120, low: 100 }};
    return sellPriceOf('Grimy ranarr weed');
  });

  expect(net).toBe(98);
});
