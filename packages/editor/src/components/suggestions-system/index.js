/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useSelect } from '@wordpress/data';
import { useEffect, useMemo } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';

// Global state to track suggestions per block
const blockSuggestions = new Map();


/**
 * Suggestions system HOC that wraps paragraph blocks
 */
const withSuggestionsMode = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		// Only apply to paragraph blocks and only if experiment is enabled
		if ( props.name !== 'core/paragraph' || ! window.__experimentalSuggestionsMode ) {
			return <BlockEdit { ...props } />;
		}

		const { clientId } = props;
		const currentContent = props.attributes?.content || '';
		
		const { collaborationMode } = useSelect( ( select ) => {
			return {
				collaborationMode: select( editorStore ).getCollaborationMode?.() || 'edit'
			};
		}, [] );


		// Handle mode switching and suggestion tracking
		useEffect( () => {
			const blockState = blockSuggestions.get( clientId ) || {};
			
			if ( collaborationMode === 'suggest' ) {
				// Entering or staying in suggest mode
				if ( ! blockState.originalContent && currentContent ) {
					// First time entering suggest mode - capture original
					blockSuggestions.set( clientId, {
						originalContent: currentContent,
						hasSuggestions: false
					} );
					console.log( `[Suggestions] Captured original for ${clientId}:`, currentContent.slice(0, 30) );
				} else if ( blockState.originalContent && currentContent !== blockState.originalContent ) {
					// Content changed - mark as having suggestions
					blockSuggestions.set( clientId, {
						...blockState,
						hasSuggestions: true
					} );
					console.log( `[Suggestions] Detected change in ${clientId}` );
				}
			}
			// Note: In edit mode, we keep suggestions data but just don't display them
		}, [ collaborationMode, currentContent, clientId ] );

		// Determine if this block should show suggestion styling
		const blockState = blockSuggestions.get( clientId ) || {};
		const showAsSuggestion = collaborationMode === 'suggest' && blockState.hasSuggestions;
		
		// Debug logging
		// eslint-disable-next-line no-console
		console.log( `[Suggestions] Block ${clientId}: mode=${collaborationMode}, original=${blockState.originalContent?.slice(0,20)}..., current=${currentContent?.slice(0,20)}..., hasSuggestions=${blockState.hasSuggestions}, showAsSuggestion=${showAsSuggestion}, persistent=${!!blockState.originalContent}` );
		
		if ( showAsSuggestion ) {
			// eslint-disable-next-line no-console
			console.log( `[Suggestions] Applying suggestion styles to block ${clientId}` );
		}

		// Create enhanced props with suggestion styling - but don't modify content attributes
		const enhancedProps = useMemo( () => {
			if ( ! showAsSuggestion ) {
				return props;
			}

			return {
				...props,
				className: `${props.className || ''} suggestion-highlight`.trim()
			};
		}, [ props, showAsSuggestion ] );

		if ( showAsSuggestion ) {
			return (
				<div className="suggestion-wrapper">
					<BlockEdit { ...enhancedProps } />
					<div className="suggestion-indicator">
						Suggestion
					</div>
				</div>
			);
		}

		return <BlockEdit { ...props } />;
	};
}, 'withSuggestionsMode' );

/**
 * Initialize suggestions system
 */
export function initializeSuggestionsSystem() {
	// Only initialize if experiment is enabled
	if ( ! window.__experimentalSuggestionsMode ) {
		return;
	}


	// Add block edit filter
	addFilter(
		'editor.BlockEdit',
		'gutenberg/suggestions-mode',
		withSuggestionsMode
	);
}

export default initializeSuggestionsSystem;