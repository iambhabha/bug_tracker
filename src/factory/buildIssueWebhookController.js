const SheetIssueGateway = require("../services/SheetIssueGateway");
const TrelloIssueGateway = require("../services/TrelloIssueGateway");
const DualBackendIssueGateway = require("../services/DualBackendIssueGateway");
const TelegramOutboundNotifier = require("../services/TelegramOutboundNotifier");
const TelegramMediaEvidenceResolver = require("../services/TelegramMediaEvidenceResolver");
const TelegramIssueWorkflowRouter = require("../routing/TelegramIssueWorkflowRouter");
const TelegramIssueWebhookController = require("../controllers/TelegramIssueWebhookController");
const StartCommandSilencer = require("../commands/StartCommandSilencer");
const DoneIssueCommand = require("../commands/DoneIssueCommand");
const ProgressIssueCommand = require("../commands/ProgressIssueCommand");
const DeleteIssueCommand = require("../commands/DeleteIssueCommand");
const AssignIssueCommand = require("../commands/AssignIssueCommand");

function buildIssueWebhookController({ telegramToken, sheetWebhookUrl, trelloConfig, httpClient }) {
    let sheetGateway = null;
    let trelloGateway = null;

    if (sheetWebhookUrl) {
        sheetGateway = new SheetIssueGateway(sheetWebhookUrl, httpClient);
    }

    if (trelloConfig) {
        trelloGateway = new TrelloIssueGateway(trelloConfig, httpClient);
    }

    const issueGateway = new DualBackendIssueGateway(sheetGateway, trelloGateway);
    const telegramNotifier = new TelegramOutboundNotifier(telegramToken, httpClient);
    const mediaResolver = new TelegramMediaEvidenceResolver(telegramToken, httpClient);

    const commandRouter = new TelegramIssueWorkflowRouter([
        new StartCommandSilencer(issueGateway, telegramNotifier),
        new DoneIssueCommand(issueGateway, telegramNotifier),
        new ProgressIssueCommand(issueGateway, telegramNotifier),
        new DeleteIssueCommand(issueGateway, telegramNotifier),
        new AssignIssueCommand(issueGateway, telegramNotifier)
    ]);

    return new TelegramIssueWebhookController({
        issueGateway: issueGateway,
        notifier: telegramNotifier,
        mediaResolver,
        commandRouter
    });
}

module.exports = buildIssueWebhookController;