/**
 * WordPress dependencies
 */
import { createContext, useContext, useState, useMemo, useCallback, useRef } from '@wordpress/element';

/**
 * @typedef {Object} GlobalStylesHeaderContextValue
 * @property {string} title - The header title
 * @property {(() => void) | null} onBack - The back button callback
 * @property {(title: string, onBack?: (() => void) | null) => void} setHeader - Function to update header
 */

/** @type {import('react').Context<GlobalStylesHeaderContextValue>} */
const GlobalStylesHeaderContext = createContext( {
    title: '',
    onBack: null,
    setHeader: () => {},
} );

export function GlobalStylesHeaderProvider( { children } ) {
    const [ header, setHeaderState ] = useState( { title: '', onBack: null } );

    const setHeader = useCallback( ( newTitle, newOnBack ) => {
        setHeaderState( ( prev ) => {
            // Only update if values actually changed to prevent infinite loops
            if ( prev.title === newTitle && prev.onBack === newOnBack ) {
                return prev;
            }
            return { title: newTitle, onBack: newOnBack };
        } );
    }, [] );

    const value = useMemo(
        () => ( { title: header.title, onBack: header.onBack, setHeader } ),
        [ header.title, header.onBack, setHeader ]
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

