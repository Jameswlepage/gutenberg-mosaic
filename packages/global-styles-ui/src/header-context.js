/**
 * WordPress dependencies
 */
import { createContext, useContext, useState, useMemo, useCallback, useRef } from '@wordpress/element';

const GlobalStylesHeaderContext = createContext( {
    title: '',
    onBack: null,
    setHeader: () => {},
} );

export function GlobalStylesHeaderProvider( { children } ) {
    const [ header, setHeaderState ] = useState( { title: '', onBack: null } );

    const setHeader = useCallback( ( newTitle, newOnBack ) => {
        setHeaderState( { title: newTitle, onBack: newOnBack } );
    }, [] );

    const value = useMemo(
        () => ( { title: header.title, onBack: header.onBack, setHeader } ),
        [ header, setHeader ]
    );

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

