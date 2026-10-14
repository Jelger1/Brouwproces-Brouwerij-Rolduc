/* =====================================================================
   Brouwerij Rolduc — Het brouwproces: scène B ("Doen") voor stap 7 t/m 9

     7  kalender    Wekenlang koud: scheur de weken van de kalender af en
                    kijk hoe het bier in de lagertank helder en rond wordt.
     8  zonnebril   De zonnebril-test: sleep de zon over drie flesjes
                    (helder, groen, bruin) en ruik wie "lichtgeraakt" raakt.
     9  warmekamer  De warme kamer: de weken lopen vanzelf, de druk loopt op.
                    Open de fles op tijd en schenk een Rolduc-kelkglas in.

   Elk proefje is één SVG-close-up (viewBox 480 × 440) die de podiumdoos
   helemaal vult. Bediening: pointer events (muis, vinger) en toetsenbord.
   Uitleg en feedback gaan via ctx.melding(); de SVG bevat alleen labels.
   ===================================================================== */
(function () {
    'use strict';

    var B = window.Brouw, D = window.BROUWPROCES;
    if (!B) return;
    var I = B.interacties = B.interacties || {};

    if (D) {
        D.hulp = D.hulp || {};
        D.hulp.kalender = D.hulp.kalender || {
            hint: 'Tik op de kalender',
            wat: 'Tik op de scheurkalender of veeg een blaadje omlaag. Elke tik is een week in de koude tank. Kijk hoe het bier helder wordt.',
            waarom: 'Vlak boven het vriespunt zakken gist en eiwitjes naar de bodem: het bier wordt helder. Intussen ruimt de gist de jonge smaakjes op: groene appel en boter.'
        };
        D.hulp.zonnebril = D.hulp.zonnebril || {
            hint: 'Sleep de zon',
            wat: 'Sleep de zon langs de hemel, boven drie flesjes: helder, groen en bruin glas. Kijk op de labeltjes welk bier fris blijft.',
            waarom: 'Blauw licht en uv breken de bitterstoffen uit de hop af tot een zwavelstof die naar stinkdier ruikt. Bruin glas houdt dat licht bijna helemaal tegen, groen veel minder, helder niets.'
        };
        D.hulp.warmekamer = D.hulp.warmekamer || {
            hint: 'Wacht… en tik dan op de kurk',
            wat: 'De weken in de warme kamer lopen vanzelf. Houd de drukmeter in de gaten en open de fles op tijd: tik op de kroonkurk.',
            waarom: 'Bij het bottelen gaan er wat suiker en verse gist bij. In zo\'n twee weken op kamertemperatuur maakt de gist koolzuur. Dat kan niet weg en lost op in het bier.'
        };
    }

    /* ------------------------------------------------------------------
       Gedeelde hulpjes
       ------------------------------------------------------------------ */
    // Tijdens het afronden in dicht() klinkt en trilt er niets meer.
    var stilte = 0;
    function speel(naam, opties) { if (!stilte && B.geluid) B.geluid.speel(naam, opties); }
    function tril(patroon) { if (!stilte) B.trillen(patroon); }
    function rondAf(klok) { stilte += 1; try { klok.leeg(true); } finally { stilte -= 1; } }
    function f(n) { return Math.round(n * 10) / 10; }
    function rustig() { return !!(B.minderBeweging && B.minderBeweging()); }

    // Vaste willekeur (mulberry32): elke keer hetzelfde, mooi verspreide plaatje.
    function willekeur(zaad) {
        var a = zaad >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            var t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Schermpunt → viewBox-coördinaten.
    function svgPunt(svg, e) {
        var m = svg.getScreenCTM();
        if (!m) return { x: 0, y: 0 };
        var p = svg.createSVGPoint();
        p.x = e.clientX; p.y = e.clientY;
        p = p.matrixTransform(m.inverse());
        return { x: p.x, y: p.y };
    }
    // Hoeveel viewBox-eenheden is één schermpixel?
    function perPixel(svg) {
        var m = svg.getScreenCTM();
        return m && m.a ? 1 / m.a : 1;
    }

    // Raakvlak + hint-ring + focusring voor een hotspot (rechthoek of cirkel).
    function raakRect(x, y, w, h, r) {
        return '<rect class="bp-d3__raak" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '"/>';
    }
    function ringenRect(x, y, w, h, r) {
        var a = ' x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '"';
        return '<rect class="bp-d3__puls"' + a + '/><rect class="bp-d3__focus"' + a + '/>';
    }

    // Eén vinger of muis: tik, veeg of sleep. o.begin(e), o.sleep(dx, dy, e),
    // o.los(dx, dy, echtLosgelaten, e) met dx/dy in schermpixels.
    function gebaar(el, o) {
        var s = null;
        el.addEventListener('pointerdown', function (e) {
            if (e.button > 0 || s) return;
            if (o.uit && o.uit()) return;
            e.preventDefault();
            try { el.setPointerCapture(e.pointerId); } catch (x) { /* oudere browsers */ }
            s = { id: e.pointerId, x: e.clientX, y: e.clientY };
            if (o.begin) o.begin(e);
        });
        el.addEventListener('pointermove', function (e) {
            if (!s || e.pointerId !== s.id) return;
            if (o.sleep) o.sleep(e.clientX - s.x, e.clientY - s.y, e);
        });
        function los(e) {
            if (!s || e.pointerId !== s.id) return;
            var dx = e.clientX - s.x, dy = e.clientY - s.y;
            s = null;
            if (o.los) o.los(dx, dy, e.type === 'pointerup', e);
        }
        el.addEventListener('pointerup', los);
        el.addEventListener('pointercancel', los);
        el.addEventListener('lostpointercapture', los);
        el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }

    // Timers die bij dicht() of opnieuw() netjes worden afgerond of gewist.
    function klokjes() {
        var lijst = [];
        function wis(t) { clearTimeout(t.id); }
        return {
            na: function (ms, fn) {
                var t = { fn: fn, op: Date.now() + ms };
                t.id = setTimeout(function () {
                    var i = lijst.indexOf(t);
                    if (i >= 0) lijst.splice(i, 1);
                    fn();
                }, ms);
                lijst.push(t);
                return t;
            },
            // uitvoeren = true: alles wat nog zou gebeuren, gebeurt nu meteen (eindtoestand).
            leeg: function (uitvoeren) {
                var rondes = 0;
                do {
                    var oud = lijst.sort(function (a, b) { return a.op - b.op; });
                    lijst = [];
                    oud.forEach(wis);
                    if (uitvoeren) oud.forEach(function (t) { t.fn(); });
                } while (uitvoeren && lijst.length && ++rondes < 6);
                if (!uitvoeren) lijst = [];
            }
        };
    }

    // Kleine sneeuwvlok (6 armen) als pad.
    function vlok(x, y, r) {
        var a = r * 0.87, b = r / 2;
        return 'M' + x + ' ' + (y - r) + 'V' + (y + r) +
            'M' + f(x - a) + ' ' + f(y - b) + 'L' + f(x + a) + ' ' + f(y + b) +
            'M' + f(x - a) + ' ' + f(y + b) + 'L' + f(x + a) + ' ' + f(y - b);
    }

    // Opnieuw starten van een CSS-animatie (klasse eraf, reflow, klasse erop).
    function herstart(el, klasse) {
        el.classList.remove(klasse);
        void el.getBoundingClientRect();
        el.classList.add(klasse);
    }

    /* ==================================================================
       7. WEKENLANG KOUD — de scheurkalender
       ================================================================== */
    I.kalender = function (houder, ctx) {
        var id = B.uniekId('bp-koud');
        var GX = 170, GY = 228, GR = 60;        // het kijkglas
        var rnd = willekeur(707);

        // Gistdeeltjes: zweven nu nog door het glas, zakken per week naar de bodem.
        var deeltjes = [];
        for (var i = 0; i < 60; i++) {
            var hoek = rnd() * Math.PI * 2, afst = Math.sqrt(rnd()) * (GR - 7);
            var bx = GX + (rnd() * 2 - 1) * (GR - 14) * (0.3 + rnd() * 0.7);
            var bodem = GY + Math.sqrt(Math.max(0, GR * GR - (bx - GX) * (bx - GX)));
            deeltjes.push({
                x: GX + Math.cos(hoek) * afst, y: GY + Math.sin(hoek) * afst,
                bx: bx, by: bodem - 4 - rnd() * 8,
                r: 1.5 + rnd() * 2.2,
                s: 0.5 + rnd() * 0.5,           // deel van de 4 weken dat dit deeltje nodig heeft
                fase: rnd() * 6.28
            });
        }

        var rijp = 'M82 113c6 4 12-2 18 2';
        for (var k = 0; k < 8; k++) rijp += 's12-2 18 2';
        rijp += 's8-2 14 0';
        var tikjes = '';
        for (var x = 86; x <= 254; x += 8) tikjes += 'M' + x + ' 92v12';
        var nagels = '';
        for (var n = 0; n < 12; n++) {
            var a = n / 12 * Math.PI * 2;
            nagels += '<circle cx="' + f(GX + Math.cos(a) * 66) + '" cy="' + f(GY + Math.sin(a) * 66) + '" r="2.2"/>';
        }

        houder.innerHTML =
            '<svg class="bp-koud" viewBox="0 0 480 440" preserveAspectRatio="xMidYMid meet" role="group" aria-label="De lagertank met een kijkglas en een scheurkalender">' +
            '<defs>' +
                '<clipPath id="' + id + '-doos"><rect width="480" height="440"/></clipPath>' +
                '<clipPath id="' + id + '-glas"><circle cx="' + GX + '" cy="' + GY + '" r="' + GR + '"/></clipPath>' +
            '</defs>' +
            '<g clip-path="url(#' + id + '-doos)">' +
                '<g aria-hidden="true">' +
                    '<path class="bp-buis" d="M170 0V36"/>' +
                    '<path class="bp-buis" d="M170 364V440"/>' +
                    // thermometer: vlak boven het vriespunt
                    '<path class="bp-lf" d="M56 186H80"/>' +
                    '<rect class="bp-v bp-lf" x="34" y="150" width="20" height="92" rx="10"/>' +
                    '<rect class="bp-koud__kwik" x="40" y="206" width="8" height="34" rx="4"/>' +
                    '<circle class="bp-koud__kwik bp-lf" cx="44" cy="244" r="12"/>' +
                    '<path class="bp-tik" d="M54 166h-6M54 180h-6M54 194h-6M54 208h-6M54 222h-6"/>' +
                    '<text class="bp-koud__label" x="44" y="286">2 °C</text>' +
                    // de tank
                    '<path class="bp-v bp-l" d="M80 92C80 58 120 36 170 36C220 36 260 58 260 92Z"/>' +
                    '<path class="bp-v bp-l" d="M80 92H260V338Q260 364 234 364H106Q80 364 80 338Z"/>' +
                    '<path class="bp-lf" d="M80 104H260"/>' +
                    '<path class="bp-tik" d="' + tikjes + '"/>' +
                    '<path class="bp-rijp" d="' + rijp + '"/>' +
                    '<g class="bp-kristal"><path d="' + vlok(98, 136, 8) + '"/><path d="' + vlok(244, 338, 7) + '"/></g>' +
                    '<g class="bp-koud__rijp-extra">' +
                        '<path class="bp-rijp" d="M84 352c6-4 12 2 18-2s12 2 18-2 12 2 18-2 12 2 18-2 12 2 18-2 12 2 18-2 12 2 18-2 12 2 18-2 12 2 14 0"/>' +
                        '<path class="bp-rijp" d="M84 122c3 10-3 20 0 30s-3 20 0 30M256 122c-3 10 3 20 0 30s3 20 0 30"/>' +
                        '<g class="bp-kristal"><path d="' + vlok(242, 134, 8) + '"/><path d="' + vlok(98, 334, 8) + '"/><path d="' + vlok(120, 120, 5) + '"/><path d="' + vlok(222, 122, 5) + '"/></g>' +
                    '</g>' +
                    // het kijkglas
                    '<circle class="bp-v bp-l" cx="' + GX + '" cy="' + GY + '" r="72"/>' +
                    '<g class="bp-nagels">' + nagels + '</g>' +
                    '<g clip-path="url(#' + id + '-glas)">' +
                        '<rect class="bp-koud__bier" x="108" y="166" width="124" height="124"/>' +
                        '<rect class="bp-koud__waas" x="108" y="166" width="124" height="124"/>' +
                        '<g class="bp-koud__deeltjes">' + deeltjes.map(function (p) { return '<circle r="' + f(p.r) + '"/>'; }).join('') + '</g>' +
                        // jonge smaakjes: groene appel (aceetaldehyde) en boter (diacetyl)
                        '<g transform="translate(146 208)"><g class="bp-koud__weg bp-koud__weg--appel"><g class="bp-koud__dobber">' +
                            '<g transform="scale(1.15)">' +
                                '<path class="bp-koud__appel" d="M0 -9C-5 -15 -17 -13 -17 0C-17 13 -9 19 -3 17C-1 16 1 16 3 17C9 19 17 13 17 0C17 -13 5 -15 0 -9Z"/>' +
                                '<path class="bp-koud__steel" d="M0 -9C0 -13 1 -16 3 -19"/>' +
                                '<path class="bp-koud__blaadje" d="M2 -14C5 -20 12 -21 15 -18C11 -14 6 -13 2 -14Z"/>' +
                                '<path class="bp-koud__glim" d="M-11 -2C-11 -6 -9 -8 -6 -9"/>' +
                            '</g>' +
                        '</g></g></g>' +
                        '<g transform="translate(196 250)"><g class="bp-koud__weg bp-koud__weg--boter"><g class="bp-koud__dobber bp-koud__dobber--2">' +
                            '<path class="bp-koud__boter" d="M-18 -2L-10 -10H18L10 -2Z"/>' +
                            '<path class="bp-koud__boter" d="M-18 -2H10V12H-18Z"/>' +
                            '<path class="bp-koud__boter bp-koud__boter--zij" d="M10 -2L18 -10V4L10 12Z"/>' +
                            '<path class="bp-koud__wikkel" d="M-18 3H10"/>' +
                        '</g></g></g>' +
                        '<path class="bp-koud__glans" d="M130 300L182 156H206L154 300Z"/>' +
                        '<g class="bp-koud__sterren"><path d="M146 196l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><path d="M200 222l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6z"/></g>' +
                    '</g>' +
                    '<circle class="bp-l" cx="' + GX + '" cy="' + GY + '" r="' + GR + '" fill="none"/>' +
                    '<path class="bp-glans" d="M128 200A48 48 0 0 1 150 176"/>' +
                    // poten
                    '<path class="bp-l" d="M104 364V414M236 364V414"/>' +
                    '<path class="bp-lf" d="M92 414H116M224 414H248"/>' +
                    // haak voor de kalender
                    '<path class="bp-lf" d="M260 124H360V134"/>' +
                    '<circle class="bp-v bp-lf" cx="360" cy="124" r="4"/>' +
                '</g>' +
                // de scheurkalender (hoofd-hotspot)
                '<g class="bp-koud__kal bp-d3__knop" role="button" tabindex="0" data-eigen-toetsen aria-label="">' +
                    raakRect(286, 112, 150, 200, 14) +
                    '<g class="bp-koud__kalbord">' +
                        '<path class="bp-lf" d="M360 134V144"/>' +
                        '<rect class="bp-v bp-l" x="300" y="142" width="120" height="156" rx="8"/>' +
                        '<rect class="bp-koud__kop" x="300" y="142" width="120" height="24" rx="8"/>' +
                        '<path class="bp-koud__stapel" d="M310 291H410M313 294.5H407"/>' +
                        '<g class="bp-koud__blad">' +
                            '<rect class="bp-koud__papier" x="308" y="164" width="104" height="124" rx="4"/>' +
                            '<path class="bp-koud__perfo" d="M314 170H406"/>' +
                            '<text class="bp-koud__woord" x="360" y="206">Dag</text>' +
                            '<text class="bp-koud__nummer" x="360" y="270">1</text>' +
                        '</g>' +
                        '<path class="bp-koud__ring" d="M330 136v14M390 136v14"/>' +
                    '</g>' +
                    ringenRect(286, 112, 150, 200, 14) +
                '</g>' +
                '<g class="bp-koud__vallen" aria-hidden="true"></g>' +
            '</g>' +
            '</svg>';

        var svg = houder.querySelector('svg');
        var kal = svg.querySelector('.bp-koud__kal');
        var bord = svg.querySelector('.bp-koud__kalbord');
        var blad = svg.querySelector('.bp-koud__blad');
        var woord = svg.querySelector('.bp-koud__woord');
        var nummer = svg.querySelector('.bp-koud__nummer');
        var vallen = svg.querySelector('.bp-koud__vallen');
        var waas = svg.querySelector('.bp-koud__waas');
        var cirkels = svg.querySelectorAll('.bp-koud__deeltjes circle');
        var appel = svg.querySelector('.bp-koud__weg--appel');
        var boter = svg.querySelector('.bp-koud__weg--boter');
        var klok = klokjes();

        var week = 0;          // 0 = dag 1 (net koud gezet), 4 = week 4: klaar
        var w = 0;             // getoonde week (loopt soepel achter `week` aan)
        var tijd = 0, zichtbaar = false;
        var vorige = { waas: '', rijp: '', glas: '' };

        var TEKST = [
            '',
            'Brr, vlak boven het vriespunt. Het jongbier is nog troebel.',
            'De groene appel (aceetaldehyde) verdwijnt: de gist ruimt op. Geduld…',
            'Ook de botersmaak (diacetyl) is weg. De gist zakt naar de bodem.'
        ];

        function zetBlad() {
            woord.textContent = week ? 'Week' : 'Dag';
            nummer.textContent = week ? String(week) : '1';
            kal.setAttribute('aria-label', week >= 4
                ? 'Scheurkalender: week 4, het bier is helder en klaar'
                : 'Scheurkalender: scheur een week af (nu ' + (week ? 'week ' + week : 'dag 1') + ', klaar bij week 4)');
        }

        function teken() {
            var tril = rustig() ? 0 : 1, som = 0;
            for (var i = 0; i < deeltjes.length; i++) {
                var p = deeltjes[i];
                var z = B.klem(w / (4 * p.s), 0, 1);
                som += z;
                var amp = (1 - z) * 3 * tril;
                cirkels[i].setAttribute('cx', f(B.lerp(p.x, p.bx, z) + Math.sin(tijd * 1.2 + p.fase) * amp));
                cirkels[i].setAttribute('cy', f(B.lerp(p.y, p.by, z) + Math.cos(tijd * 0.9 + p.fase) * amp));
            }
            var helder = som / deeltjes.length;
            var waasNu = (0.62 * (1 - helder)).toFixed(3);
            if (waasNu !== vorige.waas) { vorige.waas = waasNu; waas.style.opacity = waasNu; }
            var rijpNu = (w / 4).toFixed(2);
            if (rijpNu !== vorige.rijp) { vorige.rijp = rijpNu; svg.style.setProperty('--bp-koud-rijp', rijpNu); }
            // De lagertank in scène A leeft mee: het kijkglas wordt helderder.
            var glasNu = B.mengKleur('#BFAE80', '#E9AE2E', w / 4);
            if (glasNu !== vorige.glas) { vorige.glas = glasNu; ctx.cel.style.setProperty('--bp-koud-glas', glasNu); }
        }

        var lus = B.lus(function (dt) {
            tijd += dt;
            if (rustig()) w = week;
            else if (w < week) w = Math.min(week, w + dt / 0.9);
            else if (w > week) w = week;
            teken();
            // Stil plaatje (minder beweging) of alles uitgezakt: de lus mag rusten.
            if (rustig() || (week >= 4 && w >= 4)) lus.stop();
        }, houder);

        function valBlad() {
            var kopie = blad.cloneNode(true);
            kopie.removeAttribute('style');
            kopie.classList.remove('is-vast');
            kopie.classList.add('is-valt');
            vallen.appendChild(kopie);
            klok.na(1000, function () { if (kopie.parentNode) kopie.parentNode.removeChild(kopie); });
        }

        function scheur() {
            if (week >= 4) {
                herstart(bord, 'is-wiebel');
                speel('tik');
                ctx.melding('Helder als goud en mooi rond: klaar om te bottelen!', 'goed');
                return;
            }
            if (!rustig()) valBlad();
            week += 1;
            zetBlad();
            speel('tak');
            klok.na(130, function () { speel('zoef'); });
            ctx.opnieuwZichtbaar(true);
            ctx.cel.classList.add('is-koud-bezig');
            if (week >= 2) appel.classList.add('is-weg');
            if (week >= 3) boter.classList.add('is-weg');
            if (week < 4) {
                ctx.melding(TEKST[week], 'info');
            } else {
                svg.classList.add('is-helder');
                ctx.cel.classList.add('is-koud-klaar');
                ctx.melding('Week 4: helder en rond. Geduld loont!', 'goed');
                ctx.gelukt('Helder als goud: klaar om te bottelen!');
            }
            lus.start();
        }

        // Tik, of veeg het blaadje omlaag (het blaadje volgt je vinger een stukje).
        var eenheid = 1;
        gebaar(kal, {
            begin: function () { eenheid = perPixel(svg); blad.classList.add('is-vast'); },
            sleep: function (dx, dy) {
                var d = B.klem(dy * eenheid, 0, 30);
                blad.style.transform = 'translateY(' + f(d) + 'px) rotate(' + f(-d / 4) + 'deg)';
            },
            los: function (dx, dy, echt) {
                blad.classList.remove('is-vast');
                blad.style.transform = '';
                if (!echt) return;
                if (Math.sqrt(dx * dx + dy * dy) < 12 || dy > 14) scheur();
            }
        });
        kal.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowDown') {
                e.preventDefault();
                if (!e.repeat) scheur();
            }
        });

        function opnieuw() {
            klok.leeg(false);
            vallen.textContent = '';
            week = 0; w = 0;
            zetBlad();
            appel.classList.remove('is-weg');
            boter.classList.remove('is-weg');
            svg.classList.remove('is-helder');
            ctx.cel.classList.remove('is-koud-bezig', 'is-koud-klaar');
            ctx.melding('');
            ctx.opnieuwZichtbaar(false);
            teken();
            if (zichtbaar) lus.start();
        }

        zetBlad();
        teken();
        svg.classList.add('is-pauze');      // tot open(): niets beweegt

        return {
            hint: { el: kal, tekst: 'Tik op de kalender' },
            open: function () {
                zichtbaar = true;
                svg.classList.remove('is-pauze');
                lus.start();
            },
            dicht: function () {
                zichtbaar = false;
                lus.stop();
                rondAf(klok);
                vallen.textContent = '';
                w = week;
                teken();
                blad.classList.remove('is-vast');
                blad.style.transform = '';
                svg.classList.add('is-pauze');
            },
            opnieuw: opnieuw
        };
    };

    /* ==================================================================
       8. DE ZONNEBRIL-TEST — sleep de zon over helder, groen en bruin glas
       ================================================================== */
    I.zonnebril = function (houder, ctx) {
        var id = B.uniekId('bp-zonbril');
        var BAAN = { x0: 70, x1: 410, cx: 240, cy: 152, rx: 170, ry: 100 };
        var TOP = 241, K = 1.28;        // flesjes: kroonkurk op y 241, schaal 1,28
        var NAMEN = ['Fris', 'Geraakt', 'Stinkdier!'];
        // door = hoeveel van het blauwe licht en de uv het glas doorlaat.
        var FLESSEN = [
            { x: 104, naam: 'helder', label: 'Helder glas', door: 1, glas: 'rgba(225, 240, 232, .14)' },
            { x: 240, naam: 'groen', label: 'Groen glas', door: 0.65, glas: 'rgba(40, 128, 58, .5)' },
            { x: 376, naam: 'bruin', label: 'Bruin glas', door: 0.02, glas: 'url(#bp-grad-bruinglas)' }
        ];

        function flesPad(cx) {
            function X(v) { return f(cx + v * K); }
            function Y(v) { return f(TOP + v * K); }
            return 'M' + X(-6) + ' ' + Y(6) + 'V' + Y(28) +
                'C' + X(-6) + ' ' + Y(38) + ' ' + X(-18) + ' ' + Y(42) + ' ' + X(-18) + ' ' + Y(54) +
                'V' + Y(116) + 'Q' + X(-18) + ' ' + Y(124) + ' ' + X(-10) + ' ' + Y(124) +
                'H' + X(10) + 'Q' + X(18) + ' ' + Y(124) + ' ' + X(18) + ' ' + Y(116) +
                'V' + Y(54) + 'C' + X(18) + ' ' + Y(42) + ' ' + X(6) + ' ' + Y(38) + ' ' + X(6) + ' ' + Y(28) +
                'V' + Y(6) + 'Z';
        }

        var defs = '<clipPath id="' + id + '-doos"><rect width="480" height="440"/></clipPath>';
        var flessen = '', labels = '';
        FLESSEN.forEach(function (fl, n) {
            var cx = fl.x, pad = flesPad(cx), y = function (v) { return f(TOP + v * K); };
            defs += '<clipPath id="' + id + '-f' + n + '"><path d="' + pad + '"/></clipPath>';
            flessen +=
                '<g class="bp-zonbril__fles bp-zonbril__fles--' + fl.naam + '" data-niveau="0">' +
                    '<g class="bp-zonbril__stank">' +
                        '<path d="M' + f(cx - 30) + ' ' + y(92) + 'c-6-8 6-14 0-22s6-14 0-22 6-14 0-22"/>' +
                        '<path d="M' + f(cx + 30) + ' ' + y(86) + 'c6-8-6-14 0-22s-6-14 0-22-6-14 0-22"/>' +
                    '</g>' +
                    '<g clip-path="url(#' + id + '-f' + n + ')">' +
                        '<rect class="bp-zonbril__bier" x="' + f(cx - 26) + '" y="' + y(26) + '" width="52" height="' + f(100 * K) + '"/>' +
                        '<ellipse class="bp-zonbril__licht" cx="' + cx + '" cy="' + y(84) + '" rx="22" ry="44"/>' +
                    '</g>' +
                    '<path class="bp-zonbril__glas" d="' + pad + '" style="fill:' + fl.glas + '"/>' +
                    '<path class="bp-l" d="' + pad + '"/>' +
                    '<rect class="bp-kroonkurk" x="' + f(cx - 7.5 * K) + '" y="' + TOP + '" width="' + f(15 * K) + '" height="' + f(6.5 * K) + '" rx="2"/>' +
                    '<rect class="bp-v bp-lf" x="' + f(cx - 13 * K) + '" y="' + y(64) + '" width="' + f(26 * K) + '" height="' + f(32 * K) + '" rx="2"/>' +
                    '<use href="#bp-sym-r" class="bp-fles-r" x="' + f(cx - 8 * K) + '" y="' + y(69) + '" width="' + f(16 * K) + '" height="' + f(21 * K) + '"/>' +
                    '<path class="bp-glans" d="M' + f(cx - 12 * K) + ' ' + y(58) + 'V' + y(114) + '"/>' +
                '</g>';
            labels +=
                '<g class="bp-zonbril__label" transform="translate(' + cx + ' 200)" data-niveau="0">' +
                    '<path class="bp-lf" d="M0 32V48"/>' +
                    '<g class="bp-zonbril__kaartje">' +
                        '<rect class="bp-zonbril__kaart" x="-66" y="0" width="132" height="32" rx="7"/>' +
                        '<circle class="bp-zonbril__gat" cx="-56" cy="16" r="3.5"/>' +
                        '<text class="bp-zonbril__tekst" x="6" y="23.5">Fris</text>' +
                    '</g>' +
                '</g>';
        });

        var krans = '';
        for (var r = 0; r < 8; r++) {
            var a = r / 8 * Math.PI * 2;
            krans += 'M' + f(Math.cos(a) * 42) + ' ' + f(Math.sin(a) * 42) + 'L' + f(Math.cos(a) * 52) + ' ' + f(Math.sin(a) * 52);
        }
        var baanPad = 'M' + BAAN.x0 + ' ' + BAAN.cy + 'A' + BAAN.rx + ' ' + BAAN.ry + ' 0 0 1 ' + BAAN.x1 + ' ' + BAAN.cy;
        var rollen = '';
        for (var rx = 64; rx <= 416; rx += 44) rollen += '<circle cx="' + rx + '" cy="414" r="6"/>';

        houder.innerHTML =
            '<svg class="bp-zonbril" viewBox="0 0 480 440" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Drie flesjes in de zon: helder, groen en bruin glas">' +
            '<defs>' + defs + '</defs>' +
            '<g clip-path="url(#' + id + '-doos)">' +
                '<g aria-hidden="true">' +
                    '<path class="bp-zonbril__baan" d="' + baanPad + '"/>' +
                    '<g class="bp-zonbril__stralen"><path/><path/><path/></g>' +
                    // lopende band
                    '<path class="bp-l" d="M40 402H440"/>' +
                    '<g class="bp-rollen">' + rollen + '</g>' +
                    '<path class="bp-lf" d="M40 424H440"/>' +
                    flessen +
                    // de zonnebril (verschijnt op de bruine fles)
                    '<g transform="translate(376 ' + f(TOP + 68 * K) + ')"><g class="bp-zonbril__bril">' +
                        '<path class="bp-zonbril__poot" d="M-25 -5L-33 -11M25 -5L33 -11"/>' +
                        '<path class="bp-zonbril__lens" d="M-26 -7H-4V-1C-4 7 -9 10 -15 10S-26 7 -26 -1Z"/>' +
                        '<path class="bp-zonbril__lens" d="M4 -7H26V-1C26 7 21 10 15 10S4 7 4 -1Z"/>' +
                        '<path class="bp-zonbril__brug" d="M-4 -4Q0 -8 4 -4"/>' +
                        '<path class="bp-zonbril__schittering" d="M-21 -3L-15 3M9 -3L15 3"/>' +
                    '</g></g>' +
                    labels +
                '</g>' +
                // de zon (schuif langs de boog)
                '<g class="bp-zonbril__schuif bp-d3__knop" role="slider" tabindex="0" data-eigen-toetsen aria-label="De zon: sleep hem langs de hemel" aria-valuemin="0" aria-valuemax="60" aria-valuenow="0" aria-valuetext="0 minuten zon">' +
                    '<path class="bp-zonbril__spoor" d="' + baanPad + '"/>' +
                    '<g class="bp-zonbril__zon" transform="translate(' + BAAN.x0 + ' ' + BAAN.cy + ')">' +
                        '<circle class="bp-d3__raak" r="50"/>' +
                        '<g class="bp-zonbril__krans"><path d="' + krans + '"/></g>' +
                        '<circle class="bp-zonbril__schijf" r="34"/>' +
                        '<circle class="bp-zonbril__kern" r="24"/>' +
                        '<circle class="bp-d3__puls" r="44"/>' +
                        '<circle class="bp-d3__focus" r="47"/>' +
                    '</g>' +
                '</g>' +
            '</g>' +
            '</svg>';

        var svg = houder.querySelector('svg');
        var schuif = svg.querySelector('.bp-zonbril__schuif');
        var zon = svg.querySelector('.bp-zonbril__zon');
        var stralenG = svg.querySelector('.bp-zonbril__stralen');
        var stralen = stralenG.querySelectorAll('path');
        var flesEls = svg.querySelectorAll('.bp-zonbril__fles');
        var labelEls = svg.querySelectorAll('.bp-zonbril__label');
        FLESSEN.forEach(function (fl, n) {
            fl.el = flesEls[n];
            fl.labelEl = labelEls[n];
            fl.kaartje = labelEls[n].querySelector('.bp-zonbril__kaartje');
            fl.tekst = labelEls[n].querySelector('text');
            fl.niveau = 0;
        });
        var klok = klokjes();

        var pos = 0;          // waar de zon staat (0–60 "minuten")
        var bloot = 0;        // hoeveel zon de flesjes al gehad hebben (gaat nooit terug)
        var fase = 0, klaar = false;

        function zetNiveaus(stil) {
            FLESSEN.forEach(function (fl) {
                var stank = 1 - Math.exp(-0.12 * bloot * fl.door);
                var niveau = stank < 0.15 ? 0 : (stank < 0.55 ? 1 : 2);
                if (niveau === fl.niveau) return;
                fl.el.setAttribute('data-niveau', niveau);
                fl.labelEl.setAttribute('data-niveau', niveau);
                fl.tekst.textContent = NAMEN[niveau];
                pasIn(fl.tekst);
                if (!stil && niveau > fl.niveau) {
                    if (!rustig()) herstart(fl.kaartje, 'is-hop');
                    if (niveau === 2) { speel('fout'); tril([30, 40, 30]); }
                    else speel('tik');
                }
                fl.niveau = niveau;
            });
        }

        // Labeltekst nooit breder dan het kaartje (lettertypes verschillen per toestel).
        function pasIn(tekst) {
            tekst.removeAttribute('textLength');
            tekst.removeAttribute('lengthAdjust');
            var breed = 0;
            try { breed = tekst.getComputedTextLength(); } catch (e) { /* nog niet getekend */ }
            if (breed > 108) {
                tekst.setAttribute('textLength', '108');
                tekst.setAttribute('lengthAdjust', 'spacingAndGlyphs');
            }
        }

        function meld() {
            var nieuw = bloot <= 0 ? 0 : bloot < 4 ? 1 : bloot < 20 ? 2 : bloot < 60 ? 3 : 4;
            if (nieuw <= fase) return;
            fase = nieuw;
            if (fase === 1) ctx.melding('Een paar minuten zon… het heldere flesje ruikt al!', 'info');
            else if (fase === 2) ctx.melding('Uv en blauw licht breken de hop af: helder en groen raken lichtgeraakt.', 'info');
            if (fase >= 3 && !klaar) gelukt();
            if (fase === 4) ctx.melding('Een uur zon: helder en groen stinken, bruin blijft fris.', 'goed');
        }

        function gelukt() {
            klaar = true;
            svg.classList.add('is-bril');
            klok.na(rustig() ? 0 : 420, function () { speel('klik'); });
            ctx.cel.classList.add('is-zonbril-klaar');
            ctx.melding('Bruin glas is een zonnebril voor je bier!', 'goed');
            ctx.gelukt('Bruin glas wint: dit bier blijft fris!');
        }

        function teken() {
            var p = pos / 60, x = BAAN.x0 + (BAAN.x1 - BAAN.x0) * p, c = (x - BAAN.cx) / BAAN.rx;
            var y = BAAN.cy - BAAN.ry * Math.sqrt(Math.max(0, 1 - c * c));
            zon.setAttribute('transform', 'translate(' + f(x) + ' ' + f(y) + ')');
            for (var n = 0; n < 3; n++) {
                stralen[n].setAttribute('d', 'M' + f(x) + ' ' + f(y) + 'L' + FLESSEN[n].x + ' ' + f(TOP + 82 * K));
            }
            stralenG.style.opacity = (B.klem(pos / 3, 0, 1) * 0.9).toFixed(2);
            svg.style.setProperty('--bp-zonbril-licht', B.klem(pos / 3, 0, 1).toFixed(2));
            var m = Math.round(pos);
            schuif.setAttribute('aria-valuenow', m);
            schuif.setAttribute('aria-valuetext', m + (m === 1 ? ' minuut' : ' minuten') + ' zon' +
                (fase ? '. ' + FLESSEN.map(function (fl) { return fl.label + ': ' + NAMEN[fl.niveau].replace('!', ''); }).join(', ') : ''));
        }

        function zet(v) {
            pos = B.klem(v, 0, 60);
            if (pos > bloot) bloot = pos;
            zetNiveaus(false);
            meld();
            teken();
            if (pos > 0) ctx.opnieuwZichtbaar(true);
            ctx.cel.classList.toggle('is-zonnig', pos > 0);
        }

        function naarPunt(e) {
            var pt = svgPunt(svg, e);
            zet((pt.x - BAAN.x0) / (BAAN.x1 - BAAN.x0) * 60);
        }
        gebaar(schuif, {
            begin: function (e) { svg.classList.add('is-sleept'); naarPunt(e); },
            sleep: function (dx, dy, e) { naarPunt(e); },
            los: function () { svg.classList.remove('is-sleept'); }
        });
        schuif.addEventListener('keydown', function (e) {
            var stap = { ArrowRight: 2, ArrowUp: 2, ArrowLeft: -2, ArrowDown: -2, PageUp: 10, PageDown: -10 }[e.key];
            if (e.key === 'Home') { e.preventDefault(); zet(0); }
            else if (e.key === 'End') { e.preventDefault(); zet(60); }
            else if (stap) { e.preventDefault(); zet(pos + stap); }
        });

        function opnieuw() {
            klok.leeg(false);
            pos = 0; bloot = 0; fase = 0; klaar = false;
            FLESSEN.forEach(function (fl) { fl.niveau = -1; });
            zetNiveaus(true);
            svg.classList.remove('is-bril', 'is-sleept');
            ctx.cel.classList.remove('is-zonnig', 'is-zonbril-klaar');
            ctx.melding('');
            ctx.opnieuwZichtbaar(false);
            teken();
        }

        teken();
        svg.classList.add('is-pauze');

        return {
            hint: { el: schuif, tekst: 'Sleep de zon' },
            open: function () { svg.classList.remove('is-pauze'); },
            dicht: function () {
                rondAf(klok);
                svg.classList.remove('is-sleept');
                svg.classList.add('is-pauze');
            },
            opnieuw: opnieuw
        };
    };

    /* ==================================================================
       9. DE WARME KAMER — wachten, de druk zien oplopen, en dan: psst!
       ================================================================== */
    I.warmekamer = function (houder, ctx) {
        var id = B.uniekId('bp-warmk');
        var rnd = willekeur(909);
        var DUUR = 8;                    // 3 weken in 8 seconden
        var KLAAR = 2.0;                 // bar: genoeg prik om open te maken
        var PLAT = 0.5;                  // bar: daaronder is het bier nog plat

        // Druk in de fles: de gist start traag, eet dan de bottelsuiker op en
        // houdt op als de suiker op is. Na ± 2 weken ruim 2 bar (een autoband).
        function sCurve(w) { return 1 / (1 + Math.exp(-2.6 * (w - 1.1))); }
        var S0 = sCurve(0);
        function voortgang(w) { return B.klem((sCurve(w) - S0) / (1 - S0), 0, 1); }
        function druk(w) { return 2.4 * voortgang(w); }
        var W_KLAAR = (function () {
            var s = (KLAAR / 2.4) * (1 - S0) + S0;
            return 1.1 + Math.log(s / (1 - s)) / 2.6;
        })();

        var AUTO = [
            [0, 'Suiker en verse gist erbij, kroonkurk erop. Nu wachten…'],
            [0.25, 'De gist snoept de suiker op. Het koolzuur kan nergens heen.'],
            [1.0, 'Het koolzuur lost op in het bier: de druk loopt op.'],
            [W_KLAAR, 'Ruim 2 bar, net zoveel als een autoband. Open de fles!'],
            [2.0, 'Twee weken: onderin ligt nu een dun gistdepot. Open de fles!']
        ];

        var flesPad = 'M134 160V204C134 224 110 232 110 260V388Q110 404 126 404H174Q190 404 190 388V260C190 232 166 224 166 204V160Z';
        var kelkPad = 'M360 246C356 262 344 276 346 296C348 322 368 336 390 336C412 336 432 322 434 296C436 276 424 262 420 246Z';

        // Krijtstreepjes: 21 dagen, in bosjes van vijf.
        var streepjes = '';
        for (var d = 0; d < 21; d++) {
            var bos = Math.floor(d / 5), inBos = d % 5, x0 = 34 + bos * 46;
            var j = function () { return f((rnd() - 0.5) * 2.4); };
            if (inBos < 4) {
                var sx = x0 + inBos * 8;
                streepjes += '<path d="M' + f(sx + +j()) + ' ' + f(34 + +j()) + 'L' + f(sx + +j()) + ' ' + f(66 + +j()) + '"/>';
            } else {
                streepjes += '<path d="M' + f(x0 - 5) + ' ' + f(60 + +j()) + 'L' + f(x0 + 30) + ' ' + f(40 + +j()) + '"/>';
            }
        }
        var suiker = '', opgelost = '', gisting = '', depotStip = '';
        for (var s1 = 0; s1 < 16; s1++) suiker += '<circle cx="' + f(118 + rnd() * 64) + '" cy="' + f(270 + rnd() * 112) + '" r="3.2"/>';
        for (var s2 = 0; s2 < 30; s2++) opgelost += '<circle cx="' + f(116 + rnd() * 68) + '" cy="' + f(214 + rnd() * 172) + '" r="' + f(1 + rnd() * 1.3) + '"/>';
        for (var s3 = 0; s3 < 10; s3++) gisting += '<circle style="--d:' + f(-rnd() * 2.4) + 's" cx="' + f(120 + rnd() * 60) + '" cy="' + f(330 + rnd() * 60) + '" r="' + f(1.6 + rnd() * 1.4) + '"/>';
        for (var s4 = 0; s4 < 14; s4++) depotStip += '<circle cx="' + f(114 + rnd() * 72) + '" cy="' + f(396 + rnd() * 5) + '" r="' + f(1.4 + rnd() * 1.2) + '"/>';
        var pareling = '';
        for (var s5 = 0; s5 < 7; s5++) pareling += '<circle style="--d:' + f(s5 * 0.32) + 's" cx="' + f(374 + rnd() * 32) + '" cy="330" r="' + f(1 + rnd() * 0.8) + '"/>';

        // Meterschaal: −120° (0 bar) tot +120° (3 bar).
        function hoekVan(p) { return -120 + B.klem(p / 3, 0, 1) * 240; }
        function boog(r, p1, p2) {
            var a1 = (hoekVan(p1) - 90) * Math.PI / 180, a2 = (hoekVan(p2) - 90) * Math.PI / 180;
            return 'M' + f(Math.cos(a1) * r) + ' ' + f(Math.sin(a1) * r) + 'A' + r + ' ' + r + ' 0 ' + ((hoekVan(p2) - hoekVan(p1)) > 180 ? 1 : 0) + ' 1 ' + f(Math.cos(a2) * r) + ' ' + f(Math.sin(a2) * r);
        }
        var schaalTik = '';
        for (var t = 0; t <= 3; t++) {
            var ta = (hoekVan(t) - 90) * Math.PI / 180;
            schaalTik += 'M' + f(Math.cos(ta) * 26) + ' ' + f(Math.sin(ta) * 26) + 'L' + f(Math.cos(ta) * 33) + ' ' + f(Math.sin(ta) * 33);
        }

        houder.innerHTML =
            '<svg class="bp-warmk" viewBox="0 0 480 440" preserveAspectRatio="xMidYMid meet" role="group" aria-label="De warme kamer: een Rolduc-fles met drukmeter en een leeg kelkglas">' +
            '<defs>' +
                '<clipPath id="' + id + '-doos"><rect width="480" height="440"/></clipPath>' +
                '<clipPath id="' + id + '-fles"><path d="' + flesPad + '"/></clipPath>' +
                '<clipPath id="' + id + '-kelk"><path d="' + kelkPad + '"/></clipPath>' +
            '</defs>' +
            '<g clip-path="url(#' + id + '-doos)">' +
                '<g aria-hidden="true">' +
                    // lamp met warme gloed
                    '<circle class="bp-warmk__gloed" cx="330" cy="66" r="150"/>' +
                    '<path class="bp-lf" d="M330 0V22"/>' +
                    '<path class="bp-v bp-l" d="M306 44L316 22H344L354 44Z"/>' +
                    '<path class="bp-warmk__peer" d="M320 44A10 10 0 0 0 340 44Z"/>' +
                    // krijt op de muur
                    '<g class="bp-warmk__krijt">' + streepjes + '</g>' +
                    '<text class="bp-warmk__krijttekst" x="34" y="97">dag 0</text>' +
                    '<text class="bp-warmk__krijttekst bp-warmk__krijttekst--rechts" x="452" y="97">22 °C</text>' +
                    // plank
                    '<path class="bp-v bp-l" d="M36 404H444V416H36Z"/>' +
                    '<path class="bp-lf" d="M70 416L84 436M410 416L396 436"/>' +
                    // spijker met de flesopener
                    '<circle class="bp-warmk__spijker" cx="80" cy="126" r="3"/>' +
                    '<g class="bp-warmk__opener">' +
                        '<path class="bp-warmk__staal" d="M-14 -2C-14 -15 14 -15 14 -2L7 82Q0 90 -7 82Z"/>' +
                        '<circle class="bp-warmk__gat" cx="0" cy="0" r="6.5"/>' +
                        '<path class="bp-warmk__lip" d="M-6 6Q0 10 6 6"/>' +
                    '</g>' +
                    // het Rolduc-kelkglas (tulpglas op voet)
                    '<g class="bp-warmk__kelk">' +
                        '<path class="bp-warmk__kelkglas" d="' + kelkPad + '"/>' +
                        '<g clip-path="url(#' + id + '-kelk)">' +
                            '<rect class="bp-warmk__kelkbier" x="340" y="252" width="100" height="86"/>' +
                            '<g class="bp-warmk__pareling">' + pareling + '</g>' +
                        '</g>' +
                        '<path class="bp-warmk__kelkschuim" d="M352 260C352 248 362 242 372 246C380 238 396 238 404 246C414 242 428 248 428 260C428 264 352 264 352 260Z"/>' +
                        '<path class="bp-l" d="' + kelkPad + '"/>' +
                        '<use href="#bp-sym-r" class="bp-warmk__gravure" x="378" y="284" width="24" height="28"/>' +
                        '<path class="bp-glans" d="M356 268C352 286 354 304 364 318"/>' +
                        '<path class="bp-l" d="M390 336V396"/>' +
                        '<path class="bp-v bp-l" d="M352 404C352 394 428 394 428 404Z"/>' +
                    '</g>' +
                    '<path class="bp-warmk__straal" d="M372 240C378 262 386 290 388 330"/>' +
                '</g>' +
                // de fles (met drukmeter); schuift weg en komt terug bij een nieuwe fles
                '<g class="bp-warmk__drager">' +
                    '<g class="bp-warmk__meter" aria-hidden="true">' +
                        '<rect class="bp-v bp-lf" x="132" y="192" width="36" height="14" rx="3"/>' +
                        '<path class="bp-lf" d="M168 196H210M168 204H210"/>' +
                        '<g transform="translate(246 200)">' +
                            '<circle class="bp-v bp-l" r="40"/>' +
                            '<path class="bp-warmk__schaal" d="' + boog(30, 0, 3) + '"/>' +
                            '<path class="bp-warmk__zone" d="' + boog(30, KLAAR, 3) + '"/>' +
                            '<path class="bp-tik" d="' + schaalTik + '"/>' +
                            '<g class="bp-warmk__wijzer"><path d="M0 4V-27"/><circle r="4.5"/></g>' +
                            '<text class="bp-warmk__getal" x="0" y="28">0,0</text>' +
                        '</g>' +
                        '<text class="bp-warmk__eenheid" x="246" y="266">bar</text>' +
                    '</g>' +
                    '<g class="bp-warmk__fles" aria-hidden="true">' +
                        '<g clip-path="url(#' + id + '-fles)">' +
                            '<rect class="bp-warmk__bruin" x="106" y="150" width="88" height="258"/>' +
                            '<rect class="bp-warmk__bier" x="106" y="196" width="88" height="212"/>' +
                            '<g class="bp-warmk__suiker">' + suiker + '</g>' +
                            '<g class="bp-warmk__opgelost">' + opgelost + '</g>' +
                            '<g class="bp-warmk__gisting">' + gisting + '</g>' +
                            '<rect class="bp-warmk__depot" x="106" y="390" width="88" height="14"/>' +
                            '<g class="bp-warmk__depotstip">' + depotStip + '</g>' +
                            '<path class="bp-warmk__halsschuim" d="M110 200C120 190 130 198 140 190C150 184 160 194 170 188C178 184 186 192 194 190V214H110Z"/>' +
                        '</g>' +
                        '<path class="bp-l" d="' + flesPad + '"/>' +
                        '<rect class="bp-v bp-lf" x="118" y="292" width="64" height="60" rx="3"/>' +
                        '<use href="#bp-sym-r" class="bp-fles-r" x="136" y="304" width="28" height="36"/>' +
                        '<path class="bp-glans" d="M118 268V380"/>' +
                        '<g class="bp-warmk__overloop"><path d="M136 150C126 134 142 120 150 126C160 118 178 132 164 150Z"/><path d="M138 150C136 158 138 166 135 176"/></g>' +
                        '<g class="bp-warmk__psst"><path d="M134 132L118 116"/><path d="M150 126V102"/><path d="M166 132L182 116"/></g>' +
                        '<path class="bp-warmk__zucht" d="M150 138C144 130 156 124 150 116S156 104 150 96"/>' +
                    '</g>' +
                    // de kroonkurk (hoofd-hotspot): tik erop of veeg omhoog
                    '<g class="bp-warmk__knop bp-d3__knop" role="button" tabindex="0" data-eigen-toetsen aria-label="Open de fles">' +
                        raakRect(54, 96, 146, 116, 16) +
                        '<ellipse class="bp-warmk__kurkring" cx="150" cy="153" rx="34" ry="22"/>' +
                        '<g class="bp-warmk__kurk"><rect class="bp-kroonkurk" x="130" y="146" width="40" height="14" rx="4"/><path class="bp-warmk__kartel" d="M134 160v3M140 160v3M146 160v3M152 160v3M158 160v3M164 160v3"/></g>' +
                        ringenRect(54, 96, 146, 116, 16) +
                    '</g>' +
                '</g>' +
            '</g>' +
            '</svg>';

        var svg = houder.querySelector('svg');
        var knop = svg.querySelector('.bp-warmk__knop');
        var streepEls = svg.querySelectorAll('.bp-warmk__krijt path');
        var weekTekst = svg.querySelector('.bp-warmk__krijttekst');
        var wijzer = svg.querySelector('.bp-warmk__wijzer');
        var getal = svg.querySelector('.bp-warmk__getal');
        var opdrachtEl = ctx.scene && ctx.scene.querySelector('[data-opdracht]');
        var opdrachtStart = (opdrachtEl && opdrachtEl.textContent) || 'Wacht op de prik en open dan de fles.';
        var klok = klokjes();

        var w = 0;                 // weken in de warme kamer (0–3)
        var fase = 'wacht';        // wacht | plat | prik | goed
        var zichtbaar = false, autoB = -1, rustTot = 0, vorigeDagen = -1, vorigeWeek = 0;
        var klaarGemeld = false, labelBar = '';

        function toonDruk(p) {
            wijzer.style.transform = 'rotate(' + f(hoekVan(p)) + 'deg)';
            getal.textContent = B.getal(p, 1);
        }

        function teken() {
            var v = voortgang(w), p = druk(w);
            var dagen = Math.min(21, Math.floor(w * 7 + 1e-6));
            if (dagen !== vorigeDagen) {
                for (var i = 0; i < streepEls.length; i++) streepEls[i].classList.toggle('is-aan', i < dagen);
                vorigeDagen = dagen;
                weekTekst.textContent = 'dag ' + dagen;
            }
            if (Math.floor(w) > vorigeWeek && fase === 'wacht') speel('tik');
            vorigeWeek = Math.floor(w);
            svg.style.setProperty('--bp-warmk-suiker', (1 - v).toFixed(3));
            svg.style.setProperty('--bp-warmk-opgelost', v.toFixed(3));
            svg.style.setProperty('--bp-warmk-gisting', (4 * v * (1 - v)).toFixed(3));
            svg.style.setProperty('--bp-warmk-depot', Math.pow(v, 1.5).toFixed(3));
            if (fase === 'wacht') {
                toonDruk(p);
                var bar = B.getal(p, 1);
                if (bar !== labelBar) { labelBar = bar; knop.setAttribute('aria-label', 'Open de fles (nu ' + bar + ' bar)'); }
                var klaar = p >= KLAAR;
                svg.classList.toggle('is-klaar', klaar);
                ctx.cel.classList.toggle('is-warm-klaar', klaar);
                if (klaar && !klaarGemeld) {
                    klaarGemeld = true;
                    ctx.opdracht('Open nu de fles: tik op de kroonkurk.');
                }
                // Automatische tussenstand (niet over een verse foutmelding heen).
                var b = 0;
                for (var a = AUTO.length - 1; a >= 0; a--) { if (w >= AUTO[a][0]) { b = a; break; } }
                if (b !== autoB && Date.now() >= rustTot) { autoB = b; ctx.melding(AUTO[b][1], 'info'); }
            }
        }

        var lus = B.lus(function (dt) {
            if (fase === 'wacht' && w < 3) {
                w = Math.min(3, w + dt * 3 / DUUR);
                teken();
            }
            if (fase !== 'wacht' || w >= 3) lus.stop();
        }, houder);

        function nieuweFles() {
            svg.classList.add('is-weg');
            klok.na(rustig() ? 0 : 460, function () {
                w = 0; fase = 'wacht'; autoB = 0; vorigeWeek = 0; klaarGemeld = false; labelBar = '';
                svg.classList.add('is-zonder');
                svg.classList.remove('is-open', 'is-plat', 'is-prik', 'is-goed', 'is-klaar', 'is-weg');
                svg.classList.add('is-komt');
                knop.removeAttribute('aria-disabled');
                ctx.opdracht(opdrachtStart);
                teken();
                void svg.getBoundingClientRect();
                svg.classList.remove('is-zonder', 'is-komt');
                if (zichtbaar) lus.start();
            });
        }

        function schenk() {
            if (rustig()) {
                svg.classList.add('is-vol', 'is-kraag', 'is-geschonken');
                return;
            }
            svg.classList.add('is-schenk');
            klok.na(520, function () {
                svg.classList.add('is-straal', 'is-vol');
                speel('inschenken', { duur: 1.2 });
            });
            klok.na(1800, function () { svg.classList.add('is-kraag'); svg.classList.remove('is-straal'); });
            klok.na(2050, function () { svg.classList.remove('is-schenk'); svg.classList.add('is-geschonken'); });
        }

        function openFles() {
            if (fase !== 'wacht') return;
            var p = druk(w);
            lus.stop();
            ctx.opnieuwZichtbaar(true);
            knop.setAttribute('aria-disabled', 'true');
            svg.classList.remove('is-klaar');
            ctx.cel.classList.remove('is-warm-klaar');
            svg.classList.add('is-open');
            speel('kurk');
            toonDruk(0);
            rustTot = Date.now() + 2600;
            if (p < PLAT) {
                fase = 'plat';
                svg.classList.add('is-plat');
                ctx.melding('Pfff… nog plat. De gist heeft nog geen koolzuur gemaakt.', 'fout');
                klok.na(1300, nieuweFles);
            } else if (p < KLAAR) {
                fase = 'prik';
                svg.classList.add('is-prik');
                klok.na(320, function () { speel('psst'); });
                ctx.melding('Psst… een beetje prik, maar nog te weinig. Wacht langer!', 'fout');
                klok.na(1400, nieuweFles);
            } else {
                fase = 'goed';
                svg.classList.add('is-goed');
                ctx.cel.classList.add('is-warm-proost');
                klok.na(320, function () { speel('psst'); });
                ctx.melding('Pssst! Een fluweelzachte pareling en een trotse schuimkraag. Proost!', 'goed');
                ctx.opdracht(opdrachtStart);
                ctx.gelukt('Psst! Perfect gehergist: proost!');
                klok.na(rustig() ? 0 : 1300, schenk);
            }
        }

        gebaar(knop, {
            uit: function () { return fase !== 'wacht'; },
            los: function (dx, dy, echt) {
                if (!echt) return;
                if (Math.sqrt(dx * dx + dy * dy) < 12 || dy < -14) openFles();
            }
        });
        knop.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (!e.repeat) openFles();
            }
        });

        function opnieuw() {
            klok.leeg(false);
            lus.stop();
            w = 0; fase = 'wacht'; autoB = -1; rustTot = 0; vorigeWeek = 0; klaarGemeld = false; labelBar = '';
            svg.classList.add('is-zonder');
            svg.classList.remove('is-open', 'is-plat', 'is-prik', 'is-goed', 'is-klaar', 'is-weg', 'is-komt',
                'is-schenk', 'is-straal', 'is-vol', 'is-kraag', 'is-geschonken');
            void svg.getBoundingClientRect();
            svg.classList.remove('is-zonder');
            knop.removeAttribute('aria-disabled');
            ctx.cel.classList.remove('is-warm-klaar', 'is-warm-proost');
            ctx.opdracht(opdrachtStart);
            ctx.opnieuwZichtbaar(false);
            teken();                        // zet ook de eerste tussenstand in de feedbackregel
            if (zichtbaar) lus.start();
        }

        teken();
        svg.classList.add('is-pauze');

        return {
            hint: { el: knop, tekst: 'Wacht… en tik dan op de kurk' },
            open: function () {
                zichtbaar = true;
                svg.classList.remove('is-pauze');
                if (fase === 'wacht') { teken(); lus.start(); }
            },
            dicht: function () {
                zichtbaar = false;
                lus.stop();
                // Wat nog moest gebeuren (inschenken, nieuwe fles) staat meteen klaar.
                svg.classList.add('is-zonder');
                rondAf(klok);
                void svg.getBoundingClientRect();
                svg.classList.remove('is-zonder');
                svg.classList.add('is-pauze');
            },
            opnieuw: opnieuw
        };
    };
})();
