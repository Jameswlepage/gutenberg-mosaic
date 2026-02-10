/**
 * Internal dependencies
 */
import type { GeminiBridge } from './gemini-bridge';

/**
 * Sample rate for audio capture (Gemini expects 16kHz)
 */
const AUDIO_SAMPLE_RATE = 16000;

/**
 * Audio worklet processor code for capturing PCM audio
 */
const AUDIO_WORKLET_CODE = `
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];

    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i];

      if (this.bufferIndex >= this.bufferSize) {
        // Convert to 16-bit PCM
        const pcmData = new Int16Array(this.bufferSize);
        for (let j = 0; j < this.bufferSize; j++) {
          pcmData[j] = Math.max(-32768, Math.min(32767, Math.round(this.buffer[j] * 32767)));
        }

        this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
`;

/**
 * AudioCapture class handles microphone input and sends audio
 * to the Gemini Live API in the expected PCM format.
 */
export class AudioCapture {
	private stream: MediaStream | null = null;
	private audioContext: AudioContext | null = null;
	private workletNode: AudioWorkletNode | null = null;
	private sourceNode: MediaStreamAudioSourceNode | null = null;
	private bridge: GeminiBridge | null = null;
	private isCapturing: boolean = false;
	private workletBlobUrl: string | null = null;
	private onStopCallback: ( () => void ) | null = null;

	/**
	 * Set the bridge to send audio to
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
	 * Check if audio capture is currently active
	 */
	public getIsCapturing(): boolean {
		return this.isCapturing;
	}

	/**
	 * Start audio capture from microphone
	 */
	public async start(): Promise< void > {
		if ( this.isCapturing ) {
			return;
		}

		try {
			// Request microphone access
			this.stream = await navigator.mediaDevices.getUserMedia( {
				audio: {
					sampleRate: AUDIO_SAMPLE_RATE,
					channelCount: 1,
					echoCancellation: true,
					noiseSuppression: true,
				},
			} );

			// Create audio context at the required sample rate
			this.audioContext = new AudioContext( {
				sampleRate: AUDIO_SAMPLE_RATE,
			} );

			// Create the worklet processor
			await this.setupWorklet();

			// Connect microphone to worklet
			this.sourceNode = this.audioContext.createMediaStreamSource(
				this.stream
			);
			this.sourceNode.connect( this.workletNode! );

			this.isCapturing = true;
		} catch ( error ) {
			this.cleanup();
			throw error;
		}
	}

	/**
	 * Stop audio capture
	 */
	public stop(): void {
		this.cleanup();
	}

	/**
	 * Set up the AudioWorklet for capturing PCM audio
	 */
	private async setupWorklet(): Promise< void > {
		if ( ! this.audioContext ) {
			throw new Error( 'Audio context not initialized' );
		}

		// Create blob URL for worklet code
		const blob = new Blob( [ AUDIO_WORKLET_CODE ], {
			type: 'application/javascript',
		} );
		this.workletBlobUrl = URL.createObjectURL( blob );

		// Add the worklet module
		await this.audioContext.audioWorklet.addModule( this.workletBlobUrl );

		// Create the worklet node
		this.workletNode = new AudioWorkletNode(
			this.audioContext,
			'audio-capture-processor'
		);

		// Handle audio data from worklet
		this.workletNode.port.onmessage = ( event: MessageEvent ) => {
			if ( this.bridge && this.isCapturing ) {
				this.bridge.sendAudioChunk( event.data );
			}
		};
	}

	/**
	 * Clean up all audio resources
	 */
	private cleanup(): void {
		const wasCapturing = this.isCapturing;
		this.isCapturing = false;

		if ( this.sourceNode ) {
			this.sourceNode.disconnect();
			this.sourceNode = null;
		}

		if ( this.workletNode ) {
			this.workletNode.disconnect();
			this.workletNode = null;
		}

		if ( this.audioContext ) {
			this.audioContext.close();
			this.audioContext = null;
		}

		if ( this.stream ) {
			this.stream.getTracks().forEach( ( track ) => track.stop() );
			this.stream = null;
		}

		if ( this.workletBlobUrl ) {
			URL.revokeObjectURL( this.workletBlobUrl );
			this.workletBlobUrl = null;
		}

		if ( wasCapturing ) {
			this.onStopCallback?.();
		}
	}

	/**
	 * Toggle mute state
	 *
	 * @param muted Whether to mute the audio.
	 */
	public setMuted( muted: boolean ): void {
		if ( this.stream ) {
			this.stream.getAudioTracks().forEach( ( track ) => {
				track.enabled = ! muted;
			} );
		}
	}
}

/**
 * Create a new AudioCapture instance
 */
export function createAudioCapture(): AudioCapture {
	return new AudioCapture();
}
