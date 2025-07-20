/**
 * WordPress dependencies
 */
import { RawHTML } from '@wordpress/element';
import { sprintf, __ } from '@wordpress/i18n';
import { Icon, __experimentalHStack as HStack } from '@wordpress/components';
import { comment } from '@wordpress/icons';

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
			<HStack
				alignment="center"
				justify="flex-start"
				spacing="2"
				className="editor-collab-sidebar-panel__comment-header"
			>
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
				<time className="editor-collab-sidebar-panel__user-time">
					{new Date(thread.date).toLocaleTimeString([], {
						hour: 'numeric',
						minute: '2-digit',
						hour12: true,
					})}
				</time>
			</HStack>

			{/* Comment content */}
			<div className="editor-collab-sidebar-panel__comment-content">
				<RawHTML>{thread?.content?.raw}</RawHTML>
			</div>

			{/* Reply count - removed to avoid duplicate with thread's "X more replies" */}
		</div>
	);
}