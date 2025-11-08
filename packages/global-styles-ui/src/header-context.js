/**
 * WordPress dependencies
 */
import { createContext, useContext, useState, useMemo } from '@wordpress/element';

const GlobalStylesHeaderContext = createContext( {
    header: null,
    setHeader: () => {},
} );

export function GlobalStylesHeaderProvider( { children } ) {
    const [ header, setHeader ] = useState( null );
    const value = useMemo( () => ( { header, setHeader } ), [ header ] );
    return (
        <GlobalStylesHeaderContext.Provider value={ value }>
            { children }
        </GlobalStylesHeaderContext.Provider>
    );
}

export function useGlobalStylesHeader() {
    return useContext( GlobalStylesHeaderContext );
}

export default GlobalStylesHeaderContext;

