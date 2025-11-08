/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { external } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import CategoryAccordionItem from './category-accordion-item';

function PatternCategoryAccordion( {
	categories,
	selectedCategory,
	onSelectCategory,
	rootClientId,
	onInsert,
	onShowPatternsExplorer,
	suggestedCount = 5,
} ) {
	const [ showAllCategories, setShowAllCategories ] = useState( false );

	const suggestedCategories = categories.slice( 0, suggestedCount );
	const remainingCategories = categories.slice( suggestedCount );
	const hasRemainingCategories = remainingCategories.length > 0;

	const handleToggle = ( category ) => {
		// If clicking the currently expanded category, collapse it
		if ( selectedCategory?.name === category.name ) {
			onSelectCategory( null );
		} else {
			// Otherwise expand the clicked category
			onSelectCategory( category );
		}
	};

	return (
		<div className="block-editor-inserter__pattern-accordion-wrapper">
			<div className="block-editor-inserter__pattern-accordion">
				{ suggestedCategories.map( ( category ) => (
					<CategoryAccordionItem
						key={ category.name }
						category={ category }
						isExpanded={ selectedCategory?.name === category.name }
						onToggle={ handleToggle }
						rootClientId={ rootClientId }
						onInsert={ onInsert }
					/>
				) ) }

				{ hasRemainingCategories && showAllCategories && (
					<>
						{ remainingCategories.map( ( category ) => (
							<CategoryAccordionItem
								key={ category.name }
								category={ category }
								isExpanded={
									selectedCategory?.name === category.name
								}
								onToggle={ handleToggle }
								rootClientId={ rootClientId }
								onInsert={ onInsert }
							/>
						) ) }
					</>
				) }
			</div>
			<PatternAccordionFooter
				hasRemainingCategories={ hasRemainingCategories }
				showAllCategories={ showAllCategories }
				onToggleCategories={ () => setShowAllCategories( ! showAllCategories ) }
				remainingCategoriesCount={ remainingCategories.length }
				onShowPatternsExplorer={ onShowPatternsExplorer }
			/>
		</div>
	);
}

function PatternAccordionFooter( {
	hasRemainingCategories,
	showAllCategories,
	onToggleCategories,
	remainingCategoriesCount,
	onShowPatternsExplorer,
} ) {
	return (
		<div className="block-editor-inserter__pattern-accordion-footer">
			<div className="block-editor-inserter__pattern-accordion-footer-content">
				<div className="block-editor-inserter__pattern-accordion-footer-actions">
					{ hasRemainingCategories && (
						<Button
							__next40pxDefaultSize
							variant="secondary"
							onClick={ onToggleCategories }
							className="block-editor-inserter__show-more-categories-button"
						>
							{ showAllCategories
								? __( 'Show fewer categories' )
								: sprintf(
									__( 'Show %d more' ),
									remainingCategoriesCount
								) }
						</Button>
					) }
					<Button
						__next40pxDefaultSize
						icon={ external }
						variant="secondary"
						onClick={ onShowPatternsExplorer }
						className="block-editor-inserter__patterns-explore-icon-button"
						label={ __( 'Explore all patterns' ) }
					/>
				</div>
				<p className="block-editor-inserter__pattern-accordion-footer-help">
					{ __( 'Drag and drop patterns into the canvas.' ) }
				</p>
			</div>
		</div>
	);
}

export default PatternCategoryAccordion;
