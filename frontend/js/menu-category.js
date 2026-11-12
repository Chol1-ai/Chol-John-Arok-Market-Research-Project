(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const destination = new URLSearchParams();
  const outlet = params.get('outlet');
  if (outlet === 'FOODIZO_HAM_TOWERS' || outlet === 'OBUNUZI_YMCA') {
    destination.set('outlet', outlet);
  }
  const category = params.get('category');
  if (category) destination.set('category', category);

  const query = destination.toString();
  location.replace(`/order${query ? `?${query}` : ''}`);
})();
