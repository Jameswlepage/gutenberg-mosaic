/**
 * WordPress dependencies
 */
import { dispatch, resolveSelect, select } from '@wordpress/data';
import { createBlock } from '@wordpress/blocks';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { getAbility, registerAbility } from '@wordpress/abilities';

/**
 * Internal dependencies
 */
import { AGENT_CATEGORY } from './block-abilities';
import type { InsertMediaLibraryImageInput } from '../types';
import { store as geminiAgentStore } from '../store';

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
 * Register insert media library image ability
 */
export function registerInsertMediaLibraryImageAbility(): void {
	if ( getAbility( 'agent/insert-media-library-image' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/insert-media-library-image',
		label: 'Insert Media Library Image',
		description:
			'Finds an existing image in the Media Library (by ID or search) and inserts it as a core/image block, or replaces a target image block.',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				mediaId: {
					type: 'integer',
					description:
						'Attachment ID to insert (preferred when known).',
				},
				search: {
					type: 'string',
					description:
						'Search query to find an existing image when mediaId is not provided.',
				},
				mediaType: {
					type: 'string',
					description:
						'Optional media type filter (default: "image").',
					enum: [ 'image', 'video', 'audio' ],
				},
				perPage: {
					type: 'integer',
					description:
						'Search result size when using search (max 20, default 10).',
				},
				position: {
					type: 'string',
					enum: [ 'before', 'after', 'first', 'last' ],
					description:
						'Where to insert relative to targetClientId or selected block (default: "after").',
				},
				targetClientId: {
					type: 'string',
					description:
						'Reference block for insertion, or image block to replace when replaceTarget=true.',
				},
				replaceTarget: {
					type: 'boolean',
					description:
						'If true and targetClientId is a core/image block, replace it instead of inserting a new block.',
				},
			},
		},
		output_schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				message: { type: 'string' },
				clientId: { type: 'string' },
				mediaId: { type: 'integer' },
				imageUrl: { type: 'string' },
			},
		},
		meta: {
			annotations: {
				readonly: false,
				idempotent: false,
				destructive: true,
			},
		},
		callback: async ( input: InsertMediaLibraryImageInput ) => {
			try {
				const requestedMediaType =
					( input.mediaType || 'image' ).toLowerCase();
				let attachment: any = null;

				if ( typeof input.mediaId === 'number' ) {
					// @ts-ignore core store types are not exposed here.
					attachment = await resolveSelect( 'core' ).getEntityRecord(
						'postType',
						'attachment',
						input.mediaId
					);

					if ( ! attachment ) {
						return {
							success: false,
							message: `Media item ${ input.mediaId } was not found.`,
							clientId: '',
							mediaId: 0,
							imageUrl: '',
						};
					}
				}

				if ( ! attachment ) {
					const searchTerm = ( input.search || '' ).trim();
					if ( ! searchTerm ) {
						return {
							success: false,
							message:
								'Provide mediaId or search to select an existing Media Library image.',
							clientId: '',
							mediaId: 0,
							imageUrl: '',
						};
					}

					const perPage = Math.min(
						Math.max( input.perPage || 10, 1 ),
						20
					);
					const query: Record< string, unknown > = {
						per_page: perPage,
						context: 'view',
						search: searchTerm,
					};

					if ( requestedMediaType ) {
						query.media_type = requestedMediaType;
					}

					// @ts-ignore core store types are not exposed here.
					const records = await resolveSelect( 'core' ).getEntityRecords(
						'postType',
						'attachment',
						query
					);

					if ( ! Array.isArray( records ) || records.length === 0 ) {
						return {
							success: false,
							message: `No media found for "${ searchTerm }".`,
							clientId: '',
							mediaId: 0,
							imageUrl: '',
						};
					}

					attachment = records[ 0 ];
				}

				const mediaType = (
					attachment.media_type ||
					attachment.mime_type?.split( '/' )?.[ 0 ] ||
					''
				).toLowerCase();
				if ( requestedMediaType && mediaType !== requestedMediaType ) {
					return {
						success: false,
						message: `Selected media is "${ mediaType }", not "${ requestedMediaType }".`,
						clientId: '',
						mediaId: 0,
						imageUrl: '',
					};
				}

				if ( mediaType !== 'image' ) {
					return {
						success: false,
						message:
							'Only image attachments can be inserted with this tool.',
						clientId: '',
						mediaId: 0,
						imageUrl: '',
					};
				}

				const imageUrl = attachment.source_url || '';
				const mediaId = attachment.id || 0;
				if ( ! imageUrl || ! mediaId ) {
					return {
						success: false,
						message:
							'Selected media is missing attachment ID or source URL.',
						clientId: '',
						mediaId: 0,
						imageUrl: '',
					};
				}

				const altText =
					attachment.alt_text ||
					attachment.title?.rendered ||
					'';

				const {
					insertBlock,
					selectBlock,
					updateBlockAttributes,
				} = dispatch( blockEditorStore );
				const {
					getBlock,
					getSelectedBlockClientId,
					getBlockRootClientId,
					getBlockIndex,
					getBlocks,
				} = select( blockEditorStore );

				const resolvedTargetId =
					input.targetClientId || getSelectedBlockClientId() || '';
				const shouldReplace = !! input.replaceTarget;

				if ( shouldReplace && resolvedTargetId ) {
					const targetBlock = getBlock( resolvedTargetId );
					if (
						! targetBlock ||
						targetBlock.name !== 'core/image'
					) {
						return {
							success: false,
							message: `Block ${ resolvedTargetId } is not a core/image block.`,
							clientId: '',
							mediaId,
							imageUrl,
						};
					}

					updateBlockAttributes( resolvedTargetId, {
						id: mediaId,
						url: imageUrl,
						alt: altText,
					} );
					dispatch( geminiAgentStore ).setActiveBlockClientId(
						resolvedTargetId
					);

					return {
						success: true,
						message: `Updated image block using media item ${ mediaId }.`,
						clientId: resolvedTargetId,
						mediaId,
						imageUrl,
					};
				}

				const block = createBlock( 'core/image', {
					id: mediaId,
					url: imageUrl,
					alt: altText,
				} );

				const position = input.position || 'after';
				let rootClientId: string | undefined;
				let index: number | undefined;

				if ( resolvedTargetId && getBlock( resolvedTargetId ) ) {
					rootClientId =
						getBlockRootClientId( resolvedTargetId ) ||
						undefined;
					const targetIndex = getBlockIndex( resolvedTargetId );

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
					message: `Inserted media library image ${ mediaId }.`,
					clientId: block.clientId,
					mediaId,
					imageUrl,
				};
			} catch ( error ) {
				return {
					success: false,
					message:
						error instanceof Error
							? error.message
							: 'Failed to insert media library image.',
					clientId: '',
					mediaId: 0,
					imageUrl: '',
				};
			}
		},
	} );
}

/**
 * Register all media abilities
 */
export function registerMediaAbilities(): void {
	registerOpenMediaLibraryAbility();
	registerSearchMediaLibraryAbility();
	registerInsertMediaLibraryImageAbility();
}
