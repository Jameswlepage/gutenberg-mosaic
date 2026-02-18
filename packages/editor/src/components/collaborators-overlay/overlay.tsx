// @ts-expect-error No exported types
import { useStyleOverride } from '@wordpress/block-editor';
import { privateApis as componentsPrivateApis } from '@wordpress/components';
import { useResizeObserver, useMergeRefs } from '@wordpress/compose';
import { useEffect, useRef, useState } from '@wordpress/element';

import { unlock } from '../../lock-unlock';
import { useBlockHighlighting } from './use-block-highlighting';
import { useRenderCursors } from './use-render-cursors';
import { ELEVATION_X_SMALL } from './collaborator-styles';

const { Avatar } = unlock( componentsPrivateApis );

// wp-components styles are excluded from the editor canvas iframe, so the
// Avatar component's SCSS is not available there. We inject compiled versions
// of the relevant rules alongside the overlay-specific positioning styles.
const COLLABORATORS_OVERLAY_STYLES = `
.block-canvas-cover {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
	z-index: 20000;
}
.block-canvas-cover .collaborators-overlay-full {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
}
.block-canvas-cover .collaborators-overlay-fixed {
	position: fixed;
	width: 100%;
	height: 100%;
}
.collaborators-overlay-user {
	position: absolute;
	pointer-events: auto;
}
.collaborators-overlay-user-cursor {
	position: absolute;
	width: 2px;
	border-radius: 1px;
	outline: 1px solid #fff;
	box-shadow: ${ ELEVATION_X_SMALL };
	animation: collaborators-overlay-cursor-blink 1s infinite;
	transition: opacity 180ms ease;
	will-change: transform, opacity, filter;
}

.collaborators-overlay-selection-highlight {
	position: absolute;
	pointer-events: none;
	border-radius: 2px;
	opacity: 0.9;
}

.collaborators-overlay-user::after {
	content: "";
	position: absolute;
	left: -7px;
	right: -7px;
	top: -12px;
	bottom: -8px;
}

.collaborators-overlay-user-label.components-avatar {
	opacity: 0;
	transform: translate(-11px, -100%);
	visibility: hidden;
	pointer-events: none;
	transition: opacity 220ms ease, visibility 0s linear 220ms;
	will-change: opacity, transform;
}

.collaborators-overlay-user.is-hovered .collaborators-overlay-user-label.components-avatar,
.collaborators-overlay-user:focus-within .collaborators-overlay-user-label.components-avatar {
	opacity: 1;
	transform: translate(-11px, -100%);
	visibility: visible;
	pointer-events: auto;
	transition: opacity 220ms ease;
}

/* ── Avatar component (compiled from packages/components/src/avatar/styles.scss) ── */
.components-avatar {
	display: inline-flex;
	align-items: center;
	border-radius: 9999px;
	overflow: clip;
	flex-shrink: 0;
	background-color: var(--wp-components-color-accent, var(--wp-admin-theme-color, #3858e9));
	box-shadow: 0 0 0 var(--wp-admin-border-width-focus, 2px) #fff, ${ ELEVATION_X_SMALL };
}
.components-avatar__image {
	box-sizing: border-box;
	position: relative;
	width: 32px;
	height: 32px;
	border-radius: 9999px;
	border: 0;
	background-color: var(--wp-components-color-accent, var(--wp-admin-theme-color, #3858e9));
	overflow: clip;
	flex-shrink: 0;
	font-size: 0;
	color: #fff;
}
.is-small > .components-avatar__image {
	width: 24px;
	height: 24px;
}
.has-src > .components-avatar__image {
	background-image: var(--components-avatar-url);
	background-size: cover;
	background-position: center;
}
.has-avatar-border-color > .components-avatar__image {
	border: var(--wp-admin-border-width-focus, 2px) solid var(--components-avatar-outline-color);
	box-shadow: inset 0 0 0 var(--wp-admin-border-width-focus, 2px) #fff;
	background-clip: padding-box;
}
.components-avatar:not(.has-src) > .components-avatar__image {
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 11px;
	font-weight: 499;
	border: 0;
	box-shadow: none;
	background-clip: border-box;
}
.components-avatar:not(.has-src).has-avatar-border-color > .components-avatar__image {
	background-color: var(--components-avatar-outline-color);
}
.components-avatar__name {
	font-size: 13px;
	line-height: 20px;
	color: #fff;
	min-width: 0;
	padding-bottom: 2px;
	overflow: hidden;
	opacity: 0;
	white-space: nowrap;
	transition: opacity 0.15s cubic-bezier(0.15, 0, 0.15, 1);
}
.components-avatar.has-badge {
	display: inline-grid;
	grid-template-columns: min-content 0fr;
	column-gap: 0;
	padding-inline-end: 0;
	transition:
		grid-template-columns 0.3s cubic-bezier(0.15, 0, 0.15, 1),
		column-gap 0.3s cubic-bezier(0.15, 0, 0.15, 1),
		padding-inline-end 0.3s cubic-bezier(0.15, 0, 0.15, 1);
}
.components-avatar.has-badge:hover {
	grid-template-columns: min-content 1fr;
	column-gap: 4px;
	padding-inline-end: 8px;
	transition-timing-function: cubic-bezier(0.85, 0, 0.85, 1);
}
.components-avatar.has-badge:hover .components-avatar__name {
	opacity: 1;
	transition-timing-function: cubic-bezier(0.85, 0, 0.85, 1);
}
.components-avatar.has-badge.has-avatar-border-color {
	background-color: var(--components-avatar-outline-color);
}
/* ── end Avatar ── */

/* Overlay-specific positioning applied to the Avatar cursor label. */
.collaborators-overlay-user-label.components-avatar {
	position: absolute;
	transform: translate(-11px, -100%);
	margin-top: -4px;
	overflow: visible;
	width: max-content;
	transform-origin: bottom center;
}

@keyframes collaborators-overlay-cursor-blink {
	0%, 45% { opacity: 1; }
	55%, 95% { opacity: 0; }
	100% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
	.components-avatar.has-badge,
	.components-avatar__name,
	.collaborators-overlay-user-label,
	.collaborators-overlay-user-cursor {
		transition: none;
		animation: none;
	}
}
`;

interface OverlayProps {
	blockEditorDocument?: Document;
	postId: number | null;
	postType: string | null;
}

const CURSOR_WIDTH = 2;
const CURSOR_HOVER_X_PADDING = 16;
const CURSOR_HOVER_Y_PADDING = 16;
const HIGHLIGHT_HOVER_PADDING = 0;
const CURSOR_HOVER_EXIT_X_PADDING = 24;
const CURSOR_HOVER_EXIT_Y_PADDING = 24;
const HIGHLIGHT_HOVER_EXIT_PADDING = 0;
const HOVER_EXIT_DELAY_MS = 180;

function isPointInRect(
	x: number,
	y: number,
	rect: { x: number; y: number; width: number; height: number }
) {
	return (
		x >= rect.x &&
		x <= rect.x + rect.width &&
		y >= rect.y &&
		y <= rect.y + rect.height
	);
}

/**
 * This component is responsible for rendering the overlay components within the editor iframe.
 *
 * @param props                     - The overlay props.
 * @param props.blockEditorDocument - The block editor document.
 * @param props.postId              - The ID of the post.
 * @param props.postType            - The type of the post.
 * @return The Overlay component.
 */
export function Overlay( {
	blockEditorDocument,
	postId,
	postType,
}: OverlayProps ) {
	const [ hoveredCursorClientId, setHoveredCursorClientId ] = useState<
		number | null
	>( null );
	const hoverClearTimeoutRef = useRef< number | null >( null );
	const hoveredCursorClientIdRef = useRef< number | null >( null );

	useStyleOverride( {
		id: 'collaborators-overlay',
		css: COLLABORATORS_OVERLAY_STYLES,
	} );

	// Use state for the overlay element so that the hook re-runs once the ref is attached.
	const [ overlayElement, setOverlayElement ] =
		useState< HTMLDivElement | null >( null );

	const { cursors, rerenderCursorsAfterDelay } = useRenderCursors(
		overlayElement,
		blockEditorDocument ?? null,
		postId ?? null,
		postType ?? null
	);
	const collaboratorHighlights = useBlockHighlighting(
		blockEditorDocument ?? null,
		overlayElement,
		postId ?? null,
		postType ?? null
	);

	// Detect layout changes on overlay (e.g. turning on "Show Template") and window
	// resizes, and re-render the cursors.
	const resizeObserverRef = useResizeObserver( rerenderCursorsAfterDelay );
	useEffect( rerenderCursorsAfterDelay, [ rerenderCursorsAfterDelay ] );

	// Merge the refs to use the same element for both overlay and resize observation
	const mergedRef = useMergeRefs< HTMLDivElement | null >( [
		setOverlayElement,
		resizeObserverRef,
	] );

	useEffect( () => {
		hoveredCursorClientIdRef.current = hoveredCursorClientId;
	}, [ hoveredCursorClientId ] );

	useEffect( () => {
		if ( ! blockEditorDocument || ! overlayElement ) {
			if ( hoverClearTimeoutRef.current !== null ) {
				window.clearTimeout( hoverClearTimeoutRef.current );
				hoverClearTimeoutRef.current = null;
			}
			setHoveredCursorClientId( null );
			return;
		}

		const clearHoverClearTimeout = () => {
			if ( hoverClearTimeoutRef.current === null ) {
				return;
			}

			window.clearTimeout( hoverClearTimeoutRef.current );
			hoverClearTimeoutRef.current = null;
		};

		const scheduleHoverClear = () => {
			clearHoverClearTimeout();
			hoverClearTimeoutRef.current = window.setTimeout( () => {
				setHoveredCursorClientId( null );
			}, HOVER_EXIT_DELAY_MS );
		};

		const onPointerMove = ( event: PointerEvent ) => {
			const overlayRect = overlayElement.getBoundingClientRect();
			const x = event.clientX - overlayRect.left;
			const y = event.clientY - overlayRect.top;

			const findHoveredId = (
				cursorPaddingX: number,
				cursorPaddingY: number,
				highlightPadding: number
			) => {
				const hoveredCursor = cursors.find( ( cursor ) =>
					isPointInRect( x, y, {
						x: cursor.x - cursorPaddingX,
						y: cursor.y - cursorPaddingY,
						width: CURSOR_WIDTH + cursorPaddingX * 2,
						height: cursor.height + cursorPaddingY * 2,
					} )
				);

				if ( hoveredCursor ) {
					return hoveredCursor.clientId;
				}

				const hoveredHighlight = collaboratorHighlights.find(
					( highlight ) =>
						typeof highlight.clientId === 'number' &&
						isPointInRect( x, y, {
							x: highlight.x - highlightPadding,
							y: highlight.y - highlightPadding,
							width: highlight.width + highlightPadding * 2,
							height: highlight.height + highlightPadding * 2,
						} )
				);

				return hoveredHighlight?.clientId ?? null;
			};

			const nextHoveredId = findHoveredId(
				CURSOR_HOVER_X_PADDING,
				CURSOR_HOVER_Y_PADDING,
				HIGHLIGHT_HOVER_PADDING
			);
			if ( nextHoveredId === null ) {
				const stickyHoveredId = hoveredCursorClientIdRef.current;
				if ( stickyHoveredId !== null ) {
					const stickyIdAtPointer = findHoveredId(
						CURSOR_HOVER_EXIT_X_PADDING,
						CURSOR_HOVER_EXIT_Y_PADDING,
						HIGHLIGHT_HOVER_EXIT_PADDING
					);

					if ( stickyIdAtPointer === stickyHoveredId ) {
						clearHoverClearTimeout();
						return;
					}
				}

				scheduleHoverClear();
				return;
			}

			clearHoverClearTimeout();
			setHoveredCursorClientId( ( previousId ) =>
				previousId === nextHoveredId ? previousId : nextHoveredId
			);
		};

		const onPointerLeave = () => {
			scheduleHoverClear();
		};

		blockEditorDocument.addEventListener( 'pointermove', onPointerMove );
		blockEditorDocument.addEventListener( 'pointerleave', onPointerLeave );

		return () => {
			clearHoverClearTimeout();
			blockEditorDocument.removeEventListener(
				'pointermove',
				onPointerMove
			);
			blockEditorDocument.removeEventListener(
				'pointerleave',
				onPointerLeave
			);
		};
	}, [
		blockEditorDocument,
		overlayElement,
		cursors,
		collaboratorHighlights,
	] );

	// This is a full overlay that covers the entire iframe document. Good for
	// scrollable elements like cursor indicators.
	return (
		<div className="collaborators-overlay-full" ref={ mergedRef }>
			{ cursors.map( ( cursor ) => (
				<div
					key={ cursor.clientId }
					className={ `collaborators-overlay-user${
						hoveredCursorClientId === cursor.clientId
							? ' is-hovered'
							: ''
					}` }
					style={ {
						left: `${ cursor.x }px`,
						top: `${ cursor.y }px`,
						color: cursor.color,
					} }
				>
					<div
						className="collaborators-overlay-user-cursor"
						style={ {
							backgroundColor: cursor.color,
							height: `${ cursor.height }px`,
						} }
					/>
					<Avatar
						className="collaborators-overlay-user-label"
						badge
						size="small"
						src={ cursor.avatarUrl }
						name={ cursor.userName }
						borderColor={ cursor.color }
					/>
				</div>
			) ) }
			{ collaboratorHighlights.map( ( highlight ) => (
				<div
					key={ highlight.id }
					className="collaborators-overlay-selection-highlight"
					style={ {
						left: `${ highlight.x }px`,
						top: `${ highlight.y }px`,
						width: `${ highlight.width }px`,
						height: `${ highlight.height }px`,
						backgroundColor: highlight.color,
					} }
				/>
			) ) }
		</div>
	);
}
