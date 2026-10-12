const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const RoomManager = require('./src/game/rooms');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000
});

const PORT = process.env.PORT || 8081;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: roomManager.getStats() });
});

const roomManager = new RoomManager(io);

io.on('connection', (socket) => {
  console.log(`[+] Подключен: ${socket.id}`);

  socket.on('setProfile', ({ nick, avatar }, cb) => {
    socket.data.nick = (nick || 'Игрок').slice(0, 20);
    socket.data.avatar = avatar || '♟';
    if (cb) cb({ ok: true, nick: socket.data.nick });
  });

  socket.on('createRoom', (opts, cb) => {
    try {
      const room = roomManager.createRoom(socket, opts);
      cb({ ok: true, roomCode: room.code });
    } catch (e) { cb({ ok: false, error: e.message }); }
  });

  socket.on('joinRoom', ({ code }, cb) => {
    try {
      const room = roomManager.joinRoom(socket, code);
      cb({ ok: true, roomCode: room.code });
    } catch (e) { cb({ ok: false, error: e.message }); }
  });

  socket.on('leaveRoom', () => roomManager.leaveRoom(socket));
  socket.on('listRooms', (cb) => cb(roomManager.listPublicRooms()));

  socket.on('startGame', () => {
    const room = roomManager.getRoomBySocket(socket);
    if (room) room.start();
  });

  socket.on('nightAction', ({ targetId }) => {
    const room = roomManager.getRoomBySocket(socket);
    if (room) room.handleNightAction(socket.id, targetId);
  });

  socket.on('journalistCompare', ({ id1, id2 }) => {
    const room = roomManager.getRoomBySocket(socket);
    if (room) room.handleJournalistCompare(socket.id, id1, id2);
  });

  socket.on('vote', ({ targetId }) => {
    const room = roomManager.getRoomBySocket(socket);
    if (room) room.handleVote(socket.id, targetId);
  });

  socket.on('chat', ({ text }) => {
    const room = roomManager.getRoomBySocket(socket);
    if (room) room.handleChat(socket.id, text);
  });

  socket.on('disconnect', () => {
    console.log(`[-] Отключен: ${socket.id}`);
    roomManager.leaveRoom(socket);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎭 Mafia server running on port ${PORT}`);
});
