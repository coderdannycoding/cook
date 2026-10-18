// Classic (non-module) script loaded before the game. If one of the game's module files fails to
// download, the module graph can't report its own failure, so this shows a message instead of an
// endless loading bar. main.js calls window.__bootOk() as soon as the modules have run.
(function () {
  var started = false;
  window.__bootOk = function () { started = true; };
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (started || !t || t.tagName !== 'SCRIPT') return;
    var L = document.getElementById('loading');
    if (!L) return;
    L.innerHTML = '<div class="load-card fatal-card"><div class="load-title">The kitchen didn’t open</div>' +
      '<p class="fatal-text">Part of the game failed to download. Check your connection, then reload the page.</p></div>';
  }, true);
  setTimeout(function () {
    if (started) return;
    var txt = document.querySelector('#loading .load-text');
    if (txt) txt.textContent = 'Still downloading. On a slow connection this can take a minute.';
  }, 15000);
})();
