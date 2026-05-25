(function () {
  const banner = document.getElementById('cookie');
  const accept = document.getElementById('cookie-accept');
  if (!banner || !accept) return;

  const KEY = 'promliz:cookie-accepted';

  if (localStorage.getItem(KEY) === '1') return;

  setTimeout(() => banner.classList.add('is-visible'), 1200);

  accept.addEventListener('click', () => {
    localStorage.setItem(KEY, '1');
    banner.classList.remove('is-visible');
    setTimeout(() => { banner.hidden = true; }, 400);
  });
})();
