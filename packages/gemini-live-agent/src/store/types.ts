/**
 * Internal dependencies
 */
import type { ConnectionState } from '../types';

export interface ConversationMessage {
	id: number;
	role: 'user' | 'assistant';
	text: string;
	toolCalls?: string[];
}

export interface GeminiAgentState {
	connectionState: ConnectionState;
	isScreenSharing: boolean;
	isAudioEnabled: boolean;
	lastError: string | null;
	activeBlockClientId: string | null;
	imageEditTargetClientId: string | null;
	conversationMessages: ConversationMessage[];
}

export type SetConnectionStateAction = {
	type: 'SET_CONNECTION_STATE';
	connectionState: ConnectionState;
};

export type SetScreenSharingAction = {
	type: 'SET_SCREEN_SHARING';
	isScreenSharing: boolean;
};

export type SetAudioEnabledAction = {
	type: 'SET_AUDIO_ENABLED';
	isAudioEnabled: boolean;
};

export type SetLastErrorAction = {
	type: 'SET_LAST_ERROR';
	lastError: string | null;
};

export type SetActiveBlockClientIdAction = {
	type: 'SET_ACTIVE_BLOCK_CLIENT_ID';
	clientId: string | null;
};

export type SetImageEditTargetClientIdAction = {
	type: 'SET_IMAGE_EDIT_TARGET_CLIENT_ID';
	clientId: string | null;
};

export type AddConversationMessageAction = {
	type: 'ADD_CONVERSATION_MESSAGE';
	message: ConversationMessage;
};

export type UpdateConversationMessageAction = {
	type: 'UPDATE_CONVERSATION_MESSAGE';
	id: number;
	updates: Partial< Pick< ConversationMessage, 'text' | 'toolCalls' > >;
};

export type ClearConversationAction = {
	type: 'CLEAR_CONVERSATION';
};

export type Action =
	| SetConnectionStateAction
	| SetScreenSharingAction
	| SetAudioEnabledAction
	| SetLastErrorAction
	| SetActiveBlockClientIdAction
	| SetImageEditTargetClientIdAction
	| AddConversationMessageAction
	| UpdateConversationMessageAction
	| ClearConversationAction;
