/* =====================================================================
   Brouwerij Rolduc — Het brouwproces: geluid

   Alle geluidjes worden live gemaakt met de Web Audio API: geen
   mp3-bestanden, niets om te laden. Standaard staat geluid UIT; elke knop
   met data-geluid-knop zet het aan of uit. De keuze wordt onthouden.

   Gebruik:
     Brouw.geluid.speel('borrel')          eenmalig geluidje
     var l = Brouw.geluid.lus('koken')     doorlopend geluid ...
     l.stop()                              ... en weer stoppen
   ===================================================================== */

(function () {
    'use strict';

    var B = window.Brouw = window.Brouw || {};
    var SLEUTEL = 'rolduc-brouwproces-geluid';

    var ctx = null, meester = null, ruis = null;
    var aan = !!B.opslag.lees(SLEUTEL, false);
    var lopend = [];

    function context() {
        if (!ctx) {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();
            meester = ctx.createGain();
            meester.gain.value = 0.55;
            var comp = ctx.createDynamicsCompressor();
            meester.connect(comp);
            comp.connect(ctx.destination);
            // Eén seconde witte ruis, hergebruikt voor sissen, schenken en stoom.
            ruis = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
            var d = ruis.getChannelData(0);
            for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function omhulling(gain, t, aanzet, piek, uitklink) {
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(piek, t + aanzet);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + aanzet + uitklink);
    }

    function toon(type, f1, f2, duur, piek, vertraging, bestemming) {
        var t = ctx.currentTime + (vertraging || 0);
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f1, t);
        if (f2 && f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + duur);
        omhulling(g, t, 0.006, piek, duur);
        o.connect(g); g.connect(bestemming || meester);
        o.start(t); o.stop(t + duur + 0.05);
    }

    function ruisstoot(filterType, freq, q, duur, piek, vertraging, freqEind) {
        var t = ctx.currentTime + (vertraging || 0);
        var bron = ctx.createBufferSource();
        bron.buffer = ruis;
        bron.loop = true;
        var f = ctx.createBiquadFilter();
        f.type = filterType; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1;
        if (freqEind) f.frequency.exponentialRampToValueAtTime(freqEind, t + duur);
        var g = ctx.createGain();
        omhulling(g, t, Math.min(0.02, duur / 4), piek, duur);
        bron.connect(f); f.connect(g); g.connect(meester);
        bron.start(t, Math.random() * 0.5); bron.stop(t + duur + 0.05);
    }

    var klanken = {
        klik: function () { toon('sine', 1250, 720, 0.07, 0.16); },
        tik: function () { toon('triangle', 2300, 2100, 0.03, 0.08); },
        tak: function () { toon('triangle', 1500, 1400, 0.04, 0.09); },
        borrel: function () {
            var f = 260 + Math.random() * 380;
            toon('sine', f, f * 2.4, 0.11, 0.14);
        },
        blub: function () { toon('sine', 160, 420, 0.13, 0.18); },
        plons: function () {
            ruisstoot('bandpass', 1100, 0.9, 0.35, 0.22, 0, 400);
            toon('sine', 150, 60, 0.18, 0.2);
            for (var i = 0; i < 4; i++) setTimeout(klanken.borrel, 80 + i * 70);
        },
        schep: function () {
            for (var i = 0; i < 16; i++) ruisstoot('bandpass', 2200 + Math.random() * 2600, 1.2, 0.025, 0.05 + Math.random() * 0.05, i * 0.022);
        },
        inschenken: function (o) {
            var duur = (o && o.duur) || 1.8;
            ruisstoot('bandpass', 420, 2.2, duur, 0.16, 0, 1700);
            for (var i = 0; i < 6; i++) setTimeout(klanken.borrel, 200 + Math.random() * duur * 900);
        },
        psst: function () {
            toon('sine', 220, 90, 0.07, 0.25);
            ruisstoot('highpass', 2600, 0.7, 0.7, 0.3, 0.01, 5200);
        },
        kurk: function () {
            toon('square', 2600, 2400, 0.03, 0.06);
            toon('square', 1800, 1700, 0.04, 0.05, 0.045);
            ruisstoot('highpass', 4200, 0.8, 0.05, 0.12);
        },
        sis: function () { ruisstoot('highpass', 4800, 0.7, 0.4, 0.12); },
        succes: function () {
            [659.25, 880, 1174.66].forEach(function (f, i) { toon('sine', f, f, 0.5, 0.13, i * 0.09); toon('triangle', f * 2, f * 2, 0.25, 0.03, i * 0.09); });
        },
        fout: function () { toon('sine', 290, 170, 0.32, 0.14); },
        fanfare: function () {
            [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) { toon('sine', f, f, 0.7, 0.12, i * 0.11); toon('triangle', f, f, 0.4, 0.04, i * 0.11); });
        },
        boe: function () {
            // Een tevreden koe bij de boer (bostel!)
            var t = ctx.currentTime;
            var o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
            o.type = 'sawtooth'; o.frequency.setValueAtTime(118, t); o.frequency.linearRampToValueAtTime(96, t + 1.1);
            f.type = 'lowpass'; f.frequency.setValueAtTime(480, t); f.frequency.linearRampToValueAtTime(900, t + 0.4); f.frequency.linearRampToValueAtTime(380, t + 1.1);
            lfo.frequency.value = 5.5; lg.gain.value = 3; lfo.connect(lg); lg.connect(o.frequency);
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
            o.connect(f); f.connect(g); g.connect(meester);
            o.start(t); lfo.start(t); o.stop(t + 1.25); lfo.stop(t + 1.25);
        },
        rinkel: function () {
            toon('sine', 2637, 2600, 0.5, 0.05); toon('sine', 3520, 3480, 0.4, 0.03, 0.02);
        },
        zoef: function () { ruisstoot('bandpass', 600, 1.4, 0.35, 0.12, 0, 2400); }
    };

    /* Doorlopende geluiden. Elk geeft een functie terug die alles stopt. */
    var lussen = {
        molen: function () {
            var t = ctx.currentTime;
            var bron = ctx.createBufferSource(); bron.buffer = ruis; bron.loop = true;
            var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
            var g = ctx.createGain(); g.gain.value = 0;
            var lfo = ctx.createOscillator(); lfo.frequency.value = 16;
            var diepte = ctx.createGain(); diepte.gain.value = 0.06;
            lfo.connect(diepte); diepte.connect(g.gain);
            var brom = ctx.createOscillator(); brom.type = 'triangle'; brom.frequency.value = 58;
            var bg = ctx.createGain(); bg.gain.value = 0.05;
            g.gain.setTargetAtTime(0.1, t, 0.05);
            bron.connect(f); f.connect(g); g.connect(meester);
            brom.connect(bg); bg.connect(meester);
            bron.start(); lfo.start(); brom.start();
            return function () {
                var n = ctx.currentTime;
                g.gain.cancelScheduledValues(n); g.gain.setTargetAtTime(0, n, 0.06);
                bg.gain.setTargetAtTime(0, n, 0.06);
                setTimeout(function () { try { bron.stop(); lfo.stop(); brom.stop(); } catch (e) { /* */ } }, 400);
            };
        },
        brander: function () {
            var t = ctx.currentTime;
            var bron = ctx.createBufferSource(); bron.buffer = ruis; bron.loop = true;
            var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 360;
            var g = ctx.createGain(); g.gain.value = 0;
            g.gain.setTargetAtTime(0.32, t, 0.08);
            bron.connect(f); f.connect(g); g.connect(meester);
            bron.start();
            return function () {
                g.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
                setTimeout(function () { try { bron.stop(); } catch (e) { /* */ } }, 500);
            };
        },
        koken: function () {
            var bron = ctx.createBufferSource(); bron.buffer = ruis; bron.loop = true;
            var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 280;
            var g = ctx.createGain(); g.gain.value = 0;
            g.gain.setTargetAtTime(0.12, ctx.currentTime, 0.2);
            bron.connect(f); f.connect(g); g.connect(meester);
            bron.start();
            var klok = setInterval(function () { if (Math.random() < 0.7) klanken.borrel(); }, 140);
            return function () {
                clearInterval(klok);
                g.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
                setTimeout(function () { try { bron.stop(); } catch (e) { /* */ } }, 700);
            };
        },
        gisten: function () {
            var klok = setInterval(function () { if (Math.random() < 0.5) klanken.blub(); }, 650);
            return function () { clearInterval(klok); };
        },
        vullen: function () {
            var t = ctx.currentTime;
            var bron = ctx.createBufferSource(); bron.buffer = ruis; bron.loop = true;
            var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.4;
            f.frequency.setValueAtTime(380, t); f.frequency.setTargetAtTime(1900, t, 1.4);
            var g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.18, t, 0.05);
            bron.connect(f); f.connect(g); g.connect(meester);
            bron.start();
            return function () {
                g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
                setTimeout(function () { try { bron.stop(); } catch (e) { /* */ } }, 300);
            };
        }
    };

    var LEEG = { stop: function () { } };

    B.geluid = {
        aan: function () { return aan; },
        speel: function (naam, opties) {
            if (!aan || !klanken[naam]) return;
            if (!context()) return;
            try { klanken[naam](opties); } catch (e) { /* geluid mag nooit iets breken */ }
        },
        lus: function (naam) {
            if (!aan || !lussen[naam] || !context()) return LEEG;
            var stopper;
            try { stopper = lussen[naam](); } catch (e) { return LEEG; }
            var item = {
                stop: function () {
                    if (!stopper) return;
                    var s = stopper; stopper = null;
                    lopend = lopend.filter(function (x) { return x !== item; });
                    try { s(); } catch (e) { /* */ }
                }
            };
            lopend.push(item);
            return item;
        },
        zet: function (waarde) {
            aan = !!waarde;
            B.opslag.schrijf(SLEUTEL, aan);
            if (aan) { context(); klanken.klik(); }
            else lopend.slice().forEach(function (l) { l.stop(); });
            werkKnoppenBij();
            B.melding(aan ? 'Geluid staat aan' : 'Geluid staat uit');
        }
    };

    function werkKnoppenBij() {
        document.querySelectorAll('[data-geluid-knop]').forEach(function (knop) {
            knop.setAttribute('aria-pressed', aan ? 'true' : 'false');
            if (knop.hasAttribute('aria-label')) knop.setAttribute('aria-label', aan ? 'Geluid uitzetten' : 'Geluid aanzetten');
            var icoon = knop.querySelector('i');
            if (icoon) icoon.className = 'fas ' + (aan ? 'fa-volume-high' : 'fa-volume-xmark');
            var label = knop.querySelector('[data-geluid-label]');
            if (label) label.textContent = aan ? 'Geluid staat aan' : 'Geluid staat uit';
        });
    }
    B.geluid.werkKnoppenBij = werkKnoppenBij;

    document.addEventListener('click', function (e) {
        var knop = e.target.closest('[data-geluid-knop]');
        if (!knop) return;
        B.geluid.zet(!aan);
    });

    // iOS en Safari laten geluid pas toe na een aanraking. Stond geluid bij
    // een vorig bezoek al aan, dan ontgrendelen we het bij de eerste tik.
    function ontgrendel() {
        if (aan) context();
        document.removeEventListener('pointerdown', ontgrendel, true);
        document.removeEventListener('keydown', ontgrendel, true);
    }
    document.addEventListener('pointerdown', ontgrendel, true);
    document.addEventListener('keydown', ontgrendel, true);

    werkKnoppenBij();
})();
