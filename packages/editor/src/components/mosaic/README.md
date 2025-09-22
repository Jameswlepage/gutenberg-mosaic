Mosaic View (Experiment)
========================

Overview
--------
An experimental “Mosaic” overlay for quickly navigating between Posts/Pages (and potentially CPTs) from within the editors. It renders a responsive grid of live block previews with search, sort, status filters, and quick actions.

Highlights
---------
- Experiment-gated; toggle under wp-admin → Gutenberg → Experiments.
- Works in Post and Site editors using one shared component (MosaicOverlay) with thin wrappers.
  - Post Editor: fixed overlay below toolbar (top offset) covering the editor canvas.
  - Site Editor: when canvas=view, the overlay is portaled inside the preview canvas; when canvas=edit it behaves like Post Editor.
- Keyboard: Esc closes; Arrow keys move focus across tiles; Enter opens; Shift+F10/ContextMenu opens tile menu.
- Command Palette: while Mosaic is open, suggests Close Mosaic and New {type}; Site Editor also suggests Edit template.
- Infinite scroll; debounced search; block parse cache; preview skeleton cross‑fade.

Files (entry points)
--------------------
- Shared overlay (this package): packages/editor/src/components/mosaic/overlay.js (exported as MosaicOverlay)
- Toolbar integration: packages/editor/src/components/document-tools/
- Post Editor wrapper: packages/edit-post/src/components/mosaic-view/index.js
- Site Editor wrapper (+styles and portal): packages/edit-site/src/components/mosaic-view/{index.js,style.scss}
 - List View CTA: experiment adds a footer button at the bottom of the List View sidebar (Post/Site editors) to create a new item of the current type.

Key implementation notes
------------------------
- Feature flag: Toggle in wp-admin → Gutenberg → Experiments.
- State: open/close uses preferencesStore key `core/edit-post:mosaicViewOpen` (shared across editors by design).
- Data: `useEntityRecords` for ‘post’/‘page’ with search/sort/status/pagination.
- Previews: BlockPreview inside a 4:3 frame; skeleton shimmer fades to content.
- Layout: responsive grid, columns 1→5 by viewport; clamp to `min(items+plus, maxByViewport)`.
- Keyboard & a11y:
  - Esc closes; Arrow keys move focus across tiles; Enter/Space open; Shift+F10/ContextMenu opens the tile menu.
  - Tab/Shift+Tab step through tiles inside the grid; overlay focus trap manages Tab only when focus is outside the grid.
  - role="dialog" + aria-modal="true"; roving tabindex across tiles.
- Command Palette: while Mosaic is open, suggests Close Mosaic and New {type}; Site Editor also suggests Edit template.
- List View CTA: When the experiment is enabled, a button labeled “Add new {Type}” appears at the bottom of the List View tab. Clicking it opens `post-new.php?post_type={Type}`.
- Avatars: optional `getEditorsForItem(record)` renders a small avatar stack; wrappers currently pass the current user for the active item. There is no bulk “who is editing” endpoint today.

Styling tokens
--------------
The overlay and tiles support CSS variables with fallbacks:
- --wp-mosaic-top-offset (default 64px)
- --wp-mosaic-radius (default 4px)
- --wp-mosaic-tile-bg (default #45464A)

Caveats (experiment)
--------------------
- Uses an html class `is-mosaic-open` for some UI fades; acceptable for the experiment.
- Site Editor portals into `.edit-site-layout__canvas` in canvas=view; acceptable for the experiment.
- No bulk presence/locking endpoint is used. Avatar stack currently reflects only the active editor via wrapper logic.

Wrapper usage
-------------
MosaicOverlay props for wrappers:
- `classPrefix` string — required. Prefix for overlay class names.
- `initialPostType` string — first post type to load.
- `allowTypeSwitch` boolean — show type toggle (Site Editor).
- `onClose` function — called on close (wrappers set the preference).
- `onOpenNew(postType)` — create/navigate to a new item.
- `onOpenItem(event, record)` — optional route override (Site Editor uses internal routing).
- `getItemHref(record)` — edit href for opening/copying.
- `isActiveItem(record)` — mark the active tile (blue dot/avatars area).
- `getEditorsForItem(record)` — optional avatar data array for the tile stack.
