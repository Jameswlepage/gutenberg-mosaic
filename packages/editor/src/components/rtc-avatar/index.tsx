/**
 * WordPress dependencies
 */
import type { UserInfo } from "@wordpress/sync";

import './style.scss';

type AvatarSize = 'small' | 'medium';

/**
 * Renders a circular avatar bubble for a user with an optional border.
 */
export function RTCAvatar( {
	userInfo,
	showUserColorBorder,
	size = 'small',
}: {
	userInfo: UserInfo;
	showUserColorBorder?: boolean;
	size?: AvatarSize;
} ) {
	const avatarUrl = userInfo.avatar_urls?.[ '48' ] || userInfo.avatar_urls?.[ '96' ] || userInfo.avatar_urls?.[ '24' ];

	const className = [
		'editor-rtc-avatar',
		`editor-rtc-avatar--${ size }`,
		showUserColorBorder && 'editor-rtc-avatar--with-color-border',
	]
		.filter( Boolean )
		.join( ' ' );

	const avatarStyles: React.CSSProperties & Record< `--${ string }`, string > = {
		'--avatar-url': `url(${ avatarUrl })`,
		'--user-color': userInfo.color,
	};

	return <div className={ className } style={ avatarStyles } aria-hidden="true" />;
}
