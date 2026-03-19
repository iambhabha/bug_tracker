const IssueWorkflowCommand = require("./IssueWorkflowCommand");

class AssignIssueCommand extends IssueWorkflowCommand {
    matches(executionContext) {
        return executionContext.messageText.startsWith("/assign");
    }

    async execute(executionContext) {
        const commandSegments = executionContext.messageText.split(" ");
        let issueId = commandSegments[1];
        let responsibleOwner = commandSegments[2];

        // अगर issue ID नहीं दिया गया, तो replied message से निकालें
        if (!issueId && executionContext.replyToMessage) {
            const replyText = executionContext.replyToMessage.text || "";
            const idMatch = replyText.match(/ID:\s*(\S+)/);
            if (idMatch) {
                issueId = idMatch[1];
                responsibleOwner = commandSegments[1]; // पहला argument अब responsible owner है
            }
        }

        if (!issueId) {
            await this.telegramNotifier.send(
                executionContext.chatIdentifier,
                "Error: Please reply to a bug message or provide issue ID\nUsage: /assign <issueId> <owner> or reply to bug message with /assign <owner>"
            );
            return true;
        }

        await this.sheetIssueGateway.assignIssue(issueId, responsibleOwner);
        await this.telegramNotifier.send(
            executionContext.chatIdentifier,
            `Bug ${issueId} assigned to ${responsibleOwner}`
        );
        return true;
    }
}

module.exports = AssignIssueCommand;