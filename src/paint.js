// Runs before first paint (classic script, CSP-safe) so a new tab never flashes
// the wrong theme. app.js keeps `inspira.paint` up to date.
(function () {
  var root = document.documentElement;
  var theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  var sky = 'clear';
  var texture = 'grain';
  var grid = 'none';
  var light = 'sky';
  var skyPick = 'auto';
  try {
    var cached = JSON.parse(localStorage.getItem('inspira.paint') || 'null');
    if (cached) {
      theme = cached.theme || theme;
      sky = cached.sky || sky;
      texture = cached.texture || texture;
      grid = cached.grid || grid;
      light = cached.light || light;
      skyPick = cached.skyPick || skyPick;
    }
  } catch (e) {}
  var h = new Date().getHours();
  // Sky phase (mirrors skyPhaseAt in ui/backdrop.js) so the first frame has the right sky.
  var hh = h < 1 ? h + 24 : h;
  root.dataset.skyphase =
    skyPick !== 'auto'
      ? skyPick
      : hh >= 4 && hh < 8
        ? 'dawn'
        : hh >= 8 && hh < 16
          ? 'day'
          : hh >= 16 && hh < 19
            ? 'evening'
            : hh >= 19 && hh < 22
              ? 'night'
              : hh >= 22
                ? 'late'
                : 'deep';
  root.dataset.theme = theme;
  root.dataset.sky = sky;
  root.dataset.texture = texture;
  root.dataset.grid = grid;
  root.dataset.light = light;
  root.dataset.daypart = h >= 5 && h < 8 ? 'dawn' : h < 12 && h >= 8 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night';
})();
