/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { useState, useCallback } from '@wordpress/element';
import {
	Button,
	SelectControl,
	Spinner,
	Notice,
	__experimentalText as Text,
} from '@wordpress/components';

/**
 * Internal dependencies
 */
import { useGeminiAgent } from '../hooks/use-gemini-agent';
import './ai-assistant-panel.scss';

/**
 * Props for the AI Assistant Panel
 */
interface AIAssistantPanelProps {
	apiKey: string;
	model?: string;
	systemInstruction?: string;
	responseModality?: 'AUDIO' | 'TEXT';
	defaultVoiceName?: string;
	abilityCategories?: string[];
	serverAbilitiesTimeoutMs?: number;
	onClose?: () => void;
}

/**
 * Message in the conversation
 */
const VOICE_PRESETS = [
	{ value: 'Zephyr', label: __( 'Zephyr' ), tone: __( 'Bright' ) },
	{ value: 'Puck', label: __( 'Puck' ), tone: __( 'Upbeat' ) },
	{ value: 'Charon', label: __( 'Charon' ), tone: __( 'Informative' ) },
	{ value: 'Kore', label: __( 'Kore' ), tone: __( 'Firm' ) },
	{ value: 'Fenrir', label: __( 'Fenrir' ), tone: __( 'Excitable' ) },
	{ value: 'Aoede', label: __( 'Aoede' ), tone: __( 'Breezy' ) },
	{ value: 'Leda', label: __( 'Leda' ), tone: __( 'Youthful' ) },
	{ value: 'Orus', label: __( 'Orus' ), tone: __( 'Firm' ) },
];

/**
 * AI Assistant Panel component
 *
 * This component provides a UI for interacting with the Gemini Live agent
 * in the WordPress block editor. It supports:
 * - Screen sharing for visual context
 * - Voice input/output
 * - Text chat
 * - Real-time function calling visualization
 *
 * @param props                   Component props.
 * @param props.apiKey            The Gemini API key.
 * @param props.model             Optional model name.
 * @param props.systemInstruction Optional system instruction.
 * @param props.onClose           Optional close callback.
 */
export function AIAssistantPanel( {
	apiKey,
	model,
	systemInstruction,
	responseModality,
	defaultVoiceName,
	abilityCategories,
	serverAbilitiesTimeoutMs,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	onClose,
}: AIAssistantPanelProps ) {
	const [ voicePreset, setVoicePreset ] = useState(
		defaultVoiceName || 'Aoede'
	);

	const effectiveResponseModality = responseModality || 'AUDIO';
	const resolvedVoiceName = voicePreset;

	// Gemini agent hook
	const {
		connectionState,
		isScreenSharing,
		isAudioEnabled,
		error,
		connect,
		disconnect,
		startScreenShare,
		startAudio,
	} = useGeminiAgent( {
		apiKey,
		model,
		systemInstruction,
		responseModality: effectiveResponseModality,
		voiceName: resolvedVoiceName,
		abilityCategories,
		serverAbilitiesTimeoutMs,
	} );

	const isConnected = connectionState === 'connected';
	const isConnecting = connectionState === 'connecting';
	const isError = connectionState === 'error';

	const voiceOptions = [
		...VOICE_PRESETS.map( ( voice ) => ( {
			value: voice.value,
			label: `${ voice.label } - ${ voice.tone }`,
		} ) ),
	];

	let statusLabel = __( 'Disconnected' );
	let statusDetail = __( 'Connect to start a live session.' );

	if ( isError ) {
		statusLabel = __( 'Connection error' );
		statusDetail =
			error || __( 'Check your API key or network connection.' );
	} else if ( isConnecting ) {
		statusLabel = __( 'Connecting' );
		statusDetail = __( 'Opening the live stream...' );
	} else if ( isConnected ) {
		statusLabel = __( 'Connected' );
		const streams: string[] = [];
		if ( isScreenSharing ) {
			streams.push( __( 'Video' ) );
		}
		if ( isAudioEnabled ) {
			streams.push( __( 'Audio' ) );
		}
		statusDetail = streams.length
			? sprintf(
					/* translators: %s: list of active streams */
					__( 'Streaming: %s.' ),
					streams.join( ' + ' )
			  )
			: __( 'Waiting for screen and microphone permissions.' );
	}

	const showVoicePicker = effectiveResponseModality === 'AUDIO';

	const handleConnect = useCallback( async () => {
		if ( isConnected ) {
			disconnect();
			return;
		}

		try {
			await connect();
		} catch {
			return;
		}

		try {
			await startScreenShare();
		} catch {
			// Screen share is optional to continue connection.
		}

		try {
			await startAudio();
		} catch {
			// Audio is optional to continue connection.
		}
	}, [ connect, disconnect, isConnected, startAudio, startScreenShare ] );

	return (
		<div className="gemini-live-agent-panel">
			<div className="gemini-live-agent-panel__section gemini-live-agent-panel__status">
				<Text className="gemini-live-agent-panel__status-title">
					{ statusLabel }
				</Text>
				<Text
					size="small"
					className="gemini-live-agent-panel__status-detail"
				>
					{ statusDetail }
				</Text>

				{ error && (
					<Notice status="error" isDismissible={ false }>
						{ error }
					</Notice>
				) }

				<div className="gemini-live-agent-panel__actions">
					<Button
						__next40pxDefaultSize
						variant={ isConnected ? 'secondary' : 'primary' }
						onClick={ handleConnect }
						disabled={ isConnecting }
						accessibleWhenDisabled
					>
						{ isConnected
							? __( 'Disconnect' )
							: __( 'Connect to AI' ) }
					</Button>
					{ isConnecting && <Spinner /> }
				</div>
			</div>

			<div
				className={ `gemini-live-agent-panel__section gemini-live-agent-panel__voice${
					showVoicePicker ? '' : ' is-disabled'
				}` }
			>
				<Text
					size="small"
					className="gemini-live-agent-panel__section-title"
				>
					{ __( 'Voice' ) }
				</Text>
				<SelectControl
					__next40pxDefaultSize
					label={ __( 'Voice preset' ) }
					value={ voicePreset }
					options={ voiceOptions }
					onChange={ ( value ) => setVoicePreset( value ) }
					disabled={ ! showVoicePicker }
				/>
				<Text
					size="small"
					className="gemini-live-agent-panel__voice-note"
				>
					{ showVoicePicker
						? __( 'Select a voice for audio responses.' )
						: __( 'Audio responses are disabled.' ) }
				</Text>
			</div>
		</div>
	);
}
