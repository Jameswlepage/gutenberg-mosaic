/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * CommentsTabSelector component for switching between open, resolved comments, and suggestions.
 *
 * @param {Object}   props           - The component props.
 * @param {string}   props.activeTab - The currently active tab ('open', 'resolved', or 'suggestions').
 * @param {Function} props.onTabChange - Callback function when tab changes.
 * @param {number}   props.suggestionsCount - Number of pending suggestions.
 * @return {React.ReactNode} The rendered CommentsTabSelector component.
 */
export function CommentsTabSelector({ activeTab, onTabChange, suggestionsCount = 0 }) {
	return (
		<div className="editor-collab-sidebar-panel__tab-selector">
			<div className="editor-collab-sidebar-panel__tab-switch">
				<button
					className={`editor-collab-sidebar-panel__tab-option ${activeTab === 'open' ? 'is-active' : ''}`}
					onClick={() => onTabChange('open')}
				>
					{__('Open')}
				</button>
				{window.__experimentalSuggestionsMode && (
					<button
						className={`editor-collab-sidebar-panel__tab-option ${activeTab === 'suggestions' ? 'is-active' : ''}`}
						onClick={() => onTabChange('suggestions')}
					>
						{__('Suggestions')} {suggestionsCount > 0 && `(${suggestionsCount})`}
					</button>
				)}
				<button
					className={`editor-collab-sidebar-panel__tab-option ${activeTab === 'resolved' ? 'is-active' : ''}`}
					onClick={() => onTabChange('resolved')}
				>
					{__('Resolved')}
				</button>
			</div>
		</div>
	);
}