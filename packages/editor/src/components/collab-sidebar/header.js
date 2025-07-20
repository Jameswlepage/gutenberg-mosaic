/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { plus, starEmpty, starFilled } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useSelect, useDispatch } from '@wordpress/data';
import { store as interfaceStore } from '@wordpress/interface';
import { store as blockEditorStore } from '@wordpress/block-editor';

/**
 * CollabSidebarHeader component
 */
export function CollabSidebarHeader({ onAddComment }) {
	const { isComplementaryAreaPinned, selectedBlockId } = useSelect((select) => {
		const { isItemPinned } = select(interfaceStore);
		const { getSelectedBlockClientId } = select(blockEditorStore);
		
		return {
			isComplementaryAreaPinned: isItemPinned('core', 'edit-post/document'),
			selectedBlockId: getSelectedBlockClientId(),
		};
	});

	const { pinItem, unpinItem } = useDispatch(interfaceStore);

	const togglePin = () => {
		if (isComplementaryAreaPinned) {
			unpinItem('core', 'edit-post/document');
		} else {
			pinItem('core', 'edit-post/document');
		}
	};

	return (
		<div className="editor-collab-sidebar-header">
			<div className="editor-collab-sidebar-header__title">
				{__('Comments')}
			</div>
			<div className="editor-collab-sidebar-header__actions">
				{selectedBlockId && (
					<Button
						icon={plus}
						size="small"
						label={__('Add comment to selected block')}
						onClick={onAddComment}
						className="editor-collab-sidebar-header__add-button"
					/>
				)}
				<Button
					icon={isComplementaryAreaPinned ? starFilled : starEmpty}
					size="small"
					label={isComplementaryAreaPinned ? __('Unpin from toolbar') : __('Pin to toolbar')}
					onClick={togglePin}
					className="editor-collab-sidebar-header__pin-button"
					isPressed={isComplementaryAreaPinned}
				/>
			</div>
		</div>
	);
}