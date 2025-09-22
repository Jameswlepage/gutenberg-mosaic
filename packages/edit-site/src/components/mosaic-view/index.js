/**
 * WordPress dependencies
 */
import { useEffect, useMemo } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';
import { MosaicOverlay } from '@wordpress/editor';
import { store as coreStore } from '@wordpress/core-data';
import { privateApis as routerPrivateApis } from '@wordpress/router';
import { unlock } from '../../lock-unlock';
import { createPortal } from '@wordpress/element';

const { useLocation } = unlock( routerPrivateApis );

export default function SiteMosaicOverlay() {
    // Stable hooks order
    const { query, path } = useLocation();
    const isCanvasEdit = query?.canvas === 'edit';

    const [ canvasEl ] = useMemo( () => {
        if ( isCanvasEdit ) return [ null ];
        const el = document.querySelector( '.edit-site-layout__canvas' );
        return [ el || null ];
    }, [ isCanvasEdit ] );

    const { isOpen } = useSelect( ( select ) => ({
        isOpen: !! select( preferencesStore ).get( 'core/edit-post', 'mosaicViewOpen' ),
    }) );
    if ( ! globalThis.__experimentalMosaicView || ! isOpen ) return null;

    const overlay = <SiteMosaicOverlayInner inCanvas={ ! isCanvasEdit } path={ path } />;
    if ( ! isCanvasEdit ) {
        if ( ! canvasEl ) return null; // avoid full-width flash
        return createPortal( overlay, canvasEl );
    }
    return overlay;
}

function SiteMosaicOverlayInner( { inCanvas, path } ) {
    const { set: setPreference } = useDispatch( preferencesStore );
    const currentUser = useSelect( ( select ) => select( coreStore )?.getCurrentUser?.() );
    useEffect( () => {
        const html = document?.documentElement;
        html?.classList?.add( 'is-mosaic-open' );
        return () => html?.classList?.remove( 'is-mosaic-open' );
    }, [] );

    const activeEntityId = useMemo( () => {
        if ( typeof path === 'string' ) {
            const m = path.match(/^\/(?:post|page)\/(\d+)/);
            if ( m ) return parseInt( m[1], 10 );
        }
        return undefined;
    }, [ path ] );

    const onOpenNew = (type) => {
        window.location.href = `post-new.php?post_type=${ type }`;
    };
    const onOpenItem = (e, r) => {
        e.preventDefault();
        // Route to entity in Site Editor
        window.location.href = `/wp-admin/site-editor.php?postType=${ r.type || 'page' }&postId=${ r.id }&canvas=edit`;
    };

    return (
        <MosaicOverlay
            classPrefix="edit-site-mosaic"
            initialPostType="page"
            allowTypeSwitch={ true }
            overlayClassName={ inCanvas ? 'edit-site-mosaic__overlay--in-canvas' : '' }
            onClose={ () => setPreference( 'core/edit-post', 'mosaicViewOpen', false ) }
            onOpenNew={ onOpenNew }
            onOpenItem={ onOpenItem }
            getItemHref={ (r) => `/wp-admin/post.php?post=${ r.id }&action=edit` }
            isActiveItem={ (r) => activeEntityId === r?.id }
            getEditorsForItem={ (r) => ( activeEntityId === r?.id && currentUser ? [ currentUser ] : [] ) }
        />
    );
}
