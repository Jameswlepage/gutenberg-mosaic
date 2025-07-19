/**
 * WordPress dependencies
 */
import { DropdownMenu, MenuItemsChoice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { edit, comment } from '@wordpress/icons';
import { useSelect, useDispatch } from '@wordpress/data';
import { forwardRef } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../../store';

const COLLABORATION_MODES = [
	{
		value: 'edit',
		label: __( 'Edit' ),
		icon: edit,
	},
	{
		value: 'suggest',
		label: __( 'Suggest' ),
		icon: comment,
	},
];

const CollabModeSelector = forwardRef( function CollabModeSelector( { showTooltip = true, variant, size }, ref ) {
	// Only show if suggestions mode experiment is enabled
	if ( ! window.__experimentalSuggestionsMode ) {
		return null;
	}

	const { collaborationMode } = useSelect( ( select ) => {
		const mode = select( editorStore ).getCollaborationMode?.() || 'edit';
		return {
			collaborationMode: mode,
		};
	}, [] );

	const { setCollaborationMode } = useDispatch( editorStore );

	const handleModeChange = ( newMode ) => {
		// Update editor store
		setCollaborationMode( newMode );
		
		// When entering suggest mode, initialize suggestion capture
		if ( newMode === 'suggest' ) {
			// Initialize suggestion system
			window.gutenbergSuggestionsMode = true;
		} else {
			// Clear suggestion mode
			window.gutenbergSuggestionsMode = false;
		}
	};

	const currentMode = COLLABORATION_MODES.find(
		( mode ) => mode.value === collaborationMode
	);

	return (
		<DropdownMenu
			icon={ currentMode?.icon || edit }
			label={ __( 'Collaboration Mode' ) }
			toggleProps={ {
				variant,
				size,
				showTooltip,
				'aria-expanded': false,
				'aria-label': __( 'Select collaboration mode' ),
				ref,
			} }
			popoverProps={ {
				placement: 'bottom-start',
			} }
		>
			{ () => (
				<MenuItemsChoice
					choices={ COLLABORATION_MODES }
					value={ collaborationMode }
					onSelect={ handleModeChange }
				/>
			) }
		</DropdownMenu>
	);
} );

export default CollabModeSelector;