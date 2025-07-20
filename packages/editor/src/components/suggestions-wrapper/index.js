/**
 * WordPress dependencies
 */
import { useEffect, useState, useMemo } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { createBlock } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';

/**
 * Simple diff creation function
 */
function createSimpleDiff( original, suggested ) {
	if ( ! original || ! suggested || original === suggested ) {
		return suggested;
	}

	const originalWords = original.split( /(\s+)/ );
	const suggestedWords = suggested.split( /(\s+)/ );
	
	// Simple word-level diff - highlight additions
	let result = '';
	let origIndex = 0;
	
	for ( let i = 0; i < suggestedWords.length; i++ ) {
		const word = suggestedWords[ i ];
		
		if ( origIndex < originalWords.length && originalWords[ origIndex ] === word ) {
			// Word exists in original - keep as is
			result += word;
			origIndex++;
		} else {
			// New word - highlight as addition
			if ( word.trim() ) {
				result += `<mark class="suggestion-addition">${ word }</mark>`;
			} else {
				result += word;
			}
		}
	}
	
	return result;
}

/**
 * Suggestions wrapper component that intercepts text changes
 */
export function SuggestionsWrapper( { children, blockClientId } ) {
	const [ originalContent, setOriginalContent ] = useState( '' );
	const [ hasPendingSuggestion, setHasPendingSuggestion ] = useState( false );
	
	const { collaborationMode, blockContent } = useSelect( ( select ) => {
		const mode = select( editorStore ).getCollaborationMode?.() || 'edit';
		const block = select( 'core/block-editor' ).getBlock( blockClientId );
		
		return {
			collaborationMode: mode,
			blockContent: block?.attributes?.content || '',
		};
	}, [ blockClientId ] );
	
	// Store original content when entering suggest mode
	useEffect( () => {
		if ( collaborationMode === 'suggest' && ! originalContent && blockContent ) {
			setOriginalContent( blockContent );
		}
		
		if ( collaborationMode === 'edit' ) {
			setOriginalContent( '' );
			setHasPendingSuggestion( false );
		}
	}, [ collaborationMode, blockContent, originalContent ] );
	
	// Check for content changes in suggest mode
	useEffect( () => {
		if ( collaborationMode === 'suggest' && originalContent && blockContent !== originalContent ) {
			setHasPendingSuggestion( true );
			
			// Create a simple suggestion comment
			const suggestionData = {
				type: 'block_suggestion',
				blockClientId,
				originalContent,
				suggestedContent: blockContent,
				status: 'pending',
				timestamp: Date.now(),
			};
			
			// Store suggestion data on window for debugging
			window.currentSuggestion = suggestionData;
		}
	}, [ collaborationMode, originalContent, blockContent, blockClientId ] );
	
	// Create diff display when in suggest mode with pending suggestions
	const diffContent = useMemo( () => {
		if ( collaborationMode === 'suggest' && hasPendingSuggestion && originalContent ) {
			return createSimpleDiff( originalContent, blockContent );
		}
		return null;
	}, [ collaborationMode, hasPendingSuggestion, originalContent, blockContent ] );
	
	// If in suggest mode and we have a diff, override the display
	if ( collaborationMode === 'suggest' && diffContent ) {
		return (
			<div className="suggestions-block-wrapper">
				<div 
					className="suggestion-diff-display"
					dangerouslySetInnerHTML={ { __html: diffContent } }
				/>
				<style>{ `
					.suggestion-addition {
						background-color: #d4edda;
						border-bottom: 2px solid #28a745;
						text-decoration: underline;
						text-decoration-color: #28a745;
						color: #155724;
					}
					.suggestions-block-wrapper {
						position: relative;
					}
					.suggestion-diff-display {
						min-height: 1.5em;
						padding: 8px;
						border: 1px solid #28a745;
						border-radius: 4px;
						background-color: rgba(212, 237, 218, 0.1);
					}
				` }</style>
			</div>
		);
	}
	
	return children;
}

export default SuggestionsWrapper;