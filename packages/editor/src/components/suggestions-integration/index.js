/**
 * WordPress dependencies
 */
import { useEffect } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';

/**
 * Internal dependencies
 */
import { registerSuggestionsMiddleware } from '../../store/suggestions-middleware-registration';
import { withSuggestionVisualOverlay } from '../suggestion-visual-overlay';
import suggestionsStore, { SUGGESTIONS_STORE_NAME } from '../../store/suggestions-store';
// import '../suggestion-edit-interceptor'; // Disabled - using middleware instead
import '../simple-suggestion-display'; // Import to register the display filters
import '../suggestion-diff-display'; // Import to register the diff display

/**
 * Initialize suggestions store and middleware
 */
let hasInitialized = false;

export function initializeSuggestionsSystem() {
	if ( hasInitialized ) {
		return;
	}
	
	hasInitialized = true;
	
	// Ensure the suggestions store is properly registered
	console.log( '[SuggestionsSystem] Initializing suggestions system' );
	console.log( '[SuggestionsSystem] Store registered:', SUGGESTIONS_STORE_NAME );
	
	// Register the middleware after a short delay to ensure stores are ready
	setTimeout( () => {
		console.log( '[SuggestionsSystem] Registering middleware' );
		registerSuggestionsMiddleware();
	}, 100 );
}

/**
 * Higher-order component that integrates all suggestion functionality
 */
const withSuggestionsIntegration = createHigherOrderComponent(
	( BlockEdit ) => ( props ) => {
		const { name } = props;
		
		// Apply visual overlay to paragraph blocks
		if ( name === 'core/paragraph' ) {
			const BlockEditWithOverlay = withSuggestionVisualOverlay( BlockEdit );
			return <BlockEditWithOverlay { ...props } />;
		}
		
		return <BlockEdit { ...props } />;
	},
	'withSuggestionsIntegration'
);

/**
 * Add suggestions integration to all blocks
 */
addFilter(
	'editor.BlockEdit',
	'gutenberg/suggestions/integration',
	withSuggestionsIntegration,
	30
);

/**
 * Component that initializes the suggestions system
 */
export function SuggestionsSystemInitializer() {
	useEffect( () => {
		initializeSuggestionsSystem();
	}, [] );
	
	return null;
}

export default SuggestionsSystemInitializer;