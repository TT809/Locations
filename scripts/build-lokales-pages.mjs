import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PUBLIC_BASE = path.join(ROOT, 'public');
const DATA_PATH = path.join(ROOT, 'public', 'lokales', 'data', 'locations.json');
const OUT_BASE = path.join(ROOT, 'public', 'lokales');
const SECTION_PATH = '/lokales';

function resolveSiteUrl() {
  const candidates = [
    process.env.SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    'landkreisplaner.de'
  ];

  const selected = candidates.find((value) => String(value || '').trim());
  let normalized = String(selected || '').trim();

  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  return normalized.replace(/\/+$/g, '');
}

const SITE_URL = resolveSiteUrl();

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function slugifyFragment(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'info';
}

function uniq(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function absoluteUrl(value = '') {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return SITE_URL;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  return `${SITE_URL}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

function getLocationUrl(location) {
  return absoluteUrl(`${SECTION_PATH}/${location.slug}/`);
}

function getListUrl() {
  return absoluteUrl(`${SECTION_PATH}/`);
}

function getPrimaryImage(location) {
  return absoluteUrl(location.seo?.image || location.heroImage || normalizeGallery(location)[0]?.src || '/lokales/img/default.jpg');
}

function imageAltText(location) {
  return location.seo?.imageAlt || `${location.name}${location.city ? ` in ${location.city}` : ''}`;
}

function serializeJsonLd(data) {
  return JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
}

function parseAddress(location) {
  const fallbackCountry = location.country || (String(location.address || '').includes('Deutschland') ? 'DE' : '');
  const source = String(location.address || '').trim();
  const explicitStreet = String(location.streetAddress || '').trim();
  const explicitPostalCode = String(location.postalCode || '').trim();
  const explicitCity = String(location.city || '').trim();
  const explicitCountryName = String(location.countryName || '').trim();
  const explicitCountryCode = String(location.country || '').trim();

  if (!source && !explicitStreet && !explicitPostalCode && !explicitCity) {
    return null;
  }

  let streetAddress = explicitStreet;
  let postalCode = explicitPostalCode;
  let city = explicitCity;
  let countryName = explicitCountryName;
  let countryCode = explicitCountryCode || fallbackCountry;

  if (!streetAddress && source) {
    const parts = source.split(',').map((part) => part.trim()).filter(Boolean);
    streetAddress = parts[0] || '';

    if (!postalCode || !city) {
      const postalCityPart = parts[1] || '';
      const postalCityMatch = postalCityPart.match(/(\d{4,5})\s+(.+)/);

      if (postalCityMatch) {
        postalCode = postalCode || postalCityMatch[1];
        city = city || postalCityMatch[2];
      } else if (!city && postalCityPart) {
        city = postalCityPart;
      }
    }

    if (!countryName && parts[2]) {
      countryName = parts[2];
    }
  }

  return {
    '@type': 'PostalAddress',
    ...(streetAddress ? { streetAddress } : {}),
    ...(postalCode ? { postalCode } : {}),
    ...(city ? { addressLocality: city } : {}),
    ...(location.state ? { addressRegion: location.state } : {}),
    ...(countryName ? { addressCountry: countryName } : countryCode ? { addressCountry: countryCode } : {})
  };
}

function schemaType(location) {
  const haystack = `${location.type || ''} ${location.category || ''}`.toLowerCase();

  if (/(bar|cocktail|pub|kneipe)/.test(haystack)) {
    return 'BarOrPub';
  }

  if (/(cafe|café|coffee)/.test(haystack)) {
    return 'CafeOrCoffeeShop';
  }

  if (/(restaurant|pizzeria|bistro|gasthaus|grill)/.test(haystack)) {
    return 'Restaurant';
  }

  return 'LocalBusiness';
}

function parseDays(days = '') {
  const normalized = String(days).trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  if (/(täglich|jeden tag|mo\s*[–-]\s*so)/.test(normalized)) {
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  }

  const dayMap = new Map([
    ['mo', 'Monday'],
    ['montag', 'Monday'],
    ['di', 'Tuesday'],
    ['dienstag', 'Tuesday'],
    ['mi', 'Wednesday'],
    ['mittwoch', 'Wednesday'],
    ['do', 'Thursday'],
    ['donnerstag', 'Thursday'],
    ['fr', 'Friday'],
    ['freitag', 'Friday'],
    ['sa', 'Saturday'],
    ['samstag', 'Saturday'],
    ['so', 'Sunday'],
    ['sonntag', 'Sunday']
  ]);
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return uniq(
    normalized
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .split(',')
      .flatMap((part) => {
        const token = part.trim();

        if (!token) {
          return [];
        }

        const rangeMatch = token.match(/^([a-zäöü]+)\s*[–-]\s*([a-zäöü]+)$/i);

        if (rangeMatch) {
          const start = dayMap.get(rangeMatch[1]);
          const end = dayMap.get(rangeMatch[2]);

          if (!start || !end) {
            return [];
          }

          const startIndex = dayOrder.indexOf(start);
          const endIndex = dayOrder.indexOf(end);

          if (startIndex === -1 || endIndex === -1) {
            return [];
          }

          if (startIndex <= endIndex) {
            return dayOrder.slice(startIndex, endIndex + 1);
          }

          return [...dayOrder.slice(startIndex), ...dayOrder.slice(0, endIndex + 1)];
        }

        return dayMap.get(token) ? [dayMap.get(token)] : [];
      })
  );
}

function parseTimeRanges(hours = '') {
  const normalized = String(hours).trim().toLowerCase();

  if (!normalized || /(geschlossen|closed|ruhetag)/.test(normalized)) {
    return [];
  }

  const matches = [...normalized.matchAll(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/g)];
  return matches.map((match) => ({
    opens: match[1],
    closes: match[2]
  }));
}

function openingHoursSpecification(location) {
  return normalizeHours(location).flatMap((row) => {
    const days = parseDays(row.days);
    const ranges = parseTimeRanges(row.hours);

    if (!days.length || !ranges.length) {
      return [];
    }

    return ranges.map((range) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: days,
      opens: range.opens,
      closes: range.closes
    }));
  });
}

function defaultSeoTitle(location) {
  const descriptor = location.category || location.type || 'Lokal';
  const cityPart = location.city ? ` in ${location.city}` : '';
  return `${location.name}${cityPart} | ${descriptor}`;
}

function defaultSeoDescription(location) {
  if (location.seo?.description) {
    return location.seo.description;
  }

  const descriptor = (location.category || location.type || 'Lokal').toLowerCase();
  const locationPart = [location.city, location.address].filter(Boolean).join(', ');
  const featureParts = [
    normalizeHours(location).length ? 'Öffnungszeiten' : '',
    location.menuPdf ? 'Speisekarte' : '',
    location.mapsLink ? 'Route' : ''
  ].filter(Boolean);

  const sentence = [
    `${location.name} ist ${locationPart ? `eine ${descriptor} in ${locationPart}` : `eine ${descriptor}`}.`,
    featureParts.length ? `${featureParts.join(', ')} direkt online verfügbar.` : ''
  ].filter(Boolean).join(' ');

  return sentence.trim();
}

function detailJsonLd(location) {
  const address = parseAddress(location);
  const sameAs = uniq([location.website, location.instagram, location.facebook]);
  const images = uniq([location.heroImage, ...normalizeGallery(location).map((image) => image.src)].filter(Boolean)).map(absoluteUrl);
  const business = {
    '@context': 'https://schema.org',
    '@type': schemaType(location),
    '@id': `${getLocationUrl(location)}#business`,
    name: location.name,
    url: getLocationUrl(location),
    mainEntityOfPage: getLocationUrl(location),
    description: defaultSeoDescription(location),
    image: images.length ? images : [getPrimaryImage(location)],
    ...(location.category ? { category: location.category } : {}),
    ...(location.phone ? { telephone: location.phone } : {}),
    ...(address ? { address } : {}),
    ...(location.priceRange ? { priceRange: location.priceRange } : {}),
    ...(location.servesCuisine ? { servesCuisine: location.servesCuisine } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(location.menuPdf ? { hasMenu: absoluteUrl(location.menuPdf) } : {}),
    ...(location.mapsLink ? { hasMap: location.mapsLink } : {}),
    ...(location.reservationLink ? { acceptsReservations: true } : {}),
    ...(location.latitude && location.longitude
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: Number(location.latitude),
            longitude: Number(location.longitude)
          }
        }
      : {})
  };
  const openingHours = openingHoursSpecification(location);

  if (openingHours.length) {
    business.openingHoursSpecification = openingHours;
  }

  return [business];
}

function summarizeLocations(locations) {
  const cities = uniq(locations.map((location) => location.city));
  const types = uniq(locations.map((location) => location.category || location.type));
  const cityLabel = cities.length === 1 ? cities[0] : cities.length > 1 ? `${cities[0]} und weitere Orte` : 'der Region';
  const typeLabel = types.slice(0, 3).join(', ');

  return { cities, types, cityLabel, typeLabel };
}

function listPageTitle(locations) {
  const { cities } = summarizeLocations(locations);
  return cities.length === 1
    ? `Restaurants, Bars & Cafés in ${cities[0]} | Landkreisplaner Lokales`
    : 'Restaurants, Bars & Cafés entdecken | Landkreisplaner Lokales';
}

function listPageDescription(locations) {
  const { cities, types } = summarizeLocations(locations);
  const cityPart = cities.length === 1 ? `in ${cities[0]}` : 'in der Region';
  const typePart = types.length ? `${types.slice(0, 3).join(', ')}` : 'Restaurants, Bars und Cafés';

  return `Entdecke ${typePart} ${cityPart} mit Öffnungszeiten, Adresse, Karte, Bildern und Speisekarte auf einen Blick.`;
}

function listPageJsonLd(locations) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: listPageTitle(locations),
      url: getListUrl(),
      description: listPageDescription(locations),
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: locations.map((location, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: getLocationUrl(location),
          name: location.name
        }))
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Lokales',
          item: getListUrl()
        }
      ]
    }
  ];
}

function cssVars(theme = {}) {
  const vars = {
    '--local-primary': theme.primary || '#1c2430',
    '--local-secondary': theme.secondary || '#c9a45c',
    '--local-accent': theme.accent || '#f5efe3',
    '--local-surface': theme.surface || '#ffffff',
    '--local-background': theme.background || '#f6f4ef',
    '--local-text': theme.text || '#171717',
    '--local-hero-overlay-strong': theme.heroOverlayStrong || 'rgba(12, 17, 25, 0.42)',
    '--local-hero-overlay-soft': theme.heroOverlaySoft || 'rgba(12, 17, 25, 0.18)',
    '--local-hero-overlay-bottom': theme.heroOverlayBottom || 'rgba(12, 17, 25, 0.44)',
    '--local-hero-card-bg': theme.heroCardBackground || 'rgba(250, 247, 242, 0.76)',
    '--local-hero-card-border': theme.heroCardBorder || 'rgba(255, 255, 255, 0.34)',
    '--local-hero-card-text': theme.heroCardText || '#1c2430',
    '--local-hero-card-muted': theme.heroCardMuted || 'rgba(28, 36, 48, 0.78)',
    '--local-hero-chip-bg': theme.heroChipBackground || 'rgba(255, 255, 255, 0.56)',
    '--local-hero-chip-border': theme.heroChipBorder || 'rgba(28, 36, 48, 0.10)',
    '--local-hero-chip-text': theme.heroChipText || '#1c2430'
  };

  return Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(';');
}

function normalizeHours(location) {
  if (Array.isArray(location.openingHours) && location.openingHours.length) {
    return location.openingHours;
  }

  if (Array.isArray(location.openingHoursResolved) && location.openingHoursResolved.length) {
    return location.openingHoursResolved.map((entry) => ({
      days: entry.days || entry.weekday || 'Tag',
      hours: entry.hours || entry.text || '—'
    }));
  }

  if (Array.isArray(location.openingHoursFallback) && location.openingHoursFallback.length) {
    return location.openingHoursFallback;
  }

  return [];
}

function normalizeInfoSections(location) {
  const sections = Array.isArray(location.infoSections) && location.infoSections.length
    ? location.infoSections
    : location.description
      ? [{
          title: location.descriptionTitle || 'Über das Lokal',
          content: location.description,
          id: location.descriptionId
        }]
      : [];

  const usedIds = new Set();

  return sections
    .map((section, index) => {
      if (!section || typeof section !== 'object') {
        return null;
      }

      const title = String(section.title || '').trim();
      const content = String(section.content || '').trim();

      if (!title || !content) {
        return null;
      }

      let id = slugifyFragment(section.id || title);
      while (usedIds.has(id)) {
        id = `${id}-${index + 1}`;
      }
      usedIds.add(id);

      return { id, title, content };
    })
    .filter(Boolean);
}

function renderHours(location) {
  const hours = normalizeHours(location);

  if (!hours.length) {
    return '';
  }

  return `
    <article class="local-panel local-detail-section" id="oeffnungszeiten">
      <h2>Öffnungszeiten</h2>
      <div class="local-hours-list">
        ${hours.map((row) => `
          <div class="local-hours-row">
            <strong>${esc(row.days)}</strong>
            <span>${esc(row.hours)}</span>
          </div>
        `).join('')}
      </div>
      <p class="local-hours-note">Alle Angaben ohne Gewähr. Änderungen sind möglich.</p>
    </article>
  `;
}

function renderMenu(location) {
  if (!location.menuPdf) {
    return '';
  }

  const menuSrc = esc(location.menuPdf);

  return `
    <article class="local-panel local-detail-section" id="speisekarte">
      <h2>Speisekarte</h2>
      <div class="local-menu-card">
        <div class="local-menu-viewer" data-menu-viewer data-pdf-src="${menuSrc}">
          <button class="local-menu-viewer__arrow" type="button" data-menu-prev aria-label="Vorherige Speisekartenseite">‹</button>
          <div class="local-menu-viewer__stage">
            <button class="local-menu-preview" type="button" data-menu-open aria-label="Speisekarte in Vollbild öffnen">
              <span class="local-menu-preview__hint">Zum Vergrößern tippen oder klicken</span>
              <canvas class="local-menu-preview__canvas" data-menu-canvas></canvas>
            </button>
            <p class="local-menu-viewer__status" data-menu-status>Seite 1</p>
          </div>
          <button class="local-menu-viewer__arrow" type="button" data-menu-next aria-label="Nächste Speisekartenseite">›</button>
        </div>
      </div>
    </article>
  `;
}

function renderMenuModal(location) {
  if (!location.menuPdf) {
    return '';
  }

  const menuSrc = esc(location.menuPdf);

  return `
    <div class="local-modal local-modal--menu" data-menu-modal hidden>
      <div class="local-modal__backdrop" data-menu-close></div>
      <div class="local-modal__dialog local-modal__dialog--menu" role="dialog" aria-modal="true" aria-label="Speisekarte von ${esc(location.name)}">
        <div class="local-modal__toolbar" aria-label="Ansicht steuern">
          <button class="local-modal__toolbar-button" type="button" data-menu-zoom-out aria-label="Speisekarte verkleinern">−</button>
          <button class="local-modal__toolbar-button" type="button" data-menu-zoom-reset aria-label="Speisekarte an Bildschirm anpassen">Anpassen</button>
          <button class="local-modal__toolbar-button" type="button" data-menu-zoom-in aria-label="Speisekarte vergrößern">+</button>
        </div>
        <button class="local-modal__close" type="button" data-menu-close aria-label="Speisekartenansicht schließen">×</button>
        <div class="local-menu-viewer local-menu-viewer--modal" data-menu-modal-viewer data-pdf-src="${menuSrc}">
          <button class="local-menu-viewer__arrow" type="button" data-menu-prev aria-label="Vorherige Speisekartenseite">‹</button>
          <div class="local-menu-viewer__stage">
            <div class="local-modal__media-scroll">
              <canvas class="local-modal__menu-canvas" data-menu-canvas></canvas>
            </div>
            <p class="local-menu-viewer__status" data-menu-status>Seite 1</p>
            <div class="local-modal__swipe-hint" aria-hidden="true">
              <span>↔</span>
              <span>Nach links oder rechts wischen</span>
            </div>
          </div>
          <button class="local-menu-viewer__arrow" type="button" data-menu-next aria-label="Nächste Speisekartenseite">›</button>
        </div>
      </div>
    </div>
  `;
}

function renderHeroMedia(location) {
  const imageSrc = location.heroImage || '/lokales/img/default.jpg';

  return `
    <figure class="local-hero-media local-detail-hero__media">
      <img src="${esc(imageSrc)}" alt="${esc(imageAltText(location))}" fetchpriority="high" decoding="async">
    </figure>
  `;
}

function normalizeGallery(location) {
  if (!Array.isArray(location.gallery)) {
    return [];
  }

  return location.gallery
    .map((entry, index) => {
      if (typeof entry === 'string') {
        return {
          src: entry,
          alt: `${location.name} Bild ${index + 1}`
        };
      }

      if (entry && typeof entry === 'object' && entry.src) {
        return {
          src: entry.src,
          alt: entry.alt || `${location.name} Bild ${index + 1}`
        };
      }

      return null;
    })
    .filter(Boolean);
}

function renderGallery(location) {
  const gallery = normalizeGallery(location);

  if (!gallery.length) {
    return '';
  }

  return `
    <article class="local-panel local-detail-section local-gallery-panel" id="bilder" aria-labelledby="bilder-title">
      <h2 id="bilder-title">Bildergalerie</h2>
      <div class="local-gallery-shell" data-gallery>
        <button class="local-gallery-arrow local-gallery-arrow--prev" type="button" data-gallery-prev aria-label="Vorheriges Bild">
          <span aria-hidden="true">‹</span>
        </button>
        <div class="local-gallery-track" data-gallery-track tabindex="0" aria-label="Bildergalerie von ${esc(location.name)}">
          ${gallery.map((image, index) => `
            <button
              class="local-gallery-slide"
              type="button"
              data-gallery-open
              data-gallery-index="${index}"
              data-image-src="${esc(image.src)}"
              data-image-alt="${esc(image.alt)}"
              aria-label="${esc(image.alt)} in Vollbild öffnen">
              <img src="${esc(image.src)}" alt="${esc(image.alt)}" loading="lazy">
            </button>
          `).join('')}
        </div>
        <button class="local-gallery-arrow local-gallery-arrow--next" type="button" data-gallery-next aria-label="Nächstes Bild">
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </article>
  `;
}

function renderGalleryModal(location) {
  const gallery = normalizeGallery(location);

  if (!gallery.length) {
    return '';
  }

  return `
    <div class="local-modal local-modal--gallery" data-gallery-modal hidden>
      <div class="local-modal__backdrop" data-gallery-close></div>
      <div class="local-modal__dialog local-modal__dialog--gallery" role="dialog" aria-modal="true" aria-label="Bildergalerie von ${esc(location.name)}">
        <div class="local-modal__toolbar" aria-label="Ansicht steuern">
          <button class="local-modal__toolbar-button" type="button" data-gallery-zoom-out aria-label="Bild verkleinern">−</button>
          <button class="local-modal__toolbar-button" type="button" data-gallery-zoom-reset aria-label="Bild an Bildschirm anpassen">Anpassen</button>
          <button class="local-modal__toolbar-button" type="button" data-gallery-zoom-in aria-label="Bild vergrößern">+</button>
        </div>
        <button class="local-modal__close" type="button" data-gallery-close aria-label="Bildansicht schließen">×</button>
        <button class="local-modal__nav local-modal__nav--prev" type="button" data-gallery-modal-prev aria-label="Vorheriges Bild">‹</button>
        <div class="local-modal__media-scroll" data-gallery-modal-scroll>
          <img class="local-modal__image" data-gallery-modal-image alt="">
        </div>
        <button class="local-modal__nav local-modal__nav--next" type="button" data-gallery-modal-next aria-label="Nächstes Bild">›</button>
      </div>
    </div>
  `;
}

function renderHeaderLinks(location) {
  const links = [
    ...(normalizeHours(location).length ? [['oeffnungszeiten', 'Öffnungszeiten']] : []),
    ...(location.menuPdf ? [['speisekarte', 'Speisekarte']] : []),
    ...((location.mapsEmbedUrl || location.address) ? [['standort', 'Standort']] : []),
    ...normalizeInfoSections(location).map((section) => [section.id, section.title])
  ];

  return links.map(([href, label]) => `<a href="#${href}">${label}</a>`).join('');
}

function renderInfoSections(location) {
  return normalizeInfoSections(location).map((section) => `
    <article class="local-panel local-detail-section" id="${esc(section.id)}">
      <h2>${esc(section.title)}</h2>
      <p class="local-copy">${esc(section.content)}</p>
    </article>
  `).join('');
}

function renderLocation(location) {
  if (!location.mapsEmbedUrl && !location.address) {
    return '';
  }

  return `
    <article class="local-panel local-detail-section" id="standort">
      <h2>Standort</h2>
      <div class="local-map-embed">
        ${location.mapsEmbedUrl
          ? `<iframe src="${esc(location.mapsEmbedUrl)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Karte von ${esc(location.name)}"></iframe>`
          : '<div class="local-hero-media--fallback" style="min-height:360px;border-radius:18px;"><div><strong>Karte folgt</strong></div></div>'}
      </div>
      ${location.address ? `<p class="local-hours-note">${esc(location.address)}</p>` : ''}
    </article>
  `;
}

function renderHeroActions(location) {
  const actions = [
    location.mapsLink ? `<a class="local-button local-button--secondary" href="${esc(location.mapsLink)}" target="_blank" rel="noopener">Route öffnen</a>` : '',
    location.menuPdf ? '<a class="local-button" href="#speisekarte">Speisekarte</a>' : ''
  ].filter(Boolean);

  if (!actions.length) {
    return '';
  }

  return `
    <div class="local-hero-actions">
      ${actions.join('')}
    </div>
  `;
}

function socialIcon(name) {
  if (name === 'instagram') {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5"></rect>
        <circle cx="12" cy="12" r="4.25"></circle>
        <circle cx="17.5" cy="6.5" r="1.25" fill="currentColor" stroke="none"></circle>
      </svg>
    `;
  }

  if (name === 'facebook') {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13.5 21v-7h2.7l.5-3h-3.2V9.2c0-.9.3-1.7 1.7-1.7H17V4.8c-.4-.1-1.3-.2-2.4-.2-2.5 0-4.2 1.5-4.2 4.4V11H7.5v3h2.9v7z" fill="currentColor" stroke="none"></path>
      </svg>
    `;
  }

  return '';
}

function renderSocialLinks(location) {
  const links = [
    location.instagram ? ['instagram', location.instagram, 'Instagram'] : null,
    location.facebook ? ['facebook', location.facebook, 'Facebook'] : null
  ].filter(Boolean);

  if (!links.length) {
    return '';
  }

  return `
    <nav class="local-social-nav" aria-label="Social Media Links">
      ${links.map(([name, href, label]) => `
        <a class="local-social-link" href="${esc(href)}" target="_blank" rel="noopener" aria-label="${label} öffnen">
          ${socialIcon(name)}
          <span>${label}</span>
        </a>
      `).join('')}
    </nav>
  `;
}

function renderLegalLink(location) {
  if (!location.impressumLink) {
    return '';
  }

  return `
    <a class="local-legal-link" href="${esc(location.impressumLink)}" target="_blank" rel="noopener">
      Impressum
    </a>
  `;
}

function renderLocationCard(location) {
  const href = `${SECTION_PATH}/${encodeURIComponent(location.slug)}/`;
  const imageSrc = location.heroImage || '/lokales/img/default.jpg';
  const city = location.city || location.address || 'Details ansehen';

  return `
    <a class="local-card" href="${href}" target="_blank" rel="noopener" aria-label="${esc(location.name)} in neuem Tab öffnen">
      <div class="local-card__image-wrap">
        <img class="local-card__image" src="${esc(imageSrc)}" alt="${esc(imageAltText(location))}" loading="lazy">
      </div>

      <div class="local-card__body">
        <div class="local-card__meta-row">
          <span class="local-tag">${esc(location.type || 'Lokal')}</span>
          ${location.category ? `<span class="local-tag local-tag--soft">${esc(location.category)}</span>` : ''}
        </div>

        <h3>${esc(location.name)}</h3>
        <p class="local-card__address">${esc(location.address || '')}</p>
        <p class="local-card__text">${esc(defaultSeoDescription(location))}</p>
        <div class="local-card__footer">
          <span class="local-card__city">${esc(city)}</span>
          <span class="local-card__cta">Website öffnen</span>
        </div>
      </div>
    </a>
  `;
}

function renderSeoHead({
  title,
  description,
  canonical,
  image,
  imageAlt,
  jsonLd,
  siteName = 'Landkreisplaner Lokales',
  favicon = '',
  preloadImage = '',
  noindex = false
}) {
  const faviconLink = favicon ? `\n  <link rel="icon" href="${esc(favicon)}" />` : '';
  const preloadLink = preloadImage ? `\n  <link rel="preload" as="image" href="${esc(preloadImage)}" />` : '';
  const robots = noindex
    ? 'noindex,nofollow,noarchive'
    : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';

  return `
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="${robots}" />
  <meta name="theme-color" content="#1c2430" />
  <link rel="canonical" href="${esc(canonical)}" />
  <link rel="alternate" hreflang="de-DE" href="${esc(canonical)}" />
  <link rel="alternate" hreflang="x-default" href="${esc(canonical)}" />${faviconLink}${preloadLink}
  <meta property="og:locale" content="de_DE" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${esc(siteName)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:image" content="${esc(image)}" />
  <meta property="og:image:alt" content="${esc(imageAlt)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(image)}" />
  <script type="application/ld+json">${serializeJsonLd(jsonLd)}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/lokales/css/lokales.css" />`;
}

function renderListPage(locations) {
  const { cityLabel } = summarizeLocations(locations);
  const title = listPageTitle(locations);
  const description = listPageDescription(locations);
  const canonical = getListUrl();
  const image = locations[0] ? getPrimaryImage(locations[0]) : absoluteUrl('/lokales/img/default.jpg');

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>${renderSeoHead({
    title,
    description,
    canonical,
    image,
    imageAlt: `Lokale entdecken in ${cityLabel}`,
    jsonLd: listPageJsonLd(locations),
    preloadImage: locations[0]?.heroImage || '/lokales/img/default.jpg'
  })}
</head>
<body>
  <header class="local-shell local-shell--header">
    <div class="local-container local-topbar">
      <a href="/lokales/" class="local-brand">Landkreisplaner<span>Lokales</span></a>
      <nav class="local-mini-nav" aria-label="Seitennavigation">
        <a href="#lokale-liste">Lokale</a>
        <a href="#vorteile">Vorteile</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="local-list-hero">
      <div class="local-container local-list-hero__grid">
        <div class="local-list-hero__copy">
          <p class="local-eyebrow">Lokale entdecken</p>
          <div class="local-chip-row" aria-label="Übersicht">
            <span class="local-chip">Öffnungszeiten</span>
            <span class="local-chip">Adresse & Karte</span>
            <span class="local-chip">Speisekarte & Bilder</span>
          </div>
          <h1>Restaurants, Bars und Cafés in ${esc(cityLabel)} auf einen Blick.</h1>
          <p class="local-lead">Finde schnell passende Lokale mit Adresse, Route, Öffnungszeiten, Bildergalerie und Speisekarte. Jede Detailseite ist übersichtlich aufgebaut und mobil optimiert.</p>
          <div class="local-hero-actions">
            <a class="local-button" href="#lokale-liste">Lokale ansehen</a>
            <a class="local-button local-button--ghost" href="#vorteile">Warum diese Seiten hilfreich sind</a>
          </div>
          <div class="local-fact-grid local-fact-grid--compact" aria-label="Kurzfakten">
            <div class="local-fact">
              <span>Lokale</span>
              <strong>${locations.length}</strong>
            </div>
            <div class="local-fact">
              <span>Inhalte</span>
              <strong>Karte, Zeiten, Menü</strong>
            </div>
            <div class="local-fact">
              <span>Optimiert</span>
              <strong>Desktop & Mobil</strong>
            </div>
          </div>
        </div>
        <aside class="local-list-hero__card local-list-preview">
          <p class="local-stat-label">Was du auf den Unterseiten findest</p>
          <div class="local-preview-list">
            <div class="local-preview-item">
              <strong>Adresse mit Kartenansicht</strong>
              <span>Standorte lassen sich direkt öffnen oder in der eingebetteten Karte prüfen.</span>
            </div>
            <div class="local-preview-item">
              <strong>Öffnungszeiten im Überblick</strong>
              <span>Wichtige Zeiten sind ohne langes Suchen sichtbar.</span>
            </div>
            <div class="local-preview-item">
              <strong>Bilder und Speisekarte</strong>
              <span>Gäste bekommen schon vor dem Besuch einen guten Eindruck vom Lokal.</span>
            </div>
          </div>
        </aside>
      </div>
    </section>

    <section class="local-container local-list-section" id="lokale-liste" aria-labelledby="lokale-title">
      <div class="local-section-head">
        <div>
          <p class="local-eyebrow">Übersicht</p>
          <h2 id="lokale-title">Lokale in der Übersicht</h2>
        </div>
        <p class="local-muted">Alle Einträge sind direkt verlinkt und vollständig im HTML enthalten, damit Besucher und Suchmaschinen sie gleichermaßen schnell finden.</p>
      </div>
      <div id="locationsGrid" class="local-card-grid">
        ${locations.map((location) => renderLocationCard(location)).join('')}
      </div>
    </section>

    <section class="local-container local-benefits" id="vorteile" aria-labelledby="benefits-title">
      <div class="local-section-head">
        <div>
          <p class="local-eyebrow">Warum diese Seiten nützlich sind</p>
          <h2 id="benefits-title">Schnell zur relevanten Information</h2>
        </div>
      </div>
      <div class="local-benefits-grid">
        <article class="local-benefit-card"><h3>Wichtige Infos direkt sichtbar</h3><p>Besucher finden Adresse, Öffnungszeiten und Speisekarte ohne Umwege auf einer klar strukturierten Seite.</p></article>
        <article class="local-benefit-card"><h3>Mobil angenehm nutzbar</h3><p>Die Darstellung ist auf Smartphones optimiert, damit Inhalte auch unterwegs schnell gelesen und geklickt werden können.</p></article>
        <article class="local-benefit-card"><h3>Saubere interne Verlinkung</h3><p>Von der Übersicht gelangt man direkt auf die jeweilige Detailseite, was Orientierung und Auffindbarkeit verbessert.</p></article>
      </div>
    </section>
  </main>

  <footer class="local-shell local-shell--footer">
    <div class="local-container local-footer">
      <p>Landkreisplaner Lokales</p>
      <a href="/lokales/">Zur Übersicht</a>
    </div>
  </footer>
  <script src="/lokales/js/cookie-consent.js" defer></script>
</body>
</html>`;
}

function renderSitemap(locations) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    {
      loc: getListUrl(),
      priority: '1.0',
      changefreq: 'weekly'
    },
    ...locations.filter((location) => location.slug).map((location) => ({
      loc: getLocationUrl(location),
      priority: '0.9',
      changefreq: 'weekly'
    }))
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((entry) => `  <url>
    <loc>${esc(entry.loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
}

function renderRobotsTxt() {
  return `User-agent: *
Allow: /

Sitemap: ${absoluteUrl('/sitemap.xml')}
`;
}

function renderRootIndex() {
  const destination = `${SECTION_PATH}/`;

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Weiterleitung zu Lokales</title>
  <meta name="robots" content="noindex,follow" />
  <link rel="canonical" href="${esc(getListUrl())}" />
  <meta http-equiv="refresh" content="0; url=${destination}" />
  <script>window.location.replace(${JSON.stringify(destination)});</script>
</head>
<body>
  <p>Weiterleitung zu <a href="${destination}">Lokales</a>…</p>
</body>
</html>`;
}

function copyRootStaticFiles() {
  const staticFiles = fs.readdirSync(ROOT)
    .filter((entry) => /^google[a-z0-9]+\.html$/i.test(entry))
    .filter((entry) => fs.statSync(path.join(ROOT, entry)).isFile());

  for (const file of staticFiles) {
    fs.copyFileSync(path.join(ROOT, file), path.join(PUBLIC_BASE, file));
  }
}

function renderPage(location) {
  const title = location.seo?.title || defaultSeoTitle(location);
  const description = defaultSeoDescription(location);
  const canonical = getLocationUrl(location);
  const image = getPrimaryImage(location);
  const heroPreload = location.heroImage || '/lokales/img/default.jpg';

  return `<!doctype html>
<html lang="de" style="${cssVars(location.theme)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  ${renderSeoHead({
    title,
    description,
    canonical,
    image,
    imageAlt: imageAltText(location),
    jsonLd: detailJsonLd(location),
    siteName: location.name,
    favicon: location.favicon,
    preloadImage: heroPreload,
    noindex: Boolean(location.seo?.noindex)
  })}
</head>
<body>
  <header class="local-shell local-shell--header">
    <div class="local-container local-topbar">
      <span class="local-brand">${esc(location.name)}</span>
      <nav class="local-mini-nav" aria-label="Seitennavigation">
        ${renderHeaderLinks(location)}
      </nav>
    </div>
  </header>

  <main>
    <section class="local-detail-hero">
      ${renderHeroMedia(location)}
      <div class="local-detail-hero__overlay">
        <div class="local-container">
          <div class="local-detail-copy">
            <div class="local-detail-copy__intro">
              <p class="local-eyebrow">${esc(location.type || 'Lokal')}</p>
              <h1>${esc(location.name)}</h1>
            </div>
            ${location.shortDescription ? `<p class="local-lead">${esc(location.shortDescription)}</p>` : ''}
            ${renderHeroActions(location)}
          </div>
        </div>
      </div>
    </section>

    <section class="local-detail-main">
      <div class="local-container local-detail-grid">
        <div class="local-detail-stack">
          ${renderHours(location)}
          ${renderGallery(location)}
          ${renderMenu(location)}
          ${renderLocation(location)}
          ${renderInfoSections(location)}
        </div>
      </div>
    </section>
  </main>

  <footer class="local-shell local-shell--footer">
    <div class="local-container local-footer">
      <div class="local-footer-copy">
        <p>${esc(location.name)}</p>
        ${renderSocialLinks(location)}
        ${renderLegalLink(location)}
      </div>
    </div>
  </footer>
  ${renderMenuModal(location)}
  ${renderGalleryModal(location)}
  <script src="/lokales/js/cookie-consent.js" defer></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" defer></script>
  <script src="/lokales/js/lokales-detail.js" defer></script>
</body>
</html>`;
}

function main() {
  const locations = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8')).filter((location) => location?.slug);

  fs.mkdirSync(OUT_BASE, { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_BASE, 'index.html'), renderRootIndex(), 'utf-8');
  fs.writeFileSync(path.join(OUT_BASE, 'index.html'), renderListPage(locations), 'utf-8');

  for (const location of locations) {
    const outDir = path.join(OUT_BASE, location.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), renderPage(location), 'utf-8');
  }

  fs.writeFileSync(path.join(PUBLIC_BASE, 'sitemap.xml'), renderSitemap(locations), 'utf-8');
  fs.writeFileSync(path.join(PUBLIC_BASE, 'robots.txt'), renderRobotsTxt(), 'utf-8');
  copyRootStaticFiles();

  console.log(`✅ ${locations.length} lokale Unterseite(n) generiert.`);
}

main();
