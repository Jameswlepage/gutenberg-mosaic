<?php
/**
 * Block visibility block support flag.
 *
 * @package gutenberg
 */

require_once __DIR__ . '/responsive-breakpoints.php';

/**
 * Render nothing if the block is hidden, or add viewport visibility styles.
 *
 * @param string $block_content Rendered block content.
 * @param array  $block         Block object.
 * @return string Filtered block content.
 */
function gutenberg_render_block_visibility_support( $block_content, $block ) {
	$block_type = WP_Block_Type_Registry::get_instance()->get_registered( $block['blockName'] );

	if ( ! $block_type || ! block_has_support( $block_type, 'visibility', true ) ) {
		return $block_content;
	}

	$block_visibility = $block['attrs']['metadata']['blockVisibility'] ?? null;

	if ( false === $block_visibility ) {
		return '';
	}

	if ( is_array( $block_visibility ) && ! empty( $block_visibility ) ) {
		// Get viewport configuration from nested structure.
		$viewport_config = $block_visibility['viewport'] ?? null;

		// If no viewport config, return unchanged.
		if ( ! is_array( $viewport_config ) || empty( $viewport_config ) ) {
			return $block_content;
		}

		/*
		 * Breakpoint sizes + media-query construction now come from the
		 * shared module (`responsive-breakpoints.php`), which both block
		 * visibility and responsive-styles consume. Block visibility also
		 * needs an unbounded "desktop" upper band for "hide on desktop"
		 * to work — appended here without polluting the shared defaults
		 * that responsive-styles consumes.
		 */
		$viewport_sizes = gutenberg_get_responsive_breakpoints();
		$viewport_sizes['desktop'] = array(
			'name' => 'Desktop',
			'size' => null,
		);
		$viewport_media_queries = gutenberg_build_responsive_media_queries( $viewport_sizes );

		$hidden_on = array();

		// Collect which viewport the block is hidden on (only known viewport sizes).
		foreach ( $viewport_config as $viewport_config_size => $is_visible ) {
			if ( false === $is_visible && isset( $viewport_media_queries[ $viewport_config_size ] ) ) {
				$hidden_on[] = $viewport_config_size;
			}
		}

		// If no viewport sizes have visibility set to false, return unchanged.
		if ( empty( $hidden_on ) ) {
			return $block_content;
		}

		// Maintain consistent order of viewport sizes for class name generation.
		sort( $hidden_on );

		$css_rules   = array();
		$class_names = array();

		foreach ( $hidden_on as $hidden_viewport_size ) {
			/*
			 * If these values ever become user-defined,
			 * they should be sanitized and kebab-cased.
			 */
			$visibility_class = 'wp-block-hidden-' . $hidden_viewport_size;
			$class_names[]    = $visibility_class;
			$css_rules[]      = array(
				'selector'     => '.' . $visibility_class,
				'declarations' => array(
					'display' => 'none !important',
				),
				'rules_group'  => $viewport_media_queries[ $hidden_viewport_size ],
			);
		}

		gutenberg_style_engine_get_stylesheet_from_css_rules(
			$css_rules,
			array(
				'context'  => 'block-supports',
				'prettify' => false,
			)
		);

		if ( ! empty( $block_content ) ) {
			$processor = new WP_HTML_Tag_Processor( $block_content );
			if ( $processor->next_tag() ) {
				$processor->add_class( implode( ' ', $class_names ) );

				/*
				 * Set all IMG tags to be `fetchpriority=auto` so that wp_get_loading_optimization_attributes() won't add
				 * `fetchpriority=high` or increment the media count to affect whether subsequent IMG tags get `loading=lazy`.
				 */
				do {
					if ( 'IMG' === $processor->get_tag() ) {
						$processor->set_attribute( 'fetchpriority', 'auto' );
					}
				} while ( $processor->next_tag() );
				$block_content = $processor->get_updated_html();
			}
		}
	}

	return $block_content;
}

if ( function_exists( 'wp_render_block_visibility_support' ) ) {
	remove_filter( 'render_block', 'wp_render_block_visibility_support' );
}
add_filter( 'render_block', 'gutenberg_render_block_visibility_support', 10, 2 );
