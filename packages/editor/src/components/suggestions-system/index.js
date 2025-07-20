/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useSelect } from '@wordpress/data';
import { useEffect } from '@wordpress/element';

/**
 * External dependencies
 */
import { diff_match_patch } from 'diff-match-patch';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';
import withContentInterception, {
	getSuggestion,
	hasSuggestions,
} from '../suggestions-content-interceptor';

// Force CSS injection with ultra-high specificity
let stylesInjected = false;
function ensureSuggestionsStyles() {
	if ( stylesInjected ) {
		return;
	}

	const style = document.createElement( 'style' );
	style.id = 'suggestions-system-forced-styles';
	style.textContent = `
		/* Ultra high specificity selectors for suggestion wrapper */
		.wp-block-editor .editor-styles-wrapper .suggestion-wrapper,
		.block-editor-block-list__layout .suggestion-wrapper,
		.edit-post-visual-editor .suggestion-wrapper,
		div.suggestion-wrapper {
			position: relative !important;
			border: 1px solid #28a745 !important;
			background-color: transparent !important;
			border-radius: 3px !important;
			padding: 8px !important;
			margin: 4px 0 !important;
			min-height: 40px !important;
			display: block !important;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif !important;
			width: 100% !important;
			box-sizing: border-box !important;
		}
		
		/* Ultra high specificity selectors for suggestion indicator */
		.wp-block-editor .suggestion-indicator,
		.block-editor-block-list__layout .suggestion-indicator,
		.edit-post-visual-editor .suggestion-indicator,
		div.suggestion-indicator {
			position: absolute !important;
			top: -8px !important;
			left: 8px !important;
			background: #28a745 !important;
			color: white !important;
			font-size: 10px !important;
			padding: 1px 4px !important;
			border-radius: 2px !important;
			font-weight: 500 !important;
			z-index: 999999 !important;
			pointer-events: none !important;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif !important;
			line-height: 1 !important;
			display: block !important;
		}
		
		/* Ultra high specificity selectors for suggestion additions - green underline */
		.wp-block-editor .suggestion-addition,
		.block-editor-block-list__layout .suggestion-addition,
		.edit-post-visual-editor .suggestion-addition,
		span.suggestion-addition {
			background: none !important;
			border-bottom: none !important;
			text-decoration: underline !important;
			text-decoration-color: #28a745 !important;
			text-decoration-thickness: 1px !important;
			color: inherit !important;
			font-weight: inherit !important;
			border-radius: none !important;
			padding: 0 !important;
			display: inline !important;
		}
		
		/* Ultra high specificity selectors for suggestion deletions - red strikethrough */
		.wp-block-editor .suggestion-deletion,
		.block-editor-block-list__layout .suggestion-deletion,
		.edit-post-visual-editor .suggestion-deletion,
		span.suggestion-deletion {
			background: none !important;
			border-bottom: none !important;
			text-decoration: line-through !important;
			text-decoration-color: #dc3545 !important;
			text-decoration-thickness: 1px !important;
			color: #dc3545 !important;
			font-weight: inherit !important;
			border-radius: none !important;
			padding: 0 !important;
			display: inline !important;
			opacity: 0.7 !important;
		}
		
		/* Ultra high specificity selectors for suggestion diff content */
		.wp-block-editor .suggestion-diff-content,
		.block-editor-block-list__layout .suggestion-diff-content,
		.edit-post-visual-editor .suggestion-diff-content,
		div.suggestion-diff-content {
			font-size: inherit !important;
			line-height: inherit !important;
			color: inherit !important;
			display: block !important;
			width: 100% !important;
		}
	`;
	document.head.appendChild( style );
	stylesInjected = true;

	// Also check if styles were actually injected
	setTimeout( () => {
		const injectedStyle = document.getElementById(
			'suggestions-system-forced-styles'
		);
		// eslint-disable-next-line no-console
		console.log( '[Suggestions System] Style injection verification:', {
			styleElementExists: !! injectedStyle,
			styleContent: injectedStyle?.textContent?.slice( 0, 100 ) + '...',
			totalRules: injectedStyle?.sheet?.cssRules?.length || 0,
		} );
	}, 100 );

	// eslint-disable-next-line no-console
	console.log(
		'[Suggestions System] Ultra-high specificity CSS injection completed'
	);
}

/**
 * Advanced diff visualization using Google's diff-match-patch
 *
 * @param {string} originalContent - Original content
 * @param {string} suggestedContent - Suggested content
 * @return {string} HTML string with diff highlighting
 */
function createDiffVisualization( originalContent, suggestedContent ) {
	if ( ! originalContent || ! suggestedContent ) {
		return suggestedContent || originalContent || '';
	}

	if ( originalContent === suggestedContent ) {
		return suggestedContent;
	}

	// Initialize diff-match-patch
	const dmp = new diff_match_patch();

	// Configure for optimal semantic cleanup
	dmp.Diff_Timeout = 1.0; // 1 second timeout
	dmp.Diff_EditCost = 4; // Default edit cost

	// Create diff array
	const diffs = dmp.diff_main( originalContent, suggestedContent );

	// Apply semantic cleanup to produce more human-readable diffs
	dmp.diff_cleanupSemantic( diffs );

	// Convert diff array to HTML with custom styling
	return createCustomDiffHtml( diffs );
}

/**
 * Convert diff array to HTML with custom Gutenberg-style classes
 *
 * @param {Array} diffs - Array of diff operations from diff-match-patch
 * @return {string} HTML string with custom diff styling
 */
function createCustomDiffHtml( diffs ) {
	const html = [];

	diffs.forEach( ( [ operation, text ] ) => {
		// Escape HTML entities in text
		const encodedText = text
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /\n/g, '&para;<br>' );

		switch ( operation ) {
			case 1: // Insertion
				html.push(
					`<span class="suggestion-addition">${ encodedText }</span>`
				);
				break;
			case -1: // Deletion
				html.push(
					`<span class="suggestion-deletion">${ encodedText }</span>`
				);
				break;
			case 0: // Equality
				html.push( encodedText );
				break;
			default:
				html.push( encodedText );
		}
	} );

	return html.join( '' );
}

/**
 * Block Content Controller
 * Shows clean content in edit mode, diff overlay in suggest mode
 */
const BlockContentController = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		const { clientId } = props;

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

		const blockHasSuggestions = hasSuggestions( clientId );
		const showSuggestionOverlay =
			collaborationMode === 'suggest' && blockHasSuggestions;

		// Debug logging
		useEffect( () => {
			// eslint-disable-next-line no-console
			console.log(
				`[Block Content Controller] Block ${ clientId }: mode=${ collaborationMode }, hasSuggestions=${ blockHasSuggestions }, showOverlay=${ showSuggestionOverlay }`
			);
		}, [
			collaborationMode,
			blockHasSuggestions,
			showSuggestionOverlay,
			clientId,
		] );

		// In suggest mode with suggestions, modify the block props to show diff content
		if ( showSuggestionOverlay ) {
			const suggestion = getSuggestion( clientId );

			// Create diff HTML
			const diffHtml = createDiffVisualization(
				suggestion.originalContent,
				suggestion.suggestedContent
			);

			// Modify the block attributes to show the diff content
			const modifiedProps = {
				...props,
				attributes: {
					...props.attributes,
					content: diffHtml, // Replace content with diff HTML
				},
			};

			// Wrap in suggestion styling
			return (
				<div className="suggestion-wrapper">
					<div className="suggestion-indicator">Suggestion</div>
					<BlockEdit { ...modifiedProps } />
				</div>
			);
		}

		// Edit mode: show clean original content only
		return <BlockEdit { ...props } />;
	};
}, 'BlockContentController' );

/**
 * Initialize suggestions system with proper content management
 */
export function initializeSuggestionsSystem() {
	// Only initialize if experiment is enabled
	if ( ! window.__experimentalSuggestionsMode ) {
		return;
	}

	// Ensure CSS styles are loaded
	ensureSuggestionsStyles();

	// Add content interception filter first (higher priority)
	addFilter(
		'editor.BlockEdit',
		'gutenberg/suggestions-content-interceptor',
		withContentInterception,
		5 // Higher priority than visual controller
	);

	// Add visual controller filter second (lower priority)
	addFilter(
		'editor.BlockEdit',
		'gutenberg/suggestions-visual-controller',
		BlockContentController,
		10 // Lower priority than content interceptor
	);

	// eslint-disable-next-line no-console
	console.log(
		'[Suggestions System] Initialized with content interception and visual overlay system'
	);
}

export default initializeSuggestionsSystem;
