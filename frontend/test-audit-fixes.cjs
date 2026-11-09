const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Yk0AAAAASUVORK5CYII=';
function header(width, height) {
  const bytes = Buffer.alloc(24); Buffer.from('89504e470d0a1a0a','hex').copy(bytes);
  bytes.write('IHDR',12); bytes.writeUInt32BE(width,16); bytes.writeUInt32BE(height,20);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/bin/brave-browser',headless:true});
  try {
    for (const check of process.env.ONLY ? [process.env.ONLY] : ['images','cid','recipients','unload']) {
      const page = await browser.newPage({viewport:{width:1440,height:900}});
      const account = {id:'audit',email:'me@example.test',provider:'google',reconnect:false,gmail_modify:true};
      const mail = {id:'synthetic',account_id:account.id,sender:'Me <me@example.test>',recipient:'alice@example.test, bob@example.test',subject:'Fictional audit',snippet:'',received:'2026-11-09T00:00:00Z',unread:false,url:''};
      let recipient = mail.recipient;
      await page.route('**/api/**', route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/accounts') return route.fulfill({json:[account]});
        if (path.startsWith('/api/inbox/')) return route.fulfill({json:{messages:[mail],errors:[],next_cursors:{}}});
        if (path.startsWith('/api/compose/')) return route.fulfill({status:201,json:{}});
        if (path.endsWith('/attachment')) return route.fulfill({contentType:'image/png',body:Buffer.from(header(5000,5000).split(',')[1],'base64')});
        if (check === 'cid' && path.startsWith('/api/message/')) return route.fulfill({json:{...mail,body:'Fictional body',html:'<p>Fictional body</p><img alt="cid-first" src="cid:one"><img alt="cid-repeat" src="cid:one"><img alt="cid-second" src="cid:two">',attachments:['one','two'].map((id,index)=>({part:String(index),filename:`${id}.png`,mime_type:'image/png',size:24,inline:true,content_id:id,available:true}))}});
        if (path.startsWith('/api/message/')) return route.fulfill({json:{...mail,recipient,cc:'ALICE@example.test, carol@example.test, me@example.test, CAROL@example.test',body:'Fictional body',html:`<p>Fictional body</p><img alt="valid" src="${pixel}"><img alt="oversized" src="${header(7000,7000)}"><img alt="spoof" src="data:image/png;base64,PHN2Zz4="><img alt="budget-first" src="${header(5000,5000)}"><img alt="budget-second" src="${header(5000,5000)}">`,attachments:[]}});
        return route.fulfill({status:500,body:'Unexpected synthetic path'});
      });
      await page.goto('http://127.0.0.1:4175');
      if (check === 'cid') {
        for (const mode of ['Adaptive','Original']) {
          await page.evaluate(value=>localStorage.setItem('aurora-read-mode',value),mode);
          await page.reload(); await page.locator('.au-mail-row').first().click();
          const root=mode==='Original' ? page.frameLocator('iframe').locator('body') : page.locator('.au-email-adaptive');
          await root.locator('img[alt="cid-first"][src]').waitFor();
          await page.getByRole('button',{name:'Pratinjau two.png',exact:true}).waitFor();
          assert.equal(await root.locator('img[alt="cid-repeat"][src],img[alt="cid-second"][src]').count(),0,`${mode}: CID shares aggregate pixel budget; repeated references charged`);
        }
      } else if (check === 'images') {
        for (const mode of ['Adaptive','Original']) {
          if (mode === 'Original') {
            await page.reload();
            await page.evaluate(() => localStorage.setItem('aurora-read-mode','Original'));
            await page.reload();
          }
          await page.locator('.au-mail-row').first().click();
          const root = mode === 'Original' ? page.frameLocator('iframe').locator('body') : page.locator('.au-email-adaptive');
          await root.getByText('Fictional body',{exact:true}).waitFor();
          assert.equal(await root.locator('img[alt="valid"][src]').count(),1,`${mode}: valid raster retained`);
          assert.equal(await root.locator('img[alt="oversized"][src],img[alt="spoof"][src]').count(),0,`${mode}: unsafe raster must never reach decoder`);
          assert.equal(await root.locator('img[alt^="budget-"][src]').count(),1,`${mode}: aggregate pixel budget enforced`);
        }
      } else if (check === 'recipients') {
        for (const value of [recipient, '"Doe, Alice" <alice@example.test>, Bob <bob@example.test>, ALICE@example.test']) {
          recipient=value;
          await page.reload(); await page.locator('.au-mail-row').first().click();
          const reply=page.getByRole('button',{name:'Balas semua',exact:true}); await reply.waitFor();
          await page.getByText('Fictional body',{exact:true}).waitFor(); await reply.click();
          assert.equal(await page.getByRole('textbox',{name:'Kepada',exact:true}).inputValue(),'alice@example.test, bob@example.test');
          assert.equal(await page.getByRole('textbox',{name:'CC',exact:true}).inputValue(),'carol@example.test','To and CC disjoint; owner and case-insensitive duplicates removed');
          page.once('dialog',dialog=>dialog.accept()); await page.getByTitle('Tutup penulis pesan').click();
        }
        recipient='me@example.test';
        await page.reload(); await page.locator('.au-mail-row').first().click();
        await page.getByText('Fictional body',{exact:true}).waitFor();
        await page.getByRole('button',{name:'Balas',exact:true}).click();
        assert.equal(await page.getByRole('textbox',{name:'Kepada',exact:true}).inputValue(),'me@example.test','reply to a self-addressed sent message must keep its recipient');
        page.once('dialog',dialog=>dialog.accept()); await page.getByTitle('Tutup penulis pesan').click();
      } else if (check === 'unload') {
        let prompts=0;
        page.on('dialog',async dialog=>{ if(dialog.type()==='beforeunload') prompts++; await dialog.accept(); });
        await page.getByRole('button',{name:/Tulis email/}).click();
        await page.reload(); assert.equal(prompts,0,'empty editor does not warn');
        await page.getByRole('button',{name:/Tulis email/}).click();
        await page.getByRole('textbox',{name:'Isi pesan',exact:true}).fill('Fictional unsaved text');
        await page.getByTitle('Minimalkan pesan').click();
        await page.reload(); assert.equal(prompts,1,'minimized dirty editor warns on reload');
        await page.getByRole('button',{name:/Tulis email/}).click();
        await page.getByRole('textbox',{name:'Kepada',exact:true}).fill('alice@example.test');
        await page.getByRole('textbox',{name:'Subjek',exact:true}).fill('Synthetic draft');
        await page.getByRole('button',{name:'Simpan draf',exact:true}).click();
        await page.getByRole('region',{name:'Tulis pesan'}).waitFor({state:'hidden'});
        await page.reload(); assert.equal(prompts,1,'successful save removes unload guard');
        await page.getByRole('button',{name:/Tulis email/}).click();
        await page.locator('input[type="file"]').setInputFiles({name:'synthetic.txt',mimeType:'text/plain',buffer:Buffer.from('synthetic')});
        await page.reload(); assert.equal(prompts,2,'attachment-only editor warns');
      }
      console.log(`${check}: audit regression passed`); await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
