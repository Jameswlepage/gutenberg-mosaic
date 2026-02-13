/**
 * WordPress dependencies
 */
import { useCallback, useEffect, useRef } from '@wordpress/element';
import { dispatch, useSelect } from '@wordpress/data';
import { privateApis as coreDataPrivateApis } from '@wordpress/core-data';

/**
 * Internal dependencies
 */
import {
	createGeminiBridge,
	createScreenCapture,
	createAudioCapture,
} from '../bridge';
import type { GeminiBridge, ScreenCapture, AudioCapture } from '../bridge';
import type {
	GeminiConfig,
	ConnectionState,
	GeminiFunctionCall,
} from '../types';
import { store as geminiAgentStore, sharedAudioLevel } from '../store';
import { unlock } from '../lock-unlock';

/**
 * Hook options
 */
interface UseGeminiAgentOptions {
	apiKey: string;
	model?: string;
	systemInstruction?: string;
	responseModality?: 'AUDIO' | 'TEXT';
	voiceName?: string;
	languageCode?: string;
	abilityCategories?: string[];
	serverAbilitiesTimeoutMs?: number;
	onModelResponse?: ( text: string ) => void;
	onInputTranscription?: ( text: string ) => void;
	onAudioResponse?: ( audioData: ArrayBuffer ) => void;
	onFunctionCallStart?: ( call: GeminiFunctionCall ) => void;
	onFunctionCallEnd?: ( call: GeminiFunctionCall ) => void;
	onFunctionCall?: ( call: GeminiFunctionCall ) => void;
	onError?: ( error: Error ) => void;
}

/**
 * Hook return type
 */
/**
 * Ref object for reading audio level without re-renders.
 */
export interface AudioLevelRef {
	/** Current input audio level (0-1 RMS, smoothed). */
	current: number;
}

interface UseGeminiAgentReturn {
	// State
	connectionState: ConnectionState;
	isScreenSharing: boolean;
	isAudioEnabled: boolean;
	error: string | null;

	/** Ref that contains the latest audio input level (0-1). Read in rAF loops. */
	audioLevelRef: AudioLevelRef;

	// Actions
	connect: () => Promise< void >;
	disconnect: () => void;
	startScreenShare: () => Promise< void >;
	stopScreenShare: () => void;
	startAudio: () => Promise< void >;
	stopAudio: () => void;
	sendMessage: ( text: string ) => void;
}

const coreDataApis = coreDataPrivateApis
	? unlock( coreDataPrivateApis )
	: {};
const { getSyncManager } = coreDataApis;

let sharedBridge: GeminiBridge | null = null;
let sharedScreenCapture: ScreenCapture | null = null;
let sharedAudioCapture: AudioCapture | null = null;
let sharedConfigKey: string | null = null;

function getConfigKey( config: GeminiConfig ): string {
	return JSON.stringify( {
		apiKey: config.apiKey || '',
		model: config.model || '',
		systemInstruction: config.systemInstruction || '',
		responseModality: config.responseModality || '',
		voiceName: config.voiceName || '',
		languageCode: config.languageCode || '',
		abilityCategories: ( config.abilityCategories || [] ).slice().sort(),
		serverAbilitiesTimeoutMs: config.serverAbilitiesTimeoutMs || 0,
	} );
}

/**
 * React hook for integrating Gemini Live agent into the editor
 *
 * @param options Hook configuration options.
 *
 * @example
 * ```tsx
 * function AIAssistantPanel() {
 *   const {
 *     connectionState,
 *     isScreenSharing,
 *     connect,
 *     disconnect,
 *     startScreenShare,
 *     sendMessage,
 *   } = useGeminiAgent({
 *     apiKey: 'your-api-key',
 *     onModelResponse: (text) => console.log('AI:', text),
 *   });
 *
 *   return (
 *     <div>
 *       <button onClick={connectionState === 'connected' ? disconnect : connect}>
 *         {connectionState === 'connected' ? 'Disconnect' : 'Connect'}
 *       </button>
 *       {connectionState === 'connected' && (
 *         <button onClick={isScreenSharing ? stopScreenShare : startScreenShare}>
 *           {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useGeminiAgent(
	options: UseGeminiAgentOptions
): UseGeminiAgentReturn {
	const {
		apiKey,
		model,
		systemInstruction,
		responseModality,
		voiceName,
		languageCode,
		abilityCategories,
		serverAbilitiesTimeoutMs,
		onModelResponse,
		onInputTranscription,
		onAudioResponse,
		onFunctionCallStart,
		onFunctionCallEnd,
		onFunctionCall,
		onError,
	} = options;

	// State
	const { connectionState, isScreenSharing, isAudioEnabled, error } =
		useSelect( ( select ) => {
			const storeSelect = select( geminiAgentStore );
			return {
				connectionState: storeSelect.getConnectionState(),
				isScreenSharing: storeSelect.getIsScreenSharing(),
				isAudioEnabled: storeSelect.getIsAudioEnabled(),
				error: storeSelect.getLastError(),
			};
		}, [] );
	const activeBlockClientId = useSelect(
		( select ) =>
			select( geminiAgentStore )?.getActiveBlockClientId?.() ?? null,
		[]
	);
	const { postId, postType } = useSelect( ( select ) => {
		const editor = select( 'core/editor' ) as {
			getCurrentPostId?: () => number | null;
			getCurrentPostType?: () => string | null;
		};

		return {
			postId: editor?.getCurrentPostId?.() ?? null,
			postType: editor?.getCurrentPostType?.() ?? null,
		};
	}, [] );

	// Refs for bridge and capture instances
	const bridgeRef = useRef< GeminiBridge | null >( null );
	const screenCaptureRef = useRef< ScreenCapture | null >( null );
	const audioCaptureRef = useRef< AudioCapture | null >( null );

	// Audio level refs — written by callbacks, read in rAF loops (no re-renders)
	const audioInputLevelRef = useRef< number >( 0 );
	const audioOutputLevelRef = useRef< number >( 0 );
	// Combined level (max of input and output) for the orb
	const audioLevelRef = useRef< number >( 0 );

	// Initialize bridge with config
	useEffect( () => {
		const config: GeminiConfig = {
			apiKey,
			model,
			systemInstruction,
			responseModality,
			voiceName,
			languageCode,
			abilityCategories,
			serverAbilitiesTimeoutMs,
		};
		const configKey = getConfigKey( config );

		if ( ! sharedBridge || sharedConfigKey !== configKey ) {
			sharedBridge?.disconnect();
			sharedScreenCapture?.stop();
			sharedAudioCapture?.stop();

			sharedBridge = createGeminiBridge( config );
			sharedScreenCapture = createScreenCapture();
			sharedAudioCapture = createAudioCapture();

			sharedScreenCapture.setBridge( sharedBridge );
			sharedAudioCapture.setBridge( sharedBridge );

			sharedScreenCapture.setOnStop( () => {
				dispatch( geminiAgentStore ).setScreenSharing( false );
			} );

			sharedAudioCapture.setOnStop( () => {
				dispatch( geminiAgentStore ).setAudioEnabled( false );
				audioInputLevelRef.current = 0;
				audioLevelRef.current = 0;
				sharedAudioLevel.current = 0;
			} );

			sharedAudioCapture.setOnAudioLevel( ( level: number ) => {
				// Smooth with exponential moving average
				audioInputLevelRef.current +=
					( level - audioInputLevelRef.current ) * 0.3;
				audioLevelRef.current = Math.max(
					audioInputLevelRef.current,
					audioOutputLevelRef.current
				);
				sharedAudioLevel.current = audioLevelRef.current;
			} );

			sharedConfigKey = configKey;
		}

		bridgeRef.current = sharedBridge;
		screenCaptureRef.current = sharedScreenCapture;
		audioCaptureRef.current = sharedAudioCapture;

		// Set up event handlers
		sharedBridge.setEventHandlers( {
			onConnect: () => {
				dispatch( geminiAgentStore ).setConnectionState( 'connected' );
				dispatch( geminiAgentStore ).setLastError( null );
			},
			onDisconnect: () => {
				sharedScreenCapture?.stop();
				sharedAudioCapture?.stop();
				dispatch( geminiAgentStore ).setConnectionState( 'disconnected' );
				dispatch( geminiAgentStore ).setScreenSharing( false );
				dispatch( geminiAgentStore ).setAudioEnabled( false );
				dispatch( geminiAgentStore ).setActiveBlockClientId( null );
				dispatch( geminiAgentStore ).setImageEditTargetClientId(
					null
				);
				audioInputLevelRef.current = 0;
				audioOutputLevelRef.current = 0;
				audioLevelRef.current = 0;
			},
			onError: ( err ) => {
				sharedScreenCapture?.stop();
				sharedAudioCapture?.stop();
				onError?.( err );
				dispatch( geminiAgentStore ).setConnectionState( 'error' );
				dispatch( geminiAgentStore ).setLastError( err.message );
				dispatch( geminiAgentStore ).setActiveBlockClientId( null );
				dispatch( geminiAgentStore ).setImageEditTargetClientId(
					null
				);
			},
			onModelResponse: ( text ) => {
				onModelResponse?.( text );
			},
			onInputTranscription: ( text ) => {
				// Barge-in: if user starts talking, stop any in-flight AI audio.
				sharedBridge?.interruptAudioOutput();
				onInputTranscription?.( text );
			},
			onAudioResponse: ( audioData ) => {
				onAudioResponse?.( audioData );
			},
			onOutputAudioLevel: ( level ) => {
				audioOutputLevelRef.current +=
					( level - audioOutputLevelRef.current ) * 0.25;
				audioLevelRef.current = Math.max(
					audioInputLevelRef.current,
					audioOutputLevelRef.current
				);
				sharedAudioLevel.current = audioLevelRef.current;
			},
			onFunctionCallStart: ( call ) => {
				onFunctionCallStart?.( call );
			},
			onFunctionCallEnd: ( call ) => {
				onFunctionCallEnd?.( call );
			},
			onFunctionCall: ( call ) => {
				onFunctionCall?.( call );
			},
		} );
	}, [
		apiKey,
		model,
		systemInstruction,
		responseModality,
		voiceName,
		languageCode,
		abilityCategories,
		serverAbilitiesTimeoutMs,
		onModelResponse,
		onInputTranscription,
		onAudioResponse,
		onFunctionCallStart,
		onFunctionCallEnd,
		onFunctionCall,
		onError,
	] );

	// Connect to Gemini
	const connect = useCallback( async () => {
		if ( ! bridgeRef.current ) {
			return;
		}

		dispatch( geminiAgentStore ).setConnectionState( 'connecting' );
		dispatch( geminiAgentStore ).setLastError( null );

		try {
			await bridgeRef.current.connect();
		} catch ( err ) {
			dispatch( geminiAgentStore ).setConnectionState( 'error' );
			dispatch( geminiAgentStore ).setLastError(
				err instanceof Error ? err.message : 'Failed to connect'
			);
			onError?.(
				err instanceof Error ? err : new Error( 'Failed to connect' )
			);
		}
	}, [ onError ] );

	useEffect( () => {
		if ( ! postId || ! postType || typeof getSyncManager !== 'function' ) {
			return;
		}

		const awareness = getSyncManager()?.getAwareness(
			`postType/${ postType }`,
			postId.toString()
		);

		if ( ! awareness ) {
			return;
		}

		awareness.setUp?.();

		awareness.setLocalStateField( 'aiState', {
			connected: connectionState !== 'disconnected',
			status: connectionState,
			isAudioEnabled,
			isScreenSharing,
			activeBlockClientId: activeBlockClientId || null,
		} );
	}, [
		activeBlockClientId,
		connectionState,
		isAudioEnabled,
		isScreenSharing,
		postId,
		postType,
	] );

	// Disconnect from Gemini
	const disconnect = useCallback( () => {
		bridgeRef.current?.disconnect();
		screenCaptureRef.current?.stop();
		audioCaptureRef.current?.stop();
		dispatch( geminiAgentStore ).setConnectionState( 'disconnected' );
		dispatch( geminiAgentStore ).setScreenSharing( false );
		dispatch( geminiAgentStore ).setAudioEnabled( false );
		dispatch( geminiAgentStore ).setActiveBlockClientId( null );
		dispatch( geminiAgentStore ).setImageEditTargetClientId( null );
	}, [] );

	// Start screen sharing
	const startScreenShare = useCallback( async () => {
		if ( ! screenCaptureRef.current ) {
			return;
		}

		try {
			await screenCaptureRef.current.start();
			dispatch( geminiAgentStore ).setScreenSharing( true );
			dispatch( geminiAgentStore ).setLastError( null );
		} catch ( err ) {
			dispatch( geminiAgentStore ).setLastError(
				err instanceof Error
					? err.message
					: 'Failed to start screen sharing'
			);
			onError?.(
				err instanceof Error
					? err
					: new Error( 'Failed to start screen sharing' )
			);
		}
	}, [ onError ] );

	// Stop screen sharing
	const stopScreenShare = useCallback( () => {
		screenCaptureRef.current?.stop();
		dispatch( geminiAgentStore ).setScreenSharing( false );
	}, [] );

	// Start audio capture
	const startAudio = useCallback( async () => {
		if ( ! audioCaptureRef.current ) {
			return;
		}

		try {
			await audioCaptureRef.current.start();
			dispatch( geminiAgentStore ).setAudioEnabled( true );
			dispatch( geminiAgentStore ).setLastError( null );
		} catch ( err ) {
			dispatch( geminiAgentStore ).setLastError(
				err instanceof Error ? err.message : 'Failed to start audio'
			);
			onError?.(
				err instanceof Error
					? err
					: new Error( 'Failed to start audio' )
			);
		}
	}, [ onError ] );

	// Stop audio capture
	const stopAudio = useCallback( () => {
		audioCaptureRef.current?.stop();
		dispatch( geminiAgentStore ).setAudioEnabled( false );
	}, [] );

	// Send a text message
	const sendMessage = useCallback( ( text: string ) => {
		bridgeRef.current?.sendTextMessage( text );
	}, [] );

	return {
		connectionState,
		isScreenSharing,
		isAudioEnabled,
		error,
		audioLevelRef,
		connect,
		disconnect,
		startScreenShare,
		stopScreenShare,
		startAudio,
		stopAudio,
		sendMessage,
	};
}
