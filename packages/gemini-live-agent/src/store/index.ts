/**
 * WordPress dependencies
 */
import { createReduxStore, register } from '@wordpress/data';

/**
 * Internal dependencies
 */
import reducer from './reducer';
import * as actions from './actions';
import * as selectors from './selectors';
import { STORE_NAME } from './constants';

/**
 * Gemini Live Agent store definition.
 */
export const store = createReduxStore( STORE_NAME, {
	reducer,
	actions,
	selectors,
} );

register( store );

/**
 * Shared audio level ref — written by useGeminiAgent, read by any
 * component (e.g. floating pill waveform) via requestAnimationFrame.
 * Not reactive — avoids re-renders for high-frequency audio data.
 */
export const sharedAudioLevel = { current: 0 };
