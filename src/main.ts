import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import './styles.css';

interface FolderMapping {
	name: string;
	color: string;
	textColor: string;
}

interface FolderColorSettings {
	enabled: boolean;
	mappings: FolderMapping[];
	showDot: boolean;
	topFolderFontWeight: number;
}

const DEFAULT_SETTINGS: FolderColorSettings = {
	enabled: true,
	mappings: [
		{ name: 'Projects', color: '#e74c3c', textColor: '#ffffff' },
		{ name: 'Design', color: '#3498db', textColor: '#ffffff' },
	],
	showDot: true,
	topFolderFontWeight: 800,
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
		this.applyStructuralStyles(); // always apply structural stuff
		if (this.settings.enabled) {
			this.applyMappingsToAllExplorers(); // colors only if enabled
			this.setupObserversForExplorers();
		}
	}

	public removeStyles() {
    // Remove all inline colors and font weights
    const allFolderItems = document.querySelectorAll(
        '.tree-item.nav-folder, .nav-folder-title'
    );
    allFolderItems.forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.removeProperty('--tab-color');
        htmlEl.style.removeProperty('color');
        htmlEl.style.removeProperty('font-weight');

        // Remove dot class
        htmlEl.classList.remove('fc-dot-enabled');
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
	private applyStructuralStyles() {
		const explorers = document.querySelectorAll(
			'.workspace-leaf-content[data-type="file-explorer"]'
		);

		explorers.forEach((explorer) => {
			const folderTitleEls = Array.from(
				explorer.querySelectorAll('.tree-item.nav-folder .nav-folder-title')
			) as HTMLElement[];

			folderTitleEls.forEach((titleEl) => {
				// Font weight for top-level folders
				titleEl.style.fontWeight = this.settings.topFolderFontWeight.toString();

				// Show/hide dot
				if (this.settings.showDot) {
					titleEl.classList.add('fc-dot-enabled');
				} else {
					titleEl.classList.remove('fc-dot-enabled');
				}
			});
		});
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
			container.querySelectorAll('.tree-item.nav-folder .nav-folder-title')
		) as HTMLElement[];

		folderTitleEls.forEach((titleEl) => {
			const text = titleEl.textContent?.trim() || '';
			const mapping = mappings.find((m) => m.name === text);
			const folderItem = titleEl.closest('.tree-item.nav-folder') as HTMLElement | null;
			if (mapping && folderItem) {
				folderItem.style.setProperty('--tab-color', mapping.color);
				titleEl.style.setProperty('--tab-color', mapping.color);
				titleEl.style.color = mapping.textColor || '#ffffff';
			}
			// Show/hide dot
			if (this.settings.showDot) {
				titleEl.classList.add('fc-dot-enabled');
			} else {
				titleEl.classList.remove('fc-dot-enabled');
			}

			// Set font weight for top-level folders
			titleEl.style.fontWeight = this.settings.topFolderFontWeight.toString();
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

						// Apply or remove styles immediately
						if (value) this.plugin.addStyles();
						else this.plugin.removeStyles();

						// Re-render settings panel so sections hide/show instantly
						this.display();
					})
			);

		// --- Hide everything else if disabled ---
		if (!this.plugin.settings.enabled) {
			const note = containerEl.createEl('p', {
				text: 'Folder colors are currently disabled. Enable them to configure mappings.',
			});
			note.style.color = 'var(--text-muted)';
			note.style.fontStyle = 'italic';
			return; // stop rendering the rest
		}

		new Setting(containerEl)
			.setName('Show colored dot')
			.setDesc('Display a colored dot on top-level folders')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showDot)
					.onChange(async (value) => {
						this.plugin.settings.showDot = value;
						await this.plugin.saveData(this.plugin.settings);
						if (this.plugin.settings.enabled) this.plugin.addStyles();
					})
			);
		// Mappings list
		containerEl.createEl('h3', { text: 'Folder → Color mappings' });
		const list = containerEl.createDiv({ cls: 'folder-color-list' });
		const mappings = this.plugin.settings.mappings || [];

		mappings.forEach((m, idx) => {
			const row = list.createDiv({ cls: 'folder-mapping-row' });
			row.style.display = 'flex';
			row.style.alignItems = 'center';
			row.style.gap = '10px';
			row.style.marginBottom = '6px';

			// Folder name
			const nameInput = row.createEl('input', {
				attr: { type: 'text', placeholder: 'Folder name', value: m.name },
			});
			nameInput.classList.add('folder-name-input');
			nameInput.style.flex = '1';
			nameInput.onchange = async () => {
				mappings[idx].name = nameInput.value.trim();
				await this.plugin.saveData(this.plugin.settings);
				if (this.plugin.settings.enabled) this.plugin.addStyles();
				this.display();
			};

			// Background color
			const colorLabel = row.createEl('span', { text: 'BG', cls: 'mapping-label' });
			colorLabel.title = 'Background color';
			const colorInput = row.createEl('input', {
				attr: { type: 'color', value: m.color || '#ff0000' },
			});
			colorInput.style.width = '40px';
			colorInput.style.height = '28px';
			colorInput.style.cursor = 'pointer';
			colorInput.onchange = async () => {
				mappings[idx].color = colorInput.value;
				await this.plugin.saveData(this.plugin.settings);
				if (this.plugin.settings.enabled) this.plugin.addStyles();
			};

			// Text color
			const textLabel = row.createEl('span', { text: 'TXT', cls: 'mapping-label' });
			textLabel.title = 'Text color';
			const textColorInput = row.createEl('input', {
				attr: { type: 'color', value: m.textColor || '#ffffff' },
			});
			textColorInput.style.width = '40px';
			textColorInput.style.height = '28px';
			textColorInput.style.cursor = 'pointer';
			textColorInput.onchange = async () => {
				mappings[idx].textColor = textColorInput.value;
				await this.plugin.saveData(this.plugin.settings);
				if (this.plugin.settings.enabled) this.plugin.addStyles();
			};

			// Remove button
			const removeBtn = row.createEl('button', { text: '✕' });
			removeBtn.classList.add('mod-warning');
			removeBtn.style.marginLeft = 'auto';
			removeBtn.title = 'Remove this mapping';
			removeBtn.onclick = async () => {
				mappings.splice(idx, 1);
				await this.plugin.saveData(this.plugin.settings);
				if (this.plugin.settings.enabled) this.plugin.addStyles();
				this.display();
			};
		});

		// Add new mapping
		containerEl.createEl('h4', { text: 'Add new mapping' });
		const addRow = containerEl.createDiv({ cls: 'folder-mapping-add' });
		addRow.style.display = 'flex';
		addRow.style.alignItems = 'center';
		addRow.style.gap = '10px';
		addRow.style.marginTop = '8px';

		const newName = addRow.createEl('input', {
			attr: { type: 'text', placeholder: 'Folder name' },
		});
		newName.style.flex = '1';

		const newColor = addRow.createEl('input', {
			attr: { type: 'color', value: '#ff0000' },
		});
		newColor.style.width = '40px';
		newColor.style.height = '28px';
		newColor.style.cursor = 'pointer';

		const newTextColor = addRow.createEl('input', {
			attr: { type: 'color', value: '#ffffff' },
		});
		newTextColor.style.width = '40px';
		newTextColor.style.height = '28px';
		newTextColor.style.cursor = 'pointer';

		const addBtn = addRow.createEl('button', { text: 'Add mapping' });
		addBtn.classList.add('mod-cta');
		addBtn.onclick = async () => {
			const name = (newName.value || '').trim();
			if (!name) return;
			const color = newColor.value || '#ffffff';
			const textColor = newTextColor.value || '#ffffff';
			this.plugin.settings.mappings.push({ name, color, textColor });
			await this.plugin.saveData(this.plugin.settings);
			if (this.plugin.settings.enabled) this.plugin.addStyles();
			this.display();
		};

	}
}
