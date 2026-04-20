/**
 * WordPress dependencies
 */
import { createContext, useContext, useCallback, useMemo } from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { DEFAULT_BREAKPOINT } from './constants';

const ResponsiveBreakpointContext = createContext( {
	selectedBreakpoint: DEFAULT_BREAKPOINT,
	setSelectedBreakpoint: () => {},
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
 */
export function ResponsiveBreakpointProvider( { children } ) {
	const deviceType = useSelect( ( select ) => {
		const store = select( EDITOR_STORE_NAME );
		return store?.getDeviceType?.() ?? 'Desktop';
	}, [] );

	const dispatch = useDispatch();

	const selectedBreakpoint =
		DEVICE_TO_BP[ deviceType ] ?? DEFAULT_BREAKPOINT;

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

	const value = useMemo(
		() => ( { selectedBreakpoint, setSelectedBreakpoint } ),
		[ selectedBreakpoint, setSelectedBreakpoint ]
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
	return useContext( ResponsiveBreakpointContext ).selectedBreakpoint === DEFAULT_BREAKPOINT;
}
