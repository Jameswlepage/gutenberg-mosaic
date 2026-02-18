/**
 * WordPress dependencies
 */

import { __ } from '@wordpress/i18n';
import { useViewportMatch } from '@wordpress/compose';
import { useSelect, useDispatch } from '@wordpress/data';
import { useMemo, useState, useCallback, useId } from '@wordpress/element';
import {
	store as preferencesStore,
	privateApis as preferencesPrivateApis,
} from '@wordpress/preferences';
import { store as interfaceStore } from '@wordpress/interface';
import {
	TextControl,
	Button,
	Notice,
	__experimentalHStack as HStack,
	__experimentalText as Text,
} from '@wordpress/components';

/**
 * Internal dependencies
 */
import EnablePanelOption from './enable-panel';
import EnablePluginDocumentSettingPanelOption from './enable-plugin-document-setting-panel';
import EnablePublishSidebarOption from './enable-publish-sidebar';
import BlockVisibility from '../block-visibility';
import PostTaxonomies from '../post-taxonomies';
import PostFeaturedImageCheck from '../post-featured-image/check';
import PostExcerptCheck from '../post-excerpt/check';
import PageAttributesCheck from '../page-attributes/check';
import PostTypeSupportCheck from '../post-type-support-check';
import { store as editorStore } from '../../store';
import { unlock } from '../../lock-unlock';

const {
	PreferencesModal,
	PreferencesModalTabs,
	PreferencesModalSection,
	PreferenceToggleControl,
} = unlock( preferencesPrivateApis );

const GEMINI_API_KEY_STORAGE_KEY = 'gutenberg_gemini_api_key';
const EXA_API_KEY_STORAGE_KEY = 'gutenberg_exa_api_key';
const FAL_API_KEY_STORAGE_KEY = 'gutenberg_fal_api_key';
const GEMINI_VOICE_STORAGE_KEY = 'gutenberg_gemini_voice';
const GEMINI_LANGUAGE_STORAGE_KEY = 'gutenberg_gemini_language';

const VOICE_PRESETS = [
	{ value: 'Zephyr', label: 'Zephyr — Bright' },
	{ value: 'Puck', label: 'Puck — Upbeat' },
	{ value: 'Charon', label: 'Charon — Informative' },
	{ value: 'Kore', label: 'Kore — Firm' },
	{ value: 'Fenrir', label: 'Fenrir — Excitable' },
	{ value: 'Aoede', label: 'Aoede — Breezy' },
	{ value: 'Leda', label: 'Leda — Youthful' },
	{ value: 'Orus', label: 'Orus — Firm' },
];

const LANGUAGES = [
	{ value: '', label: __( 'Auto-detect' ) },
	{ value: 'en-US', label: 'English (US)' },
	{ value: 'en-GB', label: 'English (UK)' },
	{ value: 'es-ES', label: 'Spanish' },
	{ value: 'fr-FR', label: 'French' },
	{ value: 'de-DE', label: 'German' },
	{ value: 'it-IT', label: 'Italian' },
	{ value: 'pt-BR', label: 'Portuguese (BR)' },
	{ value: 'ja-JP', label: 'Japanese' },
	{ value: 'ko-KR', label: 'Korean' },
	{ value: 'zh-CN', label: 'Chinese (Simplified)' },
	{ value: 'hi-IN', label: 'Hindi' },
	{ value: 'ar-SA', label: 'Arabic' },
	{ value: 'nl-NL', label: 'Dutch' },
	{ value: 'pl-PL', label: 'Polish' },
	{ value: 'ru-RU', label: 'Russian' },
	{ value: 'sv-SE', label: 'Swedish' },
	{ value: 'tr-TR', label: 'Turkish' },
	{ value: 'vi-VN', label: 'Vietnamese' },
];

function getStored( key, fallback = '' ) {
	try {
		return window.localStorage.getItem( key ) || fallback;
	} catch {
		return fallback;
	}
}

function setStored( key, value ) {
	try {
		window.localStorage.setItem( key, value );
	} catch {
		// Ignore storage errors.
	}
}

function ApiKeyField( { storageKey, label, helpUrl, helpText } ) {
	const [ savedKey, setSavedKey ] = useState( () => getStored( storageKey ) );
	const [ tempKey, setTempKey ] = useState( '' );
	const [ isEditing, setIsEditing ] = useState( false );
	const [ error, setError ] = useState( null );

	const handleSave = useCallback( () => {
		if ( ! tempKey.trim() ) {
			setError( __( 'API key is required' ) );
			return;
		}
		setStored( storageKey, tempKey.trim() );
		setSavedKey( tempKey.trim() );
		setIsEditing( false );
		setTempKey( '' );
		setError( null );
	}, [ tempKey, storageKey ] );

	if ( savedKey && ! isEditing ) {
		return (
			<HStack alignment="left">
				<Text>{ '••••••••' + savedKey.slice( -4 ) }</Text>
				<Button
					__next40pxDefaultSize
					variant="link"
					onClick={ () => {
						setIsEditing( true );
						setTempKey( '' );
					} }
				>
					{ __( 'Change' ) }
				</Button>
			</HStack>
		);
	}

	return (
		<>
			<TextControl
				__next40pxDefaultSize
				label={ label }
				value={ tempKey }
				onChange={ ( value ) => {
					setTempKey( value );
					setError( null );
				} }
				type="password"
				help={
					helpUrl ? (
						<a
							href={ helpUrl }
							target="_blank"
							rel="noopener noreferrer"
						>
							{ helpText }
						</a>
					) : undefined
				}
			/>
			{ error && (
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
			) }
			<HStack alignment="left">
				<Button
					__next40pxDefaultSize
					variant="primary"
					onClick={ handleSave }
					disabled={ ! tempKey.trim() }
					accessibleWhenDisabled
				>
					{ __( 'Save' ) }
				</Button>
				{ savedKey && (
					<Button
						__next40pxDefaultSize
						variant="tertiary"
						onClick={ () => {
							setIsEditing( false );
							setTempKey( '' );
							setError( null );
						} }
					>
						{ __( 'Cancel' ) }
					</Button>
				) }
			</HStack>
		</>
	);
}

function AIPreferencesContent() {
	const [ voicePreset, setVoicePreset ] = useState( () =>
		getStored( GEMINI_VOICE_STORAGE_KEY, 'Aoede' )
	);
	const [ languageCode, setLanguageCode ] = useState( () =>
		getStored( GEMINI_LANGUAGE_STORAGE_KEY, '' )
	);

	const voiceSelectId = useId();
	const langSelectId = useId();

	const handleVoiceChange = useCallback( ( e ) => {
		const value = e.target.value;
		setVoicePreset( value );
		setStored( GEMINI_VOICE_STORAGE_KEY, value );
	}, [] );

	const handleLanguageChange = useCallback( ( e ) => {
		const value = e.target.value;
		setLanguageCode( value );
		setStored( GEMINI_LANGUAGE_STORAGE_KEY, value );
	}, [] );

	return (
		<>
			<PreferencesModalSection
				title={ __( 'Gemini API key' ) }
				description={ __(
					'A Gemini API key is required to use the AI assistant.'
				) }
			>
				<ApiKeyField
					storageKey={ GEMINI_API_KEY_STORAGE_KEY }
					label={ __( 'API Key' ) }
					helpUrl="https://aistudio.google.com/app/apikey"
					helpText={ __( 'Get your API key from Google AI Studio' ) }
				/>
			</PreferencesModalSection>
			<PreferencesModalSection
				title={ __( 'Exa API key' ) }
				description={ __(
					'An Exa API key enables AI-powered web search.'
				) }
			>
				<ApiKeyField
					storageKey={ EXA_API_KEY_STORAGE_KEY }
					label={ __( 'Exa API Key' ) }
					helpUrl="https://dashboard.exa.ai/api-keys"
					helpText={ __( 'Get your API key from Exa' ) }
				/>
			</PreferencesModalSection>
			<PreferencesModalSection
				title={ __( 'Fal API key' ) }
				description={ __(
					'A Fal API key enables AI image generation.'
				) }
			>
				<ApiKeyField
					storageKey={ FAL_API_KEY_STORAGE_KEY }
					label={ __( 'Fal API Key' ) }
					helpUrl="https://fal.ai/dashboard/keys"
					helpText={ __( 'Get your API key from fal.ai' ) }
				/>
			</PreferencesModalSection>
			<PreferencesModalSection
				title={ __( 'Voice' ) }
				description={ __( 'Choose a voice for the AI assistant.' ) }
			>
				<select
					id={ voiceSelectId }
					className="editor-ai-preferences__select"
					value={ voicePreset }
					onChange={ handleVoiceChange }
				>
					{ VOICE_PRESETS.map( ( voice ) => (
						<option key={ voice.value } value={ voice.value }>
							{ voice.label }
						</option>
					) ) }
				</select>
			</PreferencesModalSection>
			<PreferencesModalSection
				title={ __( 'Language' ) }
				description={ __( 'Set the language for speech recognition.' ) }
			>
				<select
					id={ langSelectId }
					className="editor-ai-preferences__select"
					value={ languageCode }
					onChange={ handleLanguageChange }
				>
					{ LANGUAGES.map( ( lang ) => (
						<option key={ lang.value } value={ lang.value }>
							{ lang.label }
						</option>
					) ) }
				</select>
			</PreferencesModalSection>
		</>
	);
}

export default function EditorPreferencesModal( { extraSections = {} } ) {
	const isActive = useSelect( ( select ) => {
		return select( interfaceStore ).isModalActive( 'editor/preferences' );
	}, [] );
	const { closeModal } = useDispatch( interfaceStore );

	if ( ! isActive ) {
		return null;
	}

	// Please wrap all contents inside PreferencesModalContents to prevent all
	// hooks from executing when the modal is not open.
	return (
		<PreferencesModal closeModal={ closeModal }>
			<PreferencesModalContents extraSections={ extraSections } />
		</PreferencesModal>
	);
}

function PreferencesModalContents( { extraSections = {} } ) {
	const isLargeViewport = useViewportMatch( 'medium' );
	const showBlockBreadcrumbsOption = useSelect(
		( select ) => {
			const { getEditorSettings } = select( editorStore );
			const { get } = select( preferencesStore );
			const isRichEditingEnabled = getEditorSettings().richEditingEnabled;
			const isDistractionFreeEnabled = get( 'core', 'distractionFree' );
			return (
				! isDistractionFreeEnabled &&
				isLargeViewport &&
				isRichEditingEnabled
			);
		},
		[ isLargeViewport ]
	);
	const { setIsListViewOpened, setIsInserterOpened } =
		useDispatch( editorStore );
	const { set: setPreference } = useDispatch( preferencesStore );

	const sections = useMemo(
		() =>
			[
				{
					name: 'general',
					tabLabel: __( 'General' ),
					content: (
						<>
							<PreferencesModalSection
								title={ __( 'Interface' ) }
							>
								<PreferenceToggleControl
									scope="core"
									featureName="showListViewByDefault"
									help={ __(
										'Opens the List View panel by default.'
									) }
									label={ __( 'Always open List View' ) }
								/>
								{ showBlockBreadcrumbsOption && (
									<PreferenceToggleControl
										scope="core"
										featureName="showBlockBreadcrumbs"
										help={ __(
											'Display the block hierarchy trail at the bottom of the editor.'
										) }
										label={ __( 'Show block breadcrumbs' ) }
									/>
								) }
								<PreferenceToggleControl
									scope="core"
									featureName="allowRightClickOverrides"
									help={ __(
										'Allows contextual List View menus via right-click, overriding browser defaults.'
									) }
									label={ __(
										'Allow right-click contextual menus'
									) }
								/>
								<PreferenceToggleControl
									scope="core"
									featureName="enableChoosePatternModal"
									help={ __(
										'Pick from starter content when creating a new page.'
									) }
									label={ __( 'Show starter patterns' ) }
								/>
							</PreferencesModalSection>
							<PreferencesModalSection
								title={ __( 'Document settings' ) }
								description={ __(
									'Select what settings are shown in the document panel.'
								) }
							>
								<EnablePluginDocumentSettingPanelOption.Slot />
								<PostTaxonomies
									taxonomyWrapper={ ( content, taxonomy ) => (
										<EnablePanelOption
											label={ taxonomy.labels.menu_name }
											panelName={ `taxonomy-panel-${ taxonomy.slug }` }
										/>
									) }
								/>
								<PostFeaturedImageCheck>
									<EnablePanelOption
										label={ __( 'Featured image' ) }
										panelName="featured-image"
									/>
								</PostFeaturedImageCheck>
								<PostExcerptCheck>
									<EnablePanelOption
										label={ __( 'Excerpt' ) }
										panelName="post-excerpt"
									/>
								</PostExcerptCheck>
								<PostTypeSupportCheck
									supportKeys={ [ 'comments', 'trackbacks' ] }
								>
									<EnablePanelOption
										label={ __( 'Discussion' ) }
										panelName="discussion-panel"
									/>
								</PostTypeSupportCheck>
								<PageAttributesCheck>
									<EnablePanelOption
										label={ __( 'Page attributes' ) }
										panelName="page-attributes"
									/>
								</PageAttributesCheck>
							</PreferencesModalSection>
							{ isLargeViewport && (
								<PreferencesModalSection
									title={ __( 'Publishing' ) }
								>
									<EnablePublishSidebarOption
										help={ __(
											'Review settings, such as visibility and tags.'
										) }
										label={ __(
											'Enable pre-publish checks'
										) }
									/>
								</PreferencesModalSection>
							) }
							{ extraSections?.general }
						</>
					),
				},
				{
					name: 'appearance',
					tabLabel: __( 'Appearance' ),
					content: (
						<PreferencesModalSection
							title={ __( 'Appearance' ) }
							description={ __(
								'Customize the editor interface to suit your needs.'
							) }
						>
							<PreferenceToggleControl
								scope="core"
								featureName="fixedToolbar"
								onToggle={ () =>
									setPreference(
										'core',
										'distractionFree',
										false
									)
								}
								help={ __(
									'Access all block and document tools in a single place.'
								) }
								label={ __( 'Top toolbar' ) }
							/>
							<PreferenceToggleControl
								scope="core"
								featureName="distractionFree"
								onToggle={ () => {
									setPreference(
										'core',
										'fixedToolbar',
										true
									);
									setIsInserterOpened( false );
									setIsListViewOpened( false );
								} }
								help={ __(
									'Reduce visual distractions by hiding the toolbar and other elements to focus on writing.'
								) }
								label={ __( 'Distraction free' ) }
							/>
							<PreferenceToggleControl
								scope="core"
								featureName="focusMode"
								help={ __(
									'Highlights the current block and fades other content.'
								) }
								label={ __( 'Spotlight mode' ) }
							/>
							{ extraSections?.appearance }
						</PreferencesModalSection>
					),
				},
				{
					name: 'accessibility',
					tabLabel: __( 'Accessibility' ),
					content: (
						<>
							<PreferencesModalSection
								title={ __( 'Navigation' ) }
								description={ __(
									'Optimize the editing experience for enhanced control.'
								) }
							>
								<PreferenceToggleControl
									scope="core"
									featureName="keepCaretInsideBlock"
									help={ __(
										'Keeps the text cursor within blocks while navigating with arrow keys, preventing it from moving to other blocks and enhancing accessibility for keyboard users.'
									) }
									label={ __(
										'Contain text cursor inside block'
									) }
								/>
							</PreferencesModalSection>
							<PreferencesModalSection
								title={ __( 'Interface' ) }
							>
								<PreferenceToggleControl
									scope="core"
									featureName="showIconLabels"
									label={ __( 'Show button text labels' ) }
									help={ __(
										'Show text instead of icons on buttons across the interface.'
									) }
								/>
							</PreferencesModalSection>
						</>
					),
				},
				{
					name: 'blocks',
					tabLabel: __( 'Blocks' ),
					content: (
						<>
							<PreferencesModalSection title={ __( 'Inserter' ) }>
								<PreferenceToggleControl
									scope="core"
									featureName="mostUsedBlocks"
									help={ __(
										'Adds a category with the most frequently used blocks in the inserter.'
									) }
									label={ __( 'Show most used blocks' ) }
								/>
							</PreferencesModalSection>
							<PreferencesModalSection
								title={ __( 'Manage block visibility' ) }
								description={ __(
									"Disable blocks that you don't want to appear in the inserter. They can always be toggled back on later."
								) }
							>
								<BlockVisibility />
							</PreferencesModalSection>
						</>
					),
				},
				{
					name: 'ai',
					tabLabel: __( 'AI' ),
					content: <AIPreferencesContent />,
				},
				window.__experimentalMediaProcessing && {
					name: 'media',
					tabLabel: __( 'Media' ),
					content: (
						<>
							<PreferencesModalSection
								title={ __( 'General' ) }
								description={ __(
									'Customize options related to the media upload flow.'
								) }
							>
								<PreferenceToggleControl
									scope="core/media"
									featureName="optimizeOnUpload"
									help={ __(
										'Compress media items before uploading to the server.'
									) }
									label={ __( 'Pre-upload compression' ) }
								/>
								<PreferenceToggleControl
									scope="core/media"
									featureName="requireApproval"
									help={ __(
										'Require approval step when optimizing existing media.'
									) }
									label={ __( 'Approval step' ) }
								/>
							</PreferencesModalSection>
						</>
					),
				},
			].filter( Boolean ),
		[
			showBlockBreadcrumbsOption,
			extraSections,
			setIsInserterOpened,
			setIsListViewOpened,
			setPreference,
			isLargeViewport,
		]
	);

	return <PreferencesModalTabs sections={ sections } />;
}
