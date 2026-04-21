/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { desktop, tablet, mobile } from '@wordpress/icons';

/**
 * Breakpoints available for responsive style editing. `desktop` is the base
 * (renders without a media query; its styles apply whenever no narrower
 * bp rule matches). Non-base entries are emitted by the PHP side as
 * non-overlapping CSS range-syntax media queries — e.g. `@media (width <= 480px)`
 * for mobile and `@media (480px < width <= 782px)` for tablet — so a style
 * set at tablet applies to tablet widths only and does NOT cascade into
 * mobile. See `gutenberg_build_responsive_media_queries()` in
 * `lib/block-supports/responsive-breakpoints.php` for the emitted form.
 *
 * Sizes come from `window.__experimentalResponsiveBreakpoints` when
 * available (injected by PHP after reading theme.json — see
 * lib/block-supports/responsive.php and lib/experimental/editor-settings.php).
 * Otherwise uses sensible defaults that match block visibility.
 */
export const DEFAULT_BREAKPOINT = 'desktop';

const ICONS_BY_SLUG = {
	desktop,
	tablet,
	mobile,
};

const FALLBACK_BREAKPOINTS = {
	mobile: { name: 'Mobile', size: '480px' },
	tablet: { name: 'Tablet', size: '782px' },
};

function readBreakpoints() {
	if ( typeof window === 'undefined' ) {
		return FALLBACK_BREAKPOINTS;
	}
	const fromPhp = window.__experimentalResponsiveBreakpoints;
	if ( fromPhp && typeof fromPhp === 'object' ) {
		return fromPhp;
	}
	return FALLBACK_BREAKPOINTS;
}

function buildBreakpoints() {
	const themed = readBreakpoints();
	const out = {
		[ DEFAULT_BREAKPOINT ]: {
			label: __( 'Desktop' ),
			icon: ICONS_BY_SLUG.desktop,
			key: DEFAULT_BREAKPOINT,
			isBase: true,
			size: null,
		},
	};
	// Preserve theme ordering so CSS source order (emitted by PHP) remains
	// smallest-last for correct cascade.
	for ( const [ slug, config ] of Object.entries( themed ) ) {
		out[ slug ] = {
			label: config.name ?? slug,
			icon: ICONS_BY_SLUG[ slug ] ?? ICONS_BY_SLUG.mobile,
			key: slug,
			isBase: false,
			size: config.size,
		};
	}
	return out;
}

export const RESPONSIVE_BREAKPOINTS = buildBreakpoints();

/**
 * CSS source-order list: base (no-size) first, then breakpoints largest-first
 * going down. This is only used internally if any render ever needs it; the
 * PHP render iterates the map directly.
 */
export const RESPONSIVE_BREAKPOINT_ORDER = Object.keys(
	RESPONSIVE_BREAKPOINTS
);

/**
 * Display order for the header selector — desktop → tablet → mobile, largest
 * to smallest, matching Webflow / Figma-Sites conventions for breakpoint
 * switchers. Computed by sorting non-base breakpoints by numeric pixel size
 * (largest first) and prepending Desktop.
 * @param size
 */
function parseSize( size ) {
	if ( ! size ) {
		return Infinity;
	}
	const match = String( size ).match( /^([\d.]+)/ );
	return match ? parseFloat( match[ 1 ] ) : 0;
}

export const RESPONSIVE_BREAKPOINT_DISPLAY_ORDER = Object.entries(
	RESPONSIVE_BREAKPOINTS
)
	.sort( ( [ , a ], [ , b ] ) => parseSize( b.size ) - parseSize( a.size ) )
	.map( ( [ slug ] ) => slug );
