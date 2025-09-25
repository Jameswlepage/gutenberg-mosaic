/**
 * WordPress dependencies
 */
import { Icon, Tooltip, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { closeSmall, arrowUp, image } from '@wordpress/icons';
import { BlockIcon } from '@wordpress/block-editor';
import { BlockTitle } from '@wordpress/block-editor';

export default function InputArea({
  isExpanded,
  isStudio,
  tool,
  inputRef,
  selectedClientId,
  selectedIcon,
  clearSelectedBlock,
  value,
  onChange,
  onSubmit,
  isLoading,
}) {
  return (
    <div className="editor-chat-sidebar__input">
      { tool === 'annotate' && isExpanded && isStudio && (
        <div className="editor-chat-sidebar__notice" role="status" aria-live="polite">
          { __( 'ANNOTATIONS WILL FACTOR INTO IMAGE CHANGES' ) }
        </div>
      ) }

      { selectedClientId && ! ( isExpanded && isStudio ) && tool !== 'annotate' && (
        <Tooltip text={ __( 'The AI will focus more on this selection' ) }>
          <div className="editor-chat-sidebar__selection" aria-live="polite">
            { selectedIcon ? (
              <span className="editor-chat-sidebar__selection-icon">
                <BlockIcon icon={ selectedIcon } />
              </span>
            ) : null }
            <span className="editor-chat-sidebar__selection-label">
              <BlockTitle clientId={ selectedClientId } maximumLength={ 80 } context="list-view" />
            </span>
            <button
              type="button"
              className="editor-chat-sidebar__selection-clear"
              aria-label={ __( 'Deselect block' ) }
              onClick={ () => clearSelectedBlock() }
            >
              <Icon icon={ closeSmall } />
            </button>
          </div>
        </Tooltip>
      ) }

      <div className="editor-chat-sidebar__input-wrap" ref={ inputRef }>
        <input
          type="text"
          className="editor-chat-sidebar__text"
          placeholder={
            isExpanded && isStudio
              ? __( 'How would you like to modify this image?' )
              : __( 'Write your prompt' )
          }
          value={ value }
          onChange={ (e) => onChange?.( e.target.value ) }
          onKeyDown={ (e) => {
            if ( e.key === 'Enter' && ! isLoading ) onSubmit?.();
          } }
        />
        { isExpanded && isStudio && (
          <Tooltip text={ __( 'Attach Images for Reference' ) }>
            <button
              type="button"
              className="editor-chat-sidebar__attach"
              aria-label={ __( 'Attach Images for Reference' ) }
              onClick={ () => {} }
            >
              <Icon icon={ image } />
            </button>
          </Tooltip>
        ) }
        <button
          type="button"
          className="editor-chat-sidebar__submit"
          aria-label={ __( 'Submit' ) }
          disabled={ isLoading }
          onClick={ () => onSubmit?.() }
        >
          { isLoading ? <Spinner /> : <Icon icon={ arrowUp } /> }
        </button>
      </div>
    </div>
  );
}
