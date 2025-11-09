/**
 * WordPress dependencies
 */
import {
	__experimentalVStack as VStack,
	useNavigator,
} from '@wordpress/components';
import { useEffect, useCallback } from '@wordpress/element';

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

	const defaultBackCallback = useCallback( () => {
		if ( isNotRoot ) {
			navigator.goBack();
		}
	}, [ isNotRoot, navigator ] );

	const backCallback = onBack || ( isNotRoot ? defaultBackCallback : undefined );

	useEffect( () => {
		setHeader( title, backCallback );
	}, [ title, backCallback, setHeader ] );

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
