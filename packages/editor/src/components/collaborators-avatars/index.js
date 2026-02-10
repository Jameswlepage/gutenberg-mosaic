/**
 * WordPress dependencies
 */
import { useSelect, useDispatch } from '@wordpress/data';
import {
	privateApis as coreDataPrivateApis,
} from '@wordpress/core-data';
import { Tooltip } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useGeminiAgentPresence } from '@wordpress/gemini-live-agent';
import { store as interfaceStore } from '@wordpress/interface';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';
import { sidebars } from '../sidebar/constants';
import { unlock } from '../../lock-unlock';
import { getStableCollaboratorColor } from '../../utils/collaborator-colors';

const GEMINI_LOGO_URL =
	'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/dark/gemini-color.png';

const coreDataApis = coreDataPrivateApis
	? unlock( coreDataPrivateApis )
	: {};
const { useActiveUsers } = coreDataApis;

/**
 * Get initials from a name string.
 *
 * @param {string} name The user's name.
 * @return {string} The initials (up to 2 characters).
 */
function getInitials( name ) {
	if ( ! name ) {
		return '?';
	}
	const parts = name.trim().split( /\s+/ );
	if ( parts.length === 1 ) {
		return parts[ 0 ].charAt( 0 ).toUpperCase();
	}
	return (
		parts[ 0 ].charAt( 0 ).toUpperCase() +
		parts[ parts.length - 1 ].charAt( 0 ).toUpperCase()
	);
}

/**
 * Avatar component for a single collaborator.
 *
 * @param {Object} props           Component props.
 * @param {Object} props.user      User object with userInfo.
 * @param {number} props.size      Avatar size in pixels.
 */
function CollaboratorAvatar( { user, size = 28, onActivate } ) {
	const { userInfo, isMe, isConnected, tooltip } = user;
	const clientIdValue = user?.clientId;
	const clientId =
		clientIdValue === undefined || clientIdValue === null
			? ''
			: String( clientIdValue );
	const avatarUrl =
		userInfo?.avatar_urls?.[ '96' ] ||
		userInfo?.avatar_urls?.[ '48' ];
	const name = userInfo?.name || __( 'Anonymous' );
	const isAi = clientId.startsWith( 'gemini-ai' );
	const color = isAi
		? '#1a73e8'
		: getStableCollaboratorColor( user, '#1e1e1e' );
	const height = size;
	const width = size;

	const style = {
		width,
		height,
		borderRadius: '9999px',
		border: `2px solid ${ color }`,
		backgroundColor: isAi ? '#ffffff' : color,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		fontSize: height * 0.4,
		fontWeight: 600,
		color: '#ffffff',
		overflow: 'hidden',
		boxSizing: 'border-box',
		lineHeight: 1,
		opacity: 1,
		cursor: onActivate ? 'pointer' : undefined,
	};

	const imgStyle = isAi
		? {
				width: '72%',
				height: '72%',
				objectFit: 'contain',
		  }
		: {
				width: '100%',
				height: '100%',
				objectFit: 'cover',
		  };

	const tooltipText =
		tooltip ||
		( isMe ? `${ name } (${ __( 'you' ) })` : name );

	return (
		<Tooltip text={ tooltipText }>
			<div
				className="collaborator-avatar"
				style={ style }
				aria-label={ tooltipText }
				role={ onActivate ? 'button' : undefined }
				tabIndex={ onActivate ? 0 : undefined }
				onClick={ onActivate }
				onKeyDown={ ( event ) => {
					if ( ! onActivate ) {
						return;
					}
					if ( event.key === 'Enter' || event.key === ' ' ) {
						event.preventDefault();
						onActivate();
					}
				} }
			>
				{ avatarUrl ? (
					<img src={ avatarUrl } alt="" style={ imgStyle } />
				) : (
					<span>{ getInitials( name ) }</span>
				) }
			</div>
		</Tooltip>
	);
}

/**
 * CollaboratorsAvatars component displays avatars of users currently editing
 * the same post, including the AI assistant when connected.
 */
export default function CollaboratorsAvatars() {
	const { connectionState, isScreenSharing, isAudioEnabled } =
		useGeminiAgentPresence();
	const { enableComplementaryArea } = useDispatch( interfaceStore );
	const avatarSize = 28;
	const avatarOverlap = Math.round( avatarSize * 0.4 );
	const { postId, postType } = useSelect( ( select ) => {
		const { getCurrentPostId, getCurrentPostType } = select( editorStore );
		return {
			postId: getCurrentPostId(),
			postType: getCurrentPostType(),
		};
	}, [] );

	// Get active users from awareness - this will be empty if sync isn't enabled
	const activeUsers =
		typeof useActiveUsers === 'function'
			? useActiveUsers( postId, postType ) || []
			: [];

	// Filter out current user and show only connected users
	const otherUsers = activeUsers.filter(
		( user ) => ! user.isMe && user.isConnected
	);
	const dedupedUsers = new Map();

	for ( const user of otherUsers ) {
		const userId = user.userInfo?.id ?? user.clientId;
		const existing = dedupedUsers.get( userId );
		const enteredAt = user.userInfo?.enteredAt ?? 0;
		const existingEnteredAt = existing?.userInfo?.enteredAt ?? 0;

		if ( ! existing || enteredAt >= existingEnteredAt ) {
			dedupedUsers.set( userId, user );
		}
	}

	const uniqueUsers = Array.from( dedupedUsers.values() );

	const aiUsersByOwner = new Map();
	for ( const user of activeUsers ) {
		if ( ! user?.aiState?.connected ) {
			continue;
		}

		const ownerId = user.userInfo?.id ?? user.clientId;
		if ( aiUsersByOwner.has( ownerId ) ) {
			continue;
		}

		const aiStatusParts = [];
		if ( user.aiState?.status === 'connecting' ) {
			aiStatusParts.push( __( 'Connecting' ) );
		}
		if ( user.aiState?.status === 'error' ) {
			aiStatusParts.push( __( 'Error' ) );
		}
		if ( user.aiState?.isScreenSharing ) {
			aiStatusParts.push( __( 'Screen' ) );
		}
		if ( user.aiState?.isAudioEnabled ) {
			aiStatusParts.push( __( 'Audio' ) );
		}

		const ownerName = user.userInfo?.name || __( 'Collaborator' );
		const aiTooltip = aiStatusParts.length
			? `${ __( 'Gemini AI' ) } (${ ownerName }, ${ aiStatusParts.join(
					', '
			  ) })`
			: `${ __( 'Gemini AI' ) } (${ ownerName })`;

		aiUsersByOwner.set( ownerId, {
			clientId: `gemini-ai-${ ownerId }`,
			isMe: false,
			isConnected: true,
			userInfo: {
				name: __( 'Gemini AI' ),
				color: '#1a73e8',
				avatar_urls: {
					'96': GEMINI_LOGO_URL,
					'48': GEMINI_LOGO_URL,
				},
			},
			tooltip: aiTooltip,
		} );
	}

	const aiUsers = Array.from( aiUsersByOwner.values() );
	const hasLocalAiPresence = connectionState !== 'disconnected';
	if ( aiUsers.length === 0 && hasLocalAiPresence ) {
		const aiStatusParts = [];
		if ( connectionState === 'connecting' ) {
			aiStatusParts.push( __( 'Connecting' ) );
		}
		if ( connectionState === 'error' ) {
			aiStatusParts.push( __( 'Error' ) );
		}
		if ( isScreenSharing ) {
			aiStatusParts.push( __( 'Screen' ) );
		}
		if ( isAudioEnabled ) {
			aiStatusParts.push( __( 'Audio' ) );
		}

		const aiTooltip = aiStatusParts.length
			? `${ __( 'Gemini AI' ) } (${ aiStatusParts.join( ', ' ) })`
			: __( 'Gemini AI' );

		aiUsers.push( {
			clientId: 'gemini-ai',
			isMe: false,
			isConnected: connectionState === 'connected',
			userInfo: {
				name: __( 'Gemini AI' ),
				color: '#1a73e8',
				avatar_urls: {
					'96': GEMINI_LOGO_URL,
					'48': GEMINI_LOGO_URL,
				},
			},
			tooltip: aiTooltip,
		} );
	}

	const maxAvatars = 5;
	const slotsForHumans = Math.max( 0, maxAvatars - aiUsers.length );
	const visibleNonAiUsers = uniqueUsers.slice( 0, slotsForHumans );
	const visibleUsers = [ ...visibleNonAiUsers, ...aiUsers ].slice(
		0,
		maxAvatars
	);
	const overflowCount = Math.max(
		0,
		uniqueUsers.length - visibleNonAiUsers.length
	);
	const stackCount = visibleUsers.length + ( overflowCount > 0 ? 1 : 0 );
	const stackWidth =
		stackCount > 0
			? avatarSize + ( stackCount - 1 ) * ( avatarSize - avatarOverlap )
			: 0;

	if ( visibleUsers.length === 0 ) {
		return null;
	}

	const openAiPanel = () => {
		enableComplementaryArea( 'core', sidebars.ai );
	};

	return (
		<div
			className="editor-collaborators-avatars"
			style={ {
				display: 'flex',
				alignItems: 'center',
				paddingLeft: 8,
				marginRight: 8,
			} }
		>
			<div
				style={ {
					position: 'relative',
					height: avatarSize,
					width: stackWidth,
				} }
			>
				{ visibleUsers.map( ( user, index ) => (
					<div
						key={ user.clientId }
						style={ {
							position: 'absolute',
							left: index * ( avatarSize - avatarOverlap ),
							top: 0,
							zIndex: index + 1,
						} }
					>
						<CollaboratorAvatar
							user={ user }
							size={ avatarSize }
							onActivate={
								String( user?.clientId || '' ).startsWith(
									'gemini-ai'
								)
									? openAiPanel
									: undefined
							}
						/>
					</div>
				) ) }
				{ overflowCount > 0 && (
					<div
						style={ {
							position: 'absolute',
							left:
								visibleUsers.length *
								( avatarSize - avatarOverlap ),
							top: 0,
							zIndex: visibleUsers.length + 1,
							width: avatarSize,
							height: avatarSize,
							borderRadius: '9999px',
							backgroundColor: '#757575',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							fontSize: Math.round( avatarSize * 0.4 ),
							fontWeight: 600,
							color: '#ffffff',
							border: '2px solid #fff',
							boxSizing: 'border-box',
							opacity: 1,
						} }
					>
						+{ overflowCount }
					</div>
				) }
			</div>
		</div>
	);
}
