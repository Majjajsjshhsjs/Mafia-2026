const socket = io({ autoConnect: true });

socket.on('connect', () => {
  console.log('✅ connected', socket.id);
  if (window.State) socket.emit('setProfile', { nick: State.nick, avatar: State.avatar });
});

socket.on('disconnect', (reason) => {
  console.log('❌ disconnected:', reason);
  if (window.toast) toast('Соединение потеряно');
});

socket.on('connect_error', (err) => console.warn('connect_error:', err.message));
