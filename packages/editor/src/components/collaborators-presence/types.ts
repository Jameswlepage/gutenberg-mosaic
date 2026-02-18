export interface CollaboratorPresenceInfo {
	name: string;
	id?: number;
	color?: string;
	avatar_urls?: object;
}

export interface CollaboratorPresenceItem {
	clientId: string | number;
	collaboratorInfo: CollaboratorPresenceInfo;
	isConnected: boolean;
}
