/**
 * WordPress dependencies
 */
import { dispatch, resolveSelect, select } from '@wordpress/data';
import { parse } from '@wordpress/blocks';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as coreStore } from '@wordpress/core-data';
import { getAbility, registerAbility } from '@wordpress/abilities';

/**
 * Internal dependencies
 */
import { AGENT_CATEGORY } from './block-abilities';
import type { InsertPatternInput, SearchPatternsInput } from '../types';
import { store as geminiAgentStore } from '../store';

interface BlockPatternRecord {
	name: string;
	title?: string;
	description?: string;
	categories?: string[];
	keywords?: string[];
	source?: string;
	content?: string;
	inserter?: boolean;
}

function normalizePatterns(
	patterns: Array< BlockPatternRecord > = []
): BlockPatternRecord[] {
	const seen = new Set< string >();
	return patterns.filter( ( pattern ) => {
		if ( ! pattern?.name ) {
			return false;
		}
		if ( seen.has( pattern.name ) ) {
			return false;
		}
		seen.add( pattern.name );
		return true;
	} );
}

async function getAllPatterns(): Promise< BlockPatternRecord[] > {
	const settings = select( blockEditorStore ).getSettings() as {
		__experimentalAdditionalBlockPatterns?: BlockPatternRecord[];
		__experimentalBlockPatterns?: BlockPatternRecord[];
	};

	const settingsPatterns = [
		...( settings?.__experimentalAdditionalBlockPatterns || [] ),
		...( settings?.__experimentalBlockPatterns || [] ),
	];

	const restPatterns =
		( ( await resolveSelect( coreStore ).getBlockPatterns() ) || [] ) as
			| BlockPatternRecord[]
			| undefined;

	return normalizePatterns( [ ...( settingsPatterns || [] ), ...( restPatterns || [] ) ] )
		.filter( ( pattern ) => pattern.inserter !== false );
}

/**
 * Register the search-patterns ability
 */
export function registerSearchPatternsAbility(): void {
	if ( getAbility( 'agent/search-patterns' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/search-patterns',
		label: 'Search Patterns',
		description: 'Searches available block patterns',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				search: {
					type: 'string',
					description: 'Search query for patterns',
				},
				category: {
					type: 'string',
					description: 'Filter by pattern category',
				},
				limit: {
					type: 'integer',
					description: 'Maximum number of results',
				},
			},
		},
		output_schema: {
			type: 'object',
			properties: {
				patterns: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							name: { type: 'string' },
							title: { type: 'string' },
							description: { type: 'string' },
							categories: { type: 'array', items: { type: 'string' } },
							keywords: { type: 'array', items: { type: 'string' } },
							source: { type: 'string' },
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
		callback: async ( input: SearchPatternsInput ) => {
			const allPatterns = await getAllPatterns();
			const query = ( input.search || '' ).toLowerCase().trim();
			const category = input.category?.toLowerCase();
			const limit = input.limit && input.limit > 0 ? input.limit : undefined;

			let results = allPatterns;
			if ( category ) {
				results = results.filter( ( pattern ) =>
					( pattern.categories || [] ).some(
						( cat ) => cat.toLowerCase() === category
					)
				);
			}

			if ( query ) {
				results = results.filter( ( pattern ) => {
					const haystack = [
						pattern.name,
						pattern.title,
						pattern.description,
						...( pattern.categories || [] ),
						...( pattern.keywords || [] ),
					]
						.filter( Boolean )
						.join( ' ' )
						.toLowerCase();
					return haystack.includes( query );
				} );
			}

			if ( limit ) {
				results = results.slice( 0, limit );
			}

			return {
				patterns: results.map( ( pattern ) => ( {
					name: pattern.name,
					title: pattern.title || '',
					description: pattern.description || '',
					categories: pattern.categories || [],
					keywords: pattern.keywords || [],
					source: pattern.source || '',
				} ) ),
			};
		},
	} );
}

/**
 * Register the insert-pattern ability
 */
export function registerInsertPatternAbility(): void {
	if ( getAbility( 'agent/insert-pattern' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/insert-pattern',
		label: 'Insert Pattern',
		description: 'Inserts a block pattern into the editor',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					description: 'Pattern name',
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
				rootClientId: {
					type: 'string',
					description:
						'Destination root client ID (optional, defaults to document)',
				},
			},
			required: [ 'name' ],
		},
		output_schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				message: { type: 'string' },
				clientId: { type: 'string' },
			},
		},
		meta: {
			annotations: {
				destructive: true,
				idempotent: false,
			},
		},
		callback: async ( input: InsertPatternInput ) => {
			try {
				const { insertBlocks, selectBlock } = dispatch( blockEditorStore );
				const {
					getSelectedBlockClientId,
					getBlockRootClientId,
					getBlockIndex,
					getBlocks,
				} = select( blockEditorStore );

				const patterns = await getAllPatterns();
				const pattern = patterns.find( ( item ) => item.name === input.name );

				if ( ! pattern?.content ) {
					return {
						success: false,
						clientId: '',
						message: `Pattern "${ input.name }" not found or missing content.`,
					};
				}

				const blocks = parse( pattern.content, {
					__unstableSkipMigrationLogs: true,
				} );

				if ( blocks.length === 0 ) {
					return {
						success: false,
						clientId: '',
						message: 'Pattern has no blocks to insert.',
					};
				}

				const position = input.position || 'after';
				const targetClientId =
					input.targetClientId || getSelectedBlockClientId();

				let rootClientId: string | undefined = input.rootClientId;
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
					const blocksList = getBlocks( rootClientId );
					index = position === 'first' ? 0 : blocksList.length;
				}

				insertBlocks( blocks, index, rootClientId );
				selectBlock( blocks[ 0 ].clientId );
				dispatch( geminiAgentStore ).setActiveBlockClientId(
					blocks[ 0 ].clientId
				);

				return {
					success: true,
					clientId: blocks[ 0 ].clientId,
					message: `Inserted pattern ${ pattern.title || pattern.name }.`,
				};
			} catch ( error ) {
				return {
					success: false,
					clientId: '',
					message:
						error instanceof Error
							? error.message
							: 'Failed to insert pattern.',
				};
			}
		},
	} );
}

/**
 * Register all pattern-related abilities
 */
export function registerPatternAbilities(): void {
	registerSearchPatternsAbility();
	registerInsertPatternAbility();
}
