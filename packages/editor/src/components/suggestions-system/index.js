/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useSelect } from '@wordpress/data';
import { useEffect, Fragment } from '@wordpress/element';
import { ToolbarGroup, ToolbarButton } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { BlockControls } from '@wordpress/block-editor';
import { check, close } from '@wordpress/icons';

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
			right: 8px !important;
			background: #28a745 !important;
			color: white !important;
			font-size: 10px !important;
			padding: 2px 6px !important;
			border-radius: 2px !important;
			font-weight: 500 !important;
			z-index: 999999 !important;
			pointer-events: none !important;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif !important;
			line-height: 1.2 !important;
			display: block !important;
			max-width: 200px !important;
			white-space: nowrap !important;
			overflow: hidden !important;
			text-overflow: ellipsis !important;
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

	// Configure for better diff detection
	dmp.Diff_Timeout = 1.0; // 1 second timeout
	dmp.Diff_EditCost = 4; // Default edit cost

	// Debug logging
	// eslint-disable-next-line no-console
	console.log( '[Diff Creation] Input comparison:', {
		original: originalContent.slice( 0, 50 ) + '...',
		suggested: suggestedContent.slice( 0, 50 ) + '...',
		originalLength: originalContent.length,
		suggestedLength: suggestedContent.length,
	} );

	// Create diff array
	const diffs = dmp.diff_main( originalContent, suggestedContent );

	// Apply semantic cleanup to produce more human-readable diffs
	dmp.diff_cleanupSemantic( diffs );

	// Debug the raw diff result before HTML conversion
	// eslint-disable-next-line no-console
	console.log( '[Diff Creation] Raw diff result:', diffs.map( ( [ op, text ] ) => ({
		op: op === 1 ? 'INSERT' : op === -1 ? 'DELETE' : 'EQUAL',
		text: `"${ text.slice( 0, 30 ) }"${ text.length > 30 ? '...' : '' }`,
		length: text.length,
	} ) ) );

	// Count operations for debugging
	const insertions = diffs.filter( ( [ op ] ) => op === 1 ).length;
	const deletions = diffs.filter( ( [ op ] ) => op === -1 ).length;
	const equals = diffs.filter( ( [ op ] ) => op === 0 ).length;
	// eslint-disable-next-line no-console
	console.log( `[Diff Creation] Operation counts: ${ insertions } insertions, ${ deletions } deletions, ${ equals } equals` );

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

	// Debug logging to understand the diff structure
	// eslint-disable-next-line no-console
	console.log( '[Diff Rendering] Processing diffs:', diffs.map( ( [ op, text ], index ) => ({
		index,
		operation: op === 1 ? 'INSERT' : op === -1 ? 'DELETE' : 'EQUAL',
		text: text.slice( 0, 20 ) + ( text.length > 20 ? '...' : '' ),
		length: text.length,
		charCodes: text.split( '' ).map( c => c.charCodeAt( 0 ) ).slice( 0, 10 ),
	} ) ) );

	// Count how many deletions we're processing
	const deletionCount = diffs.filter( ( [ op ] ) => op === -1 ).length;
	// eslint-disable-next-line no-console
	console.log( `[Diff Rendering] Processing ${ deletionCount } deletion operations` );

	diffs.forEach( ( [ operation, text ], index ) => {
		// Escape HTML entities in text
		const encodedText = text
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /\n/g, '&para;<br>' );

		switch ( operation ) {
			case 1: // Insertion
				html.push(
					`<span class="suggestion-addition" data-diff-index="${ index }">${ encodedText }</span>`
				);
				break;
			case -1: // Deletion
				// Split deletion text by word boundaries and wrap each word separately
				// This ensures that each deleted word gets its own strikethrough span
				if ( text.trim() ) {
					// Split on word boundaries but preserve whitespace
					const parts = text.split( /(\s+)/ );
					parts.forEach( ( part, partIndex ) => {
						if ( part ) {
							const encodedPart = part
								.replace( /&/g, '&amp;' )
								.replace( /</g, '&lt;' )
								.replace( />/g, '&gt;' )
								.replace( /\n/g, '&para;<br>' );
							html.push(
								`<span class="suggestion-deletion" data-diff-index="${ index }-${ partIndex }">${ encodedPart }</span>`
							);
						}
					} );
				} else {
					// Handle whitespace-only deletions
					html.push(
						`<span class="suggestion-deletion" data-diff-index="${ index }">${ encodedText }</span>`
					);
				}
				break;
			case 0: // Equality
				html.push( encodedText );
				break;
			default:
				html.push( encodedText );
		}
	} );

	const result = html.join( '' );
	
	// Count deletion spans in generated HTML
	const deletionSpanCount = ( result.match( /class="suggestion-deletion"/g ) || [] ).length;
	// eslint-disable-next-line no-console
	console.log( `[Diff Rendering] Generated ${ deletionSpanCount } deletion spans in HTML` );
	// eslint-disable-next-line no-console
	console.log( '[Diff Rendering] Generated HTML preview:', result.slice( 0, 200 ) + '...' );
	
	return result;
}



/**
 * Block Content Controller
 * Shows clean content in edit mode, diff overlay in suggest mode
 */
const BlockContentController = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		const { clientId, setAttributes } = props;

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

		// Accept suggestion handler
		const handleAcceptSuggestion = ( suggestionId ) => {
			const result = acceptSuggestion( suggestionId );
			
			if ( result.success ) {
				// Apply the suggested content to the actual block
				setAttributes( {
					content: result.appliedContent,
				} );
				
				// eslint-disable-next-line no-console
				console.log( '[Suggestion] Accepted and applied:', suggestionId );
			}
		};

		// Reject suggestion handler
		const handleRejectSuggestion = ( suggestionId ) => {
			const suggestion = getSuggestion( clientId );
			if ( ! suggestion ) {
				return;
			}
			
			const result = rejectSuggestion( suggestionId );
			
			if ( result.success ) {
				// Revert block back to original content
				setAttributes( {
					content: suggestion.originalContent,
				} );
				
				// eslint-disable-next-line no-console
				console.log( '[Suggestion] Rejected - reverted to original content:', suggestionId );
			} else {
				// eslint-disable-next-line no-console
				console.error( '[Suggestion] Failed to reject:', result.error );
			}
		};

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

		// In suggest mode with suggestions, show diff with hover toolbar
		if ( showSuggestionOverlay ) {
			const suggestion = getSuggestion( clientId );

			// Don't show if suggestion is no longer pending
			if ( ! suggestion || suggestion.status !== 'pending' ) {
				return <BlockEdit { ...props } />;
			}

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

			// Wrap in suggestion styling with toolbar controls and hover info
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
						<div className="suggestion-indicator">
							Suggestion: { suggestion.metadata?.editCount || 1 } { ( suggestion.metadata?.editCount || 1 ) === 1 ? 'change' : 'changes' } by { suggestion.author.name }
						</div>
						<BlockEdit { ...modifiedProps } />
					</div>
				</Fragment>
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
		'[Suggestions System] Initialized with content interception, visual overlay, and block toolbar integration'
	);
}

export default initializeSuggestionsSystem;
