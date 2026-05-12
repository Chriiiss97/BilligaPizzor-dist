// Filter core logic extracted from shared.js
// Loaded after shared.js so these definitions become source-of-truth during migration.

function arStriktOmradesokterm(soktOrd) {
    const s = normaliseraText(soktOrd);
    return s === 'anneberg';
}

function hittarOrdet(text, soktOrd) {
    const s = normaliseraText(soktOrd);
    if (!s) return false;
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(^|[\\s/\\-])' + escaped, 'i');
    return regex.test(text);
}

function matcharSoktermForPizza(pizza, soktOrd, pizzaText) {
    const s = normaliseraText(soktOrd);
    if (!s) return false;

    if (arStriktOmradesokterm(s)) {
        return normaliseraText(pizza.omrade || '') === s;
    }

    return hittarOrdet(pizzaText, s);
}

let pizzeriaMinPrisCacheRef = null;
let pizzeriaMinPrisCache = null;

function hamtaPizzeriaMinPrisMap() {
    if (pizzeriaMinPrisCacheRef === allaPizzor && pizzeriaMinPrisCache) {
        return pizzeriaMinPrisCache;
    }

    const map = new Map();
    (Array.isArray(allaPizzor) ? allaPizzor : []).forEach((pizza) => {
        const pris = Number(pizza?.pris);
        if (!Number.isFinite(pris) || pris <= 0) return;

        const nyckel = normaliseraText(pizza?.pizzeria || '');
        if (!nyckel) return;

        const befintligt = map.get(nyckel);
        if (!Number.isFinite(befintligt) || pris < befintligt) {
            map.set(nyckel, pris);
        }
    });

    pizzeriaMinPrisCacheRef = allaPizzor;
    pizzeriaMinPrisCache = map;
    return map;
}

function hamtaVisningsPrisInfo(pizza, pizzeriaMinPrisMap) {
    const prisTal = Number(pizza?.pris);
    if (Number.isFinite(prisTal) && prisTal > 0) {
        return { prisTal, harGiltigtPris: true, arFallback: false };
    }

    const nyckel = normaliseraText(pizza?.pizzeria || '');
    const fallbackPris = pizzeriaMinPrisMap.get(nyckel);
    if (Number.isFinite(fallbackPris) && fallbackPris > 0) {
        return { prisTal: fallbackPris, harGiltigtPris: true, arFallback: true };
    }

    return { prisTal: null, harGiltigtPris: false, arFallback: false };
}

function uppdateraVisning() {
    const sokStrang = document.getElementById('sokruta').value.toLowerCase();
    const soktaOrd = sokStrang.split(',').map(ord => ord.trim()).filter(ord => ord !== '');
    const soktaOrdText = soktaOrd.filter((ord) => !arVegetariskSokterm(ord));

    let resultat = allaPizzor;
    const vegetarLageAktivt = soktaOrd.some((ord) => arVegetariskSokterm(ord));

    if (valdaPizzerior.length > 0) resultat = resultat.filter(p => valdaPizzerior.includes(p.pizzeria));

    resultat = filtreraEfterKategori(resultat, aktivaKategorier);

    if (vegetarLageAktivt) {
        resultat = resultat.filter((pizza) => arVegetariskText(byggPizzaSokText(pizza)));
    }

    resultat = resultat.filter(pizza => {
        const pizzaText = byggPizzaSokText(pizza);
        const matcharSokruta = soktaOrdText.every((sokt) => matcharSoktermForPizza(pizza, sokt, pizzaText));
        return matcharSokruta;
    });

    if (window.liveInsightsState?.oppetSentAktiv && typeof window.pizzeriaHarOppetSent === 'function') {
        const oppetSentCache = new Map();
        resultat = resultat.filter((pizza) => {
            const nyckel = normaliseraText(pizza?.pizzeria || '');
            if (!nyckel) return false;
            if (!oppetSentCache.has(nyckel)) {
                const oppettider = pizza?.oppettider || hamtaOppettimerForPizzeria(pizza?.pizzeria);
                oppetSentCache.set(nyckel, Boolean(window.pizzeriaHarOppetSent(oppettider)));
            }
            return oppetSentCache.get(nyckel);
        });
    }

    if (isNearbyActive && anvandarPosition) {
        resultat = sortByDistance(resultat, anvandarPosition.lat, anvandarPosition.lng);
        uppdateraNarmastStatus('Visar närmaste pizzor');
    } else {
        const sorteringsVal = document.getElementById('pris-sortering').value;
        const pizzeriaMinPrisMap = hamtaPizzeriaMinPrisMap();
        if (sorteringsVal === 'billigast') {
            resultat.sort((a, b) => {
                const aInfo = hamtaVisningsPrisInfo(a, pizzeriaMinPrisMap);
                const bInfo = hamtaVisningsPrisInfo(b, pizzeriaMinPrisMap);
                const aPris = aInfo.harGiltigtPris ? aInfo.prisTal : Number.POSITIVE_INFINITY;
                const bPris = bInfo.harGiltigtPris ? bInfo.prisTal : Number.POSITIVE_INFINITY;
                return aPris - bPris;
            });
        }
        else if (sorteringsVal === 'dyrast') {
            resultat.sort((a, b) => {
                const aInfo = hamtaVisningsPrisInfo(a, pizzeriaMinPrisMap);
                const bInfo = hamtaVisningsPrisInfo(b, pizzeriaMinPrisMap);
                const aPris = aInfo.harGiltigtPris ? aInfo.prisTal : Number.NEGATIVE_INFINITY;
                const bPris = bInfo.harGiltigtPris ? bInfo.prisTal : Number.NEGATIVE_INFINITY;
                return bPris - aPris;
            });
        }
        else if (sorteringsVal === 'pizzeria-az') resultat.sort((a, b) => (a.pizzeria || '').localeCompare(b.pizzeria || '', 'sv'));
        else resultat.sort((a, b) => a.pizza_namn.localeCompare(b.pizza_namn, 'sv'));
    }

    if (aktivtPrisFiltreMin !== null || aktivtPrisFiltreMax !== null) {
        resultat = resultat.filter((p) => {
            const pr = Number(p.pris);
            return (aktivtPrisFiltreMin === null || pr >= aktivtPrisFiltreMin) &&
                   (aktivtPrisFiltreMax === null || pr <= aktivtPrisFiltreMax);
        });
    }

    nuvarandeFiltreradLista = resultat;
    const trafftext = resultat.length > 0 ? `Hittade ${resultat.length} pizzor` : 'Inga pizzor matchar din sökning';
    const antalTraffar = document.getElementById('antal-traffar-container');
    const antalTraffarMobil = document.getElementById('antal-traffar-mobile');
    if (antalTraffar) antalTraffar.innerText = trafftext;
    if (antalTraffarMobil) antalTraffarMobil.innerText = trafftext;
    renderAktivaChips();
    uppdateraUrl();
    uppdateraMobilRensaKnappSynlighet();
    uppdateraMobilScrollHint(false);
    if (typeof window.uppdateraLiveTopSektion === 'function') {
        window.uppdateraLiveTopSektion(nuvarandeFiltreradLista);
    }
    visaPizzor(nuvarandeFiltreradLista);
}

function hamtaOppetText(oppettider) {
    if (!oppettider || typeof oppettider !== 'object') return '';
    const nu = new Date();
    const dag = nu.getDay();
    const nuMin = nu.getHours() * 60 + nu.getMinutes();
    const dagIndex = { man:1,mandag:1,tis:2,tisdag:2,ons:3,onsdag:3,tor:4,tors:4,torsdag:4,fre:5,fredag:5,lor:6,lordag:6,son:0,sondag:0 };
    function norm(s) { return String(s || '').toLowerCase().replace(/[åä]/g,'a').replace(/ö/g,'o').replace(/[–—−-]/g,'-').replace(/\s+/g,' ').trim(); }
    function hamtaDag(t) { return dagIndex[norm(t).replace(/\./g,'').replace(/\s+/g,'')]; }
    function tidMin(s) {
        const m = String(s || '').match(/^(\d{1,2})[:.](\d{1,2})$/);
        if (!m) return null;
        const h = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
        if (h === 24 && min === 0) return 1440;
        if (h < 0 || h > 23 || min < 0 || min > 59) return null;
        return h * 60 + min;
    }
    for (const nyckel of Object.keys(oppettider)) {
        const delar = norm(nyckel).split('-').map(s => s.trim()).filter(Boolean);
        let matchar = false;
        if (delar.length === 2) {
            const f = hamtaDag(delar[0]), t = hamtaDag(delar[1]);
            if (f !== undefined && t !== undefined) matchar = f <= t ? (dag >= f && dag <= t) : (dag >= f || dag <= t);
        } else if (delar.length === 1) {
            matchar = hamtaDag(delar[0]) === dag;
        }
        if (matchar) {
            const tidText = String(oppettider[nyckel] || '');
            const m = tidText.match(/(\d{1,2}[:.]\d{1,2})\s*[-–—]\s*(\d{1,2}[:.]\d{1,2})/);
            if (m) {
                const oppMin = tidMin(m[1]), stangMin = tidMin(m[2]);
                if (oppMin !== null && stangMin !== null) {
                    const oppet = oppMin < stangMin ? (nuMin >= oppMin && nuMin < stangMin) : (nuMin >= oppMin || nuMin < stangMin);
                    const stangTid = m[2].replace('.', ':');
                    return oppet ? `Öppet till ${stangTid}` : 'Stängt';
                }
            }
        }
    }
    return '';
}

function visaPizzor(pizzor) {
    const lista = document.getElementById('resultat-lista');
    const laddaFlerSektion = document.getElementById('ladda-fler-sektion');
    if (!lista || !laddaFlerSektion) return;
    gtmPushKlick({ event: 'pizza_visas', antal: pizzor.length });
    lista.innerHTML = '';

    if (pizzor.length === 0) {
        lista.innerHTML = `<div class="ingen-traff"><div class="ingen-traff-ikon">😕</div><h3>Inga pizzor matchar dina val</h3><p>Prova att ändra filter, söka på något annat, eller rensa allt och börja om.</p><button type="button" class="pizzeria-btn" onclick="document.getElementById('rensa-filter-btn').click()">✨ Rensa filter</button></div>`;
        laddaFlerSektion.style.display = 'none';
        return;
    }

    const urval = pizzor.slice(0, pizzorSomVisas);
    const pizzeriaMinPrisMap = hamtaPizzeriaMinPrisMap();
    const giltigaPriser = urval.map((p) => Number(p.pris)).filter((pris) => Number.isFinite(pris) && pris > 0);
    const minPris = giltigaPriser.length > 0 ? Math.min(...giltigaPriser) : null;
    const fragment = document.createDocumentFragment();

    urval.forEach(pizza => {
        const kort = document.createElement('div');
        kort.className = 'pizza-kort expanded';
        kort.dataset.pizza = pizza.pizza_namn || '';
        kort.dataset.pizzeria = pizza.pizzeria || '';
        kort.dataset.omrade = pizza.omrade || '';
        kort.dataset.pris = String(pizza.pris ?? '');

        const pizzaNamnSafe = escapaHtml(formatteraPizzaNamnForVisning(pizza.pizza_namn));
        const ingrediensText = Array.isArray(pizza.ingredienser) && pizza.ingredienser.length > 0 ? pizza.ingredienser.join(', ') : 'Ingredienser saknas';
        const ingrediensTextSafe = escapaHtml(ingrediensText);
        const pizzeriaNamnSafe = escapaHtml(pizza.pizzeria || 'Okänd pizzeria');
        const avstandsDisplay = isNearbyActive && Number.isFinite(pizza.distansKm)
            ? `<p class="avstand-badge">${pizza.distansKm < 1 ? Math.round(pizza.distansKm * 1000) + ' m' : pizza.distansKm.toFixed(1).replace('.', ',') + ' km'} från dig</p>`
            : '';

        const prisInfo = hamtaVisningsPrisInfo(pizza, pizzeriaMinPrisMap);
        const prisTal = prisInfo.prisTal;
        const harGiltigtPris = prisInfo.harGiltigtPris;
        const arBilligast = minPris !== null && harGiltigtPris && prisTal === minPris;
        const billigastBadge = arBilligast ? '<span class="pizza-badge pizza-badge--billigast">🟢 Billigast</span>' : '';
        const prisBadgeKlass = arBilligast ? 'pris-badge pris-badge--billig' : 'pris-badge';
        const prisText = !harGiltigtPris
            ? 'Pris okänt'
            : (prisInfo.arFallback ? `Från ${prisTal} kr` : `${prisTal} kr`);

        const pizzeriaLank = hamtaNavigeringsLankForPizzeria(pizza.pizzeria ? skapaDynamiskPizzeriaLank(pizza.pizzeria) : DYNAMISK_PIZZERIA_BASSIDA);
        kort.dataset.href = pizzeriaLank;
        kort.setAttribute('tabindex', '0');
        kort.setAttribute('role', 'link');
        kort.setAttribute('aria-label', `Visa meny hos ${pizza.pizzeria || 'pizzerian'}`);

        const pizzeriaLankSafe = escapaHtml(pizzeriaLank);
        const pizzeriaNamnForAria = escapaHtml(pizza.pizzeria || 'pizzerian');
        const telefonRa = pizza.telefon || hamtaTelefonForPizzeria(pizza.pizzeria);
        const telefonSanerad = saneraTelefonnummer(telefonRa);
        const harTelefonnummer = /\d{5,}/.test(telefonSanerad);
        const kontaktHrefSafe = escapaHtml(harTelefonnummer ? `tel:${telefonSanerad}` : pizzeriaLank);
        const kontaktAria = harTelefonnummer ? `Ring ${pizzeriaNamnForAria}` : `Visa menyn hos ${pizzeriaNamnForAria}`;

        const aktivKategoriForEmoji = (() => {
            const valdaKategorier = hamtaAktivaKategoriNamn();
            return valdaKategorier.length === 1 ? valdaKategorier[0] : 'Pizzor (alla)';
        })();

        const pizzaKategoriEmoji = hamtaPizzaKortEmoji(pizza, aktivKategoriForEmoji, document.getElementById('sokruta')?.value || '');
        const oppettider = pizza.oppettider || hamtaOppettimerForPizzeria(pizza.pizzeria);
        const oppetText = hamtaOppetText(oppettider);
        const oppetHtml = oppetText ? `<span class="pizza-oppettider${oppetText === 'Stängt' ? ' pizza-oppettider--stangt' : ''}">${escapaHtml(oppetText)}</span>` : '';

        kort.innerHTML = `
            ${billigastBadge}
            <div class="pizza-rad">
                <div class="pizza-body">
                    <h3>${pizzaNamnSafe}</h3>
                    <p class="pizza-beskrivning">${ingrediensTextSafe}</p>
                    <div class="pizza-divider" aria-hidden="true"></div>
                    <div class="pizza-pizzeria-row">
                        <span class="pizza-store-icon" aria-hidden="true">${pizzaKategoriEmoji}</span>
                        <div class="pizza-pizzeria-detaljer">
                            <a class="pizza-pizzeria-link" href="${pizzeriaLankSafe}" aria-label="Visa meny hos ${pizzeriaNamnForAria}">${pizzeriaNamnSafe}</a>
                            ${oppetHtml ? `<span class="pizza-oppettider-rad">⏰ ${oppetHtml}</span>` : ''}
                        </div>
                    </div>
                    ${avstandsDisplay}
                </div>
                <div class="pizza-hoger">
                    <span class="${prisBadgeKlass}">${prisText}</span>
                    <a class="pizza-telefon-link" href="${kontaktHrefSafe}" aria-label="${kontaktAria}" onclick="event.stopPropagation()">
                        <span class="pizza-telefon-ikon" aria-hidden="true">☎</span>
                    </a>
                </div>
            </div>
        `;
        fragment.appendChild(kort);
    });

    lista.appendChild(fragment);
    laddaFlerSektion.style.display = pizzor.length > pizzorSomVisas ? 'block' : 'none';
}
