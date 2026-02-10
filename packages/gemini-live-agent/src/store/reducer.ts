/**
 * Internal dependencies
 */
import type { Action, GeminiAgentState } from './types';

const DEFAULT_STATE: GeminiAgentState = {
	connectionState: 'disconnected',
	isScreenSharing: false,
	isAudioEnabled: false,
	lastError: null,
	activeBlockClientId: null,
};

export default function reducer(
	state: GeminiAgentState = DEFAULT_STATE,
	action: Action
): GeminiAgentState {
	switch ( action.type ) {
		case 'SET_CONNECTION_STATE':
			return {
				...state,
				connectionState: action.connectionState,
			};
		case 'SET_SCREEN_SHARING':
			return {
				...state,
				isScreenSharing: action.isScreenSharing,
			};
		case 'SET_AUDIO_ENABLED':
			return {
				...state,
				isAudioEnabled: action.isAudioEnabled,
			};
		case 'SET_LAST_ERROR':
			return {
				...state,
				lastError: action.lastError,
			};
		case 'SET_ACTIVE_BLOCK_CLIENT_ID':
			return {
				...state,
				activeBlockClientId: action.clientId,
			};
		default:
			return state;
	}
}
