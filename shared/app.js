import { CONFIG } from './config.js';
import { shell, $, esc, message } from './ui.js';
import { isLocal, usesSupabase } from './storage.js';
import { editorPage } from './editor.js';
import { dashboardPage } from './dashboard.js';
import { operationalPage } from './operational.js';
import { loadMusic, searchMusic } from './music.js';
const page=document.body.dataset.page;
const titles={home:'Início',list:'Programações',editor:'Programação do culto',live:'Culto ao Vivo',sound:'Sonoplastia',ceremony:'Cerimonial',stage:'Tela de Palco',music:'Músicas',settings:'Configurações'};
shell(titles[page],page,{stage:page==='stage'});
try {
  if(page==='home'||page==='list')dashboardPage(page==='list');
  else if(page==='editor')await editorPage();
  else if(['live','sound','ceremony','stage'].includes(page))operationalPage(page);
  else if(page==='music') {
    $('#content').innerHTML='<section class="v2-card"><h2>Banco de músicas</h2><p>Consulte os títulos e álbuns disponíveis. Para associar uma música, abra um momento na programação.</p><label class="v2-field">Buscar por nome ou álbum<input id="catalog-query" type="search" placeholder="Digite pelo menos 2 letras"></label><p id="catalog-count" role="status">Carregando…</p><div id="catalog-results"></div></section>';
    const db=await loadMusic();
    const render=()=>{const q=$('#catalog-query').value,results=searchMusic(db,q);$('#catalog-count').textContent=q.trim().length<2 ? `${db.length} músicas disponíveis. Digite para buscar.` : `${results.length} resultados${results.length>100?' · mostrando 100; refine a busca':''}`;$('#catalog-results').innerHTML=results.slice(0,100).map(m=>`<article class="catalog-item"><strong>${esc(m.nome)}</strong><span>${esc(m.albuns||'')}</span></article>`).join('');};
    $('#catalog-query').addEventListener('input',render);render();
  } else if(page==='settings') {
    $('#content').innerHTML=`<section class="v2-card"><h2>Configuração da aplicação</h2><dl class="facts"><div><dt>Armazenamento</dt><dd>${isLocal?'Local, neste navegador':usesSupabase?'Supabase PostgreSQL':'Compartilhado, via Cloudflare Function e JSONBin'}</dd></div><div><dt>Atualização entre aparelhos</dt><dd>${isLocal?'Indisponível no modo local':usesSupabase?'Realtime; polling somente durante reconexão':CONFIG.pollInterval/1000+' segundos'}</dd></div><div><dt>Versão dos dados</dt><dd>2 · coleção de cultos</dd></div></dl><p>As configurações de infraestrutura ficam em shared/config.js e nas variáveis do servidor. Não há contas ou senhas nesta etapa.</p><p>O checklist é separado por culto e usa a mesma origem de persistência da programação. Na versão publicada, programação e controle ao vivo são compartilhados entre aparelhos.</p></section>`;
  }
} catch(error) { $('#content').innerHTML='<section class="v2-card"><h2>Não foi possível carregar esta tela</h2><p>Verifique a conexão e a configuração da persistência.</p><button class="btn btn-secondary" id="retry">Tentar novamente</button></section>';$('#retry').onclick=()=>location.reload();message(error.message,true); }
