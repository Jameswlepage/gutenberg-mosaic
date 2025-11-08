/**
 * WordPress dependencies
 */
import {
	__experimentalListView as ListView,
	privateApis as blockEditorPrivateApis,
} from '@wordpress/block-editor';
import { ComplementaryArea, store as interfaceStore } from '@wordpress/interface';
import { DataViews } from '@wordpress/dataviews';
import { useEntityRecords } from '@wordpress/core-data';
import { useFocusOnMount, useMergeRefs } from '@wordpress/compose';
import { useDispatch, useSelect } from '@wordpress/data';
import { focus } from '@wordpress/dom';
import { useCallback, useRef, useState, useMemo, useEffect } from '@wordpress/element';
import { __, _x, sprintf } from '@wordpress/i18n';
import { useShortcut } from '@wordpress/keyboard-shortcuts';
import { ESCAPE } from '@wordpress/keycodes';
import {
    Button,
    __experimentalVStack as VStack,
    __experimentalHStack as HStack,
    Modal,
    TextControl,
    CheckboxControl,
    TextareaControl,
    Tooltip,
    ToolbarButton,
    PanelBody,
} from '@wordpress/components';
import { category } from '@wordpress/icons';
import { addQueryArgs } from '@wordpress/url';
import { store as coreStore } from '@wordpress/core-data';
import { store as noticesStore } from '@wordpress/notices';
import { decodeEntities } from '@wordpress/html-entities';
import {
	serialize,
	synchronizeBlocksWithTemplate,
	createBlock,
} from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import ListViewOutline from './list-view-outline';
import { unlock } from '../../lock-unlock';
import { store as editorStore } from '../../store';
import usePostFields from '../post-fields';
import { usePostActions } from '../post-actions/actions';

const { TabbedSidebar } = unlock( blockEditorPrivateApis );

// No-op component removed; Styles content now uses ComplementaryArea.Slot

export default function ListViewSidebar() {
	const [ showAddPageModal, setShowAddPageModal ] = useState( false );
	const [ isCreatingPost, setIsCreatingPost ] = useState( false );
	const [ title, setTitle ] = useState( '' );
	const [ withAI, setWithAI ] = useState( false );
	const [ showInstructions, setShowInstructions ] = useState( false );
	const [ instructions, setInstructions ] = useState( '' );

	const { setIsListViewOpened } = useDispatch( editorStore );
	const { saveEntityRecord } = useDispatch( coreStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const { enableComplementaryArea } = useDispatch( interfaceStore );
	const { getListViewToggleRef } = unlock( useSelect( editorStore ) );

	// This hook handles focus when the sidebar first renders.
	const focusOnMountRef = useFocusOnMount( 'firstElement' );

	// When closing the list view, focus should return to the toggle button.
	const closeListView = useCallback( () => {
		setIsListViewOpened( false );
		getListViewToggleRef().current?.focus();
	}, [ getListViewToggleRef, setIsListViewOpened ] );

	const closeOnEscape = useCallback(
		( event ) => {
			if ( event.keyCode === ESCAPE && ! event.defaultPrevented ) {
				event.preventDefault();
				closeListView();
			}
		},
		[ closeListView ]
	);

	// Use internal state instead of a ref to make sure that the component
	// re-renders when the dropZoneElement updates.
	const [ dropZoneElement, setDropZoneElement ] = useState( null );
	// Tracks our current tab.
	const [ tab, setTab ] = useState( 'pages' );

	// This ref refers to the sidebar as a whole.
	const sidebarRef = useRef();
	// This ref refers to the tab panel.
	const tabsRef = useRef();
	// This ref refers to the list view application area.
	const listViewRef = useRef();

	// Must merge the refs together so focus can be handled properly in the next function.
	const listViewContainerRef = useMergeRefs( [
		focusOnMountRef,
		listViewRef,
		setDropZoneElement,
	] );

	/*
	 * Callback function to handle list view or outline focus.
	 *
	 * @param {string} currentTab The current tab. Either pages, list view or outline.
	 *
	 * @return void
	 */
	function handleSidebarFocus( currentTab ) {
		// Tab panel focus.
		const tabPanelFocus = focus.tabbable.find( tabsRef.current )[ 0 ];
		// List view tab is selected.
		if ( currentTab === 'list-view' ) {
			// Either focus the list view or the tab panel. Must have a fallback because the list view does not render when there are no blocks.
			const listViewApplicationFocus = focus.tabbable.find(
				listViewRef.current
			)[ 0 ];
			const listViewFocusArea = sidebarRef.current.contains(
				listViewApplicationFocus
			)
				? listViewApplicationFocus
				: tabPanelFocus;
			listViewFocusArea.focus();
			// Outline tab is selected.
		} else {
			tabPanelFocus.focus();
		}
	}

	const handleToggleListViewShortcut = useCallback( () => {
		// If the sidebar has focus, it is safe to close.
		if (
			sidebarRef.current.contains(
				sidebarRef.current.ownerDocument.activeElement
			)
		) {
			closeListView();
		} else {
			// If the list view or outline does not have focus, focus should be moved to it.
			handleSidebarFocus( tab );
		}
	}, [ closeListView, tab ] );

	// This only fires when the sidebar is open because of the conditional rendering.
	// It is the same shortcut to open but that is defined as a global shortcut and only fires when the sidebar is closed.
	useShortcut( 'core/editor/toggle-list-view', handleToggleListViewShortcut );

	// Pages tab state and data
	const [ pagesView, setPagesView ] = useState( {
		type: 'list',
		search: '',
		filters: [],
		page: 1,
		perPage: 20,
		sort: { field: 'title', direction: 'asc' },
		showLevels: true,
		titleField: 'title',
		mediaField: 'featured_media',
		fields: [ 'author', 'status' ],
	} );
	const {
		records: pageRecords,
		isResolving: isLoadingPages,
		totalItems: totalPageItems,
		totalPages: totalPagePages,
	} = useEntityRecords( 'postType', 'page', {
		per_page: pagesView.perPage,
		page: pagesView.page,
		search: pagesView.search,
		order: pagesView.sort?.direction,
		orderby: pagesView.sort?.field,
		// Align with Site Editor: include all non-trash statuses by default.
		status: 'draft,future,pending,private,publish',
		_embed: 'author',
	} );
	const { isLoading: isLoadingFields, fields: pageFields } = usePostFields( {
		postType: 'page',
	} );

	// Actions (rename, delete, etc.) for the three-dots context menu
	const pageActions = usePostActions( {
		postType: 'page',
		context: 'list',
	} );

	// Make the title field clickable to navigate to the page
	const clickablePageFields = useMemo( () => {
		if ( ! pageFields?.length ) return pageFields;
		const origTitle = pageFields.find( ( f ) => f.id === 'title' );
		if ( ! origTitle?.render ) return pageFields;
		const TitleLink = ( { item, field, ...rest } ) => {
			const id = item?.id;
			const href = window.location.pathname.includes( '/site-editor.php' )
				? `/wp-admin/site-editor.php?postType=page&postId=${ id }&canvas=edit`
				: `/wp-admin/post.php?post=${ id }&action=edit`;
			return (
				<a
					className="editor-pages-list__title-link"
					href={ href }
					onClick={ ( e ) => {
						e.preventDefault();
						onClickPageItem( { id } );
					} }
				>
					<origTitle.render item={ item } field={ field } { ...rest } />
				</a>
			);
		};
		return pageFields.map( ( f ) =>
			f.id === 'title'
				? {
					...f,
					render: TitleLink,
				}
				: f
		);
	}, [ pageFields ] );
	const paginationInfo = {
		totalItems: totalPageItems,
		totalPages: totalPagePages,
	};
    const [ pagesSelection, setPagesSelection ] = useState( [] );
    const navigatingRef = useRef( false );
    const onChangePagesSelection = ( items ) => setPagesSelection( items );
    const onClickPageItem = ( { id } ) => {
        navigatingRef.current = true;
        setPagesSelection( [ String( id ) ] );
        // Navigate in-place without full reload when in Site Editor
        if ( window.location.pathname.includes( '/site-editor.php' ) ) {
            const newUrl = addQueryArgs( window.location.pathname, {
                postType: 'page',
                postId: id,
                canvas: 'edit',
            } );
            // Push state and notify the Router
            window.history.pushState( {}, '', newUrl );
            window.dispatchEvent( new PopStateEvent( 'popstate' ) );
            setTimeout( () => ( navigatingRef.current = false ), 50 );
            return;
        }
        // Fallback to classic post editor (full navigation)
        window.location.href = `/wp-admin/post.php?post=${ id }&action=edit`;
    };

    // Navigate when selection changes (row click), without full reload in Site Editor
    const prevSelectedRef = useRef( undefined );
    useEffect( () => {
        if ( ! pagesSelection?.length ) return;
        const first = pagesSelection[ 0 ];
        if ( prevSelectedRef.current === first ) return;
        prevSelectedRef.current = first;
        if ( navigatingRef.current ) return; // Already handled via onClickPageItem
        const id = first;
        if ( window.location.pathname.includes( '/site-editor.php' ) ) {
            const newUrl = addQueryArgs( window.location.pathname, {
                postType: 'page',
                postId: id,
                canvas: 'edit',
            } );
            window.history.pushState( {}, '', newUrl );
            window.dispatchEvent( new PopStateEvent( 'popstate' ) );
        }
    }, [ pagesSelection ] );

	const openModal = () => setShowAddPageModal( true );
	const closeModal = () => {
		setShowAddPageModal( false );
		setTitle( '' );
		setWithAI( false );
		setShowInstructions( false );
		setInstructions( '' );
	};

	async function createPost( event ) {
		event.preventDefault();

		if ( isCreatingPost ) {
			return;
		}
		setIsCreatingPost( true );
		try {
			let content;
			if ( withAI ) {
				// Create placeholder blocks to showcase AI-generated content
				const placeholderBlocks = [
					createBlock( 'core/paragraph', {
						content: instructions
							? `AI will generate content based on: "${ instructions }"`
							: 'AI-generated introduction paragraph based on the page title and existing site content will appear here.',
					} ),
					createBlock( 'core/heading', {
						content: 'Key Section',
						level: 2,
					} ),
					createBlock( 'core/paragraph', {
						content:
							'This section will be populated with relevant content generated by AI, taking into account your existing pages and site styles.',
					} ),
					createBlock( 'core/columns', {}, [
						createBlock( 'core/column', {}, [
							createBlock( 'core/paragraph', {
								content:
									'AI-generated content in first column.',
							} ),
						] ),
						createBlock( 'core/column', {}, [
							createBlock( 'core/paragraph', {
								content:
									'AI-generated content in second column.',
							} ),
						] ),
					] ),
				];
				content = serialize( placeholderBlocks );
			}

			const newPage = await saveEntityRecord(
				'postType',
				'page',
				{
					status: 'draft',
					title,
					slug: title ?? undefined,
					content,
				},
				{ throwOnError: true }
			);

			closeModal();
			closeListView();

			createSuccessNotice(
				sprintf(
					// translators: %s: Title of the created post or template, e.g: "Hello world".
					__( '"%s" successfully created.' ),
					decodeEntities( newPage.title?.rendered || title )
				),
				{ type: 'snackbar' }
			);

            // Navigate to the new page in-place
            if ( window.location.pathname.includes( '/site-editor.php' ) ) {
                const newUrl = addQueryArgs( window.location.pathname, {
                    postType: 'page',
                    postId: newPage.id,
                    canvas: 'edit',
                } );
                window.history.pushState( {}, '', newUrl );
                window.dispatchEvent( new PopStateEvent( 'popstate' ) );
            }
		} catch ( error ) {
			const errorMessage =
				error.message && error.code !== 'unknown_error'
					? error.message
					: __( 'An error occurred while creating the item.' );

			createErrorNotice( errorMessage, {
				type: 'snackbar',
			} );
		} finally {
			setIsCreatingPost( false );
		}
	}

	return (
		// eslint-disable-next-line jsx-a11y/no-static-element-interactions
		<div
			className="editor-list-view-sidebar"
			onKeyDown={ closeOnEscape }
			ref={ sidebarRef }
		>
			<div className="editor-list-view-sidebar__content">
				<TabbedSidebar
				tabs={ [
					{
						name: 'pages',
						title: _x( 'Pages', 'Post overview' ),
						panel: (
							<div className="editor-list-view-sidebar__list-view-container">
								<div className="editor-pages-list">
									<DataViews
										actions={ pageActions }
										paginationInfo={ paginationInfo }
										fields={ clickablePageFields }
										data={ pageRecords || [] }
										isLoading={ isLoadingPages || isLoadingFields }
										view={ pagesView }
										onChangeView={ setPagesView }
										defaultLayouts={ { list: {}, table: {}, grid: {} } }
										selection={ pagesSelection }
										onChangeSelection={ onChangePagesSelection }
										isItemClickable={ ( item ) => item.status !== 'trash' }
										onClickItem={ onClickPageItem }
										getItemId={ ( item ) => item.id?.toString?.() }
									/>
								</div>
							</div>
						),
					},
                {
                    name: 'list-view',
                    title: _x( 'Structure', 'Post overview' ),
                    panel: (
                        <div className="editor-list-view-sidebar__list-view-container">
                            <PanelBody
                                title={ __( 'Overview' ) }
                                initialOpen={ false }
                                className="editor-overview-panel"
                            >
                                <div className="editor-list-view-sidebar__overview-panel">
                                    <ListViewOutline />
                                </div>
                            </PanelBody>
                            <PanelBody
                                title={ __( 'Layers' ) }
                                initialOpen={ true }
                                className="editor-layers-panel"
                            >
                                <div className="editor-list-view-sidebar__list-view-panel-content">
                                    <ListView dropZoneElement={ dropZoneElement } />
                                </div>
                            </PanelBody>
                        </div>
                    ),
                    panelRef: listViewContainerRef,
					},
                // Only show Styles tab in Site Editor where Global Styles exist
                // Render Global Styles (edit-site) in this tab via a dedicated complementary area scope
                ...(
                    typeof window !== 'undefined' &&
                    window.location.pathname.includes( '/site-editor.php' )
                        ? [
                                {
                                    name: 'styles',
                                    title: _x( 'Styles', 'Post overview' ),
                                    panel: (
                                        <div className="editor-list-view-sidebar__list-view-container editor-styles-tab">
                                            <div className="editor-list-view-sidebar__list-view-panel-content editor-styles-panel-content">
                                                <ComplementaryArea.Slot scope="edit-site/styles-left" />
                                            </div>
                                        </div>
                                    ),
                                },
                          ]
                        : []
                ),
				] }
				onClose={ closeListView }
				onSelect={ ( tabName ) => {
					setTab( tabName );
					if (
						typeof window !== 'undefined' &&
						window.location.pathname.includes( '/site-editor.php' ) &&
						tabName === 'styles'
					) {
						enableComplementaryArea(
							'edit-site/styles-left',
							'edit-site/global-styles'
						);
					}
				} }
				defaultTabId="pages"
				ref={ tabsRef }
				closeButtonLabel={ __( 'Close' ) }
			/>
			</div>
			<div className="editor-list-view-sidebar__footer">
				<HStack spacing={ 2 } justify="space-between">
						<Button
							variant="secondary"
							onClick={ openModal }
							style={ { flex: 1 } }
						>
								{ __( '+ New Page' ) }
						</Button>
					<Tooltip text={ __( 'View all pages' ) }>
						<Button
							variant="secondary"
							icon={ category }
							label={ __( 'View all pages' ) }
							showTooltip={ false }
						/>
					</Tooltip>
				</HStack>
			</div>
			{ showAddPageModal && (
				<Modal
					title={ __( 'Draft new: Page' ) }
					onRequestClose={ closeModal }
					focusOnMount="firstContentElement"
					size="small"
				>
					<form onSubmit={ createPost }>
						<VStack spacing={ 4 }>
							<TextControl
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								label={ __( 'Title' ) }
								onChange={ setTitle }
								placeholder={ __( 'No title' ) }
								value={ title }
							/>
							<HStack justify="space-between">
								<Tooltip
									text={ __(
										'The page will be created based on the title, existing pages, content, and styles.'
									) }
								>
									<div>
										<CheckboxControl
											__nextHasNoMarginBottom
											label={ __( 'With AI' ) }
											checked={ withAI }
											onChange={ ( checked ) => {
												setWithAI( checked );
												if ( ! checked ) {
													setShowInstructions(
														false
													);
												}
											} }
										/>
									</div>
								</Tooltip>
								{ withAI && (
									<Button
										variant="link"
										onClick={ () =>
											setShowInstructions(
												! showInstructions
											)
										}
										style={ { color: '#949494' } }
									>
										{ __( 'add instructions' ) }
									</Button>
								) }
							</HStack>
							{ withAI && showInstructions && (
								<TextareaControl
									__nextHasNoMarginBottom
									label={ __( 'Instructions' ) }
									value={ instructions }
									onChange={ setInstructions }
									placeholder={ __(
										'e.g., Include a hero section with a call-to-action, add customer testimonials, use a modern layout with images...'
									) }
									rows={ 4 }
								/>
							) }
							<HStack spacing={ 2 } justify="end">
								<Button
									__next40pxDefaultSize
									variant="tertiary"
									onClick={ closeModal }
								>
									{ __( 'Cancel' ) }
								</Button>
								<Button
									__next40pxDefaultSize
									variant="primary"
									type="submit"
									isBusy={ isCreatingPost }
									aria-disabled={ isCreatingPost }
								>
									{ __( 'Create draft' ) }
								</Button>
							</HStack>
						</VStack>
					</form>
				</Modal>
			) }
		</div>
	);
}
