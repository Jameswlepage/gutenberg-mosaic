/**
 * WordPress dependencies
 */
import { dispatch, select } from '@wordpress/data';
// @ts-expect-error No type declarations for block-editor.
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as coreDataStore } from '@wordpress/core-data';
import { getAbility, registerAbility } from '@wordpress/abilities';

/**
 * Internal dependencies
 */
import type { CreateNoteInput } from '../types';
import { AGENT_CATEGORY } from './block-abilities';
import { store as geminiAgentStore } from '../store';

/**
 * Register the create-note ability
 *
 * This ability creates a note/comment attached to a specific block.
 * It uses the WordPress block notes (collab sidebar) system.
 */
export function registerCreateNoteAbility(): void {
	if ( getAbility( 'agent/create-note' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/create-note',
		label: 'Create Note',
		description:
			'Creates a note/comment attached to a block for collaboration',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				clientId: {
					type: 'string',
					description:
						'The client ID of the block to attach the note to (uses selection if not provided)',
				},
				content: {
					type: 'string',
					description: 'The note content/message',
				},
			},
			required: [ 'content' ],
		},
		output_schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				noteId: { type: 'integer' },
				message: { type: 'string' },
			},
		},
		meta: {
			annotations: {
				destructive: true,
				idempotent: false,
			},
		},
		callback: async ( input: CreateNoteInput ) => {
			try {
				const {
					getSelectedBlockClientId,
					getBlock,
					getBlockAttributes,
				} = select( blockEditorStore );
				const { updateBlockAttributes } = dispatch( blockEditorStore );
				const editorSelectors = select( 'core/editor' ) as {
					getCurrentPostId: () => number;
				};
				const { saveEntityRecord } = dispatch( coreDataStore );

				const clientId = input.clientId || getSelectedBlockClientId();

				if ( ! clientId ) {
					return {
						success: false,
						noteId: 0,
						message: 'No block selected or specified',
					};
				}

				const block = getBlock( clientId );
				if ( ! block ) {
					return {
						success: false,
						noteId: 0,
						message: `Block with clientId ${ clientId } not found`,
					};
				}

				const postId = editorSelectors.getCurrentPostId();

				// Create the note as a WordPress comment with type "note"
				// This integrates with the collab-sidebar notes system
				const noteRecord = await saveEntityRecord(
					'root',
					'comment',
					{
						post: postId,
						content: input.content,
						status: 'hold', // Notes start as pending
						type: 'note',
						// Store the block reference in meta
						meta: {
							_block_client_id: clientId,
							_block_name: block.name,
						},
					},
					{ throwOnError: true }
				);

				// Update the block's metadata to reference the note
				const currentAttributes = getBlockAttributes( clientId );
				const currentMetadata = currentAttributes?.metadata || {};

				updateBlockAttributes( clientId, {
					metadata: {
						...currentMetadata,
						noteId: noteRecord.id,
					},
				} );
				dispatch( geminiAgentStore ).setActiveBlockClientId( clientId );

				return {
					success: true,
					noteId: noteRecord.id,
					message: `Created note on ${ block.name } block`,
				};
			} catch ( error ) {
				return {
					success: false,
					noteId: 0,
					message:
						error instanceof Error
							? error.message
							: 'Failed to create note',
				};
			}
		},
	} );
}

/**
 * Register the reply-to-note ability
 */
export function registerReplyToNoteAbility(): void {
	if ( getAbility( 'agent/reply-to-note' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/reply-to-note',
		label: 'Reply to Note',
		description: 'Adds a reply to an existing note thread',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				noteId: {
					type: 'integer',
					description: 'The ID of the parent note to reply to',
				},
				content: {
					type: 'string',
					description: 'The reply content',
				},
			},
			required: [ 'noteId', 'content' ],
		},
		output_schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				replyId: { type: 'integer' },
				message: { type: 'string' },
			},
		},
		meta: {
			annotations: {
				destructive: true,
				idempotent: false,
			},
		},
		callback: async ( input: { noteId: number; content: string } ) => {
			try {
				const editorSelectors = select( 'core/editor' ) as {
					getCurrentPostId: () => number;
				};
				const { saveEntityRecord } = dispatch( coreDataStore );

				const postId = editorSelectors.getCurrentPostId();

				// Create a reply comment
				const replyRecord = await saveEntityRecord(
					'root',
					'comment',
					{
						post: postId,
						parent: input.noteId,
						content: input.content,
						status: 'hold',
						type: 'note',
					},
					{ throwOnError: true }
				);

				return {
					success: true,
					replyId: replyRecord.id,
					message: 'Added reply to note thread',
				};
			} catch ( error ) {
				return {
					success: false,
					replyId: 0,
					message:
						error instanceof Error
							? error.message
							: 'Failed to add reply',
				};
			}
		},
	} );
}

/**
 * Register the update-note ability
 */
export function registerUpdateNoteAbility(): void {
	if ( getAbility( 'agent/update-note' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/update-note',
		label: 'Update Note',
		description: 'Edits the content of an existing note',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				noteId: {
					type: 'integer',
					description: 'The ID of the note to update',
				},
				content: {
					type: 'string',
					description: 'Updated note content',
				},
			},
			required: [ 'noteId', 'content' ],
		},
		output_schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				message: { type: 'string' },
			},
		},
		meta: {
			annotations: {
				destructive: true,
				idempotent: true,
			},
		},
		callback: async ( input: { noteId: number; content: string } ) => {
			try {
				const { saveEntityRecord } = dispatch( coreDataStore );

				await saveEntityRecord(
					'root',
					'comment',
					{
						id: input.noteId,
						content: input.content,
						type: 'note',
					},
					{ throwOnError: true }
				);

				return {
					success: true,
					message: 'Note updated',
				};
			} catch ( error ) {
				return {
					success: false,
					message:
						error instanceof Error
							? error.message
							: 'Failed to update note',
				};
			}
		},
	} );
}

/**
 * Register the resolve-note ability
 */
export function registerResolveNoteAbility(): void {
	if ( getAbility( 'agent/resolve-note' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/resolve-note',
		label: 'Resolve Note',
		description: 'Marks a note as resolved',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				noteId: {
					type: 'integer',
					description: 'The ID of the note to resolve',
				},
			},
			required: [ 'noteId' ],
		},
		output_schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				message: { type: 'string' },
			},
		},
		meta: {
			annotations: {
				destructive: true,
				idempotent: true,
			},
		},
		callback: async ( input: { noteId: number } ) => {
			try {
				const { saveEntityRecord } = dispatch( coreDataStore );

				// Mark the note as approved (resolved)
				await saveEntityRecord(
					'root',
					'comment',
					{
						id: input.noteId,
						status: 'approved',
					},
					{ throwOnError: true }
				);

				// Create a status entry to keep note threads consistent with UI.
				const editorSelectors = select( 'core/editor' ) as {
					getCurrentPostId: () => number;
				};
				const postId = editorSelectors.getCurrentPostId();

				await saveEntityRecord(
					'root',
					'comment',
					{
						post: postId,
						parent: input.noteId,
						content: '',
						status: 'approved',
						type: 'note',
						meta: {
							_wp_note_status: 'resolved',
						},
					},
					{ throwOnError: true }
				);

				return {
					success: true,
					message: 'Note resolved',
				};
			} catch ( error ) {
				return {
					success: false,
					message:
						error instanceof Error
							? error.message
							: 'Failed to resolve note',
				};
			}
		},
	} );
}

/**
 * Register the get-notes ability
 */
export function registerGetNotesAbility(): void {
	if ( getAbility( 'agent/get-notes' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/get-notes',
		label: 'Get Notes',
		description: 'Retrieves all notes for the current document',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				status: {
					type: 'string',
					enum: [ 'all', 'pending', 'resolved' ],
					description: 'Filter notes by status',
				},
				clientId: {
					type: 'string',
					description: 'Filter notes by block client ID',
				},
			},
		},
		output_schema: {
			type: 'object',
			properties: {
				notes: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							id: { type: 'integer' },
							content: { type: 'string' },
							status: { type: 'string' },
							blockClientId: { type: 'string' },
							replies: { type: 'array' },
						},
					},
				},
			},
		},
		meta: {
			annotations: {
				readonly: true,
				idempotent: true,
			},
		},
		callback: async ( input: { status?: string; clientId?: string } ) => {
			try {
				const editorSelectors = select( 'core/editor' ) as {
					getCurrentPostId: () => number;
				};
				const { getEntityRecords } = select( coreDataStore );

				const postId = editorSelectors.getCurrentPostId();

				// Build query for notes
				const query: Record< string, unknown > = {
					post: postId,
					type: 'note',
					per_page: 100,
				};

				if ( input.status === 'pending' ) {
					query.status = 'hold';
				} else if ( input.status === 'resolved' ) {
					query.status = 'approved';
				}

				const comments = getEntityRecords( 'root', 'comment', query ) as Array< Record< string, any > > | null | undefined;

				if ( ! comments ) {
					return { notes: [] };
				}

				// Organize into threads (parent notes with replies)
				const notesMap = new Map<
					number,
					{
						id: number;
						content: string;
						status: string;
						blockClientId: string;
						replies: Array< {
							id: number;
							content: string;
						} >;
					}
				>();

				for ( const comment of comments ) {
					if ( comment.parent === 0 ) {
						// This is a parent note
						notesMap.set( comment.id, {
							id: comment.id,
							content: comment.content?.rendered || '',
							status:
								comment.status === 'approved'
									? 'resolved'
									: 'pending',
							blockClientId: comment.meta?._block_client_id || '',
							replies: [],
						} );
					}
				}

				// Add replies to their parent notes
				for ( const comment of comments ) {
					if ( comment.parent !== 0 ) {
						const parentNote = notesMap.get( comment.parent );
						if ( parentNote ) {
							parentNote.replies.push( {
								id: comment.id,
								content: comment.content?.rendered || '',
							} );
						}
					}
				}

				let notes = Array.from( notesMap.values() );

				// Filter by clientId if specified
				if ( input.clientId ) {
					notes = notes.filter(
						( note ) => note.blockClientId === input.clientId
					);
				}

				return { notes };
			} catch ( error ) {
				return { notes: [] };
			}
		},
	} );
}

/**
 * Register all note-related abilities
 */
export function registerNoteAbilities(): void {
	registerCreateNoteAbility();
	registerReplyToNoteAbility();
	registerUpdateNoteAbility();
	registerResolveNoteAbility();
	registerGetNotesAbility();
}
