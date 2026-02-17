import {
	Button,
	privateApis as componentsPrivateApis,
} from '@wordpress/components';
import { useState } from '@wordpress/element';
import {
	privateApis,
	type PostEditorAwarenessState,
} from '@wordpress/core-data';
import { useGeminiAgentPresence } from '@wordpress/gemini-live-agent';
import { __, sprintf } from '@wordpress/i18n';

import { CollaboratorsList } from './list';
import { type CollaboratorPresenceItem } from './types';
import { unlock } from '../../lock-unlock';
import { getAvatarUrl } from '../collaborators-overlay/get-avatar-url';
import { getAvatarBorderColor } from '../collab-sidebar/utils';

import './styles/collaborators-presence.scss';
import { CollaboratorsOverlay } from '../collaborators-overlay';

const { useActiveCollaborators } = unlock( privateApis );
const { Avatar, AvatarGroup } = unlock( componentsPrivateApis );

const GEMINI_LOGO_URL =
	'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/dark/gemini-color.png';

interface CollaboratorsPresenceProps {
	postId: number | null;
	postType: string | null;
}

/**
 * Renders a list of avatars for the active collaborators, with a maximum of 3 visible avatars.
 * Shows a popover with all collaborators on hover.
 *
 * @param props          CollaboratorsPresence component props
 * @param props.postId   ID of the post
 * @param props.postType Type of the post
 */
export function CollaboratorsPresence( {
	postId,
	postType,
}: CollaboratorsPresenceProps ) {
	const { connectionState } = useGeminiAgentPresence();
	const activeCollaborators = useActiveCollaborators(
		postId,
		postType
	) as PostEditorAwarenessState[];

	// Filter out current user - we never show ourselves in the list.
	const otherActiveCollaborators = activeCollaborators.filter(
		( collaborator ) => ! collaborator.isMe
	);
	const humanCollaboratorsByUser = new Map<
		number | string,
		PostEditorAwarenessState
	>();

	for ( const collaborator of otherActiveCollaborators ) {
		const userId =
			collaborator.collaboratorInfo?.id ?? collaborator.clientId;
		const existing = humanCollaboratorsByUser.get( userId );

		if ( ! existing ) {
			humanCollaboratorsByUser.set( userId, collaborator );
			continue;
		}

		// Prefer connected sessions. If both have the same connectivity, prefer
		// the most recently-entered one.
		const existingConnectivity = existing.isConnected ? 1 : 0;
		const currentConnectivity = collaborator.isConnected ? 1 : 0;

		if ( currentConnectivity > existingConnectivity ) {
			humanCollaboratorsByUser.set( userId, collaborator );
			continue;
		}

		if ( currentConnectivity === existingConnectivity ) {
			const existingEnteredAt = existing.collaboratorInfo?.enteredAt ?? 0;
			const currentEnteredAt =
				collaborator.collaboratorInfo?.enteredAt ?? 0;

			if ( currentEnteredAt >= existingEnteredAt ) {
				humanCollaboratorsByUser.set( userId, collaborator );
			}
		}
	}

	const dedupedHumanCollaborators = Array.from(
		humanCollaboratorsByUser.values()
	);
	const aiCollaboratorsByOwner = new Map<
		number | string,
		CollaboratorPresenceItem
	>();

	for ( const collaborator of activeCollaborators ) {
		if ( ! collaborator.aiState?.connected ) {
			continue;
		}

		const ownerId =
			collaborator.collaboratorInfo?.id ?? collaborator.clientId;

		if ( aiCollaboratorsByOwner.has( ownerId ) ) {
			continue;
		}

		aiCollaboratorsByOwner.set( ownerId, {
			clientId: `gemini-ai-${ ownerId }`,
			isConnected: collaborator.isConnected,
			collaboratorInfo: {
				name: __( 'Gemini AI' ),
				color: '#1a73e8',
				avatar_urls: {
					48: GEMINI_LOGO_URL,
					96: GEMINI_LOGO_URL,
				},
			},
		} );
	}

	const hasLocalAiPresenceInAwareness = activeCollaborators.some(
		( collaborator ) => collaborator.isMe && collaborator.aiState?.connected
	);

	if (
		connectionState !== 'disconnected' &&
		! hasLocalAiPresenceInAwareness
	) {
		aiCollaboratorsByOwner.set( 'local-ai', {
			clientId: 'gemini-ai-local',
			isConnected: connectionState === 'connected',
			collaboratorInfo: {
				name: __( 'Gemini AI' ),
				color: '#1a73e8',
				avatar_urls: {
					48: GEMINI_LOGO_URL,
					96: GEMINI_LOGO_URL,
				},
			},
		} );
	}

	const presenceItems: CollaboratorPresenceItem[] = [
		...dedupedHumanCollaborators.map( ( collaborator ) => ( {
			clientId: collaborator.clientId,
			isConnected: collaborator.isConnected,
			collaboratorInfo: collaborator.collaboratorInfo,
		} ) ),
		...Array.from( aiCollaboratorsByOwner.values() ),
	];

	const [ isPopoverVisible, setIsPopoverVisible ] = useState( false );
	const [ popoverAnchor, setPopoverAnchor ] = useState< HTMLElement | null >(
		null
	);

	// When there are no other collaborators, this component should not render
	// at all. This will always be the case when collaboration is not enabled, but
	// also when the current user is the only editor with the post open.
	if ( presenceItems.length === 0 ) {
		return null;
	}

	return (
		<>
			<div className="editor-collaborators-presence">
				<Button
					__next40pxDefaultSize
					className="editor-collaborators-presence__button"
					onClick={ () => setIsPopoverVisible( ! isPopoverVisible ) }
					isPressed={ isPopoverVisible }
					ref={ setPopoverAnchor }
					aria-label={ sprintf(
						// translators: %d: number of online collaborators.
						__( 'Collaborators list, %d online' ),
						presenceItems.length
					) }
				>
					<AvatarGroup max={ 3 }>
						{ presenceItems.map( ( collaboratorState ) => (
							<Avatar
								key={ collaboratorState.clientId }
								src={ getAvatarUrl(
									collaboratorState.collaboratorInfo
										.avatar_urls
								) }
								name={ collaboratorState.collaboratorInfo.name }
								borderColor={ getAvatarBorderColor(
									collaboratorState.collaboratorInfo.id
								) }
								size="small"
							/>
						) ) }
					</AvatarGroup>
				</Button>
				{ isPopoverVisible && (
					<CollaboratorsList
						activeCollaborators={ presenceItems }
						popoverAnchor={ popoverAnchor }
						setIsPopoverVisible={ setIsPopoverVisible }
					/>
				) }
			</div>
			<CollaboratorsOverlay postId={ postId } postType={ postType } />
		</>
	);
}
