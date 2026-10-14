/* =====================================================================
   Brouwerij Rolduc — De Brouwreis: lagen boven de wereld

     1. Tip van de brouwer: elke [data-hulp] opent een korte uitleg
     2. Lade: brouwersgeheimen als kaartjes (elk kaartje past op het
        scherm, bladeren met knoppen of vegen) en de stappenkiezer
     3. Video-uitstapjes met lightbox. Bestaat het videobestand nog niet,
        dan toont de lightbox wat er komt.
   ===================================================================== */

(function () {
    'use strict';

    var B = window.Brouw;
    var D = window.BROUWPROCES || {};
    if (!B) return;
    var html = document.documentElement;

    function escape(t) {
        return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
    }
    function stapVan(el) {
        var cel = el.closest('[data-stap]');
        return cel ? +cel.getAttribute('data-stap') : null;
    }

    /* ==================================================================
       1. Tip van de brouwer
       ================================================================== */
    document.addEventListener('click', function (e) {
        var knop = e.target.closest('[data-hulp]');
        if (!knop) return;
        var sleutel = knop.getAttribute('data-hulp');
        B.tip.toon(knop, null, (D.hulp || {})[sleutel]);
    });

    /* ==================================================================
       2. Lade
       ================================================================== */
    var lade = document.getElementById('bp-lade');
    var ladePaneel = lade.querySelector('.bp-lade__paneel');
    var ladeInhoud = lade.querySelector('[data-lade-inhoud]');
    var ladeTitel = lade.querySelector('[data-lade-titel]');
    var ladeSoort = lade.querySelector('[data-lade-soort]');
    var videoModal = document.getElementById('bp-videomodal');
    var terugFocus = null;
    var open = null; // 'lade' | 'video' | null

    function openLade(o) {
        if (open) return;
        open = 'lade';
        terugFocus = document.activeElement;
        B.tip.sluit(false);
        ladeSoort.innerHTML = '<i class="fas ' + (o.icoon || 'fa-flask') + '" aria-hidden="true"></i> ' + escape(o.soort);
        ladeTitel.textContent = o.titel;
        ladeInhoud.textContent = '';
        ladeInhoud.appendChild(o.inhoud);
        ladePaneel.style.setProperty('--sleep', '0px');
        lade.setAttribute('data-soort', o.type || '');
        lade.classList.remove('is-sluitend');
        lade.hidden = false;
        B.vergrendel(true);
        B.geluid.werkKnoppenBij();
        B.geluid.speel('zoef');
        requestAnimationFrame(function () { ladePaneel.focus({ preventScroll: true }); });
    }

    function sluitLade(daarna) {
        if (open !== 'lade') return;
        open = null;
        B.vergrendel(false);
        lade.classList.add('is-sluitend');
        var weg = function () {
            lade.hidden = true;
            lade.classList.remove('is-sluitend');
            ladeInhoud.textContent = '';
            if (daarna) daarna();
        };
        if (B.minderBeweging()) weg(); else setTimeout(weg, 280);
        if (!daarna && terugFocus && terugFocus.focus && document.body.contains(terugFocus)) terugFocus.focus({ preventScroll: true });
    }

    lade.addEventListener('click', function (e) {
        if (e.target.closest('[data-lade-sluit]')) { sluitLade(); return; }
        var kies = e.target.closest('[data-kies]');
        if (kies) {
            e.preventDefault();
            e.stopPropagation();
            var doel = kies.getAttribute('data-kies');
            sluitLade(function () { if (B.scenes) B.scenes.ga(doel); });
        }
    });

    // Vegen om te sluiten (bottom sheet op de telefoon)
    var sleep = null;
    [lade.querySelector('[data-lade-greep]'), lade.querySelector('.bp-lade__kop')].forEach(function (greep) {
        greep.addEventListener('pointerdown', function (e) {
            if (window.innerWidth >= 768 || e.target.closest('button')) return;
            sleep = { y: e.clientY, t: performance.now(), d: 0 };
            lade.classList.add('is-sleept');
            try { greep.setPointerCapture(e.pointerId); } catch (x) { /* */ }
        });
        greep.addEventListener('pointermove', function (e) {
            if (!sleep) return;
            sleep.d = Math.max(0, e.clientY - sleep.y);
            ladePaneel.style.setProperty('--sleep', sleep.d + 'px');
        });
        function einde() {
            if (!sleep) return;
            var snelheid = sleep.d / Math.max(1, performance.now() - sleep.t);
            lade.classList.remove('is-sleept');
            if (sleep.d > 110 || (sleep.d > 30 && snelheid > 0.6)) sluitLade();
            else ladePaneel.style.setProperty('--sleep', '0px');
            sleep = null;
        }
        greep.addEventListener('pointerup', einde);
        greep.addEventListener('pointercancel', einde);
    });

    document.addEventListener('keydown', function (e) {
        if (!open) return;
        if (e.key === 'Escape') { e.preventDefault(); if (open === 'lade') sluitLade(); else sluitVideo(); return; }
        if (open === 'lade' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
            var kaartjes = ladeInhoud.querySelector('[data-kaartjes]');
            if (kaartjes && kaartjes._blader) { e.preventDefault(); kaartjes._blader(e.key === 'ArrowRight' ? 1 : -1); }
            return;
        }
        B.houdFocus(open === 'lade' ? lade : videoModal, e);
    });

    /* ---- Brouwersgeheim: kaartjes ---- */
    function geheimVan(n) {
        var g = D.geheimen && D.geheimen[n];
        if (g) return g;
        // Terugval: het oude <template id="geheim-N">.
        var t = document.getElementById('geheim-' + n);
        if (!t) return null;
        var h = t.content.querySelector('h3');
        return { titel: 'Brouwersgeheim', kaartjes: [{ titel: h ? h.textContent : 'Brouwersgeheim', tekst: t.content.textContent.trim().slice(0, 320) }] };
    }

    function maakKaartjes(g) {
        var n = g.kaartjes.length;
        var el = B.maak(
            '<div class="bp-kaartjes" data-kaartjes>' +
                '<div class="bp-kaartjes__rij">' +
                g.kaartjes.map(function (k, i) {
                    return '<article class="bp-kaartje" data-kaartje="' + i + '"' + (i ? ' hidden' : '') + '>' +
                        (n > 1 ? '<div class="bp-kaartje__nr">' + (i + 1) + ' / ' + n + '</div>' : '') +
                        '<h3 class="bp-kaartje__titel">' + escape(k.titel) + '</h3>' +
                        '<p class="bp-kaartje__tekst">' + escape(k.tekst) + '</p>' +
                        (k.staal ? '<ul class="bp-geheim__staal">' + k.staal.map(function (s) { return '<li><span style="--kleur:' + escape(s.kleur) + '"></span>' + escape(s.naam) + ' <em>' + escape(s.waarde) + '</em></li>'; }).join('') + '</ul>' : '') +
                    '</article>';
                }).join('') +
                '</div>' +
                (n > 1 ?
                '<div class="bp-kaartjes__nav">' +
                    '<button type="button" class="bp-kaartjes__knop" data-kaart-vorige aria-label="Vorig kaartje"><i class="fas fa-arrow-left" aria-hidden="true"></i></button>' +
                    '<span class="bp-kaartjes__punten" aria-hidden="true">' + g.kaartjes.map(function (k, i) { return '<i' + (i ? '' : ' class="is-hier"') + '></i>'; }).join('') + '</span>' +
                    '<button type="button" class="bp-knop bp-knop--goud bp-kaartjes__verder" data-kaart-volgende>Volgende <i class="fas fa-arrow-right" aria-hidden="true"></i></button>' +
                '</div>' : '') +
            '</div>');
        var huidig = 0;
        var kaarten = [].slice.call(el.querySelectorAll('[data-kaartje]'));
        var punten = [].slice.call(el.querySelectorAll('.bp-kaartjes__punten i'));
        var vorige = el.querySelector('[data-kaart-vorige]');
        var verder = el.querySelector('[data-kaart-volgende]');
        function zet(i) {
            huidig = B.klem(i, 0, n - 1);
            kaarten.forEach(function (k, j) { k.hidden = j !== huidig; });
            punten.forEach(function (p, j) { p.classList.toggle('is-hier', j === huidig); });
            if (vorige) vorige.disabled = huidig === 0;
            if (verder) {
                var laatste = huidig === n - 1;
                verder.innerHTML = laatste ? '<i class="fas fa-check" aria-hidden="true"></i> Klaar' : 'Volgende <i class="fas fa-arrow-right" aria-hidden="true"></i>';
                // Op het laatste kaartje sluit de knop de lade.
                verder.toggleAttribute('data-kaart-klaar', laatste);
                verder.toggleAttribute('data-kaart-volgende', !laatste);
            }
        }
        el._blader = function (r) { zet(huidig + r); B.geluid.speel('tik'); };
        el.addEventListener('click', function (e) {
            if (e.target.closest('[data-kaart-vorige]')) el._blader(-1);
            else if (e.target.closest('[data-kaart-klaar]')) sluitLade();
            else if (e.target.closest('[data-kaart-volgende]')) el._blader(1);
        });
        var x0 = null;
        el.addEventListener('pointerdown', function (e) { x0 = e.pointerType === 'mouse' ? null : e.clientX; });
        el.addEventListener('pointerup', function (e) {
            if (x0 == null) return;
            var dx = e.clientX - x0; x0 = null;
            if (Math.abs(dx) > 50) el._blader(dx < 0 ? 1 : -1);
        });
        zet(0);
        return el;
    }

    document.addEventListener('click', function (e) {
        var knop = e.target.closest('[data-geheim]');
        if (!knop) return;
        var n = +knop.getAttribute('data-geheim') || stapVan(knop);
        var g = geheimVan(n);
        if (!g) return;
        openLade({
            soort: 'Brouwersgeheim · stap ' + n,
            icoon: 'fa-flask',
            titel: g.titel,
            type: 'geheim',
            inhoud: maakKaartjes(g)
        });
    });

    /* ---- Stappenkiezer (HUD op de telefoon) ---- */
    function openKiezer() {
        var sjabloon = document.getElementById('bp-kiezer');
        if (!sjabloon) return;
        var inhoud = sjabloon.content.cloneNode(true);
        var hier = B.scenes ? B.scenes.huidig() : '';
        var nr = /^\d/.test(hier) ? parseInt(hier, 10) : (hier === 'spel' || hier === 'einde' ? 10 : 0);
        [].slice.call(inhoud.querySelectorAll('.bp-kiezer__raster [data-kies]')).forEach(function (a, i) {
            if (i + 1 < nr) a.classList.add('is-bereikt');
            if (i + 1 === nr) a.setAttribute('aria-current', 'step');
        });
        openLade({ soort: 'Ga naar', icoon: 'fa-route', titel: 'Kies een stap', type: 'kiezer', inhoud: inhoud });
    }
    var kiezerKnop = document.querySelector('[data-kiezer]');
    if (kiezerKnop) kiezerKnop.addEventListener('click', openKiezer);

    /* ==================================================================
       3. Video-uitstapjes
       ================================================================== */
    var videos = {};
    Object.keys(D.videos || {}).forEach(function (k) { var v = D.videos[k]; videos[v.stap] = v; });
    var beschikbaar = {};
    var videoBeeld = videoModal.querySelector('[data-video-beeld]');
    var huidigeVideo = null;
    var productie = /[?&]productie\b/.test(location.search);

    function mmss(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

    // Bestaat het bestand al? Dan krijgen de knoppen de echte duur.
    function controleer(n) {
        var v = videos[n];
        if (!v || beschikbaar[n] !== undefined) return;
        beschikbaar[n] = null;
        var proef = document.createElement('video');
        proef.preload = 'metadata';
        proef.muted = true;
        proef.addEventListener('loadedmetadata', function () {
            beschikbaar[n] = true;
            if (isFinite(proef.duration)) {
                var duur = mmss(proef.duration);
                document.querySelectorAll('[data-video="' + n + '"] [data-video-duur]').forEach(function (el) { el.textContent = duur; });
            }
            proef.removeAttribute('src');
            proef.load();
        });
        proef.addEventListener('error', function () { beschikbaar[n] = false; });
        proef.src = v.bestand;
    }
    // Niet vooraf controleren (dat kost mobiele data en geeft lege
    // verzoeken zolang de opnames er nog niet zijn): pas bij het openen.
    void controleer;

    function opnameKaart(v) {
        var specs = [['Bestand', '<code>' + escape(v.bestand) + '</code>'], ['Poster', '<code>' + escape(v.poster) + '</code>'], ['Duur', escape(v.duur)]]
            .concat((D.videoSpecs || []).map(function (r) { return [escape(r[0]), escape(r[1])]; }));
        return B.maak(
            '<div class="bp-opname">' +
                '<div class="bp-opname__preview" aria-hidden="true">' +
                    '<span class="bp-opname__film"><i class="fas fa-film"></i></span>' +
                    '<span class="bp-opname__stempel">Opname volgt</span>' +
                '</div>' +
                '<div class="bp-opname__info">' +
                    '<h3>Deze opname maken we binnenkort</h3>' +
                    '<p>' + escape(v.omschrijving || 'Straks kijk je hier mee in onze brouwzaal.') + '</p>' +
                    (productie ? '<p><strong>Shot:</strong> ' + escape(v.shot) + '</p>' : '') +
                    (productie ? '<dl class="bp-opname__specs">' + (v.tip ? '<dt>Regietip</dt><dd>' + escape(v.tip) + '</dd>' : '') + specs.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>' : '') +
                '</div>' +
            '</div>');
    }

    function speelAf(v) {
        var video = document.createElement('video');
        video.controls = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.preload = 'auto';
        if (v.poster) video.poster = v.poster;
        if (v.ondertitels) {
            var spoor = document.createElement('track');
            spoor.kind = 'captions'; spoor.srclang = 'nl'; spoor.label = 'Nederlands'; spoor.src = v.ondertitels;
            video.appendChild(spoor);
        }
        video.src = v.bestand;
        return video;
    }

    function openVideo(n) {
        if (open) return;
        var v = videos[n];
        if (!v) return;
        open = 'video';
        terugFocus = document.activeElement;
        B.tip.sluit(false);
        videoModal.querySelector('[data-video-titel]').textContent = v.titel;
        videoModal.querySelector('[data-video-teller]').textContent = 'Kijk mee in de brouwzaal · stap ' + v.stap;
        videoBeeld.textContent = '';
        videoModal.classList.remove('is-sluitend');
        videoModal.hidden = false;
        B.vergrendel(true);
        B.geluid.speel('zoef');

        if (beschikbaar[n] === false || !v.klaar) {
            videoBeeld.appendChild(opnameKaart(v));
        } else {
            var video = speelAf(v);
            huidigeVideo = video;
            var toon = function () {
                beschikbaar[n] = true;
                videoBeeld.textContent = '';
                videoBeeld.appendChild(video);
                var p = video.play();
                if (p && p.catch) p.catch(function () { /* autoplay geweigerd: de knoppen staan er */ });
            };
            video.addEventListener('error', function () {
                beschikbaar[n] = false;
                if (huidigeVideo !== video) return;
                huidigeVideo = null;
                videoBeeld.textContent = '';
                videoBeeld.appendChild(opnameKaart(v));
            });
            if (beschikbaar[n]) toon();
            else {
                videoBeeld.appendChild(opnameKaart(v));
                video.addEventListener('loadedmetadata', function () { if (huidigeVideo === video) toon(); });
                video.load();
            }
        }
        requestAnimationFrame(function () { videoModal.querySelector('.bp-videomodal__sluit').focus({ preventScroll: true }); });
    }

    function sluitVideo() {
        if (open !== 'video') return;
        open = null;
        if (huidigeVideo) { try { huidigeVideo.pause(); } catch (e) { /* */ } huidigeVideo.removeAttribute('src'); huidigeVideo.load(); huidigeVideo = null; }
        B.vergrendel(false);
        videoModal.classList.add('is-sluitend');
        setTimeout(function () {
            videoModal.hidden = true;
            videoModal.classList.remove('is-sluitend');
            videoBeeld.textContent = '';
        }, B.minderBeweging() ? 0 : 240);
        if (terugFocus && terugFocus.focus && document.body.contains(terugFocus)) terugFocus.focus({ preventScroll: true });
    }

    document.addEventListener('click', function (e) {
        var knop = e.target.closest('[data-video]');
        if (knop) { openVideo(+knop.getAttribute('data-video') || stapVan(knop)); return; }
        if (e.target.closest('[data-video-sluit]')) sluitVideo();
    });

    B.lagen = {
        openLade: openLade, sluitLade: sluitLade, sluitVideo: sluitVideo, openVideo: openVideo,
        open: function () { return open; }
    };
})();
