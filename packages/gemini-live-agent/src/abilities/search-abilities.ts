/**
 * WordPress dependencies
 */
import { select } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { AGENT_CATEGORY } from './block-abilities';
import { registerAbility, getAbility } from '@wordpress/abilities';
import { resolveSelect } from '@wordpress/data';

/**
 * Register the Openverse search ability
 */
export function registerSearchOpenverseAbility(): void {
	if ( getAbility( 'agent/search-openverse' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/search-openverse',
		label: 'Search Openverse',
		description: 'Searches Openverse for public domain images',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				search: {
					type: 'string',
					description: 'Search query for Openverse images',
				},
				perPage: {
					type: 'integer',
					description: 'Number of results to return (max 50)',
				},
				page: {
					type: 'integer',
					description: 'Result page (1-based)',
				},
			},
			required: [ 'search' ],
		},
		output_schema: {
			type: 'object',
			properties: {
				results: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							id: { type: 'string' },
							title: { type: 'string' },
							creator: { type: 'string' },
							url: { type: 'string' },
							thumbnail: { type: 'string' },
							license: { type: 'string' },
							license_version: { type: 'string' },
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
		callback: async ( input: {
			search: string;
			perPage?: number;
			page?: number;
		} ) => {
			const defaultArgs = {
				mature: false,
				excluded_source: 'flickr,inaturalist,wikimedia',
				license: 'pdm,cc0',
			};
			const perPage = Math.min( Math.max( input.perPage || 10, 1 ), 50 );
			const page = Math.max( input.page || 1, 1 );
			const query = {
				...defaultArgs,
				page_size: perPage,
				page,
				q: input.search,
			};

			const url = new URL( 'https://api.openverse.org/v1/images/' );
			Object.entries( query ).forEach( ( [ key, value ] ) => {
				url.searchParams.set( key, String( value ) );
			} );

			const response = await window.fetch( url.toString(), {
				headers: {
					'User-Agent': 'WordPress/openverse-ability',
				},
			} );

			if ( ! response.ok ) {
				throw new Error( 'Failed to fetch Openverse results.' );
			}

			const jsonResponse = await response.json();
			const results = Array.isArray( jsonResponse.results )
				? jsonResponse.results
				: [];

			return {
				results: results.map( ( result: any ) => ( {
					id: result.id,
					title:
						result.title?.toLowerCase().startsWith( 'file:' )
							? result.title.slice( 5 )
							: result.title,
					creator: result.creator || '',
					url: result.url || '',
					thumbnail: result.thumbnail || '',
					license: result.license || '',
					license_version: result.license_version || '',
					source: result.source || '',
				} ) ),
			};
		},
	} );
}

/**
 * Register the search posts ability
 */
export function registerSearchPostsAbility(): void {
	if ( getAbility( 'agent/search-posts' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/search-posts',
		label: 'Search Posts',
		description: 'Searches posts by title/content',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				search: {
					type: 'string',
					description: 'Search query',
				},
				postType: {
					type: 'string',
					description: 'Post type (default: post)',
				},
				postStatus: {
					type: 'string',
					description:
						'Optional post status filter (e.g. publish, draft, pending, private, future, trash)',
				},
				perPage: {
					type: 'integer',
					description: 'Results per page (max 20)',
				},
			},
			required: [ 'search' ],
		},
		output_schema: {
			type: 'object',
			properties: {
				results: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							id: { type: 'integer' },
							title: { type: 'string' },
							link: { type: 'string' },
							status: { type: 'string' },
							type: { type: 'string' },
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
			search: string;
			postType?: string;
			postStatus?: string;
			perPage?: number;
		} ) => {
			const type = input.postType || 'post';
			const perPage = Math.min( Math.max( input.perPage || 10, 1 ), 20 );
			const postStatus = input.postStatus?.trim();
			const query: Record< string, string | number > = {
				search: input.search,
				per_page: perPage,
				context:
					postStatus && postStatus !== 'publish'
						? 'edit'
						: 'view',
			};
			if ( postStatus ) {
				query.status = postStatus;
			}

			// @ts-ignore core store types are not exposed here.
			const results = select( 'core' ).getEntityRecords(
				'postType',
				type,
				query
			);

			if ( ! results ) {
				return { results: [] };
			}

			return {
				results: results.map( ( item: any ) => ( {
					id: item.id,
					title: item.title?.rendered || '',
					link: item.link || '',
					status: item.status || '',
					type: item.type || type,
				} ) ),
			};
		},
	} );
}

/**
 * Register the search content ability (posts, pages, and other types)
 */
export function registerSearchContentAbility(): void {
	if ( getAbility( 'agent/search-content' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/search-content',
		label: 'Search Content',
		description: 'Searches posts, pages, or other post types',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				search: {
					type: 'string',
					description: 'Search query',
				},
				postTypes: {
					type: 'array',
					items: { type: 'string' },
					description: 'Post types to search (default: post,page)',
				},
				perPage: {
					type: 'integer',
					description: 'Results per page (max 20)',
				},
			},
			required: [ 'search' ],
		},
		output_schema: {
			type: 'object',
			properties: {
				results: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							id: { type: 'integer' },
							title: { type: 'string' },
							link: { type: 'string' },
							status: { type: 'string' },
							type: { type: 'string' },
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
			search: string;
			postTypes?: string[];
			perPage?: number;
		} ) => {
			const types =
				input.postTypes && input.postTypes.length > 0
					? input.postTypes
					: [ 'post', 'page' ];
			const perPage = Math.min( Math.max( input.perPage || 10, 1 ), 20 );
			const query = {
				search: input.search,
				per_page: perPage,
				context: 'view',
			};

			const results = [];
			for ( const type of types ) {
				// @ts-ignore core store types are not exposed here.
				const records = await resolveSelect( 'core' ).getEntityRecords(
					'postType',
					type,
					query
				);

				if ( Array.isArray( records ) ) {
					for ( const item of records ) {
						results.push( {
							id: item.id,
							title: item.title?.rendered || '',
							link: item.link || '',
							status: item.status || '',
							type: item.type || type,
						} );
					}
				}
			}

			return { results };
		},
	} );
}

/**
 * Exa API configuration
 */
const EXA_API_URL = 'https://api.exa.ai/search';

type GeminiRuntimeConfig = {
	exaApiKey?: string;
};

function getExaApiKey(): string {
	try {
		const runtimeConfig = (
			window as Window & {
				gutenbergGeminiAgentConfig?: GeminiRuntimeConfig;
			}
		).gutenbergGeminiAgentConfig;
		const runtimeKey = runtimeConfig?.exaApiKey?.trim();
		if ( runtimeKey ) {
			return runtimeKey;
		}
	} catch {
		// Ignore runtime config read errors.
	}

	try {
		const stored = localStorage
			.getItem( 'gutenberg_exa_api_key' )
			?.trim();
		if ( stored ) {
			return stored;
		}
	} catch {
		// Ignore localStorage read errors.
	}

	return '';
}

/**
 * Register the web search ability (powered by Exa)
 */
export function registerSearchWebAbility(): void {
	if ( getAbility( 'agent/search-web' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/search-web',
		label: 'Search the Web',
		description:
			'Searches the web via Exa search. Defaults to instant mode for low-latency lookups of docs, references, news, and external content.',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'Search query — can be a question or topic',
				},
				numResults: {
					type: 'integer',
					description:
						'Number of results to return (1-10, default 5)',
				},
				type: {
					type: 'string',
					enum: [ 'instant', 'auto', 'fast', 'neural', 'deep' ],
					description:
						'Search type: "instant" (default) for lowest latency, "auto" for balanced quality/speed, "fast" for streamlined retrieval, "neural" for semantic search, "deep" for expanded retrieval',
				},
				includeDomains: {
					type: 'array',
					items: { type: 'string' },
					description:
						'Only include results from these domains (e.g. ["developer.wordpress.org", "github.com"])',
				},
				excludeDomains: {
					type: 'array',
					items: { type: 'string' },
					description:
						'Exclude results from these domains',
				},
				startPublishedDate: {
					type: 'string',
					description:
						'Only include results published after this date (ISO 8601, e.g. "2025-01-01T00:00:00.000Z")',
				},
			},
			required: [ 'query' ],
		},
		output_schema: {
			type: 'object',
			properties: {
				results: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							title: { type: 'string' },
							url: { type: 'string' },
							highlights: {
								type: 'array',
								items: { type: 'string' },
							},
							author: { type: 'string' },
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
			query: string;
			numResults?: number;
			type?: 'instant' | 'auto' | 'fast' | 'neural' | 'deep';
			includeDomains?: string[];
			excludeDomains?: string[];
			startPublishedDate?: string;
		} ) => {
			const exaApiKey = getExaApiKey();
			if ( ! exaApiKey ) {
				throw new Error(
					'Missing Exa API key. Set window.gutenbergGeminiAgentConfig.exaApiKey or localStorage key "gutenberg_exa_api_key".'
				);
			}

			const numResults = Math.min(
				Math.max( input.numResults || 5, 1 ),
				10
			);

			const requestedType =
				typeof input.type === 'string' ? input.type : '';
			const searchType =
				requestedType === 'keyword'
					? 'fast'
					: requestedType || 'instant';

			const body: Record< string, any > = {
				query: input.query,
				numResults,
				type: searchType,
				contents: {
					highlights: {
						maxCharacters: 3000,
					},
				},
			};

			if ( input.includeDomains && input.includeDomains.length > 0 ) {
				body.includeDomains = input.includeDomains;
			}
			if ( input.excludeDomains && input.excludeDomains.length > 0 ) {
				body.excludeDomains = input.excludeDomains;
			}
			if ( input.startPublishedDate ) {
				body.startPublishedDate = input.startPublishedDate;
			}

			const response = await window.fetch( EXA_API_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': exaApiKey,
				},
				body: JSON.stringify( body ),
			} );

			if ( ! response.ok ) {
				const errorText = await response.text().catch( () => '' );
				throw new Error(
					`Exa search failed (${ response.status }): ${ errorText }`
				);
			}

			const json = await response.json();
			const results = Array.isArray( json.results )
				? json.results
				: [];

			return {
				results: results.map( ( result: any ) => ( {
					title: result.title || '',
					url: result.url || '',
					highlights: Array.isArray( result.highlights )
						? result.highlights
						: [],
					author: result.author || '',
				} ) ),
			};
		},
	} );
}

/**
 * Register all search abilities
 */
export function registerSearchAbilities(): void {
	registerSearchOpenverseAbility();
	registerSearchPostsAbility();
	registerSearchContentAbility();
	registerSearchWebAbility();
}
