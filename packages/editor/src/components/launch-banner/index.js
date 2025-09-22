/**
 * A fixed bottom banner shown in the editor canvas (iframe) when the
 * `__experimentalLaunchBanner` experiment is enabled.
 */

/**
 * WordPress dependencies
 */
import { useEffect, useRef } from '@wordpress/element';
import { Button } from '@wordpress/components';

function LaunchBanner() {
	// Expect a global injected by PHP when the experiment is enabled.
	const cfg = globalThis.__experimentalLaunchBanner || {};
	const previewUrl = cfg.previewUrl || '#';
	const launchUrl = cfg.launchUrl || '#';

	const mountRef = useRef();

	useEffect( () => {
		// Increase body padding-bottom inside the iframe so content isn't obscured.
		const doc = mountRef.current?.ownerDocument;
		if ( ! doc ) {
			return;
		}
		const prev = doc.body && doc.body.style && doc.body.style.paddingBottom;
		if ( doc.body ) {
			doc.body.style.paddingBottom = '56px';
		}
		return () => {
			if ( doc.body ) {
				doc.body.style.paddingBottom = prev || '';
			}
		};
	}, [] );

	// Inline styles to avoid extra stylesheets.
	const barStyle = {
		position: 'fixed',
		left: 0,
		right: 0,
		bottom: 0,
		zIndex: 9999,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: '12px',
		padding: '12px 16px',
		background: 'var(--wp--preset--color--primary, #3858e9)',
		color: '#fff',
		font: '14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif',
	};

	const textStyle = { flex: 1 };
	const linkStyle = { color: '#fff' };
	const whiteBtnStyle = {
		background: '#fff',
		color: 'var(--wp--preset--color--primary, #3858e9)',
	};

	return (
		<div
			ref={ mountRef }
			style={ barStyle }
			role="region"
			aria-label="Trial Site Banner"
		>
			<span style={ textStyle }>
				This is a trial site. To launch it, upgrade to a WordPress.com
				paid plan.
			</span>
			<div style={ { display: 'flex', gap: 8, alignItems: 'center' } }>
				<Button
					href={ previewUrl }
					target="_blank"
					rel="noreferrer"
					variant="link"
					__next40pxDefaultSize
					style={ linkStyle }
				>
					Preview
				</Button>
				<Button
					href={ launchUrl }
					target="_blank"
					rel="noreferrer"
					variant="secondary"
					__next40pxDefaultSize
					style={ whiteBtnStyle }
				>
					Launch
				</Button>
			</div>
		</div>
	);
}

export default function MaybeLaunchBanner() {
	if ( ! globalThis.__experimentalLaunchBanner ) {
		return null;
	}
	return <LaunchBanner />;
}
