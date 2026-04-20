/**
 * WordPress dependencies
 */
import {
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOptionIcon as ToggleGroupControlOptionIcon,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useEffect } from '@wordpress/element';
import { useSelect } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { useResponsiveBreakpoint } from './breakpoint-context';
import {
	RESPONSIVE_BREAKPOINTS,
	RESPONSIVE_BREAKPOINT_DISPLAY_ORDER,
} from './constants';
import { store as blockEditorStore } from '../../store';

/**
 * Header-bar control for selecting the breakpoint being styled.
 * Base (desktop) = no overrides applied. Non-base = edits route into
 * attributes.responsive[ breakpoint ]. See `hooks/responsive.js`.
 *
 * Keyboard: Alt+1 / Alt+2 / Alt+3 for Desktop / Tablet / Mobile,
 * matching the convention used by Webflow/Figma-Sites for breakpoint switching.
 */
export default function ResponsiveBreakpointSelector() {
	const {
		selectedBreakpoint,
		setSelectedBreakpoint,
		canvasBreakpoints,
		toggleCanvasBreakpoint,
		resetCanvasBreakpoints,
	} = useResponsiveBreakpoint();

	const isMultiPreview = canvasBreakpoints.length > 1;

	// Shift+click toggles that specific breakpoint in/out of the canvas set.
	// Normal click resets the set to just that breakpoint AND drives the
	// editor's deviceType. Capturing the event before ToggleGroupControl's
	// own handler lets us distinguish the two gestures cleanly.
	const handleClickCapture = ( event ) => {
		const target = event.target.closest( 'button, [role="radio"]' );
		if ( ! target ) {
			return;
		}
		// Map the DOM button back to a breakpoint slug by index within the
		// selector wrap — cheap and doesn't require threading refs.
		const buttons = Array.from(
			event.currentTarget.querySelectorAll( 'button, [role="radio"]' )
		);
		const idx = buttons.indexOf( target );
		const slug = RESPONSIVE_BREAKPOINT_DISPLAY_ORDER[ idx ];
		if ( ! slug ) {
			return;
		}
		if ( event.shiftKey ) {
			event.preventDefault();
			event.stopPropagation();
			toggleCanvasBreakpoint( slug );
			return;
		}
		// Plain click behaviour depends on whether we're in multi-mode:
		//
		//   single canvas (set.size === 1): set canvas + deviceType to clicked
		//   multi canvas  (set.size > 1):   only shift focus (deviceType) to
		//                                   the clicked bp, keep frames as-is
		//
		// The "shift focus" branch lets the author move their "currently
		// editing" device within the multi-frame view without collapsing
		// back to a single canvas — matches the user's mental model from
		// Webflow/Figma-Sites multi-select workflow.
		if ( canvasBreakpoints.length <= 1 ) {
			resetCanvasBreakpoints( slug );
		}
		// In multi-mode: let the normal ToggleGroupControl handler through;
		// it calls onChange → setSelectedBreakpoint → setDeviceType, which
		// updates the selected-radio indicator without touching the canvas set.
	};

	// Read the currently-selected block's raw responsive overrides so we can
	// paint a dot on each breakpoint button that actually has overrides for
	// the block in hand. Empty set when no block is selected or no overrides.
	// Defensive throughout: this component is mounted into the editor header
	// and any throw here would blank the entire settings slot.
	const selectedBlockOverrides = useSelect( ( select ) => {
		try {
			const storeSelectors = select( blockEditorStore );
			const clientId =
				storeSelectors?.getSelectedBlockClientId?.() ?? null;
			if ( ! clientId ) {
				return {};
			}
			const rawReader =
				storeSelectors?.__experimentalGetRawBlockAttributes;
			const raw = rawReader
				? rawReader( clientId )
				: storeSelectors?.getBlockAttributes?.( clientId );
			const responsive = raw?.responsive;
			if ( ! responsive ) {
				return {};
			}
			const result = {};
			for ( const [ bp, tree ] of Object.entries( responsive ) ) {
				if ( tree && Object.keys( tree ).length > 0 ) {
					result[ bp ] = true;
				}
			}
			return result;
		} catch ( _e ) {
			return {};
		}
	}, [] );

	useEffect( () => {
		function handleKeydown( event ) {
			if ( ! event.altKey || event.ctrlKey || event.metaKey ) {
				return;
			}
			const index = [ '1', '2', '3' ].indexOf( event.key );
			if ( index === -1 ) {
				return;
			}
			const slug = RESPONSIVE_BREAKPOINT_DISPLAY_ORDER[ index ];
			if ( slug ) {
				event.preventDefault();
				setSelectedBreakpoint( slug );
			}
		}
		document.addEventListener( 'keydown', handleKeydown );
		return () => document.removeEventListener( 'keydown', handleKeydown );
	}, [ setSelectedBreakpoint ] );

	return (
		<div
			onClickCapture={ handleClickCapture }
			className={
				isMultiPreview
					? 'block-editor-responsive-breakpoint-selector__wrap is-multi-preview'
					: 'block-editor-responsive-breakpoint-selector__wrap'
			}
			title={ __(
				'Shift+click any breakpoint to show all three side-by-side'
			) }
		>
		<ToggleGroupControl
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			isBlock
			hideLabelFromVision
			label={ __( 'Editing breakpoint' ) }
			className="block-editor-responsive-breakpoint-selector"
			value={ selectedBreakpoint }
			onChange={ ( value ) =>
				setSelectedBreakpoint( value || 'desktop' )
			}
		>
			{ RESPONSIVE_BREAKPOINT_DISPLAY_ORDER.map( ( slug ) => {
				const breakpoint = RESPONSIVE_BREAKPOINTS[ slug ];
				const hasOverride = !! selectedBlockOverrides[ slug ];
				const inCanvas = canvasBreakpoints.includes( slug );
				return (
					<ToggleGroupControlOptionIcon
						key={ slug }
						value={ slug }
						icon={ breakpoint.icon }
						label={ breakpoint.label }
						data-has-override={ hasOverride ? 'true' : undefined }
						data-override-breakpoint={
							hasOverride ? slug : undefined
						}
						data-in-canvas={ inCanvas ? 'true' : undefined }
					/>
				);
			} ) }
		</ToggleGroupControl>
		</div>
	);
}
