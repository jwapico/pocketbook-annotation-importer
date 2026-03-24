import {App, PluginSettingTab, Setting} from "obsidian";
import MyPlugin from "./main";

export interface MyPluginSettings {
	pocketbookNotesDir: string;
	outputDir: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	pocketbookNotesDir: "",
	outputDir: ""
}

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Path to Pocketbook Notes Directory')
			.setDesc('Pocketbook must be plugged in with PC Link enabled')
			.addText(text => text
				.setPlaceholder('ex. /run/media/goop/PB634K3/Notes')
				.setValue(this.plugin.settings.pocketbookNotesDir)
				.onChange(async (value) => {
					this.plugin.settings.pocketbookNotesDir = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Vault Folder')
			.setDesc('The location you want the converted files to be saved in Obsidian')
			.addText(text => text
				.setPlaceholder('ex. Pocketbook Annotations')
				.setValue(this.plugin.settings.outputDir)
				.onChange(async (value) => {
					this.plugin.settings.outputDir = value.endsWith("/") ? value.slice(0, -1) : value;
					await this.plugin.saveSettings();
				}));

        new Setting(containerEl)
            .setName('Sync notes')
            .setDesc('This will create a new note for every file with annotations on your pocketbook in the directory specified above')
            .addExtraButton((button) => {
                button
                    .setIcon('play')
                    .onClick(() => {
                        this.plugin.syncNotes();
                    });
            });
	}
}
