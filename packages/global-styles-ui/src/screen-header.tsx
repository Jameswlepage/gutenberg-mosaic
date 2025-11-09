/**
 * WordPress dependencies
 */
import {
	__experimentalVStack as VStack,
	useNavigator,
} from '@wordpress/components';
import { useEffect, useCallback, useRef } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { useGlobalStylesHeader } from './header-context';

interface ScreenHeaderProps {
	title: string;
	description?: string | React.ReactElement;
	onBack?: () => void;
}

export function ScreenHeader( {
	title,
	description,
	onBack,
}: ScreenHeaderProps ) {
	const { setHeader } = useGlobalStylesHeader();
	const navigator = useNavigator();

	// Use provided onBack or create one from Navigator context
	// Show back button if not on root path
	const currentPath = navigator.location.path;
	const isNotRoot = currentPath !== '/';

	// Store navigator in ref to avoid recreating callback
	const navigatorRef = useRef( navigator );
	navigatorRef.current = navigator;

	// Store onBack in ref to keep it fresh without causing re-renders
	const onBackRef = useRef( onBack );
	onBackRef.current = onBack;

	// Create a single stable callback that handles both cases
	const stableBackCallback = useCallback( () => {
		if ( onBackRef.current ) {
			onBackRef.current();
		} else if ( navigatorRef.current.location.path !== '/' ) {
			navigatorRef.current.goBack();
		}
	}, [] );

	// Determine if we should show back button based on current state
	// The callback itself is stable, we just pass null or the callback
	const shouldShowBack = !! onBack || isNotRoot;

	useEffect( () => {
		setHeader( title, shouldShowBack ? stableBackCallback : null );
	}, [ title, shouldShowBack, stableBackCallback, setHeader ] );

	return (
		<VStack spacing={ 0 }>
			{ description && (
				<p className="global-styles-ui-header__description">
					{ description }
				</p>
			) }
		</VStack>
	);
}
