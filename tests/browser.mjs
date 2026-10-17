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
 async click(selector){await this.eval(`document.querySelector(${JSON.stringify(selector)}).click()`);}
 async fill(selector,value){await this.eval(`{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));}`);}
 async screenshot(path){const r=await this.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await fs.writeFile(path,Buffer.from(r.data,'base64'));}
 async close(){await fetch('http://127.0.0.1:9227/json/close/'+this.id);this.ws.close();}
}
const a=await new BrowserTab().open(), b=await new BrowserTab().open(), c=await new BrowserTab().open();
try {
 await a.go('index.html');await a.eval('localStorage.clear()');await a.go('index.html');await a.wait('document.body.innerText.includes("Nenhum culto programado.")');
 await a.go('programacao.html?new=1');await a.wait('!!document.querySelector("#editor-form")');await a.eval(`(()=>{window.confirm=()=>true;let n=0;while(document.querySelector('.moment-row')&&n++<50){document.querySelector('.moment-row [data-action=select]').click();document.querySelector('[data-action=remove]').click();}return n})()`);
 await a.fill('[name="title"]','Culto de teste A');await a.fill('[name="date"]','2026-10-17');await a.fill('[name="startTime"]','09:00');await a.fill('[name="elder"]','João');
 await a.click('[data-action="add"][data-section="culto"]');await a.fill('[data-item-field="label"]','Abertura');await a.fill('[data-item-field="duration"]','5');
 await a.click('[data-action="add"][data-section="culto"]');await a.fill('.editor-moment:last-child [data-item-field="label"]','Louvor');await a.fill('.editor-moment:last-child [data-item-field="duration"]','15');
 assert.equal(await a.eval('document.querySelectorAll("[id^=time-]")[1].textContent'),'09:05');
 await a.click('.moment-row:first-child [data-action=select]');await a.fill('[data-item-field="duration"]','10');assert.equal(await a.eval('document.querySelectorAll("[id^=time-]")[1].textContent'),'09:10');
 await a.click('.moment-row:last-child [data-action=select]');await a.click('.editor-moment:last-child [data-item-field="hasSongs"]');await a.click('.editor-moment:last-child [data-action="music"]');await a.wait('document.querySelector("#music-query") && !document.querySelector("#music-count").textContent.includes("Carregando")');await a.fill('#music-query','Tu És Fiel');await a.wait('!!document.querySelector("[data-choice]")');await a.click('[data-choice="0"]');await a.wait('!document.querySelector("#music-dialog").open');
 await a.click('#save-button');await a.wait('document.querySelector("#message").textContent==="Culto salvo."');
 const idA=await a.eval('new URLSearchParams(location.search).get("id")');
 await a.go('programacao.html?id='+idA);await a.wait('!!document.querySelector("#editor-form")');await a.click('.moment-row:last-child [data-action=select]');assert.ok((await a.eval('document.body.innerText')).includes('Tu És Fiel'));
 await a.go('programacao.html?new=1');await a.wait('!!document.querySelector("#editor-form")');await a.eval(`(()=>{window.confirm=()=>true;let n=0;while(document.querySelector('.moment-row')&&n++<50){document.querySelector('.moment-row [data-action=select]').click();document.querySelector('[data-action=remove]').click();}return n})()`);await a.fill('[name="title"]','Culto B');await a.fill('[name="date"]','2026-10-24');await a.click('[data-action="add"]');await a.fill('[data-item-field="label"]','Mensagem');await a.click('#save-button');await a.wait('document.querySelector("#message").textContent==="Culto salvo."');const idB=await a.eval('new URLSearchParams(location.search).get("id")');
 await a.go('programacao.html?id='+idA);await a.wait('!!document.querySelector("#editor-form")');await a.fill('[name="elder"]','Maria');await a.click('#save-button');await a.wait('document.querySelector("#message").textContent==="Culto salvo."');assert.equal(await a.eval(`JSON.parse(localStorage.getItem('iasd-cultos-v2')).cultos.find(c=>c.id==='${idB}').elder`),'');
 await a.go('ao-vivo.html?id='+idA);await a.wait('!!document.querySelector("[data-live=start]")');await a.click('[data-live="start"]');await a.wait('document.body.innerText.includes("AGORA")');
 await b.go('sonoplastia.html');await b.wait('document.querySelector(".live-focus h2")?.textContent==="Abertura"');
 await c.go('timer-culto.html');await c.wait('document.querySelector(".stage-title")?.textContent==="Abertura"');
 await a.click('[data-live="next"]');await b.wait('document.querySelector(".live-focus h2")?.textContent==="Louvor"');await c.wait('document.querySelector(".stage-title")?.textContent==="Louvor"');
 await b.go('cerimonial.html?id='+idA);await b.wait('!!document.querySelector("[data-check]")');await b.click('[data-check]');await b.wait('document.querySelector("#check-count")?.textContent==="1 de 2"');
 await b.go('cerimonial.html?id='+idB);await b.wait('document.querySelector("#check-count")?.textContent==="0 de 1"');
 await b.go('cerimonial.html?id='+idA);await b.wait('document.querySelector("#check-count")?.textContent==="1 de 2"');
 // Evitar diálogo interativo apenas no contexto isolado do teste.
 await a.eval('window.confirm=()=>true');await a.click('[data-live="finish"]');await a.wait('document.body.innerText.includes("Culto finalizado")');await c.wait('document.body.innerText.includes("Nenhum culto em andamento")');
 await b.go('sonoplastia.html');await b.wait('document.body.innerText.includes("Aguardando início do culto.")');
 const snapshot=await a.eval('JSON.parse(localStorage.getItem("iasd-cultos-v2"))');assert.equal(snapshot.cultos.find(c=>c.id===idA).status,'finished');assert.equal(snapshot.cultos.length,2);
 // Foco, leitura do catálogo e ausência de overflow em três larguras.
 for(const width of [375,768,1440]){
  await a.call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
  for(const page of ['index.html','programacoes.html','programacao.html?id='+idA,'ao-vivo.html?id='+idA,'sonoplastia.html?id='+idA,'cerimonial.html?id='+idA,'timer-culto.html','musicas.html','configuracoes.html']){
   await a.go(page);await a.wait('!document.querySelector("#content").textContent.includes("Carregando…")');
   assert.ok(await a.eval('document.documentElement.scrollWidth<=innerWidth+1'),`Overflow ${width} ${page}`);
  }
  await a.go('programacao.html?id='+idA);await a.wait('!!document.querySelector("#editor-form")');await a.screenshot('/tmp/iasd-v2-editor-'+width+'.png');
 }
 const errors=[...a.errors,...b.errors,...c.errors];assert.equal(errors.length,0,JSON.stringify(errors));
 console.log('OK navegador: 8 fluxos; músicas reais, 3 abas sincronizadas, checklist isolado, histórico e 9 telas em 375/768/1440px sem overflow.');
} finally {await Promise.all([a.close(),b.close(),c.close()]);}
