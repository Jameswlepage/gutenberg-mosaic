/**
 * WordPress dependencies
 */
import { Button, Icon, Tooltip, __unstableMotion as motion, __unstableAnimatePresence as AnimatePresence } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { image, rotateLeft, closeSmall } from '@wordpress/icons';

import { useState, useRef } from '@wordpress/element';

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
    const [ isDirty, setIsDirty ] = useState( false );
    const imgRef = useRef();
    const frameRef = useRef();
    const inputRef = useRef();
    const annotateRef = useRef();
    const [ cropRect, setCropRect ] = useState( null ); // { x,y,w,h } in frame coords
    const phase = ! isOpen ? 'closed' : isExpanded ? 'expanded' : 'open';
    const dur = 0.28;
    const ease = [ 0.6, 0, 0.4, 1 ];

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
        setIsDirty( true );
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
        setTool( ( t ) => ( t === 'annotate' ? 'none' : 'annotate' ) );
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
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo( x, y );
        setIsDirty( true );

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
        function move( ev ) {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            const { width, height } = frame.getBoundingClientRect();
            let x = Math.max( 0, Math.min( width - start.w, start.x + dx ) );
            let y = Math.max( 0, Math.min( height - start.h, start.y + dy ) );
            setCropRect( { ...start, x, y } );
            setIsDirty( true );
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
        setIsDirty( false );
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
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                                        <path d="M7 3v12a2 2 0 0 0 2 2h12v-2H9V3H7zm-4 4h2v10a2 2 0 0 0 2 2h10v2H7a4 4 0 0 1-4-4V7zM17 3h-2v6h6V7h-4V3z" fill="currentColor"/>
                                    </svg>
                                </Button>
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
                            <img
                                ref={ imgRef }
                                className="editor-chat-sidebar__image-tag"
                                src="https://images.unsplash.com/photo-1502085671122-2d218cd434e6?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                                alt={ __( 'Placeholder image' ) }
                                style={{ transform: `rotate(${ rotation }deg)`, transformOrigin: 'center center' }}
                            />
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
                    </div>
                    {/* No inline CTA; use image overlay action only */}
                    { children }
                    <div className="editor-chat-sidebar__message editor-chat-sidebar__message--me">
                        { __( 'Use the image' ) }
                    </div>
                </div>
                <div className="editor-chat-sidebar__input">
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
