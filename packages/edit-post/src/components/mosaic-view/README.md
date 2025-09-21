Mosaic View (Experiment)
========================

This directory contains the Post Editor implementation of the experimental Mosaic View: a Safari‑style “tab overview” for quickly navigating between Posts/Pages via a tile grid with live editor previews.

Status: Experimental (behind a plugin experiment toggle)

- Enable at: wp‑admin → Gutenberg → Experiments → “Editor: Mosaic content overview”.
- Global flag injected: `window.__experimentalMosaicView === true`.
- Overlay is never full‑screen; it starts below the editor toolbar (top offset 64px).

Entry points
------------

- Toolbar toggle (Post Editor, left group). Tooltip reflects current type (e.g., “Page mosaic”).
- Keyboard shortcut: Cmd/Ctrl + Shift + M.
- Command Palette: “Open Mosaic” / “Close Mosaic”.

Overlay behavior
----------------

- Fixed overlay below the header (top: 64px). Header remains visible.
- Spacing uses an 18px scale (header padding, body padding, grid gap).
- While open, header settings (right) and most left‑side toolbar items fade out to reduce clutter; the Mosaic toggle remains visible.
- Header center title switches to “All Posts Open” / “All Pages Open”.

Grid
----

- Tiles render 4:3 live previews via `<BlockPreview>` (editor styles), with a skeleton shimmer cross‑fade to avoid flash.
- Adaptive columns by viewport:
  - 1 (mobile), 2 (small tablet ≥600px), 3 (tablet ≥782px), 4 (≥960px), 5 (≥1280px).
- We clamp columns to `min(items + plus, maxColumnsByViewport)` so a few tiles don’t look sparse.
- “+ New” tile sits at the end (right). Uses the same 4:3 frame, large light‑grey “+” icon; hover brightens it. Includes `aria-label` and `title`.
- Hover title overlay shows “Title • Status” with a subtle gradient using the same grey base (#45464A). The overlay appears on hover and respects border radius.

Filters & search
----------------

- Status filter (All/Draft/Published/Scheduled/Private) sits next to the SearchControl.
- Default: “All” (includes drafts) via REST `status=any`.
- Search is debounced; we keep the previous page‑1 results visible while the next query resolves (overlay spinner shows) to avoid “bounce”.

Infinite scroll
---------------

- Uses an IntersectionObserver sentinel below the grid to auto‑load subsequent pages.
- Per‑page is 20 (adjust as needed).

Tile menu (⋯)
--------------

On hover, top‑right menu provides:

- Open in new tab (admin editor)
- Preview on site (front‑end permalink)
- Copy link (front‑end)
- Copy edit link (admin)
- Duplicate (creates a draft via core‑data; snackbar + opens in new tab)
- View revisions (opens edit screen with #revisions)
- Move to trash (destructive; snackbar)

Permissions should be respected automatically via core‑data. Add visibility guards if needed.

Accessibility
-------------

- Overlay: `role="dialog"` + `aria-modal="true"`. Esc closes.
- Tiles are anchors (tabbable). Each tile has `aria-label` like “{Title} • {Status}”.
- Menu trigger uses DropdownMenu with label “More actions for {Title}”.
- Plus tile includes `aria-label` and `title` (“Create a new {type}”).

Implementation notes
--------------------

- Experiment toggle: `lib/experiments-page.php` (`gutenberg-mosaic-view`). Flag injected from `lib/experimental/editor-settings.php`.
- Top offset: overlay CSS sets `top: 64px`.
- Preview flash: content and skeleton are absolutely positioned and cross‑faded.
- Spacing: 18px scale for header/body/grid.

Files
-----

- `index.js` — overlay, header, filters, grid, preview, infinite scroll, tile actions.
- `style.scss` — layout, spacing, grid, skeleton, title overlay, menu trigger styles.
