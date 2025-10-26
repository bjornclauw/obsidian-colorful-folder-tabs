import { Plugin } from 'obsidian';
import { FolderColorSettingTab } from './settings-tab';
import type { FolderColorSettings } from './types';
import './styles.css';

const DEFAULT_SETTINGS: FolderColorSettings = {
	enabled: true,
	mainFolderFontWeight: 700,
	subFolderFontWeight: 500,
	mappings: [
		{ name: 'Projects', color: '#e74c3c', textColor: '#ffffff', useTextColor: true },
		{ name: 'Design', color: '#3498db', textColor: '#ffffff', useTextColor: true },
	],
	showDot: true,
};

export default class FolderColorPlugin extends Plugin {
	settings: FolderColorSettings = DEFAULT_SETTINGS;
	private observer: MutationObserver | null = null;
	private explorerObservers: Map<HTMLElement, MutationObserver> = new Map();

	async onload() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		console.log('FolderColorPlugin loaded', this.settings);

		// Add settings tab
		this.addSettingTab(new FolderColorSettingTab(this.app, this));

		// Command to toggle
		this.addCommand({
			id: 'toggle-folder-colors',
			name: 'Toggle folder colors',
			callback: async () => {
				this.settings.enabled = !this.settings.enabled;
				await this.saveData(this.settings);
				this.settings.enabled ? this.applyAllStyles() : this.removeStyles();
			},
		});

		// Apply styles on layout ready if enabled
		this.app.workspace.onLayoutReady(() => {
			if (this.settings.enabled) this.applyAllStyles();
		});
	}

	onunload() {
		this.removeStyles();
		console.log('FolderColorPlugin unloaded');
	}

	/** ---------------- Core functionality ---------------- **/

	/** Apply all styles (colors + dots + observers) */
	public applyAllStyles() {
		const mainWeight = this.settings.mainFolderFontWeight ?? 700; // fallback default
		const subWeight = this.settings.subFolderFontWeight ?? 500;   // fallback default
		document.documentElement.style.setProperty('--fc-main-folder-weight', mainWeight.toString());
		document.documentElement.style.setProperty('--fc-sub-folder-weight', subWeight.toString());

		this.applyStructuralStyles();
		this.applyMappingsToAllExplorers();
		this.setupObserversForExplorers();
	}

	/** Remove all plugin styles and observers */
	public removeStyles() {
		document.querySelectorAll('.tree-item.nav-folder, .nav-folder-title')
			.forEach(el => {
				const htmlEl = el as HTMLElement;
				htmlEl.classList.remove('fc-dot-enabled', 'fc-colored-folder');
				htmlEl.style.removeProperty('--tab-color');
				htmlEl.style.removeProperty('--text-color');
			});

		this.observer?.disconnect();
		this.observer = null;

		this.explorerObservers.forEach(obs => obs.disconnect());
		this.explorerObservers.clear();
	}

	/** Apply dot indicators only */
	private applyStructuralStyles() {
		const explorers = Array.from(
			document.querySelectorAll('.workspace-leaf-content[data-type="file-explorer"]')
		);

		explorers.forEach(explorer => {
			const folderTitles = Array.from(
				explorer.querySelectorAll('.tree-item.nav-folder .nav-folder-title')
			) as HTMLElement[];

			folderTitles.forEach(titleEl => {
				if (this.settings.showDot) titleEl.classList.add('fc-dot-enabled');
				else titleEl.classList.remove('fc-dot-enabled');
			});
		});
	}

	/** Apply color mappings to all explorers */
	private applyMappingsToAllExplorers() {
		const explorers = Array.from(
			document.querySelectorAll('.workspace-leaf-content[data-type="file-explorer"]')
		);
		explorers.forEach(explorer => this.applyMappingsToDOM(explorer as HTMLElement));
	}

    /** 
     * Apply color mappings to DOM elements inside an explorer.
     * 
     * Obsidian's API does not provide direct hooks for styling folder items individually,
     * so we must access the DOM elements representing folders in the file explorer.
     * Each top-level and subfolder title is matched against user-defined mappings
     * to apply background and text colors dynamically.
     */
	private applyMappingsToDOM(container: HTMLElement) {
		const mappings = this.settings.mappings || [];
		if (!mappings.length) return;

		const folderTitles = Array.from(
			container.querySelectorAll('.tree-item.nav-folder .nav-folder-title')
		) as HTMLElement[];

		folderTitles.forEach(titleEl => {
			const text = titleEl.textContent?.trim() || '';
			const mapping = mappings.find(m => m.name === text);
			const folderItem = titleEl.closest('.tree-item.nav-folder') as HTMLElement | null;

			if (mapping && folderItem) {
				folderItem.style.setProperty('--tab-color', mapping.color);

				if (mapping.useTextColor) {
					titleEl.style.setProperty('--text-color', mapping.textColor);
				} else {
					titleEl.style.removeProperty('--text-color');
				}

				folderItem.classList.add('fc-colored-folder');
				if (this.settings.showDot) titleEl.classList.add('fc-dot-enabled');
			} else {
				folderItem?.style.removeProperty('--tab-color');
				titleEl?.style.removeProperty('--text-color');
				folderItem?.classList.remove('fc-colored-folder');
				titleEl.classList.remove('fc-dot-enabled');
			}
		});
	}

/**
 * Observe workspace for dynamically added explorers.
 *
 * Only observes new file explorers being added to the workspace.
 * Each explorer container is then passed to `observeExplorerContainer` 
 * which further scopes the observation to `.nav-files-container`.
 */
private setupObserversForExplorers() {
	// Disconnect previous workspace observer if exists
	if (this.observer) this.observer.disconnect();

	// Observe the workspace root for new file explorers
	this.observer = new MutationObserver(mutations => {
		for (const m of mutations) {
			for (const node of Array.from(m.addedNodes)) {
				if (!(node instanceof HTMLElement)) continue;

				// Only act on newly added file explorer containers
				if (node.matches('.workspace-leaf-content[data-type="file-explorer"]')) {
					this.applyMappingsToDOM(node);
					this.observeExplorerContainer(node);
				}
			}
		}
	});

	const workspaceRoot = document.querySelector('.workspace');
	if (workspaceRoot) {
		this.observer.observe(workspaceRoot, { childList: true, subtree: true });
	}

	// Ensure existing explorers are also observed
	const explorers = Array.from(
		document.querySelectorAll('.workspace-leaf-content[data-type="file-explorer"]')
	);
	explorers.forEach(explorer => this.observeExplorerContainer(explorer as HTMLElement));
}

/**
 * Observe a single explorer container.
 *
 * Only observes the `.nav-files-container` element inside the explorer,
 * which contains all folder and note nodes. This reduces unnecessary
 * MutationObserver overhead from other parts of the explorer pane.
 */
private observeExplorerContainer(container: HTMLElement) {
	if (this.explorerObservers.has(container)) return;

	const folderContainer = container.querySelector('.nav-files-container');
	if (!folderContainer) return;

	const innerObserver = new MutationObserver(() => this.applyMappingsToDOM(container));
	innerObserver.observe(folderContainer, { childList: true, subtree: true });

	this.explorerObservers.set(container, innerObserver);
}

}
