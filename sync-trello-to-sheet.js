const axios = require("axios");
const path = require("path");
require("dotenv").config();

const TRELLO_KEY = process.env.TRELLO_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const BOARD_ID = process.env.TRELLO_BOARD_ID;
const SHEET_WEBHOOK = process.env.SHEET_WEBHOOK;

const BASE_URL = "https://api.trello.com/1";
const AUTH_PARAMS = `key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;

function extractIssueIdFromText(text) {
    const raw = String(text || "");
    const patterns = [
        /^ID-(\d+)/i,
        /^ISSUE-(\d+)/i,
        /^#(\d+)/,
        /Issue ID[:\s-]+(\d+)/i,
        /\bID[:\s-]+(\d+)/i
    ];

    for (const pattern of patterns) {
        const match = raw.match(pattern);
        if (match) {
            return match[1];
        }
    }

    return null;
}

function parseCardDescription(desc) {
    const lines = (desc || "").split("\n");
    const data = {};
    
    lines.forEach(line => {
        const lowerLine = line.toLowerCase();
        if (lowerLine.startsWith("issue id:")) data.id = extractIssueIdFromText(line);
        if (lowerLine.startsWith("title:")) data.title = line.substring(line.indexOf(":") + 1).trim();
        if (lowerLine.startsWith("description:")) data.description = line.substring(line.indexOf(":") + 1).trim();
        if (lowerLine.startsWith("steps:")) data.steps = line.substring(line.indexOf(":") + 1).trim();
        if (lowerLine.startsWith("expected:")) data.expected = line.substring(line.indexOf(":") + 1).trim();
        if (lowerLine.startsWith("actual:")) data.actual = line.substring(line.indexOf(":") + 1).trim();
        if (lowerLine.startsWith("priority:")) data.priority = line.substring(line.indexOf(":") + 1).trim();
        if (lowerLine.startsWith("status:")) data.status = line.substring(line.indexOf(":") + 1).trim();
        if (lowerLine.startsWith("reporter:")) data.reporter = line.substring(line.indexOf(":") + 1).trim();
        if (lowerLine.startsWith("date:")) data.date = line.substring(line.indexOf(":") + 1).trim();
        if (lowerLine.startsWith("chat id:")) data.chatId = line.substring(line.indexOf(":") + 1).trim();
    });
    
    return data;
}

async function getCardAttachmentUrl(cardId) {
    try {
        const response = await axios.get(`${BASE_URL}/cards/${cardId}/attachments?${AUTH_PARAMS}`);
        const attachments = response.data || [];
        const imageAttachment = attachments.find(a => 
            a.mimeType && a.mimeType.startsWith("image/")
        ) || attachments[0];
        
        return imageAttachment ? (imageAttachment.url || imageAttachment.previews?.[0]?.url || null) : null;
    } catch (error) {
        return null;
    }
}

async function sync() {
    console.log("🚀 Starting Optimized Trello to Google Sheets Sync...\n");

    try {
        // Step 1: CLEAR ALL from Sheet - FASTEST WAY
        console.log("🗑️  Clearing all existing data from Google Sheet...");
        try {
            const clearResponse = await axios.post(SHEET_WEBHOOK, { action: "clearAll" });
            console.log(`✅ ${clearResponse.data}\n`);
        } catch (error) {
            console.warn("⚠️ Failed to clearAll via API (Script not updated?). Manually clearing row-by-row might be slow.\n");
        }

        // Step 2: Get Trello Lists for status mapping
        const listsResponse = await axios.get(`${BASE_URL}/boards/${BOARD_ID}/lists?${AUTH_PARAMS}`);
        const listMap = {};
        listsResponse.data.forEach(list => {
            listMap[list.id] = list.name;
        });

        // Step 3: Fetch all cards from Trello WITH attachments in one go
        console.log("🔍 Fetching all cards from Trello (with attachments)...");
        const response = await axios.get(`${BASE_URL}/boards/${BOARD_ID}/cards?attachments=true&${AUTH_PARAMS}`);
        const cards = response.data;
        console.log(`📋 Found ${cards.length} cards on Trello board.\n`);

        let syncCount = 0;
        let failedCount = 0;

        for (const card of cards) {
            const bugId = extractIssueIdFromText(card.desc || card.name);
            if (!bugId) continue;

            const parsedInfo = parseCardDescription(card.desc);
            const title = parsedInfo.title || card.name;
            
            // Get Image from pre-fetched attachments
            const attachments = card.attachments || [];
            const imageAttachment = attachments.find(a => 
                a.mimeType && a.mimeType.startsWith("image/")
            ) || attachments[0];
            const imageUrl = imageAttachment ? (imageAttachment.url || imageAttachment.previews?.[0]?.url || "") : "";

            let status = listMap[card.idList] || parsedInfo.status || "OPEN";
            if (status.toLowerCase() === "issues") status = "OPEN";

            // Generate Steps, Expected, Actual if missing
            const steps = parsedInfo.steps || `1. Open app\n2. Perform "${title}"\n3. Observe issue`;
            const expected = parsedInfo.expected || "Feature should work correctly";
            const actual = parsedInfo.actual || `"${title}" issue occurring`;

            const payload = {
                action: "create",
                id: bugId,
                title: title,
                description: parsedInfo.description || title,
                steps: steps,
                expected: expected,
                actual: actual,
                priority: parsedInfo.priority || "MEDIUM",
                status: status,
                reporter: parsedInfo.reporter || "Unknown",
                date: parsedInfo.date || new Date().toISOString(),
                chatId: parsedInfo.chatId || "N/A",
                image: imageUrl
            };

            try {
                await axios.post(SHEET_WEBHOOK, payload);
                console.log(`✅ Synced: [${bugId}] "${card.name.substring(0, 40)}..." (Status: ${status})`);
                syncCount++;
            } catch (error) {
                console.error(`❌ Failed: [${bugId}] "${card.name}" - ${error.message}`);
                failedCount++;
            }
        }

        console.log("\n=================================");
        console.log(`✅ SYNC COMPLETE!`);
        console.log(`🆕 Total Synced: ${syncCount}`);
        console.log(`❌ Total Failed: ${failedCount}`);
        console.log("=================================\n");
    } catch (error) {
        console.error("❌ Error during sync:", error.message);
    }
}

sync();

