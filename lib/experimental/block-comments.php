<?php
/**
 * Updates the comment type in the REST API.
 *
 * This function is used as a filter callback for the 'rest_pre_insert_comment' hook.
 * It checks if the 'comment_type' parameter is set to 'block_comment' in the REST API request,
 * and if so, updates the 'comment_type' and 'comment_approved' properties of the prepared comment.
 *
 * @param array $prepared_comment The prepared comment data.
 * @param WP_REST_Request $request The REST API request object.
 * @return array The updated prepared comment data.
 */
if ( ! function_exists( 'update_comment_type_in_rest_api_6_8' ) ) {
	function update_comment_type_in_rest_api_6_8( $prepared_comment, $request ) {
		// Handle both block_comment and block_suggestion types
		if ( ! empty( $request['comment_type'] ) && in_array( $request['comment_type'], [ 'block_comment', 'block_suggestion' ] ) ) {
			$prepared_comment['comment_type']     = $request['comment_type'];
			$prepared_comment['comment_approved'] = $request['comment_approved'];
		}

		return $prepared_comment;
	}
	add_filter( 'rest_pre_insert_comment', 'update_comment_type_in_rest_api_6_8', 10, 2 );
}

/**
 * Updates the comment type for avatars in the WordPress REST API.
 *
 * This function adds the 'block_comment' type to the list of comment types
 * for which avatars should be retrieved in the WordPress REST API.
 *
 * @param array $comment_type The array of comment types.
 * @return array The updated array of comment types.
 */
if ( ! function_exists( 'update_get_avatar_comment_type' ) ) {
	function update_get_avatar_comment_type( $comment_type ) {
		$comment_type[] = 'block_comment';
		$comment_type[] = 'block_suggestion';
		return $comment_type;
	}
	add_filter( 'get_avatar_comment_types', 'update_get_avatar_comment_type' );
}

/**
 * Excludes block comments from the admin comments query.
 *
 * This function modifies the comments query to exclude comments of type 'block_comment'
 * when the query is for comments in the WordPress admin.
 *
 * @param WP_Comment_Query $query The current comments query.
 *
 * @return void
 */
if ( ! function_exists( 'exclude_block_comments_from_admin' ) ) {
	function exclude_block_comments_from_admin( $query ) {
		// Only modify the query if it's for comments
		if ( isset( $query->query_vars['type'] ) && '' === $query->query_vars['type'] ) {
			$query->set( 'type', '' );

			add_filter(
				'comments_clauses',
				function ( $clauses ) {
					global $wpdb;
					// Exclude comments of type 'block_comment' and 'block_suggestion'
					$clauses['where'] .= " AND {$wpdb->comments}.comment_type NOT IN ('block_comment', 'block_suggestion')";
					return $clauses;
				}
			);
		}
	}
	add_action( 'pre_get_comments', 'exclude_block_comments_from_admin' );
}

/**
 * Register suggestion meta fields for REST API access.
 * 
 * This ensures our custom suggestion metadata is available via the REST API.
 */
if ( ! function_exists( 'register_suggestion_meta_fields' ) ) {
	function register_suggestion_meta_fields() {
		$meta_fields = [
			'suggestion_type',
			'suggestion_status', 
			'block_client_id',
			'block_type',
			'original_content',
			'suggested_content',
			'diff_data',
			'patches_data',
			'suggestion_block_id',
			'suggestion_author_id',
			'suggestion_created',
			'suggestion_updated',
		];

		foreach ( $meta_fields as $meta_key ) {
			register_meta( 'comment', $meta_key, [
				'show_in_rest' => true,
				'single'       => true,
				'type'         => 'string',
				'default'      => '',
			] );
		}
	}
	add_action( 'init', 'register_suggestion_meta_fields' );
}

/**
 * Handle duplicate detection for suggestions.
 * 
 * Suggestions are iterative by nature - the same block can have multiple 
 * updates to the same suggestion. This prevents WordPress from treating
 * suggestion updates as spam/duplicates.
 *
 * @param int $dupe_id The ID of the duplicate comment, if found.
 * @param array $commentdata The comment data.
 * @return int The duplicate comment ID, or 0 if not a duplicate.
 */
if ( ! function_exists( 'handle_suggestion_duplicate_detection' ) ) {
	function handle_suggestion_duplicate_detection( $dupe_id, $commentdata ) {
		// If this is a block suggestion, allow it to bypass default duplicate detection
		if ( isset( $commentdata['comment_type'] ) && 'block_suggestion' === $commentdata['comment_type'] ) {
			// For suggestions, we want to update existing ones rather than create duplicates
			// This is handled by our JavaScript update logic, so allow the request through
			return 0; // No duplicate - allow it
		}

		// For non-suggestions, use default WordPress behavior
		return $dupe_id;
	}
	add_filter( 'duplicate_comment_id', 'handle_suggestion_duplicate_detection', 10, 2 );
}
