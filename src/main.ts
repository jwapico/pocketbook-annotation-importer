import {Notice, Plugin} from 'obsidian';
import {DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab} from "./settings";
import { readFileSync, readdirSync} from 'fs';
import * as cheerio from 'cheerio'
import crypto from "crypto"

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "sync-pocketbook-notes",
			name: "Sync Pocketbook Notes",
			callback: () => {
				this.syncNotes();
			}
		});

		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MyPluginSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private generateHighlightHash(text: string, page: string): string {
		const input = `${text.trim()}---${page}`;
		const hash = crypto
			.createHash('sha256')
			.update(input)
			.digest('hex')
			.substring(0, 8)
			.toUpperCase();
		return hash;
	}

	private extractPersistentSection(existingContent: string): string {
		const persistStartMarker = "<!-- PERSIST START -->";
		const persistEndMarker = "<!-- PERSIST END -->";

		const startIdx = existingContent.indexOf(persistStartMarker);
		const endIdx = existingContent.indexOf(persistEndMarker);

		if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
			return existingContent.substring(startIdx, endIdx + persistEndMarker.length);
		}

		return "";
	}

	async createPocketbookNote(filename: string, html_content: string) {
		try {
			
			const $ = cheerio.load(html_content);
			const bookTitleDiv = $("div").first();
			const authorDiv = bookTitleDiv.next();
			const creationDate = bookTitleDiv.text().trim().slice(0, 19);
			const title = bookTitleDiv.text().trim().slice(22,);
			
			let metadataContent = "";
			metadataContent += "# " + title + "\n";
			metadataContent += authorDiv.text().trim() + "\n";
			metadataContent += "Annotation Creation Date: " + creationDate + "\n";

			let highlightContent = "";
			$("div.bookmark[id]").each((index, element) => {
				const $el = $(element);
				
				const page = $el.find("p.bm-page").text().trim();
				const text = $el.find("div.bm-text p").text().trim().replace(/\s+/g, " ");
				const note = $el.find("div.bm-note").text().trim();
	
				if (text) {
					const hash = this.generateHighlightHash(text, page);
					highlightContent += `###### ${hash}\n`;
					highlightContent += "> " + text + "\n";
					if (page) highlightContent += "- Page " + page + "\n";
					if (note) highlightContent += "  - Note: " + note + "\n";
					highlightContent += "\n";
				}
			});

			if (!this.app.vault.getAbstractFileByPath(this.settings.outputDir) && this.settings.outputDir != "")
				await this.app.vault.createFolder(this.settings.outputDir)

			const outputFilepath = (this.settings.outputDir != "") 
				? `${this.settings.outputDir}/${filename}` 
				: filename;
			
			const existingFile = this.app.vault.getFileByPath(outputFilepath);
			if (existingFile) {
				const existingContent = await this.app.vault.read(existingFile);
				const persistentContent = this.extractPersistentSection(existingContent);
				
				let formattedContent = metadataContent + "\n";
				if (persistentContent)
					formattedContent += persistentContent + "\n";
				formattedContent += highlightContent;

				await this.app.vault.modify(existingFile, formattedContent)
				new Notice(`Updated note: ${filename}`);
			} else {
				let formattedContent = metadataContent + "\n";
				formattedContent += "<!-- PERSIST START -->\n";
				formattedContent += "<!-- PERSIST END -->\n\n";
				formattedContent += highlightContent;
				await this.app.vault.create(outputFilepath, formattedContent)
				new Notice(`Created new note: ${filename}`);
			}

        } catch (error: unknown) {
			if (error instanceof Error)
	            new Notice(`Failed to create note: ${error.message}`);
    	        console.error(error);
        }
	}

	async syncNotes() {
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Syncing Pocketbook Notes...');

		const files: string[] = readdirSync(this.settings.pocketbookNotesDir)
		for (const file of files) {
			statusBarItemEl.setText('Syncing Pocketbook Note: ' + file);
			const filepath = this.settings.pocketbookNotesDir + "/" + file
			const html_content = readFileSync(filepath, "utf-8");
			this.createPocketbookNote(file.replace(".html", ".md"), html_content);
		}

		statusBarItemEl.setText("");
		statusBarItemEl.remove();
	}
}