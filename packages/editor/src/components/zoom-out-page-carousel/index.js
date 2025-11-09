/**
 * WordPress dependencies
 */
import { useSelect } from '@wordpress/data';
import { useEntityRecords, useEntityBlockEditor, store as coreStore } from '@wordpress/core-data';
import { store as interfaceStore } from '@wordpress/interface';
import { addQueryArgs } from '@wordpress/url';
import { useMemo, useState, useLayoutEffect } from '@wordpress/element';
import { decodeEntities } from '@wordpress/html-entities';
import { Tooltip } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';
import './style.scss';
import { unlock } from '../../lock-unlock';
import {
    BlockEditorProvider,
    BlockContextProvider,
    BlockList,
    privateApis as blockEditorPrivateApis,
} from '@wordpress/block-editor';

const { ExperimentalBlockCanvas: PreviewCanvas } = unlock( blockEditorPrivateApis );

function PagePreviewCard( { page, position, onClick, isNavigating, settings, offsets } ) {
    const templateId = useSelect(
        ( select ) => unlock( select( coreStore ) ).getTemplateId( 'page', page.id ),
        [ page.id ]
    );
    const [ templateBlocks ] = useEntityBlockEditor( 'postType', 'wp_template', {
        id: templateId || 0,
    } );

    const tooltipLabel =
        position === 'previous'
            ? `Previous page: ${ decodeEntities( page.title.rendered ) }`
            : `Next page: ${ decodeEntities( page.title.rendered ) }`;

    return (
        <Tooltip text={ tooltipLabel } placement="top">
            <button
                className={ `editor-zoom-out-page-carousel__preview editor-zoom-out-page-carousel__preview--${ position }` }
                onClick={ onClick }
                disabled={ isNavigating }
                aria-label={ tooltipLabel }
                style={
                    position === 'previous'
                        ? { left: `${ offsets.left }px` }
                        : { right: `${ offsets.right }px` }
                }
            >
                <div className="editor-zoom-out-page-carousel__preview-content">
                    { ( ! templateId || ! templateBlocks ) && (
                        <div className="editor-zoom-out-page-carousel__preview-loading" />
                    ) }
                    <div className="editor-zoom-out-page-carousel__preview-iframe">
                        <BlockEditorProvider value={ templateBlocks || [] } settings={ settings }>
                            <PreviewCanvas shouldIframe={ false } height="100%" styles={ settings?.styles }>
                                <BlockContextProvider value={ { postType: 'page', postId: page.id } }>
                                    <BlockList __unstableDisableDropZone />
                                </BlockContextProvider>
                            </PreviewCanvas>
                        </BlockEditorProvider>
                    </div>
                </div>
            </button>
        </Tooltip>
    );
}

export default function ZoomOutPageCarousel() {
    const {
        currentPostId,
        currentPostType,
        isListViewOpen,
        hasRightSidebar,
        isInserterOpened,
        settings,
    } = useSelect( ( select ) => {
        const { getCurrentPostId, getCurrentPostType, getEditorSettings, isListViewOpened } =
            select( editorStore );
        const { getActiveComplementaryArea } = select( interfaceStore );

        return {
            currentPostId: getCurrentPostId(),
            currentPostType: getCurrentPostType(),
            isListViewOpen: isListViewOpened(),
            hasRightSidebar: !! getActiveComplementaryArea( 'core' ),
            isInserterOpened: select( editorStore ).isInserterOpened(),
            settings: getEditorSettings(),
        };
    }, [] );

	// Only show carousel for pages
	if ( currentPostType !== 'page' ) {
		return null;
	}

    const { records: pages, isResolving } = useEntityRecords(
        'postType',
        'page',
        {
            per_page: 100, // Get all pages (using 100 instead of -1 for better performance)
            orderby: 'menu_order',
            order: 'asc',
            status: 'publish,draft,pending,private,future',
            _embed: 'wp:featuredmedia', // Include featured images for previews
            context: 'edit',
        }
    );

    const [ isNavigating, setIsNavigating ] = useState( false );
    // Entrance animation state: start entering, then switch to ready next frame.
    const [ isEntering, setIsEntering ] = useState( true );
    useLayoutEffect( () => {
        const id = requestAnimationFrame( () => setIsEntering( false ) );
        return () => cancelAnimationFrame( id );
    }, [] );
    const [ offsets, setOffsets ] = useState( { left: 0, right: 0 } );

    // Measure the visible canvas (scale container) and align previews to its edges
    useLayoutEffect( () => {
        const update = () => {
            const el = document.querySelector( '.block-editor-iframe__scale-container' );
            if ( ! el ) {
                setOffsets( { left: 0, right: 0 } );
                return;
            }
            const rect = el.getBoundingClientRect();
            const left = Math.max( 0, Math.round( rect.left ) );
            const right = Math.max( 0, Math.round( window.innerWidth - rect.right ) );
            setOffsets( { left, right } );
        };

        update();
        const el = document.querySelector( '.block-editor-iframe__scale-container' );
        let ro;
        if ( el && 'ResizeObserver' in window ) {
            ro = new ResizeObserver( update );
            ro.observe( el );
        }
        window.addEventListener( 'resize', update );
        return () => {
            window.removeEventListener( 'resize', update );
            if ( ro ) {
                ro.disconnect();
            }
        };
    }, [] );

	const currentPageIndex = useMemo( () => {
		if ( ! pages || ! currentPostId ) {
			return -1;
		}
		// Handle both number and string IDs
		const index = pages.findIndex(
			( page ) => page.id === currentPostId || page.id === Number( currentPostId )
		);
		return index;
	}, [ pages, currentPostId ] );

	const handleNavigate = ( pageId ) => {
		setIsNavigating( true );

		// Navigate in-place without full reload when in Site Editor
		if ( window.location.pathname.includes( '/site-editor.php' ) ) {
			const newUrl = addQueryArgs( window.location.pathname, {
				postType: 'page',
				postId: pageId,
				canvas: 'edit',
			} );
			// Push state and notify the Router
			window.history.pushState( {}, '', newUrl );
			window.dispatchEvent( new PopStateEvent( 'popstate' ) );

			// Reset navigating state after animation
			setTimeout( () => setIsNavigating( false ), 500 );
			return;
		}
		// Fallback to classic post editor (full navigation)
		window.location.href = `/wp-admin/post.php?post=${ pageId }&action=edit`;
	};

	const goToPreviousPage = () => {
		if ( currentPageIndex > 0 && pages ) {
			handleNavigate( pages[ currentPageIndex - 1 ].id );
		}
	};

	const goToNextPage = () => {
		if ( currentPageIndex < pages.length - 1 && pages ) {
			handleNavigate( pages[ currentPageIndex + 1 ].id );
		}
	};

	// Show disabled buttons while loading or if there's only one page
	const hasPrevious = ! isResolving && pages && currentPageIndex > 0;
	const hasNext =
		! isResolving &&
		pages &&
		currentPageIndex >= 0 &&
		currentPageIndex < pages.length - 1;

	// Don't render if pages aren't loaded yet or still loading
    if ( isResolving || ! pages || pages.length === 0 ) {
        return null;
    }

	const previousPage =
		currentPageIndex > 0 ? pages[ currentPageIndex - 1 ] : null;
	const nextPage =
		currentPageIndex < pages.length - 1
			? pages[ currentPageIndex + 1 ]
			: null;

	// Keep overlay even if there is only one adjacent side missing; hide chevrons via disabled state.

    const isSidebarOpen = isListViewOpen || hasRightSidebar || isInserterOpened;
    return (
        <div
            className={ `editor-zoom-out-page-carousel ${ isNavigating ? 'is-navigating' : '' } ${ isSidebarOpen ? 'is-obscured' : '' } ${ isEntering ? 'is-entering' : '' }` }
        >
            { previousPage && (
                <PagePreviewCard
                    page={ previousPage }
                    position="previous"
                    onClick={ goToPreviousPage }
                    isNavigating={ isNavigating }
                    settings={ settings }
                    offsets={ offsets }
                />
            ) }
            { nextPage && (
                <PagePreviewCard
                    page={ nextPage }
                    position="next"
                    onClick={ goToNextPage }
                    isNavigating={ isNavigating }
                    settings={ settings }
                    offsets={ offsets }
                />
            ) }
        </div>
    );
}
