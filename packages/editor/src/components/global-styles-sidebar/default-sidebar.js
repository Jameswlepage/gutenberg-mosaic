/**
 * WordPress dependencies
 */
import {
	ComplementaryArea,
	ComplementaryAreaMoreMenuItem,
} from '@wordpress/interface';

export default function DefaultSidebar( {
    className,
    identifier,
    title,
    icon,
    children,
    closeLabel,
    header,
    headerClassName,
    panelClassName,
    isActiveByDefault,
    scope = 'core',
    isPinnable = true,
    showMenuItem = true,
} ) {
    return (
        <>
            <ComplementaryArea
                className={ className }
                scope={ scope }
                identifier={ identifier }
                title={ title }
                icon={ icon }
                closeLabel={ closeLabel }
                header={ header }
                headerClassName={ headerClassName }
                panelClassName={ panelClassName }
                isPinnable={ isPinnable }
                isActiveByDefault={ isActiveByDefault }
            >
                { children }
            </ComplementaryArea>
            { showMenuItem && (
                <ComplementaryAreaMoreMenuItem
                    scope={ scope }
                    identifier={ identifier }
                    icon={ icon }
                >
                    { title }
                </ComplementaryAreaMoreMenuItem>
            ) }
        </>
    );
}
