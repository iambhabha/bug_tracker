class TrelloSyncWebhookController {
    constructor({ sheetGateway, notifier, trelloGateway }) {
        this.sheetGateway = sheetGateway;
        this.notifier = notifier;
        this.trelloGateway = trelloGateway;
        this.listStatusMap = {
            // These should be configured based on your Trello board's actual list IDs
            // Map format: trelloListId -> status name
        };
    }

    setListStatusMap(listStatusMap) {
        this.listStatusMap = listStatusMap;
    }

    async processTrelloWebhook(webhookData) {
        // Trello webhook sends data in this format:
        // {
        //   action: { type: 'updateCard', data: { card: { id, name, idList } } },
        //   model: { id: cardId }
        // }

        const action = webhookData.action;
        if (!action) {
            return;
        }

        // Handle card movement (updateCard action with idList change)
        if (action.type === 'updateCard' && action.data.card) {
            const card = action.data.card;
            const newListId = card.idList;
            const status = this.listStatusMap[newListId];

            if (status) {
                const issueId = await this.resolveIssueId(card);

                if (issueId) {
                    await this.sheetGateway.markWithStatus(issueId, status);
                    console.log(`✅ Synced Trello card '${card.name}' (${issueId}) to status: ${status}`);
                }
            }
        }

        // Handle card comments/activity if needed
        if (action.type === 'commentCard') {
            // Optional: log comment activity
            console.log(`💬 Comment on Trello card from Trello webhook`);
        }
    }

    extractIssueId(cardName) {
        // Try to extract ID from formats like:
        // "ID-123: Bug Title"
        // "ISSUE-456: Another Title"
        // "#789 - Title"
        const patterns = [
            /^ID-(\d+)/i,
            /^ISSUE-(\d+)/i,
            /^#(\d+)/
        ];

        for (const pattern of patterns) {
            const match = cardName.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return null;
    }

    async resolveIssueId(card) {
        const fromName = this.extractIssueId(card.name || "");
        if (fromName) {
            return fromName;
        }

        if (this.trelloGateway && card.id) {
            return await this.trelloGateway.getIssueIdFromCard(card.id, card.name || "");
        }

        return null;
    }
}

module.exports = TrelloSyncWebhookController;
