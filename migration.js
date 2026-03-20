const axios = require('axios');
const FormData = require("form-data");
require('dotenv').config();

class IssuesMigration {
    constructor() {
        this.trelloKey = process.env.TRELLO_KEY;
        this.trelloToken = process.env.TRELLO_TOKEN;
        this.boardId = process.env.TRELLO_BOARD_ID;
        this.baseUrl = "https://api.trello.com/1";
    }

    getAuthParams() {
        return `key=${this.trelloKey}&token=${this.trelloToken}`;
    }

    async getBoardLists() {
        const response = await axios.get(
            `${this.baseUrl}/boards/${this.boardId}/lists?${this.getAuthParams()}`
        );
        return response.data;
    }

    getListIdByAnyName(lists, candidateNames) {
        const normalizedCandidates = candidateNames.map((name) => name.toLowerCase());
        const list = lists.find((item) =>
            normalizedCandidates.includes((item.name || "").trim().toLowerCase())
        );

        return list ? list.id : null;
    }

    getTargetListIdForStatus(lists, status) {
        const normalizedStatus = (status || "OPEN").toUpperCase();

        if (normalizedStatus === "DONE") {
            return this.getListIdByAnyName(lists, ["Done", "Completed", "Closed"]);
        }

        if (normalizedStatus === "IN PROGRESS") {
            return this.getListIdByAnyName(lists, ["In Progress", "In Development", "Doing", "Development"]);
        }

        return this.getListIdByAnyName(lists, ["To Do", "Todo", "Issues", "Backlog"]);
    }

    async migrateIssuesFromSheet(sheetData) {
        console.log(`Starting migration of ${sheetData.length} issues...`);

        const lists = await this.getBoardLists();
        const fallbackListId = this.getListIdByAnyName(lists, ["To Do", "Todo", "Issues", "Backlog"]);

        if (!fallbackListId) {
            throw new Error("No suitable target list found on Trello board");
        }

        let successCount = 0;
        let errorCount = 0;

        for (const issue of sheetData) {
            try {
                const labelMap = {
                    HIGH: "red",
                    MEDIUM: "yellow",
                    LOW: "green",
                    CRITICAL: "red"
                };

                const labelColor = labelMap[(issue.priority || "").toUpperCase()];
                const listId = this.getTargetListIdForStatus(lists, issue.status) || fallbackListId;
                const cleanTitle = this.cleanTitle(issue.title || "Untitled");

                const cardData = {
                    name: cleanTitle,
                    desc: this.buildCardDescription(issue),
                    idList: listId,
                    labels: labelColor || undefined,
                    due: issue.dueDate || null
                };

                const response = await axios.post(
                    `${this.baseUrl}/cards?${this.getAuthParams()}`,
                    cardData
                );

                const mediaUrl = issue.image || issue.preview || issue.video || issue.mediaUrl;
                if (mediaUrl) {
                    await this.attachMediaToCard(response.data.id, mediaUrl);
                }

                console.log(`✅ Created card: ${issue.title} (ID: ${response.data.id})`);
                successCount++;

            } catch (error) {
                console.error(`❌ Failed to migrate: ${issue.title}`, error.message);
                errorCount++;
            }

            // Rate limiting - Trello allows 10 requests per second
            await new Promise(resolve => setTimeout(resolve, 150));
        }

        console.log(`\nMigration complete.`);
        console.log(`Success: ${successCount}`);
        console.log(`Failed: ${errorCount}`);

        return {
            successCount,
            errorCount,
            total: sheetData.length
        };
    }

    // Helper: Format issues from different sheet formats
    static formatSheetData(rawSheetData) {
        // Assuming sheet has columns: title, description, priority, status, reporter, date, chatId, image
        return rawSheetData.map(row => ({
            id: row.id || Date.now(),
            title: row.title || row.name || 'Untitled',
            description: row.description || '',
            priority: row.priority || 'MEDIUM',
            status: row.status || 'OPEN',
            reporter: row.reporter || 'Unknown',
            date: row.date || new Date().toISOString(),
            chatId: row.chatId || '',
            image: row.image || row.imageUrl || row.preview || row.video || row.mediaUrl || '',
            preview: row.preview || '',
            video: row.video || '',
            dueDate: row.dueDate || null
        }));
    }

    buildCardDescription(issue) {
        return [
            `Description: ${issue.description || ""}`,
            `Priority: ${issue.priority || "MEDIUM"}`,
            `Status: ${issue.status || "OPEN"}`,
            `Reporter: ${issue.reporter || "Unknown"}`,
            `Date: ${issue.date || "N/A"}`,
            `Chat ID: ${issue.chatId || "N/A"}`,
            `Evidence URL: ${issue.image || issue.preview || issue.video || issue.mediaUrl || "N/A"}`
        ].join("\n\n");
    }

    cleanTitle(rawTitle) {
        const withoutStatus = String(rawTitle || "")
            .replace(/^\s*\[(open|done|in progress)\]\s*/i, "")
            .replace(/^\s*(open|done|in progress)\s*[:-]\s*/i, "");

        const withoutEmoji = withoutStatus.replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, "");
        const compact = withoutEmoji.replace(/\s+/g, " ").trim();
        return compact || "Untitled";
    }

    async attachMediaToCard(cardId, mediaUrl) {
        if (!mediaUrl) {
            return;
        }

        try {
            const mediaResponse = await axios.get(mediaUrl, {
                responseType: "arraybuffer",
                timeout: 20000
            });

            const contentType = mediaResponse.headers["content-type"] || "application/octet-stream";
            const extension = this.getFileExtension(contentType, mediaUrl);
            const form = new FormData();
            form.append("file", Buffer.from(mediaResponse.data), {
                filename: `evidence.${extension}`,
                contentType
            });

            await axios.post(
                `${this.baseUrl}/cards/${cardId}/attachments?${this.getAuthParams()}`,
                form,
                {
                    headers: form.getHeaders(),
                    maxBodyLength: Infinity
                }
            );
        } catch (error) {
            try {
                await axios.post(
                    `${this.baseUrl}/cards/${cardId}/attachments?${this.getAuthParams()}`,
                    {
                        url: mediaUrl,
                        name: "evidence"
                    }
                );
            } catch (_fallbackError) {
                // Continue migration even if an attachment cannot be added.
            }
        }
    }

    getFileExtension(contentType, mediaUrl) {
        if (contentType.includes("image/jpeg")) return "jpg";
        if (contentType.includes("image/png")) return "png";
        if (contentType.includes("image/webp")) return "webp";
        if (contentType.includes("video/mp4")) return "mp4";

        const cleanUrl = String(mediaUrl || "").split("?")[0];
        const parts = cleanUrl.split(".");
        if (parts.length > 1) {
            return parts.pop().toLowerCase();
        }

        return "bin";
    }
}

module.exports = IssuesMigration;
