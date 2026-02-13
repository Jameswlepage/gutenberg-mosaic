/**
 * WordPress dependencies
 */
import { useMemo } from '@wordpress/element';

interface ShimmeringTextProps {
	text: string;
	className?: string;
}

/**
 * Text component with a sweeping gradient shimmer effect.
 * Uses a CSS animation to slide a highlight across the text.
 */
export function ShimmeringText( { text, className }: ShimmeringTextProps ) {
	const id = useMemo(
		() => `shimmer-${ Math.random().toString( 36 ).slice( 2, 8 ) }`,
		[]
	);

	return (
		<>
			<style>{ `
				@keyframes ${ id }-sweep {
					0% { background-position: -200% center; }
					100% { background-position: 200% center; }
				}
				.${ id } {
					background: linear-gradient(
						90deg,
						currentColor 0%,
						currentColor 35%,
						rgba(99, 102, 241, 0.7) 50%,
						currentColor 65%,
						currentColor 100%
					);
					background-size: 200% 100%;
					-webkit-background-clip: text;
					background-clip: text;
					-webkit-text-fill-color: transparent;
					animation: ${ id }-sweep 4s ease-in-out infinite;
				}
			` }</style>
			<span className={ `${ id } ${ className || '' }` }>{ text }</span>
		</>
	);
}
