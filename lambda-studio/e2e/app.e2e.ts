import { test, expect, type Page } from '@playwright/test';

// A fresh profile would open the tutorial; skip it.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e')) {
      sessionStorage.setItem('e2e', '1');
      localStorage.setItem('lambda-studio:tutorial', JSON.stringify({ open: false }));
    }
  });
});

const editor = (page: Page) => page.locator('.cm-content').first();
const label = (page: Page) => page.locator('.tl-label');

async function setSource(page: Page, text: string) {
  await editor(page).click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(text);
  await page.locator('.cm-editor').first().evaluate((el) => (el as HTMLElement).blur());
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  // the editor commits after a short pause: wait until the store has the new source
  await page.waitForFunction((want) => (window as any).__store?.getState().source === want, text);
}

/** The app's store, for checks the page does not show (dev server only). */
async function exposeStore(page: Page) {
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/src\/ui\/store\.ts(\?t=|$)/.test(n))!;
    (window as any).__store = (await import(/* @vite-ignore */ url)).useStore;
  });
}

async function open(page: Page, path = '/') {
  await page.goto(path);
  await expect(label(page)).toBeVisible();
  await exposeStore(page);
}

test('keyboard shortcuts act only outside text fields', async ({ page }) => {
  await open(page);
  await setSource(page, 'PLUS 1 2');
  await expect(label(page)).toHaveText('step 0 / 0');

  // in a text field: Alt+→ neither steps nor goes Back, and ? is typed, not the help
  const field = page.getByRole('textbox', { name: 'Value' });
  await field.click();
  await page.keyboard.press('Alt+ArrowRight');
  await page.keyboard.press('Alt+ArrowLeft');
  await page.keyboard.type('?');
  await expect(label(page)).toHaveText('step 0 / 0');
  await expect(page.locator('dialog.help-dialog[open]')).toHaveCount(0);
  await expect(field).toHaveValue(/\?$/);
  expect(new URL(page.url()).pathname).toBe('/');

  // in the source editor, Alt+→ steps the text just typed (the editor commits it first)
  await editor(page).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.insertText(' ');
  await page.keyboard.press('Alt+ArrowRight');
  await expect(label(page)).toHaveText('step 1 / 1');
  await setSource(page, 'PLUS 1 2');

  // outside: Alt+→ steps, Alt+← goes back, ? opens the help, Esc closes it
  await page.keyboard.press('Alt+ArrowRight');
  await expect(label(page)).toHaveText('step 1 / 1');
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(label(page)).toHaveText('step 0 / 1');
  await page.keyboard.press('?');
  await expect(page.locator('dialog.help-dialog[open]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog.help-dialog[open]')).toHaveCount(0);
});

test('a share link opens the same source in a new browser', async ({ page, context, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page);
  const src = 'TWICE = λf x.f (f x)\nTWICE SUCC 3';
  await setSource(page, src);
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Copy share link' }).click();
  await expect(page.getByText('Share link copied')).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toMatch(/#[sz]=/);

  // a new profile, as for someone the link was sent to
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(url);
  await expect(p2.getByText('Opened a shared link.')).toBeVisible();
  await expect(editor(p2)).toContainText('TWICE = λf x.f (f x)');
  await expect(editor(p2)).toContainText('TWICE SUCC 3');
  expect(p2.url()).not.toContain('#'); // the snapshot is not left in the address bar
  // and no tutorial over it
  await expect(p2.locator('.tutorial[open], dialog.tutorial[open]')).toHaveCount(0);
  await other.close();
});

test('stepping during a run keeps the timeline consistent', async ({ page }) => {
  await open(page);
  await setSource(page, 'FACT 4');
  await page.getByRole('button', { name: /^Reduce to normal form/ }).click();
  await page.keyboard.press('Alt+ArrowRight');
  await page.keyboard.press('Alt+ArrowRight');
  await page.keyboard.press('Alt+ArrowLeft');
  await page.waitForFunction(() => { const s = (window as any).__store.getState(); return !s.running && s.history.length > 10; }, null, { timeout: 30_000 });
  await expect(label(page)).toHaveText(/^step (\d+) \/ \1$/);

  // every entry is one step on from the one before: no entry repeats an earlier one
  const report = await page.evaluate(async () => {
    const term = await import(/* @vite-ignore */ location.origin + '/src/core/term.ts');
    const h = (window as any).__store.getState().history as { term: unknown }[];
    const seen = new Map<number, number>();
    let repeat: [number, number] | null = null;
    h.forEach((e, i) => {
      const k = term.hash(e.term);
      if (seen.has(k) && term.equal(h[seen.get(k)!].term, e.term) && !repeat) repeat = [seen.get(k)!, i];
      seen.set(k, i);
    });
    return { length: h.length, repeat };
  });
  expect(report.length).toBeGreaterThan(10);
  expect(report.repeat).toBeNull();
  await expect(page.getByText(/normal form/i).first()).toBeVisible();
});
