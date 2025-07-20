/**
 * WordPress dependencies
 */
import { useSelect } from '@wordpress/data';
import { useMemo } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';

/**
 * Simple diff algorithm for text comparison
 */
function createSimpleDiff( original, suggested ) {
	if ( ! original && ! suggested ) return [];
	if ( ! original ) {
		return [{ type: 'insertion', content: suggested }];
	}
	if ( ! suggested ) {
		return [{ type: 'deletion', content: original }];
	}
	
	// Simple word-based diff for demonstration
	const originalWords = original.split( /(\s+)/ );
	const suggestedWords = suggested.split( /(\s+)/ );
	
	const diffElements = [];
	const maxLength = Math.max( originalWords.length, suggestedWords.length );
	
	for ( let i = 0; i < maxLength; i++ ) {
		const originalWord = originalWords[ i ] || '';
		const suggestedWord = suggestedWords[ i ] || '';
		
		if ( originalWord === suggestedWord ) {
			if ( originalWord ) {
				diffElements.push({ type: 'equal', content: originalWord });
			}
		} else {
			if ( originalWord && ! suggestedWord ) {
				diffElements.push({ type: 'deletion', content: originalWord });
			} else if ( ! originalWord && suggestedWord ) {
				diffElements.push({ type: 'insertion', content: suggestedWord });
			} else {
				diffElements.push({ type: 'deletion', content: originalWord });
				diffElements.push({ type: 'insertion', content: suggestedWord });
			}
		}
	}
	
	return diffElements;
}

/**
 * Component that shows diff visualization for a block with suggestions
 */
function SuggestionDiffDisplay( { blockClientId } ) {
	const mode = useSelect( ( select ) => {
		return select( editorStore ).getCollaborationMode();
	}, [] );

	const suggestions = useSelect( ( select ) => {
		if ( ! blockClientId ) {
			return {};
		}
		
		try {
			const suggestionsSelect = wp.data.select( 'gutenberg/suggestions' );
			if ( suggestionsSelect && suggestionsSelect.getBlockPendingSuggestions ) {
				return suggestionsSelect.getBlockPendingSuggestions( blockClientId );
			}
		} catch ( error ) {
			// Store not available yet
		}
		
		return {};
	}, [ blockClientId ] );

	const diffElements = useMemo( () => {
		const isInSuggestMode = mode === 'suggest';
		const hasSuggestions = Object.keys( suggestions ).length > 0;
		
		if ( ! isInSuggestMode || ! hasSuggestions ) {
			return [];
		}

		// Get the first suggestion
		const firstSuggestionId = Object.keys( suggestions )[ 0 ];
		const suggestion = suggestions[ firstSuggestionId ];
		
		if ( ! suggestion ) {
			return [];
		}

		console.log( '[SuggestionDiffDisplay] Creating diff for:', suggestion.originalContent, '→', suggestion.suggestedContent );
		
		return createSimpleDiff( suggestion.originalContent, suggestion.suggestedContent );
	}, [ mode, suggestions ] );

	// Only show in suggest mode with suggestions
	if ( diffElements.length === 0 ) {
		return null;
	}

	return (
		<div
			style={ {
				position: 'absolute',
				top: 0,
				left: 0,
				right: 0,
				backgroundColor: 'rgba(255, 255, 255, 0.95)',
				border: '2px solid #007cba',
				borderRadius: '4px',
				padding: '12px',
				zIndex: 1000,
				pointerEvents: 'none',
				fontSize: 'inherit',
				lineHeight: 'inherit',
				fontFamily: 'inherit',
			} }
		>
			<div
				style={ {
					position: 'absolute',
					top: '-25px',
					left: 0,
					backgroundColor: '#007cba',
					color: 'white',
					padding: '4px 8px',
					borderRadius: '4px 4px 0 0',
					fontSize: '12px',
					fontWeight: 'bold',
				} }
			>
				Suggested Change
			</div>
			<div>
				{ diffElements.map( ( element, index ) => {
					if ( element.type === 'deletion' ) {
						return (
							<span
								key={ index }
								style={ {
									backgroundColor: '#f8d7da',
									color: '#721c24',
									textDecoration: 'line-through',
									padding: '2px 4px',
									borderRadius: '2px',
									margin: '0 1px',
								} }
							>
								{ element.content }
							</span>
						);
					}
					
					if ( element.type === 'insertion' ) {
						return (
							<span
								key={ index }
								style={ {
									backgroundColor: '#d4edda',
									color: '#155724',
									textDecoration: 'underline',
									padding: '2px 4px',
									borderRadius: '2px',
									margin: '0 1px',
								} }
							>
								{ element.content }
							</span>
						);
					}
					
					// Equal content (unchanged)
					return (
						<span key={ index }>
							{ element.content }
						</span>
					);
				} ) }
			</div>
		</div>
	);
}

/**
 * Higher-order component that adds diff display to paragraph blocks
 */
const withSuggestionDiffDisplay = createHigherOrderComponent(
	( BlockEdit ) => ( props ) => {
		const { name, clientId } = props;
		
		// Only apply to paragraph blocks
		if ( name !== 'core/paragraph' ) {
			return <BlockEdit { ...props } />;
		}
		
		return (
			<div style={ { position: 'relative' } }>
				<BlockEdit { ...props } />
				<SuggestionDiffDisplay blockClientId={ clientId } />
			</div>
		);
	},
	'withSuggestionDiffDisplay'
);

/**
 * Add diff display to paragraph blocks
 */
addFilter(
	'editor.BlockEdit',
	'gutenberg/suggestion-diff-display',
	withSuggestionDiffDisplay,
	25 // High priority to wrap other components
);

export default SuggestionDiffDisplay;