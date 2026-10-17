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

const a=await new BrowserTab().open();
try {
 await a.go('index.html');
 const fixture=await a.eval("fetch('fixtures/exemplo-sabado-2026-10-10.json').then(r=>r.json())");
 await a.eval(`localStorage.setItem('iasd-cultos-v2',JSON.stringify({schemaVersion:2,revision:0,cultos:[${JSON.stringify(fixture)}],liveState:null}))`);
 await a.go('programacao.html?id='+fixture.id);await a.wait('!!document.querySelector("#editor-form")');
 assert.equal(await a.eval('document.querySelectorAll(".moment-row").length'),13);
 assert.deepEqual(await a.eval('[...document.querySelectorAll(".moment-time")].map(e=>e.textContent)'),fixture.items.map(i=>i.referenceTime));
 assert.equal(await a.eval('document.querySelector(".app-brand img").complete && document.querySelector(".app-brand img").naturalWidth>0'),true);
 assert.ok(await a.eval('document.querySelector("#header-date").textContent.includes("10 de outubro de 2026")'));
 assert.equal(await a.eval('document.querySelector("#header-status").textContent'),'Planejado');
 assert.equal(await a.eval('document.querySelectorAll(".app-sidebar nav a").length'),6);
 assert.ok(await a.eval(`document.querySelector('[data-nav="sound"]').href.endsWith('sonoplastia.html?id=${fixture.id}')`));
 const select=async index=>a.click(`[data-select="${fixture.items[index].id}"]`);
 await select(1);assert.equal(await a.eval('document.querySelectorAll(".song-editor").length'),3);
 await a.fill('[data-item-field=label]','Louvor de abertura');
 assert.ok(await a.eval('document.querySelector(".moment-row.is-selected").textContent.includes("Louvor de abertura")'));
 await select(7);await a.fill('[data-item-field=duration]','45');
 assert.equal(await a.eval('document.querySelectorAll(".moment-time")[11].textContent'),'11:10');
 await a.fill('[data-item-field=duration]','40');
 await select(4);await a.click('[data-action=down]');
 assert.equal(await a.eval(`document.getElementById('time-${fixture.items[4].id}').textContent`),'10:01');
 await a.click('[data-action=up]');
 await select(3);assert.equal(await a.eval('document.querySelector("[data-item-field=mediaTitle]").value'),'Provai e Vede');
 await a.click('[data-item-field=hasSongs]');await a.click('[data-action=music]');await a.wait('!!document.querySelector("#manual-song-title")');
 await a.fill('#manual-song-title','Canção de teste');await a.fill('#song-reference','CD de teste');await a.eval('document.querySelector("#manual-song-form").requestSubmit()');await a.wait('!document.querySelector("#music-dialog").open');
 assert.ok(await a.eval('document.querySelector("#moment-panel").textContent.includes("CD de teste — Canção de teste")'));
 await a.click('[data-action=close]');assert.equal(await a.eval('document.querySelectorAll("[data-item-field]").length'),0);
 await select(1);await a.click('.panel-save');await a.wait('document.querySelector("#save-state").textContent==="Programação carregada"');
 await a.go('programacao.html?id='+fixture.id);await a.wait('!!document.querySelector(".moment-row")');
 assert.ok(await a.eval('document.querySelectorAll(".moment-row")[1].textContent.includes("Louvor de abertura")'));
 await a.click('[data-action=add][data-section=culto]');assert.equal(await a.eval('document.querySelectorAll(".moment-row").length'),14);
 assert.equal(await a.eval('document.querySelector("[data-item-field=label]").value'),'Novo momento');
 await a.eval('window.confirm=()=>true');await a.click('[data-action=remove]');
 assert.equal(await a.eval('document.querySelectorAll(".moment-row").length'),13);
 await a.eval('document.querySelector(".program-settings").open=true');await a.click('[data-section-editor=ss] [data-action=section-up]');
 assert.equal(await a.eval('document.querySelector("[data-section-heading]").textContent'),'Escola Sabatina');
 await a.click('[data-section-editor=ss] [data-action=section-down]');
 await a.eval('document.querySelector(".program-settings").open=false');
 await a.click('[data-action=close]');
 for(const width of [375,768,1440,1920]){
  await a.call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
  await select(1);
  assert.equal(await a.eval('document.documentElement.scrollWidth<=innerWidth'),true,`overflow at ${width}`);
  assert.equal(await a.eval('getComputedStyle(document.querySelector("#moment-panel")).display!=="none"'),true);
  await a.screenshot(`/tmp/iasd-compact-${width}.png`);
  await a.click('[data-action=close]');
  await a.screenshot(`/tmp/iasd-shell-${width}.png`);
 }
 await a.click('#save-button');await a.wait('document.querySelector("#save-state").textContent==="Programação carregada"');
 await a.click('.program-toolbar [data-action=duplicate]');await a.wait(`new URLSearchParams(location.search).get('id')!==${JSON.stringify(fixture.id)}&&!!document.querySelector('#editor-form')`);
 assert.equal(await a.eval('document.querySelector("[name=date]").value'),'2026-10-17');
 assert.ok(await a.eval('document.querySelector("#header-date").textContent.includes("17 de outubro de 2026")'));
 assert.deepEqual(a.errors,[]);
 console.log('OK editor compacto: seleção, músicas, mídia, recálculo, reordenação, inclusão/exclusão, persistência e quatro larguras.');
} finally {await a.close();}
