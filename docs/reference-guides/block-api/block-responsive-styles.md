# Responsive Styles (Experimental)

> **Experimental.** This feature is gated behind the `gutenberg-responsive-styles` experiment (Gutenberg → Experiments). The data shape is provisional; see caveats at the bottom before depending on it.

Responsive Styles lets a site author set **per-breakpoint overrides** on any block style attribute (typography, spacing, colors, borders, dimensions, background) without each block having to opt in. The experiment introduces a single cross-cutting layer — mirroring how the `style` attribute works today, but keyed by breakpoint.

## Mental model

At the top of the editor header sits a breakpoint selector (Desktop / Tablet / Mobile). It is not a preview toggle — it is an **editing mode**. Selecting Mobile:

-   Resizes the canvas to mobile width (shared state with the Preview dropdown, so there is only one "current device").
-   Routes all subsequent style edits into `attributes.responsive.mobile` instead of `attributes.style`.
-   Leaves non-style attributes (content, block-specific configuration) untouched.

When the user switches back to Desktop, they see the base values again — the mobile overrides persist on the block but do not visually override the canvas (the canvas is now wide). On the frontend, cascading `max-width` media queries apply the overrides at the right viewport.

## Attribute shape

Every block with style supports is registered with an additional top-level `responsive` attribute:

```json
{
	"style": {
		"typography": { "fontSize": "32px" },
		"spacing": { "padding": "40px" }
	},
	"fontSize": "large",
	"responsive": {
		"tablet": {
			"style": { "typography": { "fontSize": "24px" } },
			"backgroundColor": "accent-3"
		},
		"mobile": {
			"style": {
				"typography": { "fontSize": "16px" },
				"spacing": { "padding": "16px" }
			},
			"fontSize": "small"
		}
	}
}
```

Each breakpoint entry mirrors the block's style-adjacent attribute surface: a nested `style` tree (for custom values) alongside scalar preset keys (`fontSize`, `fontFamily`, `textColor`, `backgroundColor`, `gradient`). See `ROUTABLE_KEYS` in `packages/block-editor/src/hooks/responsive.js`.

Key properties:

-   **Desktop is the base.** `attributes.style` and the top-level preset attributes render unconditionally. There is no `attributes.responsive.desktop` — desktop edits go to the block's top-level attributes directly.
-   **Sparse.** Each breakpoint key only contains deltas from the base. Breakpoints are bounded, non-overlapping ranges at render time, so a style set at tablet fires at tablet widths only (it does NOT inherit down into mobile). If you want the same value on both, set it on both — or set it on the base.
-   **Reset = deletion.** Clearing an override at a breakpoint removes the key. When the last override at a breakpoint is reset, the whole breakpoint entry is pruned. When the last breakpoint is removed, the whole `responsive` attribute becomes `undefined` and is not serialized.

## Rendering

`lib/block-supports/responsive.php` hooks into `render_block`. For each breakpoint with overrides it compiles the override bundle via `gutenberg_style_engine_get_styles()` (for the nested `style` tree) plus preset-slug resolution (for `fontSize`, `textColor`, …), and emits a **CSS range-syntax media query** through the Style Engine's `rules_group` facility. The shared `gutenberg_build_responsive_media_queries()` in `lib/block-supports/responsive-breakpoints.php` does the query construction. A deterministic 8-character hash of the `responsive` tree becomes the wrapping class, so two blocks with identical overrides share one CSS rule.

```css
/* base style renders inline on the block */
.wp-block-paragraph { font-size: 32px; }

/* each breakpoint is a bounded range — tablet does NOT bleed into mobile */
@media (480px < width <= 782px) {
	.wp-responsive-ab12cd34 { font-size: 24px; }
}
@media (width <= 480px) {
	.wp-responsive-ab12cd34 { font-size: 16px; }
}
```

## Breakpoints

Breakpoints come from `theme.json`:

```json
{
	"settings": {
		"custom": {
			"responsive": {
				"breakpoints": {
					"mobile": { "name": "Mobile", "size": "480px" },
					"tablet": { "name": "Tablet", "size": "782px" }
				}
			}
		}
	}
}
```

They fall back to sensible defaults (matching block visibility) when no theme.json entry is present. Declare smaller sizes first; the shared builder walks the list in order to generate bounded, non-overlapping range queries.

The `custom.responsive` namespace is used deliberately because the first-class theme.json schema for breakpoints is still under discussion (see [issue #75707](https://github.com/WordPress/gutenberg/issues/75707)). Moving to a first-class location later is a schema migration rather than a redesign.

## Architectural notes

### The interception layer

The core insight is in `packages/block-editor/src/hooks/responsive.js`. Instead of modifying every style hook (font-size, color, spacing, border…) to be breakpoint-aware, a single `editor.BlockEdit` filter wraps every block's Edit component. When the active breakpoint is not Desktop:

1.  `attributes.style` as seen by child controls is `deepMerge(base, responsive[bp])` — controls read the effective value at the current breakpoint.
2.  `setAttributes({ style: newStyle })` is intercepted: the diff of `newStyle` against `base.style` is written to `responsive[bp]` (sparse). Non-style keys pass through unchanged.
3.  Deep equality drops noop updates; empty subtrees prune up; reset at a breakpoint removes the key.

This mirrors the approach real-time collaboration uses for CRDT operations — wrap once at the boundary, every block benefits without knowing about it.

### Canvas resizing

Selecting a breakpoint dispatches `setDeviceType` on the editor store, which is also what the Preview dropdown drives. One state, two views — no dual-source-of-truth problem.

### Serialization

The `responsive` attribute serializes like any other block attribute, in the comment delimiter JSON. Patterns — synced or otherwise — carry overrides through insertion and save cycles without special handling.

## Caveats and follow-ups

-   **Per-control dots.** The current release ships an Inspector overrides panel, a block-toolbar dropdown, and a corner dot on the block in the canvas. Figma-style per-control indicator dots on individual `ToolsPanelItem`s are not wired (would require modifying every style hook to expose its attribute path).
-   **`deviceType` coupling.** The breakpoint context reads from and dispatches to `core/editor`, which is one layer above `@wordpress/block-editor`. The coupling is documented in `breakpoint-context.js` and is intended to be replaced with a layer-neutral bridge once the experiment graduates.
-   **Container queries.** The render layer uses viewport media queries only. Container-query support ([#57719](https://github.com/WordPress/gutenberg/issues/57719)) is a separate project.
-   **Data stability.** The `responsive` attribute shape is considered provisional until the experiment graduates. Content saved against it will remain readable across shape refinements (any migration will happen in a deprecation) but extensions should not depend on the current key names before the experiment is promoted.

## Disabling per block type

A block type can opt out by declaring `supports.responsive: false` in its `block.json`. The global `blocks.registerBlockType` filter respects this flag and skips attribute registration.

## Related

-   [#19909](https://github.com/WordPress/gutenberg/issues/19909) — Responsive previewing and device-specific editing
-   [#75707](https://github.com/WordPress/gutenberg/issues/75707) — Configurable breakpoints in theme.json
-   [#72502](https://github.com/WordPress/gutenberg/issues/72502) — Block visibility (shipped in 7.0)
-   [#73888](https://github.com/WordPress/gutenberg/pull/73888) — Prior POC exploring responsive editing mode
