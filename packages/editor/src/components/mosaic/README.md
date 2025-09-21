Mosaic View (Experiment)
========================

Overview
--------
An experimental “Mosaic” overlay for quickly navigating between Posts/Pages (and potentially CPTs) from within the editors. It shows a responsive grid of live block previews with search, sort, status filters, and quick actions.

Highlights
---------
- Experiment-gated; toggle under wp-admin → Gutenberg → Experiments.
- Works in Post and Site editors.
  - Post Editor: fixed overlay below toolbar (top offset) covering the editor canvas.
  - Site Editor: when canvas=view, the overlay is portaled inside the preview canvas; when canvas=edit it behaves like Post Editor.
- Keyboard: Esc closes; Arrow keys move focus across tiles; Enter opens; Shift+F10/ContextMenu opens tile menu.
- Command Palette: while Mosaic is open, suggests Close Mosaic and New {type}; Site Editor also suggests Edit template.
- Infinite scroll; debounced search; block parse cache; preview skeleton cross‑fade.

Files (entry points)
--------------------
- Post Editor: packages/edit-post/src/components/mosaic-view/*
- Site Editor: packages/edit-site/src/components/mosaic-view/*
- Toolbar integration: packages/editor/src/components/document-tools/

Key implementation notes
------------------------
- State: open/close uses preferencesStore key core/edit-post:mosaicViewOpen (shared across editors intentionally for parity).
- Data: useEntityRecords for ‘post’/‘page’ with search/sort/status/pagination.
- Previews: BlockPreview inside 4:3 frame; skeleton shimmer fades to content.
- Layout: responsive grid, columns 1→5 by viewport; clamp to items+plus to avoid sparse rows with few items.
- Accessibility: role="dialog" + aria-modal="true"; focus trap inside overlay; roving tabindex across tiles; menu accessible via keyboard.

Styling tokens
--------------
The overlay and tiles support CSS variables with fallbacks:
- --wp-mosaic-top-offset (default 64px)
- --wp-mosaic-radius (default 4px)
- --wp-mosaic-tile-bg (default #45464A)

Caveats (experiment)
--------------------
- Uses an html class ‘is-mosaic-open’ for some UI fades; safe for the experiment. Consider scoping to a shell wrapper in a future iteration.
- Portal target for Site Editor is a class selector (.edit-site-layout__canvas); acceptable for the experiment.

Future directions
-----------------
- Centralize shared logic under a single component and reuse between editors.
- Replace hard-coded fallbacks with editor/theme tokens where available.
