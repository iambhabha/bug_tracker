const IssueWorkflowCommand = require("./IssueWorkflowCommand");

class LinkChatCommand extends IssueWorkflowCommand {
    matches(executionContext) {
        return executionContext.messageText.startsWith("/linkchat");
    }

    async execute(executionContext) {
        const commandSegments = executionContext.messageText.split(" ");
        const issueId = commandSegments[1];

        if (!issueId) {
            await this.telegramNotifier.send(
                executionContext.chatIdentifier,
                "⚠️ Please provide a bug ID.\nUsage: /linkchat <issueId>\nExample: /linkchat 1773912825965"
            );
            return true;
        }

        // Update sheet with ChatID for the old issue
        await this.sheetIssueGateway.updateIssueChatId(issueId, executionContext.chatIdentifier);

        await this.telegramNotifier.send(
            executionContext.chatIdentifier,
            `🔗 Bug ID: ${issueId} linked to this chat.\nYou will receive updates here.`
        );
        return true;
    }
}

module.exports = LinkChatCommand;
