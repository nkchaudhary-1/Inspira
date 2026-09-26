// Runs before first paint (classic script, CSP-safe) so a new tab never flashes
// the wrong theme. app.js keeps `inspira.paint` up to date.
(function () {
  var root = document.documentElement;
  var theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  var sky = 'clear';
  try {
    var cached = JSON.parse(localStorage.getItem('inspira.paint') || 'null');
    if (cached) {
      theme = cached.theme || theme;
      sky = cached.sky || sky;
    }
  } catch (e) {}
  var h = new Date().getHours();
  root.dataset.theme = theme;
  root.dataset.sky = sky;
  root.dataset.daypart = h >= 5 && h < 8 ? 'dawn' : h < 12 && h >= 8 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night';
})();
