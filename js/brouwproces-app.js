/* =====================================================================
   Brouwerij Rolduc — De Brouwreis: de app-schil

     1. Startscherm (attract mode) met leeftijdsbevestiging. Gebruikt
        dezelfde sleutel als de hoofdsite (ageVerificationDate, 24 uur).
     2. Onboarding "Hoe werkt deze reis?": bij de start en via de ?-knop
        in de HUD. Drie kaartjes; op een smal scherm veeg je ertussen.
     3. Nieuwe brouwronde: alles terug naar het startscherm. Via de knop
        aan het einde, in de game, of het logo in de HUD (met vraag).
     4. Proeflokaal-modus (brouwproces.html?modus=proeflokaal): geen
        links naar buiten, en na 2,5 minuut zonder aanraking eerst
        "Ben je er nog?" en daarna automatisch een nieuwe brouwronde.
        Uitzetten: brouwproces.html?modus=web
   ===================================================================== */

(function () {
    'use strict';

    var B = window.Brouw;
    if (!B) return;
    var html = document.documentElement;
    var start = document.getElementById('bp-start');
    var tour = document.getElementById('bp-tour');
    var resetDialoog = document.getElementById('bp-reset');
    var idleDialoog = document.getElementById('bp-idle');

    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    /* ==================================================================
       Proeflokaal-modus: links naar de website gaan uit
       ================================================================== */
    if (B.kiosk()) {
        document.querySelectorAll('a[data-extern]').forEach(function (a) {
            a.removeAttribute('href');
            a.setAttribute('aria-disabled', 'true');
        });
    }

    /* ==================================================================
       1. Startscherm
       ================================================================== */
    var actieveLaag = null;
    function laagOpen(el) { actieveLaag = el; }
    function laagDicht(el) { if (actieveLaag === el) actieveLaag = null; }

    function leeftijdBevestigd() {
        try {
            localStorage.setItem('ageVerified', 'true');
            localStorage.setItem('ageVerificationDate', new Date().toISOString());
        } catch (e) { /* niet kunnen onthouden is geen blokkade */ }
    }

    function sluitStart(daarna) {
        if (!html.classList.contains('is-start')) { if (daarna) daarna(); return; }
        leeftijdBevestigd();
        start.classList.add('is-weg');
        B.vergrendel(false);
        laagDicht(start);
        setTimeout(function () {
            html.classList.remove('is-start');
            start.classList.remove('is-weg');
            if (daarna) daarna();
        }, B.minderBeweging() ? 0 : 550);
    }

    /* QR op een etiket: ?bier=tripel. Het startscherm proost alvast met dat
       bier en op het einde staat het vooraan. (De game leest het zelf.) */
    var BIEREN = { blond: 'Rolduc Blond', dubbel: 'Rolduc Dubbel', tripel: 'Rolduc Tripel' };
    var bier = (new URLSearchParams(location.search).get('bier') || '').toLowerCase();
    if (BIEREN[bier]) {
        var chip = start.querySelector('[data-start-bier]');
        if (chip) { chip.querySelector('span').textContent = 'Je proost met een ' + BIEREN[bier]; chip.hidden = false; }
        var kaart = document.querySelector('.bp-einde__bieren [data-bier="' + bier + '"]');
        if (kaart) { var li = kaart.closest('li'); li.parentNode.insertBefore(li, li.parentNode.firstElementChild); }
    }

    // Heb je in de finale gebrouwen? Dan staat dat bier op het einde vooraan.
    var STIJLEN = { blond: 'Blond', dubbel: 'Dubbel', tripel: 'Tripel' };
    document.addEventListener('bp:spel-klaar', function (e) {
        var r = e.detail || {};
        var kaart = document.querySelector('.bp-einde__bieren [data-bier="' + r.recept + '"]');
        if (!kaart) return;
        document.querySelectorAll('.bp-bierkaart.is-gebrouwen').forEach(function (k) { k.classList.remove('is-gebrouwen'); });
        kaart.classList.add('is-gebrouwen');
        var li = kaart.closest('li');
        li.parentNode.insertBefore(li, li.parentNode.firstElementChild);
        var regel = document.querySelector('[data-gebrouwen]');
        if (regel) {
            regel.textContent = 'Jij brouwde een ' + (STIJLEN[r.recept] || r.kort || '') + ' (' + Math.round(r.score) + '%). Proef nu de echte!';
            regel.hidden = false;
        }
    });

    // De uitleg komt in het proeflokaal bij elke nieuwe gast, thuis alleen de eerste keer.
    var UITLEG = 'rolduc-brouwreis-uitleg';
    function uitlegNodig() {
        if (B.kiosk()) return true;
        try { return !localStorage.getItem(UITLEG); } catch (e) { return true; }
    }

    if (html.classList.contains('is-start')) {
        B.vergrendel(true);
        laagOpen(start);
        setTimeout(function () { var k = start.querySelector('[data-start-reis]'); if (k) k.focus({ preventScroll: true }); }, 400);
    }

    start.addEventListener('click', function (e) {
        if (e.target.closest('[data-start-reis]')) {
            B.geluid.speel('succes');
            sluitStart(function () {
                // Een #stap-6 uit de QR-code staat al klaar achter het startscherm.
                if (uitlegNodig()) openTour();
                else if (B.scenes) B.scenes.hintOpnieuw();
            });
        } else if (e.target.closest('[data-start-spel]')) {
            sluitStart(function () { if (B.scenes) B.scenes.ga('spel'); });
        } else if (e.target.closest('[data-te-jong]')) {
            start.querySelector('[data-te-jong-melding]').hidden = false;
            start.querySelector('[data-start-reis]').disabled = true;
            if (!B.kiosk()) setTimeout(function () { location.href = 'https://www.google.nl'; }, 4500);
            else setTimeout(function () { start.querySelector('[data-te-jong-melding]').hidden = true; start.querySelector('[data-start-reis]').disabled = false; }, 8000);
        }
    });

    /* ==================================================================
       2. Onboarding
       ================================================================== */
    var rij = tour.querySelector('[data-tour-rij]');
    var kaartjes = [].slice.call(tour.querySelectorAll('[data-tour-stap]'));
    var punten = [].slice.call(tour.querySelectorAll('[data-tour-punt]'));
    var volgende = tour.querySelector('[data-tour-volgende]');
    var huidig = 0, tourFocusTerug = null;

    function carrousel() { return window.matchMedia('(max-width: 759.98px)').matches; }
    function zetKaartje(i, scroll) {
        huidig = B.klem(i, 0, kaartjes.length - 1);
        punten.forEach(function (p, n) { p.setAttribute('aria-current', n === huidig ? 'true' : 'false'); });
        volgende.hidden = huidig === kaartjes.length - 1;
        if (scroll && carrousel()) rij.scrollTo({ left: huidig * rij.clientWidth, behavior: B.scrollGedrag() });
    }
    rij.addEventListener('scroll', function () {
        if (!carrousel()) return;
        var i = Math.round(rij.scrollLeft / Math.max(1, rij.clientWidth));
        if (i !== huidig) zetKaartje(i, false);
    }, { passive: true });
    punten.forEach(function (p, n) { p.addEventListener('click', function () { zetKaartje(n, true); }); });
    volgende.addEventListener('click', function () { zetKaartje(huidig + 1, true); B.geluid.speel('tik'); });

    function openTour() {
        if (!tour.hidden) return;
        tourFocusTerug = document.activeElement;
        B.tip.sluit(false);
        html.classList.add('is-tour');
        tour.hidden = false;
        tour.classList.remove('is-weg');
        B.vergrendel(true);
        laagOpen(tour);
        rij.scrollLeft = 0;
        zetKaartje(0, false);
        setTimeout(function () { tour.querySelector('[data-tour-klaar]').focus({ preventScroll: true }); }, 60);
    }
    function sluitTour() {
        if (tour.hidden) return;
        try { localStorage.setItem(UITLEG, '1'); } catch (e) { /* */ }
        tour.classList.add('is-weg');
        B.vergrendel(false);
        laagDicht(tour);
        html.classList.remove('is-tour');
        setTimeout(function () {
            tour.hidden = true;
            tour.classList.remove('is-weg');
        }, B.minderBeweging() ? 0 : 280);
        B.geluid.speel('klik');
        if (tourFocusTerug && tourFocusTerug.focus && document.body.contains(tourFocusTerug) && !start.contains(tourFocusTerug) && !tourFocusTerug.closest('[inert], #bp-lade')) {
            tourFocusTerug.focus({ preventScroll: true });
        } else if (B.scenes) {
            var sc = B.scenes.element();
            var kop = sc && sc.querySelector('[data-scene-kop]');
            if (kop) { kop.setAttribute('tabindex', '-1'); kop.focus({ preventScroll: true }); }
        }
        if (B.scenes) B.scenes.hintOpnieuw();
    }
    tour.querySelector('[data-tour-klaar]').addEventListener('click', sluitTour);
    var overslaan = tour.querySelector('[data-tour-klaar-stil]');
    if (overslaan) overslaan.addEventListener('click', sluitTour);
    document.addEventListener('click', function (e) {
        if (e.target.closest('[data-tour-open]')) {
            // Vanuit de stappenkiezer: eerst de lade dicht.
            if (B.lagen && B.lagen.open() === 'lade') B.lagen.sluitLade(openTour);
            else openTour();
            return;
        }
        var hand = e.target.closest('[data-linkshandig]');
        if (hand) {
            var links = !html.classList.contains('is-linkshandig');
            html.classList.toggle('is-linkshandig', links);
            hand.setAttribute('aria-pressed', links ? 'true' : 'false');
            try { if (links) localStorage.setItem('rolduc-brouwreis-hand', 'links'); else localStorage.removeItem('rolduc-brouwreis-hand'); } catch (x) { /* */ }
        }
    });

    /* ==================================================================
       3. Nieuwe brouwronde
       ================================================================== */
    function nieuweRonde() {
        // Herladen zet álles schoon op nul: proefjes, game, geluiden en geheugen.
        // Zonder #anker in de url begint de pagina met het startscherm.
        try { sessionStorage.setItem('bp-nieuwe-ronde', '1'); } catch (e) { /* */ }
        document.body.style.transition = 'opacity .3s';
        document.body.style.opacity = '0';
        setTimeout(function () {
            location.replace(location.pathname + location.search);
        }, B.minderBeweging() ? 0 : 280);
    }

    function openDialoog(d) {
        if (!d.hidden) return;
        d.hidden = false;
        B.vergrendel(true);
        laagOpen(d);
        setTimeout(function () { var k = d.querySelector('button'); if (k) k.focus({ preventScroll: true }); }, 50);
    }
    function sluitDialoog(d) {
        if (d.hidden) return;
        d.hidden = true;
        B.vergrendel(false);
        laagDicht(d);
    }

    document.addEventListener('click', function (e) {
        if (e.target.closest('[data-reset-nu]')) { nieuweRonde(); return; }
        if (e.target.closest('[data-reset-vraag]')) {
            if (B.lagen && B.lagen.open() === 'lade') B.lagen.sluitLade(function () { openDialoog(resetDialoog); });
            else openDialoog(resetDialoog);
            return;
        }
        var sluit = e.target.closest('[data-dialoog-sluit]');
        if (sluit) {
            var d = sluit.closest('.bp-dialoog');
            sluitDialoog(d);
            if (d === idleDialoog) idleStop();
        }
    });
    [resetDialoog, idleDialoog].forEach(function (d) {
        d.addEventListener('click', function (e) { if (e.target === d) { sluitDialoog(d); if (d === idleDialoog) idleStop(); } });
    });

    // Toetsenbord voor de app-lagen
    document.addEventListener('keydown', function (e) {
        if (!actieveLaag) return;
        if (e.key === 'Escape') {
            if (actieveLaag === tour) { e.preventDefault(); sluitTour(); }
            else if (actieveLaag === resetDialoog) { e.preventDefault(); sluitDialoog(resetDialoog); }
            else if (actieveLaag === idleDialoog) { e.preventDefault(); sluitDialoog(idleDialoog); idleStop(); }
            return;
        }
        B.houdFocus(actieveLaag, e);
    });

    /* ==================================================================
       4. Proeflokaal: automatisch opnieuw na inactiviteit
       ================================================================== */
    // Na hoeveel seconden zonder aanraking "Ben je er nog?" komt, en hoe lang
    // het aftellen duurt. (window.BP_STIL_SECONDEN is er alleen om te testen.)
    var STIL_SECONDEN = window.BP_STIL_SECONDEN || 150, AFTEL = window.BP_AFTEL || 20;
    var laatste = Date.now(), aftellen = null;
    function activiteit() { if (!aftellen) laatste = Date.now(); }
    function idleStop() { clearInterval(aftellen); aftellen = null; laatste = Date.now(); }

    if (B.kiosk()) {
        ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(function (t) {
            window.addEventListener(t, activiteit, { passive: true, capture: true });
        });
        setInterval(function () {
            if (aftellen || html.classList.contains('is-start')) return;
            if (Date.now() - laatste < STIL_SECONDEN * 1000) return;
            var video = document.querySelector('.bp-videomodal video');
            if (video && !video.paused) { laatste = Date.now(); return; }
            if (B.lagen && B.lagen.open()) { B.lagen.sluitLade(); B.lagen.sluitVideo(); }
            [resetDialoog].forEach(sluitDialoog);
            if (!tour.hidden) sluitTour();
            var tel = AFTEL;
            idleDialoog.querySelector('[data-idle-tel]').textContent = tel;
            openDialoog(idleDialoog);
            B.geluid.speel('tik');
            aftellen = setInterval(function () {
                tel -= 1;
                idleDialoog.querySelector('[data-idle-tel]').textContent = tel;
                if (tel <= 0) { clearInterval(aftellen); nieuweRonde(); }
            }, 1000);
        }, 1000);
    }

    B.app = { nieuweRonde: nieuweRonde, openTour: openTour };
})();
