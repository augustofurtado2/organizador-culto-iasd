// Tela de palco (timer-culto.html): painel widescreen de leitura à distância.
// Só apresentação: dados e tempos vêm de liveView() em culto.js.
import { enabledItems, countdown, songLabel, MEDIA_TYPES } from './culto.js';
import { esc, plannedWindow } from './ui.js';
import { timelineState } from './live-screen.js';

const minutes = value => `${value} ${value === 1 ? 'minuto' : 'minutos'}`;
const longDate = value => {
  const date = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T12:00:00') : new Date();
  const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const now = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// Faixas do timer: >30% restante = normal, 10–30% = atenção, <10% = final, passou = excedido.
export function timerLevel(view) {
  const total = view.active.duration == null ? null : view.active.duration * 60;
  if (total == null) return 'unknown';
  if (view.overtime) return 'over';
  const left = total === 0 ? 0 : view.remaining / total;
  return left > .3 ? 'ok' : left >= .1 ? 'warn' : 'danger';
}
const captions = { ok: 'minutos restantes', warn: 'minutos restantes · reta final', danger: 'minutos restantes · encerrando', over: 'tempo excedido', unknown: 'Duração não definida' };
function timerText(view) {
  if (view.active.duration == null) return countdown(null); // sem duração: não inventa contagem
  return view.overtime ? '+' + countdown(view.elapsed - view.active.duration * 60) : countdown(view.remaining);
}

function topBar(date) {
  return `<div class="stage-top"><div class="stage-brand"><img src="assets/adventist-symbol-white.svg" alt="" width="44" height="44"><div><strong>Igreja Adventista do Sétimo Dia</strong><span>Boa Vista</span></div></div><div class="stage-meta"><div class="stage-when"><span>${esc(longDate(date))}</span><time class="stage-now" data-clock>${now()}</time></div><div class="stage-sync" data-stage-sync role="status"></div></div></div>`;
}

export function stageEmpty(c = null) {
  return `<div class="stage-screen">${topBar(c?.date)}<section class="stage-idle"><h1>Nenhum culto em andamento</h1><p>Aguardando início da programação.</p>${c ? `<p class="stage-idle-culto">${esc(c.title)}</p>` : ''}</section></div>`;
}

function shortTimeline(c, view) {
  const items = enabledItems(c), index = items.findIndex(i => i.id === view.active.id);
  const start = Math.max(0, Math.min(index - 2, items.length - 5));
  const marks = { completed: ['✓', 'Concluído'], live: ['●', 'Agora'], next: ['○', 'Próximo'], pending: ['○', 'A seguir'] };
  return `<ol class="stage-timeline">${items.slice(start, start + 5).map(i => {
    const state = timelineState(i, view), [mark, label] = marks[state];
    return `<li class="is-${state}" ${state === 'live' ? 'aria-current="step"' : ''}><time>${esc(i.computedTime || '—')}</time><span class="stage-mark" aria-hidden="true">${mark}</span><span class="stage-tl-name">${esc(i.label)}</span><span class="visually-hidden">${label}</span></li>`;
  }).join('')}</ol>`;
}

export function stageScreen(c, view) {
  const a = view.active, level = timerLevel(view);
  const media = a.mediaType && a.mediaType !== 'none' ? `${MEDIA_TYPES[a.mediaType] || 'Mídia'}${a.mediaTitle ? ' · ' + a.mediaTitle : ''}` : '';
  const sub = [media && `<span class="stage-media">${esc(media)}</span>`, a.responsible && `<span class="stage-who">${esc(a.responsible)}</span>`].filter(Boolean);
  const songs = a.hasSongs ? a.songs.filter(s => songLabel(s)) : [];
  const total = a.duration == null ? null : a.duration * 60;
  const details = (a.note ? `<div class="stage-note"><span>Observação</span><p>${esc(a.note)}</p></div>` : '')
    + (songs.length ? `<div class="stage-songs"><span>Músicas deste momento</span><ol>${songs.map(s => `<li>${esc(songLabel(s))}</li>`).join('')}</ol></div>` : '');
  const n = view.next;
  return `<div class="stage-screen" data-level="${level}">${topBar(c.date)}
  <main class="stage-center">
    <span class="stage-live">● AGORA</span>
    <h1 class="stage-title">${esc(a.label)}</h1>
    ${sub.length ? `<p class="stage-sub">${sub.join('<span aria-hidden="true"> · </span>')}</p>` : ''}
    <p class="stage-window">Previsto: ${esc(plannedWindow(a))}${a.duration == null ? '' : ' • ' + minutes(a.duration)}</p>
    <div class="stage-timer" data-stage-timer>${timerText(view)}</div>
    <p class="stage-caption" data-stage-caption>${captions[level]}</p>
    ${total == null ? `<div class="stage-progress is-open"><div class="stage-time"><span>Decorridos</span><strong data-elapsed>${countdown(view.elapsed)}</strong></div></div>`
      : `<div class="stage-progress"><div class="stage-time"><span>Decorridos</span><strong data-elapsed>${countdown(view.elapsed)}</strong></div><div class="stage-bar" role="progressbar" aria-label="Tempo decorrido do momento" aria-valuemin="0" aria-valuemax="100" data-stage-bar><span style="width:${total === 0 ? 100 : Math.min(100, view.elapsed / total * 100)}%"></span></div><div class="stage-time"><span>Total</span><strong>${countdown(total)}</strong></div></div>`}
    ${details ? `<div class="stage-details">${details}</div>` : ''}
  </main>
  <footer class="stage-bottom">
    <section class="stage-next"><span class="stage-label">Próximo</span>${n ? `<h2>${esc(n.label)}</h2>${n.responsible ? `<p class="stage-next-who">${esc(n.responsible)}</p>` : ''}<p class="stage-next-when">${esc(n.computedTime || 'Horário não definido')}${n.duration == null ? '' : ' • ' + minutes(n.duration)}</p><p class="stage-next-in" data-next-in></p>` : '<h2>Último momento</h2><p class="stage-next-when">Encerramento da programação</p>'}</section>
    <section class="stage-sequence"><span class="stage-label">Sequência</span>${shortTimeline(c, view)}</section>
  </footer></div>`;
}

// Atualização a cada segundo, sem reconstruir a tela.
export function stageTick(view) {
  for (const el of document.querySelectorAll('[data-clock]')) el.textContent = now();
  const screen = document.querySelector('.stage-screen[data-level]');
  if (!screen || !view) return;
  const level = timerLevel(view), total = view.active.duration == null ? null : view.active.duration * 60;
  screen.dataset.level = level;
  document.querySelector('[data-stage-timer]').textContent = timerText(view);
  document.querySelector('[data-stage-caption]').textContent = captions[level];
  const bar = document.querySelector('[data-stage-bar]');
  if (bar && total != null) { const p = total === 0 ? 100 : Math.min(100, Math.round(view.elapsed / total * 100)); bar.firstElementChild.style.width = p + '%'; bar.setAttribute('aria-valuenow', p); }
  for (const el of document.querySelectorAll('[data-elapsed]')) el.textContent = countdown(view.elapsed);
  const nextIn = document.querySelector('[data-next-in]');
  if (nextIn) nextIn.textContent = total == null ? '' : view.overtime ? 'Assim que o momento atual terminar' : view.remaining < 60 ? 'Em menos de 1 minuto' : `Em ${minutes(Math.ceil(view.remaining / 60))}`;
}

export function stageSync(state) {
  const el = document.querySelector('[data-stage-sync]'); if (!el) return;
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const key = offline ? 'offline' : state === 'reconnecting' ? 'reconnecting' : 'synced';
  const text = { synced: ['● Sincronizado', state === 'local' ? 'Modo local · entre abas' : state === 'polling' ? 'Atualização periódica' : 'Dados em tempo real'], reconnecting: ['Reconectando…', 'Mantendo o último estado'], offline: ['● Offline', 'Sem conexão com a internet'] }[key];
  el.dataset.state = key;
  el.innerHTML = `<strong>${text[0]}</strong><span>${text[1]}</span>`;
}
