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
	const { selectedBreakpoint, setSelectedBreakpoint } =
		useResponsiveBreakpoint();

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
				return (
					<ToggleGroupControlOptionIcon
						key={ slug }
						value={ slug }
						icon={ breakpoint.icon }
						label={ breakpoint.label }
						data-has-override={
							hasOverride ? 'true' : undefined
						}
						data-override-breakpoint={
							hasOverride ? slug : undefined
						}
					/>
				);
			} ) }
		</ToggleGroupControl>
	);
}
