const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/brave-browser',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:900}});let release;
 const mail={id:'m',account_id:'one',sender:'sender@example.test',recipient:'one@example.test',subject:'Synthetic',received:'2026-11-09T10:00:00Z',snippet:'',unread:false,url:''};
 await page.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;
 if(path==='/api/accounts')return route.fulfill({json:[{id:'one',email:'one@example.test',provider:'google',reconnect:false,gmail_modify:true}]});
 if(path.startsWith('/api/inbox/'))return route.fulfill({json:{messages:[mail],errors:[]}});
 if(path.startsWith('/api/message/'))return new Promise(resolve=>{release=()=>resolve(route.fulfill({json:{...mail,recipient:'one@example.test, "Doe, Jane" <jane@example.test>',cc:'"Smith, Alex" <alex@example.test>',body:'Source body',attachments:[]}}));});
 return route.fulfill({json:{}});});
 await page.goto('http://127.0.0.1:4175');
 const open=page.locator('.au-mobile-bottom').getByTitle('Tulis email');await open.click();
 const editor=page.getByRole('region',{name:'Tulis pesan'});
 if(!process.env.ONLY || process.env.ONLY==='focus'){
 await page.waitForTimeout(180);
 assert.equal(await editor.evaluate(el=>el.contains(document.activeElement)),true,'opening focuses composer');
 for(let i=0;i<18;i++){await page.keyboard.press('Tab');assert.equal(await editor.evaluate(el=>el.contains(document.activeElement)||document.activeElement===document.body),true,'covered background cannot receive Tab');}
 }
 if(!process.env.ONLY || process.env.ONLY==='filename'){
 for(const name of ['report.','report\\2026.txt','a'.repeat(181)+'.txt']){
 await editor.getByLabel('Lampirkan file',{exact:true}).setInputFiles({name,mimeType:'text/plain',buffer:Buffer.from('safe')});
 assert.equal(await editor.locator('.au-compose-file').count(),0,'backend-incompatible name rejected before ready');
 await page.getByText(/Nama file tidak didukung/).waitFor();}
 }
 await editor.getByTitle('Tutup penulis pesan').click();
 if(!process.env.ONLY || process.env.ONLY==='focus'){await page.waitForTimeout(180);assert.equal(await open.evaluate(el=>el===document.activeElement),true,'close restores opener focus');}
 await page.locator('.au-mail-row').first().click();
 const reply=page.getByRole('button',{name:'Balas semua',exact:true});
 if(!process.env.ONLY || process.env.ONLY==='loading')assert.equal(await reply.isDisabled(),true,'Reply All waits for complete recipient metadata');
 while(!release)await page.waitForTimeout(10);release();
 await page.getByText('Source body',{exact:true}).waitFor();await reply.click();
 if(!process.env.ONLY || process.env.ONLY==='quoted')assert.equal(await editor.getByLabel('CC',{exact:true}).inputValue(),'jane@example.test, alex@example.test','quoted display-name commas are not mailbox separators');
 console.log('Compose review focus, filename boundary and Reply All recipient checks passed');
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
