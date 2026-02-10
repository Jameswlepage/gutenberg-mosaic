/**
 * WordPress dependencies
 */
import { dispatch, select } from '@wordpress/data';
import { createBlock, getBlockType, parse, type BlockInstance } from '@wordpress/blocks';
import { store as blockEditorStore } from '@wordpress/block-editor';
import {
	getAbility,
	getAbilityCategory,
	registerAbility,
	registerAbilityCategory,
} from '@wordpress/abilities';

/**
 * Internal dependencies
 */
import type {
	InsertBlockInput,
	MoveBlocksInput,
	GetBlockSchemaInput,
	UpdateBlockInput,
	GetDocumentContextOutput,
} from '../types';
import { store as geminiAgentStore } from '../store';

/**
 * Category slug for agent abilities
 */
export const AGENT_CATEGORY = 'ai-agent';

/**
 * Register the AI Agent ability category
 */
export function registerAgentCategory(): void {
	if ( getAbilityCategory( AGENT_CATEGORY ) ) {
		return;
	}

	registerAbilityCategory( AGENT_CATEGORY, {
		label: 'AI Agent',
		description:
			'Abilities for AI agents to interact with the WordPress block editor',
	} );
}

/**
 * Helper to recursively create blocks from input
 *
 * @param input The block input definition.
 */
function createBlockFromInput( input: InsertBlockInput ): BlockInstance {
	const blockType = getBlockType( input.blockName );
	const attributes: Record< string, unknown > = {
		...( input.attributes || {} ),
	};

	let innerBlocks = input.innerBlocks
		? input.innerBlocks.map( createBlockFromInput )
		: [];

	const content = typeof input.content === 'string' ? input.content : null;
	if ( content ) {
		if ( blockType?.attributes?.content ) {
			attributes.content = content;
		} else if ( blockType?.attributes?.value ) {
			attributes.value = content;
		} else if ( blockType?.attributes?.text ) {
			attributes.text = content;
		} else if ( innerBlocks.length === 0 ) {
			if ( content.includes( '<!-- wp:' ) ) {
				innerBlocks = parse( content, {
					__unstableSkipMigrationLogs: true,
				} );
			} else {
				innerBlocks = [ createBlock( 'core/paragraph', { content } ) ];
			}
		}
	}

	return createBlock( input.blockName, attributes, innerBlocks );
}

/**
 * Register the insert-block ability
 */
export function registerInsertBlockAbility(): void {
	if ( getAbility( 'agent/insert-block' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/insert-block',
		label: 'Insert Block',
		description:
			'Inserts a new block into the editor at the specified position',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				blockName: {
					type: 'string',
					description:
						'The block name (e.g., "core/paragraph", "core/heading")',
				},
				attributes: {
					type: 'object',
					description: 'Block attributes',
				},
				content: {
					type: 'string',
					description:
						'Optional block content shorthand (mapped to attributes or inner blocks)',
				},
				innerBlocks: {
					type: 'array',
					description: 'Nested inner blocks',
					items: {
						type: 'object',
					},
				},
				position: {
					type: 'string',
					enum: [ 'before', 'after', 'first', 'last' ],
					description:
						'Where to insert relative to targetClientId or document',
				},
				targetClientId: {
					type: 'string',
					description:
						'Client ID of reference block (optional, uses selection if not provided)',
				},
			},
			required: [ 'blockName' ],
		},
		output_schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				clientId: { type: 'string' },
				message: { type: 'string' },
			},
		},
		meta: {
			annotations: {
				destructive: true,
				idempotent: false,
			},
		},
		callback: async ( input: InsertBlockInput ) => {
			try {
				const { insertBlock, selectBlock } =
					dispatch( blockEditorStore );
				const {
					getSelectedBlockClientId,
					getBlockRootClientId,
					getBlockIndex,
					getBlocks,
				} = select( blockEditorStore );

				const block = createBlockFromInput( input );
				const position = input.position || 'after';
				const targetClientId =
					input.targetClientId || getSelectedBlockClientId();

				let rootClientId: string | undefined;
				let index: number | undefined;

				if ( targetClientId ) {
					rootClientId =
						getBlockRootClientId( targetClientId ) || undefined;
					const targetIndex = getBlockIndex( targetClientId );

					switch ( position ) {
						case 'before':
							index = targetIndex;
							break;
						case 'after':
							index = targetIndex + 1;
							break;
						case 'first':
							index = 0;
							break;
						case 'last':
							index = getBlocks( rootClientId ).length;
							break;
					}
				} else {
					// No target, insert at end of document
					const blocks = getBlocks();
					index = blocks.length;
				}

				insertBlock( block, index, rootClientId );
				selectBlock( block.clientId );
				dispatch( geminiAgentStore ).setActiveBlockClientId(
					block.clientId
				);

				return {
					success: true,
					clientId: block.clientId,
					message: `Inserted ${ input.blockName } block`,
				};
			} catch ( error ) {
				return {
					success: false,
					clientId: '',
					message:
						error instanceof Error
							? error.message
							: 'Failed to insert block',
				};
			}
		},
	} );
}

/**
 * Register the update-block ability
 */
export function registerUpdateBlockAbility(): void {
	if ( getAbility( 'agent/update-block' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/update-block',
		label: 'Update Block',
		description: 'Updates the attributes of an existing block',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				clientId: {
					type: 'string',
					description: 'The client ID of the block to update',
				},
				attributes: {
					type: 'object',
					description:
						'The attributes to update (merged with existing)',
				},
			},
			required: [ 'clientId', 'attributes' ],
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
		callback: async ( input: UpdateBlockInput ) => {
			try {
				const { updateBlockAttributes } = dispatch( blockEditorStore );
				const { getBlock } = select( blockEditorStore );

				const block = getBlock( input.clientId );
				if ( ! block ) {
					return {
						success: false,
						message: `Block with clientId ${ input.clientId } not found`,
					};
				}

				updateBlockAttributes( input.clientId, input.attributes );
				dispatch( geminiAgentStore ).setActiveBlockClientId(
					input.clientId
				);

				return {
					success: true,
					message: `Updated ${ block.name } block`,
				};
			} catch ( error ) {
				return {
					success: false,
					message:
						error instanceof Error
							? error.message
							: 'Failed to update block',
				};
			}
		},
	} );
}

/**
 * Register the remove-block ability
 */
export function registerRemoveBlockAbility(): void {
	if ( getAbility( 'agent/remove-block' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/remove-block',
		label: 'Remove Block',
		description: 'Removes a block from the editor',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				clientId: {
					type: 'string',
					description:
						'The client ID of the block to remove (uses selection if not provided)',
				},
			},
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
		callback: async ( input: { clientId?: string } ) => {
			try {
				const { removeBlock } = dispatch( blockEditorStore );
				const { getSelectedBlockClientId, getBlock } =
					select( blockEditorStore );

				const clientId = input.clientId || getSelectedBlockClientId();

				if ( ! clientId ) {
					return {
						success: false,
						message: 'No block selected or specified',
					};
				}

				const block = getBlock( clientId );
				if ( ! block ) {
					return {
						success: false,
						message: `Block with clientId ${ clientId } not found`,
					};
				}

				removeBlock( clientId );
				dispatch( geminiAgentStore ).setActiveBlockClientId( null );

				return {
					success: true,
					message: `Removed ${ block.name } block`,
				};
			} catch ( error ) {
				return {
					success: false,
					message:
						error instanceof Error
							? error.message
							: 'Failed to remove block',
				};
			}
		},
	} );
}

/**
 * Register the move-blocks ability
 */
export function registerMoveBlocksAbility(): void {
	if ( getAbility( 'agent/move-blocks' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/move-blocks',
		label: 'Move Blocks',
		description: 'Moves one or more blocks within the editor',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				clientIds: {
					type: 'array',
					description: 'Client IDs of blocks to move',
					items: { type: 'string' },
				},
				clientId: {
					type: 'string',
					description:
						'Single client ID (alternative to clientIds)',
				},
				position: {
					type: 'string',
					enum: [ 'before', 'after', 'first', 'last' ],
					description:
						'Where to move relative to targetClientId or destination root',
				},
				targetClientId: {
					type: 'string',
					description:
						'Target block client ID to move relative to (optional)',
				},
				rootClientId: {
					type: 'string',
					description:
						'Destination root client ID (optional, defaults to document)',
				},
			},
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
				idempotent: false,
			},
		},
		callback: async ( input: MoveBlocksInput ) => {
			try {
				const {
					moveBlocksToPosition,
					moveBlocksDown,
				} = dispatch( blockEditorStore );
				const {
					getSelectedBlockClientId,
					getBlockRootClientId,
					getBlockIndex,
					getBlocks,
				} = select( blockEditorStore );

				const clientIds =
					input.clientIds && input.clientIds.length
						? input.clientIds
						: input.clientId
							? [ input.clientId ]
							: getSelectedBlockClientId()
								? [ getSelectedBlockClientId() ]
								: [];

				if ( clientIds.length === 0 ) {
					return {
						success: false,
						message: 'No blocks specified to move.',
					};
				}

				const position = input.position || 'after';
				const targetClientId = input.targetClientId;
				const sourceRoot =
					getBlockRootClientId( clientIds[ 0 ] ) || '';
				let destinationRoot: string | undefined = input.rootClientId;
				let destinationIndex: number | undefined;

				if ( targetClientId ) {
					destinationRoot =
						getBlockRootClientId( targetClientId ) || undefined;
					const targetIndex = getBlockIndex( targetClientId );
					switch ( position ) {
						case 'before':
							destinationIndex = targetIndex;
							break;
						case 'after':
							destinationIndex = targetIndex + 1;
							break;
						case 'first':
							destinationIndex = 0;
							break;
						case 'last':
							destinationIndex = getBlocks( destinationRoot ).length;
							break;
					}
				} else {
					const blocks = getBlocks( destinationRoot );
					switch ( position ) {
						case 'first':
							destinationIndex = 0;
							break;
						case 'last':
						case 'after':
						default:
							destinationIndex = blocks.length;
							break;
						case 'before':
							destinationIndex = 0;
							break;
					}
				}

				if (
					position === 'before' ||
					position === 'after' ||
					position === 'first' ||
					position === 'last'
				) {
					moveBlocksToPosition(
						clientIds,
						sourceRoot,
						destinationRoot || '',
						destinationIndex ?? 0
					);
				} else {
					moveBlocksDown( clientIds, destinationRoot );
				}

				return {
					success: true,
					message: 'Blocks moved.',
				};
			} catch ( error ) {
				return {
					success: false,
					message:
						error instanceof Error
							? error.message
							: 'Failed to move blocks.',
				};
			}
		},
	} );
}

/**
 * Register the get-document-context ability
 */
export function registerGetDocumentContextAbility(): void {
	if ( getAbility( 'agent/get-document-context' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/get-document-context',
		label: 'Get Document Context',
		description:
			'Retrieves the current document structure and selected block',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				includeContent: {
					type: 'boolean',
					description:
						'Whether to include block content in the response',
				},
				maxDepth: {
					type: 'integer',
					description: 'Maximum depth of nested blocks to include',
				},
			},
		},
		output_schema: {
			type: 'object',
			properties: {
				postId: { type: 'integer' },
				postType: { type: 'string' },
				title: { type: 'string' },
				blocks: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							clientId: { type: 'string' },
							name: { type: 'string' },
							attributes: { type: 'object' },
						},
					},
				},
				selectedBlockClientId: {
					anyOf: [ { type: 'string' }, { type: 'null' } ],
				},
			},
		},
		meta: {
			annotations: {
				readonly: true,
				idempotent: true,
			},
		},
		callback: async ( input: {
			includeContent?: boolean;
			maxDepth?: number;
		} ): Promise< GetDocumentContextOutput > => {
			const { getBlocks, getSelectedBlockClientId } =
				select( blockEditorStore );
			const editorSelectors = select( 'core/editor' ) as {
				getCurrentPostId: () => number;
				getCurrentPostType: () => string;
				getEditedPostAttribute: ( attribute: string ) => string;
			};

			const maxDepth = input.maxDepth ?? 3;

			function serializeBlocks(
				blocks: BlockInstance[],
				depth: number = 0
			): Array< {
				clientId: string;
				name: string;
				attributes: Record< string, unknown >;
				innerBlocks?: Array< {
					clientId: string;
					name: string;
					attributes: Record< string, unknown >;
				} >;
			} > {
				return blocks.map( ( block ) => {
					const serialized: {
						clientId: string;
						name: string;
						attributes: Record< string, unknown >;
						innerBlocks?: Array< {
							clientId: string;
							name: string;
							attributes: Record< string, unknown >;
						} >;
					} = {
						clientId: block.clientId,
						name: block.name,
						attributes: input.includeContent
							? block.attributes
							: filterAttributes( block.attributes ),
					};

					if ( block.innerBlocks.length > 0 && depth < maxDepth ) {
						serialized.innerBlocks = serializeBlocks(
							block.innerBlocks,
							depth + 1
						);
					}

					return serialized;
				} );
			}

			// Filter out large content attributes for lighter payloads
			function filterAttributes(
				attrs: Record< string, unknown >
			): Record< string, unknown > {
				const filtered: Record< string, unknown > = {};
				for ( const [ key, value ] of Object.entries( attrs ) ) {
					// Skip large content fields unless explicitly requested
					if (
						key === 'content' &&
						typeof value === 'string' &&
						value.length > 200
					) {
						filtered[ key ] =
							value.substring( 0, 200 ) + '... (truncated)';
					} else {
						filtered[ key ] = value;
					}
				}
				return filtered;
			}

			return {
				postId: editorSelectors.getCurrentPostId(),
				postType: editorSelectors.getCurrentPostType(),
				title: editorSelectors.getEditedPostAttribute( 'title' ) || '',
				blocks: serializeBlocks( getBlocks() ),
				selectedBlockClientId: getSelectedBlockClientId(),
			};
		},
	} );
}

/**
 * Register the get-block-schema ability
 */
export function registerGetBlockSchemaAbility(): void {
	if ( getAbility( 'agent/get-block-schema' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/get-block-schema',
		label: 'Get Block Schema',
		description:
			'Returns block attributes and supports for a block name or client ID',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				blockName: {
					type: 'string',
					description: 'Block name, e.g. core/paragraph',
				},
				clientId: {
					type: 'string',
					description: 'Client ID to resolve the block name',
				},
			},
		},
		output_schema: {
			type: 'object',
			properties: {
				name: { type: 'string' },
				title: { type: 'string' },
				description: { type: 'string' },
				attributes: { type: 'object' },
				supports: { type: 'object' },
				styles: { type: 'array' },
				variations: { type: 'array' },
			},
		},
		meta: {
			annotations: {
				readonly: true,
				idempotent: true,
			},
		},
		callback: async ( input: GetBlockSchemaInput ) => {
			const { getBlock } = select( blockEditorStore );
			let blockName = input.blockName;

			if ( ! blockName && input.clientId ) {
				const block = getBlock( input.clientId );
				blockName = block?.name;
			}

			if ( ! blockName ) {
				return {
					name: '',
					title: '',
					description: '',
					attributes: {},
					supports: {},
					styles: [],
					variations: [],
				};
			}

			const blockType = getBlockType( blockName );
			if ( ! blockType ) {
				return {
					name: blockName,
					title: '',
					description: '',
					attributes: {},
					supports: {},
					styles: [],
					variations: [],
				};
			}

			return {
				name: blockType.name,
				title: blockType.title || '',
				description: blockType.description || '',
				attributes: blockType.attributes || {},
				supports: blockType.supports || {},
				styles: blockType.styles || [],
				variations: blockType.variations || [],
			};
		},
	} );
}

/**
 * Register the select-block ability
 */
export function registerSelectBlockAbility(): void {
	if ( getAbility( 'agent/select-block' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/select-block',
		label: 'Select Block',
		description: 'Selects a block in the editor by its client ID',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				clientId: {
					type: 'string',
					description: 'The client ID of the block to select',
				},
			},
			required: [ 'clientId' ],
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
				readonly: false,
				idempotent: true,
			},
		},
		callback: async ( input: { clientId: string } ) => {
			try {
				const { selectBlock } = dispatch( blockEditorStore );
				const { getBlock } = select( blockEditorStore );

				const block = getBlock( input.clientId );
				if ( ! block ) {
					return {
						success: false,
						message: `Block with clientId ${ input.clientId } not found`,
					};
				}

				selectBlock( input.clientId );
				dispatch( geminiAgentStore ).setActiveBlockClientId(
					input.clientId
				);

				return {
					success: true,
					message: `Selected ${ block.name } block`,
				};
			} catch ( error ) {
				return {
					success: false,
					message:
						error instanceof Error
							? error.message
							: 'Failed to select block',
				};
			}
		},
	} );
}

/**
 * Register all block-related abilities
 */
export function registerBlockAbilities(): void {
	registerAgentCategory();
	registerInsertBlockAbility();
	registerUpdateBlockAbility();
	registerRemoveBlockAbility();
	registerMoveBlocksAbility();
	registerGetDocumentContextAbility();
	registerSelectBlockAbility();
	registerGetBlockSchemaAbility();
}
