/**
 * WordPress dependencies
 */
import { _x } from '@wordpress/i18n';
import { useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import CommentAuthorInfo from './comment-author-info';
import CommentForm from './comment-form';

/**
 * Renders the UI for adding a comment in the Gutenberg editor's collaboration sidebar.
 *
 * @param {Object}   props                     - The component props.
 * @param {Function} props.onSubmit            - A callback function to be called when the user submits a comment.
 * @param {boolean}  props.showCommentBoard    - The function to edit the comment.
 * @param {Function} props.setShowCommentBoard - The function to delete the comment.
 * @return {React.ReactNode} The rendered comment input UI.
 */
export function AddComment( {
	onSubmit,
	showCommentBoard,
	setShowCommentBoard,
} ) {
	const { clientId, blockCommentId } = useSelect( ( select ) => {
		const { getSelectedBlock } = select( blockEditorStore );
		const selectedBlock = getSelectedBlock();
		return {
			clientId: selectedBlock?.clientId,
			blockCommentId: selectedBlock?.attributes?.blockCommentId,
		};
	} );

	// Only show the add comment form if:
	// 1. showCommentBoard is true (user clicked to add comment)
	// 2. There's a selected block (clientId exists) 
	// 3. We're in "new comment" mode (regardless of existing blockCommentId)
	if ( ! showCommentBoard || ! clientId ) {
		return null;
	}

	return (
		<div className="editor-collab-sidebar-panel__thread editor-collab-sidebar-panel__active-thread editor-collab-sidebar-panel__focus-thread editor-collab-sidebar-panel__add-comment">
			<div className="editor-collab-sidebar-panel__add-comment-header">
				<CommentAuthorInfo />
			</div>
			<div className="editor-collab-sidebar-panel__add-comment-form">
				<CommentForm
					onSubmit={ ( inputComment ) => {
						onSubmit( inputComment );
					} }
					onCancel={ () => {
						setShowCommentBoard( false );
					} }
					submitButtonText={ _x( 'Comment', 'Add comment button' ) }
				/>
			</div>
		</div>
	);
}
