/**
 * WordPress dependencies
 */
import { useEffect } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useResponsiveBreakpoint } from './breakpoint-context';
import { RESPONSIVE_BREAKPOINTS, DEFAULT_BREAKPOINT } from './constants';

/**
 * Paints a body-level class so editor CSS can outline the canvas, and
 * renders a corner pill identifying the active editing breakpoint.
 *
 * Direct response to the discoverability feedback on PR #73888 — without a
 * canvas-visible indicator, users silently routed edits into a non-desktop
 * breakpoint and got confused.
 */
export default function ResponsiveCanvasIndicator() {
	const { selectedBreakpoint } = useResponsiveBreakpoint();
	const isBase = selectedBreakpoint === DEFAULT_BREAKPOINT;
	const breakpoint = RESPONSIVE_BREAKPOINTS[ selectedBreakpoint ];

	useEffect( () => {
		if ( isBase ) {
			return;
		}
		const className = `is-editing-responsive-${ selectedBreakpoint }`;
		document.body.classList.add( 'is-editing-responsive' );
		document.body.classList.add( className );
		return () => {
			document.body.classList.remove( 'is-editing-responsive' );
			document.body.classList.remove( className );
		};
	}, [ selectedBreakpoint, isBase ] );

	if ( isBase || ! breakpoint ) {
		return null;
	}

	return (
		<div
			className="block-editor-responsive-canvas-indicator"
			aria-live="polite"
		>
			{ sprintf(
				/* translators: %s: current editing breakpoint name (e.g. Mobile, Tablet). */
				__( 'Editing styles for %s' ),
				breakpoint.label
			) }
		</div>
	);
}
