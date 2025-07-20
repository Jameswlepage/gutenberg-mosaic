/**
 * WordPress dependencies
 */
import { TextareaControl } from '@wordpress/components';
import { useState, useCallback } from '@wordpress/element';

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

	const handleChange = useCallback((newValue) => {
		// TODO: Future enhancement - detect @ mentions
		// const mentionRegex = /@(\w+)/g;
		// const matches = newValue.match(mentionRegex);
		// if (matches) {
		//     // Fetch user suggestions based on partial match
		//     // setSuggestions(filteredUsers);
		//     // setShowSuggestions(true);
		// } else {
		//     setShowSuggestions(false);
		// }

		onChange(newValue);
	}, [onChange]);

	const handleKeyDown = useCallback((event) => {
		// TODO: Future enhancement - handle suggestion navigation
		// if (showSuggestions) {
		//     if (event.key === 'ArrowDown') {
		//         // Navigate down in suggestions
		//         event.preventDefault();
		//     } else if (event.key === 'ArrowUp') {
		//         // Navigate up in suggestions
		//         event.preventDefault();
		//     } else if (event.key === 'Enter') {
		//         // Select current suggestion
		//         event.preventDefault();
		//     } else if (event.key === 'Escape') {
		//         // Hide suggestions
		//         setShowSuggestions(false);
		//     }
		// }

		// Call parent's onKeyDown if provided
		if (otherProps.onKeyDown) {
			otherProps.onKeyDown(event);
		}
	}, [showSuggestions, otherProps]);

	return (
		<div className="mention-textarea-control-wrapper">
			<TextareaControl
				value={value}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				rows={rows}
				{...otherProps}
			/>
			
			{/* TODO: Future enhancement - suggestions dropdown */}
			{/* {showSuggestions && suggestions.length > 0 && (
				<div className="mention-suggestions-dropdown">
					{suggestions.map((suggestion, index) => (
						<div
							key={suggestion.id}
							className="mention-suggestion-item"
							onClick={() => handleSelectSuggestion(suggestion)}
						>
							<img src={suggestion.avatar} alt={suggestion.name} />
							<span>{suggestion.name}</span>
							<span className="mention-username">@{suggestion.username}</span>
						</div>
					))}
				</div>
			)} */}
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