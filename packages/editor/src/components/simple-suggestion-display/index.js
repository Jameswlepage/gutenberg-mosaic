/**
 * WordPress dependencies
 */
import { useSelect } from '@wordpress/data';
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';

/**
 * Simple component to show suggestion status
 */
function SimpleSuggestionDisplay( { blockClientId } ) {
	const mode = useSelect( ( select ) => {
		return select( editorStore ).getCollaborationMode();
	}, [] );

	const suggestions = useSelect( ( select ) => {
		if ( ! blockClientId ) {
			return {};
		}
		
		// Try to get suggestions from store
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

	const hasSuggestions = Object.keys( suggestions ).length > 0;
	const isInSuggestMode = mode === 'suggest';

	// Only show in suggest mode with suggestions
	if ( ! isInSuggestMode || ! hasSuggestions ) {
		return null;
	}

	return (
		<div
			style={ {
				position: 'absolute',
				top: '-25px',
				left: '0',
				backgroundColor: '#007cba',
				color: 'white',
				padding: '4px 8px',
				borderRadius: '4px',
				fontSize: '12px',
				zIndex: 1000,
				pointerEvents: 'none',
			} }
		>
			📝 Suggestion pending
		</div>
	);
}

/**
 * Higher-order component that adds simple suggestion display to paragraph blocks
 */
const withSimpleSuggestionDisplay = createHigherOrderComponent(
	( BlockEdit ) => ( props ) => {
		const { name, clientId } = props;
		
		// Only apply to paragraph blocks
		if ( name !== 'core/paragraph' ) {
			return <BlockEdit { ...props } />;
		}
		
		return (
			<div style={ { position: 'relative' } }>
				<BlockEdit { ...props } />
				<SimpleSuggestionDisplay blockClientId={ clientId } />
			</div>
		);
	},
	'withSimpleSuggestionDisplay'
);

/**
 * Add simple suggestion display to paragraph blocks
 */
addFilter(
	'editor.BlockEdit',
	'gutenberg/simple-suggestion-display',
	withSimpleSuggestionDisplay,
	20 // Higher priority to wrap other components
);

export default SimpleSuggestionDisplay;