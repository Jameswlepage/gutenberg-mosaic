<?php
/**
 * Block suggestions functionality.
 *
 * @package gutenberg
 */

/**
 * Registers the block suggestion comment type.
 *
 * @since 6.5.0
 */
function gutenberg_register_block_suggestion_comment_type() {
	// Register the block_suggestion comment type
	add_filter( 'rest_comment_query', 'gutenberg_filter_block_suggestion_comment_query', 10, 2 );
	add_filter( 'rest_comment_collection_params', 'gutenberg_add_block_suggestion_comment_type_param', 10, 1 );
}

/**
 * Filters the comment query to include block_suggestion type.
 *
 * @since 6.5.0
 *
 * @param array           $prepared_args Array of arguments for WP_Comment_Query.
 * @param WP_REST_Request $request       The REST request.
 * @return array Modified arguments.
 */
function gutenberg_filter_block_suggestion_comment_query( $prepared_args, $request ) {
	// Allow filtering by block_suggestion type
	if ( isset( $request['type'] ) && 'block_suggestion' === $request['type'] ) {
		$prepared_args['type'] = 'block_suggestion';
	}
	
	return $prepared_args;
}

/**
 * Adds the block_suggestion type parameter to the REST API.
 *
 * @since 6.5.0
 *
 * @param array $query_params JSON Schema-formatted collection parameters.
 * @return array Modified collection parameters.
 */
function gutenberg_add_block_suggestion_comment_type_param( $query_params ) {
	if ( ! isset( $query_params['type'] ) ) {
		$query_params['type'] = array(
			'description' => __( 'Limit results to comments of a specific type.', 'gutenberg' ),
			'type'        => 'string',
			'enum'        => array( 'comment', 'trackback', 'pingback', 'block_comment', 'block_suggestion' ),
		);
	} else {
		// Add block_suggestion to existing enum
		if ( isset( $query_params['type']['enum'] ) && is_array( $query_params['type']['enum'] ) ) {
			if ( ! in_array( 'block_suggestion', $query_params['type']['enum'], true ) ) {
				$query_params['type']['enum'][] = 'block_suggestion';
			}
		}
	}
	
	return $query_params;
}

/**
 * Excludes block suggestions from the WordPress admin comment screens.
 *
 * @since 6.5.0
 *
 * @param WP_Comment_Query $comment_query The comment query object.
 */
function gutenberg_exclude_block_suggestions_from_admin( $comment_query ) {
	if ( is_admin() && ! defined( 'DOING_AJAX' ) ) {
		$type = $comment_query->query_vars['type'];
		if ( empty( $type ) || 'all' === $type ) {
			$comment_query->query_vars['type__not_in'] = array( 'block_suggestion' );
		}
	}
}

/**
 * Validates suggestion metadata when creating suggestions.
 *
 * @since 6.5.0
 *
 * @param int $comment_id The comment ID.
 * @param string $comment_status The comment status.
 */
function gutenberg_validate_suggestion_metadata( $comment_id, $comment_status ) {
	$comment = get_comment( $comment_id );
	
	if ( ! $comment || 'block_suggestion' !== $comment->comment_type ) {
		return;
	}
	
	// Set default values for suggestion metadata
	$defaults = array(
		'suggestion_status' => 'pending',
		'timestamp' => time(),
	);
	
	foreach ( $defaults as $key => $value ) {
		if ( ! get_comment_meta( $comment_id, $key, true ) ) {
			update_comment_meta( $comment_id, $key, $value );
		}
	}
}

/**
 * Processes suggestion acceptance by applying changes to the associated block.
 *
 * @since 6.5.0
 *
 * @param int $suggestion_id The suggestion comment ID.
 * @return bool|WP_Error True on success, WP_Error on failure.
 */
function gutenberg_accept_suggestion( $suggestion_id ) {
	$suggestion_comment = get_comment( $suggestion_id );
	
	if ( ! $suggestion_comment || 'block_suggestion' !== $suggestion_comment->comment_type ) {
		return new WP_Error( 'invalid_suggestion', __( 'Invalid suggestion ID.', 'gutenberg' ) );
	}
	
	// Get suggestion metadata
	$meta = get_comment_meta( $suggestion_id );
	$suggestion_type = $meta['suggestion_type'][0] ?? '';
	$block_client_id = $meta['block_client_id'][0] ?? '';
	$suggested_content = $meta['suggested_content'][0] ?? '';
	
	if ( empty( $suggestion_type ) || empty( $block_client_id ) || empty( $suggested_content ) ) {
		return new WP_Error( 'incomplete_suggestion', __( 'Suggestion metadata is incomplete.', 'gutenberg' ) );
	}
	
	// Update suggestion status
	$updated = wp_update_comment( array(
		'comment_ID' => $suggestion_id,
	) );
	
	if ( $updated ) {
		update_comment_meta( $suggestion_id, 'suggestion_status', 'accepted' );
	}
	
	if ( ! $updated ) {
		return new WP_Error( 'update_failed', __( 'Failed to update suggestion status.', 'gutenberg' ) );
	}
	
	// Note: Block content updates should be handled on the frontend
	// since we don't have access to the block editor state here
	
	return true;
}

/**
 * Processes suggestion rejection by updating the status.
 *
 * @since 6.5.0
 *
 * @param int $suggestion_id The suggestion comment ID.
 * @return bool|WP_Error True on success, WP_Error on failure.
 */
function gutenberg_reject_suggestion( $suggestion_id ) {
	$suggestion_comment = get_comment( $suggestion_id );
	
	if ( ! $suggestion_comment || 'block_suggestion' !== $suggestion_comment->comment_type ) {
		return new WP_Error( 'invalid_suggestion', __( 'Invalid suggestion ID.', 'gutenberg' ) );
	}
	
	// Update suggestion status
	$updated = wp_update_comment( array(
		'comment_ID' => $suggestion_id,
	) );
	
	if ( $updated ) {
		update_comment_meta( $suggestion_id, 'suggestion_status', 'rejected' );
	}
	
	if ( ! $updated ) {
		return new WP_Error( 'update_failed', __( 'Failed to update suggestion status.', 'gutenberg' ) );
	}
	
	return true;
}

/**
 * Adds suggestion-specific fields to the REST API response.
 *
 * @since 6.5.0
 *
 * @param WP_REST_Response $response The response object.
 * @param WP_Comment       $comment  The comment object.
 * @param WP_REST_Request  $request  The request object.
 * @return WP_REST_Response Modified response.
 */
function gutenberg_add_suggestion_fields_to_rest_response( $response, $comment, $request ) {
	if ( 'block_suggestion' === $comment->comment_type ) {
		$meta = get_comment_meta( $comment->comment_ID );
		
		// Add suggestion-specific data to response
		$response->data['suggestion'] = array(
			'type' => $meta['suggestion_type'][0] ?? '',
			'status' => $meta['suggestion_status'][0] ?? 'pending',
			'block_client_id' => $meta['block_client_id'][0] ?? '',
			'block_type' => $meta['block_type'][0] ?? '',
			'original_content' => $meta['original_content'][0] ?? '',
			'suggested_content' => $meta['suggested_content'][0] ?? '',
			'diff_data' => $meta['diff_data'][0] ?? '',
			'patches_data' => $meta['patches_data'][0] ?? '',
			'timestamp' => $meta['timestamp'][0] ?? '',
		);
	}
	
	return $response;
}

/**
 * Adds REST API endpoints for suggestion-specific operations.
 *
 * @since 6.5.0
 */
function gutenberg_register_suggestion_rest_endpoints() {
	register_rest_route( 'gutenberg/v1', '/suggestions/(?P<id>\d+)/accept', array(
		'methods' => 'POST',
		'callback' => 'gutenberg_rest_accept_suggestion',
		'permission_callback' => 'gutenberg_rest_suggestion_permission_check',
		'args' => array(
			'id' => array(
				'description' => __( 'The suggestion ID.', 'gutenberg' ),
				'type' => 'integer',
				'required' => true,
			),
		),
	) );
	
	register_rest_route( 'gutenberg/v1', '/suggestions/(?P<id>\d+)/reject', array(
		'methods' => 'POST',
		'callback' => 'gutenberg_rest_reject_suggestion',
		'permission_callback' => 'gutenberg_rest_suggestion_permission_check',
		'args' => array(
			'id' => array(
				'description' => __( 'The suggestion ID.', 'gutenberg' ),
				'type' => 'integer',
				'required' => true,
			),
		),
	) );
}

/**
 * REST API callback for accepting a suggestion.
 *
 * @since 6.5.0
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_REST_Response|WP_Error Response object on success, or WP_Error object on failure.
 */
function gutenberg_rest_accept_suggestion( $request ) {
	$suggestion_id = (int) $request['id'];
	$result = gutenberg_accept_suggestion( $suggestion_id );
	
	if ( is_wp_error( $result ) ) {
		return $result;
	}
	
	return new WP_REST_Response( array(
		'success' => true,
		'message' => __( 'Suggestion accepted successfully.', 'gutenberg' ),
	), 200 );
}

/**
 * REST API callback for rejecting a suggestion.
 *
 * @since 6.5.0
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_REST_Response|WP_Error Response object on success, or WP_Error object on failure.
 */
function gutenberg_rest_reject_suggestion( $request ) {
	$suggestion_id = (int) $request['id'];
	$result = gutenberg_reject_suggestion( $suggestion_id );
	
	if ( is_wp_error( $result ) ) {
		return $result;
	}
	
	return new WP_REST_Response( array(
		'success' => true,
		'message' => __( 'Suggestion rejected successfully.', 'gutenberg' ),
	), 200 );
}

/**
 * Permission check for suggestion REST API endpoints.
 *
 * @since 6.5.0
 *
 * @param WP_REST_Request $request The request object.
 * @return bool|WP_Error True if the user has permission, WP_Error otherwise.
 */
function gutenberg_rest_suggestion_permission_check( $request ) {
	$suggestion_id = (int) $request['id'];
	$suggestion_comment = get_comment( $suggestion_id );
	
	if ( ! $suggestion_comment ) {
		return new WP_Error( 'invalid_suggestion', __( 'Invalid suggestion ID.', 'gutenberg' ), array( 'status' => 404 ) );
	}
	
	// Check if user can edit the associated post
	$post_id = $suggestion_comment->comment_post_ID;
	
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return new WP_Error( 'insufficient_permissions', __( 'You do not have permission to manage suggestions for this post.', 'gutenberg' ), array( 'status' => 403 ) );
	}
	
	return true;
}

// Initialize the block suggestions functionality
add_action( 'init', 'gutenberg_register_block_suggestion_comment_type' );
add_action( 'pre_get_comments', 'gutenberg_exclude_block_suggestions_from_admin' );
add_action( 'comment_post', 'gutenberg_validate_suggestion_metadata', 10, 2 );
add_filter( 'rest_prepare_comment', 'gutenberg_add_suggestion_fields_to_rest_response', 10, 3 );
add_action( 'rest_api_init', 'gutenberg_register_suggestion_rest_endpoints' );