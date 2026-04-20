/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import { closeSmall } from '@wordpress/icons';

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
	if ( ! isMultiPreview ) {
		return null;
	}

	return (
		<div className="block-editor-responsive-multi-device">
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
