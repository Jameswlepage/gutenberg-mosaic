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
- Tile UI: persistent header inside each tile (left avatar, centered title, right ⋯ menu). Entire tile frame is 4:3; preview fills space below the header.
- Visuals: translucent dark tile backgrounds with subtle backdrop blur for depth; hover title overlay removed in favor of the always‑visible header.
- Columns: responsive grid caps at a maximum of 4 columns on wide viewports.

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
- Previews: BlockPreview fills the tile body; skeleton shimmer fades to content.
- Layout: responsive grid, columns 1→4 by viewport; clamp to `min(items+plus, maxByViewport)`.
- Keyboard & a11y:
  - Esc closes; Arrow keys move focus across tiles; Enter/Space open; Shift+F10/ContextMenu opens the tile menu.
  - Tab/Shift+Tab step through tiles inside the grid; overlay focus trap manages Tab only when focus is outside the grid.
  - role="dialog" + aria-modal="true"; roving tabindex across tiles.
  - Focus indicator: tiles use the same focus ring style as native inputs (box‑shadow 0 0 0 2px var(--wp-admin-theme-color)).
- Command Palette: while Mosaic is open, suggests Close Mosaic and New {type}; Site Editor also suggests Edit template.
- List View CTA: When the experiment is enabled, a button labeled “Add new {Type}” appears at the bottom of the List View tab. Clicking it opens `post-new.php?post_type={Type}`.
- Avatars (collab editing): optional `getEditorsForItem(record)` renders a small avatar/indicator for active editors on that post/page. In this experiment we only surface the current user on the active item; when collaborative editing presence APIs are available, this can be expanded to show multiple concurrent editors.

Styling tokens
--------------
The overlay and tiles support CSS variables with fallbacks:
- --wp-mosaic-top-offset (default 64px)
- --wp-mosaic-radius (default 4px)
- --wp-mosaic-tile-bg (default #45464A)

What’s experiment‑specific (current scope)
-----------------------------------------
- Toolbar integration hides most right‑side controls while Mosaic is open; if there are unsaved changes, only the Save/Publish button remains visible.
- Site Editor portals overlay into the canvas when viewing content (canvas=view), and uses a fixed overlay otherwise.
- Header inside each tile (avatar | centered title | ⋯ menu) replaces the previous hover title overlay.

Future work
-----------
- Seamless open/close animations and intra‑editor navigation without full page reloads. The goal is SPA‑style transitions (e.g., fade/scale canvas to open Mosaic; cross‑fade when opening an item) so moving between items feels instantaneous. This likely involves deeper integration with Post/Site editor routing and preloading.
- Presence indicators: show collaborator avatars on items when other authors are editing those posts/pages, and indicate the active post more explicitly. This requires a real presence/locking API; we deliberately do not roll our own. When available, use it to surface stacked avatars (with proper a11y) in the header.

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
