/**
 * WordPress dependencies
 */
import { useSelect, useDispatch } from '@wordpress/data';
import {
	Button,
	__experimentalHStack as HStack,
	__experimentalVStack as VStack,
	__experimentalText as Text,
	Notice,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { store as blockEditorStore } from '../../store';
import { useResponsiveBreakpoint } from './breakpoint-context';
import { RESPONSIVE_BREAKPOINTS, DEFAULT_BREAKPOINT } from './constants';

/**
 * Flatten an override bundle into dot-path leaves. Handles both the nested
 * `style` tree and the scalar preset keys (fontSize, textColor, etc.) at the
 * top level of the bundle.
 *
 * Example:
 *   { style: { typography: { fontSize: '14px' } }, fontSize: 'small' }
 * →
 *   [ { path: 'style.typography.fontSize', value: '14px' },
 *     { path: 'fontSize', value: 'small' } ]
 */
function collectOverridePaths( tree, prefix = '' ) {
	if ( ! tree || typeof tree !== 'object' ) {
		return [];
	}
	return Object.entries( tree ).flatMap( ( [ key, value ] ) => {
		const path = prefix ? `${ prefix }.${ key }` : key;
		if ( value && typeof value === 'object' && ! Array.isArray( value ) ) {
			return collectOverridePaths( value, path );
		}
		return [ { path, value } ];
	} );
}

/**
 * Translate the attribute-path into something a content author can read.
 * Keeps the dot-notation approachable ("spacing.padding") but strips the
 * implementation prefix ("style.") and humanizes scalar presets.
 */
function labelForPath( path ) {
	return path.replace( /^style\./, '' );
}

/**
 * Remove a single dot-path from a nested tree, pruning empty subtrees.
 */
function removePath( tree, path ) {
	if ( ! tree || ! path ) {
		return tree;
	}
	const [ head, ...rest ] = path.split( '.' );
	if ( rest.length === 0 ) {
		const { [ head ]: _removed, ...remainder } = tree;
		return remainder;
	}
	const child = removePath( tree[ head ], rest.join( '.' ) );
	const next = { ...tree, [ head ]: child };
	if ( ! child || Object.keys( child ).length === 0 ) {
		delete next[ head ];
	}
	return next;
}

/**
 * Inspector panel listing overrides for the current editing breakpoint,
 * with per-row reset and a reset-all action. Renders nothing at base.
 */
export default function ResponsiveOverridesPanel( { clientId } ) {
	const { selectedBreakpoint } = useResponsiveBreakpoint();
	const isBase = selectedBreakpoint === DEFAULT_BREAKPOINT;

	const responsive = useSelect(
		( select ) =>
			// Raw read — the merged view from `getBlockAttributes` would hide
			// the shape of the override tree, which is exactly what this
			// panel is supposed to display.
			select( blockEditorStore ).__experimentalGetRawBlockAttributes(
				clientId
			)?.responsive,
		[ clientId ]
	);

	const { updateBlockAttributes } = useDispatch( blockEditorStore );

	if ( isBase ) {
		return null;
	}

	const bpMeta = RESPONSIVE_BREAKPOINTS[ selectedBreakpoint ];
	const overrides = responsive?.[ selectedBreakpoint ];
	const paths = collectOverridePaths( overrides );

	if ( paths.length === 0 ) {
		return (
			<Notice
				status="info"
				isDismissible={ false }
				className="block-editor-responsive-overrides-panel"
			>
				{ sprintf(
					/* translators: %s: breakpoint label, e.g. Mobile. */
					__(
						'No overrides on %s yet. Changing any style here will create one.'
					),
					bpMeta.label
				) }
			</Notice>
		);
	}

	const resetPath = ( path ) => {
		const nextForBp = removePath( overrides, path );
		const nextResponsive = { ...responsive };
		if ( ! nextForBp || Object.keys( nextForBp ).length === 0 ) {
			delete nextResponsive[ selectedBreakpoint ];
		} else {
			nextResponsive[ selectedBreakpoint ] = nextForBp;
		}
		updateBlockAttributes( clientId, {
			responsive:
				Object.keys( nextResponsive ).length > 0
					? nextResponsive
					: undefined,
		} );
	};

	const resetAll = () => {
		const nextResponsive = { ...responsive };
		delete nextResponsive[ selectedBreakpoint ];
		updateBlockAttributes( clientId, {
			responsive:
				Object.keys( nextResponsive ).length > 0
					? nextResponsive
					: undefined,
		} );
	};

	return (
		<VStack
			spacing={ 2 }
			className="block-editor-responsive-overrides-panel"
		>
			<HStack justify="space-between" alignment="center">
				<Text weight={ 500 }>
					{ sprintf(
						/* translators: %s: breakpoint label. */
						__( '%s overrides' ),
						bpMeta.label
					) }
				</Text>
				<Button
					size="small"
					variant="tertiary"
					onClick={ resetAll }
					__next40pxDefaultSize={ false }
				>
					{ __( 'Reset all' ) }
				</Button>
			</HStack>
			<VStack spacing={ 1 }>
				{ paths.map( ( { path, value } ) => (
					<HStack
						key={ path }
						justify="space-between"
						alignment="center"
						className="block-editor-responsive-overrides-panel__row"
					>
						<Text variant="muted" size={ 12 }>
							{ labelForPath( path ) }
						</Text>
						<HStack
							spacing={ 2 }
							justify="flex-end"
							expanded={ false }
						>
							<Text variant="muted" size={ 12 }>
								{ String( value ) }
							</Text>
							<Button
								size="small"
								variant="tertiary"
								onClick={ () => resetPath( path ) }
								label={ sprintf(
									/* translators: %s: style property path. */
									__( 'Reset %s to base' ),
									path
								) }
								__next40pxDefaultSize={ false }
							>
								{ __( 'Reset' ) }
							</Button>
						</HStack>
					</HStack>
				) ) }
			</VStack>
		</VStack>
	);
}
