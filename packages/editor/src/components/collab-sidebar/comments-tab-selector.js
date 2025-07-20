/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * CommentsTabSelector component for switching between open and resolved comments.
 *
 * @param {Object}   props           - The component props.
 * @param {string}   props.activeTab - The currently active tab ('open' or 'resolved').
 * @param {Function} props.onTabChange - Callback function when tab changes.
 * @return {React.ReactNode} The rendered CommentsTabSelector component.
 */
export function CommentsTabSelector({ activeTab, onTabChange }) {
	return (
		<div className="editor-collab-sidebar-panel__tab-selector">
			<Button
				variant={activeTab === 'open' ? 'primary' : 'secondary'}
				onClick={() => onTabChange('open')}
				size="small"
				className="editor-collab-sidebar-panel__tab-button"
			>
				{__('Open')}
			</Button>
			<Button
				variant={activeTab === 'resolved' ? 'primary' : 'secondary'}
				onClick={() => onTabChange('resolved')}
				size="small"
				className="editor-collab-sidebar-panel__tab-button"
			>
				{__('Resolved')}
			</Button>
		</div>
	);
}