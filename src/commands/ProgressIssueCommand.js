const IssueWorkflowCommand = require("./IssueWorkflowCommand");

class ProgressIssueCommand extends IssueWorkflowCommand {
    matches(executionContext) {
        return executionContext.messageText.startsWith("/progress");
    }

    async execute(executionContext) {
        const issueId = executionContext.messageText.split(" ")[1];
        if (!issueId) {
            await this.telegramNotifier.send(
                executionContext.chatIdentifier,
                "⚠️ Please provide a bug ID.\nUsage: /progress <issueId>"
            );
            return true;
        }

        await this.sheetIssueGateway.markInProgress(issueId);
        await this.telegramNotifier.send(
            executionContext.chatIdentifier,
            `🚧 Bug ID: ${issueId} moved to IN PROGRESS.`
        );
        return true;
    }
}

module.exports = ProgressIssueCommand;