/**
 * WordPress dependencies
 */
import { Button, Icon, Tooltip, __unstableMotion as motion, __unstableAnimatePresence as AnimatePresence } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { image, rotateLeft, closeSmall, crop, plus } from '@wordpress/icons';

import { useState, useRef } from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';
import { BlockTitle, BlockIcon, store as blockEditorStore } from '@wordpress/block-editor';
import { store as blocksStore } from '@wordpress/blocks';

export default function ChatSidebar( {
    isOpen,
    isExpanded = false,
    isClosing = false,
    onToggleExpand,
    onClose,
    onCloseChat,
    children,
} ) {
    const [ isStudio, setIsStudio ] = useState( false );
    const [ tool, setTool ] = useState( 'none' ); // 'none' | 'crop' | 'annotate'
    const [ rotation, setRotation ] = useState( 0 );
    const [ dirtyRotate, setDirtyRotate ] = useState( false );
    const [ dirtyCrop, setDirtyCrop ] = useState( false );
    const [ dirtyAnnotate, setDirtyAnnotate ] = useState( false );
    const isDirty = dirtyRotate || dirtyCrop || dirtyAnnotate;
    const imgRef = useRef();
    const frameRef = useRef();
    const inputRef = useRef();
    const annotateRef = useRef();
    const [ cropRect, setCropRect ] = useState( null ); // { x,y,w,h } in frame coords
    const phase = ! isOpen ? 'closed' : isExpanded ? 'expanded' : 'open';
    const dur = 0.28;
    const ease = [ 0.6, 0, 0.4, 1 ];

    // Current block selection info
    const { selectedClientId, selectedIcon, isImageSelected } = useSelect( ( select ) => {
        const be = select( blockEditorStore );
        const clientId = be.getSelectedBlockClientId?.();
        const name = clientId ? be.getBlockName?.( clientId ) : null;
        const blk = select( blocksStore );
        const icon = name ? blk.getBlockType?.( name )?.icon : null;
        return { selectedClientId: clientId, selectedIcon: icon, isImageSelected: name === 'core/image' };
    } );

    const { updateBlockAttributes, clearSelectedBlock } = useDispatch( blockEditorStore );

    function handleReplaceOnCanvas() {
        if ( ! isImageSelected || ! selectedClientId ) return;
        const img = imgRef.current;
        const url = img?.getAttribute?.( 'src' );
        if ( url ) {
            updateBlockAttributes( selectedClientId, { url } );
        }
    }

    function playFLIP( expand ) {
        const img = imgRef.current;
        const inp = inputRef.current;
        if ( ! img || ! inp ) {
            expand ? onToggleExpand?.() : onClose?.();
            return;
        }
        const firstImg = img.getBoundingClientRect();
        const firstInp = inp.getBoundingClientRect();
        // Trigger layout change and immediately measure the final position in the same frame
        if ( expand ) onToggleExpand?.(); else onClose?.();
        const lastImg = img.getBoundingClientRect();
        const lastInp = inp.getBoundingClientRect();
            const imgDX = firstImg.left - lastImg.left;
            const imgDY = firstImg.top - lastImg.top;
            const imgSX = firstImg.width / Math.max( lastImg.width, 1 );
            const imgSY = firstImg.height / Math.max( lastImg.height, 1 );
            const inpDX = firstInp.left - lastInp.left;
            const inpDY = firstInp.top - lastInp.top;
            const inpSX = firstInp.width / Math.max( lastInp.width, 1 );
            const inpSY = firstInp.height / Math.max( lastInp.height, 1 );
        // Prepare: set inverse transforms without transition to avoid any flicker frame
        const dur = 350;
        const easing = 'cubic-bezier(0.6,0,0.4,1)';
        img.style.willChange = 'transform';
        inp.style.willChange = 'transform, opacity';
        img.style.transformOrigin = 'top left';
        inp.style.transformOrigin = 'top left';
        img.style.transition = 'none';
        inp.style.transition = 'none';
        img.style.transform = `translate(${ imgDX }px, ${ imgDY }px) scale(${ imgSX }, ${ imgSY })`;
        inp.style.transform = `translate(${ inpDX }px, ${ inpDY }px) scale(${ inpSX }, ${ inpSY })`;
        inp.style.opacity = '0';

        // Force reflow so the inverse transform applies before we animate to prevent shrink flash
        // eslint-disable-next-line no-unused-expressions
        img.offsetWidth;

        // Play: animate to final position/scale
        requestAnimationFrame( () => {
            img.style.transition = `transform ${ dur }ms ${ easing }`;
            inp.style.transition = `transform ${ dur }ms ${ easing }, opacity ${ dur }ms ${ easing }`;
            img.style.transform = 'none';
            inp.style.transform = 'none';
            inp.style.opacity = '1';
            // Cleanup after
            setTimeout( () => {
                img.style.transition = '';
                inp.style.transition = '';
                img.style.willChange = '';
                inp.style.willChange = '';
            }, dur + 50 );
        } );
    }

    // Image Studio actions
    function handleRotate() {
        setRotation( ( r ) => ( ( r + 90 ) % 360 ) );
        setDirtyRotate( true );
    }

    function handleToggleCrop() {
        if ( tool === 'crop' ) {
            setTool( 'none' );
            return;
        }
        // Initialize crop rect to centered 80% of frame
        const frame = frameRef.current;
        if ( frame ) {
            const { width, height } = frame.getBoundingClientRect();
            const w = Math.round( width * 0.8 );
            const h = Math.round( height * 0.8 );
            const x = Math.round( ( width - w ) / 2 );
            const y = Math.round( ( height - h ) / 2 );
            setCropRect( { x, y, w, h } );
        }
        setTool( 'crop' );
    }

    function handleToggleAnnotate() {
        if ( tool === 'annotate' ) {
            const canvas = annotateRef.current;
            const ctx = canvas?.getContext?.( '2d' );
            if ( ctx && canvas ) {
                ctx.clearRect( 0, 0, canvas.width, canvas.height );
            }
            setDirtyAnnotate( false );
            setTool( 'none' );
        } else {
            setTool( 'annotate' );
        }
    }

    // Simple in-place annotate drawing
    function onAnnotatePointerDown( e ) {
        if ( tool !== 'annotate' ) return;
        const canvas = annotateRef.current;
        const ctx = canvas?.getContext?.( '2d' );
        if ( ! ctx ) return;
        const rect = canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        let drawing = true;
        ctx.strokeStyle = '#2d7cf6';
        ctx.lineWidth = 3.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo( x, y );
        setDirtyAnnotate( true );

        function move( ev ) {
            if ( ! drawing ) return;
            x = ev.clientX - rect.left;
            y = ev.clientY - rect.top;
            ctx.lineTo( x, y );
            ctx.stroke();
        }
        function up() {
            drawing = false;
            window.removeEventListener( 'pointermove', move );
            window.removeEventListener( 'pointerup', up );
        }
        window.addEventListener( 'pointermove', move );
        window.addEventListener( 'pointerup', up );
    }

    // Simple draggable crop box (move only)
    function onCropPointerDown( e ) {
        if ( tool !== 'crop' || ! cropRect ) return;
        const frame = frameRef.current;
        if ( ! frame ) return;
        const startX = e.clientX;
        const startY = e.clientY;
        const start = { ...cropRect };
        const rect = frame.getBoundingClientRect();

        const target = e.target;
        const isHandle = target?.classList?.contains?.( 'crop-handle' );
        const handle = isHandle ? Array.from( target.classList ).find( ( c ) => c.startsWith( 'crop-handle--' ) ) : null;

        function move( ev ) {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            const maxW = rect.width;
            const maxH = rect.height;
            let { x, y, w, h } = start;

            if ( isHandle ) {
                // Resize from the handle
                if ( handle?.endsWith( 'nw' ) ) {
                    x = Math.max( 0, Math.min( x + dx, x + w - 20 ) );
                    y = Math.max( 0, Math.min( y + dy, y + h - 20 ) );
                    w = Math.max( 20, start.w - ( x - start.x ) );
                    h = Math.max( 20, start.h - ( y - start.y ) );
                } else if ( handle?.endsWith( 'ne' ) ) {
                    y = Math.max( 0, Math.min( y + dy, y + h - 20 ) );
                    w = Math.max( 20, Math.min( maxW - x, start.w + dx ) );
                    h = Math.max( 20, start.h - ( y - start.y ) );
                } else if ( handle?.endsWith( 'sw' ) ) {
                    x = Math.max( 0, Math.min( x + dx, x + w - 20 ) );
                    w = Math.max( 20, start.w - ( x - start.x ) );
                    h = Math.max( 20, Math.min( maxH - y, start.h + dy ) );
                } else if ( handle?.endsWith( 'se' ) ) {
                    w = Math.max( 20, Math.min( maxW - x, start.w + dx ) );
                    h = Math.max( 20, Math.min( maxH - y, start.h + dy ) );
                }
            } else {
                // Move the crop box
                x = Math.max( 0, Math.min( maxW - w, start.x + dx ) );
                y = Math.max( 0, Math.min( maxH - h, start.y + dy ) );
            }

            setCropRect( { x, y, w, h } );
            setDirtyCrop( true );
        }
        function up() {
            window.removeEventListener( 'pointermove', move );
            window.removeEventListener( 'pointerup', up );
        }
        window.addEventListener( 'pointermove', move );
        window.addEventListener( 'pointerup', up );
    }

    function handleSave() {
        // Placeholder save: mark clean. Exporting image composition can be added here.
        setDirtyRotate( false );
        setDirtyCrop( false );
        setDirtyAnnotate( false );
        setTool( 'none' );
    }

    return (
        <motion.aside
            className={
                'editor-chat-sidebar' +
                ( isOpen ? ' is-open' : '' ) +
                ( isExpanded ? ' is-expanded' : '' ) +
                ( isExpanded && isStudio ? ' is-studio' : '' )
            }
            aria-label={ __( 'Chat sidebar' ) }
            aria-hidden={ ! isOpen }
            initial={ false }
            style={{ flex: '0 0 auto' }}
            animate={{ width: phase === 'closed' ? 0 : phase === 'open' ? 300 : '100%' }}
            transition={{ duration: dur, ease, delay: isClosing ? dur : 0 }}
        >
            {/* Shell: everything inside the sidebar fades after slide-in, fades before slide-out */}
            <motion.div
                className="editor-chat-sidebar__shell"
                initial={ false }
                animate={{ opacity: phase === 'closed' ? 0 : 1 }}
                transition={{ duration: dur, ease, delay: isClosing ? 0 : dur }}
            >
                <div className="editor-chat-sidebar__header">
                    { isExpanded && isStudio && (
                        <div className="editor-chat-sidebar__leading">
                            <Button
                                className="editor-chat-sidebar__icon-button"
                                label={ __( 'Exit Image Studio' ) }
                                icon={ <Icon icon={ closeSmall } /> }
                                onClick={ () => { setIsStudio( false ); playFLIP( false ); } }
                            />
                        </div>
                    ) }
                    <AnimatePresence initial={ false }>
                        <motion.div
                            key={ isExpanded && isStudio ? 'studio' : 'generate' }
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: dur, ease }}
                            className="editor-chat-sidebar__title"
                        >
                            { isExpanded && isStudio ? __( 'Image Studio' ) : __( 'Generate' ) }
                        </motion.div>
                    </AnimatePresence>
                    <div className="editor-chat-sidebar__actions">
                        { isExpanded && isStudio && (
                            <div className="editor-chat-sidebar__studio-tools">
                                {/* Crop */}
                                <Button
                                    className="editor-chat-sidebar__icon-button"
                                    label={ __( 'Crop' ) }
                                    onClick={ handleToggleCrop }
                                    aria-pressed={ tool === 'crop' }
                                    icon={ <Icon icon={ crop } /> }
                                />
                                {/* Rotate */}
                                <Button
                                    className="editor-chat-sidebar__icon-button"
                                    label={ __( 'Rotate' ) }
                                    icon={ <Icon icon={ rotateLeft } /> }
                                    onClick={ handleRotate }
                                />
                                {/* Annotate */}
                                <Button
                                    className="editor-chat-sidebar__icon-button"
                                    label={ __( 'Annotate' ) }
                                    onClick={ handleToggleAnnotate }
                                    aria-pressed={ tool === 'annotate' }
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l9.06-9.06.92.92L5.92 19.58zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>
                                    </svg>
                                </Button>
                                <Button
                                    className="editor-chat-sidebar__save"
                                    variant="primary"
                                    disabled={ ! isDirty }
                                    onClick={ handleSave }
                                >
                                    { __( 'Save' ) }
                                </Button>
                            </div>
                        ) }
                    </div>
                </div>

                {/* Content */}
                <div className="editor-chat-sidebar__content">
                <div className="editor-chat-sidebar__scroll">
                    <div className="editor-chat-sidebar__message editor-chat-sidebar__message--ai">
                        { __( 'Howdy! What image do you want to create today?' ) }
                    </div>
                    <div className="editor-chat-sidebar__message editor-chat-sidebar__message--me">
                        { __(
                            'Create an image of a serene mountain landscape at sunrise, with vibrant colors reflecting off a calm lake in the foreground. Include a few fluffy clouds in the sky and a small cabin nestled among the trees.'
                        ) }
                    </div>
                    <div className="editor-chat-sidebar__image">
                        <div className="editor-chat-sidebar__image-frame" ref={ frameRef }>
                            <div className="editor-chat-sidebar__image-rotator" style={{ transform: `rotate(${ rotation }deg)`, transformOrigin: 'center center' }}>
                                <img
                                    ref={ imgRef }
                                    className="editor-chat-sidebar__image-tag"
                                    src="https://images.unsplash.com/photo-1502085671122-2d218cd434e6?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                                    alt={ __( 'Placeholder image' ) }
                                />
                            </div>
                            { isExpanded && isStudio && tool === 'annotate' && (
                                <canvas
                                    ref={ annotateRef }
                                    className="editor-chat-sidebar__annotate"
                                    onPointerDown={ onAnnotatePointerDown }
                                    width={ frameRef.current?.clientWidth || 0 }
                                    height={ frameRef.current?.clientHeight || 0 }
                                />
                            ) }
                            { isExpanded && isStudio && tool === 'crop' && cropRect && (
                                <div
                                    className="editor-chat-sidebar__crop-box"
                                    style={{ left: cropRect.x, top: cropRect.y, width: cropRect.w, height: cropRect.h }}
                                    onPointerDown={ onCropPointerDown }
                                />
                            ) }
                        </div>
                        <Tooltip text={ __( 'Open in Image Studio' ) }>
                            <Button
                                className="editor-chat-sidebar__image-action"
                                icon={ <Icon icon={ image } /> }
                                label={ __( 'Open in Image Studio' ) }
                                onClick={ () => { setIsStudio( true ); playFLIP( true ); } }
                                tooltipPosition="top"
                            />
                        </Tooltip>
                        { isImageSelected && (
                            <Tooltip text={ __( 'Replace on Canvas' ) }>
                                <Button
                                    className="editor-chat-sidebar__replace-action"
                                    icon={ <Icon icon={ plus } /> }
                                    label={ __( 'Replace on Canvas' ) }
                                    onClick={ handleReplaceOnCanvas }
                                    tooltipPosition="top"
                                />
                            </Tooltip>
                        ) }
                    </div>
                    {/* No inline CTA; use image overlay action only */}
                    { children }
                    <div className="editor-chat-sidebar__message editor-chat-sidebar__message--me">
                        { __( 'Use the image' ) }
                    </div>
                </div>
                <div className="editor-chat-sidebar__input">
                    { selectedClientId && (
                        <Tooltip text={ __( 'The AI will focus more on this selection' ) }>
                            <div className="editor-chat-sidebar__selection" aria-live="polite">
                                { selectedIcon ? (
                                    <span className="editor-chat-sidebar__selection-icon">
                                        <BlockIcon icon={ selectedIcon } />
                                    </span>
                                ) : null }
                                <span className="editor-chat-sidebar__selection-label">
                                    <BlockTitle clientId={ selectedClientId } maximumLength={ 80 } />
                                </span>
                                <button
                                    type="button"
                                    className="editor-chat-sidebar__selection-clear"
                                    aria-label={ __( 'Deselect block' ) }
                                    onClick={ () => clearSelectedBlock() }
                                >
                                    <Icon icon={ closeSmall } />
                                </button>
                            </div>
                        </Tooltip>
                    ) }
                    <div className="editor-chat-sidebar__input-wrap" ref={ inputRef }>
                        <input
                            type="text"
                            className="editor-chat-sidebar__text"
                            placeholder={ __( 'Write your prompt' ) }
                        />
                        <button
                            type="button"
                            className="editor-chat-sidebar__submit"
                            aria-label={ __( 'Submit' ) }
                            onClick={ () => {} }
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                width="18"
                                height="18"
                                aria-hidden="true"
                                focusable="false"
                            >
                                <path d="M11.25 19V9.81l-3.72 3.72-1.06-1.06L12 7.69l5.53 4.78-1.06 1.06-3.72-3.72V19h-1.5Z" fill="currentColor"/>
                            </svg>
                        </button>
                    </div>
                </div>
                </div>
            </motion.div>
        </motion.aside>
    );
}
