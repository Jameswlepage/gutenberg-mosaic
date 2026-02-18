/**
 * WordPress dependencies
 */
import { useRefEffect } from '@wordpress/compose';

/**
 * After this many milliseconds of no user interaction the caret is hidden
 * so it doesn't distract a passive reader. Any pointer or keyboard activity
 * immediately restores it.
 */
const IDLE_TIMEOUT_MS = 4000;

/**
 * Hides the native browser caret after a period of inactivity, then restores
 * it as soon as the user moves the mouse, touches the screen, or presses a key.
 *
 * Works by toggling `caret-color: transparent` on the writing-flow container,
 * which is inherited by all nested contenteditable elements.
 */
export default function useIdleCaret() {
	return useRefEffect( ( node ) => {
		let timer;

		function hideCaret() {
			node.style.caretColor = 'transparent';
		}

		function showCaret() {
			node.style.caretColor = '';
		}

		function resetTimer() {
			showCaret();
			clearTimeout( timer );
			timer = setTimeout( hideCaret, IDLE_TIMEOUT_MS );
		}

		const events = [
			'keydown',
			'keyup',
			'mousedown',
			'mousemove',
			'touchstart',
			'pointerdown',
			'scroll',
		];

		for ( const event of events ) {
			node.addEventListener( event, resetTimer, { passive: true } );
		}

		// Also wake up on window-level focus (user tabbing back into the page).
		const ownerDocument = node.ownerDocument;
		const defaultView = ownerDocument?.defaultView;

		function handleVisibilityChange() {
			if ( ! ownerDocument.hidden ) {
				resetTimer();
			}
		}

		function handleWindowFocus() {
			resetTimer();
		}

		ownerDocument.addEventListener(
			'visibilitychange',
			handleVisibilityChange
		);
		defaultView?.addEventListener( 'focus', handleWindowFocus );

		// Start the idle timer immediately.
		timer = setTimeout( hideCaret, IDLE_TIMEOUT_MS );

		return () => {
			clearTimeout( timer );
			showCaret();

			for ( const event of events ) {
				node.removeEventListener( event, resetTimer );
			}
			ownerDocument.removeEventListener(
				'visibilitychange',
				handleVisibilityChange
			);
			defaultView?.removeEventListener( 'focus', handleWindowFocus );
		};
	}, [] );
}
