/**
 * WordPress dependencies
 */
import { resolveSelect } from '@wordpress/data';
import { store as coreDataStore } from '@wordpress/core-data';
import { getAbility, registerAbility } from '@wordpress/abilities';

/**
 * Internal dependencies
 */
import { AGENT_CATEGORY } from './block-abilities';

function formatUser( user: any ) {
	return {
		id: user.id ?? 0,
		name: user.name || '',
		slug: user.slug || '',
		email: user.email || '',
		description: user.description || '',
		link: user.link || '',
		avatarUrl:
			user.avatar_urls?.[ '96' ] ||
			user.avatar_urls?.[ '48' ] ||
			'',
		roles: Array.isArray( user.roles ) ? user.roles : [],
	};
}

/**
 * Register get user by ID ability
 */
export function registerGetUserAbility(): void {
	if ( getAbility( 'agent/get-user' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/get-user',
		label: 'Get User',
		description:
			'Resolves a user/author ID to name, avatar, roles, and profile details.',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				userId: {
					type: 'integer',
					description: 'The user/author ID to look up',
				},
			},
			required: [ 'userId' ],
		},
		output_schema: {
			type: 'object',
			properties: {
				found: { type: 'boolean' },
				user: {
					type: 'object',
					properties: {
						id: { type: 'integer' },
						name: { type: 'string' },
						slug: { type: 'string' },
						email: { type: 'string' },
						description: { type: 'string' },
						link: { type: 'string' },
						avatarUrl: { type: 'string' },
						roles: {
							type: 'array',
							items: { type: 'string' },
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
		callback: async ( input: { userId: number } ) => {
			try {
				const user: any = await resolveSelect(
					coreDataStore
				).getEntityRecord( 'root', 'user', input.userId );

				if ( ! user ) {
					return { found: false, user: null };
				}

				return { found: true, user: formatUser( user ) };
			} catch {
				return { found: false, user: null };
			}
		},
	} );
}

/**
 * Register search users ability
 */
export function registerSearchUsersAbility(): void {
	if ( getAbility( 'agent/search-users' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/search-users',
		label: 'Search Users',
		description:
			'Searches WordPress users by name, slug, or email.',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				search: {
					type: 'string',
					description: 'Search query (name, slug, or email)',
				},
				perPage: {
					type: 'integer',
					description: 'Number of results (1-20, default 10)',
				},
				roles: {
					type: 'array',
					items: { type: 'string' },
					description:
						'Filter by roles (e.g. ["author", "editor"])',
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
							name: { type: 'string' },
							slug: { type: 'string' },
							email: { type: 'string' },
							description: { type: 'string' },
							link: { type: 'string' },
							avatarUrl: { type: 'string' },
							roles: {
								type: 'array',
								items: { type: 'string' },
							},
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
			roles?: string[];
		} ) => {
			const perPage = Math.min(
				Math.max( input.perPage || 10, 1 ),
				20
			);
			const query: Record< string, any > = {
				search: input.search,
				per_page: perPage,
				context: 'view',
			};

			if ( input.roles && input.roles.length > 0 ) {
				query.roles = input.roles.join( ',' );
			}

			try {
				const users: any =
					await resolveSelect( coreDataStore ).getEntityRecords(
						'root',
						'user',
						query
					);

				if ( ! Array.isArray( users ) ) {
					return { results: [] };
				}

				return {
					results: users.map( ( user: any ) =>
						formatUser( user )
					),
				};
			} catch {
				return { results: [] };
			}
		},
	} );
}

/**
 * Register the get current user ability
 */
export function registerGetCurrentUserAbility(): void {
	if ( getAbility( 'agent/get-current-user' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/get-current-user',
		label: 'Get Current User',
		description: 'Returns the currently logged-in user\'s information.',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {},
		},
		output_schema: {
			type: 'object',
			properties: {
				user: {
					type: 'object',
					properties: {
						id: { type: 'integer' },
						name: { type: 'string' },
						slug: { type: 'string' },
						email: { type: 'string' },
						description: { type: 'string' },
						link: { type: 'string' },
						avatarUrl: { type: 'string' },
						roles: {
							type: 'array',
							items: { type: 'string' },
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
		callback: async () => {
			try {
				const user: any =
					await resolveSelect( coreDataStore ).getCurrentUser();

				if ( ! user ) {
					return { user: null };
				}

				return { user: formatUser( user ) };
			} catch {
				return { user: null };
			}
		},
	} );
}

/**
 * Register all user abilities
 */
export function registerUserAbilities(): void {
	registerGetUserAbility();
	registerSearchUsersAbility();
	registerGetCurrentUserAbility();
}
