const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/brave-browser',headless:true});try{for(const width of [1440,768,390]){
 const page=await browser.newPage({viewport:{width,height:900}});let sends=0;
 let s={id:'fixture',revision:1,consent:false,accounts:[],messages:[],draft:null,pending:[],history_trimmed:false};
 const draft={sender_hint:'one@example.test',to:'hr@example.test',cc:'',bcc:'',subject:'Follow up',body:'Halo HR',local_datetime:'',timezone:'Asia/Jakarta'};
 await page.route('**/api/**',async r=>{const p=new URL(r.request().url()).pathname,m=r.request().method();
 if(p==='/api/accounts')return r.fulfill({json:[{id:'one',email:'one@example.test',provider:'google',gmail_modify:true}]});
 if(p==='/api/settings')return r.fulfill({json:{ai:{enabled:true,key_configured:true,model:'fixture',protocol:'openai_compatible',endpoint:'https://ai.example.test/chat'},appearance:null}});
 if(p.startsWith('/api/inbox/'))return r.fulfill({json:{messages:[],errors:[]}});
 if(p==='/api/assistant/sessions'&&m==='POST')return r.fulfill({json:s});
 if(p==='/api/assistant/sessions/fixture'){
  if(m==='PATCH'){const v=r.request().postDataJSON();s={...s,consent:v.consent,accounts:v.accounts,pending:[],revision:s.revision+1};}
  if(m==='DELETE')return r.fulfill({status:204});return r.fulfill({json:s});
 }
 if(p.endsWith('/turns')){const v=r.request().postDataJSON();if(v.text==='Failure test')return r.fulfill({status:502,body:'Jawaban AI terpotong karena batas panjang keluaran. Coba permintaan lebih singkat atau model lain; percakapan dan draf tetap disimpan.'});if(v.text==='Cancel test'){await new Promise(resolve=>page.once('close',resolve));return;}s.messages.push({role:'user',text:v.text,cards:[]});
  if(v.text==='Draft')s.draft={account_id:'one',draft:{...draft},source:null,mode:'new'};
  if(v.text==='Shorten')s.draft={...s.draft,draft:{...s.draft.draft,body:'Hi HR'}};
  s.messages.push({role:'assistant',text:v.text==='Hi'?'Halo! Ada yang ingin dibantu?':'Baik, lanjut.',cards:[]});s.revision++;return r.fulfill({json:s});}
 if(p.endsWith('/actions')){const v=r.request().postDataJSON();if(v.action.kind==='cancel_pending'){s.pending=[];s.revision++;return r.fulfill({json:s});}s.pending=[{id:'approval',action:v.action,email:s.draft,status:'pending',result:null}];s.revision++;return r.fulfill({json:s});}
 if(p.endsWith('/confirm')){sends++;s.pending[0].status='finished';s.pending[0].result={kind:'result',status:'succeeded',text:'Email terkirim melalui Gmail.',provider_id:'sent-fixture'};s.messages.push({role:'operation',text:'Hasil operasi',cards:[s.pending[0].result]});s.revision++;return r.fulfill({json:s});}
 throw Error('Unexpected API '+p);
 });
 await page.goto('http://127.0.0.1:4175');await page.getByRole('button',{name:'Buka asisten',exact:true}).click();
 const panel=page.getByRole('dialog',{name:'Aurora AI',exact:true});await panel.waitFor();
 const input=panel.getByLabel('Pesan ke asisten',{exact:true});await input.fill('Hi');assert.equal(await panel.getByRole('button',{name:'Kirim pesan',exact:true}).isDisabled(),true);
 await panel.getByLabel('Setuju mengirim percakapan ke penyedia AI').click();await page.waitForFunction(()=>!document.querySelector('.au-agent-optin'));
 await input.press('Enter');await panel.getByText('Halo! Ada yang ingin dibantu?',{exact:true}).waitFor();assert.equal(s.draft,null);
 await panel.getByRole('button',{name:'Privasi & akses',exact:true}).click();await panel.getByLabel('Izinkan one@example.test').click();await page.waitForFunction(()=>document.querySelector('[aria-label="Izinkan one@example.test"]')?.checked);await panel.getByRole('button',{name:'Selesai',exact:true}).click();
 for(const text of ['Draft','Unrelated topic','Shorten']){await input.fill(text);await input.press('Enter');await page.waitForFunction(text=>document.querySelector('[role="log"]')?.textContent.includes(text),text);await page.waitForFunction(()=>!document.querySelector('.au-assistant [aria-busy="true"]'));}
 await panel.getByText('Hi HR',{exact:true}).waitFor();assert.equal(sends,0);
 await input.fill('line one');await input.press('Shift+Enter');await input.type('line two');assert.match(await input.inputValue(),/\n/);await input.fill('');
 await panel.getByRole('button',{name:'Kirim sekarang',exact:true}).click();await panel.getByRole('button',{name:'Setujui kirim sekarang',exact:true}).waitFor();assert.equal(sends,0);assert.match(await panel.getByLabel('Konfirmasi tindakan').innerText(),/hr@example.test/);
 await panel.getByRole('button',{name:'Batalkan tindakan',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[aria-label="Konfirmasi tindakan"]'));assert.equal(sends,0);
 await panel.getByRole('button',{name:'Kirim sekarang',exact:true}).click();await panel.getByRole('button',{name:'Setujui kirim sekarang',exact:true}).click();await panel.getByRole('status').filter({hasText:'Email terkirim melalui Gmail.'}).waitFor();assert.equal(sends,1);
 await panel.getByRole('button',{name:'Tutup asisten',exact:true}).click();await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Buka asisten');
 await page.getByRole('button',{name:'Buka asisten',exact:true}).click();await panel.getByText('Hi HR',{exact:true}).waitFor();assert.equal(sends,1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await input.fill('Failure test');await input.press('Enter');await panel.getByRole('alert').filter({hasText:'Jawaban AI terpotong karena batas panjang keluaran.'}).waitFor();assert.equal(await input.inputValue(),'Failure test');await panel.getByText('Hi HR',{exact:true}).waitFor();assert.equal(sends,1);
 await panel.getByRole('button',{name:'Privasi & akses',exact:true}).click();await panel.getByRole('button',{name:'Selesai',exact:true}).click();
 await input.focus();const focus=await input.evaluate(el=>({textarea:getComputedStyle(el).outlineStyle,shadow:getComputedStyle(el).boxShadow,form:getComputedStyle(el.closest('form')).outlineStyle,radius:getComputedStyle(el.closest('form')).borderRadius}));assert.equal(focus.textarea,'none','focus ring belongs on rounded composer, not square textarea');assert.equal(focus.shadow,'none','inherited focus shadow must not add an inner box');assert.notEqual(focus.form,'none');assert.notEqual(focus.radius,'0px');
 await input.fill('Cancel test');await input.press('Enter');await panel.getByRole('status').filter({hasText:'Aurora sedang menyiapkan jawaban'}).waitFor();
 const stop=panel.getByRole('button',{name:'Hentikan jawaban',exact:true});await stop.waitFor();assert.equal(await stop.evaluate(el=>!!el.closest('footer')),true,'Stop must remain beside composer');
 assert.equal(await panel.locator('.au-agent-dots span').count(),3);await page.screenshot({path:`/tmp/aurora-loading-${width}.png`,animations:'disabled'});await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await panel.locator('.au-agent-dots span').first().evaluate(el=>getComputedStyle(el).animationName),'none');
 await stop.click();await page.waitForFunction(()=>!document.querySelector('.au-assistant [aria-busy="true"]'));assert.equal(await input.inputValue(),'Cancel test');assert.equal(await panel.getByRole('button',{name:'Kirim pesan',exact:true}).isEnabled(),true);
 await page.screenshot({path:`/tmp/aurora-chat-${width}.png`,animations:'disabled'});await page.close();
 console.log('Conversational assistant passed '+width);
 }
 for(const scenario of ['disabled','missing-key','settings-error','session-error']){
  const page=await browser.newPage();let attempts=0,turns=0;
  let s={id:'fixture',revision:1,consent:false,accounts:[],messages:[],draft:null,pending:[],history_trimmed:false};
  await page.route('**/api/**',async r=>{const p=new URL(r.request().url()).pathname,m=r.request().method();
   if(p==='/api/accounts')return r.fulfill({json:[]});
   if(p.startsWith('/api/inbox/'))return r.fulfill({json:{messages:[],errors:[]}});
   if(p==='/api/settings')return scenario==='settings-error'?r.fulfill({status:503,body:'Fixture settings unavailable'}):r.fulfill({json:{ai:{enabled:scenario!=='disabled',key_configured:scenario!=='missing-key',model:'fixture',protocol:'openai_compatible',endpoint:'https://ai.example.test/chat'},appearance:{theme:'dark',density:'comfortable',read_mode:'Adaptive'}}});
   if(p==='/api/assistant/sessions'&&m==='POST'){attempts++;if(scenario==='session-error'&&attempts===1)return r.fulfill({status:503,body:'Fixture session unavailable'});return r.fulfill({json:s});}
   if(p==='/api/assistant/sessions/fixture'){if(m==='PATCH'){s={...s,consent:r.request().postDataJSON().consent,revision:s.revision+1};}return r.fulfill({json:s});}
   if(p.endsWith('/turns')){turns++;s={...s,revision:s.revision+1,messages:[{role:'assistant',text:'Fixture recovered',cards:[]}]};return r.fulfill({json:s});}
   throw Error('Unexpected API '+p);
  });
  await page.goto('http://127.0.0.1:4175');await page.getByRole('button',{name:'Buka asisten',exact:true}).click();
  const panel=page.getByRole('dialog',{name:'Aurora AI',exact:true}),consent=panel.getByLabel('Setuju mengirim percakapan ke penyedia AI');
  await panel.getByLabel('Pesan ke asisten',{exact:true}).fill('Hi');
  if(scenario==='session-error'){
   await panel.getByRole('alert').filter({hasText:'Fixture session unavailable'}).waitFor();assert.equal(await consent.isDisabled(),true);
   await panel.getByRole('button',{name:'Mulai sesi baru',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.au-assistant [aria-busy="true"]'));
   assert.equal(await consent.isEnabled(),true);await consent.click();await page.waitForFunction(()=>!document.querySelector('.au-agent-optin'));
   await panel.getByRole('button',{name:'Kirim pesan',exact:true}).click();await panel.getByText('Fixture recovered',{exact:true}).waitFor();assert.equal(turns,1);
  }else{
   const message=scenario==='disabled'?'AI belum aktif. Aktifkan di Pengaturan.':scenario==='missing-key'?'API key belum tersedia. Tambahkan di Pengaturan.':'Pengaturan AI gagal dimuat: Error: Fixture settings unavailable';
   await panel.getByRole('status').filter({hasText:message}).waitFor();assert.equal(await consent.isDisabled(),true);
   assert.equal(await panel.getByRole('button',{name:'Kirim pesan',exact:true}).isDisabled(),true);assert.equal(turns,0);
   await panel.getByRole('button',{name:'Buka pengaturan AI',exact:true}).click();await panel.waitFor({state:'hidden'});
   await page.getByRole('heading',{name:'AI & Penulisan',exact:true}).waitFor();
  }
  await page.close();console.log('Assistant availability passed '+scenario);
 }
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
