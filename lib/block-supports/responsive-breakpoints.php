<?php
/**
 * Shared responsive-breakpoint plumbing.
 *
 * Single source of truth for breakpoint SIZES and media-query construction,
 * consumed by both `block-visibility.php` (per-viewport show/hide, shipped
 * WP 7.0) and `responsive.php` (per-viewport style overrides, experimental).
 *
 * Splitting this out removes the 4-way duplication we had across PHP (two
 * block-supports files) and JS (two constants.js), and gives issue #75707
 * (theme.json breakpoint integration) a single place to wire the schema
 * into. Both features stay independent at the UI and data layers; this only
 * consolidates the "what is a mobile viewport?" conversation.
 *
 * @package gutenberg
 */

if ( ! function_exists( 'gutenberg_get_responsive_breakpoints' ) ) {
	/**
	 * Breakpoint size definitions. Reads from theme.json
	 * `settings.custom.responsive.breakpoints` when the theme defines them;
	 * otherwise returns defaults that match block-visibility's shipped
	 * configuration.
	 *
	 * Expected theme.json shape:
	 *   settings.custom.responsive.breakpoints = {
	 *       "mobile": { "name": "Mobile", "size": "480px" },
	 *       "tablet": { "name": "Tablet", "size": "782px" }
	 *   }
	 *
	 * Order is preserved; smaller sizes should appear first so that at mobile
	 * width every applicable rule cascades (CSS source order wins).
	 *
	 * The `custom.responsive` namespace is deliberate — the first-class
	 * `settings.responsive` schema is still being designed (see #75707);
	 * moving there later is a schema migration, not a code rewrite.
	 *
	 * @return array Breakpoint slugs mapped to `{ name, size }`.
	 */
	function gutenberg_get_responsive_breakpoints() {
		$defaults = array(
			'mobile' => array(
				'name' => 'Mobile',
				'size' => '480px',
			),
			'tablet' => array(
				'name' => 'Tablet',
				'size' => '782px',
			),
		);

		if ( ! class_exists( 'WP_Theme_JSON_Resolver' ) ) {
			return $defaults;
		}

		$theme_json = WP_Theme_JSON_Resolver::get_merged_data();
		$raw_data   = $theme_json->get_raw_data();
		$from_theme = $raw_data['settings']['custom']['responsive']['breakpoints'] ?? null;

		if ( ! is_array( $from_theme ) || empty( $from_theme ) ) {
			return $defaults;
		}

		$normalized = array();
		foreach ( $from_theme as $slug => $config ) {
			if ( ! is_string( $slug ) || empty( $config['size'] ) ) {
				continue;
			}
			$normalized[ sanitize_key( $slug ) ] = array(
				'name' => isset( $config['name'] ) ? (string) $config['name'] : ucfirst( $slug ),
				'size' => (string) $config['size'],
			);
		}

		return ! empty( $normalized ) ? $normalized : $defaults;
	}
}

if ( ! function_exists( 'gutenberg_build_responsive_media_queries' ) ) {
	/**
	 * Build per-breakpoint media queries using CSS range syntax so each slug
	 * corresponds to a bounded viewport band that does NOT cascade into the
	 * smaller slug. A style set at "tablet" applies to tablet widths only,
	 * not to mobile.
	 *
	 * Sample output for breakpoints [ mobile => 480px, tablet => 782px ]:
	 *   mobile → @media (width <= 480px)
	 *   tablet → @media (480px < width <= 782px)
	 *
	 * The incoming breakpoint array should be ordered smallest-first, which
	 * is how `gutenberg_get_responsive_breakpoints()` returns it.
	 *
	 * @param array $breakpoints Breakpoint definitions keyed by slug.
	 * @return array             Media-query strings keyed by slug.
	 */
	function gutenberg_build_responsive_media_queries( $breakpoints ) {
		$queries       = array();
		$previous_size = null;
		$slugs         = array_keys( $breakpoints );
		$count         = count( $slugs );

		foreach ( $slugs as $index => $slug ) {
			$size = $breakpoints[ $slug ]['size'] ?? null;
			if ( 0 === $index ) {
				// Smallest band — anything from 0 up to the first size.
				$queries[ $slug ] = sprintf( '@media (width <= %s)', $size );
			} elseif ( $count - 1 === $index && null === $size ) {
				// Optional unbounded upper band (Desktop, if a theme ever
				// declares it with a null size). Not used by defaults.
				$queries[ $slug ] = sprintf( '@media (width > %s)', $previous_size );
			} else {
				$queries[ $slug ] = sprintf(
					'@media (%s < width <= %s)',
					$previous_size,
					$size
				);
			}
			$previous_size = $size;
		}

		return $queries;
	}
}
