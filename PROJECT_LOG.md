
## 2026-10-22 – poengretting og duplikat
- Bruker ba om 8..0 ved ni spillere, retting 6. og 13. oktober, samt fjerning av 1. oktober-registreringen uten kommentar.
- Rettet poeng i eksisterende game ID22 og ID26 uten å endre ID, plassering, spiller, dato, kommentar eller recordedBy. Slettet kun ID19; ID20 med kommentar beholdt (og dens egne plasseringer uendret). 30 → 29 runder; 19 spillere/bilder og minimumskrav uendret.
- Tabellen for ni spillere er rettet både i backend og frontend; øvrige tabeller, design og rankingberegning er uendret.
- Ny controller-begrenset correctGames validerer komplette forventede runder, dublett-ID og overlapp før atomisk endring/sletting. Ingen brukergrensesnittendring.
- Lokal test: oppgradering med 13 spillere og historikk bevarer data/bilde/innstilling; avvisning av uautorisert/stale/dublett/overlapp; trygg replay; poengtabeller 2..13. Stable-kompatibilitet og frontend-build bestått.
- Backend-snapshot før upgrade: 00000000000000000000000000f0a69d0101. Backend startet igjen umiddelbart; oppgradering med wasm-memory-persistence=keep. Alle data identiske etter upgrade, før selve rettingen.
- Live kontroll: to runder 8..0, kun én 1.oktober med kommentar, 29 historikkort, snitt/totaler/seire avstemt. Frontend publisert atomisk (kun JS og index); CSS og tidligere preview beholdt.
- Ytterligere funn: ID29 fra 22. oktober har samme ni-spillerfeil. Bruker spurt om den også skal rettes; foreløpig IKKE endret, utenfor de to eksplisitt angitte datoene.
- Backup, eksakte før/etter-JSON, gamle assets/WASM, test- og oppgraderingslogger: /home/clawduser/outputs/bordtennis-rettelser-20261022/.

### Oppfølging 22. oktober – dagens runde også godkjent
Bruker bekreftet retting med skjermbilde. ID29 (22.oktober13:35) er nå rettet til8–7–6–5–4–3–2–1–0 med eksisterende correctGames. Fersk backup i /home/clawduser/outputs/bordtennis-rettelser-20261022/dagens-runde. Sammenligning bekrefter kun poengdiff i ID29; alle29 runder, datoer, rekkefølger, kommentarer,19 spillere/bilder og minimum beholdt. Live-historikk verifisert. Ingen ny deploy. Forrige åpne avklaring er løst.

## 2026-10-22 – Halloween-tema
- Kun visuelle CSS-overstyringer og statisk halloween-banner.svg: lilla/oransje, gresskar, flaggermus. Ingen endring i JavaScript/JSX, backend, regler eller funksjoner.
- Testet på 320/390/1280 px, faner og spillerkort; ingen horisontal overflow eller JavaScript-feil. Kompilert JavaScript byte-identisk med forrige produksjonsversjon.
- Publisert fire frontend-filer atomisk via asset batch; ingen WASM-oppgradering eller sletting av gamle assets. Tidligere designpreview bevart.
- Live verifisert: alle filer matcher build, 29 runder/19 spillere/minimumskrav identiske før/etter; begge module hashes uendret og canistere Running.
- Backup, manifest, kontrollresultater og skjermbilder: /home/clawduser/outputs/bordtennis-halloween-20261022/.

## 2026-10-22 – halvpoeng og rekordrunden
- Bruker bekreftet 11-spillerfordeling 8–7–6–5–4–3–2–1,5–1–0,5–0. Runder med 9+ har 8/7 i toppen; laveste gap deles først ved 10–13. 2–9-tabeller beholdt.
- Additiv lagring av brøkplasseringer og optional pointsHalf/totalPointsHalf i API, nøyaktige halvpoengenheter uten migrering/omtolking av eldre Game-data. Frontend normaliserer én gang ved innlesing, inkludert historikk, badges, snitt, ranking og spillerkort; poengvisning med norsk desimalkomma.
- Lokal test: oppgradering bevarer eldre spill/bilder/innstillinger; avviser uautorisert og stale retting, inklusive halvpoeng; kun ønsket runde endres; alle tabeller 2–13 og backend-summer avstemt; ny oppgradering bevarer halvpoeng. Stable-kompatibilitet og build bestått.
- Ekstra backend-snapshot: 00000000000000010000000000f0a69d0101. Etter upgrade var alle gamle data identiske. Rettet deretter kun ID30 (22.oktober, «Rekord mange i dag»). 30 runder, 22 spillere, metadata/bilder/minimum bevart.
- Live backend-summer og snitt avstemt mot historikken; nettleser viser 1,5p/0,5p og alle 30 historikkort, uten JS-feil/overflow. Publisert kun ny JS og index; Halloween-CSS/SVG, preview og eldre assets beholdt.
- Audit og testskript: /home/clawduser/outputs/bordtennis-halvpoeng-20261022/.
