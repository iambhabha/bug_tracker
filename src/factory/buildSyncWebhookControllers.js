const TrelloSyncWebhookController = require("../controllers/TrelloSyncWebhookController");
const SheetSyncWebhookController = require("../controllers/SheetSyncWebhookController");

function buildSyncWebhookControllers({ sheetGateway, trelloGateway, telegramNotifier, trelloListStatusMap }) {
    const trelloSyncController = new TrelloSyncWebhookController({
        sheetGateway,
        notifier: telegramNotifier,
        trelloGateway
    });

    // Set up the list ID to status mapping for Trello
    if (trelloListStatusMap) {
        trelloSyncController.setListStatusMap(trelloListStatusMap);
    }

    const sheetSyncController = new SheetSyncWebhookController({
        trelloGateway,
        notifier: telegramNotifier
    });

    return {
        trelloSync: trelloSyncController,
        sheetSync: sheetSyncController
    };
}

module.exports = buildSyncWebhookControllers;
