/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useSelect, useDispatch } from '@wordpress/data';
import { useEffect, Fragment } from '@wordpress/element';
import { ToolbarGroup, ToolbarButton, Tooltip } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { BlockControls } from '@wordpress/block-editor';
import { check, close } from '@wordpress/icons';
import { store as coreStore } from '@wordpress/core-data';
import { store as blockEditorStore } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';
import {
	createTextSuggestion,
	applyTextSuggestion,
	SUGGESTION_STATUS,
	generateDiffVisualization,
	suggestionToCommentMeta,
	commentMetaToSuggestion,
} from '../suggestion-data-structures';
import withContentInterception, {
	getSuggestion,
	hasSuggestions,
	acceptSuggestion,
	rejectSuggestion,
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
			padding: 8px 8px 8px 8px !important;
			margin: 4px 0 !important;
			min-height: 40px !important;
			display: block !important;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif !important;
			width: 100% !important;
			box-sizing: border-box !important;
		}
		
		/* Ultra high specificity selectors for suggestion dot indicator */
		.wp-block-editor .suggestion-indicator,
		.block-editor-block-list__layout .suggestion-indicator,
		.edit-post-visual-editor .suggestion-indicator,
		div.suggestion-indicator {
			position: absolute !important;
			top: 50% !important;
			left: -20px !important;
			transform: translateY(-50%) !important;
			width: 8px !important;
			height: 8px !important;
			background: #28a745 !important;
			border-radius: 50% !important;
			z-index: 999999 !important;
			opacity: 0.6 !important;
			transition: opacity 0.2s ease !important;
			cursor: pointer !important;
			display: block !important;
		}
		
		/* Suggestion dot when block is focused (has .is-selected or .is-focused) */
		.wp-block-editor .is-selected .suggestion-indicator,
		.wp-block-editor .is-focused .suggestion-indicator,
		.block-editor-block-list__layout .is-selected .suggestion-indicator,
		.block-editor-block-list__layout .is-focused .suggestion-indicator,
		.edit-post-visual-editor .is-selected .suggestion-indicator,
		.edit-post-visual-editor .is-focused .suggestion-indicator,
		.is-selected div.suggestion-indicator,
		.is-focused div.suggestion-indicator {
			opacity: 1 !important;
		}
		
		/* Suggestion dot when hovering over the block wrapper */
		.wp-block-editor .suggestion-wrapper:hover .suggestion-indicator,
		.block-editor-block-list__layout .suggestion-wrapper:hover .suggestion-indicator,
		.edit-post-visual-editor .suggestion-wrapper:hover .suggestion-indicator,
		div.suggestion-wrapper:hover .suggestion-indicator {
			opacity: 1 !important;
		}
		
		/* Suggestion dot when hovering over the dot itself */
		.wp-block-editor .suggestion-indicator:hover,
		.block-editor-block-list__layout .suggestion-indicator:hover,
		.edit-post-visual-editor .suggestion-indicator:hover,
		div.suggestion-indicator:hover {
			opacity: 1 !important;
			transform: translateY(-50%) scale(1.2) !important;
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
		
		/* Remove padding from paragraphs within suggestion wrappers */
		.wp-block-editor .suggestion-wrapper p,
		.wp-block-editor .suggestion-wrapper .wp-block-paragraph,
		.block-editor-block-list__layout .suggestion-wrapper p,
		.block-editor-block-list__layout .suggestion-wrapper .wp-block-paragraph,
		.edit-post-visual-editor .suggestion-wrapper p,
		.edit-post-visual-editor .suggestion-wrapper .wp-block-paragraph,
		div.suggestion-wrapper p,
		div.suggestion-wrapper .wp-block-paragraph {
			padding: 0 !important;
			margin: 0 !important;
		}
	`;
	document.head.appendChild( style );
	stylesInjected = true;

}

/**
 * Create professional diff visualization using existing Gutenberg infrastructure
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

	// Create suggestion data using the professional system
	const suggestionData = createTextSuggestion( originalContent, suggestedContent, {
		clientId: 'temp',
		name: 'core/paragraph',
	} );

	// Use the new function that works directly with diff arrays
	return createDiffVisualizationFromDiff( suggestionData.diff );
}

/**
 * Create diff visualization directly from a diff array (for continuous edits)
 * This ensures we use the properly recalculated diff data from suggestion storage
 *
 * @param {Array} diffArray - diff-match-patch diff array
 * @return {string} HTML string with diff highlighting
 */
function createDiffVisualizationFromDiff( diffArray ) {
	if ( ! diffArray || ! Array.isArray( diffArray ) ) {
		return '';
	}

	// Generate diff elements using the professional visualization
	const diffElements = generateDiffVisualization( diffArray );

	// Convert to HTML format compatible with our styling
	return diffElements.map( ( element, index ) => {
		let className;
		switch ( element.type ) {
			case 'insertion':
				className = 'suggestion-addition';
				break;
			case 'deletion':
				className = 'suggestion-deletion';
				break;
			default:
				return element.content;
		}

		const encodedText = element.content
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /\n/g, '&para;<br>' );

		return `<span class="${ className }" data-diff-index="${ index }">${ encodedText }</span>`;
	} ).join( '' );
}

/**
 * Block Content Controller
 * Shows clean content in edit mode, diff overlay in suggest mode
 * Now uses professional Gutenberg suggestions infrastructure
 */
const BlockContentController = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		const { clientId, setAttributes } = props;
		
		// Direct dispatch to bypass interceptor for accept/reject actions
		const { updateBlockAttributes } = useDispatch( blockEditorStore );

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

		// Remove WordPress API calls that were causing conflicts

		// Check if block has suggestions using the working in-memory system
		const blockHasSuggestions = hasSuggestions( clientId );
		const showSuggestionOverlay = collaborationMode === 'suggest' && blockHasSuggestions;

		// Accept suggestion handler using working system
		const handleAcceptSuggestion = ( suggestionId ) => {
			const suggestion = getSuggestion( clientId );
			
			
			const result = acceptSuggestion( suggestionId );
			
			if ( result.success ) {
				// Apply the suggested content to the actual block using direct dispatch to bypass interceptor
				updateBlockAttributes( clientId, {
					content: result.appliedContent,
				} );
				
			}
		};

		// Reject suggestion handler using working system
		const handleRejectSuggestion = ( suggestionId ) => {
			const suggestion = getSuggestion( clientId );
			if ( ! suggestion ) {
				return;
			}
			
			const result = rejectSuggestion( suggestionId );
			
			if ( result.success ) {
				// Revert block back to original content using direct dispatch to bypass interceptor
				updateBlockAttributes( clientId, {
					content: suggestion.originalContent,
				} );
				
			}
		};


		// In suggest mode with suggestions, show diff with toolbar controls
		if ( showSuggestionOverlay ) {
			const suggestion = getSuggestion( clientId );

			// Don't show if suggestion is no longer pending
			if ( ! suggestion || suggestion.status !== 'pending' ) {
				return <BlockEdit { ...props } />;
			}

			// Use the stored diff data from the suggestion (already calculated and updated)
			// This ensures we use the properly recalculated diff for continuous edits
			const diffHtml = createDiffVisualizationFromDiff( suggestion.diff );

			// Modify the block attributes to show the diff content
			const modifiedProps = {
				...props,
				attributes: {
					...props.attributes,
					content: diffHtml, // Replace content with diff HTML
				},
			};

			// Wrap in suggestion styling with toolbar controls
			return (
				<Fragment>
					<BlockControls group="block">
						<ToolbarGroup>
							<ToolbarButton
								icon={ check }
								label={ __( 'Accept suggestion' ) }
								onClick={ () => handleAcceptSuggestion( suggestion.id ) }
							/>
							<ToolbarButton
								icon={ close }
								label={ __( 'Reject suggestion' ) }
								onClick={ () => handleRejectSuggestion( suggestion.id ) }
							/>
						</ToolbarGroup>
					</BlockControls>
					<div className="suggestion-wrapper">
						<Tooltip text={ `Suggestion: ${ suggestion.metadata?.editCount || 1 } ${ ( suggestion.metadata?.editCount || 1 ) === 1 ? 'change' : 'changes' } by ${ suggestion.author.name }` }>
							<div className="suggestion-indicator" />
						</Tooltip>
						<BlockEdit { ...modifiedProps } />
					</div>
				</Fragment>
			);
		}

		// Edit mode: show clean original content only
		return <BlockEdit { ...props } />;
	};
}, 'ProfessionalBlockContentController' );

/**
 * Initialize professional suggestions system
 */
export function initializeProfessionalSuggestionsSystem() {
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

}

export default initializeProfessionalSuggestionsSystem;