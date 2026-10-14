/* =====================================================================
   Brouwerij Rolduc — Het brouwproces: kern

   Gedeelde hulpmiddelen voor het verhaal, de proefjes en de game:
     - rekenen: klem, lerp, bierkleur uit EBC, moutkleur (Morey)
     - opslag in de browser (veilig: werkt ook als dat geblokkeerd is)
     - Brouw.lus        animatielus die stopt buiten beeld
     - Brouw.schuif     schuifregelaar (aanraken, muis, toetsenbord)
     - Brouw.draaiknop  draaiknop
     - Brouw.vasthouden knop die iets doet zolang je hem ingedrukt houdt

   Alles werkt met aanraken (iPad), muis en toetsenbord, zonder :hover.
   ===================================================================== */

(function () {
    'use strict';

    var B = window.Brouw = window.Brouw || {};

    /* ------------------------------------------------------------------
       Rekenen
       ------------------------------------------------------------------ */
    B.klem = function (v, min, max) { return v < min ? min : (v > max ? max : v); };
    B.lerp = function (a, b, t) { return a + (b - a) * t; };
    B.kaart = function (v, a1, b1, a2, b2) { return a2 + (b2 - a2) * B.klem((v - a1) / (b1 - a1), 0, 1); };
    B.kies = function (lijst) { return lijst[Math.floor(Math.random() * lijst.length)]; };

    B.getal = function (n, decimalen) {
        decimalen = decimalen == null ? 0 : decimalen;
        return Number(n).toLocaleString('nl-NL', { minimumFractionDigits: decimalen, maximumFractionDigits: decimalen });
    };

    B.minderBeweging = function () {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    };

    B.trillen = function (ms) {
        try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch (e) { /* niet erg */ }
    };

    /* ------------------------------------------------------------------
       Bierkleur. Standaard SRM-kleurentabel (1–40), EBC = SRM × 1,97.
       ------------------------------------------------------------------ */
    var SRM = ['#FFE699', '#FFD878', '#FFCA5A', '#FFBF42', '#FBB123', '#F8A600', '#F39C00', '#EA8F00', '#E58500', '#DE7C00',
        '#D77200', '#CF6900', '#CB6200', '#C35900', '#BB5100', '#B54C00', '#B04500', '#A63E00', '#A13700', '#9B3200',
        '#952D00', '#8E2900', '#882300', '#821E00', '#7B1A00', '#771900', '#701400', '#6A0E00', '#660D00', '#5E0B00',
        '#5A0A02', '#560A05', '#520907', '#4C0505', '#470606', '#440607', '#3F0708', '#3B0607', '#3A070B', '#36080A'];

    function hexNaarRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    function rgbNaarHex(r) { return '#' + r.map(function (c) { return ('0' + Math.round(c).toString(16)).slice(-2); }).join(''); }
    function meng(a, b, t) { var x = hexNaarRgb(a), y = hexNaarRgb(b); return rgbNaarHex([0, 1, 2].map(function (i) { return B.lerp(x[i], y[i], t); })); }
    B.mengKleur = meng;

    B.ebcNaarKleur = function (ebc) {
        var srm = B.klem(ebc / 1.97, 1, 40);
        var i = Math.floor(srm) - 1, t = srm - Math.floor(srm);
        if (i >= SRM.length - 1) return SRM[SRM.length - 1];
        return meng(SRM[i], SRM[i + 1], t);
    };

    /* Schuim: van romig wit (blond) naar lichtbruin (donker bier). */
    B.schuimKleur = function (ebc) {
        return meng('#FFF9EC', '#D7B98E', B.klem((ebc - 8) / 80, 0, 1));
    };

    B.kleurNaam = function (ebc) {
        if (ebc < 1) return 'Geen bier';
        if (ebc < 8) return 'Strogeel';
        if (ebc < 16) return 'Goudblond';
        if (ebc < 26) return 'Amber';
        if (ebc < 40) return 'Koperrood';
        if (ebc < 55) return 'Robijnbruin';
        if (ebc < 75) return 'Kastanjebruin';
        return 'Zwart als de nacht';
    };

    /* Moutkleur van een brouwsel via de formule van Morey.
       mout: { pils: kg, karamel: kg, chocolade: kg }, liters: brouwsel. */
    B.moutEbc = function (mout, liters) {
        var soorten = (window.BROUWPROCES || {}).mout || {};
        liters = liters || 100;
        var mcu = 0;
        Object.keys(mout).forEach(function (k) {
            var s = soorten[k];
            if (!s) return;
            var lovibond = (s.kleur + 1.2) / 2.65;
            mcu += mout[k] * 2.20462 * lovibond;
        });
        mcu /= liters / 3.78541;
        if (mcu <= 0) return 0;
        return 1.4922 * Math.pow(mcu, 0.6859) * 1.97;
    };

    /* ------------------------------------------------------------------
       Opslag (functioneel, per bezoeker; mag mislukken)
       ------------------------------------------------------------------ */
    B.opslag = {
        lees: function (sleutel, standaard) {
            try {
                var ruw = localStorage.getItem(sleutel);
                return ruw == null ? standaard : JSON.parse(ruw);
            } catch (e) { return standaard; }
        },
        schrijf: function (sleutel, waarde) {
            try { localStorage.setItem(sleutel, JSON.stringify(waarde)); } catch (e) { /* privémodus */ }
        }
    };

    /* ------------------------------------------------------------------
       DOM
       ------------------------------------------------------------------ */
    B.maak = function (html) {
        var t = document.createElement('template');
        t.innerHTML = html.trim();
        return t.content.firstElementChild;
    };

    var teller = 0;
    B.uniekId = function (voorvoegsel) { teller += 1; return (voorvoegsel || 'bp') + '-' + teller; };

    B.melding = function (tekst) {
        var el = document.getElementById('bp-melding');
        if (!el) return;
        el.textContent = '';
        setTimeout(function () { el.textContent = tekst; }, 30);
    };

    /* ------------------------------------------------------------------
       Animatielus: draait alleen als het element in beeld is en het
       tabblad zichtbaar is. stap(dt, tijd) met dt in seconden.
       ------------------------------------------------------------------ */
    B.lus = function (stap, element) {
        var actief = false, rafId = 0, vorige = 0, inBeeld = true;

        function frame(t) {
            rafId = 0;
            if (!actief) return;
            var dt = vorige ? Math.min(0.05, (t - vorige) / 1000) : 1 / 60;
            vorige = t;
            stap(dt, t);
            if (actief && inBeeld && !document.hidden) rafId = requestAnimationFrame(frame);
            else vorige = 0;
        }
        function plan() {
            if (!rafId && actief && inBeeld && !document.hidden) { vorige = 0; rafId = requestAnimationFrame(frame); }
        }
        if (element && 'IntersectionObserver' in window) {
            new IntersectionObserver(function (items) {
                inBeeld = items[items.length - 1].isIntersecting;
                plan();
            }).observe(element);
        }
        document.addEventListener('visibilitychange', plan);

        return {
            start: function () { actief = true; plan(); },
            stop: function () { actief = false; if (rafId) cancelAnimationFrame(rafId); rafId = 0; vorige = 0; },
            loopt: function () { return actief; }
        };
    };

    /* ------------------------------------------------------------------
       Schuifregelaar
       opties: label, min, max, stap, waarde, opmaak(v), waardeTekst(v),
               orientatie ('h' | 'v'), zones [{van, tot, klasse}],
               klasse, bijWijziging(v, bron), labelVerbergen
       ------------------------------------------------------------------ */
    B.schuif = function (houder, o) {
        var vert = o.orientatie === 'v';
        var min = o.min, max = o.max, stap = o.stap || 1;
        var waarde = o.waarde != null ? o.waarde : min;
        var id = B.uniekId('schuif');

        var el = B.maak(
            '<div class="bp-schuif' + (vert ? ' bp-schuif--v' : '') + (o.klasse ? ' ' + o.klasse : '') + '">' +
                '<div class="bp-schuif__kop' + (o.labelVerbergen ? ' sr-only' : '') + '">' +
                    '<span class="bp-schuif__label" id="' + id + '"></span>' +
                    '<output class="bp-schuif__waarde" aria-hidden="true"></output>' +
                '</div>' +
                '<div class="bp-schuif__baan" role="slider" tabindex="0" aria-labelledby="' + id + '"' +
                    (vert ? ' aria-orientation="vertical"' : '') + '>' +
                    '<div class="bp-schuif__spoor"><div class="bp-schuif__zones"></div><div class="bp-schuif__vulling"></div></div>' +
                    '<div class="bp-schuif__duim"><span></span></div>' +
                '</div>' +
            '</div>');
        el.querySelector('.bp-schuif__label').textContent = o.label || '';
        var baan = el.querySelector('.bp-schuif__baan');
        var uitvoer = el.querySelector('.bp-schuif__waarde');
        baan.setAttribute('aria-valuemin', min);
        baan.setAttribute('aria-valuemax', max);

        if (o.zones) {
            var zones = el.querySelector('.bp-schuif__zones');
            o.zones.forEach(function (z) {
                var zone = document.createElement('span');
                zone.className = 'bp-schuif__zone ' + (z.klasse || '');
                var a = (z.van - min) / (max - min), b = (z.tot - min) / (max - min);
                zone.style.setProperty('--a', a);
                zone.style.setProperty('--b', b);
                zones.appendChild(zone);
            });
        }

        function rond(v) { return Math.round(v / stap) * stap; }

        function zet(v, bron) {
            v = B.klem(rond(v), min, max);
            var veranderd = v !== waarde;
            waarde = v;
            var f = (v - min) / (max - min);
            el.style.setProperty('--f', f);
            baan.setAttribute('aria-valuenow', v);
            var tekst = o.opmaak ? o.opmaak(v) : String(v);
            uitvoer.textContent = tekst;
            baan.setAttribute('aria-valuetext', o.waardeTekst ? o.waardeTekst(v) : tekst);
            if (bron !== 'stil' && o.bijWijziging && (veranderd || bron === 'start')) o.bijWijziging(v, bron);
        }

        var spoor = el.querySelector('.bp-schuif__spoor');
        function vanPositie(e) {
            var r = spoor.getBoundingClientRect();
            var f = vert ? 1 - (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
            zet(min + B.klem(f, 0, 1) * (max - min), 'aanwijzer');
        }

        // Aanraken: een verticale veeg over een horizontale schuif moet de
        // pagina laten scrollen. Pas als de vinger duidelijk zijwaarts gaat,
        // pakken we hem. Een korte tik springt naar die plek.
        var bezig = false, kandidaat = null;
        baan.addEventListener('pointerdown', function (e) {
            if (e.button > 0) return;
            if (e.pointerType === 'touch' && !vert) {
                kandidaat = { x: e.clientX, y: e.clientY, id: e.pointerId, e: e };
                return;
            }
            e.preventDefault();
            baan.focus({ preventScroll: true });
            bezig = true;
            el.classList.add('is-actief');
            try { baan.setPointerCapture(e.pointerId); } catch (x) { /* oudere browsers */ }
            vanPositie(e);
        });
        baan.addEventListener('pointermove', function (e) {
            if (kandidaat && !bezig) {
                var dx = Math.abs(e.clientX - kandidaat.x), dy = Math.abs(e.clientY - kandidaat.y);
                if (dx > 6 && dx > dy) {
                    bezig = true;
                    el.classList.add('is-actief');
                    try { baan.setPointerCapture(e.pointerId); } catch (x) { /* */ }
                } else if (dy > 8) {
                    kandidaat = null;
                }
            }
            if (bezig) vanPositie(e);
        });
        function los(e) {
            if (kandidaat && !bezig && e.type === 'pointerup') vanPositie(e);
            kandidaat = null;
            if (!bezig) return;
            bezig = false;
            el.classList.remove('is-actief');
            if (o.bijLoslaten) o.bijLoslaten(waarde);
        }
        baan.addEventListener('pointerup', los);
        baan.addEventListener('pointercancel', los);
        baan.addEventListener('lostpointercapture', los);

        baan.addEventListener('keydown', function (e) {
            var groot = Math.max(stap, (max - min) / 10);
            var nieuw = null;
            switch (e.key) {
                case 'ArrowRight': case 'ArrowUp': nieuw = waarde + stap; break;
                case 'ArrowLeft': case 'ArrowDown': nieuw = waarde - stap; break;
                case 'PageUp': nieuw = waarde + groot; break;
                case 'PageDown': nieuw = waarde - groot; break;
                case 'Home': nieuw = min; break;
                case 'End': nieuw = max; break;
            }
            if (nieuw == null) return;
            e.preventDefault();
            zet(nieuw, 'toets');
            if (o.bijLoslaten) o.bijLoslaten(waarde);
        });

        houder.appendChild(el);
        zet(waarde, 'stil');

        return {
            el: el,
            zet: function (v, stil) { zet(v, stil ? 'stil' : 'code'); },
            waarde: function () { return waarde; },
            uit: function (uit) { baan.setAttribute('aria-disabled', uit ? 'true' : 'false'); el.classList.toggle('is-uit', !!uit); }
        };
    };

    /* ------------------------------------------------------------------
       Draaiknop. Draai met je vinger rond de knop (relatief, dus geen
       sprongen als je hem ergens anders vastpakt), of gebruik de pijltjes.
       ------------------------------------------------------------------ */
    B.draaiknop = function (houder, o) {
        var min = o.min, max = o.max, stap = o.stap || 1;
        var waarde = o.waarde != null ? o.waarde : min;
        var BEGIN = -135, EIND = 135;
        var id = B.uniekId('knop');

        var streepjes = '';
        for (var i = 0; i <= 12; i++) {
            var a = (BEGIN + (EIND - BEGIN) * i / 12) * Math.PI / 180;
            var r1 = 46, r2 = i % 3 === 0 ? 40 : 43;
            streepjes += 'M' + (50 + Math.sin(a) * r1).toFixed(1) + ' ' + (50 - Math.cos(a) * r1).toFixed(1) +
                'L' + (50 + Math.sin(a) * r2).toFixed(1) + ' ' + (50 - Math.cos(a) * r2).toFixed(1);
        }

        var el = B.maak(
            '<div class="bp-draaiknop' + (o.klasse ? ' ' + o.klasse : '') + '">' +
                '<span class="bp-draaiknop__label" id="' + id + '"></span>' +
                '<div class="bp-draaiknop__knop" role="slider" tabindex="0" aria-labelledby="' + id + '">' +
                    '<svg viewBox="0 0 100 100" aria-hidden="true">' +
                        '<path class="bp-draaiknop__streepjes" d="' + streepjes + '"/>' +
                        '<circle class="bp-draaiknop__ring" cx="50" cy="50" r="34"/>' +
                        '<g class="bp-draaiknop__kap"><circle cx="50" cy="50" r="28"/><path d="M50 26V38"/></g>' +
                    '</svg>' +
                '</div>' +
                '<output class="bp-draaiknop__waarde" aria-hidden="true"></output>' +
            '</div>');
        el.querySelector('.bp-draaiknop__label').textContent = o.label || '';
        var knop = el.querySelector('.bp-draaiknop__knop');
        var kap = el.querySelector('.bp-draaiknop__kap');
        var uitvoer = el.querySelector('.bp-draaiknop__waarde');
        knop.setAttribute('aria-valuemin', min);
        knop.setAttribute('aria-valuemax', max);

        var hoek = 0;
        function zet(v, bron) {
            v = B.klem(Math.round(v / stap) * stap, min, max);
            var veranderd = v !== waarde;
            waarde = v;
            hoek = BEGIN + (EIND - BEGIN) * (v - min) / (max - min);
            kap.style.transform = 'rotate(' + hoek + 'deg)';
            el.style.setProperty('--f', (v - min) / (max - min));
            knop.setAttribute('aria-valuenow', v);
            var tekst = o.opmaak ? o.opmaak(v) : String(v);
            uitvoer.textContent = tekst;
            knop.setAttribute('aria-valuetext', tekst);
            if (bron !== 'stil' && veranderd && o.bijWijziging) o.bijWijziging(v, bron);
        }

        var vorigeHoek = null, ruweHoek = 0;
        function hoekVan(e) {
            var r = knop.getBoundingClientRect();
            return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI;
        }
        knop.addEventListener('pointerdown', function (e) {
            if (e.button > 0) return;
            e.preventDefault();
            knop.focus({ preventScroll: true });
            try { knop.setPointerCapture(e.pointerId); } catch (x) { /* */ }
            vorigeHoek = hoekVan(e);
            ruweHoek = hoek;
            el.classList.add('is-actief');
        });
        knop.addEventListener('pointermove', function (e) {
            if (vorigeHoek == null) return;
            var h = hoekVan(e);
            var d = h - vorigeHoek;
            if (d > 180) d -= 360;
            if (d < -180) d += 360;
            vorigeHoek = h;
            ruweHoek = B.klem(ruweHoek + d, BEGIN, EIND);
            zet(min + (ruweHoek - BEGIN) / (EIND - BEGIN) * (max - min), 'aanwijzer');
        });
        function los() {
            if (vorigeHoek == null) return;
            vorigeHoek = null;
            el.classList.remove('is-actief');
        }
        knop.addEventListener('pointerup', los);
        knop.addEventListener('pointercancel', los);
        knop.addEventListener('lostpointercapture', los);
        knop.addEventListener('keydown', function (e) {
            var nieuw = null;
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nieuw = waarde + stap;
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nieuw = waarde - stap;
            else if (e.key === 'PageUp') nieuw = waarde + stap * 5;
            else if (e.key === 'PageDown') nieuw = waarde - stap * 5;
            else if (e.key === 'Home') nieuw = min;
            else if (e.key === 'End') nieuw = max;
            if (nieuw == null) return;
            e.preventDefault();
            zet(nieuw, 'toets');
        });

        houder.appendChild(el);
        zet(waarde, 'stil');
        return { el: el, zet: function (v, stil) { zet(v, stil ? 'stil' : 'code'); }, waarde: function () { return waarde; } };
    };

    /* ------------------------------------------------------------------
       Vasthouden: start() bij indrukken, stop() bij loslaten. Werkt met
       vinger, muis en spatie/enter.
       ------------------------------------------------------------------ */
    B.vasthouden = function (knop, o) {
        var actief = false;
        function begin() {
            if (actief || knop.disabled) return;
            actief = true;
            knop.classList.add('is-ingedrukt');
            o.start();
        }
        function einde() {
            if (!actief) return;
            actief = false;
            knop.classList.remove('is-ingedrukt');
            o.stop();
        }
        knop.addEventListener('pointerdown', function (e) {
            if (e.button > 0) return;
            e.preventDefault();
            try { knop.setPointerCapture(e.pointerId); } catch (x) { /* */ }
            begin();
        });
        knop.addEventListener('pointerup', einde);
        knop.addEventListener('pointercancel', einde);
        knop.addEventListener('lostpointercapture', einde);
        knop.addEventListener('keydown', function (e) {
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); begin(); }
        });
        knop.addEventListener('keyup', function (e) {
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); einde(); }
        });
        knop.addEventListener('blur', einde);
        knop.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        return { stop: einde, actief: function () { return actief; } };
    };

    /* Vijf weergaven van één moutkorrel, van heel tot poeder (stap 2 en de
       game). Een groep met klasse bp-kf--N wordt getoond via data-fase. */
    B.korrelFases = function (x, y, r) {
        var t = 'translate(' + x + ' ' + y + ') rotate(' + r + ')';
        return '<g transform="' + t + '">' +
            '<g class="bp-kf bp-kf--0"><ellipse class="bp-kf__kaf" rx="15" ry="7.5"/><path class="bp-kf__lijn" d="M-12 0H12"/></g>' +
            '<g class="bp-kf bp-kf--1"><ellipse class="bp-kf__kaf" rx="15" ry="7.5"/><path class="bp-kf__barst" d="M-9 -3L-4 2L1 -3L5 3L10 -2"/></g>' +
            '<g class="bp-kf bp-kf--2"><path class="bp-kf__kaf" d="M-17 -1C-17 -8 -6 -9 -2 -6L-3 6C-8 8 -17 6 -17 -1Z"/><path class="bp-kf__meel" d="M-6 -4C-3 -2 -3 3 -5 5L-3 5L-2 -5Z"/>' +
                '<path class="bp-kf__kaf" d="M17 1C17 8 6 9 2 6L3 -6C8 -8 17 -6 17 1Z"/><path class="bp-kf__meel" d="M6 -4C3 -2 3 3 5 5L3 5L2 -5Z"/>' +
                '<circle class="bp-kf__gruis" cx="0" cy="-1" r="2"/><circle class="bp-kf__gruis" cx="1" cy="4" r="1.4"/></g>' +
            '<g class="bp-kf bp-kf--3"><path class="bp-kf__kaf" d="M-14 -4l6-3 3 5-6 3z"/><path class="bp-kf__meel" d="M2 -6l6 1-1 6-6-1z"/><path class="bp-kf__kaf" d="M8 4l6 2-3 4-5-2z"/>' +
                '<circle class="bp-kf__gruis" cx="-4" cy="6" r="2.4"/><circle class="bp-kf__gruis" cx="-9" cy="5" r="1.6"/><circle class="bp-kf__gruis" cx="3" cy="7" r="1.5"/><circle class="bp-kf__gruis" cx="-1" cy="-7" r="1.4"/></g>' +
            '<g class="bp-kf bp-kf--4"><path class="bp-kf__poeder" d="M-16 7C-10 -2 10 -2 16 7Z"/><circle class="bp-kf__gruis" cx="-6" cy="2" r="1"/><circle class="bp-kf__gruis" cx="5" cy="1" r="1"/><circle class="bp-kf__gruis" cx="0" cy="-1" r=".9"/>' +
                '<path class="bp-kf__snipper" d="M-12 -6l3 1M9 -5l3 2"/></g>' +
            '</g>';
    };

    /* Kleine helper voor SVG-elementen. */
    B.svg = function (tag, attr) {
        var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        if (attr) Object.keys(attr).forEach(function (k) { el.setAttribute(k, attr[k]); });
        return el;
    };

    B.kiosk = function () { return document.documentElement.classList.contains('is-kiosk'); };

    B.scrollGedrag = function () { return B.minderBeweging() ? 'auto' : 'smooth'; };

    /* Hoogte van de zwevende HUD (+ marge), om dingen niet onder de HUD te
       laten verdwijnen. */
    B.hudRuimte = function () {
        var hud = document.querySelector('[data-hud]');
        if (!hud || document.documentElement.classList.contains('is-start')) return 12;
        return hud.getBoundingClientRect().bottom + 12;
    };

    /* Zorg dat een element helemaal in beeld komt (onder de HUD). */
    B.inBeeld = function (el, marge) {
        var r = el.getBoundingClientRect();
        var boven = B.hudRuimte();
        marge = marge || 16;
        if (r.bottom > window.innerHeight - marge && r.height < window.innerHeight - boven - marge) {
            window.scrollBy({ top: r.bottom - window.innerHeight + marge, behavior: B.scrollGedrag() });
        } else if (r.top < boven) {
            window.scrollBy({ top: r.top - boven, behavior: B.scrollGedrag() });
        }
    };

    /* ------------------------------------------------------------------
       Vergrendelen: als er een laag open staat (startscherm, uitleg, lade,
       video, dialoog) is de rest van de pagina even niet bereikbaar.
       ------------------------------------------------------------------ */
    var lagen = 0;
    B.vergrendel = function (aan) {
        lagen = Math.max(0, lagen + (aan ? 1 : -1));
        var dicht = lagen > 0;
        ['.bp-hud', '.bp-main', '.bp-dock', '.bp-skip'].forEach(function (sel) {
            var el = document.querySelector(sel);
            if (!el) return;
            if (dicht) el.setAttribute('inert', ''); else el.removeAttribute('inert');
        });
        document.documentElement.classList.toggle('bp-vergrendeld', dicht);
    };

    /* Tab blijft binnen een open laag. */
    B.houdFocus = function (laag, e) {
        if (e.key !== 'Tab') return;
        var focusbaar = [].slice.call(laag.querySelectorAll('a[href], button:not([disabled]), video, [tabindex]:not([tabindex="-1"])'))
            .filter(function (el) { return el.getClientRects().length; });
        if (!focusbaar.length) return;
        var eerste = focusbaar[0], laatste = focusbaar[focusbaar.length - 1];
        if (e.shiftKey && (document.activeElement === eerste || !laag.contains(document.activeElement))) { e.preventDefault(); laatste.focus(); }
        else if (!e.shiftKey && (document.activeElement === laatste || !laag.contains(document.activeElement))) { e.preventDefault(); eerste.focus(); }
    };

    /* ------------------------------------------------------------------
       Succesmelding in een paneel: "62 °C bereikt! De suikers komen vrij."
       ------------------------------------------------------------------ */
    B.toast = function (binnen, tekst) {
        var houder = binnen.closest('.bp-doen__podium, .bp-podium, .bp-scherm') || binnen;
        var oud = houder.querySelector(':scope > .bp-toast');
        if (oud) oud.remove();
        var el = document.createElement('p');
        el.className = 'bp-toast';
        el.setAttribute('role', 'status');
        el.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i><span></span>';
        el.querySelector('span').textContent = tekst;
        houder.appendChild(el);
        if (B.geluid) B.geluid.speel('succes');
        B.trillen(20);
        setTimeout(function () { el.classList.add('is-weg'); }, 2600);
        setTimeout(function () { el.remove(); }, 3000);
    };

    /* ------------------------------------------------------------------
       Tip van de brouwer (de ?-knoppen)
       ------------------------------------------------------------------ */
    B.tip = (function () {
        var open = null;
        function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
        function sluit(focusTerug) {
            if (!open) return;
            var o = open;
            open = null;
            o.el.remove();
            o.knop.setAttribute('aria-expanded', 'false');
            if (focusTerug && document.body.contains(o.knop)) o.knop.focus({ preventScroll: true });
        }
        // De tip zweeft boven alles (in <body>, dus nooit binnen de bewegende
        // wereld) en wordt naast de knop gezet, altijd helemaal in beeld.
        function plaats(el, knop) {
            var m = 12, vw = window.innerWidth, vh = window.innerHeight;
            var hudOnder = 0, hud = document.querySelector('[data-hud]');
            if (hud && hud.getClientRects().length) hudOnder = Math.max(0, hud.getBoundingClientRect().bottom);
            var k = knop.getBoundingClientRect();
            var boven = Math.max(m, hudOnder + 6);
            // Telefoon: een kaart over de volle breedte, net boven de duimzone.
            if (vw < 768 && vh > 500) {
                var dock = document.querySelector('[data-dock]');
                var dockBoven = dock && !dock.hidden && dock.getClientRects().length ? dock.getBoundingClientRect().top : vh - m;
                el.style.width = (vw - 2 * 16) + 'px';
                el.style.left = '16px';
                var hm = el.offsetHeight;
                el.style.top = Math.round(Math.max(boven, Math.min(dockBoven, k.top) - 8 - hm)) + 'px';
                el.classList.add('is-kaart');
                return;
            }
            // Lage schermen (telefoon liggend): breder en dus minder hoog.
            if (vh < 520) el.style.width = Math.min(560, vw - 2 * m) + 'px';
            var b = el.offsetWidth, h = el.offsetHeight;
            var x = B.klem(k.left + k.width / 2 - b / 2, m, vw - m - b);
            var y;
            if (k.bottom + 10 + h <= vh - m) y = k.bottom + 10;
            else if (k.top - 10 - h >= boven) y = k.top - 10 - h;
            else y = B.klem((vh - h) / 2, boven, Math.max(boven, vh - m - h));
            el.style.left = Math.round(x) + 'px';
            el.style.top = Math.round(y) + 'px';
            el.style.setProperty('--pijl-x', Math.round(B.klem(k.left + k.width / 2 - x, 18, b - 18)) + 'px');
            el.classList.toggle('is-boven', y < k.top);
        }
        function toon(knop, houder, tekst) {
            if (open && open.knop === knop) { sluit(true); return; }
            sluit(false);
            if (!tekst) return;
            var id = B.uniekId('tip');
            var el = B.maak(
                '<div class="bp-tip" role="dialog" aria-modal="false" aria-labelledby="' + id + '">' +
                    '<p class="bp-tip__kop" id="' + id + '"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#bp-sym-r" width="24" height="24"/></svg> Tip van de brouwer</p>' +
                    '<h4>Wat doe je?</h4><p>' + esc(tekst.wat) + '</p>' +
                    '<h4>Waarom?</h4><p>' + esc(tekst.waarom) + '</p>' +
                    '<button type="button" class="bp-tip__ok"><i class="fas fa-check" aria-hidden="true"></i> Begrepen</button>' +
                '</div>');
            (houder || document.body).appendChild(el);
            plaats(el, knop);
            knop.setAttribute('aria-expanded', 'true');
            open = { knop: knop, el: el };
            el.querySelector('.bp-tip__ok').addEventListener('click', function () { sluit(true); });
            el.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); sluit(true); } });
            if (B.geluid) B.geluid.speel('klik');
            requestAnimationFrame(function () {
                if (open && open.el === el) plaats(el, knop);
                el.querySelector('.bp-tip__ok').focus({ preventScroll: true });
            });
        }
        window.addEventListener('resize', function () { if (open) plaats(open.el, open.knop); });
        // Tik ernaast: tip dicht.
        document.addEventListener('pointerdown', function (e) {
            if (open && !open.el.contains(e.target) && !open.knop.contains(e.target)) sluit(false);
        }, true);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) sluit(true); });
        return { toon: toon, sluit: sluit, isOpen: function () { return !!open; } };
    })();
})();
