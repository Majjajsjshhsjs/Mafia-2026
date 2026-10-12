document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const root = document.getElementById('modalRoot');
    if (root && root.innerHTML) root.innerHTML = '';
  }
});

document.addEventListener('touchstart', (e) => {
  const modal = e.target.closest('.modal');
  if (!modal) return;
  modal._startY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  const modal = e.target.closest('.modal');
  if (!modal || !modal._startY) return;
  const dy = e.touches[0].clientY - modal._startY;
  if (dy > 100 && modal.scrollTop <= 0) {
    const root = document.getElementById('modalRoot');
    if (root) root.innerHTML = '';
  }
}, { passive: true });

document.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (btn && window.Adaptive?.isTouch() && navigator.vibrate) navigator.vibrate(8);
});

document.addEventListener('focusin', (e) => {
  const t = e.target;
  if (t && t.tagName === 'INPUT' && window.Adaptive?.isMobile()) {
    setTimeout(() => t.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 300);
  }
});
