import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base='http://127.0.0.1:8097/';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
class BrowserTab {
 async open(){const t=await(await fetch('http://127.0.0.1:9227/json/new?about:blank',{method:'PUT'})).json();this.id=t.id;this.ws=new WebSocket(t.webSocketDebuggerUrl);this.pending=new Map();this.n=0;this.errors=[];await new Promise(r=>this.ws.onopen=r);this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')this.errors.push(m.params.exceptionDetails);};await this.call('Runtime.enable');await this.call('Page.enable');return this;}
 call(method,params={}){return new Promise((resolve,reject)=>{const id=++this.n;this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
 async eval(expression){const r=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
 async wait(expr){for(let i=0;i<100;i++){if(await this.eval(expr))return;await delay(100);}throw Error('Timeout: '+expr+'\n'+await this.eval('document.body.innerText'));}
 async go(path){await this.call('Page.navigate',{url:base+path});await this.wait('document.querySelector("#storage-mode")?.textContent.includes("Modo local")');await delay(150);}
 async selectItem(selector){const match=selector.match(/\[data-item="([^"]+)"\]/);if(match&&!await this.eval(`!!document.querySelector('[data-item="${match[1]}"]')`))await this.eval(`document.querySelector('[data-select="${match[1]}"]').click()`);}
 async click(selector){await this.selectItem(selector);await this.eval(`document.querySelector(${JSON.stringify(selector)}).click()`);}
 async fill(selector,value){await this.selectItem(selector);await this.eval(`{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));}`);}
 async screenshot(path){const r=await this.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await fs.writeFile(path,Buffer.from(r.data,'base64'));}
 async close(){await fetch('http://127.0.0.1:9227/json/close/'+this.id);this.ws.close();}
}

const a=await new BrowserTab().open(),b=await new BrowserTab().open(),c=await new BrowserTab().open();
try{
 await a.go('index.html');
 const fixture=await a.eval("fetch('fixtures/exemplo-sabado-2026-10-10.json').then(r=>r.json())");const id=fixture.id;
 await a.eval(`localStorage.setItem('iasd-cultos-v2',JSON.stringify({schemaVersion:2,revision:0,cultos:[${JSON.stringify(fixture)}],liveState:null}))`);
 await a.go('programacao.html?id='+id);await a.wait('!!document.querySelector("#editor-form")');
 assert.deepEqual(await a.eval('Array.from(document.querySelectorAll("[id^=time-]")).map(e=>e.textContent)'),fixture.items.map(i=>i.referenceTime));
 let songCount=0,videoCount=0;
 for(const item of fixture.items){await a.click(`[data-select="${item.id}"]`);songCount+=await a.eval('document.querySelectorAll(".song-editor").length');videoCount+=await a.eval('document.querySelector("[data-item-field=mediaType]").value==="video"?1:0');}
 assert.equal(songCount,5);assert.equal(videoCount,3);

 assert.equal(await a.eval('document.querySelectorAll("[data-item-field=duration]")[0].value'),'');
 await a.fill(`[data-item="${fixture.items[7].id}"] [data-item-field="duration"]`,'45');
 assert.equal(await a.eval('document.querySelectorAll("[id^=time-]")[11].textContent'),'11:10');
 await a.fill(`[data-item="${fixture.items[7].id}"] [data-item-field="duration"]`,'40');
 await a.click(`[data-item="${fixture.items[4].id}"] [data-action="down"]`);assert.equal(await a.eval(`document.getElementById('time-${fixture.items[4].id}').textContent`),'10:01');
 assert.equal(await a.eval(`[...document.querySelectorAll('[data-item-field=responsible]')].find(e=>e.closest('[data-item]').dataset.item==='${fixture.items[4].id}').value`),'Grupo Vocal Boa Vista');
 await a.click(`[data-item="${fixture.items[4].id}"] [data-action="up"]`);
 await a.click('[data-section-editor="ss"] [data-action="section-up"]');
 assert.equal(await a.eval('document.querySelector("[data-section-heading]").textContent'),'Escola Sabatina');
 await a.click('[data-section-editor="ss"] [data-action="section-down"]');
 await a.click('[data-action="section-add"]');await a.wait('document.querySelectorAll("[data-section-editor]").length===3');
 await a.fill('.section-editor:last-child [data-section-field="label"]','Programa da tarde');await a.eval('window.confirm=()=>true');await a.click('.section-editor:last-child [data-action="section-remove"]');
 await a.click(`[data-item="${fixture.items[3].id}"] [data-item-field="hasSongs"]`);await a.click(`[data-item="${fixture.items[3].id}"] [data-action="music"]`);await a.wait('!!document.querySelector("#manual-song-title")');
 await a.fill('#manual-song-title','Canção de teste fora do catálogo');await a.fill('#song-reference','CD de teste');await a.eval('document.querySelector("#manual-song-form").requestSubmit()');await a.wait('!document.querySelector("#music-dialog").open');
 assert.ok(await a.eval('document.body.innerText.includes("CD de teste — Canção de teste fora do catálogo")'));
 await a.click(`[data-item="${fixture.items[3].id}"] [data-action="song-remove"]`);
 await a.click(`[data-item="${fixture.items[3].id}"] [data-item-field="hasSongs"]`);
 await a.fill(`[data-item="${fixture.items[3].id}"] [data-item-field="mediaTitle"]`,'Provai e Vede');
 await a.eval(`{const field=document.querySelector('[data-item="${fixture.items[3].id}"] [data-item-field=mediaType]');field.value='none';field.dispatchEvent(new Event('input',{bubbles:true}));}`);
 assert.equal(await a.eval(`document.querySelector('[data-item="${fixture.items[3].id}"] [data-media-title-field]').hidden`),true);
 await a.eval(`{const field=document.querySelector('[data-item="${fixture.items[3].id}"] [data-item-field=mediaType]');field.value='video';field.dispatchEvent(new Event('input',{bubbles:true}));}`);
 await a.click('#save-button');await a.wait('document.querySelector("#message").textContent==="Culto salvo."');
 await b.go('sonoplastia.html?id='+id);await b.wait('document.querySelectorAll(".timeline-moment").length===13');
 assert.equal(await b.eval('document.querySelectorAll(".selected-songs li").length'),5);assert.ok(await b.eval('document.body.innerText.includes("Provai e Vede")'));assert.ok(await b.eval('document.body.innerText.includes("Música instrumental após o vídeo")'));assert.ok(!await b.eval('document.body.innerText.includes("Responsável não definido")'));
 await b.go('cerimonial.html?id='+id);await b.wait('!!document.querySelector("#check-count")');assert.equal(await b.eval('document.querySelector("#check-count").textContent'),'0 de 13');
 await a.go('ao-vivo.html?id='+id);await a.wait('!!document.querySelector("[data-live=start]")');await a.click('[data-live="start"]');await a.wait('document.querySelector(".live-focus h2")?.textContent==="Boas-vindas"');
 await c.go('timer-culto.html');await c.wait('document.querySelector(".stage-display h1")?.textContent==="Boas-vindas"');assert.equal(await c.eval('document.querySelector(".stage-responsible").textContent'),'Decio');
 for(let n=1;n<=10;n++){await a.click('[data-live="next"]');await a.wait(`document.querySelector('.live-focus h2')?.textContent===${JSON.stringify(fixture.items[n].label)}`);}
 await c.wait(`document.querySelector('.stage-display h1')?.textContent===${JSON.stringify(fixture.items[10].label)}`);
 assert.equal(await c.eval('!!document.querySelector(".stage-responsible")'),false);
 await a.click('[data-live="next"]');await a.wait(`document.querySelector('.live-focus h2')?.textContent===${JSON.stringify(fixture.items[11].label)}`);
 await a.click('[data-live="next"]');await c.wait('document.querySelector(".stage-display h1")?.textContent==="Encerramento da Escola Sabatina"');assert.equal(await c.eval('document.querySelector("[data-remaining]").textContent'),'—:—');assert.equal(await c.eval('document.querySelector(".stage-caption").textContent'),'Duração não definida');
 await a.eval('window.confirm=()=>true');await a.click('[data-live="finish"]');await a.wait('document.body.innerText.includes("Culto finalizado")');
 await a.go('programacoes.html');await a.wait('!!document.querySelector("[data-action=duplicate]")');await a.click(`[data-action="duplicate"][data-id="${id}"]`);await a.wait('!!document.querySelector("#editor-form")');assert.equal(await a.eval('document.querySelector("[name=date]").value'),'2026-10-17');assert.equal(await a.eval('document.querySelectorAll(".moment-row").length'),13);
 for(const width of [375,768,1440]){
  await a.call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
  for(const page of ['programacao.html?id='+id,'sonoplastia.html?id='+id,'cerimonial.html?id='+id]){await a.go(page);await a.wait('!document.querySelector("#content").textContent.includes("Carregando…")');assert.ok(await a.eval('document.documentElement.scrollWidth<=innerWidth+1'),`${page} ${width}`);}
  if(width===375){await a.go('programacao.html?id='+id);await a.wait('!!document.querySelector("#editor-form")');await a.screenshot('/tmp/iasd-real-program-mobile.png');}
 }
 assert.equal([...a.errors,...b.errors,...c.errors].length,0);console.log('OK Chrome sábado real: editor, seções ordenáveis, recálculo, música manual, mídia contextual, 13 momentos/5 músicas, transição e duração desconhecida no palco, duplicação e responsividade.');
}finally{await Promise.all([a.close(),b.close(),c.close()]);}
