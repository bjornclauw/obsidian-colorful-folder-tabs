import { App, PluginSettingTab, Setting } from 'obsidian';
import type FolderColorPlugin from './main';

export class FolderColorSettingTab extends PluginSettingTab {
	plugin: FolderColorPlugin;

	constructor(app: App, plugin: FolderColorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Folder Color Settings' });




// --------------------------
	// Main folder font weight
	// --------------------------
	new Setting(containerEl)
		.setName('Main folder font weight')
		.setDesc('Set the font weight for top-level folders (default: 700).')
		.addText(t =>
			t.setPlaceholder('700')
				.setValue(this.plugin.settings.mainFolderFontWeight?.toString() ?? '')
				.onChange(async (v) => {
					const val = parseInt(v);
					this.plugin.settings.mainFolderFontWeight = isNaN(val) ? undefined : val;
					await this.plugin.saveData(this.plugin.settings);
					this.plugin.applyAllStyles();
				})
		);

	// --------------------------
	// Subfolder font weight
	// --------------------------
	new Setting(containerEl)
		.setName('Subfolder font weight')
		.setDesc('Set the font weight for subfolders (default: 500).')
		.addText(t =>
			t.setPlaceholder('500')
				.setValue(this.plugin.settings.subFolderFontWeight?.toString() ?? '')
				.onChange(async (v) => {
					const val = parseInt(v);
					this.plugin.settings.subFolderFontWeight = isNaN(val) ? undefined : val;
					await this.plugin.saveData(this.plugin.settings);
					this.plugin.applyAllStyles();
				})
		);
		// Enable plugin toggle
		new Setting(containerEl)
			.setName('Enable folder colors')
			.setDesc('Toggle folder color styling in the file explorer.')
			.addToggle(t =>
				t.setValue(this.plugin.settings.enabled).onChange(async v => {
					this.plugin.settings.enabled = v;
					await this.plugin.saveData(this.plugin.settings);
					v ? this.plugin.applyAllStyles() : this.plugin.removeStyles();
					this.display();
				})
			);

		// If plugin disabled, show note only
		if (!this.plugin.settings.enabled) {
			const note = containerEl.createEl('p', {
				text: 'Folder colors are disabled. Enable them to configure mappings.',
			});
			note.addClass('setting-item-description');
			return;
		}

		// Show dot toggle
		new Setting(containerEl)
			.setName('Show colored dot')
			.setDesc('Display a small colored dot next to top-level folders.')
			.addToggle(t =>
				t.setValue(this.plugin.settings.showDot).onChange(async v => {
					this.plugin.settings.showDot = v;
					await this.plugin.saveData(this.plugin.settings);
					this.plugin.applyAllStyles();
				})
			);

		// Header + disclaimer
		containerEl.createEl('h3', { text: 'Folder → Color mappings' });
		const disclaimer = containerEl.createEl('p', {
			text: 'Note: These colors will not override any colors that are modified/set by your theme.',
		});
		disclaimer.addClass('setting-item-description');

		const mappings = this.plugin.settings.mappings || [];

		// Folder mappings
		mappings.forEach((m, idx) => {
			const row = new Setting(containerEl).setClass('fc-mapping-row');

			// Left container for all inputs
			const leftGroup = row.controlEl.createDiv({ cls: 'fc-left-group' });

			// Folder name
			leftGroup.createEl('input', {
				type: 'text',
				value: m.name,
				placeholder: 'Folder name',
				cls: 'fc-text-input',
			}).addEventListener('input', async (e) => {
				const v = (e.target as HTMLInputElement).value;
				mappings[idx].name = v.trim();
				await this.plugin.saveData(this.plugin.settings);
				this.plugin.applyAllStyles();
			});

			// Create a container for the whole row of inputs
			const rowGroup = leftGroup.createDiv();
			rowGroup.style.display = 'flex';
			rowGroup.style.alignItems = 'center';
			rowGroup.style.gap = '30px'; // space between background color picker and text color controls

			// Background color picker (first group)
			const bgColor = rowGroup.createEl('input', { type: 'color', value: m.color, cls: 'fc-color-input' });
			bgColor.addEventListener('input', async (e) => {
				mappings[idx].color = (e.target as HTMLInputElement).value;
				await this.plugin.saveData(this.plugin.settings);
				this.plugin.applyAllStyles();
			});

			// Text color controls (second group)
			const textGroup = rowGroup.createDiv();
			textGroup.style.display = 'flex';
			textGroup.style.alignItems = 'center';
			textGroup.style.gap = '5px'; // small gap only inside this group

			// Label
			textGroup.createEl('span', { text: 'Use custom text color:' });

			// Checkbox
			const toggle = textGroup.createEl('input', { type: 'checkbox' });
			toggle.checked = m.useTextColor ?? true;
			toggle.className = 'fc-inline-checkbox';
			toggle.addEventListener('change', async () => {
				mappings[idx].useTextColor = toggle.checked;
				await this.plugin.saveData(this.plugin.settings);
				this.plugin.applyAllStyles();
			});

			// Text color picker
			const textColor = textGroup.createEl('input', { type: 'color' });
			textColor.value = m.textColor || '#ffffff';
			textColor.className = 'fc-inline-color';
			textColor.addEventListener('input', async (e) => {
				mappings[idx].textColor = (e.target as HTMLInputElement).value;
				await this.plugin.saveData(this.plugin.settings);
				this.plugin.applyAllStyles();
			});

			// Trash/remove button (right-aligned)
			row.addExtraButton(btn =>
				btn.setIcon('trash')
					.setTooltip('Remove mapping')
					.onClick(async () => {
						mappings.splice(idx, 1);
						await this.plugin.saveData(this.plugin.settings);
						this.plugin.applyAllStyles();
						this.display();
					})
			);

			// remove default spacing for compact row
			row.infoEl.remove();
		});

		// Add new mapping button
		new Setting(containerEl)
			.setName('Add new mapping')
			.setDesc('Create a new folder color mapping.')
			.addButton(btn =>
				btn.setButtonText('+ Add').setCta().onClick(async () => {
					mappings.push({
						name: 'New Folder',
						color: '#888888',
						textColor: '#ffffff',
						useTextColor: false,
					});
					await this.plugin.saveData(this.plugin.settings);
					this.plugin.applyAllStyles();
					this.display();
				})
			);
	}
}
