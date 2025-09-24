/**
 * WordPress dependencies
 */
import { Button, Icon } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { fullscreen, closeSmall } from '@wordpress/icons';

export default function ChatSidebar( {
    isOpen,
    isExpanded = false,
    onToggleExpand,
    onClose,
    children,
} ) {

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
            {/* Controls overlay */}
            { isOpen && (
                <div className="editor-chat-sidebar__controls">
                    { ! isExpanded ? (
                        <Button
                            className="editor-chat-sidebar__control editor-chat-sidebar__control--expand"
                            label={ __( 'Enter full screen' ) }
                            icon={ <Icon icon={ fullscreen } /> }
                            onClick={ onToggleExpand }
                        />
                    ) : (
                        <Button
                            className="editor-chat-sidebar__control editor-chat-sidebar__control--close"
                            label={ __( 'Close chat' ) }
                            icon={ <Icon icon={ closeSmall } /> }
                            onClick={ onClose }
                        />
                    ) }
                </div>
            ) }
            <div className="editor-chat-sidebar__content">{ children }</div>
        </aside>
    );
}
