/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';
import {
	Button,
	TextControl,
	Notice,
	__experimentalHStack as HStack,
	__experimentalText as Text,
} from '@wordpress/components';

/**
 * External dependencies
 */
import {
	AIAssistantPanel,
	registerAllAgentAbilities,
} from '@wordpress/gemini-live-agent';
import './ai-panel.scss';

const API_KEY_STORAGE_KEY = 'gutenberg_gemini_api_key';
const VOICE_STORAGE_KEY = 'gutenberg_gemini_voice';
const LANGUAGE_STORAGE_KEY = 'gutenberg_gemini_language';

registerAllAgentAbilities();

function getStored( key, fallback = '' ) {
	try {
		return localStorage.getItem( key ) || fallback;
	} catch {
		return fallback;
	}
}

function setStored( key, value ) {
	try {
		localStorage.setItem( key, value );
	} catch {
		// Ignore
	}
}


/**
 * AI Panel component
 */
export default function AIPanel() {
	const [ apiKey, setApiKey ] = useState( '' );
	const [ tempApiKey, setTempApiKey ] = useState( '' );
	const [ showKeyInput, setShowKeyInput ] = useState( true );
	const [ keyError, setKeyError ] = useState( null );
	const [ voicePreset ] = useState(
		() => getStored( VOICE_STORAGE_KEY, 'Aoede' )
	);
	const [ languageCode ] = useState(
		() => getStored( LANGUAGE_STORAGE_KEY, '' )
	);

	// Load stored API key
	useEffect( () => {
		const storedKey = getStored( API_KEY_STORAGE_KEY );
		if ( storedKey ) {
			setApiKey( storedKey );
			setShowKeyInput( false );
		}
	}, [] );

	const handleSaveApiKey = () => {
		if ( ! tempApiKey.trim() ) {
			setKeyError( __( 'API key is required' ) );
			return;
		}

		setStored( API_KEY_STORAGE_KEY, tempApiKey.trim() );
		setApiKey( tempApiKey.trim() );
		setShowKeyInput( false );
		setKeyError( null );
	};

	// API Key input screen
	if ( showKeyInput ) {
		return (
			<div className="editor-ai-panel">
				<div className="editor-ai-panel__section">
					<Text>
						{ __(
							'Enter your Google Gemini API key to use the AI Assistant.'
						) }
					</Text>
					<TextControl
						__next40pxDefaultSize
						label={ __( 'API Key' ) }
						value={ tempApiKey }
						onChange={ ( value ) => {
							setTempApiKey( value );
							setKeyError( null );
						} }
						type="password"
					/>
					{ keyError && (
						<Notice status="error" isDismissible={ false }>
							{ keyError }
						</Notice>
					) }
					<Text variant="muted" size="small">
						<a
							href="https://aistudio.google.com/app/apikey"
							target="_blank"
							rel="noopener noreferrer"
						>
							{ __( 'Get your API key from Google AI Studio' ) }
						</a>
					</Text>
					<HStack className="editor-ai-panel__actions">
						<Button
							__next40pxDefaultSize
							variant="primary"
							onClick={ handleSaveApiKey }
							disabled={ ! tempApiKey.trim() }
						>
							{ __( 'Save' ) }
						</Button>
						{ apiKey && (
							<Button
								__next40pxDefaultSize
								variant="tertiary"
								onClick={ () => setShowKeyInput( false ) }
							>
								{ __( 'Cancel' ) }
							</Button>
						) }
					</HStack>
				</div>
			</div>
		);
	}

	return (
		<div className="editor-ai-panel">
			<AIAssistantPanel
				apiKey={ apiKey }
				defaultVoiceName={ voicePreset }
				defaultLanguageCode={ languageCode }
			/>
		</div>
	);
}
