/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	useState,
	useCallback,
	useRef,
	useEffect,
	useMemo,
	memo,
} from '@wordpress/element';
import { Button, Notice } from '@wordpress/components';
import { useSelect, useDispatch } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { useGeminiAgent } from '../hooks/use-gemini-agent';
import { ShimmeringText } from './shimmering-text';
import { store as geminiAgentStore } from '../store';
import type { GeminiFunctionCall } from '../types';
import type { ConversationMessage } from '../store/types';
import './ai-assistant-panel.scss';

/* ── Tool call nice names ── */

const TOOL_NICE_NAMES: Record< string, string > = {
	agent_insert_block: 'Insert Block',
	agent_update_block: 'Update Block',
	agent_remove_block: 'Remove Block',
	agent_move_blocks: 'Move Blocks',
	agent_get_document_context: 'Read Document',
	agent_find_blocks: 'Find Blocks',
	agent_get_block: 'Inspect Block',
	agent_get_block_schema: 'Get Block Schema',
	agent_select_block: 'Select Block',
	agent_update_post_title: 'Update Title',
	agent_update_post_meta: 'Update Meta',
	agent_get_post_fields: 'Get Post Fields',
	agent_update_post_fields: 'Update Post Fields',
	agent_create_post: 'Create Content',
	agent_navigate_site_editor: 'Navigate Editor',
	agent_list_post_revisions: 'List Revisions',
	agent_restore_post_revision: 'Restore Revision',
	agent_save_post: 'Save Post',
	agent_update_post_status: 'Update Status',
	agent_publish_post: 'Publish Post',
	agent_search_replace_document: 'Search & Replace',
	agent_apply_document_diff: 'Apply Changes',
	agent_get_global_styles: 'Get Styles',
	agent_update_global_styles: 'Update Styles',
	agent_search_openverse: 'Search Images',
	agent_search_posts: 'Search Posts',
	agent_search_content: 'Search Content',
	agent_search_web: 'Search Web',
	agent_create_note: 'Create Note',
	agent_reply_to_note: 'Reply to Note',
	agent_update_note: 'Update Note',
	agent_resolve_note: 'Resolve Note',
	agent_get_notes: 'Get Notes',
	agent_list_shortcuts: 'List Shortcuts',
	agent_run_shortcut: 'Run Shortcut',
	agent_open_media_library: 'Open Media',
	agent_search_media_library: 'Search Media',
	agent_insert_media_library_image: 'Insert Library Image',
	agent_search_patterns: 'Search Patterns',
	agent_edit_image: 'Edit Image',
	agent_insert_pattern: 'Insert Pattern',
	agent_list_post_templates: 'List Templates',
	agent_switch_post_template: 'Switch Template',
	agent_undo: 'Undo',
	agent_redo: 'Redo',
	agent_get_user: 'Get User',
	agent_search_users: 'Search Users',
	agent_get_current_user: 'Get Current User',
};

type MarkdownSegment = {
	kind: 'text' | 'strong' | 'em' | 'code';
	text: string;
};

const messageVisibleTextLengthById = new Map< number, number >();

function parseInlineMarkdown( text: string ): MarkdownSegment[] {
	if ( ! text ) {
		return [];
	}

	const segments: MarkdownSegment[] = [];

	const appendPlainText = ( value: string ) => {
		if ( ! value ) {
			return;
		}
		const last = segments[ segments.length - 1 ];
		if ( last?.kind === 'text' ) {
			last.text += value;
			return;
		}
		segments.push( { kind: 'text', text: value } );
	};

	let cursor = 0;

	while ( cursor < text.length ) {
		const doubleMarker = text.slice( cursor, cursor + 2 );
		const isStrongMarker =
			doubleMarker === '**' || doubleMarker === '__';

		if ( isStrongMarker ) {
			const end = text.indexOf( doubleMarker, cursor + 2 );
			if ( end > cursor + 2 ) {
				segments.push( {
					kind: 'strong',
					text: text.slice( cursor + 2, end ),
				} );
				cursor = end + 2;
				continue;
			}
		}

		const current = text[ cursor ];

		if ( current === '`' ) {
			const end = text.indexOf( '`', cursor + 1 );
			if ( end > cursor + 1 ) {
				segments.push( {
					kind: 'code',
					text: text.slice( cursor + 1, end ),
				} );
				cursor = end + 1;
				continue;
			}
		}

		if (
			( current === '*' && text[ cursor + 1 ] !== '*' ) ||
			( current === '_' && text[ cursor + 1 ] !== '_' )
		) {
			const end = text.indexOf( current, cursor + 1 );
			if ( end > cursor + 1 ) {
				segments.push( {
					kind: 'em',
					text: text.slice( cursor + 1, end ),
				} );
				cursor = end + 1;
				continue;
			}
		}

		let plainEnd = cursor + 1;
		while ( plainEnd < text.length ) {
			const twoChars = text.slice( plainEnd, plainEnd + 2 );
			const oneChar = text[ plainEnd ];
			const mayStartMarkdownMarker =
				twoChars === '**' ||
				twoChars === '__' ||
				oneChar === '`' ||
				oneChar === '*' ||
				oneChar === '_';
			if ( mayStartMarkdownMarker ) {
				break;
			}
			plainEnd++;
		}

		appendPlainText( text.slice( cursor, plainEnd ) );
		cursor = plainEnd;
	}

	return segments;
}

function getToolNiceName( toolName: string ): string {
	return TOOL_NICE_NAMES[ toolName ] || toolName.replace( /^agent_/, '' ).replace( /_/g, ' ' );
}

function appendTranscriptChunk( existingText: string, chunk: string ): string {
	if ( ! chunk ) {
		return existingText;
	}

	return `${ existingText }${ chunk }`;
}

/* ── Sub-components ── */

/**
 * Single character with blur-to-clear reveal animation.
 * Already-visible characters render instantly (delay = 0).
 */
const TranscriptCharacter = memo(
	( { char, delay }: { char: string; delay: number } ) => (
		<span
			className="gemini-transcript-char"
			style={ {
				animationDelay: `${ delay }s`,
				willChange: delay > 0 ? 'filter, opacity' : 'auto',
			} }
		>
			{ char }
		</span>
	)
);

/**
 * Layered gradient aura — multiple radial-gradient divs with blur
 * and slow pulse/drift animations for a subtle ambient effect.
 */
const BackgroundAura = memo(
	( {
		isActive,
		isStreaming,
	}: {
		isActive: boolean;
		isStreaming: boolean;
	} ) => (
		<div
			className={ `gemini-aura${
				isActive ? ' is-active' : ''
			}${ isStreaming ? ' is-streaming' : '' }` }
		>
			<div className="gemini-aura__pool" />
			<div className="gemini-aura__pulse" />
			<div className="gemini-aura__left" />
			<div className="gemini-aura__left-rise" />
			<div className="gemini-aura__right" />
			<div className="gemini-aura__right-rise" />
			<div className="gemini-aura__shimmer" />
		</div>
	)
);

/**
 * A single message bubble with per-character blur-to-clear reveal.
 * Only newly appended characters get the staggered animation.
 */
const MessageBubble = memo(
	( {
		message,
		isStreaming,
		isToolCallInProgress,
	}: {
		message: ConversationMessage;
		isStreaming: boolean;
		isToolCallInProgress: boolean;
	} ) => {
		const markdownSegments = useMemo(
			() => parseInlineMarkdown( message.text ),
			[ message.text ]
		);
		const visibleCharacterCount = useMemo(
			() =>
				markdownSegments.reduce(
					( total, segment ) => total + segment.text.length,
					0
				),
			[ markdownSegments ]
		);
		const knownCharacterCount =
			messageVisibleTextLengthById.get( message.id );
		const previousCharacterCount =
			knownCharacterCount !== undefined
				? Math.min( knownCharacterCount, visibleCharacterCount )
				: isStreaming
				? 0
				: visibleCharacterCount;

		useEffect( () => {
			messageVisibleTextLengthById.set(
				message.id,
				visibleCharacterCount
			);
		}, [ message.id, visibleCharacterCount ] );

		const renderedMessageText = useMemo( () => {
			let characterOffset = 0;

			return markdownSegments.map( ( segment, segmentIndex ) => {
				const characters = segment.text.split( '' );
				const animatedCharacters = characters.map(
					( char, characterIndex ) => {
						const absoluteIndex =
							characterOffset + characterIndex;
						const delay =
							absoluteIndex >= previousCharacterCount
								? ( absoluteIndex -
										previousCharacterCount +
										1 ) *
								  0.02
								: 0;

						return (
							<TranscriptCharacter
								key={ `${ segmentIndex }-${ characterIndex }` }
								char={ char }
								delay={ delay }
							/>
						);
					}
				);

				characterOffset += characters.length;

				if ( segment.kind === 'strong' ) {
					return (
						<strong key={ `segment-${ segmentIndex }` }>
							{ animatedCharacters }
						</strong>
					);
				}

				if ( segment.kind === 'em' ) {
					return (
						<em key={ `segment-${ segmentIndex }` }>
							{ animatedCharacters }
						</em>
					);
				}

				if ( segment.kind === 'code' ) {
					return (
						<code key={ `segment-${ segmentIndex }` }>
							{ animatedCharacters }
						</code>
					);
				}

				return (
					<span key={ `segment-${ segmentIndex }` }>
						{ animatedCharacters }
					</span>
				);
			} );
		}, [ markdownSegments, previousCharacterCount ] );

		const isUser = message.role === 'user';

		return (
			<div
				className={ `gemini-message${
					isUser ? ' is-user' : ' is-assistant'
				}${ isStreaming ? ' is-streaming' : '' }` }
			>
				<div className="gemini-message__label">
					{ isUser ? __( 'You' ) : __( 'AI' ) }
				</div>
				{ message.toolCalls &&
					message.toolCalls.length > 0 &&
					message.toolCalls.map( ( name, i ) => {
						const isInProgress =
							isToolCallInProgress &&
							i === message.toolCalls!.length - 1;
							return (
								<span
									key={ i }
									className={ `gemini-message__tool-call${
										isInProgress ? ' is-in-progress' : ''
									}` }
								>
									<svg
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
									</svg>
									<span className="gemini-message__tool-call-text">
										{ getToolNiceName( name ) }
									</span>
								</span>
							);
						} ) }
				{ visibleCharacterCount > 0 && (
					<div className="gemini-message__text">
						{ renderedMessageText }
					</div>
				) }
			</div>
		);
	}
);

/**
 * Scrollable conversation transcript with auto-scroll to bottom.
 */
const ConversationTranscript = memo(
	( {
		messages,
		streamingRole,
		pendingToolCallMessageIds,
	}: {
		messages: ConversationMessage[];
		streamingRole: 'user' | 'assistant' | null;
		pendingToolCallMessageIds: number[];
	} ) => {
		const scrollRef = useRef< HTMLDivElement | null >( null );

		useEffect( () => {
			const el = scrollRef.current;
			if ( ! el ) {
				return;
			}
			const timer = setTimeout( () => {
				el.scrollTop = el.scrollHeight;
			}, 60 );
			return () => clearTimeout( timer );
		}, [ messages ] );

			return (
				<div className="gemini-transcript" ref={ scrollRef }>
					<div className="gemini-transcript__messages">
						{ messages.map( ( msg ) => (
							<MessageBubble
								key={ msg.id }
								message={ msg }
								isToolCallInProgress={ pendingToolCallMessageIds.includes(
									msg.id
								) }
								isStreaming={
									streamingRole === msg.role &&
									msg ===
										messages
											.filter(
												( m ) => m.role === msg.role
											)
											.at( -1 )
								}
							/>
						) ) }
					</div>
				</div>
		);
	}
);

/* ── Props ── */

interface AIAssistantPanelProps {
	apiKey: string;
	model?: string;
	systemInstruction?: string;
	responseModality?: 'AUDIO' | 'TEXT';
	defaultVoiceName?: string;
	defaultLanguageCode?: string;
	abilityCategories?: string[];
	serverAbilitiesTimeoutMs?: number;
	onClose?: () => void;
}

/* ── Main component ── */

let nextMessageId = 1;

/**
 * AI Assistant Panel.
 *
 * Idle — centred "Start" button.
 * Connected — scrollable conversation history with blur-reveal
 *   messages from both user and AI, bottom "End" control.
 */
export function AIAssistantPanel( {
	apiKey,
	model,
	systemInstruction,
	responseModality,
	defaultVoiceName,
	defaultLanguageCode,
	abilityCategories,
	serverAbilitiesTimeoutMs,
}: AIAssistantPanelProps ) {
	const [ voicePreset ] = useState( defaultVoiceName || 'Aoede' );
	const [ languageCode ] = useState( defaultLanguageCode || '' );

	// Conversation from store (persists across tab switches)
	const messages = useSelect(
		( select ) =>
			select( geminiAgentStore ).getConversationMessages(),
		[]
	);
	const {
		addConversationMessage,
		updateConversationMessage,
		clearConversation,
	} = useDispatch( geminiAgentStore );

	const [ isUserSpeaking, setIsUserSpeaking ] = useState( false );
	const userSpeakingTimerRef =
		useRef< ReturnType< typeof setTimeout > | null >( null );

	// Track current streaming message IDs
	const currentAiMessageIdRef = useRef< number | null >( null );
	const currentUserMessageIdRef = useRef< number | null >( null );
	const aiTextBufferRef = useRef( '' );
	const userTextBufferRef = useRef( '' );
	const textSinceLastToolCallRef = useRef( false );
	const currentToolCallsRef = useRef< string[] >( [] );
	const [ pendingToolCallMessageIds, setPendingToolCallMessageIds ] =
		useState< number[] >( [] );
	const toolCallIdToMessageIdRef = useRef< Map< string, number > >(
		new Map()
	);
	const pendingToolCallsByMessageIdRef = useRef< Map< number, number > >(
		new Map()
	);

	const effectiveResponseModality = responseModality || 'AUDIO';

	// Whether the model is currently streaming a response
	const [ isAiSpeaking, setIsAiSpeaking ] = useState( false );
	const aiSpeakingTimerRef =
		useRef< ReturnType< typeof setTimeout > | null >( null );

	// Streaming role for animation
	const streamingRole = isAiSpeaking ? 'assistant' : null;

	const syncPendingToolCallMessageIds = useCallback( () => {
		const ids = Array.from(
			pendingToolCallsByMessageIdRef.current.entries()
		)
			.filter( ( [ , count ] ) => count > 0 )
			.map( ( [ messageId ] ) => messageId );
		setPendingToolCallMessageIds( ids );
	}, [] );

	const clearPendingToolCalls = useCallback( () => {
		toolCallIdToMessageIdRef.current.clear();
		pendingToolCallsByMessageIdRef.current.clear();
		setPendingToolCallMessageIds( [] );
	}, [] );

	const markToolCallStart = useCallback(
		( callId: string, messageId: number ) => {
			toolCallIdToMessageIdRef.current.set( callId, messageId );
			const currentCount =
				pendingToolCallsByMessageIdRef.current.get( messageId ) || 0;
			pendingToolCallsByMessageIdRef.current.set(
				messageId,
				currentCount + 1
			);
			syncPendingToolCallMessageIds();
		},
		[ syncPendingToolCallMessageIds ]
	);

	const markToolCallEnd = useCallback(
		( callId: string ) => {
			const messageId = toolCallIdToMessageIdRef.current.get( callId );
			if ( messageId === undefined ) {
				return;
			}

			const currentCount =
				pendingToolCallsByMessageIdRef.current.get( messageId ) || 0;
			if ( currentCount <= 1 ) {
				pendingToolCallsByMessageIdRef.current.delete( messageId );
			} else {
				pendingToolCallsByMessageIdRef.current.set(
					messageId,
					currentCount - 1
				);
			}

			toolCallIdToMessageIdRef.current.delete( callId );
			syncPendingToolCallMessageIds();
		},
		[ syncPendingToolCallMessageIds ]
	);

	const handleModelResponse = useCallback(
		( text: string ) => {
			aiTextBufferRef.current += text;
			textSinceLastToolCallRef.current = true;
			setIsAiSpeaking( true );

			if ( aiSpeakingTimerRef.current ) {
				clearTimeout( aiSpeakingTimerRef.current );
			}
			aiSpeakingTimerRef.current = setTimeout( () => {
				setIsAiSpeaking( false );
			}, 2000 );

			const currentId = currentAiMessageIdRef.current;
			const updatedText = aiTextBufferRef.current;

			if ( currentId !== null ) {
				updateConversationMessage( currentId, {
					text: updatedText,
				} );
			} else {
				const id = nextMessageId++;
				currentAiMessageIdRef.current = id;
				addConversationMessage( {
					id,
					role: 'assistant',
					text: updatedText,
				} );
			}
		},
		[ addConversationMessage, updateConversationMessage ]
	);

	const handleInputTranscription = useCallback(
		( text: string ) => {
			if ( ! text ) {
				return;
			}

			// Finalize any pending AI message when user starts speaking
			if ( currentAiMessageIdRef.current !== null ) {
				currentAiMessageIdRef.current = null;
				aiTextBufferRef.current = '';
				textSinceLastToolCallRef.current = false;
				currentToolCallsRef.current = [];
			}

			let currentId = currentUserMessageIdRef.current;

			// If we previously finalized a user message due a short pause, keep
			// appending to the last user message until AI actually responds.
			if ( currentId === null ) {
				const lastMessage = messages.at( -1 );
				if ( lastMessage?.role === 'user' ) {
					currentId = lastMessage.id;
					currentUserMessageIdRef.current = currentId;
					userTextBufferRef.current = lastMessage.text || '';
				}
			}

			const updatedText = appendTranscriptChunk(
				userTextBufferRef.current,
				text
			);
			userTextBufferRef.current = updatedText;

			if ( currentId !== null ) {
				updateConversationMessage( currentId, {
					text: updatedText,
				} );
			} else {
				const id = nextMessageId++;
				currentUserMessageIdRef.current = id;
				addConversationMessage( {
					id,
					role: 'user',
					text: updatedText,
				} );
			}
		},
		[ addConversationMessage, messages, updateConversationMessage ]
	);

	const handleFunctionCall = useCallback(
		( call: GeminiFunctionCall ) => {
			let currentId = currentAiMessageIdRef.current;

			if ( currentId !== null ) {
				if ( textSinceLastToolCallRef.current ) {
					// Text streamed since last tool call — append new entry
					currentToolCallsRef.current = [
						...currentToolCallsRef.current,
						call.name,
					];
				} else {
					// No text since last call — replace the last entry
					const calls = [ ...currentToolCallsRef.current ];
					if ( calls.length > 0 ) {
						calls[ calls.length - 1 ] = call.name;
					} else {
						calls.push( call.name );
					}
					currentToolCallsRef.current = calls;
				}
				updateConversationMessage( currentId, {
					toolCalls: [ ...currentToolCallsRef.current ],
				} );
			} else {
				// No AI message yet — create one for the tool call
				const id = nextMessageId++;
				currentAiMessageIdRef.current = id;
				currentId = id;
				aiTextBufferRef.current = '';
				currentToolCallsRef.current = [ call.name ];
				addConversationMessage( {
					id,
					role: 'assistant',
					text: '',
					toolCalls: [ call.name ],
				} );
			}

			if ( currentId !== null ) {
				markToolCallStart( call.id, currentId );
			}
			textSinceLastToolCallRef.current = false;
		},
		[
			addConversationMessage,
			markToolCallStart,
			updateConversationMessage,
		]
	);

	const {
		connectionState,
		error,
		audioLevelRef,
		isAudioEnabled,
		connect,
		disconnect,
		startScreenShare,
		startAudio,
		stopAudio,
	} = useGeminiAgent( {
		apiKey,
		model,
		systemInstruction,
		responseModality: effectiveResponseModality,
		voiceName: voicePreset,
		languageCode,
		abilityCategories,
		serverAbilitiesTimeoutMs,
		onModelResponse: handleModelResponse,
		onInputTranscription: handleInputTranscription,
		onFunctionCall: handleFunctionCall,
		onFunctionCallEnd: ( call ) => {
			markToolCallEnd( call.id );
		},
	} );

	const isConnected = connectionState === 'connected';
	const isConnecting = connectionState === 'connecting';
	const isError = connectionState === 'error';
	const isActive = isConnected || isConnecting;

	// Detect user speaking from audio level.
	useEffect( () => {
		if ( ! isConnected ) {
			return;
		}
		const interval = setInterval( () => {
			const level = audioLevelRef?.current ?? 0;
			if ( level > 0.02 ) {
				setIsUserSpeaking( true );
				if ( userSpeakingTimerRef.current ) {
					clearTimeout( userSpeakingTimerRef.current );
				}
				userSpeakingTimerRef.current = setTimeout( () => {
					setIsUserSpeaking( false );
				}, 800 );
			}
		}, 100 );
		return () => clearInterval( interval );
	}, [ isConnected, audioLevelRef ] );

	// When AI starts responding, finalize any pending user message
	useEffect( () => {
		if ( isAiSpeaking && currentUserMessageIdRef.current !== null ) {
			currentUserMessageIdRef.current = null;
			userTextBufferRef.current = '';
		}
	}, [ isAiSpeaking ] );

	// Clear conversation only on disconnect (not on tab switch)
	useEffect( () => {
		if ( ! isConnected ) {
			clearConversation();
			messageVisibleTextLengthById.clear();
			setIsUserSpeaking( false );
			setIsAiSpeaking( false );
			aiTextBufferRef.current = '';
			userTextBufferRef.current = '';
			currentAiMessageIdRef.current = null;
			currentUserMessageIdRef.current = null;
			textSinceLastToolCallRef.current = false;
			currentToolCallsRef.current = [];
			clearPendingToolCalls();
		}
	}, [ isConnected, clearConversation, clearPendingToolCalls ] );

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
			// Screen share is optional.
		}

		try {
			await startAudio();
		} catch {
			// Audio is optional.
		}
	}, [ connect, disconnect, isConnected, startAudio, startScreenShare ] );

	const handleToggleMic = useCallback( async () => {
		if ( isAudioEnabled ) {
			stopAudio();
		} else {
			await startAudio();
		}
	}, [ isAudioEnabled, startAudio, stopAudio ] );

	const hasContent = messages.length > 0 && isConnected;

	return (
		<div
			className={ `gemini-live-agent-panel${
				isActive ? ' is-active' : ''
			}` }
		>
			{ /* Ambient aura — always rendered, opacity-controlled */ }
			<BackgroundAura
				isActive={ isActive }
				isStreaming={ isAiSpeaking || isUserSpeaking }
			/>

			<div className="gemini-live-agent-panel__content">
				<div className="gemini-live-agent-panel__main">
					{ /* ── Conversation layer ── */ }
					<div
						className={ `gemini-live-agent-panel__layer${
							hasContent ? ' is-visible' : ''
						}` }
					>
						{ hasContent && (
							<ConversationTranscript
								messages={ messages }
								pendingToolCallMessageIds={
									pendingToolCallMessageIds
								}
								streamingRole={ streamingRole }
							/>
						) }
					</div>

					{ /* ── Status layer (connecting / listening / prompt) ── */ }
					<div
						className={ `gemini-live-agent-panel__layer${
							! hasContent && isActive ? ' is-visible' : ''
						}` }
					>
						<div
							className={ `gemini-live-agent-panel__status-msg${
								isConnecting ? ' is-visible' : ''
							}` }
						>
							<ShimmeringText
								text={ __( 'Connecting...' ) }
								className="gemini-live-agent-panel__shimmer-lg"
							/>
						</div>

						<div
							className={ `gemini-live-agent-panel__status-msg${
								isConnected &&
								! hasContent &&
								isUserSpeaking &&
								! isAiSpeaking
									? ' is-visible'
									: ''
							}` }
						>
							<ShimmeringText
								text={ __( 'Listening...' ) }
								className="gemini-live-agent-panel__shimmer-lg"
							/>
						</div>

						<div
							className={ `gemini-live-agent-panel__status-msg${
								isConnected &&
								! hasContent &&
								! isUserSpeaking
									? ' is-visible'
									: ''
							}` }
						>
							<ShimmeringText
								text={ __( 'Say something...' ) }
								className="gemini-live-agent-panel__shimmer-xl"
							/>
						</div>
					</div>

					{ /* ── Idle layer (start button) ── */ }
					<div
						className={ `gemini-live-agent-panel__layer${
							! isActive ? ' is-visible' : ''
						}` }
					>
						<div className="gemini-live-agent-panel__idle">
							<Button
								variant="primary"
								size="compact"
								className="gemini-live-agent-panel__start-btn"
								onClick={ handleConnect }
								disabled={ isConnecting }
							>
								{ __( 'Start' ) }
							</Button>

							<span
								className={ `gemini-live-agent-panel__idle-hint${
									isError ? ' is-error' : ''
								}` }
							>
								{ isError
									? error || __( 'Connection error' )
									: __(
											'Tap to connect to AI assistant'
									  ) }
							</span>
						</div>
					</div>
				</div>

				{ /* ── Bottom controls ── */ }
				<div
					className={ `gemini-live-agent-panel__bottom${
						isConnected ? ' is-visible' : ''
					}` }
				>
					<Button
						variant="secondary"
						size="compact"
						className={ `gemini-live-agent-panel__mic-btn${
							isAudioEnabled ? ' is-active' : ''
						}` }
						onClick={ handleToggleMic }
						aria-label={
							isAudioEnabled
								? __( 'Mute microphone' )
								: __( 'Unmute microphone' )
						}
					>
						<svg
							width="16"
							height="16"
							viewBox="-3 0 19 19"
							fill="currentColor"
						>
							<path d="M11.665 7.915v1.31a5.257 5.257 0 0 1-1.514 3.694 5.174 5.174 0 0 1-1.641 1.126 5.04 5.04 0 0 1-1.456.384v1.899h2.312a.554.554 0 0 1 0 1.108H3.634a.554.554 0 0 1 0-1.108h2.312v-1.899a5.045 5.045 0 0 1-1.456-.384 5.174 5.174 0 0 1-1.641-1.126 5.257 5.257 0 0 1-1.514-3.695v-1.31a.554.554 0 1 1 1.109 0v1.31a4.131 4.131 0 0 0 1.195 2.917 3.989 3.989 0 0 0 5.722 0 4.133 4.133 0 0 0 1.195-2.917v-1.31a.554.554 0 1 1 1.109 0zM3.77 10.37a2.875 2.875 0 0 1-.233-1.146V4.738A2.905 2.905 0 0 1 3.77 3.58a3 3 0 0 1 1.59-1.59 2.902 2.902 0 0 1 1.158-.233 2.865 2.865 0 0 1 1.152.233 2.977 2.977 0 0 1 1.793 2.748l-.012 4.487a2.958 2.958 0 0 1-.856 2.09 3.025 3.025 0 0 1-.937.634 2.865 2.865 0 0 1-1.152.233 2.905 2.905 0 0 1-1.158-.233A2.957 2.957 0 0 1 3.77 10.37z" />
							{ ! isAudioEnabled && (
								<line
									x1="-2"
									x2="15"
									y1="1"
									y2="18"
									stroke="currentColor"
									strokeWidth="1.5"
								/>
							) }
						</svg>
					</Button>
					<Button
						variant="secondary"
						size="compact"
						className="gemini-live-agent-panel__stop-btn"
						onClick={ disconnect }
					>
						{ __( 'Stop' ) }
					</Button>
				</div>
			</div>

			{ /* ── Error notice (idle only) ── */ }
			{ error && ! isActive && (
				<div className="gemini-live-agent-panel__error">
					<Notice status="error" isDismissible={ false }>
						{ error }
					</Notice>
				</div>
			) }
		</div>
	);
}
