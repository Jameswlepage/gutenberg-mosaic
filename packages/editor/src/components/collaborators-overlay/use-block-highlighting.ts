/**
 * WordPress dependencies
 */
import {
	privateApis as coreDataPrivateApis,
	SelectionType,
} from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { useEffect, useState } from '@wordpress/element';
import { store as blockEditorStore } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import { unlock } from '../../lock-unlock';
import { getAvatarBorderColor } from '../collab-sidebar/utils';

const { useActiveCollaborators } = unlock( coreDataPrivateApis );

interface CollaboratorSelectionRange {
	blockId: string;
	startOffset: number;
	endOffset: number;
}

export interface CollaboratorSelectionHighlight {
	id: string;
	clientId?: number;
	x: number;
	y: number;
	width: number;
	height: number;
	color: string;
}

function getCollaboratorInfo( userState: any ) {
	return userState?.collaboratorInfo || userState?.userInfo || null;
}

function getCollaboratorId( userState: any ) {
	return String(
		getCollaboratorInfo( userState )?.id ??
			getCollaboratorInfo( userState )?.userId ??
			userState?.clientId
	);
}

function getCollaboratorEnteredAt( userState: any ) {
	return Number( getCollaboratorInfo( userState )?.enteredAt ?? 0 );
}

function getMyUserIds( userStates: any[] ) {
	const myUserIds = new Set< string >();

	userStates.forEach( ( userState ) => {
		if ( ! userState?.isMe ) {
			return;
		}

		const userId = getCollaboratorId( userState );
		if ( userId ) {
			myUserIds.add( userId );
		}
	} );

	return myUserIds;
}

function pickPreferredCollaboratorState( existing: any, next: any ): boolean {
	if ( ! existing ) {
		return true;
	}

	if ( next.isMe && ! existing.isMe ) {
		return true;
	}

	if ( ! next.isMe && existing.isMe ) {
		return false;
	}

	if ( next.isConnected && ! existing.isConnected ) {
		return true;
	}

	if ( next.isConnected === existing.isConnected ) {
		return (
			getCollaboratorEnteredAt( next ) >=
			getCollaboratorEnteredAt( existing )
		);
	}

	return false;
}

function dedupeCollaboratorStates( userStates: any[] ) {
	const seen = new Map< string, any >();
	const myUserIds = getMyUserIds( userStates );

	for ( const userState of userStates ) {
		if ( ! userState || userState.isMe ) {
			continue;
		}

		const userId = getCollaboratorId( userState );
		if ( myUserIds.has( userId ) ) {
			continue;
		}

		const existing = seen.get( userId );
		if ( pickPreferredCollaboratorState( existing, userState ) ) {
			seen.set( userId, userState );
		}
	}

	return Array.from( seen.values() );
}

function hexToRgb( color?: string ) {
	if ( typeof color !== 'string' ) {
		return null;
	}

	const trimmed = color.trim().toLowerCase();

	if ( trimmed.startsWith( 'rgb' ) ) {
		const parsed = trimmed.match( /rgba?\(([^)]+)\)/ );
		if ( parsed ) {
			const nums = parsed[ 1 ]
				.split( ',' )
				.map( ( value ) => Number( value.trim() ) );
			if ( nums.length >= 3 ) {
				return `${ nums[ 0 ] }, ${ nums[ 1 ] }, ${ nums[ 2 ] }`;
			}
		}

		return null;
	}

	let sanitized = trimmed;
	if ( sanitized[ 0 ] === '#' ) {
		sanitized = sanitized.slice( 1 );
	}

	if ( sanitized.length === 3 ) {
		const [ r, g, b ] = sanitized.split( '' );
		return `${ Number.parseInt( `${ r }${ r }`, 16 ) }, ${ Number.parseInt(
			`${ g }${ g }`,
			16
		) }, ${ Number.parseInt( `${ b }${ b }`, 16 ) }`;
	}

	if ( sanitized.length >= 6 ) {
		return `${ Number.parseInt(
			sanitized.slice( 0, 2 ),
			16
		) }, ${ Number.parseInt(
			sanitized.slice( 2, 4 ),
			16
		) }, ${ Number.parseInt( sanitized.slice( 4, 6 ), 16 ) }`;
	}

	return null;
}

function getCollaboratorHighlightBackgroundColor( color: string ) {
	const rgb = hexToRgb( color );
	if ( ! rgb ) {
		return 'rgba( 29, 155, 209, 0.18 )';
	}
	return `rgba( ${ rgb }, 0.18 )`;
}

function isParagraphBlock( blockElement: Element ) {
	return (
		blockElement.matches( '[data-type="core/paragraph"]' ) ||
		blockElement.classList.contains( 'wp-block-paragraph' )
	);
}

function getSelectionBlockRanges(
	selection: any,
	getBlockRootClientId?: ( blockClientId: string ) => string,
	getBlockOrder?: ( rootClientId?: string ) => string[]
): CollaboratorSelectionRange[] {
	if ( ! selection || selection.type === SelectionType.None ) {
		return [];
	}

	if (
		selection.type === SelectionType.Cursor ||
		selection.type === SelectionType.WholeBlock
	) {
		return [];
	}

	if ( selection.type === SelectionType.SelectionInOneBlock ) {
		if ( ! selection.blockId ) {
			return [];
		}

		const startOffset = Number(
			selection?.cursorStartPosition?.absoluteOffset ?? 0
		);
		const endOffset = Number(
			selection?.cursorEndPosition?.absoluteOffset ?? startOffset
		);

		return [
			{
				blockId: selection.blockId,
				startOffset,
				endOffset,
			},
		];
	}

	if ( selection.type === SelectionType.SelectionInMultipleBlocks ) {
		const blockStartId = selection.blockStartId;
		const blockEndId = selection.blockEndId;
		if ( ! blockStartId || ! blockEndId ) {
			return [];
		}

		const startOffset = Number(
			selection?.cursorStartPosition?.absoluteOffset ?? 0
		);
		const endOffset = Number(
			selection?.cursorEndPosition?.absoluteOffset ?? 0
		);
		const blockIds = getSelectionMultipleBlockIds(
			selection,
			getBlockRootClientId,
			getBlockOrder
		);

		if ( blockIds.length === 0 ) {
			return [];
		}

		return blockIds.map( ( blockId ) => {
			const isStartBlock = blockId === blockStartId;
			const isEndBlock = blockId === blockEndId;
			return {
				blockId,
				startOffset: isStartBlock ? startOffset : 0,
				endOffset: isEndBlock ? endOffset : Number.POSITIVE_INFINITY,
			};
		} );
	}

	return [];
}

function getSelectionMultipleBlockIds(
	selection: any,
	getBlockRootClientId?: ( blockClientId: string ) => string,
	getBlockOrder?: ( rootClientId?: string ) => string[]
): string[] {
	const startId = selection.blockStartId;
	const endId = selection.blockEndId;
	if ( ! startId || ! endId ) {
		return [];
	}

	if (
		typeof getBlockRootClientId !== 'function' ||
		typeof getBlockOrder !== 'function'
	) {
		return [ startId, endId ];
	}

	const startRoot = getBlockRootClientId( startId );
	const endRoot = getBlockRootClientId( endId );
	if ( startRoot !== endRoot ) {
		return [ startId, endId ];
	}

	const order = getBlockOrder( startRoot );
	if ( ! Array.isArray( order ) || order.length === 0 ) {
		return [ startId, endId ];
	}

	const startIndex = order.indexOf( startId );
	const endIndex = order.indexOf( endId );
	if ( startIndex === -1 || endIndex === -1 ) {
		return [ startId, endId ];
	}

	const from = Math.min( startIndex, endIndex );
	const to = Math.max( startIndex, endIndex );
	return order.slice( from, to + 1 );
}

function getBlockTextLength(
	blockElement: HTMLElement,
	editorDocument: Document
) {
	// eslint-disable-next-line no-bitwise
	const showFilter = NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT;
	const treeWalker = editorDocument.createTreeWalker(
		blockElement,
		showFilter
	);
	let node: Node | null = null;
	let length = 0;

	while ( ( node = treeWalker.nextNode() ) ) {
		if ( node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'BR' ) {
			length += 1;
			continue;
		}

		if ( node.nodeType === Node.TEXT_NODE ) {
			length += node.nodeValue?.length ?? 0;
		}
	}

	return length;
}

function normalizeSelectionOffsets(
	startOffset: number,
	endOffset: number,
	blockLength: number
) {
	let normalizedStart = Number.isFinite( startOffset ) ? startOffset : 0;
	let normalizedEnd = Number.isFinite( endOffset ) ? endOffset : blockLength;

	normalizedStart = Math.max( 0, Math.min( normalizedStart, blockLength ) );
	normalizedEnd = Math.max( 0, Math.min( normalizedEnd, blockLength ) );

	if ( normalizedStart > normalizedEnd ) {
		[ normalizedStart, normalizedEnd ] = [ normalizedEnd, normalizedStart ];
	}

	if ( normalizedStart === normalizedEnd ) {
		if ( blockLength === 0 ) {
			return null;
		}

		normalizedStart = Math.max(
			0,
			Math.min( normalizedStart - 1, blockLength - 1 )
		);
		normalizedEnd = Math.min( blockLength, normalizedStart + 1 );
	}

	return {
		startOffset: normalizedStart,
		endOffset: normalizedEnd,
	};
}

function getInnerOffsetForTextRange(
	blockElement: HTMLElement,
	offset: number,
	editorDocument: Document
) {
	// eslint-disable-next-line no-bitwise
	const showFilter = NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT;
	const treeWalker = editorDocument.createTreeWalker(
		blockElement,
		showFilter
	);

	let currentOffset = 0;
	let nextNode: Node | null = null;
	let lastTextNode: Node | null = null;

	while ( ( nextNode = treeWalker.nextNode() ) ) {
		const node = nextNode;

		if ( node.nodeType === Node.ELEMENT_NODE ) {
			if ( node.nodeName === 'BR' ) {
				if ( currentOffset >= offset ) {
					return {
						node: node.parentElement || blockElement,
						offset: 0,
					};
				}
				currentOffset += 1;
			}

			continue;
		}

		if ( node.nodeType !== Node.TEXT_NODE ) {
			continue;
		}

		const length = node.nodeValue?.length ?? 0;
		if ( currentOffset + length >= offset ) {
			return { node, offset: offset - currentOffset };
		}

		currentOffset += length;
		lastTextNode = node;
	}

	if ( lastTextNode ) {
		return {
			node: lastTextNode,
			offset: lastTextNode.nodeValue?.length ?? 0,
		};
	}

	return { node: blockElement, offset: 0 };
}

function getSelectionRectanglesInBlock(
	blockElement: HTMLElement,
	startOffset: number,
	endOffset: number,
	editorDocument: Document,
	overlay: HTMLElement
) {
	const blockLength = getBlockTextLength( blockElement, editorDocument );
	const normalized = normalizeSelectionOffsets(
		startOffset,
		endOffset,
		blockLength
	);

	if ( ! normalized ) {
		return [];
	}

	const range = editorDocument.createRange();
	const start = getInnerOffsetForTextRange(
		blockElement,
		normalized.startOffset,
		editorDocument
	);
	const end = getInnerOffsetForTextRange(
		blockElement,
		normalized.endOffset,
		editorDocument
	);

	try {
		range.setStart( start.node, start.offset );
		range.setEnd( end.node, end.offset );
	} catch ( error ) {
		return [];
	}

	const overlayRect = overlay.getBoundingClientRect();
	const rects = Array.from( range.getClientRects() ).filter(
		( rect ) => rect.width > 0 && rect.height > 0
	);

	return rects.map( ( rect ) => ( {
		x: rect.left - overlayRect.left,
		y: rect.top - overlayRect.top,
		width: rect.width,
		height: rect.height,
	} ) );
}

export function useBlockHighlighting(
	blockEditorDocument: Document | null,
	overlayElement: HTMLElement | null,
	postId: number | null,
	postType: string | null
): CollaboratorSelectionHighlight[] {
	const [ highlights, setHighlights ] = useState<
		CollaboratorSelectionHighlight[]
	>( [] );

	const userStates = useActiveCollaborators(
		postId ?? null,
		postType ?? null
	);
	const { getBlockOrder, getBlockRootClientId } = useSelect( ( select ) => {
		const blockEditor = select( blockEditorStore ) as {
			getBlockOrder?: ( rootClientId?: string ) => string[];
			getBlockRootClientId?: ( clientId: string ) => string;
		};

		return {
			getBlockOrder: blockEditor?.getBlockOrder,
			getBlockRootClientId: blockEditor?.getBlockRootClientId,
		};
	}, [] );

	const getCollaboratorColor = ( userState: any ) => {
		const collaboratorInfo = getCollaboratorInfo( userState );
		const collaboratorColor = collaboratorInfo?.color;

		if ( collaboratorColor ) {
			return collaboratorColor;
		}

		const userId = collaboratorInfo?.id ?? userState?.clientId;
		const numericUserId = Number( userId );
		return Number.isFinite( numericUserId )
			? getAvatarBorderColor( numericUserId )
			: getAvatarBorderColor( 0 );
	};

	useEffect( () => {
		if ( blockEditorDocument === null || overlayElement === null ) {
			setHighlights( [] );
			return;
		}

		const dedupedUserStates = dedupeCollaboratorStates( userStates );
		const nextHighlights: CollaboratorSelectionHighlight[] = [];

		dedupedUserStates.forEach( ( userState: any ) => {
			if ( ! userState.isConnected ) {
				return;
			}

			const selection = userState.editorState?.selection;
			const ranges = getSelectionBlockRanges(
				selection,
				getBlockRootClientId,
				getBlockOrder
			);
			if ( ranges.length === 0 ) {
				return;
			}

			const collaboratorId = getCollaboratorId( userState );
			const collaboratorClientId = Number( userState?.clientId );
			const color = getCollaboratorHighlightBackgroundColor(
				getCollaboratorColor( userState )
			);

			ranges.forEach(
				( { blockId, startOffset, endOffset }, rangeIndex ) => {
					const blockElement = getBlockElementById(
						blockEditorDocument,
						blockId
					);

					if (
						! blockElement ||
						! isParagraphBlock( blockElement )
					) {
						return;
					}

					const rects = getSelectionRectanglesInBlock(
						blockElement,
						startOffset,
						endOffset,
						blockEditorDocument,
						overlayElement
					);

					rects.forEach( ( rect, rectIndex ) => {
						nextHighlights.push( {
							id: `${ collaboratorId }-${ blockId }-${ rangeIndex }-${ rectIndex }`,
							clientId: Number.isFinite( collaboratorClientId )
								? collaboratorClientId
								: undefined,
							color,
							x: rect.x,
							y: rect.y,
							width: rect.width,
							height: rect.height,
						} );
					} );
				}
			);
		} );

		setHighlights( nextHighlights );
	}, [
		userStates,
		getBlockOrder,
		getBlockRootClientId,
		blockEditorDocument,
		overlayElement,
	] );

	return highlights;
}

const getBlockElementById = (
	blockEditorDocument: Document,
	blockId: string
): HTMLElement | null => {
	return blockEditorDocument.querySelector( `[data-block="${ blockId }"]` );
};
