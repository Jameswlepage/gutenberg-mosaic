/**
 * Internal dependencies
 */
import type { ConnectionState } from '../types';

export interface GeminiAgentState {
	connectionState: ConnectionState;
	isScreenSharing: boolean;
	isAudioEnabled: boolean;
	lastError: string | null;
	activeBlockClientId: string | null;
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

export type Action =
	| SetConnectionStateAction
	| SetScreenSharingAction
	| SetAudioEnabledAction
	| SetLastErrorAction
	| SetActiveBlockClientIdAction;
