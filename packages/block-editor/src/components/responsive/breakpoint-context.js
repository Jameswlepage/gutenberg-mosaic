/**
 * WordPress dependencies
 */
import {
	createContext,
	useContext,
	useCallback,
	useMemo,
	useState,
} from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { DEFAULT_BREAKPOINT } from './constants';

const ResponsiveBreakpointContext = createContext( {
	selectedBreakpoint: DEFAULT_BREAKPOINT,
	setSelectedBreakpoint: () => {},
	canvasBreakpoints: [ DEFAULT_BREAKPOINT ],
	toggleCanvasBreakpoint: () => {},
	resetCanvasBreakpoints: () => {},
} );

// 'core/editor' lives above us in the package layering; reading from/writing
// to it is only ever reached via the experiment flag. When the flag is off,
// the provider falls back to local state and no layering boundary is crossed
// at runtime. See CLAUDE.md "Package layering".
const EDITOR_STORE_NAME = 'core/editor';

const BP_TO_DEVICE = {
	desktop: 'Desktop',
	tablet: 'Tablet',
	mobile: 'Mobile',
};
const DEVICE_TO_BP = {
	Desktop: 'desktop',
	Tablet: 'tablet',
	Mobile: 'mobile',
};

/**
 * Provider reads the active editing breakpoint from the editor's
 * `deviceType` state so changing the breakpoint also physically resizes the
 * canvas (mobile edits need a mobile-width viewport for media queries to
 * fire and preview correctly). Setting the breakpoint dispatches
 * `setDeviceType` — one concept, not two. If the editor store isn't loaded
 * (e.g. standalone block-editor host), the provider degrades to local state.
 * @param root0
 * @param root0.children
 */
export function ResponsiveBreakpointProvider( { children } ) {
	const deviceType = useSelect( ( select ) => {
		const store = select( EDITOR_STORE_NAME );
		return store?.getDeviceType?.() ?? 'Desktop';
	}, [] );

	const dispatch = useDispatch();

	const selectedBreakpoint = DEVICE_TO_BP[ deviceType ] ?? DEFAULT_BREAKPOINT;

	const setSelectedBreakpoint = useCallback(
		( bp ) => {
			const device = BP_TO_DEVICE[ bp ];
			if ( ! device ) {
				return;
			}
			const editorDispatch = dispatch( EDITOR_STORE_NAME );
			if ( editorDispatch?.setDeviceType ) {
				editorDispatch.setDeviceType( device );
			}
		},
		[ dispatch ]
	);

	// `canvasBreakpoints` is the set of breakpoint slugs currently rendered in
	// the canvas area. Single-member = normal single-canvas mode (the current
	// `selectedBreakpoint` drives the existing canvas). Multi-member = stacked
	// iframe preview in visual-editor. Regular clicks reset to a single entry;
	// shift+clicks toggle that bp in/out of the set while preserving the rest.
	// Always keeps at least one entry so we never render an empty canvas.
	const [ canvasBreakpoints, setCanvasBreakpoints ] = useState( [
		selectedBreakpoint,
	] );

	const toggleCanvasBreakpoint = useCallback( ( bp ) => {
		setCanvasBreakpoints( ( prev ) => {
			if ( prev.includes( bp ) ) {
				if ( prev.length === 1 ) {
					return prev; // never empty
				}
				return prev.filter( ( s ) => s !== bp );
			}
			return [ ...prev, bp ];
		} );
	}, [] );

	const resetCanvasBreakpoints = useCallback( ( bp ) => {
		setCanvasBreakpoints( [ bp ] );
	}, [] );

	const value = useMemo(
		() => ( {
			selectedBreakpoint,
			setSelectedBreakpoint,
			canvasBreakpoints,
			toggleCanvasBreakpoint,
			resetCanvasBreakpoints,
		} ),
		[
			selectedBreakpoint,
			setSelectedBreakpoint,
			canvasBreakpoints,
			toggleCanvasBreakpoint,
			resetCanvasBreakpoints,
		]
	);

	return (
		<ResponsiveBreakpointContext.Provider value={ value }>
			{ children }
		</ResponsiveBreakpointContext.Provider>
	);
}

export function useResponsiveBreakpoint() {
	return useContext( ResponsiveBreakpointContext );
}

export function useIsBaseBreakpoint() {
	return (
		useContext( ResponsiveBreakpointContext ).selectedBreakpoint ===
		DEFAULT_BREAKPOINT
	);
}

export function useIsMultiDevicePreview() {
	return useContext( ResponsiveBreakpointContext ).canvasBreakpoints.length > 1;
}

export function useCanvasBreakpoints() {
	return useContext( ResponsiveBreakpointContext ).canvasBreakpoints;
}
