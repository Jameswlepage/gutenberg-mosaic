/**
 * WordPress dependencies
 */
import { useRef, useEffect, useCallback } from '@wordpress/element';

/**
 * Internal dependencies
 */
import type { AudioLevelRef } from '../hooks/use-gemini-agent';

interface OrbProps {
	state: 'idle' | 'connecting' | 'active' | 'error';
	audioLevelRef?: AudioLevelRef;
	className?: string;
}

/* ── Blob seed ── */

interface BlobSeed {
	px: number;
	py: number;
	sx: number;
	sy: number;
	r: number;
	color: string;
}

/* ── Bright blue palettes — bg matches the mid-tone so edges blend ── */

const PALETTE: Record<
	OrbProps[ 'state' ],
	{ blobs: string[]; bg: string }
> = {
	idle: {
		blobs: [
			'#2563eb', // blue-600
			'#3b82f6', // blue-500
			'#60a5fa', // blue-400
			'#93c5fd', // blue-300
			'#1d4ed8', // blue-700
			'#bfdbfe', // blue-200
		],
		bg: '#3b82f6',
	},
	connecting: {
		blobs: [
			'#2563eb', // blue-600
			'#6366f1', // indigo-500
			'#818cf8', // indigo-400
			'#60a5fa', // blue-400
			'#a5b4fc', // indigo-300
			'#3b82f6', // blue-500
		],
		bg: '#4f6df0',
	},
	active: {
		blobs: [
			'#2563eb', // blue-600
			'#3b82f6', // blue-500
			'#38bdf8', // sky-400
			'#60a5fa', // blue-400
			'#7dd3fc', // sky-300
			'#93c5fd', // blue-300
		],
		bg: '#3b82f6',
	},
	error: {
		blobs: [
			'#64748b', // slate-500
			'#94a3b8', // slate-400
			'#475569', // slate-600
			'#cbd5e1', // slate-300
			'#94a3b8', // slate-400
			'#64748b', // slate-500
		],
		bg: '#64748b',
	},
};

/* ── Deterministic random ── */

function seededRandom( seed: number ): () => number {
	let s = seed;
	return () => {
		s = ( s * 16807 + 0 ) % 2147483647;
		return ( s - 1 ) / 2147483646;
	};
}

function generateBlobs( colors: string[] ): BlobSeed[] {
	const rand = seededRandom( 42 );
	return colors.map( ( color ) => ( {
		px: rand() * Math.PI * 2,
		py: rand() * Math.PI * 2,
		sx: 0.2 + rand() * 0.4,
		sy: 0.2 + rand() * 0.4,
		r: 0.55 + rand() * 0.3,
		color,
	} ) );
}

/**
 * Fluid animated gradient orb.
 *
 * 6 overlapping radial-gradient blobs in a bright blue palette orbit on
 * sine/cosine paths with screen blending. A light CSS blur merges them.
 * Audio level gently inflates blobs and adds movement.
 *
 * The background matches the palette mid-tone so edges never look dark.
 */
export function Orb( { state, audioLevelRef, className }: OrbProps ) {
	const canvasRef = useRef< HTMLCanvasElement | null >( null );
	const animRef = useRef< number >( 0 );

	const palRef = useRef( PALETTE[ state ] );
	const blobsRef = useRef( generateBlobs( PALETTE[ state ].blobs ) );
	const smoothLevelRef = useRef( 0 );

	useEffect( () => {
		palRef.current = PALETTE[ state ];
		blobsRef.current = generateBlobs( PALETTE[ state ].blobs );
	}, [ state ] );

	const draw = useCallback(
		( time: number ) => {
			const canvas = canvasRef.current;
			if ( ! canvas ) {
				return;
			}
			const ctx = canvas.getContext( '2d' );
			if ( ! ctx ) {
				return;
			}

			/* ── Sizing ── */
			const dpr = window.devicePixelRatio || 1;
			const w = canvas.clientWidth;
			const h = canvas.clientHeight;
			if ( canvas.width !== w * dpr || canvas.height !== h * dpr ) {
				canvas.width = w * dpr;
				canvas.height = h * dpr;
				ctx.setTransform( dpr, 0, 0, dpr, 0, 0 );
			}

			/* ── Audio level (gentle) ── */
			const rawLevel = audioLevelRef?.current ?? 0;
			const normLevel = Math.min( rawLevel / 0.15, 1 );
			// Slow smoothing so movement is gentle, not jumpy
			smoothLevelRef.current +=
				( normLevel - smoothLevelRef.current ) * 0.06;
			const level = smoothLevelRef.current;

			/* ── Time ── */
			const baseSpeed =
				state === 'connecting'
					? 1.4
					: state === 'active'
					? 0.5
					: state === 'error'
					? 0.2
					: 0.25;
			// Audio adds only subtle speed boost
			const speed = baseSpeed + level * 0.6;
			const t = ( time / 1000 ) * speed;

			/* ── Background (mid-blue, not dark) ── */
			const pal = palRef.current;
			ctx.globalCompositeOperation = 'source-over';
			ctx.fillStyle = pal.bg;
			ctx.fillRect( 0, 0, w, h );

			/* ── Coords ── */
			const cx = w / 2;
			const cy = h / 2;
			const R = Math.min( cx, cy );

			/* ── Draw blobs ── */
			const blobs = blobsRef.current;
			for ( let i = 0; i < blobs.length; i++ ) {
				const b = blobs[ i ];
				// Small orbit; audio widens only slightly
				const orbitR = R * ( 0.15 + level * 0.1 );
				const bx = cx + Math.sin( t * b.sx + b.px ) * orbitR;
				const by = cy + Math.cos( t * b.sy + b.py ) * orbitR;
				// Audio gently inflates blobs
				const blobR = R * b.r * ( 1 + level * 0.25 );

				const grad = ctx.createRadialGradient(
					bx,
					by,
					0,
					bx,
					by,
					blobR
				);
				grad.addColorStop( 0, b.color );
				grad.addColorStop( 0.6, b.color + 'dd' );
				grad.addColorStop( 0.85, b.color + '55' );
				grad.addColorStop( 1, b.color + '00' );

				ctx.globalCompositeOperation =
					i === 0 ? 'source-over' : 'screen';
				ctx.fillStyle = grad;
				ctx.fillRect( 0, 0, w, h );
			}

			/* ── Central highlight ── */
			ctx.globalCompositeOperation = 'screen';
			const hlR = R * 0.5 * ( 1 + level * 0.15 );
			const hl = ctx.createRadialGradient(
				cx,
				cy - R * 0.05,
				0,
				cx,
				cy,
				hlR
			);
			hl.addColorStop( 0, 'rgba(191, 219, 254, 0.3)' );
			hl.addColorStop( 0.4, 'rgba(147, 197, 253, 0.1)' );
			hl.addColorStop( 1, 'transparent' );
			ctx.fillStyle = hl;
			ctx.fillRect( 0, 0, w, h );

			ctx.globalCompositeOperation = 'source-over';

			animRef.current = requestAnimationFrame( draw );
		},
		[ state, audioLevelRef ]
	);

	useEffect( () => {
		animRef.current = requestAnimationFrame( draw );
		return () => cancelAnimationFrame( animRef.current );
	}, [ draw ] );

	return (
		<canvas
			ref={ canvasRef }
			className={ className }
			style={ {
				width: '100%',
				height: '100%',
				filter: 'blur(8px) saturate(1.3)',
			} }
		/>
	);
}
