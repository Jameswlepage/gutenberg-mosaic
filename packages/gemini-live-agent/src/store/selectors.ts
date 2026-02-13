/**
 * Internal dependencies
 */
import type { GeminiAgentState } from './types';

export function getConnectionState( state: GeminiAgentState ) {
	return state.connectionState;
}

export function getIsScreenSharing( state: GeminiAgentState ) {
	return state.isScreenSharing;
}

export function getIsAudioEnabled( state: GeminiAgentState ) {
	return state.isAudioEnabled;
}

export function getLastError( state: GeminiAgentState ) {
	return state.lastError;
}

export function getActiveBlockClientId( state: GeminiAgentState ) {
	return state.activeBlockClientId;
}

export function getImageEditTargetClientId( state: GeminiAgentState ) {
	return state.imageEditTargetClientId;
}

export function isConnected( state: GeminiAgentState ) {
	return state.connectionState === 'connected';
}

export function getConversationMessages( state: GeminiAgentState ) {
	return state.conversationMessages;
}
