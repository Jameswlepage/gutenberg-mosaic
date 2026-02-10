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
				results: results.map( ( result ) => ( {
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
			perPage?: number;
		} ) => {
			const type = input.postType || 'post';
			const perPage = Math.min( Math.max( input.perPage || 10, 1 ), 20 );
			const query = {
				search: input.search,
				per_page: perPage,
				context: 'view',
			};

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
				results: results.map( ( item ) => ( {
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
 * Register all search abilities
 */
export function registerSearchAbilities(): void {
	registerSearchOpenverseAbility();
	registerSearchPostsAbility();
	registerSearchContentAbility();
}
