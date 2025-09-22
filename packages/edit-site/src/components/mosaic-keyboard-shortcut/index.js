/**
 * WordPress dependencies
 */
import { useEffect } from '@wordpress/element';
import {
    useShortcut,
    store as keyboardShortcutsStore,
} from '@wordpress/keyboard-shortcuts';
import { __ } from '@wordpress/i18n';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

const shortcutName = 'core/edit-post/toggle-mosaic';

export default function MosaicKeyboardShortcut() {
    if ( ! globalThis.__experimentalMosaicView ) return null;
    const { registerShortcut, unregisterShortcut } = useDispatch(
        keyboardShortcutsStore
    );
    const { set: setPreference } = useDispatch( preferencesStore );
    const isOpen = useSelect( ( select ) => !! select( preferencesStore ).get( 'core/edit-post', 'mosaicViewOpen' ) );

    useEffect( () => {
        registerShortcut( {
            name: shortcutName,
            category: 'global',
            description: __( 'Open Mosaic view' ),
            keyCombination: {
                modifier: 'primaryShift',
                character: 'm',
            },
        } );
        return () => {
            unregisterShortcut( shortcutName );
        };
    }, [ registerShortcut, unregisterShortcut ] );

    useShortcut( shortcutName, () => {
        setPreference( 'core/edit-post', 'mosaicViewOpen', ! isOpen );
    } );

    return null;
}
