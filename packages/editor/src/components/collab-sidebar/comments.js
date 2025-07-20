/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { useState, RawHTML } from '@wordpress/element';
import {
	__experimentalHStack as HStack,
	__experimentalVStack as VStack,
	__experimentalConfirmDialog as ConfirmDialog,
	Button,
	DropdownMenu,
	Tooltip,
} from '@wordpress/components';
import { Icon, check, published, moreVertical, comment } from '@wordpress/icons';
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
		<>
			{
				// If there are no comments, show a message indicating no comments are available.
				( ! Array.isArray( threads ) || threads.length === 0 ) && (
					<VStack
						alignment="left"
						className="editor-collab-sidebar-panel__thread"
						justify="flex-start"
						spacing="3"
					>
						{
							// translators: message displayed when there are no comments available
							__( 'No comments available' )
						}
					</VStack>
				)
			}
			{ Array.isArray( threads ) &&
				threads.length > 0 &&
				threads.map( ( thread ) => (
					<VStack
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
						spacing="3"
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
					</VStack>
				) ) }
		</>
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
		<>
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
				<>
					{ ! isActive && (
						<VStack className="editor-collab-sidebar-panel__show-more-reply">
							{ sprintf(
								// translators: %s: number of replies.
								_x(
									'%s more replies..',
									'Show replies button'
								),
								thread?.reply?.length
							) }
						</VStack>
					) }

					{ isActive &&
						thread.reply.map( ( reply ) => (
							<VStack
								key={ reply.id }
								className="editor-collab-sidebar-panel__child-thread"
								id={ reply.id }
								spacing="2"
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
							</VStack>
						) ) }
				</>
			) }
			{ 'approved' !== thread.status && isActive && (
				<VStack
					className="editor-collab-sidebar-panel__child-thread"
					spacing="2"
				>
					<ReplyToThread
						onAddReply={ onAddReply }
						threadId={ thread.id }
					/>
				</VStack>
			) }
		</>
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
		<>
			{/* Conditional action header */}
			{ ( canEdit || canDelete || ( thread.parent === 0 && onResolve ) ) && (
				<ActiveCommentHeader
					thread={ thread }
					onResolve={ onResolve }
					onDelete={ () => {
						setActionState( 'delete' );
						setShowConfirmDialog( true );
					} }
					canEdit={ canEdit }
					canDelete={ canDelete }
				/>
			) }

			{/* User info WITHOUT avatar */}
			<div className="editor-collab-sidebar-panel__comment-header">
				{ thread.parent === 0 && (
					<Icon
						icon={ comment }
						size={ 14 }
						className="editor-collab-sidebar-panel__comment-icon"
					/>
				) }
				<span className="editor-collab-sidebar-panel__user-name">
					{ thread.author_name }
				</span>
				<time className="editor-collab-sidebar-panel__user-time">
					{ new Date( thread.date ).toLocaleTimeString( [], {
						hour: 'numeric',
						minute: '2-digit',
						hour12: true,
					} ) }
				</time>
				{ status === 'approved' && (
					<Tooltip text={ __( 'Resolved' ) }>
						<Icon icon={ check } />
					</Tooltip>
				) }
			</div>

			{/* Comment content or edit form */}
			<HStack
				alignment="left"
				spacing="3"
				justify="flex-start"
				className="editor-collab-sidebar-panel__user-comment"
			>
				<VStack
					spacing="3"
					className="editor-collab-sidebar-panel__comment-field"
				>
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
						<RawHTML>{ thread?.content?.raw }</RawHTML>
					) }
				</VStack>
			</HStack>

			{/* User action buttons (edit/delete) below content */}
			{ ( canEdit || canDelete ) && 'edit' !== actionState && (
				<HStack className="editor-collab-sidebar-panel__user-actions" spacing="2">
					{ canEdit && onEdit && (
						<Button
							size="small"
							variant="secondary"
							onClick={ () => setActionState( 'edit' ) }
							className="editor-collab-sidebar-panel__user-action-edit"
						>
							{ __( 'Edit' ) }
						</Button>
					) }
					{ canDelete && onDelete && (
						<Button
							size="small"
							variant="secondary"
							onClick={ () => {
								setActionState( 'delete' );
								setShowConfirmDialog( true );
							} }
							className="editor-collab-sidebar-panel__user-action-delete"
						>
							{ __( 'Delete' ) }
						</Button>
					) }
				</HStack>
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
		</>
	);
};
