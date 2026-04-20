/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useCallback } from '@wordpress/element';
import { useSelect } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { useResponsiveBreakpoint } from '../components/responsive/breakpoint-context';
import { DEFAULT_BREAKPOINT } from '../components/responsive/constants';
import { computeDelta } from './responsive-utils';
import ResponsiveBlockToolbarButton from '../components/responsive/block-toolbar-button';
import { store as blockEditorStore } from '../store';

const RESPONSIVE_ATTRIBUTE = 'responsive';

/**
 * Top-level block attributes the interceptor routes per-breakpoint. `style`
 * is the nested custom-value tree. The rest are scalar preset slugs
 * (font-size, colors, gradient, font-family) that Gutenberg keeps at the top
 * level. Treating them uniformly as "responsive-routable" avoids silently
 * dropping preset picks when a non-base breakpoint is active.
 *
 * Each breakpoint entry mirrors this subset of the block's attributes:
 *   responsive.mobile = {
 *       style?:           { ... },      // style-tree deltas
 *       fontSize?:        'small',      // preset slug overrides
 *       fontFamily?:      'system',
 *       textColor?:       'primary',
 *       backgroundColor?: 'dark',
 *       gradient?:        'sunset',
 *   }
 */
const ROUTABLE_KEYS = [
	'style',
	'fontSize',
	'fontFamily',
	'textColor',
	'backgroundColor',
	'gradient',
];

function isEnabled() {
	return (
		typeof window !== 'undefined' && !! window.__experimentalResponsiveStyles
	);
}

/**
 * Register `responsive` attribute on every block, behind the flag. A block
 * can opt out by declaring `supports.responsive: false` in its block.json —
 * this is intentional: the feature is cross-cutting by default, and opting
 * out is a per-block decision (e.g. for blocks that already do their own
 * breakpoint handling).
 */
function addResponsiveAttribute( settings ) {
	if ( ! isEnabled() ) {
		return settings;
	}
	if ( settings.supports?.[ RESPONSIVE_ATTRIBUTE ] === false ) {
		return settings;
	}
	if ( settings.attributes?.[ RESPONSIVE_ATTRIBUTE ] ) {
		return settings;
	}
	return {
		...settings,
		attributes: {
			...settings.attributes,
			[ RESPONSIVE_ATTRIBUTE ]: { type: 'object' },
		},
	};
}

addFilter(
	'blocks.registerBlockType',
	'core/responsive/attribute',
	addResponsiveAttribute
);

/**
 * Wrap BlockEdit so controls that read/write `attributes.style` see the merged
 * base + current-breakpoint override, and writes get routed to
 * `attributes.responsive[ breakpoint ]` when editing a non-base breakpoint.
 *
 * Non-style attributes pass through unchanged.
 */
const withResponsiveBreakpointAttributes = createHigherOrderComponent(
	( BlockEdit ) => ( props ) => {
		const { selectedBreakpoint } = useResponsiveBreakpoint();
		const isBase = selectedBreakpoint === DEFAULT_BREAKPOINT;

		// Pull RAW attributes straight from the store. `getBlockAttributes`
		// is now breakpoint-aware (returns merged) so `props.attributes`
		// reflects the current-bp view. For diffing writes we need the
		// un-merged base — that's what this selector returns.
		const rawAttributes = useSelect(
			( select ) =>
				props.clientId
					? select(
							blockEditorStore
					  ).__experimentalGetRawBlockAttributes(
							props.clientId
					  )
					: props.attributes,
			[ props.clientId ]
		);

		const viewSetAttributes = useCallback(
			( updates ) => {
				if ( isBase || ! isEnabled() ) {
					return props.setAttributes( updates );
				}

				// Split updates into routable (diffed per-bp) and pass-through.
				const routableUpdates = {};
				const passThroughUpdates = {};
				for ( const [ key, value ] of Object.entries( updates ) ) {
					if ( ROUTABLE_KEYS.includes( key ) ) {
						routableUpdates[ key ] = value;
					} else {
						passThroughUpdates[ key ] = value;
					}
				}

				if ( Object.keys( routableUpdates ).length === 0 ) {
					return props.setAttributes( passThroughUpdates );
				}

				// Build the next breakpoint override from the existing one
				// plus the deltas for each routable key that changed — diffed
				// against RAW base, never against the merged view.
				const priorResponsive =
					rawAttributes?.[ RESPONSIVE_ATTRIBUTE ] ?? {};
				const priorBp = priorResponsive[ selectedBreakpoint ] ?? {};
				const nextBp = { ...priorBp };

				for ( const key of Object.keys( routableUpdates ) ) {
					const baseValue = rawAttributes?.[ key ];
					const nextValue = routableUpdates[ key ];

					if ( key === 'style' ) {
						const delta = computeDelta(
							baseValue ?? {},
							nextValue ?? {}
						);
						if ( delta === undefined ) {
							delete nextBp.style;
						} else {
							nextBp.style = delta;
						}
					} else if (
						nextValue === baseValue ||
						nextValue === undefined
					) {
						// Scalar preset: if matching base, there is no
						// override to record. `undefined` from the control
						// likewise means "clear at this bp, fall back to base".
						delete nextBp[ key ];
					} else {
						nextBp[ key ] = nextValue;
					}
				}

				const nextResponsive = { ...priorResponsive };
				if ( Object.keys( nextBp ).length === 0 ) {
					delete nextResponsive[ selectedBreakpoint ];
				} else {
					nextResponsive[ selectedBreakpoint ] = nextBp;
				}

				const finalUpdates = { ...passThroughUpdates };
				finalUpdates[ RESPONSIVE_ATTRIBUTE ] =
					Object.keys( nextResponsive ).length > 0
						? nextResponsive
						: undefined;
				return props.setAttributes( finalUpdates );
			},
			[
				rawAttributes,
				props.setAttributes,
				selectedBreakpoint,
				isBase,
			]
		);

		const onResetBreakpoint = useCallback(
			( bpSlug ) => {
				const priorResponsive =
					rawAttributes?.[ RESPONSIVE_ATTRIBUTE ] ?? {};
				const nextResponsive = { ...priorResponsive };
				delete nextResponsive[ bpSlug ];
				props.setAttributes( {
					[ RESPONSIVE_ATTRIBUTE ]:
						Object.keys( nextResponsive ).length > 0
							? nextResponsive
							: undefined,
				} );
			},
			[ rawAttributes, props.setAttributes ]
		);

		if ( ! isEnabled() ) {
			return <BlockEdit { ...props } />;
		}

		return (
			<>
				{ props.isSelected && (
					<ResponsiveBlockToolbarButton
						responsive={
							rawAttributes?.[ RESPONSIVE_ATTRIBUTE ]
						}
						onResetBreakpoint={ onResetBreakpoint }
					/>
				) }
				<BlockEdit
					{ ...props }
					setAttributes={ viewSetAttributes }
				/>
			</>
		);
	},
	'withResponsiveBreakpointAttributes'
);

/**
 * Registration is deliberately NOT at module scope. `createBlockEditFilter`
 * in hooks/utils.js registers `core/editor/hooks` when hooks/index.js runs;
 * that filter renders all the feature <Edit>s (typography, color, spacing…)
 * and forwards `setAttributes` straight from upstream props. For my
 * interception to reach those siblings, my filter must be added AFTER
 * core/editor/hooks so that my HOC becomes the OUTER wrapper and its
 * replaced `setAttributes` is what the feature Edits receive.
 */
export function registerResponsiveBlockEditFilter() {
	addFilter(
		'editor.BlockEdit',
		'core/responsive/breakpoint-attributes',
		withResponsiveBreakpointAttributes
	);
}

/**
 * Tag the rendered block-list item so styling can paint a corner indicator
 * when a block has any responsive overrides. Pure visual signal; no behavior
 * change.
 */
const withResponsiveBlockClassName = createHigherOrderComponent(
	( BlockListBlock ) => ( props ) => {
		if ( ! isEnabled() ) {
			return <BlockListBlock { ...props } />;
		}
		const responsive = props.attributes?.[ RESPONSIVE_ATTRIBUTE ];
		if ( ! responsive || Object.keys( responsive ).length === 0 ) {
			return <BlockListBlock { ...props } />;
		}
		const breakpoints = Object.keys( responsive ).filter(
			( bp ) => responsive[ bp ] && Object.keys( responsive[ bp ] ).length > 0
		);
		if ( breakpoints.length === 0 ) {
			return <BlockListBlock { ...props } />;
		}
		const extraClasses = [
			'has-responsive-overrides',
			...breakpoints.map( ( bp ) => `has-responsive-overrides--${ bp }` ),
		].join( ' ' );
		const wrapperClassName = props.className
			? `${ props.className } ${ extraClasses }`
			: extraClasses;
		return <BlockListBlock { ...props } className={ wrapperClassName } />;
	},
	'withResponsiveBlockClassName'
);

addFilter(
	'editor.BlockListBlock',
	'core/responsive/block-classname',
	withResponsiveBlockClassName
);
