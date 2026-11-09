const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const accounts = ['one', 'two'].map(id => ({ id, email: `${id}@example.test`, provider: 'google', reconnect: false }));
  const mail = (account, id, recipient, unread = false) => ({ id, account_id: account, sender: 'Me <me@example.test>', recipient, subject: `Subject ${account} ${id}`, snippet: 'Preview', received: '2026-11-06T10:00:00Z', unread, url: '' });
  const calls = [];
  try {
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/accounts') return route.fulfill({ json: accounts });
      if (url.pathname.startsWith('/api/inbox/')) {
        calls.push(url.searchParams);
        if (url.searchParams.get('cursors')) {
          assert.deepEqual(Object.keys(JSON.parse(url.searchParams.get('cursors'))), ['one']);
          return route.fulfill({ json: { messages: [mail('one', 'm1', 'Friend <friend@example.test>'), mail('one', 'm3', 'Next <next@example.test>')], errors: [], next_cursors: {}, limited_accounts: [] } });
        }
        return route.fulfill({ json: { messages: [mail('one', 'm1', 'Friend <friend@example.test>', true), mail('two', 'm2', 'Other <other@example.test>')], errors: [], next_cursors: { one: 'opaque-next' }, limited_accounts: [] } });
      }
      throw Error('Unexpected request: ' + url.pathname);
    });
    await page.goto('http://127.0.0.1:4175');
    await page.getByText('Subject one m1').waitFor();
    await page.getByRole('button', { name: 'Muat lagi' }).click();
    await page.getByText('Subject one m3').waitFor();
    assert.equal(await page.locator('.au-mail-row').count(), 3);
    assert.equal(await page.locator('.au-mail-row.is-unread').count(), 1);
    const previousCalls = calls.length;
    await page.locator('.au-rail').getByTitle('Pengaturan').click();
    await page.getByRole('navigation', { name: 'Bagian pengaturan' }).getByRole('button', { name: 'Akun & Sinkronisasi' }).click();
    assert.equal(await page.locator('.au-real-account').count(), 2, 'all accounts in one list');
    await page.locator('.au-rail').getByTitle('Pengaturan').click();
    assert.equal(calls.length, previousCalls, 'Settings must not reload paginated messages');
    assert.equal(await page.locator('.au-mail-row').count(), 3, 'Settings preserves loaded pages');
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(150);
    assert.equal(calls.length, previousCalls, 'loaded pages must suppress polling');
    assert.equal(await page.locator('.au-mail-row').count(), 3, 'loaded pages must remain visible');
    assert.equal(await page.getByRole('button', { name: 'Muat lagi' }).count(), 0);
    await page.getByRole('button', { name: /Terkirim/ }).first().click();
    await page.getByText('Subject one m1').waitFor();
    assert.equal(calls.at(-1).get('cursors'), null);
    assert.equal(await page.locator('.au-mail-row').first().locator('.au-sender').textContent(), 'Friend');
    assert.match(await page.locator('.au-mail-header').innerText(), /pesan dimuat/);
    await page.route('**/api/inbox/**', route => route.fulfill({ json: { messages: [], errors: [], next_cursors: { one: 'more-after-filter' }, limited_accounts: [] } }));
    await page.getByRole('button', { name: /Berbintang/ }).first().click();
    await page.getByRole('heading', { name: 'Tidak ada pesan di sini' }).waitFor();
    await page.getByRole('button', { name: 'Muat lagi' }).waitFor();
    console.log('Per-account cursor, dedupe, Sent recipient, empty-page continuation, and reset checks passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
