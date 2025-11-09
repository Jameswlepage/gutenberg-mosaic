/**
 * WordPress dependencies
 */
import { useSelect, useDispatch } from '@wordpress/data';
import { useEntityRecords } from '@wordpress/core-data';
import { Button } from '@wordpress/components';
import { chevronLeft, chevronRight } from '@wordpress/icons';
import { store as coreStore } from '@wordpress/core-data';
import { store as interfaceStore } from '@wordpress/interface';
import { addQueryArgs } from '@wordpress/url';
import { useMemo } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';
import './style.scss';

export default function ZoomOutPageCarousel() {
	const {
		currentPostId,
		currentPostType,
		onNavigate,
		isListViewOpen,
		hasRightSidebar,
	} = useSelect( ( select ) => {
		const { getCurrentPostId, getCurrentPostType, getEditorSettings, isListViewOpened } =
			select( editorStore );
		const { getActiveComplementaryArea } = select( interfaceStore );

		return {
			currentPostId: getCurrentPostId(),
			currentPostType: getCurrentPostType(),
			onNavigate: getEditorSettings().onNavigateToPreviousEntityRecord,
			isListViewOpen: isListViewOpened(),
			hasRightSidebar: !! getActiveComplementaryArea( 'core' ),
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
		}
	);

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

	return (
		<div className="editor-zoom-out-page-carousel">
			<Button
				className="editor-zoom-out-page-carousel__button editor-zoom-out-page-carousel__button-previous"
				icon={ chevronLeft }
				onClick={ goToPreviousPage }
				disabled={ ! hasPrevious }
				label="Previous page"
				showTooltip
				__next40pxDefaultSize
				style={ {
					left: isListViewOpen ? '380px' : '16px', // Offset when list view is open
				} }
			/>
			<Button
				className="editor-zoom-out-page-carousel__button editor-zoom-out-page-carousel__button-next"
				icon={ chevronRight }
				onClick={ goToNextPage }
				disabled={ ! hasNext }
				label="Next page"
				showTooltip
				__next40pxDefaultSize
				style={ {
					right: hasRightSidebar ? '380px' : '16px', // Offset when right sidebar is open
				} }
			/>
		</div>
	);
}
