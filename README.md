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

Hentet direkte fra Excel-arket (tabellen «Med N stk»). Vinner får alltid **8 poeng**,
fordelingen nedover avhenger av antall deltakere:

| Deltakere | Poeng 1.–N. plass |
| --- | --- |
| 3 | 8-4-0 |
| 4 | 8-6-3-0 |
| 5 | 8-6-4-2-0 |
| 6 | 8-6-4-2-1-0 |
| 7 | 8-6-4-3-2-1-0 |
| 8 | 8-6-5-4-3-2-1-0 |
| 9 | 8-6-5-4-3-2-1-1-0 |
| 10 | 8-6-5-4-3-2-2-1-1-0 |
| 13 | 8-6-5-4-3-2-2-2-1-1-1-0-0 |

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
