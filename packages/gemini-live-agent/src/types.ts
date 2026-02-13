/**
 * Gemini Live Agent types
 */

/**
 * Gemini Live API configuration
 */
export interface GeminiConfig {
	apiKey: string;
	model?: string;
	systemInstruction?: string;
	responseModality?: 'AUDIO' | 'TEXT';
	voiceName?: string;
	languageCode?: string;
	abilityCategories?: string[];
	serverAbilitiesTimeoutMs?: number;
}

/**
 * Connection state for the Gemini Live session
 */
export type ConnectionState =
	| 'disconnected'
	| 'connecting'
	| 'connected'
	| 'error';

/**
 * Screen capture state
 */
export interface ScreenCaptureState {
	isCapturing: boolean;
	stream: MediaStream | null;
	error: string | null;
}

/**
 * Agent session state
 */
export interface AgentSessionState {
	connectionState: ConnectionState;
	screenCapture: ScreenCaptureState;
	isAudioEnabled: boolean;
	lastError: string | null;
	postId: number | null;
	postType: string | null;
}

/**
 * Gemini Live tool declaration for function calling
 */
export interface GeminiToolDeclaration {
	name: string;
	description: string;
	parameters: {
		type: 'object';
		properties: Record<
			string,
			{
				type: string;
				description: string;
				enum?: string[];
				items?: { type: string };
			}
		>;
		required?: string[];
	};
}

/**
 * Gemini function call from the model
 */
export interface GeminiFunctionCall {
	id: string;
	name: string;
	args: Record< string, unknown >;
}

/**
 * Gemini function response to send back
 */
export interface GeminiFunctionResponse {
	id: string;
	name: string;
	response: {
		output?: unknown;
		error?: string;
	};
}

/**
 * Gemini Live client message types
 */
export interface GeminiSetupMessage {
	setup: {
		model: string;
		generationConfig?: {
			responseModalities: string[];
			speechConfig?: {
				languageCode?: string;
				voiceConfig?: {
					prebuiltVoiceConfig?: {
						voiceName: string;
					};
				};
			};
		};
		/** Enable text transcription of the model's audio output. */
		outputAudioTranscription?: Record< string, never >;
		/** Enable text transcription of the user's audio input. */
		inputAudioTranscription?: Record< string, never >;
		systemInstruction?: {
			parts: Array< { text: string } >;
		};
		tools?: Array< { functionDeclarations: GeminiToolDeclaration[] } >;
	};
}

export interface GeminiBlob {
	mimeType: string;
	data: string; // base64 encoded
}

export interface GeminiRealtimeInputMessage {
	realtimeInput: {
		mediaChunks?: GeminiBlob[];
		audio?: GeminiBlob;
		video?: GeminiBlob;
		text?: string;
	};
}

export interface GeminiClientContentMessage {
	clientContent: {
		turns: Array< {
			role: 'user';
			parts: Array< { text: string } >;
		} >;
		turnComplete: boolean;
	};
}

export interface GeminiToolResponseMessage {
	toolResponse: {
		functionResponses: GeminiFunctionResponse[];
	};
}

export type GeminiClientMessage =
	| GeminiSetupMessage
	| GeminiRealtimeInputMessage
	| GeminiClientContentMessage
	| GeminiToolResponseMessage;

/**
 * Gemini Live server message types
 */
export interface GeminiSetupCompleteMessage {
	setupComplete: object;
}

export interface GeminiServerContentMessage {
	serverContent: {
		modelTurn?: {
			parts: Array< {
				text?: string;
				thought?: boolean;
				functionCall?: GeminiFunctionCall;
				inlineData?: {
					mimeType: string;
					data: string;
				};
			} >;
		};
		/** Text transcription of the model's audio output. */
		outputTranscription?: {
			text: string;
		};
		/** Text transcription of the user's audio input. */
		inputTranscription?: {
			text: string;
		};
		turnComplete?: boolean;
	};
}

export interface GeminiToolCallMessage {
	toolCall: {
		functionCalls: GeminiFunctionCall[];
	};
}

export interface GeminiToolCallCancellationMessage {
	toolCallCancellation: {
		ids: string[];
	};
}

export type GeminiServerMessage =
	| GeminiSetupCompleteMessage
	| GeminiServerContentMessage
	| GeminiToolCallMessage
	| GeminiToolCallCancellationMessage;

/**
 * Block operation types for abilities
 */
export interface InsertBlockInput {
	blockName: string;
	attributes?: Record< string, unknown >;
	innerBlocks?: InsertBlockInput[];
	content?: string;
	position?: 'before' | 'after' | 'first' | 'last';
	targetClientId?: string;
}

export interface UpdateBlockInput {
	clientId: string;
	attributes?: Record< string, unknown >;
	innerBlocks?: InsertBlockInput[];
}

export interface MoveBlocksInput {
	clientIds?: string[];
	clientId?: string;
	position?: 'before' | 'after' | 'first' | 'last';
	targetClientId?: string;
	rootClientId?: string;
}

export interface GetBlockSchemaInput {
	blockName?: string;
	clientId?: string;
}

export interface CreateNoteInput {
	clientId: string;
	content: string;
}

export interface UpdateNoteInput {
	noteId: number;
	content: string;
}

export interface SearchOpenverseInput {
	search: string;
	perPage?: number;
	page?: number;
}

export interface SearchPatternsInput {
	search?: string;
	category?: string;
	limit?: number;
}

export interface InsertPatternInput {
	name: string;
	position?: 'before' | 'after' | 'first' | 'last';
	targetClientId?: string;
	rootClientId?: string;
}

export interface GetPostFieldsOutput {
	postId: number | null;
	postType: string | null;
	title: string;
	slug: string;
	status: string;
	date: string;
	dateGmt: string;
	author: number | null;
	template: string;
	parent: number | null;
	commentStatus: string;
	pingStatus: string;
}

export interface UpdatePostFieldsInput {
	title?: string;
	slug?: string;
	status?: string;
	date?: string;
	dateGmt?: string;
	author?: number;
	template?: string;
	parent?: number;
	commentStatus?: string;
	pingStatus?: string;
	postId?: number;
	postType?: string;
}

export interface ListPostRevisionsInput {
	postId?: number;
	postType?: string;
	perPage?: number;
}

export interface RestorePostRevisionInput {
	revisionId: number;
	postId?: number;
	postType?: string;
}

export interface SearchPostsInput {
	search: string;
	postType?: string;
	postStatus?: string;
	perPage?: number;
}

export interface SearchContentInput {
	search: string;
	postTypes?: string[];
	perPage?: number;
}

export interface CreatePostInput {
	postType?: string;
	title?: string;
	status?: string;
	slug?: string;
	content?: string;
	excerpt?: string;
	template?: string;
	navigate?: boolean;
}

export interface NavigateSiteEditorInput {
	postId?: number;
	postType?: string;
	title?: string;
}

export interface ListPostTemplatesInput {
	search?: string;
	postType?: string;
	perPage?: number;
}

export interface SwitchPostTemplateInput {
	templateTitle?: string;
	templateSlug?: string;
	postType?: string;
}

export interface UpdatePostTitleInput {
	title: string;
	postId?: number;
	postType?: string;
}

export interface UpdatePostMetaInput {
	meta: Record< string, unknown >;
	postId?: number;
	postType?: string;
}

export interface GetGlobalStylesOutput {
	id: number;
	title: string;
	styles: Record< string, unknown >;
	settings?: Record< string, unknown >;
}

export interface UpdateGlobalStylesInput {
	styles?: Record< string, unknown >;
	settings?: Record< string, unknown >;
	title?: string;
}

export interface SearchReplaceDocumentInput {
	search: string;
	replace: string;
	useRegex?: boolean;
	regexFlags?: string;
	limit?: number;
}

export interface ApplyDocumentDiffInput {
	before: string;
	after: string;
}

export interface SavePostInput {}

export interface UpdatePostStatusInput {
	status: string;
}

export interface PublishPostInput {}

export interface ListShortcutsInput {
	categories?: string[];
	names?: string[];
}

export interface RunShortcutInput {
	name: string;
	useAlias?: boolean;
}

export interface UndoInput {
	steps?: number;
}

export interface RedoInput {
	steps?: number;
}

export interface OpenMediaLibraryInput {
	mediaType?: string;
	multiple?: boolean;
}

export interface SearchMediaLibraryInput {
	search?: string;
	mediaType?: string;
	perPage?: number;
}

export interface InsertMediaLibraryImageInput {
	mediaId?: number;
	search?: string;
	mediaType?: 'image' | 'video' | 'audio';
	perPage?: number;
	position?: 'before' | 'after' | 'first' | 'last';
	targetClientId?: string;
	replaceTarget?: boolean;
}

export interface GetDocumentContextOutput {
	postId: number;
	postType: string;
	title: string;
	blocks: Array< Record< string, unknown > >;
	selectedBlockClientId: string | null;
	totalBlocks?: number;
}

/**
 * Event handler types
 */
export type AgentEventHandler = {
	onConnect?: () => void;
	onDisconnect?: () => void;
	onError?: ( error: Error ) => void;
	onModelResponse?: ( text: string ) => void;
	onInputTranscription?: ( text: string ) => void;
	onAudioResponse?: ( audioData: ArrayBuffer ) => void;
	onOutputAudioLevel?: ( level: number ) => void;
	onFunctionCallStart?: ( call: GeminiFunctionCall ) => void;
	onFunctionCallEnd?: ( call: GeminiFunctionCall ) => void;
	onFunctionCall?: ( call: GeminiFunctionCall ) => void;
};
