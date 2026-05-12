// --- Core Environment Helpers ---
// Force noindex only when served from netlify.app, keep indexable on the canonical domain.
(function hanteraRobotsForHost() {
    const arNetlifyHost = /(^|\.)netlify\.app$/i.test(window.location.hostname);
    let robotsMeta = document.querySelector('meta[name="robots"]');

    if (!robotsMeta) {
        robotsMeta = document.createElement('meta');
        robotsMeta.setAttribute('name', 'robots');
        document.head.appendChild(robotsMeta);
    }

    if (arNetlifyHost) {
        robotsMeta.setAttribute('content', 'noindex, nofollow, noarchive, nosnippet');
    } else if (!robotsMeta.getAttribute('content')) {
        robotsMeta.setAttribute('content', 'index,follow');
    }
})();

function arLokalUtveckling() {
    const host = (window.location.hostname || '').toLowerCase();
    return window.location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1';
}

function hamtaLokalHref(href) {
    if (!href || typeof href !== 'string') {
        return href;
    }

    const matchDynamiskPizzeria = href.match(/^\/pizzerior\/([^/?#]+)\/?$/i);
    if (matchDynamiskPizzeria && matchDynamiskPizzeria[1]) {
        // Local static servers often lack rewrite rules for /pizzerior/:slug.
        // Store slug in hash to keep routing robust without server support.
        const slug = decodeURIComponent(matchDynamiskPizzeria[1]);
        return `/pizzerior/pizzeria.html#slug=${encodeURIComponent(slug)}`;
    }

    if (!href.startsWith('/')) {
        return href;
    }

    const utanSlashPaSlutet = href.replace(/\/+$/, '');
    if (utanSlashPaSlutet === '') {
        return '/index.html';
    }

    if (utanSlashPaSlutet.endsWith('.html')) {
        return utanSlashPaSlutet;
    }

    return `${utanSlashPaSlutet}.html`;
}

function hamtaNavigeringsLankForPizzeria(lank) {
    if (!lank) {
        return lank;
    }

    return arLokalUtveckling() ? hamtaLokalHref(lank) : lank;
}

let allaPizzor = [];
let valdaPizzerior = [];
let aktivaKategorier = new Set();
let _pizzeriaInfoMap = null;
function _byggPizzeriaInfoMap() {
    if (_pizzeriaInfoMap) return;
    _pizzeriaInfoMap = new Map();
    allaPizzor.forEach(p => {
        if (!p.pizzeria) return;
        const nyckel = normaliseraText(p.pizzeria);
        const post = _pizzeriaInfoMap.get(nyckel) || {};
        if (!post.oppettider && p.oppettider) post.oppettider = p.oppettider;
        if (!post.telefon && p.telefon) post.telefon = p.telefon;
        _pizzeriaInfoMap.set(nyckel, post);
    });
}
function hamtaOppettimerForPizzeria(pizzeriaNamn) {
    _byggPizzeriaInfoMap();
    return (_pizzeriaInfoMap.get(normaliseraText(pizzeriaNamn)) || {}).oppettider || null;
}
function hamtaTelefonForPizzeria(pizzeriaNamn) {
    _byggPizzeriaInfoMap();
    return (_pizzeriaInfoMap.get(normaliseraText(pizzeriaNamn)) || {}).telefon || '';
}
let valdaIngredienser = []; 
let pizzorSomVisas = 100; 
let nuvarandeFiltreradLista = []; 
let anvandarPosition = null;
let isNearbyActive = false;
let indexCoordsMap = null;
let geolocationPaminnelsePagar = false;
let mobilScrollHintEfterVisaFler = false;
window.dataLayer = window.dataLayer || []; // GTM tracking
let gtmSokDebounceTimer = null; // GTM tracking
const gtmScrollStegSkickade = new Set(); // GTM tracking
let gtmSuppressNextPizzaKortEvent = false; // GTM tracking
const GOOGLE_MAPS_SOK_BASE_URL = 'https://www.google.com/maps/search/?api=1&query=';
let prisSliderUnderlag = null;

const ADRESS_COORDS = {
    'Konditorivägen 1, 437 33 Lindome': { lat: 57.5797, lng: 12.0742 },
    'Gamla riksvägen 38, 428 32 Kållered': { lat: 57.6110, lng: 12.0509 },
    'Gamla riksvägen 4, 428 32 Kållered': { lat: 57.6122, lng: 12.0492 },
    'Hagabäcksleden 9, 428 32 Kållered': { lat: 57.6102, lng: 12.0540 },
    'Krokslätts Parkgata 57, 431 68 Mölndal': { lat: 57.6787, lng: 11.9955 },
    'Almåsgången 1, 437 30 Lindome': { lat: 57.5776, lng: 12.0685 },
    'Gamla riksvägen 54, 428 30 Kållered': { lat: 57.6089, lng: 12.0526 }
};

function saneraTelefonnummer(telefonnummer) {
    return (telefonnummer || '').replace(/\s+/g, '');
}

const countUpRafPerElement = new WeakMap();

function countUp(el, target, suffix, duration) {
    if (!el) return;

    const tidigareRaf = countUpRafPerElement.get(el);
    if (tidigareRaf) {
        cancelAnimationFrame(tidigareRaf);
        countUpRafPerElement.delete(el);
    }

    const start = performance.now();
    function frame(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = Math.round(eased * target);
        el.textContent = current.toLocaleString('sv-SE') + suffix;
        if (progress < 1) {
            const rafId = requestAnimationFrame(frame);
            countUpRafPerElement.set(el, rafId);
        } else {
            countUpRafPerElement.delete(el);
        }
    }
    const rafId = requestAnimationFrame(frame);
    countUpRafPerElement.set(el, rafId);
}

function triggaNarSynlig(el, onEnter, onLeave, threshold = 0.45) {
    if (!el || typeof onEnter !== 'function') return;

    if (!('IntersectionObserver' in window)) {
        onEnter();
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        const [entry] = entries;
        if (!entry) return;

        if (entry.isIntersecting) {
            onEnter();
        } else if (typeof onLeave === 'function') {
            onLeave();
        }
    }, { threshold });

    observer.observe(el);
}

function escapaHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function saneraExternUrl(url) {
    const normaliserad = String(url || '').trim();
    if (!normaliserad) return '';

    const medSchema = /^[a-z][a-z\d+\-.]*:/i.test(normaliserad)
        ? normaliserad
        : `https://${normaliserad}`;

    try {
        const parsed = new URL(medSchema, window.location.origin);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return '';
        }
        return parsed.href;
    } catch {
        return '';
    }
}

function skapaGoogleMapsSokLank(namn, adress) {
    const query = `${namn || ''}, ${adress || ''}`;
    return `${GOOGLE_MAPS_SOK_BASE_URL}${encodeURIComponent(query)}`;
}

function byggPizzaSokText(pizza) {
    const ingrediensText = Array.isArray(pizza.ingredienser) ? pizza.ingredienser.join(' ') : '';
    const kategoriText = `${pizza.kategori || ''} ${pizza._bpKategoriId || ''}`;
    return normaliseraText(`${pizza.pizzeria || ''} ${pizza.pizza_namn || ''} ${ingrediensText} ${kategoriText} ${pizza.omrade || ''} ${pizza.stad || ''}`);
}

function byggKategoriSokText(pizza) {
    const ingrediensText = Array.isArray(pizza?.ingredienser) ? pizza.ingredienser.join(' ') : '';
    const kategoriText = `${pizza?.kategori || ''} ${pizza?._bpKategoriId || ''}`;
    // Intentionally exclude pizzeria name/location so category matching only uses the dish itself.
    return normaliseraText(`${pizza?.pizza_namn || ''} ${ingrediensText} ${kategoriText}`);
}

function normaliseraText(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}

function formatteraPizzaNamnForVisning(namn) {
    return String(namn || '').trim();
}

function hamtaPizzaTaggarForVisning(pizza) {
    const text = byggPizzaSokText(pizza);
    const taggar = [];

    if (text.includes('stark') || text.includes('jalapeno')) taggar.push('stark');
    if (text.includes('kott') || text.includes('oxfile') || text.includes('skinka') || text.includes('salami')) taggar.push('kott');
    if (text.includes('kyckling')) taggar.push('kyckling');
    if (text.includes('kebab')) taggar.push('kebab');
    if (text.includes('vegetar') || arVegetariskText(text)) taggar.push('vegetarisk');
    if (text.includes('bbq')) taggar.push('bbq');
    if (text.includes('champinjon')) taggar.push('champinjoner');

    if (taggar.length >= 3) return [...new Set(taggar)].slice(0, 3);

    const fallback = Array.isArray(pizza.ingredienser)
        ? pizza.ingredienser
            .map((ing) => normaliseraText(ing))
            .filter(Boolean)
            .filter((ing) => ing.length >= 3)
        : [];

    for (const ing of fallback) {
        if (!taggar.includes(ing)) taggar.push(ing);
        if (taggar.length >= 3) break;
    }

    return taggar.slice(0, 3);
}

const VEGETAR_FORBUDNA_ORD = [
    'skinka', 'salami', 'kebab', 'kyckling', 'tonfisk', 'räkor', 'bacon', 'oxfilé', 'oxkött',
    'fläsk', 'fläskfilé', 'parmaskinka', 'pepperoni', 'köttfärs', 'kött', 'ansjovis', 'sardeller',
    'musslor', 'kräft', 'scampi', 'kycklingkebab', 'gyros', 'shawarma',
    'pulled', 'lamm', 'korv', 'lax', 'fisk', 'skaldjur', 'köttbullar', 'köttbulle', 'kalkon',
    'salciccia', 'salsiccia', 'chorizo', 'prosciutto', 'mortadella', 'speck', 'pancetta',
    'capocollo', 'bresaola', 'guanciale', 'biff', 'biffer', 'hamburgare', 'burger', 'burgare'
];

const VEGETAR_TILLATNA_ORD = [
    'vegetar', 'vegansk', 'vego', 'vegokott', 'quorn', 'soja',
    'gronsaker', 'tomat', 'lok', 'paprika', 'svamp', 'champinjon', 'oliver',
    'spenat', 'zucchini', 'majs', 'ananas', 'kronartskocka',
    'mozzarella', 'cheddar', 'fetaost', 'tomatsas', 'pesto', 'halloumi', 'ost', 'agg'
];

// Pre-normalize both lists once at startup for efficient, consistent matching
const FORBUDNA_NORMALISERADE = VEGETAR_FORBUDNA_ORD.map(normaliseraText);
const TILLATNA_NORMALISERADE = VEGETAR_TILLATNA_ORD.map(normaliseraText);

// Category filter rule-sets — defined outside filter function to avoid reallocation per render cycle
const MEAT_BLACKLIST_RAW = ["oxfilé", "köttfärs", "bacon", "skinka", "salami", "kebab", "kyckling", "fläskfilé", "pepperoni"];
const SEAFOOD_LIST_RAW = ["räkor", "tonfisk", "musslor", "crabfish", "kräftstjärtar", "kräftor", "hummer", "lax", "pilgrimsmussla", "bläckfisk", "sardeller"];
const GRILL_LIST_RAW = ["kebab", "grill", "spett"];

// Pre-normalize all blacklists at startup for consistent matching
const MEAT_BLACKLIST = MEAT_BLACKLIST_RAW.map(normaliseraText);
const SEAFOOD_LIST = SEAFOOD_LIST_RAW.map(normaliseraText);
const GRILL_LIST = GRILL_LIST_RAW.map(normaliseraText);

function harForbjudetVegetarInnehall(normaliseradText) {
    // Mask veg-prefix compound words before checking so e.g. "vegokott"
    // does not falsely trigger the 'kott' forbidden entry.
    // We do NOT use word-boundary regex (\b) here because forbidden entries
    // like 'kräft' normalize to 'kraft', and "kraftor" (kräftor) has no
    // word boundary after 'kraft' — .includes() is the correct tool.
    const text = normaliseradText.replace(/veg\w+/g, '');
    return FORBUDNA_NORMALISERADE.some((ord) => text.includes(ord));
}

function arVegetariskText(normaliseradText) {
    if (harForbjudetVegetarInnehall(normaliseradText)) return false;
    return TILLATNA_NORMALISERADE.some((ord) => normaliseradText.includes(ord));
}

function arVegetariskSokterm(term) {
    const t = normaliseraText(term);
    return t.includes('vegetar') || t.includes('vegansk') || t.includes('vego');
}

function arAmerikanskKategoriPizza(item) {
    const normNamn = normaliseraText(item?.pizza_namn || '');
    return normNamn.includes('panpizza') ||
        normNamn.includes('amerikansk') ||
        normNamn.includes('americana') ||
        normNamn.includes('american');
}

function hamtaAktivaKategoriNamn() {
    return [...aktivaKategorier].filter((kategori) => kategori && kategori !== 'Pizzor (alla)');
}

function matcharKategori(item, kategori) {
    const normNamn = normaliseraText(item.pizza_namn || '');
    const normIngredienser = Array.isArray(item.ingredienser)
        ? item.ingredienser.map((i) => normaliseraText(i || ''))
        : [];

    const harIngrediens = (term) => {
        const normTerm = normaliseraText(term);
        return normIngredienser.some((i) => i.includes(normTerm));
    };
    const harNagonIngrediens = (terms) => terms.some((t) => harIngrediens(t));

    switch (kategori) {
        case 'Vegetariska':
            return arVegetariskText(byggKategoriSokText(item));

        case 'Inbakade':
            return normNamn.includes('inbakad');

        case 'Amerikanska pannpizzor':
            return arAmerikanskKategoriPizza(item);

        case 'Kebab och grillrätter': {
            const primarKat = hamtaPrimarKategoriForPizza(item);
            // Only show kebab items (NOT burgare), and pizzas with grill ingredients.
            return primarKat === 'kebab' ||
                (primarKat === 'pizza' && harNagonIngrediens(GRILL_LIST));
        }

        case 'Skaldjur':
            return harNagonIngrediens(SEAFOOD_LIST);

        case 'Salami':
            return harIngrediens('salami');

        case 'Kebab': {
            const primarKat = hamtaPrimarKategoriForPizza(item);
            return primarKat === 'kebab';
        }

        case 'Rullar': {
            const primarKat = hamtaPrimarKategoriForPizza(item);
            return primarKat === 'rulle';
        }

        case 'Köttfärs':
            return harIngrediens('köttfärs');

        case 'Kyckling':
            return harIngrediens('kyckling');

        case 'Oxfilé':
            return harIngrediens('oxfilé');

        case 'Fläskfilé':
            return harIngrediens('fläskfilé');

        case 'Burgare':
            return normNamn.includes('burgare') || normNamn.includes('burger') || normNamn.includes('hamburg');

        default:
            return true;
    }
}

function filtreraEfterKategori(menuItems, aktiva) {
    const aktivaNamn = aktiva instanceof Set
        ? [...aktiva]
        : Array.isArray(aktiva)
            ? aktiva
            : [aktiva];
    const valdaKategorier = aktivaNamn.filter((kategori) => kategori && kategori !== 'Pizzor (alla)');
    if (!valdaKategorier.length) return menuItems;

    return menuItems.filter((item) => valdaKategorier.some((kategori) => matcharKategori(item, kategori)));
}


function hamtaPrisSliderUnderlag() {
    const priser = allaPizzor.map((p) => Number(p.pris)).filter((value) => value > 0).sort((a, b) => a - b);
    if (!priser.length) {
        return null;
    }

    const globalMin = priser[0];
    const globalMax = priser[priser.length - 1];
    const p95Index = Math.floor((priser.length - 1) * 0.95);
    const steg = 5;
    const p95Pris = Math.min(globalMax, Math.ceil(priser[p95Index] / steg) * steg);

    return { globalMin, globalMax, p95Pris, totalAntal: priser.length };
}

function formatPrisSliderText(minPris, maxPris, antal) {
    if (minPris === null && maxPris === null) return 'Alla priser';
    if (minPris === null) return `Upp till ${maxPris} kr (${antal} pizzor)`;
    if (maxPris === null) return `Från ${minPris} kr (${antal} pizzor)`;
    return `${minPris} – ${maxPris} kr (${antal} pizzor)`;
}

function begransaPrisTillSteg(pris, steg = 5) {
    return Math.round(pris / steg) * steg;
}

function omvandlaSliderPercentTillPris(percent, underlag) {
    const { globalMin, globalMax, p95Pris } = underlag;
    const clampadPercent = Math.max(0, Math.min(100, percent));

    if (clampadPercent <= 80) {
        const t = clampadPercent / 80;
        return begransaPrisTillSteg(globalMin + (p95Pris - globalMin) * t);
    }

    const t = (clampadPercent - 80) / 20;
    return begransaPrisTillSteg(p95Pris + (globalMax - p95Pris) * t);
}

function omvandlaPrisTillSliderPercent(pris, underlag) {
    const { globalMin, globalMax, p95Pris } = underlag;
    const clampatPris = Math.max(globalMin, Math.min(globalMax, pris));

    if (clampatPris <= p95Pris) {
        const range = p95Pris - globalMin || 1;
        return Math.round(((clampatPris - globalMin) / range) * 80);
    }

    const range = globalMax - p95Pris || 1;
    return Math.round(80 + ((clampatPris - p95Pris) / range) * 20);
}

// Primary category taxonomy (Foodora/Uber Eats style): top strip uses only food types.
const CATEGORY_MAP = {
    pizza: {
        label: 'Pizza',
        emoji: '🍕',
        match: ['pizza', 'capricciosa', 'vesuvio', 'napoli', 'hawaii', 'calzone', 'quattro', 'margherita']
    },
    kebab: {
        label: 'Kebab',
        emoji: '🥙',
        match: ['kebab', 'tallrik', 'gyros', 'shawarma']
    },
    rulle: {
        label: 'Rullar',
        emoji: '🌯',
        match: ['rulle', 'kebabrulle', 'wraps', 'wrap']
    },
    burgare: {
        label: 'Burgare',
        emoji: '🍔',
        match: ['burgare', 'burger', 'hamburg']
    },
    sallad: {
        label: 'Sallader',
        emoji: '🥗',
        match: ['sallad', 'caesar', 'mixsallad', 'grekisk sallad', 'bowl', 'bowls']
    },
    pasta: {
        label: 'Pasta',
        emoji: '🍝',
        match: ['pasta', 'spaghetti', 'tagliatelle', 'penne']
    },
    inbakad: {
        label: 'Inbakad',
        emoji: '🫓',
        match: ['inbakad', 'inbakade', 'halvinbakad', 'halvinbakade', 'dubbelinbakad', 'dubbelinbakade']
    },
    vegetar: {
        label: 'Vegetariskt',
        emoji: '🥬',
        match: ['vegetar', 'vegansk', 'vego', 'halloumi', 'gronsaker', 'mozzarella', 'falafel']
    },
    special: {
        label: 'Special',
        emoji: '⭐',
        match: ['special', 'premium', 'husets']
    }
};

const CATEGORY_MATCH_INDEX = Object.fromEntries(
    Object.entries(CATEGORY_MAP).map(([nyckel, kategori]) => [
        nyckel,
        (kategori.match || []).map((ord) => normaliseraText(ord)).filter(Boolean)
    ])
);

function arInbakadPizzaText(pizzaText) {
    return (CATEGORY_MATCH_INDEX.inbakad || []).some((ord) => pizzaText.includes(ord));
}

function arSpecial(pizzaText) {
    // pizzaText is already normalized
    if (pizzaText.includes('special') || pizzaText.includes('husets') || pizzaText.includes('premium')) return true;
    if (pizzaText.includes('lasagne') || pizzaText.includes('lamm')) return true;
    if (pizzaText.includes('surdeg')) return true;
    return false;
}

function hamtaPrimarKategoriForPizza(pizza) {
    const pizzaText = byggKategoriSokText(pizza);

    // Inbakad always wins first.
    if (arInbakadPizzaText(pizzaText)) return 'inbakad';

    // Explicit ordered chain — score-based match for food-type categories only.
    const orderedCategories = ['rulle', 'kebab', 'burgare', 'pasta', 'sallad', 'vegetar'];
    let bastKategori = null;
    let hogstaScore = 0;

    orderedCategories.forEach((nyckel) => {
        if (nyckel === 'vegetar' && !arVegetariskText(pizzaText)) {
            return;
        }
        const matchOrd = CATEGORY_MATCH_INDEX[nyckel] || [];
        const score = matchOrd.reduce((summa, ord) => summa + (pizzaText.includes(ord) ? 1 : 0), 0);
        if (score > hogstaScore) {
            hogstaScore = score;
            bastKategori = nyckel;
        }
    });

    if (bastKategori) return bastKategori;

    // Special is checked strictly — no fuzzy match, no fallback.
    if (arSpecial(pizzaText)) return 'special';

    // Everything else is pizza.
    return 'pizza';
}

// Emoji for each filter-strip category label
const KATEGORI_STRIP_EMOJI = {
    'Amerikanska pannpizzor': '<img src="images/icons8-usa-flag-50.png" alt="Amerikansk" style="width:1.3em;height:1.3em;border-radius:50%;object-fit:cover;vertical-align:middle;">',
    'Burgare': '🍔',
    'Fläskfilé': '🍖',
    'Inbakade': '🫓',
    'Kebab och grillrätter': '🔥',
    'Kebab': '🥙',
    'Köttfärs': '🍕',
    'Kyckling': '🍗',
    'Oxfilé': '🥩',
    'Salami': '🍕',
    'Skaldjur': '🦐',
    'Vegetariska': '🥬',
};

// Keyword → emoji for search-based override (normalized keys)
const SOK_EMOJI_MAP = [
    { keys: ['kyckling'], emoji: '🍗' },
    { keys: ['kebab', 'kebabrulle', 'grill', 'gyros', 'shawarma'], emoji: '🥙' },
    { keys: ['burgare', 'burger', 'hamburgare'], emoji: '🍔' },
    { keys: ['falafel'], emoji: '🥙' },
    { keys: ['pasta', 'spaghetti', 'lasagne', 'penne'], emoji: '🍝' },
    { keys: ['sallad'], emoji: '🥗' },
    { keys: ['inbakad', 'calzone', 'halvinbakad'], emoji: '🫓' },
    { keys: ['vegetar', 'vegansk', 'vego'], emoji: '🥬' },
    { keys: ['oxfilé', 'oxfile'], emoji: '🥩' },
    { keys: ['fläskfilé', 'flaskfile'], emoji: '🍖' },
    { keys: ['rakor', 'räkor', 'skaldjur', 'tonfisk', 'scampi', 'musslor', 'kraftskraft', 'kraft'], emoji: '🦐' },
    { keys: ['salami'], emoji: '🍕' },
    { keys: ['pizza'], emoji: '🍕' },
];

function hamtaSokEmoji(sokstrang) {
    if (!sokstrang) return null;
    const norm = normaliseraText(sokstrang);
    for (const entry of SOK_EMOJI_MAP) {
        if (entry.keys.some((k) => norm.includes(k))) return entry.emoji;
    }
    return null;
}

function hamtaPizzaKortEmoji(pizza, aktivFilter, sokstrang) {
    // If a specific filter is active, all visible cards use that filter's emoji
    if (aktivFilter && aktivFilter !== 'Pizzor (alla)' && KATEGORI_STRIP_EMOJI[aktivFilter]) {
        return KATEGORI_STRIP_EMOJI[aktivFilter];
    }
    if (arAmerikanskKategoriPizza(pizza)) {
        return KATEGORI_STRIP_EMOJI['Amerikanska pannpizzor'];
    }
    // If search term maps to a known category, use that emoji
    const sokEmoji = hamtaSokEmoji(sokstrang);
    if (sokEmoji) return sokEmoji;
    const kategori = hamtaPrimarKategoriForPizza(pizza);
    // Non-pizza categories get their CATEGORY_MAP emoji directly
    if (kategori !== 'pizza') {
        return (CATEGORY_MAP[kategori] || CATEGORY_MAP.pizza).emoji;
    }
    // For plain pizza, check specific ingredients for a more precise emoji
    const normIngr = Array.isArray(pizza.ingredienser)
        ? pizza.ingredienser.map((i) => normaliseraText(i || ''))
        : [];
    const harIngrediens = (term) => {
        const t = normaliseraText(term);
        return normIngr.some((i) => i.includes(t));
    };
    if (harIngrediens('kyckling')) return '🍗';
    if (harIngrediens('fläskfilé')) return '🍖';
    if (harIngrediens('oxfilé')) return '🥩';
    if (SEAFOOD_LIST.some((t) => normIngr.some((i) => i.includes(t)))) return '🦐';
    return '🍕';
}

function skapaAssistentSvarObjekt({ kategori = 'pizza', rubrik = 'Resultat', innehall = '', actions = [] }) {
    return { kategori, rubrik, innehall, actions };
}

// --- SECURITY LAYER FOR ASSISTANT ---

const WHITELIST_PIZZA_FALT = ['pizza_namn', 'pris', 'ingredienser', 'pizzeria', 'omrade'];
const DISALLOWED_KEYWORDS = ['kod', 'javascript', 'html', 'css', 'backend', 'api', 'databas', 'server', 'variabel', 'funktion', 'console', 'debug', 'source', 'fetch', 'json', 'hvordan'];
const MAX_INPUT_LENGTH = 150;
const MAX_OUTPUT_ITEMS = 5;

function validateAndSanitizeInput(input) {
    // Validera typ
    if (typeof input !== 'string') {
        return '';
    }
    
    // Trimma och begränsa längd
    let sanitized = String(input).trim().substring(0, MAX_INPUT_LENGTH);
    
    // Remov dangercontrol characters
    sanitized = sanitized.replace(/[<>\"'`]/g, '');
    
    // Remov multiple spaces
    sanitized = sanitized.replace(/\s+/g, ' ');
    
    return sanitized;
}

function isDisallowedQuestion(frageNormaliserad) {
    const norm = frageNormaliserad.toLowerCase();
    return DISALLOWED_KEYWORDS.some(keyword => norm.includes(keyword));
}

function whitelistPizzaData(pizza) {
    if (!pizza || typeof pizza !== 'object') {
        return null;
    }
    
    const result = {};
    WHITELIST_PIZZA_FALT.forEach(falt => {
        if (falt in pizza) {
            result[falt] = pizza[falt];
        }
    });
    
    return result;
}

function getVisiblePizzasForAssistant() {
    // Returnera bara pizzor som redan är filtrerade och synliga för användaren
    if (!Array.isArray(nuvarandeFiltreradLista)) {
        return [];
    }
    
    // Begränsa till MAX_OUTPUT_ITEMS
    return nuvarandeFiltreradLista.slice(0, MAX_OUTPUT_ITEMS).map(whitelistPizzaData);
}

function renderaAssistentSvarSafe(svarEl, svarObj, fraga) {
    const wrapper = document.createElement('div');
    wrapper.className = 'assistent-inline-svar';

    const textEl = document.createElement('span');
    textEl.className = 'assistent-inline-text';

    // Convert generated HTML to plain text to keep inline answer compact and safe.
    const temp = document.createElement('div');
    temp.innerHTML = svarObj.innehall || '';
    const plain = (temp.textContent || '').replace(/\s+/g, ' ').trim();
    const kortText = plain.length > 140 ? `${plain.slice(0, 137).trim()}...` : plain;
    textEl.textContent = kortText || 'Jag hittade ett svar utifrån datan på sidan.';

    const actions = document.createElement('div');
    actions.className = 'assistent-inline-actions';

    const basActions = [...(svarObj.actions || []), { label: '📤 Dela', action: 'share', fraga }];
    basActions.slice(0, 2).forEach((a) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'assistent-inline-action';
        btn.textContent = a.label;
        btn.dataset.action = a.action || '';
        if (a.href) btn.dataset.href = a.href;
        if (a.pizzeria) btn.dataset.pizzeria = a.pizzeria;
        if (a.sok !== undefined) btn.dataset.sok = a.sok;
        if (a.fraga) btn.dataset.fraga = a.fraga;
        actions.appendChild(btn);
    });

    wrapper.appendChild(textEl);
    wrapper.appendChild(actions);
    svarEl.innerHTML = '';
    svarEl.appendChild(wrapper);
}

function hittaNamndPizzeria(fragetext) {
    const normFraga = normaliseraText(fragetext);
    const unikaPizzerior = [...new Set(allaPizzor.map((p) => p.pizzeria).filter(Boolean))];
    const sorterade = [...unikaPizzerior].sort((a, b) => b.length - a.length);
    return sorterade.find((namn) => normFraga.includes(normaliseraText(namn))) || null;
}

function hamtaAktivPizzeriaKontext() {
    return valdaPizzerior.length === 1 ? valdaPizzerior[0] : null;
}

function hamtaPizzeriaInfo(pizzeriaNamn) {
    if (!pizzeriaNamn) return null;
    const pizzaLista = allaPizzor.filter((p) => normaliseraText(p.pizzeria) === normaliseraText(pizzeriaNamn));
    if (!pizzaLista.length) return null;

    const medAdress = pizzaLista.find((p) => p.adress) || pizzaLista[0];
    return {
        namn: pizzeriaNamn,
        adress: medAdress.adress || '',
        telefon: medAdress.telefon || '',
        hemsida: medAdress.hemsida || '',
        omrade: medAdress.omrade || '',
        stad: medAdress.stad || 'Mölndal',
        oppettider: medAdress.oppettider || null,
        antalPizzor: pizzaLista.length,
        pizzor: pizzaLista
    };
}

function skapaHemsideSidorListaHtml() {
    const sidor = [...document.querySelectorAll('.footer-links a')]
        .map((a) => ({ namn: a.textContent.trim(), href: a.getAttribute('href') || '' }))
        .filter((s) => s.namn && s.href);

    if (!sidor.length) return '';
    const unika = [];
    const set = new Set();
    sidor.forEach((s) => {
        const key = `${s.namn}::${s.href}`;
        if (!set.has(key)) {
            set.add(key);
            unika.push(s);
        }
    });

    return unika
        .map((s) => `<a href="${escapaHtml(s.href)}">${escapaHtml(s.namn)}</a>`)
        .join(' · ');
}

function skapaVagSvar(pizzeriaInfo) {
    if (!pizzeriaInfo) {
        return skapaAssistentSvarObjekt({
            kategori: 'site',
            rubrik: 'Om hemsidan',
            innehall: 'Jag behöver veta vilken pizzeria du menar. Skriv till exempel: "Hur hittar jag till Nisses Pizzeria?"',
            actions: [
                { label: '📍 Öppna pizzerior', action: 'openLink', href: '/pizzerior' }
            ]
        });
    }

    if (!pizzeriaInfo.adress) {
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: 'Resultat',
            innehall: `Jag hittar ingen adress för <strong>${escapaHtml(pizzeriaInfo.namn)}</strong> just nu.`,
            actions: [
                { label: '🏪 Visa pizzerian', action: 'visaPizzeria', pizzeria: pizzeriaInfo.namn }
            ]
        });
    }

    const mapsLank = skapaGoogleMapsSokLank(pizzeriaInfo.namn, pizzeriaInfo.adress);
    const telefonRad = pizzeriaInfo.telefon
        ? ` · 📞 <a href="tel:${saneraTelefonnummer(pizzeriaInfo.telefon)}">${escapaHtml(pizzeriaInfo.telefon)}</a>`
        : '';
    return skapaAssistentSvarObjekt({
        kategori: 'pizza',
        rubrik: escapaHtml(pizzeriaInfo.namn),
        innehall: `📍 <strong>${escapaHtml(pizzeriaInfo.namn)}</strong> ligger på <strong>${escapaHtml(pizzeriaInfo.adress)}</strong>. <a href="${mapsLank}" target="_blank" rel="noopener noreferrer">Öppna i Google Maps</a>${telefonRad}.`,
        actions: [
            { label: '🍕 Visa pizzor här', action: 'visaPizzeria', pizzeria: pizzeriaInfo.namn },
            { label: '📍 Öppna i Google Maps', action: 'openLink', href: mapsLank }
        ]
    });
}

function arVegetariskPizza(pizza) {
    const text = byggPizzaSokText(pizza);
    return arVegetariskText(text);
}

function hamtaPrisTal(pizza) {
    return Number(pizza?.pris) || 0;
}

function skapaPizzaSvarsrad(pizza) {
    const namn = escapaHtml(pizza.pizza_namn || 'Okand pizza');
    const pizzeria = escapaHtml(pizza.pizzeria || 'Okand pizzeria');
    return `<strong>${namn}</strong> hos <strong>${pizzeria}</strong> (${hamtaPrisTal(pizza)} kr)`;
}

function svaraPaPizzaFraga(fragaRaw) {
    // SECURITY: Sanera input
    const fraga = validateAndSanitizeInput(fragaRaw);
    
    if (!fraga) {
        return skapaAssistentSvarObjekt({
            kategori: 'site',
            rubrik: 'Om hemsidan',
            innehall: 'Skriv en fråga, till exempel: "Hur många pizzor får jag för 1000 kr?" eller "Hur hittar jag till Bella Ciao?"'
        });
    }

    const norm = normaliseraText(fraga);
    
    // SECURITY: Blocka frågor om kod, backend, interna detaljer
    if (isDisallowedQuestion(norm)) {
        return skapaAssistentSvarObjekt({
            kategori: 'site',
            rubrik: 'Om hemsidan',
            innehall: 'Jag kan bara svara på frågor om pizzor och information som visas på sidan, som priser, ingredienser, och pizzerior i Mölndal.'
        });
    }
    
    const harData = Array.isArray(allaPizzor) && allaPizzor.length > 0;
    const pizzeriaNamn = hittaNamndPizzeria(norm) || (norm.includes('denna pizzeria') || norm.includes('den har pizzerian') || norm.includes('den pizzerian') ? hamtaAktivPizzeriaKontext() : null);

    // Hemsidefrågor (synligt innehåll och navigation)
    if (norm.includes('varfor') && (norm.includes('skapade') || norm.includes('finns sidan') || norm.includes('denna sida'))) {
        return skapaAssistentSvarObjekt({
            kategori: 'site',
            rubrik: 'Om hemsidan',
            innehall: 'Vi skapade sidan för att samla pizzor och priser i Mölndal på ett ställe, så du slipper hoppa mellan olika menyer och snabbt hittar rätt pizza för din budget.',
            actions: [
                { label: 'ℹ️ Läs mer om oss', action: 'openLink', href: '/om-oss' }
            ]
        });
    }

    if (norm.includes('vad ar den har sidan') || norm.includes('vad gor sidan') || norm.includes('om hemsidan') || norm.includes('om sidan')) {
        return skapaAssistentSvarObjekt({
            kategori: 'site',
            rubrik: 'Om hemsidan',
            innehall: 'Det här är Billiga Pizzor: en jämförelsesida där du kan söka, filtrera och sortera pizzor från lokala pizzerior i Mölndal, se priser, ingredienser och hitta pizzerior nära dig.',
            actions: [
                { label: '🏪 Gå till pizzerior', action: 'openLink', href: '/pizzerior' }
            ]
        });
    }

    if (norm.includes('kontakt') || norm.includes('mail') || norm.includes('e-post')) {
        return skapaAssistentSvarObjekt({
            kategori: 'site',
            rubrik: 'Om hemsidan',
            innehall: 'Du kan kontakta oss via <a href="mailto:kontakt@billigapizzor.se">kontakt@billigapizzor.se</a>.',
            actions: [
                { label: '✉️ Maila oss', action: 'openLink', href: 'mailto:kontakt@billigapizzor.se' }
            ]
        });
    }

    if (norm.includes('integritet') || norm.includes('privacy') || norm.includes('cookie')) {
        return skapaAssistentSvarObjekt({
            kategori: 'site',
            rubrik: 'Om hemsidan',
            innehall: 'Integritet och cookies finns på <a href="/integritetspolicy">Integritetspolicy</a>. Vi använder cookies för att förbättra tjänsten och ge bättre statistik.',
            actions: [
                { label: '🛡️ Öppna integritetspolicy', action: 'openLink', href: '/integritetspolicy' }
            ]
        });
    }

    if (norm.includes('vilka sidor') || norm.includes('navigera') || norm.includes('meny pa sidan') || norm.includes('finns pa hemsidan')) {
        const sidorHtml = skapaHemsideSidorListaHtml();
        return skapaAssistentSvarObjekt({
            kategori: 'site',
            rubrik: 'Om hemsidan',
            innehall: sidorHtml
                ? `Du hittar bland annat dessa sidor: ${sidorHtml}.`
                : 'Sidan har bland annat Hem, Pizzerior, Frågor & Svar, Om oss och Integritetspolicy.',
            actions: [
                { label: '🏠 Till startsidan', action: 'openLink', href: '/' }
            ]
        });
    }

    if (norm.includes('hur hittar jag till') || norm.includes('vag till') || norm.includes('hitta till denna pizzeria') || norm.includes('adress till')) {
        if (!harData) {
            return skapaAssistentSvarObjekt({
                kategori: 'site',
                rubrik: 'Om hemsidan',
                innehall: 'Jag kan inte hämta pizzeriadata just nu. Testa igen om en liten stund.'
            });
        }
        const info = hamtaPizzeriaInfo(pizzeriaNamn);
        return skapaVagSvar(info);
    }

    if (!harData) {
        return skapaAssistentSvarObjekt({
            kategori: 'site',
            rubrik: 'Om hemsidan',
            innehall: 'Jag hittar ingen pizzadata just nu. Testa igen om en liten stund.'
        });
    }

    const pizzorIUrval = pizzeriaNamn
        ? allaPizzor.filter((p) => normaliseraText(p.pizzeria) === normaliseraText(pizzeriaNamn))
        : allaPizzor;

    if (!pizzorIUrval.length) {
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: 'Resultat',
            innehall: 'Jag hittade ingen pizzeria som matchar den frågan.',
            actions: [
                { label: '🏪 Se alla pizzerior', action: 'openLink', href: '/pizzerior' }
            ]
        });
    }

    const billigastePizza = pizzorIUrval.reduce((min, p) => hamtaPrisTal(p) < hamtaPrisTal(min) ? p : min, pizzorIUrval[0]);
    const dyrastePizza = pizzorIUrval.reduce((max, p) => hamtaPrisTal(p) > hamtaPrisTal(max) ? p : max, pizzorIUrval[0]);
    const snittpris = pizzorIUrval.reduce((sum, p) => sum + hamtaPrisTal(p), 0) / pizzorIUrval.length;

    if ((norm.includes('vad kostar') || norm.includes('kostar')) && norm.includes('alla pizzor')) {
        const minPris = hamtaPrisTal(billigastePizza);
        const maxPris = hamtaPrisTal(dyrastePizza);
        if (pizzeriaNamn) {
            return skapaAssistentSvarObjekt({
                kategori: 'pizza',
                rubrik: escapaHtml(pizzeriaNamn),
                innehall: `Snittpris: <strong>${snittpris.toFixed(1)} kr</strong><br>Billigaste: <strong>${minPris} kr</strong><br>Dyraste: <strong>${maxPris} kr</strong>`,
                actions: [
                    { label: '🍕 Visa dessa pizzor', action: 'visaPizzeria', pizzeria: pizzeriaNamn }
                ]
            });
        }
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: 'Resultat',
            innehall: `I hela urvalet ligger pizzorna mellan <strong>${minPris}–${maxPris} kr</strong> med snitt <strong>${snittpris.toFixed(1)} kr</strong> (${pizzorIUrval.length} pizzor).`,
            actions: [
                { label: '🍕 Visa dessa pizzor', action: 'visaSokning', sok: '' }
            ]
        });
    }

    if (norm.includes('billigaste')) {
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: 'Resultat',
            innehall: `🟢 Billigaste just nu: ${skapaPizzaSvarsrad(billigastePizza)}.`,
            actions: [
                { label: '🍕 Visa dessa pizzor', action: 'visaSokning', sok: billigastePizza.pizza_namn || '', pizzeria: billigastePizza.pizzeria || '' }
            ]
        });
    }

    if (norm.includes('dyraste')) {
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: 'Resultat',
            innehall: `🔴 Dyraste just nu: ${skapaPizzaSvarsrad(dyrastePizza)}.`,
            actions: [
                { label: '🍕 Visa dessa pizzor', action: 'visaSokning', sok: dyrastePizza.pizza_namn || '', pizzeria: dyrastePizza.pizzeria || '' }
            ]
        });
    }

    if (norm.includes('snittpris')) {
        const prefix = pizzeriaNamn ? `Snittpris hos <strong>${escapaHtml(pizzeriaNamn)}</strong>` : 'Snittpris i hela Mölndal';
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: pizzeriaNamn ? escapaHtml(pizzeriaNamn) : 'Resultat',
            innehall: `📊 ${prefix}: <strong>${snittpris.toFixed(1)} kr</strong> (${pizzorIUrval.length} pizzor i urvalet).`,
            actions: [
                pizzeriaNamn
                    ? { label: '🍕 Visa dessa pizzor', action: 'visaPizzeria', pizzeria: pizzeriaNamn }
                    : { label: '🍕 Visa dessa pizzor', action: 'visaSokning', sok: '' }
            ]
        });
    }

    const budgetMatch = norm.match(/(\d+)\s*kr/);
    if ((norm.includes('hur manga') || norm.includes('max')) && budgetMatch) {
        const budget = Number(budgetMatch[1]);
        const maxAntal = Math.floor(budget / hamtaPrisTal(billigastePizza));
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: 'Resultat',
            innehall: `🧮 För <strong>${budget} kr</strong> kan du köpa upp till <strong>${maxAntal}</strong> pizzor i detta urval. Billigaste är ${skapaPizzaSvarsrad(billigastePizza)}.`,
            actions: [
                { label: '🍕 Visa billigaste alternativ', action: 'visaSokning', sok: billigastePizza.pizza_namn || '', pizzeria: billigastePizza.pizzeria || '' }
            ]
        });
    }

    const antalPizzaMatch = norm.match(/(\d+)\s*pizz/);
    if ((norm.includes('vad kostar') || norm.includes('kostar')) && antalPizzaMatch) {
        const antal = Number(antalPizzaMatch[1]);
        const minTotal = antal * hamtaPrisTal(billigastePizza);
        const maxTotal = antal * hamtaPrisTal(dyrastePizza);
        const snittTotal = antal * snittpris;
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: 'Resultat',
            innehall: `💰 <strong>${antal}</strong> pizzor kostar cirka <strong>${snittTotal.toFixed(0)} kr</strong> i snitt (spann <strong>${minTotal}–${maxTotal} kr</strong>).`,
            actions: [
                { label: '🍕 Visa billigaste alternativ', action: 'visaSokning', sok: billigastePizza.pizza_namn || '', pizzeria: billigastePizza.pizzeria || '' }
            ]
        });
    }

    if (norm.includes('kebab') && norm.includes('billig')) {
        const kebabPizzor = pizzorIUrval.filter((p) => byggPizzaSokText(p).includes('kebab'));
        if (!kebabPizzor.length) {
            return skapaAssistentSvarObjekt({
                kategori: 'pizza',
                rubrik: 'Resultat',
                innehall: 'Jag hittade ingen kebabpizza i urvalet.'
            });
        }
        const billigKebab = kebabPizzor.reduce((min, p) => hamtaPrisTal(p) < hamtaPrisTal(min) ? p : min, kebabPizzor[0]);
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: 'Resultat',
            innehall: `🥙 Billigaste kebabpizza: ${skapaPizzaSvarsrad(billigKebab)}.`,
            actions: [
                { label: '🍕 Visa dessa pizzor', action: 'visaSokning', sok: 'kebab', pizzeria: billigKebab.pizzeria || '' }
            ]
        });
    }

    if (norm.includes('vegetar')) {
        let maxPris = null;
        const underMatch = norm.match(/under\s*(\d+)/);
        if (underMatch) maxPris = Number(underMatch[1]);
        const vegPizzor = pizzorIUrval.filter((p) => arVegetariskPizza(p) && (maxPris === null || hamtaPrisTal(p) <= maxPris));
        if (!vegPizzor.length) {
            return skapaAssistentSvarObjekt({
                kategori: 'pizza',
                rubrik: 'Resultat',
                innehall: maxPris === null ? 'Jag hittade inga tydligt vegetariska pizzor i urvalet.' : `Jag hittade inga vegetariska pizzor under ${maxPris} kr.`
            });
        }
        const billigVeg = vegPizzor.reduce((min, p) => hamtaPrisTal(p) < hamtaPrisTal(min) ? p : min, vegPizzor[0]);
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: 'Resultat',
            innehall: `🥬 Jag hittade <strong>${vegPizzor.length}</strong> vegetariska alternativ${maxPris !== null ? ` under ${maxPris} kr` : ''}. Billigast är ${skapaPizzaSvarsrad(billigVeg)}.`,
            actions: [
                { label: '🍕 Visa dessa pizzor', action: 'visaSokning', sok: 'vegetarisk' }
            ]
        });
    }

    if (pizzeriaNamn && (norm.includes('kostar') || norm.includes('alla pizzor') || norm.includes('pizzor pa'))) {
        const minPris = hamtaPrisTal(billigastePizza);
        const maxPris = hamtaPrisTal(dyrastePizza);
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: escapaHtml(pizzeriaNamn),
            innehall: `Snittpris: <strong>${snittpris.toFixed(1)} kr</strong><br>Billigaste: <strong>${minPris} kr</strong><br>Dyraste: <strong>${maxPris} kr</strong>`,
            actions: [
                { label: '🍕 Visa dessa pizzor', action: 'visaPizzeria', pizzeria: pizzeriaNamn },
                { label: '📍 Hur hittar jag dit?', action: 'fraga', fraga: `Hur hittar jag till ${pizzeriaNamn}?` }
            ]
        });
    }

    return skapaAssistentSvarObjekt({
        kategori: 'site',
        rubrik: 'Om hemsidan',
        innehall: 'Jag kan svara på både pizzor och hemsidan: billigaste/dyraste/snittpris, budgetfrågor, kebab/vegetariskt, pizzerior, vägbeskrivning till pizzeria, varför sidan skapades, kontakt, integritet/cookies och vilka sidor som finns.',
        actions: [
            { label: '🔥 Populära frågor', action: 'focusInput' }
        ]
    });
}

function renderaAssistentSvar(svarEl, svarObj, fraga) {
    const kategoriEmoji = svarObj.kategori === 'site' ? 'ℹ️' : '🍕';
    const kategoriText = svarObj.kategori === 'site' ? 'Om hemsidan' : 'Resultat';
    const wrapper = document.createElement('div');
    wrapper.className = `assistent-svar-kort assistent-svar-kort--${svarObj.kategori === 'site' ? 'site' : 'pizza'}`;

    const meta = document.createElement('div');
    meta.className = 'assistent-svar-meta';
    meta.textContent = `${kategoriEmoji} ${kategoriText}`;
    wrapper.appendChild(meta);

    const rubrik = document.createElement('h3');
    rubrik.className = 'assistent-svar-rubrik';
    rubrik.innerHTML = svarObj.rubrik || (svarObj.kategori === 'site' ? 'Om hemsidan' : 'Resultat');
    wrapper.appendChild(rubrik);

    const body = document.createElement('div');
    body.className = 'assistent-svar-body';
    body.innerHTML = svarObj.innehall || '';
    wrapper.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'assistent-svar-actions';

    [...(svarObj.actions || []), { label: '📤 Dela denna fråga', action: 'share', fraga }].forEach((a) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'assistent-action-btn';
        btn.textContent = a.label;
        btn.dataset.action = a.action || '';
        if (a.href) btn.dataset.href = a.href;
        if (a.pizzeria) btn.dataset.pizzeria = a.pizzeria;
        if (a.sok !== undefined) btn.dataset.sok = a.sok;
        if (a.fraga) btn.dataset.fraga = a.fraga;
        actions.appendChild(btn);
    });

    wrapper.appendChild(actions);
    svarEl.innerHTML = '';
    svarEl.appendChild(wrapper);
}

function appliceraAssistentPizzeriaFilter(pizzeriaNamn) {
    const rensaBtn = document.getElementById('rensa-filter-btn');
    if (rensaBtn) rensaBtn.click();
    if (!pizzeriaNamn) {
        uppdateraVisning();
        return;
    }

    const cb = [...document.querySelectorAll('#pizzeria-lista input')].find((c) => c.value === pizzeriaNamn);
    if (cb) {
        cb.checked = true;
        togglaPizzeria(pizzeriaNamn, cb);
    } else {
        uppdateraVisning();
    }
}

function appliceraAssistentSokning(sokText, pizzeriaNamn = '') {
    const rensaBtn = document.getElementById('rensa-filter-btn');
    if (rensaBtn) rensaBtn.click();

    if (pizzeriaNamn) {
        const cb = [...document.querySelectorAll('#pizzeria-lista input')].find((c) => c.value === pizzeriaNamn);
        if (cb) {
            cb.checked = true;
            togglaPizzeria(pizzeriaNamn, cb);
        }
    }

    const sokruta = document.getElementById('sokruta');
    if (sokruta) sokruta.value = sokText || '';
    uppdateraVisning();
}

function skapaDelaFragaUrl(fraga) {
    const url = new URL(window.location.href);
    if (fraga) {
        url.searchParams.set('assistq', fraga);
    } else {
        url.searchParams.delete('assistq');
    }
    return url.toString();
}

async function delaFraga(fraga, svarEl) {
    const url = skapaDelaFragaUrl(fraga);
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
            if (svarEl) svarEl.setAttribute('data-share-status', 'Länk kopierad');
            return;
        }
    } catch {
        // fall through to prompt fallback
    }
    window.prompt('Kopiera den här länken:', url);
    if (svarEl) svarEl.setAttribute('data-share-status', 'Länk skapad');
}

function initPizzaAssistent() {
    const sektion = document.getElementById('pizza-assistent');
    const input = document.getElementById('pizza-assistent-input');
    const knapp = document.getElementById('pizza-assistent-knapp');
    const svarEl = document.getElementById('pizza-assistent-svar');

    if (!sektion || !input || !knapp || !svarEl) return;

    const svara = () => {
        const fraga = input.value;
        const svarObj = svaraPaPizzaFraga(fraga);
        renderaAssistentSvar(svarEl, svarObj, fraga);
    };

    knapp.addEventListener('click', svara);
    input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        svara();
    });

    document.querySelectorAll('.assistent-fraga-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            input.value = chip.dataset.fraga || '';
            svara();
        });
    });

    svarEl.addEventListener('click', (e) => {
        const target = e.target.closest('.assistent-action-btn');
        if (!target) return;

        const action = target.dataset.action || '';
        if (action === 'openLink' && target.dataset.href) {
            window.location.href = hamtaNavigeringsLankForPizzeria(target.dataset.href);
        } else if (action === 'visaPizzeria') {
            appliceraAssistentPizzeriaFilter(target.dataset.pizzeria || '');
        } else if (action === 'visaSokning') {
            appliceraAssistentSokning(target.dataset.sok || '', target.dataset.pizzeria || '');
        } else if (action === 'fraga' && target.dataset.fraga) {
            input.value = target.dataset.fraga;
            svara();
        } else if (action === 'focusInput') {
            input.focus();
            input.select();
        } else if (action === 'share') {
            delaFraga(target.dataset.fraga || input.value || '', svarEl);
        }
    });

    const fromUrl = new URLSearchParams(window.location.search).get('assistq');
    if (fromUrl) {
        input.value = fromUrl;
        svara();
    }
}

function uppdateraNarmastStatus(text, arFel = false) {
    const statusEl = document.getElementById('narmast-status');
    if (!statusEl) return;
    statusEl.innerText = text;
    statusEl.classList.toggle('error', arFel);
}

function resetNearbyMode() {
    isNearbyActive = false;
    anvandarPosition = null;
    uppdateraNarmastStatus('');
    const narmastBtn = document.getElementById('narmast-btn');
    if (narmastBtn) narmastBtn.classList.remove('narmast-aktiv');
}

function getUserLocation(forceRefresh = false) {
    if (anvandarPosition && !forceRefresh) {
        return Promise.resolve(anvandarPosition);
    }

    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation stöds inte av webbläsaren.'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                anvandarPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                resolve(anvandarPosition);
            },
            () => reject(new Error('Kunde inte hämta din position')),
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: forceRefresh ? 0 : 300000
            }
        );
    });
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function sortByDistance(pizzor, userLat, userLng) {
    return [...pizzor]
        .map((pizza) => {
            const dynamicKey = skapaPizzeriaCoordsNyckel(pizza.pizzeria, pizza.adress);
            const dynamicCoords = indexCoordsMap ? indexCoordsMap.get(dynamicKey) : null;
            const coords = dynamicCoords;
            const distansKm = coords
                ? calculateDistance(userLat, userLng, coords.lat, coords.lng)
                : Number.POSITIVE_INFINITY;

            return {
                ...pizza,
                distansKm
            };
        })
        .sort((a, b) => {
            if (a.distansKm !== b.distansKm) return a.distansKm - b.distansKm;
            return a.pizza_namn.localeCompare(b.pizza_namn, 'sv');
        });
}

let pizzeriorCoordsMapPromise = null;
let pizzeriorCoordsRowsPromise = null;
let pizzeriorInfoMapPromise = null;
let pizzorRowsPromise = null;
let extrasRowsPromise = null;

const __bpSupabaseCfg = window.BP_SUPABASE_CONFIG || {};
const SUPABASE_URL = __bpSupabaseCfg.url || 'https://yixjzzehejrfcpyccyxp.supabase.co';
const SUPABASE_ANON_KEY = __bpSupabaseCfg.anonKey || 'sb_publishable_LSQb_Gxsh0BkPGqT6HA2ig_oVQI-lDv';

async function hamtaSupabaseRows(query) {
    const batchSize = 1000;
    let offset = 0;
    const allaRows = [];

    while (true) {
        const separator = query.includes('?') ? '&' : '?';
        const pagedQuery = `${query}${separator}limit=${batchSize}&offset=${offset}`;
        const url = `${SUPABASE_URL}/rest/v1/${pagedQuery}`;

        const response = await fetch(url, {
            headers: {
                apikey: SUPABASE_ANON_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`Supabase-förfrågan misslyckades (${response.status}) för ${query}`);
        }

        const rows = await response.json();
        const lista = Array.isArray(rows) ? rows : [];
        allaRows.push(...lista);

        if (lista.length < batchSize) break;
        offset += batchSize;
    }

    return allaRows;
}

function hamtaPizzeriorInfoMapFranSupabase() {
    if (pizzeriorInfoMapPromise) return pizzeriorInfoMapPromise;

    pizzeriorInfoMapPromise = hamtaSupabaseRows('pizzerior?select=id,namn,adress,stad,omrade,telefon,hemsida,oppettider&order=id.asc')
        .then((rows) => {
            const map = new Map();
            (Array.isArray(rows) ? rows : []).forEach((row) => {
                if (!row || row.id === null || row.id === undefined) return;
                map.set(Number(row.id), {
                    namn: row.namn || '',
                    adress: row.adress || '',
                    stad: row.stad || '',
                    omrade: row.omrade || '',
                    telefon: row.telefon || '',
                    hemsida: row.hemsida || '',
                    oppettider: row.oppettider || null
                });
            });
            return map;
        });

    return pizzeriorInfoMapPromise;
}

function hamtaPizzorListaFranSupabase() {
    if (pizzorRowsPromise) return pizzorRowsPromise;

    pizzorRowsPromise = Promise.all([
        hamtaPizzeriorInfoMapFranSupabase(),
        hamtaSupabaseRows('pizzor?select=pizzeria_id,pizza_namn,pris,ingredienser&order=id.asc')
    ]).then(([pizzeriorMap, pizzorRows]) => {
        return (Array.isArray(pizzorRows) ? pizzorRows : []).map((row) => {
            const info = pizzeriorMap.get(Number(row?.pizzeria_id)) || {};
            return {
                pizzeria: info.namn || '',
                adress: info.adress || '',
                stad: info.stad || '',
                omrade: info.omrade || '',
                telefon: info.telefon || '',
                hemsida: info.hemsida || '',
                oppettider: info.oppettider || null,
                pizza_namn: row?.pizza_namn || '',
                pris: row?.pris === null || row?.pris === undefined || row?.pris === ''
                    ? null
                    : (Number.isFinite(Number(row?.pris)) ? Number(row?.pris) : null),
                ingredienser: Array.isArray(row?.ingredienser) ? row.ingredienser : []
            };
        }).filter((row) => row.pizzeria && row.pizza_namn);
    });

    return pizzorRowsPromise;
}

function hamtaExtrasListaFranSupabase() {
    if (extrasRowsPromise) return extrasRowsPromise;

    extrasRowsPromise = Promise.all([
        hamtaPizzeriorInfoMapFranSupabase(),
        hamtaSupabaseRows('extras?select=pizzeria_id,kategori,namn,pris,beskrivning&order=id.asc')
    ]).then(([pizzeriorMap, extrasRows]) => {
        return (Array.isArray(extrasRows) ? extrasRows : []).map((row) => {
            const info = pizzeriorMap.get(Number(row?.pizzeria_id)) || {};
            return {
                pizzeria: info.namn || '',
                kategori: row?.kategori || '',
                namn: row?.namn || '',
                pris: row?.pris === null || row?.pris === undefined || row?.pris === ''
                    ? null
                    : (Number.isFinite(Number(row?.pris)) ? Number(row?.pris) : null),
                beskrivning: row?.beskrivning || ''
            };
        }).filter((row) => row.pizzeria && row.namn);
    });

    return extrasRowsPromise;
}

function skapaPizzeriaCoordsNyckel(pizzeriaNamn, adress) {
    const namn = normaliseraText(pizzeriaNamn || '');
    const adr = normaliseraText(adress || '');
    return `${namn}|||${adr}`;
}

function hamtaCoordsFranStatiskLista(adress) {
    if (!adress) return null;

    const exact = ADRESS_COORDS[adress];
    if (exact) return exact;

    const nyckel = normaliseraText(adress);
    for (const [k, v] of Object.entries(ADRESS_COORDS)) {
        if (normaliseraText(k) === nyckel) return v;
    }

    return null;
}

function hamtaPizzeriorCoordsLista() {
    if (pizzeriorCoordsRowsPromise) return pizzeriorCoordsRowsPromise;

    const supabaseUrl = `${SUPABASE_URL}/rest/v1/pizzerior?select=namn,adress,lat,lng&limit=1000`;

    pizzeriorCoordsRowsPromise = fetch(supabaseUrl, {
        headers: {
            apikey: SUPABASE_ANON_KEY
        }
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Kunde inte hämta koordinater från Supabase (${response.status})`);
            }
            return response.json();
        })
        .then((rows) => {
            if (!Array.isArray(rows) || rows.length === 0) {
                throw new Error('Supabase returnerade inga koordinatrader');
            }

            const filtreradeRows = rows
                .map((row) => ({
                    pizzeria: row?.namn,
                    adress: row?.adress,
                    lat: Number(row?.lat),
                    lng: Number(row?.lng)
                }))
                .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng));

            console.log('[Coords] Källa: Supabase', {
                rows: filtreradeRows.length,
                sample: filtreradeRows[0] || null
            });

            return filtreradeRows;
        })
        .catch((error) => {
            console.error('[Coords] Kunde inte ladda koordinater fran Supabase:', error);
            return [];
        });

    return pizzeriorCoordsRowsPromise;
}

function hamtaPizzeriorCoordsMap() {
    if (pizzeriorCoordsMapPromise) return pizzeriorCoordsMapPromise;

    pizzeriorCoordsMapPromise = hamtaPizzeriorCoordsLista()
        .then((rows) => {
            const map = new Map();
            if (!Array.isArray(rows)) return map;

            rows.forEach((row) => {
                const lat = Number(row?.lat);
                const lng = Number(row?.lng);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

                const nyckel = skapaPizzeriaCoordsNyckel(row?.pizzeria, row?.adress);
                if (!nyckel || nyckel === '|||') return;

                map.set(nyckel, { lat, lng });
            });

            return map;
        })
        .catch((error) => {
            console.error('[Narmast mig] Kunde inte ladda koordinatdata:', error);
            return new Map();
        });

    return pizzeriorCoordsMapPromise;
}

function kopplaCoordsTillPizzerior(pizzerior, coordsMap) {
    const saknarCoords = [];

    const listaMedCoords = pizzerior.map((pizzeria) => {
        const nyckel = skapaPizzeriaCoordsNyckel(pizzeria.namn, pizzeria.adress);
        const franMap = coordsMap.get(nyckel) || null;
        const coords = franMap;

        if (!coords) {
            saknarCoords.push(`${pizzeria.namn} | ${pizzeria.adress}`);
        }

        return {
            ...pizzeria,
            lat: coords?.lat,
            lng: coords?.lng
        };
    });

    if (saknarCoords.length > 0) {
        console.warn(`[Narmast mig] ${saknarCoords.length} pizzerior saknar coords.`, saknarCoords.slice(0, 25));
    }

    return listaMedCoords;
}

function sorteraPizzeriorEfterDynamiskDistans(pizzerior, userLat, userLng) {
    return pizzerior
        .map((pizzeria) => {
            const harCoords = Number.isFinite(pizzeria.lat) && Number.isFinite(pizzeria.lng);
            const distansKm = harCoords
                ? calculateDistance(userLat, userLng, pizzeria.lat, pizzeria.lng)
                : Number.POSITIVE_INFINITY;

            return {
                ...pizzeria,
                distansKm
            };
        })
        .sort((a, b) => {
            if (a.distansKm !== b.distansKm) return a.distansKm - b.distansKm;
            return (a.namn || '').localeCompare((b.namn || ''), 'sv');
        });
}

function gtmPushKlick(data) { // GTM tracking
    if (gtmSuppressNextPizzaKortEvent && data && data.event === 'klick' && data.typ === 'pizza') { // GTM tracking
        gtmSuppressNextPizzaKortEvent = false; // GTM tracking
        return; // GTM tracking
    } // GTM tracking
    window.dataLayer = window.dataLayer || []; // GTM tracking
    window.dataLayer.push(data); // GTM tracking
} // GTM tracking

function gtmTrackScrollDjup() { // GTM tracking
    const doc = document.documentElement; // GTM tracking
    const maxScroll = doc.scrollHeight - window.innerHeight; // GTM tracking
    if (maxScroll <= 0) return; // GTM tracking
    const procent = Math.min(100, Math.round((window.scrollY / maxScroll) * 100)); // GTM tracking
    [25, 50, 75, 100].forEach((steg) => { // GTM tracking
        if (procent >= steg && !gtmScrollStegSkickade.has(steg)) { // GTM tracking
            gtmScrollStegSkickade.add(steg); // GTM tracking
            gtmPushKlick({ event: 'scroll', procent: steg }); // GTM tracking
        } // GTM tracking
    }); // GTM tracking
} // GTM tracking

function gtmInitNavbarTracking() { // GTM tracking
    document.querySelectorAll('.nav-links a').forEach((lank) => { // GTM tracking
        lank.addEventListener('click', () => { // GTM tracking
            gtmPushKlick({ event: 'klick', typ: 'navbar', namn: lank.textContent.trim() }); // GTM tracking
        }); // GTM tracking
    }); // GTM tracking
} // GTM tracking

let gtmPizzaKortTrackingInitierad = false; // GTM tracking
let pizzaKortNavigeringInitierad = false;

function gtmInitPizzaKortTracking() { // GTM tracking
    if (gtmPizzaKortTrackingInitierad) return; // GTM tracking
    gtmPizzaKortTrackingInitierad = true; // GTM tracking

    document.addEventListener('click', function(event) { // GTM tracking
        const kort = event.target.closest('#resultat-lista .pizza-kort'); // GTM tracking
        if (!kort) return; // GTM tracking

        const klickadLank = event.target.closest('a'); // GTM tracking
        let typ = 'pizza'; // GTM tracking

        if (klickadLank) { // GTM tracking
            const href = klickadLank.getAttribute('href') || ''; // GTM tracking
            if (href.startsWith('tel:')) typ = 'telefon'; // GTM tracking
            else if (href.includes('google.com/maps/search')) typ = 'karta'; // GTM tracking
            else typ = 'lank'; // GTM tracking
        } // GTM tracking

        gtmPushKlick({ // GTM tracking
            event: 'klick', // GTM tracking
            typ: typ, // GTM tracking
            pizza: kort.dataset.pizza || '', // GTM tracking
            pizzeria: kort.dataset.pizzeria || '', // GTM tracking
            omrade: kort.dataset.omrade || '', // GTM tracking
            pris: kort.dataset.pris || '' // GTM tracking
        }); // GTM tracking
    }); // GTM tracking
} // GTM tracking

function initPizzaKortNavigering() {
    if (pizzaKortNavigeringInitierad) return;
    pizzaKortNavigeringInitierad = true;

    const lista = document.getElementById('resultat-lista');
    if (!lista) return;

    const arInteraktivtElement = (el) => Boolean(el && el.closest('a, button, input, textarea, select, label'));

    lista.addEventListener('click', (event) => {
        const kort = event.target.closest('.pizza-kort[data-href]');
        if (!kort || arInteraktivtElement(event.target)) return;

        const href = kort.dataset.href || '';
        if (href) {
            window.location.href = href;
        }
    });

    lista.addEventListener('keydown', (event) => {
        const target = event.target;
        const kort = target?.closest?.('.pizza-kort[data-href]');
        if (!kort || arInteraktivtElement(target)) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;

        event.preventDefault();
        const href = kort.dataset.href || '';
        if (href) {
            window.location.href = href;
        }
    });
}

// --- Routing + Data Normalization ---
const DYNAMISK_PIZZERIA_BASSIDA = '/pizzerior';

function normaliseraPizzeriaNamn(namn) {
    return (namn || '').toLowerCase().trim();
}

function skapaPizzeriaSlug(namn) {
    return (namn || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(pizzeria|restaurang|resturang)\b/g, ' ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

function skapaDynamiskPizzeriaLank(namn) {
    return `${DYNAMISK_PIZZERIA_BASSIDA}/${skapaPizzeriaSlug(namn)}`;
}

function hamtaPizzeriaSlugFranUrl() {
    const hash = (window.location.hash || '').replace(/^#/, '').trim();
    if (hash) {
        const hashParams = new URLSearchParams(hash.startsWith('?') ? hash.slice(1) : hash);
        const slugFranHash = (hashParams.get('slug') || '').trim().toLowerCase();
        if (slugFranHash) {
            return slugFranHash.replace(/\.html?$/i, '');
        }
    }

    const params = new URLSearchParams(window.location.search || '');
    const slugFranQuery = (params.get('slug') || '').trim().toLowerCase();
    if (slugFranQuery) {
        return slugFranQuery;
    }

    const match = (window.location.pathname || '').match(/\/pizzerior\/([^/?#]+)\/?$/i);
    if (!match || !match[1]) {
        return '';
    }

    const slug = decodeURIComponent(match[1])
        .toLowerCase()
        .replace(/\.html?$/i, '');

    if (slug === 'pizzeria') {
        // Some local/static servers can collapse "/pizzerior/pizzeria.html?slug=xyz" to
        // "/pizzerior/pizzeria" and drop query params. Recover from referrer when possible.
        try {
            const ref = new URL(document.referrer || '', window.location.origin);
            const refParams = new URLSearchParams(ref.search || '');
            const refSlugQuery = (refParams.get('slug') || '').trim().toLowerCase();
            if (refSlugQuery && refSlugQuery !== 'pizzeria') {
                return refSlugQuery.replace(/\.html?$/i, '');
            }

            const refMatch = (ref.pathname || '').match(/\/pizzerior\/([^/?#]+)\/?$/i);
            if (refMatch && refMatch[1]) {
                const refSlug = decodeURIComponent(refMatch[1]).toLowerCase().replace(/\.html?$/i, '');
                if (refSlug && refSlug !== 'pizzeria') {
                    return refSlug;
                }
            }
        } catch (_) {
            // Ignore malformed referrer and fall through to empty slug.
        }

        return '';
    }

    return slug;
}

function hamtaPizzeriaNamnFranQuery() {
    const params = new URLSearchParams(window.location.search || '');
    return (params.get('pizzeria') || '').trim();
}

function skapaPizzeriorSidaDataFranJson(data) {
    const infoPerPizzeria = new Map();

    data.forEach((pizza) => {
        const nyckel = normaliseraPizzeriaNamn(pizza.pizzeria);
        if (!infoPerPizzeria.has(nyckel)) {
            infoPerPizzeria.set(nyckel, {
                namn: pizza.pizzeria || '',
                adress: pizza.adress || '',
                telefon: pizza.telefon || '',
                hemsida: pizza.hemsida || '',
                omrade: pizza.omrade || '',
                stad: pizza.stad || '',
                oppettider: pizza.oppettider || null
            });
        }
    });

    const slugAnvandning = new Map();

    return Array.from(infoPerPizzeria.values()).map((pizzeria) => {
        const basSlug = skapaPizzeriaSlug(pizzeria.namn) || 'pizzeria';
        const redanAnvand = slugAnvandning.get(basSlug) || 0;
        const slug = redanAnvand === 0 ? basSlug : `${basSlug}-${redanAnvand + 1}`;
        slugAnvandning.set(basSlug, redanAnvand + 1);

        return {
            namn: pizzeria.namn,
            slug,
            telefon: pizzeria.telefon,
            adress: pizzeria.adress,
            hemsida: pizzeria.hemsida,
            omrade: pizzeria.omrade,
            stad: pizzeria.stad,
            oppettider: pizzeria.oppettider,
            länk: `${DYNAMISK_PIZZERIA_BASSIDA}/${slug}`
        };
    });
}

// --- SEO: Schema.org JSON-LD ---

function parsaAdress(adress) {
    if (!adress) return {};
    const m = adress.match(/^(.+?),\s*(\d{3}\s?\d{2})\s+(.+)$/);
    if (m) {
        return { streetAddress: m[1].trim(), postalCode: m[2].trim(), addressLocality: m[3].trim() };
    }
    return { streetAddress: adress };
}

function injecteraJsonLd(data, id) {
    const befintlig = document.getElementById(id);
    if (befintlig) befintlig.remove();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
}

function byggItemListSchema(pizzerior) {
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        'name': 'Billiga pizzor i Mölndal',
        'itemListElement': pizzerior.map((p, i) => {
            const adr = parsaAdress(p.adress);
            const adressObj = { '@type': 'PostalAddress', 'addressRegion': p.stad || 'Mölndal', 'addressCountry': 'SE' };
            if (adr.streetAddress) adressObj.streetAddress = adr.streetAddress;
            if (adr.postalCode) adressObj.postalCode = adr.postalCode;
            if (adr.addressLocality) adressObj.addressLocality = adr.addressLocality;
            return {
                '@type': 'ListItem',
                'position': i + 1,
                'url': `https://billigapizzor.se/pizzerior/${p.slug}`,
                'item': { '@type': 'Restaurant', 'name': p.namn, 'address': adressObj }
            };
        })
    };
}

function byggRestaurantSchema(pizzeriaInfo, pizzeriaNamn) {
    const adr = parsaAdress(pizzeriaInfo.adress);
    const adressObj = { '@type': 'PostalAddress', 'addressRegion': pizzeriaInfo.stad || 'Mölndal', 'addressCountry': 'SE' };
    if (adr.streetAddress) adressObj.streetAddress = adr.streetAddress;
    if (adr.postalCode) adressObj.postalCode = adr.postalCode;
    if (adr.addressLocality) adressObj.addressLocality = adr.addressLocality;
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        'name': pizzeriaNamn,
        'address': adressObj
    };
    if (pizzeriaInfo.telefon) schema.telephone = pizzeriaInfo.telefon;
    if (pizzeriaInfo.hemsida) schema.url = pizzeriaInfo.hemsida;
    return schema;
}

function initSchemaGenerellSida() {
    // Pages with dedicated inits handle schema themselves
    if (document.getElementById('filter-sektion') || document.getElementById('pizzerior-lista') || document.getElementById('pizzeria-sida-root')) {
        return;
    }
    hamtaPizzorListaFranSupabase()
        .then(data => {
            injecteraJsonLd(byggItemListSchema(skapaPizzeriorSidaDataFranJson(data)), 'schema-itemlist');
        });
}

// --- UI Data Sources ---
// --- DIN MANUELLA LISTA PÅ INGREDIENSER ---
const MANUELLA_INGREDIENSER = [
    "Ananas", "Aubergine", "Avokado", "Bacon", "Banan", "Basilika", "Basilikapesto",
    "BBQ-sås", "Bearnaisesås", "Biffkebab", "Brieost", "Briochebröd", "Broccoli",
    "Buffelmozzarella", "Caesardressing", "Cayennepeppar", "Champinjoner", "Cheddarost",
    "Cheddarsås", "Chevré", "Chiliflakes", "Chilimajonnäs", "Chilimayo", "Chiliolja",
    "Citron", "Coleslaw", "Crème fraiche", "Crispy kyckling", "Curry", "Currysås",
    "Dipsås", "Dressing", "Dönerkött", "Falafel", "Feferoni", "Fetaost", "Fior di latte",
    "Fisk", "Florsocker", "Fläskfilé", "Fläskkebab", "Friterad kyckling", "Fårost",
    "Fänkålssalami", "Färsk basilika", "Färsk mozzarella", "Färsk paprika", "Färsk tomat",
    "Färsk vitlök", "Färska champinjoner", "Färska räkor", "Färska tomater",
    "Getost", "Godis", "Gorgonzola", "Gouda", "Grillad kyckling", "Grillad kycklingfilé",
    "Grillad tomat", "Grillade grönsaker", "Grillat kött", "Grillat lammfärsspett",
    "Grädde", "Gräddfil", "Gräddsås", "Grönsaker", "Gurka", "Hallon", "Hallonsås",
    "Halloumi", "Hamburgare", "Hamburgerdressing", "Handskalade räkor", "Heta kryddor",
    "Honung", "Högrevsfärs", "Inlagd gurka", "Isbergssallad", "Jalapeño", "Jordnötter",
    "Kalvfond", "Kapris", "Kebab", "Kebabkrydda", "Kebabkött", "Kebabsås", "Kebabsås stark",
    "Ketchup", "Korv", "Krabba", "Krabbfish", "Krabbstick", "Krispsallad", "Kronärtskocka",
    "Kryddor", "Kräftor", "Kräftstjärtar", "Kyckling", "Kyckling nuggets", "Kycklingfilé",
    "Kycklingfiléspett", "Kycklingkebab", "Kycklingvingar", "Körsbärstomater", "Köttfärs",
    "Köttfärssås", "Lammfärsspett", "Lammracks", "Lammytterfilé", "Lax", "Lime",
    "Lufttorkad skinka", "Lök", "Lökringar", "Majonnäs", "Majs", "Mandarin", "Mangochutney",
    "Marinerad kyckling", "Mixsallad", "Mjukost", "Mozzarella", "Mumssås", "Musslor",
    "Nachochips", "Nachos", "Nutella", "Nötfärs", "Nötkebab", "Nötkött", "Nötter",
    "Oliver", "Olivolja", "Ost", "Oxfilé", "Oxkött", "Panering", "Paprika", "Parmaskinka",
    "Parmesan", "Parmigiano", "Peperoni", "Peppar", "Pepparjack ost", "Pepperoni",
    "Persilja", "Persiskt ris", "Pesto", "Picklad gurka", "Pinjenötter", "Piri-piri",
    "Pizzaost", "Pommes", "Pommes frites", "Potatis", "Prosciutto", "Pulled pork",
    "Purjolök", "Remouladsås", "Rhode islandsås", "Ricotta", "Ris", "Riven parmesan",
    "Rostad lök", "Ruccola", "Ruccolasallad", "Rå lök", "Räfflad potatis", "Räkor",
    "Röd paprika", "Rödkål", "Rödlök", "Rödvin", "Saffran", "Salami", "Sallad",
    "Salladost", "Saltgurka", "San marzano tomatsås", "Sardeller", "Scampi", "Schnitzel",
    "Senap", "Skaldjur", "Skinka", "Smältost", "Soltorkade tomater", "Sparris", "Spenat",
    "Sriracha", "Sriracha mayo", "Stark kebabsås", "Stark korv", "Stark krydda", "Stark sås",
    "Starka kryddor", "Starksås", "Stekt ägg", "Strimlad biff", "Stureost", "Svartpeppar",
    "Sås", "Tabasco", "Taco kryddmix", "Tacosås", "Tomat", "Tomater", "Tomatsås", "Tonfisk",
    "Tryffelmajonnäs", "Tryffelolja", "Tzatziki", "Tärnad tomat", "Valfri dressing",
    "Valfri sås", "Valnötter", "Vegetarisk biff", "Veggieburgare", "Veggokorv",
    "Vegmozzarella", "Vitlök", "Vitlöksdressing", "Vitlökssås", "Zucchini",
    "Ädelost", "Ägg", "Ärtor", "Örter", "Örtkrydda"
];

function formatIngrediensDisplayNamn(ingrediens) {
    const trim = String(ingrediens || '').trim().replace(/\s+/g, ' ');
    if (!trim) return '';
    return trim.charAt(0).toUpperCase() + trim.slice(1);
}

function hamtaDynamiskaIngredienserFranData(pizzor) {
    const canonicalByNorm = new Map(
        MANUELLA_INGREDIENSER.map((namn) => [normaliseraText(namn), namn])
    );
    const unikaByNorm = new Map();

    (Array.isArray(pizzor) ? pizzor : []).forEach((pizza) => {
        if (!Array.isArray(pizza?.ingredienser)) return;
        pizza.ingredienser.forEach((ingrediens) => {
            const trim = String(ingrediens || '').trim();
            // Strip parenthetical suffixes like "(8 bitar)" so duplicates merge
            const cleaned = trim.replace(/\s*\([^)]*\)\s*$/, '').trim();
            const norm = normaliseraText(cleaned);
            if (!norm) return;
            if (unikaByNorm.has(norm)) return;
            unikaByNorm.set(norm, canonicalByNorm.get(norm) || formatIngrediensDisplayNamn(cleaned));
        });
    });

    return [...unikaByNorm.values()].sort((a, b) => a.localeCompare(b, 'sv'));
}

function arOppetNu(oppettider) {
    if (!oppettider || typeof oppettider !== 'object') return null;
    const nu = new Date();
    const dag = nu.getDay();
    const nuMinuter = nu.getHours() * 60 + nu.getMinutes();
    const dagIndex = { man:1,mandag:1,monday:1,tis:2,tisdag:2,tuesday:2,ons:3,onsdag:3,wednesday:3,tor:4,tors:4,torsdag:4,thursday:4,thu:4,fre:5,fredag:5,friday:5,lor:6,lordag:6,saturday:6,sat:6,son:0,sondag:0,sunday:0,sun:0 };
    function norm(s) { return String(s||'').toLowerCase().replace(/[åä]/g,'a').replace(/ö/g,'o').replace(/[._]/g,' ').replace(/[–—−]/g,'-').replace(/\s+/g,' ').trim(); }
    function hamtaDag(t) { return dagIndex[norm(t).replace(/\./g,'').replace(/\s+/g,'')]; }
    function tidMin(s) { const m=String(s||'').trim().match(/^(\d{1,2})[:.](\d{1,2})$/); if(!m)return null; const h=parseInt(m[1],10),min=parseInt(m[2],10); if(h<0||h>23||min<0||min>59)return null; return h*60+min; }
    function extractDagText(t) { return norm(t).replace(/\d{1,2}[:.]\d{1,2}/g,' ').replace(/[0-9]/g,' ').replace(/\s+/g,' ').trim(); }
    function tolkaDagNyckel(nyckelNorm, tidText, checkDag) {
        const allaDagar=['alla dagar','alladagar','alla dag','man-son','man-sondag'];
        if(allaDagar.indexOf(nyckelNorm)!==-1) return { hadeDag:true, matchar:true };
        let hadeDag=false, matchar=false;
        [nyckelNorm, extractDagText(tidText)].forEach(src=>{
            src.split(',').map(s=>s.trim()).filter(Boolean).forEach(del=>{
                const delar=del.split(/[-–—]/).map(d=>d.trim()).filter(Boolean);
                if(delar.length===2){const f=hamtaDag(delar[0]),t=hamtaDag(delar[1]);if(f!==undefined&&t!==undefined){hadeDag=true;const tr=(f<=t)?(checkDag>=f&&checkDag<=t):(checkDag>=f||checkDag<=t);if(tr)matchar=true;}}
                if(delar.length===1){const idx=hamtaDag(delar[0]);if(idx!==undefined){hadeDag=true;if(checkDag===idx)matchar=true;}}
            });
        });
        return {hadeDag, matchar};
    }
    function arNuInom(tidText) {
        const re=/(\d{1,2}[:.]\d{1,2})\s*[-–—]\s*(\d{1,2}[:.]\d{1,2})/g;
        let m, hittade=false;
        while((m=re.exec(tidText))!==null){
            hittade=true;
            const o=tidMin(m[1]),s=tidMin(m[2]);
            if(o===null||s===null)continue;
            if(o===s) return true;
            if(o<s){ if(nuMinuter>=o&&nuMinuter<s) return true; }
            else { if(nuMinuter>=o||nuMinuter<s) return true; }
        }
        return hittade ? false : null;
    }
    const kandidater=[];
    let hadeDagNyckel=false;
    Object.keys(oppettider).forEach(nyckel=>{
        const nyckelNorm=norm(nyckel);
        if(!nyckelNorm) return;
        const tidText=String(oppettider[nyckel]||'');
        const tolkad=tolkaDagNyckel(nyckelNorm, tidText, dag);
        if(tolkad.hadeDag){ hadeDagNyckel=true; if(tolkad.matchar) kandidater.push(tidText); return; }
        const tolkadVal=tolkaDagNyckel(extractDagText(tidText), '', dag);
        if(tolkadVal.hadeDag){ hadeDagNyckel=true; if(tolkadVal.matchar) kandidater.push(tidText); }
    });
    if(!kandidater.length) return hadeDagNyckel ? false : null;
    let hadeTolkbarTid=false;
    for(let i=0;i<kandidater.length;i++){
        const status=arNuInom(kandidater[i]);
        if(status===true) return true;
        if(status!==null) hadeTolkbarTid=true;
    }
    return hadeTolkbarTid ? false : null;
}

function stangerOppnarOm(oppettider) {
    if (!oppettider || typeof oppettider !== 'object') return '';
    const nu = new Date();
    const dag = nu.getDay();
    const dagIgar = (dag + 6) % 7;
    const nuMin = nu.getHours() * 60 + nu.getMinutes();
    const dagIndex = { man:1,mandag:1,monday:1,tis:2,tisdag:2,tuesday:2,ons:3,onsdag:3,wednesday:3,tor:4,tors:4,torsdag:4,thursday:4,thu:4,fre:5,fredag:5,friday:5,lor:6,lordag:6,saturday:6,sat:6,son:0,sondag:0,sunday:0,sun:0 };
    function norm(s){return String(s||'').toLowerCase().replace(/[åä]/g,'a').replace(/ö/g,'o').replace(/[._]/g,' ').replace(/[–—−]/g,'-').replace(/\s+/g,' ').trim();}
    function hamtaDag(t){return dagIndex[norm(t).replace(/\./g,'').replace(/\s+/g,'')];}
    function tidMin(s){const m=String(s||'').trim().match(/^(\d{1,2})[:.](\d{1,2})$/);if(!m)return null;return parseInt(m[1],10)*60+parseInt(m[2],10);}
    function extractDagText(t){return norm(t).replace(/\d{1,2}[:.]\d{1,2}/g,' ').replace(/[0-9]/g,' ').replace(/\s+/g,' ').trim();}
    function dagMatcharFor(nyckelNorm,tidText,checkDag){
        const allaDagar=['alla dagar','alladagar','alla dag','man-son','man-sondag'];
        if(allaDagar.indexOf(nyckelNorm)!==-1)return true;
        let mat=false;
        [nyckelNorm, extractDagText(tidText)].forEach(src=>{
            src.split(',').map(s=>s.trim()).filter(Boolean).forEach(del=>{
                const delar=del.split(/[-–—]/).map(d=>d.trim()).filter(Boolean);
                if(delar.length===2){const f=hamtaDag(delar[0]),t=hamtaDag(delar[1]);if(f!==undefined&&t!==undefined){const tr=(f<=t)?(checkDag>=f&&checkDag<=t):(checkDag>=f||checkDag<=t);if(tr)mat=true;}}
                if(delar.length===1){const idx=hamtaDag(delar[0]);if(idx!==undefined&&checkDag===idx)mat=true;}
            });
        });
        return mat;
    }
    function formatMin(m){if(m<=0)return'';const h=Math.floor(m/60),min=m%60;if(h>0&&min>0)return h+'h '+min+'m';if(h>0)return h+'h';return min+'m';}
    const imorgon=(dag+1)%7;
    const intervallerIdag=[], intervallerImorgon=[], intervallerIgar=[];
    Object.keys(oppettider).forEach(nyckel=>{
        const tidText=String(oppettider[nyckel]||'');
        const nyckelNorm=norm(nyckel);
        const re=/(\d{1,2}[:.]\d{1,2})\s*[-–—]\s*(\d{1,2}[:.]\d{1,2})/g;
        let m2;
        while((m2=re.exec(tidText))!==null){
            const o=tidMin(m2[1]),s=tidMin(m2[2]);
            if(o===null||s===null)continue;
            if(dagMatcharFor(nyckelNorm,tidText,dagIgar))intervallerIgar.push({o,s});
            if(dagMatcharFor(nyckelNorm,tidText,dag))intervallerIdag.push({o,s});
            if(dagMatcharFor(nyckelNorm,tidText,imorgon))intervallerImorgon.push({o,s});
        }
    });

    // First check if we are in an overnight spill from yesterday.
    for(let i=0;i<intervallerIgar.length;i++){
        const {o,s}=intervallerIgar[i];
        if(o>s && nuMin<s){
            return '⏳ Stänger om '+formatMin(s-nuMin);
        }
    }

    for(let i=0;i<intervallerIdag.length;i++){
        const {o,s}=intervallerIdag[i];
        if(o<s){
            if(nuMin>=o&&nuMin<s){
                return '⏳ Stänger om '+formatMin(s-nuMin);
            }
        }else if(o>s){
            // Overnight interval for today only counts before midnight on the same day.
            if(nuMin>=o){
                return '⏳ Stänger om '+formatMin(1440-nuMin+s);
            }
        }
    }

    let nastaIdag=null;
    intervallerIdag.forEach(({o})=>{if(o>nuMin){const d=o-nuMin;if(nastaIdag===null||d<nastaIdag)nastaIdag=d;}});
    if(nastaIdag!==null)return '🕐 Öppnar om '+formatMin(nastaIdag);
    let nastaImorgon=null;
    intervallerImorgon.forEach(({o})=>{const d=(1440-nuMin)+o;if(nastaImorgon===null||d<nastaImorgon)nastaImorgon=d;});
    if(nastaImorgon!==null)return '🕐 Öppnar om '+formatMin(nastaImorgon);
    return '';
}

function uppdateraInternaLankarForLokalUtveckling() {
    if (!arLokalUtveckling()) {
        return;
    }

    document.querySelectorAll('a[href^="/"]').forEach((lank) => {
        const href = lank.getAttribute('href');
        if (!href || href.endsWith('.html')) {
            return;
        }

        lank.setAttribute('href', hamtaLokalHref(href));
    });
}

function gtmSpåraPizzeriaKlickOchNavigera(namn, länk) { // GTM tracking
    gtmPushKlick({ event: 'klick', typ: 'pizzeria', namn: namn }); // GTM tracking
    window.location.href = hamtaNavigeringsLankForPizzeria(länk); // GTM tracking
} // GTM tracking

// --- UI Interactions ---
function showHome() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function valjKategori(chip) {
    const kategori = chip.dataset.kategori || 'Pizzor (alla)';

    if (kategori === 'Pizzor (alla)') {
        aktivaKategorier.clear();
    } else {
        if (aktivaKategorier.has(kategori)) {
            aktivaKategorier.delete(kategori);
        } else {
            aktivaKategorier.add(kategori);
        }
    }

    const arAllaAktiv = aktivaKategorier.size === 0;
    document.querySelectorAll('.kategori-chip').forEach((c) => {
        const chipKategori = c.dataset.kategori || 'Pizzor (alla)';
        const arAktiv = chipKategori === 'Pizzor (alla)'
            ? arAllaAktiv
            : aktivaKategorier.has(chipKategori);
        c.classList.toggle('kategori-chip--active', arAktiv);
    });

    uppdateraVisning();
}

function toggleMobilMeny() {
    const nav = document.querySelector('.navbar');
    const ikon = document.querySelector('.hamburger-ikon');
    if (!nav || !ikon) return;
    nav.classList.toggle('nav-open');
    ikon.classList.toggle('mobil-meny-aktiv');
}

function closeMobilMeny() {
    const nav = document.querySelector('.navbar');
    const ikon = document.querySelector('.hamburger-ikon');
    if (!nav || !ikon) return;
    nav.classList.remove('nav-open');
    ikon.classList.remove('mobil-meny-aktiv');
}

function togglaFAQ() {
    alert("Frågor & Svar: Vi jämför priser från lokala menyer i Mölndal. Priserna uppdateras löpande. Sidan är under arbete!");
}

function togglaOmOss() {
    const sektion = document.getElementById('om-oss-sektion');
    if (!sektion) return;
    sektion.classList.toggle('visa');
    if (sektion.classList.contains('visa')) {
        sektion.scrollIntoView({ behavior: 'smooth' });
    }
}

function togglaLasMer() {
    const textContent = document.getElementById('hero-text-content');
    const btn = document.getElementById('las-mer-btn');

    if (!textContent || !btn) return;

    textContent.classList.toggle('collapsed');
    const arKollapsad = textContent.classList.contains('collapsed');
    btn.textContent = arKollapsad ? 'Läs mer' : 'Visa mindre';
}

// Backward-compatible alias for existing onclick handler in HTML.
function toglaLasMer() {
    togglaLasMer();
}

window.onclick = function(event) {
    if (!event.target.closest('.dropdown-container') && !event.target.closest('.hamburger-ikon') && !event.target.closest('.nav-links')) {
        const dropdowns = document.getElementsByClassName("dropdown-innehall");
        for (let i = 0; i < dropdowns.length; i++) {
            dropdowns[i].classList.remove('visa');
        }
        // Stäng mobilmeny om öppen
        closeMobilMeny();
    }
};

// --- FILTER LOGIK ---
function uppdateraFilterStegCount() {
    // Toggle button count
    const toggleCount = document.getElementById('filter-toggle-count');
    if (toggleCount) {
        const total = valdaPizzerior.length + valdaIngredienser.length;
        toggleCount.textContent = total > 0 ? String(total) : '';
    }
}

function skapaFilterKnappar() {
    const pizzeriaLista = document.getElementById('pizzeria-lista');
    const omradeLista = document.getElementById('omrade-lista');
    const dropdownLista = document.getElementById('dropdown-lista');
    if (!pizzeriaLista || !omradeLista || !dropdownLista) return;
    
    const pizzerior = [...new Set(allaPizzor.map(p => p.pizzeria))].sort((a, b) => a.localeCompare(b, 'sv'));
    const omraden = [...new Set(allaPizzor.map(p => p.omrade))].filter(o => o).sort();
    const ingredienser = hamtaDynamiskaIngredienserFranData(allaPizzor);
    
    // Områden
    omradeLista.innerHTML = '';
    omraden.forEach(omrade => {
        const label = document.createElement('label');
        label.className = 'dropdown-item';
        label.onclick = (e) => e.stopPropagation();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = omrade;
        checkbox.onchange = () => valjOmrade(omrade, checkbox);
        const textSpan = document.createElement('span');
        textSpan.textContent = omrade;
        label.appendChild(checkbox);
        label.appendChild(textSpan);
        omradeLista.appendChild(label);
    });

    // Pizzerior
    pizzeriaLista.innerHTML = '';
    pizzerior.forEach(namn => {
        const label = document.createElement('label');
        label.className = 'dropdown-item';
        label.onclick = (e) => e.stopPropagation();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = namn;
        checkbox.onchange = () => togglaPizzeria(namn, checkbox);
        const textSpan = document.createElement('span');
        textSpan.textContent = namn;
        label.appendChild(checkbox);
        label.appendChild(textSpan);
        pizzeriaLista.appendChild(label);
    });

    // Ingredienser
    dropdownLista.innerHTML = '';
    const ingrediensSokWrap = document.createElement('div');
    ingrediensSokWrap.className = 'ingrediens-sok-wrap';
    const ingrediensSokInput = document.createElement('input');
    ingrediensSokInput.type = 'search';
    ingrediensSokInput.id = 'ingrediens-sok-input';
    ingrediensSokInput.className = 'ingrediens-sok-input';
    ingrediensSokInput.placeholder = 'Sök ingrediens...';
    ingrediensSokWrap.appendChild(ingrediensSokInput);
    dropdownLista.appendChild(ingrediensSokWrap);

    const ingrediensOptions = document.createElement('div');
    ingrediensOptions.className = 'ingrediens-options';
    dropdownLista.appendChild(ingrediensOptions);

    const tomResultat = document.createElement('p');
    tomResultat.id = 'ingrediens-sok-tomt';
    tomResultat.className = 'ingrediens-sok-tomt';
    tomResultat.textContent = 'Inga ingredienser matchar din sökning.';
    tomResultat.hidden = true;
    dropdownLista.appendChild(tomResultat);

    ingredienser.forEach(ingr => {
        const label = document.createElement('label');
        label.className = 'dropdown-item';
        label.dataset.ingrediens = ingr;
        label.onclick = (e) => e.stopPropagation();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = ingr;
        checkbox.onchange = () => togglaIngrediens(ingr, checkbox);
        const textSpan = document.createElement('span');
        textSpan.textContent = ingr;
        label.appendChild(checkbox);
        label.appendChild(textSpan);
        ingrediensOptions.appendChild(label);
    });

    ingrediensSokInput.addEventListener('input', () => {
        const term = normaliseraText(ingrediensSokInput.value);
        let synliga = 0;
        ingrediensOptions.querySelectorAll('.dropdown-item').forEach((label) => {
            const namn = normaliseraText(label.dataset.ingrediens || '');
            const visa = !term || namn.includes(term);
            label.classList.toggle('is-hidden', !visa);
            if (visa) synliga++;
        });
        tomResultat.hidden = synliga > 0;
    });

    konfigureraMobilVisaFler(omradeLista, 5);
    konfigureraMobilVisaFler(pizzeriaLista, 5);
    renderValdaIngrediensChips();
}



function registrerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    const arLokalMiljo = arLokalUtveckling();

    if (arLokalMiljo) {
        navigator.serviceWorker.getRegistrations()
            .then((regs) => Promise.all(regs.map((reg) => reg.unregister())))
            .catch(() => {});
        return;
    }

    navigator.serviceWorker
        .register('/service-worker.js', { scope: '/' })
        .catch((err) => {
            // Non-fatal — app works fine without SW, just not installable/offline.
            console.warn('Service worker kunde inte registreras:', err);
        });
}

// --- Aktiva filter chips ---
function initTangentbordsGenvag() {
    document.addEventListener('keydown', (e) => {
        if (e.key === '/') {
            const aktivtEl = document.activeElement;
            if (aktivtEl && (aktivtEl.tagName === 'INPUT' || aktivtEl.tagName === 'TEXTAREA' || aktivtEl.isContentEditable)) return;
            e.preventDefault();
            const sokruta = document.getElementById('sokruta');
            if (sokruta) { sokruta.focus(); sokruta.select(); }
        } else if (e.key === 'Escape') {
            document.querySelectorAll('.dropdown-innehall.visa').forEach(d => d.classList.remove('visa'));
        }
    });
}







function initToppKnapp() {
    const toppKnapp = document.getElementById('topp-knapp');
    if (!toppKnapp) return;

    // Normalize in case a page has mojibake characters in static HTML.
    toppKnapp.textContent = '▲';
    toppKnapp.title = 'Gå till toppen';

    let toppKnappScrollTimer = null;
    const visaVidScrollY = 300;

    const uppdateraToppKnapp = () => {
        const arMobil = window.matchMedia('(max-width: 768px)').matches;
        const skaVisa = window.scrollY > visaVidScrollY;

        if (arMobil) {
            toppKnapp.style.display = 'flex';
            toppKnapp.classList.toggle('is-visible', skaVisa);
            if (!skaVisa) {
                toppKnapp.classList.remove('is-scrolling');
            }
        } else {
            toppKnapp.classList.remove('is-visible', 'is-scrolling');
            toppKnapp.style.display = skaVisa ? 'block' : 'none';
            if (!skaVisa) {
                toppKnapp.classList.remove('scrollar');
            }
        }
    };

    window.addEventListener('scroll', () => {
        const arMobil = window.matchMedia('(max-width: 768px)').matches;

        if (window.scrollY <= visaVidScrollY) {
            if (arMobil) {
                toppKnapp.classList.remove('is-visible', 'is-scrolling');
            } else {
                toppKnapp.style.display = 'none';
                toppKnapp.classList.remove('scrollar');
            }
            return;
        }

        if (arMobil) {
            toppKnapp.style.display = 'flex';
            toppKnapp.classList.add('is-visible', 'is-scrolling');
        } else {
            toppKnapp.style.display = 'block';
            toppKnapp.classList.add('scrollar');
        }

        clearTimeout(toppKnappScrollTimer);
        toppKnappScrollTimer = setTimeout(() => {
            if (window.matchMedia('(max-width: 768px)').matches) {
                toppKnapp.classList.remove('is-scrolling');
            } else {
                toppKnapp.classList.remove('scrollar');
            }
        }, 180);
    }, { passive: true });

    window.addEventListener('resize', uppdateraToppKnapp);
    uppdateraToppKnapp();
    toppKnapp.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
}




// tillbaka till föregående sida efter cookies
function goBack() {
  if (window.history.length > 1) {
    history.back();
  } else {
    window.location.href = "/";
  }     
}

// ============================================================
//  KATEGORI STRIP SCROLL ARROWS
//  Desktop only (≥1024px). Shows left/right arrow buttons
//  only when the chip strip overflows the container.
// ============================================================
function initStickyMobileCta() {
    const root = document.getElementById('pizzeria-sida-root');
    const stickyCta = document.querySelector('.sticky-mobile-cta');
    if (!root || !stickyCta) return;

    let scrollDimTimer = null;

    const visaVidScroll = () => {
        const arMobil = window.matchMedia('(max-width: 768px)').matches;
        const skaVisa = arMobil && window.scrollY > 150;
        stickyCta.classList.toggle('is-visible', skaVisa);

        if (skaVisa) {
            stickyCta.classList.add('is-scrolling');
            clearTimeout(scrollDimTimer);
            scrollDimTimer = setTimeout(() => {
                stickyCta.classList.remove('is-scrolling');
            }, 180);
        }
    };

    window.addEventListener('scroll', visaVidScroll, { passive: true });
    window.addEventListener('resize', visaVidScroll);
    visaVidScroll();
}


// APP BOOTSTRAP - delade funktioner (alla sidor)
window.addEventListener("load", function() {
    uppdateraInternaLankarForLokalUtveckling();
    initToppKnapp();
    initSchemaGenerellSida();
    initTangentbordsGenvag();
    gtmInitNavbarTracking();
    gtmInitPizzaKortTracking();
    initPizzaKortNavigering();
    window.addEventListener('scroll', gtmTrackScrollDjup);
    gtmTrackScrollDjup();
    registrerServiceWorker();
    initStickyMobileCta();
});
