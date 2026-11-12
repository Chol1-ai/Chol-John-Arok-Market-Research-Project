document.addEventListener('click', (event) => {
  const link = event.target instanceof Element
    ? event.target.closest('[data-customer-back]')
    : null;
  if (!link || event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !document.referrer) {
    return;
  }

  const previousPage = new URL(document.referrer, location.href);
  if (previousPage.origin !== location.origin || previousPage.href === location.href) return;

  event.preventDefault();
  history.back();
});
