/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { __, isRTL } from '@wordpress/i18n';
import { addQueryArgs } from '@wordpress/url';
import { useSelect, useDispatch } from '@wordpress/data';
import {
    Button,
    __experimentalText as Text,
    __unstableMotion as motion,
    __unstableAnimatePresence as AnimatePresence,
    Dropdown,
} from '@wordpress/components';
import { BlockIcon } from '@wordpress/block-editor';
import { chevronLeftSmall, chevronRightSmall, layout } from '@wordpress/icons';
// Using Dropdown (not DropdownMenu) to fully control content width
import { displayShortcut } from '@wordpress/keycodes';
import { store as coreStore } from '@wordpress/core-data';
import { store as commandsStore } from '@wordpress/commands';
import { useRef, useEffect, useLayoutEffect, useState } from '@wordpress/element';
import { useReducedMotion } from '@wordpress/compose';
import { decodeEntities } from '@wordpress/html-entities';
import { __unstableStripHTML as stripHTML } from '@wordpress/dom';

/**
 * Internal dependencies
 */
import { TEMPLATE_POST_TYPES } from '../../store/constants';
import { store as editorStore } from '../../store';
import usePageTypeBadge from '../../utils/pageTypeBadge';
import { getTemplateInfo } from '../../utils/get-template-info';
import { getStylesCanvasTitle } from '../styles-canvas';
import { unlock } from '../../lock-unlock';
import { store as blockEditorStore } from '@wordpress/block-editor';

/** @typedef {import("@wordpress/components").IconType} IconType */

const MotionButton = motion.create( Button );

/**
 * This component renders a navigation bar at the top of the editor. It displays the title of the current document,
 * a back button (if applicable), and a command center button. It also handles different states of the document,
 * such as "not found" or "unsynced".
 *
 * @example
 * ```jsx
 * <DocumentBar />
 * ```
 *
 * @param {Object}   props       The component props.
 * @param {string}   props.title A title for the document, defaulting to the document or template title currently being edited.
 * @param {IconType} props.icon  An icon for the document, no default.
 *                               (A default icon indicating the document post type is no longer used.)
 *
 * @return {React.ReactNode} The rendered DocumentBar component.
 */
export default function DocumentBar( props ) {
	const {
		postId,
		postType,
		postTypeLabel,
		documentTitle,
		isNotFound,
		templateTitle,
		onNavigateToPreviousEntityRecord,
		isTemplatePreview,
		stylesCanvasTitle,
		isZoomedOut,
		pageTypeLabelSingular,
		pages,
		isPagesResolving,
	} = useSelect( ( select ) => {
		const {
			getCurrentPostType,
			getCurrentPostId,
			getEditorSettings,
			getRenderingMode,
		} = select( editorStore );

		const {
			getEditedEntityRecord,
			getPostType,
			getCurrentTheme,
			isResolving: isResolvingSelector,
		} = select( coreStore );
		const _postType = getCurrentPostType();
		const _postId = getCurrentPostId();
		const _document = getEditedEntityRecord(
			'postType',
			_postType,
			_postId
		);

		const { default_template_types: templateTypes = [] } =
			getCurrentTheme() ?? {};

		const _templateInfo = getTemplateInfo( {
			templateTypes,
			template: _document,
		} );
		const _postTypeLabel = getPostType( _postType )?.labels?.singular_name;

		// Check if styles canvas is active and get its title
		const { getStylesPath, getShowStylebook } = unlock(
			select( editorStore )
		);
		const _stylesPath = getStylesPath();
		const _showStylebook = getShowStylebook();
		const _stylesCanvasTitle = getStylesCanvasTitle(
			_stylesPath,
			_showStylebook
		);

		const { isZoomOut: _isZoomOut } = unlock( select( blockEditorStore ) );

		// Prepare pages list for header page picker when in zoom-out mode (or anytime to keep hooks stable).
        const query = {
            per_page: 100,
            orderby: 'menu_order',
            order: 'asc',
            status: 'publish,draft,pending,private,future',
            _embed: true,
        };
		const pagesList = select( coreStore ).getEntityRecords( 'postType', 'page', query ) || [];
		const pagesResolving = select( coreStore ).isResolving( 'getEntityRecords', [ 'postType', 'page', query ] );

		// Label for page post type (singular)
		const _pageTypeLabel = getPostType( 'page' )?.labels?.singular_name;

		return {
			postId: _postId,
			postType: _postType,
			postTypeLabel: _postTypeLabel,
			documentTitle: _document.title,
			isNotFound:
				! _document &&
				! isResolvingSelector(
					'getEditedEntityRecord',
					'postType',
					_postType,
					_postId
				),
			templateTitle: _templateInfo.title,
			onNavigateToPreviousEntityRecord:
				getEditorSettings().onNavigateToPreviousEntityRecord,
			isTemplatePreview: getRenderingMode() === 'template-locked',
			stylesCanvasTitle: _stylesCanvasTitle,
			isZoomedOut: _isZoomOut(),
			pageTypeLabelSingular: _pageTypeLabel,
			pages: pagesList,
			isPagesResolving: pagesResolving,
		};
	}, [] );

    const { open: openCommandCenter } = useDispatch( commandsStore );
    // Measure dropdown toggle to match popover width
    const toggleRef = useRef();
    const [ toggleWidth, setToggleWidth ] = useState( 0 );
    const [ showAllPages, setShowAllPages ] = useState( false );
    useLayoutEffect( () => {
        const el = toggleRef.current;
        if ( ! el ) return;
        const measure = () => setToggleWidth( el.getBoundingClientRect().width );
        measure();
        let ro;
        if ( 'ResizeObserver' in window ) {
            ro = new ResizeObserver( measure );
            ro.observe( el );
        }
        window.addEventListener( 'resize', measure );
        return () => {
            window.removeEventListener( 'resize', measure );
            if ( ro ) ro.disconnect();
        };
    }, [] );
	const isReducedMotion = useReducedMotion();

	const isTemplate = TEMPLATE_POST_TYPES.includes( postType );
	const hasBackButton = !! onNavigateToPreviousEntityRecord;
	const entityTitle = isTemplate ? templateTitle : documentTitle;
	const title = props.title || stylesCanvasTitle || entityTitle;
	const icon = props.icon;

	const pageTypeBadge = usePageTypeBadge( postId );

	const mountedRef = useRef( false );
	useEffect( () => {
		mountedRef.current = true;
	}, [] );

    // For pages, always render the page navigation bar in the header
    if ( postType === 'page' ) {
		const currentIndex = pages.findIndex( ( p ) => String( p.id ) === String( postId ) );
		const hasPrev = ! isPagesResolving && currentIndex > 0;
		const hasNext = ! isPagesResolving && currentIndex >= 0 && currentIndex < pages.length - 1;
		const prevId = hasPrev ? pages[ currentIndex - 1 ].id : null;
		const nextId = hasNext ? pages[ currentIndex + 1 ].id : null;

		const navigateTo = ( targetId ) => {
			if ( ! targetId ) return;
			// Site Editor in-place navigation
			if ( window.location.pathname.includes( '/site-editor.php' ) ) {
				const newUrl = addQueryArgs( window.location.pathname, {
					postType: 'page',
					postId: targetId,
					canvas: 'edit',
				} );
				window.history.pushState( {}, '', newUrl );
				window.dispatchEvent( new PopStateEvent( 'popstate' ) );
				return;
			}
			window.location.href = `/wp-admin/post.php?post=${ targetId }&action=edit`;
		};

        // Build status labels
        const statusLabel = ( status ) => {
            switch ( status ) {
                case 'publish': return ` · ${ __( 'Published' ) }`;
                case 'draft': return ` · ${ __( 'Draft' ) }`;
                case 'pending': return ` · ${ __( 'Pending' ) }`;
                case 'private': return ` · ${ __( 'Private' ) }`;
                case 'future': return ` · ${ __( 'Scheduled' ) }`;
                default: return '';
            }
        };

        // Derive lists ensuring current page is always first
        const currentIdStr = String( postId );
        const currentPage = ( pages || [] ).find( ( p ) => String( p.id ) === currentIdStr );

        // Primary list: top published pages by menu order + ensure current page first
        const publishedSorted = ( pages || [] )
            .filter( ( p ) => p.status === 'publish' && String( p.id ) !== currentIdStr )
            .sort( ( a, b ) => ( a.menu_order || 0 ) - ( b.menu_order || 0 ) )
            .slice( 0, 7 );
        const primaryPages = currentPage ? [ currentPage, ...publishedSorted ] : publishedSorted;

        // Full list: all pages by menu order + current page first
        const allSorted = ( pages || [] )
            .filter( ( p ) => String( p.id ) !== currentIdStr )
            .sort( ( a, b ) => ( a.menu_order || 0 ) - ( b.menu_order || 0 ) );
        const fullPages = currentPage ? [ currentPage, ...allSorted ] : allSorted;

		const currentTitle = pages?.[ currentIndex ]
			? decodeEntities( pages[ currentIndex ]?.title?.rendered || '' )
			: __( 'Select page' );

		return (
			<div className={ clsx( 'editor-document-bar', 'editor-document-bar--zoom-nav' ) }>
				<Button
					className="editor-document-bar__zoom-chevron editor-document-bar__zoom-chevron--prev"
					icon={ isRTL() ? chevronRightSmall : chevronLeftSmall }
					onClick={ ( e ) => { e.stopPropagation(); navigateTo( prevId ); } }
					disabled={ ! hasPrev }
					variant="tertiary"
					size="compact"
					label={ __( 'Previous page' ) }
				/>
                <Dropdown
                    popoverProps={ {
                        className: 'editor-document-bar__zoom-popover',
                        style: toggleWidth ? { width: `${ toggleWidth }px` } : undefined,
                    } }
                    renderToggle={ ( { onToggle } ) => (
						<Button
							ref={ toggleRef }
							className="editor-document-bar__zoom-toggle"
							variant="tertiary"
							size="compact"
							onClick={ ( e ) => { e.preventDefault(); onToggle(); } }
							aria-label={ __( 'Select page' ) }
						>
							<span className="editor-document-bar__zoom-title">
								<span className="editor-document-bar__post-title">{ currentTitle }</span>
								{ pageTypeLabelSingular && (
									<span className="editor-document-bar__post-type-label">{ `· ${ decodeEntities( pageTypeLabelSingular ) }` }</span>
								) }
							</span>
						</Button>
					) }
                    renderContent={ ( { onClose } ) => {
                        const renderItem = ( page ) => {
                            const title = decodeEntities( page?.title?.rendered || '' ) || `Untitled (${ page.id })`;
                            const typeText = pageTypeLabelSingular ? decodeEntities( pageTypeLabelSingular ) : '';
                            const statusText = statusLabel( page.status );
                            const media = page?._embedded?.[ 'wp:featuredmedia' ]?.[ 0 ];
                            const thumbSrc = media?.media_details?.sizes?.thumbnail?.source_url || media?.source_url;
                            const isCurrent = String( page.id ) === currentIdStr;
                            return (
                                <button
                                    key={ page.id }
                                    type="button"
                                    className={ `editor-document-bar__menu-row${ isCurrent ? ' is-current' : '' }` }
                                    onClick={ () => { if ( ! isCurrent ) { navigateTo( page.id ); onClose(); setShowAllPages( false ); } } }
                                    disabled={ isCurrent }
                                >
                                    <span className="editor-document-bar__menu-left">
                                        { thumbSrc && (
                                            <img className="editor-document-bar__menu-thumb" src={ thumbSrc } alt="" />
                                        ) }
                                        <span className="editor-document-bar__menu-title">{ title }</span>
                                    </span>
                                    <span className="editor-document-bar__menu-meta">{ typeText }{ statusText }</span>
                                </button>
                            );
                        };

                        return (
                            <div className="editor-document-bar__menu" style={ toggleWidth ? { width: `${ toggleWidth }px` } : undefined }>
                                { showAllPages ? (
                                    <div className="editor-document-bar__menu-scroll">
                                        <div className="editor-document-bar__menu-inner">
                                            { ( fullPages || [] ).map( renderItem ) }
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="editor-document-bar__menu-inner">
                                            { ( primaryPages || [] ).map( renderItem ) }
                                        </div>
                                        <button
                                            type="button"
                                            className="editor-document-bar__menu-row editor-document-bar__menu-more"
                                            onClick={ () => setShowAllPages( true ) }
                                        >
                                            { __( 'More…' ) }
                                        </button>
                                    </>
                                ) }
                            </div>
                        );
                    } }
                />
				<Button
					className="editor-document-bar__zoom-chevron editor-document-bar__zoom-chevron--next"
					icon={ isRTL() ? chevronLeftSmall : chevronRightSmall }
					onClick={ ( e ) => { e.stopPropagation(); navigateTo( nextId ); } }
					disabled={ ! hasNext }
					variant="tertiary"
					size="compact"
					label={ __( 'Next page' ) }
				/>
			</div>
		);
	}

	return (
		<div
			className={ clsx( 'editor-document-bar', {
				'has-back-button': hasBackButton,
			} ) }
		>
			<AnimatePresence>
				{ hasBackButton && (
					<MotionButton
						className="editor-document-bar__back"
						icon={ isRTL() ? chevronRightSmall : chevronLeftSmall }
						onClick={ ( event ) => {
							event.stopPropagation();
							onNavigateToPreviousEntityRecord();
						} }
						size="compact"
						initial={
							mountedRef.current
								? { opacity: 0, transform: 'translateX(15%)' }
								: false // Don't show entry animation when DocumentBar mounts.
						}
						animate={ { opacity: 1, transform: 'translateX(0%)' } }
						exit={ { opacity: 0, transform: 'translateX(15%)' } }
						transition={
							isReducedMotion ? { duration: 0 } : undefined
						}
					>
						{ __( 'Back' ) }
					</MotionButton>
				) }
			</AnimatePresence>
			{ ! isTemplate && isTemplatePreview && ! hasBackButton && (
				<BlockIcon
					icon={ layout }
					className="editor-document-bar__icon-layout"
				/>
			) }
			{ isNotFound ? (
				<Text>{ __( 'Document not found' ) }</Text>
			) : (
				<Button
					className="editor-document-bar__command"
					onClick={ () => openCommandCenter() }
					size="compact"
				>
					<motion.div
						className="editor-document-bar__title"
						// Force entry animation when the back button is added or removed.
						key={ hasBackButton }
						initial={
							mountedRef.current
								? {
										opacity: 0,
										transform: hasBackButton
											? 'translateX(15%)'
											: 'translateX(-15%)',
								  }
								: false // Don't show entry animation when DocumentBar mounts.
						}
						animate={ {
							opacity: 1,
							transform: 'translateX(0%)',
						} }
						transition={
							isReducedMotion ? { duration: 0 } : undefined
						}
					>
						{ icon && <BlockIcon icon={ icon } /> }
						<Text size="body" as="h1">
							<span className="editor-document-bar__post-title">
								{ title
									? stripHTML( title )
									: __( 'No title' ) }
							</span>
							{ pageTypeBadge && (
								<span className="editor-document-bar__post-type-label">
									{ `· ${ pageTypeBadge }` }
								</span>
							) }
							{ postTypeLabel &&
								! props.title &&
								! pageTypeBadge && (
									<span className="editor-document-bar__post-type-label">
										{ `· ${ decodeEntities(
											postTypeLabel
										) }` }
									</span>
								) }
						</Text>
					</motion.div>
					<span className="editor-document-bar__shortcut">
						{ displayShortcut.primary( 'k' ) }
					</span>
				</Button>
			) }
		</div>
	);
}
