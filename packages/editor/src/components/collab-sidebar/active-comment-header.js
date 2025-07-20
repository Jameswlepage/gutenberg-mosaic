/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { __experimentalHStack as HStack } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * ActiveCommentHeader component displays header actions for active comments.
 *
 * @param {Object}   props           - The component props.
 * @param {Object}   props.thread    - The comment thread object.
 * @param {Function} props.onResolve - Callback function to resolve comment.
 * @param {Function} props.onDelete  - Callback function to delete comment.
 * @param {boolean}  props.canEdit   - Whether user can edit this comment.
 * @param {boolean}  props.canDelete - Whether user can delete this comment.
 * @return {React.ReactNode} The rendered ActiveCommentHeader component.
 */
export function ActiveCommentHeader({ thread, onResolve, onDelete, canEdit, canDelete }) {
	// Don't render header if no actions are available
	if (!onResolve && !canDelete && thread.parent !== 0) {
		return null;
	}

	return (
		<div className="editor-collab-sidebar-panel__active-header">
			<HStack justify="flex-start" spacing="2">
				{/* Always show resolve for main comments that aren't resolved yet */}
				{thread.parent === 0 && onResolve && thread.status !== 'approved' && (
					<Button
						size="small"
						variant="link"
						onClick={() => onResolve(thread.id)}
						className="editor-collab-sidebar-panel__header-action-resolve"
					>
						{__('Resolve')}
					</Button>
				)}

				{/* Show delete if user has permission */}
				{canDelete && (
					<Button
						size="small"
						variant="link"
						isDestructive
						onClick={() => onDelete(thread.id)}
						className="editor-collab-sidebar-panel__header-action-delete"
					>
						{__('Delete')}
					</Button>
				)}
			</HStack>
		</div>
	);
}