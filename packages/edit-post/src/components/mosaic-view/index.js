/**
 * External dependencies
 */
import clsx from 'clsx';
/* eslint-disable curly */
/* global navigator */

/**
 * WordPress dependencies
 */
import { useCallback, useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { parse } from '@wordpress/blocks';
import { BlockPreview } from '@wordpress/block-editor';
import { Icon, SearchControl, SelectControl, DropdownMenu, MenuGroup, MenuItem } from '@wordpress/components';
import { plus, moreVertical } from '@wordpress/icons';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';
import { useEntityRecords, store as coreStore } from '@wordpress/core-data';
import { store as noticesStore } from '@wordpress/notices';
import { store as editorStore } from '@wordpress/editor';
// commandsStore not needed here; title no longer opens palette

const VIEWPORT_WIDTH = 1000;
const blockParseCache = new Map(); // key: `${id}:${modified}` => blocks array

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
		// Fallback when no IO is available
		setVisible( true );
	}, [ ref ] );
	return visible;
}

function PageTilePreview( { contentHTML, cacheKey } ) {
    const containerRef = useRef( null );
    const visible = useInViewport( containerRef );
    const blocks = useMemo( () => {
        if ( ! visible ) return [];
        if ( cacheKey && blockParseCache.has( cacheKey ) ) {
            return blockParseCache.get( cacheKey );
        }
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
            // Empty content: stop shimmer and mark ready to avoid infinite skeleton
            const id = window.requestAnimationFrame( () => setReady( true ) );
            return () => window.cancelAnimationFrame( id );
        }
    }, [ visible, blocks?.length, ready ] );
    const isEmpty = ready && !blocks?.length;
    return (
        <div ref={ containerRef } className={ `edit-post-mosaic__tile-frame${ ready ? ' is-ready' : '' }${ isEmpty ? ' is-empty' : '' }` }>
            <div className={ `edit-post-mosaic__tile-content${ ready ? ' is-ready' : '' }` }>
                { visible && blocks?.length ? (
                    <BlockPreview blocks={ blocks } viewportWidth={ VIEWPORT_WIDTH } />
                ) : null }
            </div>
            <div className="edit-post-mosaic__tile-skeleton" />
        </div>
    );
}

export default function MosaicOverlay() {
	const enabled = !! globalThis.__experimentalMosaicView;
	const { isOpen, isSupported } = useSelect( ( select ) => {
		const { get } = select( preferencesStore );
		const { getCurrentPostType } = select( editorStore );
		const cpt = getCurrentPostType?.();
		return {
			isOpen: !! get( 'core/edit-post', 'mosaicViewOpen' ),
			isSupported: cpt === 'page' || cpt === 'post',
		};
	}, [] );
	if ( ! enabled || ! isOpen || ! isSupported ) return null;
	return <MosaicOverlayInner />;
}

function MosaicOverlayInner() {
	const { set: setPreference } = useDispatch( preferencesStore );
	const currentPostType = useSelect( ( select ) => select( editorStore )?.getCurrentPostType?.() );
    const [ postType ] = useState( currentPostType || 'page' );
    const [ search, setSearch ] = useState( '' );
    const [ debouncedSearch, setDebouncedSearch ] = useState( '' );
    // Default: show all (includes drafts)
    const [ statusFilter, setStatusFilter ] = useState( 'all' );
    const [ sort, setSort ] = useState( 'date_desc' );
	const [ page, setPage ] = useState( 1 );
	const perPage = 20;
    const maxByViewport = useMaxColumnsByViewport();
    // Hoisted dispatchers
    const { saveEntityRecord, deleteEntityRecord } = useDispatch( coreStore );
    const { createSuccessNotice, createErrorNotice } = useDispatch( noticesStore );

	useEffect( () => {
		const t = setTimeout( () => setDebouncedSearch( search ), 250 );
		return () => clearTimeout( t );
	}, [ search ] );

    const orderby = useMemo( () => {
        if ( sort.startsWith( 'title' ) ) return 'title';
        if ( sort.startsWith( 'modified' ) ) return 'modified';
        return 'date';
    }, [ sort ] );
    const query = useMemo( () => ( {
        context: 'edit',
        page,
        per_page: perPage,
        order: sort.endsWith('_desc') ? 'desc' : 'asc',
        orderby,
        search: debouncedSearch,
        status: statusFilter === 'all' ? 'any' : statusFilter,
        _fields: [ 'id', 'title', 'status', 'content', 'date', 'modified', 'link' ].join(),
    } ), [ page, perPage, debouncedSearch, statusFilter, sort, orderby ] );

    const { records, isResolving, totalPages } = useEntityRecords( 'postType', postType, query );
    const safeRecords = records || [];
    const [ items, setItems ] = useState( () => ( page === 1 ? safeRecords : [] ) );
    // Roving tabindex state
    const [ activeIndex, setActiveIndex ] = useState( 0 );
    const tileRefs = useRef( [] );
    const menuButtonRefs = useRef( [] );
    const plusRef = useRef( null );
    const loadMoreRef = useRef( null );
    const fetchingRef = useRef( false );

    useEffect( () => {
        if ( page === 1 ) {
            if ( isResolving && (!safeRecords || !safeRecords.length) ) return;
            setItems( safeRecords );
            // Focus first tile when initial results arrive
            window.requestAnimationFrame( () => {
                if ( tileRefs.current[0] ) {
                    setActiveIndex( 0 );
                    tileRefs.current[0].focus();
                }
            } );
        } else {
            if ( !safeRecords || !safeRecords.length ) return;
            setItems( ( prev ) => [ ...prev, ...safeRecords ] );
        }
    }, [ safeRecords, page, isResolving ] );

    const onClose = useCallback( () => {
        setPreference( 'core/edit-post', 'mosaicViewOpen', false );
    }, [ setPreference ] );

    // Infinite scroll: auto-advance page when sentinel appears
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

    // Reset the fetching guard when a batch finishes
    useEffect( () => {
        if ( ! isResolving ) fetchingRef.current = false;
    }, [ isResolving ] );

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

	const openNew = useCallback( () => {
		window.location.href = `post-new.php?post_type=${ postType }`;
	}, [ postType ] );

    return (
        <div
            className={ clsx( 'edit-post-mosaic__overlay' ) }
            role="dialog"
            aria-modal="true"
            aria-label="Mosaic overview"
            tabIndex={ -1 }
            ref={ overlayRef }
        >
                <div className="edit-post-mosaic__header">
                    <div className="edit-post-mosaic__left">
                        <div
                            className="edit-post-mosaic__header-title"
                        >
                            { `All ${ postType === 'page' ? 'Pages' : postType === 'post' ? 'Posts' : (postType || 'Content') }` }
                        </div>
                    </div>
                    <div className="edit-post-mosaic__header-actions">
                        <SelectControl
                            __next40pxDefaultSize
                            __nextHasNoMarginBottom
                            hideLabelFromVision
                            label="Sort"
                            value={ sort }
                            onChange={ (v)=> {
                                if ( page !== 1 ) {
                                    setPage( 1 );
                                }
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
                                if ( page !== 1 ) {
                                    setPage( 1 );
                                }
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
                            if ( page !== 1 ) {
                                setPage( 1 );
                            }
                            setSearch( v );
                        } }
                        label="Search"
                        hideLabelFromVision
                        placeholder="Search by title"
                    />
                </div>
			</div>
			<div className="edit-post-mosaic__body">
				{ page === 1 && isResolving && ! items.length ? null : (
                <div
                    className="edit-post-mosaic__grid"
                    role="grid"
                    aria-label="Items"
                    tabIndex={ 0 }
                    style={ { gridTemplateColumns: `repeat(${ Math.min( (items.length + 1) || 1, maxByViewport ) }, minmax(0, 1fr))` } }
                    onKeyDown={ (e) => {
                        const columns = Math.min( (items.length + 1) || 1, maxByViewport );
                        const lastIndex = items.length; // plus is last
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
                        const href = `post.php?post=${ r.id }&action=edit`;
                        const preview = r?.link || href;
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
                                className="edit-post-mosaic__tile"
                                href={ href }
                                role="gridcell"
                                aria-label={`${ title } • ${ statusLabel( r?.status ) }`}
                            >
                                <div className="edit-post-mosaic__tile-menu">
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
                                        { ( { onClose: closeMenu } ) => (
                                            <>
                                                <MenuGroup>
                                                    <MenuItem
                                                        onClick={ (e)=>{ e.preventDefault(); e.stopPropagation(); window.open( href, '_blank' ); closeMenu(); } }
                                                    >Open in new tab</MenuItem>
                                                    <MenuItem
                                                        onClick={ (e)=>{ e.preventDefault(); e.stopPropagation(); window.open( preview, '_blank' ); closeMenu(); } }
                                                    >Preview on site</MenuItem>
                                                    <MenuItem
                                                        onClick={ async (e)=>{
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            try {
                                                                if ( typeof navigator !== 'undefined' && navigator.clipboard?.writeText ) {
                                                                    await navigator.clipboard.writeText( preview );
                                                                    createSuccessNotice( 'Link copied.', { type: 'snackbar' } );
                                                                }
                                                            } catch( _err ) {}
                                                            closeMenu();
                                                        } }
                                                    >Copy link</MenuItem>
                                                    <MenuItem
                                                        onClick={ async (e)=>{
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            try {
                                                                if ( typeof navigator !== 'undefined' && navigator.clipboard?.writeText ) {
                                                                    await navigator.clipboard.writeText( window.location.origin + '/' + href );
                                                                    createSuccessNotice( 'Edit link copied.', { type: 'snackbar' } );
                                                                }
                                                            } catch( _err ) {}
                                                            closeMenu();
                                                        } }
                                                    >Copy edit link</MenuItem>
                                                </MenuGroup>
                                                <MenuGroup>
                                                    <MenuItem onClick={ duplicate }>Duplicate</MenuItem>
                                                    <MenuItem onClick={ (e)=>{ e.preventDefault(); e.stopPropagation(); window.open( href + '#revisions', '_blank' ); closeMenu(); } }>View revisions</MenuItem>
                                                </MenuGroup>
                                                <MenuGroup>
                                                    <MenuItem isDestructive onClick={ trash }>Move to trash</MenuItem>
                                                </MenuGroup>
                                            </>
                                        ) }
                                    </DropdownMenu>
                                </div>
                                <PageTilePreview contentHTML={ r?.content?.raw ?? r?.content?.rendered ?? '' } cacheKey={ cacheKey } />
                                <div className="edit-post-mosaic__tile-meta">
                                    <span className="edit-post-mosaic__tile-title">{ title } 
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
                        className="edit-post-mosaic__tile edit-post-mosaic__tile--plus"
                        onClick={ openNew }
                        aria-label={ postType === 'post' ? 'New post' : 'New page' }
                        title={ postType === 'post' ? 'Create a new post' : 'Create a new page' }
                        role="gridcell"
                    >
						<div className="edit-post-mosaic__tile-frame edit-post-mosaic__tile-frame--center">
							<Icon icon={ plus } size={ 56 } />
						</div>
					</button>
                    <div ref={ loadMoreRef } className="edit-post-mosaic__sentinel" aria-hidden="true" />
                </div>
                ) }
            </div>
		</div>
	);
}

/* eslint-enable curly */

// (Removed legacy roving handlers block which duplicated stateful logic)
