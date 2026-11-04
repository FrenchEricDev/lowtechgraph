# Guides: how to change them by hand

One folder per guide, one file in it: `guide.json`. The folder's name is the guide's id
(`save-money`, `healthier-home`…). Everything a reader sees on a guide, and its tile on the home
page, is in that file. No code to touch.

```
{
  "slug":  { "en": "save-money", "fr": "economiser" },    the address: /en/guide/save-money
  "order": 1,                                             its place on the home page and the guides page
  "en": {
    "door":  "Lower my bills",                            the words on its home-page tile
    "title": "Build to save money",                       the guide page's title
    "intro": "Five solutions that…"                       the sentence under the title
  },
  "fr": { …the same three, in French… },
  "picks": [                                              the solutions, in the order shown
    { "id": "SOL-123",                                    the catalogue number (Housing-Systems.xlsx)
      "en": { "why": "Keeps the heat you already paid for…" },
      "fr": { "why": "Retient la chaleur déjà payée…" } },
    …
  ]
}
```

## Common changes

- **Swap a solution:** change its `"id"` and rewrite its two `"why"` lines. The name, picture,
  ratings and tutorials come from the catalogue by themselves.
- **Reorder the solutions:** move the whole `{ "id": … }` block up or down. They are listed
  from the easiest to build to the most demanding (Eric, 2026-11-01).
- **Reorder the home page's tiles:** change the `order` numbers. Six fill the grid.
- **Take a guide off the home page** but keep its page: delete its `"order"` line.
- **Add a guide:** copy a folder, rename it, and change everything in it, slugs included.
- **Remove a guide:** move its folder to `archive/`.

## Rules the build checks

`npm run build` (and `python scripts/regenerate.py`) refuse the change, and say why, if:

- a pick names a solution number that is not in the catalogue, or the same one twice;
- a solution is on more than two guides;
- a guide lacks a slug in either language, or two guides share one;
- a guide with an `order` lacks its `door` words in either language.

## Writing tips

- Straight quotes `"` delimit the text; inside it, use the typographic apostrophe `’`, or `\"`
  for a quote mark.
- In French, a no-break space goes before `:` `;` `?` `!` (as elsewhere on the site).
- A comma after the last item of a list, or a missing one between items, breaks the file: the
  build names the file and the line.
- After a change: `npm run build` in `app/webapp`, or `npm run dev` to see it live.
