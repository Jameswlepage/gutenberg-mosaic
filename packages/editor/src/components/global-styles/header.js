/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useEffect } from '@wordpress/element';
import { useNavigator } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { useGlobalStylesHeader } from './header-context';

function ScreenHeader( { title, description } ) {
    const navigator = useNavigator();
    const { setHeader } = useGlobalStylesHeader();

    useEffect( () => {
        const path = navigator?.location?.path ?? '/';
        const canGoBack = path !== '/';
        setHeader( {
            title: title || __( 'Styles' ),
            onBack: canGoBack ? () => window.history.back() : null,
        } );
        return () => setHeader( null );
    }, [ title, setHeader, navigator ] );

    // Render description below content if provided; title/back lives in fixed header
    return description ? (
        <p className="edit-site-global-styles-header__description">{ description }</p>
    ) : null;
}

export default ScreenHeader;
