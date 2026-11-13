const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true });
  const account = { id: 'fictional', email: 'sample@example.test', provider: 'google', reconnect: false, gmail_modify: null };
  const message = { id: 'm', account_id: account.id, recipient: account.email, sender: 'Alya <alya@example.test>', subject: 'Review desain', snippet: 'Catatan pekerjaan hari ini.', received: '2026-11-06T10:00:00Z', unread: false, url: '' };
  try {
    for (const [width, height] of [[1920, 1080], [1440, 900], [1024, 768], [768, 1024], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/settings') return route.fulfill({ json: { ai: { model: 'claude-opus-5-5', enabled: false, key_configured: false }, appearance: route.request().postDataJSON()?.appearance || null } });
        if (url.pathname === '/api/accounts') return route.fulfill({ json: [account] });
        if (url.pathname.startsWith('/api/inbox/')) return route.fulfill({ json: { messages: Array.from({ length: 69 }, (_, i) => ({ ...message, id: `m-${i}`, subject: `Review desain ${i}` })), errors: [], next_cursors: {}, limited_accounts: [] } });
        if (url.pathname.startsWith('/api/message/')) return route.fulfill({ json: { sender: message.sender, recipient: message.recipient, subject: message.subject, received: message.received, body: 'Isi email uji.', url: '' } });
        throw Error('Unexpected API: ' + url.pathname);
      });
      await page.goto('http://127.0.0.1:4175');
      await page.locator('.au-mail-row').first().waitFor();
      const avatar = await page.locator('.au-mail-row .au-avatar').first().boundingBox();
      assert(avatar && avatar.width >= 30 && avatar.height >= 30 && Math.abs(avatar.width - avatar.height) <= 1, `${width} inbox avatar must stay square: ${JSON.stringify(avatar)}`);
      const scroll = page.locator('.au-messages-scroll');
      const geometry = await scroll.evaluate(el => ({ client: el.clientHeight, content: el.scrollHeight, viewport: innerHeight }));
      assert(geometry.content > geometry.client && geometry.client > 0 && geometry.client <= geometry.viewport, `${width} list must have a bounded scroll area: ${JSON.stringify(geometry)}`);
      await scroll.hover();
      await page.mouse.wheel(0, 600);
      await page.waitForFunction(() => document.querySelector('.au-messages-scroll')?.scrollTop > 0);
      assert(await scroll.evaluate(el => el.scrollTop) > 0, `${width} inbox must scroll with wheel`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width} horizontal overflow`);
      await page.locator('.au-mail-row').first().click();
      await page.getByText('Isi email uji.').waitFor();
      const readerAvatar = await page.locator('.au-reader-person .au-avatar').boundingBox();
      assert(readerAvatar && readerAvatar.width >= 36 && readerAvatar.height >= 36 && Math.abs(readerAvatar.width - readerAvatar.height) <= 1, `${width} reader sender avatar must stay square: ${JSON.stringify(readerAvatar)}`);
      if (width <= 800) assert.equal(await page.locator('.au-reading-column').isVisible(), true);
      if (width === 1024) {
        const rail = await page.locator('.au-rail').boundingBox();
        assert(rail && rail.x >= 0 && rail.x + rail.width <= width, 'tablet rail must fit on screen');
        const logo = await page.locator('.au-logo-mark').boundingBox();
        assert(logo && logo.x >= 0 && logo.x + logo.width <= width, 'tablet logo must fit on screen');
        const sidebar = await page.locator('.au-sidebar').boundingBox();
        assert(sidebar && sidebar.x + sidebar.width <= 0, 'closed tablet sidebar must not cover rail');
      }
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `/tmp/sela-aurora-${width}x${height}.png` });
      await page.close();
    }
    console.log('Five viewport synthetic layouts and reader click-through passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
