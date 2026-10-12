const { ROLES } = require('./roles');

class Player {
  constructor({ id, socketId, nick, avatar, isBot = false, roleId = 'CIVILIAN' }) {
    this.id = id;
    this.socketId = socketId;
    this.nick = nick;
    this.avatar = avatar || '♟';
    this.isBot = isBot;
    this.roleId = roleId;
    this.alive = true;
    this.ready = false;
    this.nightTarget = null;
    this.secondTarget = null;
    this.blocked = false;
    this.protected = false;
    this.markedForDeath = false;
    this.votedFor = null;
    this.investigationResults = [];
  }
  get role() { return ROLES[this.roleId]; }
  get team() { return this.role.team; }
  get isMafia() { return this.team === 'mafia'; }

  toPublic() {
    return { id: this.id, nick: this.nick, avatar: this.avatar, alive: this.alive, ready: this.ready, isBot: this.isBot };
  }
  toPrivate() {
    return {
      ...this.toPublic(),
      roleId: this.roleId,
      roleName: this.role.name,
      roleIcon: this.role.icon,
      team: this.team,
      investigationResults: this.investigationResults
    };
  }
  resetNight() { this.nightTarget = null; this.secondTarget = null; this.blocked = false; this.protected = false; this.markedForDeath = false; }
  resetDay() { this.votedFor = null; }
}

module.exports = Player;
