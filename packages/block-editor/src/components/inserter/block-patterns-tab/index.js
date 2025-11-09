/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { useViewportMatch } from '@wordpress/compose';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import PatternsExplorerModal from '../block-patterns-explorer';
import { PatternCategoryPreviews } from './pattern-category-previews';
import { usePatternCategories } from './use-pattern-categories';
import PatternCategoryAccordion from './pattern-category-accordion';
import CategoryTabs from '../category-tabs';
import InserterNoResults from '../no-results';

function BlockPatternsTab( {
	onSelectCategory,
	selectedCategory,
	onInsert,
	rootClientId,
	children,
} ) {
	const [ showPatternsExplorer, setShowPatternsExplorer ] = useState( false );

	const categories = usePatternCategories( rootClientId );

	// Use dual-panel layout for very large screens (>=1920px)
	const isVeryLargeViewport = useViewportMatch( 'xhuge', '>=' );

	if ( ! categories.length ) {
		return <InserterNoResults />;
	}

	return (
		<>
			{ isVeryLargeViewport ? (
				<div className="block-editor-inserter__block-patterns-tabs-container">
					<CategoryTabs
						categories={ categories }
						selectedCategory={ selectedCategory }
						onSelectCategory={ onSelectCategory }
					>
						{ children }
					</CategoryTabs>
					<Button
						__next40pxDefaultSize
						className="block-editor-inserter__patterns-explore-button"
						onClick={ () => setShowPatternsExplorer( true ) }
						variant="secondary"
					>
						{ __( 'Explore all patterns' ) }
					</Button>
				</div>
			) : (
				<div className="block-editor-inserter__pattern-accordion-wrapper">
					<PatternCategoryAccordion
						categories={ categories }
						selectedCategory={ selectedCategory }
						onSelectCategory={ onSelectCategory }
						rootClientId={ rootClientId }
						onInsert={ onInsert }
						onShowPatternsExplorer={ () => setShowPatternsExplorer( true ) }
						suggestedCount={ 5 }
					/>
				</div>
			) }
			{ showPatternsExplorer && (
				<PatternsExplorerModal
					initialCategory={ selectedCategory || categories[ 0 ] }
					patternCategories={ categories }
					onModalClose={ () => setShowPatternsExplorer( false ) }
					rootClientId={ rootClientId }
				/>
			) }
		</>
	);
}

export default BlockPatternsTab;
