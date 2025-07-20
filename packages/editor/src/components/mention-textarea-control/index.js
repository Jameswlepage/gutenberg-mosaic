/**
 * WordPress dependencies
 */
import { TextareaControl } from '@wordpress/components';
import { useState, useCallback, useRef, useEffect } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';

/**
 * MentionTextareaControl component that extends TextareaControl to support @ mentions.
 * 
 * This component is designed to be enhanced in the future with:
 * - @ mention detection
 * - User suggestion dropdown
 * - @ mention formatting and parsing
 * 
 * @param {Object}   props             - The component props.
 * @param {string}   props.value       - The textarea value.
 * @param {Function} props.onChange    - Callback function when value changes.
 * @param {string}   props.placeholder - Placeholder text.
 * @param {number}   props.rows        - Number of rows for textarea.
 * @param {Object}   ...otherProps     - Additional props passed to TextareaControl.
 * @return {React.ReactNode} The rendered MentionTextareaControl component.
 */
export function MentionTextareaControl({ 
	value, 
	onChange, 
	placeholder = '', 
	rows = 2,
	...otherProps 
}) {
	const [suggestions, setSuggestions] = useState([]);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [selectedSuggestion, setSelectedSuggestion] = useState(0);
	const [currentMention, setCurrentMention] = useState(null);
	const textareaRef = useRef();

	// Get users from WordPress
	const { users } = useSelect( ( select ) => {
		return {
			users: select( coreStore ).getUsers() || [],
		};
	}, [] );

	const handleChange = useCallback((newValue) => {
		// Detect @ mentions
		const cursorPosition = textareaRef.current?.selectionStart || newValue.length;
		const textBeforeCursor = newValue.substring(0, cursorPosition);
		const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
		
		if (mentionMatch) {
			const searchTerm = mentionMatch[1].toLowerCase();
			let filteredUsers;
			
			if (searchTerm === '') {
				// If just @ with no characters, show all users
				filteredUsers = users.slice(0, 5);
			} else {
				// Filter by search term
				filteredUsers = users.filter(user => 
					user.name.toLowerCase().includes(searchTerm) ||
					user.slug.toLowerCase().includes(searchTerm)
				).slice(0, 5);
			}
			
			setCurrentMention({
				startPos: mentionMatch.index,
				searchTerm: searchTerm,
				fullMatch: mentionMatch[0]
			});
			setSuggestions(filteredUsers);
			setShowSuggestions(filteredUsers.length > 0);
			setSelectedSuggestion(0);
		} else {
			setShowSuggestions(false);
			setCurrentMention(null);
		}

		onChange(newValue);
	}, [onChange, users]);

	const handleSelectSuggestion = useCallback((user) => {
		if (!currentMention) return;
		
		const beforeMention = value.substring(0, currentMention.startPos);
		const afterMention = value.substring(textareaRef.current?.selectionStart || value.length);
		const newValue = beforeMention + `@${user.slug} ` + afterMention;
		
		onChange(newValue);
		setShowSuggestions(false);
		setCurrentMention(null);
		
		// Focus back to textarea
		setTimeout(() => {
			if (textareaRef.current) {
				const newCursorPos = beforeMention.length + user.slug.length + 2;
				textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
				textareaRef.current.focus();
			}
		}, 0);
	}, [value, onChange, currentMention]);

	const handleKeyDown = useCallback((event) => {
		if (showSuggestions && suggestions.length > 0) {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				setSelectedSuggestion((prev) => 
					prev < suggestions.length - 1 ? prev + 1 : 0
				);
				return; // Don't call parent's onKeyDown
			} else if (event.key === 'ArrowUp') {
				event.preventDefault();
				setSelectedSuggestion((prev) => 
					prev > 0 ? prev - 1 : suggestions.length - 1
				);
				return; // Don't call parent's onKeyDown
			} else if (event.key === 'Enter') {
				event.preventDefault();
				event.stopPropagation();
				handleSelectSuggestion(suggestions[selectedSuggestion]);
				return; // Don't call parent's onKeyDown
			} else if (event.key === 'Tab') {
				event.preventDefault();
				handleSelectSuggestion(suggestions[selectedSuggestion]);
				return; // Don't call parent's onKeyDown
			} else if (event.key === 'Escape') {
				event.preventDefault();
				setShowSuggestions(false);
				return; // Don't call parent's onKeyDown
			}
		}

		// Call parent's onKeyDown if provided (only if we didn't handle the key above)
		if (otherProps.onKeyDown) {
			otherProps.onKeyDown(event);
		}
	}, [showSuggestions, suggestions, selectedSuggestion, handleSelectSuggestion, otherProps]);

	const createHighlightedText = () => {
		if (!value) return '';
		
		// Replace @ mentions with styled versions for the highlight overlay
		return value.replace(/@(\w+)/g, '<span class="mention-highlight-input">@$1</span>');
	};

	return (
		<div className="mention-textarea-control-wrapper">
			{/* Hidden div that mirrors textarea for highlighting */}
			<div 
				className="mention-highlight-overlay"
				dangerouslySetInnerHTML={{ __html: createHighlightedText() }}
				style={{
					whiteSpace: 'pre-wrap',
					wordWrap: 'break-word',
					position: 'absolute',
					top: 0,
					left: 0,
					width: '100%',
					height: '100%',
					pointerEvents: 'none',
					zIndex: 1,
					padding: '8px', // Match TextareaControl padding
					fontSize: '13px', // Match TextareaControl font size
					lineHeight: '1.4',
					fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
					border: '1px solid transparent', // Match border to align properly
					borderRadius: '2px',
					color: 'transparent', // Hide the regular text
					overflow: 'hidden'
				}}
			/>
			<TextareaControl
				ref={textareaRef}
				value={value}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				rows={rows}
				style={{
					position: 'relative',
					zIndex: 2,
					background: 'transparent',
					color: '#1e1e1e' // Ensure regular text is visible
				}}
				{...otherProps}
			/>
			
			{showSuggestions && suggestions.length > 0 && (
				<div className="mention-suggestions-dropdown">
					{suggestions.map((suggestion, index) => (
						<div
							key={suggestion.id}
							className={`mention-suggestion-item ${
								index === selectedSuggestion ? 'is-selected' : ''
							}`}
							onClick={() => handleSelectSuggestion(suggestion)}
							onMouseEnter={() => setSelectedSuggestion(index)}
						>
							<img 
								src={suggestion.avatar_urls?.['24'] || suggestion.avatar_urls?.['48']} 
								alt={suggestion.name}
								width="24"
								height="24"
							/>
							<span className="mention-name">{suggestion.name}</span>
							<span className="mention-username">@{suggestion.slug}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

/**
 * Helper function to parse @ mentions from text (for future use)
 * 
 * @param {string} text - The text to parse
 * @return {Array} Array of mention objects
 */
export function parseMentions(text) {
	const mentionRegex = /@(\w+)/g;
	const mentions = [];
	let match;

	while ((match = mentionRegex.exec(text)) !== null) {
		mentions.push({
			username: match[1],
			start: match.index,
			end: match.index + match[0].length,
			fullMatch: match[0]
		});
	}

	return mentions;
}

/**
 * Helper function to format text with @ mentions (for future use)
 * 
 * @param {string} text - The text to format
 * @param {Array}  mentions - Array of mention objects with user data
 * @return {string} Formatted text with mention IDs or other formatting
 */
export function formatMentionsForSave(text, mentions = []) {
	// TODO: Future enhancement - replace @username with user IDs or other format
	// Example: Replace "@johndoe" with "@[user:123:johndoe]"
	return text;
}