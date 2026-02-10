/**
 * WordPress dependencies
 */
import type { Ability } from '@wordpress/abilities';
import { getAbilities, executeAbility } from '@wordpress/abilities';

/**
 * Internal dependencies
 */
import type {
	GeminiConfig,
	ConnectionState,
	GeminiToolDeclaration,
	GeminiFunctionCall,
	GeminiFunctionResponse,
	GeminiSetupMessage,
	GeminiClientMessage,
	GeminiServerMessage,
	AgentEventHandler,
} from '../types';

/**
 * Default Gemini model for Live API
 */
const DEFAULT_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const DEFAULT_RESPONSE_MODALITY: 'AUDIO' | 'TEXT' = 'AUDIO';
const DEFAULT_SERVER_ABILITIES_TIMEOUT_MS = 1500;
const TOOL_NAME_MAX_LENGTH = 64;

/**
 * Gemini Live API WebSocket endpoint
 */
const GEMINI_LIVE_ENDPOINT =
	'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const SETUP_TIMEOUT_MS = 10000;

/**
 * System instruction for the agent
 */
const DEFAULT_SYSTEM_INSTRUCTION = `You are an AI assistant integrated into the WordPress block editor through the Gutenberg collaborative editing system.

Your role is to help users create and edit content by:
1. Observing what the user is doing on screen (through screen sharing)
2. Listening to their requests and questions
3. Making edits to the document using the available tools

When making edits:
- Use get-document-context first to understand the current state
- Be precise about which blocks to modify using clientIds
- Explain what you're doing briefly
- Create notes to leave feedback or suggestions for the user

Available block types include:
- core/paragraph - For regular text
- core/heading - For headings (use level attribute: 1-6)
- core/image - For images
- core/list - For bullet/numbered lists
- core/quote - For quotations
- core/code - For code snippets
- core/table - For tables

Be helpful, concise, and proactive in suggesting improvements to the content.`;

/**
 * Normalize ability names for Gemini tool names.
 */
function sanitizeToolName( name: string ): string {
	const sanitized = name.replace( /[^a-zA-Z0-9_]/g, '_' );
	if ( sanitized.length === 0 ) {
		return 'tool';
	}
	return /^[A-Za-z_]/.test( sanitized ) ? sanitized : `_${ sanitized }`;
}

function createToolName( abilityName: string, used: Set< string > ): string {
	const base = sanitizeToolName( abilityName );
	let toolName = base.slice( 0, TOOL_NAME_MAX_LENGTH );

	if ( ! used.has( toolName ) ) {
		used.add( toolName );
		return toolName;
	}

	let suffix = 1;
	while ( suffix < 1000 ) {
		const suffixText = `_${ suffix }`;
		const trimmed = toolName
			.slice( 0, TOOL_NAME_MAX_LENGTH - suffixText.length )
			.concat( suffixText );
		if ( ! used.has( trimmed ) ) {
			used.add( trimmed );
			return trimmed;
		}
		suffix++;
	}

	return `${ toolName }_${ Date.now() }`;
}

/**
 * GeminiBridge class manages the WebSocket connection to Gemini Live API
 * and handles function calling integration with WordPress abilities.
 */
export class GeminiBridge {
	private ws: WebSocket | null = null;
	private config: GeminiConfig;
	private connectionState: ConnectionState = 'disconnected';
	private eventHandlers: AgentEventHandler = {};
	private pendingFunctionCalls: Map< string, GeminiFunctionCall > = new Map();
	private audioContext: AudioContext | null = null;
	private audioWorklet: AudioWorkletNode | null = null;
	private audioPlaybackTime = 0;
	private audioSampleRate: number | null = null;
	private toolNameToAbilityName: Map< string, string > = new Map();
	private toolDeclarations: GeminiToolDeclaration[] = [];

	constructor( config: GeminiConfig ) {
		this.config = {
			model: DEFAULT_MODEL,
			systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
			responseModality: DEFAULT_RESPONSE_MODALITY,
			...config,
		};

		if ( ! this.config.model ) {
			this.config.model = DEFAULT_MODEL;
		}
	}

	/**
	 * Set event handlers
	 *
	 * @param handlers Event handler callbacks.
	 */
	public setEventHandlers( handlers: AgentEventHandler ): void {
		this.eventHandlers = { ...this.eventHandlers, ...handlers };
	}

	/**
	 * Get current connection state
	 */
	public getConnectionState(): ConnectionState {
		return this.connectionState;
	}

	/**
	 * Collect abilities for tool declarations.
	 */
	private getToolAbilities(): Ability[] {
		const categories = this.config.abilityCategories;
		if ( ! categories || categories.length === 0 ) {
			return getAbilities();
		}

		const abilitiesByName = new Map< string, Ability >();
		for ( const category of categories ) {
			for ( const ability of getAbilities( { category } ) ) {
				abilitiesByName.set( ability.name, ability );
			}
		}

		return Array.from( abilitiesByName.values() );
	}

	private hasServerAbilities(): boolean {
		return getAbilities().some(
			( ability ) => ability.meta?.annotations?.serverRegistered
		);
	}

	private async waitForServerAbilities(): Promise< void > {
		const timeoutMs =
			this.config.serverAbilitiesTimeoutMs ??
			DEFAULT_SERVER_ABILITIES_TIMEOUT_MS;

		if ( timeoutMs <= 0 || this.hasServerAbilities() ) {
			return;
		}

		const start = Date.now();
		while ( Date.now() - start < timeoutMs ) {
			if ( this.hasServerAbilities() ) {
				return;
			}

			await new Promise( ( resolve ) => setTimeout( resolve, 50 ) );
		}
	}

	private buildToolDeclarations( abilities: Ability[] ): GeminiToolDeclaration[] {
		const usedNames = new Set< string >();
		this.toolNameToAbilityName = new Map();

		return abilities.map( ( ability ) => {
			const inputSchema = ability.input_schema || {
				type: 'object',
				properties: {},
			};

			// Convert JSON Schema to Gemini format
			const properties: GeminiToolDeclaration[ 'parameters' ][ 'properties' ] =
				{};

			if ( inputSchema.properties ) {
				for ( const [ key, schema ] of Object.entries(
					inputSchema.properties
				) ) {
					const prop = schema as Record< string, unknown >;
					properties[ key ] = {
						type: ( prop.type as string ) || 'string',
						description: ( prop.description as string ) || key,
					};

					if ( prop.enum ) {
						properties[ key ].enum = prop.enum as string[];
					}

					if ( prop.items ) {
						properties[ key ].items = prop.items as { type: string };
					}
				}
			}

			const toolName = createToolName( ability.name, usedNames );
			this.toolNameToAbilityName.set( toolName, ability.name );

			return {
				name: toolName,
				description: ability.description || ability.label || ability.name,
				parameters: {
					type: 'object',
					properties,
					required: ( inputSchema.required as string[] ) || [],
				},
			};
		} );
	}

	/**
	 * Connect to Gemini Live API
	 */
	public async connect(): Promise< void > {
		if ( this.ws ) {
			this.disconnect();
		}

		if ( ! this.config.apiKey?.trim() ) {
			this.connectionState = 'error';
			const error = new Error( 'Missing Gemini API key.' );
			this.eventHandlers.onError?.( error );
			throw error;
		}

		this.connectionState = 'connecting';
		await this.waitForServerAbilities();
		this.toolDeclarations = this.buildToolDeclarations(
			this.getToolAbilities()
		);

		const url = `${ GEMINI_LIVE_ENDPOINT }?key=${ this.config.apiKey }`;

		return new Promise( ( resolve, reject ) => {
			let settled = false;
			let setupTimeout: ReturnType< typeof setTimeout > | null = null;

			const finish = ( error?: Error ) => {
				if ( settled ) {
					return;
				}
				settled = true;
				if ( setupTimeout ) {
					clearTimeout( setupTimeout );
					setupTimeout = null;
				}
				if ( error ) {
					this.connectionState = 'error';
					this.eventHandlers.onError?.( error );
					reject( error );
					return;
				}
				resolve();
			};

			try {
				this.ws = new WebSocket( url );
			} catch ( error ) {
				const err =
					error instanceof Error
						? error
						: new Error( 'Failed to create WebSocket connection.' );
				finish( err );
				return;
			}

			this.ws.onopen = () => {
				setupTimeout = setTimeout( () => {
					finish(
						new Error(
							'Timed out waiting for Gemini setup response.'
						)
					);
					this.disconnect();
				}, SETUP_TIMEOUT_MS );
				this.sendSetupMessage();
			};

			this.ws.onmessage = async ( event ) => {
				let payload: string;
				const data = event.data;

				if ( typeof data === 'string' ) {
					payload = data;
				} else if ( data && typeof data.text === 'function' ) {
					payload = await data.text();
				} else if ( data && typeof data.arrayBuffer === 'function' ) {
					const buffer = await data.arrayBuffer();
					payload = new TextDecoder().decode( buffer );
				} else if ( data instanceof ArrayBuffer ) {
					payload = new TextDecoder().decode( data );
				} else if ( ArrayBuffer.isView( data ) ) {
					payload = new TextDecoder().decode( data.buffer );
				} else {
					payload = JSON.stringify( data );
				}

				this.handleMessage( payload );

				// Resolve on setup complete
				if ( this.connectionState === 'connected' ) {
					finish();
				}
			};

			this.ws.onerror = ( error ) => {
				finish( new Error( 'WebSocket connection error.' ) );
			};

			this.ws.onclose = ( event ) => {
				if ( ! settled && this.connectionState !== 'connected' ) {
					const reason =
						event.reason ||
						( event.code
							? `WebSocket closed with code ${ event.code }`
							: 'WebSocket closed before setup completed.' );
					finish( new Error( reason ) );
					return;
				}
				this.connectionState = 'disconnected';
				this.eventHandlers.onDisconnect?.();
			};
		} );
	}

	/**
	 * Disconnect from Gemini Live API
	 */
	public disconnect(): void {
		if ( this.ws ) {
			this.ws.close();
			this.ws = null;
		}

		if ( this.audioContext ) {
			this.audioContext.close();
			this.audioContext = null;
			this.audioPlaybackTime = 0;
			this.audioSampleRate = null;
		}

		this.connectionState = 'disconnected';
	}

	/**
	 * Send the initial setup message with tools configuration
	 */
	private sendSetupMessage(): void {
		const toolDeclarations = this.toolDeclarations;
		const responseModality =
			this.config.responseModality || DEFAULT_RESPONSE_MODALITY;
		const generationConfig: NonNullable<
			GeminiSetupMessage[ 'setup' ][ 'generationConfig' ]
		> = {
			responseModalities: [ responseModality ],
		};

		if ( responseModality === 'AUDIO' ) {
			const voiceName = this.config.voiceName || 'Aoede';
			generationConfig.speechConfig = {
				voiceConfig: {
					prebuiltVoiceConfig: {
						voiceName,
					},
				},
			};
		}

		const setupMessage: GeminiClientMessage = {
			setup: {
				model: `models/${ this.config.model }`,
				generationConfig,
				systemInstruction: {
					parts: [
						{
							text:
								this.config.systemInstruction ||
								DEFAULT_SYSTEM_INSTRUCTION,
						},
					],
				},
				tools: toolDeclarations.length
					? [
							{
								functionDeclarations: toolDeclarations,
							},
					  ]
					: undefined,
			},
		};

		this.send( setupMessage );
	}

	/**
	 * Send a message to the WebSocket
	 *
	 * @param message The message to send.
	 */
	private send( message: GeminiClientMessage ): void {
		if ( this.ws && this.ws.readyState === WebSocket.OPEN ) {
			this.ws.send( JSON.stringify( message ) );
		}
	}

	/**
	 * Handle incoming messages from Gemini
	 *
	 * @param data The raw message data.
	 */
	private async handleMessage( data: string ): Promise< void > {
		try {
			const message = JSON.parse( data ) as GeminiServerMessage & {
				error?: { message?: string };
				goAway?: { reason?: string };
			};

			if ( message.error ) {
				this.connectionState = 'error';
				const errorMessage =
					message.error.message || 'Gemini API error.';
				this.eventHandlers.onError?.( new Error( errorMessage ) );
				this.disconnect();
				return;
			}

			if ( message.goAway ) {
				this.connectionState = 'error';
				const errorMessage =
					message.goAway.reason ||
					'Gemini server requested disconnect.';
				this.eventHandlers.onError?.( new Error( errorMessage ) );
				this.disconnect();
				return;
			}

			if ( 'setupComplete' in message ) {
				this.connectionState = 'connected';
				this.eventHandlers.onConnect?.();
				return;
			}

			if ( 'serverContent' in message ) {
				await this.handleServerContent( message );
				return;
			}

			if ( 'toolCall' in message ) {
				await this.handleToolCall( message );
				return;
			}

			if ( 'toolCallCancellation' in message ) {
				this.handleToolCallCancellation( message );
			}
		} catch ( error ) {
			// eslint-disable-next-line no-console
			console.error( 'Failed to parse Gemini message:', error );
		}
	}

	/**
	 * Handle server content (text/audio responses)
	 *
	 * @param message The server message.
	 */
	private async handleServerContent(
		message: GeminiServerMessage
	): Promise< void > {
		if ( ! ( 'serverContent' in message ) ) {
			return;
		}

		const content = message.serverContent;

		if ( content.modelTurn?.parts ) {
			const functionResponses: GeminiFunctionResponse[] = [];

			for ( const part of content.modelTurn.parts ) {
				// Handle text response
				if ( part.text ) {
					this.eventHandlers.onModelResponse?.( part.text );
				}

				// Handle audio response
				if ( part.inlineData?.mimeType.startsWith( 'audio/' ) ) {
					const audioData = this.base64ToArrayBuffer(
						part.inlineData.data
					);
					this.eventHandlers.onAudioResponse?.( audioData );
					await this.playAudio( audioData, part.inlineData?.mimeType );
				}

				// Handle function calls in content
				if ( part.functionCall ) {
					const response = await this.executeFunctionCall(
						part.functionCall
					);
					functionResponses.push( response );
				}
			}

			if ( functionResponses.length > 0 ) {
				this.sendToolResponse( functionResponses );
			}
		}
	}

	/**
	 * Handle tool call messages
	 *
	 * @param message The server message.
	 */
	private async handleToolCall(
		message: GeminiServerMessage
	): Promise< void > {
		if ( ! ( 'toolCall' in message ) ) {
			return;
		}

		const functionCalls = message.toolCall.functionCalls;
		const responses: GeminiFunctionResponse[] = [];

		for ( const call of functionCalls ) {
			this.eventHandlers.onFunctionCall?.( call );
			const response = await this.executeFunctionCall( call );
			responses.push( response );
		}

		// Send all responses back
		this.sendToolResponse( responses );
	}

	/**
	 * Handle tool call cancellation
	 *
	 * @param message The server message.
	 */
	private handleToolCallCancellation( message: GeminiServerMessage ): void {
		if ( ! ( 'toolCallCancellation' in message ) ) {
			return;
		}

		for ( const id of message.toolCallCancellation.ids ) {
			this.pendingFunctionCalls.delete( id );
		}
	}

	/**
	 * Execute a function call using WordPress abilities
	 *
	 * @param call The function call to execute.
	 */
	private async executeFunctionCall(
		call: GeminiFunctionCall
	): Promise< GeminiFunctionResponse > {
		const abilityName = this.toolNameToAbilityName.get( call.name );

		if ( ! abilityName ) {
			return {
				id: call.id,
				name: call.name,
				response: {
					error: `Unknown tool: ${ call.name }`,
				},
			};
		}

		try {
			const result = await executeAbility( abilityName, call.args );

			return {
				id: call.id,
				name: call.name,
				response: {
					output: result,
				},
			};
		} catch ( error ) {
			return {
				id: call.id,
				name: call.name,
				response: {
					error:
						error instanceof Error
							? error.message
							: 'Unknown error executing ability',
				},
			};
		}
	}

	/**
	 * Send tool response back to Gemini
	 *
	 * @param responses The function responses to send.
	 */
	private sendToolResponse( responses: GeminiFunctionResponse[] ): void {
		const message: GeminiClientMessage = {
			toolResponse: {
				functionResponses: responses,
			},
		};

		this.send( message );
	}

	/**
	 * Send a video frame from screen capture
	 *
	 * @param imageData The image data as base64 or data URL.
	 * @param mimeType  The MIME type of the image.
	 */
	public sendVideoFrame(
		imageData: string,
		mimeType: string = 'image/jpeg'
	): void {
		if ( this.connectionState !== 'connected' ) {
			return;
		}

		// Remove data URL prefix if present
		const base64Data = imageData.replace( /^data:image\/\w+;base64,/, '' );

		const message: GeminiClientMessage = {
			realtimeInput: {
				video: {
					mimeType,
					data: base64Data,
				},
			},
		};

		this.send( message );
	}

	/**
	 * Send audio data from microphone
	 *
	 * @param audioData The audio data as ArrayBuffer.
	 */
	public sendAudioChunk( audioData: ArrayBuffer ): void {
		if ( this.connectionState !== 'connected' ) {
			return;
		}

		const base64Data = this.arrayBufferToBase64( audioData );

		const message: GeminiClientMessage = {
			realtimeInput: {
				audio: {
					mimeType: 'audio/pcm;rate=16000',
					data: base64Data,
				},
			},
		};

		this.send( message );
	}

	/**
	 * Send a text message from the user
	 *
	 * @param text The text message to send.
	 */
	public sendTextMessage( text: string ): void {
		if ( this.connectionState !== 'connected' ) {
			return;
		}

		const message: GeminiClientMessage = {
			clientContent: {
				turns: [
					{
						role: 'user',
						parts: [ { text } ],
					},
				],
				turnComplete: true,
			},
		};

		this.send( message );
	}

	/**
	 * Play audio response
	 *
	 * @param audioData The audio data to play.
	 */
	private getAudioSampleRate( mimeType?: string ): number {
		if ( ! mimeType ) {
			return 24000;
		}

		const match = mimeType.match( /rate=(\d+)/i );
		if ( match ) {
			const rate = Number( match[ 1 ] );
			if ( Number.isFinite( rate ) && rate > 0 ) {
				return rate;
			}
		}

		return 24000;
	}

	private async playAudio(
		audioData: ArrayBuffer,
		mimeType?: string
	): Promise< void > {
		try {
			const sampleRate = this.getAudioSampleRate( mimeType );
			if ( ! this.audioContext || this.audioSampleRate !== sampleRate ) {
				if ( this.audioContext ) {
					this.audioContext.close();
				}
				this.audioContext = new AudioContext( { sampleRate } );
				this.audioSampleRate = sampleRate;
				this.audioPlaybackTime = this.audioContext.currentTime;
			}

			if ( this.audioContext.state === 'suspended' ) {
				await this.audioContext.resume();
			}

			const pcmData = new Int16Array( audioData );
			const audioBuffer = this.audioContext.createBuffer(
				1,
				pcmData.length,
				sampleRate
			);
			const channelData = audioBuffer.getChannelData( 0 );

			for ( let i = 0; i < pcmData.length; i++ ) {
				channelData[ i ] = pcmData[ i ] / 32768;
			}

			const source = this.audioContext.createBufferSource();
			source.buffer = audioBuffer;
			source.connect( this.audioContext.destination );
			const now = this.audioContext.currentTime;
			if ( this.audioPlaybackTime < now ) {
				this.audioPlaybackTime = now;
			}
			source.start( this.audioPlaybackTime );
			this.audioPlaybackTime += audioBuffer.duration;
		} catch ( error ) {
			// eslint-disable-next-line no-console
			console.error( 'Failed to play audio:', error );
		}
	}

	/**
	 * Convert base64 to ArrayBuffer
	 *
	 * @param base64 The base64 string to convert.
	 */
	private base64ToArrayBuffer( base64: string ): ArrayBuffer {
		const binaryString = atob( base64 );
		const bytes = new Uint8Array( binaryString.length );
		for ( let i = 0; i < binaryString.length; i++ ) {
			bytes[ i ] = binaryString.charCodeAt( i );
		}
		return bytes.buffer;
	}

	/**
	 * Convert ArrayBuffer to base64
	 *
	 * @param buffer The ArrayBuffer to convert.
	 */
	private arrayBufferToBase64( buffer: ArrayBuffer ): string {
		const bytes = new Uint8Array( buffer );
		let binary = '';
		for ( let i = 0; i < bytes.byteLength; i++ ) {
			binary += String.fromCharCode( bytes[ i ] );
		}
		return btoa( binary );
	}
}

/**
 * Create a new GeminiBridge instance
 *
 * @param config The Gemini configuration.
 */
export function createGeminiBridge( config: GeminiConfig ): GeminiBridge {
	return new GeminiBridge( config );
}
