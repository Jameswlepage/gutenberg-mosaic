/**
 * WordPress dependencies
 */
import { useSelect } from '@wordpress/data';
import {
	useEntityRecords,
	useEntityBlockEditor,
	store as coreStore,
} from '@wordpress/core-data';
import { store as interfaceStore } from '@wordpress/interface';
import { addQueryArgs } from '@wordpress/url';
import { useMemo, useState, useEffect, useRef } from '@wordpress/element';
import { decodeEntities } from '@wordpress/html-entities';
import { Tooltip } from '@wordpress/components';
import { useReducedMotion } from '@wordpress/compose';
import {
    BlockEditorProvider,
    BlockContextProvider,
    BlockList,
    store as blockEditorStore,
    privateApis as blockEditorPrivateApis,
} from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';
import './style.scss';
import { unlock } from '../../lock-unlock';

const { ExperimentalBlockCanvas: PreviewCanvas } = unlock( blockEditorPrivateApis );
const PREVIEW_RENDER_DELAY_MS = 450;
const ZOOM_ANIMATION_DURATION_MS = 400;

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
	const handleClick = () => {
		if ( isNavigating ) {
			return;
		}
		onClick();
	};

	return (
		<Tooltip text={ tooltipLabel } placement="top">
			<button
				type="button"
				className={ `editor-zoom-out-page-carousel__preview editor-zoom-out-page-carousel__preview--${ position }` }
				onClick={ handleClick }
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
		isZoomedOut,
	} = useSelect( ( select ) => {
		const { getCurrentPostId, getCurrentPostType, getEditorSettings, isListViewOpened } =
			select( editorStore );
		const { getActiveComplementaryArea } = select( interfaceStore );
		const { isZoomOut: getIsZoomOut } = unlock( select( blockEditorStore ) );

		return {
			currentPostId: getCurrentPostId(),
			currentPostType: getCurrentPostType(),
			isListViewOpen: isListViewOpened(),
			hasRightSidebar: !! getActiveComplementaryArea( 'core' ),
			isInserterOpened: select( editorStore ).isInserterOpened(),
			settings: getEditorSettings(),
			isZoomedOut: getIsZoomOut(),
		};
	}, [] );

	if ( currentPostType !== 'page' ) {
		return null;
	}

	const prefersReducedMotion = useReducedMotion();
	const [ shouldShowContent, setShouldShowContent ] = useState( prefersReducedMotion );
	const [ isEntering, setIsEntering ] = useState( false );
	const [ isExiting, setIsExiting ] = useState( false );
	const [ isNavigating, setIsNavigating ] = useState( false );
	const [ offsets, setOffsets ] = useState( { left: 0, right: 0 } );
	const previousIsZoomedOut = useRef( isZoomedOut );

	// Detect zoom in/out transitions
	useEffect( () => {
		let rafId;
		let timeoutId;

		// Entering: zoom out (false -> true)
		if ( ! previousIsZoomedOut.current && isZoomedOut ) {
			setIsExiting( false );
			setIsEntering( true );

			if ( ! prefersReducedMotion ) {
				// Use requestAnimationFrame to ensure the browser paints the initial state
				// before we start the transition sequence
				rafId = requestAnimationFrame( () => {
					// Wait for zoom animation to complete before sliding in
					timeoutId = setTimeout( () => {
						setIsEntering( false );
					}, ZOOM_ANIMATION_DURATION_MS );
				} );
			} else {
				setIsEntering( false );
			}
		}
		// Exiting: zoom in (true -> false)
		else if ( previousIsZoomedOut.current && ! isZoomedOut ) {
			setIsExiting( true );
			setIsEntering( false );
			// Remove carousel after exit animation completes (600ms slide animation)
			if ( ! prefersReducedMotion ) {
				timeoutId = setTimeout( () => {
					setIsExiting( false );
				}, 600 );
			} else {
				setIsExiting( false );
			}
		}

		previousIsZoomedOut.current = isZoomedOut;

		return () => {
			if ( rafId ) {
				cancelAnimationFrame( rafId );
			}
			if ( timeoutId ) {
				clearTimeout( timeoutId );
			}
		};
	}, [ isZoomedOut, prefersReducedMotion ] );

	useEffect( () => {
		if ( prefersReducedMotion ) {
			setShouldShowContent( true );
			return;
		}

		if ( ! isZoomedOut ) {
			return;
		}

		setShouldShowContent( false );
		const timeoutId = setTimeout( () => {
			setShouldShowContent( true );
		}, PREVIEW_RENDER_DELAY_MS );

		return () => {
			clearTimeout( timeoutId );
		};
	}, [ isZoomedOut, prefersReducedMotion ] );

	useEffect( () => {
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
			ro = new ResizeObserver( () => {
				requestAnimationFrame( update );
			} );
			ro.observe( el );
		}
		const handleResize = () => {
			requestAnimationFrame( update );
		};
		window.addEventListener( 'resize', handleResize );
		return () => {
			window.removeEventListener( 'resize', handleResize );
			if ( ro ) {
				ro.disconnect();
			}
		};
	}, [] );

	const isSidebarOpen = isListViewOpen || hasRightSidebar || isInserterOpened;
	const carouselClasses = [
		'editor-zoom-out-page-carousel',
		isNavigating && 'is-navigating',
		isSidebarOpen && 'is-obscured',
		isEntering && 'is-entering',
		isExiting && 'is-exiting',
	]
		.filter( Boolean )
		.join( ' ' );

	// Show carousel when zoomed out OR when exiting (zooming in)
	if ( ! isZoomedOut && ! isExiting ) {
		return null;
	}

	return (
		<div className={ carouselClasses }>
			{ shouldShowContent ? (
				<ZoomOutPageCarouselContent
					currentPostId={ currentPostId }
					settings={ settings }
					offsets={ offsets }
					isNavigating={ isNavigating }
					onStartNavigate={ () => setIsNavigating( true ) }
					onFinishNavigate={ () => setIsNavigating( false ) }
				/>
			) : (
				<>
					<PagePreviewSkeleton position="previous" offsets={ offsets } />
					<PagePreviewSkeleton position="next" offsets={ offsets } />
				</>
			) }
		</div>
	);
}

function ZoomOutPageCarouselContent( {
	currentPostId,
	settings,
	offsets,
	isNavigating,
	onStartNavigate,
	onFinishNavigate,
} ) {
	const { records: pages, isResolving } = useEntityRecords(
		'postType',
		'page',
		{
			per_page: 100,
			orderby: 'menu_order',
			order: 'asc',
			status: 'publish,draft,pending,private,future',
			_embed: 'wp:featuredmedia',
			context: 'edit',
		}
	);

	const currentPageIndex = useMemo( () => {
		if ( ! pages || ! currentPostId ) {
			return -1;
		}
		return pages.findIndex(
			( page ) => page.id === currentPostId || page.id === Number( currentPostId )
		);
	}, [ pages, currentPostId ] );

	if ( isResolving || ! pages || pages.length === 0 ) {
		return (
			<>
				<PagePreviewSkeleton position="previous" offsets={ offsets } />
				<PagePreviewSkeleton position="next" offsets={ offsets } />
			</>
		);
	}

	const previousPage =
		currentPageIndex > 0 ? pages[ currentPageIndex - 1 ] : null;
	const nextPage =
		currentPageIndex < pages.length - 1
			? pages[ currentPageIndex + 1 ]
			: null;

	const handleNavigate = ( pageId ) => {
		if ( ! pageId ) {
			return;
		}
		onStartNavigate();

		if ( window.location.pathname.includes( '/site-editor.php' ) ) {
			const newUrl = addQueryArgs( window.location.pathname, {
				postType: 'page',
				postId: pageId,
				canvas: 'edit',
			} );
			window.history.pushState( {}, '', newUrl );
			window.dispatchEvent( new PopStateEvent( 'popstate' ) );
			setTimeout( onFinishNavigate, 500 );
			return;
		}

		window.location.href = `/wp-admin/post.php?post=${ pageId }&action=edit`;
	};

	const goToPreviousPage = () => {
		if ( previousPage ) {
			handleNavigate( previousPage.id );
		}
	};

	const goToNextPage = () => {
		if ( nextPage ) {
			handleNavigate( nextPage.id );
		}
	};

	return (
		<>
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
		</>
	);
}

function PagePreviewSkeleton( { position, offsets } ) {
	const sideStyle =
		position === 'previous'
			? { left: `${ offsets.left }px` }
			: { right: `${ offsets.right }px` };

	return (
		<div
			className={ `editor-zoom-out-page-carousel__preview editor-zoom-out-page-carousel__preview--${ position }` }
			style={ { ...sideStyle, pointerEvents: 'none' } }
			aria-hidden="true"
		>
			<div className="editor-zoom-out-page-carousel__preview-content">
				<div className="editor-zoom-out-page-carousel__preview-loading" />
			</div>
		</div>
	);
}
