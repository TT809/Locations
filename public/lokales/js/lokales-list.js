(async function () {
  const grid = document.getElementById('locationsGrid');
  if (!grid) return;

  function esc(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function cardMarkup(location) {
    const href = `/lokales/${encodeURIComponent(location.slug)}/`;
    const imageSrc = location.heroImage || '/lokales/img/default.jpg';
    const city = location.city || location.address || 'Details ansehen';

    return `
      <a class="local-card" href="${href}" target="_blank" rel="noopener" aria-label="${esc(location.name)} in neuem Tab öffnen">
        <div class="local-card__image-wrap">
          <img class="local-card__image" src="${esc(imageSrc)}" alt="${esc(location.name)}" loading="lazy">
        </div>

        <div class="local-card__body">
          <div class="local-card__meta-row">
            <span class="local-tag">${esc(location.type || 'Lokal')}</span>
            ${location.category ? `<span class="local-tag local-tag--soft">${esc(location.category)}</span>` : ''}
          </div>

          <h3>${esc(location.name)}</h3>
          <p class="local-card__address">${esc(location.address || '')}</p>
          <p class="local-card__text">${esc(location.shortDescription || '')}</p>
          <div class="local-card__footer">
            <span class="local-card__city">${esc(city)}</span>
            <span class="local-card__cta">Website öffnen</span>
          </div>
        </div>
      </a>
    `;
  }

  try {
    const response = await fetch('/lokales/data/locations.json', { credentials: 'same-origin' });
    const locations = await response.json();
    grid.innerHTML = Array.isArray(locations) ? locations.map(cardMarkup).join('') : '';
  } catch (error) {
    console.error('Fehler beim Laden der locations.json', error);
    grid.innerHTML = '<p class="local-error">Die Daten konnten lokal gerade nicht geladen werden.</p>';
  }
})();
