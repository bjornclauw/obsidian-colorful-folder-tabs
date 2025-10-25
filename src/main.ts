import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import './styles.css';

interface FolderMapping {
	name: string;
	color: string; // hex
}

interface FolderColorSettings {
	enabled: boolean;
	mappings: FolderMapping[];
}

const DEFAULT_SETTINGS: FolderColorSettings = {
	enabled: true,
	mappings: [
		{ name: 'Projects', color: '#e74c3c' },
		{ name: 'Design', color: '#3498db' },
	],
};

export default class FolderColorPlugin extends Plugin {
	settings: FolderColorSettings = DEFAULT_SETTINGS;
	private observer: MutationObserver | null = null;
	private explorerObservers: Map<HTMLElement, MutationObserver> = new Map();

	async onload() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		) as FolderColorSettings;
		console.log('FolderColorPlugin loaded', this.settings);

		// Register settings tab
		this.addSettingTab(new FolderColorSettingTab(this.app, this));

		// Command to toggle styles quickly
		this.addCommand({
			id: 'toggle-folder-colors',
			name: 'Toggle folder colors',
			callback: async () => {
				this.settings.enabled = !this.settings.enabled;
				await this.saveData(this.settings);
				if (this.settings.enabled) this.addStyles();
				else this.removeStyles();
			},
		});

		// Apply styles when workspace layout is ready
		this.app.workspace.onLayoutReady(() => {
			if (this.settings.enabled) this.addStyles();
		});
	}

	onunload() {
		this.removeStyles();
		console.log('FolderColorPlugin unloaded');
	}

	/** --------------------- Core functionality --------------------- **/

	public addStyles() {
		this.applyMappingsToAllExplorers();
		this.setupObserversForExplorers();
	}

	public removeStyles() {
		// Remove all inline colors
		const allFolderItems = document.querySelectorAll(
			'.tree-item.nav-folder, .nav-folder-title'
		);
		allFolderItems.forEach((el) => {
			(el as HTMLElement).style.removeProperty('--tab-color');
		});

		// Disconnect main observer
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}

		// Disconnect all explorer-specific observers
		this.explorerObservers.forEach((obs) => obs.disconnect());
		this.explorerObservers = new Map();
	}

	/** Apply mappings to all currently available explorers */
	private applyMappingsToAllExplorers() {
		const explorers = document.querySelectorAll(
			'.workspace-leaf-content[data-type="file-explorer"]'
		);
		explorers.forEach((explorer) =>
			this.applyMappingsToDOM(explorer as HTMLElement)
		);
	}

	/** Apply mappings for a single explorer container */
	private applyMappingsToDOM(container: HTMLElement) {
		const mappings = this.settings.mappings || [];
		if (!mappings.length) return;

		const folderTitleEls = Array.from(
			container.querySelectorAll(
				'.tree-item.nav-folder .nav-folder-title'
			)
		) as HTMLElement[];
		folderTitleEls.forEach((titleEl) => {
			const text = titleEl.textContent?.trim() || '';
			const mapping = mappings.find((m) => m.name === text);
			const folderItem = titleEl.closest(
				'.tree-item.nav-folder'
			) as HTMLElement | null;
			if (mapping && folderItem) {
				folderItem.style.setProperty('--tab-color', mapping.color);
				titleEl.style.setProperty('--tab-color', mapping.color);
			}
		});
	}

	/** Observe workspace for new explorers and apply mappings dynamically */
	private setupObserversForExplorers() {
		// Disconnect previous observer if any
		if (this.observer) this.observer.disconnect();

		this.observer = new MutationObserver((mutations) => {
			mutations.forEach((m) => {
				m.addedNodes.forEach((node) => {
					if (!(node instanceof HTMLElement)) return;
					if (
						node.matches(
							'.workspace-leaf-content[data-type="file-explorer"]'
						)
					) {
						this.applyMappingsToDOM(node);
						this.observeExplorerContainer(node);
					}
				});
			});
		});

		const workspaceRoot = document.querySelector('.workspace');
		if (workspaceRoot) {
			this.observer.observe(workspaceRoot, {
				childList: true,
				subtree: true,
			});
		}

		// Also observe existing explorers
		const explorers = document.querySelectorAll(
			'.workspace-leaf-content[data-type="file-explorer"]'
		);
		explorers.forEach((explorer) =>
			this.observeExplorerContainer(explorer as HTMLElement)
		);
	}

	/** Observe a single explorer container for folder changes */
	private observeExplorerContainer(container: HTMLElement) {
		if (this.explorerObservers.has(container)) return;

		const innerObserver = new MutationObserver(() => {
			this.applyMappingsToDOM(container);
		});
		innerObserver.observe(container, { childList: true, subtree: true });
		this.explorerObservers.set(container, innerObserver);
	}
}

class FolderColorSettingTab extends PluginSettingTab {
	plugin: FolderColorPlugin;

	constructor(app: App, plugin: FolderColorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Folder Color settings' });

		new Setting(containerEl)
			.setName('Enable folder colors')
			.setDesc('Toggle the folder color styling in the file explorer')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabled)
					.onChange(async (value) => {
						this.plugin.settings.enabled = value;
						await this.plugin.saveData(this.plugin.settings);
						if (value) this.plugin.addStyles();
						else this.plugin.removeStyles();
					})
			);

		// Mappings list
		containerEl.createEl('h3', { text: 'Folder → Color mappings' });
		const list = containerEl.createDiv({ cls: 'folder-color-list' });

		const mappings = this.plugin.settings.mappings || [];
		mappings.forEach((m, idx) => {
			const row = list.createDiv({ cls: 'folder-mapping-row' });
			row.createEl('label', { text: 'Folder name', cls: 'mapping-label' });
                const nameInput = row.createEl('input', { attr: { type: 'text', placeholder: 'Folder name', value: m.name } });
			nameInput.style.marginRight = '8px';
			nameInput.onchange = async () => {
				mappings[idx].name = nameInput.value.trim();
				await this.plugin.saveData(this.plugin.settings);
				this.plugin.addStyles();
				this.display();
			};

			row.createEl('label', { text: 'Color', cls: 'mapping-label' });
			const colorInput = row.createEl('input', { attr: { type: 'color', value: m.color || '#ff0000' } });
			colorInput.style.marginRight = '8px';
			colorInput.onchange = async () => {
				mappings[idx].color = colorInput.value;
				await this.plugin.saveData(this.plugin.settings);
				this.plugin.addStyles();
			};

			const removeBtn = row.createEl('button', { text: 'Remove' });
			removeBtn.onclick = async () => {
				mappings.splice(idx, 1);
				await this.plugin.saveData(this.plugin.settings);
				this.plugin.addStyles();
				this.display();
			};
		});

		// Add new mapping
		containerEl.createEl('h4', { text: 'Add mapping' });
		const addRow = containerEl.createDiv({ cls: 'folder-mapping-add' });
		const newName = addRow.createEl('input', { attr: { type: 'text', placeholder: 'Folder name' } });
		newName.style.marginRight = '8px';
		const newColor = addRow.createEl('input', { attr: { type: 'color', value: '#ff0000' } });
		newColor.style.marginRight = '8px';
		const addBtn = addRow.createEl('button', { text: 'Add' });
		addBtn.onclick = async () => {
			const name = (newName.value || '').trim();
			const color = newColor.value || '#ffffff';
			if (!name) return;
			this.plugin.settings.mappings = this.plugin.settings.mappings || [];
			this.plugin.settings.mappings.push({ name, color });
			await this.plugin.saveData(this.plugin.settings);
			this.plugin.addStyles();
			this.display();
		};
	}
}
