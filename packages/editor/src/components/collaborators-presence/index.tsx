import { Button } from '@wordpress/components';
import { useState } from '@wordpress/element';
import {
	privateApis,
	type PostEditorAwarenessState,
} from '@wordpress/core-data';
import { useGeminiAgentPresence } from '@wordpress/gemini-live-agent';
import { __, sprintf } from '@wordpress/i18n';

import { Avatar } from './avatar';
import { CollaboratorsList } from './list';
import { type CollaboratorPresenceItem } from './types';
import { unlock } from '../../lock-unlock';

import './styles/collaborators-presence.scss';

const { useActiveCollaborators } = unlock( privateApis );
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
 * @param {Object} props          CollaboratorsPresence component props
 * @param {number} props.postId   ID of the post
 * @param {string} props.postType Type of the post
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

	const visibleCollaborators = presenceItems.slice( 0, 3 );
	const remainingCollaborators = presenceItems.slice( 3 );
	const remainingCollaboratorsText = remainingCollaborators
		.map( ( { collaboratorInfo } ) => collaboratorInfo.name )
		.join( ', ' );

	return visibleCollaborators.length > 0 ? (
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
				{ visibleCollaborators.map( ( collaboratorState ) => (
					<Avatar
						key={ collaboratorState.clientId }
						collaboratorInfo={ collaboratorState.collaboratorInfo }
						showCollaboratorColorBorder={ false }
						size="small"
					/>
				) ) }

				{ remainingCollaborators.length > 0 && (
					<div
						className="editor-collaborators-presence__remaining"
						title={ remainingCollaboratorsText }
					>
						+{ remainingCollaborators.length }
					</div>
				) }
			</Button>
			{ isPopoverVisible && (
				<CollaboratorsList
					activeCollaborators={ presenceItems }
					popoverAnchor={ popoverAnchor }
					setIsPopoverVisible={ setIsPopoverVisible }
				/>
			) }
		</div>
	) : null;
}
