import { uid } from './culto.js';
import { $, esc } from './ui.js';
let database,pending,pickerGeneration=0;
export async function loadMusic() {
  if (database) return database;
  if (!pending) pending = fetch('data/musicas.json').then(r => { if (!r.ok) throw new Error('Não foi possível carregar o banco de músicas.'); return r.json(); }).then(data => { if (!Array.isArray(data)) throw new Error('Banco de músicas inválido.'); database = data; return data; }).finally(()=>{ pending = null; });
  return pending;
}
const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export function searchMusic(db, query) { const q = fold(query.trim()); return q.length < 2 ? [] : db.filter(m => fold(m.nome).includes(q) || fold(m.albuns).includes(q)); }
export async function openPicker(onSelect) {
  const generation=++pickerGeneration;
  const dialog = $('#music-dialog');
  dialog.innerHTML = `<form method="dialog" class="section-heading"><h2>Selecionar música</h2><button class="btn btn-secondary">Fechar</button></form><label for="music-query">Buscar por nome ou álbum</label><input id="music-query" type="search" autocomplete="off" placeholder="Digite pelo menos 2 letras"><label for="song-reference">Referência opcional (nº do hinário ou CD)</label><input id="song-reference" placeholder="Ex.: 564 ou CD Jovem"><p id="music-count" role="status">Carregando banco…</p><div id="music-results" class="music-picker-results"></div><form id="manual-song-form" class="manual-song"><h3>Música não encontrada?</h3><label for="manual-song-title">Título manual para este culto</label><input id="manual-song-title" required placeholder="Nome da música"><button class="btn btn-secondary" type="submit">Adicionar título manual</button></form>`;
  dialog.showModal(); const input = $('#music-query'); input.focus();
  $('#manual-song-form').onsubmit=event=>{event.preventDefault();const title=$('#manual-song-title').value.trim();if(!title)return;onSelect({id:uid(),songId:null,title,reference:$('#song-reference').value.trim()});dialog.close();};
  try {
    const db = await loadMusic();
    if (!dialog.open || generation!==pickerGeneration) return;
    const render = () => {
      const all = searchMusic(db,input.value), limited = all.slice(0,100);
      $('#music-count').textContent = input.value.trim().length < 2 ? `${db.length} músicas · digite pelo menos 2 letras.` : `${all.length} resultados${all.length > 100 ? ' · mostrando 100; refine a busca' : ''}`;
      $('#music-results').innerHTML = limited.map((m,index)=>`<button type="button" class="music-choice" data-choice="${index}"><strong>${esc(m.nome)}</strong><span>${esc(m.albuns || '')}</span></button>`).join('');
      $('#music-results').onclick = e => { const b = e.target.closest('[data-choice]'); if (b) { const song=limited[+b.dataset.choice];onSelect({id:uid(),songId:song.id==null?null:String(song.id),title:song.nome,reference:$('#song-reference').value.trim()}); dialog.close(); } };
    };
    input.oninput = render; render();
  } catch(e) { if(dialog.open&&generation===pickerGeneration)$('#music-count').textContent = e.message; }
}
