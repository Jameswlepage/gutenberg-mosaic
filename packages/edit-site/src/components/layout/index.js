/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { NavigableRegion } from '@wordpress/admin-ui';
import {
	__unstableMotion as motion,
	__unstableAnimatePresence as AnimatePresence,
	__unstableUseNavigateRegions as useNavigateRegions,
	SlotFillProvider,
} from '@wordpress/components';
import {
	useReducedMotion,
	useViewportMatch,
	useResizeObserver,
	usePrevious,
} from '@wordpress/compose';
import { __, sprintf } from '@wordpress/i18n';
import { useState, useRef, useEffect } from '@wordpress/element';
import {
	EditorSnackbars,
	UnsavedChangesWarning,
	ErrorBoundary,
	privateApis as editorPrivateApis,
} from '@wordpress/editor';
import { privateApis as routerPrivateApis } from '@wordpress/router';
import { PluginArea } from '@wordpress/plugins';
import { store as noticesStore } from '@wordpress/notices';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import { default as SiteHub, SiteHubMobile } from '../site-hub';
import ResizableFrame from '../resizable-frame';
import { unlock } from '../../lock-unlock';
import SaveKeyboardShortcut from '../save-keyboard-shortcut';
import { useIsSiteEditorLoading } from './hooks';
import useMovingAnimation from './animation';
import { SidebarContent, SidebarNavigationProvider } from '../sidebar';
import SaveHub from '../save-hub';
import SavePanel from '../save-panel';

const { useLocation } = unlock( routerPrivateApis );
const { useStyle } = unlock( editorPrivateApis );

const ANIMATION_DURATION = 0.3;

function Layout() {
	const { query, name: routeKey, areas, widths } = useLocation();
	const { canvas = 'view' } = query;
	const isMobileViewport = useViewportMatch( 'medium', '<' );
	const toggleRef = useRef();
	const navigateRegionsProps = useNavigateRegions();
	const disableMotion = useReducedMotion();
	const [ canvasResizer, canvasSize ] = useResizeObserver();
	const isEditorLoading = useIsSiteEditorLoading();
	const [ isResizableFrameOversized, setIsResizableFrameOversized ] =
		useState( false );
	const animationRef = useMovingAnimation( {
		triggerAnimationOnChange: routeKey + '-' + canvas,
	} );

	// Collapsed sidebar rail experiment
	const isCollapsedRailEnabled =
		window.__experimentalCollapsedSidebarRail && ! isMobileViewport;
	const [ sidebarMode, setSidebarMode ] = useState(
		isCollapsedRailEnabled ? 'collapsed' : 'expanded'
	);
	const hoverTimeoutRef = useRef( null );

	const { showIconLabels } = useSelect( ( select ) => {
		return {
			showIconLabels: select( preferencesStore ).get(
				'core',
				'showIconLabels'
			),
		};
	} );

	// Reset sidebar mode when viewport changes or experiment is disabled
	useEffect( () => {
		if ( ! isCollapsedRailEnabled && sidebarMode !== 'expanded' ) {
			setSidebarMode( 'expanded' );
		}
	}, [ isCollapsedRailEnabled, sidebarMode ] );

	// Hover preview handlers
	const handleSidebarMouseEnter = () => {
		if ( ! isCollapsedRailEnabled || sidebarMode === 'expanded' ) {
			return;
		}

		// Clear any existing timeout
		if ( hoverTimeoutRef.current ) {
			clearTimeout( hoverTimeoutRef.current );
		}

		// Add delay to avoid accidental flicker
		hoverTimeoutRef.current = setTimeout( () => {
			setSidebarMode( 'preview' );
		}, 150 );
	};

	const handleSidebarMouseLeave = () => {
		if ( ! isCollapsedRailEnabled || sidebarMode === 'expanded' ) {
			return;
		}

		// Clear any pending hover timeout
		if ( hoverTimeoutRef.current ) {
			clearTimeout( hoverTimeoutRef.current );
			hoverTimeoutRef.current = null;
		}

		// Collapse if in preview mode
		if ( sidebarMode === 'preview' ) {
			setSidebarMode( 'collapsed' );
		}
	};

	// Pin sidebar when navigating
	const handleNavigationClick = () => {
		if ( isCollapsedRailEnabled && sidebarMode !== 'expanded' ) {
			setSidebarMode( 'expanded' );
		}
	};

	// Cleanup timeout on unmount
	useEffect( () => {
		return () => {
			if ( hoverTimeoutRef.current ) {
				clearTimeout( hoverTimeoutRef.current );
			}
		};
	}, [] );

	// Keyboard support: Escape to collapse sidebar
	useEffect( () => {
		if ( ! isCollapsedRailEnabled ) {
			return;
		}

		const handleKeyDown = ( event ) => {
			if ( event.key === 'Escape' && sidebarMode === 'expanded' ) {
				setSidebarMode( 'collapsed' );
				event.preventDefault();
			}
		};

		document.addEventListener( 'keydown', handleKeyDown );
		return () => {
			document.removeEventListener( 'keydown', handleKeyDown );
		};
	}, [ isCollapsedRailEnabled, sidebarMode ] );

	const backgroundColor = useStyle( 'color.background' );
	const gradientValue = useStyle( 'color.gradient' );
	const previousCanvaMode = usePrevious( canvas );
	useEffect( () => {
		if ( previousCanvaMode === 'edit' ) {
			toggleRef.current?.focus();
		}
		// Should not depend on the previous canvas mode value but the next.
	}, [ canvas ] );

	return (
		<>
			<UnsavedChangesWarning />
			{ canvas === 'view' && <SaveKeyboardShortcut /> }
			<div
				{ ...navigateRegionsProps }
				ref={ navigateRegionsProps.ref }
				className={ clsx(
					'edit-site-layout',
					navigateRegionsProps.className,
					{
						'is-full-canvas': canvas === 'edit',
						'show-icon-labels': showIconLabels,
						'is-sidebar-collapsed':
							isCollapsedRailEnabled &&
							sidebarMode === 'collapsed',
						'is-sidebar-preview':
							isCollapsedRailEnabled && sidebarMode === 'preview',
						'is-sidebar-expanded':
							isCollapsedRailEnabled && sidebarMode === 'expanded',
					}
				) }
			>
				<div className="edit-site-layout__content">
					{ /*
						The NavigableRegion must always be rendered and not use
						`inert` otherwise `useNavigateRegions` will fail.
					*/ }
					{ ( ! isMobileViewport || ! areas.mobile ) && (
						<NavigableRegion
							ariaLabel={
								isCollapsedRailEnabled && sidebarMode === 'collapsed'
									? __( 'Navigation (collapsed)' )
									: __( 'Navigation' )
							}
							className="edit-site-layout__sidebar-region"
						>
							<AnimatePresence>
								{ canvas === 'view' && (
									<motion.div
										initial={ { opacity: 0 } }
										animate={ { opacity: 1 } }
										exit={ { opacity: 0 } }
										transition={ {
											type: 'tween',
											duration:
												// Disable transition in mobile to emulate a full page transition.
												disableMotion ||
												isMobileViewport
													? 0
													: ANIMATION_DURATION,
											ease: 'easeOut',
										} }
										className="edit-site-layout__sidebar"
										onMouseEnter={ handleSidebarMouseEnter }
										onMouseLeave={ handleSidebarMouseLeave }
										onClick={ handleNavigationClick }
									>
										<SiteHub
											ref={ toggleRef }
											isTransparent={
												isResizableFrameOversized
											}
										/>
										<SidebarNavigationProvider>
											<SidebarContent
												shouldAnimate={
													routeKey !== 'styles'
												}
												routeKey={ routeKey }
											>
												<ErrorBoundary>
													{ areas.sidebar }
												</ErrorBoundary>
											</SidebarContent>
										</SidebarNavigationProvider>
										<SaveHub />
										<SavePanel />
									</motion.div>
								) }
							</AnimatePresence>
						</NavigableRegion>
					) }

					<EditorSnackbars />

					{ isMobileViewport && areas.mobile && (
						<div className="edit-site-layout__mobile">
							<SidebarNavigationProvider>
								{ canvas !== 'edit' ? (
									<>
										<SiteHubMobile
											ref={ toggleRef }
											isTransparent={
												isResizableFrameOversized
											}
										/>
										<SidebarContent routeKey={ routeKey }>
											<ErrorBoundary>
												{ areas.mobile }
											</ErrorBoundary>
										</SidebarContent>
										<SaveHub />
										<SavePanel />
									</>
								) : (
									<ErrorBoundary>
										{ areas.mobile }
									</ErrorBoundary>
								) }
							</SidebarNavigationProvider>
						</div>
					) }

					{ ! isMobileViewport &&
						areas.content &&
						canvas !== 'edit' && (
							<div
								className="edit-site-layout__area"
								style={ {
									maxWidth: widths?.content,
								} }
							>
								<ErrorBoundary>{ areas.content }</ErrorBoundary>
							</div>
						) }

					{ ! isMobileViewport && areas.edit && canvas !== 'edit' && (
						<div
							className="edit-site-layout__area"
							style={ {
								maxWidth: widths?.edit,
							} }
						>
							<ErrorBoundary>{ areas.edit }</ErrorBoundary>
						</div>
					) }

					{ ! isMobileViewport && areas.preview && (
						<div className="edit-site-layout__canvas-container">
							{ canvasResizer }
							{ !! canvasSize.width && (
								<div
									className={ clsx(
										'edit-site-layout__canvas',
										{
											'is-right-aligned':
												isResizableFrameOversized,
										}
									) }
									ref={ animationRef }
								>
									<ErrorBoundary>
										<ResizableFrame
											isReady={ ! isEditorLoading }
											isFullWidth={ canvas === 'edit' }
											defaultSize={ {
												width:
													canvasSize.width -
													24 /* $canvas-padding */,
												height: canvasSize.height,
											} }
											isOversized={
												isResizableFrameOversized
											}
											setIsOversized={
												setIsResizableFrameOversized
											}
											innerContentStyle={ {
												background:
													gradientValue ??
													backgroundColor,
											} }
										>
											{ areas.preview }
										</ResizableFrame>
									</ErrorBoundary>
								</div>
							) }
						</div>
					) }
				</div>
			</div>
		</>
	);
}

export default function LayoutWithGlobalStylesProvider( props ) {
	const { createErrorNotice } = useDispatch( noticesStore );
	function onPluginAreaError( name ) {
		createErrorNotice(
			sprintf(
				/* translators: %s: plugin name */
				__(
					'The "%s" plugin has encountered an error and cannot be rendered.'
				),
				name
			)
		);
	}

	return (
		<SlotFillProvider>
			{ /** This needs to be within the SlotFillProvider */ }
			<PluginArea onError={ onPluginAreaError } />
			<Layout { ...props } />
		</SlotFillProvider>
	);
}
