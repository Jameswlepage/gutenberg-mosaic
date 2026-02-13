/**
 * Internal dependencies
 */
import type { ScreenCaptureState } from '../types';
import type { GeminiBridge } from './gemini-bridge';

/**
 * Default frame rate for screen capture (frames per second)
 * Lower values reduce bandwidth but may miss fast changes
 */
const DEFAULT_FRAME_RATE = 1; // 1 FPS for screen sharing

/**
 * Default image quality (0-1) for JPEG compression
 */
const DEFAULT_IMAGE_QUALITY = 0.7;

/**
 * Maximum dimension for captured frames (width or height)
 * Frames are scaled down if larger to reduce bandwidth
 */
const MAX_FRAME_DIMENSION = 1280;

/**
 * ScreenCapture class handles screen sharing and frame extraction
 * for sending to the Gemini Live API.
 */
export class ScreenCapture {
	private stream: MediaStream | null = null;
	private videoElement: HTMLVideoElement | null = null;
	private canvas: HTMLCanvasElement | null = null;
	private canvasContext: CanvasRenderingContext2D | null = null;
	private captureInterval: ReturnType< typeof setInterval > | null = null;
	private bridge: GeminiBridge | null = null;
	private frameRate: number;
	private imageQuality: number;
	private isCapturing: boolean = false;
	private onStopCallback: ( () => void ) | null = null;

	constructor(
		options: {
			frameRate?: number;
			imageQuality?: number;
		} = {}
	) {
		this.frameRate = options.frameRate || DEFAULT_FRAME_RATE;
		this.imageQuality = options.imageQuality || DEFAULT_IMAGE_QUALITY;
	}

	/**
	 * Set the bridge to send frames to
	 *
	 * @param bridge The Gemini bridge instance.
	 */
	public setBridge( bridge: GeminiBridge ): void {
		this.bridge = bridge;
	}

	/**
	 * Set a callback fired when capture stops.
	 *
	 * @param onStop The callback to invoke.
	 */
	public setOnStop( onStop: () => void ): void {
		this.onStopCallback = onStop;
	}

	/**
	 * Get current capture state
	 */
	public getState(): ScreenCaptureState {
		return {
			isCapturing: this.isCapturing,
			stream: this.stream,
			error: null,
		};
	}

	/**
	 * Start screen capture
	 */
	public async start(): Promise< void > {
		if ( this.isCapturing ) {
			return;
		}

		try {
			const displayMediaOptions = {
				video: {
					cursor: 'always',
					displaySurface: 'browser',
				},
				audio: false,
				preferCurrentTab: true,
				selfBrowserSurface: 'include',
				surfaceSwitching: 'exclude',
			} as any;

			// Request screen capture permission
			this.stream =
				await navigator.mediaDevices.getDisplayMedia(
					displayMediaOptions
				);

			const videoTrack = this.stream.getVideoTracks()[ 0 ];
			const settings = videoTrack?.getSettings?.();

			if ( settings?.displaySurface && settings.displaySurface !== 'browser' ) {
				this.stop();
				throw new Error(
					'Please share the current browser tab to enable AI collaboration.'
				);
			}

			// Create video element to capture frames from
			this.videoElement = document.createElement( 'video' );
			this.videoElement.srcObject = this.stream;
			this.videoElement.muted = true;
			await this.videoElement.play();

			// Create canvas for frame extraction
			this.canvas = document.createElement( 'canvas' );
			this.canvasContext = this.canvas.getContext( '2d' );

			// Handle stream ending (user stops sharing)
			this.stream.getVideoTracks()[ 0 ].onended = () => {
				this.stop();
			};

			this.isCapturing = true;

			// Start capturing frames
			this.startFrameCapture();
		} catch ( error ) {
			this.isCapturing = false;
			throw error;
		}
	}

	/**
	 * Stop screen capture
	 */
	public stop(): void {
		const wasCapturing = this.isCapturing;
		this.isCapturing = false;

		if ( this.captureInterval ) {
			clearInterval( this.captureInterval );
			this.captureInterval = null;
		}

		if ( this.stream ) {
			this.stream.getTracks().forEach( ( track ) => track.stop() );
			this.stream = null;
		}

		if ( this.videoElement ) {
			this.videoElement.srcObject = null;
			this.videoElement = null;
		}

		this.canvas = null;
		this.canvasContext = null;

		if ( wasCapturing ) {
			this.onStopCallback?.();
		}
	}

	/**
	 * Start capturing frames at the configured frame rate
	 */
	private startFrameCapture(): void {
		const intervalMs = 1000 / this.frameRate;

		this.captureInterval = setInterval( () => {
			this.captureAndSendFrame();
		}, intervalMs );

		// Capture first frame immediately
		this.captureAndSendFrame();
	}

	/**
	 * Capture a single frame and send to the bridge
	 */
	private captureAndSendFrame(): void {
		if (
			! this.videoElement ||
			! this.canvas ||
			! this.canvasContext ||
			! this.bridge
		) {
			return;
		}

		const video = this.videoElement;

		// Calculate scaled dimensions
		let width = video.videoWidth;
		let height = video.videoHeight;

		if ( width > MAX_FRAME_DIMENSION || height > MAX_FRAME_DIMENSION ) {
			const scale = MAX_FRAME_DIMENSION / Math.max( width, height );
			width = Math.round( width * scale );
			height = Math.round( height * scale );
		}

		// Set canvas size and draw frame
		this.canvas.width = width;
		this.canvas.height = height;
		this.canvasContext.drawImage( video, 0, 0, width, height );

		// Convert to JPEG and send
		const imageData = this.canvas.toDataURL(
			'image/jpeg',
			this.imageQuality
		);
		this.bridge.sendVideoFrame( imageData, 'image/jpeg' );
	}

	/**
	 * Capture a single frame and return as base64
	 */
	public captureFrame(): string | null {
		if ( ! this.videoElement || ! this.canvas || ! this.canvasContext ) {
			return null;
		}

		const video = this.videoElement;

		// Calculate scaled dimensions
		let width = video.videoWidth;
		let height = video.videoHeight;

		if ( width > MAX_FRAME_DIMENSION || height > MAX_FRAME_DIMENSION ) {
			const scale = MAX_FRAME_DIMENSION / Math.max( width, height );
			width = Math.round( width * scale );
			height = Math.round( height * scale );
		}

		// Set canvas size and draw frame
		this.canvas.width = width;
		this.canvas.height = height;
		this.canvasContext.drawImage( video, 0, 0, width, height );

		// Return as base64
		return this.canvas.toDataURL( 'image/jpeg', this.imageQuality );
	}

	/**
	 * Set the frame rate
	 *
	 * @param fps Frames per second.
	 */
	public setFrameRate( fps: number ): void {
		this.frameRate = fps;

		// Restart capture with new frame rate if currently capturing
		if ( this.isCapturing && this.captureInterval ) {
			clearInterval( this.captureInterval );
			this.startFrameCapture();
		}
	}

	/**
	 * Set the image quality
	 *
	 * @param quality Image quality between 0 and 1.
	 */
	public setImageQuality( quality: number ): void {
		this.imageQuality = Math.max( 0, Math.min( 1, quality ) );
	}
}

/**
 * Create a new ScreenCapture instance
 *
 * @param options              Configuration options.
 * @param options.frameRate    Frames per second.
 * @param options.imageQuality Image quality between 0 and 1.
 */
export function createScreenCapture( options?: {
	frameRate?: number;
	imageQuality?: number;
} ): ScreenCapture {
	return new ScreenCapture( options );
}
