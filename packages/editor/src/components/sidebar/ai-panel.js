/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';
import {
	Button,
	DropdownMenu,
	MenuGroup,
	MenuItem,
	TextControl,
	Notice,
	__experimentalHStack as HStack,
	__experimentalText as Text,
} from '@wordpress/components';
import { moreVertical } from '@wordpress/icons';

/**
 * External dependencies
 */
import {
	AIAssistantPanel,
	registerAllAgentAbilities,
} from '@wordpress/gemini-live-agent';
import './ai-panel.scss';

const API_KEY_STORAGE_KEY = 'gutenberg_gemini_api_key';

registerAllAgentAbilities();

function getStoredApiKey() {
	try {
		return localStorage.getItem( API_KEY_STORAGE_KEY ) || '';
	} catch {
		return '';
	}
}

function storeApiKey( key ) {
	try {
		localStorage.setItem( API_KEY_STORAGE_KEY, key );
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

	// Load stored API key
	useEffect( () => {
		const storedKey = getStoredApiKey();
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

		storeApiKey( tempApiKey.trim() );
		setApiKey( tempApiKey.trim() );
		setShowKeyInput( false );
		setKeyError( null );
	};

	const handleChangeApiKey = () => {
		setTempApiKey( '' );
		setKeyError( null );
		setShowKeyInput( true );
	};

	// API Key input screen
	if ( showKeyInput ) {
		return (
			<div className="editor-ai-panel">
				<div className="editor-ai-panel__header">
					<Text className="editor-ai-panel__title">
						{ __( 'Gemini Live' ) }
					</Text>
				</div>
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
			<div className="editor-ai-panel__header">
				<Text className="editor-ai-panel__title">
					{ __( 'Gemini Live' ) }
				</Text>
				<DropdownMenu
					icon={ moreVertical }
					label={ __( 'Gemini options' ) }
					className="editor-ai-panel__menu"
				>
					{ ( { onClose } ) => (
						<MenuGroup>
							<MenuItem
								onClick={ () => {
									handleChangeApiKey();
									onClose();
								} }
							>
								{ __( 'Change API key' ) }
							</MenuItem>
						</MenuGroup>
					) }
				</DropdownMenu>
			</div>
			<AIAssistantPanel apiKey={ apiKey } />
		</div>
	);
}
