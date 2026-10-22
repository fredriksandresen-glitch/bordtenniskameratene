# 🏓 Bordtenniskameratene

Lunsj-bordtennis ranking som web-app på Internet Computer.
Erstatter Excel-arket `Ranking Bordtennis 2026.xlsx`.

**Live:** https://lix6v-xyaaa-aaaah-qu2pa-cai.icp0.io/

## Canistere (IC mainnet)

| Canister | ID |
| --- | --- |
| backend (Motoko) | `lbuvj-bqaaa-aaaah-qu2oq-cai` |
| frontend (assets) | `lix6v-xyaaa-aaaah-qu2pa-cai` |

## Funksjoner

- **Ny runde** — velg hvem som er med, sorter rekkefølgen, lagre. To skjermer.
- **Ranking** — snitt, antall runder, seire og seiersprosent per spiller.
- **Historikk** — alle runder med plassering, poeng og merknad.
- **Spillere** — legg til folk, velg emoji, last opp bilde (croppes i nettleseren).
- **Innlogging** — Internet Identity (som også tilbyr «Continue with Google»).
  Anonyme kall til `recordGame` avvises av backend.

## Poengmodell

Basert på Excel-arket (tabellen «Med N stk»), med avklart regel for ni eller flere spillere 22. oktober 2026. Vinner får alltid **8 poeng**,
fordelingen nedover avhenger av antall deltakere. Regelen for ni spillere ble
avklart 22. oktober 2026 til 8–7–6–5–4–3–2–1–0; øvrige fordelinger er uendret:

| Deltakere | Poeng 1.–N. plass |
| --- | --- |
| 3 | 8-4-0 |
| 4 | 8-6-3-0 |
| 5 | 8-6-4-2-0 |
| 6 | 8-6-4-2-1-0 |
| 7 | 8-6-4-3-2-1-0 |
| 8 | 8-6-5-4-3-2-1-0 |
| 9 | 8-7-6-5-4-3-2-1-0 |
| 10 | 8–7–6–5–4–3–2–1–0,5–0 |
| 11 | 8–7–6–5–4–3–2–1,5–1–0,5–0 |
| 12 | 8–7–6–5–4–3–2,5–2–1,5–1–0,5–0 |
| 13 | 8–7–6–5–4–3,5–3–2,5–2–1,5–1–0,5–0 |

Ranking sorteres på snittpoeng, med antall seire som tiebreak.

## Utvikling

```sh
# frontend
cd src/frontend && pnpm install && pnpm dev

# backend + frontend til mainnet
mops install
dfx deploy --network ic
```

## Struktur

```
src/backend/main.mo     Motoko-canister: spillere, runder, ranking
src/frontend/           React + Vite
  src/App.jsx           UI (Ranking / Ny runde / Historikk / Spillere)
  src/auth.js           Internet Identity
  src/bordtennis.did.js Candid-grensesnitt
```

### Eksakte halvpoeng
API-resultater har `pointsHalf` (optional Nat, antall halvpoeng); faktisk poengsum er `pointsHalf / 2`, med `points` som fallback for eldre serverversjoner. `points` beholder heltallsdelen for bakoverkompatibilitet. `standings.totalPointsHalf` er eksakt sum i halvpoeng. Backend lagrer brøkplasseringer separat, slik at gammel historikk ikke omtolkes. Rettelser må sammenligne hele `GameView`, inkludert `pointsHalf`.
