/**
 * WordPress dependencies
 */
import { useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { useDispatch, useSelect } from '@wordpress/data';
import { useCommandLoader } from '@wordpress/commands';
import { plus, category as mosaicIcon, layout } from '@wordpress/icons';
import { store as preferencesStore } from '@wordpress/preferences';
import { privateApis as routerPrivateApis } from '@wordpress/router';
/**
 * Internal dependencies
 */
import { unlock } from '../../lock-unlock';

const { useLocation, useHistory } = unlock( routerPrivateApis );

const getMosaicCommands = () =>
    function useMosaicCommands() {
        const { set: setPreference } = useDispatch( preferencesStore );
        const isOpen = useSelect( ( select ) => !! select( preferencesStore ).get( 'core/edit-post', 'mosaicViewOpen' ) );
        const { query, path } = useLocation();
        const history = useHistory();
        const isCanvasEdit = query?.canvas === 'edit';
        // Derive current post type from the path when possible: /page/ID or /post/ID
        const currentType = useMemo( () => {
            const match = typeof path === 'string' ? path.match(/^\/(\w+)\//) : null;
            const t = match?.[1];
            if ( t === 'post' || t === 'page' ) { return t; }
            return 'page';
        }, [ path ] );
        const newLabel = currentType === 'post' ? __( 'New Post' ) : __( 'New Page' );

        const commands = useMemo( () => {
            if ( ! globalThis.__experimentalMosaicView ) {
                return [];
            }
            const context = isCanvasEdit ? 'entity-edit' : 'site-editor';
            return [
                {
                    name: 'core/edit-post/toggle-mosaic',
                    label: isOpen ? __( 'Close Mosaic' ) : __( 'Open Mosaic' ),
                    icon: mosaicIcon,
                    context,
                    callback: ( { close } ) => {
                        close?.();
                        setPreference( 'core/edit-post', 'mosaicViewOpen', ! isOpen );
                    },
                },
                {
                    name: 'core/edit-post/new-current-type',
                    label: newLabel,
                    icon: plus,
                    context,
                    callback: ( { close } ) => {
                        close?.();
                        window.location.href = `post-new.php?post_type=${ currentType }`;
                    },
                },
                {
                    name: 'core/edit-site/edit-template',
                    label: __( 'Edit template' ),
                    icon: layout,
                    context,
                    callback: ( { close } ) => {
                        close?.();
                        if ( ! isCanvasEdit ) {
                            history.navigate( path, { query: { ...query, canvas: 'edit' } } );
                        }
                    },
                },
            ];
        }, [ isOpen, setPreference, isCanvasEdit, currentType, newLabel, history, path, query ] );

        return { isLoading: false, commands };
    };

export function useMosaicCommand() {
    useCommandLoader( {
        name: 'core/edit-post/toggle-mosaic',
        hook: getMosaicCommands(),
    } );
}
