/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useSelect, useDispatch } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { navigateToComment } from '../../utils/comment-navigation';

/**
 * Higher-order component that adds comment indicators to blocks with comments
 */
const withCommentIndicator = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		const { clientId } = props;
		
		// Get comment data for this block
		const { hasComment, commentId, hasSuggestion } = useSelect( ( select ) => {
			const { getBlockAttributes } = select( blockEditorStore );
			const blockAttributes = getBlockAttributes( clientId );
			
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

		// Calculate indicator position - avoid conflicts with suggestion indicators
		const indicatorClass = hasSuggestion 
			? "block-comment-indicator block-comment-indicator--with-suggestion"
			: "block-comment-indicator";

		// Add comment indicator wrapper
		return (
			<div className="block-with-comment-wrapper" style={{ position: 'relative' }}>
				<div 
					className={ indicatorClass }
					onClick={ () => {
						navigateToComment( commentId, clientId );
					} }
					title={ `View comment on this ${ props.name?.replace( 'core/', '' ) || 'block' }` }
				/>
				{ blockEdit }
			</div>
		);
	};
}, 'withCommentIndicator' );

/**
 * Add comment indicator to all blocks
 */
addFilter(
	'editor.BlockEdit',
	'editor/block-comment-indicator',
	withCommentIndicator
);