/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useSelect, useDispatch } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { navigateToComment } from '../../utils/comment-navigation';

// Force CSS injection with ultra-high specificity for comment indicators
let commentStylesInjected = false;

function ensureCommentIndicatorStyles() {
	if ( commentStylesInjected ) {
		return;
	}

	const style = document.createElement( 'style' );
	style.id = 'comment-system-forced-styles';
	style.textContent = `
		/* Ultra high specificity selectors for comment block wrapper */
		.wp-block-editor .block-with-comment-wrapper,
		.block-editor-block-list__layout .block-with-comment-wrapper,
		.edit-post-visual-editor .block-with-comment-wrapper,
		div.block-with-comment-wrapper {
			position: relative !important;
		}
		
		/* Ultra high specificity selectors for comment dot indicator */
		.wp-block-editor .block-comment-indicator,
		.block-editor-block-list__layout .block-comment-indicator,
		.edit-post-visual-editor .block-comment-indicator,
		div.block-comment-indicator {
			position: absolute !important;
			top: 50% !important;
			left: -20px !important;
			transform: translateY(-50%) !important;
			width: 8px !important;
			height: 8px !important;
			background: #f0b849 !important;
			border-radius: 50% !important;
			z-index: 999999 !important;
			opacity: 0.6 !important;
			transition: opacity 0.2s ease !important;
			cursor: pointer !important;
			display: block !important;
		}
		
		/* Comment dot when block is focused (has .is-selected or .is-focused) */
		.wp-block-editor .is-selected .block-comment-indicator,
		.wp-block-editor .is-focused .block-comment-indicator,
		.block-editor-block-list__layout .is-selected .block-comment-indicator,
		.block-editor-block-list__layout .is-focused .block-comment-indicator,
		.edit-post-visual-editor .is-selected .block-comment-indicator,
		.edit-post-visual-editor .is-focused .block-comment-indicator,
		.is-selected div.block-comment-indicator,
		.is-focused div.block-comment-indicator {
			opacity: 1 !important;
		}
		
		/* Comment dot when hovering over the block wrapper */
		.wp-block-editor .block-with-comment-wrapper:hover .block-comment-indicator,
		.block-editor-block-list__layout .block-with-comment-wrapper:hover .block-comment-indicator,
		.edit-post-visual-editor .block-with-comment-wrapper:hover .block-comment-indicator,
		div.block-with-comment-wrapper:hover .block-comment-indicator {
			opacity: 1 !important;
		}
		
		/* Comment dot when hovering over the dot itself */
		.wp-block-editor .block-comment-indicator:hover,
		.block-editor-block-list__layout .block-comment-indicator:hover,
		.edit-post-visual-editor .block-comment-indicator:hover,
		div.block-comment-indicator:hover {
			opacity: 1 !important;
			transform: translateY(-50%) scale(1.2) !important;
		}

		/* Position adjustment when both comment and suggestion indicators exist */
		.wp-block-editor .block-comment-indicator--with-suggestion,
		.block-editor-block-list__layout .block-comment-indicator--with-suggestion,
		.edit-post-visual-editor .block-comment-indicator--with-suggestion,
		div.block-comment-indicator--with-suggestion {
			top: calc(50% - 10px) !important;
		}
	`;
	document.head.appendChild( style );
	commentStylesInjected = true;
}

/**
 * Higher-order component that adds comment indicators to blocks with comments
 */
const withCommentIndicator = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		const { clientId, name } = props;
		
		// Get comment data for this block
		const { hasComment, commentId, hasSuggestion } = useSelect( ( select ) => {
			const { getBlockAttributes } = select( blockEditorStore );
			const blockAttributes = getBlockAttributes( clientId );
			
			// Debug logging
			if ( blockAttributes?.blockCommentId ) {
				console.log( 'Comment indicator found for block:', {
					clientId,
					blockType: name,
					commentId: blockAttributes.blockCommentId,
					allAttributes: blockAttributes
				} );
			}
			
			return {
				hasComment: !! blockAttributes?.blockCommentId,
				commentId: blockAttributes?.blockCommentId,
				// Check if block has suggestions too (avoid positioning conflicts)
				hasSuggestion: !! blockAttributes?.suggestionId,
			};
		}, [ clientId ] );

		// Render the original block
		const blockEdit = <BlockEdit { ...props } />;

		// If no comment, return original block
		if ( ! hasComment ) {
			return blockEdit;
		}

		console.log( 'Rendering comment indicator for block:', clientId, 'with comment:', commentId );

		// Calculate indicator position - avoid conflicts with suggestion indicators
		const indicatorClass = hasSuggestion 
			? "block-comment-indicator block-comment-indicator--with-suggestion"
			: "block-comment-indicator";

		// Add comment indicator wrapper
		return (
			<div className="block-with-comment-wrapper">
				<div 
					className={ indicatorClass }
					onClick={ (e) => {
						e.preventDefault();
						e.stopPropagation();
						console.log( 'Comment indicator clicked for:', commentId, clientId );
						navigateToComment( commentId, clientId );
					} }
					title={ `View comment on this ${ name?.replace( 'core/', '' ) || 'block' }` }
				/>
				{ blockEdit }
			</div>
		);
	};
}, 'withCommentIndicator' );

/**
 * Add comment indicator to all blocks
 */
// Ensure CSS styles are injected first with highest priority
addFilter(
	'editor.BlockEdit',
	'editor/comment-indicator-styles',
	() => {
		ensureCommentIndicatorStyles();
		return ( BlockEdit ) => BlockEdit;
	},
	1 // Highest priority to ensure styles are injected first
);

// Add comment indicators with lower priority
addFilter(
	'editor.BlockEdit',
	'editor/block-comment-indicator',
	withCommentIndicator,
	15 // Lower priority than suggestions system
);