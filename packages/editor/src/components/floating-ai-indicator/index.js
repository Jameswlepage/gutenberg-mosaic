/**
 * WordPress dependencies
 */
import { useSelect, useDispatch } from '@wordpress/data';
import {
	useRef,
	useEffect,
	useState,
	useCallback,
	memo,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { store as interfaceStore } from '@wordpress/interface';

/**
 * External dependencies
 */
import { sharedAudioLevel } from '@wordpress/gemini-live-agent';

/**
 * Internal dependencies
 */
import { sidebars } from '../sidebar/constants';
import './style.scss';

const STORE_NAME = 'core/gemini-live-agent';
const MARGIN = 16;
const BAR_COUNT = 20;
const BAR_W = 2;
const BAR_GAP = 1.5;

/**
 * Canvas waveform — reads sharedAudioLevel in a rAF loop.
 */
const Waveform = memo( ( { isActive } ) => {
	const canvasRef = useRef( null );
	const barsRef = useRef( new Float32Array( BAR_COUNT ).fill( 0 ) );
	const rafRef = useRef( null );

	useEffect( () => {
		const canvas = canvasRef.current;
		if ( ! canvas ) {
			return;
		}
		const ctx = canvas.getContext( '2d' );
		const dpr = window.devicePixelRatio || 1;
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		canvas.width = w * dpr;
		canvas.height = h * dpr;
		ctx.scale( dpr, dpr );

		const bars = barsRef.current;

		function draw() {
			const level = isActive ? sharedAudioLevel.current : 0;
			const target = Math.min( level / 0.12, 1 );

			for ( let i = 0; i < bars.length - 1; i++ ) {
				bars[ i ] += ( bars[ i + 1 ] - bars[ i ] ) * 0.35;
			}
			bars[ bars.length - 1 ] +=
				( target + ( Math.random() - 0.5 ) * target * 0.3 - bars[ bars.length - 1 ] ) * 0.45;

			ctx.clearRect( 0, 0, w, h );

			const totalW = BAR_COUNT * BAR_W + ( BAR_COUNT - 1 ) * BAR_GAP;
			const startX = ( w - totalW ) / 2;

			for ( let i = 0; i < bars.length; i++ ) {
				const v = Math.max( 0.06, Math.min( 1, bars[ i ] ) );
				const barH = v * h * 0.8;
				const x = startX + i * ( BAR_W + BAR_GAP );
				const y = ( h - barH ) / 2;

				// Soft gradient: purple center, fading to edges
				const alpha = 0.5 + v * 0.4;
				const centerDist = Math.abs( i - bars.length / 2 ) / ( bars.length / 2 );
				const r = Math.round( 140 + centerDist * 40 );
				const g = Math.round( 80 + ( 1 - centerDist ) * 60 );
				const b2 = Math.round( 220 + centerDist * 35 );
				ctx.fillStyle = `rgba(${ r },${ g },${ b2 },${ alpha })`;
				ctx.beginPath();
				ctx.roundRect( x, y, BAR_W, barH, 1 );
				ctx.fill();
			}

			rafRef.current = requestAnimationFrame( draw );
		}

		rafRef.current = requestAnimationFrame( draw );
		return () => {
			if ( rafRef.current ) {
				cancelAnimationFrame( rafRef.current );
			}
		};
	}, [ isActive ] );

	return (
		<canvas
			ref={ canvasRef }
			className="floating-ai-indicator__waveform"
		/>
	);
} );

/**
 * Nearest corner snap position.
 */
function snapToCorner( x, y ) {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	// Use the pill's actual rendered size via center point
	const cx = x + 80; // ~half pill width
	const cy = y + 20; // ~half pill height

	const isRight = cx > vw / 2;
	const isBottom = cy > vh / 2;

	return {
		x: isRight ? vw - MARGIN : MARGIN,
		y: isBottom ? vh - MARGIN : MARGIN,
	};
}

/**
 * Floating AI indicator — visible when AI is connected and the AI
 * sidebar tab is closed. Draggable, snaps to corners. Click opens sidebar.
 */
function FloatingAIIndicator() {
	const { isConnected, isAISidebarOpen } = useSelect( ( select ) => {
		let connectionState = 'disconnected';
		try {
			connectionState = select( STORE_NAME ).getConnectionState();
		} catch {
			// Store not registered yet.
		}
		const activeArea =
			select( interfaceStore ).getActiveComplementaryArea( 'core' );
		return {
			isConnected: connectionState === 'connected',
			isAISidebarOpen: activeArea === sidebars.ai,
		};
	}, [] );

	const { enableComplementaryArea } = useDispatch( interfaceStore );

	const shouldShow = isConnected && ! isAISidebarOpen;

	// Position uses bottom/right anchoring via CSS custom properties.
	// We store which corner: { x: left px, y: top px } using CSS translate.
	const [ pos, setPos ] = useState( () => snapToCorner(
		window.innerWidth, window.innerHeight
	) );
	const [ isSnapping, setIsSnapping ] = useState( false );

	const pillRef = useRef( null );
	const isDragging = useRef( false );
	const dragStart = useRef( { mx: 0, my: 0, px: 0, py: 0 } );
	const hasMoved = useRef( false );

	// Mount/unmount animation
	const [ isVisible, setIsVisible ] = useState( false );
	const [ isMounted, setIsMounted ] = useState( false );

	useEffect( () => {
		if ( shouldShow ) {
			setIsMounted( true );
			const raf = requestAnimationFrame( () => {
				requestAnimationFrame( () => setIsVisible( true ) );
			} );
			return () => cancelAnimationFrame( raf );
		}
		setIsVisible( false );
		const t = setTimeout( () => setIsMounted( false ), 280 );
		return () => clearTimeout( t );
	}, [ shouldShow ] );

	// Resnap on resize
	useEffect( () => {
		const onResize = () => setPos( ( p ) => snapToCorner( p.x, p.y ) );
		window.addEventListener( 'resize', onResize );
		return () => window.removeEventListener( 'resize', onResize );
	}, [] );

	const handlePointerDown = useCallback( ( e ) => {
		if ( e.button !== 0 ) {
			return;
		}
		isDragging.current = true;
		hasMoved.current = false;
		dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
		pillRef.current?.setPointerCapture( e.pointerId );
		setIsSnapping( false );
	}, [ pos ] );

	const handlePointerMove = useCallback( ( e ) => {
		if ( ! isDragging.current ) {
			return;
		}
		const dx = e.clientX - dragStart.current.mx;
		const dy = e.clientY - dragStart.current.my;
		if ( Math.abs( dx ) > 3 || Math.abs( dy ) > 3 ) {
			hasMoved.current = true;
		}
		setPos( {
			x: dragStart.current.px + dx,
			y: dragStart.current.py + dy,
		} );
	}, [] );

	const handlePointerUp = useCallback( ( e ) => {
		if ( ! isDragging.current ) {
			return;
		}
		isDragging.current = false;
		pillRef.current?.releasePointerCapture( e.pointerId );

		// Always snap to nearest corner
		setIsSnapping( true );
		setPos( ( p ) => snapToCorner( p.x, p.y ) );
		setTimeout( () => setIsSnapping( false ), 350 );
	}, [] );

	const handleClick = useCallback( () => {
		if ( hasMoved.current ) {
			return;
		}
		enableComplementaryArea( 'core', sidebars.ai );
	}, [ enableComplementaryArea ] );

	if ( ! isMounted ) {
		return null;
	}

	// Determine anchor style — position from corner
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const anchorRight = pos.x > vw / 2;
	const anchorBottom = pos.y > vh / 2;

	const style = {};
	if ( anchorRight ) {
		style.right = isDragging.current ? `${ vw - pos.x }px` : `${ MARGIN }px`;
	} else {
		style.left = isDragging.current ? `${ pos.x }px` : `${ MARGIN }px`;
	}
	if ( anchorBottom ) {
		style.bottom = isDragging.current ? `${ vh - pos.y }px` : `${ MARGIN }px`;
	} else {
		style.top = isDragging.current ? `${ pos.y }px` : `${ MARGIN }px`;
	}

	return (
		<div
			ref={ pillRef }
			className={ [
				'floating-ai-indicator',
				isVisible && 'is-visible',
				isSnapping && 'is-snapping',
				isDragging.current && 'is-dragging',
			]
				.filter( Boolean )
				.join( ' ' ) }
			style={ isDragging.current ? {
				position: 'fixed',
				left: `${ pos.x }px`,
				top: `${ pos.y }px`,
			} : style }
			onPointerDown={ handlePointerDown }
			onPointerMove={ handlePointerMove }
			onPointerUp={ handlePointerUp }
			onClick={ handleClick }
			role="button"
			tabIndex={ 0 }
			aria-label={ __( 'AI assistant active — click to open' ) }
		>
			{ /* Subtle color wash behind frosted glass */ }
			<div className="floating-ai-indicator__glow" />
			<div className="floating-ai-indicator__content">
				{ /* Dot indicator */ }
				<span className="floating-ai-indicator__dot" />
				<Waveform isActive={ isConnected } />
			</div>
		</div>
	);
}

export default memo( FloatingAIIndicator );
