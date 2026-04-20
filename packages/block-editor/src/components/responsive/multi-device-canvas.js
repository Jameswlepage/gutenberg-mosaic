/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import { closeSmall } from '@wordpress/icons';
import { useEffect, useRef } from '@wordpress/element';

/**
 * Internal dependencies
 */
import {
	ResponsiveBreakpointProvider,
	useResponsiveBreakpoint,
} from './breakpoint-context';
import {
	RESPONSIVE_BREAKPOINTS,
	RESPONSIVE_BREAKPOINT_DISPLAY_ORDER,
} from './constants';
import { ExperimentalBlockCanvas as BlockCanvas } from '../block-canvas';

/**
 * Compute a target canvas width for a breakpoint slug. For non-base
 * breakpoints we use a value slightly under the upper bound of the bp
 * range, so the media query inside the iframe fires without hugging the
 * edge. Desktop uses a generous preview width that still fits the
 * multi-frame row.
 * @param {string} slug
 * @return {number} Pixel width.
 */
function widthFor( slug ) {
	const bp = RESPONSIVE_BREAKPOINTS[ slug ];
	if ( bp?.isBase ) {
		return 1280;
	}
	const size = parseInt( bp?.size, 10 );
	if ( ! Number.isFinite( size ) ) {
		return 480;
	}
	return Math.max( 320, size - 60 );
}

/**
 * Render a BlockCanvas for each breakpoint currently in the canvas set,
 * side-by-side. Each canvas shares the same `core/block-editor` store so
 * edits propagate instantly between frames; the only thing that differs
 * is the `overrideBreakpoint` we feed each one's ResponsiveBreakpointProvider,
 * which is what the responsive interceptor reads to decide which merged view
 * to present AND where `setAttributes({ style: … })` writes routed-by-bp.
 *
 * Rendered at all only when `canvasBreakpoints.length > 1`; a single entry
 * falls through to the normal single BlockCanvas owned by visual-editor.
 *
 * @return {Element|null}
 */
export default function ResponsiveMultiDeviceCanvas() {
	const { canvasBreakpoints, resetCanvasBreakpoints, selectedBreakpoint } =
		useResponsiveBreakpoint();
	const isMultiPreview = canvasBreakpoints.length > 1;
	const containerRef = useRef( null );

	/*
	 * Scroll-sync across frames. Each BlockCanvas renders its block list in
	 * its own iframe (so css-in-iframe works per-breakpoint). Scrolling one
	 * should scroll the others proportionally — otherwise comparing across
	 * devices means constantly re-scrolling each. We sync by scroll ratio
	 * (0..1 of scrollable height) rather than raw pixels, since each frame
	 * has a different total scrollHeight. A `syncing` flag breaks the
	 * feedback loop: when we write scrollTop on siblings, their scroll
	 * handlers fire too, but skip forwarding while syncing is true.
	 *
	 * Re-attaches whenever the set of visible breakpoints changes, since
	 * new iframes appear and old ones detach.
	 */
	useEffect( () => {
		if ( ! isMultiPreview || ! containerRef.current ) {
			return;
		}
		let cleanup = () => {};
		const tryAttach = () => {
			const iframes = Array.from(
				containerRef.current.querySelectorAll(
					'.block-editor-responsive-multi-device__frames iframe'
				)
			);
			const docs = iframes
				.map( ( f ) => f.contentDocument )
				.filter( Boolean );
			if (
				docs.length < 2 ||
				docs.some( ( d ) => d.readyState !== 'complete' )
			) {
				return false;
			}
			let syncing = false;
			const handlers = docs.map( ( doc ) => {
				const handler = () => {
					if ( syncing ) {
						return;
					}
					const elt =
						doc.scrollingElement || doc.documentElement;
					const max = Math.max(
						1,
						elt.scrollHeight - elt.clientHeight
					);
					const ratio = elt.scrollTop / max;
					syncing = true;
					for ( const otherDoc of docs ) {
						if ( otherDoc === doc ) {
							continue;
						}
						const otherElt =
							otherDoc.scrollingElement ||
							otherDoc.documentElement;
						const otherMax = Math.max(
							0,
							otherElt.scrollHeight - otherElt.clientHeight
						);
						otherElt.scrollTop = ratio * otherMax;
					}
					requestAnimationFrame( () => {
						syncing = false;
					} );
				};
				doc.addEventListener( 'scroll', handler, { passive: true } );
				return { doc, handler };
			} );
			cleanup = () => {
				for ( const h of handlers ) {
					h.doc.removeEventListener( 'scroll', h.handler );
				}
			};
			return true;
		};
		// Poll until every BlockCanvas iframe is loaded — they mount async.
		const interval = setInterval( () => {
			if ( tryAttach() ) {
				clearInterval( interval );
			}
		}, 200 );
		return () => {
			clearInterval( interval );
			cleanup();
		};
	}, [ isMultiPreview, canvasBreakpoints.join( ',' ) ] );

	if ( ! isMultiPreview ) {
		return null;
	}

	return (
		<div
			ref={ containerRef }
			className="block-editor-responsive-multi-device"
		>
			<div className="block-editor-responsive-multi-device__toolbar">
				<span className="block-editor-responsive-multi-device__title">
					{ sprintf(
						/* translators: %d: number of breakpoints currently shown. */
						__( 'Live editing · %d breakpoints' ),
						canvasBreakpoints.length
					) }
				</span>
				<Button
					icon={ closeSmall }
					size="small"
					onClick={ () =>
						resetCanvasBreakpoints( selectedBreakpoint )
					}
					label={ __( 'Exit multi-device editing' ) }
				/>
			</div>
			<div className="block-editor-responsive-multi-device__frames">
				{ RESPONSIVE_BREAKPOINT_DISPLAY_ORDER.filter( ( slug ) =>
					canvasBreakpoints.includes( slug )
				).map( ( slug ) => {
					const bp = RESPONSIVE_BREAKPOINTS[ slug ];
					const width = widthFor( slug );
					return (
						<figure
							key={ slug }
							className="block-editor-responsive-multi-device__frame"
							data-breakpoint={ slug }
							data-focused={
								slug === selectedBreakpoint ? 'true' : undefined
							}
							style={ { width: `${ width }px` } }
						>
							<figcaption className="block-editor-responsive-multi-device__caption">
								<span>{ bp.label }</span>
								<span className="block-editor-responsive-multi-device__size">
									{ sprintf(
										/* translators: %dpx */
										__( '%dpx' ),
										width
									) }
								</span>
							</figcaption>
							<div className="block-editor-responsive-multi-device__body">
								<ResponsiveBreakpointProvider
									overrideBreakpoint={ slug }
								>
									<BlockCanvas
										shouldIframe
										height="100%"
									/>
								</ResponsiveBreakpointProvider>
							</div>
						</figure>
					);
				} ) }
			</div>
		</div>
	);
}
