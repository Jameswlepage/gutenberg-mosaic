/**
 * WordPress dependencies
 */
import {
	Button,
	Dropdown,
	MenuItemsChoice,
	NavigableMenu,
	Icon,
} from '@wordpress/components';
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
		label: (
			<>
				<Icon icon={ edit } />
				{ __( 'Edit' ) }
			</>
		),
		info: __( 'Make direct changes to content.' ),
		'aria-label': __( 'Edit mode' ),
	},
	{
		value: 'suggest',
		label: (
			<>
				<Icon icon={ comment } />
				{ __( 'Suggest' ) }
			</>
		),
		info: __( 'Propose changes for review.' ),
		'aria-label': __( 'Suggest mode' ),
	},
];

const CollabModeSelector = forwardRef( function CollabModeSelector( 
	{ showTooltip = true, variant, size, disabled = false }, 
	ref 
) {
	const { collaborationMode } = useSelect( ( select ) => {
		return {
			collaborationMode: select( editorStore ).getCollaborationMode?.() || 'edit'
		};
	}, [] );

	const { setCollaborationMode } = useDispatch( editorStore );

	// Only show if suggestions mode experiment is enabled
	if ( ! window.__experimentalSuggestionsMode ) {
		return null;
	}

	const handleModeChange = ( newMode ) => {
		setCollaborationMode( newMode );
	};

	const currentMode = COLLABORATION_MODES.find(
		( mode ) => mode.value === collaborationMode
	);

	const currentIcon = collaborationMode === 'suggest' ? comment : edit;

	return (
		<Dropdown
			popoverProps={ { placement: 'bottom-start' } }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<Button
					size={ size }
					variant={ variant }
					ref={ ref }
					label={ showTooltip ? __( 'Collaboration tools' ) : undefined }
					showTooltip={ showTooltip }
					disabled={ disabled }
					icon={ currentIcon }
					onClick={ onToggle }
					aria-expanded={ isOpen }
					aria-haspopup="true"
				/>
			) }
			renderContent={ () => (
				<NavigableMenu role="menu" aria-label={ __( 'Collaboration modes' ) }>
					<MenuItemsChoice
						choices={ COLLABORATION_MODES }
						value={ collaborationMode }
						onSelect={ handleModeChange }
					/>
					<div className="block-editor-collab-mode-selector__help">
						{ __( 
							'Collaboration tools provide different ways to work with content. Choose between direct editing and suggestion mode for collaborative review.' 
						) }
					</div>
				</NavigableMenu>
			) }
		/>
	);
} );

export default CollabModeSelector;