(function () {
  const STORAGE_KEY = 'lokales_cookie_consent_v1';
  const STATUS_ACCEPTED = 'accepted';
  const STATUS_REJECTED = 'rejected';
  const DEFAULT_PRIVACY_URL = 'https://landkreisplaner.de/datenschutz.html';

  function getStoredConsent() {
    try {
      const rawValue = window.localStorage.getItem(STORAGE_KEY);
      if (!rawValue) {
        return null;
      }

      const parsed = JSON.parse(rawValue);
      return parsed?.status === STATUS_ACCEPTED || parsed?.status === STATUS_REJECTED
        ? parsed.status
        : null;
    } catch (error) {
      return null;
    }
  }

  function storeConsent(status) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        status,
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {
      // Ignore storage errors so the site remains usable.
    }
  }

  function resolvePrivacyUrl() {
    const legalLink = document.querySelector('.local-legal-link');
    return legalLink?.href || DEFAULT_PRIVACY_URL;
  }

  function emitConsentChange(status) {
    document.documentElement.dataset.cookieConsent = status || 'unset';
    document.dispatchEvent(new CustomEvent('lokales:cookie-consent-change', {
      detail: {
        status,
        analytics: status === STATUS_ACCEPTED
      }
    }));
  }

  function exposeConsentApi() {
    window.LokalesConsent = {
      getStatus: getStoredConsent,
      hasAnalyticsConsent: function () {
        return getStoredConsent() === STATUS_ACCEPTED;
      },
      reset: function () {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
          // Ignore storage errors.
        }

        document.documentElement.dataset.cookieConsent = 'unset';
      }
    };
  }

  function buildBanner() {
    const banner = document.createElement('aside');
    banner.className = 'local-cookie-banner';
    banner.hidden = true;
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Cookie-Hinweis');
    banner.innerHTML = `
      <p class="local-cookie-banner__eyebrow">Cookie-Hinweis</p>
      <p class="local-cookie-banner__text">
        Aktuell ist noch kein Analyse-Tracking aktiv. Mit deiner Auswahl speichern wir,
        ob wir spaeter Analyse-Tools wie Google Analytics aktivieren duerfen.
      </p>
      <div class="local-cookie-banner__actions">
        <button type="button" class="local-cookie-banner__button local-cookie-banner__button--primary" data-cookie-accept>
          Annehmen
        </button>
        <button type="button" class="local-cookie-banner__button local-cookie-banner__button--ghost" data-cookie-reject>
          Ablehnen
        </button>
      </div>
      <a class="local-cookie-banner__link" href="${resolvePrivacyUrl()}" target="_blank" rel="noopener">
        Datenschutz
      </a>
    `;

    return banner;
  }

  function showBanner(banner) {
    banner.hidden = false;
    requestAnimationFrame(() => {
      banner.classList.add('is-visible');
    });
  }

  function hideBanner(banner) {
    banner.classList.remove('is-visible');
    window.setTimeout(() => {
      banner.hidden = true;
    }, 220);
  }

  function initBanner() {
    exposeConsentApi();

    const existingStatus = getStoredConsent();
    emitConsentChange(existingStatus);

    if (existingStatus) {
      return;
    }

    const banner = buildBanner();
    document.body.appendChild(banner);

    const acceptButton = banner.querySelector('[data-cookie-accept]');
    const rejectButton = banner.querySelector('[data-cookie-reject]');

    function handleDecision(status) {
      storeConsent(status);
      emitConsentChange(status);
      hideBanner(banner);
    }

    acceptButton?.addEventListener('click', () => handleDecision(STATUS_ACCEPTED));
    rejectButton?.addEventListener('click', () => handleDecision(STATUS_REJECTED));

    window.setTimeout(() => {
      showBanner(banner);
    }, 240);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBanner, { once: true });
  } else {
    initBanner();
  }
})();
