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
 await a.go('index.html');const db=await a.eval('JSON.parse(localStorage.getItem("iasd-cultos-v2"))');
 const id=db.cultos[0].id, other=db.cultos[1].id;
 await a.go('programacao.html?id='+id);await a.wait('!!document.querySelector("#editor-form")');await a.fill('[name="elder"]','Edição preservada em conflito');
 await b.go('programacao.html?id='+other);await b.wait('!!document.querySelector("#editor-form")');await b.fill('[name="elder"]','Outro operador');await b.click('#save-button');await b.wait('document.querySelector("#message").textContent==="Culto salvo."');
 await a.click('#save-button');await a.wait('document.querySelector("#message").textContent.includes("Os dados mudaram")');assert.equal(await a.eval('document.querySelector("[name=elder]").value'),'Edição preservada em conflito');
 await a.eval('window.confirm=()=>true');await a.click('[data-action="reload"]');await a.wait('document.querySelector("#message").textContent==="Dados recarregados."');
 await a.click('[data-action="music"]');await a.wait('document.querySelector("#music-query") && !document.querySelector("#music-count").textContent.includes("Carregando")');await a.fill('#music-query','Porque Ele Vive');await a.wait('!!document.querySelector("[data-choice]")');await a.click('[data-choice="0"]');
 assert.equal(await a.eval('document.querySelectorAll(".song-editor").length'),2);
 const secondSong=await a.eval('document.querySelectorAll(".song-editor span")[1].textContent');await a.eval('document.querySelectorAll(".song-editor")[1].querySelector("[data-action=song-up]").click()');assert.equal(await a.eval('document.querySelector(".song-editor span").textContent'),secondSong);
 await a.eval('document.querySelectorAll(".song-editor")[1].querySelector("[data-action=song-remove]").click()');await a.click('#save-button');await a.wait('document.querySelector("#message").textContent==="Culto salvo."');
 await a.go('programacoes.html');await a.wait('!!document.querySelector("[data-action=duplicate]")');await a.click(`[data-action="duplicate"][data-id="${id}"]`);await a.wait('!!document.querySelector("#editor-form")');
 const copyId=await a.eval('new URLSearchParams(location.search).get("id")');const copyDb=await a.eval('JSON.parse(localStorage.getItem("iasd-cultos-v2"))');const original=copyDb.cultos.find(c=>c.id===id),copy=copyDb.cultos.find(c=>c.id===copyId);assert.notEqual(copyId,id);assert.equal(copy.status,'planned');assert.ok(!copy.lastLiveState);assert.ok(copy.items.every(i=>!original.items.some(j=>i.id===j.id)));
 await a.go('programacoes.html');await a.wait(`!!document.querySelector('[data-action="delete"][data-id="${copyId}"]')`);await a.eval('window.confirm=()=>true');await a.click(`[data-action="delete"][data-id="${copyId}"]`);await a.wait('JSON.parse(localStorage.getItem("iasd-cultos-v2")).cultos.length===2');
 await b.go('cerimonial.html?id='+id);await b.wait('!!document.querySelector("#check-count")');const validId=original.items[0].id;await b.eval(`{const db=JSON.parse(localStorage.getItem('iasd-cultos-v2'));db.cultos.find(c=>c.id==='${id}').checklistIds=['${validId}',...Array.from({length:12},(_,i)=>'invalido-'+i)];localStorage.setItem('iasd-cultos-v2',JSON.stringify(db));}`);await b.go('cerimonial.html?id='+id);await b.wait('document.querySelector("#check-count")?.textContent==="1 de 2"');
 await c.go('cerimonial.html?id='+id);await c.wait('document.querySelector("#check-count")?.textContent==="1 de 2"');
 await b.click('[data-check]');await c.wait('document.querySelector("#check-count")?.textContent==="0 de 2"');
 await b.click('[data-check]');await c.wait('document.querySelector("#check-count")?.textContent==="1 de 2"');
 await a.go('ao-vivo.html?id='+id);await a.wait('!!document.querySelector("[data-live=start]")');await a.eval('window.confirm=()=>true');await a.click('[data-live="start"]');await a.wait('!!document.querySelector(".live-focus")');
 await b.go('sonoplastia.html?id=inexistente');await b.wait('document.body.innerText.includes("Culto não encontrado.")');assert.equal(await b.eval('!!document.querySelector(".live-focus")'),false);
 await b.go('sonoplastia.html');await b.wait('!!document.querySelector(".live-focus")');await c.go('timer-culto.html');await c.wait('!!document.querySelector(".stage-display")');
 const snapshot=await a.eval('localStorage.getItem("iasd-cultos-v2")');await a.eval('localStorage.setItem("iasd-cultos-v2","invalid-json")');await b.wait('document.querySelector("#message").textContent.includes("Reconectando")');await c.wait('document.querySelector("#message").textContent.includes("Reconectando")');assert.ok(await b.eval('!!document.querySelector(".live-focus")'));assert.ok(await c.eval('!!document.querySelector(".stage-display")'));
 await a.eval(`localStorage.setItem('iasd-cultos-v2',${JSON.stringify(snapshot)})`);await b.wait('!!document.querySelector(".live-focus")');await c.wait('!!document.querySelector(".stage-display")');
 await a.wait('!!document.querySelector("[data-live=finish]")');await a.click('[data-live="finish"]');await a.wait('document.body.innerText.includes("Culto finalizado")');
 assert.equal([...a.errors,...b.errors,...c.errors].length,0);
 console.log('OK navegador: conflitos preservam formulário; ordenar/remover músicas; duplicar/excluir; checklist com IDs órfãos; ID inexistente sem fallback; falha de armazenamento preserva o último estado e recupera acompanhamento.');
} finally {await Promise.all([a.close(),b.close(),c.close()]);}
