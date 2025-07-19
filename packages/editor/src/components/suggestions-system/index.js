/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useSelect } from '@wordpress/data';
import { useEffect, useState, useMemo } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';

// Global state to track suggestions per block
const blockSuggestions = new Map();

// Simple CSS injection for suggestion styles
let stylesInjected = false;
function injectSuggestionStyles() {
	if ( stylesInjected ) return;
	
	const style = document.createElement( 'style' );
	style.textContent = `
		.suggestion-wrapper {
			position: relative;
		}
		.suggestion-indicator {
			position: absolute;
			top: -2px;
			right: -2px;
			background: #28a745;
			color: white;
			font-size: 10px;
			padding: 2px 4px;
			border-radius: 2px;
			font-weight: 500;
			z-index: 100;
			pointer-events: none;
		}
		.suggestion-highlight {
			border: 2px solid #28a745 !important;
			background-color: rgba(212, 237, 218, 0.1) !important;
		}
	`;
	document.head.appendChild( style );
	stylesInjected = true;
}

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

		// Inject styles once
		useEffect( () => {
			injectSuggestionStyles();
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
			} else {
				// Edit mode - clear suggestion state but don't modify content
				if ( blockState.originalContent ) {
					blockSuggestions.delete( clientId );
					console.log( `[Suggestions] Cleared suggestions for ${clientId}` );
				}
			}
		}, [ collaborationMode, currentContent, clientId ] );

		// Determine if this block should show suggestion styling
		const blockState = blockSuggestions.get( clientId ) || {};
		const showAsSuggestion = collaborationMode === 'suggest' && blockState.hasSuggestions;
		
		// Debug logging
		console.log( `[Suggestions] Block ${clientId}: mode=${collaborationMode}, original=${blockState.originalContent?.slice(0,20)}..., current=${currentContent?.slice(0,20)}..., hasSuggestions=${blockState.hasSuggestions}, showAsSuggestion=${showAsSuggestion}` );

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

		return (
			<div className={ showAsSuggestion ? 'suggestion-wrapper' : '' }>
				<BlockEdit { ...enhancedProps } />
				{ showAsSuggestion && (
					<div className="suggestion-indicator">
						Suggestion
					</div>
				) }
			</div>
		);
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

	// Clear suggestions when switching to edit mode globally
	let lastMode = 'edit';
	const checkModeChange = () => {
		if ( window.wp?.data ) {
			const currentMode = window.wp.data.select( editorStore ).getCollaborationMode?.() || 'edit';
			if ( lastMode === 'suggest' && currentMode === 'edit' ) {
				// Switched from suggest to edit - clear all suggestions
				blockSuggestions.clear();
				console.log( '[Suggestions] Cleared all suggestions on mode switch' );
			}
			lastMode = currentMode;
		}
		requestAnimationFrame( checkModeChange );
	};
	requestAnimationFrame( checkModeChange );

	// Add block edit filter
	addFilter(
		'editor.BlockEdit',
		'gutenberg/suggestions-mode',
		withSuggestionsMode
	);
}

export default initializeSuggestionsSystem;