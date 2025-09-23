# MadCrew Backoffice (Next.js + Firebase)

Een kant-en-klare, 100% online backoffice met:
- Login via Firebase (Google sign-in)
- Dashboard KPI's (omzet, kosten drukker, buffer)
- Producten, Bestelrondes, Bestellingen
- Excel-importer (herkent rijen met "Bestelronde X")
- Admin-toegang via whitelist (ENV) + Firestore `roles` bootstrap
- Firestore Security Rules

## 1) Benodigdheden
- Firebase project (Firestore + Authentication)
- GitHub account
- Vercel account (voor hosting)

## 2) Installatie (online, zonder lokale tools)
1. Maak een lege GitHub repo en upload deze projectbestanden (of push).
2. Koppel repo aan Vercel → Deploy.
3. Zet ENV vars in Vercel (Project Settings → Environment Variables):

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_ADMIN_EMAILS=you@example.com,coadmin@example.com
```

4. Firebase Console → Authentication → Providers → **Google** inschakelen.
5. Firebase Console → Firestore → **Rules** tab → vervang door `firestore.security.rules` uit dit project → **Publish**.

## 3) Eerste login (bootstrap admin)
- Ga naar je Vercel URL, klik **Inloggen met Google**.
- Als jouw e-mailadres in `NEXT_PUBLIC_ADMIN_EMAILS` staat, wordt er automatisch
  een document aangemaakt in `roles/{uid}` met `role: 'admin'`.
- Daarna heb je toegang tot `/admin` en alle subpagina's.

## 4) Excel importeren
- Ga naar **/admin/import** en upload je Excel.
- De importer verwacht kolommen zoals jouw sheet:
  - `Datum`, `Naam`, `Product`, `Kleur`, `Maat`, `Aantal`, `Prijs`, `Totaal`, `Betaald (Ja/Nee)`, `Opmerkingen`, `Naar drukker`, `Mis Druk`, `Winst`
- Regels met tekst **"Bestelronde X"** in kolom `Datum` worden als ronde-header gezien.
- Voor elke order wordt `margin` (winst/buffer) meegenomen. `kosten drukker ≈ omzet - buffer`.

## 5) Beheerders toevoegen/verwijderen
- Voeg e-mail toe aan `NEXT_PUBLIC_ADMIN_EMAILS` **of** zet handmatig in Firestore
  in collectie `roles` → doc met `uid` → `{ role: 'admin', email: '...' }`.

## 6) Veiligheid & Changelog
- Dit starterproject houdt basisvelden bij. Voor een echte changelog adviseren we een
  collectie `audit` waarin je bij elke wijziging `who/when/what/old/new` logt.
  (Kan ik toevoegen zodra je wilt.)

## 7) Volgende stappen
- Statusflows (betaald/geleverd/misdruk/doorverkocht) met knoppen.
- Rapporten per bestelronde.
- Webshop-koppeling (bestellingen automatisch naar `orders`).

Vragen of uitbreiden? Laat het weten!
