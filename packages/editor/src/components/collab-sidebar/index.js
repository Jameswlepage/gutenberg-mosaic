/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	useSelect,
	useDispatch,
	resolveSelect,
	subscribe,
} from '@wordpress/data';
import { useState, useMemo } from '@wordpress/element';
import { comment as commentIcon } from '@wordpress/icons';
import { addFilter } from '@wordpress/hooks';
import { store as noticesStore } from '@wordpress/notices';
import { store as coreStore, useEntityBlockEditor } from '@wordpress/core-data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as interfaceStore } from '@wordpress/interface';

/**
 * Internal dependencies
 */
import PluginSidebar from '../plugin-sidebar';
import PluginSidebarMoreMenuItem from '../plugin-sidebar-more-menu-item';
import { collabSidebarName } from './constants';
import { Comments } from './comments';
import { AddComment } from './add-comment';
import { CommentsTabSelector } from './comments-tab-selector';
import { SuggestionItem } from './suggestion-item';
import { store as editorStore } from '../../store';
import AddCommentButton from './comment-button';
import AddCommentToolbarButton from './comment-button-toolbar';
import { useGlobalStylesContext } from '../global-styles-provider';
import { getCommentIdsFromBlocks } from './utils';
import { navigateToComment } from '../../utils/comment-navigation';
import { 
	acceptSuggestion as acceptInMemorySuggestion,
	rejectSuggestion as rejectInMemorySuggestion,
	commentMetaToSuggestion 
} from '../suggestions-content-interceptor';

const modifyBlockCommentAttributes = ( settings ) => {
	if ( ! settings.attributes.blockCommentId ) {
		settings.attributes = {
			...settings.attributes,
			blockCommentId: {
				type: 'number',
			},
		};
	}

	return settings;
};

// Apply the filter to all core blocks
addFilter(
	'blocks.registerBlockType',
	'block-comment/modify-core-block-attributes',
	modifyBlockCommentAttributes
);

function CollabSidebarContent( {
	showCommentBoard,
	setShowCommentBoard,
	styles,
	comments,
	suggestions,
} ) {
	const [ activeTab, setActiveTab ] = useState( 'open' );
	const { createNotice } = useDispatch( noticesStore );
	const { saveEntityRecord, deleteEntityRecord } = useDispatch( coreStore );
	const { getEntityRecord } = resolveSelect( coreStore );

	const { postId } = useSelect( ( select ) => {
		const { getCurrentPostId } = select( editorStore );
		const _postId = getCurrentPostId();

		return {
			postId: _postId,
		};
	}, [] );

	const { getSelectedBlockClientId } = useSelect( blockEditorStore );
	const { updateBlockAttributes } = useDispatch( blockEditorStore );

	// Function to save the comment.
	const addNewComment = async ( comment, parentCommentId ) => {
		const args = {
			post: postId,
			content: comment,
			comment_type: 'block_comment',
			comment_approved: 0,
		};

		// Create a new object, conditionally including the parent property
		const updatedArgs = {
			...args,
			...( parentCommentId ? { parent: parentCommentId } : {} ),
		};

		const savedRecord = await saveEntityRecord(
			'root',
			'comment',
			updatedArgs
		);

		if ( savedRecord ) {
			// If it's a main comment, update the block attributes with the comment id.
			if ( ! parentCommentId ) {
				updateBlockAttributes( selectedBlockClientId, {
					blockCommentId: savedRecord?.id,
				} );
			}

			// Close the comment creation board
			setShowCommentBoard( false );

			// Navigate to and expand the newly created comment
			setTimeout(() => {
				if ( parentCommentId ) {
					// For replies, navigate to the parent comment to show the full thread
					navigateToComment( parentCommentId, selectedBlockClientId );
				} else if ( savedRecord?.id ) {
					// For new main comments, navigate to the new comment
					navigateToComment( savedRecord.id, selectedBlockClientId );
				}
			}, 100); // Small delay to allow UI updates

			createNotice(
				'snackbar',
				parentCommentId
					? // translators: Reply added successfully
					  __( 'Reply added successfully.' )
					: // translators: Comment added successfully
					  __( 'Comment added successfully.' ),
				{
					type: 'snackbar',
					isDismissible: true,
				}
			);
		} else {
			onError();
		}
	};

	const onCommentResolve = async ( commentId ) => {
		const savedRecord = await saveEntityRecord( 'root', 'comment', {
			id: commentId,
			status: 'approved',
		} );

		if ( savedRecord ) {
			// translators: Comment resolved successfully
			createNotice( 'snackbar', __( 'Comment marked as resolved.' ), {
				type: 'snackbar',
				isDismissible: true,
			} );
		} else {
			onError();
		}
	};

	const onEditComment = async ( commentId, comment ) => {
		const savedRecord = await saveEntityRecord( 'root', 'comment', {
			id: commentId,
			content: comment,
		} );

		if ( savedRecord ) {
			createNotice(
				'snackbar',
				// translators: Comment edited successfully
				__( 'Comment edited successfully.' ),
				{
					type: 'snackbar',
					isDismissible: true,
				}
			);
		} else {
			onError();
		}
	};

	const onError = () => {
		createNotice(
			'error',
			// translators: Error message when comment submission fails
			__(
				'Something went wrong. Please try publishing the post, or you may have already submitted your comment earlier.'
			),
			{
				isDismissible: true,
			}
		);
	};

	const onCommentDelete = async ( commentId ) => {
		const childComment = await getEntityRecord(
			'root',
			'comment',
			commentId
		);
		await deleteEntityRecord( 'root', 'comment', commentId );

		if ( childComment && ! childComment.parent ) {
			updateBlockAttributes( selectedBlockClientId, {
				blockCommentId: undefined,
			} );
		}

		createNotice(
			'snackbar',
			// translators: Comment deleted successfully
			__( 'Comment deleted successfully.' ),
			{
				type: 'snackbar',
				isDismissible: true,
			}
		);
	};

	// Handle suggestion accept/reject actions
	const handleAcceptSuggestion = async ( suggestionId ) => {
		// Try in-memory acceptance first
		const result = acceptInMemorySuggestion( suggestionId );
		
		if ( result.success ) {
			// Find the suggestion in database comments to update it
			const suggestionComment = suggestions.find( s => 
				s.meta?.suggestion_block_id && s.meta.suggestion_block_id === suggestionId 
			);
			
			if ( suggestionComment ) {
				// Update the comment status to 'approved' to mark as accepted
				await saveEntityRecord( 'root', 'comment', {
					id: suggestionComment.id,
					status: 'approved',
				} );
			}
			
			createNotice(
				'snackbar',
				__( 'Suggestion accepted successfully.' ),
				{
					type: 'snackbar',
					isDismissible: true,
				}
			);
		} else {
			onError();
		}
	};
	
	const handleRejectSuggestion = async ( suggestionId ) => {
		// Try in-memory rejection first
		const result = rejectInMemorySuggestion( suggestionId );
		
		if ( result.success ) {
			// Find the suggestion in database comments to update it
			const suggestionComment = suggestions.find( s => 
				s.meta?.suggestion_block_id && s.meta.suggestion_block_id === suggestionId 
			);
			
			if ( suggestionComment ) {
				// Update the comment status to 'spam' to mark as rejected
				await saveEntityRecord( 'root', 'comment', {
					id: suggestionComment.id,
					status: 'spam',
				} );
			}
			
			createNotice(
				'snackbar',
				__( 'Suggestion rejected successfully.' ),
				{
					type: 'snackbar',
					isDismissible: true,
				}
			);
		} else {
			onError();
		}
	};

	// Filter comments and suggestions based on active tab
	const filteredComments = comments.filter( ( comment ) => {
		if ( activeTab === 'open' ) {
			return comment.status !== 'approved';
		} else if ( activeTab === 'resolved' ) {
			return comment.status === 'approved';
		}
		return true;
	} );
	
	const filteredSuggestions = activeTab === 'suggestions' 
		? suggestions.filter( s => s.status === 'hold' ) // Only pending suggestions
		: [];

	return (
		<div className="editor-collab-sidebar-panel" style={ styles }>
			<div className="editor-collab-sidebar-panel__content">
				<AddComment
					onSubmit={ addNewComment }
					showCommentBoard={ showCommentBoard }
					setShowCommentBoard={ setShowCommentBoard }
				/>
				
				{/* Tab selector for open/resolved comments and suggestions */}
				{ ((comments && comments.length > 0) || (suggestions && suggestions.length > 0)) && !showCommentBoard ? (
					<CommentsTabSelector
						activeTab={ activeTab }
						onTabChange={ setActiveTab }
						suggestionsCount={ suggestions ? suggestions.filter( s => s.status === 'hold' ).length : 0 }
					/>
				) : null }
				
				{/* Render comments or suggestions based on active tab */}
				{ activeTab === 'suggestions' ? (
				<div className="editor-collab-sidebar-suggestions">
					{ filteredSuggestions.length > 0 ? (
						filteredSuggestions.map( ( suggestionComment ) => {
							// Convert comment meta back to suggestion format
							const suggestion = commentMetaToSuggestion( suggestionComment.meta || {} );
							suggestion.id = suggestionComment.meta?.suggestion_block_id || suggestionComment.id;
							suggestion.author = { name: suggestionComment.author_name || 'User' };
							
							return (
								<SuggestionItem
									key={ suggestion.id }
									suggestion={ suggestion }
									onAccept={ handleAcceptSuggestion }
									onReject={ handleRejectSuggestion }
								/>
							);
						} )
					) : (
						<div className="editor-collab-sidebar-panel__thread editor-collab-sidebar-panel__no-comments">
							{ __( 'No pending suggestions.' ) }
						</div>
					) }
				</div>
			) : (
				<Comments
					key={ selectedBlockClientId }
					threads={ filteredComments }
					onEditComment={ onEditComment }
					onAddReply={ addNewComment }
					onCommentDelete={ onCommentDelete }
					onCommentResolve={ onCommentResolve }
					showCommentBoard={ showCommentBoard }
					setShowCommentBoard={ setShowCommentBoard }
				/>
			) }
			</div>
			
			{/* Add comment button at bottom when block is selected */}
			{ selectedBlockClientId && !showCommentBoard && (
				<div className="editor-collab-sidebar-panel__bottom-actions">
					<div 
						className="editor-collab-sidebar-panel__add-comment-bottom-button"
						onClick={ () => setShowCommentBoard( true ) }
						role="button"
						tabIndex="0"
						onKeyDown={ ( e ) => {
							if ( e.key === 'Enter' || e.key === ' ' ) {
								e.preventDefault();
								setShowCommentBoard( true );
							}
						} }
					>
						+ { __( 'Add comment' ) }
					</div>
				</div>
			) }
		</div>
	);
}

/**
 * Renders the Collab sidebar.
 */
export default function CollabSidebar() {
	const [ showCommentBoard, setShowCommentBoard ] = useState( false );
	const { enableComplementaryArea } = useDispatch( interfaceStore );
	const { getActiveComplementaryArea } = useSelect( interfaceStore );

	const { postId, postType, postStatus, threads, suggestions } = useSelect( ( select ) => {
		const { getCurrentPostId, getCurrentPostType } = select( editorStore );
		const _postId = getCurrentPostId();
		
		// Fetch regular comments
		const commentsData =
			!! _postId && typeof _postId === 'number'
				? select( coreStore ).getEntityRecords( 'root', 'comment', {
						post: _postId,
						type: 'block_comment',
						status: 'any',
						per_page: 100,
				  } )
				: null;
		
		// Fetch suggestions (if experimental mode is enabled)
		const suggestionsData = 
			!! _postId && typeof _postId === 'number' && window.__experimentalSuggestionsMode
				? select( coreStore ).getEntityRecords( 'root', 'comment', {
						post: _postId,
						type: 'block_suggestion',
						status: 'any',
						meta_key: 'suggestion_type',
						per_page: 100,
				  } )
				: null;
		
		return {
			postId: _postId,
			postType: getCurrentPostType(),
			postStatus:
				select( editorStore ).getEditedPostAttribute( 'status' ),
			threads: commentsData,
			suggestions: suggestionsData,
		};
	}, [] );

	const { blockCommentId, selectedBlockClientId } = useSelect( ( select ) => {
		const { getBlockAttributes, getSelectedBlockClientId } =
			select( blockEditorStore );
		const _clientId = getSelectedBlockClientId();

		return {
			blockCommentId: _clientId
				? getBlockAttributes( _clientId )?.blockCommentId
				: null,
			selectedBlockClientId: _clientId,
		};
	}, [] );

	const openCollabBoard = () => {
		// Always use the main collabSidebarName for consistency
		enableComplementaryArea( 'core', collabSidebarName );
		
		if ( blockCommentId ) {
			// Block has existing comment - show comments thread but don't navigate yet
			// User can see existing comments and choose to add a new one via bottom button
			setShowCommentBoard( false );
			// Optional: Navigate to existing comment to highlight it
			setTimeout(() => {
				navigateToComment( blockCommentId, selectedBlockClientId );
			}, 100);
		} else {
			// No existing comment - show comment creation form immediately  
			setShowCommentBoard( true );
		}
	};

	const [ blocks ] = useEntityBlockEditor( 'postType', postType, {
		id: postId,
	} );

	// Process comments to build the tree structure
	const { resultComments, sortedThreads } = useMemo( () => {
		// Create a compare to store the references to all objects by id
		const compare = {};
		const result = [];

		const filteredComments = ( threads ?? [] ).filter(
			( comment ) => comment.status !== 'trash'
		);

		// Initialize each object with an empty `reply` array
		filteredComments.forEach( ( item ) => {
			compare[ item.id ] = { ...item, reply: [] };
		} );

		// Iterate over the data to build the tree structure
		filteredComments.forEach( ( item ) => {
			if ( item.parent === 0 ) {
				// If parent is 0, it's a root item, push it to the result array
				result.push( compare[ item.id ] );
			} else if ( compare[ item.parent ] ) {
				// Otherwise, find its parent and push it to the parent's `reply` array
				compare[ item.parent ].reply.push( compare[ item.id ] );
			}
		} );

		if ( 0 === result?.length ) {
			return { resultComments: [], sortedThreads: [] };
		}

		const updatedResult = result.map( ( item ) => ( {
			...item,
			reply: [ ...item.reply ].reverse(),
		} ) );

		const blockCommentIds = getCommentIdsFromBlocks( blocks );

		const threadIdMap = new Map(
			updatedResult.map( ( thread ) => [ thread.id, thread ] )
		);

		const sortedComments = blockCommentIds
			.map( ( id ) => threadIdMap.get( id ) )
			.filter( ( thread ) => thread !== undefined );

		return { resultComments: updatedResult, sortedThreads: sortedComments };
	}, [ threads, blocks ] );

	// Get the global styles to set the background color of the sidebar.
	const { merged: GlobalStyles } = useGlobalStylesContext();
	const backgroundColor = GlobalStyles?.styles?.color?.background;

	if ( 0 < resultComments.length ) {
		const unsubscribe = subscribe( () => {
			const activeSidebar = getActiveComplementaryArea( 'core' );

			if ( ! activeSidebar ) {
				enableComplementaryArea( 'core', collabSidebarName );
				unsubscribe();
			}
		} );
	}

	if ( postStatus === 'publish' ) {
		return null; // or maybe return some message indicating no threads are available.
	}

	const AddCommentComponent = blockCommentId
		? AddCommentToolbarButton
		: AddCommentButton;

	return (
		<>
			<AddCommentComponent onClick={ openCollabBoard } />
			<PluginSidebarMoreMenuItem
				target={ collabSidebarName }
				icon={ commentIcon }
			>
				{ __( 'Comments' ) }
			</PluginSidebarMoreMenuItem>
			<PluginSidebar
				isPinnable={ false }
				header={ false }
				identifier={ collabSidebarName }
				className="editor-collab-sidebar"
				headerClassName="editor-collab-sidebar__header"
				// translators: Comments sidebar title
				title={ __( 'Comments' ) }
				icon={ commentIcon }
			>
				<CollabSidebarContent
					comments={ sortedThreads }
					suggestions={ suggestions || [] }
					showCommentBoard={ showCommentBoard }
					setShowCommentBoard={ setShowCommentBoard }
					styles={ {
						backgroundColor,
					} }
				/>
			</PluginSidebar>
		</>
	);
}
