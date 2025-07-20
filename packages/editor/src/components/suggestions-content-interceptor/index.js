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

// Global suggestion storage
const suggestionStorage = new Map();

/**
 * Convert RichTextData to string
 *
 * @param {*} content - Content to convert (RichTextData, string, or other)
 * @return {string} Converted string content
 */
function convertToString( content ) {
	if ( ! content ) {
		return '';
	}

	// If it's already a string, return it
	if ( typeof content === 'string' ) {
		return content;
	}

	// If it's a RichTextData object, convert to HTML string
	if ( content && typeof content === 'object' && content.toHTMLString ) {
		return content.toHTMLString();
	}

	// Fallback to string conversion
	return String( content );
}

/**
 * Store a suggestion without modifying block content
 *
 * @param {string} clientId - Block client ID
 * @param {*} originalContent - Original content
 * @param {*} suggestedContent - Suggested content changes
 * @return {Object} Suggestion data object
 */
function storeSuggestion( clientId, originalContent, suggestedContent ) {
	// Convert RichTextData objects to strings
	const originalString = convertToString( originalContent );
	const suggestedString = convertToString( suggestedContent );

	const suggestionData = {
		id: `suggestion_${ clientId }_${ Date.now() }`,
		blockClientId: clientId,
		originalContent: originalString,
		suggestedContent: suggestedString,
		timestamp: Date.now(),
		status: 'pending',
		changes: calculateChanges( originalString, suggestedString ),
	};

	suggestionStorage.set( clientId, suggestionData );

	// eslint-disable-next-line no-console
	console.log(
		'[Content Interceptor] Stored suggestion for block:',
		clientId,
		{
			...suggestionData,
			originalContent: originalString.slice( 0, 30 ) + '...',
			suggestedContent: suggestedString.slice( 0, 30 ) + '...',
		}
	);

	return suggestionData;
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
 */
export function getAllSuggestions() {
	return Array.from( suggestionStorage.values() );
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

					// Don't store if content hasn't changed
					if ( originalContent === suggestedContent ) {
						return;
					}

					// eslint-disable-next-line no-console
					console.log(
						'[Content Interceptor] Real-time suggestion in suggest mode:',
						{
							clientId,
							original: originalContent?.slice( 0, 30 ) + '...',
							suggested: suggestedContent?.slice( 0, 30 ) + '...',
						}
					);

					// Store as suggestion
					storeSuggestion(
						clientId,
						originalContent,
						suggestedContent
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

