/**
 * WordPress dependencies
 */
import { useSelect } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import { closeSmall } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { useResponsiveBreakpoint } from './breakpoint-context';
import {
	RESPONSIVE_BREAKPOINTS,
	RESPONSIVE_BREAKPOINT_DISPLAY_ORDER,
} from './constants';

/**
 * Shift+click on the breakpoint selector opens this view: three frontend
 * previews of the current post side-by-side, each rendered at its own
 * device width so every breakpoint's responsive overrides fire for real
 * against real CSS (no canvas simulation).
 *
 * Rendering the frontend permalink in an iframe (rather than re-rendering
 * the block tree three times) keeps this cheap — one React root, three
 * <iframe>s, the responsive-styles `@media` rules do the rest.
 *
 * Widths are the *authoring* widths for each band:
 *   Mobile  — 420px  (fires @media (width <= 480px))
 *   Tablet  — 680px  (fires @media (480px < width <= 782px))
 *   Desktop — 1280px (falls through both — base styles only)
 *
 * @return {Element|null}
 */
export default function ResponsiveMultiDeviceCanvas() {
	const { canvasBreakpoints, resetCanvasBreakpoints, selectedBreakpoint } =
		useResponsiveBreakpoint();
	const isMultiPreview = canvasBreakpoints.length > 1;

	const previewUrl = useSelect( ( select ) => {
		const editorStore = select( 'core/editor' );
		if ( ! editorStore ) {
			return null;
		}
		const postId = editorStore.getCurrentPostId?.();
		if ( ! postId ) {
			return null;
		}
		// Frontend permalink — the rendered page with real responsive CSS.
		// Cache-bust so iframe reloads reflect latest saved state without
		// forcing a full reload on every toggle.
		return `/?p=${ postId }&crown_preview=1`;
	}, [] );

	if ( ! isMultiPreview ) {
		return null;
	}

	return (
		<div className="block-editor-responsive-multi-device">
			<div className="block-editor-responsive-multi-device__toolbar">
				<span className="block-editor-responsive-multi-device__title">
					{ sprintf(
						/* translators: %d: number of breakpoints currently shown. */
						__( 'Live preview · %d breakpoints' ),
						canvasBreakpoints.length
					) }
				</span>
				<Button
					icon={ closeSmall }
					size="small"
					onClick={ () => resetCanvasBreakpoints( selectedBreakpoint ) }
					label={ __( 'Exit multi-device preview' ) }
				/>
			</div>
			<div className="block-editor-responsive-multi-device__frames">
				{ RESPONSIVE_BREAKPOINT_DISPLAY_ORDER.filter( ( slug ) =>
					canvasBreakpoints.includes( slug )
				).map( ( slug ) => {
					const bp = RESPONSIVE_BREAKPOINTS[ slug ];
					const width = bp.isBase
						? 1280
						: Math.max( 320, parseInt( bp.size, 10 ) - 60 );
					return (
						<figure
							key={ slug }
							className="block-editor-responsive-multi-device__frame"
							data-breakpoint={ slug }
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
							{ previewUrl ? (
								<iframe
									src={ previewUrl }
									title={ sprintf(
										/* translators: %s: breakpoint label. */
										__( 'Frontend preview at %s' ),
										bp.label
									) }
									loading="lazy"
								/>
							) : (
								<div className="block-editor-responsive-multi-device__empty">
									{ __(
										'Save the post once to enable preview.'
									) }
								</div>
							) }
						</figure>
					);
				} ) }
			</div>
		</div>
	);
}
