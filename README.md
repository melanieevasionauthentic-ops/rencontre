
# À l’Ancienne — Pack Netlify (domain + favicon + URLs propres)

## Déploiement
1. Sur Netlify, **Add new site → Deploy manually** puis glissez le dossier (ou le ZIP).
2. Netlify détecte `index.html`. Aucune build.
3. Les fichiers `_redirects` et `_headers` sont pris en compte automatiquement.

## Domaine personnalisé
- Dans le tableau de bord Netlify : **Site settings → Domain management → Add domain**.
- Saisis ton domaine (ex. `rencontres-a-lancienne.com`) et suis l’assistant DNS (CNAME/ALIAS).
- Une fois propagé, les liens fonctionneront grâce aux **chemins relatifs** et aux **URLs propres** (ex. `/privacy`).

## Favicon / Manifest
- Inclus `assets/favicon.ico`, `favicon-32.png`, `favicon-16.png`, `icon-192.png`, `icon-512.png` + `site.webmanifest`.
- `theme-color` configuré.

> Prototype uniquement : aucune collecte serveur. Tout est local (navigateur).
