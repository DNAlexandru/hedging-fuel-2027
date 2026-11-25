# Hedging fuel 2027 FTL

Dashboard condivisa per le coperture fuel FTL 2027 (round, Brent per fissazione, rapporti future/Brent, indicatori).

## Come funziona
- `public/index.html`: la pagina. Non contiene dati: li legge dall'API dopo il login.
- `api/*`: funzioni Vercel. Salvano round, rapporti e future su Vercel Blob (store privato), con controllo di versione per le modifiche contemporanee.
- Cron giornaliero (06:30 UTC) su `/api/update-market`: bollettino UE (diesel EU-27 con tasse), Brent EIA (FRED), cambio BCE.
- Il future gasoil si inserisce a mano dalla pagina Indicatori (non esiste una fonte gratuita ufficiale).

## Messa online (una volta)
1. Vercel → Add New → Project → importa questo repository. Framework: Other. Output directory: `public`.
2. Nel progetto: Storage → Create → Blob → accesso **Private** → collega al progetto (crea `BLOB_READ_WRITE_TOKEN`).
3. (Facoltativo) Settings → Environment Variables: `CRON_SECRET`, stringa casuale lunga, usata dal cron giornaliero.
4. Redeploy.

Accesso: libero per chi ha il link, senza password (scelta del team).
