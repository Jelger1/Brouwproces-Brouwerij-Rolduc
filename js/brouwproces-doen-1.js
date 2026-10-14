/* =====================================================================
   Brouwerij Rolduc — De Brouwreis: scène B ("Doen") voor stap 1, 2 en 3

     rooster  stap 1  Kleur de mout     de roostertrommel aanhouden (vasthouden)
     molen    stap 2  Plet de korrel    draaien aan het slingerwiel (met nadraai)
     maisch   stap 3  Wek de enzymen    de thermometer slepen: eerst 62, dan 72 °C

   Elk proefje vult zijn podium met één SVG-close-up (viewBox 480×440,
   alles binnen x 20–460). Uitleg en feedback gaan via ctx.melding(); in
   de SVG staan alleen korte labels (≥ 22 eenheden). Werkt met vinger,
   muis en toetsenbord. Het contract staat in fase3/BOUW-DOEN.md:
     Brouw.interacties[naam](houder, ctx) → { hint, open, dicht, opnieuw }
   ===================================================================== */

(function () {
    'use strict';

    var B = window.Brouw;
    if (!B) return;
    var D = window.BROUWPROCES || {};
    var I = B.interacties = B.interacties || {};
    var G = B.geluid || { speel: function () { }, lus: function () { return { stop: function () { } }; } };

    /* De tipteksten (wat / waarom / hint) staan centraal in brouwproces-data.js
       → hulp.rooster, hulp.molen, hulp.maisch. Hier alleen een terugval. */
    function hulpHint(naam, standaard) {
        var h = D.hulp && D.hulp[naam];
        return (h && h.hint) || standaard;
    }

    /* ------------------------------------------------------------------
       Gedeelde hulpjes
       ------------------------------------------------------------------ */
    function niets() { }

    // ctx kan (in een test of bij een vroege bouw) onvolledig zijn.
    function veiligCtx(ctx, houder) {
        ctx = ctx || {};
        function fn(f) { return typeof f === 'function' ? f : niets; }
        return {
            cel: ctx.cel || houder.closest('.bp-stap') || document.createElement('div'),
            ketel: ctx.ketel || null,
            scene: ctx.scene || houder.closest('.bp-scherm') || null,
            melding: fn(ctx.melding),
            opdracht: fn(ctx.opdracht),
            opnieuwZichtbaar: fn(ctx.opnieuwZichtbaar),
            gelukt: fn(ctx.gelukt)
        };
    }

    function beginOpdracht(c, standaard) {
        var el = c.scene && c.scene.querySelector('[data-opdracht]');
        var t = el && el.textContent.trim();
        return t || standaard;
    }

    // Meldt alleen als er echt iets verandert (anders kletst aria-live).
    function melder(c) {
        var laatst = null;
        function meld(tekst, soort) {
            soort = soort || 'info';
            var sleutel = soort + '|' + tekst;
            if (sleutel === laatst) return;
            laatst = sleutel;
            c.melding(tekst, soort);
        }
        meld.wis = function () { laatst = null; c.melding('', ''); };
        return meld;
    }

    // Haptiek: niet vaker dan eens per 150 ms; bij minder beweging alleen 'gelukt'.
    var trilKlok = 0;
    function tril(patroon) {
        if (B.minderBeweging()) return;
        var nu = Date.now();
        if (nu - trilKlok < 150) return;
        trilKlok = nu;
        B.trillen(patroon);
    }

    // Schermcoördinaten → viewBox-coördinaten van de close-up.
    function svgPunt(svg, e) {
        var m = svg.getScreenCTM();
        if (!m) return { x: 0, y: 0 };
        var p = svg.createSVGPoint();
        p.x = e.clientX; p.y = e.clientY;
        p = p.matrixTransform(m.inverse());
        return { x: p.x, y: p.y };
    }

    function zet(el, naam, waarde) {
        waarde = String(waarde);
        if (el && el.getAttribute(naam) !== waarde) el.setAttribute(naam, waarde);
    }
    function tekst(el, t) { if (el && el.textContent !== t) el.textContent = t; }
    function f1(n) { return (Math.round(n * 10) / 10).toString(); }

    // Na ↺: knop weer weg; had hij de focus, dan gaat die naar de hoofd-hotspot.
    function opnieuwKlaar(c, hot) {
        var a = document.activeElement;
        var hadKnop = !!(a && a.matches && a.matches('[data-opnieuw]'));
        c.opnieuwZichtbaar(false);
        if (hadKnop && hot && hot.focus) { try { hot.focus({ preventScroll: true }); } catch (e) { /* oude browser */ } }
    }

    // Puls- en focusring rond een hotspot (de app zet .bp-pulse op de hotspot).
    function ringen(vorm, puls, focus) {
        return '<' + vorm + ' class="bp-d1-ring bp-d1-ring--puls" ' + puls + '/>' +
            '<' + vorm + ' class="bp-d1-ring bp-d1-ring--focus" ' + focus + '/>';
    }

    // Een schaartje (enzym), wijzend naar +x, scharnier in 0,0.
    function schaar(klasse, transform) {
        return '<g class="bp-d1-schaar ' + klasse + '" transform="' + transform + '">' +
            '<g class="bp-d1-schaar__blad" data-blad="1"><path class="bp-d1-schaar__mes" d="M-2 -2.6L29 -1.2Q31.5 0 29 .9L-2 2.2Z"/><path class="bp-d1-schaar__arm" d="M-2 1.6L-8.5 6.6"/><circle class="bp-d1-schaar__ring" cx="-12.5" cy="8.6" r="5.6"/></g>' +
            '<g class="bp-d1-schaar__blad" data-blad="2"><path class="bp-d1-schaar__mes" d="M-2 2.6L29 1.2Q31.5 0 29 -.9L-2 -2.2Z"/><path class="bp-d1-schaar__arm" d="M-2 -1.6L-8.5 -6.6"/><circle class="bp-d1-schaar__ring" cx="-12.5" cy="-8.6" r="5.6"/></g>' +
            '<circle class="bp-d1-schaar__spil" r="2.3"/>' +
            '</g>';
    }
    function schaarOpen(el, open) {
        var a = f1(open * 17);
        var bladen = el.querySelectorAll('.bp-d1-schaar__blad');
        zet(bladen[0], 'transform', 'rotate(-' + a + ')');
        zet(bladen[1], 'transform', 'rotate(' + a + ')');
    }

    function stuk(lijst, x) {
        // Lineair tussen knooppunten [[x, y], …].
        if (x <= lijst[0][0]) return lijst[0][1];
        for (var i = 1; i < lijst.length; i++) {
            if (x <= lijst[i][0]) {
                var a = lijst[i - 1], b = lijst[i];
                return B.lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
            }
        }
        return lijst[lijst.length - 1][1];
    }

    function svgKop(klasse, label) {
        return '<svg class="bp-d1__svg ' + klasse + '" viewBox="0 0 480 440" preserveAspectRatio="xMidYMid meet" role="group" aria-label="' + label + '" focusable="false">';
    }

    /* ==================================================================
       1. KLEUR DE MOUT  (vasthouden)
       Houd de roostertrommel aan: hete lucht stroomt langs een gloeiende
       spiraal de draaiende trommel in, de korrels tuimelen rond en kleuren
       van pils- via karamel- naar chocolademout. Het proefglas kleurt mee
       en de enzymen op het kaartje vallen één voor één uit.
       In het echt doet de mouterij dit: pilsmout droogt met warme lucht op
       80–85 °C, donkere mout gaat in een roostertrommel tot ± 220 °C.
       ================================================================== */
    var ZAK = 'M96 132C78 168 60 226 66 272C70 300 96 310 160 310C224 310 250 300 254 272C260 226 242 168 224 132Z';
    var GLAS = 'M34 14C30 34 20 52 22 76C24 102 40 122 56 128H64C80 122 96 102 98 76C100 52 90 34 86 14Z';

    I.rooster = function (houder, ctx) {
        var c = veiligCtx(ctx, houder);
        var id = B.uniekId('bp-rooster');
        var mout = D.mout || {};
        var K = {
            pils: (mout.pils && mout.pils.staal) || '#F2DC9A',
            karamel: (mout.karamel && mout.karamel.staal) || '#C2701F',
            choc: (mout.chocolade && mout.chocolade.staal) || '#2B1206',
            zwart: '#120804'
        };
        var OPDRACHT = 'Houd de trommel aan en kleur de mout.';
        var TEKST = {
            pils: 'Pilsmout: met warme lucht gedroogd op 80–85 °C. Enzymen blijven heel.',
            karamel: 'Karamelmout: nat gestoofd, dan geroosterd. Zoet als karamel, amberrood van kleur.',
            gelukt: 'Hoe donkerder geroosterd, hoe donkerder je bier.',
            enzymen: 'Let op: donkere mout heeft geen werkende enzymen meer. Pilsmout blijft nodig.',
            verbrand: 'Nog heter? Dan verbrandt de mout! Laat maar los.',
            langer: 'Houd langer vast: hoe heter geroosterd, hoe donkerder de mout.',
            bijna: 'Bijna! Houd nog even vast voor chocolademout.'
        };
        var NAMEN = ['Pilsmout', 'Karamelmout', 'Chocolademout', 'Chocolademout'];
        var DUUR = 6;            // seconden vasthouden van licht tot verbrand
        var TX = 228, TY = 242;  // midden van de trommel

        // Korrels in de trommel: een hoopje onderin (hoek, straal) dat gaat tuimelen.
        var KORRELS = [];
        for (var i = 0; i < 12; i++) {
            KORRELS.push({
                hoek: 90 + (i % 4 - 1.5) * 26 + (i % 3 - 1) * 5,
                straal: 39 - Math.floor(i / 4) * 12,
                draai: (i * 47) % 180 - 90,
                fase: i * 0.9,
                k: 0.8 + (i % 4) * 0.15
            });
        }
        var korrels = KORRELS.map(function () {
            return '<g class="bp-rooster__k"><ellipse class="bp-rooster__korrel" rx="13" ry="6.5"/><path class="bp-rooster__naad" d="M-9 0H9"/></g>';
        }).join('');
        var schoepen = '', bouten = '';
        for (var s = 0; s < 6; s++) {
            var as = s / 6 * Math.PI * 2;
            schoepen += 'M' + f1(TX + Math.cos(as) * 59) + ' ' + f1(TY + Math.sin(as) * 59) + 'L' + f1(TX + Math.cos(as) * 69) + ' ' + f1(TY + Math.sin(as) * 69);
        }
        for (var b = 0; b < 12; b++) {
            var ab = (b + 0.5) / 12 * Math.PI * 2;
            bouten += '<circle cx="' + f1(TX + Math.cos(ab) * 74) + '" cy="' + f1(TY + Math.sin(ab) * 74) + '" r="1.9"/>';
        }
        var SPIRAAL = 'M180 346q6-12 12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0';
        var enzymen = '';
        [42, 78, 114].forEach(function (x, j) {
            enzymen += schaar('bp-rooster__enzym', 'translate(' + x + ' ' + (178 + (j % 2 ? -1 : 1)) + ') scale(.62)');
        });

        houder.innerHTML = '<div class="bp-d1 bp-rooster">' +
            svgKop('bp-rooster__svg', 'Close-up: moutkorrels in een hete roostertrommel, een zak mout en een proefglas') +
            '<defs>' +
                '<clipPath id="' + id + '-zak"><path d="' + ZAK + '"/></clipPath>' +
                '<clipPath id="' + id + '-glas"><path d="' + GLAS + '"/></clipPath>' +
                '<clipPath id="' + id + '-raam"><circle cx="' + TX + '" cy="' + TY + '" r="52"/></clipPath>' +
                '<radialGradient id="' + id + '-gloed" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE08A"/><stop offset=".45" stop-color="#F59A3A" stop-opacity=".8"/><stop offset="1" stop-color="#E0561E" stop-opacity="0"/></radialGradient>' +
            '</defs>' +
            '<g class="bp-rooster__scene" transform="translate(0 -26)">' +
            '<ellipse class="bp-schaduw" cx="238" cy="404" rx="216" ry="11"/>' +
            // de jutezak (uit scène A), links achter de trommel
            '<g class="bp-rooster__zak" aria-hidden="true" transform="translate(-31 150) scale(.8)">' +
                '<path class="bp-v bp-l" d="' + ZAK + '"/>' +
                '<g class="bp-rooster__jute" clip-path="url(#' + id + '-zak)">' +
                    '<path d="M70 150H250M70 162H250M70 174H250M70 186H250M70 198H250M70 210H250M70 222H250M70 234H250M70 246H250M70 258H250M70 270H250M70 282H250M70 294H250"/>' +
                    '<path d="M84 130V310M96 130V310M108 130V310M120 130V310M132 130V310M144 130V310M156 130V310M168 130V310M180 130V310M192 130V310M204 130V310M216 130V310M228 130V310M240 130V310"/>' +
                '</g>' +
                '<path class="bp-lf" d="M112 168C122 204 112 244 122 290M206 172C198 208 210 250 200 292"/>' +
                '<path class="bp-v bp-l" d="M90 128C88 112 112 104 160 104C208 104 232 112 230 128C228 144 204 152 160 152C116 152 92 144 90 128Z"/>' +
                '<path class="bp-lf" d="M96 136C118 146 202 146 224 136"/>' +
                '<ellipse class="bp-rooster__opening" cx="160" cy="125" rx="58" ry="12"/>' +
                '<path class="bp-rooster__hoop" d="M104 126C112 100 208 100 216 126Z"/>' +
            '</g>' +
            // het kaartje "enzymen" op een stokje in de zak
            '<g class="bp-rooster__kaartje" aria-hidden="true">' +
                '<path class="bp-rooster__stok" d="M82 196L88 244"/>' +
                '<rect class="bp-rooster__kaart" x="22" y="110" width="120" height="88" rx="8"/>' +
                '<circle class="bp-rooster__gaatje" cx="82" cy="119" r="2.6"/>' +
                '<text class="bp-rooster__kaarttekst" x="82" y="150">enzymen</text>' +
                enzymen +
            '</g>' +
            // het proefglas: "bier van deze mout"
            '<g class="bp-rooster__glas" aria-hidden="true" transform="translate(344 216) scale(1.1)">' +
                '<ellipse class="bp-rooster__onderzetter" cx="60" cy="168" rx="44" ry="6"/>' +
                '<g clip-path="url(#' + id + '-glas)">' +
                    '<rect class="bp-rooster__bier" x="10" y="30" width="100" height="104"/>' +
                    '<rect class="bp-rooster__schuim" x="10" y="18" width="100" height="16"/>' +
                    '<g class="bp-rooster__bubbels"><circle cx="48" cy="120" r="1.8" style="--d:0s"/><circle cx="60" cy="122" r="1.4" style="--d:.6s"/><circle cx="70" cy="118" r="1.7" style="--d:1.1s"/><circle cx="54" cy="124" r="1.2" style="--d:1.6s"/><circle cx="66" cy="124" r="1.5" style="--d:2s"/></g>' +
                    '<path class="bp-rooster__glans" d="M32 40C28 60 30 84 40 104"/>' +
                '</g>' +
                '<path class="bp-rooster__glasrand" d="' + GLAS + '"/>' +
                '<path class="bp-rooster__glasrand" d="M57 128V160M63 128V160M34 166C34 158 86 158 86 166C86 170 34 170 34 166Z"/>' +
            '</g>' +
            // DE HOTSPOT: de roostertrommel met onderstel en gloeiende spiraal
            '<g class="bp-rooster__hot bp-d1-hot" role="button" tabindex="0" data-eigen-toetsen aria-label="Roostertrommel met moutkorrels. Houd ingedrukt om de mout te verhitten.">' +
                '<rect class="bp-d1-hit" x="126" y="128" width="204" height="280" rx="16"/>' +
                ringen('rect', 'x="124" y="126" width="208" height="284" rx="18"', 'x="120" y="122" width="216" height="292" rx="22"') +
                // onderstel
                '<path class="bp-l" d="M190 316L162 398M266 316L294 398"/>' +
                '<path class="bp-lf" d="M172 372H284M148 398H176M280 398H308M186 362V372M270 362V372"/>' +
                // gloeiende spiraal en hete lucht die de trommel in stroomt
                '<rect class="bp-v bp-lf" x="176" y="354" width="104" height="8" rx="3"/>' +
                '<path class="bp-rooster__spiraal" d="' + SPIRAAL + '"/>' +
                '<g class="bp-rooster__gloei" opacity="0"><path d="' + SPIRAAL + '"/></g>' +
                '<g class="bp-rooster__lucht" opacity="0"><path style="--d:0s" d="M204 338c-4-5 4-8 0-13"/><path style="--d:.4s" d="M228 338c-4-5 4-8 0-13"/><path style="--d:.8s" d="M252 338c-4-5 4-8 0-13"/></g>' +
                // schoorsteen (achter de trommel) en de trommel zelf
                '<rect class="bp-v bp-l" x="288" y="148" width="16" height="56" rx="2"/>' +
                '<circle class="bp-v bp-l" cx="' + TX + '" cy="' + TY + '" r="80"/>' +
                '<path class="bp-rooster__schoepen" d="' + schoepen + '"/>' +
                '<g class="bp-nagels">' + bouten + '</g>' +
                '<circle class="bp-rooster__raam" cx="' + TX + '" cy="' + TY + '" r="54"/>' +
                '<g clip-path="url(#' + id + '-raam)">' +
                    '<ellipse class="bp-rooster__gloed" cx="' + TX + '" cy="292" rx="70" ry="34" fill="url(#' + id + '-gloed)" opacity="0"/>' +
                    '<g class="bp-rooster__korrels">' + korrels + '</g>' +
                '</g>' +
                '<circle class="bp-rooster__raamrand" cx="' + TX + '" cy="' + TY + '" r="54"/>' +
                '<path class="bp-rooster__glim" d="M196 216a40 40 0 0 1 26 -15"/>' +
                // temperatuur op het kastje bovenop
                '<rect class="bp-v bp-l" x="184" y="134" width="88" height="32" rx="6"/>' +
                '<text class="bp-rooster__temp" x="' + TX + '" y="158">80 °C</text>' +
            '</g>' +
            // rook uit de schoorsteen en het label met de moutsoort
            '<g class="bp-rooster__rook" aria-hidden="true" opacity="0"><path style="--d:0s" d="M296 146c-12-16 12-26 0-42s12-26 0-40"/><path style="--d:.9s" d="M300 148c-12-16 12-26 0-42s12-26 0-40"/></g>' +
            '<g class="bp-rooster__label" aria-hidden="true" transform="translate(252 104)"><rect x="-104" y="-24" width="208" height="48" rx="24"/><text y="9">Pilsmout</text></g>' +
            '</g></svg></div>';

        var wortel = houder.querySelector('.bp-rooster');
        var svg = wortel.querySelector('svg');
        var hot = svg.querySelector('.bp-rooster__hot');
        var korrelGroep = svg.querySelector('.bp-rooster__korrels');
        var korrelEls = korrelGroep.querySelectorAll('.bp-rooster__k');
        var schoepenEl = svg.querySelector('.bp-rooster__schoepen');
        var gloeiEl = svg.querySelector('.bp-rooster__gloei');
        var luchtEl = svg.querySelector('.bp-rooster__lucht');
        var gloedEl = svg.querySelector('.bp-rooster__gloed');
        var rookEl = svg.querySelector('.bp-rooster__rook');
        var labelEl = svg.querySelector('.bp-rooster__label');
        var labelTekst = labelEl.querySelector('text');
        var tempEl = svg.querySelector('.bp-rooster__temp');
        var bier = svg.querySelector('.bp-rooster__bier');
        var schuim = svg.querySelector('.bp-rooster__schuim');
        var enzymEls = svg.querySelectorAll('.bp-rooster__enzym');
        var meld = melder(c);
        var hint = { el: hot, tekst: hulpHint('rooster', 'Houd de trommel aan') };

        var t = 0, gloed = 0, houdt = false, doelT = null, fase = 0, gelukt = false, bediend = false, brander = null, labelKlok = 0;
        var rot = 0, getekend = '';

        function faseVan(x) { return x < 0.25 ? 0 : x < 0.6 ? 1 : x < 0.88 ? 2 : 3; }
        function kleurVan(x) {
            if (x < 0.08) return K.pils;
            if (x < 0.34) return B.mengKleur(K.pils, K.karamel, (x - 0.08) / 0.26);
            if (x < 0.48) return K.karamel;
            if (x < 0.64) return B.mengKleur(K.karamel, K.choc, (x - 0.48) / 0.16);
            if (x < 0.86) return K.choc;
            return B.mengKleur(K.choc, K.zwart, (x - 0.86) / 0.14);
        }
        // Kleur van "het bier van deze mout": log-schaal 6 → 40 → 150 EBC.
        function ebcVan(x) { return Math.exp(stuk([[0, Math.log(6)], [0.25, Math.log(9)], [0.45, Math.log(40)], [0.68, Math.log(150)], [1, Math.log(170)]], x)); }
        function tempVan(x) { return stuk([[0, 80], [0.2, 85], [0.25, 100], [0.6, 200], [0.88, 232], [1, 250]], x); }

        // De korrels tuimelen mee met de trommel (bij minder beweging: stil hoopje).
        function tekenTrommel() {
            var mix = B.minderBeweging() ? 0 : gloed;
            var sleutel = f1(rot) + '|' + f1(mix);
            if (sleutel === getekend) return;
            getekend = sleutel;
            var r = rot * Math.PI / 180;
            for (var i = 0; i < KORRELS.length; i++) {
                var k = KORRELS[i];
                var a = (k.hoek + mix * 40 * Math.sin(r * k.k + k.fase)) * Math.PI / 180;
                var rr = k.straal + mix * 6 * Math.sin(r * 2 * k.k + k.fase);
                zet(korrelEls[i], 'transform', 'translate(' + f1(TX + Math.cos(a) * rr) + ' ' + f1(TY + Math.sin(a) * rr) + ') rotate(' + f1(k.draai + mix * rot * k.k) + ')');
            }
            zet(schoepenEl, 'transform', 'rotate(' + f1(rot % 360) + ' ' + TX + ' ' + TY + ')');
        }

        function teken() {
            var kleur = kleurVan(t);
            korrelGroep.style.setProperty('--mout', kleur);
            korrelGroep.style.setProperty('--mout-rand', B.mengKleur(kleur, '#000000', 0.5));
            var ebc = ebcVan(t);
            zet(bier, 'fill', B.ebcNaarKleur(ebc));
            zet(schuim, 'fill', B.schuimKleur(ebc));
            tekst(tempEl, Math.round(tempVan(t) / 5) * 5 + ' °C');
            var levend = 1 - B.klem((t - 0.18) / 0.26, 0, 1);
            var n = Math.ceil(levend * 3 - 1e-6);
            for (var i = 0; i < enzymEls.length; i++) enzymEls[i].classList.toggle('is-uit', i >= n);
            zet(gloeiEl, 'opacity', f1(gloed));
            zet(luchtEl, 'opacity', f1(gloed * 0.9));
            zet(gloedEl, 'opacity', f1(gloed * 0.75));
            zet(rookEl, 'opacity', f1(B.klem((t - 0.8) / 0.2, 0, 1)));
            hot.classList.toggle('is-heet', gloed > 0.5);
            tekenTrommel();
            if (bediend) {
                c.cel.style.setProperty('--bp-rooster-mout', kleur);
                zet(hot, 'aria-valuetext', NAMEN[fase]);
            }
        }

        function toonLabel(f) {
            tekst(labelTekst, NAMEN[f]);
            labelEl.classList.add('is-zichtbaar');
            if (!B.minderBeweging()) {
                labelEl.classList.remove('is-nieuw');
                void labelEl.getBoundingClientRect();
                labelEl.classList.add('is-nieuw');
                clearTimeout(labelKlok);
                labelKlok = setTimeout(function () { labelEl.classList.remove('is-nieuw'); }, 500);
            }
        }

        function check() {
            var f = faseVan(t);
            if (f === fase) return;
            fase = f;
            G.speel('tik');
            tril(12);
            toonLabel(f);
            if (f === 1) meld(TEKST.karamel, 'info');
            if (f === 2) {
                if (!gelukt) { gelukt = true; c.gelukt(TEKST.gelukt); }
                meld(TEKST.enzymen, 'fout');
            }
            if (f === 3) { meld(TEKST.verbrand, 'fout'); G.speel('sis'); tril([30, 40, 30]); }
        }

        function eerste() {
            if (bediend) return;
            bediend = true;
            c.opnieuwZichtbaar(true);
            c.cel.classList.add('bp-rooster-koppel');
            toonLabel(fase);
            if (fase === 0) meld(TEKST.pils, 'info');
        }

        function startBrander() { if (!brander) brander = G.lus('brander'); }
        function stopBrander() { if (brander) { brander.stop(); brander = null; } }

        var lus = B.lus(function (dt) {
            var verwarmt = (houdt || doelT !== null) && t < 1;
            if (verwarmt) {
                t = Math.min(1, t + dt / DUUR);
                if (doelT !== null && t >= doelT) { doelT = null; if (!houdt) stopBrander(); }
                check();
            } else if (doelT !== null) { doelT = null; stopBrander(); }
            var doel = (houdt || doelT !== null) ? 1 : 0;
            gloed = B.minderBeweging() ? doel : gloed + (doel - gloed) * Math.min(1, dt * 5);
            if (Math.abs(gloed - doel) < 0.01) gloed = doel;
            if (!B.minderBeweging()) rot += dt * 150 * gloed;   // de trommel draait (en loopt uit)
            teken();
            if (!houdt && doelT === null && gloed === 0) lus.stop();
        }, houder);

        function begin() {
            if (houdt) return;
            eerste();
            houdt = true;
            startBrander();
            lus.start();
        }
        function einde() {
            if (!houdt) return;
            houdt = false;
            if (doelT === null) stopBrander();
            if (!gelukt) meld(fase === 0 ? TEKST.langer : TEKST.bijna, 'info');
            lus.start();
        }

        hot.addEventListener('pointerdown', function (e) {
            if (e.button > 0) return;
            e.preventDefault();
            try { hot.setPointerCapture(e.pointerId); } catch (x) { /* oude browser */ }
            begin();
        });
        hot.addEventListener('pointerup', einde);
        hot.addEventListener('pointercancel', einde);
        hot.addEventListener('lostpointercapture', einde);
        hot.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        // Toetsenbord: Enter of spatie = een stap verder (pils → karamel → chocolade).
        hot.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            if (e.repeat || t >= 1) return;
            eerste();
            // nog onderweg naar de vorige stap? dan meteen door naar de volgende
            doelT = [0.3, 0.64, 0.93, 1][doelT !== null ? faseVan(doelT) : fase];
            startBrander();
            lus.start();
        });

        c.opdracht(OPDRACHT);
        teken();

        return {
            hint: hint,
            open: function () { wortel.classList.add('is-open'); teken(); },
            dicht: function () {
                wortel.classList.remove('is-open');
                houdt = false; doelT = null; gloed = 0;
                stopBrander();
                lus.stop();
                teken();
            },
            opnieuw: function () {
                houdt = false; doelT = null; gloed = 0; t = 0; fase = 0; gelukt = false; bediend = false;
                stopBrander();
                lus.stop();
                labelEl.classList.remove('is-zichtbaar', 'is-nieuw');
                tekst(labelTekst, NAMEN[0]);
                c.cel.classList.remove('bp-rooster-koppel');
                c.cel.style.removeProperty('--bp-rooster-mout');
                hot.removeAttribute('aria-valuetext');
                meld.wis();
                c.opdracht(OPDRACHT);
                teken();
                opnieuwKlaar(c, hot);
            }
        };
    };

    /* ==================================================================
       2. PLET DE KORREL  (draaien aan het slingerwiel)
       Elke volle slag = +14 fijnheid; een zwiep draait na. Laat het wiel
       stilstaan in het groene vak (34–66): korrel open, kafje heel.
       ================================================================== */
    I.molen = function (houder, ctx) {
        var c = veiligCtx(ctx, houder);
        var id = B.uniekId('bp-molen2');
        var OPDRACHT = beginOpdracht(c, 'Draai aan het wiel tot de korrel openbreekt.');
        var TEKST = {
            start: 'Krak! De walsen breken de korrels. Kijk in de schep.',
            open: 'Nu breekt de korrel open. Laat het wiel los!',
            heel: 'Nog te heel: het zetmeel zit nog opgesloten. Draai door.',
            perfect: 'Perfect gekraakt! Meelkern open, kafje heel.',
            poeder: 'Te ver! Het kaf wordt poeder en verstopt het filter. Tik de schep leeg.',
            leeg: 'Nieuwe handvol mout. Draai opnieuw, en stop op tijd.',
            opdrachtPoeder: 'Tik op de schep om hem leeg te maken.'
        };
        var CX = 352, CY = 172, SLAG = 14, REM = 2.4, REM_TOETS = 5;
        var PLAAT = { x: 160, y: 240, r: 29 };

        function hoekPunt(a, r) {
            var rad = a * Math.PI / 180;
            return f1(PLAAT.x + r * Math.cos(rad)) + ' ' + f1(PLAAT.y + r * Math.sin(rad));
        }
        function boog(a1, a2) { return 'M' + hoekPunt(a1, PLAAT.r) + 'A' + PLAAT.r + ' ' + PLAAT.r + ' 0 0 1 ' + hoekPunt(a2, PLAAT.r); }

        var plekken = [[30, 34, -20], [70, 26, 15], [110, 36, -5], [150, 28, 28], [50, 66, 35], [92, 70, -12], [134, 64, 18], [172, 60, -25]];
        var schepKorrels = plekken.map(function (p) { return B.korrelFases(p[0], p[1], p[2]); }).join('');
        var loepKorrels = [[104, 300, -14, 2.3], [160, 306, 22, 2.2], [126, 354, 6, 2.2]].map(function (p) {
            return '<g transform="translate(' + p[0] + ' ' + p[1] + ') scale(' + p[3] + ')">' + B.korrelFases(0, 0, p[2]) + '</g>';
        }).join('');
        var tikjes = '';
        for (var i = 0; i < 22; i++) tikjes += 'M' + (98 + i * 6) + ' 128v10';

        houder.innerHTML = '<div class="bp-d1 bp-molen2">' +
            svgKop('bp-molen2__svg', 'Close-up: de schrootmolen met een groot slingerwiel en een schep vol geschrote mout') +
            '<defs><clipPath id="' + id + '-loep"><circle cx="130" cy="322" r="72"/></clipPath></defs>' +
            '<ellipse class="bp-schaduw" cx="236" cy="404" rx="214" ry="11"/>' +
            '<g class="bp-molen2__molen" aria-hidden="true">' +
                // poten (achter de schep)
                '<path class="bp-l" d="M110 250L86 398M124 250L104 398M210 250L234 398M196 250L216 398"/>' +
                '<path class="bp-lf" d="M96 340H224M74 398H114M206 398H246"/>' +
                // trechter met mout
                '<rect class="bp-v bp-l" x="74" y="26" width="172" height="16" rx="3"/>' +
                '<path class="bp-v bp-l" d="M80 42H240L196 118H124Z"/>' +
                '<path class="bp-molen2__hoop" d="M88 44C116 28 204 28 232 44Z"/>' +
                '<path class="bp-lf" d="M98 50L136 112M222 50L184 112"/>' +
                '<g class="bp-molen2__val"><ellipse cx="150" cy="62" rx="4.5" ry="2.4" style="--d:0s"/><ellipse cx="166" cy="58" rx="4.5" ry="2.4" style="--d:.3s"/><ellipse cx="158" cy="66" rx="4.5" ry="2.4" style="--d:.6s"/><ellipse cx="172" cy="62" rx="4.5" ry="2.4" style="--d:.15s"/></g>' +
                // behuizing met kijkvenster en walsen
                '<rect class="bp-v bp-l" x="92" y="118" width="136" height="132" rx="6"/>' +
                '<path class="bp-lf" d="M92 128H228M92 138H228"/>' +
                '<path class="bp-tik" d="' + tikjes + '"/>' +
                '<g class="bp-nagels"><circle cx="100" cy="146" r="1.8"/><circle cx="220" cy="146" r="1.8"/><circle cx="100" cy="242" r="1.8"/><circle cx="220" cy="242" r="1.8"/></g>' +
                '<rect class="bp-venster" x="106" y="146" width="108" height="46" rx="6"/>' +
                '<g class="bp-molen2__wals"><circle class="bp-tanden" cx="138" cy="169" r="15"/><circle class="bp-lf" cx="138" cy="169" r="8"/><path class="bp-lf" d="M138 161V177M130 169H146"/><circle class="bp-naaf" cx="138" cy="169" r="2.4"/></g>' +
                '<g class="bp-molen2__wals"><circle class="bp-tanden" cx="182" cy="169" r="15"/><circle class="bp-lf" cx="182" cy="169" r="8"/><path class="bp-lf" d="M182 161V177M174 169H190"/><circle class="bp-naaf" cx="182" cy="169" r="2.4"/></g>' +
                // walsplaatje: heel / goed / poeder
                '<path class="bp-molen2__plaat" d="M122 240A38 38 0 0 1 198 240Z"/>' +
                '<path class="bp-molen2__vak bp-molen2__vak--heel" d="' + boog(182, 241) + '"/>' +
                '<path class="bp-molen2__vak bp-molen2__vak--goed" d="' + boog(241.2, 298.8) + '"/>' +
                '<path class="bp-molen2__vak bp-molen2__vak--poeder" d="' + boog(299, 358) + '"/>' +
                '<path class="bp-molen2__naald" d="M160 240H187" transform="rotate(180 160 240)"/>' +
                '<circle class="bp-naaf" cx="160" cy="240" r="3.6"/>' +
                // uitloop en de stroom schroot
                '<path class="bp-v bp-l" d="M138 250H182L172 278H148Z"/>' +
                '<g class="bp-molen2__stroom"><path style="--d:0s" d="M154 282l4-2 2 3z"/><path style="--d:.2s" d="M162 284l3 3-4 1z"/><path style="--d:.4s" d="M157 286l3-3 2 4z"/><path style="--d:.1s" d="M166 281l-3 2 3 2z"/></g>' +
                // as naar het wiel
                '<path class="bp-l" d="M228 172H' + CX + '"/>' +
                '<circle class="bp-v bp-l" cx="236" cy="172" r="7"/>' +
            '</g>' +
            // HET SLINGERWIEL (hoofd-hotspot)
            '<g class="bp-molen2__wielhot bp-d1-hot" role="slider" tabindex="0" aria-label="Slingerwiel van de schrootmolen. Draai rond om te schroten." aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="nog niets geschroot">' +
                '<circle class="bp-d1-hit" cx="' + CX + '" cy="' + CY + '" r="96"/>' +
                ringen('circle', 'cx="' + CX + '" cy="' + CY + '" r="94"', 'cx="' + CX + '" cy="' + CY + '" r="98"') +
                '<path class="bp-molen2__pijl" d="M296 104A90 90 0 0 1 430 120M422 106L431 121L415 126"/>' +
                '<g class="bp-molen2__wiel">' +
                    '<circle class="bp-v bp-molen2__velg" cx="' + CX + '" cy="' + CY + '" r="74"/>' +
                    '<circle class="bp-tanden bp-tanden--groot" cx="' + CX + '" cy="' + CY + '" r="65"/>' +
                    '<path class="bp-l" d="M352 112V232M292 172H412M309.6 129.6L394.4 214.4M394.4 129.6L309.6 214.4"/>' +
                    '<circle class="bp-v bp-l" cx="' + CX + '" cy="' + CY + '" r="14"/>' +
                    '<circle class="bp-naaf" cx="' + CX + '" cy="' + CY + '" r="4"/>' +
                    '<circle class="bp-molen2__greep" cx="' + CX + '" cy="114" r="20"/>' +
                    '<circle class="bp-molen2__greepkern" cx="' + CX + '" cy="114" r="7"/>' +
                '</g>' +
            '</g>' +
            // de schep (tik = leegmaken)
            '<g class="bp-molen2__schep bp-d1-hot" role="button" tabindex="0" data-eigen-toetsen aria-label="Schep met schroot. Tik om hem leeg te maken.">' +
                '<rect class="bp-d1-hit" x="40" y="270" width="240" height="104" rx="16"/>' +
                ringen('rect', 'x="42" y="272" width="236" height="100" rx="18"', 'x="38" y="268" width="244" height="108" rx="20"') +
                '<g transform="translate(48 262) scale(1.12)">' +
                    '<path class="bp-molen2__bak" d="M6 46C6 96 194 96 194 46Z"/>' +
                    '<path class="bp-molen2__nerf" d="M26 60C60 72 140 72 174 60M46 74C80 82 120 82 154 74"/>' +
                    '<g class="bp-molen2__korrels" data-fase="0">' + schepKorrels + '</g>' +
                    '<path class="bp-molen2__rand" d="M6 46C6 96 194 96 194 46"/>' +
                '</g>' +
            '</g>' +
            // de loep (na het slagen)
            '<g class="bp-molen2__loep" aria-hidden="true">' +
                '<path class="bp-molen2__loepsteel" d="M80 376L46 414"/>' +
                '<circle class="bp-molen2__loepglas" cx="130" cy="322" r="72"/>' +
                '<g clip-path="url(#' + id + '-loep)"><g class="bp-molen2__groot">' + loepKorrels + '</g></g>' +
                '<circle class="bp-molen2__loeprand" cx="130" cy="322" r="74"/>' +
                '<g class="bp-molen2__vink" transform="translate(222 296)"><rect x="0" y="-22" width="200" height="40" rx="20"/><text x="16" y="7">kafje heel ✓</text></g>' +
                '<g class="bp-molen2__vink" transform="translate(222 346)"><rect x="0" y="-22" width="214" height="40" rx="20"/><text x="16" y="7">meelkern open ✓</text></g>' +
            '</g>' +
            '</svg></div>';

        var wortel = houder.querySelector('.bp-molen2');
        var svg = wortel.querySelector('svg');
        var wielHot = svg.querySelector('.bp-molen2__wielhot');
        var wiel = svg.querySelector('.bp-molen2__wiel');
        var walsen = svg.querySelectorAll('.bp-molen2__wals');
        var naald = svg.querySelector('.bp-molen2__naald');
        var schep = svg.querySelector('.bp-molen2__schep');
        var schepKorrelsEl = svg.querySelector('.bp-molen2__korrels');
        var loep = svg.querySelector('.bp-molen2__loep');
        var meld = melder(c);

        var fijn = 0, hoek = 0, omega = 0, sleept = null, vorigeHoek = 0, monsters = [];
        var zone = 'heel', gelukt = false, bediend = false, draait = false, wachtOpStil = false;
        var laatsteBeweging = 0, geluid = null, getekendeHoek = null, rem = REM, gestart = false;

        function zoneVan(f) { return f < 34 ? 'heel' : f <= 66 ? 'perfect' : 'poeder'; }
        function faseVan(f) { return f < 12 ? 0 : f < 34 ? 1 : f <= 66 ? 2 : f < 86 ? 3 : 4; }
        function zoneNaam(z) { return z === 'heel' ? 'te heel' : z === 'perfect' ? 'perfect geschroot' : 'poeder'; }

        function teken() {
            if (getekendeHoek !== hoek) {
                getekendeHoek = hoek;
                var h = ((hoek % 360) + 360) % 360;
                zet(wiel, 'transform', 'rotate(' + f1(h) + ' ' + CX + ' ' + CY + ')');
                var w = ((hoek * 1.7) % 360 + 360) % 360;
                zet(walsen[0], 'transform', 'rotate(' + f1(w) + ' 138 169)');
                zet(walsen[1], 'transform', 'rotate(' + f1(-w) + ' 182 169)');
            }
            zet(naald, 'transform', 'rotate(' + f1(180 + fijn * 1.8) + ' 160 240)');
            zet(schepKorrelsEl, 'data-fase', faseVan(fijn));
            zet(svg, 'data-zone', fijn < 0.5 ? '' : zone);
            zet(wielHot, 'aria-valuenow', Math.round(fijn));
            zet(wielHot, 'aria-valuetext', fijn < 0.5 ? 'nog niets geschroot' : Math.round(fijn) + ' procent geschroot, ' + zoneNaam(zone));
        }

        function zetDraait(aan) {
            if (aan === draait) return;
            draait = aan;
            svg.classList.toggle('is-malend', aan);
            c.cel.classList.toggle('is-malend', aan);
            if (aan && !geluid) geluid = G.lus('molen');
            if (!aan && geluid) { geluid.stop(); geluid = null; }
            if (aan) toonLoep(false);
        }

        function toonLoep(aan) {
            if (aan) {
                // pilletjes passend maken bij de tekst
                var vinken = loep.querySelectorAll('.bp-molen2__vink');
                for (var i = 0; i < vinken.length; i++) {
                    var tx = vinken[i].querySelector('text'), rect = vinken[i].querySelector('rect');
                    var b = 0;
                    try { b = tx.getComputedTextLength(); } catch (e) { b = 0; }
                    if (b > 20) zet(rect, 'width', Math.min(232, Math.ceil(b + 32)));
                }
            }
            loep.classList.toggle('is-zichtbaar', aan);
        }

        function maal(graden) {
            var oud = zone;
            fijn = B.klem(fijn + Math.abs(graden) / 360 * SLAG, 0, 100);
            if (!gestart && fijn > 1) { gestart = true; meld(TEKST.start, 'info'); }
            zone = zoneVan(fijn);
            if (zone === oud) return;
            if (zone === 'perfect') { G.speel('klik'); tril(12); meld(TEKST.open, 'info'); }
            if (zone === 'poeder') {
                G.speel('fout'); tril([30, 40, 30]);
                meld(TEKST.poeder, 'fout');
                c.opdracht(TEKST.opdrachtPoeder);
            }
        }

        // Het wiel staat stil: hoe is de korrel?
        function stil() {
            zetDraait(false);
            if (fijn < 0.5) return;
            if (zone === 'heel') meld(TEKST.heel, 'info');
            else if (zone === 'perfect') {
                toonLoep(true);
                meld(TEKST.perfect, 'goed');
                if (!gelukt) { gelukt = true; c.gelukt(TEKST.perfect); }
            } else meld(TEKST.poeder, 'fout');
        }

        function eerste() {
            if (bediend) return;
            bediend = true;
            svg.classList.add('is-bediend');
            c.opnieuwZichtbaar(true);
        }

        var lus = B.lus(function (dt) {
            var nu = performance.now();
            if (sleept === null && omega !== 0) {
                var d = omega * dt;
                hoek += d;
                maal(d);
                omega *= Math.exp(-rem * dt);
                if (Math.abs(omega) < 12) omega = 0;
            }
            zetDraait((sleept !== null && nu - laatsteBeweging < 220) || Math.abs(omega) > 30);
            teken();
            if (sleept === null && omega === 0) {
                lus.stop();
                if (wachtOpStil) { wachtOpStil = false; stil(); }
            }
        }, houder);

        function hoekVan(e) {
            var p = svgPunt(svg, e);
            return { a: Math.atan2(p.y - CY, p.x - CX) * 180 / Math.PI, r: Math.sqrt((p.x - CX) * (p.x - CX) + (p.y - CY) * (p.y - CY)) };
        }
        wielHot.addEventListener('pointerdown', function (e) {
            if (e.button > 0) return;
            e.preventDefault();
            try { wielHot.setPointerCapture(e.pointerId); } catch (x) { /* oude browser */ }
            sleept = e.pointerId;
            vorigeHoek = hoekVan(e).a;
            omega = 0;
            rem = REM;
            monsters = [];
            wachtOpStil = false;
            eerste();
            wielHot.classList.add('is-actief');
            lus.start();
        });
        wielHot.addEventListener('pointermove', function (e) {
            if (sleept !== e.pointerId) return;
            var p = hoekVan(e);
            if (p.r < 16) return;   // vlak bij de as is de hoek onbetrouwbaar
            var d = p.a - vorigeHoek;
            if (d > 180) d -= 360;
            if (d < -180) d += 360;
            vorigeHoek = p.a;
            if (Math.abs(d) < 0.01) return;
            hoek += d;
            maal(d);
            var nu = performance.now();
            monsters.push({ t: nu, d: d });
            while (monsters.length && nu - monsters[0].t > 120) monsters.shift();
            laatsteBeweging = nu;
        });
        function los(e) {
            if (sleept === null || (e && e.pointerId !== undefined && e.pointerId !== sleept)) return;
            sleept = null;
            wielHot.classList.remove('is-actief');
            var nu = performance.now();
            var recent = monsters.filter(function (m) { return nu - m.t < 100; });
            var som = 0;
            recent.forEach(function (m) { som += m.d; });
            var duur = recent.length ? Math.max(16, nu - recent[0].t) : 0;
            // Nadraai (momentum); bij minder beweging staat het wiel meteen stil.
            omega = (duur && !B.minderBeweging() && nu - laatsteBeweging < 90) ? B.klem(som / duur * 1000, -1100, 1100) : 0;
            monsters = [];
            wachtOpStil = true;
            lus.start();
        }
        wielHot.addEventListener('pointerup', los);
        wielHot.addEventListener('pointercancel', los);
        wielHot.addEventListener('lostpointercapture', los);
        wielHot.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        // Toetsenbord: pijltjes = een stukje draaien (+8), Enter = stop en bekijk.
        wielHot.addEventListener('keydown', function (e) {
            var k = e.key;
            if (k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowLeft' || k === 'ArrowDown') {
                e.preventDefault();
                eerste();
                var graden = 8 / SLAG * 360;
                if (B.minderBeweging()) {
                    hoek += graden; maal(graden); teken();
                    stil();
                } else {
                    // een korte, vlotte draai (± 0,8 s) per toets
                    rem = REM_TOETS;
                    omega += graden * REM_TOETS * 1.03;
                    wachtOpStil = true;
                    lus.start();
                }
            } else if (k === 'Enter' || k === ' ') {
                e.preventDefault();
                if (!bediend) return;
                omega = 0;
                wachtOpStil = false;
                teken();
                stil();
            }
        });

        function leegSchep(bron) {
            omega = 0; wachtOpStil = false;
            fijn = 0; zone = 'heel'; gelukt = false; gestart = false;
            toonLoep(false);
            zetDraait(false);
            teken();
            if (bron === 'opnieuw') return;
            G.speel('schep');
            tril(12);
            if (bediend) { meld(TEKST.leeg, 'info'); c.opdracht(OPDRACHT); }
        }
        schep.addEventListener('click', function () { leegSchep('schep'); });
        schep.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            if (!e.repeat) leegSchep('schep');
        });

        teken();

        return {
            hint: { el: wielHot, tekst: hulpHint('molen', 'Draai aan het wiel') },
            open: function () { wortel.classList.add('is-open'); },
            dicht: function () {
                wortel.classList.remove('is-open');
                sleept = null; omega = 0; wachtOpStil = false;
                wielHot.classList.remove('is-actief');
                lus.stop();
                zetDraait(false);
            },
            opnieuw: function () {
                sleept = null;
                hoek = 0; bediend = false;
                leegSchep('opnieuw');
                lus.stop();
                svg.classList.remove('is-bediend');
                meld.wis();
                c.opdracht(OPDRACHT);
                teken();
                opnieuwKlaar(c, wielHot);
            }
        };
    };

    /* ==================================================================
       3. WEK DE ENZYMEN  (thermometer slepen)
       Bèta-rust 62–65 °C (speelzone 61–65,5): het kleine schaartje knipt
       maltose van het uiteinde. Alfa-rust 70–72 °C (69,5–73): het grote
       schaartje knipt brokken uit het midden. 78 °C: afmaischen.
       Bèta-amylase gaat boven ± 65 °C onomkeerbaar kapot: wie boven 65,5 °C
       komt voordat de bèta-rust klaar is, slaat hem over (↺, met puls). Net
       zo: 78 °C vóór de twee rusten klaar zijn. Volgorde dus altijd laag → hoog.
       ================================================================== */
    I.maisch = function (houder, ctx) {
        var c = veiligCtx(ctx, houder);
        var id = B.uniekId('bp-maisch2');
        var OPDRACHT = 'Eerst 62 °C: wacht op het vinkje. Dan 72 °C.';
        var TEKST = {
            koud: 'Te koud: de enzymen slapen nog. Sleep omhoog naar 62 °C.',
            beta: '62–65 °C: bèta knipt suiker voor alcohol. Wacht op het vinkje!',
            betaKlaar: 'Bèta-rust klaar! Sleep nu door naar 70–72 °C.',
            tussen: 'Tussen de rusten. Sleep door naar 70–72 °C.',
            alfa: '70–72 °C: alfa knipt stukken voor body. Wacht op het vinkje!',
            heet: 'Te heet! Alleen het grote schaartje werkt nog even. Terug naar 72 °C.',
            kapotHeet: 'Te heet: de enzymen stoppen. Tik ↺ en probeer het nog eens.',
            kapotBeta: 'Bèta overgeslagen: boven 65 °C gaat dat enzym kapot. Tik ↺, begin op 62 °C.',
            gelukt: 'Twee scharen geknipt: suiker voor alcohol, de rest voor body.',
            naar78: 'Bijna! Nog iets warmer, naar 78 °C.',
            af: '78 °C: afgemaischt. De enzymen stoppen, het beslag is klaar.',
            afHeet: '78 °C is genoeg: heter hoeft niet.',
            opdrachtAlfa: 'Nu door naar 72 °C en wacht op het vinkje.',
            opdracht78: 'Tot slot: sleep naar 78 °C om af te maischen.',
            opdrachtAf: 'Afgemaischt! Het beslag kan naar de filterkuip.',
            opdrachtKapot: 'Tik op ↺ en begin opnieuw.'
        };
        var TMIN = 46, TMAX = 82, TSTART = 50;
        var STOPS = [TSTART, 63.5, 71, 78];
        function Y(temp) { return 340 - (temp - TMIN) * 8; }
        function Tvan(y) { return TMIN + (340 - y) / 8; }

        var KRALEN = 13, EIND_X = 366, STAP = 14, KETEN_Y = 216;
        var PLEK_B = [[346, 293], [368, 292], [336, 282], [358, 281], [378, 280], [348, 270], [370, 269], [359, 258]];
        var PLEK_A = [[288, 292], [300, 281], [283, 270], [298, 260], [287, 249], [303, 240]];

        var tikjes = '', nagels = '', bouten = '', streepjes = '';
        for (var i = 0; i < 28; i++) tikjes += 'M' + (228 + i * 8) + ' 120v10';
        for (var j = 0; j < 12; j++) nagels += '<circle cx="' + (232 + j * 18.5).toFixed(1) + '" cy="139" r="1.8"/>';
        for (var b = 0; b < 12; b++) {
            var a = b / 12 * Math.PI * 2;
            bouten += '<circle cx="' + f1(335 + Math.cos(a) * 81) + '" cy="' + f1(236 + Math.sin(a) * 81) + '" r="2.4"/>';
        }
        for (var s = 48; s <= 80; s += 2) streepjes += 'M76 ' + Y(s) + 'H' + (s % 10 === 0 ? 68 : 72);
        var vlammen = '';
        for (var v = 0; v < 5; v++) {
            vlammen += '<g class="bp-maisch2__vlam" transform="translate(' + (285 + v * 25) + ' 388)"><g style="--d:-' + (v * 0.13).toFixed(2) + 's">' +
                '<path class="bp-maisch2__vlam-buiten" d="M0 0C-10 -8 -8 -22 0 -36C8 -22 10 -8 0 0Z"/>' +
                '<path class="bp-maisch2__vlam-binnen" d="M0 0C-5 -5 -4 -13 0 -21C4 -13 5 -5 0 0Z"/></g></g>';
        }

        houder.innerHTML = '<div class="bp-d1 bp-maisch2">' +
            svgKop('bp-maisch2__svg', 'Close-up: de maischketel met een kijkglas waarin enzymen het zetmeel knippen, en links een grote thermometer') +
            '<defs>' +
                '<clipPath id="' + id + '-poort"><circle cx="335" cy="236" r="76"/></clipPath>' +
                '<radialGradient id="' + id + '-micro" cx=".5" cy=".42" r=".62"><stop offset="0" stop-color="#2E5038"/><stop offset="1" stop-color="#0A2116"/></radialGradient>' +
                '<radialGradient id="' + id + '-rood" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#FF5A2A" stop-opacity=".75"/><stop offset="1" stop-color="#C21E0E" stop-opacity=".25"/></radialGradient>' +
            '</defs>' +
            '<ellipse class="bp-schaduw" cx="250" cy="404" rx="212" ry="11"/>' +
            '<g class="bp-maisch2__ketel" aria-hidden="true">' +
                '<g class="bp-maisch2__stoom"><path style="--d:0s" d="M296 62c-6-8 6-12 0-19s6-12 0-18"/><path style="--d:1.1s" d="M335 42c-6-8 6-12 0-19s6-12 0-18"/><path style="--d:2.1s" d="M374 62c-6-8 6-12 0-19s6-12 0-18"/></g>' +
                '<path class="bp-l" d="M240 348V398M430 348V398"/>' +
                '<path class="bp-lf" d="M228 398H252M418 398H442"/>' +
                '<g class="bp-maisch2__vlammen">' + vlammen + '</g>' +
                '<rect class="bp-v bp-l" x="268" y="388" width="134" height="10" rx="4"/>' +
                '<path class="bp-v bp-l" d="M222 120C222 86 270 66 335 66C400 66 448 86 448 120Z"/>' +
                '<rect class="bp-v bp-l" x="318" y="46" width="34" height="20" rx="3"/>' +
                '<path class="bp-lf" d="M324 52H346M324 58H346"/>' +
                '<path class="bp-v bp-l" d="M222 120H448V334Q448 348 434 348H236Q222 348 222 334Z"/>' +
                '<path class="bp-maisch2__rood" d="M222 120H448V334Q448 348 434 348H236Q222 348 222 334Z" fill="url(#' + id + '-rood)"/>' +
                '<path class="bp-lf" d="M222 130H448"/>' +
                '<path class="bp-tik" d="' + tikjes + '"/>' +
                '<g class="bp-nagels">' + nagels + '<circle cx="232" cy="338" r="1.8"/><circle cx="438" cy="338" r="1.8"/></g>' +
                // de patrijspoort: een blik door de microscoop
                '<circle cx="335" cy="236" r="76" fill="url(#' + id + '-micro)"/>' +
                '<g clip-path="url(#' + id + '-poort)">' +
                    '<path class="bp-maisch2__binding" d="M180 ' + KETEN_Y + 'H' + EIND_X + '"/>' +
                    '<g class="bp-maisch2__keten"></g>' +
                    '<g class="bp-maisch2__stapels"></g>' +
                    '<g class="bp-maisch2__zzz"><text x="334" y="184">z</text><text x="348" y="172">z</text><text x="362" y="162">z</text></g>' +
                    schaar('bp-maisch2__schaar bp-maisch2__schaar--alfa', 'translate(306 190) rotate(90) scale(1.2)') +
                    schaar('bp-maisch2__schaar bp-maisch2__schaar--beta', 'translate(388 194) rotate(124) scale(.85)') +
                '</g>' +
                '<circle class="bp-maisch2__poort" cx="335" cy="236" r="80"/>' +
                '<g class="bp-maisch2__bouten">' + bouten + '</g>' +
                // voeler van de thermometer
                '<path class="bp-lf" d="M89 362H232V348"/>' +
                '<rect class="bp-v bp-lf" x="226" y="336" width="14" height="14" rx="3"/>' +
            '</g>' +
            // DE THERMOMETER (hoofd-hotspot)
            '<g class="bp-maisch2__thermo bp-d1-hot" role="slider" tabindex="0" aria-orientation="vertical" aria-label="Thermometer van de maischketel. Sleep om de temperatuur te kiezen. Eerst 62 graden tot het vinkje, dan 72." aria-valuemin="' + TMIN + '" aria-valuemax="' + TMAX + '" aria-valuenow="' + TSTART + '" aria-valuetext="' + TSTART + ' graden, te koud">' +
                '<rect class="bp-d1-hit" x="20" y="24" width="196" height="392" rx="18"/>' +
                ringen('rect', 'x="22" y="22" width="192" height="394" rx="20"', 'x="18" y="18" width="200" height="402" rx="22"') +
                '<rect class="bp-maisch2__buis" x="42" y="34" width="40" height="322" rx="20"/>' +
                '<rect class="bp-maisch2__band bp-maisch2__band--beta" x="37" y="' + Y(65) + '" width="50" height="' + (Y(62) - Y(65)) + '" rx="5"/>' +
                '<rect class="bp-maisch2__band bp-maisch2__band--alfa" x="37" y="' + Y(72) + '" width="50" height="' + (Y(70) - Y(72)) + '" rx="5"/>' +
                '<path class="bp-maisch2__stop" d="M32 ' + Y(78) + 'H92"/>' +
                '<path class="bp-maisch2__streepjes" d="' + streepjes + '"/>' +
                '<rect class="bp-maisch2__kwik" x="54" y="' + Y(TSTART) + '" width="16" height="' + (372 - Y(TSTART)) + '" rx="8"/>' +
                '<circle class="bp-maisch2__bol" cx="62" cy="378" r="28"/>' +
                '<path class="bp-maisch2__glans" d="M52 60V330"/>' +
                '<text class="bp-maisch2__lab bp-maisch2__lab--stop" x="100" y="' + (Y(78) + 8) + '">78°</text>' +
                '<text class="bp-maisch2__lab bp-maisch2__lab--alfa" x="100" y="' + (Y(71) + 8) + '">70–72°</text>' +
                '<text class="bp-maisch2__lab bp-maisch2__lab--beta" x="100" y="' + (Y(63.5) + 8) + '">62–65°</text>' +
                '<g class="bp-maisch2__vink" data-vink="af" transform="translate(160 ' + Y(78) + ')"><circle r="13"/><path d="M-6 0l4 4.5 8-9"/></g>' +
                '<g class="bp-maisch2__vink" data-vink="alfa" transform="translate(194 ' + Y(71) + ')"><circle r="13"/><path d="M-6 0l4 4.5 8-9"/></g>' +
                '<g class="bp-maisch2__vink" data-vink="beta" transform="translate(194 ' + Y(63.5) + ')"><circle r="13"/><path d="M-6 0l4 4.5 8-9"/></g>' +
                '<g class="bp-maisch2__greep" transform="translate(62 ' + Y(TSTART) + ')">' +
                    '<path class="bp-maisch2__pijl" d="M-9 -36L0 -45L9 -36M-9 36L0 45L9 36"/>' +
                    '<circle r="27"/><text y="8">' + TSTART + '°</text>' +
                '</g>' +
            '</g>' +
            '</svg></div>';

        var wortel = houder.querySelector('.bp-maisch2');
        var svg = wortel.querySelector('svg');
        var thermo = svg.querySelector('.bp-maisch2__thermo');
        var kwik = svg.querySelector('.bp-maisch2__kwik');
        var greep = svg.querySelector('.bp-maisch2__greep');
        var greepTekst = greep.querySelector('text');
        var ketenEl = svg.querySelector('.bp-maisch2__keten');
        var stapelEl = svg.querySelector('.bp-maisch2__stapels');
        var binding = svg.querySelector('.bp-maisch2__binding');
        var zzz = svg.querySelector('.bp-maisch2__zzz');
        var rood = svg.querySelector('.bp-maisch2__rood');
        var stoom = svg.querySelector('.bp-maisch2__stoom');
        var vlamEls = svg.querySelectorAll('.bp-maisch2__vlam');
        var schaarA = svg.querySelector('.bp-maisch2__schaar--alfa');
        var schaarB = svg.querySelector('.bp-maisch2__schaar--beta');
        var vinken = { beta: svg.querySelector('[data-vink="beta"]'), alfa: svg.querySelector('[data-vink="alfa"]'), af: svg.querySelector('[data-vink="af"]') };
        var ketelTemp = (c.ketel || c.cel).querySelector('[data-ketel-temp]');
        var meld = melder(c);

        var T, sleept, offset, betaN, alfaN, klokB, klokA, klokOver, kapot, af, gelukt, bediend, laatsteStatus, zoneNu;
        var opnieuwKnop = c.scene && c.scene.querySelector('[data-opnieuw]');
        var HINT = hulpHint('maisch', 'Sleep naar 62 °C');
        var hint = { el: thermo, tekst: HINT };
        var kralen = [], stukken = [], plekB = 0, plekA = 0, getekend = {}, animeert = false;
        var scharen = { a: { el: schaarA, open: 0.35 }, b: { el: schaarB, open: 0.35 } };

        function maakKraal(x) {
            var el = B.svg('circle', { class: 'bp-maisch2__kraal', cx: f1(x), cy: KETEN_Y, r: 6.6 });
            ketenEl.appendChild(el);
            return { el: el, x: x };
        }
        function bouwKeten() {
            ketenEl.textContent = '';
            stapelEl.textContent = '';
            kralen = []; stukken = []; plekB = 0; plekA = 0;
            for (var k = 0; k < KRALEN; k++) kralen.push(maakKraal(EIND_X - k * STAP));
        }

        function reset() {
            T = TSTART; sleept = null; offset = 0;
            betaN = 0; alfaN = 0; klokB = 0; klokA = 0; klokOver = 0;
            kapot = ''; af = false; gelukt = false; bediend = false;
            laatsteStatus = ''; kandidaat = ''; zoneNu = 'koud';
            scharen.a.open = 0.35; scharen.b.open = 0.35;
            getekend = {};
            bouwKeten();
            svg.classList.remove('is-bediend', 'is-kapot', 'is-af');
            schaarA.classList.remove('is-uit');
            schaarB.classList.remove('is-uit');
            Object.keys(vinken).forEach(function (k) { vinken[k].classList.remove('is-aan'); });
        }

        function zoneVan(x) {
            if (x < 61) return 'koud';
            if (x < 65.5) return 'beta';
            if (x < 69.5) return 'tussen';
            if (x < 73) return 'alfa';
            if (x < 77.5) return 'heet';
            return 'af';
        }
        var ZONE_TEKST = { koud: 'te koud', beta: 'bèta-rust', tussen: 'tussen de rusten', alfa: 'alfa-rust', heet: 'te heet', af: 'afmaischen' };

        // Een knip: stukje van de keten valt naar zijn hoopje onderin het kijkglas.
        function knip(soort) {
            var n, van;
            if (soort === 'beta') { n = 2; van = 0; }
            else { n = 3 + Math.floor(Math.random() * 2); van = 2 + Math.floor(Math.random() * 3); }
            var weg = kralen.splice(van, n);
            var x0 = weg[weg.length - 1].x;   // meest linkse kraal
            weg.forEach(function (k) { k.el.remove(); });
            for (var k = 0; k < n; k++) kralen.push(maakKraal(EIND_X - (kralen.length) * STAP));
            var plek;
            if (soort === 'beta') { plek = PLEK_B[plekB % PLEK_B.length]; plekB += 1; }
            else { plek = PLEK_A[plekA % PLEK_A.length]; plekA += 1; }
            var g = B.svg('g', { class: 'bp-maisch2__stuk bp-maisch2__stuk--' + (soort === 'beta' ? 'maltose' : 'dextrine') });
            for (var m = 0; m < n; m++) g.appendChild(B.svg('circle', { cx: m * (soort === 'beta' ? 11 : 10), cy: 0, r: soort === 'beta' ? 5.4 : 5 }));
            stapelEl.appendChild(g);
            // oude stukjes op dezelfde plek mogen weg (de hoop blijft overzichtelijk)
            var vol = soort === 'beta' ? PLEK_B.length : PLEK_A.length;
            var zelfde = stukken.filter(function (s) { return s.soort === soort; });
            if (zelfde.length >= vol) { zelfde[0].el.remove(); stukken.splice(stukken.indexOf(zelfde[0]), 1); }
            var nieuw = { el: g, soort: soort, x0: x0, y0: KETEN_Y, x: plek[0], y: plek[1], t: B.minderBeweging() ? 1 : 0 };
            stukken.push(nieuw);
            plaatsStuk(nieuw);
            var sch = soort === 'beta' ? scharen.b : scharen.a;
            sch.open = 0;
            G.speel('tik');
            if (soort === 'beta') betaN += 1; else alfaN += 1;
        }
        function plaatsStuk(s) {
            var e = s.t;
            var x = B.lerp(s.x0, s.x, 1 - Math.pow(1 - e, 2));
            var y = B.lerp(s.y0, s.y, e * e);
            zet(s.el, 'transform', 'translate(' + f1(x) + ' ' + f1(y) + ')');
        }

        function status() {
            if (kapot) return kapot;
            if (af) return T >= 80 ? 'afHeet' : 'af';
            if (gelukt) return T >= 73 ? 'naar78' : 'gelukt';
            // te warm vóór de bèta-rust klaar is: niets voorlezen tot het oordeel valt
            if (betaN < 4 && T > 65.5) return laatsteStatus;
            var z = zoneNu;
            if (z === 'koud') return 'koud';
            if (z === 'beta') return betaN >= 4 ? 'betaKlaar' : 'beta';
            if (z === 'tussen') return betaN >= 4 ? 'tussen' : 'beta';
            if (z === 'alfa') return 'alfa';
            return 'heet';
        }
        var SOORT = { koud: 'info', beta: 'info', betaKlaar: 'goed', tussen: 'info', alfa: 'info', heet: 'fout', kapotHeet: 'fout', kapotBeta: 'fout', gelukt: 'goed', naar78: 'info', af: 'goed', afHeet: 'info' };

        function maakKapot(soort) {
            kapot = soort;
            svg.classList.add('is-kapot');
            schaarA.classList.add('is-uit');
            schaarB.classList.add('is-uit');
            G.speel('fout');
            tril([30, 40, 30]);
            c.opdracht(TEKST.opdrachtKapot);
            // ↺ meteen in beeld en de hint (puls + handje) wijst ernaar
            c.opnieuwZichtbaar(true);
            if (opnieuwKnop) {
                opnieuwKnop.classList.add('bp-pulse');
                hint.el = opnieuwKnop;
                hint.tekst = 'Tik op ↺';
            }
        }

        function stapLogica(dt) {
            var zOud = zoneNu;
            zoneNu = zoneVan(T);
            if (zoneNu !== zOud && bediend && !kapot && !af && (zoneNu === 'beta' || zoneNu === 'alfa')) { G.speel('borrel'); tril(12); }
            if (kapot || af || !bediend) return;
            if (T >= 77.5) {
                if (gelukt) {
                    af = true;
                    svg.classList.add('is-af');
                    vinken.af.classList.add('is-aan');
                    schaarA.classList.add('is-uit');
                    schaarB.classList.add('is-uit');
                    G.speel('fanfare');
                    tril(12);
                    c.opdracht(TEKST.opdrachtAf);
                } else maakKapot('kapotHeet');
                return;
            }
            // Boven 65,5 °C voordat de bèta-rust klaar is: bèta gaat kapot (rust overgeslagen).
            // Een heel kort uitschieter (< 0,35 s) bij het slepen telt niet.
            if (betaN < 4 && T > 65.5) {
                klokOver += dt;
                if (klokOver >= 0.35) { maakKapot('kapotBeta'); return; }
            } else klokOver = 0;
            var z = zoneNu;
            var rB = z === 'beta' ? 1 / 0.6 : 0;
            var rA = z === 'alfa' ? 1 / 1.25 : (z === 'tussen' || z === 'heet') ? 0.5 / 1.25 : 0;
            if (rB) { klokB += dt * rB; if (klokB >= 1) { klokB = 0; knip('beta'); if (betaN === 4) betaKlaar(); } }
            else klokB = 0;
            if (rA && betaN >= 4) { klokA += dt * rA; if (klokA >= 1) { klokA = 0; knip('alfa'); if (alfaN === 2) alfaKlaar(); } }
            else klokA = 0;
            if (!gelukt && betaN >= 4 && alfaN >= 2) {
                gelukt = true;
                c.gelukt(TEKST.gelukt);
                c.opdracht(TEKST.opdracht78);
            }
        }
        function betaKlaar() {
            vinken.beta.classList.add('is-aan');
            G.speel('rinkel');
            tril(12);
            if (alfaN < 2) c.opdracht(TEKST.opdrachtAlfa);
        }
        function alfaKlaar() { vinken.alfa.classList.add('is-aan'); }

        function teken(dt) {
            var t = T;
            // thermometer
            var y = Y(t);
            if (getekend.T !== t) {
                getekend.T = t;
                zet(kwik, 'y', f1(y));
                zet(kwik, 'height', f1(372 - y));
                zet(greep, 'transform', 'translate(62 ' + f1(y) + ')');
                tekst(greepTekst, Math.round(t) + '°');
                zet(thermo, 'aria-valuenow', Math.round(t));
                zet(thermo, 'aria-valuetext', Math.round(t) + ' graden, ' + ZONE_TEKST[zoneVan(t)]);
                var hitte = B.klem((t - TMIN) / (TMAX - TMIN), 0, 1);
                var h = f1(0.25 + hitte * 1.05);
                for (var v = 0; v < vlamEls.length; v++) zet(vlamEls[v], 'transform', 'translate(' + (285 + v * 25) + ' 388) scale(1 ' + h + ')');
                zet(stoom, 'opacity', f1(0.08 + hitte * 0.9));
                zet(rood, 'opacity', f1(B.klem((t - 79.5) / 2.5, 0, 1)));
                // de ketel in scène A leeft mee: meter, stoom, temperatuur
                if (bediend) {
                    var fT = B.klem((t - 40) / 40, 0, 1);
                    c.cel.style.setProperty('--hitte', fT.toFixed(3));
                    c.cel.style.setProperty('--naald', (-70 + fT * 130).toFixed(1) + 'deg');
                    if (ketelTemp) tekst(ketelTemp, Math.round(t) + '°');
                }
            }
            if (bediend && getekend.omzet !== betaN + alfaN) {
                getekend.omzet = betaN + alfaN;
                c.cel.style.setProperty('--beslag-kleur', B.mengKleur('#E6D6AE', '#C98B2E', B.klem((betaN + alfaN) / 8, 0, 1)));
            }
            // keten: kralen schuiven naar hun plek
            animeert = false;
            var snel = B.minderBeweging() ? 1 : Math.min(1, dt * 9);
            for (var k = 0; k < kralen.length; k++) {
                var kr = kralen[k], doel = EIND_X - k * STAP;
                if (kr.x !== doel) {
                    kr.x = Math.abs(doel - kr.x) < 0.3 ? doel : kr.x + (doel - kr.x) * snel;
                    zet(kr.el, 'cx', f1(kr.x));
                    if (kr.x !== doel) animeert = true;
                }
            }
            zet(binding, 'd', 'M180 ' + KETEN_Y + 'H' + f1(kralen[0].x));
            for (var m = 0; m < stukken.length; m++) {
                var st = stukken[m];
                if (st.t < 1) {
                    st.t = Math.min(1, st.t + (B.minderBeweging() ? 1 : dt / 0.55));
                    plaatsStuk(st);
                    if (st.t < 1) animeert = true;
                }
            }
            // scharen: open als ze werken, dicht na een knip
            var actiefB = !kapot && !af && bediend && zoneNu === 'beta';
            var actiefA = !kapot && !af && bediend && (zoneNu === 'alfa' || zoneNu === 'tussen');
            [[scharen.b, actiefB], [scharen.a, actiefA]].forEach(function (p) {
                var sch = p[0], doelOpen = p[1] ? 1 : (kapot || af ? 0.12 : 0.35);
                sch.open = B.minderBeweging() ? doelOpen : sch.open + (doelOpen - sch.open) * Math.min(1, dt * 6);
                if (Math.abs(sch.open - doelOpen) < 0.01) sch.open = doelOpen;
                else animeert = true;
                schaarOpen(sch.el, sch.open);
            });
            zzz.classList.toggle('is-zichtbaar', !kapot && !af && T < 59);
        }

        // Tijdens snel slepen niet elke tussenstand voorlezen: pas melden als
        // de stand 0,25 s gelijk blijft (gebeurtenissen meteen).
        var kandidaat = '', kandidaatSinds = 0;
        var METEEN = { kapotHeet: 1, kapotBeta: 1, gelukt: 1, af: 1, betaKlaar: 1 };
        function meldStatus() {
            if (!bediend) return;
            var s = status(), nu = performance.now();
            if (s === laatsteStatus) { kandidaat = ''; return; }
            if (s !== kandidaat) { kandidaat = s; kandidaatSinds = nu; }
            if (sleept !== null && !METEEN[s] && nu - kandidaatSinds < 250) return;
            laatsteStatus = s;
            kandidaat = '';
            meld(TEKST[s], SOORT[s]);
        }

        // Moet de lus nog draaien? (anders stil: spaart de batterij)
        function bezig() {
            if (sleept !== null || animeert || kandidaat) return true;
            if (!bediend || kapot || af) return false;
            return zoneNu === 'beta' || zoneNu === 'tussen' || zoneNu === 'alfa' || zoneNu === 'heet';
        }

        var lus = B.lus(function (dt) {
            stapLogica(dt);
            teken(dt);
            meldStatus();
            if (!bezig()) lus.stop();
        }, houder);

        function eerste() {
            if (bediend) return;
            bediend = true;
            svg.classList.add('is-bediend');
            c.cel.classList.add('is-gekoppeld');
            c.opnieuwZichtbaar(true);
        }
        function zetT(nieuw) {
            T = B.klem(nieuw, TMIN, TMAX);
            eerste();
            zoneNu = zoneVan(T);
            teken(0);
            meldStatus();
            lus.start();
        }

        thermo.addEventListener('pointerdown', function (e) {
            if (e.button > 0) return;
            e.preventDefault();
            try { thermo.setPointerCapture(e.pointerId); } catch (x) { /* oude browser */ }
            var p = svgPunt(svg, e);
            var yNu = Y(T);
            sleept = e.pointerId;
            offset = (Math.abs(p.y - yNu) < 34 && p.x < 100) ? p.y - yNu : 0;
            thermo.classList.add('is-actief');
            zetT(Tvan(p.y - offset));
        });
        thermo.addEventListener('pointermove', function (e) {
            if (sleept !== e.pointerId) return;
            zetT(Tvan(svgPunt(svg, e).y - offset));
        });
        function los(e) {
            if (sleept === null || (e && e.pointerId !== undefined && e.pointerId !== sleept)) return;
            sleept = null;
            thermo.classList.remove('is-actief');
            lus.start();
        }
        thermo.addEventListener('pointerup', los);
        thermo.addEventListener('pointercancel', los);
        thermo.addEventListener('lostpointercapture', los);
        thermo.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        // Toetsenbord: pijltjes ±1 °C, PageUp/PageDown = naar de volgende/vorige rust.
        thermo.addEventListener('keydown', function (e) {
            var k = e.key, nieuw = null, r = Math.round(T);
            if (k === 'ArrowUp' || k === 'ArrowRight') nieuw = r + 1;
            else if (k === 'ArrowDown' || k === 'ArrowLeft') nieuw = r - 1;
            else if (k === 'PageUp') { nieuw = TMAX; for (var s = 0; s < STOPS.length; s++) if (STOPS[s] > T + 0.5) { nieuw = STOPS[s]; break; } }
            else if (k === 'PageDown') { nieuw = TMIN; for (var q = STOPS.length - 1; q >= 0; q--) if (STOPS[q] < T - 0.5) { nieuw = STOPS[q]; break; } }
            else if (k === 'Home') nieuw = TMIN;
            else if (k === 'End') nieuw = TMAX;
            if (nieuw === null) return;
            e.preventDefault();
            zetT(nieuw);
        });

        reset();
        c.opdracht(OPDRACHT);
        teken(0);

        return {
            hint: hint,
            open: function () { wortel.classList.add('is-open'); lus.start(); },
            dicht: function () {
                wortel.classList.remove('is-open');
                sleept = null;
                thermo.classList.remove('is-actief');
                lus.stop();
            },
            opnieuw: function () {
                lus.stop();
                reset();
                if (opnieuwKnop) opnieuwKnop.classList.remove('bp-pulse');
                hint.el = thermo;
                hint.tekst = HINT;
                c.cel.classList.remove('is-gekoppeld');
                ['--hitte', '--naald', '--beslag-kleur'].forEach(function (p) { c.cel.style.removeProperty(p); });
                if (ketelTemp) tekst(ketelTemp, '');
                meld.wis();
                c.opdracht(OPDRACHT);
                teken(0);
                opnieuwKlaar(c, thermo);
            }
        };
    };
})();
