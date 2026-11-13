const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/brave-browser', headless: true });
  const calls = [];
  const account = { id: 'google-opaque-1', email: 'user@example.test', provider: 'google', reconnect: false };
  const message = { id: 'message-opaque-1', account_id: account.id, recipient: account.email, sender: 'Alya <alya@example.test>', subject: 'Review terakhir sebelum handoff', snippet: 'Halo dari server', received: '2026-11-06T10:42:00Z', unread: true, url: 'https://mail.google.com/mail/u/0/#inbox/message-opaque-1' };
  try {
    for (const width of [1440, 768, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        calls.push({ pathname: url.pathname, search: url.searchParams, method: route.request().method() });
        if (url.pathname === '/api/settings') return route.fulfill({ json: { ai: { model: 'claude-opus-5-5', enabled: false, key_configured: false }, appearance: route.request().postDataJSON()?.appearance || null } });
        if (url.pathname === '/api/accounts') return route.fulfill({ json: [account] });
        if (url.pathname.startsWith('/api/inbox/')) return route.fulfill({ json: { messages: [message], errors: [] } });
        if (url.pathname.startsWith('/api/message/') && url.pathname.endsWith('/read')) return route.fulfill({ status: 204 });
        if (url.pathname.startsWith('/api/message/')) return route.fulfill({ json: { sender: message.sender, recipient: message.recipient, subject: message.subject, received: message.received, body: 'Isi asli dari server', url: message.url } });
        throw new Error('Unexpected API request: ' + url.pathname);
      });
      await page.goto('http://127.0.0.1:4175', { waitUntil: 'domcontentloaded' });
      await page.getByText('user@example.test').first().waitFor();
      await page.getByText('Review terakhir sebelum handoff').first().waitFor();
      assert(calls.some(c => c.pathname === '/api/inbox/all' && c.search.get('mailbox') === 'inbox'));
      await page.getByRole('navigation', { name: 'Kategori email' }).getByRole('button', { name: 'Promosi' }).click();
      assert(calls.some(c => c.pathname === '/api/inbox/all' && c.search.get('category') === 'promotions'));
      const categoryEntry = width <= 660 ? page.locator('.au-mobile-bottom').getByTitle('Setelan') : page.locator('.au-rail').getByTitle('Pengaturan');
      await categoryEntry.click();
      if (width <= 660) await page.locator('.au-mobile-bottom').getByTitle('Inbox').click(); else await categoryEntry.click();
      assert.equal(await page.getByRole('navigation', { name: 'Kategori email' }).getByRole('button', { name: 'Promosi' }).getAttribute('aria-pressed'), 'true', 'Settings preserves non-default category');
      await page.getByRole('search').getByRole('textbox', { name: 'Cari email' }).fill('invoice');
      await page.getByRole('search').locator('button').click();
      assert(calls.some(c => c.pathname === '/api/inbox/all' && c.search.get('search') === 'invoice'));
      if (width <= 800) await page.getByTitle('Buka menu').click();
      await page.getByRole('button', { name: /Terkirim/ }).first().click();
      assert(calls.some(c => c.pathname === '/api/inbox/all' && c.search.get('mailbox') === 'sent'));
      if (width <= 800) await page.getByTitle('Buka menu').click();
      if (width <= 800) await page.locator('.au-sidebar-account').first().click();
      else await page.getByTitle('user@example.test').click();
      assert(calls.some(c => c.pathname === '/api/inbox/google-opaque-1'));
      if (width <= 800) await page.getByTitle('Buka menu').click();
      await page.getByRole('button', { name: /Terkirim/ }).first().click();
      await page.getByRole('search').getByRole('textbox', { name: 'Cari email' }).fill('invoice');
      await page.getByRole('search').locator('button').click();
      await page.getByText('Review terakhir sebelum handoff').first().click();
      await page.getByText('Isi asli dari server').waitFor();
      assert(calls.some(c => c.pathname === '/api/message/google-opaque-1' && c.search.get('id') === 'message-opaque-1'));
      assert(calls.some(c => c.pathname === '/api/message/google-opaque-1/read' && c.method === 'POST'));
      await page.getByRole('button', { name: /Balas/ }).first().click();
      await page.getByText(/Izin Gmail belum terverifikasi/).first().waitFor();
      page.once('dialog',dialog => dialog.accept());
      await page.getByTitle('Tutup penulis pesan').click();
      if (width <= 660) await page.locator('.au-mobile-bottom button').filter({ hasText: 'Tulis' }).click();
      else { if (width <= 800) await page.getByTitle('Buka menu').click(); await page.getByRole('button', { name: /Tulis email/ }).first().click(); }
      await page.getByText(/Izin Gmail belum terverifikasi/).first().waitFor();
      page.once('dialog',dialog => dialog.accept());
      await page.getByTitle('Tutup penulis pesan').click();
      const railGear = page.locator('.au-rail').getByTitle('Pengaturan');
      const mobileSettings = page.locator('.au-mobile-bottom').getByRole('button', { name: /Setelan/ });
      assert.equal(Number(await railGear.isVisible()) + Number(await mobileSettings.isVisible()), 1, `${width} has one visible Settings entry`);
      assert.equal(await page.locator('.au-sidebar').getByRole('button', { name: 'Pengaturan' }).count(), 0);
      assert.equal(await page.locator('.au-sidebar').getByRole('button', { name: /Kelola semua akun/ }).count(), 0);
      const categoryBefore = calls.filter(c => c.pathname.startsWith('/api/inbox/')).at(-1).search.get('category');
      const beforeSettings = calls.filter(c => c.pathname.startsWith('/api/inbox/')).length;
      if (width <= 800 && width > 660) await page.locator('.au-sidebar-close').click();
      if (await railGear.isVisible()) await railGear.click(); else await mobileSettings.click();
      await page.getByRole('heading', { name: 'Pengaturan' }).waitFor();
      if (await railGear.isVisible()) assert.match(await railGear.getAttribute('class'), /selected/, 'gear must show active Settings');
      const settings = page.getByRole('navigation', { name: 'Bagian pengaturan' });
      assert.equal(await settings.getByRole('button').count(), 6, 'six Settings sections including AI');
      for (const label of ['Tampilan & Preferensi', 'Akun & Sinkronisasi', 'Email & Notifikasi', 'AI & Penulisan', 'Privasi & Keamanan', 'Tentang Aurora']) {
        await settings.getByRole('button', { name: label, exact: true }).click();
        await page.getByRole('heading', { name: label, exact: true }).waitFor();
      }
      await settings.getByRole('button', { name: 'Tampilan & Preferensi' }).click();
      await page.getByRole('button', { name: 'Adaptive', exact: true }).waitFor();
      await page.getByRole('button', { name: /Tema:/ }).click();
      await page.waitForFunction(() => document.querySelector('.aurora-app')?.classList.contains('au-theme-light'));
      assert.match(await page.locator('.aurora-app').getAttribute('class'), /au-theme-light/);
      await page.getByRole('button', { name: /Kepadatan:/ }).click();
      await page.waitForFunction(() => document.querySelector('.aurora-app')?.classList.contains('au-density-compact'));
      assert.match(await page.locator('.aurora-app').getAttribute('class'), /au-density-compact/);
      await page.getByRole('table', { name: 'Pintasan keyboard' }).waitFor();
      await page.keyboard.press('Tab');
      const preferencesNav = settings.getByRole('button', { name: 'Tampilan & Preferensi' });
      await preferencesNav.focus();
      assert.equal(await preferencesNav.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await page.getByRole('heading', { name: 'Akun & Sinkronisasi', exact: true }).waitFor();
      await settings.getByRole('button', { name: 'Email & Notifikasi' }).click();
      const compactPanel = await page.locator('.au-settings-panel').boundingBox();
      assert(compactPanel.height < 370, 'short notes must not create oversized empty cards');
      const contrast = await page.locator('.au-settings-panel').evaluate(panel => {
        const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        const style = getComputedStyle(panel);
        const background = luminance(style.backgroundImage.match(/rgba?\([^)]+\)/)?.[0] || style.backgroundColor);
        const ratios = [...panel.querySelectorAll('h2,h3,p')].map(el => {
          const foreground = luminance(getComputedStyle(el).color);
          return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
        });
        const page = panel.closest('.au-page-scroll');
        const pageBackground = luminance(getComputedStyle(page).backgroundColor);
        for (const el of page.querySelectorAll('.au-page-heading h1,.au-page-heading p')) {
          const foreground = luminance(getComputedStyle(el).color);
          ratios.push((Math.max(foreground, pageBackground) + .05) / (Math.min(foreground, pageBackground) + .05));
        }
        return ratios;
      });
      assert(contrast.every(ratio => ratio >= 4.5), 'Settings text must remain readable in light theme');
      await page.screenshot({ path: `/tmp/aurora-settings-${width}.png` });
      await settings.getByRole('button', { name: 'Tampilan & Preferensi' }).click();
      await page.getByRole('button', { name: /Tema:/ }).click();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await page.locator('.au-motion-reduced').isVisible(), true);
      assert.equal(await page.locator('.au-motion-normal').isVisible(), false);
      for (const [index, label] of ['Tampilan & Preferensi', 'Akun & Sinkronisasi', 'Email & Notifikasi', 'Privasi & Keamanan', 'Tentang Aurora'].entries()) {
        await settings.getByRole('button', { name: label, exact: true }).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label} must not overflow at ${width}`);
        await page.screenshot({ path: `/tmp/aurora-settings-${width}-${index}.png` });
      }
      await settings.getByRole('button', { name: 'Privasi & Keamanan' }).click();
      await page.getByText(/memerlukan izin per pesan/).waitFor();
      await settings.getByRole('button', { name: 'Akun & Sinkronisasi' }).click();
      assert.equal(await page.locator('.au-settings-panel .au-real-account').count(), 1, 'one authoritative account list');
      await page.locator('.au-settings-panel .au-real-account').getByText('user@example.test',{exact:true}).waitFor();
      const addAccount = page.getByRole('link', { name: 'Tambah Gmail' });
      const reauthorize = page.getByRole('link', { name: 'Perbarui izin' });
      assert.equal(await addAccount.getAttribute('href'), '/auth/google');
      assert.equal(await reauthorize.getAttribute('href'), '/auth/google?login_hint=user%40example.test');
      await page.context().route('**/auth/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Mock OAuth only</title>' }));
      // Open mocked OAuth in another tab, preserving the mailbox under test.
      for (const link of [addAccount, reauthorize]) {
        await link.evaluate(el => el.setAttribute('target', '_blank'));
        const popupPromise = page.waitForEvent('popup');
        await link.click();
        const popup = await popupPromise;
        await popup.waitForLoadState();
        assert.equal(await popup.title(), 'Mock OAuth only');
        await popup.close();
      }
      await page.getByRole('button', { name: 'Putuskan' }).waitFor();
      if (await railGear.isVisible()) await railGear.click();
      else await page.locator('.au-mobile-bottom').getByRole('button', { name: /Inbox/ }).click();
      assert.equal(await page.locator('.au-mail-header h1').textContent(), 'Hasil pencarian', `${width} search must remain selected`);
      assert.equal(await page.locator('.au-mail-header .au-heading-eyebrow').textContent(), 'user@example.test', `${width} account must remain selected`);
      assert.equal(await page.getByRole('search').getByRole('textbox', { name: 'Cari email' }).inputValue(), 'invoice', `${width} search input must remain`);
      assert.equal(await page.locator('.au-mail-row.is-current').count(), 1, `${width} selected message must remain`);
      assert.equal(await page.locator('.au-mail-row').count(), 1, `${width} loaded message must remain`);
      assert.equal(calls.filter(c => c.pathname.startsWith('/api/inbox/')).length, beforeSettings, `${width} returning must not reload mailbox`);
      assert.equal(calls.filter(c => c.pathname.startsWith('/api/inbox/')).at(-1).search.get('category'), categoryBefore, `${width} category must remain selected`);
      await page.getByText('Isi asli dari server').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `horizontal overflow at ${width}`);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Aurora desktop/tablet/mobile API click-through passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
