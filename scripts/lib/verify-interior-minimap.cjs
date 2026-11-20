/* eslint-disable @typescript-eslint/no-require-imports -- Shared browser assertions. */
const assert = require('node:assert/strict');

async function assertCompactPanel(page, plan) {
  const panel = page.locator('[data-interior-floor-controls]');
  const minimap = page.locator('[data-floor-plan-minimap]');
  const restore = page.getByRole('button', { name: 'Show minimap', exact: true });
  const hide = page.getByRole('button', { name: 'Hide minimap', exact: true });
  if (await restore.isVisible()) await restore.click();
  await hide.waitFor();
  assert(await minimap.locator('[aria-haspopup="dialog"]').isHidden(), 'Compact layouts replace expand with X');
  assert.equal(await minimap.getByRole('status').count(), 0, 'No loading or pending-room messages on the minimap');
  const map = await minimap.boundingBox();
  const phone = page.viewportSize().width < 640;
  assert(map.width <= (phone ? 176 : 224) + 1);
  for (const button of await panel.locator(':scope > button, :scope > [role="combobox"]').all()) {
    const box = await button.boundingBox();
    assert(Math.abs(box.width - map.width) < 1, 'Floor/balcony controls follow the minimap width');
  }
  const back = page.getByRole('link', { name: 'Back to masterplan', exact: true });
  if (phone && await back.count()) {
    assert(await back.locator('span').isHidden(), 'Phone back button is icon-only');
    const box = await back.boundingBox();
    assert(box.width <= 44 && box.x + box.width < map.x, 'Arrow and minimap do not overlap');
    assert(Math.abs(box.y - map.y) < 1, 'Both phone controls start at the top');
  }
  const hits = await minimap.locator('[data-minimap-room-number]').evaluateAll(elements => elements.map(element => {
    const r = element.getBoundingClientRect();
    return { ref: element.dataset.minimapRoomNumber, hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('[data-minimap-room-number]')?.getAttribute('data-minimap-room-number') };
  }));
  for (const hit of hits) assert.equal(hit.hit, hit.ref, `${plan.id} POI ${hit.ref} stays independently clickable at compact size`);
  const before = await page.locator('[data-pano-node]').getAttribute('data-pano-node');
  await hide.click();
  await page.waitForFunction(() => {
    const panel = document.querySelector('[data-interior-floor-controls]');
    return panel?.getAttribute('data-hidden') === 'true' && panel.getBoundingClientRect().left >= innerWidth;
  });
  assert(await panel.isHidden(), 'Minimap and all its controls leave the screen together');
  await restore.waitFor();
  const showBox = await restore.boundingBox();
  assert(showBox.y <= 24 && showBox.x + showBox.width <= page.viewportSize().width, 'Restore stays at the top right');
  await restore.click(); await hide.waitFor();
  assert.equal(await page.locator('[data-pano-node]').getAttribute('data-pano-node'), before, 'Hiding/restoring never changes the panorama');
  assert.equal(await minimap.locator('[data-minimap-room-number]').count(), plan.markers.length);
}

async function assertSimpleExpanded(dialog) {
  assert.equal(await dialog.locator('header, aside, ol').count(), 0, 'Expanded plan has no header, sidebar or room-list containers');
  assert.equal(await dialog.getByRole('status').count(), 0);
  assert.equal(await dialog.getByRole('button', { name: /Zoom/ }).count(), 0);
  const frame = await dialog.locator('[data-numbered-plan-image]').boundingBox();
  const box = await dialog.boundingBox();
  assert(Math.abs(box.width - frame.width) < 1 && Math.abs(box.height - frame.height) < 1, 'Expanded dialog is only the map, not an outer padded card');
}

module.exports = { assertCompactPanel, assertSimpleExpanded };
