class TelegramMediaEvidenceResolver {
    constructor(telegramToken, httpClient) {
        this.telegramToken = telegramToken;
        this.httpClient = httpClient;
    }

    async extractMediaUrl(messageEnvelope) {
        const fileId = this.resolveFileId(messageEnvelope);
        if (!fileId) {
            return "";
        }

        const telegramFileLookup = await this.httpClient.get(
            `https://api.telegram.org/bot${this.telegramToken}/getFile?file_id=${fileId}`
        );

        return `https://api.telegram.org/file/bot${this.telegramToken}/${telegramFileLookup.data.result.file_path}`;
    }

    resolveFileId(messageEnvelope) {
        if (messageEnvelope.photo && messageEnvelope.photo.length > 0) {
            return messageEnvelope.photo[messageEnvelope.photo.length - 1].file_id;
        }

        if (messageEnvelope.video && messageEnvelope.video.file_id) {
            return messageEnvelope.video.file_id;
        }

        if (messageEnvelope.document && messageEnvelope.document.file_id) {
            return messageEnvelope.document.file_id;
        }

        return "";
    }
}

module.exports = TelegramMediaEvidenceResolver;