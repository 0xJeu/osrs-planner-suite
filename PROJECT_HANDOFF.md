# OSRS Tool Suite — Project Handoff Document
**For a new Claude instance to fully understand this codebase**

---

## Overview

George is building a personal OSRS (Old School RuneScape) tool suite as a collection of standalone HTML files — no backend, no framework, just self-contained HTML/CSS/JS pages that open directly in a browser from a local folder. All files must stay in the same folder so navigation links work.

The development has been ongoing across multiple sessions. George's stack is pure vanilla HTML/CSS/JS. All pages share a consistent dark-mode design language with a gold accent color system.

---

## The 5 Files

| File | Purpose | Lines |
|------|---------|-------|
| `osrs-ge-tracker.html` | Grand Exchange price tracker | ~2,110 |
| `osrs-skill-profit.html` | Skill profit calculator | ~900 |
| `osrs-training-planner.html` | Construction training planner | ~726 |
| `osrs-farming-planner.html` | Farming training planner | ~1,798 |
| `osrs-herblore-planner.html` | Herblore training planner | ~973 |

---

## Live Price API

All price data comes from the **RuneScape Wiki prices API** (NOT the official Jagex API, which has CORS issues):

```js
const WIKI_MAPPING = 'https://prices.runescape.wiki/api/v1/osrs/mapping';
const WIKI_LATEST = 'https://prices.runescape.wiki/api/v1/osrs/latest';
```

**CRITICAL KNOWN BUG (already fixed):** Item IDs must be stored as **strings** when building `nameToId`, because `Object.entries(priceData.data)` returns string keys:
```js
// CORRECT:
mapData.forEach(i => { nameToId[i.name.toLowerCase()] = String(i.id); });
// WRONG (was causing all price lookups to silently return 0):
mapData.forEach(i => { nameToId[i.name.toLowerCase()] = i.id; }); // number vs string mismatch!
```

**User-Agent header:** the prices API *does* accept one — verified 2026-09-23, its preflight answers `204` with `access-control-allow-headers: user-agent` and caches that approval for 24h (`access-control-max-age: 86400`). The wiki actually asks callers to identify themselves, so `osrs-ge-tracker.html`'s `H` header is fine. (An earlier version of this line said browsers block it and cause silent CORS failures; that was wrong.) The real cost is that a non-safelisted header forces a preflight **per distinct URL** — negligible for the fixed `/latest` URL, but it doubles the request count for anything that walks many URLs, like the `/5m?timestamp=` backfill.

**GE Tax:** `sellPriceOf()` deducts 1% GE tax: `Math.min(5000000, Math.max(1, Math.floor(price * 0.01)))`.

**Price direction:** In the prices API:
- `high` = instant buy price (what buyers pay) — use when calculating ingredient costs
- `low` = instant sell price (what sellers receive) — use when calculating sell revenue, then deduct 1% tax

**Icons — bundle anything you can enumerate; never hotlink it.** Nav, skill, account-badge, sapling, seed, coin, and checkbox icons are committed under `icons/` and referenced by relative path (`icons/Farming_icon.png`). Every page and `suite-nav.js` used to hotlink these from `oldschool.runescape.wiki/images/`, costing the wiki a request per icon per page view; one checkbox icon (`Myths_Guild.png`) was a 1500×1000, 508 KB scene render shown at 24px. To add one: download it once, downscale to ~2× its rendered size, give it a plain ASCII filename (no `%`-encoding — the `src` and the file on disk must agree), commit it.

Don't derive icon filenames from display names — look them up. Herb seeds are the cautionary tale: the planner calls a herb "Ranarr weed" but the seed item is "Ranarr seed" and its file is `Ranarr_seed_5.png`, so a `${name}_seed.png` template 404'd on all fourteen herbs.

Only **data-driven** item icons — names that come from the mapping API at runtime for whatever items a plan contains — still load from the wiki, since they can't be pre-bundled. Use the mapping API's `icon` field, not item IDs, and give the `<img>` `loading="lazy"`:
```js
nameToIcon[i.name.toLowerCase()] = i.icon; // e.g. "Varrock teleport.png"
// URL: https://oldschool.runescape.wiki/images/{filename.replace(/ /g,'_')}
```

**Teleport tablet name trick:** GE mapping uses `"Varrock teleport (tablet)"` not `"Varrock teleport"`. Resolve with `(tablet)` fallback:
```js
function resolveItemIcon(name) {
  const key = name.toLowerCase();
  if (HARDCODED_ITEM_ICONS[key]) return HARDCODED_ITEM_ICONS[key];
  if (nameToIcon[key]) return nameToIcon[key];
  const tabletKey = `${key} (tablet)`;
  if (nameToIcon[tabletKey]) return nameToIcon[tabletKey];
  return null;
}
```

**Hardcoded fallbacks** for items not on the GE (e.g. Coins, Digsite pendant):
```js
const HARDCODED_ITEM_IDS = { 'coins': 995, 'spade': 952, 'rake': 5341, 'digsite pendant': 11194, 'teleport crystal': 6102 };
const HARDCODED_ITEM_ICONS = { 'spade': 'Spade.png', 'rake': 'Rake.png', 'digsite pendant': 'Digsite_pendant.png', 'teleport crystal': 'Teleport_crystal_(1).png' };
```

---

## Design System

```css
:root {
  --bg: #0d0f14;
  --surface: #141720;
  --surface2: #1b1f2e;
  --border: #252a3a;
  --gold: #c8a84b;
  --gold-dim: #8a7030;
  --green: #2ecc71;
  --red: #e74c3c;
  --blue: #4a7eff;
  --purple: #9b6fd6;
  --text: #dde1ec;
  --text-dim: #6b7490;
}
```

Light mode is toggled with `[data-theme="light"]` on `<html>`. Each page has a 🌙/☀️ toggle button.

**Fonts:** Google Fonts — `Share Tech Mono` (monospace numbers), `Barlow Condensed` (headers), `Barlow` (body).

---

## GE Tracker (`osrs-ge-tracker.html`)

Personal Grand Exchange price tracker. Features:
- Add/remove items to a watchlist by name
- Live prices from the Wiki API
- Shows high, low, margin, volume
- Persists watchlist in localStorage

---

## Skill Profit Calculator (`osrs-skill-profit.html`)

Shows profit/loss per XP for various skilling methods. Features:
- Live GE prices for all materials
- Filters by skill, sort by GP/XP
- Had the same `String(i.id)` price bug — now fixed

---

## Construction Planner (`osrs-training-planner.html`)

Standard training planner format. Speed tiers, XP table, cost per method.

---

## Farming Planner (`osrs-farming-planner.html`) — Most Complex File

### Key Features
1. **Patch Settings panel** — gear icon (⚙️) header, collapsible, patches grouped by type. Tracks which patches are unlocked (some gated by quests/diaries).

2. **Run Options bar** — three global toggles:
   - 💰 Pay for protection (gardener payments vs ultracompost only)
   - 🌿 Include herb runs
   - 📜 Use tele tabs (vs runes)

3. **Budget Tier tabs** — Expensive / Balanced / Cheap / Custom

4. **Inventory mockup** — pixel-exact OSRS inventory panel:
   - Background: `#3e3529` (pixel-sampled from real OSRS screenshot)
   - Border: `#4f4836`
   - Always 28 slots (4×7 grid)
   - Items link to OSRS wiki on click
   - **Saplings are unstackable** — use `addUnstackedSlots()` which gives each sapling its own slot entry with a `#index` suffix key
   - **Payment items render as "noted"** (CSS parchment overlay via `::before` pseudo-element)
   - Stack quantities shown in yellow (`#ffff00`) with black text-shadow, OSRS-style format (123K, 1.5M)
   - Coins use denomination-specific sprites via `coinIconFor(qty)` function

5. **Route guide** — step-by-step run directions per track. Each waypoint has:
   ```js
   { patch:'Varrock', teleport:'Varrock Teleport', tabItem:'Varrock teleport', runeItems:[{name:'Law rune',qty:1},{name:'Air rune',qty:3},{name:'Fire rune',qty:1}], directions:'...', itemOnly:null }
   ```
   - `tabItem` = exact GE item name for the tablet
   - `runeItems` = array of {name, qty} for rune-cast equivalent
   - `itemOnly` = items with no tab/rune choice (Ectophial, Digsite pendant, etc.)
   - The global tabs toggle switches which version shows

6. **Item checklist** — next to each inventory, a list of all items + quantities needed

7. **Bank tag export** — two copy buttons per inventory section:
   - "Copy for Import tag tab": `tagname,iconId,itemId1,itemId2,...`
   - "Copy for Import tag tab with layout": `banktaglayoutsplugin:tagname,itemId:slotIndex,itemId:slotIndex,...`
   - Uses `navigator.clipboard.writeText()` with `execCommand` fallback
   - Button shows ✓ Copied! feedback for 1.5 seconds

8. **Target level cost estimate** — projects daily XP/cost forward to target level

### Tree Data Structure
```js
const REGULAR_TREES = [
  { level:75, name:'Magic', plantXp:145.5, checkXp:13768.3, growMin:480,
    payItem:'Coconut', payQty:25, seedName:'Magic sapling' }, // seedName = SAPLING name
];
```
Note: `seedName` is the sapling name (e.g. "Magic sapling"), NOT the seed name. Players plant saplings, not raw seeds.

### Payment item names (exact GE names):
- Regular trees: `'Basket of tomatoes'`, `'Basket of apples'`, `'Basket of oranges'`, `'Cactus spine'`, `'Coconut'`
- Fruit trees: `'Sweetcorn'`, `'Basket of strawberries'`, `'Basket of bananas'`, `'Watermelon'`, `'Pineapple'`, `'Papaya fruit'`
- Hardwood trees: `'Limpwurt root'`, `'Yanillian hops'`
- Herbs: Always Ultracompost (no gardener option for herbs)

### Route arrays — all 5 defined:
- `REGULAR_TREE_ROUTE` — 6 patches (Lumbridge, Varrock, Falador, Taverley, Gnome Stronghold, Farming Guild)
- `FRUIT_TREE_ROUTE` — 6 patches
- `HARDWOOD_ROUTE` — 3 patches (Fossil Island via Digsite pendant + Anglers + Varlamore)
- `COMBINED_FRUIT_HARDWOOD_ROUTE` — geographically chained (avoids doubling back)
- `HERB_ROUTE` — 10 patches

### Coin clearing fees:
- Regular/fruit/hardwood: 200 gp per patch (pay gardener to instantly clear a dead tree)
- Redwood specifically: 2,000 gp
- Scaled by actual patch count in the plan

---

## Herblore Planner (`osrs-herblore-planner.html`)

### Key Features

1. **4 Named Routes** (not just "fast/medium/slow"):
   - **Nuclear** — max XP/hr, ends on Menaphite remedy (200 XP each, level 88, highest XP standard potion in game)
   - **Standard** — prayer potions → super restores → Saradomin brews through 99; simple 14+14 inventories
   - **Live Value** — dynamically compares practical unlocked potion methods using current GE prices and selects the lowest net GP/XP at each unlock point
   - **Budget** — herb cleaning → prayer potions → super restores → extended antifire 84 → super combat 90; super combats live only here because their low GP/XP can justify the inventory-heavy method

2. **Mastering Mixology tab** — completely separate mode (not a standard route):
   - Requires level 60 + Children of the Sun quest, level 81 for full efficiency (Mixalot)
   - Three paste types: Mox (low herbs), Aga (high herbs), Lye (mid herbs)
   - Cheapest herbs per type: Marrentill→Mox (13 paste/herb), Lantadyme→Aga (40 paste/herb), Avantoe→Lye (30 paste/herb)
   - XP: ~70k/hr active, ~45k/hr passive at 81+
   - Cost model: only herb cost, no sell-back (paste non-tradeable)
   - Shows all 10 potion recipes, herb comparison table, rewards guide
   - Digweed mechanic: spawns ~every 7 min at 81+, always use on Mixalot

3. **Cost display** — two separate numbers shown everywhere:
   - **Upfront Capital** — total GP needed in bank before starting (can be 500M+ for super combat route)
   - **Net Cost (after selling)** — what you actually spend after selling all finished potions (often much lower)
   - These are very different numbers. Players need to understand both.

4. **GE Tax** — 1% deducted from every sell price in `sellPriceOf()`

5. **Shopping list** — collapsible, per-stop breakdown + grand total with sell credit rows

6. **GP/XP metric** — shown prominently in summary bar since it's the true comparison metric between routes (total cost comparisons are misleading because slower methods need more potions for the same XP)

### Verified XP per potion (from OSRS Wiki):
- Attack: 25, Prayer: 87.5, Super attack: 100, Super energy: 117.5, Super strength: 125
- Super restore: 142.5, Saradomin brew: 180, Ancient brew: 190, Menaphite remedy: 200
- Extended antifire: 110, Stamina: 25.5 per dose (76.5 for the planner's 3-dose recipe), Ranging: 162.5
- Super combat: 150 (NOT stackable — Torstol takes its own inventory slot)

### Actions per hour (from Wiki):
- Standard 14+14 inventory: 2,500/hr
- Stackable secondary (stamina, extended antifire): 2,750/hr
- Super combat (7 per inventory, Torstol NOT stackable): **2,166/hr** (NOT 2,400 — wiki confirmed via XP/hr column)

### Input names supporting quantity multipliers:
```js
inputNames: ['Antifire potion(4)', {name:'Lava scale shard', qty:4}]
// Extended antifire needs 4x lava scale shards per potion
inputNames: ['Super energy(3)', {name:'Amylase crystal', qty:3}]
// Stamina conversion is dose-for-dose: a 3-dose potion needs 3 crystals
```

The `inCost` formula handles both string and `{name, qty}` object inputs:
```js
const inCost = (method.inputNames||[]).reduce((sum,n)=>{
  const itemName = typeof n === 'string' ? n : n.name;
  const qty = typeof n === 'object' && n.qty ? n.qty : 1;
  return sum + (priceOf(itemName)||0) * qty;
}, 0);
```

---

## Known Remaining Issues / Backlog

1. **Bank tag import format** needs real-world testing. Two formats are offered:
   - Plain: `tagname,iconId,itemId1,itemId2,...` — use "Import tag tab"
   - Layout: `banktaglayoutsplugin:tagname,itemId:slotIndex,...` — use "Import tag tab with layout" (requires Bank Tag Layouts plugin)
   
2. **Mastering Mixology herb costs** — paste-per-herb yield values and gp/paste figures are from the wiki but should be verified against live prices since they fluctuate.

3. **Smithing and Fletching** planners are stubbed as "Soon" in the sidebar nav.

4. **Farming planner bank tags** — some items (notably Digsite pendant, Teleport crystal) are hardcoded since they're untradeable or charge-suffixed.

5. **Super combat decanting** — the wiki calculator assumes super attack/str/def(4) potions are decanted from 3-dose before combining. Our planner uses (4) dose inputs which is correct for buying pre-made but may differ from players who make their own.

---

## Dev Team (in-universe characters George created)
- 🔴 **Rex** — Lead Dev
- 🔵 **Dex** — QA/Debugger  
- 🟡 **Vex** — Creative Director
- 🟢 **Hex** — Product/Ideas

---

## George's Context
- Medical transport driver, music producer (Logic Pro, alternative pop)
- OSRS player interested in GE flipping and skill optimization
- Has the MediLog app (trip tracking PWA deployed to Netlify) as a separate project
- Prefers dark UIs, practical tools, and accurate data over pretty demos
