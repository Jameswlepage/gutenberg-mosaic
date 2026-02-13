/**
 * Internal dependencies
 */
import type {
	SetConnectionStateAction,
	SetScreenSharingAction,
	SetAudioEnabledAction,
	SetLastErrorAction,
	SetActiveBlockClientIdAction,
	SetImageEditTargetClientIdAction,
	AddConversationMessageAction,
	UpdateConversationMessageAction,
	ClearConversationAction,
	ConversationMessage,
} from './types';
import type { ConnectionState } from '../types';

export function setConnectionState(
	connectionState: ConnectionState
): SetConnectionStateAction {
	return {
		type: 'SET_CONNECTION_STATE',
		connectionState,
	};
}

export function setScreenSharing(
	isScreenSharing: boolean
): SetScreenSharingAction {
	return {
		type: 'SET_SCREEN_SHARING',
		isScreenSharing,
	};
}

export function setAudioEnabled(
	isAudioEnabled: boolean
): SetAudioEnabledAction {
	return {
		type: 'SET_AUDIO_ENABLED',
		isAudioEnabled,
	};
}

export function setLastError( lastError: string | null ): SetLastErrorAction {
	return {
		type: 'SET_LAST_ERROR',
		lastError,
	};
}

export function setActiveBlockClientId(
	clientId: string | null
): SetActiveBlockClientIdAction {
	return {
		type: 'SET_ACTIVE_BLOCK_CLIENT_ID',
		clientId,
	};
}

export function setImageEditTargetClientId(
	clientId: string | null
): SetImageEditTargetClientIdAction {
	return {
		type: 'SET_IMAGE_EDIT_TARGET_CLIENT_ID',
		clientId,
	};
}

export function addConversationMessage(
	message: ConversationMessage
): AddConversationMessageAction {
	return {
		type: 'ADD_CONVERSATION_MESSAGE',
		message,
	};
}

export function updateConversationMessage(
	id: number,
	updates: Partial< Pick< ConversationMessage, 'text' | 'toolCalls' > >
): UpdateConversationMessageAction {
	return {
		type: 'UPDATE_CONVERSATION_MESSAGE',
		id,
		updates,
	};
}

export function clearConversation(): ClearConversationAction {
	return {
		type: 'CLEAR_CONVERSATION',
	};
}
