/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useSelect } from '@wordpress/data';
import { RichText } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import { store as editorStore } from '../store';
import { useSuggestionCapture } from '../components/suggestion-capture';
import { withInlinePreview } from '../components/suggestion-inline-preview';
import { generateDiffVisualization } from '../components/suggestion-data-structures';

/**
 * Higher-order component that adds suggestion capture to paragraph blocks
 * when in suggestion mode.
 */
const withSuggestionCaptureIntegration = createHigherOrderComponent(
	( BlockEdit ) => ( props ) => {
		const { name, clientId } = props;
		
		const { collaborationMode } = useSelect( ( select ) => {
			return {
				collaborationMode: select( editorStore ).getCollaborationMode(),
			};
		}, [] );

		// Always call hooks in the same order - this fixes the hooks order violation
		const isParagraphBlock = name === 'core/paragraph';
		const isSuggestionMode = collaborationMode === 'suggest';
		const shouldCapture = isParagraphBlock && isSuggestionMode;

		// Always initialize suggestion capture (it will be inactive if not needed)
		useSuggestionCapture( shouldCapture ? clientId : null );

		// Only apply wrapper to paragraph blocks in suggestion mode
		if ( ! shouldCapture ) {
			return <BlockEdit { ...props } />;
		}

		// Wrap the block edit component with inline preview
		const BlockEditWithPreview = withInlinePreview( BlockEdit );
		
		return <BlockEditWithPreview { ...props } />;
	},
	'withSuggestionCaptureIntegration'
);

/**
 * Filters the block edit component to add suggestion capture functionality
 * for paragraph blocks when in suggestion mode.
 */
addFilter(
	'editor.BlockEdit',
	'core/editor/suggestion-capture',
	withSuggestionCaptureIntegration,
	20
);

/**
 * Adds suggestion-specific CSS classes to block list blocks
 */
const addSuggestionCaptureClasses = createHigherOrderComponent(
	( BlockListBlock ) => ( props ) => {
		const { block } = props;
		
		const { collaborationMode } = useSelect( ( select ) => {
			return {
				collaborationMode: select( editorStore ).getCollaborationMode(),
			};
		}, [] );

		// Only add classes to paragraph blocks in suggestion mode
		if ( block.name !== 'core/paragraph' || collaborationMode !== 'suggest' ) {
			return <BlockListBlock { ...props } />;
		}

		// Add subtle suggestion mode classes that don't interfere with block styling
		const className = [
			props.className,
			'editor-suggestion-capture-active',
		].filter( Boolean ).join( ' ' );

		return <BlockListBlock { ...props } className={ className } />;
	},
	'addSuggestionCaptureClasses'
);

/**
 * Filters the block list block to add suggestion-specific classes
 */
addFilter(
	'editor.BlockListBlock',
	'core/editor/suggestion-capture-classes',
	addSuggestionCaptureClasses,
	20
);

// Remove the old diff renderer that polluted block attributes
// This has been replaced by the visual overlay system