/**
 * WordPress dependencies
 */
import { dispatch, select } from '@wordpress/data';
import { createBlock } from '@wordpress/blocks';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { getAbility, registerAbility } from '@wordpress/abilities';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { AGENT_CATEGORY } from './block-abilities';
import { store as geminiAgentStore } from '../store';

/**
 * fal.ai API endpoints
 */
const FAL_IMAGEN4_URL = 'https://fal.run/fal-ai/imagen4/preview';
const FAL_GEMINI_FLASH_EDIT_URL = 'https://fal.run/fal-ai/gemini-flash-edit';

type GeminiRuntimeConfig = {
	falApiKey?: string;
};

function getFalApiKey(): string {
	try {
		const runtimeConfig = (
			window as Window & {
				gutenbergGeminiAgentConfig?: GeminiRuntimeConfig;
			}
		).gutenbergGeminiAgentConfig;
		const runtimeKey = runtimeConfig?.falApiKey?.trim();
		if ( runtimeKey ) {
			return runtimeKey;
		}
	} catch {
		// Ignore runtime config read errors.
	}

	try {
		const stored = localStorage
			.getItem( 'gutenberg_fal_api_key' )
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
 * Supported aspect ratios and their numeric values.
 */
const ASPECT_RATIOS: { ratio: string; value: number }[] = [
	{ ratio: '1:1', value: 1 },
	{ ratio: '4:3', value: 4 / 3 },
	{ ratio: '3:4', value: 3 / 4 },
	{ ratio: '16:9', value: 16 / 9 },
	{ ratio: '9:16', value: 9 / 16 },
];

/**
 * Given pixel dimensions, return the closest supported aspect ratio string.
 */
function detectAspectRatio(
	width: number,
	height: number
): string {
	if ( ! width || ! height ) {
		return '1:1';
	}
	const actual = width / height;
	let best = ASPECT_RATIOS[ 0 ];
	let bestDiff = Math.abs( actual - best.value );
	for ( const entry of ASPECT_RATIOS ) {
		const diff = Math.abs( actual - entry.value );
		if ( diff < bestDiff ) {
			best = entry;
			bestDiff = diff;
		}
	}
	return best.ratio;
}

/**
 * Load an image URL and return its natural dimensions.
 */
function getImageDimensions(
	url: string
): Promise< { width: number; height: number } > {
	return new Promise( ( resolve, reject ) => {
		const img = new Image();
		img.onload = () =>
			resolve( { width: img.naturalWidth, height: img.naturalHeight } );
		img.onerror = reject;
		img.src = url;
	} );
}

function blobToDataUrl( blob: Blob ): Promise< string > {
	return new Promise( ( resolve, reject ) => {
		const reader = new FileReader();
		reader.onload = () => resolve( String( reader.result || '' ) );
		reader.onerror = () =>
			reject(
				new Error( 'Failed to convert image blob to data URL.' )
			);
		reader.readAsDataURL( blob );
	} );
}

async function resolveFalReferenceImageUrl(
	rawUrl: string
): Promise< string > {
	const trimmed = rawUrl.trim();
	if ( ! trimmed ) {
		return '';
	}

	if ( trimmed.startsWith( 'data:' ) ) {
		return trimmed;
	}

	const normalized = new URL(
		trimmed,
		window.location.origin
	).toString();

	// Always pass reference images as Base64 data URLs for consistent behavior.
	const imageResponse = await window.fetch( normalized );
	if ( ! imageResponse.ok ) {
		throw new Error(
			`Failed to fetch reference image (${ imageResponse.status }).`
		);
	}

	const imageBlob = await imageResponse.blob();
	return blobToDataUrl( imageBlob );
}

/**
 * Register the generate-image ability
 */
export function registerGenerateImageAbility(): void {
	if ( getAbility( 'agent/generate-image' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/generate-image',
		label: 'Generate Image',
		description:
			'Generates a brand-new image from a text prompt (Imagen4), uploads to media library, and inserts or replaces an image block. Use only when the user explicitly asks for AI generation or when no suitable existing media-library image is available.',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				prompt: {
					type: 'string',
					description:
						'Detailed image description — include subject, style, lighting, colors, and mood.',
				},
				aspect_ratio: {
					type: 'string',
					enum: [ '1:1', '16:9', '9:16', '4:3', '3:4' ],
					description:
						'Aspect ratio (default: "1:1"). Auto-detected from selected image block.',
				},
				targetClientId: {
					type: 'string',
					description:
						'Client ID of an image block to replace. Auto-detected from selection.',
				},
				position: {
					type: 'string',
					enum: [ 'before', 'after', 'first', 'last' ],
					description:
						'Where to insert a new image block (default: "after"). Ignored with targetClientId.',
				},
			},
			required: [ 'prompt' ],
		},
		output_schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				message: { type: 'string' },
				clientId: { type: 'string' },
				imageUrl: { type: 'string' },
			},
		},
		meta: {
			annotations: {
				destructive: true,
				idempotent: false,
			},
		},
		callback: async ( input: {
			prompt: string;
			aspect_ratio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
			targetClientId?: string;
			position?: 'before' | 'after' | 'first' | 'last';
		} ) => {
			try {
				const falApiKey = getFalApiKey();
				if ( ! falApiKey ) {
					return {
						success: false,
						message:
							'Missing fal.ai API key. Set window.gutenbergGeminiAgentConfig.falApiKey or localStorage key "gutenberg_fal_api_key".',
						clientId: '',
						imageUrl: '',
					};
				}

				const {
					insertBlock,
					selectBlock,
					updateBlockAttributes,
				} = dispatch( blockEditorStore );
				const {
					getSelectedBlockClientId,
					getBlockRootClientId,
					getBlockIndex,
					getBlocks,
					getBlock,
				} = select( blockEditorStore );

				// Resolve target: explicit targetClientId, or auto-detect selected image block.
				let resolvedTargetId = input.targetClientId || '';
				if ( ! resolvedTargetId ) {
					const selectedId = getSelectedBlockClientId();
					if ( selectedId ) {
						const selectedBlock = getBlock( selectedId );
						if (
							selectedBlock &&
							selectedBlock.name === 'core/image'
						) {
							resolvedTargetId = selectedId;
						}
					}
				}

				// Match aspect ratio from the target image block if not explicitly set.
				let aspectRatio = input.aspect_ratio || '';
				if ( ! aspectRatio && resolvedTargetId ) {
					const targetBlock = getBlock( resolvedTargetId );
					const targetUrl = targetBlock?.attributes?.url;
					if ( targetUrl ) {
						try {
							const dims =
								await getImageDimensions( targetUrl );
							aspectRatio = detectAspectRatio(
								dims.width,
								dims.height
							);
						} catch {
							// Fall back to default.
						}
					}
				}
				if ( ! aspectRatio ) {
					aspectRatio = '1:1';
				}

				// 1. Call fal.ai Imagen4 API.
				const falResponse = await window.fetch( FAL_IMAGEN4_URL, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Key ${ falApiKey }`,
					},
					body: JSON.stringify( {
						prompt: input.prompt,
						aspect_ratio: aspectRatio,
					} ),
				} );

				if ( ! falResponse.ok ) {
					const errorText = await falResponse
						.text()
						.catch( () => '' );
					return {
						success: false,
						message: `Image generation failed (${ falResponse.status }): ${ errorText }`,
						clientId: '',
						imageUrl: '',
					};
				}

				const falResult = await falResponse.json();
				const generatedImageUrl =
					falResult?.images?.[ 0 ]?.url ||
					falResult?.image?.url ||
					'';

				if ( ! generatedImageUrl ) {
					return {
						success: false,
						message:
							'Image generation succeeded but no image URL was returned.',
						clientId: '',
						imageUrl: '',
					};
				}

				// 2. Fetch the generated image as a blob.
				const imageResponse = await window.fetch(
					generatedImageUrl
				);
				if ( ! imageResponse.ok ) {
					return {
						success: false,
						message: `Failed to download generated image (${ imageResponse.status }).`,
						clientId: '',
						imageUrl: '',
					};
				}

				const imageBlob = await imageResponse.blob();
				const imageFile = new File(
					[ imageBlob ],
					'ai-generated-image.png',
					{ type: imageBlob.type || 'image/png' }
				);

				// 3. Upload to WordPress media library.
				const formData = new FormData();
				formData.append( 'file', imageFile, 'ai-generated-image.png' );

				const attachment: any = await apiFetch( {
					path: '/wp/v2/media',
					method: 'POST',
					body: formData,
				} );

				const wpImageUrl =
					attachment?.source_url || generatedImageUrl;
				const attachmentId = attachment?.id;

				// If we have a target image block, update it in place.
				if ( resolvedTargetId ) {
					const targetBlock = getBlock( resolvedTargetId );
					if (
						! targetBlock ||
						targetBlock.name !== 'core/image'
					) {
						return {
							success: false,
							message: `Block ${ resolvedTargetId } is not a core/image block or was not found.`,
							clientId: '',
							imageUrl: wpImageUrl,
						};
					}

					updateBlockAttributes( resolvedTargetId, {
						url: wpImageUrl,
						id: attachmentId,
						alt: input.prompt,
					} );

					dispatch( geminiAgentStore ).setActiveBlockClientId(
						resolvedTargetId
					);

					return {
						success: true,
						message: `Updated image block with AI-generated image.`,
						clientId: resolvedTargetId,
						imageUrl: wpImageUrl,
					};
				}

				// Otherwise, insert a new core/image block.
				const block = createBlock( 'core/image', {
					url: wpImageUrl,
					id: attachmentId,
					alt: input.prompt,
				} );

				const position = input.position || 'after';
				const selectedClientId = getSelectedBlockClientId();

				let rootClientId: string | undefined;
				let index: number | undefined;

				if ( selectedClientId ) {
					rootClientId =
						getBlockRootClientId( selectedClientId ) ||
						undefined;
					const selectedIndex =
						getBlockIndex( selectedClientId );

					switch ( position ) {
						case 'before':
							index = selectedIndex;
							break;
						case 'after':
							index = selectedIndex + 1;
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
					message: `Generated and inserted AI image.`,
					clientId: block.clientId,
					imageUrl: wpImageUrl,
				};
			} catch ( error ) {
				return {
					success: false,
					message:
						error instanceof Error
							? error.message
							: 'Failed to generate image',
					clientId: '',
					imageUrl: '',
				};
			}
		},
	} );
}

/**
 * Register the edit-image ability (Gemini Flash Edit — image-to-image)
 */
export function registerEditImageAbility(): void {
	if ( getAbility( 'agent/edit-image' ) ) {
		return;
	}

	registerAbility( {
		name: 'agent/edit-image',
		label: 'Edit Image',
		description:
			'Edits an existing image using a text prompt (Gemini Flash Edit). Auto-detects the selected image block as reference. Uploads result to media library.',
		category: AGENT_CATEGORY,
		input_schema: {
			type: 'object',
			properties: {
				prompt: {
					type: 'string',
					description:
						'Description of the edit (e.g. "Make the sky orange", "Remove background").',
				},
				image_url: {
					type: 'string',
					description:
						'Reference image URL. Auto-read from selected image block if omitted.',
				},
				targetClientId: {
					type: 'string',
					description:
						'Client ID of an image block to use as reference and replace with the result.',
				},
				position: {
					type: 'string',
					enum: [ 'before', 'after', 'first', 'last' ],
					description:
						'Where to insert a new image block (default: "after"). Ignored with targetClientId.',
				},
			},
			required: [ 'prompt' ],
		},
		output_schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean' },
				message: { type: 'string' },
				clientId: { type: 'string' },
				imageUrl: { type: 'string' },
			},
		},
		meta: {
			annotations: {
				destructive: true,
				idempotent: false,
			},
		},
		callback: async ( input: {
			prompt: string;
			image_url?: string;
			targetClientId?: string;
			position?: 'before' | 'after' | 'first' | 'last';
		} ) => {
			let shimmerTargetId: string | null = null;
			try {
				const falApiKey = getFalApiKey();
				if ( ! falApiKey ) {
					return {
						success: false,
						message:
							'Missing fal.ai API key. Set window.gutenbergGeminiAgentConfig.falApiKey or localStorage key "gutenberg_fal_api_key".',
						clientId: '',
						imageUrl: '',
					};
				}

				const {
					getBlock,
					getSelectedBlockClientId,
				} = select( blockEditorStore );

				// Auto-detect selected image block if no targetClientId.
				let resolvedTargetId = input.targetClientId || '';
				if ( ! resolvedTargetId ) {
					const selectedId = getSelectedBlockClientId();
					if ( selectedId ) {
						const selectedBlock = getBlock( selectedId );
						if (
							selectedBlock &&
							selectedBlock.name === 'core/image'
						) {
							resolvedTargetId = selectedId;
						}
					}
				}

				if ( resolvedTargetId ) {
					const targetBlock = getBlock( resolvedTargetId );
					if (
						targetBlock &&
						targetBlock.name === 'core/image'
					) {
						shimmerTargetId = resolvedTargetId;
						dispatch(
							geminiAgentStore
						).setImageEditTargetClientId(
							shimmerTargetId
						);
					}
				}

				// Resolve the reference image URL.
				let referenceImageUrl = input.image_url || '';

				if ( ! referenceImageUrl && resolvedTargetId ) {
					const targetBlock = getBlock( resolvedTargetId );
					if (
						targetBlock &&
						targetBlock.name === 'core/image'
					) {
						referenceImageUrl =
							targetBlock.attributes?.url || '';
					}
				}

				if ( ! referenceImageUrl ) {
					return {
						success: false,
						message:
							'No reference image provided. Supply image_url, a targetClientId, or select an existing image block.',
						clientId: '',
						imageUrl: '',
					};
				}

				const falReferenceImageUrl =
					await resolveFalReferenceImageUrl(
						referenceImageUrl
					);

				// 1. Call fal.ai Gemini Flash Edit API.
				const falResponse = await window.fetch(
					FAL_GEMINI_FLASH_EDIT_URL,
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Key ${ falApiKey }`,
						},
						body: JSON.stringify( {
							prompt: input.prompt,
							image_url: falReferenceImageUrl,
						} ),
					}
				);

				if ( ! falResponse.ok ) {
					const errorText = await falResponse
						.text()
						.catch( () => '' );
					return {
						success: false,
						message: `Image editing failed (${ falResponse.status }): ${ errorText }`,
						clientId: '',
						imageUrl: '',
					};
				}

				const falResult = await falResponse.json();
				const editedImageUrl =
					falResult?.images?.[ 0 ]?.url ||
					falResult?.image?.url ||
					'';

				if ( ! editedImageUrl ) {
					return {
						success: false,
						message:
							'Image editing succeeded but no image URL was returned.',
						clientId: '',
						imageUrl: '',
					};
				}

				// 2. Fetch the edited image as a blob.
				const imageResponse =
					await window.fetch( editedImageUrl );
				if ( ! imageResponse.ok ) {
					return {
						success: false,
						message: `Failed to download edited image (${ imageResponse.status }).`,
						clientId: '',
						imageUrl: '',
					};
				}

				const imageBlob = await imageResponse.blob();
				const imageFile = new File(
					[ imageBlob ],
					'ai-edited-image.png',
					{ type: imageBlob.type || 'image/png' }
				);

				// 3. Upload to WordPress media library.
				const formData = new FormData();
				formData.append(
					'file',
					imageFile,
					'ai-edited-image.png'
				);

				const attachment: any = await apiFetch( {
					path: '/wp/v2/media',
					method: 'POST',
					body: formData,
				} );

				const wpImageUrl =
					attachment?.source_url || editedImageUrl;
				const attachmentId = attachment?.id;

				// 4. Insert or update the image block.
				const {
					insertBlock,
					selectBlock,
					updateBlockAttributes,
				} = dispatch( blockEditorStore );
				const {
					getBlockRootClientId,
					getBlockIndex,
					getBlocks,
				} = select( blockEditorStore );

				// If we have a resolved target, update it in place.
				if ( resolvedTargetId ) {
					const targetBlock = getBlock( resolvedTargetId );
					if (
						! targetBlock ||
						targetBlock.name !== 'core/image'
					) {
						return {
							success: false,
							message: `Block ${ resolvedTargetId } is not a core/image block or was not found.`,
							clientId: '',
							imageUrl: wpImageUrl,
						};
					}

					updateBlockAttributes( resolvedTargetId, {
						url: wpImageUrl,
						id: attachmentId,
						alt: input.prompt,
					} );

					dispatch(
						geminiAgentStore
					).setActiveBlockClientId(
						resolvedTargetId
					);

					return {
						success: true,
						message: `Updated image block with AI-edited image.`,
						clientId: resolvedTargetId,
						imageUrl: wpImageUrl,
					};
				}

				// Otherwise, insert a new core/image block.
				const block = createBlock( 'core/image', {
					url: wpImageUrl,
					id: attachmentId,
					alt: input.prompt,
				} );

				const position = input.position || 'after';
				const selectedClientId = getSelectedBlockClientId();

				let rootClientId: string | undefined;
				let index: number | undefined;

				if ( selectedClientId ) {
					rootClientId =
						getBlockRootClientId( selectedClientId ) ||
						undefined;
					const selectedIndex =
						getBlockIndex( selectedClientId );

					switch ( position ) {
						case 'before':
							index = selectedIndex;
							break;
						case 'after':
							index = selectedIndex + 1;
							break;
						case 'first':
							index = 0;
							break;
						case 'last':
							index =
								getBlocks( rootClientId ).length;
							break;
					}
				} else {
					const blocks = getBlocks();
					index = blocks.length;
				}

				insertBlock( block, index, rootClientId );
				selectBlock( block.clientId );
				dispatch(
					geminiAgentStore
				).setActiveBlockClientId( block.clientId );

				return {
					success: true,
					message: `Edited and inserted AI image.`,
					clientId: block.clientId,
					imageUrl: wpImageUrl,
				};
			} catch ( error ) {
				return {
					success: false,
					message:
						error instanceof Error
							? error.message
							: 'Failed to edit image',
					clientId: '',
					imageUrl: '',
				};
			} finally {
				if ( shimmerTargetId ) {
					dispatch(
						geminiAgentStore
					).setImageEditTargetClientId( null );
				}
			}
		},
	} );
}

/**
 * Register all image generation abilities
 */
export function registerImageGenerationAbilities(): void {
	registerGenerateImageAbility();
	registerEditImageAbility();
}
