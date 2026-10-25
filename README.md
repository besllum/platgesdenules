# Platges de Nules — platgesdenules.es

Web de l'Associació Platges de Nules (valencià i castellà).

- Valencià: `/`, `/patrimoni`, `/casetes-obertes`, `/legal`
- Castellà: `/es`, `/es/patrimonio`, `/es/casetas-abiertas`, `/es/legal`

Els textos són a `src/i18n/` i el SEO de cada pàgina a `src/site.json`.
Vercel executa `node build.mjs` i publica la carpeta `dist/` a cada canvi de la branca `main`.
Més detalls a `CLAUDE.md`.
