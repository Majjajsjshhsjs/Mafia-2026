(function () {
  const doc = document.documentElement;
  function setVH() { doc.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px'); }
  function detectDevice() {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /Android/.test(ua);
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || window.innerWidth < 768;
    const isTablet = /iPad|Tablet/i.test(ua) || (isMobile && window.innerWidth >= 768);
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    doc.classList.toggle('is-ios', isIOS);
    doc.classList.toggle('is-android', isAndroid);
    doc.classList.toggle('is-mobile', isMobile);
    doc.classList.toggle('is-tablet', isTablet);
    doc.classList.toggle('is-touch', isTouch);
    doc.classList.toggle('is-pointer', !isTouch);
  }
  function onResize() { setVH(); }
  function init() {
    setVH(); detectDevice();
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(onResize, 250));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.Adaptive = {
    isMobile: () => doc.classList.contains('is-mobile'),
    isTablet: () => doc.classList.contains('is-tablet'),
    isTouch: () => doc.classList.contains('is-touch'),
    isLandscape: () => window.innerWidth > window.innerHeight,
    setVH
  };
})();
