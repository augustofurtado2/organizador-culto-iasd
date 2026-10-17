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
 const fixture=await a.eval("fetch('fixtures/exemplo-sabado-2026-10-10.json').then(r=>r.json())"),id=fixture.id;
 const other=await a.eval(`(async()=>{const {applyOperation,uid}=await import('./shared/culto.js');let db={schemaVersion:2,revision:0,cultos:[${JSON.stringify(fixture)}],liveState:null};const other=uid();db=applyOperation(db,{type:'duplicate',id:'${id}',newId:other});db=applyOperation(db,{type:'start',id:'${id}'});db=applyOperation(db,{type:'next',id:'${id}'});db=applyOperation(db,{type:'checklist',id:'${id}',itemId:'${fixture.items[0].id}',completed:true});localStorage.setItem('iasd-cultos-v2',JSON.stringify(db));return other;})()`);
 await a.call('Emulation.setDeviceMetricsOverride',{width:375,height:850,deviceScaleFactor:1,mobile:true});
 await a.go('cerimonial.html');await a.wait('document.querySelector(".ceremony-current h2")?.textContent==="Louvor inicial"');
 assert.equal(await a.eval('document.querySelector("#check-count").textContent'),'1 de 13');
 assert.equal(await a.eval('document.querySelector(".ceremony-percent").textContent'),'8%');
 assert.equal(await a.eval('document.querySelectorAll("[data-check]").length'),13);
 assert.equal(await a.eval('document.querySelectorAll(".ceremony-current .ceremony-songs li").length'),3);
 assert.equal(await a.eval('document.querySelectorAll("[data-live],input[type=number],.editor-actions").length'),0);
 assert.equal(await a.eval('getComputedStyle(document.querySelector("#navigation")).display'),'none');
 assert.equal(await a.eval('document.querySelectorAll(".ceremony-after p").length'),2);
 assert.equal(await a.eval('document.querySelectorAll(".ceremony-item-live").length'),1);
 assert.equal(await a.eval('document.querySelectorAll(".ceremony-item-next").length'),1);
 assert.equal(await a.eval('document.querySelectorAll(".ceremony-item-pending").length'),10);
 assert.equal(await a.eval('document.querySelectorAll(".ceremony-section").length'),2);
 assert.ok(await a.eval('document.querySelector(".ceremony-next h2").textContent.includes("oração")'));
 assert.ok(await a.eval('document.querySelector(".ceremony-current .ceremony-planned").textContent.includes("09:32" )'));
 assert.ok(await a.eval('document.querySelector(".ceremony-real").textContent.includes("Iniciado às")'));
 assert.ok(!await a.eval('document.body.innerText.includes("undefined")||document.body.innerText.includes("null")'));
 await b.go('cerimonial.html?id='+id);await b.wait('!!document.querySelector("[data-check]")');
 await c.go('ao-vivo.html');await c.wait('!!document.querySelector("[data-live=next]")');
 const liveBefore=await a.eval("JSON.stringify(JSON.parse(localStorage.getItem('iasd-cultos-v2')).liveState)");
 const louvor=`[data-check="${fixture.items[1].id}"]`;
 await a.eval(`document.querySelector('${louvor}').focus()`);await a.click(louvor);await a.wait('document.querySelector("#check-count").textContent==="2 de 13"');await b.wait('document.querySelector("#check-count").textContent==="2 de 13"');
 assert.equal(await a.eval('document.activeElement.dataset.check'),fixture.items[1].id);
 assert.equal(await a.eval("JSON.stringify(JSON.parse(localStorage.getItem('iasd-cultos-v2')).liveState)"),liveBefore);
 assert.equal(await a.eval('document.querySelector(".ceremony-current h2").textContent'),'Louvor inicial');
 assert.ok(await a.eval(`document.querySelector('[data-ceremony-item="${fixture.items[1].id}"]').textContent.includes('AGORA')`));
 await a.click(louvor);await a.wait('document.querySelector("#check-count").textContent==="1 de 13"');
 await b.go('cerimonial.html?id='+other);await b.wait('document.querySelector("#check-count")?.textContent==="0 de 13"');
 assert.equal(await b.eval('document.querySelectorAll(".ceremony-current").length'),0);
 // Detalhes não devem fechar nem mover a consulta quando outra tela avança.
 await a.click(`[data-moment-details="${fixture.items[3].id}"] summary`);
 assert.ok(await a.eval(`document.querySelector('[data-moment-details="${fixture.items[3].id}"]').textContent.includes('Provai e Vede')`));
 assert.ok(await a.eval(`document.querySelector('[data-moment-details="${fixture.items[3].id}"]').textContent.includes('Música instrumental após o vídeo')`));
 await a.eval(`document.querySelector('[data-ceremony-item="${fixture.items[7].id}"]').scrollIntoView({block:'start'})`);
 await new Promise(r=>setTimeout(r,250));const scroll=await a.eval('scrollY'),beforeTop=await a.eval(`document.querySelector('[data-ceremony-item="${fixture.items[7].id}"]').getBoundingClientRect().top`);assert.ok(scroll>500);
 await c.click('[data-live=next]');await a.wait('document.querySelector(".ceremony-current h2")?.textContent.includes("oração")');
 await new Promise(r=>setTimeout(r,200));const afterTop=await a.eval(`document.querySelector('[data-ceremony-item="${fixture.items[7].id}"]').getBoundingClientRect().top`);assert.ok(Math.abs(afterTop-beforeTop)<6,`scroll anchor: before=${beforeTop}, after=${afterTop}, scroll=${scroll}`);
 assert.equal(await a.eval(`document.querySelector('[data-moment-details="${fixture.items[3].id}"]').open`),true);
 assert.equal(await a.eval('document.querySelector("#check-count").textContent'),'1 de 13');
 // Uma leitura inválida mantém o último estado e desabilita a marcação.
 const snapshot=await c.eval("localStorage.getItem('iasd-cultos-v2')");
 await c.eval("localStorage.setItem('iasd-cultos-v2','{broken')");
 await a.wait('document.querySelector("#ceremony-connection").textContent.includes("Reconectando")');
 assert.equal(await a.eval('document.querySelector("[data-check]").disabled'),true);
 assert.ok(await a.eval('document.querySelector(".ceremony-current h2").textContent.includes("oração")'));
 await c.eval(`localStorage.setItem('iasd-cultos-v2',${JSON.stringify(snapshot)})`);
 await a.wait('!document.querySelector("[data-check]").disabled');
 await a.call('Page.bringToFront');await a.eval("scrollTo({top:0,behavior:'instant'})");await c.click('[data-live=next]');await a.wait('document.querySelector(".ceremony-current h2")?.textContent==="Ofertório"');
 await new Promise(r=>setTimeout(r,900));assert.ok(await a.eval('{const r=document.querySelector(".ceremony-current").getBoundingClientRect();r.top>=0&&r.top<60}'));
 assert.equal(await a.eval('document.querySelectorAll(".ceremony-current .ceremony-responsible").length'),0);
 assert.equal(await a.eval('document.querySelectorAll(".ceremony-current .ceremony-songs").length'),0);
 for(const width of [375,768,1440]){
  await a.call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
  assert.equal(await a.eval('document.documentElement.scrollWidth<=innerWidth'),true,`overflow ${width}`);
  assert.equal(await a.eval('document.querySelector(".ceremony-check").getBoundingClientRect().width>=44'),true);
  assert.equal(await a.eval('document.querySelector(".ceremony-check").getBoundingClientRect().height>=44'),true);
  await a.screenshot(`/tmp/iasd-ceremony-${width}.png`);
 }
 await c.eval('window.confirm=()=>true');await c.click('[data-live=finish]');await a.wait('document.body.innerText.includes("Nenhum culto em andamento")');
 assert.equal(await a.eval('document.querySelectorAll(".ceremony-current,.ceremony-next").length'),0);
 await a.go('cerimonial.html?id='+id);await a.wait('!!document.querySelector("#check-count")');assert.equal(await a.eval('document.querySelector("#check-count").textContent'),'1 de 13');
 assert.equal(await a.eval('document.querySelectorAll(".ceremony-current").length'),0);
 assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);assert.deepEqual(c.errors,[]);
 console.log('OK Cerimonial: fixture 10/10, checklist independente, isolamento, três abas, atual/próximo, detalhes preservados, scroll, reconexão, histórico, celular e desktop.');
}finally{await a.close();await b.close();await c.close();}
