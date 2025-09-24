/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { InterfaceSkeleton, ComplementaryArea } from '@wordpress/interface';
import { useSelect } from '@wordpress/data';
import { __, _x } from '@wordpress/i18n';
import { store as preferencesStore } from '@wordpress/preferences';
import { BlockBreadcrumb, BlockToolbar } from '@wordpress/block-editor';
import { useViewportMatch } from '@wordpress/compose';
import { useState, useCallback, useEffect } from '@wordpress/element';
import { Button, Icon, __unstableMotion as motion } from '@wordpress/components';
import { wordpress } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';
import EditorNotices from '../editor-notices';
import Header from '../header';
import InserterSidebar from '../inserter-sidebar';
import ListViewSidebar from '../list-view-sidebar';
import SavePublishPanels from '../save-publish-panels';
import TextEditor from '../text-editor';
import VisualEditor from '../visual-editor';
import EditorContentSlotFill from './content-slot-fill';
import ChatSidebar from '../chat-sidebar';

const interfaceLabels = {
	/* translators: accessibility text for the editor top bar landmark region. */
	header: __( 'Editor top bar' ),
	/* translators: accessibility text for the editor content landmark region. */
	body: __( 'Editor content' ),
	/* translators: accessibility text for the editor settings landmark region. */
	sidebar: __( 'Editor settings' ),
	/* translators: accessibility text for the editor publish landmark region. */
	actions: __( 'Editor publish' ),
	/* translators: accessibility text for the editor footer landmark region. */
	footer: __( 'Editor footer' ),
};

export default function EditorInterface( {
	className,
	styles,
	children,
	forceIsDirty,
	contentRef,
	disableIframe,
	autoFocus,
	customSaveButton,
	customSavePanel,
	forceDisableBlockTools,
	title,
	iframeProps,
} ) {
	const {
		mode,
		isInserterOpened,
		isListViewOpened,
		isDistractionFree,
		isPreviewMode,
		showBlockBreadcrumbs,
		documentLabel,
	} = useSelect( ( select ) => {
		const { get } = select( preferencesStore );
		const { getEditorSettings, getPostTypeLabel } = select( editorStore );
		const editorSettings = getEditorSettings();
		const postTypeLabel = getPostTypeLabel();

		let _mode = select( editorStore ).getEditorMode();
		if ( ! editorSettings.richEditingEnabled && _mode === 'visual' ) {
			_mode = 'text';
		}
		if ( ! editorSettings.codeEditingEnabled && _mode === 'text' ) {
			_mode = 'visual';
		}

		return {
			mode: _mode,
			isInserterOpened: select( editorStore ).isInserterOpened(),
			isListViewOpened: select( editorStore ).isListViewOpened(),
			isDistractionFree: get( 'core', 'distractionFree' ),
			isPreviewMode: editorSettings.isPreviewMode,
			showBlockBreadcrumbs: get( 'core', 'showBlockBreadcrumbs' ),
			documentLabel:
				// translators: Default label for the Document in the Block Breadcrumb.
				postTypeLabel || _x( 'Document', 'noun, breadcrumb' ),
		};
	}, [] );
	const isLargeViewport = useViewportMatch( 'medium' );
	const secondarySidebarLabel = isListViewOpened
		? __( 'Document Overview' )
		: __( 'Block Library' );

	// Local state for save panel.
	// Note 'truthy' callback implies an open panel.
	const [ entitiesSavedStatesCallback, setEntitiesSavedStatesCallback ] =
		useState( false );
    const [ isChatOpen, setIsChatOpen ] = useState( () => {
        if ( typeof window !== 'undefined' && window.__experimentalChatSidebar ) {
            try {
                return localStorage.getItem( 'gutenbergChatSidebarOpen' ) === '1';
            } catch (e) {}
        }
        return false;
    } );
    // Never reload into full screen: default expanded to false regardless of storage
    const [ isChatExpanded, setIsChatExpanded ] = useState( false );
	const closeEntitiesSavedStates = useCallback(
		( arg ) => {
			if ( typeof entitiesSavedStatesCallback === 'function' ) {
				entitiesSavedStatesCallback( arg );
			}
			setEntitiesSavedStatesCallback( false );
		},
		[ entitiesSavedStatesCallback ]
	);

    const chatEnabled =
        typeof window !== 'undefined' && window.__experimentalChatSidebar;
    const [ isClosing, setIsClosing ] = useState( false );
    const effectiveOpen = ( chatEnabled && isChatOpen ) || isClosing;
    const phase = ! chatEnabled || ! effectiveOpen ? 'closed' : isChatExpanded ? 'expanded' : 'open';
    const dur = 0.28;
    const ease = [ 0.6, 0, 0.4, 1 ];

    // Persist chat open/expanded states in localStorage
    useEffect( () => {
        if ( ! chatEnabled ) return;
        try {
            localStorage.setItem( 'gutenbergChatSidebarOpen', isChatOpen ? '1' : '0' );
            // Auto-clear expanded when closed to avoid stale fullscreen state
            const expanded = isChatOpen && isChatExpanded ? '1' : '0';
            localStorage.setItem( 'gutenbergChatSidebarExpanded', expanded );
        } catch (e) {}
    }, [ chatEnabled, isChatOpen, isChatExpanded ] );

	return (
		<div
			className={ clsx( 'editor-chat-container', {
				'is-chat-open': chatEnabled && isChatOpen,
				'is-chat-expanded': chatEnabled && isChatOpen && isChatExpanded,
			} ) }
			style={ { height: '100%' } }
		>
            <motion.div
                className="editor-chat-wrap"
                initial={ false }
                animate={{
                    padding: phase === 'closed' ? 0 : 16,
                }}
                style={{ columnGap: phase === 'expanded' ? 0 : 16 }}
                transition={{ duration: dur, ease, delay: isClosing ? dur : 0 }}
            >
				<motion.div
					className="editor-chat-inner"
					initial={ false }
					animate={{ opacity: phase === 'expanded' ? 0 : 1 }}
					transition={{ duration: dur, ease }}
				>
					<InterfaceSkeleton
			isDistractionFree={ isDistractionFree }
			className={ clsx( 'editor-editor-interface', className, {
				'is-entity-save-view-open': !! entitiesSavedStatesCallback,
				'is-distraction-free': isDistractionFree && ! isPreviewMode,
			} ) }
			labels={ {
				...interfaceLabels,
				secondarySidebar: secondarySidebarLabel,
			} }
			header={
				! isPreviewMode && (
					<Header
						forceIsDirty={ forceIsDirty }
						setEntitiesSavedStatesCallback={
							setEntitiesSavedStatesCallback
						}
						customSaveButton={ customSaveButton }
						forceDisableBlockTools={ forceDisableBlockTools }
						title={ title }
					/>
				)
			}
			editorNotices={ <EditorNotices /> }
			secondarySidebar={
				! isPreviewMode &&
				mode === 'visual' &&
				( ( isInserterOpened && <InserterSidebar /> ) ||
					( isListViewOpened && <ListViewSidebar /> ) )
			}
			sidebar={
				! isPreviewMode &&
				! isDistractionFree && <ComplementaryArea.Slot scope="core" />
			}
			content={
				<>
					{ ! isDistractionFree && ! isPreviewMode && (
						<EditorNotices />
					) }

					<EditorContentSlotFill.Slot>
						{ ( [ editorCanvasView ] ) =>
							editorCanvasView ? (
								editorCanvasView
							) : (
								<>
									{ ! isPreviewMode && mode === 'text' && (
										<TextEditor
											// We should auto-focus the canvas (title) on load.
											// eslint-disable-next-line jsx-a11y/no-autofocus
											autoFocus={ autoFocus }
										/>
									) }
									{ ! isPreviewMode &&
										! isLargeViewport &&
										mode === 'visual' && (
											<BlockToolbar hideDragHandle />
										) }
									{ ( isPreviewMode ||
										mode === 'visual' ) && (
										<VisualEditor
											styles={ styles }
											contentRef={ contentRef }
											disableIframe={ disableIframe }
											// We should auto-focus the canvas (title) on load.
											// eslint-disable-next-line jsx-a11y/no-autofocus
											autoFocus={ autoFocus }
											iframeProps={ iframeProps }
										/>
									) }
									{ children }
								</>
							)
						}
					</EditorContentSlotFill.Slot>
				</>
			}
			footer={
				! isPreviewMode &&
				! isDistractionFree &&
				isLargeViewport &&
				showBlockBreadcrumbs &&
				mode === 'visual' && (
					<BlockBreadcrumb rootLabelText={ documentLabel } />
				)
			}
			actions={
				! isPreviewMode
					? customSavePanel || (
							<SavePublishPanels
								closeEntitiesSavedStates={
									closeEntitiesSavedStates
								}
								isEntitiesSavedStatesOpen={
									entitiesSavedStatesCallback
								}
								setEntitiesSavedStatesCallback={
									setEntitiesSavedStatesCallback
								}
								forceIsDirtyPublishPanel={ forceIsDirty }
							/>
					  )
					: undefined
			}
					/>
				</motion.div>
				{/* Render chat experiment only when enabled via experiments page */}
                { chatEnabled ? (
                    <ChatSidebar
                        isOpen={ effectiveOpen }
                        isExpanded={ isChatExpanded }
                        isClosing={ isClosing }
                        onToggleExpand={ () => setIsChatExpanded( (v) => ! v ) }
                        onClose={ () => setIsChatExpanded( false ) }
                        onCloseChat={ () => {
                            setIsChatExpanded( false );
                            setIsClosing( true );
                            setTimeout( () => {
                                setIsClosing( false );
                                setIsChatOpen( false );
                            }, dur * 1000 );
                        } }
                    />
                ) : null }
            </motion.div>

			{/* Floating toggle button */}
            { chatEnabled ? (
                <Button
                    className={ 'editor-chat-toggle' + ( isChatOpen ? ' is-active' : '' ) }
                    label={ isChatOpen ? __( 'Close chat' ) : __( 'Open chat' ) }
                    onClick={ () => {
                        if ( isChatOpen ) {
                            // Start closing sequence: fade out content, then slide & remove background
                            setIsChatExpanded( false );
                            setIsClosing( true );
                            setTimeout( () => {
                                setIsClosing( false );
                                setIsChatOpen( false );
                            }, dur * 1000 );
                        } else {
                            setIsChatOpen( true );
                        }
                    } }
                    icon={ <Icon icon={ wordpress } /> }
                />
            ) : null }
		</div>
	);
}
