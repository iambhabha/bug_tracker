const express = require("express");
const axios = require("axios");
const buildIssueWebhookController = require("./src/factory/buildIssueWebhookController");
const IssuesMigration = require("./migration");

const app = express();
app.use(express.json({ limit: '50mb' }));

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const SHEET_WEBHOOK = process.env.SHEET_WEBHOOK;

// Trello configuration
const TRELLO_CONFIG = {
    key: process.env.TRELLO_KEY,
    token: process.env.TRELLO_TOKEN,
    boardId: process.env.TRELLO_BOARD_ID
};

const issueWebhookController = buildIssueWebhookController({
    telegramToken: TELEGRAM_TOKEN,
    sheetWebhookUrl: SHEET_WEBHOOK,
    trelloConfig: TRELLO_CONFIG,
    httpClient: axios
});

app.get("/", (req, res) => {
    res.send("Bug Bot Running");
});

app.post("/webhook", async (req, res) => {
    try {
        const message = req.body.message;
        if (!message) {
            return res.sendStatus(200);
        }

        await issueWebhookController.processIncomingMessage(message);
        return res.sendStatus(200);
    } catch (error) {
        console.error(error.message);
        return res.sendStatus(500);
    }
});

// Migration endpoint - POST issues data to migrate to Trello
app.post("/migrate-to-trello", async (req, res) => {
    try {
        const issuesData = req.body.issues;

        if (!issuesData || !Array.isArray(issuesData)) {
            return res.status(400).json({
                error: "Invalid format. Send POST with {issues: [...]}"
            });
        }

        console.log(`📋 Migration request received for ${issuesData.length} issues`);

        const formattedData = IssuesMigration.formatSheetData(issuesData);
        const migration = new IssuesMigration();
        const result = await migration.migrateIssuesFromSheet(formattedData);

        return res.json({
            success: true,
            message: `Migrated ${result.successCount}/${result.total} issues to Trello`,
            stats: result
        });

    } catch (error) {
        console.error("Migration error:", error.message);
        return res.status(500).json({
            error: error.message
        });
    }
});

app.listen(process.env.PORT || 3000);
