/**
 * WordPress dependencies
 */
import { dispatch, select } from '@wordpress/data';
import { createBlock, getBlockType, parse, pasteHandler, type BlockInstance } from '@wordpress/blocks';
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
 * Parse HTML or plain-text list content into core/list-item inner blocks.
 *
 * Handles `<li>…</li>` HTML as well as plain-text lines.
 */
function parseListItems( html: string ): BlockInstance[] {
	const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
	const items: BlockInstance[] = [];
	let match;

	while ( ( match = liRegex.exec( html ) ) !== null ) {
		items.push(
			createBlock( 'core/list-item', { content: match[ 1 ] } )
		);
	}

	// No <li> tags — treat as newline-separated plain-text items.
	if ( items.length === 0 && html.trim().length > 0 ) {
		const lines = html
			.split( /\n+/ )
			.map( ( l ) => l.trim() )
			.filter( Boolean );
		for ( const line of lines ) {
			items.push( createBlock( 'core/list-item', { content: line } ) );
		}
	}

	return items;
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

	// core/list: convert deprecated `values`/`value` attribute to core/list-item inner blocks.
	if ( input.blockName === 'core/list' && innerBlocks.length === 0 ) {
		const listContent =
			( attributes.values as string ) ||
			( attributes.value as string ) ||
			content;
		delete attributes.values;
		delete attributes.value;
		if ( typeof listContent === 'string' && listContent.length > 0 ) {
			innerBlocks = parseListItems( listContent );
		}
	} else if ( content ) {
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
				// Convert markdown/plain text to proper blocks.
				const converted = pasteHandler( {
					plainText: content,
					mode: 'BLOCKS',
				} );
				innerBlocks = Array.isArray( converted ) ? converted : [];
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
			'Inserts a block at a given position. For core/list, use innerBlocks with core/list-item entries (not the deprecated value attribute).',
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
		description:
			'Updates attributes and/or inner blocks of an existing block. For core/list, pass innerBlocks as core/list-item entries.',
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
				innerBlocks: {
					type: 'array',
					description:
						'Replace child blocks. Each entry: {blockName, attributes, innerBlocks?}.',
					items: { type: 'object' },
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
				destructive: true,
				idempotent: true,
			},
		},
		callback: async ( input: UpdateBlockInput ) => {
			try {
				const { updateBlockAttributes, replaceInnerBlocks } =
					dispatch( blockEditorStore );
				const { getBlock } = select( blockEditorStore );

				const block = getBlock( input.clientId );
				if ( ! block ) {
					return {
						success: false,
						message: `Block with clientId ${ input.clientId } not found`,
					};
				}

				if ( input.attributes ) {
					updateBlockAttributes(
						input.clientId,
						input.attributes
					);
				}

				if ( input.innerBlocks ) {
					const newInner = input.innerBlocks.map(
						createBlockFromInput
					);
					replaceInnerBlocks( input.clientId, newInner );
				}

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
 * Extract a short content preview from block attributes.
 */
function getContentPreview(
	attrs: Record< string, unknown >,
	maxLen: number = 80
): string {
	const raw =
		( attrs.content as string ) ||
		( attrs.text as string ) ||
		( attrs.value as string ) ||
		( attrs.citation as string ) ||
		'';
	if ( ! raw ) {
		return '';
	}
	// Strip HTML tags for the preview.
	const plain = raw.replace( /<[^>]+>/g, '' ).trim();
	return plain.length > maxLen
		? plain.substring( 0, maxLen ) + '…'
		: plain;
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
			'Returns document block tree with configurable detail level. Use "outline" (default) for large docs, "summary" for content previews, "full" for all attributes. Supports subtree queries via rootClientId.',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				detail: {
					type: 'string',
					enum: [ 'outline', 'summary', 'full' ],
					description:
						'Detail level. "outline": clientId + name + innerBlockCount (lightweight). "summary": + truncated content preview. "full": all attributes. Default: outline.',
				},
				rootClientId: {
					type: 'string',
					description:
						'Start from this block instead of document root. Use to zoom into a subtree.',
				},
				maxDepth: {
					type: 'integer',
					description:
						'Max nesting depth (default 10).',
				},
			},
		},
		output_schema: {
			type: 'object',
			properties: {
				postId: { type: 'integer' },
				postType: { type: 'string' },
				title: { type: 'string' },
				blocks: { type: 'array' },
				selectedBlockClientId: {
					anyOf: [ { type: 'string' }, { type: 'null' } ],
				},
				totalBlocks: { type: 'integer' },
			},
		},
		meta: {
			annotations: {
				readonly: true,
				idempotent: true,
			},
		},
		callback: async ( input: {
			detail?: 'outline' | 'summary' | 'full';
			rootClientId?: string;
			maxDepth?: number;
		} ): Promise< GetDocumentContextOutput > => {
			const { getBlocks, getBlock, getSelectedBlockClientId } =
				select( blockEditorStore );
			const editorSelectors = select( 'core/editor' ) as {
				getCurrentPostId: () => number;
				getCurrentPostType: () => string;
				getEditedPostAttribute: ( attribute: string ) => string;
			};

			const detail = input.detail || 'outline';
			const maxDepth = input.maxDepth ?? 10;

			// Count total blocks in tree for context.
			function countBlocks( blocks: BlockInstance[] ): number {
				let count = blocks.length;
				for ( const block of blocks ) {
					count += countBlocks( block.innerBlocks );
				}
				return count;
			}

			function serializeBlocks(
				blocks: BlockInstance[],
				depth: number = 0
			): Array< Record< string, unknown > > {
				return blocks.map( ( block ) => {
					const entry: Record< string, unknown > = {
						clientId: block.clientId,
						name: block.name,
					};

					if ( detail === 'outline' ) {
						if ( block.innerBlocks.length > 0 ) {
							entry.innerBlockCount = block.innerBlocks.length;
						}
					} else if ( detail === 'summary' ) {
						const preview = getContentPreview(
							block.attributes
						);
						if ( preview ) {
							entry.content = preview;
						}
						if ( block.innerBlocks.length > 0 ) {
							entry.innerBlockCount = block.innerBlocks.length;
						}
					} else {
						// full
						entry.attributes = block.attributes;
					}

					if (
						block.innerBlocks.length > 0 &&
						depth < maxDepth
					) {
						entry.innerBlocks = serializeBlocks(
							block.innerBlocks,
							depth + 1
						);
					}

					return entry;
				} );
			}

			let rootBlocks: BlockInstance[];
			if ( input.rootClientId ) {
				const rootBlock = getBlock( input.rootClientId );
				rootBlocks = rootBlock ? rootBlock.innerBlocks : [];
			} else {
				rootBlocks = getBlocks();
			}

			return {
				postId: editorSelectors.getCurrentPostId(),
				postType: editorSelectors.getCurrentPostType(),
				title:
					editorSelectors.getEditedPostAttribute( 'title' ) || '',
				blocks: serializeBlocks( rootBlocks ),
				selectedBlockClientId: getSelectedBlockClientId(),
				totalBlocks: countBlocks( rootBlocks ),
			};
		},
	} );
}

/**
 * Register the find-blocks ability
 */
export function registerFindBlocksAbility(): void {
	if ( getAbility( 'agent/find-blocks' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/find-blocks',
		label: 'Find Blocks',
		description:
			'Searches the entire block tree by text content and/or block name. Returns matching blocks with clientId, path breadcrumb, and content preview. Fastest way to locate a block in deeply nested documents.',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description:
						'Text to search for in block content (case-insensitive, searches HTML-stripped text).',
				},
				blockName: {
					type: 'string',
					description:
						'Filter by block name, e.g. "core/paragraph".',
				},
				limit: {
					type: 'integer',
					description: 'Max results (default 20).',
				},
			},
		},
		output_schema: {
			type: 'object',
			properties: {
				results: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							clientId: { type: 'string' },
							name: { type: 'string' },
							path: { type: 'string' },
							content: { type: 'string' },
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
		callback: async ( input: {
			query?: string;
			blockName?: string;
			limit?: number;
		} ) => {
			const { getBlocks } = select( blockEditorStore );
			const limit = Math.min( Math.max( input.limit || 20, 1 ), 100 );
			const queryLower = ( input.query || '' ).toLowerCase();
			const blockNameFilter = input.blockName || '';

			interface Match {
				clientId: string;
				name: string;
				path: string;
				content: string;
			}

			const results: Match[] = [];

			function getBlockTitle( block: BlockInstance ): string {
				const bt = getBlockType( block.name );
				return bt?.title || block.name;
			}

			function walk(
				blocks: BlockInstance[],
				ancestors: string[]
			): void {
				for ( const block of blocks ) {
					if ( results.length >= limit ) {
						return;
					}

					const title = getBlockTitle( block );
					const currentPath = [ ...ancestors, title ];

					// Check name filter.
					const nameMatch =
						! blockNameFilter ||
						block.name === blockNameFilter;

					// Check text query.
					let textMatch = ! queryLower;
					let preview = '';
					if ( nameMatch ) {
						preview = getContentPreview(
							block.attributes,
							120
						);
						if ( queryLower ) {
							textMatch = preview
								.toLowerCase()
								.includes( queryLower );
						}
					}

					if ( nameMatch && textMatch ) {
						results.push( {
							clientId: block.clientId,
							name: block.name,
							path: currentPath.join( ' > ' ),
							content: preview,
						} );
					}

					walk( block.innerBlocks, currentPath );
				}
			}

			walk( getBlocks(), [] );
			return { results };
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
 * Register the get-block ability
 */
export function registerGetBlockAbility(): void {
	if ( getAbility( 'agent/get-block' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/get-block',
		label: 'Get Block',
		description:
			'Returns full details of a single block by clientId — attributes (including rich-text HTML content with links/formatting), name, and inner blocks.',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				clientId: {
					type: 'string',
					description: 'The block clientId to inspect',
				},
			},
			required: [ 'clientId' ],
		},
		output_schema: {
			type: 'object',
			properties: {
				found: { type: 'boolean' },
				block: {
					type: 'object',
					properties: {
						clientId: { type: 'string' },
						name: { type: 'string' },
						attributes: { type: 'object' },
						innerBlocks: { type: 'array' },
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
		callback: async ( input: { clientId: string } ) => {
			const { getBlock } = select( blockEditorStore );
			const block = getBlock( input.clientId );

			if ( ! block ) {
				return { found: false, block: null };
			}

			function serializeBlock( b: BlockInstance ): Record< string, unknown > {
				return {
					clientId: b.clientId,
					name: b.name,
					attributes: b.attributes,
					innerBlocks: b.innerBlocks.map( serializeBlock ),
				};
			}

			return { found: true, block: serializeBlock( block ) };
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
	registerFindBlocksAbility();
	registerSelectBlockAbility();
	registerGetBlockSchemaAbility();
	registerGetBlockAbility();
}
