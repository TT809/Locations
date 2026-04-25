(function () {
  const galleries = document.querySelectorAll('[data-gallery]');
  const header = document.querySelector('.local-shell--header');
  const menuModal = document.querySelector('[data-menu-modal]');
  const menuOpen = document.querySelector('[data-menu-open]');
  const menuCloseButtons = document.querySelectorAll('[data-menu-close]');
  const galleryModal = document.querySelector('[data-gallery-modal]');
  const galleryModalImage = galleryModal?.querySelector('[data-gallery-modal-image]');
  const galleryModalScroll = galleryModal?.querySelector('[data-gallery-modal-scroll]');
  const galleryModalPrev = galleryModal?.querySelector('[data-gallery-modal-prev]');
  const galleryModalNext = galleryModal?.querySelector('[data-gallery-modal-next]');
  const galleryZoomIn = galleryModal?.querySelector('[data-gallery-zoom-in]');
  const galleryZoomOut = galleryModal?.querySelector('[data-gallery-zoom-out]');
  const galleryZoomReset = galleryModal?.querySelector('[data-gallery-zoom-reset]');
  let lastScrollY = window.scrollY;
  let ticking = false;
  let activeGalleryItems = [];
  let activeGalleryIndex = 0;
  let activeGalleryZoom = 1;

  function clampZoom(value, maxZoom) {
    return Math.min(Math.max(value, 1), maxZoom);
  }

  function getScrollPadding(element) {
    const styles = window.getComputedStyle(element);
    return {
      x: Number.parseFloat(styles.paddingLeft || '0') + Number.parseFloat(styles.paddingRight || '0'),
      y: Number.parseFloat(styles.paddingTop || '0') + Number.parseFloat(styles.paddingBottom || '0')
    };
  }

  function applyGalleryZoom() {
    if (!galleryModalImage || !galleryModalScroll || !galleryModalImage.naturalWidth || !galleryModalImage.naturalHeight) {
      return;
    }

    const padding = getScrollPadding(galleryModalScroll);
    const availableWidth = Math.max(galleryModalScroll.clientWidth - padding.x, 120);
    const availableHeight = Math.max(galleryModalScroll.clientHeight - padding.y, 120);
    const fitScale = Math.min(
      availableWidth / galleryModalImage.naturalWidth,
      availableHeight / galleryModalImage.naturalHeight
    );
    const width = galleryModalImage.naturalWidth * fitScale * activeGalleryZoom;
    const height = galleryModalImage.naturalHeight * fitScale * activeGalleryZoom;
    const verticalInset = Math.max((availableHeight - height) / 2, 0);

    galleryModalImage.style.width = `${width}px`;
    galleryModalImage.style.height = `${height}px`;
    galleryModalImage.style.marginTop = `${verticalInset}px`;
    galleryModalImage.style.marginBottom = `${verticalInset}px`;
    if (galleryZoomOut) {
      galleryZoomOut.disabled = activeGalleryZoom <= 1;
    }
    if (galleryZoomIn) {
      galleryZoomIn.disabled = activeGalleryZoom >= 4;
    }
  }

  function updateGalleryButtons(track, prev, next) {
    const maxScroll = track.scrollWidth - track.clientWidth;
    prev.disabled = track.scrollLeft <= 8;
    next.disabled = track.scrollLeft >= maxScroll - 8;
  }

  galleries.forEach((gallery) => {
    const track = gallery.querySelector('[data-gallery-track]');
    const prev = gallery.querySelector('[data-gallery-prev]');
    const next = gallery.querySelector('[data-gallery-next]');
    const items = Array.from(gallery.querySelectorAll('[data-gallery-open]'));

    if (!track || !prev || !next) {
      return;
    }

    function scrollGallery(direction) {
      const amount = Math.max(track.clientWidth * 0.82, 260);
      track.scrollBy({
        left: direction * amount,
        behavior: 'smooth'
      });
    }

    prev.addEventListener('click', () => scrollGallery(-1));
    next.addEventListener('click', () => scrollGallery(1));
    track.addEventListener('scroll', () => updateGalleryButtons(track, prev, next), { passive: true });
    window.addEventListener('resize', () => updateGalleryButtons(track, prev, next));
    updateGalleryButtons(track, prev, next);

    if (galleryModal && galleryModalImage && galleryModalScroll && galleryModalPrev && galleryModalNext) {
      items.forEach((item, index) => {
        item.addEventListener('click', () => {
          activeGalleryItems = items;
          activeGalleryIndex = index;
          renderGalleryModal();
          galleryModal.hidden = false;
          document.body.classList.add('local-body--modal-open');
        });
      });
    }
  });

  function renderGalleryModal() {
    if (!galleryModalImage || !galleryModalScroll || !galleryModalPrev || !galleryModalNext || !activeGalleryItems.length) {
      return;
    }

    const item = activeGalleryItems[activeGalleryIndex];
    const src = item.getAttribute('data-image-src') || '';
    const alt = item.getAttribute('data-image-alt') || '';

    galleryModalImage.src = src;
    galleryModalImage.alt = alt;
    activeGalleryZoom = 1;
    galleryModalScroll.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    galleryModalPrev.disabled = activeGalleryIndex <= 0;
    galleryModalNext.disabled = activeGalleryIndex >= activeGalleryItems.length - 1;

    if (galleryModalImage.complete) {
      applyGalleryZoom();
    } else {
      galleryModalImage.addEventListener('load', applyGalleryZoom, { once: true });
    }
  }

  if (galleryModal && galleryModalPrev && galleryModalNext && galleryModalImage) {
    galleryModalPrev.addEventListener('click', () => {
      if (activeGalleryIndex > 0) {
        activeGalleryIndex -= 1;
        renderGalleryModal();
      }
    });

    galleryModalNext.addEventListener('click', () => {
      if (activeGalleryIndex < activeGalleryItems.length - 1) {
        activeGalleryIndex += 1;
        renderGalleryModal();
      }
    });

    galleryModal.querySelectorAll('[data-gallery-close]').forEach((button) => {
      button.addEventListener('click', () => {
        galleryModal.hidden = true;
        document.body.classList.remove('local-body--modal-open');
      });
    });

    galleryZoomIn?.addEventListener('click', () => {
      activeGalleryZoom = clampZoom(activeGalleryZoom + 0.25, 4);
      applyGalleryZoom();
    });

    galleryZoomOut?.addEventListener('click', () => {
      activeGalleryZoom = clampZoom(activeGalleryZoom - 0.25, 4);
      applyGalleryZoom();
    });

    galleryZoomReset?.addEventListener('click', () => {
      activeGalleryZoom = 1;
      galleryModalScroll.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      applyGalleryZoom();
    });

    window.addEventListener('resize', () => {
      if (!galleryModal.hidden) {
        applyGalleryZoom();
      }
    });
  }

  async function setupPdfViewer(viewer) {
    if (!viewer || !window.pdfjsLib) {
      return;
    }

    const src = viewer.getAttribute('data-pdf-src');
    const canvas = viewer.querySelector('[data-menu-canvas]');
    const prev = viewer.querySelector('[data-menu-prev]');
    const next = viewer.querySelector('[data-menu-next]');
    const status = viewer.querySelector('[data-menu-status]');
    const modalScroll = viewer.querySelector('.local-modal__media-scroll');
    const isModalViewer = viewer.hasAttribute('data-menu-modal-viewer');
    const zoomIn = viewer.parentElement?.querySelector('[data-menu-zoom-in]');
    const zoomOut = viewer.parentElement?.querySelector('[data-menu-zoom-out]');
    const zoomReset = viewer.parentElement?.querySelector('[data-menu-zoom-reset]');

    if (!src || !canvas || !prev || !next || !status) {
      return;
    }

    const loadingTask = window.pdfjsLib.getDocument(src);
    const pdf = await loadingTask.promise;
    let pageNumber = 1;
    let renderTask = null;
    let zoomLevel = 1;
    let modalViewportLock = null;

    function getCurrentModalViewport() {
      return {
        width: modalScroll?.clientWidth || viewer.clientWidth || 760,
        height: modalScroll?.clientHeight || window.innerHeight * 0.8
      };
    }

    async function renderPage() {
      const page = await pdf.getPage(pageNumber);
      const rotation = ((page.rotate || 0) % 360 + 360) % 360;
      const normalizedRotation = rotation === 180 ? 0 : rotation;
      const viewport = page.getViewport({ scale: 1, rotation: normalizedRotation });
      const modalViewport = isModalViewer
        ? (modalViewportLock || getCurrentModalViewport())
        : null;
      const containerWidth = isModalViewer
        ? modalViewport.width
        : viewer.clientWidth || 760;
      const containerHeight = isModalViewer
        ? modalViewport.height
        : viewer.clientHeight || window.innerHeight * 0.7;
      const fitWidthScale = Math.max((containerWidth - 24) / viewport.width, 0.1);
      const fitHeightScale = Math.max((containerHeight - 24) / viewport.height, 0.1);
      let scale = fitWidthScale;

      if (isModalViewer) {
        const fitScale = Math.min(fitWidthScale, fitHeightScale);
        scale = Math.min(fitScale * zoomLevel, 4);
      } else {
        scale = Math.min(Math.max(fitWidthScale, 0.7), 1.8);
      }

      const scaledViewport = page.getViewport({ scale, rotation: normalizedRotation });
      const context = canvas.getContext('2d');
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      const verticalInset = isModalViewer
        ? Math.max((containerHeight - scaledViewport.height) / 2, 0)
        : 0;

      if (renderTask) {
        try {
          renderTask.cancel();
        } catch (error) {
          // Ignore cancellations from previous renders.
        }
      }

      canvas.width = Math.floor(scaledViewport.width * outputScale);
      canvas.height = Math.floor(scaledViewport.height * outputScale);
      canvas.style.width = `${scaledViewport.width}px`;
      canvas.style.height = `${scaledViewport.height}px`;
      canvas.style.marginTop = `${verticalInset}px`;
      canvas.style.marginBottom = `${verticalInset}px`;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);

      const renderOptions = {
        canvasContext: context,
        viewport: scaledViewport
      };

      if (outputScale !== 1) {
        renderOptions.transform = [outputScale, 0, 0, outputScale, 0, 0];
      }

      renderTask = page.render(renderOptions);

      try {
        await renderTask.promise;
      } catch (error) {
        if (error?.name === 'RenderingCancelledException') {
          return;
        }

        throw error;
      } finally {
        renderTask = null;
      }

      if (modalScroll) {
        modalScroll.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }

      status.textContent = `Seite ${pageNumber} von ${pdf.numPages}`;
      prev.disabled = pageNumber <= 1;
      next.disabled = pageNumber >= pdf.numPages;
      if (isModalViewer) {
        if (zoomOut) {
          zoomOut.disabled = zoomLevel <= 1;
        }
        if (zoomIn) {
          zoomIn.disabled = zoomLevel >= 4;
        }
      }
    }

    prev.addEventListener('click', async () => {
      if (pageNumber <= 1) {
        return;
      }

      pageNumber -= 1;
      if (isModalViewer) {
        zoomLevel = 1;
      }
      await renderPage();
    });

    next.addEventListener('click', async () => {
      if (pageNumber >= pdf.numPages) {
        return;
      }

      pageNumber += 1;
      if (isModalViewer) {
        zoomLevel = 1;
      }
      await renderPage();
    });

    window.addEventListener('resize', () => {
      if (isModalViewer) {
        if (!menuModal || menuModal.hidden) {
          return;
        }

        const nextViewport = getCurrentModalViewport();

        if (!modalViewportLock) {
          modalViewportLock = nextViewport;
          renderPage().catch(() => {});
          return;
        }

        const widthDelta = Math.abs(nextViewport.width - modalViewportLock.width);
        const heightDelta = Math.abs(nextViewport.height - modalViewportLock.height);

        // Ignore small viewport changes caused by mobile browser chrome while
        // scrolling inside the fullscreen modal. Only rerender on substantial
        // changes like rotation or a real layout change.
        if (widthDelta < 48 && heightDelta < 160) {
          return;
        }

        modalViewportLock = nextViewport;
      }

      renderPage().catch(() => {});
    });

    if (isModalViewer) {
      zoomIn?.addEventListener('click', async () => {
        zoomLevel = clampZoom(zoomLevel + 0.25, 4);
        await renderPage();
      });

      zoomOut?.addEventListener('click', async () => {
        zoomLevel = clampZoom(zoomLevel - 0.25, 4);
        await renderPage();
      });

      zoomReset?.addEventListener('click', async () => {
        zoomLevel = 1;
        modalScroll?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        await renderPage();
      });

      viewer.addEventListener('lokales:modal-open', async () => {
        zoomLevel = 1;
        modalViewportLock = getCurrentModalViewport();
        modalScroll?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        await renderPage();
      });

      viewer.addEventListener('lokales:modal-close', () => {
        modalViewportLock = null;
      });

      viewer.addEventListener('lokales:modal-reset-zoom', async () => {
        zoomLevel = 1;
        modalScroll?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        await renderPage();
      });
    }

    await renderPage();
  }

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const menuViewers = document.querySelectorAll('[data-menu-viewer], [data-menu-modal-viewer]');
  menuViewers.forEach((viewer) => {
    setupPdfViewer(viewer).catch((error) => {
      console.error('Fehler beim Laden der Speisekarte', error);
    });
  });

  if (menuModal && menuOpen) {
    function closeMenuModal() {
      menuModal.hidden = true;
      document.body.classList.remove('local-body--modal-open');
      menuModal.querySelector('[data-menu-modal-viewer]')?.dispatchEvent(new CustomEvent('lokales:modal-close'));
    }

    function openMenuModal() {
      menuModal.hidden = false;
      document.body.classList.add('local-body--modal-open');
      window.requestAnimationFrame(() => {
        menuModal.querySelector('[data-menu-modal-viewer]')?.dispatchEvent(new CustomEvent('lokales:modal-open'));
      });
      const closeButton = menuModal.querySelector('[data-menu-close]');
      if (closeButton) {
        closeButton.focus();
      }
    }

    menuOpen.addEventListener('click', openMenuModal);
    menuOpen.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openMenuModal();
      }
    });

    menuCloseButtons.forEach((button) => button.addEventListener('click', closeMenuModal));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (menuModal && !menuModal.hidden) {
          closeMenuModal();
        }

        if (galleryModal && !galleryModal.hidden) {
          galleryModal.hidden = true;
          document.body.classList.remove('local-body--modal-open');
        }
      }
    });
  }

  if (header) {
    function updateHeaderVisibility() {
      const isMobile = window.matchMedia('(max-width: 720px)').matches;

      if (!isMobile) {
        header.classList.remove('local-shell--header-hidden');
        lastScrollY = window.scrollY;
        ticking = false;
        return;
      }

      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY + 10 && currentScrollY > 88) {
        header.classList.add('local-shell--header-hidden');
      } else if (currentScrollY < lastScrollY - 10 || currentScrollY <= 8) {
        header.classList.remove('local-shell--header-hidden');
      }

      lastScrollY = currentScrollY;
      ticking = false;
    }

    function onScroll() {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(updateHeaderVisibility);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateHeaderVisibility);
    updateHeaderVisibility();
  }
})();
