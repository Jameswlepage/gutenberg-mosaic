/**
 * WordPress dependencies
 */
import { resolveSelect } from '@wordpress/data';
import { getAbility, registerAbility } from '@wordpress/abilities';

/**
 * Internal dependencies
 */
import { AGENT_CATEGORY } from './block-abilities';

/**
 * Register open media library ability
 */
export function registerOpenMediaLibraryAbility(): void {
	if ( getAbility( 'agent/open-media-library' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/open-media-library',
		label: 'Open Media Library',
		description: 'Opens the WordPress media library modal',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				mediaType: {
					type: 'string',
					description: 'Optional media type filter (image, video, audio)',
				},
				multiple: {
					type: 'boolean',
					description: 'Allow multiple selection',
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
				readonly: false,
				idempotent: false,
			},
		},
		callback: async ( input: {
			mediaType?: string;
			multiple?: boolean;
		} ) => {
			const { wp } = window as Window & {
				wp?: { media?: ( options: Record< string, unknown > ) => any };
			};

			if ( ! wp?.media ) {
				return {
					success: false,
					message: 'Media library is not available.',
				};
			}

			const frame = wp.media( {
				title: 'Media Library',
				multiple: !! input.multiple,
				library: input.mediaType
					? { type: input.mediaType }
					: undefined,
			} );

			frame.open();

			return {
				success: true,
				message: 'Media library opened.',
			};
		},
	} );
}

/**
 * Register search media library ability
 */
export function registerSearchMediaLibraryAbility(): void {
	if ( getAbility( 'agent/search-media-library' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/search-media-library',
		label: 'Search Media Library',
		description: 'Searches the media library for attachments',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				search: {
					type: 'string',
					description: 'Search query',
				},
				mediaType: {
					type: 'string',
					description: 'Filter by media type (image, video, audio)',
				},
				perPage: {
					type: 'integer',
					description: 'Results per page (max 20)',
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
							id: { type: 'integer' },
							title: { type: 'string' },
							url: { type: 'string' },
							mediaType: { type: 'string' },
							mimeType: { type: 'string' },
							altText: { type: 'string' },
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
			search?: string;
			mediaType?: string;
			perPage?: number;
		} ) => {
			const perPage = Math.min( Math.max( input.perPage || 10, 1 ), 20 );
			const query: Record< string, unknown > = {
				per_page: perPage,
				context: 'view',
			};

			if ( input.search ) {
				query.search = input.search;
			}

			if ( input.mediaType ) {
				query.media_type = input.mediaType;
			}

			// @ts-ignore core store types are not exposed here.
			const records = await resolveSelect( 'core' ).getEntityRecords(
				'postType',
				'attachment',
				query
			);

			if ( ! Array.isArray( records ) ) {
				return { results: [] };
			}

			return {
				results: records.map( ( item ) => ( {
					id: item.id,
					title: item.title?.rendered || '',
					url: item.source_url || '',
					mediaType: item.media_type || '',
					mimeType: item.mime_type || '',
					altText: item.alt_text || '',
				} ) ),
			};
		},
	} );
}

/**
 * Register all media abilities
 */
export function registerMediaAbilities(): void {
	registerOpenMediaLibraryAbility();
	registerSearchMediaLibraryAbility();
}
