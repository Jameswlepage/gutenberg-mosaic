/**
 * WordPress dependencies
 */
import { select, dispatch } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as coreStore } from '@wordpress/core-data';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../store';
import { createTextSuggestion } from '../components/suggestion-data-structures';

/**
 * Middleware that intercepts block editing actions when in suggestions mode
 * and converts them to suggestions instead of direct edits
 */
const suggestionsMiddleware = ( store ) => ( next ) => ( action ) => {
	// Check if we're in suggestions mode
	const suggestionsMode = select( 'gutenberg/suggestions' ).getSuggestionsMode();
	
	if ( suggestionsMode !== 'suggest' ) {
		return next( action );
	}

	// Intercept block attribute updates for text content
	if ( action.type === 'UPDATE_BLOCK_ATTRIBUTES' ) {
		const { clientId, attributes } = action;
		
		// Only handle text content changes for paragraph blocks
		const block = select( blockEditorStore ).getBlock( clientId );
		if ( ! block || block.name !== 'core/paragraph' ) {
			return next( action );
		}

		// Check if the content attribute is being updated
		if ( attributes.content !== undefined ) {
			const originalContent = select( 'gutenberg/suggestions' ).getOriginalContent( clientId );
			const currentContent = block.attributes.content || '';
			const newContent = attributes.content || '';

			// If this is the first edit, store the original content
			if ( ! originalContent ) {
				dispatch( 'gutenberg/suggestions' ).setOriginalContent( clientId, currentContent );
			}

			// Create a suggestion instead of applying the edit
			const suggestion = createTextSuggestion( 
				originalContent || currentContent, 
				newContent, 
				{ 
					clientId, 
					blockName: block.name,
					timestamp: Date.now(),
				} 
			);

			// Generate a unique suggestion ID
			const suggestionId = `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

			// Add the suggestion to the store
			dispatch( 'gutenberg/suggestions' ).addSuggestion( clientId, suggestionId, {
				...suggestion,
				id: suggestionId,
				status: 'pending',
				blockClientId: clientId,
				blockName: block.name,
				timestamp: Date.now(),
			} );

			// Store the pending change
			dispatch( 'gutenberg/suggestions' ).setPendingChange( clientId, {
				type: 'content',
				from: originalContent || currentContent,
				to: newContent,
				timestamp: Date.now(),
			} );

			// Create a block suggestion comment
			const postId = select( editorStore ).getCurrentPostId();
			if ( postId ) {
				dispatch( coreStore ).saveEntityRecord( 'root', 'comment', {
					post: postId,
					type: 'block_suggestion',
					content: `Text suggestion for block ${clientId}`,
					meta: {
						suggestion_type: 'text_change',
						suggestion_status: 'pending',
						block_client_id: clientId,
						block_type: block.name,
						original_content: originalContent || currentContent,
						suggested_content: newContent,
						diff_data: JSON.stringify( suggestion.diff ),
						patches_data: JSON.stringify( suggestion.patches ),
						timestamp: Date.now(),
					},
				} );
			}

			// Don't apply the original action - we've converted it to a suggestion
			return;
		}
	}

	// For all other actions, proceed normally
	return next( action );
};

export default suggestionsMiddleware;