/**
 * WordPress dependencies
 */
import { useEffect } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import {
	useShortcut,
	store as keyboardShortcutsStore,
} from '@wordpress/keyboard-shortcuts';
import { __ } from '@wordpress/i18n';
import { store as preferencesStore } from '@wordpress/preferences';
import { store as editorStore } from '@wordpress/editor';

/**
 * Internal dependencies
 */
import { store as editPostStore } from '../../store';

function KeyboardShortcuts() {
    const { toggleFullscreenMode } = useDispatch( editPostStore );
    const { registerShortcut } = useDispatch( keyboardShortcutsStore );
    const { set: setPreference } = useDispatch( preferencesStore );
    const { isMosaicOpen, isPostOrPage } = useSelect( ( select ) => {
        const { get } = select( preferencesStore );
        const { getCurrentPostType } = select( editorStore );
        return {
            isMosaicOpen: !! get( 'core/edit-post', 'mosaicViewOpen' ),
            isPostOrPage: [ 'page', 'post' ].includes( getCurrentPostType?.() ),
        };
    } );

	useEffect( () => {
		registerShortcut( {
			name: 'core/edit-post/toggle-fullscreen',
			category: 'global',
			description: __( 'Enable or disable fullscreen mode.' ),
			keyCombination: {
				modifier: 'secondary',
				character: 'f',
			},
		} );
    }, [] );

    useShortcut( 'core/edit-post/toggle-fullscreen', () => {
        toggleFullscreenMode();
    } );

    // Register and handle Mosaic toggle (Cmd/Ctrl+Shift+M)
    useEffect( () => {
        if ( ! globalThis.__experimentalMosaicView ) return;
        registerShortcut( {
            name: 'core/edit-post/toggle-mosaic',
            category: 'global',
            description: __( 'Open Mosaic view' ),
            keyCombination: {
                modifier: 'primaryShift',
                character: 'm',
            },
        } );
    }, [] );

    useShortcut( 'core/edit-post/toggle-mosaic', () => {
        if ( ! globalThis.__experimentalMosaicView ) return;
        if ( ! isPostOrPage ) return;
        setPreference( 'core/edit-post', 'mosaicViewOpen', ! isMosaicOpen );
    } );

    return null;
}

export default KeyboardShortcuts;
