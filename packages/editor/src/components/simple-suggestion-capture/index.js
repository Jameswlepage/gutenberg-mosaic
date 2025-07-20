/**
 * WordPress dependencies
 */
import { useEffect, useRef } from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { store as blockEditorStore } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';

/**
 * Simple hook to capture text changes in suggest mode
 */
function useSimpleSuggestionCapture( blockClientId ) {
	const previousContentRef = useRef( null );
	
	const content = useSelect( ( select ) => {
		if ( ! blockClientId ) {
			return '';
		}
		
		const block = select( blockEditorStore ).getBlock( blockClientId );
		return block?.attributes?.content || '';
	}, [ blockClientId ] );

	const isInSuggestMode = useSelect( ( select ) => {
		const mode = select( editorStore ).getCollaborationMode();
		return mode === 'suggest';
	}, [] );

	const { dispatch } = useDispatch();
	
	useEffect( () => {
		// Initialize previous content if not set
		if ( previousContentRef.current === null ) {
			previousContentRef.current = content;
			return;
		}
		
		// Only capture changes in suggest mode
		if ( ! isInSuggestMode ) {
			previousContentRef.current = content;
			return;
		}
		
		// Detect content changes
		if ( content !== previousContentRef.current ) {
			console.log( '[SimpleSuggestionCapture] Content changed from:', previousContentRef.current );
			console.log( '[SimpleSuggestionCapture] Content changed to:', content );
			
			// Try to add suggestion to store
			try {
				const suggestionsDispatch = wp.data.dispatch( 'gutenberg/suggestions' );
				if ( suggestionsDispatch && suggestionsDispatch.addSuggestion ) {
					const suggestionId = `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
					
					suggestionsDispatch.addSuggestion( blockClientId, suggestionId, {
						id: suggestionId,
						type: 'text_change',
						status: 'pending',
						originalContent: previousContentRef.current,
						suggestedContent: content,
						blockClientId,
						timestamp: Date.now(),
					} );
					
					console.log( '[SimpleSuggestionCapture] Added suggestion:', suggestionId );
				}
			} catch ( error ) {
				console.warn( '[SimpleSuggestionCapture] Could not add suggestion:', error );
			}
			
			previousContentRef.current = content;
		}
	}, [ content, isInSuggestMode, blockClientId ] );
}

/**
 * Higher-order component that adds simple suggestion capture to paragraph blocks
 */
const withSimpleSuggestionCapture = createHigherOrderComponent(
	( BlockEdit ) => ( props ) => {
		const { name, clientId } = props;
		
		// Only apply to paragraph blocks
		if ( name === 'core/paragraph' ) {
			useSimpleSuggestionCapture( clientId );
		}
		
		return <BlockEdit { ...props } />;
	},
	'withSimpleSuggestionCapture'
);

/**
 * Add simple suggestion capture to paragraph blocks
 * DISABLED - Replaced by suggestion-edit-interceptor
 */
// addFilter(
// 	'editor.BlockEdit',
// 	'gutenberg/simple-suggestion-capture',
// 	withSimpleSuggestionCapture,
// 	15 // Lower priority to run after other filters
// );

export default useSimpleSuggestionCapture;