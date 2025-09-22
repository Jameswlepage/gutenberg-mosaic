export default function ChatSidebar() {
	if ( ! globalThis.__experimentalChatSidebar ) {
		return null;
	}

	return (
		<div role="region" aria-label="Chat Sidebar" style={ { padding: 12 } }>
			<strong>Chat sidebar</strong>
			<div style={ { marginTop: 8, opacity: 0.7 } }>
				Coming soon: in-editor chat and assistance.
			</div>
		</div>
	);
}
