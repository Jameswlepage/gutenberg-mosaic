/**
 * WordPress dependencies
 */
import { useEffect, useCallback } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';
import { MosaicOverlay } from '@wordpress/editor';
import { store as editorStore } from '@wordpress/editor';
import { store as coreStore } from '@wordpress/core-data';

export default function MosaicOverlayWrapper() {
    const enabled = !! globalThis.__experimentalMosaicView;
    const { isOpen, isSupported, postType, postId } = useSelect( ( select ) => {
        const { get } = select( preferencesStore );
        const ed = select( editorStore );
        const cpt = ed?.getCurrentPostType?.();
        const pid = ed?.getCurrentPostId?.() || ed?.getCurrentPost?.()?.id;
        return {
            isOpen: !! get( 'core/edit-post', 'mosaicViewOpen' ),
            isSupported: cpt === 'page' || cpt === 'post',
            postType: cpt,
            postId: pid,
        };
    }, [] );
    // Lightweight presence writer: advertise current user editing this post in localStorage
    const currentUser = useSelect( ( select ) => select( coreStore )?.getCurrentUser?.() );
    useEffect( () => {
        if ( ! enabled || ! isSupported || ! postId || ! postType ) return;
        const key = `gb:mosaic:presence:${ currentUser?.id || 'me' }:${ postType }:${ postId }`;
        const write = () => {
            try {
                const payload = {
                    userId: currentUser?.id,
                    name: currentUser?.name || '',
                    avatar_urls: currentUser?.avatar_urls || {},
                    type: postType,
                    id: postId,
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
    }, [ enabled, isSupported, postId, postType, currentUser ] );

    if ( ! enabled || ! isOpen || ! isSupported ) return null;
    return <MosaicOverlayInner initialPostType={ postType || 'page' } activeId={ postId } />;
}

function MosaicOverlayInner( { initialPostType, activeId } ) {
    const { set: setPreference } = useDispatch( preferencesStore );
    const currentUser = useSelect( ( select ) => select( coreStore )?.getCurrentUser?.() );

    useEffect( () => {
        const html = document?.documentElement;
        html?.classList?.add( 'is-mosaic-open' );
        return () => html?.classList?.remove( 'is-mosaic-open' );
    }, [] );

    const onOpenNew = useCallback( (type) => {
        window.location.href = `post-new.php?post_type=${ type }`;
    }, [] );

    return (
        <MosaicOverlay
            classPrefix="edit-post-mosaic"
            initialPostType={ initialPostType || 'page' }
            allowTypeSwitch={ false }
            onClose={ () => setPreference( 'core/edit-post', 'mosaicViewOpen', false ) }
            onOpenNew={ onOpenNew }
            getItemHref={ (r) => `post.php?post=${ r.id }&action=edit` }
            isActiveItem={ (r) => r?.id === activeId }
            getEditorsForItem={ (r) => ( r?.id === activeId && currentUser ? [ currentUser ] : [] ) }
        />
    );
}
