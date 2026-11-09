const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true });
  const account = { id: 'icons-one', email: 'icons@example.test', provider: 'google', reconnect: false, gmail_modify: true };
  const message = { id: 'icons-message', account_id: account.id, recipient: account.email, sender: 'Sender <sender@example.test>', subject: 'Icon regression', snippet: 'Fictional message', received: '2026-11-08T10:00:00Z', unread: false, url: '' };
  try {
    for (const [width, height] of [[1920,1080],[1440,900],[1024,768],[768,1024],[390,844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/accounts') return route.fulfill({ json: [account] });
        if (path.startsWith('/api/inbox/')) return route.fulfill({ json: { messages: [message], errors: [], next_cursors: {}, limited_accounts: [] } });
        if (path.startsWith('/api/message/')) return route.fulfill({ json: { ...message, body: 'Fictional body' } });
        throw new Error('Unexpected API request: ' + path);
      });
      await page.goto('http://127.0.0.1:4175');
      await page.locator('.au-mail-row').waitFor();
      const logo = page.locator('.au-logo-mark img');
      assert.equal(await logo.count(), 1, 'rail must use supplied logo, not a glyph');
      assert(await logo.evaluate(img => img.complete && img.naturalWidth > 0), 'logo must load');
      const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
      const response = await page.request.get(new URL(favicon, page.url()).href);
      assert.equal(response.status(), 200, 'favicon must be served');
      assert.match(response.headers()['content-type'], /image\/svg\+xml/);
      const gear = page.locator('.au-rail').getByRole('button', { name: 'Pengaturan', exact: true });
      const mobile = page.locator('.au-mobile-bottom').getByRole('button', { name: 'Setelan', exact: true });
      assert.equal(Number(await gear.isVisible()) + Number(await mobile.isVisible()), 1);
      if (width <= 1110) await page.getByTitle('Buka menu').click();
      for (const button of await page.locator('.au-nav-item').all()) {
        const icon = await button.locator('svg').boundingBox();
        assert(icon && icon.width === 18 && icon.height === 18, 'folder icons must remain 18px squares');
      }
      await page.locator('.au-sidebar-account').click();
      if (width <= 1110) await page.getByTitle('Buka menu').click();
      assert.equal(await page.locator('.au-sidebar-account').getAttribute('aria-current'), 'page', 'account switching retains selected state');
      if (width <= 1110) await page.locator('.au-sidebar-close').click();
      const settings = await gear.isVisible() ? gear : mobile;
      await page.keyboard.press('Tab');
      await settings.focus();
      assert.equal(await settings.evaluate(el => getComputedStyle(el).outlineStyle), 'solid', 'keyboard focus visible');
      assert((await settings.boundingBox()).height >= 40, 'Settings touch target');
      assert.equal(await settings.getAttribute('title'), width <= 660 ? 'Setelan' : 'Pengaturan');
      await settings.click();
      assert.equal(await settings.getAttribute('aria-current'), 'page');
      await page.getByRole('heading', { name: 'Pengaturan', exact: true }).waitFor();
      if (await gear.isVisible()) await gear.click(); else await page.locator('.au-mobile-bottom').getByRole('button', { name: 'Inbox', exact: true }).click();
      await page.locator('.au-mail-row').click();
      await page.getByText('Fictional body', { exact: true }).waitFor();
      for (const icon of await page.locator('.au-reader-tools svg').all()) {
        const size = await icon.boundingBox();
        assert(size && size.width >= 17 && size.width <= 19, 'toolbar icons must not shrink');
      }
      assert(await page.locator('.au-reader-tools button').evaluateAll(buttons => buttons.every(button => [...button.children].filter(child => getComputedStyle(child).display !== 'none').every(child => { const b = button.getBoundingClientRect(), c = child.getBoundingClientRect(); return c.left >= b.left && c.right <= b.right; }))), 'toolbar labels and icons must stay inside their buttons');
      const unnamed = await page.locator('button:visible').evaluateAll(buttons => buttons.filter(b => !b.textContent.trim() && !b.getAttribute('aria-label') && !b.title).length);
      assert.equal(unnamed, 0, 'all icon-only buttons must have names');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width} page overflow`);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await settings.evaluate(el => getComputedStyle(el).transitionDuration), '0s');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `/tmp/aurora-icons-${width}.png` });
      await page.close();
    }
    console.log('Icon sizing, logo/favicon, focus, Settings, account switching: five viewports passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
