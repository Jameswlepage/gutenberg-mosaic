/**
 * WordPress dependencies
 */
import { dispatch, resolveSelect, select } from '@wordpress/data';
import { parse, serialize } from '@wordpress/blocks';
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

function setEditedPostContent( content: string ): void {
	const editor = dispatch( 'core/editor' ) as {
		editPost?: ( payload: { content: string } ) => void;
	};
	const blockEditor = dispatch( blockEditorStore ) as {
		resetBlocks?: ( blocks: Array< unknown > ) => void;
	};

	if ( typeof editor?.editPost === 'function' ) {
		editor.editPost( { content } );
	}

	if ( typeof blockEditor?.resetBlocks === 'function' ) {
		const blocks = parse( content, { __unstableSkipMigrationLogs: true } );
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

			const record = await resolveSelect( coreDataStore ).getEntityRecord(
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

			const record = await resolveSelect( coreDataStore ).getEntityRecord(
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
