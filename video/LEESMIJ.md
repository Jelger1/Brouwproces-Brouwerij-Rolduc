# Video's voor "De Brouwreis" — shotlijst voor het productieteam

In de app `brouwproces.html` staan vijf video-uitstapjes (de ▶-knop bij stap 2, 3, 5, 8
en 9). Zolang een video er nog niet is, toont de lightbox dat de opname binnenkort komt.

**Zo zet je een video live:**

1. Zet het bestand met de juiste naam in deze map (en de poster-JPG ernaast).
2. Zet in `js/brouwproces-data.js` bij die video `klaar: false` op `klaar: true`.
3. Verhoog `?v=…` achter de scripts in `brouwproces.html`, zodat iPads de nieuwe versie ophalen.

Wil je de productie-aanwijzingen (shot, regietip, bestandsnaam) in de lightbox zien, open
dan `brouwproces.html?productie#stap-3`.

## De vijf opnames

| Slot | Stap | Bestandsnaam | Duur | Wat we zien |
|---|---|---|---|---|
| 1 | 2 · Schroten | `stap-2-schroten.mp4` | ± 0:25 | Close-up van de brouwer die een zak mout in de schrootmolen stort en het grof gebroken schroot controleert in zijn hand. |
| 2 | 3 · Maischen | `stap-3-maischen.mp4` | ± 0:30 | Dampende maischketel die geopend wordt, waarbij je het roerwerk door het warme beslag ziet draaien. |
| 3 | 5 · Koken | `stap-5-koken.mp4` | ± 0:30 | Kolkend wort in de ketel en het moment waarop een flinke schep geurige hopbellen/pellets in de kokende massa wordt gegooid. |
| 4 | 8 · Bottelen | `stap-8-bottelen.mp4` | ± 0:35 | Ritmische shots van het bottelen: rinkelende flesjes, schuim dat precies tot de rand komt en de kroonkurk die erop gaat. |
| 5 | 9 · Hergisten op fles | `stap-9-hergisten.mp4` | ± 0:40 | Het openen van een flesje Rolduc (psst!) en het langzaam inschenken in een origineel Rolduc-kelkglas met een prachtige schuimkraag. |

### Regietips

1. **Schroten** — begin op de korrels die in de trechter glijden, eindig op de open hand met het schroot: kafjes heel, meelkern zichtbaar.
2. **Maischen** — laat de stoom het eerste beeld vullen en wegtrekken. Een detail van de thermometer (62 °C) maakt de koppeling met de tekst.
3. **Koken** — slow motion (50/60 fps) van het moment dat de hop het wort raakt werkt prachtig.
4. **Bottelen** — monteer op het ritme van de machine; het originele geluid van rinkelend glas is hier de muziek.
5. **Hergisten** — gouden uur, abdijmuur op de achtergrond. Houd de "psst" hoorbaar.

## Technische eisen

| | |
|---|---|
| Formaat | MP4, H.264-video + AAC-audio |
| Resolutie | 1920 × 1080 (16:9), 25 of 30 fps |
| Grootte | liefst onder 15 MB per video (de pagina wordt ook op mobiel bekeken) |
| Poster | JPG, 1600 × 900, **zelfde naam** als de video: `stap-2-schroten.jpg` enz. |
| Ondertitels | optioneel, WebVTT: `stap-2-schroten.vtt` enz. Zet daarna in `js/brouwproces-data.js` bij die video `ondertitels: 'video/stap-2-schroten.vtt'`. |

Comprimeren kan bijvoorbeeld met HandBrake (preset "Fast 1080p30") of met:

```bash
ffmpeg -i bron.mov -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart stap-2-schroten.mp4
```

`-movflags +faststart` zorgt dat de video meteen begint te spelen terwijl hij nog laadt.

## Regels voor alcoholreclame

De Reclamecode voor Alcoholhoudende Dranken geldt ook voor deze video's:
geen personen in beeld die jonger zijn dan 25 jaar (of zo ogen), geen koppeling
met sport, verkeer of prestaties, en drinken wordt nooit gepresenteerd als
oplossing. Genieten, proeven en vakmanschap staan centraal.

## Andere titel of duur?

Titels, duur, de omschrijving voor gasten (`omschrijving`) en de shotomschrijving
(`shot`) staan in `js/brouwproces-data.js` onder `videos`. Vermeld in teksten voor
gasten alleen wat ook echt in beeld komt.
