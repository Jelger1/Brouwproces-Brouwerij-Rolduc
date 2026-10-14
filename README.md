# Brouwerij Rolduc — De Brouwreis (interactieve web-app)

> Een reis door de brouwzaal van **Brouwerij Rolduc** in 9 stappen, gebouwd op de
> brouwproces-infographic. Voor de iPad in het proeflokaal (kiosk), voor gasten die met hun
> telefoon een QR-code op een viltje of etiket scannen, en voor bezoekers op een laptop.
> Elk scherm past precies in beeld: je hoeft nooit te scrollen of uit te zoomen.

---

## Inhoud

1. [Openen en testen](#1-openen-en-testen)
2. [Proeflokaal-modus (iPad) en QR-codes](#2-proeflokaal-modus-ipad-en-qr-codes)
3. [Zo werkt de app](#3-zo-werkt-de-app)
4. [Bestanden](#4-bestanden)
5. [Wat wijzig je waar?](#5-wat-wijzig-je-waar)
6. [Online zetten](#6-online-zetten)
7. [De Brouwmeester-game: het rekenmodel](#7-de-brouwmeester-game-het-rekenmodel)
8. [Vormgeving](#8-vormgeving)
9. [Schermen, toegankelijkheid en techniek](#9-schermen-toegankelijkheid-en-techniek)
10. [Getest](#10-getest)
11. [Nog te controleren](#11-nog-te-controleren)
12. [Pitch-video's](#12-pitch-videos)

---

## 1. Openen en testen

Open `brouwproces.html` in een browser. Er is geen build-stap. Testen op een iPad of telefoon
in hetzelfde wifi-netwerk:

```bash
python -m http.server 8080
# op de pc:              http://localhost:8080/brouwproces.html
# op de iPad/telefoon:   http://<ip-van-de-pc>:8080/brouwproces.html
```

Handige links:

| Link | Gaat naar |
|---|---|
| `brouwproces.html#stap-5` | Stap 5, het verhaal |
| `brouwproces.html#stap-5-doen` | Stap 5, zelf doen |
| `brouwproces.html#brouwmeester` | De Brouwmeester-game |
| `brouwproces.html#einde` | Proost! |

Met een `#` sla je het startscherm over, tenzij de leeftijd de afgelopen 24 uur nog niet is
bevestigd (dan komt eerst het startscherm, daarna ga je naar de gevraagde stap).

---

## 2. Proeflokaal-modus (iPad) en QR-codes

### Proeflokaal (kiosk)

Open één keer **`brouwproces.html?modus=proeflokaal`**. De iPad onthoudt dat. Terug naar
normaal: `brouwproces.html?modus=web`.

In de proeflokaal-modus:

- verwijst niets naar de website of webshop; bij de bieren staat *"Vraag aan de bar"*;
- komt de uitleg ("Hoe werkt deze reis?") bij elke nieuwe gast;
- verschijnt na **2,5 minuut** zonder aanraking *"Ben je er nog?"* met een aftelling van
  20 seconden, daarna begint automatisch een nieuwe brouwronde;
- staan tekst selecteren en lang-drukmenu's uit.

Tips: zet de pagina via *Deel → Zet op beginscherm* als app (schermvullend), gebruik
**Begeleide toegang** (Instellingen → Toegankelijkheid) en zet de automatische
schermvergrendeling uit of op een paar minuten.

### QR-codes op viltjes en etiketten

| Drager | Link in de QR-code |
|---|---|
| Viltje (algemeen) | `brouwerij-rolduc.nl/brouwproces.html` |
| Etiket per bier | `…/brouwproces.html?bier=tripel` (of `blond`, `dubbel`) |
| Viltje per stap (verzamelreeks) | `…/brouwproces.html#stap-6` |

Met `?bier=` proost het startscherm alvast met dat bier ("Je proost met een Rolduc Tripel"),
staat het in de game voorop en op het einde vooraan. Zet **nooit** `?modus=proeflokaal` in
een QR-code (dan gaat een telefoon zich als kiosk gedragen). Een korte link zoals
`brouwerij-rolduc.nl/brouwreis` met een doorverwijzing scant beter op een klein viltje.
Druk de QR minimaal 2 × 2 cm, donker op licht.

Op een telefoon is er geen automatische reset, en de uitleg komt alleen de eerste keer.

---

## 3. Zo werkt de app

De brouwzaal is één grote kaart, net als de poster. Elk scherm is één plek op die kaart; de
**camera reist langs de S-curve** van de poster: 1 → 2 → 3 naar rechts, 4 (met het bostel)
rechts omlaag, 5 → 6 terug naar links, 7 links omlaag, 8 → 9 naar rechts, en dan de finale.
Een **gouden leiding** loopt onder het plafond van ketel naar ketel en stroomt tijdens elke
reis mee; hopbladeren waaien voorbij.

| Onderdeel | Wat het doet |
|---|---|
| **Startscherm** | Logo, vallende hopbellen, *Start de Brouwreis*. Door te starten bevestigt de gast 18+ te zijn (zelfde sleutel als de hoofdsite: `ageVerificationDate`, 24 uur). Op de telefoon staat de startknop onderin, binnen bereik van de duim. |
| **Uitleg** | Drie geanimeerde kaartjes: *Volg de gouden leiding*, *Eerst kijken, dan doen*, *Hulp nodig? Tik op ?*. Altijd terug te halen via **ⓘ** in de HUD (telefoon: via de routekaart). |
| **HUD** | Logo (= *Nieuwe brouwronde?*), de **routeknop** met een mini-kaartje van de S-curve en *Stap 3 van 9 · Maischen · Lezen/Doen* (tik = de routekaart om naar elke stap te springen), **ⓘ** uitleg en geluid. Op de telefoon staat erboven een verhalenbalk van 10 segmenten (half = gezien, vol = zelf gedaan). |
| **Scène A: kijken en lezen** | De ketel van die stap, groot en levend, met de leiding die erin valt, en een verhaalkaart: *STAP 3 — MAISCHEN*, de kop, een samenvatting en het verhaal. Ketel en kaart wisselen speels van kant langs de S-curve. Tik op de gloeiende ketel = zelf doen. |
| **Scène B: zelf doen** | Een close-up van de ketel waarop je zelf iets doet, met een kraft hangkaartje (opdracht + directe feedback) en knoppen voor 🎬 video, ⚗ brouwersgeheim en ↺ opnieuw. Op de telefoon schuift dit als *bottom sheet* omhoog terwijl de ketel erboven blijft meeleven. |
| **Dock** | Altijd op dezelfde plek: ← terug · de gouden hoofdknop (*Probeer het zelf* / *Volgende stap*) · 🎬 · **?** (tip van de brouwer). Op de telefoon in twee rijen onderin, binnen bereik van de duim. |
| **Brouwersgeheim** | Twee of drie kaartjes per stap om doorheen te bladeren (nooit scrollen). |
| **Hints** | Doe je 3 seconden niets, dan pulseert de belangrijkste knop of hotspot goud met een handje. |
| **De finale** | De Brouwmeester-game: hier draai je echt aan de knoppen, met score (zie §7). |
| **Einde** | *Proost!*, de drie abdijbieren (het bier dat je brouwde vooraan, met gouden rand), de zaterdagrondleiding en *Nieuwe brouwronde*. |

**De 9 proefjes in scène B**

| Stap | Wat je doet |
|---|---|
| 1 Mout | Houd het rooster vast: de mout kleurt van pils- via karamel- naar chocolademout en het proefglas kleurt mee |
| 2 Schroten | Draai aan het slingerwiel tot de korrel open is en het kafje heel blijft |
| 3 Maischen | Sleep het kwik naar 62 °C en 72 °C; in de patrijspoort knippen twee schaartjes de zetmeelketen |
| 4 Filtratie | Trek de kraan open (eerst troebel, dan helder wort) en stuur het bostel-karretje naar de boer |
| 5 Koken | Breng de ketel aan de kook en gooi hopbellen van de rank erin: bitterhop vroeg, aromahop laat |
| 6 Vergisten | Sleep het vergrootglas over de gisttank en zie de gist suiker eten |
| 7 Lageren | Tik vier keer op de scheurkalender: het bier wordt helder en de jonge smaakjes verdwijnen |
| 8 Bottelen | Sleep de zon over helder, groen en bruin glas: alleen de bruine fles blijft fris |
| 9 Hergisten | Wacht op de prik in de warme kamer en open dan de fles: psst, inschenken in het kelkglas |

**Navigeren:** met de dock, de pijltjestoetsen (→ ↓ = verder, ← ↑ = terug), het muiswiel of
trackpad (één gebaar = één stap) en vegen. Op een tablet: vegen naar links of omhoog = verder.
Op de telefoon: horizontaal vegen = naar het vorige of volgende station, omhoog vegen = zelf
doen, de sheet omlaag slepen = terug naar het verhaal.

**Nieuwe brouwronde** laadt de pagina schoon opnieuw: alle proefjes, de game en het geheugen
gaan terug naar nul en het startscherm staat klaar.

---

## 4. Bestanden

```
brouwproces-rolduc/
├── brouwproces.html                   De app: teksten, illustraties, schermen
├── css/
│   ├── brouwproces.css                Basis: tokens, knoppen, illustraties, lagen, startscherm
│   ├── brouwproces-wereld.css         De wereld: camera, scènes A en B, HUD, dock, telefoon
│   ├── brouwproces-doen-1.css         Proefjes stap 1–3
│   ├── brouwproces-doen-2.css         Proefjes stap 4–6
│   ├── brouwproces-doen-3.css         Proefjes stap 7–9
│   └── brouwproces-spel.css           De Brouwmeester-game
├── js/
│   ├── brouwproces-data.js            ★ Teksten om aan te passen: tips, brouwersgeheimen, video's, recepten
│   ├── brouwproces-kern.js            Rekenen, bierkleur, touch-componenten, tips, meldingen
│   ├── brouwproces-geluid.js          Geluid via de Web Audio API (geen mp3's)
│   ├── brouwproces-doen-1.js          Proefjes stap 1–3 (rooster, molen, maisch)
│   ├── brouwproces-doen-2.js          Proefjes stap 4–6 (filter, hopketel, gistloep)
│   ├── brouwproces-doen-3.js          Proefjes stap 7–9 (kalender, zonnebril, warme kamer)
│   ├── brouwproces-scenes.js          Camera, scènes, invoer, gouden leiding, HUD, dock, hints
│   ├── brouwproces-lagen.js           Tip van de brouwer, brouwersgeheim, routekaart, video
│   ├── brouwproces-spel.js            De Brouwmeester-game
│   └── brouwproces-app.js             Startscherm, uitleg, nieuwe ronde, proeflokaal-modus
├── assets/                            Font, logo, flesfoto's (uit de hoofdsite), de infographic
├── video/LEESMIJ.md                   Shotlijst voor het productieteam; hier komen de mp4's
├── pitch-videos/                      Twee pitch-video's (1920×1080) voor de eigenaar, zie §12
└── scripts/
    ├── genereer-hopdecor.mjs          Tekent de gegraveerde hopbellen en -bladeren
    ├── kopieer-gedeelde-bestanden.mjs Haalt font, logo, favicons en foto's uit de hoofdsite
    ├── record-pitch-videos.mjs        Neemt de pitch-video's op (Playwright + FFmpeg)
    └── pitch-geluid.js                Muziek en geluidseffecten voor de pitch-video's
```

De app is zelfstandig: geen CSS of JavaScript van de hoofdsite, alleen het lettertype, het
logo, de favicons en drie flesfoto's.

---

## 5. Wat wijzig je waar?

| Wat | Waar |
|---|---|
| Verhaal, samenvatting, kop of korte telefoontekst van een stap | `brouwproces.html`, zoek op `bp-verhaalkaart__verhaal`, `__sam`, `__kop`, `__kort` |
| Opdracht en titel van een proefje (scène B) | `brouwproces.html`, `bp-hangkaart__titel` / `__opdracht` |
| **Tip van de brouwer** (de ?-knop) en het zinnetje bij het handje | `js/brouwproces-data.js` → `hulp` |
| **Brouwersgeheimen** (kaartjes) | `js/brouwproces-data.js` → `geheimen` (± 55 woorden per kaartje) |
| Video's | `js/brouwproces-data.js` → `videos`. Zet de mp4 in `video/` en zet `klaar: true`; zie `video/LEESMIJ.md` |
| Recepten, proefnotities, rangen van de game | `js/brouwproces-data.js` |
| Meldingen tijdens een proefje | `js/brouwproces-doen-1/2/3.js` (bovenaan per proefje) |
| Teksten van uitleg, startscherm, einde | `brouwproces.html` |
| Hoe lang voordat het proeflokaal opnieuw begint | `js/brouwproces-app.js` → `STIL_SECONDEN` (150) en `AFTEL` (20) |
| Kleuren en maten | `css/brouwproces.css` en `css/brouwproces-wereld.css` → `:root` |

**Let op de lengte:** elk scherm moet passen. Houd een samenvatting op max. 2 zinnen
(± 28 woorden), het verhaal rond 60–90 woorden, de korte telefoontekst op max. 45 woorden en
een opdracht op max. 10 woorden. Past een kaart toch niet, dan maakt de app hem eerst
compacter en meldt hij `[past niet]` in de console.

Na een wijziging in CSS of JS: verhoog `?v=…` achter de bestanden in `brouwproces.html`,
zodat iPads en browsers de nieuwe versie ophalen.

---

## 6. Online zetten

Zet `brouwproces.html`, de map `css/` (zes bestanden), de map `js/` (tien bestanden),
`assets/brouwproces/` en `video/` in de hoofdmap van de website. De gedeelde bestanden (font,
logo, favicons, `assets/klein/`) staan daar al. Niet uploaden: `scripts/`, `README.md`,
`brouwproces.jpeg`, en vooral **niet `index.html` en `.nojekyll`**: die zijn alleen voor de
demo op GitHub Pages, en `index.html` zou de homepage van de hoofdsite overschrijven.

De app linkt zelf naar `index.html#proeflokaal`, `webshop.html`, `product.html?id=…` en de
privacy- en cookiepagina (alleen in de webmodus). Vanuit de website: `<a href="brouwproces.html">De Brouwreis</a>`.

**Demo op GitHub Pages:** <https://jelger1.github.io/Brouwproces-Brouwerij-Rolduc/>. Daar
stuurt `index.html` je door naar `brouwproces.html` (met `?modus=…`, `?bier=…` en `#stap-…`
erbij), en wijzen de links naar webshop, producten en privacy vanzelf naar
`https://www.brouwerij-rolduc.nl/`. Elke push naar `main` staat binnen een paar minuten online.

---

## 7. De Brouwmeester-game: het rekenmodel

| Fase | Wat je doet | Wat het bepaalt |
|---|---|---|
| **1a Mout storten** | Zakken ingedrukt houden (pils, karamel, chocolade) | Kleur via de formule van Morey (EBC), hoeveelheid mout → alcohol |
| **1b Schroten** | De molen versnelt; *Stop!* in het groene vak | Rendement; poeder = verstopt filterbed |
| **2 Maischen** | Brander aan/uit; 62–65 °C, daarna 70–72 °C | Vergistbaarheid (alcohol), body en schuim |
| **3 Hop** | Bitterhop bij de start, aromahop in de laatste 5 minuten | Bitterheid (Tinseth, IBU) en aroma |
| **4a Gist** | Gist erbij tussen 18 en 24 °C | Gezonde gisting |
| **4b Bottelsuiker** | Drukmeter in het groene vak | Pareling en schuimkraag; te veel = spuiter |
| **4c Aftappen** | Vasthouden tot de vullijn, kroonkurk erop | Zuurstof in de hals |

Brouwmeester-score = 70% gemiddelde fasescore + 30% hoe dicht kleur, bitterheid en alcohol
bij het recept liggen. Het glas krijgt de echte berekende kleur. Zet je telefoon even weg of
wissel je van app, dan pauzeert het spel.

---

## 8. Vormgeving

- **Kleuren:** diep donkergroen `#12261A` / `#183022`, goud `#D4AF37` / `#E8D595`, crème
  lijnwerk en ovalen `#F7E59D` (uit de infographic). Per station een eigen lichttint
  (amber in de maischzaal, vuurgloed bij het koken, koud blauw in de lagerkelder …).
- **Typografie:** MATURASC voor titels; het systeemfont voor tekst. Lopende tekst minstens
  16 px, labels minstens 14 px.
- **Illustraties:** inline SVG in de lijnstijl van de infographic; gewelfbogen van de abdij op
  de achtergrond, hopranken en voorbijwaaiende hopbladeren in de voorgrond.
- **Iconen:** Font Awesome 6 (laadt niet-blokkerend).

---

## 9. Schermen, toegankelijkheid en techniek

| Scherm | Indeling |
|---|---|
| Telefoon (< 768 px) | Ketel boven, verhaalkaart eronder, duimzone onderin; zelf doen als bottom sheet |
| iPad staand (≥ 768 px, staand) | Ketel boven, kaart eronder; scène B met close-up onder het hangkaartje |
| iPad liggend, laptop, desktop | Ketel en kaart naast elkaar (wisselend links/rechts); scène B: hangkaartje · close-up · knoppen |
| Telefoon liggend | Compacte variant |

- Eén scherm = één scène: de pagina scrolt nooit. Schermhoogte komt uit `window.innerHeight`
  (ook met de adresbalk van Safari).
- Tikdoelen minstens 44 × 44 px. Slepen, draaien, vasthouden en tikken werken met vinger,
  muis en toetsenbord; elke hotspot heeft een label voor schermlezers.
- Lagen (startscherm, uitleg, tips, lade, video, dialogen) houden de focus vast, sluiten met
  Escape en zetten de rest tijdelijk op `inert`.
- `prefers-reduced-motion`: geen camerareis maar een korte overgang, geen parallax en geen
  sfeeranimaties. Geluid staat standaard uit.
- HTML + CSS + vanilla JavaScript, geen frameworks of build-stap; werkt ook via `file://`.
- Geen cookies of tracking. In de browser bewaard (functioneel): leeftijdsbevestiging,
  geluidskeuze, of je de uitleg al zag, beste game-score, modus, links-/rechtshandig.

---

## 10. Getest

Automatisch in Chrome (Playwright) met de viewport-keuring `viewport.mjs`: per scène, per
tip, video en brouwersgeheim en per spelscherm wordt gecontroleerd dat alles binnen
`innerWidth × innerHeight` valt, niets wordt afgeknipt, nergens een scrollbalk zit, niets
onder HUD of dock valt, tekst groot genoeg is en tikdoelen groot genoeg zijn. Op
**390×844** (telefoon), **768×1024** en **1024×768** (iPad), **1280×720**, **1366×768** en
**1440×900** (laptop). Uitslag: zie §10.1.

Verder doorgespeeld met echte klikken, toetsen, muiswiel en touch-gebaren: de hele reis van
startscherm tot *Nieuwe brouwronde*, alle 9 proefjes (muis, touch en toetsenbord), de game
met alle drie de recepten (goed: 97–99 %, slecht: 7–23 %), de proeflokaal-modus met
automatische nieuwe ronde, en `?bier=tripel#stap-6`.

### 10.1 Laatste keuring (14 oktober 2026)

| Wat | Maten | Uitslag |
|---|---|---|
| Alle 23 scènes + elke tip, video, brouwersgeheim (alle kaartjes) en de uitleg + alle 9 spelschermen | 390×844, 768×1024, 1024×768, 1280×720, 1366×768, 1440×900 | **0 fouten, 0 waarschuwingen** in 575 keuringen |
| Idem, extra maten | 1024×690 (iPad met adresbalk), 1366×657, 375×667, 360×740, 844×390 en 667×375 (telefoon liggend) | **0 fouten** in 574 keuringen; alleen op 667×375 waarschuwingen voor tekst van 14–15 px (zie §10.2) |
| Tekst die bedekt wordt (aparte meting) | telefoon 390×844, 375×667, 360×740, 390×664 | geen overlap |
| De hele reis met echte klikken | 1280×720, 1024×768, 390×844 | intro → 1a → 1b → … → 9b → spel → einde → nieuwe ronde, zonder fouten; één wielgebaar = één stap; pijltjestoetsen |
| Gebaren op de telefoon | 390×844 | vegen links/rechts = station, omhoog = zelf doen, greep omlaag (ook traag) = terug, tik op de ketel, dubbeltik = één stap, systeem-terugknop sluit de sheet |
| Proeflokaal-modus | 1024×768 | *"Ben je er nog?"* → automatisch nieuwe ronde, modus blijft aan |
| Alle 9 proefjes | 343×343 t/m 781×716 (podiummaten), muis, touch, toetsenbord, minder beweging | allemaal geslaagd |
| De game | 10 maten, Blond/Dubbel/Tripel, goed en slecht gespeeld | geen fouten |

Meetscripts: `viewport.mjs` (keuring per scène), aangevuld met aparte metingen van
overlap, de leiding, SVG-tekst en echte navigatie.

### 10.2 Bekende kanttekeningen

- Op zeer kleine schermen (telefoon liggend, 375 px breed) is tekst soms 14–15 px in plaats
  van 16 px: daar past het anders niet.

**Nog niet getest op een echte iPad en iPhone in Safari.** Doe dat vóór gebruik in het
proeflokaal en vóór het drukken van QR-codes.

---

## 11. Nog te controleren

1. **Intro:** de hoofdsite zegt dat Rolduc sinds 2013 brouwt; de oorspronkelijke zin
   "Al eeuwenlang wordt er binnen de muren van Abdij Rolduc gebrouwen" is daarom aangepast
   naar "Binnen de eeuwenoude muren van Abdij Rolduc brouwen wij sinds 2013 ons abdijbier."
   Kun je aantonen dat er vroeger in de abdij gebrouwen werd, dan kan de oude zin terug.
2. **Niet te controleren op de hoofdsite** (uit de klanttekst, graag bevestigen): bostel naar
   lokale boeren, de "geheime kruidenmix" bij sommige bieren, de warme kamer (± 2 weken), en
   of alle bieren op fles hergisten.
3. **Streefkleuren (EBC)** in de game zijn schattingen; de Dubbel (60 EBC) is aan de donkere
   kant. Zoek op `CONTROLEREN` in `js/brouwproces-data.js`.
4. **Video's**: nog op te nemen, zie `video/LEESMIJ.md`.
5. **Leeftijdsbevestiging** via de startknop in plaats van een ja/nee-pop-up: laat dit
   eventueel juridisch toetsen.

---

## 12. Pitch-video's

In `pitch-videos/` staan twee liggende video's (1920×1080, H.264, 30 fps, AAC-stereo) om de
app aan de eigenaar te laten zien, of op YouTube te zetten:

| Bestand | Duur | Inhoud |
|---|---|---|
| `01-Rolduc-Storytelling-Pitch.mp4` | 2:17 | Titel, startscherm en uitleg, de reis op de iPad (tip, routekaart, maischen 62/72 °C, filmknop, bostel bij stap 4, stap 5–9), dan iPad, telefoon met bierviltje-QR en laptop, en de doorverwijzing naar de game |
| `02-Rolduc-Brouwmeester-Game-Tripel.mp4` | 2:25 | Een Tripel brouwen: recept kiezen, alle vier fases (met de ?-tip), inschenken in de kelk, score en proefnotitie, de echte bieren |

Alles is opgenomen in de échte app: een gouden cursor glijdt naar elke knop en tikt erop
(echte aanrakingen), een ondertitelbalk vertelt wat je ziet. De soundtrack is zelf
gegenereerd en dus rechtenvrij: een rustige, opgewekte muziekbedding plus de geluiden van de
app zelf (molen, brander, schenken, kroonkurk, de koe bij de boer) op het moment dat ze in
beeld klinken, en zachte whooshes en tikjes bij overgangen.

**Opnieuw opnemen** (bijvoorbeeld na een tekstwijziging), ± 4 minuten per video:

```bash
npm i -D playwright-core            # eenmalig; gebruikt de geïnstalleerde Google Chrome
node scripts/record-pitch-videos.mjs          # beide video's
node scripts/record-pitch-videos.mjs 2        # alleen video 2
node scripts/record-pitch-videos.mjs --zonder-geluid
```

Nodig: Google Chrome en FFmpeg met libx264 in het PATH. Het script controleert na afloop
lengte, resolutie en codec, en meldt het als een video buiten 1,5–2,5 minuut valt. Regie,
ondertitels en wachttijden staan leesbaar in `scripts/record-pitch-videos.mjs` (functies
`video1` en `video2`); muziek en effecten in `scripts/pitch-geluid.js`.

In de video's toont de filmknop het kaartje "Opname volgt", omdat de echte brouwzaalvideo's
nog niet zijn opgenomen (zie `video/LEESMIJ.md`). Na het opnemen daarvan en `klaar: true` in
`js/brouwproces-data.js` toont een nieuwe opname daar de echte video (het geluid van die
video zelf komt niet mee in de soundtrack).
