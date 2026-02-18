/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useMemo } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { privateApis as coreDataPrivateApis } from '@wordpress/core-data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import { useGeminiAgentPresence } from '@wordpress/gemini-live-agent';

/**
 * Internal dependencies
 */
import { unlock } from '../../lock-unlock';
import { store as editorStore } from '../../store';
import { getAvatarBorderColor } from '../../components/collab-sidebar/utils';

const coreDataApis = coreDataPrivateApis ? unlock( coreDataPrivateApis ) : {};
const { useActiveUsers } = coreDataApis;
const useActiveUsersSafe =
	typeof useActiveUsers === 'function' ? useActiveUsers : () => [];

function getCollaboratorInfo( user ) {
	if ( ! user ) {
		return null;
	}

	return user.collaboratorInfo || user.userInfo || null;
}

function getCollaboratorId( user ) {
	const collaboratorInfo = getCollaboratorInfo( user );

	if ( collaboratorInfo?.id !== undefined ) {
		return collaboratorInfo.id;
	}

	return user?.clientId;
}

function getCollaboratorColor( user ) {
	const collaboratorInfo = getCollaboratorInfo( user );
	if ( collaboratorInfo?.color ) {
		return collaboratorInfo.color;
	}

	const numericUserId = Number( getCollaboratorId( user ) );

	return Number.isFinite( numericUserId )
		? getAvatarBorderColor( numericUserId )
		: getAvatarBorderColor( 0 );
}

function getCollaboratorName( user ) {
	return getCollaboratorInfo( user )?.name || __( 'Collaborator' );
}

const SELECTION_TYPE = {
	None: 'none',
	Cursor: 'cursor',
	SelectionInOneBlock: 'selection-in-one-block',
	SelectionInMultipleBlocks: 'selection-in-multiple-blocks',
	WholeBlock: 'whole-block',
};

function getSelectionBlockIds(
	selection,
	getBlockRootClientId,
	getBlockOrder
) {
	if ( ! selection || selection.type === SELECTION_TYPE.None ) {
		return [];
	}

	if (
		selection.type === SELECTION_TYPE.Cursor ||
		selection.type === SELECTION_TYPE.SelectionInOneBlock ||
		selection.type === SELECTION_TYPE.WholeBlock
	) {
		return selection.blockId ? [ selection.blockId ] : [];
	}

	if ( selection.type === SELECTION_TYPE.SelectionInMultipleBlocks ) {
		const startId = selection.blockStartId;
		const endId = selection.blockEndId;
		if ( ! startId || ! endId ) {
			return [];
		}

		if (
			typeof getBlockRootClientId !== 'function' ||
			typeof getBlockOrder !== 'function'
		) {
			return [ startId, endId ];
		}

		const startRoot = getBlockRootClientId( startId );
		const endRoot = getBlockRootClientId( endId );
		if ( startRoot !== endRoot ) {
			return [ startId, endId ];
		}

		const order = getBlockOrder( startRoot );
		if ( ! Array.isArray( order ) || order.length === 0 ) {
			return [ startId, endId ];
		}

		const startIndex = order.indexOf( startId );
		const endIndex = order.indexOf( endId );
		if ( startIndex === -1 || endIndex === -1 ) {
			return [ startId, endId ];
		}

		const from = Math.min( startIndex, endIndex );
		const to = Math.max( startIndex, endIndex );
		return order.slice( from, to + 1 );
	}

	return [];
}

function dedupeUsers( users ) {
	const seen = new Set();
	const unique = [];

	for ( const user of users ) {
		const userId = getCollaboratorId( user );
		if ( seen.has( userId ) ) {
			continue;
		}
		seen.add( userId );
		unique.push( user );
	}

	return unique;
}

const withCollaboratorCursors = createHigherOrderComponent(
	( BlockListBlock ) => {
		return function CollaboratorCursors( props ) {
			const { clientId, wrapperProps } = props;
			const {
				connectionState: aiConnectionState,
				activeBlockClientId: aiActiveBlockClientId,
				imageEditTargetClientId,
			} = useGeminiAgentPresence();
			const {
				postId,
				postType,
				getBlockOrder,
				getBlockRootClientId,
				getSelectedBlockClientId,
			} = useSelect( ( select ) => {
				const editor = select( editorStore );
				const blockEditor = select( blockEditorStore );
				return {
					postId: editor.getCurrentPostId(),
					postType: editor.getCurrentPostType(),
					getBlockOrder: blockEditor.getBlockOrder,
					getBlockRootClientId: blockEditor.getBlockRootClientId,
					getSelectedBlockClientId:
						blockEditor.getSelectedBlockClientId,
				};
			}, [] );
			const selectedBlockClientId =
				typeof getSelectedBlockClientId === 'function'
					? getSelectedBlockClientId()
					: null;

			const activeUsers = useActiveUsersSafe( postId, postType );

			const blockUsers = useMemo( () => {
				if ( ! activeUsers.length ) {
					return [];
				}

				const users = [];

				for ( const user of activeUsers ) {
					if ( ! user || user.isMe || ! user.isConnected ) {
						continue;
					}

					const selection = user.editorState?.selection;
					const blockIds = getSelectionBlockIds(
						selection,
						getBlockRootClientId,
						getBlockOrder
					);

					if ( blockIds.includes( clientId ) ) {
						users.push( user );
					}
				}

				return users;
			}, [ activeUsers, clientId, getBlockOrder, getBlockRootClientId ] );

			const aiUsers = useMemo( () => {
				if ( aiConnectionState !== 'connected' ) {
					return [];
				}

				const inferredClientId =
					aiActiveBlockClientId || selectedBlockClientId;

				if ( ! inferredClientId || inferredClientId !== clientId ) {
					return [];
				}

				return [
					{
						clientId: 'gemini-ai',
						isMe: false,
						isConnected: true,
						userInfo: {
							name: __( 'Gemini AI' ),
							color: '#1a73e8',
							avatar_urls: {},
						},
					},
				];
			}, [
				aiActiveBlockClientId,
				aiConnectionState,
				clientId,
				selectedBlockClientId,
			] );

			const allBlockUsers =
				blockUsers.length || aiUsers.length
					? [ ...blockUsers, ...aiUsers ]
					: [];
			const isImageEditTarget = imageEditTargetClientId === clientId;
			const uniqueUsers =
				allBlockUsers.length > 0 ? dedupeUsers( allBlockUsers ) : [];

			if ( uniqueUsers.length === 0 && ! isImageEditTarget ) {
				return <BlockListBlock { ...props } />;
			}

			if ( uniqueUsers.length === 0 ) {
				const shimmerWrapperProps = {
					...wrapperProps,
					className: [
						wrapperProps?.className,
						'editor-ai-image-editing',
					]
						.filter( Boolean )
						.join( ' ' ),
				};

				return (
					<BlockListBlock
						{ ...props }
						wrapperProps={ shimmerWrapperProps }
					/>
				);
			}

			const primaryUser = uniqueUsers[ 0 ];
			const primaryName = getCollaboratorName( primaryUser );
			const labelSuffix =
				uniqueUsers.length > 1 ? ` +${ uniqueUsers.length - 1 }` : '';
			const label = `${ primaryName }${ labelSuffix }`;
			const color = getCollaboratorColor( primaryUser );
			const names = uniqueUsers
				.map( ( user ) => getCollaboratorInfo( user )?.name )
				.filter( Boolean )
				.join( ', ' );

			const mergedWrapperProps = {
				...wrapperProps,
				className: [
					wrapperProps?.className,
					'editor-collab-cursor',
					uniqueUsers.length > 1
						? 'editor-collab-cursor--multi'
						: null,
					isImageEditTarget ? 'editor-ai-image-editing' : null,
				]
					.filter( Boolean )
					.join( ' ' ),
				style: {
					...wrapperProps?.style,
					'--editor-collab-color': color,
				},
				'data-collab-label': label,
				'data-collab-count': String( uniqueUsers.length ),
				...( names
					? { title: `${ __( 'Collaborators' ) }: ${ names }` }
					: {} ),
			};

			return (
				<BlockListBlock
					{ ...props }
					wrapperProps={ mergedWrapperProps }
				/>
			);
		};
	},
	'withCollaboratorCursors'
);

addFilter(
	'editor.BlockListBlock',
	'core/editor/collaborator-cursors',
	withCollaboratorCursors
);
