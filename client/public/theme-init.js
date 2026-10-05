// Apply the saved theme before the page paints, so a dark-theme user never
// sees a white flash. Keep the key and values in step with
// src/context/ThemeContext.jsx. A file rather than an inline <script>, so the
// Content-Security-Policy (nginx.conf.template) needs no 'unsafe-inline'.
(function () {
  try {
    var pref = localStorage.getItem('novard_theme');
    var dark = pref === 'dark' || (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
