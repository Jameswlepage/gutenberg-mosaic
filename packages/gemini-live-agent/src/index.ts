/**
 * Gemini Live Agent for WordPress Collaborative Editing
 *
 * This package provides integration between Google's Gemini Live API
 * and the WordPress block editor, enabling AI-powered collaborative
 * editing through screen sharing and voice interaction.
 *
 * @example
 * ```tsx
 * import {
 *   registerAllAgentAbilities,
 *   AIAssistantPanel,
 *   useGeminiAgent,
 * } from '@wordpress/gemini-live-agent';
 *
 * // Register abilities on app init
 * registerAllAgentAbilities();
 *
 * // Use the hook in your component
 * function MyComponent() {
 *   const agent = useGeminiAgent({
 *     apiKey: 'your-api-key',
 *     onModelResponse: (text) => console.log(text),
 *   });
 *
 *   return <button onClick={agent.connect}>Connect</button>;
 * }
 *
 * // Or use the pre-built panel
 * function EditorPanel() {
 *   return <AIAssistantPanel apiKey="your-api-key" />;
 * }
 * ```
 */

// Abilities
export {
	registerAllAgentAbilities,
	registerBlockAbilities,
	registerNoteAbilities,
	registerPatternAbilities,
	AGENT_CATEGORY,
} from './abilities';

// Bridge
export {
	GeminiBridge,
	createGeminiBridge,
	ScreenCapture,
	createScreenCapture,
	AudioCapture,
	createAudioCapture,
} from './bridge';

// Hooks
export { useGeminiAgent, useGeminiAgentPresence } from './hooks';

// Components
export { AIAssistantPanel } from './components';

// Types
export type {
	GeminiConfig,
	ConnectionState,
	ScreenCaptureState,
	AgentSessionState,
	GeminiToolDeclaration,
	GeminiFunctionCall,
	GeminiFunctionResponse,
	InsertBlockInput,
	MoveBlocksInput,
	GetBlockSchemaInput,
	UpdateBlockInput,
	CreateNoteInput,
	UpdateNoteInput,
	SearchOpenverseInput,
	SearchPatternsInput,
	InsertPatternInput,
	GetPostFieldsOutput,
	UpdatePostFieldsInput,
	ListPostRevisionsInput,
	RestorePostRevisionInput,
	SearchPostsInput,
	SearchContentInput,
	UpdatePostTitleInput,
	UpdatePostMetaInput,
	GetGlobalStylesOutput,
	UpdateGlobalStylesInput,
	SearchReplaceDocumentInput,
	ApplyDocumentDiffInput,
	SavePostInput,
	UpdatePostStatusInput,
	PublishPostInput,
	ListShortcutsInput,
	RunShortcutInput,
	OpenMediaLibraryInput,
	SearchMediaLibraryInput,
	GetDocumentContextOutput,
	AgentEventHandler,
} from './types';
