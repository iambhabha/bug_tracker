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
                "Usage: /linkchat <issueId>\n\nExample: /linkchat BUG-123"
            );
            return true;
        }

        // Update sheet with ChatID for the old issue
        await this.sheetIssueGateway.updateIssueChatId(issueId, executionContext.chatIdentifier);

        await this.telegramNotifier.send(
            executionContext.chatIdentifier,
            `✅ Bug ${issueId} linked to this chat!\nNow you'll receive notifications here.`
        );
        return true;
    }
}

module.exports = LinkChatCommand;
