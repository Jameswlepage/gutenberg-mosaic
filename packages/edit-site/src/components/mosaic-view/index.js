/**
 * WordPress dependencies
 */
import { useEffect, useMemo, useState } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';
import { MosaicOverlay } from '@wordpress/editor';
import { store as coreStore } from '@wordpress/core-data';
import { privateApis as routerPrivateApis } from '@wordpress/router';
import { unlock } from '../../lock-unlock';
import { createPortal } from '@wordpress/element';

const { useLocation, useHistory } = unlock( routerPrivateApis );

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
    const typeOptions = useSelect( ( select ) => {
        const types = select( coreStore ).getPostTypes?.( { per_page: -1 } ) || [];
        // Limit to posts and pages for now; expand to CPTs later if desired.
        const allowed = types.filter( ( t ) => [ 'page', 'post' ].includes( t.slug ) );
        return allowed.map( ( t ) => ( { value: t.slug, label: t.labels?.name || t.labels?.singular_name || t.name || t.slug } ) );
    }, [] );
    const history = useHistory();
    const [ isClosing, setIsClosing ] = useState( false );
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
    const activeType = useMemo( () => {
        if ( typeof path === 'string' ) {
            const m = path.match(/^\/(post|page)\//);
            if ( m ) return m[1];
        }
        return 'page';
    }, [ path ] );

    // Presence writer for Site Editor
    useEffect( () => {
        if ( ! activeEntityId ) return;
        const key = `gb:mosaic:presence:${ currentUser?.id || 'me' }:${ activeType }:${ activeEntityId }`;
        const write = () => {
            try {
                const payload = {
                    userId: currentUser?.id,
                    name: currentUser?.name || '',
                    avatar_urls: currentUser?.avatar_urls || {},
                    type: activeType,
                    id: activeEntityId,
                    ts: Date.now(),
                };
                localStorage.setItem( key, JSON.stringify( payload ) );
            } catch {}
        };
        const iv = setInterval( write, 5000 );
        write();
        const onUnload = () => { try { localStorage.removeItem( key ); } catch {} };
        window.addEventListener( 'beforeunload', onUnload );
        return () => { clearInterval( iv ); window.removeEventListener( 'beforeunload', onUnload ); try { localStorage.removeItem( key ); } catch {} };
    }, [ activeEntityId, activeType, currentUser ] );

    const onOpenNew = (type) => {
        window.location.href = `post-new.php?post_type=${ type }`;
    };
    const onOpenItem = (e, r) => {
        e.preventDefault();
        const t = r?.type || 'page';
        history.navigate( `/${ t }/${ r.id }?canvas=edit` );
        setPreference( 'core/edit-post', 'mosaicViewOpen', false );
    };

    return (
        <MosaicOverlay
            classPrefix="edit-site-mosaic"
            initialPostType="page"
            allowTypeSwitch={ true }
            typeOptions={ typeOptions }
            overlayClassName={ `${ (!inCanvas || isClosing) ? '' : 'edit-site-mosaic__overlay--in-canvas' }${ isClosing ? ' is-closing' : '' }` }
            onClose={ () => setPreference( 'core/edit-post', 'mosaicViewOpen', false ) }
            onOpenNew={ onOpenNew }
            onOpenItem={ ( e, r ) => {
                // Start closing to ensure overlay persists (fixed) over route change, navigate, then finish fade/close
                e.preventDefault();
                setIsClosing( true );
                const t = r?.type || 'page';
                history.navigate( `/${ t }/${ r.id }?canvas=edit` );
                setTimeout( () => setPreference( 'core/edit-post', 'mosaicViewOpen', false ), 160 );
            } }
            getItemHref={ (r) => `/${ (r?.type || 'page') }/${ r.id }?canvas=edit` }
            isActiveItem={ (r) => activeEntityId === r?.id }
            getEditorsForItem={ (r) => ( activeEntityId === r?.id && currentUser ? [ currentUser ] : [] ) }
        />
    );
}
