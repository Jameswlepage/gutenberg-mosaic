/**
 * WordPress dependencies
 */
import { ToolbarButton } from '@wordpress/components';
import { _x } from '@wordpress/i18n';
import { comment as commentIcon } from '@wordpress/icons';
import { privateApis as blockEditorPrivateApis } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import { unlock } from '../../lock-unlock';

const { CommentIconToolbarSlotFill } = unlock( blockEditorPrivateApis );

const AddCommentToolbarButton = ( { onClick } ) => {
	const handleClick = ( event ) => {
		// Prevent any default behavior and event bubbling
		event.preventDefault();
		event.stopPropagation();
		
		// Call our handler
		onClick();
	};

	const handleMouseEnter = ( event ) => {
		// Stop mouse enter from bubbling to prevent triggering other UI
		event.stopPropagation();
	};

	return (
		<CommentIconToolbarSlotFill.Fill>
			<ToolbarButton
				icon={ commentIcon }
				label={ _x( 'Comment', 'View or add comment' ) }
				onClick={ handleClick }
				onMouseEnter={ handleMouseEnter }
				aria-haspopup="dialog"
			/>
		</CommentIconToolbarSlotFill.Fill>
	);
};

export default AddCommentToolbarButton;
