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
	imageEditTargetClientId: null,
	conversationMessages: [],
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
		case 'SET_IMAGE_EDIT_TARGET_CLIENT_ID':
			return {
				...state,
				imageEditTargetClientId: action.clientId,
			};
		case 'ADD_CONVERSATION_MESSAGE':
			return {
				...state,
				conversationMessages: [
					...state.conversationMessages,
					action.message,
				],
			};
		case 'UPDATE_CONVERSATION_MESSAGE':
			return {
				...state,
				conversationMessages: state.conversationMessages.map( ( m ) =>
					m.id === action.id ? { ...m, ...action.updates } : m
				),
			};
		case 'CLEAR_CONVERSATION':
			return {
				...state,
				conversationMessages: [],
			};
		default:
			return state;
	}
}
