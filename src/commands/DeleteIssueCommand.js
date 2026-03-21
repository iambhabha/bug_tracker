const IssueWorkflowCommand = require("./IssueWorkflowCommand");

class DeleteIssueCommand extends IssueWorkflowCommand {
    matches(executionContext) {
        return executionContext.messageText.startsWith("/delete");
    }

    async execute(executionContext) {
        const issueId = executionContext.messageText.split(" ")[1];
        if (!issueId) {
            await this.telegramNotifier.send(
                executionContext.chatIdentifier,
                "⚠️ Please provide a bug ID.\nUsage: /delete <issueId>"
            );
            return true;
        }

        await this.sheetIssueGateway.removeIssue(issueId);
        await this.telegramNotifier.send(
            executionContext.chatIdentifier,
            `🗑️ Bug ID: ${issueId} deleted.`
        );
        return true;
    }
}

module.exports = DeleteIssueCommand;