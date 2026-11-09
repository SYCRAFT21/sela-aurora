const assert = require('node:assert/strict');
const { chromium } = require('playwright');
function pdf(label) {
  const stream = `BT /F1 22 Tf 30 100 Td (${label}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 240 160] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let text = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(text)); text += `${index+1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(text);
  text += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(text);
}
(async () => {
  const browser = await chromium.launch({ executablePath:'/usr/bin/brave-browser',headless:true });
  try {
    for (const width of [1440,768,390]) {
      const page = await browser.newPage({viewport:{width,height:900}});
      const files = [pdf('First file'),pdf('Second file'),pdf('Third file')];
      const account = {id:'one',email:'one@example.test',provider:'google',reconnect:false,gmail_modify:true};
      const mail = {id:'m',account_id:'one',sender:'Sender <sender@example.test>',recipient:account.email,subject:'Three PDFs',snippet:'',received:'2026-11-08T10:00:00Z',unread:false,url:''};
      let active = 0, peak = 0;
      await page.route('**/api/**',async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/accounts') return route.fulfill({json:[account]});
        if (url.pathname.startsWith('/api/inbox/')) return route.fulfill({json:{messages:[mail],errors:[]}});
        if (url.pathname.endsWith('/attachment')) {
          active++; peak = Math.max(peak, active);
          await new Promise(resolve => setTimeout(resolve,80));
          try { return await route.fulfill({body:files[Number(url.searchParams.get('part'))],contentType:'application/octet-stream'}); }
          finally { active--; }
        }
        return route.fulfill({json:{...mail,body:'Fictional body',attachments:files.map((bytes,index) => ({part:String(index),filename:`file-${index+1}.pdf`,mime_type:'application/pdf',size:bytes.length,inline:false,available:true}))}});
      });
      await page.goto('http://127.0.0.1:4175');
      await page.locator('.au-mail-row').first().click();
      await page.getByRole('region',{name:'Lampiran email'}).waitFor({timeout:3000});
      assert.equal(await page.locator('.au-attachment-card').count(),3);
      await page.waitForFunction(() => document.querySelectorAll('.au-attachment-card canvas[data-rendered="true"]').length===3);
      assert.equal(peak,1,'Visible thumbnails must fetch sequentially');
      await page.screenshot({path:`/tmp/aurora-pdf-gallery-${width}.png`});
      for (let index=0;index<3;index++) {
        await page.getByRole('button',{name:`Pratinjau file-${index+1}.pdf`,exact:true}).click();
        await page.locator('dialog canvas[data-rendered="true"]').waitFor();
        const ink = await page.locator('dialog canvas').evaluate(canvas => [...canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data].some((n,i) => i%4!==3 && n<100));
        assert(ink,'PDF must render actual text');
        if (index===0) await page.screenshot({path:`/tmp/aurora-pdf-viewer-${width}.png`});
        await page.getByRole('button',{name:'Perbesar',exact:true}).click();
        const download = page.waitForEvent('download');
        await page.getByRole('button',{name:'Unduh file',exact:true}).click();
        const file = await download;
        const chunks = []; for await (const chunk of await file.createReadStream()) chunks.push(chunk);
        assert.deepEqual(Buffer.concat(chunks),files[index]);
        await page.getByRole('button',{name:'Tutup pratinjau',exact:true}).click();
        assert.equal(await page.locator('.au-mail-row.is-current').count(),1);
      }
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
      await page.route('**/api/message/one/attachment?**', route => route.fulfill({body:png,contentType:'application/octet-stream'}));
      await page.route('**/api/message/one?**',route => route.fulfill({json:{...mail,body:'Image body',attachments:[{part:'0',filename:'photo.png',mime_type:'image/png',size:png.length,inline:false,available:true}]}}));
      await page.reload(); await page.locator('.au-mail-row').first().click();
      await page.getByRole('button',{name:'Pratinjau photo.png',exact:true}).click();
      await page.getByRole('img',{name:'photo.png',exact:true}).waitFor();
      assert.equal(await page.getByRole('img',{name:'photo.png',exact:true}).evaluate(image => image.naturalWidth),1);
      await page.getByRole('button',{name:'Tutup pratinjau',exact:true}).click();
      await page.route('**/api/message/one/attachment?**',route => route.fulfill({status:503,body:'Synthetic unavailable'}));
      await page.getByRole('button',{name:'Pratinjau photo.png',exact:true}).click();
      await page.locator('dialog [role="alert"]').waitFor();
      await page.route('**/api/message/one/attachment?**',route => route.fulfill({body:png}));
      await page.getByRole('button',{name:'Coba lagi',exact:true}).click();
      await page.getByRole('img',{name:'photo.png',exact:true}).waitFor();
      await page.getByRole('button',{name:'Tutup pratinjau',exact:true}).click();
      for (const [name,mime,content,expected] of [
        ['notes.txt','text/plain','<script>window.bad=true</script>','<script>window.bad=true</script>'],
        ['document.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document','fictional Office bytes','Pratinjau format ini belum tersedia. Unduh file untuk membukanya.'],
        ['spoof.png','image/png','<svg onload="window.bad=true"/>','Gambar tidak dapat dipratinjau. Unduh file.']
      ]) {
        const bytes=Buffer.from(content);
        await page.route('**/api/message/one/attachment?**',route => route.fulfill({body:bytes}));
        await page.route('**/api/message/one?**',route => route.fulfill({json:{...mail,body:'Attachment types',attachments:[{part:'0',filename:name,mime_type:mime,size:bytes.length,inline:false,available:true}]}}));
        await page.reload(); await page.locator('.au-mail-row').first().click();
        await page.getByRole('button',{name:`Pratinjau ${name}`,exact:true}).click();
        await page.locator('dialog').getByText(expected,{exact:true}).waitFor();
        assert.equal(await page.evaluate(() => window.bad),undefined);
        await page.getByRole('button',{name:'Tutup pratinjau',exact:true}).click();
      }
      await page.route('**/api/message/one/attachment?**',route => route.fulfill({body:png,contentType:'application/octet-stream'}));
      await page.route('**/api/message/one?**',route => route.fulfill({json:{...mail,body:'CID body',html:'<p>Inline image</p><img src="cid:logo" alt="Trusted CID"><img src="blob:forged" alt="Forged blob">',attachments:[{part:'0',filename:'logo.png',mime_type:'image/png',size:png.length,inline:true,content_id:'logo',available:true}]}}));
      await page.reload(); await page.locator('.au-mail-row').first().click();
      await page.getByRole('img',{name:'Trusted CID',exact:true}).waitFor();
      assert.match(await page.getByRole('img',{name:'Trusted CID',exact:true}).getAttribute('src'),/^blob:/);
      assert.equal(await page.getByRole('img',{name:'Forged blob'}).count(),0);
      assert.equal(await page.locator('.au-attachment-card').count(),0,'Used inline image must not duplicate gallery');
      await page.route('**/api/message/one/attachment?**',route => route.fulfill({status:503,body:'Synthetic CID failure'}));
      await page.reload(); await page.locator('.au-mail-row').first().click();
      await page.getByRole('button',{name:'Pratinjau logo.png',exact:true}).waitFor({timeout:3000});
      await page.route('**/api/message/one?**',route => route.fulfill({json:{...mail,body:'Large CID',html:'<img src="cid:large">',attachments:[{part:'0',filename:'large.png',mime_type:'image/png',size:21_000_000,inline:true,content_id:'large',available:true}]}}));
      await page.reload(); await page.locator('.au-mail-row').first().click();
      await page.getByRole('button',{name:'Pratinjau large.png',exact:true}).waitFor({timeout:3000});
      await page.route('**/api/message/one/attachment?**',route => route.fulfill({body:png}));
      await page.route('**/api/message/one?**',route => route.fulfill({json:{...mail,body:'CID body',html:'<img src="cid:logo" alt="Trusted CID">',attachments:[{part:'0',filename:'logo.png',mime_type:'image/png',size:png.length,inline:true,content_id:'logo',available:true}]}}));
      await page.evaluate(() => localStorage.setItem('aurora-read-mode','Original'));
      await page.reload(); await page.locator('.au-mail-row').first().click();
      await page.frameLocator('iframe').getByAltText('Trusted CID').waitFor();
      await page.waitForFunction(() => document.querySelector('iframe')?.getAttribute('srcdoc')?.includes('alt="Trusted CID" src="data:') || document.querySelector('iframe')?.getAttribute('srcdoc')?.includes('src="data:image/png'));
      await page.frameLocator('iframe').getByAltText('Trusted CID').evaluate(img => img.complete ? null : new Promise(resolve => {img.onload=resolve;img.onerror=resolve;}));
      assert.equal(await page.frameLocator('iframe').getByAltText('Trusted CID').evaluate(img => img.naturalWidth),1);
      assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-popups allow-popups-to-escape-sandbox');
      await page.evaluate(() => localStorage.setItem('aurora-read-mode','Plain Text'));
      let cidRequests=0;
      await page.route('**/api/message/one/attachment?**',route => {cidRequests++; return route.fulfill({body:png});});
      await page.reload(); await page.locator('.au-mail-row').first().click(); await page.locator('.au-email-plain').waitFor();
      assert.equal(cidRequests,0,'Plain Text must not fetch CID or image thumbnails');
      await page.evaluate(() => localStorage.setItem('aurora-read-mode','Adaptive'));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:`/tmp/aurora-attachments-${width}.png`});
      await page.getByTitle('Kembali ke inbox').click().catch(() => {});
      if (width > 1110) await page.locator('.au-compose-trigger').click();
      else if (width <= 660) await page.locator('.au-mobile-bottom').getByTitle('Tulis email').click();
      else { await page.locator('.au-topbar-menu').click(); await page.locator('.au-compose-trigger').click(); }
      await page.getByLabel('Lampirkan file').setInputFiles([{name:'one.txt',mimeType:'text/plain',buffer:Buffer.from('one')},{name:'two.bin',mimeType:'application/octet-stream',buffer:Buffer.from([0,255])}]);
      assert.equal(await page.locator('.au-compose-file').count(),2);
      await page.getByRole('button',{name:'Hapus one.txt',exact:true}).click();
      await page.waitForFunction(()=>document.querySelectorAll('.au-compose-file').length===1);
      assert.equal(await page.locator('.au-compose-file').count(),1);
      await page.getByLabel('Kepada',{exact:true}).fill('recipient@example.test');
      await page.getByLabel('Subjek',{exact:true}).fill('Synthetic files');
      const submitted = page.waitForRequest('**/api/compose/one');
      page.once('dialog',dialog => dialog.accept());
      await page.getByRole('button',{name:'Kirim',exact:true}).click();
      const request = await submitted;
      assert.match(request.headers()['content-type'],/^multipart\/form-data;/);
      const payload = request.postDataBuffer();
      assert(payload.includes(Buffer.from([0,255])));
      assert(payload.includes(Buffer.from('two.bin')));
      await page.route('**/api/draft/one?**',route => route.fulfill({json:{draft_id:'draft-real',message_id:'m',to:'recipient@example.test',cc:'',bcc:'',subject:'Existing draft',body:'Draft body',html_only:false,attachments:[{part:'0',filename:'kept.png',mime_type:'image/png',size:png.length,inline:false,available:true}]}}));
      await page.reload();
      if (width <= 1110) await page.locator('.au-topbar-menu').click();
      await page.locator('.au-nav-list').getByRole('button',{name:'Draf',exact:true}).click();
      await page.locator('.au-mail-row').first().click();
      await page.getByRole('button',{name:'Edit draf',exact:true}).waitFor({timeout:2000});
      await page.getByRole('button',{name:'Edit draf',exact:true}).click();
      await page.getByRole('button',{name:'Hapus kept.png',exact:true}).waitFor();
      assert.equal(await page.getByLabel('Subjek',{exact:true}).inputValue(),'Existing draft');
      await page.route('**/api/compose/one',route => route.fulfill({status:424,body:'Synthetic preparation failure; not sent'}));
      page.once('dialog',dialog => dialog.accept());
      await page.getByRole('button',{name:'Kirim',exact:true}).click();
      await page.getByText(/Perbaiki pesan sebelum mengirim ulang/).waitFor({timeout:3000});
      assert.equal(await page.getByRole('button',{name:'Kirim',exact:true}).isEnabled(),true);
      assert.equal(await page.locator('.au-compose-body').inputValue(),'Draft body');
      assert.equal(await page.getByRole('button',{name:'Hapus kept.png',exact:true}).count(),1);
      await page.route('**/api/compose/one',route => route.fulfill({status:201,json:{id:'draft-real',message_id:'m2'}}));
      const update = page.waitForRequest('**/api/compose/one');
      await page.getByRole('button',{name:'Simpan draf',exact:true}).click();
      const json = (await update).postDataJSON();
      assert.equal(json.draft_id,'draft-real'); assert.equal(json.expected_message_id,'m');
      assert.equal(json.retained[0].part,'0');
      await page.close();
    }
    console.log('Three PDF canvases/download bytes, raster/text/Office safety, CID privacy, uploads and draft reopening: three viewports passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
