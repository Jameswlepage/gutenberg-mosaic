/* eslint-disable curly */
/* global navigator */
/**
 * WordPress dependencies
 */
import { useCallback, useEffect, useMemo, useRef, useState, createPortal } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { parse } from '@wordpress/blocks';
import { BlockPreview } from '@wordpress/block-editor';
import { Button, __experimentalText as Text, Icon, SearchControl, SelectControl, DropdownMenu, MenuGroup, MenuItem } from '@wordpress/components';
import { plus, moreVertical } from '@wordpress/icons';
import { useEntityRecords } from '@wordpress/core-data';
import { store as preferencesStore } from '@wordpress/preferences';
import { store as commandsStore } from '@wordpress/commands';
import { store as coreStore } from '@wordpress/core-data';
import { store as noticesStore } from '@wordpress/notices';

/**
 * Internal dependencies
 */
import useNavigateToEntityRecord from '../block-editor/use-navigate-to-entity-record';
import { privateApis as routerPrivateApis } from '@wordpress/router';
import { unlock } from '../../lock-unlock';

const { useLocation } = unlock( routerPrivateApis );

const VIEWPORT_WIDTH = 1000;
const blockParseCache = new Map();

function useMaxColumnsByViewport() {
    const [ cols, setCols ] = useState( 1 );
    useEffect( () => {
        const compute = () => {
            const w = window.innerWidth || 0;
            if ( w >= 1280 ) return 5;
            if ( w >= 960 ) return 4;
            if ( w >= 782 ) return 3;
            if ( w >= 600 ) return 2;
            return 1;
        };
        const onResize = () => setCols( compute() );
        setCols( compute() );
        window.addEventListener( 'resize', onResize );
        return () => window.removeEventListener( 'resize', onResize );
    }, [] );
    return cols;
}

function useInViewport( ref ) {
    const [ visible, setVisible ] = useState( false );
    useEffect( () => {
        if ( ! ref.current ) return;
        if ( typeof window !== 'undefined' && 'IntersectionObserver' in window ) {
            const obs = new window.IntersectionObserver( ( entries ) => {
                entries.forEach( ( entry ) => {
                    if ( entry.isIntersecting ) {
                        setVisible( true );
                        obs.disconnect();
                    }
                } );
            }, { rootMargin: '200px' } );
            obs.observe( ref.current );
            return () => obs.disconnect();
        }
        setVisible( true );
    }, [ ref ] );
    return visible;
}

function PageTilePreview( { contentHTML, cacheKey } ) {
    const containerRef = useRef( null );
    const visible = useInViewport( containerRef );
    const blocks = useMemo( () => {
        if ( ! visible ) return [];
        if ( cacheKey && blockParseCache.has( cacheKey ) ) return blockParseCache.get( cacheKey );
        const parsed = parse( contentHTML || '' );
        if ( cacheKey ) blockParseCache.set( cacheKey, parsed );
        return parsed;
    }, [ contentHTML, visible, cacheKey ] );
    const [ ready, setReady ] = useState( false );
    useEffect( () => {
        if ( visible && blocks?.length && !ready ) {
            const id = window.requestAnimationFrame( () => setReady( true ) );
            return () => window.cancelAnimationFrame( id );
        }
        if ( visible && !blocks?.length && !ready ) {
            const id = window.requestAnimationFrame( () => setReady( true ) );
            return () => window.cancelAnimationFrame( id );
        }
    }, [ visible, blocks?.length, ready ] );
    const isEmpty = ready && !blocks?.length;
    return (
        <div ref={ containerRef } className={ `edit-site-mosaic__tile-frame${ ready ? ' is-ready' : '' }${ isEmpty ? ' is-empty' : '' }` }>
            <div className={ `edit-site-mosaic__tile-content${ ready ? ' is-ready' : '' }` }>
                { visible && blocks?.length ? (
                    <BlockPreview blocks={ blocks } viewportWidth={ VIEWPORT_WIDTH } />
                ) : null }
            </div>
            <div className="edit-site-mosaic__tile-skeleton" />
        </div>
    );
}

export default function SiteMosaicOverlay() {
    // Call hooks in a stable order on every render to avoid hook-order mismatches
    const { query } = useLocation();
    const isCanvasEdit = query?.canvas === 'edit';
    const [ canvasEl, setCanvasEl ] = useState( () => (
        ! isCanvasEdit ? ( document.querySelector( '.edit-site-layout__canvas' ) || null ) : null
    ) );
    useEffect( () => {
        if ( isCanvasEdit ) return;
        const el = document.querySelector( '.edit-site-layout__canvas' );
        setCanvasEl( el || null );
    }, [ isCanvasEdit ] );

    const isOpen = useSelect( ( select ) => !! select( preferencesStore ).get( 'core/edit-post', 'mosaicViewOpen' ) );

    if ( ! globalThis.__experimentalMosaicView || ! isOpen ) return null;

    const overlay = <SiteMosaicOverlayInner inCanvas={ ! isCanvasEdit } />;
    if ( ! isCanvasEdit && ! canvasEl ) {
        // Wait for canvas container before mounting overlay to avoid a full-width flash
        return null;
    }
    if ( ! isCanvasEdit && canvasEl ) {
        return createPortal( overlay, canvasEl );
    }
    return overlay;
}

function SiteMosaicOverlayInner( { inCanvas = false } ) {
    const onNavigateToEntityRecord = useNavigateToEntityRecord();
    const { set: setPreference } = useDispatch( preferencesStore );
    const [ postType, setPostType ] = useState( 'page' );
    const [ search, setSearch ] = useState( '' );
    const [ debouncedSearch, setDebouncedSearch ] = useState( '' );
    const [ statusFilter, setStatusFilter ] = useState( 'all' );
    const [ sort, setSort ] = useState( 'date_desc' );
    const [ page, setPage ] = useState( 1 );
    const perPage = 20;
    const maxByViewport = useMaxColumnsByViewport();

    useEffect( () => {
        const t = setTimeout( () => setDebouncedSearch( search ), 250 );
        return () => clearTimeout( t );
    }, [ search ] );

    const query = useMemo( () => ( {
        context: 'edit',
        page,
        per_page: perPage,
        order: sort.endsWith('_desc') ? 'desc' : 'asc',
        orderby: sort.startsWith('title') ? 'title' : sort.startsWith('modified') ? 'modified' : 'date',
        search: debouncedSearch,
        status: statusFilter === 'all' ? 'any' : statusFilter,
        _fields: [ 'id', 'title', 'status', 'content', 'date', 'modified', 'link' ].join(),
    } ), [ page, perPage, debouncedSearch, statusFilter, sort, postType ] );

    const { records, isResolving, totalPages } = useEntityRecords( 'postType', postType, query );
    const safeRecords = records || [];
    const [ items, setItems ] = useState( () => ( page === 1 ? safeRecords : [] ) );
    const loadMoreRef = useRef( null );
    const fetchingRef = useRef( false );
    const [ activeIndex, setActiveIndex ] = useState( 0 );
    const tileRefs = useRef( [] );
    const menuButtonRefs = useRef( [] );
    const plusRef = useRef( null );
    // Hoisted dispatchers
    const { saveEntityRecord, deleteEntityRecord } = useDispatch( coreStore );
    const { createSuccessNotice, createErrorNotice } = useDispatch( noticesStore );

    useEffect( () => {
        if ( page === 1 ) {
            setItems( safeRecords );
            window.requestAnimationFrame( () => {
                if ( tileRefs.current[0] ) {
                    setActiveIndex( 0 );
                    tileRefs.current[0].focus();
                }
            } );
        } else {
            setItems( ( prev ) => [ ...prev, ...safeRecords ] );
        }
    }, [ safeRecords, page ] );

    const openNew = useCallback( () => {
        window.location.href = `post-new.php?post_type=${ postType }`;
    }, [ postType ] );

    // Infinite scroll sentinel
    useEffect( () => {
        if ( ! loadMoreRef.current ) return;
        const el = loadMoreRef.current;
        const io = typeof window !== 'undefined' && 'IntersectionObserver' in window
            ? new window.IntersectionObserver( ( entries ) => {
                const entry = entries[0];
                if ( entry && entry.isIntersecting && ! isResolving && ! fetchingRef.current ) {
                    if ( totalPages && page < totalPages ) {
                        fetchingRef.current = true;
                        setPage( (p) => p + 1 );
                    }
                }
            }, { rootMargin: '200px 0px' } ) : null;
        if ( io ) {
            io.observe( el );
            return () => io.disconnect();
        }
        return undefined;
    }, [ isResolving, page, totalPages ] );

    useEffect( () => { if ( ! isResolving ) fetchingRef.current = false; }, [ isResolving ] );

    const onClose = useCallback( () => {
        setPreference( 'core/edit-post', 'mosaicViewOpen', false );
    }, [ setPreference ] );

    const overlayRef = useRef();
    useEffect( () => {
        overlayRef.current?.focus?.();
        const html = document?.documentElement;
        html?.classList?.add( 'is-mosaic-open' );
        const onKey = ( e ) => {
            if ( e.key === 'Escape' ) onClose();
            if ( e.key === '/' ) {
                const input = overlayRef.current?.querySelector?.( 'input[type="search"], input[role="searchbox"]' );
                input?.focus?.();
                e.preventDefault();
            }
        };
        document.addEventListener( 'keydown', onKey, true );
        const onTabKey = ( e ) => {
            if ( e.key !== 'Tab' ) return;
            const root = overlayRef.current;
            if ( ! root ) return;
            const focusables = root.querySelectorAll(
                'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'
            );
            if ( ! focusables.length ) return;
            const first = focusables[0];
            const last = focusables[ focusables.length - 1 ];
            const activeEl = root.ownerDocument?.activeElement || document.activeElement;
            if ( e.shiftKey && activeEl === first ) {
                e.preventDefault();
                last.focus();
            } else if ( ! e.shiftKey && activeEl === last ) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener( 'keydown', onTabKey, true );
        return () => {
            document.removeEventListener( 'keydown', onKey, true );
            document.removeEventListener( 'keydown', onTabKey, true );
            html?.classList?.remove( 'is-mosaic-open' );
        };
    }, [ onClose ] );

    return (
        <div
            className={ `edit-site-mosaic__overlay${ inCanvas ? ' edit-site-mosaic__overlay--in-canvas' : '' }` }
            role="dialog"
            aria-modal="true"
            aria-label="Mosaic overview"
            tabIndex={ -1 }
            ref={ overlayRef }
        >
                <div className="edit-site-mosaic__header">
                    <div className="edit-site-mosaic__left">
                        <div className="edit-site-mosaic__header-title">
                            { (() => {
                                if ( postType === 'page' ) return 'All Pages';
                                if ( postType === 'post' ) return 'All Posts';
                                return `All ${ postType || 'Content' }`;
                            })() }
                        </div>
                        <div className="edit-site-mosaic__type-toggle">
                    <Button
                        __next40pxDefaultSize
                        variant={ postType === 'page' ? 'primary' : 'tertiary' }
                        onClick={ () => setPostType( 'page' ) }
                    >Pages</Button>
                    <Button
                        __next40pxDefaultSize
                        variant={ postType === 'post' ? 'primary' : 'tertiary' }
                        onClick={ () => setPostType( 'post' ) }
                    >Posts</Button>
                        </div>
                    </div>
                <div className="edit-site-mosaic__header-actions">
                    <SelectControl
                        __next40pxDefaultSize
                        __nextHasNoMarginBottom
                        hideLabelFromVision
                        label="Sort"
                        value={ sort }
                        onChange={ (v)=> {
                            setPage( 1 );
                            setSort( v );
                        } }
                        options={ [
                            { label: 'Newest', value: 'date_desc' },
                            { label: 'Oldest', value: 'date_asc' },
                            { label: 'Recently modified', value: 'modified_desc' },
                            { label: 'Least recently modified', value: 'modified_asc' },
                            { label: 'Title A–Z', value: 'title_asc' },
                            { label: 'Title Z–A', value: 'title_desc' },
                        ] }
                    />
                    <SelectControl
                        __next40pxDefaultSize
                        __nextHasNoMarginBottom
                        hideLabelFromVision
                        label="Status"
                        value={ statusFilter }
                        onChange={ (v)=> {
                            setPage( 1 );
                            setStatusFilter( v );
                        } }
                        options={ [
                            { label: 'All', value: 'all' },
                            { label: 'Draft', value: 'draft' },
                            { label: 'Published', value: 'publish' },
                            { label: 'Scheduled', value: 'future' },
                            { label: 'Private', value: 'private' },
                        ] }
                    />
                    <SearchControl
                        __next40pxDefaultSize
                        __nextHasNoMarginBottom
                        value={ search }
                        onChange={ (v) => {
                            setPage( 1 );
                            setSearch( v );
                        } }
                        label="Search"
                        hideLabelFromVision
                        placeholder="Search by title"
                    />
                </div>
            </div>
            <div className="edit-site-mosaic__body">
                { page === 1 && isResolving && ! items.length ? null : (
                <div
                    className="edit-site-mosaic__grid"
                    role="grid"
                    aria-label="Items"
                    tabIndex={ 0 }
                    style={ { gridTemplateColumns: `repeat(${ Math.min( (items.length + 1) || 1, maxByViewport ) }, minmax(0, 1fr))` } }
                    onKeyDown={ (e) => {
                        const columns = Math.min( (items.length + 1) || 1, maxByViewport );
                        const lastIndex = items.length;
                        let next = activeIndex;
                        const atPlus = activeIndex === lastIndex;
                        switch ( e.key ) {
                            case 'ArrowRight': next = Math.min( activeIndex + 1, lastIndex ); break;
                            case 'ArrowLeft': next = Math.max( activeIndex - 1, 0 ); break;
                            case 'ArrowDown': next = Math.min( activeIndex + columns, lastIndex ); break;
                            case 'ArrowUp': next = Math.max( activeIndex - columns, 0 ); break;
                            case 'Home': next = 0; break;
                            case 'End': next = lastIndex; break;
                            case 'ContextMenu':
                            case 'F10':
                                if ( e.shiftKey || e.key === 'ContextMenu' ) {
                                    e.preventDefault();
                                    menuButtonRefs.current[ activeIndex ]?.click?.();
                                    return;
                                }
                                break;
                            case '.': {
                                e.preventDefault();
                                menuButtonRefs.current[ activeIndex ]?.click?.();
                                return;
                            }
                            case 'Enter':
                            case ' ': {
                                e.preventDefault();
                                if ( atPlus ) plusRef.current?.click?.();
                                else tileRefs.current[ activeIndex ]?.click?.();
                                return;
                            }
                            default: return;
                        }
        				e.preventDefault();
                        setActiveIndex( next );
                        const el = next === lastIndex ? plusRef.current : tileRefs.current[ next ];
                        el?.focus?.();
                    } }
                >
                    { items.map( ( r, idx ) => {
                        const title = r?.title?.rendered || '(Untitled)';
                        const statusLabel = (s)=>({ draft: 'Draft', publish: 'Published', future: 'Scheduled', private: 'Private', pending: 'Pending' })[s] || s;
                        const preview = r?.link;
                        const cacheKey = `${ r.id }:${ r.modified || r.date || '' }`;
                        const duplicate = async (e) => {
                            e.preventDefault(); e.stopPropagation();
                            try {
                                const newPost = await saveEntityRecord( 'postType', postType, {
                                    title: `${ title }`,
                                    status: 'draft',
                                    content: r?.content?.raw ?? r?.content?.rendered ?? ''
                                }, { throwOnError: true } );
                                createSuccessNotice( 'Duplicated to draft.', { type: 'snackbar' } );
                                window.open( `post.php?post=${ newPost.id }&action=edit`, '_blank' );
                            } catch (err) {
                                createErrorNotice( 'Could not duplicate.', { type: 'snackbar' } );
                            }
                        };
                        const trash = async (e) => {
                            e.preventDefault(); e.stopPropagation();
                            try {
                                await deleteEntityRecord( 'postType', postType, r.id, undefined, { throwOnError: true } );
                                createSuccessNotice( 'Moved to trash.', { type: 'snackbar' } );
                            } catch (err) {
                                createErrorNotice( 'Could not move to trash.', { type: 'snackbar' } );
                            }
                        };
                        return (
                            <a
                                key={ r.id }
                                ref={ (el) => tileRefs.current[idx] = el }
                                tabIndex={ activeIndex === idx ? 0 : -1 }
                                onFocus={ () => setActiveIndex( idx ) }
                                className="edit-site-mosaic__tile"
                                href={ `/${ postType }/${ r.id }?canvas=edit` }
                                onClick={ (e) => { e.preventDefault(); onNavigateToEntityRecord( { postType, postId: r.id } ); } }
                                role="gridcell"
                                aria-label={`${ title } • ${ statusLabel( r?.status ) }`}
                            >
                                <div className="edit-site-mosaic__tile-menu">
                                    <DropdownMenu
                                        icon={ moreVertical }
                                        label={ `More actions for ${ title }` }
                                        toggleProps={ {
                                            isSmall: true,
                                            variant: 'tertiary',
                                            tabIndex: -1,
                                            ref: (el) => {
                                                if (!menuButtonRefs.current) menuButtonRefs.current = [];
                                                menuButtonRefs.current[idx] = el;
                                            },
                                            onClick: (e)=>{ e.preventDefault(); e.stopPropagation(); }
                                        } }
                                    >
                                        { ( { onClose } ) => (
                                            <>
                                                <MenuGroup>
                                                    <MenuItem onClick={ (e)=>{ e.preventDefault(); e.stopPropagation(); window.open( `post.php?post=${ r.id }&action=edit`, '_blank' ); onClose(); } }>Open in new tab</MenuItem>
                                                    <MenuItem onClick={ (e)=>{ e.preventDefault(); e.stopPropagation(); if (preview) window.open( preview, '_blank' ); onClose(); } }>Preview on site</MenuItem>
                                                    <MenuItem onClick={ async (e)=>{ e.preventDefault(); e.stopPropagation(); try { if ( typeof navigator !== 'undefined' && navigator.clipboard?.writeText ) { await navigator.clipboard.writeText( preview || '' ); createSuccessNotice( 'Link copied.', { type: 'snackbar' } ); } } catch( _err ){} onClose(); } }>Copy link</MenuItem>
                                                    <MenuItem onClick={ async (e)=>{ e.preventDefault(); e.stopPropagation(); try { if ( typeof navigator !== 'undefined' && navigator.clipboard?.writeText ) { await navigator.clipboard.writeText( window.location.origin + `/wp-admin/post.php?post=${ r.id }&action=edit` ); createSuccessNotice( 'Edit link copied.', { type: 'snackbar' } ); } } catch( _err ){} onClose(); } }>Copy edit link</MenuItem>
                                                </MenuGroup>
                                                <MenuGroup>
                                                    <MenuItem onClick={ duplicate }>Duplicate</MenuItem>
                                                    <MenuItem onClick={ (e)=>{ e.preventDefault(); e.stopPropagation(); window.open( `/wp-admin/post.php?post=${ r.id }&action=edit#revisions`, '_blank' ); onClose(); } }>View revisions</MenuItem>
                                                </MenuGroup>
                                                <MenuGroup>
                                                    <MenuItem isDestructive onClick={ trash }>Move to trash</MenuItem>
                                                </MenuGroup>
                                            </>
                                        ) }
                                    </DropdownMenu>
                                </div>
                                <PageTilePreview contentHTML={ r?.content?.raw ?? r?.content?.rendered ?? '' } cacheKey={ cacheKey } />
                                <div className="edit-site-mosaic__tile-meta">
                                    <span className="edit-site-mosaic__tile-title">{ title } 
                                        <span aria-hidden="true"> • </span>
                                        { statusLabel( r?.status ) }
                                    </span>
                                </div>
                            </a>
                        );
                    } ) }
                    <button
                        ref={ (el) => plusRef.current = el }
                        tabIndex={ activeIndex === items.length ? 0 : -1 }
                        onFocus={ () => setActiveIndex( items.length ) }
                        className="edit-site-mosaic__tile edit-site-mosaic__tile--plus"
                        onClick={ openNew }
                        aria-label={ postType === 'post' ? 'New post' : 'New page' }
                        title={ postType === 'post' ? 'Create a new post' : 'Create a new page' }
                        role="gridcell"
                    >
                        <div className="edit-site-mosaic__tile-frame edit-site-mosaic__tile-frame--center">
                            <Icon icon={ plus } size={ 56 } />
                        </div>
                    </button>
                    <div ref={ loadMoreRef } className="edit-site-mosaic__sentinel" aria-hidden="true" />
                </div>
                ) }
            </div>
        </div>
    );
}
