# Mshots Screenshot Preview Code

This code was removed from the Content Guidelines PR as it uses WordPress.com's mshots service (`s0.wp.com`). It can be added back as a plugin or via the SlotFill pattern.

## Usage Pattern

The Content Guidelines package exports a SlotFill pattern for screenshot previews:

```js
import { ReferenceScreenshotFill } from '@wordpress/content-guidelines';

// In your plugin/extension:
<ReferenceScreenshotFill>
  { ( { url } ) => <YourScreenshotComponent url={ url } /> }
</ReferenceScreenshotFill>
```

## Mshots Implementation

```js
/**
 * WordPress dependencies
 */
import {
	useState,
	useEffect,
	useRef,
	useCallback,
	memo,
} from '@wordpress/element';
import { Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Normalize a URL for mshots.
 * Handles various formats: with/without protocol, www, trailing slash, etc.
 *
 * @param {string} url The URL to normalize.
 * @return {string|null} Normalized URL or null if invalid.
 */
function normalizeUrl( url ) {
	if ( ! url || typeof url !== 'string' ) {
		return null;
	}

	let normalized = url.trim();

	// Remove trailing slashes for consistency
	normalized = normalized.replace( /\/+$/, '' );

	// Ensure URL has protocol
	if ( ! /^https?:\/\//i.test( normalized ) ) {
		normalized = 'https://' + normalized;
	}

	return normalized;
}

/**
 * Generate mshots URL for a given website URL.
 *
 * @param {string} url               The URL to screenshot.
 * @param {Object} options           Options for the screenshot.
 * @param {number} options.width     Width of the screenshot.
 * @param {number} options.height    Height of the screenshot.
 * @param {number} options.retrySeed Optional seed to bust cache for retries.
 * @return {string|null} The mshots URL or null.
 */
function getMshotsUrl(
	url,
	{ width = 400, height = 300, retrySeed = 0 } = {}
) {
	const normalizedUrl = normalizeUrl( url );
	if ( ! normalizedUrl ) {
		return null;
	}

	const encodedUrl = encodeURIComponent( normalizedUrl );
	const seedParam = retrySeed > 0 ? `&r=${ retrySeed }` : '';

	return `https://s0.wp.com/mshots/v1/${ encodedUrl }?w=${ width }&h=${ height }${ seedParam }`;
}

/**
 * Screenshot preview component using mshots service.
 * Handles polling for screenshot generation (mshots returns placeholder while generating).
 * Memoized to prevent unnecessary re-renders when multiple screenshots are on the page.
 *
 * @param {Object} props     Component props.
 * @param {string} props.url The URL to screenshot.
 * @return {JSX.Element|null} Screenshot preview or null.
 */
const MshotsPreview = memo( function MshotsPreview( { url } ) {
	const [ isLoading, setIsLoading ] = useState( true );
	const [ hasError, setHasError ] = useState( false );
	const [ imageSrc, setImageSrc ] = useState( null );
	const [ retryCount, setRetryCount ] = useState( 0 );
	const imgRef = useRef( null );
	const retryTimeoutRef = useRef( null );

	const maxRetries = 10;
	const retryDelay = 2000; // 2 seconds between retries

	// Cleanup timeout on unmount
	useEffect( () => {
		return () => {
			if ( retryTimeoutRef.current ) {
				clearTimeout( retryTimeoutRef.current );
			}
		};
	}, [] );

	// Update mshots URL when url or retryCount changes
	useEffect( () => {
		if ( ! url ) {
			setImageSrc( null );
			setIsLoading( false );
			setRetryCount( 0 );
			return;
		}

		// Reset state when URL changes (but not on retry)
		if ( retryCount === 0 ) {
			setIsLoading( true );
			setHasError( false );
		}

		const mshotsUrl = getMshotsUrl( url, { retrySeed: retryCount } );
		setImageSrc( mshotsUrl );
	}, [ url, retryCount ] );

	const handleLoad = useCallback( () => {
		const img = imgRef.current;
		if ( ! img ) {
			return;
		}

		// mshots returns a small placeholder (typically 400x300 or 1x1) while generating.
		// Real screenshots are larger. Check naturalWidth to detect placeholder.
		if ( img.naturalWidth < 100 || img.naturalHeight < 100 ) {
			// This is the placeholder, retry
			if ( retryCount < maxRetries ) {
				retryTimeoutRef.current = setTimeout( () => {
					setRetryCount( ( c ) => c + 1 );
				}, retryDelay );
			} else {
				// Max retries reached, show error
				setIsLoading( false );
				setHasError( true );
			}
			return;
		}

		// Real screenshot loaded
		setIsLoading( false );
		setHasError( false );
	}, [ retryCount ] );

	const handleError = useCallback( () => {
		// On error, retry a few times before giving up
		if ( retryCount < maxRetries ) {
			retryTimeoutRef.current = setTimeout( () => {
				setRetryCount( ( c ) => c + 1 );
			}, retryDelay );
		} else {
			setIsLoading( false );
			setHasError( true );
		}
	}, [ retryCount ] );

	if ( ! url || ! imageSrc ) {
		return null;
	}

	return (
		<div className="reference-screenshot">
			{ isLoading && (
				<div className="reference-screenshot__loading">
					<Spinner />
					<span>{ __( 'Loading preview...' ) }</span>
				</div>
			) }
			{ hasError && (
				<div className="reference-screenshot__error">
					{ __( 'Preview unavailable' ) }
				</div>
			) }
			<img
				ref={ imgRef }
				src={ imageSrc }
				alt={ __( 'Website screenshot' ) }
				className="reference-screenshot__image"
				onLoad={ handleLoad }
				onError={ handleError }
				style={ { display: isLoading || hasError ? 'none' : 'block' } }
			/>
		</div>
	);
} );

export default MshotsPreview;
```

## CSS Styles

```scss
.reference-screenshot {
	position: relative;
	width: 100%;
	max-width: 400px;
	aspect-ratio: 4 / 3;
	background: #f0f0f0;
	border-radius: 4px;
	overflow: hidden;

	&__loading,
	&__error {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: #757575;
		font-size: 12px;
	}

	&__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
}
```

## Using with SlotFill

To enable mshots previews in your environment:

```js
import { ReferenceScreenshotFill } from '@wordpress/content-guidelines';
import MshotsPreview from './mshots-preview';

function MshotsScreenshotFill() {
	return (
		<ReferenceScreenshotFill>
			{ ( { url } ) => <MshotsPreview url={ url } /> }
		</ReferenceScreenshotFill>
	);
}

// Register this component in your plugin's entry point
```
