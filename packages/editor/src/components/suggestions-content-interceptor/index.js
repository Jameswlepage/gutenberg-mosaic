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

// Global suggestion storage - will be replaced with WordPress integration
const suggestionStorage = new Map();

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
 * Convert RichTextData to plain text string (strips HTML)
 *
 * @param {*} content - Content to convert (RichTextData, string, or other)
 * @return {string} Plain text content without HTML
 */
function convertToString( content ) {
	if ( ! content ) {
		return '';
	}

	// If it's already a string, strip any HTML tags for plain text comparison
	if ( typeof content === 'string' ) {
		// Remove HTML tags and decode entities for plain text comparison
		return content
			.replace( /<[^>]*>/g, '' ) // Remove HTML tags
			.replace( /&amp;/g, '&' ) // Decode entities
			.replace( /&lt;/g, '<' )
			.replace( /&gt;/g, '>' )
			.replace( /&para;<br>/g, '\n' );
	}

	// If it's a RichTextData object, convert to plain text
	if ( content && typeof content === 'object' ) {
		if ( content.toHTMLString ) {
			// Convert to HTML first, then strip tags
			const htmlString = content.toHTMLString();
			return htmlString.replace( /<[^>]*>/g, '' ).replace( /&[^;]+;/g, ' ' );
		}
		
		// Try other RichTextData methods for plain text
		if ( content.toString ) {
			return content.toString();
		}
	}

	// Fallback to string conversion and strip HTML
	return String( content ).replace( /<[^>]*>/g, '' );
}

/**
 * Store or update a suggestion with cumulative changes
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
		// Update existing suggestion with new content, keeping original baseline
		suggestionData = {
			...existingSuggestion,
			
			// Keep the original baseline content unchanged
			// originalContent stays the same
			
			// Update with latest suggested content
			suggestedContent: suggestedString,
			changes: calculateChanges( existingSuggestion.originalContent, suggestedString ),
			
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
		
		// eslint-disable-next-line no-console
		console.log(
			'[Content Interceptor] Updated existing suggestion:',
			{
				id: suggestionData.id,
				blockId: clientId,
				editCount: suggestionData.metadata.editCount,
				original: existingSuggestion.originalContent.slice( 0, 20 ) + '...',
				updated: suggestedString.slice( 0, 20 ) + '...',
			}
		);
		
	} else {
		// Create new suggestion
		suggestionData = {
			// Core identification
			id: generateUUID(),
			blockClientId: clientId,
			
			// Author information
			author: {
				id: currentUser.id,
				name: currentUser.name,
				avatar: currentUser.avatar,
			},
			
			// Content data - originalString is the baseline for all future changes
			originalContent: originalString,
			suggestedContent: suggestedString,
			changes: calculateChanges( originalString, suggestedString ),
			
			// Timestamps (ISO format for compatibility)
			created: now.toISOString(),
			updated: now.toISOString(),
			
			// Status workflow
			status: 'pending', // pending | accepted | rejected | resolved
			
			// Future extensions
			commentThreadId: null, // Will link to WordPress comments
			metadata: {
				wordCount: {
					original: originalString.split( /\s+/ ).length,
					suggested: suggestedString.split( /\s+/ ).length,
				},
				changeType: determineChangeType( originalString, suggestedString ),
				editCount: 1,
			},
		};
		
		// eslint-disable-next-line no-console
		console.log(
			'[Content Interceptor] Created new suggestion:',
			{
				id: suggestionData.id,
				blockId: clientId,
				author: suggestionData.author.name,
				original: originalString.slice( 0, 20 ) + '...',
				suggested: suggestedString.slice( 0, 20 ) + '...',
			}
		);
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
 * Clear suggestion for a block
 *
 * @param {string} clientId - Block client ID
 * @return {boolean} True if suggestion was deleted
 */
export function clearSuggestion( clientId ) {
	return suggestionStorage.delete( clientId );
}

/**
 * Get all suggestions
 *
 * @param {Object} filters - Optional filters 
 * @param {string} filters.status - Filter by status
 * @param {number} filters.authorId - Filter by author ID
 * @return {Array} Array of suggestion objects
 */
export function getAllSuggestions( filters = {} ) {
	let suggestions = Array.from( suggestionStorage.values() );
	
	// Apply status filter
	if ( filters.status ) {
		suggestions = suggestions.filter( s => s.status === filters.status );
	}
	
	// Apply author filter
	if ( filters.authorId ) {
		suggestions = suggestions.filter( s => s.author.id === filters.authorId );
	}
	
	// Sort by creation date (newest first)
	suggestions.sort( ( a, b ) => new Date( b.created ) - new Date( a.created ) );
	
	return suggestions;
}

/**
 * Update suggestion status
 *
 * @param {string} suggestionId - Suggestion UUID
 * @param {string} newStatus - New status (pending/accepted/rejected)
 * @return {Object|null} Updated suggestion or null if not found
 */
export function updateSuggestionStatus( suggestionId, newStatus ) {
	// Find suggestion by ID across all blocks
	for ( const [ clientId, suggestion ] of suggestionStorage.entries() ) {
		if ( suggestion.id === suggestionId ) {
			const updatedSuggestion = {
				...suggestion,
				status: newStatus,
				updated: new Date().toISOString(),
			};
			
			suggestionStorage.set( clientId, updatedSuggestion );
			
			// eslint-disable-next-line no-console
			console.log( `[Suggestion] Status updated: ${ suggestionId } → ${ newStatus }` );
			
			return updatedSuggestion;
		}
	}
	
	return null;
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
			
			// Remove the suggestion from storage since it's been applied
			suggestionStorage.delete( clientId );
			
			// eslint-disable-next-line no-console
			console.log( `[Suggestion] Accepted and removed: ${ suggestionId }` );
			
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
			
			// Remove the suggestion from storage since it's been rejected
			suggestionStorage.delete( clientId );
			
			// eslint-disable-next-line no-console
			console.log( `[Suggestion] Rejected and removed: ${ suggestionId }` );
			
			return {
				success: true,
				suggestion: rejectedSuggestion,
			};
		}
	}
	
	return { success: false, error: 'Suggestion not found' };
}

/**
 * Get suggestion statistics
 *
 * @return {Object} Statistics about suggestions
 */
export function getSuggestionStats() {
	const suggestions = getAllSuggestions();
	
	return {
		total: suggestions.length,
		pending: suggestions.filter( s => s.status === 'pending' ).length,
		accepted: suggestions.filter( s => s.status === 'accepted' ).length,
		rejected: suggestions.filter( s => s.status === 'rejected' ).length,
		byAuthor: suggestions.reduce( ( acc, s ) => {
			acc[ s.author.name ] = ( acc[ s.author.name ] || 0 ) + 1;
			return acc;
		}, {} ),
	};
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
		useEffect( () => {
			if ( collaborationMode !== 'suggest' ) {
				originalContentRef.current = currentContent;
			}
		}, [ currentContent, collaborationMode ] );

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

					// eslint-disable-next-line no-console
					console.log(
						'[Content Interceptor] Real-time suggestion in suggest mode:',
						{
							clientId,
							original: plainTextOriginal?.slice( 0, 30 ) + '...',
							suggested: plainTextSuggested?.slice( 0, 30 ) + '...',
							originalType: typeof originalContent,
							suggestedType: typeof suggestedContent,
						}
					);

					// Store as suggestion with plain text content
					storeSuggestion(
						clientId,
						plainTextOriginal,
						plainTextSuggested
					);
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

export default withContentInterception;
