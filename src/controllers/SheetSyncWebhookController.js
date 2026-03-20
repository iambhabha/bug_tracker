class SheetSyncWebhookController {
    constructor({ trelloGateway, notifier }) {
        this.trelloGateway = trelloGateway;
        this.notifier = notifier;
    }

    async processSheetWebhook(webhookData) {
        // Google Sheets webhook data format (when using Apps Script):
        // {
        //   action: 'update',
        //   id: '123',
        //   status: 'IN PROGRESS'  or 'DONE' or 'OPEN'
        // }

        const { action, id, status } = webhookData;

        if (!action || !id) {
            return false;
        }

        if (action === 'update' && status) {
            // Map sheet status to Trello action
            if (status === 'IN PROGRESS') {
                await this.trelloGateway.markInProgress(id);
                console.log(`✅ Synced Sheet issue ${id} to Trello: IN PROGRESS`);
            } else if (status === 'IN REVIEW') {
                await this.trelloGateway.markInReview(id);
                console.log(`✅ Synced Sheet issue ${id} to Trello: IN REVIEW`);
            } else if (status === 'DONE') {
                await this.trelloGateway.markDone(id);
                console.log(`✅ Synced Sheet issue ${id} to Trello: DONE`);
            } else if (status === 'OPEN') {
                // Optionally move back to TODO/backlog
                await this.trelloGateway.markOpen(id);
                console.log(`✅ Synced Sheet issue ${id} to Trello: OPEN`);
            }
            return true;
        }

        return false;
    }
}

module.exports = SheetSyncWebhookController;
