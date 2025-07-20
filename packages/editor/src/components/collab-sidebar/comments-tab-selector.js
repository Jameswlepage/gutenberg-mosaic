/**
 * WordPress dependencies
 */
import { TabPanel } from '@wordpress/components';
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
	const tabs = [
		{
			name: 'open',
			title: __('Open'),
		},
		{
			name: 'resolved',
			title: __('Resolved'),
		},
	];

	return (
		<div className="editor-collab-sidebar-panel__tab-selector">
			<TabPanel
				className="editor-collab-sidebar-panel__tab-panel"
				activeClass="is-active"
				tabs={tabs}
				initialTabName={activeTab}
				onSelect={onTabChange}
			>
				{() => null /* Content is handled by parent component */}
			</TabPanel>
		</div>
	);
}