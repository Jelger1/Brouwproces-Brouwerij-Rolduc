/* =====================================================================
   Brouwerij Rolduc — De Brouwreis, scène B "Doen" (deel 2)

     stap 4  filter    Kraan open, bostel weg   hendel slepen of tikken,
                                                daarna tik op het karretje
     stap 5  hopketel  Hop in de ketel          tik de ketel aan de kook,
                                                tik of zwiep hopbellen erin
     stap 6  gistloep  De gist-loep             vergrootglas vrij slepen

   Elk proefje vult zijn podium met één close-up (viewBox 480 × 440) en
   praat met de app via ctx: melding, opdracht, opnieuwZichtbaar, gelukt,
   en koppelklassen op ctx.cel (de ketel in scène A leeft mee).
   Bediening: één vinger of muis (pointer events) en het toetsenbord.
   ===================================================================== */

(function () {
    'use strict';

    var B = window.Brouw;
    if (!B) return;
    var D = window.BROUWPROCES || {};
    D.hulp = D.hulp || {};
    var I = B.interacties = B.interacties || {};

    var VB_B = 480, VB_H = 440;

    /* ==================================================================
       Gedeelde hulpjes
       ================================================================== */
    function geenOp() { /* niets */ }

    // Een dunne laag om ctx heen: meldingen niet dubbel sturen, en
    // ontbrekende functies (losse proefpagina) mogen geen fout geven.
    function praat(ctx) {
        ctx = ctx || {};
        var laatste = null;
        return {
            melding: function (tekst, soort) {
                tekst = tekst || '';
                var sleutel = tekst + '|' + (tekst ? soort || 'info' : '');
                if (sleutel === laatste) return;
                laatste = sleutel;
                if (ctx.melding) ctx.melding(tekst, tekst ? soort || 'info' : undefined);
            },
            opdracht: function (tekst) { if (ctx.opdracht && tekst) ctx.opdracht(tekst); },
            opnieuwZichtbaar: function (aan) { if (ctx.opnieuwZichtbaar) ctx.opnieuwZichtbaar(!!aan); },
            gelukt: function (tekst) { if (ctx.gelukt) ctx.gelukt(tekst); },
            celKlasse: function (k, aan) { if (ctx.cel) ctx.cel.classList.toggle(k, !!aan); },
            celVar: function (k, v) {
                if (!ctx.cel) return;
                if (v == null) ctx.cel.style.removeProperty(k); else ctx.cel.style.setProperty(k, v);
            }
        };
    }

    // De opdrachtregel zoals de app hem in de HTML zette (voor ↺).
    function beginOpdracht(ctx, reserve) {
        var el = ctx && ctx.scene && ctx.scene.querySelector('[data-opdracht]');
        var t = el && el.textContent.trim();
        return t || reserve;
    }

    function speel(naam) { if (B.geluid) B.geluid.speel(naam); }
    function geluidAan() { return !!(B.geluid && B.geluid.aan && B.geluid.aan()); }

    // Een doorlopend geluid (lus) dat je elk frame aan of uit mag zetten.
    function lusGeluid(naam) {
        var g = null, echt = false;
        return function (aan) {
            if (aan && g && !echt && geluidAan()) { g.stop(); g = null; }
            if (aan && !g) {
                echt = geluidAan();
                g = (B.geluid && B.geluid.lus(naam)) || { stop: geenOp };
            } else if (!aan && g) {
                g.stop();
                g = null;
            }
        };
    }

    // Haptiek (mobiel.md §5.3): kort tikje bij een mijlpaal, nooit tijdens
    // het slepen, niet bij bewegingsvoorkeur, max één keer per 150 ms.
    var laatsteTril = 0;
    function tril(ms) {
        if (B.minderBeweging()) return;
        var nu = Date.now();
        if (nu - laatsteTril < 150) return;
        laatsteTril = nu;
        B.trillen(ms || 12);
    }

    // Schermpunt → viewBox-punt (werkt met preserveAspectRatio meet en met
    // de camera-transform van de wereld, want we meten de echte rechthoek).
    function naarVb(svg, e) {
        var r = svg.getBoundingClientRect();
        var s = Math.min(r.width / VB_B, r.height / VB_H) || 1;
        return {
            x: (e.clientX - r.left - (r.width - VB_B * s) / 2) / s,
            y: (e.clientY - r.top - (r.height - VB_H * s) / 2) / s
        };
    }

    /* Eén gebaar op een hotspot: tik óf sleep (pointer events + capture),
       plus toetsen en een klik-reserve voor schermlezers.
       o.start(p)            pointer omlaag; return false = negeren
       o.beweeg(p)           tijdens slepen (pas na 8 px)
       o.los(p, v, afgebr.)  einde van een sleep; v = snelheid (eenheden/s)
       o.tik(p)              tik zonder slepen (p = null bij klik/AT)
       o.toets(e)            return true = afgehandeld                    */
    function gebaar(el, svg, o) {
        var a = null, laatstePointer = 0;
        el.addEventListener('pointerdown', function (e) {
            if (a || (e.pointerType === 'mouse' && e.button !== 0)) return;
            var p = naarVb(svg, e);
            if (o.start && o.start(p) === false) return;
            e.preventDefault();
            try { el.setPointerCapture(e.pointerId); } catch (x) { /* oud toestel */ }
            a = { id: e.pointerId, cx: e.clientX, cy: e.clientY, p0: p, p: p, sleept: false, spoor: [{ t: e.timeStamp, x: p.x, y: p.y }] };
        });
        el.addEventListener('pointermove', function (e) {
            if (!a || e.pointerId !== a.id) return;
            var p = naarVb(svg, e);
            if (!a.sleept) {
                if (Math.abs(e.clientX - a.cx) + Math.abs(e.clientY - a.cy) < 8 || !o.beweeg) return;
                a.sleept = true;
            }
            a.p = p;
            a.spoor.push({ t: e.timeStamp, x: p.x, y: p.y });
            while (a.spoor.length > 2 && e.timeStamp - a.spoor[0].t > 110) a.spoor.shift();
            o.beweeg(p);
        });
        function klaar(e, afgebroken) {
            if (!a || (e && e.pointerId !== a.id)) return;
            var h = a;
            a = null;
            laatstePointer = Date.now();
            try { el.releasePointerCapture(h.id); } catch (x) { /* al los */ }
            if (!h.sleept) {
                if (afgebroken) { if (o.los) o.los(h.p, { x: 0, y: 0 }, true); }
                else if (o.tik) o.tik(h.p0);
                return;
            }
            var s0 = h.spoor[0], s1 = h.spoor[h.spoor.length - 1], dt = s1.t - s0.t;
            var v = dt > 8 ? { x: (s1.x - s0.x) / dt * 1000, y: (s1.y - s0.y) / dt * 1000 } : { x: 0, y: 0 };
            if (o.los) o.los(h.p, v, !!afgebroken);
        }
        el.addEventListener('pointerup', function (e) { klaar(e, false); });
        el.addEventListener('pointercancel', function (e) { klaar(e, true); });
        el.addEventListener('lostpointercapture', function (e) { if (a && e.pointerId === a.id) klaar(e, true); });
        // Schermlezers "klikken" zonder pointer events.
        el.addEventListener('click', function () {
            if (Date.now() - laatstePointer > 700 && o.tik) o.tik(null);
        });
        el.addEventListener('keydown', function (e) {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            if (o.toets && o.toets(e)) e.preventDefault();
        });
    }

    function isActivatie(e) { return e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar'; }

    function schud(el) {
        el.classList.remove('is-nee');
        void el.getBoundingClientRect();
        el.classList.add('is-nee');
        clearTimeout(el.__nee);
        el.__nee = setTimeout(function () { el.classList.remove('is-nee'); }, 500);
    }

    function f1(n) { return (Math.round(n * 10) / 10).toString(); }

    /* ==================================================================
       STAP 4 · KRAAN OPEN, BOSTEL WEG
       Hendel omlaag (slepen of tikken) → eerst troebel wort dat terug
       over het filterbed gaat (rondpompen), dan helder goud naar de
       kookketel. Kuip leeg → bostel in het karretje → tik → naar de boer.
       ================================================================== */
    D.hulp.filter = D.hulp.filter || {
        hint: 'Trek de hendel omlaag',
        wat: 'Trek de hendel van de kraan omlaag, of tik erop. Kijk hoe het wort eerst troebel en dan helder loopt. Tik daarna op het karretje.',
        waarom: 'De kafjes uit stap 2 vormen een natuurlijk filter. Het troebele begin pompt de brouwer terug: rondpompen. Het heldere wort gaat naar de kookketel, het bostel als krachtvoer naar de boer.'
    };

    var FT = {
        troebel: 1.8,   // s rondpompen
        leeg: 6.2,      // s: de kuip is leeg
        glij: 0.45,     // s na leeg: het bostel glijdt de goot af
        vol: 1.15,      // s na leeg: het karretje is vol
        hendelLabel: 'Open de kraan: trek de hendel omlaag',
        opdracht2: 'Tik op het karretje: bostel naar de boer.'
    };

    function filterSvg(id) {
        var kuip = id + '-kuip', kader = id + '-kader', k5 = id + '-k5';
        var tikken = '';
        for (var x = 240; x <= 460; x += 18) tikken += 'M' + x + ' 386v6';
        return '' +
        '<svg class="bp-filter4" viewBox="0 0 480 440" preserveAspectRatio="xMidYMid meet" role="group" aria-label="De filterkuip met kraan, de kookketel en het bostelkarretje">' +
            '<defs>' +
                '<clipPath id="' + kuip + '"><rect x="84" y="70" width="160" height="156" rx="8"/></clipPath>' +
                '<clipPath id="' + kader + '"><rect x="0" y="0" width="478" height="440"/></clipPath>' +
                '<clipPath id="' + k5 + '"><rect x="42" y="364" width="40" height="42" rx="5"/></clipPath>' +
            '</defs>' +

            // De boer op de achtergrond: heuvel, hoeve, koe en voerbak.
            '<g class="bp-filter4__hoeve" aria-hidden="true">' +
                '<path class="bp-filter4__heuvel" d="M280 174C314 156 350 152 388 160S446 158 462 150"/>' +
                '<path class="bp-filter4__rook" d="M441 74c-6-6 4-10-2-16s4-10-2-16"/>' +
                '<path class="bp-v bp-lf" d="M436 104V80H446V110"/>' +
                '<path class="bp-v bp-lf" d="M366 168V118H446V168Z"/>' +
                '<path class="bp-v bp-l" d="M358 122L406 86L454 122Z"/>' +
                '<path class="bp-lf" d="M396 168V144H416V168M376 130h14v11h-14zM422 130h14v11h-14z"/>' +
                '<path class="bp-v bp-lf" d="M272 162H306L302 172H276Z"/>' +
                '<path class="bp-bostel bp-filter4__voer" d="M277 163C279 156 285 154 290 157C294 153 300 155 302 163Z"/>' +
                '<g class="bp-filter4__koe">' +
                    '<path class="bp-lf" d="M318 150V168M326 150V168M344 150V168M352 150V168M358 134C366 138 366 150 362 158"/>' +
                    '<rect class="bp-filter4__koelijf" x="312" y="126" width="48" height="26" rx="10"/>' +
                    '<path class="bp-filter4__vlek" d="M326 127C334 128 336 138 330 142C324 146 318 138 320 132ZM346 140C352 138 358 142 356 148C350 152 344 148 346 140Z"/>' +
                    '<g class="bp-filter4__kop">' +
                        '<path class="bp-filter4__koelijf" d="M315 131L298 128Q288 128 288 138L290 146Q292 151 298 150L315 144Z"/>' +
                        '<path class="bp-lf" d="M302 129L299 120M308 130L311 121M315 134L323 129"/>' +
                        '<circle class="bp-naaf" cx="300" cy="136" r="1.7"/>' +
                        '<path class="bp-lf" d="M290 145h5"/>' +
                    '</g>' +
                '</g>' +
                '<path class="bp-filter4__boe" d="M281 129c-5-4-5-11 0-15M273 133c-9-7-9-19 0-26"/>' +
            '</g>' +

            // Leidingen achter de kuip, de kuip zelf, goot en poten.
            '<g aria-hidden="true">' +
                '<path class="bp-filter4__buis" d="M44 282V30H116V84M44 282V318H62V334M150 282H44M164 236V268"/>' +
                '<path class="bp-v bp-l" d="M68 52H260V60H68Z"/>' +
                '<path class="bp-v bp-l" d="M72 60H256V228Q256 238 246 238H82Q72 238 72 228Z"/>' +
                '<g class="bp-nagels"><circle cx="78" cy="66" r="2"/><circle cx="250" cy="66" r="2"/><circle cx="78" cy="230" r="2"/><circle cx="250" cy="230" r="2"/></g>' +
                '<rect class="bp-venster" x="84" y="70" width="160" height="156" rx="8"/>' +
                '<g clip-path="url(#' + kuip + ')">' +
                    '<g class="bp-filter4__vloeistof" data-vloeistof transform="translate(0 0)">' +
                        '<rect class="bp-filter4__beslag" x="84" y="76" width="160" height="112"/>' +
                        '<g class="bp-filter4__deeltjes"><circle cx="100" cy="98" r="2.2"/><circle cx="128" cy="122" r="1.8"/><circle cx="152" cy="94" r="2.4"/><circle cx="186" cy="132" r="1.8"/><circle cx="214" cy="104" r="2.2"/><circle cx="230" cy="150" r="1.8"/><circle cx="108" cy="160" r="2"/><circle cx="170" cy="166" r="1.6"/><circle cx="204" cy="172" r="2"/></g>' +
                    '</g>' +
                    '<g class="bp-filter4__bed">' +
                        '<rect x="84" y="186" width="160" height="28"/>' +
                        '<path d="M94 194l6-3M110 204l6 2M126 192l5 4M142 206l6-2M158 196l6 3M174 204l5-4M190 192l6 2M206 206l5-3M222 196l6 2M100 208l5-2M134 200l5 3M168 210l6-1M198 200l5-3M232 208l4-4"/>' +
                    '</g>' +
                    '<rect class="bp-filter4__onder" x="84" y="214" width="160" height="12"/>' +
                    '<path class="bp-lf" d="M164 70V176M124 176H204"/>' +
                    '<path class="bp-hakmes" d="M130 176v12M146 176v12M162 176v12M178 176v12M194 176v12"/>' +
                    '<path class="bp-filter4__sproei" d="M106 90v8M116 92v10M126 90v8M111 106v6M121 108v6"/>' +
                '</g>' +
                '<path class="bp-zeef" d="M84 214H244"/>' +
                '<rect class="bp-lf" x="84" y="70" width="160" height="156" rx="8"/>' +
                '<path class="bp-l" d="M102 84H130"/>' +
                '<path class="bp-v bp-l" d="M256 180H270V214H256"/>' +
                '<path class="bp-lf" d="M270 186L338 298M270 212L320 302"/>' +
                '<path class="bp-l" d="M84 238V300M250 238V300"/>' +
                '<path class="bp-lf" d="M74 300H94M240 300H260"/>' +

                // Stroom (gestreept, beweegt mee): uit de kuip, terug over
                // het bed (rondpompen) of door naar de kookketel.
                '<path class="bp-filter4__stroom bp-filter4__stroom--uit" d="M164 238V282H44"/>' +
                '<path class="bp-filter4__stroom bp-filter4__stroom--rond" d="M44 282V30H116V84"/>' +
                '<path class="bp-filter4__stroom bp-filter4__stroom--ketel" d="M44 282V318H62V336"/>' +

                // Kijkglas, klep, kookketel (stap 5) met ovaaltje.
                '<circle class="bp-v bp-l" cx="104" cy="282" r="15"/>' +
                '<circle class="bp-filter4__kijk" cx="104" cy="282" r="10"/>' +
                '<path class="bp-lf" d="M155 266H173M155 298H173"/>' +
                '<circle class="bp-v bp-l" cx="164" cy="282" r="14"/>' +
                '<path class="bp-v bp-l" d="M34 356C34 341 46 334 62 334C78 334 90 341 90 356Z"/>' +
                '<path class="bp-v bp-l" d="M34 356H90V408Q90 414 84 414H40Q34 414 34 408Z"/>' +
                '<rect class="bp-venster" x="42" y="364" width="40" height="42" rx="5"/>' +
                '<g clip-path="url(#' + k5 + ')"><rect class="bp-filter4__k5wort" data-k5 x="42" y="406" width="40" height="0"/></g>' +
                '<rect class="bp-lf" x="42" y="364" width="40" height="42" rx="5"/>' +
                '<path class="bp-l" d="M40 414V426M84 414V426"/>' +
                '<g class="bp-filter4__ovaal"><ellipse cx="110" cy="350" rx="16" ry="14"/><text x="110" y="358">5</text></g>' +

                // Rails naar de boer + het bostel dat de goot af glijdt.
                '<path class="bp-lf" d="M232 386H468"/>' +
                '<path class="bp-tik" d="' + tikken + '"/>' +
                '<g class="bp-filter4__klont"><path class="bp-bostel" d="M-16 6C-14 -6 -4 -10 4 -6C10 -12 18 -6 16 6Z"/></g>' +
                '<path class="bp-filter4__pijl" d="M240.1 317.5A84 84 0 0 1 181.5 364.2M192.5 368L181.5 364.2L190 356.3"/>' +
            '</g>' +

            // Hotspot 1: de hendel van de kraan.
            '<g class="bp-filter4__hendel bp-dn2__knop" role="button" tabindex="0" data-eigen-toetsen aria-label="' + FT.hendelLabel + '">' +
                '<g data-arm transform="rotate(0 164 282)">' +
                    '<circle class="bp-dn2__raak" cx="222" cy="282" r="45"/>' +
                    '<rect class="bp-dn2__raak" x="150" y="264" width="76" height="36"/>' +
                    '<rect class="bp-v bp-l" x="164" y="277" width="62" height="10" rx="5"/>' +
                    '<circle class="bp-filter4__knop" cx="230" cy="282" r="16"/>' +
                    '<circle class="bp-dn2__ring" cx="230" cy="282" r="29"/>' +
                '</g>' +
                '<circle class="bp-v bp-l" cx="164" cy="282" r="7"/>' +
            '</g>' +

            // Hotspot 2: het bostelkarretje (rijdt de close-up uit, geknipt).
            '<g clip-path="url(#' + kader + ')">' +
                '<g class="bp-filter4__rit">' +
                    '<g class="bp-filter4__kar bp-dn2__knop" role="button" tabindex="0" data-eigen-toetsen aria-disabled="true" aria-label="Rij het bostel naar de boer">' +
                        '<rect class="bp-dn2__raak" x="270" y="270" width="130" height="122" rx="18"/>' +
                        '<rect class="bp-dn2__ring" x="262" y="266" width="146" height="132" rx="24"/>' +
                        '<g class="bp-filter4__lading">' +
                            '<path class="bp-bostel" d="M290 314C292 296 306 288 318 294C324 282 344 282 352 292C364 286 382 296 382 314Z"/>' +
                            '<g class="bp-bostel-korrels"><circle cx="304" cy="304" r="1.8"/><circle cx="320" cy="298" r="1.8"/><circle cx="338" cy="292" r="1.8"/><circle cx="352" cy="302" r="1.8"/><circle cx="368" cy="306" r="1.8"/><circle cx="330" cy="308" r="1.8"/></g>' +
                            '<path class="bp-filter4__damp" d="M318 282c-5-6 5-10 0-16M342 278c-5-6 5-10 0-16"/>' +
                        '</g>' +
                        '<path class="bp-v bp-l" d="M282 312H390L378 362H294Z"/>' +
                        '<path class="bp-lf" d="M286 326H386M282 318L262 310"/>' +
                        '<g class="bp-filter4__wiel"><circle class="bp-v bp-l" cx="308" cy="372" r="12"/><path class="bp-lf" d="M300 372h16M308 364v16"/></g>' +
                        '<g class="bp-filter4__wiel"><circle class="bp-v bp-l" cx="364" cy="372" r="12"/><path class="bp-lf" d="M356 372h16M364 364v16"/></g>' +
                    '</g>' +
                '</g>' +
            '</g>' +
        '</svg>';
    }

    I.filter = function (houder, ctx) {
        var c = praat(ctx);
        var opdracht1 = beginOpdracht(ctx, 'Trek de kraan open, tik dan op het karretje.');
        houder.innerHTML = filterSvg(B.uniekId('bp-filter4'));
        var svg = houder.querySelector('svg');
        var hendel = svg.querySelector('.bp-filter4__hendel');
        var arm = svg.querySelector('[data-arm]');
        var vloeistof = svg.querySelector('[data-vloeistof]');
        var k5 = svg.querySelector('[data-k5]');
        var kar = svg.querySelector('.bp-filter4__kar');
        var vullen = lusGeluid('vullen');
        var hint = { el: hendel, tekst: D.hulp.filter.hint };
        var S = nieuw(true);

        function nieuw(open) {
            return { fase: 'dicht', hoek: 0, doel: 0, sleept: false, t: 0, rit: 0, afgetapt: 0, open: open, gelukt: false };
        }
        function klas(k, aan) { svg.classList.toggle(k, !!aan); }

        function zetHendel(h) { arm.setAttribute('transform', 'rotate(' + f1(h) + ' 164 282)'); }
        function zetAfgetapt(f) {
            if (B.minderBeweging()) f = Math.round(f * 4) / 4;
            if (f === S.afgetapt) return;
            S.afgetapt = f;
            vloeistof.setAttribute('transform', 'translate(0 ' + f1(f * 112) + ')');
            k5.setAttribute('y', f1(406 - f * 42));
            k5.setAttribute('height', f1(f * 42));
            c.celVar('--vulling', f.toFixed(3));   // de kuip in scène A loopt mee leeg
        }

        function openKraan() {
            if (S.fase !== 'dicht') return;
            S.fase = 'open';
            S.t = 0;
            S.doel = 90;
            S.sleept = false;
            klas('is-open', true);
            klas('is-troebel', true);
            hendel.setAttribute('aria-disabled', 'true');
            hendel.setAttribute('aria-label', 'De kraan staat open');
            c.melding('Eerst troebel: die liters gaan terug over het filterbed.', 'info');
            c.opnieuwZichtbaar(true);
            speel('klik');
            tril(12);
            wek();
        }
        function helder() {
            S.helder = true;
            klas('is-troebel', false);
            klas('is-helder', true);
            c.melding('Helder wort! De kafjes doen hun werk als filter.', 'goed');
            speel('tik');
        }
        function leeg() {
            S.leeg = true;
            zetAfgetapt(1);
            klas('is-helder', false);
            klas('is-leeg', true);
            vullen(false);
            c.melding('Al het wort is eruit. Breng het bostel naar de boer.', 'info');
            speel('schep');
        }
        function karVol() {
            S.fase = 'vol';
            klas('is-glijden', false);
            klas('is-vol', true);
            kar.setAttribute('aria-disabled', 'false');
            kar.classList.add('is-nu');
            hint.el = kar;
            hint.tekst = 'Tik op het karretje';
            c.opdracht(FT.opdracht2);
            speel('tak');
            tril(12);
        }
        function rijden() {
            if (S.fase !== 'vol') { karNee(); return; }
            S.fase = 'rijdt';
            S.rit = 0;
            kar.classList.remove('is-nu');
            kar.setAttribute('aria-disabled', 'true');
            klas('is-weg', true);
            klas('is-rijdt', true);
            speel('zoef');
            wek();
        }
        function bijDeBoer() {
            S.bijBoer = true;
            klas('is-gevoerd', true);
            klas('is-boe', true);
            speel('boe');
            c.melding('Bostel bij de boer: krachtvoer voor het vee. Niks verspild!', 'goed');
            if (!S.gelukt) {
                S.gelukt = true;
                c.gelukt('Helder wort naar de ketel, bostel naar de koeien!');
            }
        }
        function karNee() {
            if (S.fase === 'rijdt') return;
            if (S.fase === 'dicht') c.melding('Eerst de kraan open: het karretje is nog leeg.', 'info');
            else if (S.fase === 'open') c.melding('Even geduld: eerst moet al het wort eruit.', 'info');
            else if (S.fase === 'klaar') c.melding('Het bostel is al bij de boer. Smakelijk!', 'goed');
            schud(kar);
            speel('tak');
        }

        var lus = B.lus(function (dt) {
            // De hendel veert naar zijn doel (open = 90°, dicht = 0°).
            if (!S.sleept && S.hoek !== S.doel) {
                var rest = S.doel - S.hoek;
                S.hoek = (B.minderBeweging() || Math.abs(rest) < 0.6) ? S.doel : S.hoek + rest * Math.min(1, dt * 14);
            }
            zetHendel(S.hoek);

            if (S.fase === 'open') {
                S.t += dt;
                if (S.t >= FT.troebel && !S.helder && S.t < FT.leeg) helder();
                if (S.t >= FT.troebel) zetAfgetapt(B.klem((S.t - FT.troebel) / (FT.leeg - FT.troebel), 0, 1));
                if (S.t >= FT.leeg && !S.leeg) leeg();
                if (S.t >= FT.leeg + FT.glij && !S.glijdt) { S.glijdt = true; klas('is-glijden', true); }
                if (S.t >= FT.leeg + FT.vol) karVol();
            }
            vullen(S.fase === 'open' && S.t < FT.leeg);

            if (S.fase === 'rijdt') {
                S.rit += dt;
                if (S.rit >= 1.2 && !S.bijBoer) bijDeBoer();
                if (S.rit >= 2.0 && !S.terug) { S.terug = true; klas('is-vol', false); klas('is-weg', false); }
                if (S.rit >= 3.1) { S.fase = 'klaar'; klas('is-rijdt', false); klas('is-boe', false); }
            }

            var rust = !S.sleept && S.hoek === S.doel && (S.fase === 'dicht' || S.fase === 'vol' || S.fase === 'klaar');
            if (rust) lus.stop();
        }, houder);
        function wek() { if (S.open) lus.start(); }

        // Hendel: slepen (rondom het draaipunt) of tikken.
        gebaar(hendel, svg, {
            start: function () {
                if (S.fase !== 'dicht') return false;
                S.sleept = true;
                wek();
            },
            beweeg: function (p) {
                if (S.fase !== 'dicht') return;
                var h = Math.atan2(p.y - 282, p.x - 164) * 180 / Math.PI;
                if (h > 90) h = 90;
                else if (h < -135) h = 90;
                else if (h < 0) h = 0;
                S.hoek = h;
                if (h >= 80) openKraan();
            },
            los: function () {
                S.sleept = false;
                if (S.fase !== 'dicht') return;
                if (S.hoek >= 40) { openKraan(); return; }
                S.doel = 0;
                c.melding('Trek de hendel helemaal omlaag.', 'info');
                wek();
            },
            tik: function () {
                S.sleept = false;
                if (S.fase === 'dicht') openKraan();
            },
            toets: function (e) {
                if (isActivatie(e) || e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                    if (S.fase === 'dicht') openKraan();
                    return true;
                }
                return false;
            }
        });

        gebaar(kar, svg, {
            tik: rijden,
            toets: function (e) {
                if (!isActivatie(e)) return false;
                rijden();
                return true;
            }
        });

        return {
            hint: hint,
            open: function () { S.open = true; wek(); },
            dicht: function () { S.open = false; lus.stop(); vullen(false); },
            opnieuw: function () {
                svg.classList.add('is-direct');
                ['is-open', 'is-troebel', 'is-helder', 'is-leeg', 'is-glijden', 'is-vol', 'is-weg', 'is-rijdt', 'is-gevoerd', 'is-boe'].forEach(function (k) { klas(k, false); });
                S = nieuw(S.open);
                S.afgetapt = -1;
                zetAfgetapt(0);
                c.celVar('--vulling', null);
                zetHendel(0);
                vullen(false);
                hendel.removeAttribute('aria-disabled');
                hendel.setAttribute('aria-label', FT.hendelLabel);
                kar.setAttribute('aria-disabled', 'true');
                kar.classList.remove('is-nu', 'is-nee');
                hint.el = hendel;
                hint.tekst = D.hulp.filter.hint;
                c.melding('');
                c.opdracht(opdracht1);
                c.opnieuwZichtbaar(false);
                requestAnimationFrame(function () { requestAnimationFrame(function () { svg.classList.remove('is-direct'); }); });
            }
        };
    };

    /* ==================================================================
       STAP 5 · HOP IN DE KETEL
       Tik de ketel aan de kook: de kookklok loopt 60 → 0 min in ± 14 s
       (het groene aroma-stuk loopt trager, zodat je het haalt). Tik of
       zwiep hopbellen van de rank in het mangat. Gelukt = één bitterhop
       met ≥ 30 min te gaan + één aromahop in de laatste 5 min. Begeleid,
       zonder score: de score zit in de finale.
       ================================================================== */
    D.hulp.hopketel = D.hulp.hopketel || {
        hint: 'Tik op de ketel',
        wat: 'Tik op de ketel: het wort gaat koken en de klok loopt. Gooi meteen een hopbel erin, en nog één in het groene stuk van de klok.',
        waarom: 'Hop wordt pas bitter na lang koken: de alfazuren veranderen langzaam in bittere iso-alfazuren. De geur is vluchtig en verdampt als de hop te lang meekookt.'
    };

    var KT = {
        mangat: { x: 300, y: 92 },
        thuis: [{ x: 76, y: 132 }, { x: 152, y: 226 }, { x: 74, y: 318 }],
        r: 58,                                   // straal van de kookring
        ketelLabel: 'Breng de ketel aan de kook',
        opdracht2: 'Gooi hop erin: vroeg voor bitter, laat voor aroma.',
        opdrachtNog: 'Tik op de ketel voor een nieuwe kook.'
    };

    function klokPunt(min, r) {
        var a = (1 - min / 60) * 2 * Math.PI - Math.PI / 2;
        return { x: 300 + Math.cos(a) * r, y: 270 + Math.sin(a) * r };
    }
    function klokBoog(van, tot, r) {
        var p1 = klokPunt(van, r), p2 = klokPunt(tot, r);
        var groot = (van - tot) > 30 ? 1 : 0;
        return 'M' + f1(p1.x) + ' ' + f1(p1.y) + 'A' + r + ' ' + r + ' 0 ' + groot + ' 1 ' + f1(p2.x) + ' ' + f1(p2.y);
    }

    function kookSvg(id) {
        var klok = id + '-klok';
        var omtrek = (2 * Math.PI * KT.r).toFixed(1);
        var tik = '', nagels = '';
        for (var x = 230; x <= 370; x += 10) tik += 'M' + x + ' 168v12';
        for (var n = 234; n <= 366; n += 16.5) nagels += '<circle cx="' + f1(n) + '" cy="190" r="1.9"/><circle cx="' + f1(n) + '" cy="380" r="1.9"/>';
        var bellen = '';
        KT.thuis.forEach(function (p, i) {
            bellen +=
            '<g class="bp-kook5__bel bp-dn2__knop" data-bel="' + i + '" role="button" tabindex="0" data-eigen-toetsen aria-label="Gooi hopbel ' + (i + 1) + ' in de ketel">' +
                '<g data-pos transform="translate(' + p.x + ' ' + p.y + ')">' +
                    '<g class="bp-kook5__zwaai" style="animation-delay:' + (-i * 1.7) + 's">' +
                        '<rect class="bp-dn2__raak" x="-45" y="-56" width="90" height="112" rx="22"/>' +
                        '<ellipse class="bp-dn2__ring" rx="47" ry="58"/>' +
                        '<use href="#bp-sym-hopbel" x="-35" y="-49" width="70" height="98"/>' +
                    '</g>' +
                '</g>' +
            '</g>';
        });
        function wolk(x, y, s, d) {
            return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path style="--d:' + d + 's" d="M-14 6a9 9 0 0 1 12-12a11 11 0 0 1 20 1a8 8 0 0 1 3 15H-10a7 7 0 0 1-4-4Z"/></g>';
        }
        return '' +
        '<svg class="bp-kook5" viewBox="0 0 480 440" preserveAspectRatio="xMidYMid meet" role="group" aria-label="De kookketel met de kookklok en een hoprank">' +
            '<defs>' +
                '<clipPath id="' + klok + '"><circle cx="300" cy="270" r="50"/></clipPath>' +
            '</defs>' +
            '<g aria-hidden="true">' +
                '<path class="bp-kook5__leiding" d="M20 24H460"/>' +
                '<g class="bp-kook5__wolken">' + wolk(252, 64, 1.3, 0) + wolk(352, 50, 1.5, 1.4) + wolk(372, 92, 1.1, 2.6) + '</g>' +
                '<g class="bp-kook5__geur" data-geur></g>' +
                '<g class="bp-kook5__vuur">' +
                    '<path class="bp-lf" d="M262 422H338"/>' +
                    '<path class="bp-kook5__vlam" d="M276 420C270 412 276 404 281 398C283 406 289 410 285 420Z"/>' +
                    '<path class="bp-kook5__vlam" style="animation-delay:-.2s" d="M296 420C290 410 296 400 302 394C304 404 310 408 306 420Z"/>' +
                    '<path class="bp-kook5__vlam" style="animation-delay:-.35s" d="M316 420C310 412 316 404 321 398C323 406 329 410 325 420Z"/>' +
                '</g>' +
            '</g>' +

            // Hotspot: de ketel (hoofdhotspot), met de kookklok als kijkglas.
            '<g class="bp-kook5__ketel bp-dn2__knop" role="button" tabindex="0" data-eigen-toetsen aria-label="' + KT.ketelLabel + '">' +
                '<rect class="bp-dn2__raak" x="212" y="78" width="176" height="318" rx="22"/>' +
                '<rect class="bp-dn2__ring" x="204" y="70" width="192" height="334" rx="28"/>' +
                '<path class="bp-v bp-l" d="M222 168C222 128 256 104 300 104C344 104 378 128 378 168Z"/>' +
                '<path class="bp-v bp-l" d="M276 108V88H324V108"/>' +
                '<ellipse class="bp-kook5__gat" cx="300" cy="88" rx="24" ry="6"/>' +
                '<path class="bp-v bp-l" d="M222 168H378V378Q378 390 366 390H234Q222 390 222 378Z"/>' +
                '<path class="bp-lf" d="M222 180H378"/>' +
                '<path class="bp-tik" d="' + tik + '"/>' +
                '<g class="bp-nagels">' + nagels + '</g>' +
                '<circle class="bp-v bp-l" cx="300" cy="270" r="66"/>' +
                '<circle class="bp-venster" cx="300" cy="270" r="50"/>' +
                '<g clip-path="url(#' + klok + ')">' +
                    '<path class="bp-kook5__wort" data-wort d="M246 290Q260 282 274 290T302 290T330 290T358 290V330H246Z"/>' +
                    '<g class="bp-kook5__bubbels"><circle style="--d:0s" cx="272" cy="312" r="3"/><circle style="--d:.3s" cx="292" cy="316" r="2.4"/><circle style="--d:.55s" cx="312" cy="312" r="3.2"/><circle style="--d:.8s" cx="328" cy="316" r="2.2"/><circle style="--d:.15s" cx="302" cy="318" r="2"/></g>' +
                '</g>' +
                '<circle class="bp-kook5__spoor" cx="300" cy="270" r="' + KT.r + '"/>' +
                '<path class="bp-kook5__vak bp-kook5__vak--bitter" d="' + klokBoog(60, 30, KT.r) + '"/>' +
                '<path class="bp-kook5__vak bp-kook5__vak--aroma" d="' + klokBoog(5, 0.01, KT.r) + '"/>' +
                '<circle class="bp-kook5__loop" data-loop cx="300" cy="270" r="' + KT.r + '" transform="rotate(-90 300 270)" stroke-dasharray="' + omtrek + '" stroke-dashoffset="' + omtrek + '"/>' +
                '<g data-merken></g>' +
                '<circle class="bp-kook5__wijzer" data-wijzer cx="300" cy="' + (270 - KT.r) + '" r="7"/>' +
                '<text class="bp-kook5__min" data-min x="300" y="270">60</text>' +
                '<text class="bp-kook5__eenheid" x="300" y="298">min</text>' +
                '<path class="bp-l" d="M236 390V424M364 390V424"/>' +
                '<path class="bp-lf" d="M226 424H246M354 424H374"/>' +
            '</g>' +

            // De hoprank uit de plafondleiding, met drie hopbellen (hotspots).
            '<g class="bp-kook5__rank" aria-hidden="true">' +
                '<path class="bp-kook5__stengel" d="M112 24C130 58 96 94 110 132C124 172 92 206 108 246C120 280 98 312 110 350"/>' +
                '<path class="bp-kook5__steel" d="M108 104C98 100 84 96 72 88M110 198C124 194 138 190 148 182M108 292C96 290 82 284 70 274M110 132c14-6 24 2 20 10s-14 6-12-2"/>' +
                '<g transform="translate(152 104) rotate(24)"><use href="#bp-sym-hopblad" x="-28" y="-28" width="56" height="56"/></g>' +
                '<g transform="translate(64 220) rotate(-28)"><use href="#bp-sym-hopblad" x="-25" y="-25" width="50" height="50"/></g>' +
            '</g>' +
            bellen +
            '<g class="bp-kook5__spat" data-spat aria-hidden="true"></g>' +
        '</svg>';
    }

    I.hopketel = function (houder, ctx) {
        var c = praat(ctx);
        var opdracht1 = beginOpdracht(ctx, 'Breng de ketel aan de kook en gooi hop erin.');
        houder.innerHTML = kookSvg(B.uniekId('bp-kook5'));
        var svg = houder.querySelector('svg');
        var ketel = svg.querySelector('.bp-kook5__ketel');
        var bellen = [].slice.call(svg.querySelectorAll('.bp-kook5__bel'));
        var posEl = bellen.map(function (b) { return b.querySelector('[data-pos]'); });
        var loopEl = svg.querySelector('[data-loop]');
        var wijzer = svg.querySelector('[data-wijzer]');
        var minEl = svg.querySelector('[data-min]');
        var merken = svg.querySelector('[data-merken]');
        var wort = svg.querySelector('[data-wort]');
        var geur = svg.querySelector('[data-geur]');
        var spat = svg.querySelector('[data-spat]');
        var OMTREK = 2 * Math.PI * KT.r;
        var koken = lusGeluid('koken');
        var hint = { el: ketel, tekst: D.hulp.hopketel.hint };
        var S = nieuw(true);

        function nieuw(open) {
            return {
                kook: 'uit', min: 60, bitter: false, aroma: false, vroeg: 0, groei: 0,
                bel: KT.thuis.map(function (p) { return { staat: 'thuis', x: p.x, y: p.y }; }),
                vlucht: [], open: open, gelukt: false
            };
        }

        function zetBel(i, x, y, r, s) {
            posEl[i].setAttribute('transform', 'translate(' + f1(x) + ' ' + f1(y) + ')' + (r ? ' rotate(' + f1(r) + ')' : '') + (s != null && s !== 1 ? ' scale(' + s.toFixed(3) + ')' : ''));
        }
        function belOver() { return S.bel.some(function (b) { return b.staat === 'thuis' || b.staat === 'sleept' || b.staat === 'terug'; }); }
        function kleurWort() { wort.style.fill = B.mengKleur('#F4D27A', '#B8741F', Math.min(1, S.vroeg * 0.3)); }

        function tekenKlok() {
            var e = 1 - S.min / 60;
            loopEl.setAttribute('stroke-dashoffset', (OMTREK * (1 - e)).toFixed(1));
            var p = klokPunt(S.min, KT.r);
            wijzer.setAttribute('cx', f1(p.x));
            wijzer.setAttribute('cy', f1(p.y));
            var t = String(Math.max(0, Math.ceil(S.min - 1e-6)));
            if (minEl.textContent !== t) minEl.textContent = t;
        }
        function merk(m) {
            var p = klokPunt(m, KT.r);
            var soort = m >= 30 ? 'bitter' : (m <= 5 ? 'aroma' : 'midden');
            merken.appendChild(B.svg('circle', { cx: f1(p.x), cy: f1(p.y), r: 6.5, 'class': 'bp-kook5__merk bp-kook5__merk--' + soort }));
        }

        function bijZetten(el, ms) {
            spat.appendChild(el);
            setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, ms);
        }
        function spetter() {
            if (B.minderBeweging()) return;
            bijZetten(B.svg('ellipse', { cx: 300, cy: 88, rx: 18, ry: 5, 'class': 'bp-kook5__ring' }), 800);
            var puf = B.svg('g', { transform: 'translate(300 74)' });
            puf.appendChild(B.svg('path', { 'class': 'bp-kook5__puf', d: 'M-14 6a9 9 0 0 1 12-12a11 11 0 0 1 20 1a8 8 0 0 1 3 15H-10a7 7 0 0 1-4-4Z' }));
            bijZetten(puf, 1300);
        }
        // Vroege hop: de geurkrulletjes verdampen.
        function geurWeg() {
            if (B.minderBeweging()) return;
            [-26, 0, 26].forEach(function (dx, k) {
                var g = B.svg('g', { transform: 'translate(' + (300 + dx) + ' 78)' });
                g.appendChild(B.svg('path', { 'class': 'bp-kook5__krul bp-kook5__krul--weg', style: 'animation-delay:' + (k * 0.12) + 's', d: 'M0 0c-5-6 5-12 0-18s5-12 0-18' }));
                bijZetten(g, 2000);
            });
        }
        // Late hop: hopvormige geurwolkjes zweven op en blijven hangen.
        function geurBlijft() {
            var plekken = [[-62, -22], [2, -32], [66, -18]];
            plekken.forEach(function (d, k) {
                var g = B.svg('g', { transform: 'translate(300 84)' });
                var op = B.svg('g', { 'class': 'bp-kook5__aroma', style: '--x:' + d[0] + 'px;--y:' + d[1] + 'px;animation-delay:' + (k * 0.15) + 's' });
                var dobber = B.svg('g', { 'class': 'bp-kook5__dobber', style: 'animation-delay:' + (-k * 0.9) + 's' });
                dobber.appendChild(B.svg('path', { 'class': 'bp-kook5__krul', d: 'M0 14c-4-5 4-9 0-14s4-9 0-14' }));
                dobber.appendChild(B.svg('use', { href: '#bp-sym-hopbel', x: -12, y: -40, width: 24, height: 34 }));
                op.appendChild(dobber);
                g.appendChild(op);
                geur.appendChild(g);
            });
        }

        function verplaatsFocus(i) {
            if (document.activeElement !== bellen[i]) return;
            for (var k = 0; k < bellen.length; k++) {
                if (k !== i && S.bel[k].staat === 'thuis') { bellen[k].focus({ preventScroll: true }); return; }
            }
            ketel.focus({ preventScroll: true });
        }
        function zetBelWeg(i, weg) {
            bellen[i].classList.toggle('is-weg', weg);
            if (weg) { bellen[i].setAttribute('tabindex', '-1'); bellen[i].setAttribute('aria-hidden', 'true'); }
            else { bellen[i].setAttribute('tabindex', '0'); bellen[i].removeAttribute('aria-hidden'); }
        }

        function nogNiet(i) {
            c.melding('Eerst aan de kook: tik op de ketel.', 'info');
            if (i != null) schud(bellen[i]);
            speel('tak');
        }
        function terugNaarRank(i) {
            var b = S.bel[i];
            b.staat = 'terug';
            S.vlucht.push({ i: i, t: 0, duur: B.minderBeweging() ? 0 : 0.3, x0: b.x, y0: b.y, terug: true });
            wek();
        }
        function gooi(i) {
            var b = S.bel[i];
            if (S.kook !== 'aan') { b.staat = 'thuis'; zetBel(i, KT.thuis[i].x, KT.thuis[i].y); nogNiet(i); return; }
            var m = S.min;
            b.staat = 'vliegt';
            bellen[i].classList.add('is-vliegt');
            bellen[i].classList.remove('is-nu', 'is-sleept');
            verplaatsFocus(i);
            bellen[i].setAttribute('tabindex', '-1');
            merk(m);
            S.vlucht.push({
                i: i, m: m, t: 0, duur: B.minderBeweging() ? 0 : 0.62,
                x0: b.x, y0: b.y, cx: (b.x + KT.mangat.x) / 2, cy: Math.min(b.y, KT.mangat.y) - 84
            });
            c.opnieuwZichtbaar(true);
            speel('klik');
            wek();
        }
        function land(v) {
            var i = v.i, m = v.m;
            S.bel[i].staat = 'weg';
            bellen[i].classList.remove('is-vliegt');
            zetBelWeg(i, true);
            speel('plons');
            setTimeout(function () { speel('sis'); }, 140);
            spetter();
            tril(12);
            if (m >= 30) {
                S.vroeg += 1;
                kleurWort();
                geurWeg();
                if (!S.bitter) { S.bitter = true; c.melding('Bitterhop op tijd! Een uur koken maakt hem pas echt bitter.', 'goed'); }
                else c.melding('Nog meer bitter? Bewaar er één voor het eind.', 'info');
            } else if (m > 5) {
                S.vroeg += 0.5;
                kleurWort();
                geurWeg();
                if (S.bitter) c.melding('Te vroeg: de geur van de aromahop dampt de schoorsteen uit.', 'fout');
                else c.melding('Te laat: de bitterhop kookt te kort en blijft zwak.', 'fout');
            } else {
                geurBlijft();
                if (S.bitter && !S.aroma) {
                    S.aroma = true;
                    c.melding('Aromahop op het eind: de bloemige geur blijft in het bier.', 'goed');
                    bellen.forEach(function (el) { el.classList.remove('is-nu'); });
                    if (!S.gelukt) { S.gelukt = true; c.gelukt('Vroeg erin: bitter. Laat erin: aroma in je glas.'); }
                } else if (!S.bitter) {
                    c.melding('Lekker geurig, maar zonder bitterhop blijft het bier zoet.', 'fout');
                } else {
                    c.melding('Nog meer aromahop: nog meer bloemige geur!', 'goed');
                }
            }
        }

        function hopTerug(direct) {
            S.bel.forEach(function (b, i) {
                if (b.staat === 'weg' || direct) {
                    b.staat = 'thuis';
                    b.x = KT.thuis[i].x; b.y = KT.thuis[i].y;
                    zetBel(i, b.x, b.y);
                    zetBelWeg(i, false);
                    bellen[i].classList.remove('is-vliegt', 'is-sleept', 'is-nu');
                    if (!direct && !B.minderBeweging()) {
                        bellen[i].classList.remove('is-groei');
                        void bellen[i].getBoundingClientRect();
                        bellen[i].classList.add('is-groei');
                    }
                }
            });
        }

        function startKook() {
            if (S.kook === 'aan') { c.melding('Het kookt al: let op de klok.', 'info'); return; }
            if (S.vlucht.length) return;
            hopTerug(false);
            merken.textContent = '';
            geur.textContent = '';
            S.kook = 'aan';
            S.min = 60;
            S.bitter = S.aroma = false;
            S.vroeg = 0;
            S.groei = 0;
            kleurWort();
            svg.classList.add('is-kokend');
            svg.classList.remove('is-aroma');
            c.celKlasse('is-kokend', true);
            ketel.setAttribute('aria-label', 'De ketel kookt. Kijk op de kookklok.');
            c.melding('Het kookt! Gooi er meteen een hopbel in.', 'info');
            c.opdracht(KT.opdracht2);
            c.opnieuwZichtbaar(true);
            hint.el = bellen[0];
            hint.tekst = 'Tik op een hopbel';
            speel('borrel');
            tril(12);
            tekenKlok();
            wek();
        }
        function groenMoment() {
            svg.classList.add('is-aroma');
            if (S.aroma || !S.bitter || !belOver()) return;
            c.melding('Nu! De laatste vijf minuten: de aromahop.', 'info');
            S.bel.forEach(function (b, i) { if (b.staat === 'thuis') bellen[i].classList.add('is-nu'); });
            tril(12);
        }
        function eindeKook() {
            S.kook = 'klaar';
            svg.classList.remove('is-kokend', 'is-aroma');
            c.celKlasse('is-kokend', false);
            koken(false);
            bellen.forEach(function (el) { el.classList.remove('is-nu'); });
            ketel.setAttribute('aria-label', 'Breng de ketel opnieuw aan de kook');
            hint.el = ketel;
            hint.tekst = D.hulp.hopketel.hint;
            if (!S.aroma) {
                c.melding('Kook voorbij. Tik op de ketel voor nog een kook.', 'info');
                c.opdracht(KT.opdrachtNog);
            }
            S.groei = 0.8;   // daarna groeit de hop terug aan de rank
        }

        var lus = B.lus(function (dt) {
            // Vliegende en terugverende hopbellen.
            for (var k = S.vlucht.length - 1; k >= 0; k--) {
                var v = S.vlucht[k];
                v.t += dt;
                var u = v.duur ? Math.min(1, v.t / v.duur) : 1;
                if (v.terug) {
                    var e = 1 - Math.pow(1 - u, 3), h = KT.thuis[v.i], b = S.bel[v.i];
                    b.x = B.lerp(v.x0, h.x, e);
                    b.y = B.lerp(v.y0, h.y, e);
                    zetBel(v.i, b.x, b.y);
                    if (u >= 1) { b.staat = 'thuis'; S.vlucht.splice(k, 1); }
                } else {
                    var w = 1 - u;
                    var x = w * w * v.x0 + 2 * w * u * v.cx + u * u * KT.mangat.x;
                    var y = w * w * v.y0 + 2 * w * u * v.cy + u * u * KT.mangat.y;
                    zetBel(v.i, x, y, 300 * u, 1 - 0.55 * u);
                    if (u >= 1) { S.vlucht.splice(k, 1); land(v); }
                }
            }

            if (S.kook === 'aan') {
                var oud = S.min;
                S.min = Math.max(0, S.min - dt * (S.min > 5 ? 5 : 5 / 3));
                if (Math.floor(oud / 5) !== Math.floor(S.min / 5) && S.min > 0) speel('tik');
                if (oud > 30 && S.min <= 30 && !S.bitter) c.melding('Te laat voor bitterhop: die moet lang meekoken.', 'fout');
                if (oud > 12 && S.min <= 12 && S.bitter && !S.aroma && belOver()) c.melding('Bijna klaar… wacht op het groene stuk van de klok.', 'info');
                if (oud > 5 && S.min <= 5) groenMoment();
                tekenKlok();
                if (S.min <= 0 && !S.vlucht.length) eindeKook();
            }
            koken(S.kook === 'aan');

            if (S.groei > 0) {
                S.groei -= dt;
                if (S.groei <= 0) { S.groei = 0; hopTerug(false); }
            }
            if (S.kook !== 'aan' && !S.vlucht.length && !S.groei) lus.stop();
        }, houder);
        function wek() { if (S.open) lus.start(); }

        gebaar(ketel, svg, {
            tik: startKook,
            toets: function (e) {
                if (!isActivatie(e)) return false;
                startKook();
                return true;
            }
        });

        bellen.forEach(function (el, i) {
            gebaar(el, svg, {
                start: function (p) {
                    var b = S.bel[i];
                    if (b.staat !== 'thuis') return false;
                    b.staat = 'sleept';
                    b.p0 = p; b.sx = b.x; b.sy = b.y;
                    el.classList.add('is-sleept');
                },
                beweeg: function (p) {
                    var b = S.bel[i];
                    if (b.staat !== 'sleept') return;
                    b.x = B.klem(b.sx + p.x - b.p0.x, 30, 450);
                    b.y = B.klem(b.sy + p.y - b.p0.y, 40, 410);
                    zetBel(i, b.x, b.y);
                },
                los: function (p, v, afgebroken) {
                    var b = S.bel[i];
                    el.classList.remove('is-sleept');
                    if (b.staat !== 'sleept') return;
                    var opKetel = p.x > 212 && p.x < 388 && p.y > 60 && p.y < 396;
                    var dx = KT.mangat.x - b.x, dy = KT.mangat.y - b.y, afst = Math.hypot(dx, dy) || 1;
                    var snel = Math.hypot(v.x, v.y);
                    var richting = snel ? (v.x * dx + v.y * dy) / (snel * afst) : 0;
                    var zwiep = snel > 320 && richting > 0.5;
                    if (!afgebroken && (opKetel || zwiep) && S.kook === 'aan') { gooi(i); return; }
                    terugNaarRank(i);
                    if (afgebroken) return;
                    if (S.kook !== 'aan') nogNiet(null);
                    else c.melding('Mis! Tik de hopbel aan, of sleep hem in de ketel.', 'info');
                },
                tik: function () {
                    var b = S.bel[i];
                    el.classList.remove('is-sleept');
                    if (b.staat === 'sleept') b.staat = 'thuis';
                    if (b.staat !== 'thuis') return;
                    gooi(i);
                },
                toets: function (e) {
                    if (!isActivatie(e)) return false;
                    if (S.bel[i].staat === 'thuis') gooi(i);
                    return true;
                }
            });
        });

        kleurWort();
        tekenKlok();

        return {
            hint: hint,
            open: function () {
                S.open = true;
                if (S.kook === 'aan') c.celKlasse('is-kokend', true);
                wek();
            },
            dicht: function () {
                S.open = false;
                lus.stop();
                koken(false);
                c.celKlasse('is-kokend', false);
            },
            opnieuw: function () {
                var open = S.open;
                lus.stop();
                koken(false);
                S = nieuw(open);
                svg.classList.add('is-direct');
                hopTerug(true);
                merken.textContent = '';
                geur.textContent = '';
                spat.textContent = '';
                svg.classList.remove('is-kokend', 'is-aroma');
                c.celKlasse('is-kokend', false);
                kleurWort();
                tekenKlok();
                ketel.setAttribute('aria-label', KT.ketelLabel);
                hint.el = ketel;
                hint.tekst = D.hulp.hopketel.hint;
                c.melding('');
                c.opdracht(opdracht1);
                c.opnieuwZichtbaar(false);
                requestAnimationFrame(function () { requestAnimationFrame(function () { svg.classList.remove('is-direct'); }); });
            }
        };
    };

    /* ==================================================================
       STAP 6 · DE GIST-LOEP
       Sleep het vergrootglas (vrij) over de gisttank. Alleen zolang de
       loep op de tank ligt, loopt de tijd: dag 1 → 7 in ± 10 s. In de lens
       (canvas, geknipt op de lens, met dpr) eten gistcellen suiker, delen
       zich en laten CO₂-belletjes los; de alcohol loopt op tot ± 6,3 %.
       ================================================================== */
    D.hulp.gistloep = D.hulp.gistloep || {
        hint: 'Sleep het vergrootglas',
        wat: 'Sleep het vergrootglas over de gisttank. Zolang het erop ligt, tikken de dagen door. Kijk hoe de gist suiker eet, zich deelt en belletjes maakt.',
        waarom: 'Gist zet suiker om in alcohol en koolzuurgas. Daarbij maakt hij ook de fruitige en kruidige geuren die abdijbier zo typerend maken.'
    };

    var GT = {
        rust: { x: 372, y: 300 },      // het vergrootglas ligt rechtsonder
        midden: { x: 200, y: 236 },    // Enter of tik: op het midden van de tank
        R: 78,                         // straal van de lens (Ø 156)
        zoom: 1.5,                     // vergroting in de lens
        duur: 10,                      // s kijken voor 7 dagen
        min: { x: 94, y: 94 }, max: { x: 386, y: 315 },
        abv: 6.3,                      // zoals Abdijbier Rolduc Blond
        suiker: 110, gist: 14, maxGist: 36,
        opdracht2: 'Houd de loep op de tank tot dag 7.',
        status: 'Vergrootglas. Sleep het over de gisttank, of gebruik de pijltjes. Enter legt het op de tank.'
    };

    // Vergistingscurve: traag op gang, dan snel, dan uitlopend (0 → 1).
    var SIG0 = 1 / (1 + Math.exp(9 * 0.42)), SIG1 = 1 / (1 + Math.exp(-9 * 0.58));
    function vergist(t) { var s = 1 / (1 + Math.exp(-9 * (t - 0.42))); return B.klem((s - SIG0) / (SIG1 - SIG0), 0, 1); }
    function activiteit(t) { var s = 1 / (1 + Math.exp(-9 * (t - 0.42))); return s * (1 - s) * 4; }

    // Ligt het midden van de lens op de tank (ruim genomen)?
    function loepOpTank(x, y) {
        if (y < 116 || y > 352) return false;
        var half = y <= 300 ? 74 : 74 - (y - 300);
        return Math.abs(x - 200) < half;
    }
    // In het bier (de vloeistof van de tank), met marge m.
    function inBier(x, y, m) {
        m = m || 0;
        if (y < 156 + m || y > 350 - m) return false;
        var half = (y <= 300 ? 66 : 66 - (y - 300)) - m;
        return Math.abs(x - 200) < half;
    }

    function loepSvg() {
        var koelmantel = 'M128 176H272M128 182H272M128 262H272M128 268H272';
        var tik = '';
        for (var x = 134; x <= 266; x += 8) tik += 'M' + x + ' 100v10';
        return '' +
        '<svg class="bp-loep6__scene" viewBox="0 0 480 440" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
            // blow-off: slang naar het waterpotje
            '<path class="bp-loep6__slang" d="M166 56C138 28 82 34 66 74V322"/>' +
            '<path class="bp-v bp-l" d="M38 318H94L90 386Q90 394 82 394H50Q42 394 42 386Z"/>' +
            '<path class="bp-loep6__water" d="M42 342H90L88 386Q88 390 82 390H50Q44 390 44 386Z"/>' +
            '<g class="bp-loep6__blub"><circle cx="62" cy="380" r="3"/><circle style="animation-delay:-.5s" cx="70" cy="382" r="2.2"/><circle style="animation-delay:-1s" cx="58" cy="384" r="2.4"/></g>' +
            // de tank
            '<path class="bp-l" d="M138 290V420M262 290V420"/>' +
            '<path class="bp-lf" d="M128 420H148M252 420H272M138 392H262"/>' +
            '<path class="bp-v bp-l" d="M128 100C128 70 156 52 200 52C244 52 272 70 272 100Z"/>' +
            '<path class="bp-v bp-l" d="M128 100H272V300L216 356H184L128 300Z"/>' +
            '<path class="bp-loep6__bier" d="M134 150H266V298L214 350H186L134 298Z"/>' +
            '<path class="bp-loep6__krausen" data-krausen transform="translate(0 150) scale(1 0.02) translate(0 -150)" d="M134 150V136C142 128 152 136 160 129C168 122 178 132 188 126C198 120 208 130 218 124C228 118 238 130 248 125C256 121 262 128 266 130V150Z"/>' +
            '<path class="bp-loep6__depot" data-depot d="M188 350L200 338L212 350Z"/>' +
            '<path class="bp-lf bp-loep6__mantel" d="' + koelmantel + '"/>' +
            '<path class="bp-lf" d="M128 110H272"/>' +
            '<path class="bp-tik" d="' + tik + '"/>' +
            '<g class="bp-nagels"><circle cx="138" cy="118" r="1.9"/><circle cx="162" cy="118" r="1.9"/><circle cx="186" cy="118" r="1.9"/><circle cx="214" cy="118" r="1.9"/><circle cx="238" cy="118" r="1.9"/><circle cx="262" cy="118" r="1.9"/></g>' +
            '<rect class="bp-v bp-lf" x="192" y="356" width="16" height="10" rx="2"/>' +
            '<path class="bp-lf" d="M200 366V386"/>' +
            // koperen dagplaatje en het gegraveerde alcoholplaatje
            '<path class="bp-lf" d="M300 32H452M318 32V44M380 32V44M330 92V100M426 32V100"/>' +
            '<rect class="bp-loep6__koper" x="300" y="44" width="96" height="46" rx="6"/>' +
            '<text class="bp-loep6__dag" data-dag x="348" y="76">Dag 1</text>' +
            '<rect class="bp-loep6__plaat" x="300" y="100" width="152" height="66" rx="6"/>' +
            '<text class="bp-loep6__abv" data-abv x="376" y="134">0,0 %</text>' +
            '<text class="bp-loep6__abv-label" x="376" y="157">alcohol</text>' +
        '</svg>';
    }
    function glasSvg() {
        var R = GT.R, c60 = 0.5, s60 = 0.866;
        var rand = { x: f1(R * c60), y: f1(R * s60) }, eind = { x: f1((R + 48) * c60), y: f1((R + 48) * s60) };
        var greep = { x: f1((R + 12) * c60), y: f1((R + 12) * s60) };
        return '' +
        '<svg class="bp-loep6__boven" viewBox="0 0 480 440" preserveAspectRatio="xMidYMid meet">' +
            '<g class="bp-loep6__glas bp-dn2__knop" data-glas role="button" tabindex="0" data-eigen-toetsen aria-label="' + GT.status + '" transform="translate(' + GT.rust.x + ' ' + GT.rust.y + ')">' +
                '<g class="bp-loep6__wiebel">' +
                    '<circle class="bp-dn2__raak" r="' + (R + 6) + '"/>' +
                    '<path class="bp-dn2__raak bp-loep6__steelraak" d="M' + rand.x + ' ' + rand.y + 'L' + eind.x + ' ' + eind.y + '"/>' +
                    '<path class="bp-loep6__steel" d="M' + greep.x + ' ' + greep.y + 'L' + eind.x + ' ' + eind.y + '"/>' +
                    '<path class="bp-loep6__huls" d="M' + rand.x + ' ' + rand.y + 'L' + greep.x + ' ' + greep.y + '"/>' +
                    '<circle class="bp-loep6__lens" r="' + (R - 4) + '"/>' +
                    '<circle class="bp-loep6__rand" r="' + R + '"/>' +
                    '<circle class="bp-loep6__randlijn" r="' + (R - 5) + '"/>' +
                    '<path class="bp-loep6__glans" d="M-46 -40A62 62 0 0 1 8 -62"/>' +
                    '<circle class="bp-dn2__ring" r="' + (R + 12) + '"/>' +
                '</g>' +
            '</g>' +
        '</svg>';
    }

    I.gistloep = function (houder, ctx) {
        var c = praat(ctx);
        var opdracht1 = beginOpdracht(ctx, 'Sleep het vergrootglas over de gisttank.');
        houder.innerHTML = '<div class="bp-loep6 is-rust">' + loepSvg() +
            '<canvas class="bp-loep6__wereld" aria-hidden="true"></canvas>' + glasSvg() +
            '<span class="bp-dn2__sr" data-status aria-live="off"></span></div>';
        var root = houder.firstElementChild;
        var scene = root.querySelector('.bp-loep6__scene');
        var boven = root.querySelector('.bp-loep6__boven');
        var glas = root.querySelector('[data-glas]');
        var canvas = root.querySelector('canvas');
        var cx = canvas.getContext('2d');
        var dagEl = root.querySelector('[data-dag]');
        var abvEl = root.querySelector('[data-abv]');
        var krausen = root.querySelector('[data-krausen]');
        var depot = root.querySelector('[data-depot]');
        var status = root.querySelector('[data-status]');
        var statusId = B.uniekId('bp-loep6-status');
        status.id = statusId;
        glas.setAttribute('aria-describedby', statusId);
        var gisten = lusGeluid('gisten');
        var hint = { el: glas, tekst: D.hulp.gistloep.hint };

        var L = { x: GT.rust.x, y: GT.rust.y };
        var W = 0, H = 0, dpr = 1, sch = 0, ox = 0, oy = 0;
        var suiker = [], gist = [], bubbels = [], gegeten = 0;
        var S = nieuw(true);
        var rustTeken = 0;

        function nieuw(open) {
            return { t: 0, opTank: false, ooit: false, klaar: false, glijd: null, greep: null, open: open, stadium: -1, gelukt: false, dag: 0, abv: '', loopt: false };
        }

        /* ---- maat en dpr ---- */
        function maat() {
            var w = root.clientWidth, h = root.clientHeight;
            var d = Math.min(2, window.devicePixelRatio || 1);
            if (w === W && h === H && d === dpr) return;
            W = w; H = h; dpr = d;
            canvas.width = Math.max(1, Math.round(W * dpr));
            canvas.height = Math.max(1, Math.round(H * dpr));
            sch = W && H ? Math.min(W / VB_B, H / VB_H) : 0;
            ox = (W - VB_B * sch) / 2;
            oy = (H - VB_H * sch) / 2;
        }

        /* ---- de microwereld (viewBox-eenheden) ---- */
        function puntInBier(m) {
            for (var k = 0; k < 80; k++) {
                var x = 134 + Math.random() * 132, y = 156 + Math.random() * 194;
                if (inBier(x, y, m)) return { x: x, y: y };
            }
            return { x: 200, y: 240 };
        }
        function nieuweGist(x, y, groei) {
            return { x: x, y: y, vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16, hoek: Math.random() * 6.28, groei: groei, maag: 0, z: Math.random() };
        }
        function vers() {
            suiker = []; gist = []; bubbels = []; gegeten = 0;
            for (var i = 0; i < GT.suiker; i++) { var p = puntInBier(4); suiker.push({ x: p.x, y: p.y, w: Math.random() * 6 }); }
            for (var j = 0; j < GT.gist; j++) { var q = puntInBier(8); gist.push(nieuweGist(q.x, q.y, 1)); }
        }
        function eet(g, s) {
            suiker.splice(suiker.indexOf(s), 1);
            gegeten += 1;
            g.maag += 1;
            g.groei = Math.min(1.25, g.groei + 0.05);
            bubbels.push({ x: g.x, y: g.y - 4, r: 1.6 + Math.random() * 2, v: 18 + Math.random() * 16 });
            if (Math.random() < 0.6) bubbels.push({ x: g.x + 4, y: g.y, r: 1.2 + Math.random() * 1.4, v: 16 + Math.random() * 14 });
            if (g.maag >= 4 && gist.length < GT.maxGist) {
                g.maag = 0;
                gist.push(nieuweGist(g.x + 7, g.y + 4, 0.45));   // de gist deelt zich (knop)
            }
        }
        function eetDichtstbij() {
            var best = Infinity, bg = null, bs = null;
            for (var i = 0; i < gist.length; i++) {
                for (var j = 0; j < suiker.length; j++) {
                    var d = Math.abs(suiker[j].x - gist[i].x) + Math.abs(suiker[j].y - gist[i].y);
                    if (d < best) { best = d; bg = gist[i]; bs = suiker[j]; }
                }
            }
            if (bg) eet(bg, bs);
        }
        function beweeg(g, dt, max) {
            g.vx *= 0.96; g.vy *= 0.96;
            var sn = Math.hypot(g.vx, g.vy);
            if (sn > max) { g.vx = g.vx / sn * max; g.vy = g.vy / sn * max; }
            var nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
            if (inBier(nx, ny, 6)) { g.x = nx; g.y = ny; } else { g.vx *= -0.6; g.vy *= -0.6; }
        }
        function stap(dt, doel) {
            gist.forEach(function (g) {
                var kies = null, best = 70;
                if (gegeten < doel) {
                    for (var i = 0; i < suiker.length; i++) {
                        var d = Math.abs(suiker[i].x - g.x) + Math.abs(suiker[i].y - g.y);
                        if (d < best) { best = d; kies = suiker[i]; }
                    }
                }
                if (kies) {
                    var dx = kies.x - g.x, dy = kies.y - g.y, l = Math.hypot(dx, dy) || 1;
                    g.vx += dx / l * 60 * dt; g.vy += dy / l * 60 * dt;
                    if (l < 7) eet(g, kies);
                } else {
                    g.vx += (Math.random() - 0.5) * 30 * dt; g.vy += (Math.random() - 0.5) * 30 * dt;
                }
                beweeg(g, dt, 30);
                g.hoek += dt * 0.5;
                if (g.groei < 1) g.groei = Math.min(1, g.groei + dt * 0.15);
            });
            var n = 0;
            while (gegeten < doel - 2 && suiker.length && n++ < 4) eetDichtstbij();
            stapBellen(dt);
        }
        function stapSlaap(dt) {
            gist.forEach(function (g) {
                g.vx *= 0.9;
                g.vy = Math.min(g.vy + 8 * dt, 6);
                beweeg(g, dt, 6);
            });
            stapBellen(dt);
        }
        function stapBellen(dt) {
            bubbels.forEach(function (b) { b.y -= b.v * dt; b.x += Math.sin(b.y / 7) * 0.25; });
            bubbels = bubbels.filter(function (b) { return inBier(b.x, b.y, -2); });
        }

        function tankPad() {
            cx.beginPath();
            cx.moveTo(134, 150); cx.lineTo(266, 150); cx.lineTo(266, 298);
            cx.lineTo(214, 350); cx.lineTo(186, 350); cx.lineTo(134, 298);
            cx.closePath();
        }
        function teken() {
            cx.setTransform(1, 0, 0, 1, 0, 0);
            cx.clearRect(0, 0, canvas.width, canvas.height);
            if (!sch) return;
            if (L.x + GT.R < 128 || L.x - GT.R > 272 || L.y + GT.R < 140 || L.y - GT.R > 356) return;
            cx.setTransform(dpr * sch, 0, 0, dpr * sch, dpr * ox, dpr * oy);
            cx.save();
            cx.beginPath();
            cx.arc(L.x, L.y, GT.R - 5, 0, Math.PI * 2);
            cx.clip();
            cx.translate(L.x, L.y);
            cx.scale(GT.zoom, GT.zoom);
            cx.translate(-L.x, -L.y);
            tankPad();
            cx.clip();
            cx.fillStyle = 'rgba(244, 196, 98, .30)';
            cx.fillRect(120, 140, 160, 220);
            // suiker: kleine zeshoekjes
            cx.lineWidth = 0.8;
            suiker.forEach(function (p) {
                cx.beginPath();
                for (var k = 0; k < 6; k++) {
                    var a = k / 6 * Math.PI * 2 + p.w;
                    var px = p.x + Math.cos(a) * 3.6, py = p.y + Math.sin(a) * 3.6;
                    if (k === 0) cx.moveTo(px, py); else cx.lineTo(px, py);
                }
                cx.closePath();
                cx.fillStyle = '#F7E59D'; cx.fill();
                cx.strokeStyle = '#B98A2E'; cx.stroke();
            });
            // gistcellen (met knop als ze bijna delen)
            gist.forEach(function (g) {
                var rx = 8.5 * g.groei, ry = 6.6 * g.groei;
                cx.save();
                cx.translate(g.x, g.y);
                cx.rotate(g.hoek);
                cx.beginPath(); cx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
                cx.fillStyle = 'rgba(250, 244, 226, .94)'; cx.fill();
                cx.strokeStyle = '#7E6C42'; cx.lineWidth = 1; cx.stroke();
                cx.beginPath(); cx.ellipse(-rx * 0.15, 0, rx * 0.32, ry * 0.32, 0, 0, Math.PI * 2);
                cx.fillStyle = 'rgba(140, 122, 76, .5)'; cx.fill();
                if (g.maag >= 3) {
                    cx.beginPath(); cx.ellipse(rx * 0.95, -ry * 0.2, rx * 0.36, ry * 0.36, 0, 0, Math.PI * 2);
                    cx.fillStyle = 'rgba(250, 244, 226, .94)'; cx.fill(); cx.stroke();
                }
                cx.restore();
            });
            // CO₂-belletjes
            cx.strokeStyle = 'rgba(255, 255, 255, .9)';
            cx.lineWidth = 0.9;
            bubbels.forEach(function (b) { cx.beginPath(); cx.arc(b.x, b.y, b.r, 0, Math.PI * 2); cx.stroke(); });
            // dag 7: de gist wordt slaperig
            if (S.klaar) {
                cx.fillStyle = 'rgba(255, 248, 228, .9)';
                cx.font = '700 7px system-ui, sans-serif';
                gist.forEach(function (g, i) {
                    if (i % 3) return;
                    cx.fillText('z', g.x + 7, g.y - 7 - g.z * 3);
                    cx.fillText('z', g.x + 11, g.y - 12 - g.z * 3);
                });
            }
            cx.restore();
        }

        /* ---- tank, plaatjes, potje ---- */
        function borden() {
            var dag = S.t >= 1 ? 7 : Math.min(7, 1 + Math.floor(S.t * 6));
            var abv = B.getal(GT.abv * vergist(S.t), 1);
            if (dag !== S.dag || abv !== S.abv) {
                S.dag = dag; S.abv = abv;
                dagEl.textContent = 'Dag ' + dag;
                abvEl.textContent = abv + ' %';
                status.textContent = 'Dag ' + dag + ' van 7, ' + abv + ' % alcohol.';
            }
            var k = Math.min(1, vergist(S.t) * 2.2) * (1 - 0.55 * B.klem((S.t - 0.7) / 0.3, 0, 1));
            krausen.setAttribute('transform', 'translate(0 150) scale(1 ' + Math.max(0.02, k).toFixed(3) + ') translate(0 -150)');
            depot.style.opacity = B.klem((S.t - 0.55) / 0.45, 0, 1).toFixed(2);
        }

        function stadiumTekst(t) {
            if (t >= 0.55) return 'Zie je dat? De gist deelt zich en wordt steeds talrijker.';
            if (t >= 0.22) return 'Elke hap suiker wordt alcohol en een belletje koolzuur.';
            return 'De gist wordt wakker en stort zich op de suiker.';
        }
        function klaar() {
            S.klaar = true;
            root.classList.add('is-klaar');
            c.melding('Klaar! Bijna alle suiker is op. Tijd om te lageren.', 'goed');
            if (!S.gelukt) { S.gelukt = true; c.gelukt('Jongbier: ± 6,3 % alcohol en volop koolzuur.'); }
        }

        /* ---- het vergrootglas ---- */
        function zetLoep(x, y) {
            L.x = B.klem(x, GT.min.x, GT.max.x);
            L.y = B.klem(y, GT.min.y, GT.max.y);
            glas.setAttribute('transform', 'translate(' + f1(L.x) + ' ' + f1(L.y) + ')');
            var op = loepOpTank(L.x, L.y);
            if (op !== S.opTank) {
                S.opTank = op;
                if (op) {
                    root.classList.remove('is-rust');
                    if (!S.ooit) { S.ooit = true; c.opdracht(GT.opdracht2); c.opnieuwZichtbaar(true); }
                    if (!S.klaar) { tril(12); speel('blub'); }
                }
            }
            wek();
        }
        function naLos() {
            if (S.opTank || S.klaar) return;
            if (S.t > 0) c.melding('De tijd staat stil. Leg de loep op de tank.', 'info');
            else c.melding('Leg het vergrootglas óp de gisttank.', 'info');
        }
        function glijNaar(x, y) {
            root.classList.remove('is-rust');
            if (B.minderBeweging()) { zetLoep(x, y); naLos(); return; }
            S.glijd = { x0: L.x, y0: L.y, x1: x, y1: y, t: 0 };
            wek();
        }

        var lus = B.lus(function (dt) {
            if (!sch) maat();
            if (S.glijd) {
                var gl = S.glijd;
                gl.t = Math.min(1, gl.t + dt / 0.4);
                var e = 1 - Math.pow(1 - gl.t, 3);
                zetLoep(B.lerp(gl.x0, gl.x1, e), B.lerp(gl.y0, gl.y1, e));
                if (gl.t >= 1) { S.glijd = null; naLos(); }
            }
            var loopt = S.opTank && !S.klaar;
            if (loopt) {
                S.t = Math.min(1, S.t + dt / GT.duur);
                stap(dt, Math.round(GT.suiker * 0.96 * vergist(S.t)));
                c.melding(stadiumTekst(S.t), 'info');
                if (S.t >= 1) klaar();
            } else if (S.opTank) {
                stapSlaap(dt);
            }
            loopt = S.opTank && !S.klaar;
            if (loopt !== S.loopt) {
                S.loopt = loopt;
                c.celKlasse('is-gistend', loopt);
                root.classList.toggle('is-gistend', loopt);
            }
            root.classList.toggle('is-snel', loopt && activiteit(S.t) > 0.55);
            gisten(loopt);
            borden();
            // Bewegingsvoorkeur: de microwereld verspringt in rustige stapjes.
            rustTeken -= dt;
            if (!B.minderBeweging() || rustTeken <= 0) { rustTeken = 0.45; teken(); }
        }, houder);
        function wek() { if (S.open) lus.start(); }

        gebaar(glas, boven, {
            start: function (p) {
                S.glijd = null;
                S.greep = { dx: p.x - L.x, dy: p.y - L.y };
                root.classList.add('is-sleept');
                root.classList.remove('is-rust');
                wek();
            },
            beweeg: function (p) { zetLoep(p.x - S.greep.dx, p.y - S.greep.dy); },
            los: function () { root.classList.remove('is-sleept'); naLos(); },
            tik: function () {
                root.classList.remove('is-sleept');
                if (!S.opTank) glijNaar(GT.midden.x, GT.midden.y);
            },
            toets: function (e) {
                var d = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[e.key];
                if (d) {
                    root.classList.remove('is-rust');
                    S.glijd = null;
                    zetLoep(L.x + d[0], L.y + d[1]);
                    naLos();
                    return true;
                }
                if (isActivatie(e)) { glijNaar(GT.midden.x, GT.midden.y); return true; }
                return false;
            }
        });
        // Tik op de tank: het vergrootglas glijdt erheen.
        gebaar(scene, scene, {
            tik: function (p) {
                if (!p || !loepOpTank(p.x, p.y)) return;
                glijNaar(p.x, p.y);
            }
        });

        if ('ResizeObserver' in window) new ResizeObserver(function () { maat(); teken(); }).observe(root);
        vers();
        maat();
        borden();

        return {
            hint: hint,
            open: function () { S.open = true; wek(); },
            dicht: function () {
                S.open = false;
                lus.stop();
                gisten(false);
                S.loopt = false;
                c.celKlasse('is-gistend', false);
                root.classList.remove('is-gistend', 'is-snel');
            },
            opnieuw: function () {
                S = nieuw(S.open);
                vers();
                root.classList.remove('is-klaar', 'is-gistend', 'is-snel', 'is-sleept');
                root.classList.add('is-rust');
                c.celKlasse('is-gistend', false);
                gisten(false);
                zetLoep(GT.rust.x, GT.rust.y);
                S.opTank = false;
                borden();
                teken();
                hint.el = glas;
                c.melding('');
                c.opdracht(opdracht1);
                c.opnieuwZichtbaar(false);
            }
        };
    };
})();
