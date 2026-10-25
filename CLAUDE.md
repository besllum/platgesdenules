# platgesdenules.es — guia per editar

Web estàtica bilingüe de l'Associació Platges de Nules. Desplegament: **GitHub → Vercel**.
Cada push a `main` publica la web a producció; qualsevol altra branca crea una previsualització.

La propietària (Hilke) fa els canvis demanant-los en el xat, sense terminal. Respon en castellà o valencià, breu i amb passos clars.

## Estructura

- `src/i18n/ca.json` · `src/i18n/es.json` — **tots els textos** (valencià / castellà). Seccions: `common` (menú, peu), `home`, `patrimoni`, `casetes`, `legal`, `alt` (textos alternatius de les imatges).
- `src/site.json` — títols i descripcions SEO de cada pàgina i idioma, URLs (slugs), pobles de Mar Nostra.
- `src/pages/*.html` — plantilles de cada pàgina. `src/partials/` — capçalera i peu compartits.
- `public/` — imatges (`img/`), fonts, `css/site.css`, `js/site.js`, icones. Es copia tal qual.
- `build.mjs` — generador sense dependències: `node build.mjs` → `dist/`.

## Sintaxi de les plantilles

- `{{ t.clau }}` text de l'idioma actual (escapat). `{{{ t.clau }}}` sense escapar.
- `{{ url.home }}` `{{ url.patrimoni }}` `{{ url.casetes }}` `{{ url.legal }}` URL en l'idioma actual.
- `{{json t.llista }}` JSON dins d'un atribut. `{{> header }}` inclou un parcial.
- `style-hover="..."` / `style-focus="..."` es converteixen en classes CSS.
- Les `<img>` amb `src="/img/..."` reben `width`/`height` i `loading="lazy"` automàticament. Per a la imatge principal (LCP) posa `fetchpriority="high"`.
- Carrusels: `data-slider` > `.slide[data-slide]` + `data-prev` / `data-next` / `.dot[data-dot]`. "Llegir més": `data-more="x"` + `data-more-item="x" hidden`.

## Regles

1. Qualsevol text nou va **als dos idiomes** (ca i es) amb la mateixa clau. No inventes fets, dates ni xifres: si falta un text, pregunta.
2. Imatges noves: converteix-les a WebP (≤1600 px d'ample, qualitat ~78) i escriu un `alt` descriptiu als dos idiomes a la secció `alt`.
3. Abans de fer push: `node build.mjs` sense avisos (⚠) i revisa la pàgina amb Playwright si el canvi és visual.
4. Canvis de text petits → directament a `main`. Canvis grans de disseny o d'estructura → branca nova, enllaç de previsualització i confirmació abans de fusionar.
5. Si canvies un slug a `site.json`, afegeix una redirecció 301 a `vercel.json`.
6. No afegeixes analítiques ni cookies sense avís de consentiment (ho diu la pàgina legal).

## Pendents de contingut (no són errors de codi)

Textos "Lorem ipsum" (Casetes obertes a l'inici, Cultura, Arquitectura, Natura, notícies 5a i 4a edició), notícies "Titular pendent", segona foto de natura i fotos de la secció Cultura, dades legals (NIF, adreça, registre).
