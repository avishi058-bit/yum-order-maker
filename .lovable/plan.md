# Video structured data: what Google sees (investigation only)

## Findings
There is exactly ONE VideoObject in the whole project:

- `src/components/PressSection.tsx` line 147 (inside the JSON-LD built at lines 142-155, injected at line 160 as a script tag).
- Renders on `/` (`src/pages/Index.tsx` line 950, hidden on kiosk/station) and on `/groups` (`src/pages/Groups.tsx` line 554). Not on `/en/groups` or `/otef-aza`.
- It is added only by JavaScript (not in the raw prerendered HTML), so Google sees it after rendering.
- Fields present: `@type: VideoObject`, `name` ("אבישי שלזינגר - המבורגר הבקתה - מתארח בערוץ 13"), `url` (https://www.youtube.com/watch?v=YDUMyeS4xrQ). Nested as `subjectOf` of a second Restaurant object.

No VideoObject anywhere else: none in `index.html`, `src/seo/pages.ts`, prerender, or `public/`. No `itemprop`/`itemtype` microdata anywhere.

## Google fields vs. what exists
| Field | Status |
|---|---|
| name | present |
| description | MISSING (required) |
| thumbnailUrl | MISSING (required) |
| uploadDate (ISO 8601 + timezone) | MISSING (required) |
| contentUrl | missing (recommended; `url` is not a substitute) |
| embedUrl | missing (recommended, e.g. https://www.youtube.com/embed/YDUMyeS4xrQ) |
| duration (ISO 8601, e.g. PT3M20S) | missing (recommended) |

The 3 missing required fields plus the page count (2 pages) explain the "4 issues": likely description, thumbnailUrl, uploadDate, and one recommended/duplicate report across `/` and `/groups`.

The page `<video>` tags on /groups and /en/groups (guide reel, Canada reel) have no structured data; Google may also detect them as videos on the page, but they are not the source of these schema errors.

## Proposed fix (only if you approve)
In `PressSection.tsx` complete the VideoObject: add description, thumbnailUrl (https://i.ytimg.com/vi/YDUMyeS4xrQ/hqdefault.jpg), uploadDate with timezone (real date from YouTube needed from you), embedUrl, contentUrl and duration. Optionally add VideoObjects for the two self-hosted reels on /groups and /en/groups via `src/seo/pages.ts` so they are in raw HTML. Then publish and click "Validate fix" in Search Console.
