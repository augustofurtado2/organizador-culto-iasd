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

const a=await new BrowserTab().open(),b=await new BrowserTab().open();
try{
 await a.go('index.html');
 const fixture=await a.eval("fetch('fixtures/exemplo-sabado-2026-10-10.json').then(r=>r.json())"),id=fixture.id;
 await a.eval(`(async()=>{const {applyOperation}=await import('./shared/culto.js');let db={schemaVersion:2,revision:0,cultos:[${JSON.stringify(fixture)}],liveState:null};db=applyOperation(db,{type:'start',id:'${id}'});db=applyOperation(db,{type:'next',id:'${id}'});db.liveState.activeStartedAt=new Date(Date.now()-390000).toISOString();db.cultos[0].items[1].realStartedAt=db.liveState.activeStartedAt;localStorage.setItem('iasd-cultos-v2',JSON.stringify(db));})()`);
 await a.go('ao-vivo.html');await a.wait('document.querySelector(".live-now h2")?.textContent==="Louvor inicial"');
 assert.equal(await a.eval('document.querySelectorAll(".app-sidebar nav > a").length'),8);
 assert.equal(await a.eval('document.querySelector(".app-sidebar [aria-current=page]").textContent'),'Culto ao Vivo');
 assert.equal(await a.eval('document.querySelectorAll(".live-songs li").length'),3);
 assert.equal(await a.eval('document.querySelectorAll(".is-completed").length'),1);
 assert.equal(await a.eval('document.querySelectorAll(".is-live").length'),1);
 assert.equal(await a.eval('document.querySelectorAll(".is-next").length'),1);
 assert.equal(await a.eval('document.querySelectorAll(".is-pending").length'),10);
 assert.ok(await a.eval('document.querySelector(".live-next h2").textContent.includes("oração")'));
 assert.ok(await a.eval('document.querySelector("[data-elapsed]").textContent.startsWith("06:")'));
 assert.ok(await a.eval('document.querySelector("[data-remaining]").textContent.startsWith("03:")'));
 assert.ok(await a.eval('document.querySelector("[data-moment-progress]").value>=65'));
 assert.ok(await a.eval('document.querySelector(".live-total").textContent.includes("2h30min")'));
 assert.ok(await a.eval('document.querySelector(".live-total").textContent.includes("duração não definida")'));
 assert.equal(await a.eval('document.querySelectorAll("[data-live=pause]").length'),0);
 const revision=await a.eval("JSON.parse(localStorage.getItem('iasd-cultos-v2')).revision");
 await a.fill('#live-section-filter','ss');await a.eval("document.querySelector('#live-section-filter').dispatchEvent(new Event('change',{bubbles:true}))");
 assert.equal(await a.eval('document.querySelectorAll(".live-timeline-row").length'),2);
 assert.equal(await a.eval("JSON.parse(localStorage.getItem('iasd-cultos-v2')).revision"),revision);
 await a.fill('#live-section-filter','all');await a.eval("document.querySelector('#live-section-filter').dispatchEvent(new Event('change',{bubbles:true}))");
 await b.go('sonoplastia.html');await b.wait('document.querySelector(".live-focus h2")?.textContent==="Louvor inicial"');
 for(const width of [375,768,1440]){
  await a.call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
  assert.equal(await a.eval('document.documentElement.scrollWidth<=innerWidth'),true,`overflow ${width}`);
  await a.screenshot(`/tmp/iasd-live-${width}.png`);
 }
 await a.click('[data-live=next]');await a.wait('document.querySelector(".live-now h2")?.textContent.includes("oração")');await b.wait('document.querySelector(".live-focus h2")?.textContent.includes("oração")');
 assert.equal(await a.eval('document.querySelectorAll(".live-songs").length'),0);
 await a.click('[data-live=previous]');await a.wait('document.querySelector(".live-now h2")?.textContent==="Louvor inicial"');
 await a.click('.live-complete');await a.wait('document.querySelector(".live-now h2")?.textContent.includes("oração")');
 await a.click('[data-live=next]');await a.wait('document.querySelector(".live-now h2")?.textContent==="Ofertório"');
 assert.ok(await a.eval('document.querySelector(".live-details").textContent.includes("Provai e Vede")'));
 assert.ok(await a.eval('document.querySelector(".live-details").textContent.includes("Música instrumental após o vídeo")'));
 // Uma atualização recebida em outra aba deve invalidar a tela sem recarregar a página.
 await b.eval(`(async()=>{const {saveLiveState,loadCollection}=await import('./shared/storage.js');const db=await loadCollection();await saveLiveState('next','${id}',db.revision);})()`);
 await a.wait('document.querySelector(".live-now h2")?.textContent==="Mensagem musical"');
 const snapshot=await a.eval("localStorage.getItem('iasd-cultos-v2')");
 await b.eval("localStorage.setItem('iasd-cultos-v2','{broken')");
 await a.wait('document.querySelector("#live-connection").textContent.includes("Reconectando")');
 assert.equal(await a.eval('document.querySelector(".live-now h2").textContent'),'Mensagem musical');
 assert.equal(await a.eval('document.querySelector("[data-live=next]").disabled'),true);
 await b.eval(`localStorage.setItem('iasd-cultos-v2',${JSON.stringify(snapshot)})`);
 await a.wait('document.querySelector("#live-connection").textContent.includes("sincronizado")&&!document.querySelector("[data-live=next]").disabled');
 await a.eval('window.confirm=()=>false');await a.click('[data-live=finish]');assert.equal(await a.eval('!!document.querySelector(".live-now")'),true);
 await a.eval('window.confirm=()=>true');await a.click('[data-live=finish]');await a.wait('document.body.innerText.includes("Nenhum culto em andamento")');
 assert.equal(await a.eval('document.querySelectorAll(".live-now,[data-remaining],.live-songs").length'),0);
 assert.equal(await a.eval("JSON.parse(localStorage.getItem('iasd-cultos-v2')).cultos[0].status"),'finished');
 assert.ok(await a.eval("!!JSON.parse(localStorage.getItem('iasd-cultos-v2')).cultos[0].lastLiveState"));
 await a.go('ao-vivo.html?id='+id);await a.wait('!!document.querySelector("[data-live=start]")');await a.eval('window.confirm=()=>true');await a.click('[data-live=start]');await a.wait('!!document.querySelector(".live-now")');
 // A duração final ausente não deve gerar timer zero ou término inventado.
 await b.eval(`(async()=>{const {saveLiveState,loadCollection}=await import('./shared/storage.js');for(let n=0;n<12;n++){const db=await loadCollection();await saveLiveState('next','${id}',db.revision);}})()`);
 await a.wait('document.querySelector(".live-now h2")?.textContent==="Encerramento da Escola Sabatina"');
 assert.equal(await a.eval('document.querySelector("[data-remaining]").textContent'),'—:—');
 assert.equal(await a.eval('document.querySelector("[data-moment-progress]").hidden'),true);
 assert.equal(await a.eval('document.querySelector("[data-live=next]").disabled'),true);
 await a.eval('window.confirm=()=>true');await a.click('.live-complete');await a.wait('!!document.querySelector(".live-empty")');
 assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);
 console.log('OK operação ao vivo: fixture 10/10, timer real 6min30, quatro estados, filtro local, músicas, mídia, avanço/retorno/conclusão, duas abas, finalizar/cancelar, histórico, duração desconhecida e responsividade.');
}finally{await a.close();await b.close();}
