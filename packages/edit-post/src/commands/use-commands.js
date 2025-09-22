/**
 * WordPress dependencies
 */
import { useSelect, useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { fullscreen, plus, category as mosaicIcon } from '@wordpress/icons';
import { useCommand } from '@wordpress/commands';
import { store as preferencesStore } from '@wordpress/preferences';
import { store as editorStore } from '@wordpress/editor';
import { store as noticesStore } from '@wordpress/notices';

export default function useCommands() {
	const { isFullscreen } = useSelect( ( select ) => {
		const { get } = select( preferencesStore );

		return {
			isFullscreen: get( 'core/edit-post', 'fullscreenMode' ),
		};
	}, [] );
	const { toggle, set: setPreference } = useDispatch( preferencesStore );
	const { createInfoNotice } = useDispatch( noticesStore );

    const { isMosaicOpen, isPostOrPage, postType } = useSelect( ( select ) => {
        const { get } = select( preferencesStore );
        const { getCurrentPostType } = select( editorStore );
        return {
            isMosaicOpen: !! get( 'core/edit-post', 'mosaicViewOpen' ),
            isPostOrPage: [ 'page', 'post' ].includes( getCurrentPostType?.() ),
            postType: getCurrentPostType?.(),
        };
    } );

    useCommand( {
        name: 'core/toggle-fullscreen-mode',
        label: isFullscreen
            ? __( 'Exit fullscreen' )
            : __( 'Enter fullscreen' ),
        icon: fullscreen,
        callback: ( { close } ) => {
			toggle( 'core/edit-post', 'fullscreenMode' );
			close();
			createInfoNotice(
				isFullscreen ? __( 'Fullscreen off.' ) : __( 'Fullscreen on.' ),
				{
					id: 'core/edit-post/toggle-fullscreen-mode/notice',
					type: 'snackbar',
					actions: [
						{
							label: __( 'Undo' ),
							onClick: () => {
								toggle( 'core/edit-post', 'fullscreenMode' );
							},
						},
					],
				}
			);
		},
	} );

    useCommand( {
        name: 'core/edit-post/toggle-mosaic',
        label: isMosaicOpen ? __( 'Close Mosaic' ) : __( 'Open Mosaic' ),
        icon: mosaicIcon,
        context: 'entity-edit',
        callback: ( { close } ) => {
            if ( ! globalThis.__experimentalMosaicView || ! isPostOrPage ) {
                createInfoNotice( __( 'Mosaic is available for Posts and Pages only.' ), {
                    type: 'snackbar',
                    id: 'core/edit-post/toggle-mosaic/notice',
                } );
                close();
                return;
            }
            setPreference( 'core/edit-post', 'mosaicViewOpen', ! isMosaicOpen );
            close();
        },
    } );

    // Suggested: New item of same type when Mosaic is open
    const newLabel = postType === 'page' ? __( 'New Page' ) : __( 'New Post' );
    useCommand( {
        name: 'core/edit-post/new-current-type',
        label: newLabel,
        icon: plus,
        context: 'entity-edit',
        callback: ( { close } ) => {
            if ( ! isPostOrPage ) return close?.();
            window.location.href = `post-new.php?post_type=${ postType }`;
            close?.();
        },
    } );
}
