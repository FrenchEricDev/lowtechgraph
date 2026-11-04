# Lowtech Graph

The code of [lowtechgraph.org](https://www.lowtechgraph.org), a free catalogue of low-tech solutions
for the home, in English and French.

The site lists 246 solutions across 15 needs of a house (water, heating, cooking, power, waste and
more). Each one has the same plain ratings (cost, skill to build, upkeep, whether it works without
the grid), a drawing, its sources and links to tutorials by people who built it. The system builder
links solutions by what one gives and the next takes, then checks the result against the rain, sun
and cold of the reader's region and shows where it falls short.

It has no ads, no account, no cookies and no tracking script, and it sells nothing. It counts page
requests on the server, with no IP address and no identifier (see `worker/index.js`).

## Licences

- **Code:** GNU Affero General Public License v3.0, in [`LICENSE`](LICENSE). If you run a modified
  copy as a website, publish your changes under the same licence.
- **Content** (the catalogue, the texts, the drawings): CC BY-SA 4.0, in
  [`LICENSE-content.md`](LICENSE-content.md), with the credits for the climate data.

## The data

The whole catalogue is one file, `src/data/catalogue.json`, also served at
https://www.lowtechgraph.org/catalogue.json. The climate of each country is in `public/climate/`.

The catalogue is generated from a spreadsheet by a Python script. Neither is in this repository:
they are working files, and the JSON holds everything they produce. To correct an entry, report it
rather than editing `catalogue.json` by hand, since the next generation would overwrite the edit.

## How it was made

One person built it, with a lot of help from AI (Claude, by Anthropic) to search sources, assemble
the data and write the code. Every figure in the catalogue names where it comes from; the solution
pages and the system check show it.

## Reporting an error

Write to eric@lowtechgraph.org, or open an issue here. A wrong figure with a better source is the
most useful thing you can send.

## Running it

Node 22 or later (see `.nvmrc`).

```bash
npm install
npm run dev        # the site on http://localhost:5173, reloading as you edit
npm run build      # lint, build, prerender every page, then run every check; fails on any
npm run preview    # the built site on http://localhost:4173 (it installs a service worker)
npm run qa         # the checks alone, against an existing build
```

## Where things are

- `src/data/catalogue.json`: the catalogue (generated, see above).
- `src/ui-strings.js`, `src/ui-strings.fr.js`: every interface text, in English and French.
- `src/content/`: the guides and the home page cards.
- `src/adequacy/`: the system check (water, energy and heat balances against the climate).
- `src/illustrations/`: the drawings, as SVG built in code.
- `scripts/`: the build's checks, the prerendering, `llms.txt` and the sharing card.
- `worker/index.js`, `wrangler.jsonc`: the Cloudflare Worker that serves the site and counts requests.
