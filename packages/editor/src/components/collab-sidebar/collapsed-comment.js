/**
 * WordPress dependencies
 */
import { RawHTML } from '@wordpress/element';
import { sprintf, __ } from '@wordpress/i18n';

/**
 * CollapsedComment component displays a minimal comment view with just name, time, content, and reply count.
 *
 * @param {Object}   props             - The component props.
 * @param {Object}   props.thread      - The comment thread object.
 * @param {Function} props.onActivate  - Callback function when comment is clicked to activate.
 * @return {React.ReactNode} The rendered CollapsedComment component.
 */
export function CollapsedComment({ thread, onActivate }) {
	return (
		<div
			onClick={() => onActivate(thread.id)}
			className="editor-collab-sidebar-panel__collapsed-comment"
		>
			{/* User info with avatar */}
			<div className="editor-collab-sidebar-panel__comment-header">
				<img
					src={ thread?.author_avatar_urls?.[ 48 ] || thread?.author_avatar_urls?.[ 24 ] }
					className="editor-collab-sidebar-panel__user-avatar"
					alt="User avatar"
					width="24"
					height="24"
				/>
				<span className="editor-collab-sidebar-panel__user-name">
					{thread.author_name}
				</span>
				<span className="editor-collab-sidebar-panel__user-time">
					{new Date(thread.date).toLocaleTimeString([], {
						hour: 'numeric',
						minute: '2-digit',
						hour12: true,
					})}
				</span>
			</div>

			{/* Comment content */}
			<div className="editor-collab-sidebar-panel__comment-content">
				<RawHTML>{thread?.content?.raw}</RawHTML>
			</div>
		</div>
	);
}