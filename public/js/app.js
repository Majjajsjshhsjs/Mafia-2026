const State = {
  nick: localStorage.getItem('mafia_nick') || 'Игрок',
  avatar: localStorage.getItem('mafia_avatar') || '♟',
  roomCode: null, game: null, selected: null, selectedSecond: null
};
window.State = State;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('nickInput').value = State.nick;
  document.getElementById('avatarBtn').textContent = State.avatar;
  bindHome(); bindLobby(); bindGame();
  socket.emit('setProfile', { nick: State.nick, avatar: State.avatar });
});

function toast(text) {
  const root = document.getElementById('toastRoot');
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = text;
  root.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}
window.toast = toast;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
}

function saveProfile() {
  localStorage.setItem('mafia_nick', State.nick);
  localStorage.setItem('mafia_avatar', State.avatar);
  socket.emit('setProfile', { nick: State.nick, avatar: State.avatar });
}

function modal(title, html) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal">
    <button class="modal-close" onclick="document.getElementById('modalRoot').innerHTML=''">×</button>
    <h2>${title}</h2>${html}</div></div>`;
}

function bindHome() {
  const nickInput = document.getElementById('nickInput');
  nickInput.addEventListener('change', () => {
    State.nick = (nickInput.value || 'Игрок').trim().slice(0, 16);
    nickInput.value = State.nick; saveProfile();
  });
  document.getElementById('avatarBtn').addEventListener('click', () => {
    const avatars = ['♟','🕵️','🎩','🦊','🐺','🦁','👑','🃏','😎','🥷','🐱','🦉'];
    modal('Выберите аватар', `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
      ${avatars.map(a => `<button class="btn" onclick="pickAvatar('${a}')">${a}</button>`).join('')}</div>`);
  });
  document.getElementById('btnCreate').addEventListener('click', () => createRoom());
  document.getElementById('btnBots').addEventListener('click', () => createRoom({ botCount: 5 }));
  document.getElementById('btnJoin').addEventListener('click', () => {
    modal('Войти по коду', `<input id="joinCodeInput" placeholder="Код комнаты" maxlength="5" style="text-transform:uppercase">
      <button class="btn primary" onclick="doJoin()">Войти</button>`);
    setTimeout(() => document.getElementById('joinCodeInput')?.focus(), 50);
  });
  document.getElementById('btnPublic').addEventListener('click', () => {
    socket.emit('listRooms', (rooms) => {
      let html = '<div style="display:grid;gap:8px">';
      if (!rooms.length) html += '<p>Пока нет открытых комнат</p>';
      rooms.forEach(r => {
        html += `<button class="btn" style="justify-content:space-between" onclick="quickJoin('${r.code}')">
          <span>${r.code}</span><span>${r.players}/${r.max}</span></button>`;
      });
      html += '</div>';
      modal('Публичные комнаты', html);
    });
  });
  setInterval(() => {
    socket.emit('listRooms', (rooms) => {
      const total = rooms.reduce((s, r) => s + r.players, 0);
      document.getElementById('onlineCount').textContent = total;
    });
  }, 5000);
}

function pickAvatar(a) {
  State.avatar = a;
  document.getElementById('avatarBtn').textContent = a;
  document.getElementById('modalRoot').innerHTML = '';
  saveProfile();
}
window.pickAvatar = pickAvatar;

function createRoom(opts = {}) {
  socket.emit('createRoom', {
    nick: State.nick, avatar: State.avatar,
    maxPlayers: 10, botCount: opts.botCount || 0,
    dayTime: 90, nightTime: 45
  }, (res) => {
    if (!res.ok) return toast(res.error);
    State.roomCode = res.roomCode;
    toast('Комната создана: ' + res.roomCode);
  });
}
window.createRoom = createRoom;

function doJoin() {
  const code = document.getElementById('joinCodeInput').value.trim().toUpperCase();
  if (code.length < 4) return toast('Введите код');
  socket.emit('joinRoom', { code }, (res) => {
    if (!res.ok) return toast(res.error);
    State.roomCode = res.roomCode;
    document.getElementById('modalRoot').innerHTML = '';
    toast('Вы вошли в комнату');
  });
}
window.doJoin = doJoin;

function quickJoin(code) {
  socket.emit('joinRoom', { code }, (res) => {
    if (!res.ok) return toast(res.error);
    State.roomCode = res.roomCode;
    document.getElementById('modalRoot').innerHTML = '';
  });
}
window.quickJoin = quickJoin;

function bindLobby() {
  document.getElementById('btnStart').addEventListener('click', () => socket.emit('startGame'));
  document.getElementById('btnLeave').addEventListener('click', () => {
    socket.emit('leaveRoom');
    State.roomCode = null;
    showScreen('screen-home');
  });
  document.getElementById('btnCopyCode').addEventListener('click', () => {
    navigator.clipboard.writeText(State.roomCode).then(() => toast('Скопировано'));
  });
}

function bindGame() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.getElementById('chatTab').classList.toggle('hidden', target !== 'chat');
      document.getElementById('roleTab').classList.toggle('hidden', target !== 'role');
    });
  });
  document.getElementById('chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    socket.emit('chat', { text });
    input.value = '';
  });
}

socket.on('state', (state) => {
  State.game = state;
  if (state.phase === 'lobby') { showScreen('screen-lobby'); renderLobby(); }
  else { showScreen('screen-game'); renderGame(); }
});

socket.on('timer', ({ time }) => {
  const el = document.getElementById('timer');
  if (!el) return;
  el.textContent = String(Math.floor(time / 60)).padStart(2, '0') + ':' + String(time % 60).padStart(2, '0');
  el.classList.toggle('warning', time <= 10);
});

socket.on('chat', (msg) => appendChat(msg));
socket.on('mafiaChat', (msg) => appendChat({ ...msg, mafia: true }));
socket.on('feed', (item) => appendFeed(item.text));
socket.on('nightActionAck', () => toast('Действие принято'));
socket.on('investigationResult', ({ targetNick, isMafia }) => {
  modal('🕵️ Результат проверки', `<p><strong>${targetNick}</strong> — ${isMafia ? '🔪 МАФИЯ!' : '✅ не мафия'}</p>`);
});
socket.on('journalistResult', ({ same }) => {
  modal('📰 Результат сравнения', `<p>Игроки <strong>${same ? 'в одной команде' : 'в разных командах'}</strong></p>`);
});

function renderLobby() {
  const s = State.game;
  document.getElementById('lobbyCode').textContent = s.code;
  document.getElementById('lobbyCount').textContent = `${s.players.length} / ${s.settings.maxPlayers}`;
  document.getElementById('lobbySub').textContent = s.canStart ? 'Можно начинать' : `Нужно минимум 4 игрока (сейчас ${s.players.length})`;
  const grid = document.getElementById('lobbyPlayers');
  grid.innerHTML = '';
  s.players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'player-slot';
    div.innerHTML = `
      ${s.hostId === p.id ? '<span class="badge">👑</span>' : ''}
      <div class="avatar">${p.avatar}</div>
      <div class="name">${escapeHtml(p.nick)}</div>
      <div style="font-size:10px;color:#8a8f9e">${p.isBot ? '🤖 Бот' : '👤 Игрок'}</div>`;
    grid.appendChild(div);
  });
  for (let i = s.players.length; i < s.settings.maxPlayers; i++) {
    const div = document.createElement('div');
    div.className = 'player-slot empty';
    div.innerHTML = `<div class="avatar">＋</div><div class="name" style="color:#8a8f9e">Свободно</div>`;
    grid.appendChild(div);
  }
  document.getElementById('lobbySettings').innerHTML = `
    <div class="settings-list">
      <div class="settings-row"><span class="muted">Игроков</span><b>${s.players.length} / ${s.settings.maxPlayers}</b></div>
      <div class="settings-row"><span class="muted">Ботов</span><b>${s.players.filter(p => p.isBot).length}</b></div>
      <div class="settings-row"><span class="muted">День</span><b>${s.settings.dayTime}с</b></div>
      <div class="settings-row"><span class="muted">Ночь</span><b>${s.settings.nightTime}с</b></div>
    </div>`;
  const startBtn = document.getElementById('btnStart');
  startBtn.disabled = !s.canStart;
  startBtn.style.opacity = s.canStart ? '1' : '0.4';
  startBtn.style.display = s.isHost ? '' : 'none';
}

function renderGame() {
  const s = State.game;
  const you = s.you;
  if (!you) return;
  const isNight = s.phase === 'night';
  const phaseIcon = document.getElementById('phaseIcon');
  phaseIcon.textContent = isNight ? '🌙' : (s.phase === 'day_vote' ? '🗳️' : (s.phase === 'end' ? '🏆' : '☀️'));
  phaseIcon.classList.toggle('day', !isNight);
  const titles = { night: `Ночь ${s.round}`, day_discussion: `День ${s.round}`, day_vote: 'Голосование', end: 'Игра окончена' };
  document.getElementById('phaseTitle').textContent = titles[s.phase] || s.phase;
  const subs = {
    night: you.alive
      ? (you.roleId === 'MAFIA' || you.roleId === 'DON' ? 'Выберите жертву'
        : you.roleId === 'CIVILIAN' ? 'Спите'
        : you.roleId === 'JOURNALIST'
          ? (State.selected === null ? 'Первый игрок' : State.selectedSecond === null ? 'Второй игрок' : 'Готово')
          : 'Выберите цель')
      : 'Вы мертвы',
    day_discussion: 'Обсудите кандидатов',
    day_vote: 'Голосуйте за изгнание',
    end: s.winner === 'mafia' ? 'Мафия победила' : 'Город победил'
  };
  document.getElementById('phaseSub').textContent = subs[s.phase] || '';
  const table = document.getElementById('gamePlayers');
  table.innerHTML = '';
  s.players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'game-player';
    if (!p.alive) div.classList.add('dead');
    if (p.id === you.id) div.classList.add('you');
    if (State.selected === p.id || State.selectedSecond === p.id) div.classList.add('selected');
    const votesAgainst = (s.votes[p.id] || []).length;
    const youVoted = you.votedFor === p.id;
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    div.innerHTML = `
      ${youVoted ? '<div class="p-voted">✅</div>' : ''}
      ${votesAgainst > 0 ? `<div class="p-vote">${votesAgainst}</div>` : ''}
      <span class="p-avatar">${p.alive ? p.avatar : '💀'}</span>
      <div class="p-name">${escapeHtml(p.nick)}</div>`;
    div.onclick = () => onPlayerClick(p);
    div.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPlayerClick(p); }
    };
    table.appendChild(div);
  });
  renderFeed(); renderActionBar(); renderChat(); renderRole();
}

function renderFeed() {
  const s = State.game;
  const feed = document.getElementById('gameFeed');
  feed.innerHTML = '';
  (s.feed || []).forEach(f => {
    const line = document.createElement('div');
    line.className = 'feed-line' + (/ночь|день|победил|началась/i.test(f.text) ? ' system' : '');
    line.textContent = f.text;
    feed.appendChild(line);
  });
  feed.scrollTop = feed.scrollHeight;
}

function renderChat() {
  const s = State.game;
  const log = document.getElementById('chatLog');
  log.innerHTML = '';
  (s.chat || []).forEach(m => {
    const el = document.createElement('div');
    el.className = 'chat-msg';
    el.innerHTML = `<span class="who">${m.avatar || ''} ${escapeHtml(m.nick)}:</span> <span class="text">${escapeHtml(m.text)}</span>`;
    log.appendChild(el);
  });
  log.scrollTop = log.scrollHeight;
}

function appendChat(m) {
  const log = document.getElementById('chatLog');
  if (!log) return;
  const el = document.createElement('div');
  el.className = 'chat-msg';
  el.innerHTML = `<span class="who">${m.avatar || ''} ${escapeHtml(m.nick)}${m.mafia ? ' 🔪' : ''}:</span> <span class="text">${escapeHtml(m.text)}</span>`;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

function appendFeed(text) {
  const feed = document.getElementById('gameFeed');
  if (!feed) return;
  const line = document.createElement('div');
  line.className = 'feed-line' + (/ночь|день|победил|началась/i.test(text) ? ' system' : '');
  line.textContent = text;
  feed.appendChild(line);
  feed.scrollTop = feed.scrollHeight;
}

function renderRole() {
  const you = State.game.you;
  const info = ROLE_INFO[you.roleId] || ROLE_INFO.CIVILIAN;
  const card = document.getElementById('roleCard');
  card.innerHTML = `
    <div class="role-card">
      <div class="icon">${info.icon}</div>
      <div class="name">${info.name}</div>
      <div class="team">${info.team}</div>
      <div class="desc">${info.desc}</div>
      ${you.investigationResults?.length ? `
        <div style="margin-top:20px;text-align:left;font-size:12px;background:#0c0d13;padding:12px;border-radius:8px">
          <b>Ваши проверки:</b><br>
          ${you.investigationResults.map(r => `Раунд ${r.round}: <b>${r.targetNick}</b> — ${r.isMafia ? '🔪 мафия' : '✅ не мафия'}`).join('<br>')}
        </div>` : ''}
    </div>`;
}

function onPlayerClick(p) {
  const s = State.game;
  const you = s.you;
  if (!you || !you.alive || !p.alive || p.id === you.id) return;
  if (s.phase === 'night') {
    if (!you.roleId || you.roleId === 'CIVILIAN') return toast('У вас нет ночного действия');
    if ((you.roleId === 'MAFIA' || you.roleId === 'DON') && p.team === 'mafia') return toast('Нельзя выбрать своего');
    if (you.roleId === 'JOURNALIST') {
      if (State.selected === null) State.selected = p.id;
      else if (State.selectedSecond === null && State.selected !== p.id) State.selectedSecond = p.id;
      else { State.selected = p.id; State.selectedSecond = null; }
      renderGame();
      return;
    }
    State.selected = p.id;
    renderGame();
    if (window.Adaptive?.isTouch() && navigator.vibrate) navigator.vibrate(15);
  } else if (s.phase === 'day_vote' || s.phase === 'day_discussion') {
    if (you.votedFor !== null) return toast('Вы уже голосовали');
    State.selected = p.id;
    renderGame();
    if (window.Adaptive?.isTouch() && navigator.vibrate) navigator.vibrate(15);
  }
}

function renderActionBar() {
  const s = State.game;
  const you = s.you;
  const hint = document.getElementById('actionHint');
  const buttons = document.getElementById('actionButtons');
  buttons.innerHTML = ''; hint.textContent = '';
  if (!you.alive) { hint.textContent = '☠️ Вы мертвы. Наблюдайте.'; return; }

  if (s.phase === 'night') {
    if (you.roleId === 'CIVILIAN') hint.textContent = '😴 Вы мирный житель. Спите...';
    else if (you.roleId === 'MAFIA' || you.roleId === 'DON') {
      hint.textContent = State.selected !== null ? `Цель: ${s.players.find(p => p.id === State.selected)?.nick}` : 'Выберите жертву';
      if (State.selected !== null) {
        const btn = document.createElement('button');
        btn.className = 'btn primary'; btn.textContent = '🔪 Убить';
        btn.onclick = () => { socket.emit('nightAction', { targetId: State.selected }); State.selected = null; renderGame(); };
        buttons.appendChild(btn);
      }
    } else if (you.roleId === 'COMMISSAR') {
      hint.textContent = State.selected !== null ? `Проверить: ${s.players.find(p => p.id === State.selected)?.nick}` : 'Выберите игрока';
      if (State.selected !== null) {
        const btn = document.createElement('button');
        btn.className = 'btn primary'; btn.textContent = '🕵️ Проверить';
        btn.onclick = () => { socket.emit('nightAction', { targetId: State.selected }); State.selected = null; renderGame(); };
        buttons.appendChild(btn);
      }
    } else if (you.roleId === 'DOCTOR') {
      hint.textContent = State.selected !== null ? `Защитить: ${s.players.find(p => p.id === State.selected)?.nick}` : 'Выберите игрока';
      if (State.selected !== null) {
        const btn = document.createElement('button');
        btn.className = 'btn primary'; btn.textContent = '🩺 Защитить';
        btn.onclick = () => { socket.emit('nightAction', { targetId: State.selected }); State.selected = null; renderGame(); };
        buttons.appendChild(btn);
      }
    } else if (you.roleId === 'LOVER') {
      hint.textContent = State.selected !== null ? `Заблокировать: ${s.players.find(p => p.id === State.selected)?.nick}` : 'Выберите игрока';
      if (State.selected !== null) {
        const btn = document.createElement('button');
        btn.className = 'btn primary'; btn.textContent = '💋 Заблокировать';
        btn.onclick = () => { socket.emit('nightAction', { targetId: State.selected }); State.selected = null; renderGame(); };
        buttons.appendChild(btn);
      }
    } else if (you.roleId === 'JOURNALIST') {
      hint.textContent = State.selected !== null ? `Первый: ${s.players.find(p => p.id === State.selected)?.nick}` : 'Выберите первого';
      if (State.selected !== null && State.selectedSecond === null) hint.textContent += '. Выберите второго';
      if (State.selected !== null && State.selectedSecond !== null) {
        const btn = document.createElement('button');
        btn.className = 'btn primary'; btn.textContent = '📰 Сравнить';
        btn.onclick = () => {
          socket.emit('journalistCompare', { id1: State.selected, id2: State.selectedSecond });
          State.selected = null; State.selectedSecond = null; renderGame();
        };
        buttons.appendChild(btn);
      }
    }
  } else if (s.phase === 'day_discussion') {
    hint.textContent = '💬 Обсуждайте. Голосование начнётся автоматически.';
    if (State.selected !== null) {
      const btn = document.createElement('button');
      btn.className = 'btn primary'; btn.textContent = '🗳️ Голосовать';
      btn.onclick = () => { socket.emit('vote', { targetId: State.selected }); State.selected = null; renderGame(); };
      buttons.appendChild(btn);
    }
  } else if (s.phase === 'day_vote') {
    if (you.votedFor !== null) hint.textContent = '✅ Ваш голос учтён';
    else if (State.selected !== null) {
      const t = s.players.find(p => p.id === State.selected);
      hint.textContent = `Голосовать против ${t?.nick}?`;
      const btn = document.createElement('button');
      btn.className = 'btn primary'; btn.textContent = '🗳️ Голосовать';
      btn.onclick = () => { socket.emit('vote', { targetId: State.selected }); State.selected = null; renderGame(); };
      buttons.appendChild(btn);
    } else hint.textContent = 'Выберите игрока для голосования';
  } else if (s.phase === 'end') {
    hint.textContent = s.winner === 'mafia' ? '🔪 Мафия победила!' : '🏆 Город победил!';
    const btn = document.createElement('button');
    btn.className = 'btn primary'; btn.textContent = '← В меню';
    btn.onclick = () => {
      socket.emit('leaveRoom');
      State.roomCode = null; State.selected = null; State.selectedSecond = null;
      showScreen('screen-home');
    };
    buttons.appendChild(btn);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
