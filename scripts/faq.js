(function () {
  const list = document.getElementById('faq-list');
  if (!list) return;

  const items = list.querySelectorAll('.faq-item');

  items.forEach((item) => {
    item.addEventListener('toggle', () => {
      if (item.open) {
        items.forEach((other) => {
          if (other !== item && other.open) other.open = false;
        });
      }
    });
  });
})();
