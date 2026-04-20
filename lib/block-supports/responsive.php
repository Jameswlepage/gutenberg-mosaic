<?php
/**
 * Responsive styles block support.
 *
 * Applies per-breakpoint style overrides stored on the `responsive` block
 * attribute. The base `style` attribute renders unconditionally (desktop);
 * each breakpoint in `responsive` emits a max-width media query that overrides
 * the base via CSS source-order cascade. Sparse: a breakpoint only contains
 * deltas from the base.
 *
 * Behind the `gutenberg-responsive-styles` experiment.
 *
 * @package gutenberg
 */

require_once __DIR__ . '/responsive-breakpoints.php';

/**
 * Compile declarations for a single breakpoint's override bundle.
 *
 * The bundle mirrors the shape of the block's style-adjacent attributes:
 *   array(
 *       'style'           => array( 'typography' => array( 'fontSize' => '14px' ), ... ),
 *       'fontSize'        => 'small',   // preset slug
 *       'fontFamily'      => 'system',
 *       'textColor'       => 'primary',
 *       'backgroundColor' => 'dark',
 *       'gradient'        => 'sunset',
 *   )
 *
 * Custom-value edits (nested `style` tree) round-trip through the Style
 * Engine. Preset slugs resolve at runtime via CSS custom properties emitted
 * by theme.json — no duplicate preset table maintained here.
 *
 * @param array $override Per-breakpoint override bundle.
 * @return array Array of CSS declarations keyed by property.
 */
function gutenberg_compile_responsive_declarations( $override ) {
	if ( empty( $override ) || ! is_array( $override ) ) {
		return array();
	}

	$declarations = array();

	if ( ! empty( $override['style'] ) && is_array( $override['style'] ) ) {
		$compiled = gutenberg_style_engine_get_styles(
			$override['style'],
			array( 'convert_vars_to_classnames' => false )
		);
		if ( ! empty( $compiled['declarations'] ) ) {
			$declarations = array_merge( $declarations, $compiled['declarations'] );
		}
	}

	$preset_map = array(
		'fontSize'        => array( 'font-size', 'font-size' ),
		'fontFamily'      => array( 'font-family', 'font-family' ),
		'textColor'       => array( 'color', 'color' ),
		'backgroundColor' => array( 'background-color', 'color' ),
		'gradient'        => array( 'background-image', 'gradient' ),
	);

	foreach ( $preset_map as $attr => list( $css_prop, $preset_bucket ) ) {
		if ( empty( $override[ $attr ] ) ) {
			continue;
		}
		$slug = sanitize_key( $override[ $attr ] );
		if ( '' === $slug ) {
			continue;
		}
		$declarations[ $css_prop ] = sprintf(
			'var(--wp--preset--%s--%s)',
			$preset_bucket,
			$slug
		);
	}

	/*
	 * Preset-backed color / font-size classes in theme.json are emitted with
	 * `!important` (see `has-<slug>-background-color { … !important }`). A
	 * responsive override without `!important` cannot beat them even at equal
	 * specificity, so the override silently applies to the wrapper (which has
	 * no preset class) while the element that DOES carry the preset keeps its
	 * base color. Append `!important` to every declaration so overrides win
	 * consistently. `block-visibility.php` uses the same workaround.
	 */
	foreach ( $declarations as $property => $value ) {
		if ( false === strpos( (string) $value, '!important' ) ) {
			$declarations[ $property ] = $value . ' !important';
		}
	}

	return $declarations;
}

/**
 * Generate a deterministic class slug from the responsive override tree so
 * identical overrides across blocks share a single CSS rule.
 *
 * @param array $responsive Responsive attribute (keyed by breakpoint slug).
 * @return string Class suffix (8-char hash).
 */
function gutenberg_get_responsive_class( $responsive ) {
	return substr( md5( wp_json_encode( $responsive ) ), 0, 8 );
}

/**
 * Scope a block-registered feature selector to a single responsive instance.
 *
 * My unique class lands on the first HTML tag the `WP_HTML_Tag_Processor`
 * walks (Button → the outer `.wp-block-button` div; Paragraph → the `<p>`;
 * Image → the `<figure>`). The registered feature selector describes the
 * global target — Button color returns `.wp-block-button .wp-block-button__link`
 * where the target is a *descendant* of the class-carrying element, while
 * Paragraph color returns `p` where the target IS the class-carrying element.
 *
 * Compound (space-separated) selectors mean "descendant target" — my class is
 * on the ancestor so we rewrite as `.<class> <descendant-tail>`. Single-token
 * selectors mean "same-element target" so we qualify with the class directly.
 * This heuristic avoids depending on `$block_type->selectors['root']`, which
 * we've observed drift to mean different things across blocks.
 *
 * Handles comma-separated compound selectors (e.g. Image border registers
 * three targets at once) by scoping each independently.
 *
 * @param string $feature_selector Selector returned by wp_get_block_css_selector().
 * @param string $class_slug       Unique per-instance class (no leading dot).
 * @return string|null             Scoped selector, or null if inputs are empty.
 */
function gutenberg_scope_responsive_selector( $feature_selector, $class_slug ) {
	if ( empty( $feature_selector ) || empty( $class_slug ) ) {
		return null;
	}
	$parts  = array_map( 'trim', explode( ',', $feature_selector ) );
	$scoped = array();
	foreach ( $parts as $part ) {
		if ( '' === $part ) {
			continue;
		}
		if ( false !== strpos( $part, ' ' ) ) {
			// Descendant target. Drop the original root token and make our
			// class the new ancestor; the remainder stays intact.
			$first_space = strpos( $part, ' ' );
			$tail        = trim( substr( $part, $first_space + 1 ) );
			$scoped[]    = '.' . $class_slug . ' ' . $tail;
		} else {
			// Same-element target — the feature element is the class bearer.
			$scoped[] = $part . '.' . $class_slug;
		}
	}
	return empty( $scoped ) ? null : implode( ', ', $scoped );
}

/**
 * Render callback: append responsive CSS and tag the block wrapper.
 *
 * @param string $block_content Rendered block content.
 * @param array  $block         Parsed block.
 * @return string Filtered block content.
 */
function gutenberg_render_responsive_styles_support( $block_content, $block ) {
	if ( ! gutenberg_is_experiment_enabled( 'gutenberg-responsive-styles' ) ) {
		return $block_content;
	}

	$responsive = $block['attrs']['responsive'] ?? null;
	if ( empty( $responsive ) || ! is_array( $responsive ) ) {
		return $block_content;
	}

	// Respect the per-block opt-out declared in block.json as
	// `supports.responsive: false`.
	$block_type = WP_Block_Type_Registry::get_instance()->get_registered( $block['blockName'] );
	if ( $block_type && false === block_has_support( $block_type, 'responsive', true ) ) {
		return $block_content;
	}

	$breakpoints    = gutenberg_get_responsive_breakpoints();
	$media_queries  = gutenberg_build_responsive_media_queries( $breakpoints );
	$class_slug     = 'wp-responsive-' . gutenberg_get_responsive_class( $responsive );
	$css_rules      = array();

	/*
	 * Each block registers which element owns which style feature (color,
	 * typography, spacing, border, …) via `__experimentalSelector` on its
	 * block-supports config. `wp_get_block_css_selector()` reads that
	 * registry — Button's color target is `.wp-block-button__link`, not the
	 * outer wrapper. A single catch-all selector both over-applied (yellow
	 * rectangle around the pill) AND bled styles onto elements the feature
	 * wasn't intended to touch. Bucketing declarations per feature and
	 * emitting each bucket against its registered selector matches how base
	 * block-supports styles land.
	 */
	$css_property_feature_map = array(
		'color'                => array( 'color', 'background-color', 'background-image', 'background' ),
		'typography'           => array(
			'font-size',
			'font-family',
			'font-style',
			'font-weight',
			'line-height',
			'letter-spacing',
			'text-decoration',
			'text-transform',
			'text-indent',
			'writing-mode',
			'text-columns',
		),
		'spacing'              => array(
			'padding',
			'padding-top',
			'padding-right',
			'padding-bottom',
			'padding-left',
			'margin',
			'margin-top',
			'margin-right',
			'margin-bottom',
			'margin-left',
			'gap',
			'row-gap',
			'column-gap',
		),
		'__experimentalBorder' => array(
			'border',
			'border-radius',
			'border-color',
			'border-style',
			'border-width',
			'border-top',
			'border-top-color',
			'border-top-style',
			'border-top-width',
			'border-top-left-radius',
			'border-top-right-radius',
			'border-right',
			'border-right-color',
			'border-right-style',
			'border-right-width',
			'border-bottom',
			'border-bottom-color',
			'border-bottom-style',
			'border-bottom-width',
			'border-bottom-left-radius',
			'border-bottom-right-radius',
			'border-left',
			'border-left-color',
			'border-left-style',
			'border-left-width',
		),
		'dimensions'           => array( 'min-height', 'aspect-ratio', 'width', 'height' ),
		'shadow'               => array( 'box-shadow' ),
	);

	// Convention fallback for blocks that don't register a root selector.
	$conventional_root = '.' . $class_slug;

	foreach ( $breakpoints as $bp_slug => $breakpoint ) {
		$override     = $responsive[ $bp_slug ] ?? null;
		$declarations = gutenberg_compile_responsive_declarations( $override );
		if ( empty( $declarations ) || empty( $media_queries[ $bp_slug ] ) ) {
			continue;
		}

		$remainder = $declarations;
		$buckets   = array();
		foreach ( $css_property_feature_map as $feature => $props ) {
			$picked = array();
			foreach ( $props as $prop ) {
				if ( isset( $remainder[ $prop ] ) ) {
					$picked[ $prop ] = $remainder[ $prop ];
					unset( $remainder[ $prop ] );
				}
			}
			if ( empty( $picked ) ) {
				continue;
			}
			$feature_selector = $block_type
				? wp_get_block_css_selector( $block_type, array( $feature ), true )
				: null;
			$scoped = $feature_selector
				? gutenberg_scope_responsive_selector( $feature_selector, $class_slug )
				: $conventional_root;
			if ( empty( $scoped ) ) {
				continue;
			}
			$buckets[] = array(
				'selector'     => $scoped,
				'declarations' => $picked,
			);
		}

		// Any declarations not matched by a feature bucket (transforms,
		// filters, etc.) fall back to the class-bearing element itself.
		if ( ! empty( $remainder ) ) {
			$buckets[] = array(
				'selector'     => $conventional_root,
				'declarations' => $remainder,
			);
		}

		foreach ( $buckets as $bucket ) {
			if ( empty( $bucket['selector'] ) ) {
				continue;
			}
			$css_rules[] = array(
				'selector'     => $bucket['selector'],
				'declarations' => $bucket['declarations'],
				'rules_group'  => $media_queries[ $bp_slug ],
			);
		}
	}

	if ( empty( $css_rules ) ) {
		return $block_content;
	}

	gutenberg_style_engine_get_stylesheet_from_css_rules(
		$css_rules,
		array(
			'context'  => 'block-supports',
			'prettify' => false,
		)
	);

	if ( empty( $block_content ) ) {
		return $block_content;
	}

	$processor = new WP_HTML_Tag_Processor( $block_content );
	if ( $processor->next_tag() ) {
		$processor->add_class( $class_slug );
		$block_content = $processor->get_updated_html();
	}

	return $block_content;
}

add_filter( 'render_block', 'gutenberg_render_responsive_styles_support', 10, 2 );
