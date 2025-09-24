/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

export default function ChatSidebar( { isOpen, isExpanded = false, children } ) {

    return (
        <aside
            className={
                'editor-chat-sidebar' +
                ( isOpen ? ' is-open' : '' ) +
                ( isExpanded ? ' is-expanded' : '' )
            }
            aria-label={ __( 'Chat sidebar' ) }
            aria-hidden={ ! isOpen }
        >
            <div className="editor-chat-sidebar__content">{ children }</div>
        </aside>
    );
}
