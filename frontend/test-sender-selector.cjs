const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/bin/brave-browser',headless:true});
  try {
    for (const width of [1440,768,390]) {
      const context = await browser.newContext({viewport:{width,height:900},hasTouch:true});
      const page = await context.newPage();
      const accounts = [
        {id:'one',email:'one@example.test',provider:'google',reconnect:false,gmail_modify:true},
        {id:'two',email:'long.sender.address.for.truncation.with.another.department@example.test',provider:'google',reconnect:false,gmail_modify:true},
        {id:'three',email:'reconnect@example.test',provider:'google',reconnect:true,gmail_modify:null},
        {id:'outlook',email:'outlook@example.test',provider:'microsoft',reconnect:false,gmail_modify:null}
      ];
      const mail={id:'m',account_id:'one',sender:'sender@example.test',recipient:accounts[0].email,subject:'Synthetic',received:'2026-11-09T10:00:00Z',snippet:'',unread:false,url:''};
      await page.route('**/api/**',route => {
        const url=new URL(route.request().url());
        if(url.pathname==='/api/accounts') return route.fulfill({json:accounts});
        if(url.pathname.startsWith('/api/inbox/')) return route.fulfill({json:{messages:[mail],errors:[]}});
        if(url.pathname.startsWith('/api/compose/')) return route.fulfill({status:422,body:'Synthetic validation; no send'});
        return route.fulfill({json:{...mail,body:'Source body',attachments:[]}});
      });
      await page.goto('http://127.0.0.1:4175');
      if(width>1110) await page.locator('.au-compose-trigger').click();
      else if(width<=660) await page.locator('.au-mobile-bottom').getByTitle('Tulis email').click();
      else {await page.locator('.au-topbar-menu').click(); await page.locator('.au-compose-trigger').click();}
      const trigger=page.getByRole('combobox',{name:'Dari',exact:true});
      await trigger.waitFor({timeout:3000});
      await page.getByLabel('Kepada',{exact:true}).fill('recipient@example.test');
      await page.getByLabel('Subjek',{exact:true}).fill('Keep subject');
      await page.locator('.au-compose-body').fill('Keep body');
      await page.getByLabel('Lampirkan file').setInputFiles({name:'keep.txt',mimeType:'text/plain',buffer:Buffer.from('keep')});
      await trigger.click();
      const list=page.getByRole('listbox',{name:'Akun pengirim'});
      await list.waitFor();
      assert.equal(await list.getByRole('option').count(),3);
      assert.equal(await list.getByRole('option',{selected:true}).count(),1);
      assert.equal(await list.getByRole('option').nth(2).locator('.au-sender-connected').count(),0);
      assert.equal(await list.locator('.au-sender-connected').count(),2);
      const bounds=await list.boundingBox(); assert(bounds.x>=8 && bounds.x+bounds.width<=width-8);
      assert(bounds.y>=8 && bounds.y+bounds.height<=900-8);
      assert.equal(await list.evaluate(el => el.matches(':popover-open')),true,'top-layer popover avoids compose clipping');
      assert.equal(await list.evaluate(el => getComputedStyle(el).transitionDuration),'0.18s');
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('.au-sender-popup')).opacity==='1');
      await page.screenshot({path:`/tmp/aurora-sender-${width}.png`});
      await list.getByRole('option').nth(1).click();
      await page.waitForFunction(() => document.querySelector('[role="combobox"]').getAttribute('aria-expanded')==='false');
      assert.match(await trigger.innerText(),/long.sender/);
      assert.equal(await page.getByLabel('Kepada',{exact:true}).inputValue(),'recipient@example.test');
      assert.equal(await page.getByLabel('Subjek',{exact:true}).inputValue(),'Keep subject');
      assert.equal(await page.locator('.au-compose-body').inputValue(),'Keep body');
      assert.equal(await page.getByRole('button',{name:'Hapus keep.txt',exact:true}).count(),1);
      await trigger.focus(); await trigger.press('ArrowDown'); await list.waitFor();
      await trigger.press('Home'); await trigger.press('ArrowDown'); await trigger.press('Enter');
      assert.match(await trigger.innerText(),/long.sender/);
      await trigger.click(); await list.waitFor(); await trigger.press('Escape');
      assert.equal(await trigger.getAttribute('aria-expanded'),'false');
      assert((await list.evaluate(el=>getComputedStyle(el).transitionDuration)).split(', ').every(duration=>duration==='0.14s'));
      assert.equal(await trigger.evaluate(el=>document.activeElement===el),true);
      assert.equal(await trigger.evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
      assert.equal(await page.locator('.au-compose-window').count(),1,'Escape closes selector, not dirty compose');
      await trigger.click(); await list.waitFor(); await page.locator('.au-compose-body').click();
      await page.waitForFunction(() => document.querySelector('[role="combobox"]').getAttribute('aria-expanded')==='false');
      await trigger.tap(); await list.waitFor(); await list.getByRole('option').first().tap();
      assert.match(await trigger.innerText(),/one@example/);
      await trigger.focus(); await trigger.press('ArrowUp'); await trigger.press('Home'); await trigger.press('ArrowDown'); await trigger.press('Enter');
      const draft=page.waitForRequest('**/api/compose/two');
      await page.getByRole('button',{name:'Simpan draf',exact:true}).click();
      assert((await draft).postDataBuffer().includes(Buffer.from('Keep body')));
      await page.getByText(/Perbaiki pesan|Draf belum tersimpan/).waitFor();
      const send=page.waitForRequest('**/api/compose/two');
      page.once('dialog',dialog=>dialog.accept()); await page.getByRole('button',{name:'Kirim',exact:true}).click();
      await send;
      await page.getByText(/Perbaiki pesan/).waitFor();
      // Force the anchor near the viewport bottom; the real control must flip above it.
      await trigger.evaluate(el=>{el.style.position='fixed';el.style.inset='auto 8px 8px auto';el.style.width='280px';el.style.zIndex='30';});
      await trigger.click(); await list.waitFor();
      const flipped=await list.boundingBox(), anchor=await trigger.boundingBox();
      assert(flipped.y+flipped.height<=anchor.y,'dropdown flips above when below is insufficient');
      await trigger.press('Escape');
      await page.emulateMedia({reducedMotion:'reduce'}); await trigger.click(); await list.waitFor();
      assert.equal(await list.evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
      await trigger.press('Escape');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      // Existing reply source lock must remain; discard only synthetic unsent editor.
      page.once('dialog',dialog=>dialog.accept()); await page.getByTitle('Tutup penulis pesan').click();
      if(await page.locator('.au-sidebar.is-open').count()) await page.locator('.au-sidebar-close').click();
      await page.locator('.au-mail-row').first().click();
      await page.getByRole('button',{name:'Balas',exact:true}).first().click();
      assert.equal(await trigger.isDisabled(),true);
      await context.close();
    }
    console.log('Sender mouse/touch/keyboard, animations, placement, source lock, preserved files and send/draft account binding: three viewports passed');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
