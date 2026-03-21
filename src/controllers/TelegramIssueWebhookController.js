const fs = require("fs");
const path = require("path");
const TelegramReporterIdentity = require("../domain/TelegramReporterIdentity");
const TelegramIncomingContent = require("../domain/TelegramIncomingContent");
const IssuePayloadComposer = require("../domain/IssuePayloadComposer");
const IssueCommandExecutionContext = require("../commands/IssueCommandExecutionContext");

const TELEGRAM_USERS_FILE = path.resolve(process.cwd(), "telegram-users.json");

class TelegramIssueWebhookController {
    constructor({ issueGateway, notifier, mediaResolver, commandRouter }) {
        this.issueGateway = issueGateway;
        this.notifier = notifier;
        this.mediaResolver = mediaResolver;
        this.commandRouter = commandRouter;
    }

    async processIncomingMessage(telegramMessage) {
        const chatIdentifier = telegramMessage.chat.id;
        const reporterIdentity = TelegramReporterIdentity.composeReporter(telegramMessage.from);

        const { messageText, consolidatedContent } = TelegramIncomingContent.parse(telegramMessage);
        this.upsertUserChatMapping(telegramMessage, reporterIdentity, chatIdentifier);

        if ((messageText || "").trim().toLowerCase() === "/mychatid") {
            await this.notifier.send(chatIdentifier, `Your chat ID is: ${chatIdentifier}`);
            return;
        }

        const commandExecutionContext = new IssueCommandExecutionContext({
            chatIdentifier,
            messageText,
            replyToMessage: telegramMessage.reply_to_message
        });

        const commandHandled = await this.commandRouter.tryHandle(commandExecutionContext);
        if (commandHandled) {
            return;
        }

        if (!consolidatedContent) {
            return;
        }

        const evidenceImageUrl = await this.mediaResolver.extractMediaUrl(telegramMessage);
        const issuePayload = IssuePayloadComposer.buildIssuePayload({
            issueText: consolidatedContent,
            issueReporter: reporterIdentity,
            evidenceImageUrl,
            chatId: chatIdentifier
        });

        await this.issueGateway.createIssue(issuePayload);

        await this.notifier.send(
            chatIdentifier,
            [
                "Bug created",
                `ID: ${issuePayload.id}`,
                `Title: ${issuePayload.title}`,
                `Priority: ${issuePayload.priority}`,
                `Reporter: ${issuePayload.reporter}`,
                "Status: OPEN"
            ].join("\n")
        );
    }

    upsertUserChatMapping(telegramMessage, reporterIdentity, chatIdentifier) {
        try {
            const from = telegramMessage.from || {};
            const fullName = `${from.first_name || ""} ${from.last_name || ""}`.trim();
            const reporterAlias = this.extractReporterAlias(reporterIdentity);

            const candidateNames = [
                reporterIdentity,
                reporterAlias,
                fullName,
                from.username ? `@${from.username}` : "",
                from.username || ""
            ].filter(Boolean);

            let records = [];
            if (fs.existsSync(TELEGRAM_USERS_FILE)) {
                records = JSON.parse(fs.readFileSync(TELEGRAM_USERS_FILE, "utf-8"));
            }

            for (const name of candidateNames) {
                const existing = records.find(
                    (item) => (item.username || "").toLowerCase() === name.toLowerCase()
                );

                if (existing) {
                    existing.chatId = String(chatIdentifier);
                } else {
                    records.push({ username: name, chatId: String(chatIdentifier) });
                }
            }

            fs.writeFileSync(TELEGRAM_USERS_FILE, JSON.stringify(records, null, 2));
        } catch (error) {
            console.error("Failed to auto-save telegram user mapping:", error.message);
        }
    }

    extractReporterAlias(reporterIdentity) {
        if (!reporterIdentity) {
            return "";
        }

        const bracketMatch = reporterIdentity.match(/\(([^)]+)\)/);
        if (bracketMatch && bracketMatch[1]) {
            return bracketMatch[1];
        }

        return reporterIdentity;
    }
}

module.exports = TelegramIssueWebhookController;