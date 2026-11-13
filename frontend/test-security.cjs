const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true });
  const page = await browser.newPage();
  const requests = [];
  const accounts = [{ id: 'opaque-google', email: 'user@example.test', provider: 'google', reconnect: false }];
  const mail = { id: 'opaque-mail', account_id: accounts[0].id, recipient: accounts[0].email, sender: 'Sender <sender@example.test>', subject: 'Read me', snippet: 'Sample', received: '2026-11-06T12:00:00Z', unread: true, url: '' };
  try {
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url()); requests.push(url.pathname);
      if (url.pathname === '/api/settings') return route.fulfill({ json: { ai: { model: 'claude-opus-5-5', enabled: false, key_configured: false }, appearance: route.request().postDataJSON()?.appearance || null } });
      if (url.pathname === '/api/accounts') return route.fulfill({ json: accounts });
      if (url.pathname.startsWith('/api/inbox/')) return route.fulfill({ json: { messages: [mail], errors: [] } });
      if (url.pathname.endsWith('/read')) return route.fulfill({ status: 403, body: 'synthetic permission error' });
      if (url.pathname.startsWith('/api/message/')) return route.fulfill({ json: { sender: mail.sender, recipient: mail.recipient, subject: mail.subject, received: mail.received, body: '', html: '<script>top.alert("XSS")</script><p>Safe preview</p>', url: 'javascript:alert(1)' } });
      throw Error('Unexpected request ' + url.pathname);
    });
    let unexpectedDialog = false;
    page.on('dialog', dialog => { if (dialog.type() === 'alert') { unexpectedDialog = true; void dialog.dismiss(); } else void dialog.accept(); });
    await page.goto('http://127.0.0.1:4175');
    await page.locator('.au-mail-row').first().click();
    await page.locator('.au-email-adaptive').waitFor();
    assert.equal(await page.locator('iframe').count(), 0);
    assert.equal(await page.locator('.au-email-adaptive script').count(), 0);
    assert.equal(await page.locator('.au-email-adaptive').textContent().then(text => text?.includes('Safe preview')), true);
    assert.equal(await page.locator('.au-email-adaptive img').count(), 0);
    assert.equal(await page.getByText('Buka di penyedia').count(), 0);
    await page.getByText('synthetic permission error', { exact: false }).waitFor();
    assert.equal(await page.locator('.au-mail-row.is-unread').count(), 1);
    assert(requests.some(url => url.endsWith('/read')));
    await page.locator('.au-rail').getByTitle('Pengaturan').click();
    await page.getByRole('navigation', { name: 'Bagian pengaturan' }).getByRole('button', { name: 'Akun & Sinkronisasi' }).click();
    let disconnectCalls = 0;
    await page.route('**/api/accounts/opaque-google', route => { disconnectCalls++; return route.fulfill({ status: 503, body: 'synthetic disconnect error' }); });
    page.removeAllListeners('dialog');
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Putuskan' }).click();
    assert.equal(disconnectCalls, 0, 'cancel confirmation must not disconnect');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Putuskan' }).click();
    await page.getByText('synthetic disconnect error', { exact: false }).waitFor();
    assert.equal(await page.getByText('user@example.test').count() > 0, true);
    assert.equal(unexpectedDialog, false);
    console.log('Sandbox, rejected read, and failed disconnect checks passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
