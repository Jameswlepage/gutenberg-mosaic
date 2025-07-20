/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { Button, TextareaControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * ReplyToThread component displays a simplified reply form that shows send button only when focused.
 *
 * @param {Object}   props           - The component props.
 * @param {Function} props.onAddReply - Callback function to add a reply.
 * @param {number}   props.threadId   - The thread ID to reply to.
 * @return {React.ReactNode} The rendered ReplyToThread component.
 */
export function ReplyToThread({ onAddReply, threadId }) {
	const [isReplyFocused, setIsReplyFocused] = useState(false);
	const [replyText, setReplyText] = useState('');

	const handleSendReply = () => {
		if (replyText.trim()) {
			onAddReply(replyText, threadId);
			setReplyText('');
			setIsReplyFocused(false);
		}
	};

	const handleTextareaFocus = () => {
		setIsReplyFocused(true);
	};

	const handleTextareaBlur = () => {
		// Only hide send button if there's no content
		if (!replyText.trim()) {
			setIsReplyFocused(false);
		}
	};

	const handleKeyDown = (event) => {
		// Send on Ctrl/Cmd + Enter
		if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
			event.preventDefault();
			handleSendReply();
		}
	};

	return (
		<div className="editor-collab-sidebar-panel__reply-to-thread">
			<TextareaControl
				placeholder={__('Reply to thread')}
				value={replyText}
				onChange={setReplyText}
				onFocus={handleTextareaFocus}
				onBlur={handleTextareaBlur}
				onKeyDown={handleKeyDown}
				rows={2}
			/>

			{/* Send button only appears when focused/has content */}
			{(isReplyFocused || replyText.trim()) && (
				<div className="editor-collab-sidebar-panel__reply-actions">
					<Button
						variant="primary"
						size="small"
						onClick={handleSendReply}
						disabled={!replyText.trim()}
					>
						{__('Send')}
					</Button>
				</div>
			)}
		</div>
	);
}