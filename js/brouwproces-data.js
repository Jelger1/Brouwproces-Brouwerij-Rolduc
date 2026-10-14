/* =====================================================================
   Brouwerij Rolduc — Het brouwproces: inhoud en instellingen

   DIT IS DE PLEK VOOR WAT JE WILT AANPASSEN ZONDER IN DE CODE TE DUIKEN:
     - videos     de vijf video-uitstapjes (titel, duur, bestandsnaam,
                  shotomschrijving voor het productieteam)
     - recepten   de drie bieren in de Brouwmeester-game en hun streefwaarden
     - notities   wat de hoofdbrouwer zegt in de proefnotitie

   De verhaalteksten van de 9 stappen staan gewoon in brouwproces.html,
   zodat ze zonder JavaScript leesbaar zijn en door Google gevonden worden.

   Waarom .js en geen .json? Zie js/producten.js: een JSON-bestand moet
   met fetch() worden opgehaald en dat werkt niet als je de pagina lokaal
   opent (file://). Een gewoon script werkt overal.

   ---------------------------------------------------------------------
   CONTROLEREN
   ---------------------------------------------------------------------
   Regels met  // CONTROLEREN  zijn aannames die de brouwer moet
   bevestigen. ABV en IBU komen uit js/producten.js; de kleuren (EBC)
   zijn schattingen voor de bierstijl.
   ===================================================================== */

(function () {
    'use strict';

    window.BROUWPROCES = {

        /* ================================================================
           VIDEO-UITSTAPJES
           Zet het videobestand op de genoemde plek en zet 'klaar' op true:
           dan speelt de knop de video af. Zolang 'klaar' false is, toont de
           lightbox dat de opname binnenkort komt (zonder het bestand op te
           vragen). Zie ook video/LEESMIJ.md.
           ================================================================ */
        videos: {
            1: {
                stap: 2,
                klaar: false,               // true zodra het videobestand er staat
                omschrijving: 'Mout glijdt de molen in en komt er gebroken uit: kafjes heel, meelkern open.',   // wat de gast ziet zolang de opname er nog niet is
                titel: 'De schrootmolen in actie',
                duur: '0:25',
                bestand: 'video/stap-2-schroten.mp4',
                poster: 'video/stap-2-schroten.jpg',
                ondertitels: null,          // ondertitels? zet hier 'video/stap-2-schroten.vtt'
                shot: 'Close-up van de brouwer die een zak mout in de schrootmolen stort en het grof gebroken schroot controleert in zijn hand.',
                tip: 'Begin op de korrels die in de trechter glijden, eindig op de open hand met het schroot: kafjes heel, meelkern zichtbaar.'
            },
            2: {
                stap: 3,
                klaar: false,               // true zodra het videobestand er staat
                omschrijving: 'Stoom, warm beslag en een draaiend roerwerk: zo ziet maischen eruit.',   // wat de gast ziet zolang de opname er nog niet is
                titel: 'Het beslag ontwaakt',
                duur: '0:30',
                bestand: 'video/stap-3-maischen.mp4',
                poster: 'video/stap-3-maischen.jpg',
                ondertitels: null,          // ondertitels? zet hier 'video/stap-3-maischen.vtt'
                shot: 'Dampende maischketel die geopend wordt, waarbij je het roerwerk door het warme beslag ziet draaien.',
                tip: 'Laat de stoom het eerste beeld vullen en wegtrekken. Een detail van de thermometer (62 °C) maakt de koppeling met de tekst.'
            },
            3: {
                stap: 5,
                klaar: false,               // true zodra het videobestand er staat
                omschrijving: 'Kolkend wort, en dan gaat de hop erin.',   // wat de gast ziet zolang de opname er nog niet is
                titel: 'Hop in de kokende ketel',
                duur: '0:30',
                bestand: 'video/stap-5-koken.mp4',
                poster: 'video/stap-5-koken.jpg',
                ondertitels: null,          // ondertitels? zet hier 'video/stap-5-koken.vtt'
                shot: 'Kolkend wort in de ketel en het moment waarop een flinke schep geurige hopbellen/pellets in de kokende massa wordt gegooid.',
                tip: 'Slow motion (50/60 fps) van het moment dat de hop het wort raakt werkt prachtig.'
            },
            4: {
                stap: 8,
                klaar: false,               // true zodra het videobestand er staat
                omschrijving: 'Vullen tot in de hals, en direct de kroonkurk erop.',   // wat de gast ziet zolang de opname er nog niet is
                titel: 'Flesje voor flesje',
                duur: '0:35',
                bestand: 'video/stap-8-bottelen.mp4',
                poster: 'video/stap-8-bottelen.jpg',
                ondertitels: null,          // ondertitels? zet hier 'video/stap-8-bottelen.vtt'
                shot: 'Ritmische shots van het bottelen: rinkelende flesjes, schuim dat precies tot de rand komt en de kroonkurk die erop gaat.',
                tip: 'Monteer op het ritme van de machine; het originele geluid van rinkelend glas is hier de muziek.'
            },
            5: {
                stap: 9,
                klaar: false,               // true zodra het videobestand er staat
                omschrijving: 'Een flesje open, rustig inschenken en kijken naar die schuimkraag.',   // wat de gast ziet zolang de opname er nog niet is
                titel: 'Psst! Proost op Rolduc',
                duur: '0:40',
                bestand: 'video/stap-9-hergisten.mp4',
                poster: 'video/stap-9-hergisten.jpg',
                ondertitels: null,          // ondertitels? zet hier 'video/stap-9-hergisten.vtt'
                shot: 'Het openen van een flesje Rolduc (psst!) en het langzaam inschenken in een origineel Rolduc-kelkglas met een prachtige schuimkraag.',
                tip: 'Gouden uur, abdijmuur op de achtergrond. Houd het geluid van de "psst" er duidelijk in. Geen herkenbare personen onder de 25 in beeld (Reclamecode Alcohol).'
            }
        },

        /* Technische eisen voor alle video's (getoond aan het productieteam). */
        videoSpecs: [
            ['Formaat', 'MP4 (H.264 + AAC), 1920 × 1080, 25 of 30 fps'],
            ['Grootte', 'liefst onder 15 MB per video'],
            ['Posterbeeld', 'JPG, 1600 × 900, zelfde naam als de video'],
            ['Ondertitels', 'optioneel: WebVTT (.vtt), zelfde naam als de video']
        ],

        /* ================================================================
           DE ROLDUC BROUWMEESTER — recepten
           ebc     streefkleur (EBC)                     // CONTROLEREN
           ibu     streefbitterheid (uit producten.js)
           abv     streefalcohol in % (uit producten.js)
           moutKg  hoeveel mout (kg) voor een brouwsel van 100 liter
           mengsel richtwaarde per moutsoort (kg), alleen voor de uitleg
           maisch  seconden in de bèta-rust (62–65 °C) en alfa-rust (70–73 °C)
           suiker  schepjes bottelsuiker voor de juiste pareling
           ================================================================ */
        recepten: {
            blond: {
                id: 'blond',
                naam: 'Abdijbier Rolduc Blond',
                kort: 'Blond',
                stijl: 'Blond',
                stijlLang: 'Belgian Blond',
                omschrijving: 'Licht abdijbier met zoethout, aangenaam smaakvol.',
                ebc: 12,          // CONTROLEREN
                ibu: 22,
                abv: 6.3,
                moutKg: 22,
                mengsel: { pils: 20.6, karamel: 1.4, chocolade: 0 },
                maisch: { beta: 11, alfa: 8 },
                suiker: 3,
                productId: 'rolduc-blond',
                afbeelding: 'assets/klein/rolduc-blond-640.webp'
            },
            dubbel: {
                id: 'dubbel',
                naam: 'Abdijbier Rolduc Dubbel',
                kort: 'Dubbel',
                stijl: 'Dubbel',
                stijlLang: 'Belgian Dubbel',
                omschrijving: 'Vol en afgerond, met tonen van koffie en pure chocolade.',
                ebc: 60,          // CONTROLEREN
                ibu: 25,
                abv: 7.0,
                moutKg: 24,
                mengsel: { pils: 18.7, karamel: 3, chocolade: 2.3 },
                maisch: { beta: 8, alfa: 11 },
                suiker: 3,
                productId: 'rolduc-dubbel',
                afbeelding: 'assets/klein/rolduc-dubbel-640.webp'
            },
            tripel: {
                id: 'tripel',
                naam: 'Abdijbier Rolduc Tripel',
                kort: 'Tripel',
                stijl: 'Tripel',
                stijlLang: 'Belgian Tripel',
                omschrijving: 'Fruitige tonen en een licht bittere, uitgebalanceerde afdronk.',
                ebc: 11,          // CONTROLEREN
                ibu: 28,
                abv: 9.0,
                moutKg: 31,
                mengsel: { pils: 30.4, karamel: 0.6, chocolade: 0 },
                maisch: { beta: 13, alfa: 6 },
                suiker: 4,
                productId: 'rolduc-tripel',
                afbeelding: 'assets/klein/rolduc-tripel-640.webp'
            }
        },

        /* Moutsoorten in de Mout-Menger en de game. kleur in EBC, snelheid
           in kg per seconde als je de stortknop ingedrukt houdt. */
        mout: {
            pils: { naam: 'Pilsmout', kleur: 3.5, snelheid: 4.2, staal: '#F2DC9A' },
            karamel: { naam: 'Karamelmout', kleur: 120, snelheid: 1.1, staal: '#C2701F' },
            chocolade: { naam: 'Chocolademout', kleur: 900, snelheid: .45, staal: '#2B1206' }
        },

        /* Rangen bij de Brouwmeester-score. */
        rangen: [
            { vanaf: 90, titel: 'Brouwmeester van Rolduc' },
            { vanaf: 80, titel: 'Meesterbrouwer' },
            { vanaf: 65, titel: 'Brouwer' },
            { vanaf: 45, titel: 'Gezel' },
            { vanaf: 0, titel: 'Leerling-brouwer' }
        ],

        /* ================================================================
           PROEFNOTITIES VAN DE HOOFDBROUWER
           {stijl} wordt vervangen door de bierstijl (Blond, Dubbel, Tripel).
           'kort' wordt gebruikt in zinnen als "<pijnpunt>, maar <compliment>!"
           ================================================================ */
        notities: {
            opening: {
                90: ['Chapeau! Dit had zó uit onze eigen ketels kunnen komen.', 'Ik proef, ik proef nog eens… en ik ben even stil. Meesterlijk.'],
                75: ['Mooi werk, collega-brouwer!', 'Hier zou ik op zaterdag zelf een glas van bestellen.'],
                55: ['Niet slecht voor een eerste brouwsel!', 'Er zit karakter in, al vraagt het nog wat schaafwerk.'],
                35: ['Hmm, een… avontuurlijk bier.', 'Eerlijk is eerlijk: dit glas vraagt om een tweede poging.'],
                0: ['Oei. Hier zouden de monniken een schietgebedje voor doen.', 'Deze gaat de gootsteen in, maar je hebt er wél veel van geleerd!']
            },
            pijn: {
                teDonker: { kort: 'Oei, iets te diep in de chocolademout gegraaid', lang: 'Je hebt iets te diep in de chocolademoutzak gegraaid: dit is eerder een nachtzwart bier dan een {stijl}.' },
                teLicht: { kort: 'De kleur is wat bleekjes', lang: 'De kleur is aan de bleke kant voor een {stijl}: een schepje karamelmout had gemogen.' },
                teWeinigMout: { kort: 'Er ging wat weinig mout in de ketel', lang: 'Er ging wat weinig mout in de ketel: het bier mist kracht en body.' },
                teVeelMout: { kort: 'Dat was een flinke schep extra mout', lang: 'Dat was een flinke schep extra mout: zwaar en zoet, maar niet helemaal een {stijl}.' },
                teGrof: { kort: 'Je schroot was nog te grof', lang: 'Je schroot was nog te grof: veel suiker bleef opgesloten in de korrel.' },
                poeder: { kort: 'Oei, iets te lang geschroot', lang: 'Oei, iets te lang geschroot: je filterbed zat potdicht en we verloren kostbaar wort.' },
                teHeet: { kort: 'De maischketel werd te heet', lang: 'De maischketel werd te heet: de enzymen gaven er halverwege de brui aan.' },
                teKoud: { kort: 'Je maischte te koud', lang: 'Je maischte te koud: de enzymen hebben vooral liggen slapen.' },
                bitterTeLaat: { kort: 'Je bitterhop kwam te laat', lang: 'Je bitterhop kwam te laat: het bier mist ruggengraat.' },
                geenBitter: { kort: 'De bitterhop is vergeten', lang: 'Waar is de bitterhop gebleven? Zoet, zoet, zoet…' },
                aromaTeVroeg: { kort: 'Je aromahop ging er te vroeg in', lang: 'Je aromahop ging er te vroeg in: al die bloemige geuren zijn de schoorsteen uit.' },
                geenAroma: { kort: 'De aromahop ontbreekt', lang: 'Zonder aromahop ruikt het glas wat vlak.' },
                gistTeHeet: { kort: 'De gist kreeg een hittegolf over zich heen', lang: 'De gist kreeg een hittegolf over zich heen: ik proef een vleugje oplosmiddel.' },
                gistTeKoud: { kort: 'De gist had het koud', lang: 'De gist had het koud en kwam maar traag op gang.' },
                teVeelSuiker: { kort: 'Psssst… whoosh: te veel bottelsuiker', lang: 'Psssst… whoosh! Met zoveel bottelsuiker spuit het bier de fles uit.' },
                teWeinigSuiker: { kort: 'Er zit weinig prik in', lang: 'Er zit weinig prik in: de schuimkraag is maar bescheiden.' },
                vulling: { kort: 'Je fles was niet netjes gevuld', lang: 'Je fles was niet netjes gevuld: lucht in de hals is de vijand van bier.' }
            },
            lof: {
                mout: { kort: 'je moutmengsel was precies raak', lang: 'Je moutmengsel was precies raak: de goede kleur.' },
                maisch: { kort: 'je hield die maischketel strak als een metronoom', lang: 'Je hield die maischketel strak als een metronoom.' },
                hop: { kort: 'je hop-timing was meesterlijk', lang: 'Je hop-timing was meesterlijk!' },
                gist: { kort: 'je gist en bottelwerk waren vakwerk', lang: 'Gist erbij op precies het goede moment, en netjes afgevuld: vakwerk.' }
            },
            slot: {
                hoog: ['Een karaktervolle {stijl}!', 'Een {stijl} om trots op te zijn.'],
                midden: ['Een {stijl} met belofte.', 'Met nog een poging wordt dit een echte {stijl}.'],
                laag: ['Een {stijl}… in wording.', 'Kom eens proeven hoe wij hem maken.']
            }
        },

        /* ================================================================
           BROUWERSGEHEIMEN (de kolf-knop bij elke stap, in scène B)
           Twee of drie kaartjes per stap; elk kaartje past op één scherm,
           dus houd ze kort (± 55 woorden).
           ================================================================ */
        geheimen: {
            1: {
                titel: 'Kiemen & eesten',
                kaartjes: [
                    { titel: 'Van gerst tot mout', tekst: 'In de mouterij ligt de gerst ± 2 dagen in het water, tot de korrel zo\'n 45% vocht bevat. Dan kiemt hij ± 5 dagen en maakt hij zijn eigen gereedschap aan: enzymen. Tot slot droogt de mouter het \'groenmout\' ± 1 dag in de eest.' },
                    { titel: 'Waarom donkere mout nooit alleen kan', tekst: 'Pilsmout wordt zacht gedroogd, rond 80–85 °C, zodat de enzymen heel blijven. Karamel- en chocolademout worden veel heter behandeld: ze krijgen kleur en smaak, maar hun enzymen zijn kapot. Daarom bestaat zelfs een donker bier grotendeels uit lichte mout.' },
                    { titel: 'De kleur van mout', tekst: 'Brouwers meten kleur in EBC: hoe hoger, hoe donkerder. Pilsmout 3–4 EBC, karamelmout 50–150 EBC, chocolademout 800–1.000 EBC. Het bruin en het broodaroma komen van de Maillardreactie, dezelfde reactie die een korstje op vers brood geeft.' }
                ]
            },
            2: {
                titel: 'De perfecte spleet',
                kaartjes: [
                    { titel: 'De walsspleet bepaalt alles', tekst: 'Een schrootmolen heeft stalen walsen die tegen elkaar in draaien. Te ruim (± 1,8 mm): korrels glippen heel door. Precies goed (± 1,0–1,3 mm): de korrel breekt open en het kafje blijft heel. Te krap (< 0,6 mm): het kaf verpulvert en het filterbed loopt vast.' },
                    { titel: 'Een trucje van de brouwer', tekst: 'Veel brouwers bevochtigen de mout vlak voor het schroten heel even. Het kafje wordt dan soepel als leer in plaats van broos als papier, en blijft daardoor mooi heel.' },
                    { titel: 'Er gaat niets verloren', tekst: 'Met goed schroot haal je zo\'n driekwart of meer van alle suikers uit de mout. Wat achterblijft, gaat met het bostel mee naar de boer.' }
                ]
            },
            3: {
                titel: 'Twee microscopische scharen',
                kaartjes: [
                    { titel: 'Bèta-amylase · 62–65 °C', tekst: 'Zetmeel is een lange ketting van suikerkraaltjes. Bèta-amylase knipt geduldig steeds twee kraaltjes van het uiteinde: maltose. Perfect gistvoer, dus straks alcohol. Boven de 65 °C raakt dit enzym snel uitgeput.' },
                    { titel: 'Alfa-amylase · 70–72 °C', tekst: 'Knipt lukraak midden in de ketting. Snel, maar hij laat vertakte brokjes achter die gist niet lust. Die geven body en een zachte zoetheid. Lang rusten bij 62 °C geeft een droog bier zoals een tripel, meer tijd bij 72 °C een vol bier zoals een dubbel.' },
                    { titel: 'Afmaischen en de jodiumtest', tekst: 'Tot slot gaat het beslag naar 78 °C: de enzymen stoppen en het beslag wordt dunner, wat de filtratie helpt. Klaar? Een druppel jodium op wat beslag vertelt het: blauwzwart betekent nog zetmeel, geelbruin betekent alles omgezet.' }
                ]
            },
            4: {
                titel: 'Rondpompen & spoelen',
                kaartjes: [
                    { titel: 'Eerst troebel, dan helder', tekst: 'De eerste liters uit de filterkuip zijn nog troebel: er spoelen losse deeltjes mee. Die pompt de brouwer terug over het filterbed, tot het wort helder loopt. Brouwers noemen dat rondpompen.' },
                    { titel: 'Uitspoelen met heet water', tekst: 'In het filterbed zit nog volop suiker. Daarom sproeit de brouwer er heet water van zo\'n 78 °C overheen: overspoelen. Niet heter en niet te lang, anders lossen er wrange looistoffen uit de kafjes op.' },
                    { titel: 'Bostel: van restje naar krachtvoer', tekst: 'Per hectoliter bier blijft er ruwweg 20 kilo nat bostel over, rijk aan eiwit en vezels. Bij Brouwerij Rolduc gaat het naar boeren uit de buurt, als voer voor hun vee. Zo komt het graan van het land weer terug op het land.' }
                ]
            },
            5: {
                titel: 'Waarom een vol uur koken?',
                kaartjes: [
                    { titel: 'Bitter heeft tijd nodig', tekst: 'Hop bevat alfazuren. Die zijn van zichzelf nauwelijks bitter en lossen slecht op. Pas door lang koken veranderen ze in iso-alfazuren: bitter én oplosbaar. Zelfs na een uur is maar een kwart tot een derde omgezet. Daarom gaat de bitterhop er meteen aan het begin in.' },
                    { titel: 'Aroma is vluchtig', tekst: 'De bloemige, citrusachtige of kruidige geur van hop zit in etherische oliën. Die verdampen snel tijdens het koken. Daarom gaat aromahop er pas aan het eind in, of zelfs koud tijdens het lageren: dryhoppen.' },
                    { titel: 'Bitterheid in cijfers', tekst: 'Bitterheid meten brouwers in IBU: ruwweg milligram bitterstof per liter bier. Abdijbier Rolduc Blond heeft 22 IBU, de Dubbel 25 en de Tripel 28. De hoppige Kloeëster IPA komt op 45 IBU.' }
                ]
            },
            6: {
                titel: 'Het feestmaal in formule',
                kaartjes: [
                    { titel: 'Suiker wordt alcohol en koolzuur', tekst: 'Wat gist doet, past in één regel scheikunde: C₆H₁₂O₆ → 2 C₂H₅OH + 2 CO₂. Eén suikermolecuul wordt twee moleculen alcohol en twee moleculen koolzuurgas. De gist werkt zo hard dat de tank er warm van wordt: de brouwer koelt hem met een koelmantel.' },
                    { titel: 'Bovengist en zijn geurtjes', tekst: 'Voor abdijbier gebruiken brouwers bovengist, Saccharomyces cerevisiae. Die werkt graag bij zo\'n 18 tot 24 °C. Naast alcohol maakt hij honderden geurstofjes: esters ruiken naar fruit zoals peer en banaan, fenolen naar kruiden zoals kruidnagel. Hoe warmer de vergisting, hoe fruitiger.' },
                    { titel: 'Waarom razendsnel afkoelen?', tekst: 'Lauw wort is een feestmaal voor elke bacterie. Daarom stroomt het kokende wort door een platenkoeler en komt het er in één doorgang op gisttemperatuur uit. Na de gisting zakt de uitgewerkte gist naar de puntige bodem van de tank, waar de brouwer hem aftapt.' }
                ]
            },
            7: {
                titel: 'Wat de kou doet',
                kaartjes: [
                    { titel: 'Jonge smaken verdwijnen', tekst: 'Jongbier bevat nog stofjes die er niet in thuishoren: aceetaldehyde, dat naar groene appel ruikt, en diacetyl, dat naar boter en toffee smaakt. De gist ruimt ze tijdens het rijpen grotendeels op.' },
                    { titel: 'Kou maakt helder', tekst: 'Vlak boven het vriespunt klonteren gistcellen en eiwitdeeltjes samen en zakken naar de bodem. Het bier wordt vanzelf helder. En hoe kouder het bier, hoe meer koolzuur erin oplost.' },
                    { titel: 'Waar komt \'lageren\' vandaan?', tekst: 'Het woord komt van het Duitse lagern: opslaan, bewaren. Vroeger lieten brouwers hun bier rijpen in koele kelders en grotten. Nu doet een gekoelde tank hetzelfde werk.' }
                ]
            },
            8: {
                titel: 'Lichtgeraakt bier',
                kaartjes: [
                    { titel: 'Wat zonlicht doet', tekst: 'Blauw licht en uv-straling breken de bitterstoffen uit de hop af. Daarbij ontstaat een zwavelstof die ruikt naar… een stinkdier. Je neus pikt het al op bij een paar miljardste gram per liter. Brouwers noemen dat \'lichtgeraakt\' bier.' },
                    { titel: 'Helder, groen of bruin?', tekst: 'Helder glas laat vrijwel al het schadelijke licht door, groen glas het meeste. Bruin glas houdt bijna alles tegen. Daarom zitten de Rolduc-bieren in bruine flesjes: een zonnebril voor je bier.' },
                    { titel: 'Zuurstof: de stille vijand', tekst: 'Zuurstof laat bier verouderen: het gaat naar nat karton smaken. Daarom wordt elk flesje tot de vullijn gevuld en gaat de kroonkurk er direct op. Tel maar eens na: een kroonkurk heeft 21 tandjes.' }
                ]
            },
            9: {
                titel: 'Een levend bier',
                kaartjes: [
                    { titel: 'De warme kamer', tekst: 'Na het vullen staan de flessen zo\'n twee weken op kamertemperatuur. De gist eet het extra suikertje op en maakt koolzuur dat nergens heen kan: het lost op in het bier. De druk loopt op tot ongeveer die van een autoband. Daarom zijn bierflessen zo stevig.' },
                    { titel: 'Het gistdepot', tekst: 'Op de bodem ontstaat een dun laagje gist. Schenk rustig in één beweging en laat het laatste bodempje in de fles staan. Of schenk het apart: het smaakt wat gistig en romig.' },
                    { titel: 'Bier dat blijft rijpen', tekst: 'Omdat de gist nog leeft, ontwikkelt de smaak zich nog maandenlang. Zwaardere bieren worden vaak ronder en voller. Bewaar de flessen rechtop, koel en donker: dan blijft het gistdepot netjes op de bodem.' }
                ]
            }
        },

        /* ================================================================
           TIP VAN DE BROUWER (de ?-knoppen)
           Per proefje en per game-fase: wat moet je doen, en waarom.
           'hint' is het korte zinnetje bij het handje dat verschijnt als
           iemand een paar seconden niets doet.
           ================================================================ */
        hulp: {
            // Scène B: de proefjes op de ketel (stap 1–9)
            rooster: {
                hint: 'Houd de trommel aan',
                wat: 'Houd de roostertrommel ingedrukt: hete lucht verhit de mout. Laat los om te stoppen. Kijk hoe de korrels en het proefglas donkerder kleuren.',
                waarom: 'Pilsmout wordt met warme lucht zacht gedroogd, rond 80–85 °C: de enzymen blijven heel. Donkere mout gaat in de roostertrommel tot ± 220 °C en verliest zijn enzymen.'
            },
            molen: {
                hint: 'Draai aan het wiel',
                wat: 'Draai rondjes aan het slingerwiel. Een flinke zwiep draait nog even door. Stop als de naald in het groene vak staat: korrel open, kafje heel.',
                waarom: 'Een hele korrel houdt zijn zetmeel vast. Maal je te fijn, dan wordt het kaf poeder en verstopt het filterbed bij stap 4.'
            },
            maisch: {
                hint: 'Sleep naar 62 °C',
                wat: 'Sleep de thermometer eerst naar 62 °C en wacht op het vinkje. Daarna naar 70–72 °C, weer tot het vinkje. Eindig op 78 °C.',
                waarom: 'Bij 62–65 °C knipt bèta suiker voor alcohol; boven 65 °C gaat dat enzym kapot. Daarna knipt alfa bij 70–72 °C stukken voor body. Bij 78 °C stoppen ze allebei.'
            },
            filter: {
                hint: 'Trek de hendel omlaag',
                wat: 'Trek de hendel van de kraan omlaag, of tik erop. Kijk hoe het wort eerst troebel en dan helder loopt. Tik daarna op het karretje.',
                waarom: 'De kafjes uit stap 2 vormen een natuurlijk filter. Het troebele begin pompt de brouwer terug: rondpompen. Het heldere wort gaat naar de kookketel, het bostel als krachtvoer naar de boer.'
            },
            hopketel: {
                hint: 'Tik op de ketel',
                wat: 'Tik op de ketel: het wort gaat koken en de klok loopt. Gooi meteen een hopbel erin, en nog één in het groene stuk van de klok.',
                waarom: 'Hop wordt pas bitter na lang koken: de alfazuren veranderen langzaam in bittere iso-alfazuren. De geur is vluchtig en verdampt als de hop te lang meekookt.'
            },
            gistloep: {
                hint: 'Sleep het vergrootglas',
                wat: 'Sleep het vergrootglas over de gisttank. Zolang het erop ligt, tikken de dagen door. Kijk hoe de gist suiker eet, zich deelt en belletjes maakt.',
                waarom: 'Gist zet suiker om in alcohol en koolzuurgas. Daarbij maakt hij ook de fruitige en kruidige geuren die abdijbier zo typerend maken.'
            },
            kalender: {
                hint: 'Tik op de kalender',
                wat: 'Tik op de scheurkalender of veeg een blaadje omlaag. Elke tik is een week in de koude tank. Kijk hoe het bier helder wordt.',
                waarom: 'Vlak boven het vriespunt zakken gist en eiwitjes naar de bodem: het bier wordt helder. Intussen ruimt de gist de jonge smaakjes op: groene appel en boter.'
            },
            zonnebril: {
                hint: 'Sleep de zon',
                wat: 'Sleep de zon langs de hemel, boven drie flesjes: helder, groen en bruin glas. Kijk op de labeltjes welk bier fris blijft.',
                waarom: 'Blauw licht en uv breken de bitterstoffen uit de hop af tot een zwavelstof die naar stinkdier ruikt. Bruin glas houdt dat licht bijna helemaal tegen, groen veel minder, helder niets.'
            },
            warmekamer: {
                hint: 'Wacht… en tik dan op de kurk',
                wat: 'De weken in de warme kamer lopen vanzelf. Houd de drukmeter in de gaten en open de fles op tijd: tik op de kroonkurk.',
                waarom: 'Bij het bottelen gaan er wat suiker en verse gist bij. In zo\'n twee weken op kamertemperatuur maakt de gist koolzuur. Dat kan niet weg en lost op in het bier.'
            },
            // De Brouwmeester-game
            kies: {
                wat: 'Tik op het bier dat je wilt brouwen. Elke kaart toont de streefkleur (EBC), de bitterheid (IBU) en het alcoholpercentage.',
                waarom: 'Elk recept vraagt iets anders: een tripel wil meer mout en een lange bèta-rust, een dubbel donkere mout en meer body.'
            },
            storten: {
                wat: 'Houd een moutzak ingedrukt om te storten en laat los om te stoppen. Mik op de groene doellijn en kijk rechtsboven naar de kleur.',
                waarom: 'De hoeveelheid mout bepaalt hoe sterk je bier wordt, de mix bepaalt de kleur.'
            },
            schroten: {
                wat: 'Tik op "Stop!" zodra de naald in het groene vak staat. Let op: de molen draait steeds sneller.',
                waarom: 'Te heel betekent te weinig suiker, poeder betekent een verstopt filterbed.'
            },
            maischen: {
                wat: 'Tik de brander aan als het te koud is en weer uit vlak voor de groene zone. De ketel warmt nog even na!',
                waarom: 'De bèta-rust maakt suikers voor alcohol, de alfa-rust maakt body. Te heet en de enzymen geven het op.'
            },
            hop: {
                wat: 'Gooi de bitterhop er meteen bij de start in (gouden vak) en de aromahop helemaal aan het eind (groene vak).',
                waarom: 'Bitterheid heeft kooktijd nodig, het aroma verdampt juist snel.'
            },
            gist: {
                wat: 'Wacht tot de thermometer in het gouden vak (18–24 °C) staat en tik dan op "Gist erbij!".',
                waarom: 'Te heet en de gist bezwijkt of maakt rare smaakjes. Te koud en de gist slaapt.'
            },
            suiker: {
                wat: 'Gebruik + en − tot de naald van de drukmeter in het groene vak staat. Tik dan op "Klaar".',
                waarom: 'De bottelsuiker wordt in de warme kamer koolzuur. Te weinig is plat, te veel wordt een spuiter.'
            },
            aftappen: {
                wat: 'Houd "Tap af" ingedrukt tot het bier bij de gouden vullijn staat. Laat los, wacht tot het schuim zakt, vul eventueel bij en tik op "Kroonkurk erop".',
                waarom: 'Te weinig bier betekent veel zuurstof in de hals, en zuurstof laat bier verouderen. Te vol loopt over.'
            },
            resultaat: {
                wat: 'Bekijk je glas, je score en de proefnotitie. Brouw nog eens, kies een ander recept of ga proosten.',
                waarom: 'Kleur, schuimkraag en helderheid van het glas volgen écht uit wat je in de vier fases deed.'
            }
        }
    };
})();
