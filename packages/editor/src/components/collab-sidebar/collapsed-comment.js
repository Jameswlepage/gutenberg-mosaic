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
			{/* User name and time only */}
			<div className="editor-collab-sidebar-panel__comment-header">
				<span className="editor-collab-sidebar-panel__user-name">
					{thread.author_name}
				</span>
				<time className="editor-collab-sidebar-panel__user-time">
					{new Date(thread.date).toLocaleTimeString([], {
						hour: 'numeric',
						minute: '2-digit',
						hour12: true,
					})}
				</time>
			</div>

			{/* Comment content */}
			<div className="editor-collab-sidebar-panel__comment-content">
				<RawHTML>{thread?.content?.raw}</RawHTML>
			</div>

			{/* Reply count */}
			{thread.reply?.length > 0 && (
				<div className="editor-collab-sidebar-panel__reply-count">
					{sprintf(
						// translators: %d: number of replies
						__('%d replies'),
						thread.reply.length
					)}
				</div>
			)}
		</div>
	);
}