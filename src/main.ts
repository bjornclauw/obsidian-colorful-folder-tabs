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
        // example defaults (you can remove these)
        { name: 'Projects', color: '#e74c3c' },
        { name: 'Design', color: '#3498db' },
    ],
};

export default class FolderColorPlugin extends Plugin {
    settings: FolderColorSettings = DEFAULT_SETTINGS;
    private observer: MutationObserver | null = null;

    async onload() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as FolderColorSettings;
        console.log('FolderColorPlugin loaded', this.settings);

            // Inject styles if enabled
            if (this.settings.enabled) this.addStyles();

        // Register settings tab
        this.addSettingTab(new FolderColorSettingTab(this.app, this));

        // Command to toggle styles quickly
        this.addCommand({
            id: 'toggle-folder-colors',
            name: 'Toggle folder colors',
            callback: async () => {
                this.settings.enabled = !this.settings.enabled;
                await this.saveData(this.settings);
                if (this.settings.enabled) this.addStyles(); else this.removeStyles();
            },
        });
    }

    onunload() {
        this.removeStyles();
        console.log('FolderColorPlugin unloaded');
    }

        addStyles() {
                // Base CSS is imported via side-effect import './styles.css' and will be
                // injected by the bundler. We only need to apply mappings and observe
                // the DOM for dynamic updates.
                this.applyMappingsToDOM();
                this.setupObserver();
        }

    removeStyles() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            // Remove inline styles set by mappings
            this.clearInlineMappings();
    }

        private applyMappingsToDOM() {
            const mappings = this.settings.mappings || [];
            if (!mappings.length) return;

            // The explorer renders folder titles inside elements with class .nav-folder-title.
            // We will match by the visible text content (trimmed).
            const folderTitleEls = Array.from(document.querySelectorAll('.workspace-leaf-content[data-type="file-explorer"] .nav-files-container .tree-item.nav-folder .nav-folder-title')) as HTMLElement[];

            folderTitleEls.forEach(titleEl => {
                const text = titleEl.textContent?.trim() || '';
                const mapping = mappings.find(m => m.name === text);
                const folderItem = titleEl.closest('.tree-item.nav-folder') as HTMLElement | null;
                if (mapping && folderItem) {
                    // set inline CSS custom property so all rules can read it
                    folderItem.style.setProperty('--tab-color', mapping.color);
                    titleEl.style.setProperty('--tab-color', mapping.color);
                }
            });
        }

        private clearInlineMappings() {
            const folderItems = Array.from(document.querySelectorAll('.workspace-leaf-content[data-type="file-explorer"] .nav-files-container .tree-item.nav-folder')) as HTMLElement[];
            folderItems.forEach(el => {
                el.style.removeProperty('--tab-color');
            });
            const titleEls = Array.from(document.querySelectorAll('.workspace-leaf-content[data-type="file-explorer"] .nav-files-container .tree-item.nav-folder .nav-folder-title')) as HTMLElement[];
            titleEls.forEach(el => el.style.removeProperty('--tab-color'));
        }

        private setupObserver() {
            if (this.observer) return;
            const container = document.querySelector('.workspace-leaf-content[data-type="file-explorer"] .nav-files-container');
            if (!container) return;
            this.observer = new MutationObserver(() => {
                // small debounce via setTimeout to allow DOM to settle
                setTimeout(() => this.applyMappingsToDOM(), 50);
            });
            this.observer.observe(container, { childList: true, subtree: true });
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
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.enabled).onChange(async (value) => {
                    this.plugin.settings.enabled = value;
                    await this.plugin.saveData(this.plugin.settings);
                        if (value) this.plugin.addStyles(); else this.plugin.removeStyles();
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