/* =====================================================================
   Brouwerij Rolduc — De Brouwreis: scènes en camera

   De brouwzaal is één grote kaart, net als de poster. Elke scène-cel is
   precies één scherm groot. Navigeren = de camera glijdt langs de
   S-curve naar de volgende cel; de gouden leiding stroomt mee.

     1. Wereld opbouwen: cellen op hun plek (data-x / data-y)
     2. Camera en scènes: ga(id), volgende(), terug(), volgendeStap()
        Per station twee lagen: A (verhaal) en B (doen).
     3. Invoer: knoppen, toetsen, muiswiel/trackpad en vegen
     4. De gouden leiding: één buis door de hele wereld, berekend uit
        de ankerpunten [data-anker-in] / [data-anker-uit] per station
     5. HUD-voortgang, dock en hints
     6. Test-API: Brouw.scenes.lijst(), ga(id, {direct}), element(id)

   Op een telefoon (< 768px) is laag B een bottom sheet die je zelf
   opent ("Probeer het zelf"); vegen en "Volgende stap" slaan hem over.
   ===================================================================== */

(function () {
    'use strict';

    var B = window.Brouw;
    var D = window.BROUWPROCES || {};
    var html = document.documentElement;
    var camera = document.querySelector('[data-camera]');
    var wereld = camera && camera.querySelector('[data-wereld]');
    if (!B || !wereld) return;

    var mobiel = window.matchMedia('(max-width: 767.98px) and (min-height: 501px)');
    var hud = document.querySelector('[data-hud]');
    var dock = document.querySelector('[data-dock]');
    var dieptes = [].slice.call(camera.querySelectorAll('[data-diepte]'));

    /* ==================================================================
       1. Wereld
       ================================================================== */
    var cellen = [].slice.call(wereld.querySelectorAll('[data-cel]')).map(function (el) {
        return { el: el, id: el.getAttribute('data-cel'), x: parseFloat(el.getAttribute('data-x')) || 0, y: parseFloat(el.getAttribute('data-y')) || 0, stap: el.hasAttribute('data-stap') ? +el.getAttribute('data-stap') : null };
    });
    var minX = Math.min.apply(null, cellen.map(function (c) { return c.x; }));
    var minY = Math.min.apply(null, cellen.map(function (c) { return c.y; }));
    var maxX = Math.max.apply(null, cellen.map(function (c) { return c.x; }));
    var maxY = Math.max.apply(null, cellen.map(function (c) { return c.y; }));

    var scenes = [], perId = {};
    cellen.forEach(function (cel) {
        [].slice.call(cel.el.querySelectorAll('[data-scene]')).forEach(function (el) {
            var id = el.getAttribute('data-scene');
            var s = { id: id, el: el, cel: cel, stap: cel.stap, laag: /b$/.test(id) && cel.stap ? 'b' : 'a', index: scenes.length };
            scenes.push(s);
            perId[id] = s;
        });
    });

    var W = 0, H = 0;
    function meet() {
        W = camera.clientWidth || window.innerWidth;
        H = window.innerHeight;
        html.style.setProperty('--vw', W + 'px');
        html.style.setProperty('--vh', H + 'px');
        wereld.style.width = (maxX - minX + 1) * W + 'px';
        wereld.style.height = (maxY - minY + 1) * H + 'px';
        cellen.forEach(function (c) {
            c.el.style.left = (c.x - minX) * W + 'px';
            c.el.style.top = (c.y - minY) * H + 'px';
        });
    }

    /* Voorgrond: hopbladeren en -bellen die tijdens een camerareis door het
       beeld waaien. Ze staan op een laag die sneller beweegt dan de wereld
       (parallax) en zo dat ze in rust bij geen enkele cel in beeld zijn. */
    var voorgrond = camera.querySelector('.bp-diepte--dichtbij');
    function strooiVoorgrond() {
        if (!voorgrond || B.minderBeweging()) return;
        var f = parseFloat(voorgrond.getAttribute('data-diepte')) || 1.6;
        voorgrond.textContent = '';
        var maat = Math.round(B.klem(Math.min(W, H) * 0.16, 70, 150));
        var rusten = cellen.map(camPositie);
        function inBeeld(x, y) {
            return rusten.some(function (c) {
                var sx = x - c.x * f, sy = y - c.y * f;
                return sx > -maat * 1.2 && sx < W + maat * 0.2 && sy > -maat * 1.2 && sy < H + maat * 0.2;
            });
        }
        var nr = 0;
        for (var i = 0; i < cellen.length - 1; i++) {
            var a = camPositie(cellen[i]), b = camPositie(cellen[i + 1]);
            [[0.32, 0.22], [0.62, 0.7], [0.18, 0.55]].forEach(function (o, j) {
                var x = f * (a.x + b.x) / 2 + W * o[0], y = f * (a.y + b.y) / 2 + H * o[1];
                if (inBeeld(x, y)) return;
                nr += 1;
                var bel = (i + j) % 2 === 0;
                var el = document.createElementNS(NS, 'svg');
                el.setAttribute('class', 'bp-voorgrond ' + (bel ? 'bp-voorgrond--bel' : 'bp-voorgrond--blad'));
                el.setAttribute('viewBox', bel ? '-50 -70 100 140' : '-60 -60 120 120');
                el.setAttribute('aria-hidden', 'true');
                el.style.cssText = 'left:' + Math.round(x) + 'px;top:' + Math.round(y) + 'px;width:' + maat + 'px;height:' + Math.round(bel ? maat * 1.4 : maat) + 'px;transform:rotate(' + ((nr * 47) % 80 - 40) + 'deg)';
                var use = document.createElementNS(NS, 'use');
                use.setAttribute('href', bel ? '#bp-sym-hopbel' : '#bp-sym-hopblad');
                // Zonder maat tekent <use> het symbool vanaf 0,0 en zie je maar een kwart.
                if (bel) { use.setAttribute('x', -50); use.setAttribute('y', -70); use.setAttribute('width', 100); use.setAttribute('height', 140); }
                else { use.setAttribute('x', -60); use.setAttribute('y', -60); use.setAttribute('width', 120); use.setAttribute('height', 120); }
                el.appendChild(use);
                voorgrond.appendChild(el);
            });
        }
    }

    // Focus of een anker mag de camera nooit verschuiven.
    camera.addEventListener('scroll', function () { camera.scrollLeft = 0; camera.scrollTop = 0; });

    /* ==================================================================
       2. Camera en scènes
       ================================================================== */
    var huidig = null;
    var reisTimer = 0, reisKlaar = null;
    var luisteraars = [];

    function camPositie(cel) { return { x: (cel.x - minX) * W, y: (cel.y - minY) * H }; }

    function zetCamera(cel, duur) {
        var p = camPositie(cel);
        var t = duur ? 'transform ' + duur + 'ms cubic-bezier(.65, .02, .3, 1)' : 'none';
        wereld.style.transition = t;
        wereld.style.transform = 'translate3d(' + (-p.x) + 'px,' + (-p.y) + 'px,0)';
        dieptes.forEach(function (laag) {
            var f = parseFloat(laag.getAttribute('data-diepte')) || 0.5;
            laag.style.transition = t;
            laag.style.transform = 'translate3d(' + (-p.x * f) + 'px,' + (-p.y * f) + 'px,0)';
        });
    }

    function reisduur(van, naar) {
        if (!van || van === naar) return 0;
        var d = Math.sqrt(Math.pow(van.x - naar.x, 2) + Math.pow(van.y - naar.y, 2));
        return Math.round(B.klem(650 + d * 380, 800, 1500));
    }

    function stapNaam(n) {
        var cel = cellen.filter(function (c) { return c.stap === n; })[0];
        return cel ? cel.el.getAttribute('data-kort') : '';
    }

    function hashVoor(s) {
        if (s.stap) return '#stap-' + s.stap + (s.laag === 'b' ? '-doen' : '');
        if (s.id === 'spel') return '#brouwmeester';
        return '#' + s.id;
    }
    function sceneVoorHash(h) {
        h = (h || '').replace(/^#/, '');
        var m = /^stap-([1-9])(-doen)?$/.exec(h);
        if (m) return perId[m[1] + (m[2] ? 'b' : 'a')];
        if (h === 'brouwmeester' || h === 'spel' || h === 'finale') return perId.spel;
        return perId[h] || null;
    }

    function zetInert(el, aan) {
        if (aan) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
        else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
    }

    function ga(id, o) {
        o = o || {};
        var s = typeof id === 'string' ? perId[id] : id;
        if (!s) return Promise.resolve();
        if (s === huidig && !o.forceer) return Promise.resolve();
        var vorige = huidig;
        huidig = s;
        B.tip.sluit(false);
        verbergHint();

        var nieuweCel = !vorige || vorige.cel !== s.cel;
        var direct = !!o.direct || !vorige;
        var duur = direct ? 0 : (nieuweCel ? reisduur(vorige.cel, s.cel) : 620);
        var rustig = B.minderBeweging() && !direct;

        if (direct) html.classList.add('is-direct');
        // Tijdens een reis (en heel even erna) telt nieuwe navigatie niet:
        // een dubbeltik of twee snelle vegen springen zo niet twee stappen.
        // Binnen één station (verhaal ↔ zelf doen) kort, tussen stations de hele reis.
        reisTot = direct ? 0 : performance.now() + (nieuweCel ? (rustig ? 200 : Math.max(duur, 620)) + 150 : 350);
        if (!direct && nieuweCel) html.classList.add('is-reizend');

        // Cellen: alleen de huidige is bereikbaar; buren blijven levend. De
        // cel waar je vandaan komt blijft zichtbaar tot de camera er weg is.
        cellen.forEach(function (c) { c.el.classList.remove('is-vertrek'); });
        if (vorige && nieuweCel && !direct) vorige.cel.el.classList.add('is-vertrek');
        cellen.forEach(function (c) {
            var hier = c === s.cel;
            c.el.classList.toggle('is-huidig', hier);
            c.el.classList.toggle('is-buur', !hier && Math.abs(c.x - s.cel.x) <= 1.01 && Math.abs(c.y - s.cel.y) <= 1.01);
            zetInert(c.el, !hier);
        });
        scenes.forEach(function (sc) {
            if (sc.cel !== s.cel) return;
            var actief = sc === s || (mobiel.matches && s.laag === 'b' && sc.laag === 'a');
            sc.el.classList.toggle('is-actief', sc === s);
            zetInert(sc.el, !actief || (mobiel.matches && s.laag === 'b' && sc.laag === 'a'));
        });
        if (s.cel.stap) s.cel.el.setAttribute('data-laag', s.laag);
        // Eerste bezoek: de omtrekken van de ketel tekenen zichzelf.
        s.cel.el.classList.add('is-zichtbaar');
        html.setAttribute('data-huidige-scene', s.id);
        html.setAttribute('data-laag', s.laag);
        html.classList.toggle('is-sheet', mobiel.matches && s.laag === 'b');

        if (nieuweCel && vorige) {
            // De kaart van het vorige station begint de volgende keer weer kort.
            var oudeKaart = vorige.cel.el.querySelector('[data-verhaalkaart].is-lang');
            if (oudeKaart) {
                oudeKaart.classList.remove('is-lang');
                var lk = oudeKaart.querySelector('[data-lees]');
                lk.setAttribute('aria-expanded', 'false');
                lk.querySelector('[data-lees-tekst]').textContent = 'Lees het verhaal';
            }
        }
        if (nieuweCel) {
            if (rustig) {
                camera.classList.add('is-wissel');
                setTimeout(function () { zetCamera(s.cel, 0); camera.classList.remove('is-wissel'); }, 160);
            } else {
                zetCamera(s.cel, duur);
            }
            if (!direct) B.geluid.speel('zoef');
        }

        vulLeiding(direct ? 0 : duur);
        hudBij();
        dockBij();
        controllers(vorige, s);
        if (!o.geenHash) {
            try {
                var opent = mobiel.matches && s.laag === 'b' && vorige && vorige.laag === 'a' && vorige.cel === s.cel && !direct;
                if (opent) {
                    // Telefoon: de sheet krijgt een eigen plek in de geschiedenis,
                    // zodat de terugknop of -veeg van het systeem hem sluit.
                    history.pushState({ bpSheet: 1 }, '', hashVoor(s));
                    sheetInGeschiedenis = true;
                } else if (sheetInGeschiedenis && !(mobiel.matches && s.laag === 'b')) {
                    sheetInGeschiedenis = false;
                    negeerGeschiedenis = true;
                    history.back();
                    setTimeout(function () { negeerGeschiedenis = false; }, 600);
                } else {
                    history.replaceState(null, '', hashVoor(s));
                }
            } catch (e) { /* file:// in sommige browsers */ }
        }
        if (!direct) {
            var m = s.stap ? 'Stap ' + s.stap + ' van 9: ' + stapNaam(s.stap) + (s.laag === 'b' ? ', zelf doen' : '') : (s.el.getAttribute('aria-label') || '');
            if (m) B.melding(m);
        }

        // Direct (test, herladen, draaien): alles meteen in de eindstand. Eerst de
        // stijl laten doorrekenen, pas daarna mogen overgangen weer.
        if (direct) void document.body.offsetHeight;
        clearTimeout(reisTimer);
        if (reisKlaar) { reisKlaar(); reisKlaar = null; }
        return new Promise(function (klaar) {
            reisKlaar = klaar;
            var wacht = direct ? 0 : (rustig ? 200 : Math.max(duur, 620)) + 40;
            reisTimer = setTimeout(function () {
                html.classList.remove('is-reizend');
                aangekomen(s, vorige, !direct && !o.geenFocus);
                // Twee frames: layout en afbeeldingen staan stil.
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        html.classList.remove('is-direct');
                        if (reisKlaar === klaar) reisKlaar = null;
                        klaar();
                    });
                });
            }, wacht);
        });
    }

    function aangekomen(s, vorige, focus) {
        if (huidig !== s) return;
        cellen.forEach(function (c) { c.el.classList.remove('is-vertrek'); });
        // Telefoon: de ketel krimpt boven de sheet, dus de leiding moet mee.
        if (mobiel.matches && vorige && vorige.cel === s.cel) setTimeout(bouwLeiding, 60);
        // Toetsenbord in scène B: meteen naar de hoofd-hotspot van het proefje.
        if (focus && s.laag === 'b' && s.stap && laatsteInvoer === 'toets') {
            var c = ctrls[s.stap], doelEl = c && c.hint && c.hint.el;
            if (doelEl && doelEl.focus && s.el.contains(doelEl)) { doelEl.focus({ preventScroll: true }); focus = false; }
        }
        if (focus) {
            var actief = document.activeElement;
            var verloren = !actief || actief === document.body || (vorige && vorige.cel.el.contains(actief) && vorige.cel !== s.cel) || (actief.closest && actief.closest('[inert]'));
            if (verloren) {
                var kop = s.el.querySelector('[data-scene-kop]') || s.el.querySelector('h1, h2, h3');
                if (kop) {
                    kop.setAttribute('tabindex', '-1');
                    // Wie met vinger of muis reist, ziet geen focusrand; een
                    // schermlezer krijgt de kop wel.
                    if (laatsteInvoer !== 'toets') {
                        kop.classList.add('bp-zonder-ring');
                        kop.addEventListener('blur', function weg() { kop.classList.remove('bp-zonder-ring'); kop.removeEventListener('blur', weg); });
                    }
                    kop.focus({ preventScroll: true });
                }
            }
        }
        luisteraars.forEach(function (fn) { try { fn(s.id, vorige ? vorige.id : null); } catch (e) { /* luisteraar mag de reis niet breken */ } });
        hintPlannen();
    }

    function isMobielOver(s) {
        // Op de telefoon slaan vegen en "Volgende stap" laag B over.
        return mobiel.matches && s.laag === 'b';
    }
    function volgendeVan(s, stapsgewijs) {
        for (var i = s.index + 1; i < scenes.length; i++) {
            var k = scenes[i];
            if ((stapsgewijs || mobiel.matches) && isMobielOver(k)) continue;
            if (stapsgewijs && k.laag === 'b') continue;
            return k;
        }
        return null;
    }
    function vorigeVan(s) {
        if (s.laag === 'b') return perId[s.stap + 'a'];
        for (var i = s.index - 1; i >= 0; i--) {
            var k = scenes[i];
            if (isMobielOver(k)) continue;
            return k;
        }
        return null;
    }

    var reisTot = 0;
    function onderweg() { return performance.now() < reisTot; }
    var NIETS = Promise.resolve();
    function volgende() { var k = !onderweg() && huidig && volgendeVan(huidig, false); return k ? ga(k) : NIETS; }
    function volgendeStap() { var k = !onderweg() && huidig && volgendeVan(huidig, true); return k ? ga(k) : NIETS; }
    function terug() { var k = !onderweg() && huidig && vorigeVan(huidig); return k ? ga(k) : NIETS; }
    function doen() { if (!onderweg() && huidig && huidig.stap) return ga(huidig.stap + 'b'); return NIETS; }

    /* ---- Proefjes in laag B: klaarzetten, pauzeren, hints ---- */
    var ctrls = {};
    function proefje(n) {
        if (ctrls[n] !== undefined) return ctrls[n];
        var s = perId[n + 'b'];
        var houder = s && s.el.querySelector('[data-interactie]');
        var naam = houder && houder.getAttribute('data-interactie');
        if (!houder || !B.interacties || !B.interacties[naam]) { ctrls[n] = null; return null; }
        var cel = s.cel.el;
        var feedback = s.el.querySelector('[data-feedback]');
        var opdracht = s.el.querySelector('[data-opdracht]');
        var opnieuwKnop = s.el.querySelector('[data-opnieuw]');
        var ctx = {
            stap: n, cel: cel, scene: s.el, houder: houder,
            ketel: s.cel.el.querySelector('.bp-scherm--a [data-ketel]'),
            // soort: 'info' (neutraal), 'goed' (✓) of 'fout' (!). Leeg = regel weg.
            melding: function (tekst, soort) {
                if (!feedback) return;
                if (feedback.textContent !== (tekst || '')) feedback.textContent = tekst || '';
                feedback.setAttribute('data-soort', tekst ? (soort || 'info') : '');
            },
            opdracht: function (tekst) { if (opdracht && tekst && opdracht.textContent !== tekst) opdracht.textContent = tekst; },
            opnieuwZichtbaar: function (aan) { if (opnieuwKnop) opnieuwKnop.hidden = !aan; },
            gelukt: function (tekst) {
                markeerBediend(cel);
                var eerste = !cel.classList.contains('is-gelukt');
                cel.classList.add('is-gelukt');
                if (tekst) B.toast(houder, tekst);
                if (eerste) hudBij();
            }
        };
        try { ctrls[n] = B.interacties[naam](houder, ctx) || {}; }
        catch (e) { ctrls[n] = null; if (window.console) console.error(e); }
        return ctrls[n];
    }
    function controllers(vorige, s) {
        if (vorige && vorige.stap && vorige.laag === 'b' && vorige !== s) {
            var c = ctrls[vorige.stap];
            if (c && c.dicht) c.dicht();
        }
        if (s.stap) {
            var ctrl = proefje(s.stap);
            if (s.laag === 'b' && ctrl && ctrl.open) ctrl.open();
            // Alvast klaarzetten: het volgende proefje.
            if (s.stap < 9) setTimeout(function () { proefje(s.stap + 1); }, 900);
        }
        if (vorige && vorige.id === 'spel' && s.id !== 'spel' && B.spel && B.spel.pauze) B.spel.pauze();
    }

    /* ==================================================================
       3. Invoer
       ================================================================== */
    function vergrendeld() { return html.classList.contains('bp-vergrendeld') || html.classList.contains('is-start') || html.classList.contains('is-tour'); }

    document.addEventListener('click', function (e) {
        var k = e.target.closest('[data-nav]');
        if (k && !vergrendeld()) {
            var actie = k.getAttribute('data-nav');
            if (actie === 'volgende') volgende();
            else if (actie === 'terug') terug();
            else if (actie === 'stap') volgendeStap();
            else if (actie === 'doen') doen();
            else if (actie === 'reset') { if (B.app) B.app.nieuweRonde(); return; }
            B.geluid.speel('tik');
            return;
        }
        var g = e.target.closest('[data-ga]');
        if (g) { e.preventDefault(); ga(g.getAttribute('data-ga')); return; }
        // Telefoon: "Lees het verhaal" wisselt de kaart tussen kort en lang.
        var lees = e.target.closest('[data-lees]');
        if (lees) {
            var kaart = lees.closest('[data-verhaalkaart]');
            var lang = !kaart.classList.contains('is-lang');
            kaart.classList.toggle('is-lang', lang);
            lees.setAttribute('aria-expanded', lang ? 'true' : 'false');
            lees.querySelector('[data-lees-tekst]').textContent = lang ? 'Terug naar kort' : 'Lees het verhaal';
            B.geluid.speel('tik');
            requestAnimationFrame(function () { pasIn(kaart.closest('[data-cel]')); bouwLeiding(); });
            return;
        }
        var op = e.target.closest('[data-opnieuw]');
        if (op) {
            var celEl = op.closest('[data-stap]');
            var c = celEl && ctrls[+celEl.getAttribute('data-stap')];
            if (c && c.opnieuw) { c.opnieuw(); B.geluid.speel('tak'); }
        }
    });

    // Tik op de ketel in laag A: kijk erin = zelf doen.
    wereld.addEventListener('click', function (e) {
        var ketel = e.target.closest('[data-ketel]');
        if (!ketel || !huidig || huidig.laag !== 'a' || !huidig.stap) return;
        if (!huidig.el.contains(ketel)) return;
        e.stopPropagation();
        doen();
    });

    // Toetsen
    document.addEventListener('keydown', function (e) {
        if (vergrendeld() || e.altKey || e.ctrlKey || e.metaKey || !huidig || huidig.id === 'spel') return;
        var doel = e.target;
        if (doel.closest && doel.closest('input, textarea, select, [role="slider"], [contenteditable], [data-eigen-toetsen]')) return;
        var knop = doel.closest && doel.closest('button, a[href], summary');
        switch (e.key) {
            case 'ArrowRight': case 'ArrowDown': case 'PageDown':
                e.preventDefault(); volgende(); break;
            case ' ':
                if (knop) return;
                e.preventDefault(); if (e.shiftKey) terug(); else volgende(); break;
            case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
                e.preventDefault(); terug(); break;
            case 'Home': e.preventDefault(); ga('intro'); break;
            case 'End': e.preventDefault(); ga('einde'); break;
            case 'Escape':
                if (huidig.laag === 'b' && mobiel.matches) { e.preventDefault(); terug(); }
                break;
        }
    });

    // Muiswiel en trackpad: één gebaar = één stap. Een nieuw gebaar
    // begint na een korte stilte, of als de uitslag weer groeit.
    var wiel = { som: 0, laatst: 0, gebruikt: false, vorigeAbs: 0, slot: 0 };
    window.addEventListener('wheel', function (e) {
        if (e.ctrlKey) return;
        if (vergrendeld() || !huidig || huidig.id === 'spel') return;
        if (e.target.closest && e.target.closest('[data-eigen-wiel]')) return;
        e.preventDefault();
        var nu = performance.now();
        var delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        if (e.deltaMode === 1) delta *= 32;
        var abs = Math.abs(delta);
        if (nu - wiel.laatst > 260 || (wiel.gebruikt && abs > wiel.vorigeAbs * 1.6 && abs > 24 && nu - wiel.laatst > 60)) {
            wiel.som = 0;
            wiel.gebruikt = false;
        }
        wiel.laatst = nu;
        wiel.vorigeAbs = abs;
        if (wiel.gebruikt || nu < wiel.slot) return;
        wiel.som += delta;
        if (Math.abs(wiel.som) >= 46) {
            wiel.gebruikt = true;
            wiel.slot = nu + 420;
            if (wiel.som > 0) volgende(); else terug();
            wiel.som = 0;
        }
    }, { passive: false });

    /* Vegen (vinger of pen). Elementen met een eigen gebaar doen niet mee,
       net als de schermranden (die zijn van het systeem: terug, meldingen).
       Telefoon: horizontaal = reizen naar het vorige/volgende station,
       omhoog in A = zelf doen (sheet open), omlaag op de greep of kop van
       de sheet = terug naar het verhaal. Tablet: links/omhoog = verder. */
    var veeg = null, veegKlik = 0;
    function eigenGebaar(el) {
        return !!(el.closest && el.closest('[data-eigen-gebaar], [role="slider"], input, textarea, select, .bp-tip, video'));
    }
    function vorigStation() {
        if (!huidig) return Promise.resolve();
        if (huidig.laag === 'b') return ga(huidig.stap + 'a');
        return terug();
    }
    camera.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' || vergrendeld() || !e.isPrimary || !huidig) return;
        if (huidig.id === 'spel') return;
        var rand = 20;
        if (e.clientX < rand || e.clientX > window.innerWidth - rand || e.clientY < 24 || e.clientY > window.innerHeight - 24) return;
        var opSheetKop = !!(e.target.closest && e.target.closest('[data-sheet-greep], [data-sheet-kop]'));
        if (eigenGebaar(e.target) && !opSheetKop) return;
        veeg = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, sheetKop: opSheetKop };
    });
    camera.addEventListener('pointermove', function (e) {
        if (!veeg || e.pointerId !== veeg.id) return;
        var dx = e.clientX - veeg.x, dy = e.clientY - veeg.y;
        if (!veeg.as && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
            veeg.as = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : (Math.abs(dy) > Math.abs(dx) * 1.2 ? 'y' : 'geen');
        }
        if (veeg.as === 'x') camera.style.setProperty('--veeg-x', B.klem(dx * 0.15, -28, 28) + 'px');
        if (veeg.as === 'y' && mobiel.matches && huidig.laag === 'b' && veeg.sheetKop && dy > 0) camera.style.setProperty('--sheet-sleep', dy + 'px');
    });
    function veegEinde(e) {
        if (!veeg || e.pointerId !== veeg.id) return;
        var v = veeg; veeg = null;
        camera.style.removeProperty('--veeg-x');
        camera.style.removeProperty('--sheet-sleep');
        if (e.type === 'pointercancel' || !huidig) return;
        var dx = e.clientX - v.x, dy = e.clientY - v.y, dt = performance.now() - v.t;
        var ax = Math.abs(dx), ay = Math.abs(dy);
        var snel = Math.max(ax, ay) / Math.max(1, dt);
        var raak = Math.max(ax, ay) >= 56 || (Math.max(ax, ay) >= 24 && snel >= 0.45);
        var traagSlepen = mobiel.matches && huidig.laag === 'b' && v.sheetKop && v.as === 'y';
        if (traagSlepen) raak = dy > 110 || (dy > 30 && snel > 0.6);
        if (!raak || (!traagSlepen && dt > 1500) || !v.as || v.as === 'geen') return;
        veegKlik = performance.now();
        if (mobiel.matches) {
            if (huidig.laag === 'b') {
                if (v.as === 'y' && dy > 0 && v.sheetKop) terug();
                return;
            }
            if (v.as === 'x') { if (dx < 0) volgendeStap(); else vorigStation(); }
            else if (dy < 0 && huidig.stap) doen();
            return;
        }
        if (v.as === 'x') { if (dx < 0) volgende(); else terug(); }
        else { if (dy < 0) volgende(); else terug(); }
    }
    camera.addEventListener('pointerup', veegEinde);
    camera.addEventListener('pointercancel', veegEinde);
    // Tik op de kijkstrook boven de sheet (telefoon): terug naar het verhaal.
    camera.addEventListener('click', function (e) {
        if (!huidig || !mobiel.matches || huidig.laag !== 'b') return;
        if (e.target.closest('.bp-scherm--b')) return;
        if (e.target.closest('.bp-cel.is-huidig')) terug();
    });
    // Na een veeg geen klik op de knop waar de vinger toevallig begon.
    document.addEventListener('click', function (e) {
        if (performance.now() - veegKlik < 350) { e.stopPropagation(); e.preventDefault(); }
    }, true);

    // HUD-ovalen en de stappenkiezer
    if (hud) {
        hud.addEventListener('click', function (e) {
            var a = e.target.closest('[data-doel]');
            if (!a) return;
            e.preventDefault();
            var doel = a.getAttribute('data-doel');
            ga(doel === 'spel' ? 'spel' : doel + 'a');
        });
    }

    var sheetInGeschiedenis = false, negeerGeschiedenis = false;
    window.addEventListener('popstate', function () {
        if (negeerGeschiedenis) {
            negeerGeschiedenis = false;
            try { history.replaceState(null, '', hashVoor(huidig)); } catch (e) { /* */ }
            return;
        }
        if (sheetInGeschiedenis && huidig && huidig.laag === 'b') {
            sheetInGeschiedenis = false;
            ga(huidig.stap + 'a', { geenHash: true });
        }
    });
    window.addEventListener('hashchange', function () {
        var s = sceneVoorHash(location.hash);
        if (s && s !== huidig) ga(s, { geenHash: true });
    });

    /* ==================================================================
       4. De gouden leiding
       ================================================================== */
    var NS = 'http://www.w3.org/2000/svg';
    var KNIK = 26;
    var leiding = wereld.querySelector('.bp-leiding');
    var banen = leiding && leiding.querySelector('[data-banen]');
    var kopje = leiding && leiding.querySelector('.bp-leiding__kop');
    var segmenten = [];       // segment i loopt naar knooppunt i+1 (0 = bron → stap 1)
    var knooppunten = [];     // bron, stap 1–9, spel
    var vulAnim = 0;

    function f1(n) { return Math.round(n * 10) / 10; }
    function pad(klasse, d, ouder) {
        var p = document.createElementNS(NS, 'path');
        p.setAttribute('class', klasse);
        p.setAttribute('d', d);
        (ouder || banen).appendChild(p);
        return p;
    }
    function lijn(punten) {
        // Haakse lijn door de punten, met afgeronde knikken.
        var d = 'M' + f1(punten[0][0]) + ' ' + f1(punten[0][1]);
        for (var i = 1; i < punten.length - 1; i++) {
            var p0 = punten[i - 1], p1 = punten[i], p2 = punten[i + 1];
            var l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
            var r = Math.min(KNIK, l1 / 2, l2 / 2);
            if (r < 1 || !l1 || !l2) { d += 'L' + f1(p1[0]) + ' ' + f1(p1[1]); continue; }
            d += 'L' + f1(p1[0] - (p1[0] - p0[0]) / l1 * r) + ' ' + f1(p1[1] - (p1[1] - p0[1]) / l1 * r) +
                 'Q' + f1(p1[0]) + ' ' + f1(p1[1]) + ' ' + f1(p1[0] + (p2[0] - p1[0]) / l2 * r) + ' ' + f1(p1[1] + (p2[1] - p1[1]) / l2 * r);
        }
        var z = punten[punten.length - 1];
        return d + 'L' + f1(z[0]) + ' ' + f1(z[1]);
    }
    // Weg met punten die samenvallen of op één rechte lijn liggen.
    function schoon(punten) {
        var uit = [];
        punten.forEach(function (p) {
            var v = uit[uit.length - 1];
            if (v && Math.abs(v[0] - p[0]) < 0.5 && Math.abs(v[1] - p[1]) < 0.5) return;
            uit.push(p);
        });
        for (var i = uit.length - 2; i > 0; i--) {
            var a = uit[i - 1], b = uit[i], c = uit[i + 1];
            if ((Math.abs(a[0] - b[0]) < 0.5 && Math.abs(b[0] - c[0]) < 0.5) || (Math.abs(a[1] - b[1]) < 0.5 && Math.abs(b[1] - c[1]) < 0.5)) uit.splice(i, 1);
        }
        return uit;
    }

    /* De ketel-SVG's hebben nog de stompjes van de oude leiding: boven
       (in, eindpunt) en onder (uit, beginpunt). Daar sluit de wereldleiding
       precies op aan: hij valt in de ketel en komt er onderaan weer uit. */
    function svgPunt(svg, x, y, wr) {
        var m = svg.getScreenCTM();
        if (!m) return null;
        return [m.a * x + m.c * y + m.e - wr.left, m.b * x + m.d * y + m.f - wr.top];
    }
    function stompje(svg, soort) {
        var p = svg.querySelector('.bp-buis-vloed--' + soort);
        var d = p && p.getAttribute('d');
        if (!d) return null;
        var x = 0, y = 0, eerste = null;
        var re = /([MVHLQ])\s*([-\d.\s,]+)/g, m;
        while ((m = re.exec(d))) {
            var g = m[2].trim().split(/[\s,]+/).map(Number);
            if (m[1] === 'V') y = g[g.length - 1];
            else if (m[1] === 'H') x = g[g.length - 1];
            else { x = g[g.length - 2]; y = g[g.length - 1]; }
            if (!eerste) eerste = [x, y];
        }
        return soort === 'uit' ? eerste : [x, y];
    }
    function knooppunt(c, wr, hudOnder) {
        var top = (c.y - minY) * H, links = (c.x - minX) * W;
        var k = { cel: c, plafond: top + hudOnder + 30, links: links, rechts: links + W };
        var ketel = c.el.querySelector('.bp-scherm--a [data-ketel]');
        var svg = ketel && ketel.querySelector('svg');
        if (svg && ketel.getClientRects().length) {
            var si = stompje(svg, 'in'), su = stompje(svg, 'uit');
            if (si) k.in = svgPunt(svg, si[0], si[1], wr);
            if (su) k.uit = svgPunt(svg, su[0], su[1], wr);
            var r = ketel.getBoundingClientRect();
            k.box = { l: r.left - wr.left, r: r.right - wr.left };
            k.gat = parseFloat(getComputedStyle(c.el.querySelector('.bp-scherm--a')).columnGap) || 32;
        }
        function midden(el) {
            if (!el || !el.getClientRects().length) return null;
            var r = el.getBoundingClientRect();
            return [r.left + r.width / 2 - wr.left, r.top + r.height / 2 - wr.top];
        }
        if (!k.in) k.in = midden(c.el.querySelector('[data-anker-in]'));
        if (!k.uit) k.uit = midden(c.el.querySelector('[data-anker-uit]'));
        return (k.in || k.uit) ? k : null;
    }
    // Route van station a naar b (ontwerp §1.4): vloerloop onder de ketel,
    // stijgbuis aan de stroomkant, langs het plafond, en dan valt hij in de
    // volgende ketel. Uit een bocht-station (4, 7) loopt hij naar het
    // plafond van de volgende rij.
    function route(a, b) {
        var P0 = a.uit, P5 = b.in;
        var naarRechts = P5[0] >= P0[0];
        var bocht = a.cel.stap === 4 || a.cel.stap === 7;
        var plafond = bocht ? b.plafond : a.plafond;
        if (!a.box) {
            // De kraan in de intro. Staand (telefoon, iPad) staat hij onder de tekst: dan
            // eerst naar de linkerrand en daar (onzichtbaar) omhoog, niet door de tekst.
            if (mobiel.matches || W / H <= 0.8) return [P0, [a.links, P0[1]], [a.links, plafond], [P5[0], plafond], P5];
            return [P0, [P0[0], plafond], [P5[0], plafond], P5];
        }
        var vloer = P0[1] + 16;
        var stijg = naarRechts ? a.box.r + a.gat / 2 : a.box.l - a.gat / 2;
        // Ligt het plafond lager dan de vloerloop, dan komt de knik precies op
        // de celgrens: in rust zie je hem dan in geen enkele cel.
        if (plafond > vloer) stijg = naarRechts ? a.rechts : a.links;
        return [P0, [P0[0], vloer], [stijg, vloer], [stijg, plafond], [P5[0], plafond], P5];
    }

    function bouwLeiding() {
        if (!leiding) return;
        var wr = wereld.getBoundingClientRect();
        var w = Math.round(wereld.offsetWidth), h = Math.round(wereld.offsetHeight);
        leiding.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        leiding.setAttribute('width', w);
        leiding.setAttribute('height', h);
        banen.textContent = '';
        segmenten = [];
        knooppunten = [];
        var hudOnder = 64;
        if (hud && hud.getClientRects().length && !html.classList.contains('is-start') && !html.classList.contains('is-tour')) {
            hudOnder = Math.max(40, hud.getBoundingClientRect().bottom);
        }

        cellen.forEach(function (c) {
            var k = knooppunt(c, wr, hudOnder);
            if (k) knooppunten.push(k);
        });
        for (var i = 0; i < knooppunten.length - 1; i++) {
            var a = knooppunten[i], b = knooppunten[i + 1];
            if (!a.uit || !b.in) continue;
            var d = lijn(schoon(route(a, b)));
            pad('bp-leiding__basis', d);
            var halo = pad('bp-leiding__halo', d);
            var vloed = pad('bp-leiding__vloed', d);
            var lengte = vloed.getTotalLength() || 1;
            [halo, vloed].forEach(function (p) {
                p.style.strokeDasharray = lengte + ' ' + (lengte + 40);
                p.style.strokeDashoffset = lengte;
            });
            // Vooraf 48 punten langs het pad: tijdens de reis geen zwaar rekenwerk.
            var punten = [];
            for (var q = 0; q <= 48; q++) { var pt = vloed.getPointAtLength(lengte * q / 48); punten.push([pt.x, pt.y]); }
            segmenten.push({ naar: b.cel, van: a.cel, halo: halo, vloed: vloed, lengte: lengte, deel: 0, punten: punten });
        }
        vulLeiding(0);
    }

    // Het goud blijft staan op het verste station dat je bereikte: ga je
    // terug, dan loopt de leiding niet leeg.
    var verst = -1;
    function vulDoel(seg) {
        if (!huidig) return 0;
        verst = Math.max(verst, cellen.indexOf(huidig.cel));
        return cellen.indexOf(seg.naar) <= verst ? 1 : 0;
    }
    function zetSegment(s, deel) {
        s.deel = deel;
        var off = s.lengte * (1 - deel);
        s.vloed.style.strokeDashoffset = off;
        s.halo.style.strokeDashoffset = off;
    }
    function vulLeiding(duur) {
        cancelAnimationFrame(vulAnim);
        if (!segmenten.length) return;
        var start = segmenten.map(function (s) { return s.deel; });
        var doel = segmenten.map(vulDoel);
        var stijgend = segmenten.filter(function (s, i) { return doel[i] > start[i]; });
        if (!duur || B.minderBeweging()) {
            segmenten.forEach(function (s, i) { zetSegment(s, doel[i]); });
            kopje.classList.add('is-verborgen');
            stationsBij();
            return;
        }
        // Dalen gaat meteen; stijgen stroomt mee met de camera, één voor één.
        segmenten.forEach(function (s, i) { if (doel[i] < start[i]) zetSegment(s, doel[i]); });
        var t0 = performance.now(), n = Math.max(1, stijgend.length);
        function frame(t) {
            var p = B.klem((t - t0) / duur, 0, 1);
            var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
            var voor = null;
            stijgend.forEach(function (s, i) {
                var deel = B.klem(e * n - i, 0, 1);
                zetSegment(s, deel);
                if (deel > 0 && deel < 1) voor = s;
            });
            if (voor) {
                var pos = voor.deel * 48, i0 = Math.floor(pos), r = pos - i0;
                var pa = voor.punten[i0], pb = voor.punten[Math.min(48, i0 + 1)];
                kopje.setAttribute('cx', f1(pa[0] + (pb[0] - pa[0]) * r));
                kopje.setAttribute('cy', f1(pa[1] + (pb[1] - pa[1]) * r));
                kopje.classList.remove('is-verborgen');
            } else kopje.classList.add('is-verborgen');
            if (p < 1) vulAnim = requestAnimationFrame(frame);
            else { kopje.classList.add('is-verborgen'); stationsBij(true); }
        }
        vulAnim = requestAnimationFrame(frame);
    }
    function stationsBij(geluid) {
        var hier = huidig ? cellen.indexOf(huidig.cel) : -1;
        cellen.forEach(function (c, i) {
            if (!c.stap) return;
            var gevuld = i <= Math.max(hier, verst);
            if (gevuld && !c.el.classList.contains('is-gevuld') && geluid && i === hier) B.geluid.speel('borrel');
            c.el.classList.toggle('is-gevuld', gevuld);
            c.el.classList.toggle('is-doorgestroomd', i < hier);
        });
    }

    /* ==================================================================
       5. HUD, dock en hints
       ================================================================== */
    var hudStappen = hud ? [].slice.call(hud.querySelectorAll('[data-doel]')) : [];
    var hudSegmenten = hud ? [].slice.call(hud.querySelectorAll('[data-segment]')) : [];
    var routeGoud = hud && hud.querySelector('[data-route-goud]');
    var routePunten = hud ? [].slice.call(hud.querySelectorAll('[data-punt]')) : [];
    var hudModus = hud && hud.querySelector('[data-hud-modus]');
    // In de finale toont de HUD in welke spelfase je zit.
    var spelScherm = document.querySelector('.bp-scherm--spel');
    if (spelScherm && 'MutationObserver' in window) {
        new MutationObserver(function () { if (huidig && huidig.id === 'spel') hudBij(); })
            .observe(spelScherm, { attributes: true, attributeFilter: ['data-spel-fase'] });
    }
    var gezien = {}, routeLengtes = null, verstePositie = 0;
    // Hoe ver langs het S-pad ligt elk stationsstipje (in pathLength-eenheden)?
    function meetRoute() {
        try {
            var L = routeGoud.getTotalLength();
            if (!L) return;
            routeLengtes = routePunten.map(function (p) {
                var x = +p.getAttribute('cx'), y = +p.getAttribute('cy'), best = 0, afst = Infinity;
                for (var i = 0; i <= 240; i++) {
                    var q = routeGoud.getPointAtLength(L * i / 240), d = Math.hypot(q.x - x, q.y - y);
                    if (d < afst) { afst = d; best = i / 240; }
                }
                return best * 100;
            });
        } catch (e) { routeLengtes = null; }
    }
    var hudNummer = hud && hud.querySelector('[data-hud-nummer]');
    var hudNaam = hud && hud.querySelector('[data-hud-naam]');
    var hudVan = hud && hud.querySelector('[data-hud-van]');

    function positie() {
        // 0 = intro, 1–9 = stations, 10 = spel, 11 = einde
        if (!huidig) return 0;
        if (huidig.stap) return huidig.stap;
        if (huidig.id === 'spel') return 10;
        if (huidig.id === 'einde') return 11;
        return 0;
    }
    function hudBij() {
        if (!hud) return;
        var nr = positie();
        hud.style.setProperty('--voortgang', B.klem((nr - 1) / 9, 0, 1).toFixed(3));
        hudStappen.forEach(function (a) {
            var d = a.getAttribute('data-doel'), n = d === 'spel' ? 10 : +d;
            var cel = n <= 9 ? cellen.filter(function (c) { return c.stap === n; })[0] : null;
            a.classList.toggle('is-bereikt', n < nr);
            a.classList.toggle('is-gelukt', !!(cel && cel.el.classList.contains('is-gelukt')));
            if (n === nr || (nr === 11 && n === 10)) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
        });
        // Telefoon: verhalenbalk (half = gezien, vol = zelf gedaan) en de mini-route.
        if (nr >= 1 && nr <= 10) gezien[nr] = true;
        hudSegmenten.forEach(function (seg, i) {
            var n = i + 1;
            var cel = n <= 9 ? cellen.filter(function (c) { return c.stap === n; })[0] : null;
            seg.classList.toggle('is-gezien', !!gezien[n] || n < nr || nr === 11);
            seg.classList.toggle('is-gedaan', !!(cel && cel.el.classList.contains('is-gelukt')) || (n === 10 && nr === 11));
            seg.classList.toggle('is-hier', n === nr);
        });
        // Mini-S-kaart: goud tot het verste station, stip per station.
        if (routeGoud) {
            if (!routeLengtes) meetRoute();
            var verstNr = Math.max(nr, verstePositie);
            verstePositie = verstNr;
            var tot = routeLengtes && verstNr >= 1 ? routeLengtes[Math.min(verstNr, 10) - 1] : 0;
            routeGoud.style.strokeDasharray = tot.toFixed(1) + ' 100';
            routePunten.forEach(function (p) {
                var n = +p.getAttribute('data-punt');
                var cel = n <= 9 ? cellen.filter(function (c) { return c.stap === n; })[0] : null;
                p.classList.toggle('is-bereikt', n <= verstNr);
                p.classList.toggle('is-hier', n === nr || (nr === 11 && n === 10));
                p.classList.toggle('is-gedaan', !!(cel && cel.el.classList.contains('is-gelukt')));
                p.setAttribute('r', p.classList.contains('is-hier') ? 4.4 : 2.6);
            });
        }
        if (hudModus) {
            hudModus.hidden = !huidig.stap;
            hudModus.textContent = huidig.laag === 'b' ? 'Doen' : 'Lezen';
            hudModus.classList.toggle('is-doen', huidig.laag === 'b');
        }
        if (hudNummer) {
            if (nr >= 10) {
                hudNummer.innerHTML = '<i class="fas fa-beer" aria-hidden="true"></i>';
                hudNaam.textContent = nr === 10 ? 'Brouw zelf!' : 'Proost';
                var fase = nr === 10 && spelScherm ? spelScherm.getAttribute('data-spel-fase') : '';
                hudVan.textContent = /^[1-4]$/.test(fase || '') ? 'Fase ' + fase + ' van 4' : (fase === 'resultaat' ? 'Je bier' : 'De finale');
            } else if (!nr) {
                hudNummer.textContent = '·';
                hudNaam.textContent = 'De Brouwreis';
                hudVan.textContent = 'Intro';
            } else {
                hudNummer.textContent = String(nr);
                hudNaam.textContent = stapNaam(nr);
                hudVan.textContent = 'Stap ' + nr + ' van 9';
            }
        }
    }

    /* De dock: altijd op dezelfde plek, gevuld per scène.
         rij 1  ▶ Video · ✨ Probeer het zelf   (alleen in A; intro: de game)
         rij 2  ← · ? · Volgende stap →         (goud, altijd rechtsonder)  */
    var D_ = {};
    if (dock) ['video', 'doen', 'spel', 'terug', 'hulp', 'verder', 'label', 'icoon', 'terug-icoon'].forEach(function (k) { D_[k] = dock.querySelector('[data-dock-' + k + ']'); });
    var rij1 = dock && dock.querySelector('.bp-dock__rij--1');
    var VIDEODUUR = {};
    Object.keys(D.videos || {}).forEach(function (k) { VIDEODUUR[D.videos[k].stap] = D.videos[k].duur; });

    function dockBij() {
        if (!dock || !huidig) return;
        var s = huidig, label = '', icoon = 'fa-arrow-right', actie = 'stap';
        var volgendStation = volgendeVan(s, true);
        var hulpSleutel = '';
        if (s.stap) {
            var houder = perId[s.stap + 'b'] && perId[s.stap + 'b'].el.querySelector('[data-interactie]');
            hulpSleutel = houder ? houder.getAttribute('data-interactie') : '';
        }

        var mob = mobiel.matches;
        if (s.id === 'intro') {
            label = mob ? 'Begin de reis' : 'Open de kraan';
            icoon = mob ? 'fa-arrow-right' : 'fa-faucet-drip';
            actie = 'volgende';
        } else if (s.stap && s.laag === 'a' && !mob) {
            // Tablet en groter: eerst kijken, dan doen (A → B).
            label = 'Probeer het zelf'; icoon = 'fa-wand-magic-sparkles'; actie = 'doen';
        } else if (s.stap && s.stap < 9) label = 'Volgende stap';
        else if (s.stap === 9) label = mob ? 'Nu jij: brouw zelf' : 'Naar de finale';
        else if (s.id === 'einde') { label = 'Nieuwe brouwronde'; icoon = 'fa-rotate-left'; actie = 'reset'; }

        D_.label.textContent = label;
        D_.icoon.className = 'fas ' + icoon;
        D_.verder.setAttribute('data-nav', actie);
        D_.verder.classList.toggle('bp-dockknop--icoon-voor', actie === 'reset');
        var bestemming = volgendStation && actie !== 'reset' ? (volgendStation.stap ? 'stap ' + volgendStation.stap + ', ' + stapNaam(volgendStation.stap) : 'de Brouwmeester-game') : '';
        D_.verder.setAttribute('aria-label', label + (bestemming ? ': naar ' + bestemming : ''));
        D_.verder.hidden = !label;

        // Rij 1
        var inA = !!s.stap && s.laag === 'a';
        var video = inA && VIDEODUUR[s.stap];
        D_.video.hidden = !video;
        if (video) {
            D_.video.setAttribute('data-video', s.stap);
            D_.video.querySelector('[data-video-duur]').textContent = VIDEODUUR[s.stap];
            D_.video.setAttribute('aria-label', 'Bekijk de video van stap ' + s.stap + ' (' + VIDEODUUR[s.stap] + ')');
        }
        D_.doen.hidden = !inA || !mob;
        D_.spel.hidden = s.id !== 'intro';
        var rij1Leeg = D_.video.hidden && D_.doen.hidden && D_.spel.hidden;
        rij1.hidden = rij1Leeg;
        rij1.classList.toggle('is-enkel', [D_.video, D_.doen, D_.spel].filter(function (k) { return !k.hidden; }).length === 1);

        // Rij 2
        D_.terug.hidden = s.id === 'intro';
        var sheet = mobiel.matches && s.laag === 'b';
        D_['terug-icoon'].className = 'fas ' + (sheet ? 'fa-chevron-down' : 'fa-arrow-left');
        D_.terug.setAttribute('aria-label', sheet ? 'Terug naar het verhaal' : 'Terug');
        D_.hulp.hidden = !hulpSleutel;
        D_.hulp.setAttribute('data-hulp', hulpSleutel);

        dock.hidden = s.id === 'spel';
        dock.setAttribute('data-huidige-scene', s.id);
        dock.setAttribute('data-laag', s.laag);
    }

    // Bediend? Dan geen hint meer bij dit station.
    function markeerBediend(cel) {
        if (!cel || cel.classList.contains('is-bediend')) return;
        cel.classList.add('is-bediend');
        verbergHint();
    }
    wereld.addEventListener('pointerdown', function (e) {
        var doenLaag = e.target.closest('.bp-scherm--b [data-interactie]');
        if (doenLaag) markeerBediend(doenLaag.closest('[data-cel]'));
    }, { passive: true });
    wereld.addEventListener('keydown', function (e) {
        var doenLaag = e.target.closest('.bp-scherm--b [data-interactie]');
        if (doenLaag) markeerBediend(doenLaag.closest('[data-cel]'));
    });

    // Gouden puls + handje na 3 seconden niets doen.
    var hintTimer = 0, hintEl = null, pulsEl = null, hintCel = null, laatsteInvoer = 'aanwijzer';
    function verbergHint() {
        clearTimeout(hintTimer);
        if (hintCel) { hintCel.classList.remove('toon-hint'); hintCel = null; }
        if (hintEl) { hintEl.remove(); hintEl = null; }
        if (pulsEl) { pulsEl.classList.remove('bp-pulse'); pulsEl = null; }
    }
    function toonHint() {
        if (!huidig || vergrendeld()) return;
        var s = huidig, doelEl = null, label = '';
        if (s.stap && s.laag === 'b') {
            if (s.cel.el.classList.contains('is-bediend')) return;
            var ctrl = proefje(s.stap);
            doelEl = ctrl && ctrl.hint && ctrl.hint.el;
            var naam = (s.el.querySelector('[data-interactie]') || {}).getAttribute ? s.el.querySelector('[data-interactie]').getAttribute('data-interactie') : '';
            label = (ctrl && ctrl.hint && ctrl.hint.tekst) || (D.hulp && D.hulp[naam] && D.hulp[naam].hint) || 'Probeer maar';
        } else if (s.stap && s.laag === 'a') {
            // De ketel gloeit al; nu verschijnt ook het tik-icoontje erop en
            // pulseert de knop "Probeer het zelf".
            s.cel.el.classList.add('toon-hint');
            hintCel = s.cel.el;
            doelEl = dock && dock.querySelector('[data-nav="doen"]:not([hidden])');
            label = '';
        }
        if (!doelEl || !doelEl.getClientRects().length) return;
        pulsEl = doelEl;
        doelEl.classList.add('bp-pulse');
        if (!label) return;
        var podium = s.el;
        var rp = podium.getBoundingClientRect(), rd = doelEl.getBoundingClientRect();
        hintEl = B.maak('<div class="bp-hint" aria-hidden="true"><span class="bp-hint__hand"><i class="fas fa-hand-pointer"></i></span><span class="bp-hint__label"></span></div>');
        hintEl.querySelector('.bp-hint__label').textContent = label;
        hintEl.style.top = B.klem(rd.top + rd.height * 0.55 - rp.top, 40, rp.height - 110) + 'px';
        podium.appendChild(hintEl);
        // Klemmen met de echte breedte: het label blijft altijd helemaal in beeld.
        var half = hintEl.offsetWidth / 2 + 8;
        hintEl.style.left = B.klem(rd.left + rd.width / 2 - rp.left, half, Math.max(half, rp.width - half)) + 'px';
    }
    function hintPlannen() {
        verbergHint();
        if (!huidig || !huidig.stap) return;
        hintTimer = setTimeout(toonHint, 3000);
    }
    ['pointerdown', 'keydown'].forEach(function (t) {
        document.addEventListener(t, function () {
            laatsteInvoer = t === 'keydown' ? 'toets' : 'aanwijzer';
            if (hintEl || pulsEl || hintCel) { verbergHint(); }
        }, { passive: true, capture: true });
    });

    /* Pas-in-ladder: past de verhaalkaart niet (lange tekst, grote systeem-
       letters, een korte laptop), dan eerst compacter, dan een bredere kaart.
       Nooit kleiner dan leesbaar; past het dan nog niet, dan een melding
       voor de schrijvers (de testharnas telt die als fout). */
    function pastNiet(cel) {
        var a = cel.querySelector('.bp-scherm--a');
        var kaart = cel.querySelector('[data-verhaalkaart]');
        var ketel = cel.querySelector('.bp-scherm--a [data-ketel]');
        if (!a || !kaart || !a.getClientRects().length) return false;
        var ra = a.getBoundingClientRect(), rk = kaart.getBoundingClientRect();
        var onder = ra.bottom - parseFloat(getComputedStyle(a).paddingBottom);
        if (kaart.scrollHeight > kaart.clientHeight + 1 || rk.bottom > onder + 1 || rk.top < ra.top + parseFloat(getComputedStyle(a).paddingTop) - 1) return true;
        if (mobiel.matches && ketel && ketel.getBoundingClientRect().height < 96) return true;
        return false;
    }
    function pasIn(celEl) {
        if (!celEl || !celEl.hasAttribute('data-stap') || celEl.getAttribute('data-laag') === 'b') return;
        celEl.classList.remove('is-compact', 'is-breed');
        if (!pastNiet(celEl)) return;
        celEl.classList.add('is-compact');
        if (!pastNiet(celEl)) return;
        if (!mobiel.matches) { celEl.classList.add('is-breed'); if (!pastNiet(celEl)) return; }
        if (window.console) console.warn('[past niet] ' + celEl.getAttribute('data-cel') + 'a op ' + W + '×' + H);
    }
    function pasAllesIn() { cellen.forEach(function (c) { if (c.stap) pasIn(c.el); }); }

    /* ==================================================================
       Opbouwen en bijhouden
       ================================================================== */
    var bouwTimer = 0;
    function herbouw() {
        clearTimeout(bouwTimer);
        bouwTimer = setTimeout(function () {
            meet();
            strooiVoorgrond();
            if (huidig) { html.classList.add('is-direct'); zetCamera(huidig.cel, 0); }
            requestAnimationFrame(function () {
                pasAllesIn();
                bouwLeiding();
                html.classList.remove('is-direct');
                if (huidig) ga(huidig, { direct: true, forceer: true, geenHash: true, geenFocus: true });
            });
        }, 90);
    }
    window.addEventListener('resize', herbouw);
    window.addEventListener('orientationchange', herbouw);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', herbouw);
    window.addEventListener('load', herbouw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(herbouw);
    mobiel.addEventListener && mobiel.addEventListener('change', function () { if (huidig) { dockBij(); ga(huidig, { direct: true, forceer: true, geenHash: true }); } });

    meet();
    strooiVoorgrond();
    pasAllesIn();
    var begin = sceneVoorHash(location.hash) || perId.intro || scenes[0];
    ga(begin, { direct: true, geenHash: !location.hash });
    requestAnimationFrame(bouwLeiding);

    /* ==================================================================
       6. API (ook voor de testharnas)
       ================================================================== */
    B.scenes = {
        lijst: function () { return scenes.map(function (s) { return s.id; }); },
        huidig: function () { return huidig ? huidig.id : null; },
        ga: function (id, o) { return ga(id, o); },
        element: function (id) { var s = perId[id || (huidig && huidig.id)]; return s ? s.el : null; },
        volgende: volgende, terug: terug, volgendeStap: volgendeStap, doen: doen,
        herbouw: herbouw,
        mobiel: function () { return mobiel.matches; },
        proefje: proefje,
        bijWissel: function (fn) { luisteraars.push(fn); },
        hintOpnieuw: hintPlannen
    };
})();
