import { speak } from '@wordpress/a11y';
import { Popover, Button } from '@wordpress/components';
import { close } from '@wordpress/icons';

import { type EnhancedState, type PostEditorState } from '@wordpress/sync';
import { RTCAvatar } from '../rtc-avatar';

interface RTCCollaboratorsListProps {
	activeUsers: EnhancedState< PostEditorState >[];
	popoverAnchor?: HTMLElement | null;
	setIsPopoverVisible: ( isVisible: boolean ) => void;
}

/**
 * Renders a list showing all active collaborators with their details.
 * Note: activeUsers should already exclude the current user (filtered by parent component).
 */
export function RTCCollaboratorsList( {
	activeUsers,
	popoverAnchor,
	setIsPopoverVisible,
}: RTCCollaboratorsListProps ) {
	return (
		<Popover
			anchor={ popoverAnchor }
			placement="bottom"
			offset={ 8 }
			className="editor-rtc-collaborators-list"
		>
			<div className="editor-rtc-collaborators-list-content">
				<div className="editor-rtc-collaborators-list-header">
					<div className="editor-rtc-collaborators-list-header-title">
						Collaborators
						<span> { activeUsers.length } </span>
					</div>
					<div className="editor-rtc-collaborators-list-header-action">
						<Button
							icon={ close }
							iconSize={ 16 }
							label="Close Collaborators List"
							onClick={ () => setIsPopoverVisible( false ) }
						/>
					</div>
				</div>
				<div className="editor-rtc-collaborators-list-items">
					{ activeUsers.map( userState => (
						<button
							key={ userState.clientId }
							className="editor-rtc-collaborators-list-item"
							disabled={ ! userState.isConnected }
							style={ {
								opacity: userState.isConnected ? 1 : 0.5,
							} }
						>
							<RTCAvatar userInfo={ userState.userInfo } showUserColorBorder={ true } size="medium" />
							<div className="editor-rtc-collaborators-list-item-info">
								<div className="editor-rtc-collaborators-list-item-name">
									{ userState.userInfo.name }
								</div>
							</div>
						</button>
					) ) }
				</div>
			</div>
		</Popover>
	);
}
