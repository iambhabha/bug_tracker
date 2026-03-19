class IssueCommandExecutionContext {
    constructor({ chatIdentifier, messageText, replyToMessage }) {
        this.chatIdentifier = chatIdentifier;
        this.messageText = messageText;
        this.replyToMessage = replyToMessage;
    }
}

module.exports = IssueCommandExecutionContext;