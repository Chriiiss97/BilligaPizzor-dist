// Maps each pizza to the same category id as the index strip uses
function kategoriseraPizzeriaItem(pizza) {
    if (pizza && typeof pizza._bpKategoriId === 'string' && pizza._bpKategoriId) {
        return pizza._bpKategoriId;
    }

    // Name-based checks run first so e.g. "Amerikansksallad" → sallader, not amerikanska
    const namn = normaliseraText(pizza.pizza_namn || '');
    const LASAGNE_ORD = ['lasagne', 'lasagna'];
    const PASTA_ORD   = ['pasta', 'spaghetti', 'tagliatelle', 'penne', 'linguine', 'fettuccine', 'rigatoni', 'carbonara', 'bolognese'];
    const SALLAD_ORD  = ['sallad', 'salad'];
    const KEBAB_RULLE_TALLRIK_ORD = ['kebabrulle', 'rulle', 'tallrik', 'gyrosrulle', 'falafelrulle'];

    if (SALLAD_ORD.some((o) => namn.includes(o)))  return 'sallader';
    if (LASAGNE_ORD.some((o) => namn.includes(o))) return 'lasagne';
    if (PASTA_ORD.some((o) => namn.includes(o)))   return 'pasta';
    if (KEBAB_RULLE_TALLRIK_ORD.some((o) => namn.includes(o))) return 'kebab';

    // Ingredient/name-based category checks
    if (matcharKategori(pizza, 'Amerikanska pannpizzor')) return 'amerikanska';
    if (matcharKategori(pizza, 'Burgare'))                return 'burgare';
    if (matcharKategori(pizza, 'Inbakade'))               return 'inbakade';
    if (matcharKategori(pizza, 'Kebab'))                  return 'kebab';
    if (matcharKategori(pizza, 'Kebab och grillrätter'))  return 'kebab';
    if (matcharKategori(pizza, 'Kyckling'))               return 'kyckling';
    if (matcharKategori(pizza, 'Oxfilé'))                 return 'oxfile';
    if (matcharKategori(pizza, 'Fläskfilé'))              return 'flaskfile';
    if (matcharKategori(pizza, 'Skaldjur'))               return 'skaldjur';
    if (matcharKategori(pizza, 'Köttfärs'))               return 'kottfars';
    if (matcharKategori(pizza, 'Salami'))                 return 'salami';
    if (matcharKategori(pizza, 'Vegetariska'))            return 'vegetarisk';

    return 'pizzor';
}

// Emoji for each pizzeria-page category id
const PIZZERIA_KAT_EMOJI = {
    pizzor:      '🍕',
    amerikanska: '<img src="/images/icons8-usa-flag-50.png" alt="Amerikansk" style="width:1.3em;height:1.3em;border-radius:50%;object-fit:cover;vertical-align:middle;">',
    burgare:     '🍔',
    flaskfile:   '🍖',
    inbakade:    '🫓',
    kebab:       '🥙',
    kottfars:    '🍕',
    kyckling:    '🍗',
    oxfile:      '🥩',
    salami:      '🍕',
    skaldjur:    '🦐',
    vegetarisk:  '🥬',
    lasagne:     '🫕',
    pasta:       '🍝',
    sallader:    '🥗',
    dryck:       '🥤',
    lask:        '🥤',
    ol:          '🍺',
    vin:         '🍷',
    drinkar:     '🥃',
    varmadrycker:'☕',
    snacks:      '🍟',
    saser:       '🧄',
    tillbehor:   '🍽️',
    dessert:     '🍰',
};

const PIZZERIA_DRYCK_KAT = new Set(['dryck', 'lask', 'ol', 'vin', 'drinkar', 'varmadrycker']);
const PIZZERIA_EXTRA_KOMPAKTA = new Set(['dryck', 'lask', 'ol', 'vin', 'drinkar', 'varmadrycker', 'snacks', 'saser', 'tillbehor', 'dessert']);
const PIZZERIA_ICKE_PIZZA_KAT = new Set([
    'dryck',
    'lask',
    'ol',
    'vin',
    'drinkar',
    'varmadrycker',
    'snacks',
    'saser',
    'tillbehor',
    'dessert',
    'sallader',
    'pasta',
    'lasagne',
    'burgare',
]);

// Pizzeriasidor laddar inte alltid filter-core.js där denna helper normalt finns.
// Definiera en lokal fallback så sök fungerar konsekvent på mobil och desktop.
if (typeof window.hittarOrdet !== 'function') {
    window.hittarOrdet = function hittarOrdet(text, soktOrd) {
        const s = normaliseraText(soktOrd);
        if (!s) return false;
        const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp('(^|[\\s/\\-])' + escaped, 'i');
        return regex.test(text || '');
    };
}

function normaliseraExtraKategoriId(kategori) {
    const k = normaliseraText(kategori || '');
    if (!k) return 'tillbehor';

    const arLaskKategori = ['lask', 'lasker', 'soda', 'soft drink', 'stillavatten', 'stilla vatten']
        .some((term) => k === term || k.includes(term));
    if (arLaskKategori) return 'lask';

    const arOlKategori = ['ol', 'olsorter', 'cider', 'beer', 'alkoholfri ol']
        .some((term) => k === term || k.includes(term));
    if (arOlKategori) return 'ol';

    const arVinKategori = ['vin', 'rodvin', 'vitt vin', 'rosevin', 'prosecco']
        .some((term) => k === term || k.includes(term));
    if (arVinKategori) return 'vin';

    const arDrinkKategori = ['drinkar', 'drink', 'shots', 'shot', 'cocktail']
        .some((term) => k === term || k.includes(term));
    if (arDrinkKategori) return 'drinkar';

    const arVarmaKategori = ['varma drycker', 'varm dryck', 'kaffe', 'te', 'espresso', 'latte', 'cappuccino']
        .some((term) => k === term || k.includes(term));
    if (arVarmaKategori) return 'varmadrycker';

    if (k === 'dryck' || k.includes('dryck')) return 'lask';
    if (k === 'snacks' || k.includes('snack')) return 'snacks';
    if (k === 'saser' || k === 'sos' || k.includes('sas')) return 'saser';
    if (k === 'dessert' || k.includes('efterratt')) return 'dessert';
    return 'tillbehor';
}

function normaliseraExtraKategoriIdFranNamn(namn, fallbackKategoriId) {
    const n = normaliseraText(namn || '');
    if (!n) return fallbackKategoriId;

    const tokens = n.split(/[^a-z0-9]+/).filter(Boolean);
    const harToken = (term) => tokens.includes(term);
    const harNagonToken = (termer) => termer.some(harToken);
    const harNagonFras = (fraser) => fraser.some((fras) => n.includes(fras));

    if (harNagonToken(['gin', 'tonic', 'vodka', 'redbull', 'rum', 'limoncello', 'sambuca', 'grappa', 'jagermeister', 'whisky', 'whiskey', 'shot', 'shots'])) {
        return 'drinkar';
    }

    if (harNagonToken(['peroni', 'birra', 'moretti', 'cider', 'somersby', 'ol']) || harNagonFras(['alkoholfri ol'])) {
        return 'ol';
    }

    if (harNagonToken(['vin', 'rose', 'prosecco']) || harNagonFras(['rod vin', 'rott vin', 'vitt vin'])) {
        return 'vin';
    }

    if (harNagonToken(['kaffe', 'te', 'espresso', 'latte', 'cappuccino']) || harNagonFras(['varm choklad'])) {
        return 'varmadrycker';
    }

    if (harNagonToken(['fanta', 'exotic', 'bonaqua', 'vatten', 'lask', 'sprite', 'pepsi', 'zingo', 'trocadero', 'dricka']) || harNagonFras(['coca cola', 'cola zero', 'mer apelsin', 'stilla vatten'])) {
        return 'lask';
    }

    return fallbackKategoriId;
}

function normaliseraExtraKategoriIdMedNamn(kategori, namn) {
    const grund = normaliseraExtraKategoriId(kategori);
    return normaliseraExtraKategoriIdFranNamn(namn, grund);
}

function normaliseraLegacyPizzeriaSlug(slug) {
    return (slug || '')
        .toLowerCase()
        .replace(/\.html?$/i, '')
        .replace(/(?:^|-)(pizzeria|restaurang|resturang)(?=-|$)/g, '')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '');
}

function normaliseraExtraPoster(extraLista, soktNamnNormaliserat) {
    if (!Array.isArray(extraLista)) return [];
    return extraLista
        .filter((row) => normaliseraText(row?.pizzeria || '') === soktNamnNormaliserat)
        .map((row) => {
            const beskrivning = String(row?.beskrivning || '').trim();
            return {
                pizzeria: row.pizzeria,
                pizza_namn: String(row?.namn || '').trim(),
                pris: Number(row?.pris) || 0,
                ingredienser: beskrivning ? [beskrivning] : [],
                beskrivning,
                _bpKategoriId: normaliseraExtraKategoriIdMedNamn(row?.kategori, row?.namn),
            };
        })
        .filter((row) => row.pizza_namn);
}

function initPizzeriaSida() {
    const sidaRoot = document.getElementById('pizzeria-sida-root');
    const titel = document.getElementById('pizzeria-sida-titel');
    const underrubrik = document.getElementById('pizzeria-sida-underrubrik');
    const lista = document.getElementById('resultat-lista');
    const laddaFlerSektion = document.getElementById('ladda-fler-sektion');
    const sokruta = document.getElementById('sokruta');
    const antalTraffar = document.getElementById('antal-traffar-container');

    if (!sidaRoot || !lista || !titel || !underrubrik || !laddaFlerSektion || !sokruta || !antalTraffar) {
        return;
    }

    document.body.classList.add('index-kort-lage');

    const pizzeriaNamnFranQuery = hamtaPizzeriaNamnFranQuery();
    const pizzeriaSlugFranUrl = hamtaPizzeriaSlugFranUrl();
    const fallbackNamn = (sidaRoot.dataset.pizzeria || '').trim();

    Promise.all([
        hamtaPizzorListaFranSupabase(),
        hamtaExtrasListaFranSupabase(),
    ])
        .then(([data, extraData]) => {
            const register = skapaPizzeriorSidaDataFranJson(data);
            const matchadPizzeriaFranSlug = (() => {
                if (!pizzeriaSlugFranUrl) return null;

                const exakt = register.find((pizzeria) => pizzeria.slug === pizzeriaSlugFranUrl);
                if (exakt) return exakt;

                // Support legacy static slugs such as "restaurang-perla.html".
                const sokSlug = normaliseraLegacyPizzeriaSlug(pizzeriaSlugFranUrl);
                if (!sokSlug) return null;

                return register.find((pizzeria) => normaliseraLegacyPizzeriaSlug(pizzeria.slug) === sokSlug) || null;
            })();
            const pizzeriaNamn = matchadPizzeriaFranSlug?.namn || pizzeriaNamnFranQuery || fallbackNamn;

            if (!pizzeriaNamn) {
                titel.innerText = 'Pizzeria saknas';
                underrubrik.innerText = 'Ingen pizzeria angiven för sidan.';
                lista.innerHTML = '<div class="ingen-traff"><h3>Ingen pizzeria vald</h3><p>Sidan saknar koppling till en pizzeria.</p></div>';
                laddaFlerSektion.style.display = 'none';
                return;
            }

            const soktNamn = pizzeriaNamn.toLowerCase().trim();
            const soktNamnNormaliserat = normaliseraText(pizzeriaNamn);
            const pizzor = data
                .filter((pizza) => (pizza.pizzeria || '').toLowerCase().trim() === soktNamn)
                .sort((a, b) => a.pizza_namn.localeCompare(b.pizza_namn, 'sv'));
            const extraPoster = normaliseraExtraPoster(extraData, soktNamnNormaliserat);
            const huvudRatter = pizzor;
            const extraRatter = extraPoster;
            const allaRatter = [...pizzor, ...extraPoster].sort((a, b) => {
                const ka = kategoriseraPizzeriaItem(a);
                const kb = kategoriseraPizzeriaItem(b);
                if (ka !== kb) return ka.localeCompare(kb, 'sv');
                return String(a.pizza_namn || '').localeCompare(String(b.pizza_namn || ''), 'sv');
            });

            const pizzeriaInfo = pizzor.find((p) => p.oppettider) || pizzor[0] || null;
            const pizzeriaUnderrad = document.querySelector('.hero-subline');
            const pizzeriaInfoTitel = document.querySelector('.pizzeria-info-header h1');
            const adressLank = document.querySelector('.meta-address-link');
            const metaTelefonLank = document.querySelector('.pizzeria-meta-grid a[href^="tel:"]');
            const hemsidaMetaLank = document.querySelector('.meta-hemsida');
            const stickyCallKnapp = document.querySelector('.sticky-mobile-cta .cta-btn-call');
            const callKnappar = document.querySelectorAll('.pizzeria-cta-row .cta-btn-call');

            if (pizzeriaInfo) {
                const platsDelar = [pizzeriaInfo.omrade, pizzeriaInfo.stad].filter(Boolean).join(', ');
                if (pizzeriaUnderrad && platsDelar) pizzeriaUnderrad.innerText = platsDelar;

                if (pizzeriaInfoTitel) {
                    pizzeriaInfoTitel.innerText = pizzeriaNamn;
                }

                if (adressLank && pizzeriaInfo.adress) {
                    adressLank.href = skapaGoogleMapsSokLank(pizzeriaNamn, pizzeriaInfo.adress);
                    adressLank.innerText = pizzeriaInfo.adress;
                }

                if (metaTelefonLank && pizzeriaInfo.telefon) {
                    metaTelefonLank.href = `tel:${saneraTelefonnummer(pizzeriaInfo.telefon)}`;
                    metaTelefonLank.innerText = pizzeriaInfo.telefon;
                }

                if (hemsidaMetaLank) {
                    const hemsidaUrl = saneraExternUrl(pizzeriaInfo.hemsida);
                    if (hemsidaUrl) {
                        hemsidaMetaLank.href = hemsidaUrl;
                        hemsidaMetaLank.innerText = hemsidaUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
                    } else if (hemsidaMetaLank.parentElement) {
                        hemsidaMetaLank.parentElement.style.display = 'none';
                    }
                }

                // Opening hours — populate the right-column box
                if (pizzeriaInfo.oppettider && typeof pizzeriaInfo.oppettider === 'object') {
                    const oppBox = document.getElementById('oppettider-box');
                    const oppLista = document.getElementById('oppettider-lista');
                    const oppRubrik = oppBox ? oppBox.querySelector('.oppettider-rubrik') : null;
                    if (oppBox && oppLista) {
                        const DAGORDNING = ['måndag','tisdag','onsdag','torsdag','fredag','lördag','söndag'];
                        const DAGKORT = {
                            'mån':'måndag','man':'måndag','tis':'tisdag','ons':'onsdag','tor':'torsdag','tors':'torsdag',
                            'fre':'fredag','lör':'lördag','lor':'lördag','sön':'söndag','son':'söndag',
                            'måndag':'måndag','tisdag':'tisdag','onsdag':'onsdag','torsdag':'torsdag',
                            'fredag':'fredag','lördag':'lördag','söndag':'söndag',
                            'mon':'måndag','tue':'tisdag','wed':'onsdag','thu':'torsdag',
                            'fri':'fredag','sat':'lördag','sun':'söndag'
                        };
                        const DAGVISNING = {
                            'måndag':'Måndag','tisdag':'Tisdag','onsdag':'Onsdag','torsdag':'Torsdag',
                            'fredag':'Fredag','lördag':'Lördag','söndag':'Söndag'
                        };

                        function normDag(s) {
                            return (s || '').toLowerCase().trim().replace(/[^a-zåäö]/g, '');
                        }

                        function expanderaDagar(dagNyckel, tid) {
                            // Split on dash/hyphen/en-dash/–, handle "mån-fre", "Måndag – Torsdag" etc.
                            const delar = dagNyckel.split(/[-–—]/).map((d) => normDag(d)).filter(Boolean);
                            if (delar.length === 2) {
                                const fran = DAGKORT[delar[0]];
                                const till = DAGKORT[delar[1]];
                                const frIdx = DAGORDNING.indexOf(fran);
                                const tiIdx = DAGORDNING.indexOf(till);
                                if (frIdx !== -1 && tiIdx !== -1) {
                                    const resultat = [];
                                    for (let i = frIdx; i <= tiIdx; i++) {
                                        resultat.push({ dag: DAGVISNING[DAGORDNING[i]], tid });
                                    }
                                    return resultat;
                                }
                            }
                            // Single day
                            const norm = DAGKORT[normDag(dagNyckel)];
                            const visning = norm ? DAGVISNING[norm] : dagNyckel;
                            return [{ dag: visning, tid }];
                        }

                        // Build expanded list, preserving day order
                        const dagMap = new Map();
                        Object.entries(pizzeriaInfo.oppettider).forEach(([nyckel, tid]) => {
                            expanderaDagar(nyckel, tid).forEach(({ dag, tid: t }) => {
                                dagMap.set(dag.toLowerCase(), { dag, tid: t });
                            });
                        });

                        // Sort by DAGORDNING and include missing days as closed.
                        const sorterade = DAGORDNING.map((d) => {
                            const befintlig = dagMap.get(d);
                            if (befintlig) return befintlig;
                            return { dag: DAGVISNING[d], tid: 'Stängt' };
                        });

                        function hamtaDagensNyckel() {
                            const jsDag = new Date().getDay(); // 0=söndag
                            const karta = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
                            return karta[jsDag] || 'måndag';
                        }

                        function arStangtText(tidText) {
                            const t = (tidText || '').toLowerCase().trim();
                            return !t || t.includes('stängt') || t.includes('stangt') || t.includes('closed');
                        }

                        function parseMinuter(hhmm) {
                            const m = (hhmm || '').match(/(\d{1,2})[:.](\d{2})/);
                            if (!m) return null;
                            const h = Number(m[1]);
                            const min = Number(m[2]);
                            if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
                            if (h === 24 && min === 0) return 1440;
                            if (h < 0 || h > 23 || min < 0 || min > 59) return null;
                            return h * 60 + min;
                        }

                        function arOppetNuForTid(tidText) {
                            if (arStangtText(tidText)) return false;
                            const now = new Date();
                            const nuMin = now.getHours() * 60 + now.getMinutes();
                            const delar = String(tidText || '').split(/[,;]|\s+och\s+/i).map((s) => s.trim()).filter(Boolean);
                            for (let i = 0; i < delar.length; i++) {
                                const range = delar[i];
                                const bits = range.split(/[-–—]/).map((s) => s.trim());
                                if (bits.length !== 2) continue;
                                const start = parseMinuter(bits[0]);
                                const slut = parseMinuter(bits[1]);
                                if (start == null || slut == null) continue;

                                if (slut >= start) {
                                    if (nuMin >= start && nuMin <= slut) return true;
                                } else {
                                    // Over midnight, e.g. 16:00-02:00
                                    if (nuMin >= start || nuMin <= slut) return true;
                                }
                            }
                            return false;
                        }

                        function formatTid(minuterTotal) {
                            const m = ((minuterTotal % 1440) + 1440) % 1440;
                            const h = Math.floor(m / 60);
                            const min = m % 60;
                            const hh = String(h).padStart(2, '0');
                            const mm = String(min).padStart(2, '0');
                            return `${hh}:${mm}`;
                        }

                        function hamtaIntervall(tidText) {
                            if (arStangtText(tidText)) return [];
                            const segment = String(tidText || '')
                                .split(/[,;]|\s+och\s+/i)
                                .map((s) => s.trim())
                                .filter(Boolean);
                            const resultat = [];
                            segment.forEach((range) => {
                                const bits = range.split(/[-–—]/).map((s) => s.trim());
                                if (bits.length !== 2) return;
                                const start = parseMinuter(bits[0]);
                                const slut = parseMinuter(bits[1]);
                                if (start == null || slut == null) return;
                                resultat.push({ start, slut });
                            });
                            return resultat;
                        }

                        function beraknaStatusInfo() {
                            const now = new Date();
                            const nuMin = now.getHours() * 60 + now.getMinutes();
                            const jsDag = now.getDay(); // 0=söndag
                            const dagNycklar = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
                            const idagNyckel = dagNycklar[jsDag] || 'måndag';
                            const idagIndex = DAGORDNING.indexOf(idagNyckel);

                            const intervall = [];
                            for (let d = -1; d <= 7; d++) {
                                const dagIndex = (idagIndex + d + 7) % 7;
                                const dagNyckel = DAGORDNING[dagIndex];
                                const dagVisning = DAGVISNING[dagNyckel];
                                const dagData = dagMap.get(dagNyckel);
                                const dagIntervall = hamtaIntervall(dagData ? dagData.tid : '');
                                dagIntervall.forEach(({ start, slut }) => {
                                    const startAbs = d * 1440 + start;
                                    let slutAbs = d * 1440 + slut;
                                    if (slut <= start) slutAbs += 1440;
                                    intervall.push({ startAbs, slutAbs, start, dagNyckel, dagVisning });
                                });
                            }

                            intervall.sort((a, b) => a.startAbs - b.startAbs);

                            const aktivt = intervall.find((iv) => nuMin >= iv.startAbs && nuMin < iv.slutAbs);
                            if (aktivt) {
                                return {
                                    arOppetNu: true,
                                    text: `Stänger ${formatTid(aktivt.slutAbs)}`
                                };
                            }

                            const nasta = intervall.find((iv) => iv.startAbs > nuMin);
                            if (nasta) {
                                const kvar = nasta.startAbs - nuMin;
                                if (kvar < 1440) {
                                    return {
                                        arOppetNu: false,
                                        text: `Öppnar ${formatTid(nasta.startAbs)}`
                                    };
                                }
                                return {
                                    arOppetNu: false,
                                    text: `Öppnar ${nasta.dagVisning} ${formatTid(nasta.startAbs)}`
                                };
                            }

                            return {
                                arOppetNu: false,
                                text: 'Inga öppettider tillgängliga'
                            };
                        }

                        const dagensNyckel = hamtaDagensNyckel();
                        const statusInfo = beraknaStatusInfo();
                        const arOppetNu = !!statusInfo.arOppetNu;

                        oppLista.innerHTML = sorterade
                            .map(({ dag, tid }) => {
                                const nyckel = dag.toLowerCase();
                                const arIdag = nyckel === dagensNyckel;
                                let radKlass = 'oppettider-rad';
                                if (arIdag) {
                                    radKlass += ' oppettider-rad--idag';
                                    radKlass += arOppetNu ? ' oppettider-rad--idag-oppet' : ' oppettider-rad--idag-stangt';
                                }
                                return `<div class="${radKlass}"><span class="opp-dag">${escapaHtml(dag)}</span><span class="opp-tid">${escapaHtml(tid)}</span></div>`;
                            })
                            .join('');

                        if (oppRubrik) {
                            const statusText = arOppetNu ? 'Öppet' : 'Stängt';
                            const statusClass = arOppetNu ? 'oppettider-status--oppet' : 'oppettider-status--stangt';
                            oppRubrik.innerHTML = `🕐 Öppettider <span class="oppettider-status ${statusClass}">${statusText} <span class="oppettider-status-dot" aria-hidden="true">●</span></span>`;
                        }

                        const gammalMeta = oppBox.querySelector('.oppettider-meta');
                        if (gammalMeta) gammalMeta.remove();
                        const meta = document.createElement('p');
                        meta.className = `oppettider-meta ${arOppetNu ? 'oppettider-meta--oppet' : 'oppettider-meta--stangt'}`;
                        meta.textContent = statusInfo.text;
                        if (oppRubrik && oppRubrik.parentNode) {
                            oppRubrik.parentNode.insertBefore(meta, oppLista);
                        }

                        let toggleBtn = oppBox.querySelector('.oppettider-toggle');
                        if (!toggleBtn) {
                            toggleBtn = document.createElement('button');
                            toggleBtn.type = 'button';
                            toggleBtn.className = 'oppettider-toggle';
                            toggleBtn.setAttribute('aria-controls', 'oppettider-lista');
                            oppBox.insertBefore(toggleBtn, oppLista);
                        }

                        const arMobil = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
                        if (arMobil) {
                            oppBox.classList.add('oppettider-box--collapsed');
                            toggleBtn.hidden = false;
                        } else {
                            oppBox.classList.remove('oppettider-box--collapsed');
                            toggleBtn.hidden = true;
                        }

                        function uppdateraOppettiderToggleUi() {
                            const arExpanderad = !oppBox.classList.contains('oppettider-box--collapsed');
                            toggleBtn.innerText = arExpanderad ? '▴' : '▾';
                            toggleBtn.setAttribute('aria-expanded', String(arExpanderad));
                            toggleBtn.setAttribute('aria-label', arExpanderad ? 'Visa endast idag' : 'Visa alla öppettider');
                            toggleBtn.title = arExpanderad ? 'Visa endast idag' : 'Visa alla öppettider';
                        }

                        if (!toggleBtn.dataset.bound) {
                            toggleBtn.dataset.bound = '1';
                            toggleBtn.addEventListener('click', function () {
                                oppBox.classList.toggle('oppettider-box--collapsed');
                                uppdateraOppettiderToggleUi();
                            });
                        }
                        uppdateraOppettiderToggleUi();

                        oppBox.style.display = '';
                    }
                }

                // Map widget link
                const karteBtn = document.getElementById('karta-widget-btn');
                if (karteBtn && pizzeriaInfo.adress) {
                    karteBtn.href = skapaGoogleMapsSokLank(pizzeriaNamn, pizzeriaInfo.adress);
                }

                if (stickyCallKnapp && pizzeriaInfo.telefon) {
                    stickyCallKnapp.href = `tel:${saneraTelefonnummer(pizzeriaInfo.telefon)}`;
                }

                if (callKnappar.length > 0 && pizzeriaInfo.telefon) {
                    callKnappar.forEach((knapp) => {
                        knapp.href = `tel:${saneraTelefonnummer(pizzeriaInfo.telefon)}`;
                    });
                }
            }

            if (pizzeriaInfo) {
                injecteraJsonLd(byggRestaurantSchema(pizzeriaInfo, pizzeriaNamn), 'schema-restaurant');
            }

            // Load coords and init interactive Leaflet map
            hamtaPizzeriorCoordsLista()
                .then((coords) => {
                    const koordMatch = coords.find((c) => normaliseraText(c.pizzeria) === normaliseraText(pizzeriaNamn));
                    if (!koordMatch) return;
                    const { lat, lng } = koordMatch;

                    // "Visa på karta" → Google Maps for navigation
                    const karteBtnKoord = document.getElementById('karta-widget-btn');
                    if (karteBtnKoord) {
                        karteBtnKoord.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                    }

                    // Render map directly so it is visible from the first paint.
                    const mapEl = document.getElementById('leaflet-map');
                    const fallback = document.getElementById('karta-ikon-fallback');
                    if (mapEl) {
                        const delta = 0.0036;
                        const iframeSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta},${lat - delta},${lng + delta},${lat + delta}&layer=mapnik&marker=${lat},${lng}`;
                        mapEl.innerHTML = `<iframe class="karta-iframe-live" src="${iframeSrc}" title="Karta" frameborder="0" scrolling="no" loading="lazy" referrerpolicy="no-referrer"></iframe>`;

                        const expandBtn = document.createElement('button');
                        expandBtn.className = 'karta-expand-btn';
                        expandBtn.type = 'button';
                        expandBtn.setAttribute('aria-label', 'Visa större karta');
                        expandBtn.innerText = '⛶';
                        mapEl.appendChild(expandBtn);

                        let kartaModal = document.getElementById('karta-modal');
                        if (!kartaModal) {
                            kartaModal = document.createElement('div');
                            kartaModal.id = 'karta-modal';
                            kartaModal.className = 'karta-modal';
                            kartaModal.setAttribute('role', 'dialog');
                            kartaModal.setAttribute('aria-modal', 'true');
                            kartaModal.setAttribute('aria-label', 'Stor karta');
                            kartaModal.innerHTML = `
                                <div class="karta-modal-inner">
                                  <div id="leaflet-map-modal" class="karta-iframe-modal"></div>
                                  <button class="karta-modal-stang" id="karta-modal-stang" aria-label="Stäng karta">✕</button>
                                  <a class="karta-modal-extern" id="karta-modal-extern" href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" rel="noopener noreferrer">↗ Öppna i Google Maps</a>
                                </div>
                            `;
                            document.body.appendChild(kartaModal);
                        }

                        const closeBtn = document.getElementById('karta-modal-stang');

                        // Dynamically load Leaflet for the modal
                        function _laddaLeaflet(cb) {
                            if (window.L) { cb(); return; }
                            const lcss = document.createElement('link');
                            lcss.rel = 'stylesheet';
                            lcss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                            lcss.crossOrigin = '';
                            document.head.appendChild(lcss);
                            const ljs = document.createElement('script');
                            ljs.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                            ljs.crossOrigin = '';
                            ljs.onload = cb;
                            document.body.appendChild(ljs);
                        }

                        const oppnaKartaModal = () => {
                            const modal = document.getElementById('karta-modal');
                            if (!modal) return;
                            modal.classList.add('karta-modal--open');
                            document.body.style.overflow = 'hidden';
                            if (!window._bpModalMapInited) {
                                _laddaLeaflet(() => {
                                    window._bpModalMapInited = true;
                                    const el = document.getElementById('leaflet-map-modal');
                                    if (!el || el._leaflet_id) return;
                                    const mmap = L.map(el, {
                                        center: [lat, lng],
                                        zoom: 16,
                                        zoomControl: true,
                                        scrollWheelZoom: true,
                                        dragging: true,
                                        attributionControl: true
                                    });
                                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                                        maxZoom: 19,
                                        attribution: '© OpenStreetMap'
                                    }).addTo(mmap);
                                    const markerIkonModal = L.divIcon({
                                        className: 'bp-marker',
                                        html: '<div class="bp-marker-pin"></div>',
                                        iconSize: [24, 36],
                                        iconAnchor: [12, 36],
                                        popupAnchor: [0, -36]
                                    });
                                    L.marker([lat, lng], { icon: markerIkonModal }).addTo(mmap)
                                        .bindPopup(`<b>${escapaHtml(pizzeriaNamn)}</b>`, { className: 'bp-popup' })
                                        .openPopup();
                                    setTimeout(() => mmap.invalidateSize(), 150);
                                });
                            }
                        };

                        const stangKartaModal = () => {
                            const modal = document.getElementById('karta-modal');
                            if (!modal) return;
                            modal.classList.remove('karta-modal--open');
                            document.body.style.overflow = '';
                        };

                        expandBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            oppnaKartaModal();
                        });

                        if (closeBtn && !closeBtn.dataset.bound) {
                            closeBtn.dataset.bound = '1';
                            closeBtn.addEventListener('click', stangKartaModal);
                        }

                        if (kartaModal && !kartaModal.dataset.bound) {
                            kartaModal.dataset.bound = '1';
                            kartaModal.addEventListener('click', (e) => {
                                if (e.target === kartaModal) stangKartaModal();
                            });
                            document.addEventListener('keydown', (e) => {
                                if (e.key === 'Escape') stangKartaModal();
                            });
                        }

                        if (fallback) fallback.style.display = 'none';
                    }
                })
                .catch(() => { /* coords unavailable — fallback emoji stays */ });

            titel.innerText = pizzeriaNamn;
            underrubrik.innerText = `Visar ${allaRatter.length} rätter från ${pizzeriaNamn}.`;

            // --- Category tabs ---
            const PIZZERIA_TAB_DEF = [
                { id: 'alla',        label: 'Alla',            emoji: '🍽️' },
                { id: 'amerikanska', label: 'Amerikanska',     emoji: '<img src="/images/icons8-usa-flag-50.png" alt="Amerikansk" style="width:1.3em;height:1.3em;border-radius:50%;object-fit:cover;vertical-align:middle;">' },
                { id: 'burgare',     label: 'Burgare',         emoji: '🍔' },
                { id: 'flaskfile',   label: 'Fläskfilé',       emoji: '🍖' },
                { id: 'inbakade',    label: 'Inbakade',        emoji: '🫓' },
                { id: 'kebab',       label: 'Kebab, Rullar & Tallrikar', emoji: '🥙' },
                { id: 'kottfars',    label: 'Köttfärs',        emoji: '🍕' },
                { id: 'kyckling',    label: 'Kyckling',        emoji: '🍗' },
                { id: 'oxfile',      label: 'Oxfilé',          emoji: '🥩' },
                { id: 'salami',      label: 'Salami',          emoji: '🍕' },
                { id: 'skaldjur',    label: 'Skaldjur',        emoji: '🦐' },
                { id: 'vegetarisk',  label: 'Vegetarisk',      emoji: '🥬' },
                { id: 'lasagne',     label: 'Lasagne',         emoji: '🫕' },
                { id: 'pasta',       label: 'Pasta',           emoji: '🍝' },
                { id: 'sallader',    label: 'Sallader',        emoji: '🥗' },
            ];

            const tabContainer = document.getElementById('pizzeria-kategori-tabs');
            let aktivaPizzeriaTabs = new Set();
            const FOKUS_INITIAL = 4;
            const FOKUS_STEP = 8;

            const SEKTION_DEF = [
                { id: 'pizzor',      titel: 'Populära pizzor', emoji: '🍕' },
                { id: 'amerikanska', titel: 'Amerikanska',     emoji: '<img src="/images/icons8-usa-flag-50.png" alt="Amerikansk" style="width:1.3em;height:1.3em;border-radius:50%;object-fit:cover;vertical-align:middle;">' },
                { id: 'burgare',     titel: 'Burgare',         emoji: '🍔' },
                { id: 'flaskfile',   titel: 'Fläskfilé',       emoji: '🍖' },
                { id: 'inbakade',    titel: 'Inbakade',        emoji: '🫓' },
                { id: 'kebab',       titel: 'Kebab, Rullar & Tallrikar', emoji: '🥙' },
                { id: 'kottfars',    titel: 'Köttfärs',        emoji: '🍕' },
                { id: 'kyckling',    titel: 'Kyckling',        emoji: '🍗' },
                { id: 'oxfile',      titel: 'Oxfilé',          emoji: '🥩' },
                { id: 'salami',      titel: 'Salami',          emoji: '🍕' },
                { id: 'skaldjur',    titel: 'Skaldjur',        emoji: '🦐' },
                { id: 'vegetarisk',  titel: 'Vegetarisk',      emoji: '🥬' },
                { id: 'lasagne',     titel: 'Lasagne',         emoji: '🫕' },
                { id: 'pasta',       titel: 'Pasta',           emoji: '🍝' },
                { id: 'sallader',    titel: 'Sallader',        emoji: '🥗' },
            ];

            const EXTRA_SEKTION_DEF = [
                { id: 'lask',      titel: 'Läsk',           emoji: '🥤' },
                { id: 'ol',        titel: 'Öl',             emoji: '🍺' },
                { id: 'vin',       titel: 'Vin',            emoji: '🍷' },
                { id: 'drinkar',   titel: 'Drinkar/Shots',  emoji: '🥃' },
                { id: 'varmadrycker', titel: 'Varma drycker', emoji: '☕' },
                { id: 'snacks',    titel: 'Snacks',    emoji: '🍟' },
                { id: 'saser',     titel: 'Såser',     emoji: '🧄' },
                { id: 'tillbehor', titel: 'Tillbehör', emoji: '🍽️' },
                { id: 'dessert',   titel: 'Dessert',   emoji: '🍰' },
            ];

            function uppdateraAktivTabVisning() {
                if (!tabContainer) return;
                const ingenAktiv = aktivaPizzeriaTabs.size === 0;
                tabContainer.querySelectorAll('.pizzeria-kategori-tab').forEach((t) => {
                    const aktiv = t.dataset.tabId === 'alla' ? ingenAktiv : aktivaPizzeriaTabs.has(t.dataset.tabId);
                    t.classList.toggle('pizzeria-kategori-tab--active', aktiv);
                    t.setAttribute('aria-selected', String(aktiv));
                });
            }

            if (tabContainer) {
                const tabsMedData = PIZZERIA_TAB_DEF.map((tab) => ({
                    ...tab,
                    antal: tab.id === 'alla' ? huvudRatter.length : huvudRatter.filter((p) => kategoriseraPizzeriaItem(p) === tab.id).length
                })).filter((tab) => tab.id === 'alla' || tab.antal > 0);

                tabContainer.classList.add('pizzeria-kategori-tabs--carousel');
                tabContainer.innerHTML = `
                    <button class="pizzeria-kategori-nav pizzeria-kategori-nav--left" type="button" aria-label="Skrolla kategorier åt vänster">◀</button>
                    <div class="pizzeria-kategori-scroll" id="pizzeria-kategori-scroll"></div>
                    <button class="pizzeria-kategori-nav pizzeria-kategori-nav--right" type="button" aria-label="Skrolla kategorier åt höger">▶</button>
                `;
                const tabScroll = tabContainer.querySelector('#pizzeria-kategori-scroll');
                if (tabScroll) {
                    tabScroll.innerHTML = tabsMedData.map((tab) => `
                    <button class="pizzeria-kategori-tab${tab.id === 'alla' ? ' pizzeria-kategori-tab--active' : ''}"
                            data-tab-id="${escapaHtml(tab.id)}"
                            role="tab"
                            aria-selected="${tab.id === 'alla'}">
                        ${tab.emoji} ${escapaHtml(tab.label)} <span class="tab-antal">(${tab.antal})</span>
                    </button>
                `).join('');
                }

                const navLeft = tabContainer.querySelector('.pizzeria-kategori-nav--left');
                const navRight = tabContainer.querySelector('.pizzeria-kategori-nav--right');

                function uppdateraKategoriNav() {
                    if (!tabScroll || !navLeft || !navRight) return;
                    const maxScroll = Math.max(0, tabScroll.scrollWidth - tabScroll.clientWidth);
                    const canLeft = tabScroll.scrollLeft > 4;
                    const canRight = tabScroll.scrollLeft < maxScroll - 4;
                    navLeft.disabled = !canLeft;
                    navRight.disabled = !canRight;
                }

                function scrollaAktivTabTillSikt() {
                    if (!tabScroll) return;
                    const aktiv = tabScroll.querySelector('.pizzeria-kategori-tab--active');
                    if (aktiv && typeof aktiv.scrollIntoView === 'function') {
                        aktiv.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }
                }

                if (tabScroll) {
                    tabScroll.addEventListener('scroll', uppdateraKategoriNav);
                }
                if (navLeft && tabScroll) {
                    navLeft.addEventListener('click', () => {
                        tabScroll.scrollBy({ left: -280, behavior: 'smooth' });
                    });
                }
                if (navRight && tabScroll) {
                    navRight.addEventListener('click', () => {
                        tabScroll.scrollBy({ left: 280, behavior: 'smooth' });
                    });
                }
                uppdateraKategoriNav();

                tabContainer.querySelectorAll('.pizzeria-kategori-tab').forEach((btn) => {
                    btn.addEventListener('click', () => {
                        const tabId = btn.dataset.tabId;
                        if (tabId === 'alla') {
                            aktivaPizzeriaTabs.clear();
                        } else if (aktivaPizzeriaTabs.has(tabId)) {
                            aktivaPizzeriaTabs.delete(tabId);
                        } else {
                            aktivaPizzeriaTabs.add(tabId);
                        }
                        uppdateraAktivTabVisning();
                        scrollaAktivTabTillSikt();
                        sokruta.value = '';
                        pizzorSomVisasPizzeria = aktivaPizzeriaTabs.size === 0 ? 100 : FOKUS_INITIAL;
                        uppdateraPizzeriaVisning();
                    });
                });
            }

            let filtreradLista = huvudRatter;
            let pizzorSomVisasPizzeria = 100;

            function skapaPizzeriaItemRad(pizza) {
                const rad = document.createElement('div');
                const kat = kategoriseraPizzeriaItem(pizza);
                const arKompakt = PIZZERIA_EXTRA_KOMPAKTA.has(kat);
                rad.className = `pizzeria-item-rad${arKompakt ? ' pizzeria-item-rad--compact' : ''}`;
                const pizzaNamn = escapaHtml(formatteraPizzaNamnForVisning(pizza.pizza_namn));
                const prisTal = Number(pizza?.pris);
                const harGiltigtPris = Number.isFinite(prisTal) && prisTal > 0;
                const pris = harGiltigtPris ? `${prisTal} kr` : 'Pris okänt';
                const ingredienser = Array.isArray(pizza.ingredienser) && pizza.ingredienser.length
                    ? pizza.ingredienser.map((ing) => escapaHtml(ing)).join(', ')
                    : '';
                const kortBeskrivning = escapaHtml(String(pizza.beskrivning || '').trim());
                const emoji = PIZZERIA_KAT_EMOJI[kat] || '🍕';
                const sekundarText = arKompakt
                    ? ((PIZZERIA_DRYCK_KAT.has(kat) || kat === 'dessert') ? '' : (kortBeskrivning || ingredienser))
                    : ingredienser;
                rad.innerHTML = `
                    <div class="pizzeria-item-bild pizzeria-item-bild--${kat}" aria-hidden="true">${emoji}</div>
                    <div class="pizzeria-item-info">
                        <span class="pizzeria-item-namn">${pizzaNamn}</span>
                        ${sekundarText ? `<span class="pizzeria-item-ingredienser">${sekundarText}</span>` : ''}
                    </div>
                    <span class="pizzeria-item-pris">${escapaHtml(String(pris))}</span>
                `;
                return rad;
            }

            function visaPizzeriaGrid(allaPizzeriasPizzor) {
                lista.innerHTML = '';
                laddaFlerSektion.style.display = 'none';
                const sektioner = SEKTION_DEF.map((s) => ({
                    ...s,
                    pizzor: allaPizzeriasPizzor.filter((p) => kategoriseraPizzeriaItem(p) === s.id)
                })).filter((s) => s.pizzor.length > 0);

                if (!sektioner.length) {
                    lista.innerHTML = '<div class="ingen-traff"><h3>Mamma Mia! 🍕</h3><p>Inga pizzor hittades.</p></div>';
                    return;
                }

                const gridWrapper = document.createElement('div');
                gridWrapper.className = 'pizzeria-sektion-grid';

                sektioner.forEach(({ id, titel, emoji, pizzor: pizzorInSektion }) => {
                    const sektionEl = document.createElement('div');
                    const arKompaktSektion = PIZZERIA_EXTRA_KOMPAKTA.has(id);
                    sektionEl.className = `pizzeria-sektion pizzeria-sektion--${id}${arKompaktSektion ? ' pizzeria-sektion--compact' : ''}`;

                    const headerEl = document.createElement('div');
                    headerEl.className = 'pizzeria-sektion-header';
                    headerEl.innerHTML = `
                        <span class="pizzeria-sektion-titel">${emoji} ${escapaHtml(titel)}</span>
                        <span class="pizzeria-sektion-antal">${pizzorInSektion.length} st${pizzorInSektion.length > 4 ? ' • scrolla' : ''}</span>
                    `;
                    sektionEl.appendChild(headerEl);

                    const itemsEl = document.createElement('div');
                    itemsEl.className = 'pizzeria-sektion-items';
                    pizzorInSektion.forEach((pizza) => itemsEl.appendChild(skapaPizzeriaItemRad(pizza)));
                    sektionEl.appendChild(itemsEl);

                    gridWrapper.appendChild(sektionEl);
                });

                lista.appendChild(gridWrapper);
            }

            function visaExtraSektion(extraAttVisa) {
                const grupper = EXTRA_SEKTION_DEF.map((s) => ({
                    ...s,
                    ratter: extraAttVisa.filter((p) => kategoriseraPizzeriaItem(p) === s.id)
                })).filter((s) => s.ratter.length > 0);

                if (!grupper.length) return;

                const wrap = document.createElement('section');
                wrap.className = 'pizzeria-extra-wrap';
                wrap.innerHTML = `
                    <div class="pizzeria-extra-head">
                        <h3 class="pizzeria-extra-title">🍟 Tillbehör & Dryck</h3>
                    </div>
                `;

                const grid = document.createElement('div');
                grid.className = 'pizzeria-extra-grid';

                grupper.forEach((grupp) => {
                    const card = document.createElement('div');
                    card.className = `pizzeria-extra-card pizzeria-sektion--${grupp.id}`;

                    const header = document.createElement('div');
                    header.className = 'pizzeria-extra-card-head';
                    header.innerHTML = `
                        <span class="pizzeria-extra-card-title">${grupp.emoji} ${escapaHtml(grupp.titel)}</span>
                    `;
                    card.appendChild(header);

                    const items = document.createElement('div');
                    items.className = 'pizzeria-extra-items';
                    grupp.ratter.forEach((pizza) => items.appendChild(skapaPizzeriaItemRad(pizza)));
                    card.appendChild(items);

                    grid.appendChild(card);
                });

                wrap.appendChild(grid);
                lista.appendChild(wrap);
            }

            function visaPizzorPizzeria(pizzorAttVisa) {
                lista.innerHTML = '';
                if (pizzorAttVisa.length === 0) {
                    lista.innerHTML = '<div class="ingen-traff"><h3>Mamma Mia! 🍕</h3><p>Prova andra sökord.</p></div>';
                    laddaFlerSektion.style.display = 'none';
                    return;
                }

                const ingenTabAktiv2 = aktivaPizzeriaTabs.size === 0;
                const urval = pizzorAttVisa;
                const wrapper = document.createElement('div');
                wrapper.className = `pizzeria-lista-full${!ingenTabAktiv2 ? ' pizzeria-lista-full--fokus' : ''}`;
                urval.forEach((pizza) => wrapper.appendChild(skapaPizzeriaItemRad(pizza)));
                lista.appendChild(wrapper);
                laddaFlerSektion.style.display = 'none';
            }

            function uppdateraPizzeriaVisning() {
                const sokStrang = sokruta.value.toLowerCase().trim();
                const harSok = sokStrang.length > 0;
                const soktaOrd = sokStrang.split(',').map((ord) => ord.trim()).filter((ord) => ord !== '');

                let resultatHuvud = harSok
                    ? huvudRatter.filter((pizza) => {
                        const pizzaText = byggPizzaSokText(pizza);
                        return soktaOrd.every((sokt) => hittarOrdet(pizzaText, sokt));
                    })
                    : huvudRatter;

                if (aktivaPizzeriaTabs.size > 0) {
                    resultatHuvud = resultatHuvud.filter((p) => aktivaPizzeriaTabs.has(kategoriseraPizzeriaItem(p)));
                }

                filtreradLista = resultatHuvud;
                const ingenTabAktiv = aktivaPizzeriaTabs.size === 0;
                const totalTraffar = ingenTabAktiv
                    ? (resultatHuvud.length + extraRatter.length)
                    : resultatHuvud.length;
                antalTraffar.innerText = totalTraffar > 0
                    ? `Hittade ${totalTraffar} ${aktivaPizzeriaTabs.has('sallader') ? 'sallader' : 'rätter'}`
                    : 'Inga rätter matchar din sökning';

                if (ingenTabAktiv && !harSok) {
                    visaPizzeriaGrid(huvudRatter);
                } else {
                    visaPizzorPizzeria(filtreradLista);
                }

                // Extras are always rendered as a permanent secondary section.
                visaExtraSektion(extraRatter);
            }

            sokruta.addEventListener('input', () => {
                pizzorSomVisasPizzeria = 100;
                uppdateraPizzeriaVisning();
            });

            const laddaFlerBtn = document.getElementById('ladda-fler-btn');
            if (laddaFlerBtn) {
                laddaFlerBtn.onclick = () => {
                    pizzorSomVisasPizzeria += FOKUS_STEP;
                    visaPizzorPizzeria(filtreradLista);
                };
            }

            uppdateraPizzeriaVisning();
        });
}



// ============================================================
//  APP BOOTSTRAP - pizzeria-sida
// ============================================================
window.addEventListener("load", function() {
    initPizzeriaSida();
});
