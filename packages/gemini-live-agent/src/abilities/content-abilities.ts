/**
 * WordPress dependencies
 */
import { dispatch, resolveSelect, select } from '@wordpress/data';
import { parse, serialize, pasteHandler } from '@wordpress/blocks';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as coreDataStore } from '@wordpress/core-data';
import { getAbility, registerAbility } from '@wordpress/abilities';

/**
 * Internal dependencies
 */
import { AGENT_CATEGORY } from './block-abilities';

function clampPerPage( value: number | undefined, max: number ) {
	const fallback = 10;
	const perPage = value ?? fallback;
	return Math.min( Math.max( perPage, 1 ), max );
}

function isPlainObject( value: unknown ): value is Record< string, unknown > {
	return (
		!! value &&
		typeof value === 'object' &&
		! Array.isArray( value )
	);
}

function mergeDeep(
	base: Record< string, unknown >,
	patch: Record< string, unknown >
): Record< string, unknown > {
	const result: Record< string, unknown > = { ...base };
	for ( const [ key, value ] of Object.entries( patch ) ) {
		if ( isPlainObject( value ) && isPlainObject( result[ key ] ) ) {
			result[ key ] = mergeDeep(
				result[ key ] as Record< string, unknown >,
				value
			);
		} else {
			result[ key ] = value;
		}
	}
	return result;
}

function getCurrentPost(): { postId: number | null; postType: string | null } {
	const editor = select( 'core/editor' ) as {
		getCurrentPostId?: () => number | null;
		getCurrentPostType?: () => string | null;
	};

	return {
		postId: editor?.getCurrentPostId?.() ?? null,
		postType: editor?.getCurrentPostType?.() ?? null,
	};
}

type NavigateToEntityRecord = ( input: {
	postId: number;
	postType: string;
} ) => void;

function getEditorEntityNavigator(): NavigateToEntityRecord | null {
	const blockEditor = select( blockEditorStore ) as {
		getSettings?: () => {
			onNavigateToEntityRecord?: unknown;
		};
	};
	const callback = blockEditor?.getSettings?.()?.onNavigateToEntityRecord;

	return typeof callback === 'function'
		? ( callback as NavigateToEntityRecord )
		: null;
}

function getEditedPostContent(): string {
	const editor = select( 'core/editor' ) as {
		getEditedPostContent?: () => string;
	};

	if ( typeof editor?.getEditedPostContent === 'function' ) {
		return editor.getEditedPostContent() || '';
	}

	const blockEditor = select( blockEditorStore ) as {
		getBlocks?: () => Array< unknown >;
	};

	if ( typeof blockEditor?.getBlocks === 'function' ) {
		return serialize( blockEditor.getBlocks() || [] );
	}

	const current = getCurrentPost();
	if ( ! current.postId || ! current.postType ) {
		return '';
	}

	const record = select( coreDataStore ).getEditedEntityRecord(
		'postType',
		current.postType,
		current.postId
	) as { content?: string } | undefined;

	return record?.content || '';
}

function contentToBlocks( content: string ): Array< unknown > {
	// If content already contains block delimiters, parse directly.
	if ( content.indexOf( '<!-- wp:' ) !== -1 ) {
		return parse( content, { __unstableSkipMigrationLogs: true } );
	}

	// Otherwise treat as markdown/plain text and convert to blocks.
	// pasteHandler runs showdown (markdown → HTML) then converts to blocks.
	const blocks = pasteHandler( {
		plainText: content,
		mode: 'BLOCKS',
	} );

	return Array.isArray( blocks ) ? blocks : [];
}

function setEditedPostContent( content: string ): void {
	const editor = dispatch( 'core/editor' ) as {
		editPost?: ( payload: { content: string } ) => void;
	};
	const blockEditor = dispatch( blockEditorStore ) as {
		resetBlocks?: ( blocks: Array< unknown > ) => void;
	};

	const blocks = contentToBlocks( content );

	// Serialize the blocks back to block markup so editPost gets valid content.
	const blockContent = serialize( blocks );

	if ( typeof editor?.editPost === 'function' ) {
		editor.editPost( { content: blockContent } );
	}

	if ( typeof blockEditor?.resetBlocks === 'function' ) {
		blockEditor.resetBlocks( blocks );
	}
}

function hashString( value: string ): string {
	let hash = 0;
	for ( let i = 0; i < value.length; i++ ) {
		hash = ( hash << 5 ) - hash + value.charCodeAt( i );
		hash |= 0;
	}
	return `${ value.length }:${ Math.abs( hash ) }`;
}

/**
 * Register update title ability
 */
export function registerUpdatePostTitleAbility(): void {
	if ( getAbility( 'agent/update-post-title' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/update-post-title',
		label: 'Update Post Title',
		description: 'Updates the title of a post or page',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				title: {
					type: 'string',
					description: 'New title text',
				},
				postId: {
					type: 'integer',
					description: 'Post ID (defaults to current post)',
				},
				postType: {
					type: 'string',
					description: 'Post type (defaults to current post type)',
				},
			},
			required: [ 'title' ],
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
		callback: async ( input: {
			title: string;
			postId?: number;
			postType?: string;
		} ) => {
			const current = getCurrentPost();
			const postId = input.postId ?? current.postId;
			const postType = input.postType ?? current.postType;

			if ( ! postId || ! postType ) {
				return { success: false, message: 'No post context available.' };
			}

			if ( postId === current.postId ) {
				dispatch( 'core/editor' ).editPost( { title: input.title } );
			} else {
				dispatch( coreDataStore ).editEntityRecord(
					'postType',
					postType,
					postId,
					{ title: input.title }
				);
			}

			return { success: true, message: 'Post title updated.' };
		},
	} );
}

/**
 * Register update post meta ability
 */
export function registerUpdatePostMetaAbility(): void {
	if ( getAbility( 'agent/update-post-meta' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/update-post-meta',
		label: 'Update Post Meta',
		description: 'Updates custom fields on a post or page',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				meta: {
					type: 'object',
					description: 'Meta fields to merge into the post',
				},
				postId: {
					type: 'integer',
					description: 'Post ID (defaults to current post)',
				},
				postType: {
					type: 'string',
					description: 'Post type (defaults to current post type)',
				},
			},
			required: [ 'meta' ],
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
		callback: async ( input: {
			meta: Record< string, unknown >;
			postId?: number;
			postType?: string;
		} ) => {
			const current = getCurrentPost();
			const postId = input.postId ?? current.postId;
			const postType = input.postType ?? current.postType;

			if ( ! postId || ! postType ) {
				return { success: false, message: 'No post context available.' };
			}

			if ( postId === current.postId ) {
				dispatch( 'core/editor' ).editPost( { meta: input.meta } );
			} else {
				dispatch( coreDataStore ).editEntityRecord(
					'postType',
					postType,
					postId,
					{ meta: input.meta }
				);
			}

			return { success: true, message: 'Post meta updated.' };
		},
	} );
}

function getPostFields() {
	const current = getCurrentPost();
	if ( ! current.postId || ! current.postType ) {
		return {
			postId: null,
			postType: null,
			title: '',
			slug: '',
			status: '',
			date: '',
			dateGmt: '',
			author: null,
			template: '',
			parent: null,
			commentStatus: '',
			pingStatus: '',
		};
	}

	const record = select( coreDataStore ).getEditedEntityRecord(
		'postType',
		current.postType,
		current.postId
	) as Record< string, unknown > | undefined;

	return {
		postId: current.postId,
		postType: current.postType,
		title: ( record?.title as string ) || '',
		slug: ( record?.slug as string ) || '',
		status: ( record?.status as string ) || '',
		date: ( record?.date as string ) || '',
		dateGmt: ( record?.date_gmt as string ) || '',
		author: ( record?.author as number ) ?? null,
		template: ( record?.template as string ) || '',
		parent: ( record?.parent as number ) ?? null,
		commentStatus: ( record?.comment_status as string ) || '',
		pingStatus: ( record?.ping_status as string ) || '',
	};
}

type PostTemplateOption = {
	id: number | null;
	slug: string;
	title: string;
	source: string;
	isCustom: boolean;
};

function stripHtmlTags( value: string ): string {
	return value.replace( /<[^>]*>/g, ' ' ).replace( /\s+/g, ' ' ).trim();
}

function normalizeTemplateValue( value: string ): string {
	return value.toLowerCase().trim().replace( /\s+/g, ' ' );
}

function getEntityTitleFromRecord( record: Record< string, unknown > ): string {
	const rawTitle = record.title;

	if ( typeof rawTitle === 'string' ) {
		const stripped = stripHtmlTags( rawTitle );
		if ( stripped ) {
			return stripped;
		}
	}

	if ( isPlainObject( rawTitle ) ) {
		const rendered = rawTitle.rendered;
		if ( typeof rendered === 'string' ) {
			const stripped = stripHtmlTags( rendered );
			if ( stripped ) {
				return stripped;
			}
		}
		const raw = rawTitle.raw;
		if ( typeof raw === 'string' ) {
			const stripped = stripHtmlTags( raw );
			if ( stripped ) {
				return stripped;
			}
		}
	}

	if ( typeof record.slug === 'string' && record.slug ) {
		return record.slug;
	}

	if ( typeof record.id === 'number' ) {
		return `#${ record.id }`;
	}

	return 'Untitled';
}

function toTemplateTitle( template: Record< string, unknown > ): string {
	const rawTitle = template.title;

	if ( typeof rawTitle === 'string' ) {
		const stripped = stripHtmlTags( rawTitle );
		if ( stripped ) {
			return stripped;
		}
	}

	if ( isPlainObject( rawTitle ) ) {
		const rendered = rawTitle.rendered;
		if ( typeof rendered === 'string' ) {
			const stripped = stripHtmlTags( rendered );
			if ( stripped ) {
				return stripped;
			}
		}
	}

	const slug =
		typeof template.slug === 'string'
			? template.slug
			: typeof template.name === 'string'
			? template.name
			: '';

	return slug || 'Untitled template';
}

async function getPostTemplatesForType(
	postType: string,
	search?: string,
	perPage?: number
): Promise< PostTemplateOption[] > {
	const records = ( await resolveSelect( coreDataStore ).getEntityRecords(
		'postType',
		'wp_template',
		{
			per_page: -1,
			post_type: postType,
			context: 'edit',
		}
	) ) as Array< Record< string, unknown > > | null;

	const normalizedSearch = search
		? normalizeTemplateValue( search )
		: '';

	const templates = Array.isArray( records )
		? records
				.map( ( template ) => {
					const slug =
						typeof template.slug === 'string'
							? template.slug
							: typeof template.name === 'string'
							? template.name
							: '';
					if ( ! slug ) {
						return null;
					}

					const source =
						typeof template.source === 'string'
							? template.source
							: ( template.is_custom ? 'custom' : 'theme' );

					return {
						id:
							typeof template.id === 'number' ? template.id : null,
						slug,
						title: toTemplateTitle( template ),
						source,
						isCustom: Boolean( template.is_custom ),
					} as PostTemplateOption;
				} )
				.filter(
					(
						template
					): template is PostTemplateOption => template !== null
				)
		: [];

	const withDefault: PostTemplateOption[] = [
		{
			id: null,
			slug: '',
			title: 'Default template',
			source: 'default',
			isCustom: false,
		},
		...templates,
	];

	const filtered = normalizedSearch
		? withDefault.filter( ( template ) =>
				normalizeTemplateValue( template.title ).includes(
					normalizedSearch
				)
		  )
		: withDefault;

	const maxResults =
		typeof perPage === 'number' ? clampPerPage( perPage, 100 ) : 100;
	return filtered.slice( 0, maxResults );
}

/**
 * Register get post fields ability
 */
export function registerGetPostFieldsAbility(): void {
	if ( getAbility( 'agent/get-post-fields' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/get-post-fields',
		label: 'Get Post Fields',
		description: 'Returns post settings like status, dates, slug, author, and template',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {},
		},
		output_schema: {
			type: 'object',
			properties: {
				postId: { type: [ 'integer', 'null' ] },
				postType: { type: [ 'string', 'null' ] },
				title: { type: 'string' },
				slug: { type: 'string' },
				status: { type: 'string' },
				date: { type: 'string' },
				dateGmt: { type: 'string' },
				author: { type: [ 'integer', 'null' ] },
				template: { type: 'string' },
				parent: { type: [ 'integer', 'null' ] },
				commentStatus: { type: 'string' },
				pingStatus: { type: 'string' },
			},
		},
		meta: {
			annotations: {
				readonly: true,
				idempotent: true,
			},
		},
		callback: async () => getPostFields(),
	} );
}

/**
 * Register update post fields ability
 */
export function registerUpdatePostFieldsAbility(): void {
	if ( getAbility( 'agent/update-post-fields' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/update-post-fields',
		label: 'Update Post Fields',
		description: 'Updates post settings like status, dates, slug, author, template, or discussion',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				title: { type: 'string' },
				slug: { type: 'string' },
				status: { type: 'string' },
				date: { type: 'string' },
				dateGmt: { type: 'string' },
				author: { type: 'integer' },
				template: { type: 'string' },
				parent: { type: 'integer' },
				commentStatus: { type: 'string' },
				pingStatus: { type: 'string' },
				postId: { type: 'integer' },
				postType: { type: 'string' },
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
		callback: async ( input: {
			title?: string;
			slug?: string;
			status?: string;
			date?: string;
			dateGmt?: string;
			author?: number;
			template?: string;
			parent?: number;
			commentStatus?: string;
			pingStatus?: string;
			postId?: number;
			postType?: string;
		} ) => {
			const current = getCurrentPost();
			const postId = input.postId ?? current.postId;
			const postType = input.postType ?? current.postType;

			if ( ! postId || ! postType ) {
				return { success: false, message: 'No post context available.' };
			}

			const payload: Record< string, unknown > = {};
			if ( typeof input.title === 'string' ) payload.title = input.title;
			if ( typeof input.slug === 'string' ) payload.slug = input.slug;
			if ( typeof input.status === 'string' ) payload.status = input.status;
			if ( typeof input.date === 'string' ) payload.date = input.date;
			if ( typeof input.dateGmt === 'string' )
				payload.date_gmt = input.dateGmt;
			if ( typeof input.author === 'number' ) payload.author = input.author;
			if ( typeof input.template === 'string' )
				payload.template = input.template;
			if ( typeof input.parent === 'number' ) payload.parent = input.parent;
			if ( typeof input.commentStatus === 'string' )
				payload.comment_status = input.commentStatus;
			if ( typeof input.pingStatus === 'string' )
				payload.ping_status = input.pingStatus;

			if ( Object.keys( payload ).length === 0 ) {
				return { success: false, message: 'No fields provided.' };
			}

			if ( postId === current.postId ) {
				dispatch( 'core/editor' ).editPost( payload );
			} else {
				dispatch( coreDataStore ).editEntityRecord(
					'postType',
					postType,
					postId,
					payload
				);
			}

			return { success: true, message: 'Post fields updated.' };
		},
	} );
}

/**
 * Register create post ability
 */
export function registerCreatePostAbility(): void {
	if ( getAbility( 'agent/create-post' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/create-post',
		label: 'Create Post',
		description:
			'Creates a new page or custom post type item and can open it in the editor.',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				postType: {
					type: 'string',
					description:
						'Post type to create (defaults to "page", but can be any CPT slug).',
				},
				title: {
					type: 'string',
					description: 'Post title (defaults to "Untitled").',
				},
				status: {
					type: 'string',
					description:
						'Initial status (defaults to "draft"). Common values: draft, publish, pending, private.',
				},
				slug: {
					type: 'string',
					description: 'Optional post slug.',
				},
				content: {
					type: 'string',
					description: 'Optional post content.',
				},
				excerpt: {
					type: 'string',
					description: 'Optional excerpt.',
				},
				template: {
					type: 'string',
					description: 'Optional template slug.',
				},
				navigate: {
					type: 'boolean',
					description:
						'Whether to navigate to the created item in the editor (default: true).',
				},
			},
		},
		output_schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				message: { type: 'string' },
				postId: { type: [ 'integer', 'null' ] },
				postType: { type: 'string' },
				title: { type: 'string' },
				status: { type: 'string' },
				link: { type: 'string' },
			},
		},
		meta: {
			annotations: {
				destructive: true,
				idempotent: false,
			},
		},
		callback: async ( input: {
			postType?: string;
			title?: string;
			status?: string;
			slug?: string;
			content?: string;
			excerpt?: string;
			template?: string;
			navigate?: boolean;
		} ) => {
			const postType =
				typeof input.postType === 'string' && input.postType.trim()
					? input.postType.trim()
					: 'page';
			const title =
				typeof input.title === 'string' && input.title.trim()
					? input.title.trim()
					: 'Untitled';
			const status =
				typeof input.status === 'string' && input.status.trim()
					? input.status.trim()
					: 'draft';
			const payload: Record< string, unknown > = {
				title,
				status,
			};

			if ( typeof input.slug === 'string' && input.slug.trim() ) {
				payload.slug = input.slug.trim();
			}
			if ( typeof input.content === 'string' ) {
				payload.content = input.content;
			}
			if ( typeof input.excerpt === 'string' ) {
				payload.excerpt = input.excerpt;
			}
			if ( typeof input.template === 'string' ) {
				payload.template = input.template;
			}

			try {
				const created = ( await dispatch(
					coreDataStore
				).saveEntityRecord(
					'postType',
					postType,
					payload,
					{ throwOnError: true }
				) ) as Record< string, unknown >;

				const postId =
					typeof created?.id === 'number' ? created.id : null;
				const createdTitle = isPlainObject( created )
					? getEntityTitleFromRecord( created )
					: title;
				const createdStatus =
					typeof created?.status === 'string'
						? created.status
						: status;
				const navigate =
					typeof input.navigate === 'boolean'
						? input.navigate
						: true;

				if ( navigate && postId ) {
					const onNavigate = getEditorEntityNavigator();
					onNavigate?.( {
						postId,
						postType,
					} );
				}

				return {
					success: Boolean( postId ),
					message: postId
						? `Created ${ postType } "${ createdTitle }".`
						: `Created ${ postType }.`,
					postId,
					postType,
					title: createdTitle,
					status: createdStatus,
					link: typeof created?.link === 'string' ? created.link : '',
				};
			} catch ( error ) {
				return {
					success: false,
					message:
						error instanceof Error
							? error.message
							: `Failed to create ${ postType }.`,
					postId: null,
					postType,
					title,
					status,
					link: '',
				};
			}
		},
	} );
}

/**
 * Register site editor navigation ability
 */
export function registerNavigateSiteEditorAbility(): void {
	if ( getAbility( 'agent/navigate-site-editor' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/navigate-site-editor',
		label: 'Navigate Site Editor',
		description:
			'Navigates to a post, page, or template entity in the Site Editor using native editor navigation.',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				postId: {
					type: 'integer',
					description:
						'Entity ID to navigate to. Provide this directly when known.',
				},
				postType: {
					type: 'string',
					description:
						'Post type to open (defaults to "page"). Can also be wp_template, wp_template_part, etc.',
				},
				title: {
					type: 'string',
					description:
						'Optional title query used to resolve postId when postId is not provided.',
				},
			},
		},
		output_schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				message: { type: 'string' },
				postId: { type: [ 'integer', 'null' ] },
				postType: { type: 'string' },
				title: { type: 'string' },
				matches: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							postId: { type: 'integer' },
							title: { type: 'string' },
							status: { type: 'string' },
						},
					},
				},
			},
		},
		meta: {
			annotations: {
				readonly: false,
				idempotent: true,
			},
		},
		callback: async ( input: {
			postId?: number;
			postType?: string;
			title?: string;
		} ) => {
			const onNavigate = getEditorEntityNavigator();
			const postType =
				typeof input.postType === 'string' && input.postType.trim()
					? input.postType.trim()
					: 'page';

			if ( ! onNavigate ) {
				return {
					success: false,
					message:
						'Site editor navigation is not available in this context.',
					postId: null,
					postType,
					title: '',
					matches: [],
				};
			}

			let postId =
				typeof input.postId === 'number' ? input.postId : null;
			let resolvedTitle = '';
			let matches: Array< {
				postId: number;
				title: string;
				status: string;
			} > = [];

			if ( ! postId && typeof input.title === 'string' ) {
				const search = input.title.trim();
				if ( search ) {
					const records = ( await resolveSelect(
						coreDataStore
					).getEntityRecords( 'postType', postType, {
						search,
						per_page: 20,
						context: 'edit',
					} ) ) as Array< Record< string, unknown > > | null;

					matches = Array.isArray( records )
						? records
								.map( ( record ) => {
									const id =
										typeof record.id === 'number'
											? record.id
											: null;
									if ( ! id ) {
										return null;
									}
									return {
										postId: id,
										title: getEntityTitleFromRecord(
											record
										),
										status:
											typeof record.status === 'string'
												? record.status
												: '',
									};
								} )
								.filter(
									(
										match
									): match is {
										postId: number;
										title: string;
										status: string;
									} => match !== null
								)
						: [];

					const normalizedSearch =
						normalizeTemplateValue( search );
					const exactMatches = matches.filter(
						( match ) =>
							normalizeTemplateValue( match.title ) ===
							normalizedSearch
					);
					const startsWithMatches = matches.filter(
						( match ) =>
							normalizeTemplateValue( match.title ).startsWith(
								normalizedSearch
							)
					);
					const partialMatches = matches.filter( ( match ) =>
						normalizeTemplateValue( match.title ).includes(
							normalizedSearch
						)
					);

					if ( exactMatches.length === 1 ) {
						postId = exactMatches[ 0 ].postId;
						resolvedTitle = exactMatches[ 0 ].title;
					} else if ( startsWithMatches.length === 1 ) {
						postId = startsWithMatches[ 0 ].postId;
						resolvedTitle = startsWithMatches[ 0 ].title;
					} else if ( partialMatches.length === 1 ) {
						postId = partialMatches[ 0 ].postId;
						resolvedTitle = partialMatches[ 0 ].title;
					}
				}
			}

			if ( ! postId ) {
				return {
					success: false,
					message:
						'Could not resolve a target. Provide postId or a more specific title.',
					postId: null,
					postType,
					title: '',
					matches: matches.slice( 0, 10 ),
				};
			}

			if ( ! resolvedTitle ) {
				const record = select( coreDataStore ).getEntityRecord(
					'postType',
					postType,
					postId
				) as Record< string, unknown > | undefined;
				if ( record ) {
					resolvedTitle = getEntityTitleFromRecord( record );
				}
			}

			onNavigate( { postId, postType } );

			return {
				success: true,
				message: resolvedTitle
					? `Navigated to "${ resolvedTitle }".`
					: `Navigated to ${ postType } ${ postId }.`,
				postId,
				postType,
				title: resolvedTitle,
				matches: [],
			};
		},
	} );
}

/**
 * Register list post templates ability
 */
export function registerListPostTemplatesAbility(): void {
	if ( getAbility( 'agent/list-post-templates' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/list-post-templates',
		label: 'List Post Templates',
		description: 'Lists available templates for the current post type',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				search: {
					type: 'string',
					description: 'Optional template title search text',
				},
				postType: {
					type: 'string',
					description: 'Post type (defaults to current post type)',
				},
				perPage: {
					type: 'integer',
					description: 'Maximum templates to return (max 100)',
				},
			},
		},
		output_schema: {
			type: 'object',
			properties: {
				templates: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							id: { type: [ 'integer', 'null' ] },
							slug: { type: 'string' },
							title: { type: 'string' },
							source: { type: 'string' },
							isCustom: { type: 'boolean' },
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
			postType?: string;
			perPage?: number;
		} ) => {
			const current = getCurrentPost();
			const postType = input.postType ?? current.postType;

			if ( ! postType ) {
				return { templates: [] };
			}

			const templates = await getPostTemplatesForType(
				postType,
				input.search,
				input.perPage
			);

			return { templates };
		},
	} );
}

/**
 * Register switch post template ability
 */
export function registerSwitchPostTemplateAbility(): void {
	if ( getAbility( 'agent/switch-post-template' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/switch-post-template',
		label: 'Switch Post Template',
		description:
			'Switches the current post template by template title or slug',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				templateTitle: {
					type: 'string',
					description:
						'Template title to match (for example "Default template" or "Page with Sidebar")',
				},
				templateSlug: {
					type: 'string',
					description:
						'Template slug to apply directly (for example "page-with-sidebar")',
				},
				postType: {
					type: 'string',
					description: 'Post type (defaults to current post type)',
				},
			},
		},
		output_schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				message: { type: 'string' },
				templateSlug: { type: 'string' },
				templateTitle: { type: 'string' },
				matches: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							slug: { type: 'string' },
							title: { type: 'string' },
						},
					},
				},
			},
		},
		meta: {
			annotations: {
				destructive: true,
				idempotent: false,
			},
		},
		callback: async ( input: {
			templateTitle?: string;
			templateSlug?: string;
			postType?: string;
		} ) => {
			const current = getCurrentPost();
			const postType = input.postType ?? current.postType;

			if ( ! current.postId || ! postType ) {
				return {
					success: false,
					message: 'No post context available.',
					templateSlug: '',
					templateTitle: '',
					matches: [],
				};
			}

			const templateTitle =
				typeof input.templateTitle === 'string'
					? input.templateTitle.trim()
					: '';
			const templateSlug =
				typeof input.templateSlug === 'string'
					? input.templateSlug.trim()
					: '';

			if ( ! templateTitle && ! templateSlug ) {
				return {
					success: false,
					message: 'Provide templateTitle or templateSlug.',
					templateSlug: '',
					templateTitle: '',
					matches: [],
				};
			}

			const templates = await getPostTemplatesForType( postType );
			let match: PostTemplateOption | undefined;

			if ( templateSlug ) {
				match = templates.find(
					( template ) => template.slug === templateSlug
				);
			}

			if ( ! match && templateTitle ) {
				const targetTitle = normalizeTemplateValue(
					templateTitle
				);
				const exactMatches = templates.filter(
					( template ) =>
						normalizeTemplateValue( template.title ) ===
						targetTitle
				);
				const startsWithMatches = templates.filter(
					( template ) =>
						normalizeTemplateValue( template.title ).startsWith(
							targetTitle
						)
				);
				const partialMatches = templates.filter( ( template ) =>
					normalizeTemplateValue( template.title ).includes(
						targetTitle
					)
				);

				if ( exactMatches.length === 1 ) {
					match = exactMatches[ 0 ];
				} else if ( exactMatches.length > 1 ) {
					return {
						success: false,
						message:
							'Multiple templates matched this title. Please be more specific.',
						templateSlug: '',
						templateTitle: '',
						matches: exactMatches
							.slice( 0, 10 )
							.map( ( template ) => ( {
								slug: template.slug,
								title: template.title,
							} ) ),
					};
				} else if ( startsWithMatches.length === 1 ) {
					match = startsWithMatches[ 0 ];
				} else if ( startsWithMatches.length > 1 ) {
					return {
						success: false,
						message:
							'Multiple templates matched this title. Please be more specific.',
						templateSlug: '',
						templateTitle: '',
						matches: startsWithMatches
							.slice( 0, 10 )
							.map( ( template ) => ( {
								slug: template.slug,
								title: template.title,
							} ) ),
					};
				} else if ( partialMatches.length === 1 ) {
					match = partialMatches[ 0 ];
				} else if ( partialMatches.length > 1 ) {
					return {
						success: false,
						message:
							'Multiple templates matched this title. Please be more specific.',
						templateSlug: '',
						templateTitle: '',
						matches: partialMatches
							.slice( 0, 10 )
							.map( ( template ) => ( {
								slug: template.slug,
								title: template.title,
							} ) ),
					};
				}
			}

			if ( ! match ) {
				return {
					success: false,
					message:
						'No matching template found. Use list-post-templates first.',
					templateSlug: '',
					templateTitle: '',
					matches: templates.slice( 0, 10 ).map( ( template ) => ( {
						slug: template.slug,
						title: template.title,
					} ) ),
				};
			}

			dispatch( 'core/editor' ).editPost( { template: match.slug } );

			return {
				success: true,
				message: `Template switched to "${ match.title }".`,
				templateSlug: match.slug,
				templateTitle: match.title,
				matches: [],
			};
		},
	} );
}

/**
 * Register list revisions ability
 */
export function registerListPostRevisionsAbility(): void {
	if ( getAbility( 'agent/list-post-revisions' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/list-post-revisions',
		label: 'List Post Revisions',
		description: 'Lists recent revisions for the current post',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				postId: { type: 'integer' },
				postType: { type: 'string' },
				perPage: { type: 'integer' },
			},
		},
		output_schema: {
			type: 'object',
			properties: {
				revisions: { type: 'array' },
			},
		},
		meta: {
			annotations: {
				readonly: true,
				idempotent: true,
			},
		},
		callback: async ( input: {
			postId?: number;
			postType?: string;
			perPage?: number;
		} ) => {
			const current = getCurrentPost();
			const postId = input.postId ?? current.postId;
			const postType = input.postType ?? current.postType;

			if ( ! postId || ! postType ) {
				return { revisions: [] };
			}

			const perPage = clampPerPage( input.perPage, 20 );
			const revisions =
				( await resolveSelect( coreDataStore ).getEntityRecords(
					'postType',
					`revision/${ postType }`,
					{ parent: postId, per_page: perPage }
				) ) || [];

			return { revisions };
		},
	} );
}

/**
 * Register restore revision ability
 */
export function registerRestorePostRevisionAbility(): void {
	if ( getAbility( 'agent/restore-post-revision' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/restore-post-revision',
		label: 'Restore Post Revision',
		description: 'Restores a specific revision for the current post',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				revisionId: { type: 'integer' },
				postId: { type: 'integer' },
				postType: { type: 'string' },
			},
			required: [ 'revisionId' ],
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
		callback: async ( input: {
			revisionId: number;
			postId?: number;
			postType?: string;
		} ) => {
			const current = getCurrentPost();
			const postId = input.postId ?? current.postId;
			const postType = input.postType ?? current.postType;

			if ( ! postId || ! postType ) {
				return { success: false, message: 'No post context available.' };
			}

			try {
				await dispatch( coreDataStore ).saveEntityRecord(
					'postType',
					`revision/${ postType }`,
					{ id: input.revisionId },
					{ parent: postId }
				);
				return { success: true, message: 'Revision restored.' };
			} catch ( error ) {
				return {
					success: false,
					message:
						error instanceof Error
							? error.message
							: 'Failed to restore revision.',
				};
			}
		},
	} );
}

/**
 * Register search and replace document ability
 */
export function registerSearchReplaceDocumentAbility(): void {
	if ( getAbility( 'agent/search-replace-document' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/search-replace-document',
		label: 'Search and Replace Document',
		description: 'Searches and replaces across the entire document content',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				search: {
					type: 'string',
					description: 'Search string or regex pattern',
				},
				replace: {
					type: 'string',
					description: 'Replacement string',
				},
				useRegex: {
					type: 'boolean',
					description: 'Interpret search as regex',
				},
				regexFlags: {
					type: 'string',
					description: 'Regex flags (default: g)',
				},
				limit: {
					type: 'integer',
					description: 'Maximum replacements to apply',
				},
			},
			required: [ 'search', 'replace' ],
		},
		output_schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				replacements: { type: 'integer' },
				message: { type: 'string' },
			},
		},
		meta: {
			annotations: {
				destructive: true,
				idempotent: false,
			},
		},
		callback: async ( input: {
			search: string;
			replace: string;
			useRegex?: boolean;
			regexFlags?: string;
			limit?: number;
		} ) => {
			const currentContent = getEditedPostContent();
			if ( ! currentContent ) {
				return {
					success: false,
					replacements: 0,
					message: 'No document content found.',
				};
			}

			let nextContent = currentContent;
			let replacements = 0;

			if ( input.useRegex ) {
				const flags = input.regexFlags || 'g';
				const regex = new RegExp( input.search, flags );
				if ( input.limit && input.limit > 0 ) {
					nextContent = currentContent.replace(
						regex,
						( match, ...args ) => {
							if ( replacements >= input.limit! ) {
								return match;
							}
							replacements++;
							return input.replace;
						}
					);
				} else {
					nextContent = currentContent.replace( regex, () => {
						replacements++;
						return input.replace;
					} );
				}
			} else {
				const search = input.search;
				if ( search === '' ) {
					return {
						success: false,
						replacements: 0,
						message: 'Search string is empty.',
					};
				}

				let cursor = 0;
				let result = '';
				const limit = input.limit && input.limit > 0 ? input.limit : null;

				while ( cursor < currentContent.length ) {
					const index = currentContent.indexOf( search, cursor );
					if ( index === -1 ) {
						result += currentContent.slice( cursor );
						break;
					}
					if ( limit && replacements >= limit ) {
						result += currentContent.slice( cursor );
						break;
					}
					result +=
						currentContent.slice( cursor, index ) + input.replace;
					replacements++;
					cursor = index + search.length;
				}

				nextContent = result;
			}

			if ( replacements === 0 ) {
				return {
					success: false,
					replacements: 0,
					message: 'No matches found.',
				};
			}

			setEditedPostContent( nextContent );

			return {
				success: true,
				replacements,
				message: 'Document updated.',
			};
		},
	} );
}

/**
 * Register apply document diff ability
 */
export function registerApplyDocumentDiffAbility(): void {
	if ( getAbility( 'agent/apply-document-diff' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/apply-document-diff',
		label: 'Apply Document Diff',
		description:
			'Applies a diff by replacing the document when the "before" content matches',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				before: {
					type: 'string',
					description: 'Expected current document content',
				},
				after: {
					type: 'string',
					description: 'New document content to replace with',
				},
			},
			required: [ 'before', 'after' ],
		},
		output_schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				message: { type: 'string' },
				currentHash: { type: 'string' },
			},
		},
		meta: {
			annotations: {
				destructive: true,
				idempotent: false,
			},
		},
		callback: async ( input: { before: string; after: string } ) => {
			const currentContent = getEditedPostContent();
			const currentHash = hashString( currentContent );

			if ( currentContent !== input.before ) {
				return {
					success: false,
					message: 'Document content has changed. Diff not applied.',
					currentHash,
				};
			}

			setEditedPostContent( input.after );
			return {
				success: true,
				message: 'Document updated.',
				currentHash,
			};
		},
	} );
}

/**
 * Register save post ability
 */
export function registerSavePostAbility(): void {
	if ( getAbility( 'agent/save-post' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/save-post',
		label: 'Save Post',
		description: 'Saves the current post',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {},
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
		callback: async () => {
			try {
				await dispatch( 'core/editor' ).savePost();
				return { success: true, message: 'Post saved.' };
			} catch ( error ) {
				return {
					success: false,
					message:
						error instanceof Error
							? error.message
							: 'Failed to save post.',
				};
			}
		},
	} );
}

/**
 * Register publish post ability
 */
export function registerUpdatePostStatusAbility(): void {
	if ( getAbility( 'agent/update-post-status' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/update-post-status',
		label: 'Update Post Status',
		description: 'Updates the current post status (publish, draft, private, etc.)',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				status: {
					type: 'string',
					description:
						'New status (publish, draft, private, pending, future)',
				},
			},
			required: [ 'status' ],
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
		callback: async ( input: { status: string } ) => {
			try {
				dispatch( 'core/editor' ).editPost( { status: input.status } );
				await dispatch( 'core/editor' ).savePost();
				return { success: true, message: 'Post status updated.' };
			} catch ( error ) {
				return {
					success: false,
					message:
						error instanceof Error
							? error.message
							: 'Failed to update post status.',
				};
			}
		},
	} );
}

/**
 * Register publish post ability (alias)
 */
export function registerPublishPostAbility(): void {
	if ( getAbility( 'agent/publish-post' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/publish-post',
		label: 'Publish Post',
		description: 'Publishes the current post',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {},
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
		callback: async () => {
			try {
				dispatch( 'core/editor' ).editPost( { status: 'publish' } );
				await dispatch( 'core/editor' ).savePost();
				return { success: true, message: 'Post published.' };
			} catch ( error ) {
				return {
					success: false,
					message:
						error instanceof Error
							? error.message
							: 'Failed to publish post.',
				};
			}
		},
	} );
}

/**
 * Register get global styles ability
 */
export function registerGetGlobalStylesAbility(): void {
	if ( getAbility( 'agent/get-global-styles' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/get-global-styles',
		label: 'Get Global Styles',
		description: 'Returns the current global styles record',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				includeSettings: {
					type: 'boolean',
					description: 'Include settings in the response',
				},
			},
		},
		output_schema: {
			type: 'object',
			properties: {
				id: { type: 'integer' },
				title: { type: 'string' },
				styles: { type: 'object' },
				settings: { type: 'object' },
			},
		},
		meta: {
			annotations: {
				readonly: true,
				idempotent: true,
			},
		},
		callback: async ( input: { includeSettings?: boolean } ) => {
			const globalStylesId = await resolveSelect(
				coreDataStore
			).__experimentalGetCurrentGlobalStylesId();

			if ( ! globalStylesId ) {
				return {
					id: 0,
					title: '',
					styles: {},
					settings: {},
				};
			}

			const record: any = await resolveSelect( coreDataStore ).getEntityRecord(
				'root',
				'globalStyles',
				Number( globalStylesId )
			);

			return {
				id: record?.id || Number( globalStylesId ),
				title: record?.title?.rendered || record?.title || '',
				styles: record?.styles || {},
				settings: input.includeSettings ? record?.settings || {} : {},
			};
		},
	} );
}

/**
 * Register update global styles ability
 */
export function registerUpdateGlobalStylesAbility(): void {
	if ( getAbility( 'agent/update-global-styles' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/update-global-styles',
		label: 'Update Global Styles',
		description: 'Updates the current global styles record',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				styles: {
					type: 'object',
					description: 'Styles to merge into global styles',
				},
				settings: {
					type: 'object',
					description: 'Settings to merge into global styles',
				},
				title: {
					type: 'string',
					description: 'Optional title for the styles record',
				},
			},
		},
		output_schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				message: { type: 'string' },
				id: { type: 'integer' },
			},
		},
		meta: {
			annotations: {
				destructive: true,
				idempotent: false,
			},
		},
		callback: async ( input: {
			styles?: Record< string, unknown >;
			settings?: Record< string, unknown >;
			title?: string;
		} ) => {
			const globalStylesId = await resolveSelect(
				coreDataStore
			).__experimentalGetCurrentGlobalStylesId();

			if ( ! globalStylesId ) {
				return {
					success: false,
					message: 'Global styles not available.',
					id: 0,
				};
			}

			const record: any = await resolveSelect( coreDataStore ).getEntityRecord(
				'root',
				'globalStyles',
				Number( globalStylesId )
			);

			const nextStyles = input.styles
				? mergeDeep( record?.styles || {}, input.styles )
				: record?.styles || {};
			const nextSettings = input.settings
				? mergeDeep( record?.settings || {}, input.settings )
				: record?.settings || {};

			const saved = await dispatch( coreDataStore ).saveEntityRecord(
				'root',
				'globalStyles',
				{
					id: Number( globalStylesId ),
					styles: nextStyles,
					settings: nextSettings,
					title: input.title ?? record?.title,
				},
				{ throwOnError: true }
			);

			return {
				success: true,
				message: 'Global styles updated.',
				id: saved?.id || Number( globalStylesId ),
			};
		},
	} );
}

/**
 * Register all content abilities
 */
export function registerContentAbilities(): void {
	registerUpdatePostTitleAbility();
	registerUpdatePostMetaAbility();
	registerGetPostFieldsAbility();
	registerUpdatePostFieldsAbility();
	registerCreatePostAbility();
	registerNavigateSiteEditorAbility();
	registerListPostTemplatesAbility();
	registerSwitchPostTemplateAbility();
	registerListPostRevisionsAbility();
	registerRestorePostRevisionAbility();
	registerSavePostAbility();
	registerUpdatePostStatusAbility();
	registerPublishPostAbility();
	registerGetGlobalStylesAbility();
	registerUpdateGlobalStylesAbility();
	registerSearchReplaceDocumentAbility();
	registerApplyDocumentDiffAbility();
}
