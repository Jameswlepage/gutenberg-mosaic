/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { useState, RawHTML } from '@wordpress/element';
import {
	__experimentalConfirmDialog as ConfirmDialog,
} from '@wordpress/components';
import { Icon, check } from '@wordpress/icons';
import { __, _x, sprintf } from '@wordpress/i18n';
import { useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import CommentAuthorInfo from './comment-author-info';
import CommentForm from './comment-form';
import { CollapsedComment } from './collapsed-comment';
import { ActiveCommentHeader } from './active-comment-header';
import { ReplyToThread } from './reply-to-thread';

/**
 * Renders the Comments component.
 *
 * @param {Object}   props                     - The component props.
 * @param {Array}    props.threads             - The array of comment threads.
 * @param {Function} props.onEditComment       - The function to handle comment editing.
 * @param {Function} props.onAddReply          - The function to add a reply to a comment.
 * @param {Function} props.onCommentDelete     - The function to delete a comment.
 * @param {Function} props.onCommentResolve    - The function to mark a comment as resolved.
 * @param {boolean}  props.showCommentBoard    - Whether to show the comment board.
 * @param {Function} props.setShowCommentBoard - The function to set the comment board visibility.
 * @return {React.ReactNode} The rendered Comments component.
 */
export function Comments( {
	threads,
	onEditComment,
	onAddReply,
	onCommentDelete,
	onCommentResolve,
	showCommentBoard,
	setShowCommentBoard,
} ) {
	const { blockCommentId } = useSelect( ( select ) => {
		const { getBlockAttributes, getSelectedBlockClientId } =
			select( blockEditorStore );
		const _clientId = getSelectedBlockClientId();

		return {
			blockCommentId: _clientId
				? getBlockAttributes( _clientId )?.blockCommentId
				: null,
		};
	}, [] );

	const [ activeCommentId, setActiveCommentId ] = useState(
		showCommentBoard && blockCommentId ? blockCommentId : null
	);

	const handleCommentActivate = ( commentId ) => {
		setActiveCommentId( activeCommentId === commentId ? null : commentId );
	};

	const clearThreadFocus = () => {
		setActiveCommentId( null );
		setShowCommentBoard( false );
	};

	return (
		<div className="editor-collab-sidebar-panel__threads">
			{
				// If there are no comments, show a message indicating no comments are available.
				( ! Array.isArray( threads ) || threads.length === 0 ) && (
					<div className="editor-collab-sidebar-panel__thread editor-collab-sidebar-panel__no-comments">
						{
							// translators: message displayed when there are no comments available
							__( 'No comments available' )
						}
					</div>
				)
			}
			{ Array.isArray( threads ) &&
				threads.length > 0 &&
				threads.map( ( thread ) => (
					<div
						key={ thread.id }
						className={ clsx(
							'editor-collab-sidebar-panel__thread',
							{
								'editor-collab-sidebar-panel__active-thread':
									blockCommentId &&
									blockCommentId === thread.id,
								'editor-collab-sidebar-panel__focus-thread':
									activeCommentId && activeCommentId === thread.id,
							}
						) }
						id={ thread.id }
					>
						<Thread
							thread={ thread }
							onAddReply={ onAddReply }
							onCommentDelete={ onCommentDelete }
							onCommentResolve={ onCommentResolve }
							onEditComment={ onEditComment }
							isActive={ activeCommentId === thread.id }
							onActivate={ handleCommentActivate }
							clearThreadFocus={ clearThreadFocus }
						/>
					</div>
				) ) }
		</div>
	);
}

function Thread( {
	thread,
	onEditComment,
	onAddReply,
	onCommentDelete,
	onCommentResolve,
	isActive,
	onActivate,
	clearThreadFocus,
} ) {
	return (
		<div className="editor-collab-sidebar-panel__thread-container">
			<CommentBoard
				thread={ thread }
				onResolve={ onCommentResolve }
				onEdit={ onEditComment }
				onDelete={ onCommentDelete }
				status={ thread.status }
				isActive={ isActive }
				onActivate={ onActivate }
			/>
			{ 0 < thread?.reply?.length && (
				<div className="editor-collab-sidebar-panel__replies">
					{ ! isActive && (
						<div className="editor-collab-sidebar-panel__show-more-reply">
							{ sprintf(
								// translators: %s: number of replies.
								_x(
									'%s more replies..',
									'Show replies button'
								),
								thread?.reply?.length
							) }
						</div>
					) }

					{ isActive &&
						thread.reply.map( ( reply ) => (
							<div
								key={ reply.id }
								className="editor-collab-sidebar-panel__child-thread"
								id={ reply.id }
							>
								{ 'approved' !== thread.status && (
									<CommentBoard
										thread={ reply }
										onEdit={ onEditComment }
										onDelete={ onCommentDelete }
									/>
								) }
								{ 'approved' === thread.status && (
									<CommentBoard thread={ reply } />
								) }
							</div>
						) ) }
				</div>
			) }
			{ 'approved' !== thread.status && isActive && (
				<div className="editor-collab-sidebar-panel__child-thread">
					<ReplyToThread
						onAddReply={ onAddReply }
						threadId={ thread.id }
					/>
				</div>
			) }
		</div>
	);
}

const CommentBoard = ( { thread, onResolve, onEdit, onDelete, status, isActive, onActivate } ) => {
	const [ actionState, setActionState ] = useState( false );
	const [ showConfirmDialog, setShowConfirmDialog ] = useState( false );

	// User permission system (placeholder - will be enhanced later)
	// TODO: Replace with proper user permission checks
	const canEdit = true; // For now, assume all users can edit
	const canDelete = true; // For now, assume all users can delete

	const handleConfirmDelete = () => {
		onDelete( thread.id );
		setActionState( false );
		setShowConfirmDialog( false );
	};

	const handleConfirmResolve = () => {
		onResolve( thread.id );
		setActionState( false );
		setShowConfirmDialog( false );
	};

	const handleCancel = () => {
		setActionState( false );
		setShowConfirmDialog( false );
	};

	// Show collapsed comment if not active
	if ( ! isActive ) {
		return <CollapsedComment thread={ thread } onActivate={ onActivate } />;
	}

	// Show active comment with all functionality
	return (
		<div className="editor-collab-sidebar-panel__comment">
			{/* Action header with resolve/delete buttons */}
			{ ( canEdit || canDelete || ( thread.parent === 0 && onResolve ) ) && (
				<div className="editor-collab-sidebar-panel__comment-actions-header">
					{/* Always show resolve for main comments that aren't resolved yet */}
					{ thread.parent === 0 && onResolve && thread.status !== 'approved' && (
						<button
							className="editor-collab-sidebar-panel__header-action editor-collab-sidebar-panel__header-action-resolve"
							onClick={ () => {
								setActionState( 'resolve' );
								setShowConfirmDialog( true );
							} }
						>
							{ __( 'Resolve' ) }
						</button>
					) }

					{/* Show delete if user has permission */}
					{ canDelete && (
						<button
							className="editor-collab-sidebar-panel__header-action editor-collab-sidebar-panel__header-action-delete"
							onClick={ () => {
								setActionState( 'delete' );
								setShowConfirmDialog( true );
							} }
						>
							{ __( 'Delete' ) }
						</button>
					) }
				</div>
			) }

			{/* User info with avatar */}
			<div className="editor-collab-sidebar-panel__comment-header">
				<img
					src={ thread?.author_avatar_urls?.[ 48 ] || thread?.author_avatar_urls?.[ 24 ] }
					className="editor-collab-sidebar-panel__user-avatar"
					alt="User avatar"
					width="24"
					height="24"
				/>
				<span className="editor-collab-sidebar-panel__user-name">
					{ thread.author_name }
				</span>
				<span className="editor-collab-sidebar-panel__user-time">
					{ new Date( thread.date ).toLocaleTimeString( [], {
						hour: 'numeric',
						minute: '2-digit',
						hour12: true,
					} ) }
				</span>
				{ status === 'approved' && (
					<span className="editor-collab-sidebar-panel__resolved-icon" title={ __( 'Resolved' ) }>
						<Icon icon={ check } />
					</span>
				) }
			</div>

			{/* Comment content or edit form */}
			<div className="editor-collab-sidebar-panel__comment-content">
				{ 'edit' === actionState && (
					<CommentForm
						onSubmit={ ( value ) => {
							onEdit( thread.id, value );
							setActionState( false );
						} }
						onCancel={ () => handleCancel() }
						thread={ thread }
						submitButtonText={ _x( 'Update', 'verb' ) }
					/>
				) }
				{ 'edit' !== actionState && (
					<div className="editor-collab-sidebar-panel__comment-text">
						<RawHTML>{ thread?.content?.raw }</RawHTML>
					</div>
				) }
			</div>

			{/* User action buttons (edit/delete) below content */}
			{ ( canEdit || canDelete ) && 'edit' !== actionState && (
				<div className="editor-collab-sidebar-panel__comment-actions">
					{ canEdit && onEdit && (
						<button
							className="editor-collab-sidebar-panel__action-button editor-collab-sidebar-panel__action-edit"
							onClick={ () => setActionState( 'edit' ) }
						>
							{ __( 'Edit' ) }
						</button>
					) }
					{ canDelete && onDelete && (
						<button
							className="editor-collab-sidebar-panel__action-button editor-collab-sidebar-panel__action-delete"
							onClick={ () => {
								setActionState( 'delete' );
								setShowConfirmDialog( true );
							} }
						>
							{ __( 'Delete' ) }
						</button>
					) }
				</div>
			) }

			{/* Confirmation dialogs */}
			{ 'resolve' === actionState && (
				<ConfirmDialog
					isOpen={ showConfirmDialog }
					onConfirm={ handleConfirmResolve }
					onCancel={ handleCancel }
					confirmButtonText="Yes"
					cancelButtonText="No"
				>
					{ __( 'Are you sure you want to mark this comment as resolved?' ) }
				</ConfirmDialog>
			) }
			{ 'delete' === actionState && (
				<ConfirmDialog
					isOpen={ showConfirmDialog }
					onConfirm={ handleConfirmDelete }
					onCancel={ handleCancel }
					confirmButtonText="Yes"
					cancelButtonText="No"
				>
					{ __( 'Are you sure you want to delete this comment?' ) }
				</ConfirmDialog>
			) }
		</div>
	);
};
