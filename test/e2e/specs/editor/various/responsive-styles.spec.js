/**
 * WordPress dependencies
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

/**
 * Covers the Responsive Styles experiment end-to-end:
 *   1. Editor-side: base vs. per-breakpoint style edits route into the right
 *      place on the block's attributes (style vs. responsive[bp]).
 *   2. Serialization round-trip: save → reopen → overrides intact.
 *   3. Frontend render: the block support emits a range-syntax media query
 *      carrying the override, with the base value unscoped.
 *
 * Pre-requisite: the `gutenberg-responsive-styles` experiment is enabled
 * in beforeAll (and disabled in afterAll). The first assertion in each
 * editor-side test checks `window.__experimentalResponsiveStyles` directly,
 * so the suite fails loudly if the flag didn't reach the browser rather
 * than silently passing against a feature-off editor.
 */

test.describe( 'Responsive Styles (experimental)', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.setGutenbergExperiments( [
			'gutenberg-responsive-styles',
		] );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await requestUtils.setGutenbergExperiments( [] );
	} );

	test.beforeEach( async ( { admin } ) => {
		await admin.createNewPost();
	} );

	test( 'writes font-size edits into responsive[mobile] when editing at Mobile breakpoint', async ( {
		editor,
		page,
	} ) => {
		// Verify the experiment global actually reached the editor before
		// exercising any of the routing behaviour. Without this, a missing
		// flag would silently degrade the attribute filter to a no-op and
		// every assertion below would "pass" against a feature-off build.
		const experimentEnabled = await page.evaluate(
			() => !! window.__experimentalResponsiveStyles
		);
		expect(
			experimentEnabled,
			'window.__experimentalResponsiveStyles must be set for this test to make sense'
		).toBe( true );

		await editor.insertBlock( {
			name: 'core/paragraph',
			attributes: { content: 'Hello responsive world' },
		} );

		// Baseline: set a font-size at Desktop. Reads/writes should land on
		// attributes.style.typography.fontSize — no `responsive` key yet.
		await editor.openDocumentSettingsSidebar();
		await page.getByRole( 'tab', { name: 'Styles', exact: true } ).click();

		const fontSizeInput = page
			.getByRole( 'region', { name: 'Editor settings' } )
			.getByLabel( 'Font size', { exact: true } )
			.first();
		await fontSizeInput.fill( '32' );
		await fontSizeInput.press( 'Tab' );

		let attrs = await editor.getBlocks();
		expect( attrs[ 0 ].attributes.style?.typography?.fontSize ).toBe(
			'32px'
		);
		expect(
			attrs[ 0 ].attributes.responsive,
			'no overrides yet'
		).toBeFalsy();

		// Switch to Mobile via the header selector, then edit font-size.
		await page.getByRole( 'radio', { name: 'Mobile' } ).click();

		await fontSizeInput.fill( '14' );
		await fontSizeInput.press( 'Tab' );

		attrs = await editor.getBlocks();
		expect(
			attrs[ 0 ].attributes.style?.typography?.fontSize,
			'base value is untouched'
		).toBe( '32px' );
		expect(
			attrs[ 0 ].attributes.responsive?.mobile?.style?.typography
				?.fontSize,
			'mobile override recorded in sparse style tree'
		).toBe( '14px' );

		// Switching back to Desktop should surface the base again.
		await page.getByRole( 'radio', { name: 'Desktop' } ).click();
		await expect( fontSizeInput ).toHaveValue( '32' );
	} );

	test( 'reset-to-base removes the override cleanly', async ( {
		editor,
		page,
	} ) => {
		await editor.insertBlock( {
			name: 'core/paragraph',
			attributes: {
				content: 'Reset test',
				style: { typography: { fontSize: '24px' } },
				responsive: {
					mobile: {
						style: { typography: { fontSize: '14px' } },
					},
				},
			},
		} );

		await editor.openDocumentSettingsSidebar();
		await page.getByRole( 'tab', { name: 'Styles', exact: true } ).click();

		await page.getByRole( 'radio', { name: 'Mobile' } ).click();

		// The overrides panel labels reset buttons with the user-facing
		// path (the `style.` prefix is stripped in `labelForPath`), so the
		// selector matches `typography.fontSize`, not `style.typography.fontSize`.
		await page
			.getByRole( 'button', {
				name: /Reset typography\.fontSize to base/,
			} )
			.click();

		const attrs = await editor.getBlocks();
		expect(
			attrs[ 0 ].attributes.responsive,
			'responsive attribute cleared when last override is reset'
		).toBeFalsy();
		expect( attrs[ 0 ].attributes.style?.typography?.fontSize ).toBe(
			'24px'
		);
	} );

	test( 'frontend render emits a range-syntax media query carrying the override', async ( {
		page,
		requestUtils,
	} ) => {
		const { id: postId } = await requestUtils.createPost( {
			title: 'Responsive styles render test',
			status: 'publish',
			content: `<!-- wp:paragraph {"style":{"typography":{"fontSize":"32px"}},"responsive":{"mobile":{"style":{"typography":{"fontSize":"14px"}}}}} -->
<p>Rendered responsive</p>
<!-- /wp:paragraph -->`,
		} );

		const response = await page.request.get( `/?p=${ postId }` );
		const html = await response.text();

		expect(
			html,
			'base font-size still applied (block-supports inline style)'
		).toMatch( /font-size:32px/ );

		// The shared responsive-breakpoint builder emits CSS range syntax
		// (`@media (width <= 480px)`), not legacy `max-width`. See
		// `gutenberg_build_responsive_media_queries()` in
		// `lib/block-supports/responsive-breakpoints.php`.
		expect(
			html,
			'mobile override emitted inside (width <= 480px) media query'
		).toMatch(
			/@media\s*\(\s*width\s*<=\s*480px\s*\)[^{]*\{[^}]*font-size:\s*14px/
		);
	} );
} );
