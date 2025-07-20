/**
 * WordPress dependencies
 */
import { createHigherOrderComponent } from '@wordpress/compose';
import { useSelect } from '@wordpress/data';
import { useCallback, useEffect, useRef } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';
import {
	createTextSuggestion,
	SUGGESTION_STATUS,
	suggestionToCommentMeta,
} from '../suggestion-data-structures';
import { useDispatch } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import apiFetch from '@wordpress/api-fetch';

// Re-export functions from suggestion-data-structures for collab-sidebar
export { commentMetaToSuggestion } from '../suggestion-data-structures';

// Working in-memory suggestion storage (will be replaced with WordPress integration later)
const suggestionStorage = new Map();

// Database save debouncing - track pending saves and timeouts
const pendingDatabaseSaves = new Map();
const DATABASE_SAVE_DEBOUNCE_MS = 3000; // Save 3 seconds after user stops typing

/**
 * Generate a simple UUID v4
 * 
 * @return {string} UUID string
 */
function generateUUID() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace( /[xy]/g, function( c ) {
		const r = Math.random() * 16 | 0;
		const v = c === 'x' ? r : ( r & 0x3 | 0x8 );
		return v.toString( 16 );
	} );
}

/**
 * Get current WordPress user info (placeholder for now)
 * 
 * @return {Object} User info object
 */
function getCurrentUser() {
	// TODO: Integrate with WordPress user system
	// For now, return placeholder data
	return {
		id: 1,
		name: 'Current User',
		avatar: '',
	};
}

/**
 * Hard-remove <span class="suggestion-deletion">…</span>
 * and unwrap <span class="suggestion-addition">…</span>.
 * 
 * @param {string} html - HTML content with suggestion markup
 * @return {string} HTML with suggestion markup stripped
 */
function stripSuggestionMarkup( html ) {
	return html
		.replace(
			/<span[^>]*class="[^"]*suggestion-deletion[^"]*"[^>]*>.*?<\/span>/gis,
			''
		)
		.replace(
			/<span[^>]*class="[^"]*suggestion-addition[^"]*"[^>]*>(.*?)<\/span>/gis,
			'$1'
		);
}

/**
 * Convert RichTextData to plain text string (strips HTML)
 *
 * @param {*} content - Content to convert (RichTextData, string, or other)
 * @return {string} Plain text content without HTML
 */
function convertToString( content ) {
	if ( ! content ) {
		return '';
	}

	// If it's already a string, strip suggestion markup first, then HTML tags for plain text comparison
	if ( typeof content === 'string' ) {
		// Remove HTML tags and decode entities for plain text comparison
		return stripSuggestionMarkup( content )
			.replace( /<[^>]*>/g, '' ) // Remove HTML tags
			.replace( /&amp;/g, '&' ) // Decode entities
			.replace( /&lt;/g, '<' )
			.replace( /&gt;/g, '>' )
			.replace( /&para;<br>/g, '\n' );
	}

	// If it's a RichTextData object, convert to plain text
	if ( content && typeof content === 'object' ) {
		if ( content.toHTMLString ) {
			// Convert to HTML first, strip suggestion markup, then strip tags
			const htmlString = stripSuggestionMarkup( content.toHTMLString() );
			return htmlString.replace( /<[^>]*>/g, '' ).replace( /&[^;]+;/g, ' ' );
		}
		
		// Try other RichTextData methods for plain text
		if ( content.toString ) {
			return stripSuggestionMarkup( content.toString() );
		}
	}

	// Fallback to string conversion, strip suggestion markup, then strip HTML
	return stripSuggestionMarkup( String( content ) ).replace( /<[^>]*>/g, '' );
}

/**
 * Store or update a suggestion with cumulative changes (working in-memory version)
 *
 * @param {string} clientId - Block client ID
 * @param {*} originalContent - Original content (baseline)
 * @param {*} suggestedContent - Latest suggested content changes
 * @return {Object} Enhanced suggestion data object
 */
function storeSuggestion( clientId, originalContent, suggestedContent ) {
	// Convert RichTextData objects to strings
	const originalString = convertToString( originalContent );
	const suggestedString = convertToString( suggestedContent );
	const currentUser = getCurrentUser();
	const now = new Date();

	// Check if we have an existing suggestion for this block
	const existingSuggestion = suggestionStorage.get( clientId );
	
	let suggestionData;
	
	if ( existingSuggestion && existingSuggestion.status === 'pending' ) {
		// CRITICAL FIX: Recalculate complete diff from original to current suggested content
		// This ensures proper diff rendering for continuous edits
		const recalculatedSuggestion = createTextSuggestion( 
			existingSuggestion.originalContent, 
			suggestedString, 
			{
				clientId,
				name: 'core/paragraph',
			} 
		);
		
		
		// Update existing suggestion with recalculated diff and metadata
		suggestionData = {
			...existingSuggestion,
			
			// Keep the original baseline content unchanged
			// originalContent stays the same
			
			// Update with latest suggested content
			suggestedContent: suggestedString,
			
			// CRITICAL: Use recalculated diff for proper visual rendering
			diff: recalculatedSuggestion.diff,
			
			// Update timestamp
			updated: now.toISOString(),
			
			// Update metadata
			metadata: {
				...existingSuggestion.metadata,
				wordCount: {
					original: existingSuggestion.originalContent.split( /\s+/ ).length,
					suggested: suggestedString.split( /\s+/ ).length,
				},
				changeType: determineChangeType( existingSuggestion.originalContent, suggestedString ),
				editCount: ( existingSuggestion.metadata.editCount || 0 ) + 1,
			},
		};
		
		
	} else {
		// Create new suggestion using professional structure
		const professionalSuggestion = createTextSuggestion( originalString, suggestedString, {
			clientId,
			name: 'core/paragraph',
		} );
		
		suggestionData = {
			// Use professional data structure
			...professionalSuggestion,
			
			// Ensure we have a proper ID (generated by createTextSuggestion or create one)
			id: professionalSuggestion.id || generateUUID(),
			
			// Add additional metadata for compatibility
			author: {
				id: currentUser.id,
				name: currentUser.name,
				avatar: currentUser.avatar,
			},
			created: now.toISOString(),
			updated: now.toISOString(),
			commentThreadId: null,
			metadata: {
				wordCount: {
					original: originalString.split( /\s+/ ).length,
					suggested: suggestedString.split( /\s+/ ).length,
				},
				changeType: determineChangeType( originalString, suggestedString ),
				editCount: 1,
			},
		};
		
	}

	suggestionStorage.set( clientId, suggestionData );
	return suggestionData;
}

/**
 * Determine the type of change for metadata
 *
 * @param {string} original - Original content
 * @param {string} suggested - Suggested content
 * @return {string} Change type
 */
function determineChangeType( original, suggested ) {
	if ( ! original && suggested ) {
		return 'addition';
	}
	if ( original && ! suggested ) {
		return 'deletion';
	}
	if ( original.length < suggested.length ) {
		return 'expansion';
	}
	if ( original.length > suggested.length ) {
		return 'reduction';
	}
	return 'modification';
}

/**
 * Calculate word-level changes between original and suggested content
 *
 * @param {string} original - Original content string
 * @param {string} suggested - Suggested content string
 * @return {Array} Array of change objects
 */
function calculateChanges( original, suggested ) {
	if ( ! original || ! suggested || original === suggested ) {
		return [];
	}

	const originalWords = original.split( /(\s+)/ );
	const suggestedWords = suggested.split( /(\s+)/ );
	const changes = [];

	// Simple diff algorithm - identify additions
	suggestedWords.forEach( ( word, index ) => {
		if ( ! originalWords.includes( word ) && word.trim() ) {
			changes.push( {
				type: 'addition',
				text: word,
				position: index,
				timestamp: Date.now(),
			} );
		}
	} );

	// Identify deletions
	originalWords.forEach( ( word, index ) => {
		if ( ! suggestedWords.includes( word ) && word.trim() ) {
			changes.push( {
				type: 'deletion',
				text: word,
				position: index,
				timestamp: Date.now(),
			} );
		}
	} );

	return changes;
}

/**
 * Get suggestion data for a block
 *
 * @param {string} clientId - Block client ID
 * @return {Object|undefined} Suggestion data or undefined if not found
 */
export function getSuggestion( clientId ) {
	return suggestionStorage.get( clientId );
}

/**
 * Check if a block has suggestions
 *
 * @param {string} clientId - Block client ID
 * @return {boolean} True if block has suggestions
 */
export function hasSuggestions( clientId ) {
	return suggestionStorage.has( clientId );
}

/**
 * Force immediate save of pending suggestion (bypasses debouncing)
 *
 * @param {string} blockClientId - Block client ID to save
 */
export async function forceImmediateSave( blockClientId ) {
	// Cancel any pending debounced save
	if ( pendingDatabaseSaves.has( blockClientId ) ) {
		clearTimeout( pendingDatabaseSaves.get( blockClientId ) );
		pendingDatabaseSaves.delete( blockClientId );
	}
	
	// Get the current suggestion for this block
	const suggestion = suggestionStorage.get( blockClientId );
	if ( suggestion ) {
		try {
			await saveSuggestionToDatabase( suggestion );
		} catch ( error ) {
			// Fail silently
		}
	}
}

/**
 * Accept a suggestion (apply changes to block)
 *
 * @param {string} suggestionId - Suggestion UUID
 * @return {Object|null} Result object with success status and content
 */
export function acceptSuggestion( suggestionId ) {
	// Find and update suggestion status
	for ( const [ clientId, suggestion ] of suggestionStorage.entries() ) {
		if ( suggestion.id === suggestionId ) {
			const acceptedSuggestion = {
				...suggestion,
				status: 'accepted',
				updated: new Date().toISOString(),
			};
			
			// Force immediate save before removing from memory
			forceImmediateSave( clientId );
			
			// Remove the suggestion from storage since it's been applied
			suggestionStorage.delete( clientId );
			
			return {
				success: true,
				suggestion: acceptedSuggestion,
				appliedContent: acceptedSuggestion.suggestedContent,
			};
		}
	}
	
	return { success: false, error: 'Suggestion not found' };
}

/**
 * Reject a suggestion
 *
 * @param {string} suggestionId - Suggestion UUID
 * @return {Object|null} Result object with success status
 */
export function rejectSuggestion( suggestionId ) {
	// Find and reject suggestion
	for ( const [ clientId, suggestion ] of suggestionStorage.entries() ) {
		if ( suggestion.id === suggestionId ) {
			const rejectedSuggestion = {
				...suggestion,
				status: 'rejected',
				updated: new Date().toISOString(),
			};
			
			// Force immediate save before removing from memory
			forceImmediateSave( clientId );
			
			// Remove the suggestion from storage since it's been rejected
			suggestionStorage.delete( clientId );
			
			return {
				success: true,
				suggestion: rejectedSuggestion,
			};
		}
	}
	
	return { success: false, error: 'Suggestion not found' };
}

/**
 * Content Interceptor HOC
 * Prevents content modifications in suggest mode and stores them as suggestions
 * Uses input event listening for real-time typing detection
 */
const withContentInterception = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		const { clientId, attributes, setAttributes } = props;
		const currentContent = attributes?.content || '';
		const blockRef = useRef( null );
		const originalContentRef = useRef( currentContent );

		const { collaborationMode } = useSelect( ( select ) => {
			return {
				collaborationMode:
					select( editorStore ).getCollaborationMode?.() || 'edit',
			};
		}, [] );

		// Only apply to paragraph blocks and only if experiment is enabled
		if (
			props.name !== 'core/paragraph' ||
			! window.__experimentalSuggestionsMode
		) {
			return <BlockEdit { ...props } />;
		}

		// Update original content reference when not in suggest mode
		// Also force immediate save when leaving suggest mode
		useEffect( () => {
			if ( collaborationMode !== 'suggest' ) {
				// Force immediate save of any pending suggestion before switching modes
				if ( hasSuggestions( clientId ) ) {
					forceImmediateSave( clientId );
				}
				originalContentRef.current = currentContent;
			}
		}, [ currentContent, collaborationMode, clientId ] );

		// Store suggestion for real-time changes
		const handleSuggestion = useCallback(
			( suggestedContent ) => {
				if ( collaborationMode === 'suggest' ) {
					const originalContent = originalContentRef.current;
					
					// Convert suggested content to plain text for comparison
					const plainTextSuggested = convertToString( suggestedContent );
					const plainTextOriginal = convertToString( originalContent );

					// Don't store if content hasn't changed
					if ( plainTextOriginal === plainTextSuggested ) {
						return;
					}


					// Store as suggestion with plain text content (both in-memory and database)
					const suggestionData = storeSuggestion(
						clientId,
						plainTextOriginal,
						plainTextSuggested
					);
					
					// Also save to WordPress database asynchronously (debounced)
					if ( suggestionData ) {
						debouncedDatabaseSave( suggestionData );
					}
				}
			},
			[ collaborationMode, clientId ]
		);

		// Listen for real-time input events
		useEffect( () => {
			if ( collaborationMode !== 'suggest' || ! blockRef.current ) {
				return;
			}

			const handleInput = ( event ) => {
				const target = event.target;

				// Check if this is a contenteditable element (RichText)
				if (
					target &&
					target.getAttribute &&
					target.getAttribute( 'contenteditable' ) === 'true'
				) {
					const newContent =
						target.innerHTML || target.textContent || '';
					handleSuggestion( newContent );
				}
			};

			// Add input event listener to capture real-time typing
			const blockElement = blockRef.current;
			blockElement.addEventListener( 'input', handleInput, {
				capture: true,
			} );

			return () => {
				blockElement.removeEventListener( 'input', handleInput, {
					capture: true,
				} );
			};
		}, [ collaborationMode, handleSuggestion ] );

		// Intercept setAttributes - prevent content changes in suggest mode
		const interceptedSetAttributes = useCallback(
			( newAttributes ) => {
				if (
					collaborationMode === 'suggest' &&
					newAttributes.content !== undefined
				) {
					// Handle suggestion (store but prevent the actual content change)
					handleSuggestion( newAttributes.content );

					// Don't call setAttributes - this prevents the content from being modified
					// The visual overlay will show the suggestion while keeping original content intact
					return;
				}

				// In edit mode, allow all changes normally
				setAttributes( newAttributes );
			},
			[ collaborationMode, handleSuggestion, setAttributes ]
		);

		// Wrap the block edit in a container to capture input events
		return (
			<div ref={ blockRef } style={ { width: '100%' } }>
				<BlockEdit
					{ ...props }
					setAttributes={ interceptedSetAttributes }
				/>
			</div>
		);
	};
}, 'withContentInterception' );

/**
 * Find existing suggestion comment for a block
 *
 * @param {string} postId - Post ID
 * @param {string} blockClientId - Block client ID
 * @return {Promise<Object|null>} Existing suggestion comment or null
 */
async function findExistingSuggestionComment( postId, blockClientId ) {
	try {
		// Query for existing suggestion comments for this block
		const existingComments = await apiFetch( {
			path: `/wp/v2/comments?post=${postId}&type=block_suggestion&meta_key=suggestion_block_id&meta_value=${blockClientId}&per_page=1`,
			method: 'GET',
		} );
		
		return existingComments && existingComments.length > 0 ? existingComments[0] : null;
	} catch ( error ) {
		return null;
	}
}

/**
 * Debounced database save - only saves after user stops typing
 *
 * @param {Object} suggestionData - Suggestion data to save
 */
function debouncedDatabaseSave( suggestionData ) {
	const blockClientId = suggestionData.blockClientId;
	
	// Clear existing timeout for this block
	if ( pendingDatabaseSaves.has( blockClientId ) ) {
		clearTimeout( pendingDatabaseSaves.get( blockClientId ) );
	}
	
	// Set new timeout to save after debounce period
	const timeoutId = setTimeout( async () => {
		try {
			await saveSuggestionToDatabase( suggestionData );
			pendingDatabaseSaves.delete( blockClientId );
		} catch ( error ) {
			// Fail silently - in-memory suggestions still work
			pendingDatabaseSaves.delete( blockClientId );
		}
	}, DATABASE_SAVE_DEBOUNCE_MS );
	
	pendingDatabaseSaves.set( blockClientId, timeoutId );
}

/**
 * Save suggestion to WordPress database as a comment (with debouncing and update logic)
 *
 * @param {Object} suggestionData - Suggestion data to save
 * @return {Promise} WordPress API response promise
 */
export async function saveSuggestionToDatabase( suggestionData ) {
	try {
		// Get current post ID from global or URL
		const postId = window?.wp?.data?.select( 'core/editor' )?.getCurrentPostId?.() || 
					   window?.postId ||
					   new URLSearchParams( window.location.search ).get( 'post' );

		if ( ! postId ) {
			return null;
		}

		// Convert suggestion to WordPress comment format
		const commentMeta = suggestionToCommentMeta( suggestionData, 
			`Text suggestion: ${suggestionData.metadata?.changeType || 'modification'} by ${suggestionData.author?.name || 'User'}` );

		// Check if suggestion comment already exists for this block
		const existingComment = await findExistingSuggestionComment( postId, suggestionData.blockClientId );
		
		if ( existingComment ) {
			// Update existing comment with new suggestion data
			const response = await apiFetch( {
				path: `/wp/v2/comments/${existingComment.id}`,
				method: 'POST',
				data: {
					content: `Suggestion: ${suggestionData.metadata?.changeType || 'text change'}`,
					meta: {
						...commentMeta,
						// Keep original metadata but update content
						suggestion_block_id: suggestionData.blockClientId || suggestionData.id,
						suggestion_author_id: suggestionData.author?.id || 1,
						suggestion_updated: new Date().toISOString(),
					},
				}
			} );
			
			return response;
		} else {
			// Create new suggestion comment
			const commentData = {
				post: postId,
				content: `Suggestion: ${suggestionData.metadata?.changeType || 'text change'}`,
				meta: {
					...commentMeta,
					// Add additional metadata for easier querying
					suggestion_block_id: suggestionData.blockClientId || suggestionData.id,
					suggestion_author_id: suggestionData.author?.id || 1,
					suggestion_created: suggestionData.created || new Date().toISOString(),
				},
				// Use comment_type like the working comments system, not 'type'
				comment_type: 'block_suggestion', 
				// Use comment_approved like the working comments system, not 'status'
				comment_approved: 0
			};

			// Save to WordPress via REST API
			const response = await apiFetch( {
				path: '/wp/v2/comments',
				method: 'POST',
				data: commentData,
			} );

			return response;
		}

	} catch ( error ) {
		// Don't throw - we want in-memory suggestions to continue working
		// even if database persistence fails
		return null;
	}
}

export default withContentInterception;
