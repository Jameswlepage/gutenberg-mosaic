/**
 * Shared Mosaic Overlay (experiment)
 * Parameterized by class prefix and navigation hooks to reuse in Post and Site editors.
 */

/**
 * WordPress dependencies
 */
import { useCallback, useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { parse } from '@wordpress/blocks';
import { BlockPreview } from '@wordpress/block-editor';
import { Button, __experimentalText as Text, Icon, SearchControl, SelectControl, DropdownMenu, MenuGroup, MenuItem, Spinner, Dropdown, Tooltip } from '@wordpress/components';
import { plus, moreVertical, postAuthor as userIcon, funnel } from '@wordpress/icons';
import { useDispatch, useSelect } from '@wordpress/data';
import { useEntityRecords, store as coreStore } from '@wordpress/core-data';
import { store as noticesStore } from '@wordpress/notices';
// Avoid self-dependency on @wordpress/editor to prevent dependency cycles in PHP dependency resolution
import { store as editorStore } from '../../store';

const VIEWPORT_WIDTH = 1000;

function useMaxColumnsByViewport() {
    const [ cols, setCols ] = useState( 1 );
    useEffect( () => {
        const compute = () => {
            const w = window.innerWidth || 0;
            // Cap at 4 columns on widest viewports
            if ( w >= 1280 ) return 4;
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
        const obs = new IntersectionObserver( ( entries ) => {
            entries.forEach( ( entry ) => {
                if ( entry.isIntersecting ) {
                    setVisible( true );
                    obs.disconnect();
                }
            } );
        }, { rootMargin: '200px' } );
        obs.observe( ref.current );
        return () => obs.disconnect();
    }, [ ref ] );
    return visible;
}

const blockParseCache = new Map();
function PageTilePreview( { contentHTML, cacheKey, classPrefix, postType, editors } ) {
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
        if ( visible && !ready ) {
            const id = requestAnimationFrame( () => setReady( true ) );
            return () => cancelAnimationFrame( id );
        }
    }, [ visible, ready ] );
    const isEmpty = ready && !blocks?.length;
    return (
        <div ref={ containerRef } className={ `${ classPrefix }__tile-frame${ ready ? ' is-ready' : '' }${ isEmpty ? ' is-empty' : '' }` }>
            { (editors && editors.length) ? (
                <div className={`${ classPrefix }__tile-avatars`}>
                    { editors.slice(0,3).map( (u, i) => {
                        const label = u?.name || 'User';
                        const urls = u?.avatar_urls || {};
                        const src = u.__placeholder ? '' : ( urls['96'] || urls['128'] || urls['48'] || urls['24'] || '' );
                        const tooltipText = `Editing: ${ label }`;
                        return src ? (
                            <Tooltip key={ i } text={ tooltipText }>
                                <img className={`${ classPrefix }__tile-avatar`} src={ src } alt={ label } />
                            </Tooltip>
                        ) : (
                            <Tooltip key={ i } text={ tooltipText }>
                                <div className={`${ classPrefix }__tile-avatar ${ classPrefix }__tile-avatar--placeholder`} aria-label={ tooltipText } />
                            </Tooltip>
                        );
                    } ) }
                </div>
            ) : null }
            <div className={ `${ classPrefix }__tile-content${ ready ? ' is-ready' : '' }` }>
                { visible && blocks?.length ? (
                    <BlockPreview blocks={ blocks } viewportWidth={ VIEWPORT_WIDTH } />
                ) : isEmpty ? (
                    postType === 'post' ? (
                        <div className={`${ classPrefix }__wireframe ${ classPrefix }__wireframe--post`} aria-hidden="true">
                            { Array.from({ length: 8 }).map( ( _, i ) => (
                                <div key={ i } className={`${ classPrefix }__wireframe-row ${ classPrefix }__wireframe-row--flex`} />
                            ) ) }
                            <div className={`${ classPrefix }__wireframe-label`} title="No content yet">No content yet</div>
                        </div>
                    ) : (
                        <div className={`${ classPrefix }__wireframe ${ classPrefix }__wireframe--page`} aria-hidden="true">
                            <div className={`${ classPrefix }__wireframe-hero ${ classPrefix }__wireframe-hero--tall`} />
                            <div className={`${ classPrefix }__wireframe-row ${ classPrefix }__wireframe-row--wide`} />
                            <div className={`${ classPrefix }__wireframe-grid ${ classPrefix }__wireframe-grid--2col`}>
                                <div />
                                <div />
                            </div>
                            <div className={`${ classPrefix }__wireframe-label`} title="No content yet">No content yet</div>
                        </div>
                    )
                ) : null }
            </div>
            <div className={`${ classPrefix }__tile-skeleton`} />
        </div>
    );
}

export default function MosaicOverlay( {
    classPrefix,
    initialPostType = 'page',
    allowTypeSwitch = false,
    onClose,
    onOpenNew,
    onOpenItem, // (event, record) => void, optional
    getItemHref, // (record) => string, optional
    isActiveItem, // (record) => boolean, optional
    getEditorsForItem, // (record) => Array<{ id?:number, name?:string, avatar_urls?:Record<string,string> }>
    overlayClassName = '',
} ) {
    const [ postType, setPostType ] = useState( initialPostType );
    const [ search, setSearch ] = useState( '' );
    const [ debouncedSearch, setDebouncedSearch ] = useState( '' );
    const [ statusFilter, setStatusFilter ] = useState( 'all' );
    const [ sort, setSort ] = useState( 'date_desc' );
    const [ page, setPage ] = useState( 1 );
    const perPage = 20;
    const maxByViewport = useMaxColumnsByViewport();
    const { saveEntityRecord, deleteEntityRecord } = useDispatch( coreStore );
    const { createSuccessNotice, createErrorNotice } = useDispatch( noticesStore );
    const filtersButtonRef = useRef( null );

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
        _fields: [ 'id', 'title', 'status', 'content', 'date', 'modified', 'link', 'type' ].join(),
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
    const overlayRef = useRef();
    // Track dirty state to control header save button visibility while Mosaic is open
    const isDirty = useSelect( ( select ) => {
        const ed = select( editorStore );
        return !! ( ed?.isEditedPostDirty?.() || ed?.hasNonPostEntityChanges?.() );
    }, [] );

    useEffect( () => {
        if ( page === 1 ) {
            if ( isResolving && ! safeRecords.length ) return;
            setItems( safeRecords );
            requestAnimationFrame( () => {
                if ( tileRefs.current[0] ) {
                    setActiveIndex( 0 );
                    tileRefs.current[0].focus();
                }
            } );
        } else if ( safeRecords.length ) {
            setItems( ( prev ) => [ ...prev, ...safeRecords ] );
        }
    }, [ safeRecords, page, isResolving ] );

    // Infinite scroll
    useEffect( () => {
        if ( ! loadMoreRef.current ) return;
        const el = loadMoreRef.current;
        const io = new IntersectionObserver( ( entries ) => {
            const entry = entries[0];
            if ( entry && entry.isIntersecting && ! isResolving && ! fetchingRef.current ) {
                if ( totalPages && page < totalPages ) {
                    fetchingRef.current = true;
                    setPage( (p) => p + 1 );
                }
            }
        }, { rootMargin: '200px 0px' } );
        io.observe( el );
        return () => io.disconnect();
    }, [ isResolving, page, totalPages ] );

    useEffect( () => { if ( ! isResolving ) fetchingRef.current = false; }, [ isResolving ] );

    useEffect( () => {
        overlayRef.current?.focus?.();
        // Reflect dirty state on the root element to show the Save button in header while Mosaic is open
        const html = document?.documentElement;
        if ( isDirty ) html?.classList?.add( 'is-mosaic-dirty' );
        else html?.classList?.remove( 'is-mosaic-dirty' );
        const onKey = ( e ) => {
            if ( e.key === 'Escape' ) onClose?.();
            if ( e.key === '/' ) {
                // Focus the header search input
                requestAnimationFrame( () => {
                    const input = overlayRef.current?.querySelector?.( 'input[type="search"], input[role="searchbox"]' );
                    if ( input ) {
                        input.focus();
                        e.preventDefault();
                    }
                } );
            }
        };
        const onTabKey = ( e ) => {
            if ( e.key !== 'Tab' ) return;
            const root = overlayRef.current;
            if ( ! root ) return;
            // If focus is inside the grid, let the grid manage Tab navigation.
            const gridEl = root.querySelector( `.${ classPrefix }__grid` );
            if ( gridEl && gridEl.contains( e.target ) ) return;
            const focusables = root.querySelectorAll(
                'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'
            );
            if ( ! focusables.length ) return;
            const first = focusables[0];
            const last = focusables[ focusables.length - 1 ];
            if ( e.shiftKey && document.activeElement === first ) {
                e.preventDefault();
                last.focus();
            } else if ( ! e.shiftKey && document.activeElement === last ) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener( 'keydown', onKey, true );
        document.addEventListener( 'keydown', onTabKey, true );
        return () => {
            document.removeEventListener( 'keydown', onKey, true );
            document.removeEventListener( 'keydown', onTabKey, true );
            html?.classList?.remove( 'is-mosaic-dirty' );
        };
    }, [ onClose, isDirty ] );

    return (
        <div
            className={ `${ classPrefix }__overlay${ overlayClassName ? ' ' + overlayClassName : '' }` }
            role="dialog"
            aria-modal="true"
            aria-label="Mosaic overview"
            tabIndex={ -1 }
            ref={ overlayRef }
        >
                <div className={`${ classPrefix }__header`}>
                    <div className={`${ classPrefix }__left`}>
                        <div className={`${ classPrefix }__header-title`}>
                            { `All ${ postType === 'page' ? 'Pages' : postType === 'post' ? 'Posts' : (postType || 'Content') }` }
                        </div>
                        { allowTypeSwitch && (
                            <div className={`${ classPrefix }__type-toggle`}>
                                <Button __next40pxDefaultSize variant={ postType === 'page' ? 'primary' : 'tertiary' } onClick={ () => { setPage(1); setPostType('page'); } }>Pages</Button>
                                <Button __next40pxDefaultSize variant={ postType === 'post' ? 'primary' : 'tertiary' } onClick={ () => { setPage(1); setPostType('post'); } }>Posts</Button>
                            </div>
                        ) }
                    </div>
                    <div className={`${ classPrefix }__header-actions`}>
                        <SearchControl
                            __next40pxDefaultSize
                            value={ search }
                            onChange={ (v) => { if ( page !== 1 ) setPage( 1 ); setSearch( v ); } }
                            label="Search"
                            hideLabelFromVision
                            placeholder="Search by title"
                        />
                        <Dropdown
                            popoverProps={ { placement: 'bottom-end', className: `${ classPrefix }__filters-popover` } }
                            renderToggle={ ( { isOpen, onToggle } ) => (
                                <Button
                                    __next40pxDefaultSize
                                    icon={ funnel }
                                    ref={ (el) => { filtersButtonRef.current = el; } }
                                    aria-expanded={ isOpen }
                                    aria-haspopup="true"
                                    onClick={ onToggle }
                                    label="Filters"
                                    style={ { color: '#fff' } }
                                    isPressed={ isOpen }
                                />
                            ) }
                            renderContent={ () => (
                                <div style={ { padding: 12, minWidth: 280, display: 'grid', gap: 10 } }>
                                    <SelectControl
                                        __next40pxDefaultSize
                                        label="Status"
                                        value={ statusFilter }
                                        onChange={ ( v ) => { if ( page !== 1 ) setPage( 1 ); setStatusFilter( v ); } }
                                        options={ [
                                            { label: 'All', value: 'all' },
                                            { label: 'Draft', value: 'draft' },
                                            { label: 'Published', value: 'publish' },
                                            { label: 'Scheduled', value: 'future' },
                                            { label: 'Private', value: 'private' },
                                        ] }
                                    />
                                    <SelectControl
                                        __next40pxDefaultSize
                                        label="Sort"
                                        value={ sort }
                                        onChange={ ( v ) => { if ( page !== 1 ) setPage( 1 ); setSort( v ); } }
                                        options={ [
                                            { label: 'Newest', value: 'date_desc' },
                                            { label: 'Oldest', value: 'date_asc' },
                                            { label: 'Recently modified', value: 'modified_desc' },
                                            { label: 'Least recently modified', value: 'modified_asc' },
                                            { label: 'Title A–Z', value: 'title_asc' },
                                            { label: 'Title Z–A', value: 'title_desc' },
                                        ] }
                                    />
                                </div>
                            ) }
                        />
                    </div>
                </div>
            <div className={`${ classPrefix }__body${ (page === 1 && items.length === 0) ? ' ' + classPrefix + '__body--single-empty' : '' }`}>
                { page === 1 && isResolving && ! items.length ? null : (
                    <div
                        className={`${ classPrefix }__grid${ (page === 1 && items.length === 0) ? ' ' + classPrefix + '__grid--single-empty' : '' }`}
                        role="grid"
                        aria-label="Items"
                        style={ { gridTemplateColumns: `repeat(${ Math.min( (items.length + 1) || 1, maxByViewport ) }, minmax(0, 1fr))` } }
                        onKeyDown={ (e) => {
                            if ( e.key === 'Tab' ) {
                                const lastIndex = items.length; // plus tile is last
                                if ( e.shiftKey ) {
                                    if ( activeIndex > 0 ) {
                                        e.preventDefault();
                                        const prev = activeIndex - 1;
                                        setActiveIndex( prev );
                                        tileRefs.current[ prev ]?.focus?.();
                                    }
                                    // if at first, allow default to go back to header controls
                                    return;
                                }
                                // forward tab
                                if ( activeIndex < lastIndex ) {
                                    e.preventDefault();
                                    const next = activeIndex + 1;
                                    setActiveIndex( next );
                                    const el = next === lastIndex ? plusRef.current : tileRefs.current[ next ];
                                    el?.focus?.();
                                    return;
                                }
                                // at last (+) allow default to move to next control after grid
                                return;
                            }
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
                            const href = getItemHref?.( r );
                            const cacheKey = `${ r.id }:${ r.modified || r.date || '' }`;
                            const isActive = !! isActiveItem?.( r );
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
                            const linkProps = onOpenItem
                                ? { href: '#', onClick: (e) => onOpenItem( e, r ) }
                                : { href };
                            const editors = getEditorsForItem ? ( getEditorsForItem( r ) || [] ) : [];
                            // Only show collaborator avatars when there are collaborators beyond the author themself.
                            // Stub behavior: if there is more than one editor listed for the item, treat as collaborators and show.
                            const showCollaborators = Array.isArray( editors ) && editors.length > 1;
                            const headerEditors = editors.length ? editors.slice(0,1) : ( isActive ? [ { __placeholder: true } ] : [] );
                            return (
                                <a
                                    key={ r.id }
                                    ref={ (el) => tileRefs.current[idx] = el }
                                    tabIndex={ activeIndex === idx ? 0 : -1 }
                                    onFocus={ () => setActiveIndex( idx ) }
                                    className={`${ classPrefix }__tile`}
                                    role="gridcell"
                                    aria-label={`${ title } • ${ statusLabel( r?.status ) }`}
                                    { ...linkProps }
                                >
                                    { href ? <link rel="prefetch" href={ href } /> : null }
                                    <div className={`${ classPrefix }__tile-header`}>
                                        <div className={`${ classPrefix }__tile-header-left`}>
                                            { isActive && (
                                                <Tooltip text="Active post">
                                                    <span className={`${ classPrefix }__tile-active-dot`} role="img" aria-label="Active post" />
                                                </Tooltip>
                                            ) }
                                        </div>
                                        <div className={`${ classPrefix }__tile-header-title`} title={ title }>{ title }</div>
                                        <div className={`${ classPrefix }__tile-header-right`}>
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
                                                            <MenuItem onClick={ (e)=>{ e.preventDefault(); e.stopPropagation(); if (href) window.open( href, '_blank' ); onClose(); } }>Open in new tab</MenuItem>
                                                            <MenuItem onClick={ (e)=>{ e.preventDefault(); e.stopPropagation(); if (r?.link) window.open( r.link, '_blank' ); onClose(); } }>Preview on site</MenuItem>
                                                            <MenuItem onClick={ async (e)=>{ e.preventDefault(); e.stopPropagation(); try { await navigator.clipboard.writeText( r?.link || '' ); createSuccessNotice( 'Link copied.', { type: 'snackbar' } ); } catch{} onClose(); } }>Copy link</MenuItem>
                                                            { href && (
                                                                <MenuItem onClick={ async (e)=>{ e.preventDefault(); e.stopPropagation(); try { await navigator.clipboard.writeText( window.location.origin + '/' + href ); createSuccessNotice( 'Edit link copied.', { type: 'snackbar' } ); } catch{} onClose(); } }>Copy edit link</MenuItem>
                                                            ) }
                                                        </MenuGroup>
                                                        <MenuGroup>
                                                            <MenuItem onClick={ duplicate }>Duplicate</MenuItem>
                                                            <MenuItem onClick={ (e)=>{ e.preventDefault(); e.stopPropagation(); if (href) window.open( href + '#revisions', '_blank' ); onClose(); } }>View revisions</MenuItem>
                                                        </MenuGroup>
                                                        <MenuGroup>
                                                            <MenuItem isDestructive onClick={ trash }>Move to trash</MenuItem>
                                                        </MenuGroup>
                                                    </>
                                                ) }
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                    <PageTilePreview
                                        contentHTML={ r?.content?.raw ?? r?.content?.rendered ?? '' }
                                        cacheKey={ cacheKey }
                                        classPrefix={ classPrefix }
                                        postType={ r?.type || postType }
                                        editors={ showCollaborators ? editors : [] }
                                    />
                                </a>
                            );
                        } ) }
                        <button
                            ref={ (el) => plusRef.current = el }
                            tabIndex={ activeIndex === items.length ? 0 : -1 }
                            onFocus={ () => setActiveIndex( items.length ) }
                            className={`${ classPrefix }__tile ${ classPrefix }__tile--plus`}
                            onClick={ () => onOpenNew?.( postType ) }
                            aria-label={ postType === 'post' ? 'New post' : 'New page' }
                            title={ postType === 'post' ? 'Create a new post' : 'Create a new page' }
                            role="gridcell"
                        >
                            <div className={`${ classPrefix }__tile-frame ${ classPrefix }__tile-frame--center`}>
                                <Icon icon={ plus } size={ 56 } />
                            </div>
                        </button>
                        <div ref={ loadMoreRef } className={`${ classPrefix }__sentinel`} aria-hidden="true" />
                    </div>
                ) }
            </div>
        </div>
    );
}
