const Game = require('./Game');

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }

  genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      code = '';
      for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(socket, opts = {}) {
    const code = this.genCode();
    const game = new Game({ code, io: this.io, host: { id: 0 }, settings: opts });
    game.addPlayer(socket, opts.nick, opts.avatar);
    const bots = Math.min(opts.botCount || 0, (opts.maxPlayers || 10) - 1);
    for (let i = 0; i < bots; i++) game.addBot();
    this.rooms.set(code, game);
    socket.join(code);
    game.broadcast();
    return game;
  }

  joinRoom(socket, code) {
    code = (code || '').toUpperCase().trim();
    const game = this.rooms.get(code);
    if (!game) throw new Error('Комната не найдена');
    if (game.phase !== 'lobby') throw new Error('Игра уже началась');
    if (game.playerCount >= game.settings.maxPlayers) throw new Error('Комната заполнена');
    game.addPlayer(socket, socket.data.nick, socket.data.avatar);
    socket.join(code);
    game.broadcast();
    return game;
  }

  leaveRoom(socket) {
    for (const [code, game] of this.rooms) {
      if (game.hasPlayer(socket.id)) {
        game.removePlayer(socket.id);
        socket.leave(code);
        if (game.isEmpty) {
          clearInterval(game.timer);
          this.rooms.delete(code);
          console.log(`[x] Комната ${code} удалена`);
        } else game.broadcast();
        break;
      }
    }
  }

  getRoomBySocket(socket) {
    for (const game of this.rooms.values()) {
      if (game.hasPlayer(socket.id)) return game;
    }
    return null;
  }

  listPublicRooms() {
    const list = [];
    for (const [code, game] of this.rooms) {
      if (game.settings.isPrivate) continue;
      if (game.phase !== 'lobby') continue;
      list.push({ code, players: game.playerCount, max: game.settings.maxPlayers, host: game.players[0]?.nick || '—' });
    }
    return list;
  }

  getStats() {
    return {
      totalRooms: this.rooms.size,
      playing: [...this.rooms.values()].filter(g => g.isPlaying).length,
      lobby: [...this.rooms.values()].filter(g => g.phase === 'lobby').length
    };
  }
}

module.exports = RoomManager;
