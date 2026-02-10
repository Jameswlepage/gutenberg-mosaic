/**
 * WordPress dependencies
 */
import { useSelect } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { store as geminiAgentStore } from '../store';

export function useGeminiAgentPresence() {
	return useSelect( ( select ) => {
		const storeSelect = select( geminiAgentStore );
		return {
			connectionState: storeSelect.getConnectionState(),
			isScreenSharing: storeSelect.getIsScreenSharing(),
			isAudioEnabled: storeSelect.getIsAudioEnabled(),
			lastError: storeSelect.getLastError(),
			activeBlockClientId: storeSelect.getActiveBlockClientId(),
		};
	}, [] );
}
