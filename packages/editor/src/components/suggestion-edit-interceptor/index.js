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
 * Hook that intercepts and prevents content changes in suggest mode
 */
function useSuggestionEditInterceptor( blockClientId, currentContent, setAttributes ) {
	const originalContentRef = useRef( null );
	const isInterceptingRef = useRef( false );
	
	const isInSuggestMode = useSelect( ( select ) => {
		const mode = select( editorStore ).getCollaborationMode();
		return mode === 'suggest';
	}, [] );

	// Store original content when entering suggest mode
	useEffect( () => {
		if ( isInSuggestMode && originalContentRef.current === null ) {
			originalContentRef.current = currentContent;
			console.log( '[EditInterceptor] Stored original content:', currentContent );
		} else if ( ! isInSuggestMode ) {
			originalContentRef.current = null;
			isInterceptingRef.current = false;
		}
	}, [ isInSuggestMode, currentContent ] );

	// Intercept content changes
	useEffect( () => {
		if ( ! isInSuggestMode || ! originalContentRef.current || isInterceptingRef.current ) {
			return;
		}

		// If content has changed from original, we need to intercept
		if ( currentContent !== originalContentRef.current ) {
			console.log( '[EditInterceptor] Content change detected, intercepting...' );
			console.log( '[EditInterceptor] Original:', originalContentRef.current );
			console.log( '[EditInterceptor] Current:', currentContent );
			
			isInterceptingRef.current = true;
			
			// Revert to original content
			setAttributes( { content: originalContentRef.current } );
			
			// Create suggestion
			try {
				const suggestionsDispatch = wp.data.dispatch( 'gutenberg/suggestions' );
				if ( suggestionsDispatch && suggestionsDispatch.addSuggestion ) {
					const suggestionId = `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
					
					suggestionsDispatch.addSuggestion( blockClientId, suggestionId, {
						id: suggestionId,
						type: 'text_change',
						status: 'pending',
						originalContent: originalContentRef.current,
						suggestedContent: currentContent,
						blockClientId,
						timestamp: Date.now(),
					} );
					
					console.log( '[EditInterceptor] Created suggestion:', suggestionId );
				}
			} catch ( error ) {
				console.warn( '[EditInterceptor] Could not create suggestion:', error );
			}
			
			// Reset interception flag after a brief delay
			setTimeout( () => {
				isInterceptingRef.current = false;
			}, 100 );
		}
	}, [ currentContent, isInSuggestMode, blockClientId, setAttributes ] );

	return {
		originalContent: originalContentRef.current,
		isIntercepting: isInterceptingRef.current,
	};
}

/**
 * Higher-order component that adds edit interception to paragraph blocks
 */
const withSuggestionEditInterceptor = createHigherOrderComponent(
	( BlockEdit ) => ( props ) => {
		const { name, attributes, setAttributes, clientId } = props;
		
		// Only apply to paragraph blocks
		if ( name !== 'core/paragraph' ) {
			return <BlockEdit { ...props } />;
		}

		// Use the interceptor hook
		const { originalContent, isIntercepting } = useSuggestionEditInterceptor(
			clientId,
			attributes.content || '',
			setAttributes
		);

		// Add interceptor info to props for debugging
		const enhancedProps = {
			...props,
			__suggestionInterceptor: {
				originalContent,
				isIntercepting,
				currentContent: attributes.content || '',
			},
		};

		return <BlockEdit { ...enhancedProps } />;
	},
	'withSuggestionEditInterceptor'
);

/**
 * Add edit interception to paragraph blocks
 */
addFilter(
	'editor.BlockEdit',
	'gutenberg/suggestion-edit-interceptor',
	withSuggestionEditInterceptor,
	5 // Very high priority to intercept early
);

export default useSuggestionEditInterceptor;