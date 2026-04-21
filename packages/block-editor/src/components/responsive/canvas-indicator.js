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
 * Small neutral badge identifying the active editing breakpoint, intended to
 * render in the editor's bottom bar next to the block breadcrumb rather than
 * floating at the top-right of the canvas.
 *
 * Also toggles a body-level class (`is-editing-responsive-*`) so other CSS
 * can key off the active bp — preserved from the original top-right pill so
 * existing selectors don't break.
 *
 * Mounting site (the editor's InterfaceSkeleton footer) takes care of layout;
 * this component is inline and assumes its container decides placement.
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
		<span
			className="block-editor-responsive-canvas-indicator"
			data-breakpoint={ selectedBreakpoint }
			aria-live="polite"
		>
			{ sprintf(
				/* translators: %s: current editing breakpoint name (e.g. Mobile, Tablet). */
				__( 'Editing styles for %s' ),
				breakpoint.label
			) }
		</span>
	);
}
