let liveMiniMap = null;
let liveMiniMapLayer = null;
let liveBaseLayerMode = 'dark';
let liveDarkLayer = null;
let liveLightLayer = null;
let liveSatelliteLayer = null;
let liveDashboardDebounce = null;
let liveMenyStatsMapCache = null;
let liveCoordsByNameCache = null;
let liveUnderlagSignatur = '';
let livePizzeriaPosterCache = [];
let liveNamnSynsFranZoom = 15;
let livePizzeriaMarkorer = [];
window.liveInsightsState = window.liveInsightsState || { oppetSentAktiv: false, senastePrisspann: null };
window.__liveTopDebug = window.__liveTopDebug || { calls: 0, lastError: null, lastPayload: null };

// Exponera till window för debugging
window.liveMiniMap = null;
window.liveMiniMapLayer = null;

function byggLiveCoordsByNameCache(coordsMap) {
    const byName = new Map();
    if (!(coordsMap instanceof Map)) return byName;

    coordsMap.forEach((coords, nyckel) => {
        if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return;
        const namnDel = String(nyckel || '').split('|||')[0] || '';
        if (!namnDel) return;
        if (!byName.has(namnDel)) {
            byName.set(namnDel, coords);
        }
    });

    return byName;
}

function hamtaLiveCoordsForPizza(pizza) {
    const striktNyckel = skapaPizzeriaCoordsNyckel(pizza?.pizzeria, pizza?.adress);
    let coords = indexCoordsMap?.get(striktNyckel) || null;

    if (!coords && liveCoordsByNameCache) {
        const namnNyckel = normaliseraText(pizza?.pizzeria || '');
        coords = liveCoordsByNameCache.get(namnNyckel) || null;
    }

    if (!coords && typeof hamtaCoordsFranStatiskLista === 'function') {
        coords = hamtaCoordsFranStatiskLista(pizza?.adress) || null;
    }

    if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return null;
    return coords;
}

function laddaLeafletForIndex(cb) {
    if (window.L && window.L.markerClusterGroup) {
        cb();
        return;
    }

    if (!document.querySelector('link[data-leaflet="index"]')) {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        css.crossOrigin = '';
        css.dataset.leaflet = 'index';
        document.head.appendChild(css);

        const clusterBaseCss = document.createElement('link');
        clusterBaseCss.rel = 'stylesheet';
        clusterBaseCss.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
        clusterBaseCss.crossOrigin = '';
        clusterBaseCss.dataset.leaflet = 'cluster-base';
        document.head.appendChild(clusterBaseCss);

        const clusterCss = document.createElement('link');
        clusterCss.rel = 'stylesheet';
        clusterCss.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
        clusterCss.crossOrigin = '';
        clusterCss.dataset.leaflet = 'cluster';
        document.head.appendChild(clusterCss);
    }

    if (document.querySelector('script[data-leaflet="index"]')) {
        document.addEventListener('leaflet-index-loaded', cb, { once: true });
        return;
    }

    const js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.crossOrigin = '';
    js.dataset.leaflet = 'index';
    js.onload = () => {
        const clusterJs = document.createElement('script');
        clusterJs.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
        clusterJs.crossOrigin = '';
        clusterJs.dataset.leaflet = 'cluster';
        clusterJs.onload = () => {
            document.dispatchEvent(new Event('leaflet-index-loaded'));
            cb();
        };
        document.body.appendChild(clusterJs);
    };
    document.body.appendChild(js);
}

function byggPizzeriaPosterFranPizzor(pizzor) {
    const map = new Map();
    if (!liveMenyStatsMapCache) {
        liveMenyStatsMapCache = byggLiveMenyStatsMap(allaPizzor);
    }

    (Array.isArray(pizzor) ? pizzor : []).forEach((pizza) => {
        const nyckel = skapaPizzeriaCoordsNyckel(pizza?.pizzeria, pizza?.adress);
        const coords = hamtaLiveCoordsForPizza(pizza);
        if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return;

        let post = map.get(nyckel);
        if (!post) {
            const oppettider = pizza?.oppettider || hamtaOppettimerForPizzeria(pizza?.pizzeria) || null;
            post = {
                nyckel,
                pizzeria: pizza?.pizzeria || 'Okand pizzeria',
                adress: pizza?.adress || '',
                lat: coords.lat,
                lng: coords.lng,
                telefon: pizza?.telefon || hamtaTelefonForPizzeria(pizza?.pizzeria) || '',
                slug: skapaDynamiskPizzeriaLank(pizza?.pizzeria || '').split('/').pop() || '',
                lagstaPris: null,
                snittPris: null,
                oppettider,
                menyStats: liveMenyStatsMapCache.get(normaliseraText(pizza?.pizzeria || '')) || null,
                arOppet: arOppetNu(oppettider) === true,
                _prisSum: 0,
                _prisCount: 0,
                _prisMin: Infinity
            };
            map.set(nyckel, post);
        }

        const pris = Number(pizza?.pris);
        if (Number.isFinite(pris) && pris > 0) {
            post._prisSum += pris;
            post._prisCount += 1;
            if (pris < post._prisMin) post._prisMin = pris;
        }
    });

    map.forEach((post) => {
        post.lagstaPris = post._prisCount > 0 ? post._prisMin : null;
        post.snittPris = post._prisCount > 0 ? Math.round(post._prisSum / post._prisCount) : null;
        delete post._prisSum;
        delete post._prisCount;
        delete post._prisMin;
    });

    return [...map.values()];
}

function skapaLiveUnderlagSignatur(underlag) {
    const rows = Array.isArray(underlag) ? underlag : [];
    const len = rows.length;
    if (len === 0) return '0';

    const first = rows[0];
    const mid = rows[Math.floor(len / 2)];
    const last = rows[len - 1];

    const nyckelFor = (rad) => skapaPizzeriaCoordsNyckel(rad?.pizzeria, rad?.adress);
    return [
        len,
        nyckelFor(first),
        nyckelFor(mid),
        nyckelFor(last)
    ].join('|');
}

function uppdateraLiveKartlager(pizzeriaPoster) {
    if (!liveMiniMap || !liveMiniMapLayer) return;

    liveMiniMapLayer.clearLayers();
    livePizzeriaMarkorer = [];
    pizzeriaPoster.forEach((post) => {
        const marker = L.marker([post.lat, post.lng], {
            icon: skapaLiveMarkorIkon(post)
        });
        marker.bindTooltip(post?.pizzeria || '', {
            permanent: false,
            direction: 'top',
            offset: [0, -62],
            className: 'live-karta-tooltip-namn',
            opacity: 1,
            interactive: false
        });
        liveMiniMapLayer.addLayer(marker);
        livePizzeriaMarkorer.push(marker);
    });

    uppdateraLiveNamnEtiketter();
}

function uppdateraLiveNamnEtiketter() {
    if (!liveMiniMap || !liveMiniMapLayer) return;
    const visaNamn = liveMiniMap.getZoom() >= liveNamnSynsFranZoom;

    livePizzeriaMarkorer.forEach((marker) => {
        if (!marker || !marker.getTooltip() || !liveMiniMapLayer.hasLayer(marker)) return;
        if (visaNamn) {
            marker.openTooltip();
        } else {
            marker.closeTooltip();
        }
    });
}

function byggLiveMenyStatsMap(pizzor) {
    const map = new Map();
    (Array.isArray(pizzor) ? pizzor : []).forEach((rad) => {
        const nyckel = normaliseraText(rad?.pizzeria || '');
        if (!nyckel) return;
        if (!map.has(nyckel)) {
            map.set(nyckel, { pizzor: 0, burgare: 0, sallader: 0, pasta: 0 });
        }
        const post = map.get(nyckel);
        const namn = String(rad?.pizza_namn || '').toLowerCase();
        if (namn.includes('sallad') || namn.includes('bowl')) {
            post.sallader += 1;
        } else if (namn.includes('burger') || namn.includes('burgare') || namn.includes('hamburgare')) {
            post.burgare += 1;
        } else if (namn.includes('pasta') || namn.includes('lasagne')) {
            post.pasta += 1;
        } else {
            post.pizzor += 1;
        }
    });
    return map;
}

function hamtaPrisNivaKlass(pris) {
    const num = Number(pris);
    if (!Number.isFinite(num) || num <= 0) return 'level3';
    if (num < 90) return 'level1';
    if (num < 105) return 'level2';
    if (num < 125) return 'level3';
    if (num < 145) return 'level4';
    return 'level5';
}

function skapaLiveMarkorIkon(post) {
    const pris = Number(post?.lagstaPris);
    const prisKlass = hamtaPrisNivaKlass(pris);
    const prisText = Number.isFinite(pris) ? `fr ${Math.round(pris)} kr` : '';
    const prisHtml = prisText
        ? `<span class="karta-markor-pris karta-markor-pris--${prisKlass}">${prisText}</span>`
        : '';

    return L.divIcon({
        className: 'karta-markor-ikon',
        html: `<div class="karta-markor-wrap">
            <img src="/images/Pizza%20_Gubbe.png" alt="" class="karta-markor-figur" />
            ${prisHtml}
        </div>`,
        iconSize: [64, 64],
        iconAnchor: [32, 64],
        popupAnchor: [0, -96]
    });
}

function formatLiveDistance(km) {
    if (!Number.isFinite(km)) return '';
    return km < 1
        ? `${Math.round(km * 1000)} m`
        : `${km.toFixed(1).replace('.', ',')} km`;
}

function skapaLivePopupHtml(post, distansText) {
    const pizzeriaUrl = hamtaNavigeringsLankForPizzeria(`/pizzerior/${post?.slug || ''}`);
    const oppettider = post?.oppettider && typeof post.oppettider === 'object' ? post.oppettider : null;
    const oppettiderRader = oppettider
        ? Object.keys(oppettider).map((dag) => `<li><span>${dag}</span><span>${oppettider[dag]}</span></li>`).join('')
        : '<li><span>Öppettider</span><span>Saknas</span></li>';

    const menyStats = post?.menyStats;
    const menyRows = menyStats
        ? [
            `<div class="karta-popup-stats-rad"><span>🍕</span><span>Pizzor</span><strong>${menyStats.pizzor || 0}</strong></div>`,
            `<div class="karta-popup-stats-rad"><span>🍔</span><span>Burgare</span><strong>${menyStats.burgare || 0}</strong></div>`,
            `<div class="karta-popup-stats-rad"><span>🥗</span><span>Sallader</span><strong>${menyStats.sallader || 0}</strong></div>`,
            `<div class="karta-popup-stats-rad"><span>🍝</span><span>Pasta</span><strong>${menyStats.pasta || 0}</strong></div>`
        ].join('')
        : '<div class="karta-popup-stats-rad"><span>📋</span><span>Menyöversikt</span><strong>-</strong></div>';

    const ringKnapp = post?.telefon
        ? `<a href="tel:${String(post.telefon).replace(/\s+/g, '')}" class="karta-popup-btn">📞 Ring</a>`
        : '';

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${post.lat},${post.lng}`;
    
    const favoriter = hamtaFavoriter();
    const erFavorit = favoriter.indexOf(post?.slug) >= 0;
    const utilRad = `<div class="karta-popup-util-rad">
        <button onclick="event.stopPropagation(); window.toggleFavorit('${post?.slug}')" class="karta-popup-btn--util${erFavorit ? ' is-favorit' : ''}" id="fav-btn-live-${post?.slug}" type="button">
            ${erFavorit ? '❤ Sparad' : '🤍 Spara'}
        </button>
        <button onclick="event.stopPropagation(); window.delaPizzeria('${post?.slug}')" class="karta-popup-btn--util" type="button">🔗 Dela</button>
    </div>`;

    return `<div class="karta-popup">
      <div class="karta-popup-karusell">
        <div class="karta-popup-sida karta-popup-sida--aktiv">
          <p class="karta-popup-namn">${escapaHtml(post?.pizzeria || 'Pizzeria')}</p>
          <p class="karta-popup-adress">${escapaHtml(post?.adress || 'Adress saknas')}</p>
          <p class="karta-popup-distans">${distansText ? `📍 ${distansText} bort` : '📍 Avstånd saknas'}</p>
          <p class="karta-popup-distans">💸 ${Number.isFinite(post?.lagstaPris) ? `Från ${Math.round(post.lagstaPris)} kr` : 'Pris saknas'}</p>
          <a href="${escapaHtml(pizzeriaUrl)}" class="karta-popup-btn">🍕 Se meny</a>
          ${utilRad}
        </div>
        <div class="karta-popup-sida">
          <p class="karta-popup-namn">📋 Menyöversikt</p>
          <div class="karta-popup-stats-lista">${menyRows}</div>
        </div>
        <div class="karta-popup-sida">
          <p class="karta-popup-namn">🧭 Kontakt & väg</p>
          <ul class="karta-popup-oppettider-lista">${oppettiderRader}</ul>
          ${ringKnapp}
          <a href="${mapsUrl}" class="karta-popup-btn" target="_blank" rel="noopener noreferrer">🗺 Vägbeskrivning</a>
        </div>
      </div>
      <div class="karta-popup-karusell-nav">
        <button class="karta-popup-nav-pil" onclick="window.livePopupBlaeddra(this,-1)" type="button">‹</button>
        <span class="karta-popup-nav-prickar">
          <span class="karta-popup-nav-prick karta-popup-nav-prick--aktiv"></span>
          <span class="karta-popup-nav-prick"></span>
          <span class="karta-popup-nav-prick"></span>
        </span>
        <button class="karta-popup-nav-pil" onclick="window.livePopupBlaeddra(this,1)" type="button">›</button>
      </div>
    </div>`;
}

window.livePopupBlaeddra = function (knapp, riktning) {
    const popup = knapp.closest('.karta-popup');
    if (!popup) return;
    const sidor = popup.querySelectorAll('.karta-popup-sida');
    const prickar = popup.querySelectorAll('.karta-popup-nav-prick');
    const aktiv = popup.querySelector('.karta-popup-sida--aktiv');
    const nuIndex = Array.prototype.indexOf.call(sidor, aktiv);
    const nyttIndex = (nuIndex + riktning + sidor.length) % sidor.length;
    sidor.forEach((sida) => sida.classList.remove('karta-popup-sida--aktiv'));
    prickar.forEach((prick) => prick.classList.remove('karta-popup-nav-prick--aktiv'));
    sidor[nyttIndex].classList.add('karta-popup-sida--aktiv');
    if (prickar[nyttIndex]) prickar[nyttIndex].classList.add('karta-popup-nav-prick--aktiv');
};

function parseeraTidIMinuter(tidStr) {
    const match = String(tidStr || '').match(/^(\d{1,2})[:.](\d{1,2})$/);
    if (!match) return null;
    const timmar = Number(match[1]);
    const minuter = Number(match[2]);
    if (!Number.isFinite(timmar) || !Number.isFinite(minuter)) return null;
    if (timmar === 24 && minuter === 0) return 1440;
    if (timmar < 0 || timmar > 23 || minuter < 0 || minuter > 59) return null;
    return (timmar * 60) + minuter;
}

function pizzeriaHarOppetSent(oppettider, gransMinuter = 22 * 60) {
    if (!oppettider || typeof oppettider !== 'object') return false;

    return Object.values(oppettider).some((intervall) => {
        const match = String(intervall || '').match(/(\d{1,2}[:.]\d{1,2})\s*[-–—]\s*(\d{1,2}[:.]\d{1,2})/);
        if (!match) return false;

        const oppnar = parseeraTidIMinuter(match[1]);
        const stanger = parseeraTidIMinuter(match[2]);
        if (oppnar === null || stanger === null) return false;

        if (stanger <= oppnar) return true;
        return stanger >= gransMinuter;
    });
}

window.pizzeriaHarOppetSent = pizzeriaHarOppetSent;

function beraknaVanligastePrisintervall(priser) {
    if (!Array.isArray(priser) || priser.length === 0) return null;
    const spannBredd = 30;
    const buckets = new Map();

    priser.forEach((pris) => {
        const num = Number(pris);
        if (!Number.isFinite(num) || num <= 0) return;
        const start = Math.floor(num / spannBredd) * spannBredd;
        const nyckel = `${start}-${start + spannBredd}`;
        buckets.set(nyckel, (buckets.get(nyckel) || 0) + 1);
    });

    if (buckets.size === 0) return null;
    let bastaNyckel = null;
    let hogstaAntal = -1;

    buckets.forEach((antal, nyckel) => {
        if (antal > hogstaAntal) {
            hogstaAntal = antal;
            bastaNyckel = nyckel;
        }
    });

    return bastaNyckel;
}

function uppdateraLiveInsightsUi({ billigastNamn, billigastPris, oppetSentAntal, vanligasteSpann }) {
    const insightBilligast = document.getElementById('live-insight-cheapest');
    const insightSent = document.getElementById('live-insight-late');
    const insightSpann = document.getElementById('live-insight-range');

    if (insightBilligast) {
        insightBilligast.textContent = Number.isFinite(billigastPris)
            ? `💸 Billigast i vyn: ${Math.round(billigastPris)} kr hos ${billigastNamn || 'okänd pizzeria'}`
            : '💸 Billigast i vyn: -';
    }

    if (insightSent) {
        insightSent.textContent = `🌙 ${Number(oppetSentAntal || 0)} öppna sent`;
    }

    if (insightSpann) {
        insightSpann.textContent = vanligasteSpann
            ? `📈 Vanligaste prisspann: ${vanligasteSpann} kr`
            : '📈 Vanligaste prisspann: -';
    }

    window.liveInsightsState.senastePrisspann = vanligasteSpann || null;
}

function tillampaLivePrisspannFilter(prisspann) {
    if (!prisspann || typeof prisspann !== 'string') return;
    const match = prisspann.match(/^(\d+)-(\d+)$/);
    if (!match) return;
    const minPris = Number(match[1]);
    const maxPris = Number(match[2]);
    const underlag = prisSliderUnderlag || hamtaPrisSliderUnderlag();
    if (!underlag) return;

    const minPercent = omvandlaPrisTillSliderPercent(minPris, underlag);
    const maxPercent = omvandlaPrisTillSliderPercent(maxPris, underlag);
    const slMin = document.getElementById('pris-slider-min');
    const slMax = document.getElementById('pris-slider-max');
    const fillLeft = document.getElementById('pris-slider-fill-left');
    const fill = document.getElementById('pris-slider-fill');
    const visning = document.getElementById('pris-slider-visning');
    const wrap = document.getElementById('pris-slider-wrap');

    if (slMin) slMin.value = String(minPercent);
    if (slMax) slMax.value = String(maxPercent);
    if (fillLeft) fillLeft.style.width = `${minPercent}%`;
    if (fill) fill.style.left = `${maxPercent}%`;

    aktivtPrisFiltreMin = minPris;
    aktivtPrisFiltreMax = maxPris;
    if (visning) visning.textContent = formatPrisSliderText(aktivtPrisFiltreMin, aktivtPrisFiltreMax, 0);
    if (wrap) wrap.classList.add('pris-slider-aktiv');
}

function initLiveInsightsActions() {
    const chips = document.querySelectorAll('[data-live-action]');
    if (!chips.length) return;

    chips.forEach((chip) => {
        chip.addEventListener('click', () => {
            const action = chip.getAttribute('data-live-action');
            if (action === 'cheapest') {
                const sortering = document.getElementById('pris-sortering');
                if (sortering) sortering.value = 'billigast';
                uppdateraVisning();
                return;
            }

            if (action === 'late') {
                window.liveInsightsState.oppetSentAktiv = !window.liveInsightsState.oppetSentAktiv;
                const sentChip = document.getElementById('live-insight-late');
                if (sentChip) sentChip.classList.toggle('is-active', window.liveInsightsState.oppetSentAktiv);
                uppdateraVisning();
                return;
            }

            if (action === 'range') {
                tillampaLivePrisspannFilter(window.liveInsightsState.senastePrisspann);
                uppdateraVisning();
            }
        });
    });
}

function initLiveMapExpandModal() {
    const expandBtn = document.getElementById('live-map-expand');
    const modal = document.getElementById('live-karta-modal');
    const closeBtn = document.getElementById('live-karta-modal-close');
    const storIframe = document.getElementById('live-karta-iframe-stor');
    if (!expandBtn || !modal || !closeBtn || !storIframe) return;

    const oppna = () => {
        if (!storIframe.getAttribute('src')) {
            storIframe.setAttribute('src', '/karta.html?embed=1');
        }
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    };

    const stang = () => {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    };

    expandBtn.addEventListener('click', oppna);
    closeBtn.addEventListener('click', stang);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) stang();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('is-open')) {
            stang();
        }
    });
}

function initLiveBaseLayers() {
    if (!liveMiniMap) return;
    if (!liveDarkLayer) {
        liveDarkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            subdomains: 'abcd'
        });
    }
    if (!liveLightLayer) {
        liveLightLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            subdomains: 'abc'
        });
    }
    if (!liveSatelliteLayer) {
        liveSatelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19
        });
    }
}

function uppdateraLiveTemaKnapp() {
    const satBtn = document.getElementById('live-map-sat-btn');
    if (!satBtn) return;

    const etikett = liveBaseLayerMode === 'dark'
        ? 'KARTA'
        : liveBaseLayerMode === 'light'
            ? 'SAT'
            : 'MORK';

    satBtn.textContent = etikett;
    satBtn.setAttribute('aria-pressed', liveBaseLayerMode === 'satellite' ? 'true' : 'false');
}

function sattaLiveBaslager(mode) {
    if (!liveMiniMap) return;
    initLiveBaseLayers();
    const mapEl = document.getElementById('live-mini-map');

    [liveDarkLayer, liveLightLayer, liveSatelliteLayer].forEach((lager) => {
        if (lager && liveMiniMap.hasLayer(lager)) {
            liveMiniMap.removeLayer(lager);
        }
    });

    if (mode === 'light' && liveLightLayer) {
        liveLightLayer.addTo(liveMiniMap);
    } else if (mode === 'satellite' && liveSatelliteLayer) {
        liveSatelliteLayer.addTo(liveMiniMap);
    } else if (liveDarkLayer) {
        mode = 'dark';
        liveDarkLayer.addTo(liveMiniMap);
    }

    liveBaseLayerMode = mode;
    if (mapEl) mapEl.setAttribute('data-theme', mode);
    uppdateraLiveTemaKnapp();
}

function fokuseraIndexSokruta() {
    const sokruta = document.getElementById('sokruta');
    const sokSektion = document.getElementById('huvud-sok-sektion');
    if (sokSektion) {
        sokSektion.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (sokruta) {
        sokruta.focus();
        sokruta.select?.();
    }
}

function uppdateraLiveKpiUi({ oppnaNu, antalPizzor, billigaste, snitt, antalPizzeriorIvy, antalPizzeriorTotalt }) {
    const elOppna = document.getElementById('live-kpi-open');
    const elPizzor = document.getElementById('live-kpi-pizzor');
    const elBilligast = document.getElementById('live-kpi-cheapest');
    const elSnitt = document.getElementById('live-kpi-average');
    const vyLabel = document.getElementById('live-vy-label');

    if (elOppna) elOppna.textContent = Number(oppnaNu || 0).toLocaleString('sv-SE');
    if (elPizzor) elPizzor.textContent = Number(antalPizzor || 0).toLocaleString('sv-SE');
    if (elBilligast) elBilligast.textContent = Number.isFinite(billigaste) ? `${Math.round(billigaste)} kr` : '-';
    if (elSnitt) elSnitt.textContent = Number.isFinite(snitt) ? `${Math.round(snitt)} kr` : '-';

    if (vyLabel) {
        if (antalPizzeriorIvy > 0) {
            vyLabel.textContent = `${antalPizzeriorIvy} pizzerior i vyn`;
        } else {
            vyLabel.textContent = '0 pizzerior i vyn';
        }
    }

    const infoText = document.getElementById('live-info-text');
    if (infoText) {
        infoText.textContent = antalPizzeriorIvy > 0 ? `${antalPizzeriorIvy} av ${antalPizzeriorTotalt || 0}` : '0 av 0';
    }
}

function renderaLiveTopSektion(pizzorUnderlag) {
    try {
        window.__liveTopDebug.calls += 1;
        // Live-kartan och dess KPI ska vara frikopplade från sidans filter.
        // Därför används alltid fulla datasetet för top-sektionen.
        const underlag = Array.isArray(allaPizzor) ? allaPizzor : [];

        const underlagSignatur = skapaLiveUnderlagSignatur(underlag);
        const dataHarAndrats = underlagSignatur !== liveUnderlagSignatur;

        if (dataHarAndrats) {
            livePizzeriaPosterCache = byggPizzeriaPosterFranPizzor(underlag);
            liveUnderlagSignatur = underlagSignatur;
            uppdateraLiveKartlager(livePizzeriaPosterCache);
        }

        const pizzeriaPoster = livePizzeriaPosterCache;

        if (!liveMiniMap) {
            uppdateraLiveKpiUi({
                oppnaNu: 0,
                antalPizzor: 0,
                billigaste: null,
                snitt: null,
                antalPizzeriorIvy: 0,
                antalPizzeriorTotalt: 0
            });
            return;
        }

        const bounds = liveMiniMap.getBounds();
        const synligaPizzerior = pizzeriaPoster.filter((post) => bounds.contains([post.lat, post.lng]));
        const synligaNycklar = new Set(synligaPizzerior.map((post) => post.nyckel));
        const synligaPizzor = underlag.filter((pizza) => {
            const nyckel = skapaPizzeriaCoordsNyckel(pizza?.pizzeria, pizza?.adress);
            return synligaNycklar.has(nyckel);
        });

        const priser = synligaPizzor
            .map((pizza) => Number(pizza?.pris))
            .filter((pris) => Number.isFinite(pris) && pris > 0);

        let billigastPizza = null;
        synligaPizzor.forEach((pizza) => {
            const pris = Number(pizza?.pris);
            if (!Number.isFinite(pris) || pris <= 0) return;
            if (!billigastPizza || pris < billigastPizza.pris) {
                billigastPizza = {
                    pris,
                    pizzeria: pizza?.pizzeria || ''
                };
            }
        });

        uppdateraLiveInsightsUi({
            billigastNamn: billigastPizza?.pizzeria || '',
            billigastPris: billigastPizza?.pris ?? null,
            oppetSentAntal: synligaPizzerior.filter((post) => pizzeriaHarOppetSent(post.oppettider)).length,
            vanligasteSpann: beraknaVanligastePrisintervall(priser)
        });

        uppdateraLiveKpiUi({
            oppnaNu: synligaPizzerior.filter((post) => post.arOppet).length,
            antalPizzor: synligaPizzor.length,
            billigaste: priser.length ? Math.min(...priser) : null,
            snitt: priser.length ? (priser.reduce((sum, pris) => sum + pris, 0) / priser.length) : null,
            antalPizzeriorIvy: synligaPizzerior.length,
            antalPizzeriorTotalt: pizzeriaPoster.length
        });

        window.__liveTopDebug.lastPayload = {
            underlagAntal: Array.isArray(underlag) ? underlag.length : 0,
            posterAntal: pizzeriaPoster.length,
            synligaPizzerior: synligaPizzerior.length,
            synligaPizzor: synligaPizzor.length
        };
        window.__liveTopDebug.lastError = null;

    } catch (error) {
        console.error('[LiveTop] render-error', error);
        window.__liveTopDebug.lastError = String(error && (error.stack || error.message || error));
        const vyLabel = document.getElementById('live-vy-label');
        if (vyLabel) vyLabel.textContent = '⚠️ Kunde inte uppdatera kartvyn';
    }
}

function schemalaggLiveDashboardUppdatering(pizzorUnderlag) {
    if (liveDashboardDebounce) clearTimeout(liveDashboardDebounce);
    liveDashboardDebounce = setTimeout(() => {
        renderaLiveTopSektion(pizzorUnderlag);
    }, 120);
}

window.uppdateraLiveTopSektion = schemalaggLiveDashboardUppdatering;
window.__runLiveTopNow = function () {
    renderaLiveTopSektion(Array.isArray(nuvarandeFiltreradLista) && nuvarandeFiltreradLista.length ? nuvarandeFiltreradLista : allaPizzor);
};

// --- Favoriter-system ---
function hamtaFavoriter() {
    const data = localStorage.getItem('bp-live-favoriter') || '[]';
    try {
        return JSON.parse(data);
    } catch {
        return [];
    }
}

function sparaFavoriter(favoriter) {
    localStorage.setItem('bp-live-favoriter', JSON.stringify(favoriter || []));
}

window.toggleFavorit = function (slug) {
    const favoriter = hamtaFavoriter();
    const index = favoriter.indexOf(slug);
    if (index >= 0) {
        favoriter.splice(index, 1);
    } else {
        favoriter.push(slug);
    }
    sparaFavoriter(favoriter);
    const btn = document.getElementById(`fav-btn-live-${slug}`);
    if (btn) {
        btn.classList.toggle('is-favorit');
        btn.innerHTML = favoriter.indexOf(slug) >= 0 ? '❤ Sparad' : '🤍 Spara';
    }
};

window.delaPizzeria = function (slug) {
    const favoriter = hamtaFavoriter();
    const pizzeria = allaPizzor?.find(p => skapaDynamiskPizzeriaLank(p.pizzeria).includes(slug))?.pizzeria || '';
    const url = window.location.origin + '/pizzerior/' + slug;
    const text = `Kolla denna pizzeria: ${pizzeria} - Billiga Pizzor`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Billiga Pizzor',
            text: text,
            url: url
        }).catch(() => {});
    } else {
        const shareText = `${text}\n${url}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareText).then(() => {
                alert('Länken är kopierad!');
            });
        } else {
            alert(`${shareText}`);
        }
    }
};

// --- Geolokalisering för "Hitta mig"-knapp ---
window.kartaNarmastMigLive = function () {
    const btn = document.getElementById('live-narmast-btn');
    if (btn) btn.disabled = true;
    
    if (!navigator.geolocation) {
        alert('Geolokalisering stöds inte i din webbläsare');
        if (btn) btn.disabled = false;
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            anvandarPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            liveUnderlagSignatur = '';
            if (liveMiniMap) {
                liveMiniMap.setView([anvandarPosition.lat, anvandarPosition.lng], 13);
                schemalaggLiveDashboardUppdatering(nuvarandeFiltreradLista);
            }
            if (btn) btn.disabled = false;
        },
        () => {
            alert('Kunde inte hämta din position');
            if (btn) btn.disabled = false;
        }
    );
};

// --- Satellit-kartlager ---
window.toggleSatelliteLive = function () {
    if (!liveMiniMap) return;
    const ordning = ['dark', 'light', 'satellite'];
    const index = ordning.indexOf(liveBaseLayerMode);
    const nastaMode = ordning[(index + 1 + ordning.length) % ordning.length];
    sattaLiveBaslager(nastaMode);
};

function initLiveTopDashboard() {
    const mapEl = document.getElementById('live-mini-map');
    if (!mapEl || mapEl._leaflet_id) return;

    initLiveMapExpandModal();

    const satBtn = document.getElementById('live-map-sat-btn');
    if (satBtn) {
        satBtn.addEventListener('click', () => window.toggleSatelliteLive());
    }

    const sokBtn = document.getElementById('live-sok-toggle');
    if (sokBtn) {
        sokBtn.addEventListener('click', fokuseraIndexSokruta);
    }

    const liveNarmastBtn = document.getElementById('live-narmast-btn');
    if (liveNarmastBtn) {
        liveNarmastBtn.addEventListener('click', () => window.kartaNarmastMigLive());
    }

    initLiveInsightsActions();

    laddaLeafletForIndex(() => {
        if (!document.getElementById('live-mini-map') || mapEl._leaflet_id) return;

        liveMiniMap = L.map(mapEl, {
            center: [57.6535, 12.0130],
            zoom: 11,
            zoomControl: true,
            scrollWheelZoom: true,
            attributionControl: false
        });
        
        // Exponera till window
        window.liveMiniMap = liveMiniMap;

        initLiveBaseLayers();
        sattaLiveBaslager('dark');

        // Använd samma klusterdesign som karta.html
        liveMiniMapLayer = L.markerClusterGroup({
            maxClusterRadius: 50,
            showCoverageOnHover: false,
            chunkedLoading: true,
            chunkInterval: 80,
            chunkDelay: 16,
            removeOutsideVisibleBounds: true,
            iconCreateFunction: function (cluster) {
                const antal = cluster.getChildCount();
                return L.divIcon({
                    className: '',
                    html: '<div class="karta-kluster"><span>' + antal + '</span></div>',
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                });
            }
        }).addTo(liveMiniMap);
        window.liveMiniMapLayer = liveMiniMapLayer;

        const initialPoster = byggPizzeriaPosterFranPizzor(allaPizzor);
        if (initialPoster.length > 0) {
            const bounds = L.latLngBounds(initialPoster.map((post) => [post.lat, post.lng]));
            liveMiniMap.fitBounds(bounds, {
                padding: [0, 0],
                maxZoom: 13,
                animate: false
            });
        }

        liveMiniMap.on('moveend', () => {
            schemalaggLiveDashboardUppdatering(nuvarandeFiltreradLista);
        });

        liveMiniMap.on('zoomend', () => {
            uppdateraLiveNamnEtiketter();
            schemalaggLiveDashboardUppdatering(nuvarandeFiltreradLista);
        });

        setTimeout(() => {
            liveMiniMap.invalidateSize();
            schemalaggLiveDashboardUppdatering(nuvarandeFiltreradLista);
            if (Array.isArray(allaPizzor) && allaPizzor.length > 0) {
                renderaLiveTopSektion(allaPizzor);
            }
        }, 80);
    });
}

function initIndexSida() {
    // Handle "Läs mer" button for expanding hero section on mobile
    const lasMerBtn = document.querySelector('.hero-las-mer-btn');
    const heroSektion = document.querySelector('.hero-sektion');
    if (lasMerBtn && heroSektion) {
        lasMerBtn.addEventListener('click', function() {
            const isExpanded = this.getAttribute('aria-expanded') === 'true';
            
            if (isExpanded) {
                // Collapse
                heroSektion.classList.remove('hero-expanded');
                this.textContent = 'Läs mer';
                this.setAttribute('aria-expanded', 'false');
            } else {
                // Expand
                heroSektion.classList.add('hero-expanded');
                this.textContent = 'Dölj';
                this.setAttribute('aria-expanded', 'true');
            }
        });
    }

    // Handle "Läs mer och visa alla alternativ" button for mobile filters
    const mobilLasMerBtn = document.getElementById('mobil-las-mer-btn');
    const mobilFilterSektion = document.getElementById('mobil-filter-sektion');
    const mobilKontroller = document.getElementById('mobil-kontroller');
    const filterSektion = document.getElementById('filter-sektion');
    const prisSlider = document.getElementById('pris-slider-wrap');
    const aktivaChips = document.getElementById('aktiva-filter-chips');
    const filterHr = aktivaChips ? aktivaChips.nextElementSibling : null; // <hr> after chips

    const extraDolj = [filterSektion, prisSlider, aktivaChips, filterHr].filter(Boolean);

    if (mobilLasMerBtn && mobilFilterSektion && mobilKontroller) {
        const isMobile = () => window.innerWidth < 768;

        function kollapsa() {
            mobilFilterSektion.classList.remove('mobil-filter-expanded');
            mobilFilterSektion.classList.add('mobil-filter-compact');
            mobilKontroller.classList.remove('mobil-kontroller-expanded');
            mobilKontroller.classList.add('mobil-kontroller-compact');
            extraDolj.forEach(el => el.classList.add('mobil-las-mer-dold'));
            if (filterSektion) filterSektion.classList.add('filter-hidden-mobile');
            mobilLasMerBtn.setAttribute('aria-expanded', 'false');
        }

        function expandera() {
            mobilFilterSektion.classList.remove('mobil-filter-compact');
            mobilFilterSektion.classList.add('mobil-filter-expanded');
            mobilKontroller.classList.remove('mobil-kontroller-compact');
            mobilKontroller.classList.add('mobil-kontroller-expanded');
            extraDolj.forEach(el => el.classList.remove('mobil-las-mer-dold'));
            if (filterSektion) filterSektion.classList.remove('mobil-las-mer-dold');
            mobilLasMerBtn.setAttribute('aria-expanded', 'true');
        }

        if (isMobile()) {
            kollapsa();
        }

        mobilLasMerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (this.getAttribute('aria-expanded') === 'true') {
                kollapsa();
            } else {
                expandera();
            }
        });

        window.addEventListener('resize', function() {
            if (!isMobile()) {
                mobilLasMerBtn.style.display = 'none';
                mobilFilterSektion.classList.remove('mobil-filter-compact', 'mobil-filter-expanded');
                mobilKontroller.classList.remove('mobil-kontroller-compact', 'mobil-kontroller-expanded');
                extraDolj.forEach(el => el.classList.remove('mobil-las-mer-dold'));
                if (filterSektion) filterSektion.classList.remove('mobil-las-mer-dold');
                mobilLasMerBtn.setAttribute('aria-expanded', 'false');
            } else {
                mobilLasMerBtn.style.display = 'flex';
                if (mobilLasMerBtn.getAttribute('aria-expanded') !== 'true') {
                    kollapsa();
                }
            }
        });
    }

    const kategoriStripInner = document.querySelector('#kategori-strip .kategori-strip-inner');
    if (kategoriStripInner) {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchMoved = false;
        const tapMoveThreshold = 10;

        kategoriStripInner.addEventListener('touchstart', (event) => {
            if (!event.touches || event.touches.length !== 1) return;
            touchMoved = false;
            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
        }, { passive: true });

        kategoriStripInner.addEventListener('touchmove', (event) => {
            if (!event.touches || event.touches.length !== 1) return;
            const dx = Math.abs(event.touches[0].clientX - touchStartX);
            const dy = Math.abs(event.touches[0].clientY - touchStartY);
            if (dx > tapMoveThreshold || dy > tapMoveThreshold) {
                touchMoved = true;
            }
        }, { passive: true });

        // Reliable mobile tap handling for category chips inside a horizontal scroller.
        kategoriStripInner.addEventListener('touchend', (event) => {
            if (window.innerWidth >= 768 || touchMoved) return;
            const chip = event.target.closest('.kategori-chip');
            if (!chip) return;
            event.preventDefault();
            valjKategori(chip);
        }, { passive: false });
    }

    const sokruta = document.getElementById('sokruta');
    const antalTraffar = document.getElementById('antal-traffar-container');
    const prisSortering = document.getElementById('pris-sortering');
    const resultatLista = document.getElementById('resultat-lista');

    if (!sokruta || !antalTraffar || !prisSortering || !resultatLista) {
        return;
    }

    document.body.classList.add('index-kort-lage');

    // Visa skeleton-laddning medan data hämtas
    const resultatListaSkel = document.getElementById('resultat-lista');
    if (resultatListaSkel) {
        const skelFragment = document.createDocumentFragment();
        for (let i = 0; i < 8; i++) {
            const skel = document.createElement('div');
            skel.className = 'pizza-kort-skeleton';
            skel.innerHTML = [
                '<div class="skeleton-line skeleton-line--title"></div>',
                '<div class="skeleton-line skeleton-line--mid"></div>',
                '<div class="skeleton-line skeleton-line--short"></div>',
                '<div class="skeleton-line skeleton-line--long"></div>'
            ].join('');
            skelFragment.appendChild(skel);
        }
        resultatListaSkel.appendChild(skelFragment);
    }

    Promise.all([
        hamtaPizzorListaFranSupabase(),
        hamtaPizzeriorCoordsMap()
    ])
        .then(([data, coordsMap]) => {
            allaPizzor = data;
            _pizzeriaInfoMap = null; // reset so hamtaOppettimerForPizzeria/hamtaTelefonForPizzeria rebuild
            indexCoordsMap = coordsMap;
            liveCoordsByNameCache = byggLiveCoordsByNameCache(coordsMap);
            liveMenyStatsMapCache = null;
            console.log('[LiveTop] data-loaded', {
                pizzor: Array.isArray(data) ? data.length : 0,
                coords: coordsMap instanceof Map ? coordsMap.size : 0
            });
            injecteraJsonLd(byggItemListSchema(skapaPizzeriorSidaDataFranJson(data)), 'schema-itemlist');

            const antalPizzor = data.length;
            const hundratal = Math.floor(antalPizzor / 100) * 100;
            const etikett = `${hundratal}+`;

            const heroIntro = document.querySelector('.hero-intro');
            if (heroIntro) heroIntro.textContent = heroIntro.textContent.replace(/\d+\+/, etikett);

            const bottenLi = document.querySelector('.hf-icon.hf-green + span');
            if (bottenLi) bottenLi.textContent = bottenLi.textContent.replace(/\d+\+/, etikett);

            skapaFilterKnappar();
            initPrisSlider();
            initFranUrl();
            initLiveTopDashboard();
            uppdateraVisning(); 
        });

    const laddaFlerBtn = document.getElementById('ladda-fler-btn');
    if (laddaFlerBtn) {
        laddaFlerBtn.onclick = () => {
            pizzorSomVisas += 100;
            visaPizzor(nuvarandeFiltreradLista);
        };
    }

    const narmastBtn = document.getElementById('narmast-btn');
    if (narmastBtn) {
        narmastBtn.onclick = async () => {
            if (geolocationPaminnelsePagar) return;

            geolocationPaminnelsePagar = true;
            narmastBtn.disabled = true;
            uppdateraNarmastStatus('Hämtar din position...');

            try {
                await getUserLocation(true);
                isNearbyActive = true;
                narmastBtn.classList.add('narmast-aktiv');
                uppdateraNarmastStatus('Visar närmaste pizzor');
                if (liveMiniMap && anvandarPosition) {
                    liveMiniMap.setView([anvandarPosition.lat, anvandarPosition.lng], Math.max(liveMiniMap.getZoom(), 13));
                }
                uppdateraVisning();
            } catch (error) {
                isNearbyActive = false;
                uppdateraNarmastStatus('Kunde inte hämta din position', true);
            } finally {
                geolocationPaminnelsePagar = false;
                narmastBtn.disabled = false;
            }
        };
    }

    const koraSokflode = () => {
        uppdateraVisning();
    };

    sokruta.addEventListener('input', () => { 
        clearTimeout(gtmSokDebounceTimer); // GTM tracking
        gtmSokDebounceTimer = setTimeout(() => { // GTM tracking
            const sökSträng = sokruta.value.toLowerCase(); // GTM tracking
            gtmPushKlick({ event: 'sok', text: sökSträng }); // GTM tracking
        }, 350); // GTM tracking

        pizzorSomVisas = 100;
        koraSokflode();
    });

    sokruta.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        pizzorSomVisas = 100;
        koraSokflode();
    });

    prisSortering.addEventListener('change', () => { // GTM tracking
        gtmPushKlick({ event: 'klick', typ: 'sortering', val: prisSortering.value }); // GTM tracking
        pizzorSomVisas = 100; uppdateraVisning();
    }); // GTM tracking

    let mobilHintScrollTimer = null;
    window.addEventListener('scroll', () => {
        if (!mobilScrollHintEfterVisaFler) return;

        uppdateraMobilScrollHint(true);

        clearTimeout(mobilHintScrollTimer);
        mobilHintScrollTimer = setTimeout(() => {
            uppdateraMobilScrollHint(false);
        }, 180);
    }, { passive: true });
    window.addEventListener('resize', () => uppdateraMobilScrollHint(false));
    window.addEventListener('resize', uppdateraMobilRensaKnappSynlighet);
    uppdateraMobilScrollHint(false);

    const rensaFilterBtn = document.getElementById('rensa-filter-btn');
    if (rensaFilterBtn) {
        rensaFilterBtn.onclick = () => {
            gtmPushKlick({ event: 'klick', typ: 'rensa_filter' }); // GTM tracking
            valdaPizzerior = []; valdaIngredienser = []; 
            aktivaKategorier.clear();
            document.getElementById('sokruta').value = '';
            document.getElementById('pris-sortering').value = 'standard';
            document.querySelectorAll('.pizzeria-btn').forEach(k => k.classList.remove('vald-knapp'));
            document.querySelectorAll('.dropdown-innehall input').forEach(cb => cb.checked = false);
            document.querySelectorAll('.kategori-chip').forEach((chip) => chip.classList.remove('kategori-chip--active'));
            const allaKategoriChip = document.querySelector('.kategori-chip[data-kategori="Pizzor (alla)"]');
            if (allaKategoriChip) allaKategoriChip.classList.add('kategori-chip--active');
            document.getElementById('omrade-meny-knapp').innerText = `Välj område... ▼`;
            document.getElementById('ingrediens-meny-knapp').innerText = `Välj ingredienser... ▼`;
            document.getElementById('pizzeria-meny-knapp').innerText = `Välj pizzerior... ▼`;

            document.getElementById('omrade-lista').classList.remove('visa');
            document.getElementById('pizzeria-lista').classList.remove('visa');
            document.getElementById('dropdown-lista').classList.remove('visa');
            const ingrediensSokInput = document.getElementById('ingrediens-sok-input');
            if (ingrediensSokInput) ingrediensSokInput.value = '';
            document.querySelectorAll('#dropdown-lista .dropdown-item').forEach((item) => item.classList.remove('is-hidden'));
            const ingrediensTom = document.getElementById('ingrediens-sok-tomt');
            if (ingrediensTom) ingrediensTom.hidden = true;
            renderValdaIngrediensChips();

            const filterSektion = document.getElementById('filter-sektion');
            const mobilKnapp = document.getElementById('mobil-filter-toggle');
            filterSektion.classList.remove('visa');
            const mobilKnappTextNode = Array.from(mobilKnapp.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
            if (mobilKnappTextNode) mobilKnappTextNode.textContent = '🔍 Visa filter';

            // Also reset price slider
            resetPrisSlider();

            resetNearbyMode();
            uppdateraFilterStegCount();

            pizzorSomVisas = 100;
            uppdateraVisning();
        };
    }
}

// --- Rendering: Pizzeria Cards + Pages ---
// ── Öppettider-hjälpare (används av pizzerior-lista) ──────────────────────────
function renderAktivaChips() {
    const container = document.getElementById('aktiva-filter-chips');
    if (!container) return;

    const chips = [];

    const valdaOmraden = [...document.querySelectorAll('#omrade-lista input:checked')].map(cb => cb.value);
    valdaOmraden.forEach(o => chips.push({
        label: `📍 ${o}`,
        rensa: () => {
            const cb = [...document.querySelectorAll('#omrade-lista input')].find(c => c.value === o);
            if (cb) { cb.checked = false; valjOmrade(o, cb); }
        }
    }));

    [...valdaPizzerior].forEach(p => chips.push({
        label: `🏪 ${p}`,
        rensa: () => {
            const cb = [...document.querySelectorAll('#pizzeria-lista input')].find(c => c.value === p);
            if (cb) { cb.checked = false; togglaPizzeria(p, cb); }
        }
    }));

    [...valdaIngredienser].forEach(i => chips.push({
        label: `🌿 ${i}`,
        rensa: () => {
            const cb = [...document.querySelectorAll('#dropdown-lista input')].find(c => c.value === i);
            if (cb) { cb.checked = false; togglaIngrediens(i, cb); }
        }
    }));

    container.innerHTML = '';
    chips.forEach(chip => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'aktiv-filter-chip';
        el.setAttribute('aria-label', `Ta bort filter`);
        const labelNode = document.createTextNode(`${chip.label} `);
        const xSpan = document.createElement('span');
        xSpan.className = 'chip-x';
        xSpan.setAttribute('aria-hidden', 'true');
        xSpan.textContent = '✕';
        el.appendChild(labelNode);
        el.appendChild(xSpan);
        el.addEventListener('click', chip.rensa);
        container.appendChild(el);
    });
}

// --- URL sync ---
function uppdateraUrl() {
    if (!document.getElementById('filter-sektion')) return;
    const params = new URLSearchParams();
    const soktext = document.getElementById('sokruta')?.value.trim();
    if (soktext) params.set('sok', soktext);
    const valdaOmraden = [...document.querySelectorAll('#omrade-lista input:checked')].map(cb => cb.value);
    if (valdaOmraden.length) params.set('omraden', valdaOmraden.join(','));
    if (valdaPizzerior.length) params.set('pizzerior', valdaPizzerior.join(','));
    if (valdaIngredienser.length) params.set('ingredienser', valdaIngredienser.join(','));
    if (aktivtPrisFiltreMin !== null) {
        params.set('prismin', String(aktivtPrisFiltreMin));
    }
    if (aktivtPrisFiltreMax !== null) {
        params.set('prismax', String(aktivtPrisFiltreMax));
    }
    const sortering = document.getElementById('pris-sortering')?.value;
    if (sortering && sortering !== 'standard') params.set('sortering', sortering);
    const query = params.toString();
    history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
}

// --- Initiera filter från URL-parametrar ---
function initFranUrl() {
    if (!document.getElementById('filter-sektion')) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.toString()) return;

    const sok = params.get('sok');
    if (sok) { const el = document.getElementById('sokruta'); if (el) el.value = sok; }

    const omradenParam = params.get('omraden');
    if (omradenParam) {
        omradenParam.split(',').map(o => o.trim()).filter(Boolean).forEach(o => {
            const cb = [...document.querySelectorAll('#omrade-lista input')].find(c => c.value === o);
            if (!cb) return;
            cb.checked = true;
            [...new Set(allaPizzor.filter(p => p.omrade === o).map(p => p.pizzeria))].forEach(p => {
                if (!valdaPizzerior.includes(p)) valdaPizzerior.push(p);
            });
        });
    }

    const pizzeriorParam = params.get('pizzerior');
    if (pizzeriorParam) {
        pizzeriorParam.split(',').map(p => p.trim()).filter(Boolean).forEach(p => {
            const cb = [...document.querySelectorAll('#pizzeria-lista input')].find(c => c.value === p);
            if (cb) { cb.checked = true; if (!valdaPizzerior.includes(p)) valdaPizzerior.push(p); }
        });
    }

    const valdaOmradenCount = [...document.querySelectorAll('#omrade-lista input:checked')].length;
    const omradeMenyKnapp = document.getElementById('omrade-meny-knapp');
    if (omradeMenyKnapp) omradeMenyKnapp.innerText = valdaOmradenCount > 0 ? `Områden (${valdaOmradenCount}) ▼` : 'Välj område... ▼';
    document.querySelectorAll('#pizzeria-lista input').forEach(cb => { cb.checked = valdaPizzerior.includes(cb.value); });
    const pizzeriaMenyKnapp = document.getElementById('pizzeria-meny-knapp');
    if (pizzeriaMenyKnapp) pizzeriaMenyKnapp.innerText = valdaPizzerior.length > 0 ? `Pizzerior (${valdaPizzerior.length}) ▼` : 'Välj pizzerior... ▼';

    const ingredienserParam = params.get('ingredienser');
    if (ingredienserParam) {
        ingredienserParam.split(',').map(i => i.trim()).filter(Boolean).forEach(i => {
            const cb = [...document.querySelectorAll('#dropdown-lista input')].find(c => c.value === i);
            if (cb) { cb.checked = true; if (!valdaIngredienser.includes(i)) valdaIngredienser.push(i); }
        });
        const ingrediensMenyKnapp = document.getElementById('ingrediens-meny-knapp');
        if (ingrediensMenyKnapp) ingrediensMenyKnapp.innerText = valdaIngredienser.length > 0 ? `Ingredienser (${valdaIngredienser.length}) ▼` : 'Välj ingredienser... ▼';
    }
    renderValdaIngrediensChips();

    const prismin = params.get('prismin');
    const prismax = params.get('prismax');
    if (prismin !== null || prismax !== null) {
        const underlag = prisSliderUnderlag || hamtaPrisSliderUnderlag();
        if (!underlag) return;
        const slMin = document.getElementById('pris-slider-min');
        const slMax = document.getElementById('pris-slider-max');
        const fillLeft = document.getElementById('pris-slider-fill-left');
        const fill = document.getElementById('pris-slider-fill');
        const visning = document.getElementById('pris-slider-visning');
        const wrap = document.getElementById('pris-slider-wrap');
        if (prismin !== null) {
            aktivtPrisFiltreMin = Math.max(Number(prismin), underlag.globalMin);
            const minPercent = omvandlaPrisTillSliderPercent(aktivtPrisFiltreMin, underlag);
            if (slMin) slMin.value = String(minPercent);
            if (fillLeft) fillLeft.style.width = `${minPercent}%`;
        }
        if (prismax !== null) {
            aktivtPrisFiltreMax = Math.min(Number(prismax), underlag.globalMax);
            const maxPercent = omvandlaPrisTillSliderPercent(aktivtPrisFiltreMax, underlag);
            if (slMax) slMax.value = String(maxPercent);
            if (fill) fill.style.left = `${maxPercent}%`;
        }
        if (visning) {
            const antal = allaPizzor.filter((p) => {
                const pr = Number(p.pris);
                return (aktivtPrisFiltreMin === null || pr >= aktivtPrisFiltreMin) &&
                       (aktivtPrisFiltreMax === null || pr <= aktivtPrisFiltreMax);
            }).length;
            visning.textContent = formatPrisSliderText(aktivtPrisFiltreMin, aktivtPrisFiltreMax, antal);
        }
        if (wrap) wrap.classList.add('pris-slider-aktiv');
    }

    const sortering = params.get('sortering');
    if (sortering) { const sel = document.getElementById('pris-sortering'); if (sel) sel.value = sortering; }

    uppdateraFilterStegCount();
}

// --- Pris snabbfilter ---
let aktivtPrisFiltreMin = null;
let aktivtPrisFiltreMax = null;

function resetPrisSlider() {
    const sliderMin = document.getElementById('pris-slider-min');
    const sliderMax = document.getElementById('pris-slider-max');
    const fillLeft = document.getElementById('pris-slider-fill-left');
    const fill = document.getElementById('pris-slider-fill');
    const visning = document.getElementById('pris-slider-visning');
    const wrap = document.getElementById('pris-slider-wrap');
    if (sliderMin) sliderMin.value = 0;
    if (sliderMax) sliderMax.value = 100;
    if (fillLeft) fillLeft.style.width = '0%';
    if (fill) fill.style.left = '100%';
    if (visning) visning.textContent = 'Alla priser';
    if (wrap) wrap.classList.remove('pris-slider-aktiv');
    aktivtPrisFiltreMin = null;
    aktivtPrisFiltreMax = null;
}

function initPrisSlider() {
    const wrap = document.getElementById('pris-slider-wrap');
    if (!wrap || !allaPizzor.length) return;

    const underlag = hamtaPrisSliderUnderlag();
    if (!underlag) return;

    const { globalMin, globalMax } = underlag;
    prisSliderUnderlag = underlag;

    const sliderMin = document.getElementById('pris-slider-min');
    const sliderMax = document.getElementById('pris-slider-max');
    const fillLeft = document.getElementById('pris-slider-fill-left');
    const fill = document.getElementById('pris-slider-fill');
    const visning = document.getElementById('pris-slider-visning');

    if (!sliderMin || !sliderMax || !fill || !visning) return;

    sliderMin.min = 0; sliderMin.max = 100; sliderMin.step = 1;
    sliderMax.min = 0; sliderMax.max = 100; sliderMax.step = 1;
    if (!sliderMax.dataset.initialized) {
        sliderMin.value = 0;
        sliderMax.value = 100;
        if (fillLeft) fillLeft.style.width = '0%';
        fill.style.left = '100%';
        visning.textContent = 'Alla priser';
    }

    function uppdateraFill() {
        const minP = Number(sliderMin.value);
        const maxP = Number(sliderMax.value);
        if (fillLeft) fillLeft.style.width = `${minP}%`;
        fill.style.left = `${maxP}%`;
        const valtMin = omvandlaSliderPercentTillPris(minP, underlag);
        const valtMax = omvandlaSliderPercentTillPris(maxP, underlag);
        aktivtPrisFiltreMin = valtMin <= globalMin ? null : valtMin;
        aktivtPrisFiltreMax = valtMax >= globalMax ? null : valtMax;
        const antal = allaPizzor.filter((p) => {
            const pr = Number(p.pris);
            return (aktivtPrisFiltreMin === null || pr >= aktivtPrisFiltreMin) &&
                   (aktivtPrisFiltreMax === null || pr <= aktivtPrisFiltreMax);
        }).length;
        visning.textContent = formatPrisSliderText(aktivtPrisFiltreMin, aktivtPrisFiltreMax, antal);
        wrap.classList.toggle('pris-slider-aktiv', aktivtPrisFiltreMin !== null || aktivtPrisFiltreMax !== null);
        // Raise min z-index when it's in the right half so it can be grabbed over max
        sliderMin.style.zIndex = minP > 50 ? 2 : 1;
        sliderMax.style.zIndex = minP > 50 ? 1 : 2;
    }

    sliderMin.oninput = () => {
        if (Number(sliderMin.value) > Number(sliderMax.value)) sliderMin.value = sliderMax.value;
        uppdateraFill();
        pizzorSomVisas = 100;
        uppdateraVisning();
    };

    sliderMax.oninput = () => {
        if (Number(sliderMax.value) < Number(sliderMin.value)) sliderMax.value = sliderMin.value;
        uppdateraFill();
        pizzorSomVisas = 100;
        uppdateraVisning();
    };

    sliderMax.dataset.initialized = 'true';
}

// --- Tangentbordsgenväg: / fokuserar sökrutan ---
(function initKategoriStripArrows() {
  var strip      = document.getElementById('kategori-strip');
  var inner      = strip && strip.querySelector('.kategori-strip-inner');
  var pilVanster = document.getElementById('ks-pil-vanster');
  var pilHoger   = document.getElementById('ks-pil-hoger');

  if (!strip || !inner || !pilVanster || !pilHoger) return;

  var DESKTOP_BP  = 1024;
  var SCROLL_DIST = 260; // px per arrow click

  function uppdateraPilar() {
    if (window.innerWidth < DESKTOP_BP) {
      // Reset all arrow state on mobile/tablet
      strip.classList.remove('kategori-strip--overflow', 'kategori-strip--can-scroll-left', 'kategori-strip--at-end');
      pilVanster.classList.remove('ks-pil--synlig');
      pilHoger.classList.remove('ks-pil--synlig');
      return;
    }

    var harOverflow = inner.scrollWidth > inner.clientWidth + 1;
    strip.classList.toggle('kategori-strip--overflow', harOverflow);

    if (!harOverflow) {
      strip.classList.remove('kategori-strip--can-scroll-left', 'kategori-strip--at-end');
      pilVanster.classList.remove('ks-pil--synlig');
      pilHoger.classList.remove('ks-pil--synlig');
      return;
    }

    var scrollLeft = Math.round(inner.scrollLeft);
    var maxScroll  = Math.round(inner.scrollWidth - inner.clientWidth);
    var vidStart   = scrollLeft <= 0;
    var vidSlut    = scrollLeft >= maxScroll - 1;

    // Left arrow: only visible when NOT at start
    strip.classList.toggle('kategori-strip--can-scroll-left', !vidStart);
    pilVanster.classList.toggle('ks-pil--synlig', !vidStart);

    // Right arrow: only visible when NOT at end
    strip.classList.toggle('kategori-strip--at-end', vidSlut);
    pilHoger.classList.toggle('ks-pil--synlig', !vidSlut);
  }

  pilVanster.addEventListener('click', function () {
    inner.scrollBy({ left: -SCROLL_DIST, behavior: 'smooth' });
  });

  pilHoger.addEventListener('click', function () {
    inner.scrollBy({ left: SCROLL_DIST, behavior: 'smooth' });
  });

  inner.addEventListener('scroll', uppdateraPilar, { passive: true });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(uppdateraPilar, 80);
  }, { passive: true });

  // Run after full page load so layout dimensions are settled
  if (document.readyState === 'complete') {
    uppdateraPilar();
  } else {
    window.addEventListener('load', uppdateraPilar, { once: true });
  }
})();

// ============================================================
//  APP BOOTSTRAP - index-sida
// ============================================================
window.addEventListener("load", function() {
    initIndexSida();
    initPrisSlider();
});
