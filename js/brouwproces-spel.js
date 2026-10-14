/* =====================================================================
   Brouwerij Rolduc — De Rolduc Brouwmeester (de Brouw Zelf-finale)

   Verloop
     Kies een recept (Blond, Dubbel, Tripel; zie js/brouwproces-data.js)
     Fase 1  Mout & schroot   storten (vasthouden), schroten (Stop!)
     Fase 2  Maischen         brander aan/uit binnen de temperatuurzone
     Fase 3  Hop              bitterhop en aromahop op het goede moment
     Fase 4  Gist & fles      gist erbij op temperatuur, bottelsuiker,
                              fles aftappen tot de vullijn
     Resultaat: je bier in een Rolduc-kelkglas, score, rang, proefnotitie
     en de vergelijking met het recept. Daarna "Proost!" naar het einde.

   Indeling (fase 3 van de app): elk spelscherm past in één scherm,
   zonder scrollen. Eén spelbord met een vaste schil:
     spelbalk   recept-chip · fase-ovalen · ander recept · ? (data-hulp)
     hoofd      podium (uitlees + illustratie) en bediening
     doelkaart  rechts (liggend), strook (staand) of sheet (telefoon)
     spel-dock  secundaire knoppen links, de gouden primaire actie
                altijd rechtsonder op dezelfde plek
   Uitleg- en uitslagkaarten liggen over het hoofd; hun knop is de
   primaire actie in het spel-dock.

   Het rekenmodel staat in bereken(): kleur via Morey, bitterheid via de
   Tinseth-tijdsfactor, alcohol als product van moutmenge,
   schrootrendement, maischtemperatuur en gisttemperatuur.

   Test-API: Brouw.spel.fases(), Brouw.spel.toon(fase) en
   Brouw.spel.pauze(). Wie het spel uitspeelt, krijgt het resultaat via
   Brouw.spel.resultaat() en het event 'bp:spel-klaar' op document.
   ===================================================================== */

(function () {
    'use strict';

    var B = window.Brouw, D = window.BROUWPROCES;
    var app = document.getElementById('bp-spel-app');
    if (!B || !D || !app) return;
    var G = B.geluid;
    var scherm = app.closest('[data-scene="spel"]') || app.parentElement;
    var BESTE = 'rolduc-brouwmeester-beste';
    var LAATSTE = 'rolduc-brouwmeester-laatste';

    var FASEN = [
        { n: 1, naam: 'Mout & schroot', kort: 'Mout' },
        { n: 2, naam: 'Maischen', kort: 'Maisch' },
        { n: 3, naam: 'Hop', kort: 'Hop' },
        { n: 4, naam: 'Gist & fles', kort: 'Gist' }
    ];
    var DELEN = ['kies', 'storten', 'schroten', 'maischen', 'hop', 'gist', 'suiker', 'aftappen', 'resultaat'];

    /* Terugval als de tips in brouwproces-data.js ontbreken. */
    D.hulp = D.hulp || {};
    D.hulp.kies = D.hulp.kies || {
        wat: 'Tik op het bier dat je wilt brouwen. Elke kaart toont de streefkleur (EBC), de bitterheid (IBU) en het alcoholpercentage.',
        waarom: 'Elk recept vraagt iets anders: een tripel wil meer mout en een lange bèta-rust, een dubbel donkere mout en meer body.'
    };
    D.hulp.resultaat = D.hulp.resultaat || {
        wat: 'Bekijk je glas, je score en de proefnotitie. Brouw nog eens, kies een ander recept of ga proosten.',
        waarom: 'Kleur, schuimkraag en helderheid van het glas volgen écht uit wat je in de vier fases deed.'
    };

    var S = null;                       // spelstatus
    var lus = null, timers = [], geluiden = [];
    var bord = null, hoofd = null, podium = null, bediening = null, doelkaart = null, dockEl = null;
    var laag = null;                    // open uitleg- of uitslagkaart
    var klok = false, pauze = null, wakeLock = null;
    var laatste = B.opslag.lees(LAATSTE, null);

    var urlBier = null;
    try { urlBier = (new URLSearchParams(location.search).get('bier') || '').toLowerCase(); } catch (e) { urlBier = null; }
    if (!urlBier || !D.recepten[urlBier]) urlBier = null;
    var keuzeId = urlBier || Object.keys(D.recepten)[0];

    /* ------------------------------------------------------------------
       Hulpjes
       ------------------------------------------------------------------ */
    function noop() { }
    function plan(t, ms) {
        t.eind = Date.now() + ms;
        t.id = setTimeout(function () {
            var i = timers.indexOf(t);
            if (i >= 0) timers.splice(i, 1);
            t.fn();
        }, ms);
    }
    function later(fn, ms) { var t = { fn: fn }; plan(t, ms); timers.push(t); return t; }
    function stopAlles() {
        if (lus) { lus.stop(); lus = null; }
        timers.forEach(function (t) { clearTimeout(t.id); }); timers = [];
        geluiden.slice().forEach(function (g) { g.stop(); }); geluiden = [];
        stopKlok();
        pauze = null;
        verbergPauze();
    }
    /* Een geluidslus die je kunt pauzeren en hervatten. */
    function geluidLus(naam) {
        var g = { naam: naam, echt: G.lus(naam) };
        g.stop = function () {
            if (g.echt) g.echt.stop();
            g.echt = null;
            var i = geluiden.indexOf(g);
            if (i >= 0) geluiden.splice(i, 1);
        };
        geluiden.push(g);
        return g;
    }
    function nieuweLus(stap) { if (lus) lus.stop(); lus = B.lus(stap, bord); lus.start(); return lus; }
    function tekst(el, t) { if (el && el.textContent !== t) el.textContent = t; }
    function rond(n) { return Math.round(n); }
    function stijl(t) { return t.replace(/\{stijl\}/g, S.recept.stijl); }
    function klein(t) { return t.toLowerCase(); }
    function benut(min) { return 1 - Math.exp(-0.04 * Math.max(0, min)); }
    function $(sel, binnen) { return (binnen || bord).querySelector(sel); }
    function scoreKlasse(s) { return s >= 80 ? 'is-goed' : s >= 50 ? 'is-matig' : 'is-fout'; }
    function inScene() {
        try { return !B.scenes || !B.scenes.huidig || B.scenes.huidig() === 'spel'; } catch (e) { return true; }
    }
    function zetFocus(el) {
        if (!el || !inScene()) return;
        try { el.focus({ preventScroll: true }); } catch (e) { /* oude browser */ }
    }
    function ga(id) { if (B.scenes && B.scenes.ga) B.scenes.ga(id); }

    /* ------------------------------------------------------------------
       Tijdgebonden fases: pauzeren (tabblad weg, scène verlaten) en het
       scherm wakker houden.
       ------------------------------------------------------------------ */
    function startKlok() { klok = true; vraagWakeLock(); }
    function stopKlok() { klok = false; laatWakeLockLos(); }
    function vraagWakeLock() {
        if (wakeLock || !navigator.wakeLock || document.hidden) return;
        wakeLock = 'bezig';
        navigator.wakeLock.request('screen').then(function (l) {
            if (!klok || wakeLock !== 'bezig') { l.release().catch(noop); if (wakeLock === 'bezig') wakeLock = null; return; }
            wakeLock = l;
            l.addEventListener('release', function () { if (wakeLock === l) wakeLock = null; });
        }, function () { if (wakeLock === 'bezig') wakeLock = null; });
    }
    function laatWakeLockLos() {
        var l = wakeLock;
        wakeLock = null;
        if (l && l !== 'bezig' && l.release) l.release().catch(noop);
    }
    function pauzeer() {
        if (!klok || pauze || !bord) return;
        var nu = Date.now();
        pauze = {
            lus: lus && lus.loopt() ? lus : null,
            timers: timers.map(function (t) { clearTimeout(t.id); t.rest = Math.max(0, t.eind - nu); return t; })
        };
        if (pauze.lus) pauze.lus.stop();
        geluiden.forEach(function (g) { if (g.echt) { g.echt.stop(); g.echt = null; } });
        laatWakeLockLos();
        toonPauze();
    }
    function hervat() {
        if (!pauze) return;
        var p = pauze;
        pauze = null;
        verbergPauze();
        p.timers.forEach(function (t) { if (timers.indexOf(t) >= 0) plan(t, t.rest); });
        geluiden.forEach(function (g) { if (!g.echt) g.echt = G.lus(g.naam); });
        if (p.lus) p.lus.start();
        if (klok) vraagWakeLock();
        G.speel('klik');
    }
    function toonPauze() {
        var el = bord && $('[data-pauze]');
        if (!el) return;
        el.hidden = false;
        B.tip.sluit(false);
        zetFocus($('[data-hervat]'));
        B.melding('Gepauzeerd. Tik op Verder brouwen om door te gaan.');
    }
    function verbergPauze() {
        var el = bord && bord.querySelector('[data-pauze]');
        if (el) el.hidden = true;
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) pauzeer(); });

    /* ------------------------------------------------------------------
       Rekenmodel
       ------------------------------------------------------------------ */
    function kleurScore(ebc, doel) { return ebc <= 0 ? 0 : 100 * B.klem(1 - Math.abs(Math.log(ebc / doel)) / Math.log(2.2), 0, 1); }
    function bijna(v, doel, marge) { return 100 * B.klem(1 - Math.abs(v - doel) / marge, 0, 1); }

    function schrootScore(f) {
        if (f == null) return 0;
        if (f >= 42 && f <= 62) return 100 - Math.abs(f - 52) * 1.5;
        if (f < 42) return 85 * B.klem((f - 8) / 34, 0, 1);
        return 85 * B.klem((100 - f) / 38, 0, 1);
    }
    function rendement(f) {
        if (f >= 42 && f <= 62) return 1;
        if (f < 42) return 0.62 + 0.38 * f / 42;
        return 1 - (f - 62) / 38 * 0.2;
    }
    function gistScore(t) {
        if (t == null) return 0;
        if (t >= 18 && t <= 24) return 100;
        if (t > 24) return t <= 30 ? 100 - (t - 24) * 10 : Math.max(0, 40 - (t - 30) * 3);
        return t >= 14 ? 100 - (18 - t) * 12 : Math.max(0, 52 - (14 - t) * 8);
    }
    function gistFactor(t) {
        if (t >= 18 && t <= 24) return 1;
        if (t > 24) return t <= 30 ? 1 - (t - 24) * 0.008 : 0.952 - (t - 30) * 0.01;
        return 1 - (18 - t) * 0.012;
    }
    function suikerScore(n) { var d = Math.abs(n - S.recept.suiker); return d === 0 ? 100 : d === 1 ? 60 : d === 2 ? 20 : 0; }
    function vulScore(v) {
        if (v == null) return 0;
        if (v > 100) return 12;
        if (v >= 88 && v <= 94) return 100;
        var afstand = v < 88 ? 88 - v : v - 94;
        return Math.max(0, 100 - afstand * 7);
    }

    function bereken() {
        var r = S.recept, m = S.mout;
        var kg = m.pils + m.karamel + m.chocolade;
        var ebc = B.moutEbc(m, 100);
        var uit = { kg: kg, ebc: ebc };
        uit.kleur = kleurScore(ebc, r.ebc);
        uit.hoeveel = bijna(kg, r.moutKg, 0.35 * r.moutKg);
        uit.schroot = schrootScore(S.fijn);
        uit.p1 = 0.4 * uit.kleur + 0.25 * uit.hoeveel + 0.35 * uit.schroot;

        var ma = S.maisch;
        uit.p2 = ma.gescoord ? 100 * B.klem(ma.inZone / ma.gescoord, 0, 1) : 0;

        var h = S.hop, ibu = 0;
        if (h.bitter != null) ibu += r.ibu * benut(h.bitter) / benut(60);
        if (h.aroma != null) ibu += r.ibu * 0.15 * benut(h.aroma) / benut(60);
        uit.ibu = ibu;
        uit.bitter = bijna(ibu, r.ibu, 0.6 * r.ibu);
        uit.aroma = h.aroma == null ? 0 : (h.aroma <= 5.5 ? 100 : (h.aroma <= 15 ? 100 - (h.aroma - 5.5) * 6.3 : Math.max(10, 40 - (h.aroma - 15))));
        uit.p3 = 0.55 * uit.bitter + 0.45 * uit.aroma;

        uit.gist = gistScore(S.gistTemp);
        uit.suiker = suikerScore(S.suiker);
        uit.vul = vulScore(S.vulling);
        uit.p4 = 0.4 * uit.gist + 0.3 * uit.suiker + 0.3 * uit.vul;

        var fermentatie = 0.82 + 0.18 * uit.p2 / 100;
        uit.abv = r.abv * B.klem(kg / r.moutKg, 0.2, 1.7) * (S.fijn == null ? 1 : rendement(S.fijn)) * fermentatie * (S.gistTemp == null ? 1 : gistFactor(S.gistTemp));
        uit.abvScore = bijna(uit.abv, r.abv, 0.3 * r.abv);

        // Schuimkraag: koolzuur, hopbitterheid (iso-alfazuren houden schuim vast),
        // eiwit en body uit het maischen en een nette vulling.
        uit.schuim = S.suiker === 0 ? 3 : 6 + 30 * (0.45 * uit.suiker + 0.25 * uit.bitter + 0.2 * uit.p2 + 0.1 * uit.vul) / 100;
        uit.spuiter = S.suiker / r.suiker >= 1.5;
        uit.troebel = (S.fijn != null && S.fijn > 70) || (ma.gescoord && ma.teKoud / ma.gescoord > 0.3);

        uit.totaal = rond(0.7 * (uit.p1 + uit.p2 + uit.p3 + uit.p4) / 4 + 0.3 * (uit.kleur + uit.bitter + uit.abvScore) / 3);
        return uit;
    }

    /* ------------------------------------------------------------------
       Proefnotitie van de hoofdbrouwer
       ------------------------------------------------------------------ */
    function proefnotitie(u) {
        var N = D.notities, r = S.recept;
        var pijnen = [];
        function pijn(sleutel, ernst) { pijnen.push({ s: sleutel, e: ernst }); }
        if (u.kleur < 70) pijn(u.ebc > r.ebc ? 'teDonker' : 'teLicht', 100 - u.kleur);
        if (u.hoeveel < 70) pijn(u.kg < r.moutKg ? 'teWeinigMout' : 'teVeelMout', 100 - u.hoeveel);
        if (S.fijn < 42) pijn('teGrof', 100 - u.schroot);
        else if (S.fijn > 62) pijn('poeder', 100 - u.schroot);
        if (u.p2 < 70) pijn(S.maisch.teHeet >= S.maisch.teKoud ? 'teHeet' : 'teKoud', 100 - u.p2);
        if (S.hop.bitter == null) pijn('geenBitter', 90);
        else if (S.hop.bitter < 50) pijn('bitterTeLaat', 100 - u.bitter);
        if (S.hop.aroma == null) pijn('geenAroma', 60);
        else if (S.hop.aroma > 8) pijn('aromaTeVroeg', 100 - u.aroma);
        if (S.gistTemp > 26) pijn('gistTeHeet', 100 - u.gist);
        else if (S.gistTemp < 16) pijn('gistTeKoud', 100 - u.gist);
        if (S.suiker > r.suiker) pijn('teVeelSuiker', S.suiker - r.suiker >= 2 ? 85 : 40);
        else if (S.suiker < r.suiker) pijn('teWeinigSuiker', r.suiker - S.suiker >= 2 ? 80 : 40);
        if (u.vul < 70) pijn('vulling', 100 - u.vul);
        pijnen.sort(function (a, b) { return b.e - a.e; });

        var fasen = [['mout', u.p1], ['maisch', u.p2], ['hop', u.p3], ['gist', u.p4]].sort(function (a, b) { return b[1] - a[1]; });
        var lof = fasen[0][1] >= 85 ? N.lof[fasen[0][0]] : null;
        var ergste = pijnen.length && pijnen[0].e >= 25 ? N.pijn[pijnen[0].s] : null;

        var band = u.totaal >= 90 ? 90 : u.totaal >= 75 ? 75 : u.totaal >= 55 ? 55 : u.totaal >= 35 ? 35 : 0;
        var opening = B.kies(N.opening[band]);
        var slot = B.kies(N.slot[u.totaal >= 75 ? 'hoog' : u.totaal >= 50 ? 'midden' : 'laag']);

        // De opening mag op een kort scherm wegvallen; de kern blijft altijd staan.
        var kern;
        if (ergste && lof) { kern = ergste.kort + ', maar ' + lof.kort + '! ' + slot; opening = ''; }
        else if (ergste) kern = ergste.lang + ' ' + slot;
        else if (lof) kern = lof.lang + ' ' + slot;
        else kern = slot;

        var extra = pijnen.slice(ergste ? 1 : 0, ergste ? 3 : 2).filter(function (p) { return p.e >= 25; }).map(function (p) { return N.pijn[p.s].lang; });
        return { opening: stijl(opening), kern: stijl(kern), hoofd: stijl((opening ? opening + ' ' : '') + kern), extra: extra.map(stijl) };
    }

    function rang(score) {
        for (var i = 0; i < D.rangen.length; i++) if (score >= D.rangen[i].vanaf) return D.rangen[i].titel;
        return D.rangen[D.rangen.length - 1].titel;
    }

    /* ------------------------------------------------------------------
       Bouwstenen
       ------------------------------------------------------------------ */
    function glasIcoon(ebc, kl) {
        var id = B.uniekId('mini');
        return '<svg class="bp-miniglas' + (kl ? ' bp-miniglas--klein' : '') + '" viewBox="0 0 40 56" aria-hidden="true">' +
            '<defs><clipPath id="' + id + '"><path d="M8 4H32C32 22 27 32 20 32C13 32 8 22 8 4Z"/></clipPath></defs>' +
            '<g clip-path="url(#' + id + ')"><rect x="4" y="9" width="32" height="26" fill="' + B.ebcNaarKleur(ebc) + '"/><rect x="4" y="2" width="32" height="8" fill="' + B.schuimKleur(ebc) + '"/></g>' +
            '<path d="M8 4H32C32 22 27 32 20 32C13 32 8 22 8 4ZM20 32V46M12 50C12 46 28 46 28 50C28 52 12 52 12 50Z" fill="none" stroke="#EDE0A2" stroke-width="1.6" stroke-linejoin="round"/>' +
            '</svg>';
    }
    function schijf(score, extraKlasse, attr) {
        return '<div class="bp-schijf ' + scoreKlasse(score) + (extraKlasse ? ' ' + extraKlasse : '') + '" style="--s:' + (attr ? 0 : (score / 100).toFixed(2)) + '"' + (attr || '') + '>' +
            '<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34"/><circle class="bp-schijf__boog" cx="40" cy="40" r="34" pathLength="1"/></svg>' +
            '<span' + (attr ? ' data-eindscore' : '') + '>' + (attr ? 0 : score) + '<small>%</small></span></div>';
    }

    /* Het bord: één doos die het hele spelvlak vult. */
    function bordOpen(soort, html) {
        B.tip.sluit(false);
        laag = null;
        app.innerHTML = '<div class="bp-spelbord" data-spelbord data-scherm="' + soort + '" data-eigen-gebaar>' + html + '</div>';
        bord = app.firstElementChild;
        hoofd = podium = bediening = doelkaart = null;
        dockEl = $('[data-spel-dock]');
        scherm.classList.toggle('is-bezig', soort !== 'kies');
        scherm.setAttribute('data-spel-fase', soort === 'kies' ? 'kies' : soort === 'resultaat' ? 'resultaat' : '1');
        bord.addEventListener('click', klikInBord);
        bord.addEventListener('keydown', function (e) {
            var p = bord.querySelector('[data-pauze]');
            if (p && !p.hidden) { if (B.houdFocus) B.houdFocus(p, e); return; }
            if (!sheetOpen()) return;
            if (e.key === 'Escape') { e.stopPropagation(); sluitSheet(true); }
            else if (B.houdFocus) B.houdFocus(bord.querySelector('.bp-doelsheet__paneel'), e);
        });
        return bord;
    }
    function klikInBord(e) {
        var k = e.target.closest('button');
        if (!k || !bord.contains(k)) return;
        if (k.hasAttribute('data-herstart')) { sluitSheet(false); stopAlles(); G.speel('tak'); toonKeuze(); zetFocus($('[data-primair]')); return; }
        if (k.hasAttribute('data-doelknop')) { openSheet(); return; }
        if (k.hasAttribute('data-doelsheet-dicht')) { sluitSheet(true); return; }
        if (k.hasAttribute('data-hervat')) { hervat(); return; }
    }

    function balkHtml() {
        var r = S.recept;
        return '<div class="bp-spelbord__balk">' +
            '<p class="bp-spelchip bp-spelchip--label">' + glasIcoon(r.ebc, true) + '<span><small>Je brouwt</small><b>' + r.kort + '</b></span></p>' +
            '<button type="button" class="bp-spelchip bp-spelchip--knop" data-doelknop aria-haspopup="dialog" aria-expanded="false" aria-label="Recept-doel van de ' + r.kort + ' bekijken">' +
                glasIcoon(r.ebc, true) + '<b>' + r.kort + '</b><i class="fas fa-bullseye" aria-hidden="true"></i></button>' +
            '<ol class="bp-fasen" aria-label="Fases van het spel">' +
                FASEN.map(function (f) { return '<li data-fase-nr="' + f.n + '"><span class="bp-fasen__nr logo-font">' + f.n + '</span><span class="bp-fasen__naam">' + f.naam + '</span></li>'; }).join('') +
            '</ol>' +
            '<button type="button" class="bp-spelbord__ander" data-herstart aria-label="Ander recept kiezen"><i class="fas fa-rotate-left" aria-hidden="true"></i><span>Ander recept</span></button>' +
            '<button type="button" class="bp-spelbord__hulp" data-hulp="storten" aria-expanded="false" aria-label="Tip van de brouwer bij deze fase">?</button>' +
        '</div>';
    }
    function sheetHtml() {
        return '<div class="bp-doelsheet" data-doelsheet hidden>' +
            '<div class="bp-doelsheet__achter" data-doelsheet-achter></div>' +
            '<div class="bp-doelsheet__paneel" role="dialog" aria-modal="true" aria-labelledby="bp-doelsheet-titel" tabindex="-1">' +
                '<div class="bp-doelsheet__kop">' +
                    '<p class="bp-doelsheet__titel" id="bp-doelsheet-titel"><i class="fas fa-bullseye" aria-hidden="true"></i> Recept-doel · ' + S.recept.kort + '</p>' +
                    '<button type="button" class="bp-doelsheet__dicht" data-doelsheet-dicht aria-label="Sluiten"><i class="fas fa-xmark" aria-hidden="true"></i></button>' +
                '</div>' +
                '<div class="bp-doelkaart bp-doelkaart--sheet" data-doelkaart-sheet></div>' +
                '<button type="button" class="bp-knop bp-knop--licht bp-doelsheet__ander" data-herstart><i class="fas fa-rotate-left bp-knop__icoon" aria-hidden="true"></i> Ander recept</button>' +
            '</div>' +
        '</div>';
    }
    function pauzeHtml() {
        return '<div class="bp-spelbord__pauze" data-pauze hidden>' +
            '<div class="bp-pauzekaart" role="dialog" aria-modal="true" aria-labelledby="bp-pauze-titel">' +
                '<p class="bp-pauzekaart__titel logo-font" id="bp-pauze-titel">Gepauzeerd</p>' +
                '<p class="bp-pauzekaart__tekst">Je brouwsel wacht netjes op je.</p>' +
                '<button type="button" class="bp-knop bp-knop--goud bp-knop--groot" data-hervat><i class="fas fa-play bp-knop__icoon" aria-hidden="true"></i> Verder brouwen</button>' +
            '</div>' +
        '</div>';
    }

    /* Spel-dock: secundaire knoppen links, de gouden primaire actie rechts.
       o = { links: [{ tekst, kort, icoon, label, actie, soort } | { hulp }],
             primair: { tekst, icoon, actie, uit, glans, pijl } } */
    function zetDock(o) {
        if (!dockEl) return null;
        var links = o.links || [];
        var html = '<div class="bp-spelbord__dock-links">' + links.map(function (k, i) {
            if (k.hulp) return '<button type="button" class="bp-spelbord__hulp" data-hulp="' + k.hulp + '" aria-expanded="false" aria-label="Tip van de brouwer">?</button>';
            var kort = k.kort == null ? k.tekst : k.kort;
            return '<button type="button" class="bp-spelknop' + (k.soort ? ' bp-spelknop--' + k.soort : '') + (kort ? '' : ' bp-spelknop--icoon') + '" data-dock-actie="' + i + '" aria-label="' + (k.label || k.tekst) + '">' +
                (k.icoon ? '<i class="fas ' + k.icoon + '" aria-hidden="true"></i>' : '') +
                '<span class="bp-spelknop__lang">' + k.tekst + '</span>' +
                (kort ? '<span class="bp-spelknop__kort">' + kort + '</span>' : '') +
            '</button>';
        }).join('') + '</div>';
        var p = o.primair;
        if (p) {
            html += '<button type="button" class="bp-knop bp-knop--goud bp-spelbord__primair' + (p.glans ? ' bp-knop-glans' : '') + '" data-primair' + (p.uit ? ' disabled' : '') + '>' +
                (p.icoon ? '<i class="fas ' + p.icoon + ' bp-knop__icoon" aria-hidden="true"></i>' : '') +
                '<span data-primair-tekst>' + p.tekst + '</span>' +
                (p.pijl === false ? '' : '<i class="fas fa-arrow-right bp-knop__icoon" aria-hidden="true"></i>') +
            '</button>';
        }
        dockEl.innerHTML = html;
        dockEl.querySelectorAll('[data-dock-actie]').forEach(function (k) {
            var item = links[+k.getAttribute('data-dock-actie')];
            k.addEventListener('click', function () { if (item.actie) item.actie(k); });
        });
        var knop = dockEl.querySelector('[data-primair]');
        if (knop && p.actie) knop.addEventListener('click', function () { if (!knop.disabled) p.actie(knop); });
        return knop;
    }

    /* Doelkaart: rechts (liggend), als strook (staand) of in de sheet (telefoon). */
    function doelHtml() {
        var r = S.recept, u = bereken();
        var heeftKleur = u.kg > 0;
        var heeftIbu = !!S.klaar[3];
        var heeftAbv = S.gistTemp != null;
        function rij(label, doel, jouw, staal) {
            return '<div class="bp-doel__rij">' +
                '<span class="bp-doel__label">' + label + '</span>' +
                '<span class="bp-doel__streef">' + (staal ? '<i style="background:' + B.ebcNaarKleur(r.ebc) + '"></i>' : '') + doel + '</span>' +
                '<span class="bp-doel__jouw' + (jouw == null ? ' is-leeg' : '') + '">' + (staal && jouw != null ? '<i style="background:' + B.ebcNaarKleur(u.ebc) + '"></i>' : '') + (jouw == null ? '–' : jouw) + '</span>' +
            '</div>';
        }
        return '<h3 class="bp-doel__kop"><i class="fas fa-bullseye" aria-hidden="true"></i> Recept-doel</h3>' +
            '<div class="bp-doel__tabel">' +
                '<div class="bp-doel__rij bp-doel__rij--kop"><span></span><span>Streef</span><span>Jouw bier</span></div>' +
                rij('Kleur', rond(r.ebc) + ' EBC', heeftKleur ? rond(u.ebc) + ' EBC' : null, true) +
                rij('Bitter', r.ibu + ' IBU', heeftIbu ? rond(u.ibu) + ' IBU' : null) +
                rij('Alcohol', B.getal(r.abv, 1) + '%', heeftAbv ? B.getal(u.abv, 1) + '%' : null) +
                rij('Mout', r.moutKg + ' kg', heeftKleur ? B.getal(u.kg, 1) + ' kg' : null) +
            '</div>' +
            '<ul class="bp-doel__fasen" aria-label="Score per fase">' +
                FASEN.map(function (f) {
                    var sc = S.klaar[f.n] ? rond(u['p' + f.n]) : null;
                    return '<li class="' + (sc == null ? '' : scoreKlasse(sc)) + '"><span>' + f.naam + '</span><b>' + (sc == null ? '–' : sc + '%') + '</b></li>';
                }).join('') +
            '</ul>';
    }
    function tekenDoelkaart() {
        if (!S || !bord) return;
        var html = doelHtml();
        [doelkaart, bord.querySelector('[data-doelkaart-sheet]')].forEach(function (el) {
            if (el && el.__html !== html) { el.innerHTML = html; el.__html = html; }
        });
    }

    /* Telefoon: de doeltabel achter de recept-chip. */
    function sheetOpen() { var s = bord && bord.querySelector('[data-doelsheet]'); return !!(s && !s.hidden); }
    function openSheet() {
        var s = $('[data-doelsheet]');
        if (!s) return;
        tekenDoelkaart();
        B.tip.sluit(false);
        s.hidden = false;
        var k = $('[data-doelknop]');
        if (k) k.setAttribute('aria-expanded', 'true');
        G.speel('zoef');
        zetFocus($('.bp-doelsheet__paneel'));
        s.querySelector('[data-doelsheet-achter]').onclick = function () { sluitSheet(true); };
    }
    function sluitSheet(focusTerug) {
        var s = bord && bord.querySelector('[data-doelsheet]');
        if (!s || s.hidden) return;
        s.hidden = true;
        var k = $('[data-doelknop]');
        if (k) { k.setAttribute('aria-expanded', 'false'); if (focusTerug) zetFocus(k); }
    }

    function zetFase(n) {
        if (!bord) return;
        scherm.setAttribute('data-spel-fase', String(n));
        bord.querySelectorAll('.bp-fasen li').forEach(function (li) {
            var f = +li.getAttribute('data-fase-nr');
            var klaar = n === 'klaar' || f < n;
            li.classList.toggle('is-actief', f === n);
            li.classList.toggle('is-klaar', klaar);
            if (f === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
        });
    }
    /* Welk deel speelt nu: bepaalt de tip van de brouwer achter de ?. */
    function zetDeel(naam) {
        if (!bord) return;
        bord.setAttribute('data-deel', naam);
        bord.querySelectorAll('.bp-spelbord__balk [data-hulp]').forEach(function (k) { k.setAttribute('data-hulp', naam); });
        B.tip.sluit(false);
    }

    /* ------------------------------------------------------------------
       Pas-in-ladder: past iets niet, dan stap voor stap compacter (nooit
       kleiner dan 14 px, lopende tekst op de telefoon 16 px).
       ------------------------------------------------------------------ */
    var PAS = ['pas-1', 'pas-2', 'pas-3'];
    /* Alleen de hoogte telt: de carrousel loopt op de telefoon bewust over de zijranden. */
    function loopOver(el) { return !!el && el.scrollHeight > el.clientHeight + 1; }
    /* Liggend staat de doelkaart boven het dock in dezelfde kolom: niet overlappen. */
    function overlapt(a, b) {
        if (!a || !b || !a.offsetParent || !b.offsetParent) return false;
        var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        return ra.bottom > rb.top + 1 && ra.top < rb.bottom && ra.right > rb.left && ra.left < rb.right;
    }
    function pastNiet() {
        if (!bord) return false;
        var soort = bord.getAttribute('data-scherm');
        if (loopOver(bord)) return true;
        if (soort === 'fase') return loopOver(hoofd) || loopOver(podium) || loopOver(bediening) || overlapt(doelkaart, dockEl);
        if (soort === 'resultaat') return loopOver($('[data-res]'));
        if (soort === 'kies') return loopOver($('[data-keuze]'));
        return false;
    }
    function pasIn() {
        if (!bord || !bord.isConnected) return;
        PAS.forEach(function (k) { bord.classList.remove(k); });
        var i = 0;
        while (pastNiet() && i < PAS.length) bord.classList.add(PAS[i++]);
        if (pastNiet()) waarschuw(bord.getAttribute('data-scherm') + (bord.getAttribute('data-deel') ? ' (' + bord.getAttribute('data-deel') + ')' : ''));
        if (laag) pasKaart(laag);
    }
    function pasKaart(l) {
        var kaart = l.querySelector('.bp-uitleg__kaart');
        if (!kaart || !l.clientHeight) return;
        PAS.forEach(function (k) { kaart.classList.remove(k); });
        var ruimte = function () { return l.clientHeight - 16; };
        var i = 0;
        while (kaart.offsetHeight > ruimte() && i < PAS.length) kaart.classList.add(PAS[i++]);
        if (kaart.offsetHeight > ruimte() + 8) waarschuw('kaart ' + (bord && bord.getAttribute('data-deel')));
    }
    function waarschuw(wat) {
        if (window.console && console.warn) console.warn('[past niet] spel ' + wat + ' op ' + window.innerWidth + '×' + window.innerHeight);
    }
    var pasTimer = 0;
    function pasStraks() { clearTimeout(pasTimer); pasTimer = setTimeout(pasIn, 120); }
    window.addEventListener('resize', pasStraks);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', pasStraks);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(pasStraks);

    /* ------------------------------------------------------------------
       Uitleg- en uitslagkaart over het hoofd. De knop zit in het dock.
       ------------------------------------------------------------------ */
    function toonLaag(html, o) {
        sluitLaag(false);
        var el = B.maak('<div class="bp-uitleg' + (o.uitslag ? ' bp-uitleg--uitslag' : '') + '">' + html + '</div>');
        hoofd.appendChild(el);
        hoofd.classList.add('heeft-uitleg');
        // Wat onder de kaart ligt, doet even niet mee (en wordt niet voorgelezen).
        [podium, bediening].forEach(function (d) { if (d) d.setAttribute('inert', ''); });
        laag = el;
        pasKaart(el);
        var knop = zetDock({
            primair: {
                tekst: o.knop, icoon: o.icoon, glans: true,
                actie: function () { sluitLaag(true); G.speel('klik'); o.bij(); }
            }
        });
        later(function () { zetFocus(knop); }, 60);
        return el;
    }
    function sluitLaag(anim) {
        if (!laag) return;
        var el = laag;
        laag = null;
        if (hoofd) hoofd.classList.remove('heeft-uitleg');
        [podium, bediening].forEach(function (d) { if (d) d.removeAttribute('inert'); });
        if (anim && !B.minderBeweging()) { el.classList.add('is-weg'); setTimeout(function () { el.remove(); }, 300); }
        else el.remove();
    }
    function uitleg(o) {
        toonLaag(
            '<div class="bp-uitleg__kaart" role="group" aria-labelledby="bp-uitleg-titel">' +
                '<div class="bp-uitleg__fase">' + o.fase + '</div>' +
                '<h3 class="bp-uitleg__titel logo-font" id="bp-uitleg-titel">' + o.titel + '</h3>' +
                '<div class="bp-uitleg__tekst">' + o.tekst + '</div>' +
                (o.doel ? '<p class="bp-uitleg__doel"><i class="fas fa-bullseye" aria-hidden="true"></i><span>' + o.doel + '</span></p>' : '') +
            '</div>', o);
    }
    function uitslag(o) {
        var score = rond(o.score);
        toonLaag(
            '<div class="bp-uitleg__kaart" role="group" aria-label="Tussenstand">' +
                schijf(score) +
                '<h3 class="bp-uitleg__titel">' + o.titel + '</h3>' +
                '<div class="bp-uitleg__tekst">' + o.tekst + '</div>' +
                (o.lijst ? '<div class="bp-uitslag__lijst">' + o.lijst.map(function (x) { return '<span>' + x[0] + ' <b>' + x[1] + '</b></span>'; }).join('') + '</div>' : '') +
            '</div>', { uitslag: true, knop: o.knop, bij: o.bij });
        G.speel(score >= 80 ? 'succes' : score >= 50 ? 'tak' : 'fout');
        if (score >= 80) B.trillen(20);
        B.melding(o.titel + ': ' + score + ' procent. ' + o.tekst.replace(/<[^>]+>/g, ''));
        tekenDoelkaart();
    }

    /* ==================================================================
       KEUZE: welk bier ga je brouwen?
       ================================================================== */
    function volgorde() {
        var ids = Object.keys(D.recepten);
        if (urlBier) ids = [urlBier].concat(ids.filter(function (id) { return id !== urlBier; }));
        return ids;
    }
    function receptKaart(id, beste) {
        var r = D.recepten[id];
        return '<li><button type="button" class="bp-receptkaart' + (id === keuzeId ? ' is-gekozen' : '') + '" data-recept="' + id + '">' +
            '<span class="bp-receptkaart__glas">' + glasIcoon(r.ebc) + '</span>' +
            '<span class="bp-receptkaart__kop"><span class="bp-receptkaart__naam logo-font">' + r.kort + '</span>' +
            '<span class="bp-receptkaart__echt">' + r.naam + '</span></span>' +
            '<span class="bp-receptkaart__tekst">' + r.omschrijving + '</span>' +
            '<span class="bp-receptkaart__doelen">' +
                '<span><small>kleur (EBC)</small><b><i style="background:' + B.ebcNaarKleur(r.ebc) + '"></i>' + r.ebc + '</b></span>' +
                '<span><small>bitter (IBU)</small><b>' + r.ibu + '</b></span>' +
                '<span><small>alcohol</small><b>' + B.getal(r.abv, 1) + '%</b></span>' +
            '</span>' +
            (beste[id] != null ? '<span class="bp-receptkaart__beste"><i class="fas fa-trophy" aria-hidden="true"></i> Jouw beste: ' + beste[id] + '%</span>' : '') +
            '<span class="bp-receptkaart__kies">Brouw deze <i class="fas fa-arrow-right" aria-hidden="true"></i></span>' +
        '</button></li>';
    }
    function toonKeuze() {
        stopAlles();
        S = null;
        var beste = B.opslag.lees(BESTE, {}) || {};
        var ids = volgorde();
        bordOpen('kies',
            '<div class="bp-keuze" data-keuze>' +
                '<p class="bp-keuze__intro"><span class="bp-keuze__lang">Kies welk Rolduc-bier je wilt brouwen. Elk recept heeft een eigen kleur, bitterheid en alcoholpercentage. In vier fases zet je alles wat je onderweg leerde in de praktijk.</span>' +
                '<span class="bp-keuze__kort">Kies je bier en brouw het in vier fases.</span></p>' +
                '<ul class="bp-keuze__recepten" data-recepten data-eigen-gebaar data-mag-afknippen aria-label="Recepten">' +
                    ids.map(function (id) { return receptKaart(id, beste); }).join('') +
                '</ul>' +
                '<div class="bp-keuze__stippen" aria-hidden="true">' + ids.map(function (id) { return '<i data-stip="' + id + '"></i>'; }).join('') + '</div>' +
                '<ol class="bp-keuze__fasen" aria-label="De vier fases">' +
                    FASEN.map(function (f) { return '<li><span class="bp-keuze__nr logo-font">' + f.n + '</span><span class="bp-keuze__fasenaam">' + f.naam + '</span><span class="bp-keuze__fasekort">' + f.kort + '</span></li>'; }).join('') +
                '</ol>' +
            '</div>' +
            '<div class="bp-spelbord__dock" data-spel-dock></div>');
        zetDeel('kies');
        zetDock({
            links: [
                { tekst: 'Terug naar stap 9', kort: 'Stap 9', icoon: 'fa-arrow-left', soort: 'tekst', actie: function () { G.speel('tik'); ga('9a'); } },
                { hulp: 'kies' }
            ],
            primair: { tekst: 'Brouw de ' + D.recepten[keuzeId].kort, actie: function () { start(keuzeId); } }
        });
        var lijst = $('[data-recepten]');
        lijst.querySelectorAll('[data-recept]').forEach(function (k) {
            k.addEventListener('click', function () { start(k.getAttribute('data-recept')); });
        });
        // Telefoon: carrousel. De kaart in het midden is de keuze.
        var scrollTimer = 0;
        lijst.addEventListener('scroll', function () {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(function () { kiesMidden(lijst); }, 90);
        }, { passive: true });
        requestAnimationFrame(function () { naarKaart(lijst, keuzeId); markeerKeuze(); pasIn(); });
    }
    function naarKaart(lijst, id) {
        if (!lijst || lijst.scrollWidth <= lijst.clientWidth + 1) return;
        var k = lijst.querySelector('[data-recept="' + id + '"]');
        if (!k) return;
        var lr = lijst.getBoundingClientRect(), kr = k.parentElement.getBoundingClientRect();
        lijst.scrollLeft += (kr.left + kr.width / 2) - (lr.left + lr.width / 2);
    }
    function kiesMidden(lijst) {
        if (!lijst.isConnected || lijst.scrollWidth <= lijst.clientWidth + 1) return;
        var midden = lijst.getBoundingClientRect().left + lijst.clientWidth / 2, beste = null, afstand = Infinity;
        lijst.querySelectorAll('li').forEach(function (li) {
            var r = li.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - midden);
            if (d < afstand) { afstand = d; beste = li; }
        });
        if (!beste) return;
        var id = beste.querySelector('[data-recept]').getAttribute('data-recept');
        if (id !== keuzeId) { keuzeId = id; markeerKeuze(); G.speel('tik'); }
    }
    function markeerKeuze() {
        if (!bord) return;
        bord.querySelectorAll('[data-recept]').forEach(function (k) { k.classList.toggle('is-gekozen', k.getAttribute('data-recept') === keuzeId); });
        bord.querySelectorAll('[data-stip]').forEach(function (s) { s.classList.toggle('is-actief', s.getAttribute('data-stip') === keuzeId); });
        tekst($('[data-primair-tekst]'), 'Brouw de ' + D.recepten[keuzeId].kort);
    }

    function nieuweStatus(id) {
        return {
            recept: D.recepten[id],
            mout: { pils: 0, karamel: 0, chocolade: 0 },
            fijn: null,
            maisch: { inZone: 0, gescoord: 0, teHeet: 0, teKoud: 0 },
            hop: { bitter: null, aroma: null },
            gistTemp: null,
            suiker: 0,
            vulling: null,
            klaar: {}
        };
    }
    function start(id) {
        stopAlles();
        keuzeId = id;
        S = nieuweStatus(id);
        schil();
        G.speel('succes');
        faseStorten();
    }

    /* De schil voor de fases. */
    function schil() {
        bordOpen('fase',
            balkHtml() +
            '<div class="bp-spelbord__hoofd" data-hoofd>' +
                '<div class="bp-podium" data-podium></div>' +
                '<div class="bp-bediening" data-bediening></div>' +
            '</div>' +
            '<aside class="bp-doelkaart" data-doelkaart aria-label="Recept-doel en jouw brouwsel"></aside>' +
            '<div class="bp-spelbord__dock" data-spel-dock></div>' +
            sheetHtml() + pauzeHtml());
        hoofd = $('[data-hoofd]');
        podium = $('[data-podium]');
        bediening = $('[data-bediening]');
        doelkaart = $('[data-doelkaart]');
    }
    /* Elke fase begint met een schone bediening en zonder klok. */
    function nieuweFase(fase, deel) {
        stopAlles();
        if (!bord || bord.getAttribute('data-scherm') !== 'fase') schil();
        sluitLaag(false);
        sluitSheet(false);
        zetFase(fase);
        zetDeel(deel);
        tekenDoelkaart();
    }
    function klaarVoor(fn) { requestAnimationFrame(function () { pasIn(); if (fn) fn(); }); }

    /* ==================================================================
       FASE 1a — Mout storten
       ================================================================== */
    var ZAK_X = { pils: 110, karamel: 180, chocolade: 250 };
    function zak(k, label) {
        return '<g class="bp-zak" data-zak="' + k + '" transform="translate(' + ZAK_X[k] + ' 8)">' +
            '<path class="bp-zak__straal" d="M0 52V150"/>' +
            '<g class="bp-zak__kantel">' +
                '<path class="bp-zak__lijf bp-zak__lijf--' + k + '" d="M-20 8C-25 22 -27 40 -20 54H20C27 40 25 22 20 8Z"/>' +
                '<path class="bp-lf" d="M-14 8C-7 1 7 1 14 8"/>' +
                '<text class="bp-zak__tekst" x="0" y="37">' + label + '</text>' +
            '</g>' +
        '</g>';
    }
    function faseStorten() {
        nieuweFase(1, 'storten');
        var r = S.recept;
        var doelY = 228 - r.moutKg * 3.5;
        podium.innerHTML =
            '<div class="bp-uitlees">' +
                '<div class="bp-uitlees__vak"><span>In de kuip</span><b data-weeg>0,0 kg</b><em>doel ' + r.moutKg + ' kg</em></div>' +
                '<div class="bp-uitlees__vak bp-uitlees__vak--rechts"><span>Verwachte kleur</span><b class="bp-uitlees__kleur"><i data-kleur></i><span data-kleurnaam>–</span></b><em>doel ± ' + r.ebc + ' EBC</em></div>' +
            '</div>' +
            '<svg class="bp-scene" viewBox="62 0 236 246" aria-hidden="true">' +
                '<defs><clipPath id="bp-clip-kuip"><path d="M90 92H270L256 228H104Z"/></clipPath>' +
                '<pattern id="bp-korrelpatroon" width="12" height="8" patternUnits="userSpaceOnUse"><ellipse cx="4" cy="3" rx="3.2" ry="1.6" fill="rgba(0,0,0,.18)"/><ellipse cx="10" cy="7" rx="3.2" ry="1.6" fill="rgba(255,255,255,.14)"/></pattern></defs>' +
                zak('pils', 'PILS') + zak('karamel', 'KARAMEL') + zak('chocolade', 'CHOCO') +
                '<path class="bp-v bp-l" d="M84 88H276L260 232H100Z"/>' +
                '<g clip-path="url(#bp-clip-kuip)">' +
                    '<rect data-laag="pils" x="80" width="200" y="228" height="0" fill="#EED48C"/>' +
                    '<rect data-laag="karamel" x="80" width="200" y="228" height="0" fill="#C2701F"/>' +
                    '<rect data-laag="chocolade" x="80" width="200" y="228" height="0" fill="#3A1A0A"/>' +
                    '<rect data-patroon x="80" width="200" y="228" height="0" fill="url(#bp-korrelpatroon)"/>' +
                '</g>' +
                '<path class="bp-l" d="M84 88H276L260 232H100Z" fill="none"/>' +
                '<path class="bp-kuip__doel" d="M92 ' + doelY + 'H268"/>' +
                '<text class="bp-kuip__doeltekst" x="264" y="' + (doelY - 5) + '">doel ' + r.moutKg + ' kg</text>' +
            '</svg>';
        bediening.innerHTML =
            '<div class="bp-stortknoppen">' +
                ['pils', 'karamel', 'chocolade'].map(function (k) {
                    var naam = D.mout[k].naam, stam = naam.replace(/mout$/, '');
                    return '<button type="button" class="bp-stortknop bp-stortknop--' + k + '" data-mout="' + k + '" aria-label="' + naam + ': houd vast om te storten">' +
                        '<span class="bp-stortknop__staal" aria-hidden="true"></span>' +
                        '<span class="bp-stortknop__tekst"><strong>' + stam + '<span class="bp-stortknop__mout">mout</span></strong><small data-kg="' + k + '">0,0 kg</small>' +
                        '<span class="bp-stortknop__hint">houd vast</span></span>' +
                    '</button>';
                }).join('') +
            '</div>';
        tekenDoelkaart();

        var storten = {}, schepKlok = 0, klaarKnop = null;
        function teken() {
            var m = S.mout, y = 228;
            ['pils', 'karamel', 'chocolade'].forEach(function (k) {
                var h = m[k] * 3.5;
                y -= h;
                var l = podium.querySelector('[data-laag="' + k + '"]');
                l.setAttribute('y', y.toFixed(1));
                l.setAttribute('height', h.toFixed(1));
                tekst(bediening.querySelector('[data-kg="' + k + '"]'), B.getal(m[k], 1) + ' kg');
            });
            var p = podium.querySelector('[data-patroon]');
            p.setAttribute('y', y.toFixed(1)); p.setAttribute('height', (228 - y).toFixed(1));
            var kg = m.pils + m.karamel + m.chocolade;
            tekst(podium.querySelector('[data-weeg]'), B.getal(kg, 1) + ' kg');
            var ebc = B.moutEbc(m, 100);
            podium.querySelector('[data-kleur]').style.background = kg ? B.ebcNaarKleur(ebc) : 'transparent';
            tekst(podium.querySelector('[data-kleurnaam]'), kg ? B.kleurNaam(ebc) + ' · ' + rond(ebc) + ' EBC' : '–');
            if (klaarKnop) klaarKnop.disabled = kg < 1;
            tekenDoelkaart();
        }
        nieuweLus(function (dt) {
            var bezig = false;
            Object.keys(storten).forEach(function (k) {
                if (!storten[k]) return;
                bezig = true;
                var tot = S.mout.pils + S.mout.karamel + S.mout.chocolade;
                if (tot < 40) S.mout[k] = Math.min(S.mout[k] + D.mout[k].snelheid * dt, S.mout[k] + 40 - tot);
            });
            if (bezig) {
                schepKlok += dt;
                if (schepKlok > 0.22) { schepKlok = 0; G.speel('schep'); }
                teken();
            }
        });
        bediening.querySelectorAll('[data-mout]').forEach(function (knop) {
            var k = knop.getAttribute('data-mout');
            B.vasthouden(knop, {
                start: function () { storten[k] = true; podium.querySelector('[data-zak="' + k + '"]').classList.add('is-stort'); },
                stop: function () { storten[k] = false; podium.querySelector('[data-zak="' + k + '"]').classList.remove('is-stort'); teken(); }
            });
        });
        function spelen() {
            klaarKnop = zetDock({
                links: [{ tekst: 'Kuip legen', kort: '', icoon: 'fa-trash-can', actie: function () {
                    S.mout = { pils: 0, karamel: 0, chocolade: 0 };
                    G.speel('zoef');
                    teken();
                } }],
                primair: { tekst: 'Klaar, naar de molen', uit: true, actie: function () { stopAlles(); faseSchroten(); } }
            });
            teken();
            zetFocus(bediening.querySelector('[data-mout]'));
        }
        teken();
        uitleg({
            fase: 'Fase 1 · Mout & schroot',
            titel: 'Stort de mout',
            tekst: '<p>Houd een zak ingedrukt om mout in de kuip te storten. Lichte <strong>pilsmout</strong> is de basis en levert de enzymen. <strong>Karamelmout</strong> en <strong>chocolademout</strong> geven kleur en smaak: een klein beetje gaat al ver.</p>',
            doel: 'Ongeveer <strong>' + r.moutKg + ' kg</strong> mout, in de kleur van een ' + klein(r.stijl) + ' (± ' + r.ebc + ' EBC).',
            knop: 'Begin met storten',
            icoon: 'fa-hand-pointer',
            bij: spelen
        });
        return spelen;
    }

    /* ==================================================================
       FASE 1b — Schroten: stop de molen in het groene vak
       ================================================================== */
    function faseSchroten() {
        nieuweFase(1, 'schroten');
        var plekken = [[232, 90, -20], [272, 82, 15], [312, 92, -5], [252, 124, 28], [296, 126, -30]];
        podium.innerHTML =
            '<svg class="bp-scene bp-scene--molen" viewBox="30 4 330 196" aria-hidden="true">' +
                '<path class="bp-l" d="M40 14H180L140 74H80Z"/>' +
                '<path class="bp-mouthoop" d="M50 20C80 6 140 6 170 20Z"/>' +
                '<rect class="bp-v bp-l" x="62" y="74" width="96" height="62" rx="5"/>' +
                '<rect class="bp-venster" x="76" y="86" width="68" height="38" rx="5"/>' +
                '<g class="bp-molen__wals" data-wals="1"><circle class="bp-tanden" cx="98" cy="105" r="14"/><circle class="bp-lf" cx="98" cy="105" r="6"/></g>' +
                '<g class="bp-molen__wals" data-wals="2"><circle class="bp-tanden" cx="122" cy="105" r="14"/><circle class="bp-lf" cx="122" cy="105" r="6"/></g>' +
                '<path class="bp-l" d="M84 136H136L124 158H96Z"/>' +
                '<g class="bp-molen__val"><ellipse cx="104" cy="34" rx="4" ry="2.2"/><ellipse cx="116" cy="44" rx="4" ry="2.2"/><ellipse cx="110" cy="26" rx="4" ry="2.2"/>' +
                    '<path d="M106 164l3-2 1 3z"/><path d="M112 172l3 2-3 1z"/><path d="M108 180l3-2 1 3z"/></g>' +
                '<path class="bp-l" d="M66 136L48 196M154 136L172 196"/>' +
                '<g class="bp-handvol bp-handvol--spel" data-fase="0"><path class="bp-handvol__schaal" d="M214 100C214 150 350 150 350 100"/>' +
                    plekken.map(function (p) { return B.korrelFases ? B.korrelFases(p[0], p[1], p[2]) : ''; }).join('') +
                '</g>' +
                '<text class="bp-svg-klein" x="282" y="172">jouw schroot</text>' +
            '</svg>' +
            '<div class="bp-meter-balk bp-meter-balk--spel" aria-hidden="true">' +
                '<div class="bp-meter-balk__zones" style="grid-template-columns:42fr 20fr 38fr"><span class="is-fout">Te heel</span><span class="is-goed">Perfect</span><span class="is-fout">Poeder</span></div>' +
                '<div class="bp-meter-balk__naald" data-naald></div>' +
            '</div>';
        bediening.innerHTML =
            '<button type="button" class="bp-grote-knop bp-grote-knop--stop" data-stop disabled><span>Stop!</span><small>de molen</small></button>';
        var stopKnop = bediening.querySelector('[data-stop]');
        var naald = podium.querySelector('[data-naald]');
        var walsen = podium.querySelectorAll('.bp-molen__wals');
        var hand = podium.querySelector('.bp-handvol');
        var scene = podium.querySelector('.bp-scene--molen');
        var T = 3.8, t = 0, f = 0, klaar = false, molen = null;

        function teken() {
            naald.style.left = f + '%';
            walsen[0].style.transform = 'rotate(' + (t * 900) + 'deg)';
            walsen[1].style.transform = 'rotate(' + (-t * 900) + 'deg)';
            hand.setAttribute('data-fase', f < 12 ? 0 : f < 42 ? 1 : f < 62 ? 2 : f < 84 ? 3 : 4);
        }
        function stop() {
            if (klaar) return;
            klaar = true;
            stopKnop.disabled = true;
            if (lus) lus.stop();
            if (molen) molen.stop();
            stopKlok();
            scene.classList.remove('is-malend');
            S.fijn = f;
            S.klaar[1] = true;
            var u = bereken();
            var oordeel = f < 42 ? 'Te vroeg gestopt: de korrels zijn nog te heel. Daar haal je minder suiker uit.'
                : f <= 62 ? 'Perfect geschroot! Meelkern open, kafje heel: straks een mooi filterbed.'
                : 'Te lang doorgemalen: poeder! Het filterbed raakt verstopt.';
            uitslag({
                score: u.p1,
                titel: 'Fase 1 klaar',
                tekst: '<p>' + oordeel + '</p>',
                lijst: [['Kleur', rond(u.kleur) + '%'], ['Hoeveelheid', rond(u.hoeveel) + '%'], ['Schroot', rond(u.schroot) + '%']],
                knop: 'Naar de maischketel',
                bij: faseMaischen
            });
        }
        stopKnop.addEventListener('click', stop);
        function spelen() {
            zetDock({ primair: { tekst: 'Naar de maischketel', uit: true } });
            stopKnop.disabled = false;
            zetFocus(stopKnop);
            scene.classList.add('is-malend');
            molen = geluidLus('molen');
            startKlok();
            nieuweLus(function (dt) {
                t += dt;
                f = Math.min(100, 100 * Math.pow(t / T, 1.6));
                teken();
                if (f >= 100) stop();
            });
        }
        teken();
        uitleg({
            fase: 'Fase 1 · Mout & schroot',
            titel: 'Stop de schrootmolen',
            tekst: '<p>De molen draait steeds sneller en de naald loopt van ‘te heel’ naar ‘poeder’. Tik op <strong>Stop!</strong> zodra de naald in het <strong>groene vak</strong> staat.</p>',
            doel: 'Breken, niet malen: meelkern open, kafje heel.',
            knop: 'Start de molen',
            icoon: 'fa-gear',
            bij: spelen
        });
        return spelen;
    }

    /* ==================================================================
       FASE 2 — Maischen: brander aan/uit binnen de zone
       Speelzones 61–65 en 70–73 °C (iets ruimer dan de tekst, zodat het
       speelbaar blijft); de labels tonen 62–65 en 70–72 °C.
       ================================================================== */
    function faseMaischen() {
        nieuweFase(2, 'maischen');
        var r = S.recept.maisch;
        var totaal = r.beta + r.alfa;
        var zones = [{ min: 61, max: 65, naam: 'bèta-rust' }, { min: 70, max: 73, naam: 'alfa-rust' }];
        function ty(t) { return 226 - (t - 50) / 32 * 200; }
        var clipId = B.uniekId('mk');
        podium.innerHTML =
            '<div class="bp-uitlees">' +
                '<div class="bp-uitlees__vak"><span>In de zone</span><b data-zonepct>0%</b></div>' +
                '<div class="bp-uitlees__vak bp-uitlees__vak--lcd bp-uitlees__vak--rechts"><b><span data-temp>58,0</span> °C</b><em data-zonestatus>Klaar voor de start</em></div>' +
            '</div>' +
            '<svg class="bp-scene" viewBox="30 4 254 236" aria-hidden="true">' +
                '<defs><clipPath id="' + clipId + '"><rect x="146" y="74" width="108" height="100" rx="12"/></clipPath></defs>' +
                '<g class="bp-maisch__stoom" style="--hitte:1"><path d="M180 44c-5-7 5-10 0-17s5-10 0-15"/><path d="M220 48c-5-7 5-10 0-17s5-10 0-15"/></g>' +
                '<path class="bp-v bp-l" d="M128 66C128 44 156 34 200 34C244 34 272 44 272 66Z"/>' +
                '<path class="bp-v bp-l" d="M128 66H272V182Q272 192 262 192H138Q128 192 128 182Z"/>' +
                '<rect class="bp-venster" x="146" y="74" width="108" height="100" rx="12"/>' +
                '<g clip-path="url(#' + clipId + ')"><rect class="bp-maisch__beslag" x="140" y="96" width="120" height="82"/>' +
                    '<path class="bp-l" d="M200 34V150"/><g class="bp-roer"><path class="bp-roerblad" d="M170 146H230V154H170Z"/></g></g>' +
                '<rect class="bp-l" x="146" y="74" width="108" height="100" rx="12"/>' +
                '<g class="bp-maisch__vlam" data-vlam><path d="M174 230C164 220 170 212 176 206C176 216 184 216 184 226Z"/><path d="M196 232C184 218 196 208 200 200C200 212 210 214 210 226Z"/><path d="M222 230C214 220 220 212 224 206C226 216 232 218 230 228Z"/></g>' +
                '<path class="bp-lf" d="M148 236H252"/>' +
                '<rect class="bp-v bp-lf" x="40" y="14" width="30" height="214" rx="15"/>' +
                '<rect class="bp-maisch__zone bp-maisch__zone--actief" data-zoneband x="44" width="22" y="0" height="0"/>' +
                '<rect class="bp-maisch__kwik" x="51" y="26" width="8" height="200" rx="4" data-kwik/>' +
                [50, 60, 70, 80].map(function (t) { return '<path class="bp-tik" d="M70 ' + ty(t) + 'h7"/><text class="bp-maisch__schaal" x="81" y="' + (ty(t) + 4) + '">' + t + '</text>'; }).join('') +
                [55, 65, 75].map(function (t) { return '<path class="bp-tik" d="M70 ' + ty(t) + 'h4"/>'; }).join('') +
                '<path class="bp-lf" d="M104 120H128"/>' +
            '</svg>' +
            '<div class="bp-tijdlijn" aria-hidden="true">' +
                '<div class="bp-tijdlijn__balk"><span style="flex:' + r.beta + '"></span><span style="flex:' + r.alfa + '"></span><i data-cursor></i></div>' +
                '<div class="bp-tijdlijn__legenda"><span class="is-beta">Bèta-rust · 62–65 °C</span><span class="is-alfa">Alfa-rust · 70–72 °C</span></div>' +
            '</div>';
        bediening.innerHTML =
            '<button type="button" class="bp-brander" data-brander aria-pressed="false" disabled>' +
                '<span class="bp-brander__knop" aria-hidden="true"><i class="fas fa-fire-flame-curved"></i></span>' +
                '<span class="bp-brander__tekst"><strong data-brandertekst>Brander staat uit</strong><small>tik om aan of uit te zetten</small></span>' +
            '</button>';
        var knop = bediening.querySelector('[data-brander]');
        var vlam = podium.querySelector('[data-vlam]');
        var kwik = podium.querySelector('[data-kwik]');
        var band = podium.querySelector('[data-zoneband]');
        var cursor = podium.querySelector('[data-cursor]');
        var tempEl = podium.querySelector('[data-temp]');
        var statusEl = podium.querySelector('[data-zonestatus]');
        var pctEl = podium.querySelector('[data-zonepct]');
        var T = 58, t = 0, aan = false, brander = null, vorigeZone = -1;
        var ma = S.maisch;

        function zetBrander(waarde) {
            aan = waarde;
            knop.setAttribute('aria-pressed', aan ? 'true' : 'false');
            knop.classList.toggle('is-aan', aan);
            tekst(bediening.querySelector('[data-brandertekst]'), aan ? 'Brander staat aan' : 'Brander staat uit');
            vlam.classList.toggle('is-aan', aan);
            if (aan && !brander) brander = geluidLus('brander');
            if (!aan && brander) { brander.stop(); brander = null; }
            G.speel('tak');
        }
        knop.addEventListener('click', function () { if (!knop.disabled) zetBrander(!aan); });

        function zoneOp(tijd) { return tijd < r.beta ? zones[0] : zones[1]; }
        function teken() {
            var z = zoneOp(t);
            band.setAttribute('y', ty(z.max).toFixed(1));
            band.setAttribute('height', (ty(z.min) - ty(z.max)).toFixed(1));
            kwik.style.transform = 'scaleY(' + B.klem((T - 48) / 34, 0.03, 1).toFixed(3) + ')';
            tekst(tempEl, B.getal(T, 1));
            cursor.style.left = (B.klem(t / totaal, 0, 1) * 100).toFixed(2) + '%';
            var pct = ma.gescoord ? rond(100 * ma.inZone / ma.gescoord) : 0;
            tekst(pctEl, pct + '%');
            var status = T > z.max ? 'Te heet! Brander uit' : T < z.min ? 'Te koud: brander aan' : 'In de zone · ' + z.naam;
            tekst(statusEl, status);
            statusEl.setAttribute('data-status', T > z.max ? 'heet' : T < z.min ? 'koud' : 'goed');
        }
        function einde() {
            if (lus) lus.stop();
            if (brander) { brander.stop(); brander = null; }
            stopKlok();
            knop.disabled = true;
            vlam.classList.remove('is-aan');
            S.klaar[2] = true;
            var u = bereken();
            var tekstUit = u.p2 >= 85 ? 'Strak gemaischt! De enzymen hebben precies gedaan wat je wilde.'
                : ma.teHeet > ma.teKoud ? 'Je ketel schoot regelmatig te ver door: zet de brander eerder uit, de temperatuur loopt nog even na.'
                : 'De ketel zakte vaak te ver af: zet de brander iets eerder weer aan.';
            uitslag({
                score: u.p2,
                titel: 'Fase 2 klaar',
                tekst: '<p>' + tekstUit + '</p>',
                lijst: [['In de zone', rond(u.p2) + '%'], ['Te heet', B.getal(ma.teHeet, 1) + ' s'], ['Te koud', B.getal(ma.teKoud, 1) + ' s']],
                knop: 'Naar de kookketel',
                bij: faseHop
            });
        }
        function spelen() {
            zetDock({ primair: { tekst: 'Naar de kookketel', uit: true } });
            knop.disabled = false;
            zetFocus(knop);
            startKlok();
            nieuweLus(function (dt) {
                t += dt;
                T += ((aan ? 2.5 : -1.15) + (Math.random() - 0.5) * 0.6) * dt;
                T = B.klem(T, 40, 92);
                var z = zoneOp(t);
                var zi = t < r.beta ? 0 : 1;
                if (zi !== vorigeZone) { vorigeZone = zi; if (zi === 1) G.speel('succes'); }
                var gescoord = t > 1.5 && !(t > r.beta && t < r.beta + 3);
                if (gescoord) {
                    ma.gescoord += dt;
                    if (T >= z.min && T <= z.max) ma.inZone += dt;
                    else if (T >= z.min - 0.6 && T <= z.max + 0.6) ma.inZone += dt * 0.5;
                    else if (T > z.max) ma.teHeet += dt;
                    else ma.teKoud += dt;
                }
                teken();
                if (t >= totaal) einde();
            });
        }
        teken();
        uitleg({
            fase: 'Fase 2 · Maischen',
            titel: 'Houd de ketel op temperatuur',
            tekst: '<p>Tik op de <strong>brander</strong> om hem aan of uit te zetten. Houd het beslag eerst in de <strong>bèta-rust (62–65 °C)</strong> en daarna in de <strong>alfa-rust (70–72 °C)</strong>. Let op: een ketel reageert traag!</p>',
            doel: 'Je ' + klein(S.recept.stijl) + ' vraagt ' + r.beta + ' seconden bèta-rust en ' + r.alfa + ' seconden alfa-rust.',
            knop: 'Start het maischen',
            icoon: 'fa-temperature-half',
            bij: spelen
        });
        return spelen;
    }

    /* ==================================================================
       FASE 3 — Hop-timing
       ================================================================== */
    function faseHop() {
        nieuweFase(3, 'hop');
        var R = 66, OMTREK = 2 * Math.PI * R, CX = 108, CY = 116;
        function p(min, rad) { var a = ((60 - min) / 60 * 360 - 90) * Math.PI / 180; return [CX + Math.cos(a) * rad, CY + Math.sin(a) * rad]; }
        function boog(van, tot) {
            var a = p(van, 82), b = p(tot, 82);
            return 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + 'A82 82 0 0 1 ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
        }
        podium.innerHTML =
            '<div class="bp-uitlees">' +
                '<div class="bp-uitlees__vak"><span>Bitterheid</span><b data-ibu>0 IBU</b><em>doel ' + S.recept.ibu + ' IBU</em></div>' +
                '<div class="bp-uitlees__vak bp-uitlees__vak--rechts"><span>Kooktijd</span><b data-kooktijd>nog 60 min</b></div>' +
            '</div>' +
            '<svg class="bp-scene" viewBox="10 0 344 236" aria-hidden="true">' +
                '<circle class="bp-hop__wijzerplaat" cx="' + CX + '" cy="' + CY + '" r="88"/>' +
                '<path class="bp-hop__venster bp-hop__venster--bitter" d="' + boog(60, 54) + '"/>' +
                '<path class="bp-hop__venster bp-hop__venster--aroma" d="' + boog(5, 0.05) + '"/>' +
                '<circle class="bp-hop__spoor" cx="' + CX + '" cy="' + CY + '" r="' + R + '"/>' +
                '<circle class="bp-hop__rest" cx="' + CX + '" cy="' + CY + '" r="' + R + '" style="transform-origin:' + CX + 'px ' + CY + 'px;stroke-dasharray:' + OMTREK.toFixed(1) + ';stroke-dashoffset:' + OMTREK.toFixed(1) + '" data-rest/>' +
                '<circle class="bp-hop__wijzer" r="6" cx="' + CX + '" cy="' + (CY - R) + '" data-wijzer/>' +
                '<g data-merken></g>' +
                '<text class="bp-hop__minuten" x="' + CX + '" y="' + (CY + 8) + '" data-minuten>60</text>' +
                '<text class="bp-hop__eenheid" x="' + CX + '" y="' + (CY + 28) + '">minuten</text>' +
                '<text class="bp-hop__label bp-hop__label--bitter" x="' + (CX + 52) + '" y="16">bitterhop</text>' +
                '<text class="bp-hop__label bp-hop__label--aroma" x="' + (CX - 52) + '" y="16">aromahop</text>' +
                '<g transform="translate(220 74)">' +
                    '<path class="bp-v bp-l" d="M0 20H124V134Q124 144 114 144H10Q0 144 0 134Z"/>' +
                    '<rect class="bp-hop__wort" x="4" y="32" width="116" height="108"/>' +
                    '<g class="bp-hop__bubbels"><circle cx="20" cy="36" r="3"/><circle cx="42" cy="34" r="4"/><circle cx="64" cy="37" r="3"/><circle cx="86" cy="34" r="4"/><circle cx="106" cy="37" r="2.5"/></g>' +
                    '<g data-vallend></g>' +
                    '<g class="bp-maisch__stoom" style="--hitte:1"><path d="M40 10c-5-7 5-10 0-17s5-10 0-15"/><path d="M84 12c-5-7 5-10 0-17s5-10 0-15"/></g>' +
                '</g>' +
            '</svg>';
        bediening.innerHTML =
            '<div class="bp-hopknoppen">' +
                '<button type="button" class="bp-hopknop bp-hopknop--groot bp-hopknop--bitter" data-hop="bitter" disabled><svg class="bp-hopknop__bel" viewBox="0 0 100 140" aria-hidden="true"><use href="#bp-sym-hopbel" width="100" height="140"/></svg><span><strong>Bitterhop</strong><small>bij de start</small></span></button>' +
                '<button type="button" class="bp-hopknop bp-hopknop--groot bp-hopknop--aroma" data-hop="aroma" disabled><svg class="bp-hopknop__bel" viewBox="0 0 100 140" aria-hidden="true"><use href="#bp-sym-hopbel" width="100" height="140"/></svg><span><strong>Aromahop</strong><small>laatste 5 minuten</small></span></button>' +
            '</div>';
        var minuten = 60, klaar = false, kook = null, vorig = 60;
        var rest = podium.querySelector('[data-rest]');
        var wijzer = podium.querySelector('[data-wijzer]');
        var knoppen = bediening.querySelectorAll('[data-hop]');
        var scene = podium.querySelector('.bp-scene');

        function ibuNu() {
            var r = S.recept, ibu = 0;
            if (S.hop.bitter != null) ibu += r.ibu * benut(S.hop.bitter - minuten) / benut(60);
            if (S.hop.aroma != null) ibu += r.ibu * 0.15 * benut(S.hop.aroma - minuten) / benut(60);
            return ibu;
        }
        function teken() {
            var m = Math.ceil(minuten);
            tekst(podium.querySelector('[data-minuten]'), String(m));
            tekst(podium.querySelector('[data-kooktijd]'), m > 5 ? 'nog ' + m + ' min' : m > 0 ? 'nog ' + m + ' min · aroma!' : 'klaar');
            rest.style.strokeDashoffset = (OMTREK * minuten / 60).toFixed(1);
            var q = p(minuten, R);
            wijzer.setAttribute('cx', q[0].toFixed(1)); wijzer.setAttribute('cy', q[1].toFixed(1));
            tekst(podium.querySelector('[data-ibu]'), rond(ibuNu()) + ' IBU');
        }
        function einde() {
            if (klaar) return;
            klaar = true;
            if (lus) lus.stop();
            if (kook) { kook.stop(); kook = null; }
            stopKlok();
            scene.classList.remove('is-kokend');
            knoppen.forEach(function (k) { k.disabled = true; });
            S.klaar[3] = true;
            var u = bereken();
            var delen = [];
            if (S.hop.bitter == null) delen.push('Geen bitterhop: het bier blijft plakkerig zoet.');
            else if (S.hop.bitter >= 54) delen.push('Bitterhop op tijd: ' + rond(u.ibu) + ' IBU.');
            else delen.push('Bitterhop pas na ' + rond(60 - S.hop.bitter) + ' minuten: ' + rond(u.ibu) + ' IBU in plaats van ' + S.recept.ibu + '.');
            if (S.hop.aroma == null) delen.push('De aromahop is vergeten.');
            else if (S.hop.aroma <= 5.5) delen.push('Aromahop helemaal aan het eind: de bloemige geur blijft behouden!');
            else delen.push('De aromahop kookte ' + rond(S.hop.aroma) + ' minuten mee: de geur is grotendeels verdampt.');
            uitslag({
                score: u.p3,
                titel: 'Fase 3 klaar',
                tekst: '<p>' + delen.join(' ') + '</p>',
                lijst: [['Bitterheid', rond(u.bitter) + '%'], ['Aroma', rond(u.aroma) + '%']],
                knop: 'Naar de gisttank',
                bij: faseGist
            });
        }
        knoppen.forEach(function (k) {
            k.addEventListener('click', function () {
                if (k.disabled || klaar) return;
                var soort = k.getAttribute('data-hop');
                S.hop[soort] = minuten;
                k.disabled = true;
                k.classList.add('is-toegevoegd');
                k.querySelector('small').textContent = 'erin op ' + Math.ceil(minuten) + ' min';
                var q = p(minuten, R);
                podium.querySelector('[data-merken]').appendChild(B.svg('circle', { cx: q[0].toFixed(1), cy: q[1].toFixed(1), r: 7, class: 'bp-hop__merk bp-hop__merk--' + soort }));
                var val = B.svg('use', { href: '#bp-sym-hopbel', x: soort === 'bitter' ? 34 : 70, y: 0, width: 24, height: 34, class: 'bp-hop__val' });
                podium.querySelector('[data-vallend]').appendChild(val);
                later(function () { val.remove(); }, 1200);
                G.speel('plons');
                B.trillen(15);
                var volgende = bediening.querySelector('[data-hop]:not(:disabled)');
                if (volgende) zetFocus(volgende);
            });
        });
        function spelen() {
            zetDock({ primair: { tekst: 'Naar de gisttank', uit: true } });
            knoppen.forEach(function (k) { k.disabled = false; });
            zetFocus(knoppen[0]);
            scene.classList.add('is-kokend');
            kook = geluidLus('koken');
            startKlok();
            nieuweLus(function (dt) {
                minuten = Math.max(0, minuten - dt * 3);
                if (Math.floor(minuten / 5) !== Math.floor(vorig / 5)) G.speel('tik');
                vorig = minuten;
                teken();
                if (minuten <= 0) einde();
            });
        }
        teken();
        uitleg({
            fase: 'Fase 3 · Hop',
            titel: 'Timing is alles',
            tekst: '<p>De kookklok telt een uur af, hier in twintig seconden. Gooi de <strong>bitterhop</strong> er meteen bij de start in: bitterheid heeft kooktijd nodig. De <strong>aromahop</strong> gaat er pas in de <strong>laatste 5 minuten</strong> in, anders verdampt de geur.</p>',
            doel: 'Bitterhop in het gouden vak, aromahop in het groene vak.',
            knop: 'Breng aan de kook',
            icoon: 'fa-fire',
            bij: spelen
        });
        return spelen;
    }

    /* ==================================================================
       FASE 4a — Gist erbij op de juiste temperatuur
       ================================================================== */
    function faseGist() {
        nieuweFase(4, 'gist');
        function ty(t) { return 216 - t / 100 * 196; }
        podium.innerHTML =
            '<div class="bp-uitlees">' +
                '<div class="bp-uitlees__vak bp-uitlees__vak--lcd"><b><span data-temp>96,0</span> °C</b><em data-status>Het wort koelt af</em></div>' +
                '<div class="bp-uitlees__vak bp-uitlees__vak--rechts" data-abvvak hidden><span data-dag>Dag 1</span><b data-abv>0,0%</b><em>alcohol</em></div>' +
            '</div>' +
            '<svg class="bp-scene" viewBox="10 4 340 236" aria-hidden="true">' +
                '<rect class="bp-v bp-lf" x="20" y="12" width="30" height="214" rx="15"/>' +
                '<rect class="bp-gist__zone" x="24" y="' + ty(24) + '" width="22" height="' + (ty(18) - ty(24)) + '"/>' +
                '<rect class="bp-gist__kwik" x="31" y="20" width="8" height="196" rx="4" data-kwik/>' +
                [0, 20, 40, 60, 80, 100].map(function (t) { return '<path class="bp-tik" d="M50 ' + ty(t) + 'h7"/><text class="bp-maisch__schaal" x="60" y="' + (ty(t) + 4) + '">' + t + '</text>'; }).join('') +
                // platenkoeler
                '<path class="bp-buis" d="M84 40H108V196H132V40H156V196H180V118H208"/>' +
                '<path class="bp-gist__stroom" d="M84 40H108V196H132V40H156V196H180V118H208" data-stroom/>' +
                '<rect class="bp-v bp-lf" x="100" y="30" width="88" height="176" rx="8" fill-opacity=".35"/>' +
                '<text class="bp-svg-klein" x="144" y="226">platenkoeler</text>' +
                // vergistingstank
                '<path class="bp-v bp-l" d="M220 60C220 42 240 34 270 34C300 34 320 42 320 60Z"/>' +
                '<path class="bp-v bp-l" d="M220 60H320V170L286 206H254L220 170Z"/>' +
                '<path class="bp-gist__bier" d="M224 84H316V168L284 202H256L224 168Z" data-tankbier/>' +
                '<g class="bp-gist__bellen" data-bellen><circle cx="250" cy="170" r="2.5"/><circle cx="270" cy="176" r="3"/><circle cx="292" cy="168" r="2.2"/><circle cx="260" cy="160" r="1.8"/><circle cx="282" cy="180" r="2.4"/><circle cx="300" cy="150" r="2"/></g>' +
                '<g class="bp-gist__korrels" data-korrels><circle cx="262" cy="30" r="2"/><circle cx="272" cy="24" r="2"/><circle cx="280" cy="32" r="2"/><circle cx="268" cy="38" r="2"/></g>' +
                '<path class="bp-l" d="M226 170V234M314 170V234"/>' +
                '<path class="bp-lf" d="M300 40C318 30 340 34 340 60V96"/><g class="bp-blub" data-blub><circle style="--d:0s" cx="340" cy="104" r="3"/><circle style="--d:.7s" cx="336" cy="104" r="2"/></g>' +
            '</svg>';
        bediening.innerHTML =
            '<button type="button" class="bp-actieknop" data-gist disabled><span class="bp-actieknop__icoon" aria-hidden="true"><i class="fas fa-flask"></i></span><span><strong>Gist erbij!</strong><small>tussen 18 en 24 °C</small></span></button>';
        var knop = bediening.querySelector('[data-gist]');
        var kwik = podium.querySelector('[data-kwik]');
        var scene = podium.querySelector('.bp-scene');
        var tempEl = podium.querySelector('[data-temp]');
        var statusEl = podium.querySelector('[data-status]');
        var t = 0, T = 96, gedaan = false, sis = 0;
        var TAU = 3.4;

        function teken() {
            kwik.style.transform = 'scaleY(' + B.klem(T / 100, 0.02, 1).toFixed(3) + ')';
            tekst(tempEl, B.getal(T, 1));
            var zone = T > 24 ? 'heet' : T >= 18 ? 'goed' : 'koud';
            statusEl.setAttribute('data-status', zone);
            tekst(statusEl, zone === 'heet' ? 'Nog te heet voor de gist' : zone === 'goed' ? 'Nu! Perfecte gisttemperatuur' : 'Te koud: de gist wordt traag');
        }
        function pitch() {
            if (gedaan) return;
            gedaan = true;
            knop.disabled = true;
            if (lus) lus.stop();
            S.gistTemp = T;
            scene.classList.remove('is-koelend');
            scene.classList.add('is-gist');
            G.speel('schep');
            var u = bereken();
            later(function () {
                scene.classList.add('is-gistend');
                var blub = geluidLus('gisten');
                var vak = podium.querySelector('[data-abvvak]');
                vak.hidden = false;
                var d = 0;
                nieuweLus(function (dt) {
                    d = Math.min(1, d + dt / 2.6);
                    tekst(vak.querySelector('[data-abv]'), B.getal(u.abv * d, 1) + '%');
                    tekst(vak.querySelector('[data-dag]'), 'Dag ' + Math.min(7, 1 + Math.floor(d * 6.99)));
                    if (d >= 1) {
                        lus.stop();
                        blub.stop();
                        stopKlok();
                        var tekstUit = S.gistTemp > 30 ? 'Veel te heet! Een deel van de gist is bezweken en de rest maakt oplosmiddelachtige geurtjes.'
                            : S.gistTemp > 24 ? 'Iets te warm: de gist werkt hard en wordt extra fruitig.'
                            : S.gistTemp >= 18 ? 'Precies op temperatuur: de gist gaat meteen aan het werk.'
                            : 'Te koud: de gist kwam maar traag op gang.';
                        uitslag({
                            score: u.gist,
                            titel: 'De gist is aan het werk',
                            tekst: '<p>Gist erbij op <strong>' + B.getal(S.gistTemp, 1) + ' °C</strong>. ' + tekstUit + ' Na een week: <strong>' + B.getal(u.abv, 1) + '% alcohol</strong>.</p>',
                            knop: 'Naar de bottelarij',
                            bij: faseSuiker
                        });
                    }
                });
            }, 700);
        }
        knop.addEventListener('click', pitch);
        function spelen() {
            zetDock({ primair: { tekst: 'Naar de bottelarij', uit: true } });
            knop.disabled = false;
            zetFocus(knop);
            scene.classList.add('is-koelend');
            startKlok();
            nieuweLus(function (dt) {
                t += dt;
                T = 8 + 88 * Math.exp(-t / TAU);
                sis += dt;
                if (sis > 1.2 && T > 30) { sis = 0; G.speel('sis'); }
                teken();
                if (T <= 9) pitch();
            });
        }
        teken();
        uitleg({
            fase: 'Fase 4 · Gist & fles',
            titel: 'Koel af en voeg gist toe',
            tekst: '<p>Het kokende wort stroomt door de platenkoeler naar de gisttank. Te heet en de gist bezwijkt, te koud en hij slaapt. Tik op <strong>Gist erbij!</strong> zodra de thermometer in het <strong>gouden vak (18–24 °C)</strong> staat.</p>',
            doel: 'Gist toevoegen tussen 18 en 24 °C.',
            knop: 'Start de koeler',
            icoon: 'fa-snowflake',
            bij: spelen
        });
        return spelen;
    }

    /* ==================================================================
       FASE 4b — Bottelsuiker doseren
       ================================================================== */
    var FLES = 'M140 36V78C140 96 112 104 112 128V226Q112 236 122 236H178Q188 236 188 226V128C188 104 160 96 160 78V36Z';
    function faseSuiker() {
        nieuweFase(4, 'suiker');
        var r = S.recept;
        var PER = 0.72;
        function hoek(bar) { return -128 + B.klem(bar / 5, 0, 1) * 256; }
        function boogPunt(bar, rad) { var a = (hoek(bar) - 90) * Math.PI / 180; return (Math.cos(a) * rad).toFixed(1) + ' ' + (Math.sin(a) * rad).toFixed(1); }
        var ideaal = r.suiker * PER;
        podium.innerHTML =
            '<div class="bp-uitlees">' +
                '<p class="bp-uitlees__hint" data-hint aria-live="polite"></p>' +
            '</div>' +
            '<svg class="bp-scene" viewBox="56 10 290 236" aria-hidden="true">' +
                '<path class="bp-fles-glas" d="' + FLES + '"/>' +
                '<rect class="bp-suiker__bier" x="114" y="100" width="72" height="134" rx="8"/>' +
                '<g data-klontjes></g>' +
                '<path class="bp-l" d="' + FLES + '"/>' +
                '<rect class="bp-v bp-lf" x="118" y="150" width="64" height="48" rx="3"/>' +
                '<use href="#bp-sym-r" class="bp-fles-r" x="136" y="158" width="28" height="32"/>' +
                '<g transform="translate(66 18) rotate(-24)"><path class="bp-v bp-l" d="M0 0H40Q46 0 46 6V8Q46 14 40 14H0Z"/><path class="bp-lf" d="M-40 7H0"/><path class="bp-suiker__lepel" d="M6 3H38V11H6Z"/></g>' +
                '<g transform="translate(276 118)">' +
                    '<circle class="bp-v bp-l" r="62"/>' +
                    '<path class="bp-kamer__schaal" d="M' + boogPunt(0, 48) + 'A48 48 0 1 1 ' + boogPunt(5, 48) + '"/>' +
                    '<path class="bp-suiker__ideaal" d="M' + boogPunt(ideaal - 0.36, 48) + 'A48 48 0 0 1 ' + boogPunt(ideaal + 0.36, 48) + '"/>' +
                    '<path class="bp-suiker__gevaar" d="M' + boogPunt(3.7, 48) + 'A48 48 0 0 1 ' + boogPunt(5, 48) + '"/>' +
                    '<text class="bp-kamer__getal" x="0" y="28" data-bar>0,0</text>' +
                    '<text class="bp-svg-klein" x="0" y="44">bar straks</text>' +
                    '<g class="bp-kamer__wijzer" data-wijzer><path d="M0 0L0 -40"/><circle r="6"/></g>' +
                '</g>' +
            '</svg>';
        bediening.innerHTML =
            '<div class="bp-teller">' +
                '<button type="button" class="bp-teller__knop" data-min aria-label="Schepje minder"><i class="fas fa-minus" aria-hidden="true"></i></button>' +
                '<div class="bp-teller__waarde" aria-live="polite"><b data-schepjes>0</b><span>schepjes bottelsuiker</span></div>' +
                '<button type="button" class="bp-teller__knop" data-plus aria-label="Schepje meer"><i class="fas fa-plus" aria-hidden="true"></i></button>' +
            '</div>';
        var wijzer = podium.querySelector('[data-wijzer]');
        var klontjes = podium.querySelector('[data-klontjes]');
        S.suiker = 0;
        function teken() {
            var bar = S.suiker * PER;
            wijzer.style.transform = 'rotate(' + hoek(bar).toFixed(1) + 'deg)';
            tekst(podium.querySelector('[data-bar]'), B.getal(bar, 1));
            tekst(bediening.querySelector('[data-schepjes]'), String(S.suiker));
            var html = '';
            for (var i = 0; i < S.suiker; i++) html += '<rect class="bp-suiker__klontje" x="' + (124 + (i % 3) * 18) + '" y="' + (214 - Math.floor(i / 3) * 14) + '" width="12" height="10" rx="2"/>';
            klontjes.innerHTML = html;
            var hint = S.suiker === 0 ? 'Nog geen suiker: zonder prik blijft het bier plat.'
                : bar > 3.6 ? 'Gevaarlijk! Zoveel druk wordt een spuiter.'
                : Math.abs(bar - ideaal) <= 0.36 ? 'Precies in het groene vak voor een ' + klein(r.stijl) + '.'
                : bar < ideaal ? 'Nog wat weinig prik voor een ' + klein(r.stijl) + '.'
                : 'Iets veel: dat wordt erg bruisend.';
            var h = podium.querySelector('[data-hint]');
            tekst(h, hint);
            h.setAttribute('data-status', bar > 3.6 ? 'fout' : Math.abs(bar - ideaal) <= 0.36 ? 'goed' : '');
            bediening.querySelector('[data-min]').disabled = S.suiker <= 0;
            bediening.querySelector('[data-plus]').disabled = S.suiker >= 7;
        }
        bediening.querySelector('[data-min]').addEventListener('click', function () { S.suiker = Math.max(0, S.suiker - 1); G.speel('tak'); teken(); });
        bediening.querySelector('[data-plus]').addEventListener('click', function () { S.suiker = Math.min(7, S.suiker + 1); G.speel('schep'); teken(); });
        function spelen() {
            zetDock({ primair: { tekst: 'Klaar, naar de vuller', actie: function () { faseAftappen(); } } });
            zetFocus(bediening.querySelector('[data-plus]'));
        }
        teken();
        uitleg({
            fase: 'Fase 4 · Gist & fles',
            titel: 'Bottelsuiker',
            tekst: '<p>Vlak voor de kroonkurk gaat er een beetje <strong>bottelsuiker</strong> in de fles. In de warme kamer maakt de gist daar koolzuur van. De drukmeter laat zien hoeveel druk dat straks geeft.</p>',
            doel: 'Breng de naald in het <strong>groene vak</strong>. In het rode vak wordt het een spuiter.',
            knop: 'Doseer de suiker',
            icoon: 'fa-cubes-stacked',
            bij: spelen
        });
        return spelen;
    }

    /* ==================================================================
       FASE 4c — Aftappen tot de vullijn en kroonkurk erop
       ================================================================== */
    function faseAftappen() {
        nieuweFase(4, 'aftappen');
        function yVan(pct) { return 236 - 196 * pct / 100; }
        var clipId = B.uniekId('tap');
        podium.innerHTML =
            '<div class="bp-uitlees">' +
                '<div class="bp-uitlees__vak"><span>Vulling</span><b data-vul>0%</b><em>vullijn 88–94%</em></div>' +
            '</div>' +
            '<svg class="bp-scene" viewBox="70 -4 200 250" aria-hidden="true">' +
                '<defs><clipPath id="' + clipId + '"><path d="' + FLES + '"/></clipPath></defs>' +
                '<path class="bp-v bp-l" d="M120 0H180V14H164V30H136V14H120Z"/>' +
                '<path class="bp-tap__straal" data-straal d="M150 30V230"/>' +
                '<path class="bp-fles-glas" d="' + FLES + '"/>' +
                '<g clip-path="url(#' + clipId + ')">' +
                    '<rect class="bp-tap__bier" x="108" y="236" width="84" height="0" data-bier/>' +
                    '<rect class="bp-tap__schuim" x="108" y="236" width="84" height="0" data-schuim/>' +
                '</g>' +
                '<path class="bp-l" d="' + FLES + '"/>' +
                '<path class="bp-tap__lijn" d="M128 ' + yVan(94).toFixed(1) + 'H172M128 ' + yVan(88).toFixed(1) + 'H172"/>' +
                '<rect class="bp-tap__vak" x="140" y="' + yVan(94).toFixed(1) + '" width="20" height="' + (yVan(88) - yVan(94)).toFixed(1) + '"/>' +
                '<text class="bp-svg-klein bp-tap__label" x="200" y="' + (yVan(91) + 4).toFixed(1) + '">vullijn</text>' +
                '<path class="bp-lf" d="M174 ' + yVan(91).toFixed(1) + 'H194"/>' +
                '<rect class="bp-v bp-lf" x="118" y="150" width="64" height="48" rx="3"/>' +
                '<use href="#bp-sym-r" class="bp-fles-r" x="136" y="158" width="28" height="32"/>' +
                '<g class="bp-tap__overloop" data-overloop><path d="M140 40C138 60 136 90 134 110M160 40C164 70 166 96 168 116"/></g>' +
                '<g class="bp-tap__kurk" data-kurk><rect class="bp-kroonkurk" x="136" y="-30" width="28" height="10" rx="3"/></g>' +
            '</svg>';
        bediening.innerHTML =
            '<button type="button" class="bp-grote-knop bp-grote-knop--tap" data-tap disabled><span>Tap af</span><small>houd vast</small></button>';
        var bier = podium.querySelector('[data-bier]');
        var schuim = podium.querySelector('[data-schuim]');
        var scene = podium.querySelector('.bp-scene');
        var tapKnop = bediening.querySelector('[data-tap]');
        var kurkKnop = null;
        var niveau = 0, schuimH = 0, tappen = false, vulgeluid = null, klaar = false;

        function teken() {
            var yb = yVan(Math.min(niveau, 104));
            bier.setAttribute('y', yb.toFixed(1));
            bier.setAttribute('height', (236 - yb).toFixed(1));
            var ys = yVan(Math.min(niveau + schuimH, 104));
            schuim.setAttribute('y', ys.toFixed(1));
            schuim.setAttribute('height', Math.max(0, yb - ys).toFixed(1));
            tekst(podium.querySelector('[data-vul]'), rond(Math.min(niveau, 100)) + '%');
            scene.classList.toggle('is-over', niveau + schuimH > 100);
        }
        B.vasthouden(tapKnop, {
            start: function () {
                if (klaar) return;
                tappen = true;
                scene.classList.add('is-tappend');
                vulgeluid = geluidLus('vullen');
            },
            stop: function () {
                tappen = false;
                scene.classList.remove('is-tappend');
                if (vulgeluid) { vulgeluid.stop(); vulgeluid = null; }
                if (niveau > 0 && kurkKnop && !klaar) kurkKnop.disabled = false;
            }
        });
        function kurk() {
            if (klaar) return;
            klaar = true;
            tapKnop.disabled = true;
            if (kurkKnop) kurkKnop.disabled = true;
            S.vulling = niveau;
            scene.classList.add('is-gekurkt');
            later(function () { G.speel('kurk'); B.trillen(25); }, 380);
            later(function () {
                if (lus) lus.stop();
                S.klaar[4] = true;
                var u = bereken();
                var vulTekst = niveau > 100 ? 'Overgelopen! Je fles stroomde over de rand.'
                    : u.vul >= 100 ? 'Precies op de vullijn. Weinig lucht in de hals: zo blijft je bier lang goed.'
                    : niveau < 88 ? 'Te weinig in de fles: veel lucht in de hals, en zuurstof is de vijand.'
                    : 'Net iets te vol.';
                uitslag({
                    score: u.p4,
                    titel: 'Fase 4 klaar',
                    tekst: '<p>' + vulTekst + '</p>',
                    lijst: [['Gist', rond(u.gist) + '%'], ['Suiker', rond(u.suiker) + '%'], ['Vulling', rond(u.vul) + '%']],
                    knop: 'Proef je bier!',
                    bij: function () { toonResultaat(); }
                });
            }, 1100);
        }
        function spelen() {
            kurkKnop = zetDock({ primair: { tekst: 'Kroonkurk erop', icoon: 'fa-circle-dot', pijl: false, uit: niveau <= 0, actie: kurk } });
            tapKnop.disabled = false;
            zetFocus(tapKnop);
            nieuweLus(function (dt) {
                if (tappen) {
                    niveau = Math.min(106, niveau + (niveau < 70 ? 34 : 18) * dt);
                    schuimH = Math.min(7, schuimH + 10 * dt);
                } else {
                    schuimH = Math.max(0, schuimH - 9 * dt);
                }
                teken();
            });
        }
        teken();
        uitleg({
            fase: 'Fase 4 · Gist & fles',
            titel: 'Tap je flesje af',
            tekst: '<p>Houd <strong>Tap af</strong> ingedrukt om de fles te vullen. Na het loslaten zakt het schuim nog wat in, dus je mag bijvullen. Tik daarna op <strong>Kroonkurk erop</strong>.</p>',
            doel: 'Vul tot de gouden <strong>vullijn</strong> in de hals.',
            knop: 'Naar de vuller',
            icoon: 'fa-bottle-droplet',
            bij: spelen
        });
        return spelen;
    }

    /* ==================================================================
       RESULTAAT — het glas, de score, de proefnotitie en de vergelijking
       ================================================================== */
    function toonResultaat(o) {
        o = o || {};
        stopAlles();
        sluitSheet(false);
        var r = S.recept, u = bereken();
        var notitie = proefnotitie(u);
        var beste = B.opslag.lees(BESTE, {}) || {};
        var nieuwRecord = false;
        if (!o.test) {
            nieuwRecord = beste[r.id] == null || u.totaal > beste[r.id];
            if (nieuwRecord) { beste[r.id] = u.totaal; B.opslag.schrijf(BESTE, beste); }
            laatste = { recept: r.id, naam: r.naam, kort: r.kort, stijl: r.stijl, score: u.totaal, rang: rang(u.totaal), ebc: rond(u.ebc), abv: +u.abv.toFixed(1), datum: new Date().toISOString() };
            B.opslag.schrijf(LAATSTE, laatste);
            try { document.dispatchEvent(new CustomEvent('bp:spel-klaar', { detail: laatste })); } catch (e) { /* oude browser */ }
        }

        var bierKleur = B.ebcNaarKleur(u.ebc);
        var schuimKleur = B.schuimKleur(u.ebc);
        var schuimH = B.klem(u.schuim, 3, 40);
        var vloeistofTop = 40 + schuimH;
        var clipId = B.uniekId('kelk');
        var schuimNaam = u.spuiter ? 'spuiter!' : schuimH > 24 ? 'dik en romig' : schuimH > 12 ? 'mooi' : 'dun';
        function cel(label, jouw, doel, staal) {
            return '<div class="bp-vergelijk__cel"><dt>' + label + '</dt><dd><b>' + (staal ? '<i style="background:' + staal + '"></i>' : '') + jouw + '</b><span class="bp-vergelijk__doel">doel ' + doel + '</span></dd></div>';
        }

        bordOpen('resultaat',
            balkHtml() +
            '<div class="bp-resultaat" data-res>' +
                '<div class="bp-resultaat__glas">' +
                    '<svg class="bp-kelk' + (u.spuiter ? ' is-spuiter' : '') + (u.troebel ? ' is-troebel' : '') + '" viewBox="0 -40 220 330" role="img" aria-label="Jouw ' + klein(r.stijl) + ' in een Rolduc-kelkglas: ' + klein(B.kleurNaam(u.ebc)) + ', met ' + (schuimH > 24 ? 'een dikke' : schuimH > 12 ? 'een mooie' : 'een dunne') + ' schuimkraag">' +
                        '<defs><clipPath id="' + clipId + '"><path d="M46 40H174C174 112 146 156 110 156C74 156 46 112 46 40Z"/></clipPath>' +
                        '<linearGradient id="' + clipId + '-g" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset=".4" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs>' +
                        '<circle class="bp-gloed" cx="110" cy="110" r="108"/>' +
                        '<g class="bp-kelk__fles"><g transform="translate(0 22)"><path d="M150 -60L218 -6L206 8L138 -46Z" class="bp-kelk__flespad"/><path d="M138 -46L126 -36" class="bp-l"/></g></g>' +
                        '<path class="bp-kelk__straal" d="M128 -14C120 4 112 20 110 40" style="stroke:' + bierKleur + '"/>' +
                        '<g clip-path="url(#' + clipId + ')">' +
                            '<g class="bp-kelk__inhoud">' +
                                '<rect class="bp-kelk__bier" x="40" y="' + vloeistofTop + '" width="140" height="' + (160 - vloeistofTop) + '" fill="' + bierKleur + '"/>' +
                                '<rect class="bp-kelk__waas" x="40" y="' + vloeistofTop + '" width="140" height="' + (160 - vloeistofTop) + '"/>' +
                                '<rect x="40" y="' + vloeistofTop + '" width="140" height="' + (160 - vloeistofTop) + '" fill="url(#' + clipId + '-g)"/>' +
                                '<g class="bp-kelk__parels"><circle cx="96" cy="150" r="1.5"/><circle cx="110" cy="152" r="1.2"/><circle cx="124" cy="150" r="1.6"/><circle cx="104" cy="152" r="1"/><circle cx="118" cy="153" r="1.3"/></g>' +
                                '<rect class="bp-kelk__schuim" x="40" y="38" width="140" height="' + (schuimH + 2) + '" fill="' + schuimKleur + '"/>' +
                            '</g>' +
                        '</g>' +
                        '<path class="bp-kelk__kraag" d="M46 40C52 ' + (36 - schuimH * 0.25) + ' 64 ' + (34 - schuimH * 0.2) + ' 74 37C84 ' + (31 - schuimH * 0.2) + ' 98 ' + (32 - schuimH * 0.25) + ' 108 36C118 ' + (30 - schuimH * 0.22) + ' 134 ' + (31 - schuimH * 0.2) + ' 142 37C152 ' + (32 - schuimH * 0.2) + ' 168 ' + (34 - schuimH * 0.2) + ' 174 40Z" fill="' + schuimKleur + '"/>' +
                        '<g class="bp-kelk__overloop"><path d="M50 42C44 60 46 80 50 96M170 44C176 66 174 84 168 104" stroke="' + schuimKleur + '"/></g>' +
                        '<path class="bp-l" d="M46 40H174C174 112 146 156 110 156C74 156 46 112 46 40Z" fill="none"/>' +
                        '<use href="#bp-sym-r" class="bp-kelk__r" x="94" y="82" width="32" height="36"/>' +
                        '<path class="bp-glans" d="M58 52C58 84 70 116 84 134"/>' +
                        '<path class="bp-l" d="M110 156V226"/>' +
                        '<path class="bp-l bp-v" d="M64 236C64 226 156 226 156 236C156 242 64 242 64 236Z"/>' +
                    '</svg>' +
                    '<p class="bp-resultaat__kleur"><i style="background:' + bierKleur + '"></i><span>' + B.kleurNaam(u.ebc) + '</span><span class="bp-resultaat__ebc">· ' + rond(u.ebc) + ' EBC</span></p>' +
                '</div>' +
                '<div class="bp-resultaat__tekst">' +
                    '<div class="bp-resultaat__score">' +
                        schijf(u.totaal, 'bp-schijf--groot', ' data-eindschijf') +
                        '<div class="bp-resultaat__rangvak">' +
                            '<div class="bp-resultaat__label">Brouwmeester-score</div>' +
                            '<h3 class="bp-resultaat__rang logo-font">' + rang(u.totaal) + '</h3>' +
                            (o.test ? '' : nieuwRecord ? '<p class="bp-resultaat__record"><i class="fas fa-trophy" aria-hidden="true"></i> Nieuw record<span class="bp-resultaat__voor"> voor de ' + r.kort + '</span>!</p>' : '<p class="bp-resultaat__record is-oud">Jouw beste: ' + beste[r.id] + '%</p>') +
                        '</div>' +
                    '</div>' +
                    '<blockquote class="bp-notitie">' +
                        '<div class="bp-notitie__kop"><i class="fas fa-feather-pointed" aria-hidden="true"></i> Proefnotitie van de hoofdbrouwer</div>' +
                        '<p class="bp-notitie__hoofd">“' + (notitie.opening ? '<span class="bp-notitie__opening">' + notitie.opening + ' </span>' : '') + notitie.kern + '”</p>' +
                        (notitie.extra.length ? '<ul class="bp-notitie__extra">' + notitie.extra.map(function (e) { return '<li>' + e + '</li>'; }).join('') + '</ul>' : '') +
                    '</blockquote>' +
                    '<dl class="bp-vergelijk" aria-label="Jouw bier vergeleken met het recept">' +
                        cel('Kleur', rond(u.ebc) + ' EBC', r.ebc + ' EBC', bierKleur) +
                        cel('Bitter', rond(u.ibu) + ' IBU', r.ibu + ' IBU') +
                        cel('Alcohol', B.getal(u.abv, 1) + '%', B.getal(r.abv, 1) + '%') +
                        cel('Schuim', schuimNaam, 'stevig') +
                    '</dl>' +
                    '<button type="button" class="bp-spelknop bp-spelknop--tekst bp-resultaat__vergelijkknop" data-doelknop aria-haspopup="dialog"><i class="fas fa-bullseye" aria-hidden="true"></i> Vergelijk met het recept</button>' +
                    '<ul class="bp-resultaat__fasen" aria-label="Score per fase">' +
                        FASEN.map(function (f) { var sc = rond(u['p' + f.n]); return '<li class="' + scoreKlasse(sc) + '"><span class="bp-resultaat__fasenaam">' + f.naam + '</span><span class="bp-resultaat__fasekort">' + f.kort + '</span><b>' + sc + '%</b></li>'; }).join('') +
                    '</ul>' +
                '</div>' +
            '</div>' +
            '<div class="bp-spelbord__dock" data-spel-dock></div>' +
            sheetHtml());
        tekenDoelkaart();
        zetFase('klaar');
        scherm.setAttribute('data-spel-fase', 'resultaat');
        zetDeel('resultaat');
        var proost = zetDock({
            links: [
                { hulp: 'resultaat' },
                { tekst: 'Nog een keer', icoon: 'fa-rotate-left', label: 'Nog een keer de ' + r.kort + ' brouwen', actie: function () { start(r.id); } },
                { tekst: 'Ander recept', icoon: 'fa-beer-mug-empty', label: 'Ander recept kiezen', actie: function () { G.speel('tak'); toonKeuze(); zetFocus($('[data-primair]')); } }
            ],
            primair: { tekst: 'Proost! Naar het einde', glans: true, actie: function () { G.speel('klik'); ga('einde'); } }
        });

        var kelk = $('.bp-kelk');
        var schijfEl = $('[data-eindschijf]');
        var scoreEl = $('[data-eindscore]');
        function eindstand() {
            scoreEl.innerHTML = u.totaal + '<small>%</small>';
            schijfEl.style.setProperty('--s', (u.totaal / 100).toFixed(3));
        }
        if (o.direct) {
            kelk.classList.add('is-direct', 'is-schenken', 'is-vol');
            eindstand();
        } else {
            requestAnimationFrame(function () { kelk.classList.add('is-schenken'); });
            G.speel('inschenken', { duur: 2.2 });
            later(function () {
                kelk.classList.add('is-vol');
                if (B.minderBeweging()) { eindstand(); G.speel(u.totaal >= 80 ? 'fanfare' : 'succes'); }
                else {
                    var begin = performance.now();
                    (function tel(nu) {
                        if (!scoreEl.isConnected) return;
                        var d = B.klem((nu - begin) / 1200, 0, 1);
                        var waarde = Math.round(u.totaal * (1 - Math.pow(1 - d, 3)));
                        scoreEl.innerHTML = waarde + '<small>%</small>';
                        schijfEl.style.setProperty('--s', (waarde / 100).toFixed(3));
                        if (d < 1) requestAnimationFrame(tel);
                        else G.speel(u.totaal >= 80 ? 'fanfare' : 'succes');
                    })(begin);
                }
                B.melding('Je ' + klein(r.stijl) + ' is klaar. Brouwmeester-score ' + u.totaal + ' procent: ' + rang(u.totaal) + '. ' + notitie.hoofd);
            }, B.minderBeweging() ? 50 : 2300);
            later(function () { zetFocus(proost); }, 80);
        }
        pasIn();
    }

    /* ==================================================================
       Test-API en koppeling met de app
       ================================================================== */
    /* Een brouwsel tot (niet met) de gevraagde fase, met nette waarden. */
    function simuleer(id, tot) {
        S = nieuweStatus(id);
        var r = S.recept;
        var i = tot === 'resultaat' ? 7 : ['storten', 'schroten', 'maischen', 'hop', 'gist', 'suiker', 'aftappen'].indexOf(tot);
        if (i > 0) { S.mout = { pils: +(r.mengsel.pils * 0.98).toFixed(1), karamel: r.mengsel.karamel, chocolade: r.mengsel.chocolade }; }
        if (i > 1) { S.fijn = 54; S.klaar[1] = true; }
        if (i > 2) { S.maisch = { inZone: 15.6, gescoord: 17, teHeet: 0.9, teKoud: 0.5 }; S.klaar[2] = true; }
        if (i > 3) { S.hop = { bitter: 59, aroma: 4 }; S.klaar[3] = true; }
        if (i > 4) { S.gistTemp = 21.4; }
        if (i > 5) { S.suiker = r.suiker; }
        if (i > 6) { S.vulling = 91; S.klaar[4] = true; }
    }
    var FASE_FN = { storten: faseStorten, schroten: faseSchroten, maischen: faseMaischen, hop: faseHop, gist: faseGist, suiker: faseSuiker, aftappen: faseAftappen };
    function naFrames() {
        return new Promise(function (klaar) {
            requestAnimationFrame(function () { requestAnimationFrame(function () { pasIn(); klaar(); }); });
        });
    }

    B.spel = {
        fases: function () { return DELEN.slice(); },
        /* toon(fase, { recept, uitleg: false }): direct naar een spelscherm.
           Fases openen zoals een speler ze ziet: met de uitlegkaart. Met
           uitleg:false staat de fase meteen klaar om te spelen. */
        toon: function (fase, o) {
            o = o || {};
            if (DELEN.indexOf(fase) < 0) return Promise.reject(new Error('Onbekende spelfase: ' + fase));
            stopAlles();
            var id = o.recept && D.recepten[o.recept] ? o.recept : keuzeId;
            if (fase === 'kies') toonKeuze();
            else if (fase === 'resultaat') { simuleer(id, 'resultaat'); toonResultaat({ direct: true, test: true }); }
            else {
                simuleer(id, fase);
                schil();
                var spelen = FASE_FN[fase]();
                if (o.uitleg === false) { sluitLaag(false); spelen(); }
            }
            return naFrames();
        },
        pauze: function () { pauzeer(); },
        hervat: hervat,
        resultaat: function () { return laatste; },
        status: function () {
            return {
                scherm: bord ? bord.getAttribute('data-scherm') : null,
                deel: bord ? bord.getAttribute('data-deel') : null,
                recept: S ? S.recept.id : keuzeId,
                klok: klok,
                gepauzeerd: !!pauze
            };
        }
    };
    if (B.scenes && B.scenes.bijWissel) {
        B.scenes.bijWissel(function (id, vorige) {
            var vorigId = vorige && typeof vorige === 'object' ? vorige.id : vorige;
            if (id !== 'spel' && (vorigId === 'spel' || vorigId == null)) pauzeer();
            if (id === 'spel') pasStraks();
        });
    }

    toonKeuze();
    window.addEventListener('pagehide', stopAlles);
})();
