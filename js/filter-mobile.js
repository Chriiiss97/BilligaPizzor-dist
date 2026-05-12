// Mobile-specific filter UI extracted from shared.js
// Loaded after shared.js so these definitions become source-of-truth during migration.

function uppdateraMobilRensaKnappSynlighet() {
    const statusRad = document.getElementById('mobil-status-rad');
    if (!statusRad) return;

    const arKompaktViewport = window.matchMedia('(max-width: 1024px)').matches;
    if (!arKompaktViewport) {
        statusRad.classList.remove('visa-rensa');
        return;
    }

    const sokruta = document.getElementById('sokruta');
    const prisSortering = document.getElementById('pris-sortering');

    const harSoktext = (sokruta?.value || '').trim() !== '';
    const harKategoriFilter = aktivaKategorier.size > 0;
    const harPrisFilter = aktivtPrisFiltreMin !== null || aktivtPrisFiltreMax !== null;
    const harSortering = (prisSortering?.value || 'standard') !== 'standard';
    const harNarmast = isNearbyActive;

    const skaVisaRensaKnapp = harSoktext || harKategoriFilter || harPrisFilter || harSortering || harNarmast;
    statusRad.classList.toggle('visa-rensa', skaVisaRensaKnapp);
}

function uppdateraMobilScrollHint(arScrollar = false) {
    const hint = document.getElementById('mobil-scroll-hint');
    if (!hint) return;

    const arMobil = window.matchMedia('(max-width: 768px)').matches;
    if (!arMobil || !mobilScrollHintEfterVisaFler) {
        hint.classList.add('dold');
        hint.classList.remove('scrollar');
        return;
    }

    const forstaPizzaKort = document.querySelector('#resultat-lista .pizza-kort');
    const pizzorSyns = !!forstaPizzaKort && (() => {
        const rect = forstaPizzaKort.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
    })();

    if (pizzorSyns) {
        hint.classList.add('dold');
        hint.classList.remove('scrollar');
        return;
    }

    hint.classList.remove('dold');
    hint.classList.toggle('scrollar', arScrollar);
}
