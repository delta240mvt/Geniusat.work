
document.querySelectorAll('[data-page-link]').forEach((link) => {
  const href = link.getAttribute('href');
  if (location.pathname.endsWith(href)) link.classList.add('active');
});
