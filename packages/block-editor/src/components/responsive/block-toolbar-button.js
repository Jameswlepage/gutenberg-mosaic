/**
 * WordPress dependencies
 */
import {
	Button,
	Dropdown,
	ToolbarButton,
	ToolbarGroup,
	MenuGroup,
	__experimentalHStack as HStack,
	__experimentalText as Text,
} from '@wordpress/components';
import { __, sprintf, _n } from '@wordpress/i18n';
import { desktop as desktopIcon, closeSmall } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import BlockControls from '../block-controls';
import { useResponsiveBreakpoint } from './breakpoint-context';
import { RESPONSIVE_BREAKPOINTS, DEFAULT_BREAKPOINT } from './constants';

function countOverrides( tree ) {
	if ( ! tree || typeof tree !== 'object' ) {
		return 0;
	}
	let n = 0;
	for ( const value of Object.values( tree ) ) {
		if ( value && typeof value === 'object' && ! Array.isArray( value ) ) {
			n += countOverrides( value );
		} else if ( value !== undefined ) {
			n += 1;
		}
	}
	return n;
}

/**
 * Block-toolbar affordance surfaced when a block carries any responsive
 * overrides. Mirrors the Figma "status pill" pattern: a compact icon that
 * expands into a menu of the breakpoints with overrides, with jump-to-bp
 * and per-bp reset actions.
 */
export default function ResponsiveBlockToolbarButton( {
	responsive,
	onResetBreakpoint,
} ) {
	const { selectedBreakpoint, setSelectedBreakpoint } =
		useResponsiveBreakpoint();

	if ( ! responsive ) {
		return null;
	}

	const entries = Object.entries( responsive ).filter(
		( [ , tree ] ) => tree && Object.keys( tree ).length > 0
	);

	if ( entries.length === 0 ) {
		return null;
	}

	return (
		<BlockControls group="other">
			<ToolbarGroup>
				<Dropdown
					popoverProps={ { placement: 'bottom-start' } }
					renderToggle={ ( { isOpen, onToggle } ) => (
						<ToolbarButton
							icon={
								RESPONSIVE_BREAKPOINTS[ selectedBreakpoint ]
									?.icon ?? desktopIcon
							}
							label={ sprintf(
								/* translators: %d: number of breakpoints with overrides. */
								_n(
									'Responsive overrides (%d)',
									'Responsive overrides (%d)',
									entries.length
								),
								entries.length
							) }
							aria-expanded={ isOpen }
							onClick={ onToggle }
							className="block-editor-responsive-toolbar-button"
						/>
					) }
					renderContent={ ( { onClose } ) => (
						<MenuGroup
							label={ __( 'Responsive overrides' ) }
							className="block-editor-responsive-toolbar-button__menu"
						>
							{ entries.map( ( [ bpSlug, bpTree ] ) => {
								const bpMeta =
									RESPONSIVE_BREAKPOINTS[ bpSlug ];
								if ( ! bpMeta ) {
									return null;
								}
								const count = countOverrides( bpTree );
								return (
									<HStack
										key={ bpSlug }
										spacing={ 1 }
										alignment="center"
										className="block-editor-responsive-toolbar-button__row"
									>
										<Button
											icon={ bpMeta.icon }
											className="block-editor-responsive-toolbar-button__row-switch"
											onClick={ () => {
												setSelectedBreakpoint(
													bpSlug
												);
												onClose();
											} }
										>
											<span className="block-editor-responsive-toolbar-button__row-label">
												{ bpMeta.label }
											</span>
											<Text
												variant="muted"
												className="block-editor-responsive-toolbar-button__row-count"
											>
												{ sprintf(
													/* translators: %d: number of overridden properties. */
													_n(
														'%d override',
														'%d overrides',
														count
													),
													count
												) }
											</Text>
										</Button>
										<Button
											icon={ closeSmall }
											iconSize={ 20 }
											size="small"
											label={ sprintf(
												/* translators: %s: breakpoint label (e.g. Mobile). */
												__( 'Reset %s overrides' ),
												bpMeta.label
											) }
											onClick={ () =>
												onResetBreakpoint( bpSlug )
											}
											className="block-editor-responsive-toolbar-button__row-reset"
										/>
									</HStack>
								);
							} ) }
							{ selectedBreakpoint !== DEFAULT_BREAKPOINT && (
								<Button
									icon={
										RESPONSIVE_BREAKPOINTS.desktop.icon
									}
									className="block-editor-responsive-toolbar-button__back"
									onClick={ () => {
										setSelectedBreakpoint(
											DEFAULT_BREAKPOINT
										);
										onClose();
									} }
								>
									{ __( 'Back to Desktop' ) }
								</Button>
							) }
						</MenuGroup>
					) }
				/>
			</ToolbarGroup>
		</BlockControls>
	);
}
