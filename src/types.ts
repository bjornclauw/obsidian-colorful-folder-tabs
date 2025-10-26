export interface FolderMapping {
	name: string;
	color: string;
	textColor: string;
	useTextColor?: boolean; 
}

export interface FolderColorSettings {
	enabled: boolean;
	mappings: FolderMapping[];
	showDot: boolean;
    subFolderFontWeight?: number;
	mainFolderFontWeight?: number;
}
