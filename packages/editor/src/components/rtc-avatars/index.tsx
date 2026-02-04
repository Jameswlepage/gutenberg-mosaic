import { Button } from '@wordpress/components';
import { useState } from '@wordpress/element';

import { RTCAvatar } from '../rtc-avatar';
import { RTCCollaboratorsList } from '../rtc-collaborators-list';
import { useActiveUsers } from '../../hooks/use-post-editor-awareness-state';

import './style.scss';

/**
 * Renders a list of avatars for the active users, with a maximum of 3 visible avatars.
 * Shows a popover with all users on hover.
 */
export function RTCVAvatars() {
	const activeUsers = useActiveUsers();

	// Filter out current user - we never show ourselves in the list
	const otherActiveUsers = activeUsers.filter( user => ! user.isMe );

	const [ isPopoverVisible, setIsPopoverVisible ] = useState( false );
	const [ popoverAnchor, setPopoverAnchor ] = useState< HTMLElement | null >( null );

	if ( otherActiveUsers.length === 0 ) {
		// Hide avatars when there are no other users
		return null;
	}

	const visibleUsers = otherActiveUsers.slice( 0, 3 );
	const remainingUsers = otherActiveUsers.slice( 3 );
	const remainingUsersText = remainingUsers.map( ( { userInfo } ) => userInfo.name ).join( ', ' );

	return visibleUsers.length > 0 ? (
		<>
			<Button
				className="editor-rtc-avatars-container"
				onClick={ () => setIsPopoverVisible( ! isPopoverVisible ) }
				isPressed={ isPopoverVisible }
				ref={ setPopoverAnchor }
				aria-label={ `Collaborators list, ${ otherActiveUsers.length } online` }
			>
				{ visibleUsers.map( userState => (
					<RTCAvatar
						key={ userState.clientId }
						userInfo={ userState.userInfo }
						showUserColorBorder={ false }
						size="small"
					/>
				) ) }

				{ remainingUsers.length > 0 && (
					<div
						className="editor-rtc-avatar-remaining"
						title={ remainingUsersText }
					>
						+{ remainingUsers.length }
					</div>
				) }
			</Button>
			{ isPopoverVisible && (
				<RTCCollaboratorsList
					activeUsers={ otherActiveUsers }
					popoverAnchor={ popoverAnchor }
					setIsPopoverVisible={ setIsPopoverVisible }
				/>
			) }
		</>
	) : null;
}
