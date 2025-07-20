/**
 * WordPress dependencies
 */
import { select } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import suggestionsMiddleware from './suggestions-middleware';

/**
 * Debounced suggestion creation to prevent flooding
 */
const pendingSuggestions = new Map();
const suggestionTimeouts = new Map();

function createDebouncedSuggestion( clientId, originalContent, newContent ) {
	// Clear existing timeout for this block
	if ( suggestionTimeouts.has( clientId ) ) {
		clearTimeout( suggestionTimeouts.get( clientId ) );
	}
	
	// Store the pending suggestion
	pendingSuggestions.set( clientId, { originalContent, newContent } );
	
	// Set a debounced timeout
	const timeoutId = setTimeout( () => {
		const pending = pendingSuggestions.get( clientId );
		if ( pending ) {
			// Convert RichTextData to plain text if needed
			const originalText = typeof pending.originalContent === 'object' && pending.originalContent?.toHTMLString 
				? pending.originalContent.toHTMLString()
				: pending.originalContent || '';
			
			const suggestedText = typeof pending.newContent === 'object' && pending.newContent?.toHTMLString
				? pending.newContent.toHTMLString()
				: pending.newContent || '';
			
			// Only create suggestion if content actually changed
			if ( originalText !== suggestedText ) {
				const suggestionId = `suggestion_${clientId}_current`; // Use consistent ID per block
				
				try {
					// Replace any existing suggestion for this block
					wp.data.dispatch( 'gutenberg/suggestions' ).addSuggestion( clientId, suggestionId, {
						id: suggestionId,
						type: 'text_change',
						status: 'pending',
						originalContent: originalText,
						suggestedContent: suggestedText,
						blockClientId: clientId,
						timestamp: Date.now(),
					} );
					
					console.log( '[SuggestionsMiddleware] Created/updated suggestion for block:', clientId );
					console.log( '[SuggestionsMiddleware] Original:', originalText.substring(0, 50) + '...' );
					console.log( '[SuggestionsMiddleware] Suggested:', suggestedText.substring(0, 50) + '...' );
				} catch ( error ) {
					console.warn( '[SuggestionsMiddleware] Failed to create suggestion:', error );
				}
			}
			
			pendingSuggestions.delete( clientId );
			suggestionTimeouts.delete( clientId );
		}
	}, 300 ); // 300ms debounce
	
	suggestionTimeouts.set( clientId, timeoutId );
}

/**
 * Registers the suggestions middleware with the block editor store
 * This needs to be called after the block editor store is created
 */
export function registerSuggestionsMiddleware() {
	try {
		// Use wp.data.dispatch to get the block editor dispatch function
		const blockEditorDispatch = wp.data.dispatch( 'core/block-editor' );
		
		if ( ! blockEditorDispatch ) {
			console.warn( 'Block editor dispatch not found, cannot register suggestions middleware' );
			return;
		}

		// Store original content when entering suggest mode
		const originalContentMap = new Map();

		// Get the original updateBlockAttributes function
		const originalUpdateBlockAttributes = blockEditorDispatch.updateBlockAttributes;

		// Wrap it with our interceptor
		blockEditorDispatch.updateBlockAttributes = function( clientId, attributes ) {
			// Check if we're in suggest mode
			const editorMode = wp.data.select( 'core/editor' ).getCollaborationMode();
			
			if ( editorMode === 'suggest' && attributes.content !== undefined ) {
				const currentBlock = wp.data.select( 'core/block-editor' ).getBlock( clientId );
				
				// Only handle paragraph blocks
				if ( currentBlock?.name !== 'core/paragraph' ) {
					return originalUpdateBlockAttributes.call( this, clientId, attributes );
				}
				
				// Store original content on first change in suggest mode
				if ( ! originalContentMap.has( clientId ) ) {
					originalContentMap.set( clientId, currentBlock.attributes.content );
				}
				
				const originalContent = originalContentMap.get( clientId );
				
				// Create debounced suggestion
				createDebouncedSuggestion( clientId, originalContent, attributes.content );
				
				// Don't call the original function - this prevents the edit
				return;
			} else {
				// In edit mode, clear stored original content
				originalContentMap.delete( clientId );
				
				// Clear any pending suggestions for this block
				if ( pendingSuggestions.has( clientId ) ) {
					clearTimeout( suggestionTimeouts.get( clientId ) );
					pendingSuggestions.delete( clientId );
					suggestionTimeouts.delete( clientId );
				}
			}
			
			// In edit mode or non-content changes, proceed normally
			return originalUpdateBlockAttributes.call( this, clientId, attributes );
		};

		console.log( 'Suggestions middleware registered successfully via dispatch wrapper' );
	} catch ( error ) {
		console.warn( 'Failed to register suggestions middleware:', error );
	}
}

/**
 * Alternative approach using a more direct method
 * This patches the block editor store to include our middleware
 */
export function patchBlockEditorWithSuggestionsMiddleware() {
	// Wait for the block editor store to be available
	const checkStore = () => {
		const blockEditorStoreInstance = select( blockEditorStore );
		
		if ( blockEditorStoreInstance ) {
			// Get the store's dispatch function
			const originalDispatch = blockEditorStoreInstance.dispatch;
			
			// Create our middleware wrapper
			const middlewareWrapper = suggestionsMiddleware( blockEditorStoreInstance );
			
			// Wrap the dispatch function
			const wrappedDispatch = middlewareWrapper( originalDispatch );
			
			// Replace the dispatch function on the store
			blockEditorStoreInstance.dispatch = wrappedDispatch;
			
			console.log( 'Block editor store patched with suggestions middleware' );
		} else {
			// Store not ready yet, try again
			setTimeout( checkStore, 100 );
		}
	};
	
	// Start checking for the store
	checkStore();
}