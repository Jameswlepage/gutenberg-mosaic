/**
 * WordPress dependencies
 */
import { RawHTML } from '@wordpress/element';

/**
 * MentionTextRenderer component that renders text with styled @ mentions.
 * 
 * @param {Object} props - The component props.
 * @param {string} props.content - The raw text content containing @ mentions.
 * @param {string} props.className - Additional CSS class names.
 * @return {React.ReactNode} The rendered content with styled @ mentions.
 */
export function MentionTextRenderer({ content, className = '' }) {
	if (!content) {
		return null;
	}

	// Parse @ mentions and wrap them in styled spans
	const renderWithMentions = (text) => {
		// Regex to match @ mentions (@ followed by word characters)
		const mentionRegex = /@(\w+)/g;
		
		// Split text by mentions while keeping the mentions
		const parts = text.split(mentionRegex);
		const result = [];
		
		for (let i = 0; i < parts.length; i++) {
			if (i % 2 === 0) {
				// Regular text parts
				if (parts[i]) {
					result.push(parts[i]);
				}
			} else {
				// Mention parts (the captured username)
				result.push(`<span class="mention-highlight">@${parts[i]}</span>`);
			}
		}
		
		return result.join('');
	};

	const processedContent = renderWithMentions(content);

	return (
		<div className={className}>
			<RawHTML>{processedContent}</RawHTML>
		</div>
	);
}

/**
 * Helper function to check if text contains @ mentions
 * 
 * @param {string} text - The text to check
 * @return {boolean} True if text contains @ mentions
 */
export function hasMentions(text) {
	return /@\w+/.test(text);
}