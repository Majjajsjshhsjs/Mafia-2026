const Player = require('./Player');
const { generateRoles, shuffle } = require('./roles');

const PHASES = { LOBBY: 'lobby', NIGHT: 'night', DAY_DISCUSSION: 'day_discussion', DAY_VOTE: 'day_vote', END: 'end' };

class Game {
  constructor({ code, io, host, settings = {} }) {
    this.code = code;
    this.io = io;
    this.hostId = host.id;
    this.players = [];
    this.phase = PHASES.LOBBY;
    this.round = 0;
    this.timer = null;
    this.timeLeft = 0;
    this.settings = {
      maxPlayers: settings.maxPlayers || 10,
      dayTime: settings.dayTime || 90,
      nightTime: settings.nightTime || 45,
      isPrivate: settings.isPrivate || false
    };
    this.chat = [];
    this.feed = [];
    this.votes = {};
    this.winner = null;
  }

  addPlayer(socket, nick, avatar) {
    if (this.players.length >= this.settings.maxPlayers) throw new Error('Комната заполнена');
    if (this.phase !== PHASES.LOBBY) throw new Error('Игра уже началась');
    if (this.players.some(p => p.socketId === socket.id)) throw new Error('Вы уже в комнате');
    const id = this.players.length;
    const player = new Player({ id, socketId: socket.id, nick: nick || `Игрок ${id + 1}`, avatar: avatar || '♟' });
    this.players.push(player);
    return player;
  }

  addBot() {
    if (this.players.length >= this.settings.maxPlayers) return null;
    const id = this.players.length;
    const names = ['Алиса', 'Марк', 'Соня', 'Денис', 'Лера', 'Тимур', 'Мила', 'Егор', 'Ника', 'Арсений'];
    const bot = new Player({
      id, socketId: `bot_${this.code}_${id}`,
      nick: names[id % names.length] + (id >= names.length ? `-${id}` : ''),
      avatar: ['🦊', '🐺', '🦁', '🐱', '🦉', '🐯', '🐸', '🐼'][id % 8],
      isBot: true
    });
    bot.ready = true;
    this.players.push(bot);
    return bot;
  }

  removePlayer(socketId) {
    const idx = this.players.findIndex(p => p.socketId === socketId);
    if (idx === -1) return;
    if (this.phase === PHASES.LOBBY) {
      this.players.splice(idx, 1);
      this.players.forEach((p, i) => p.id = i);
    } else {
      this.players[idx].alive = false;
      this.players[idx].socketId = null;
    }
    this.broadcast();
  }

  hasPlayer(socketId) { return this.players.some(p => p.socketId === socketId); }
  getPlayer(socketId) { return this.players.find(p => p.socketId === socketId); }
  getPlayerById(id) { return this.players.find(p => p.id === id); }

  start() {
    if (this.phase !== PHASES.LOBBY) return;
    if (this.players.length < 4) throw new Error('Нужно минимум 4 игрока');
    const roles = generateRoles(this.players.length);
    const shuffled = shuffle(this.players);
    shuffled.forEach((p, i) => { p.roleId = roles[i]; });
    this.phase = PHASES.NIGHT;
    this.round = 1;
    this.players.forEach(p => { p.ready = false; p.alive = true; });
    this.addFeed('🎬 Игра началась! Роли розданы.');
    this.startNight();
  }

  startNight() {
    this.phase = PHASES.NIGHT;
    this.players.forEach(p => p.resetNight());
    this.addFeed(`🌙 Наступает ночь ${this.round}...`);
    this.timeLeft = this.settings.nightTime;
    this.broadcast();
    this.runTimer(() => this.endNight());
    this.botNightActions();
  }

  handleNightAction(socketId, targetId) {
    if (this.phase !== PHASES.NIGHT) return;
    const player = this.getPlayer(socketId);
    if (!player || !player.alive || player.blocked) return;
    const target = this.getPlayerById(targetId);
    if (!target || !target.alive) return;
    if (!player.role.nightAction) return;
    player.nightTarget = targetId;
    this.emitToPlayer(player, 'nightActionAck', { targetId });
    this.broadcast();
  }

  handleJournalistCompare(socketId, id1, id2) {
    if (this.phase !== PHASES.NIGHT) return;
    const player = this.getPlayer(socketId);
    if (!player || !player.alive || player.roleId !== 'JOURNALIST') return;
    player.nightTarget = id1;
    player.secondTarget = id2;
    const p1 = this.getPlayerById(id1);
    const p2 = this.getPlayerById(id2);
    if (p1 && p2) this.emitToPlayer(player, 'journalistResult', { same: p1.team === p2.team });
  }

  endNight() {
    if (this.phase !== PHASES.NIGHT) return;
    clearInterval(this.timer);
    const mafia = this.players.filter(p => p.alive && p.isMafia && !p.blocked);
    const doctor = this.players.find(p => p.alive && p.roleId === 'DOCTOR' && !p.blocked);
    const commissar = this.players.find(p => p.alive && p.roleId === 'COMMISSAR' && !p.blocked);
    let victim = null;
    const targets = mafia.map(m => m.nightTarget).filter(Boolean);
    if (targets.length) {
      const don = mafia.find(m => m.roleId === 'DON');
      victim = this.getPlayerById(don?.nightTarget ?? targets[0]);
    }
    let saved = false;
    if (doctor && doctor.nightTarget !== null) {
      const heal = this.getPlayerById(doctor.nightTarget);
      if (victim && heal && heal.id === victim.id) saved = true;
    }
    if (commissar && commissar.nightTarget !== null) {
      const t = this.getPlayerById(commissar.nightTarget);
      if (t) {
        commissar.investigationResults.push({ round: this.round, targetId: t.id, targetNick: t.nick, isMafia: t.isMafia });
        this.emitToPlayer(commissar, 'investigationResult', { targetId: t.id, targetNick: t.nick, isMafia: t.isMafia });
      }
    }
    if (victim && !saved) {
      victim.alive = false;
      this.addFeed(`🩸 Утром найдено тело: ${victim.nick}. Роль: ${victim.role.icon} ${victim.role.name}`);
    } else {
      this.addFeed('☀️ Утром все живы. Ночное покушение не удалось.');
    }
    this.players.forEach(p => { p.protected = false; p.blocked = false; p.nightTarget = null; p.secondTarget = null; });
    if (this.checkWin()) return;
    this.round++;
    this.startDay();
  }

  startDay() {
    this.phase = PHASES.DAY_DISCUSSION;
    this.players.forEach(p => p.resetDay());
    this.votes = {};
    this.addFeed(`☀️ Наступает день ${this.round}. Обсуждение.`);
    this.timeLeft = this.settings.dayTime;
    this.broadcast();
    this.runTimer(() => this.startVote());
  }

  startVote() {
    this.phase = PHASES.DAY_VOTE;
    this.votes = {};
    this.players.forEach(p => p.votedFor = null);
    this.addFeed('🗳️ Голосование началось!');
    this.timeLeft = 45;
    this.broadcast();
    this.runTimer(() => this.endVote());
    this.botVotes();
  }

  handleChat(socketId, text) {
    const player = this.getPlayer(socketId);
    if (!player || !player.alive) return;
    text = (text || '').trim().slice(0, 200);
    if (!text) return;
    if (this.phase === PHASES.NIGHT) {
      if (!player.isMafia) return;
      this.io.to(this.code).emit('mafiaChat', { nick: player.nick, avatar: player.avatar, text, ts: Date.now() });
      return;
    }
    this.chat.push({ nick: player.nick, avatar: player.avatar, text, ts: Date.now() });
    this.io.to(this.code).emit('chat', this.chat[this.chat.length - 1]);
    if (this.phase === PHASES.DAY_DISCUSSION) this.botChatResponse();
  }

  handleVote(socketId, targetId) {
    if (this.phase !== PHASES.DAY_VOTE && this.phase !== PHASES.DAY_DISCUSSION) return;
    const player = this.getPlayer(socketId);
    if (!player || !player.alive || player.votedFor !== null) return;
    const target = this.getPlayerById(targetId);
    if (!target || !target.alive || target.id === player.id) return;
    player.votedFor = targetId;
    if (!this.votes[targetId]) this.votes[targetId] = [];
    this.votes[targetId].push(player.id);
    this.broadcast();
    const alive = this.players.filter(p => p.alive && !p.isBot);
    if (alive.every(p => p.votedFor !== null)) this.endVote();
  }

  endVote() {
    clearInterval(this.timer);
    if (this.phase === PHASES.END) return;
    const tally = {};
    for (const [targetId, voters] of Object.entries(this.votes)) tally[targetId] = voters.length;
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0 || (sorted.length > 1 && sorted[0][1] === sorted[1][1])) {
      this.addFeed('🤷 Голоса разделились. Никто не изгнан.');
    } else {
      const [topId, count] = sorted[0];
      const target = this.getPlayerById(Number(topId));
      if (target) {
        target.alive = false;
        this.addFeed(`⚖️ ${target.nick} изгнан (${count} голосов). Роль: ${target.role.icon} ${target.role.name}`);
      }
    }
    if (this.checkWin()) return;
    this.round++;
    this.startNight();
  }

  checkWin() {
    const alive = this.players.filter(p => p.alive);
    const mafia = alive.filter(p => p.isMafia);
    const town = alive.filter(p => !p.isMafia);
    if (mafia.length === 0) {
      this.phase = PHASES.END;
      this.winner = 'town';
      this.addFeed('🏆 Город победил!');
      this.end();
      return true;
    }
    if (mafia.length >= town.length) {
      this.phase = PHASES.END;
      this.winner = 'mafia';
      this.addFeed('🔪 Мафия победила!');
      this.end();
      return true;
    }
    return false;
  }

  end() { clearInterval(this.timer); this.broadcast(); }

  botNightActions() {
    const alive = this.players.filter(p => p.alive);
    const mafia = alive.filter(p => p.isBot && p.isMafia);
    const nonMafia = alive.filter(p => !p.isMafia);
    mafia.forEach(m => { if (nonMafia.length) m.nightTarget = nonMafia[Math.floor(Math.random() * nonMafia.length)].id; });
    const doctor = alive.find(p => p.isBot && p.roleId === 'DOCTOR');
    if (doctor) {
      const c = alive.filter(p => p.id !== doctor.id);
      doctor.nightTarget = c[Math.floor(Math.random() * c.length)]?.id ?? doctor.id;
    }
    const comm = alive.find(p => p.isBot && p.roleId === 'COMMISSAR');
    if (comm) {
      const c = alive.filter(p => p.id !== comm.id);
      comm.nightTarget = c[Math.floor(Math.random() * c.length)]?.id ?? null;
    }
    const lover = alive.find(p => p.isBot && p.roleId === 'LOVER');
    if (lover) {
      const c = alive.filter(p => p.id !== lover.id);
      lover.nightTarget = c[Math.floor(Math.random() * c.length)]?.id ?? null;
    }
    const j = alive.find(p => p.isBot && p.roleId === 'JOURNALIST');
    if (j) {
      const c = alive.filter(p => p.id !== j.id);
      if (c.length >= 2) {
        const s = shuffle(c);
        j.nightTarget = s[0].id;
        j.secondTarget = s[1].id;
      }
    }
  }

  botVotes() {
    setTimeout(() => {
      const alive = this.players.filter(p => p.alive);
      alive.filter(p => p.isBot && p.votedFor === null).forEach(bot => {
        let candidates = alive.filter(t => t.id !== bot.id);
        if (bot.isMafia) {
          const nonMafia = candidates.filter(t => !t.isMafia);
          if (nonMafia.length) candidates = nonMafia;
        }
        if (!candidates.length) return;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        bot.votedFor = pick.id;
        if (!this.votes[pick.id]) this.votes[pick.id] = [];
        this.votes[pick.id].push(bot.id);
        this.broadcast();
      });
      if (this.players.filter(p => p.alive).every(p => p.votedFor !== null)) this.endVote();
    }, 4000 + Math.random() * 3000);
  }

  botChatResponse() {
    const bots = this.players.filter(p => p.alive && p.isBot);
    const phrases = ['Согласен, надо смотреть на голоса.', 'Я бы присмотрелся к тихоням.', 'Не спеши, нужны аргументы.', 'Кто-нибудь ещё что думает?', 'Интересная мысль.', 'Голосуем аккуратно.', 'Есть подозрения.'];
    const count = Math.min(2, bots.length);
    const shuffled = shuffle(bots).slice(0, count);
    shuffled.forEach((bot, i) => {
      setTimeout(() => {
        if (this.phase === PHASES.END) return;
        const msg = phrases[Math.floor(Math.random() * phrases.length)];
        this.io.to(this.code).emit('chat', { nick: bot.nick, avatar: bot.avatar, text: msg, ts: Date.now() });
      }, 800 + i * 1200);
    });
  }

  runTimer(cb) {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.timeLeft--;
      this.io.to(this.code).emit('timer', { time: this.timeLeft, phase: this.phase });
      if (this.timeLeft <= 0) { clearInterval(this.timer); cb(); }
    }, 1000);
  }

  addFeed(text) {
    this.feed.push({ text, ts: Date.now() });
    if (this.feed.length > 50) this.feed.shift();
    this.io.to(this.code).emit('feed', this.feed[this.feed.length - 1]);
  }

  emitToPlayer(player, event, data) {
    if (player.isBot || !player.socketId) return;
    this.io.to(player.socketId).emit(event, data);
  }

  broadcast() {
    this.players.forEach(p => {
      if (p.isBot || !p.socketId) return;
      this.io.to(p.socketId).emit('state', this.publicState(p));
    });
  }

  publicState(forPlayer) {
    return {
      code: this.code, phase: this.phase, round: this.round, timeLeft: this.timeLeft,
      winner: this.winner, hostId: this.hostId, settings: this.settings,
      players: this.players.map(p => p.toPublic()),
      you: forPlayer ? forPlayer.toPrivate() : null,
      votes: this.votes, feed: this.feed.slice(-20), chat: this.chat.slice(-30),
      canStart: this.phase === PHASES.LOBBY && this.players.length >= 4,
      isHost: forPlayer && forPlayer.id === this.hostId
    };
  }

  get isPlaying() { return this.phase !== PHASES.LOBBY && this.phase !== PHASES.END; }
  get isEmpty() { return this.players.filter(p => !p.isBot).length === 0; }
  get playerCount() { return this.players.length; }
}

module.exports = Game;
module.exports.PHASES = PHASES;
