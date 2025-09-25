/**
 * WordPress dependencies
 */
import { __unstableMotion as motion } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Header from './Header';
import ImagePanel from './ImagePanel';
import InputArea from './InputArea';

import { useState, useRef } from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
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
	// Rotation disabled for now
	const [ dirtyCrop, setDirtyCrop ] = useState( false );
	const [ dirtyAnnotate, setDirtyAnnotate ] = useState( false );
	const isDirty = dirtyCrop || dirtyAnnotate;
	const imgRef = useRef();
	const frameRef = useRef();
	const inputRef = useRef();
	const annotateRef = useRef();
	// Spy values from ImageEditingProvider
	const [ cropPercent, setCropPercent ] = useState( null ); // {x,y,width,height} in %
	// Rotation context disabled
	const [ imgNatural, setImgNatural ] = useState( { w: 0, h: 0 } );
	// Cropper UI state bridged from ImageEditingProvider
	const [ zoomUI, setZoomUI ] = useState( 1 ); // 1.0 - 3.0 (provider expects 100-300)
	const [ aspectUI, setAspectUI ] = useState(); // number | undefined (free)
	const setZoomRef = useRef( null );
	const setAspectRef = useRef( null );
	const phase = ! isOpen ? 'closed' : isExpanded ? 'expanded' : 'open';
	const dur = 0.28;
	const ease = [ 0.6, 0, 0.4, 1 ];

	// Chat messages state
	const [ messages, setMessages ] = useState( [
		{ id: 'm1', role: 'ai', text: __( 'Howdy! What image do you want to create today?' ) },
	] );
	const [ inputValue, setInputValue ] = useState( '' );
	const [ isSubmitting, setIsSubmitting ] = useState( false );
	const [ isGeneratingImage, setIsGeneratingImage ] = useState( false );

	// Current block selection info
	const { selectedClientId, selectedIcon, isImageSelected, selectedImageURL } = useSelect(
		( select ) => {
			const be = select( blockEditorStore );
			const clientId = be.getSelectedBlockClientId?.();
			const name = clientId ? be.getBlockName?.( clientId ) : null;
			const blk = select( blocksStore );
			const icon = name ? blk.getBlockType?.( name )?.icon : null;
			const selectedBlock = be.getSelectedBlock?.();
			const selectedUrl = name === 'core/image' ? selectedBlock?.attributes?.url : null;
			return {
				selectedClientId: clientId,
				selectedIcon: icon,
				isImageSelected: name === 'core/image',
				selectedImageURL: selectedUrl,
			};
		}
	);

	const { updateBlockAttributes, clearSelectedBlock } =
		useDispatch( blockEditorStore );

	function handleReplaceOnCanvas() {
		if ( ! isImageSelected || ! selectedClientId ) return;
		const img = imgRef.current;
		const url = img?.getAttribute?.( 'src' );
		if ( url ) {
			updateBlockAttributes( selectedClientId, { url } );
		}
	}

	function handleReplaceInChat() {
		if ( ! isImageSelected || ! selectedImageURL ) return;
		if ( imgRef.current ) {
			imgRef.current.src = selectedImageURL;
		}
	}

	function submitPrompt() {
		if ( ! inputValue.trim() || isSubmitting ) return;
		// Image Studio: simulate generation pulse
		if ( isExpanded && isStudio ) {
			setIsSubmitting( true );
			setIsGeneratingImage( true );
			const done = () => {
				setIsGeneratingImage( false );
				setIsSubmitting( false );
			};
			// Mock 2s generation
			setTimeout( done, 2000 );
			setInputValue( '' );
			return;
		}

		// Regular chat: push user message, then fake AI response
		const id = 'm' + Date.now();
		setMessages( (prev) => [ ...prev, { id, role: 'user', text: inputValue } ] );
		setInputValue( '' );
		setIsSubmitting( true );
		setTimeout( () => {
			setMessages( (prev) => [
				...prev,
				{
					id: 'm' + ( Date.now() + 1 ),
					role: 'ai',
					text: __( 'Here’s a mocked AI response. Describe a style or subject for a better result.' ),
				},
			] );
			setIsSubmitting( false );
		}, 900 );
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
		if ( expand ) onToggleExpand?.();
		else onClose?.();
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
	// Rotation disabled for now

	function handleToggleCrop() {
		if ( tool === 'crop' ) {
			setTool( 'none' );
			return;
		}
		setCropPercent( null );
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

	// Removed manual crop box; handled by react-easy-crop

	// Rotation disabled: draw from base image without rotation

	async function handleSave() {
		try {
			const src = imgRef.current?.src;
			if ( ! src ) throw new Error( 'no image' );
			const base = await new Promise( ( res, rej ) => {
				const im = new Image();
				im.crossOrigin = 'anonymous';
				im.onload = () => res( im );
				im.onerror = rej;
				im.src = src;
			} );
			const rotated = base;
			// Convert cropPercent (0-100) to pixels against base image
			const crop = cropPercent
				? {
						x: Math.round(
							( cropPercent.x / 100 ) * rotated.width
						),
						y: Math.round(
							( cropPercent.y / 100 ) * rotated.height
						),
						width: Math.round(
							( cropPercent.width / 100 ) * rotated.width
						),
						height: Math.round(
							( cropPercent.height / 100 ) * rotated.height
						),
				  }
				: { x: 0, y: 0, width: rotated.width, height: rotated.height };
			const out = document.createElement( 'canvas' );
			out.width = Math.max( 1, Math.floor( crop.width ) );
			out.height = Math.max( 1, Math.floor( crop.height ) );
			const octx = out.getContext( '2d' );
			octx.drawImage(
				rotated,
				crop.x,
				crop.y,
				crop.width,
				crop.height,
				0,
				0,
				out.width,
				out.height
			);
			if ( annotateRef.current ) {
				// draw annotations aligned to base image space
				octx.drawImage(
					annotateRef.current,
					crop.x,
					crop.y,
					crop.width,
					crop.height,
					0,
					0,
					out.width,
					out.height
				);
			}
			const dataUrl = out.toDataURL( 'image/png' );
			if ( imgRef.current ) imgRef.current.src = dataUrl;
		} catch ( e ) {
			// swallow
		}
		// rotation disabled
		setDirtyCrop( false );
		setDirtyAnnotate( false );
		setTool( 'none' );
	}

	// Image load natural dimensions
	function onBaseImageLoad( e ) {
		const im = e.currentTarget;
		setImgNatural( { w: im.naturalWidth || 0, h: im.naturalHeight || 0 } );
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
			style={ { flex: '0 0 auto' } }
			animate={ { width: phase === 'closed' ? 0 : phase === 'open' ? 300 : '100%' } }
			transition={ { duration: dur, ease, delay: isClosing ? dur : 0 } }
		>
			{ /* Shell: everything inside the sidebar fades after slide-in, fades before slide-out */ }
			<motion.div
				className="editor-chat-sidebar__shell"
				initial={ false }
				animate={ { opacity: phase === 'closed' ? 0 : 1 } }
				transition={ { duration: dur, ease, delay: isClosing ? 0 : dur } }
			>
				<Header
					isExpanded={ isExpanded }
					isStudio={ isStudio }
					setIsStudio={ setIsStudio }
					playFLIP={ playFLIP }
					tool={ tool }
					zoomUI={ zoomUI }
					aspectUI={ aspectUI }
					setZoomRef={ setZoomRef }
					setAspectRef={ setAspectRef }
					setZoomUI={ setZoomUI }
					setAspectUI={ setAspectUI }
					setDirtyCrop={ setDirtyCrop }
					handleToggleCrop={ handleToggleCrop }
					handleToggleAnnotate={ handleToggleAnnotate }
					isDirty={ isDirty }
					handleSave={ handleSave }
				/>

				{ /* Content */ }
				<div className="editor-chat-sidebar__content">
					<div className="editor-chat-sidebar__scroll">
						{ messages.map( (m) => (
							<div
								key={ m.id }
								className={
									'editor-chat-sidebar__message ' +
									( m.role === 'ai'
										? 'editor-chat-sidebar__message--ai'
										: 'editor-chat-sidebar__message--me' )
								}
							>
								{ m.text }
							</div>
						) ) }
						<ImagePanel
							isExpanded={ isExpanded }
							isStudio={ isStudio }
							tool={ tool }
							setIsStudio={ setIsStudio }
							playFLIP={ playFLIP }
							isImageSelected={ isImageSelected }
							frameRef={ frameRef }
							imgRef={ imgRef }
							annotateRef={ annotateRef }
							onBaseImageLoad={ onBaseImageLoad }
							imgNatural={ imgNatural }
							setCropPercent={ setCropPercent }
							setDirtyCrop={ setDirtyCrop }
							zoomUI={ zoomUI }
							aspectUI={ aspectUI }
							setZoomRef={ setZoomRef }
							setAspectRef={ setAspectRef }
							setZoomUI={ setZoomUI }
							setAspectUI={ setAspectUI }
							handleReplaceOnCanvas={ handleReplaceOnCanvas }
							handleReplaceInChat={ handleReplaceInChat }
							onAnnotatePointerDown={ onAnnotatePointerDown }
							isGenerating={ isGeneratingImage }
						/>
					{ /* No inline CTA; use image overlay action only */ }
					{ children }
					<div className="editor-chat-sidebar__message editor-chat-sidebar__message--me">
						{ __( 'Use the image' ) }
					</div>
				</div>
				<InputArea
					isExpanded={ isExpanded }
					isStudio={ isStudio }
					tool={ tool }
					inputRef={ inputRef }
					selectedClientId={ selectedClientId }
					selectedIcon={ selectedIcon }
					clearSelectedBlock={ clearSelectedBlock }
					value={ inputValue }
					onChange={ setInputValue }
					onSubmit={ submitPrompt }
					isLoading={ isSubmitting }
				/>
				</div>
			</motion.div>
		</motion.aside>
	);
}
