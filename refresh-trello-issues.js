const axios = require("axios");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

/**
 * Script to delete old Trello cards and re-upload with issue IDs
 * 
 * Usage:
 * node refresh-trello-issues.js {BOARD_ID} {TRELLO_KEY} {TRELLO_TOKEN}
 */

const BOARD_ID = process.argv[2];
const TRELLO_KEY = process.argv[3];
const TRELLO_TOKEN = process.argv[4];

if (!BOARD_ID || !TRELLO_KEY || !TRELLO_TOKEN) {
    console.error("❌ Usage: node refresh-trello-issues.js <BOARD_ID> <TRELLO_KEY> <TRELLO_TOKEN>");
    process.exit(1);
}

const BASE_URL = "https://api.trello.com/1";
const AUTH_PARAMS = `key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;

// Read issues.json
const issuesPath = path.join(__dirname, "issues.json");
if (!fs.existsSync(issuesPath)) {
    console.error("❌ issues.json not found!");
    process.exit(1);
}

const issues = JSON.parse(fs.readFileSync(issuesPath, "utf8"));
console.log(`📋 Loaded ${issues.length} issues from issues.json\n`);

async function deleteExistingCards() {
    try {
        console.log("🗑️  Deleting existing cards...");
        const response = await axios.get(
            `${BASE_URL}/boards/${BOARD_ID}/cards?${AUTH_PARAMS}`
        );

        const cards = response.data;
        let deletedCount = 0;

        for (const card of cards) {
            try {
                await axios.delete(
                    `${BASE_URL}/cards/${card.id}?${AUTH_PARAMS}`
                );
                console.log(`   ✅ Deleted: "${card.name}"`);
                deletedCount++;
            } catch (error) {
                console.log(`   ⚠️  Failed to delete: "${card.name}"`);
            }
        }

        console.log(`\n✅ Deleted ${deletedCount}/${cards.length} cards\n`);
    } catch (error) {
        console.error("❌ Error deleting cards:", error.message);
        process.exit(1);
    }
}

async function getTodoListId() {
    try {
        const response = await axios.get(
            `${BASE_URL}/boards/${BOARD_ID}/lists?${AUTH_PARAMS}`
        );

        const lists = response.data;
        const todoList = lists.find(l =>
            l.name.toLowerCase().includes("issues") ||
            l.name.toLowerCase().includes("todo") ||
            l.name.toLowerCase().includes("backlog")
        );

        if (!todoList) {
            throw new Error("Todo list not found on board");
        }

        return todoList.id;
    } catch (error) {
        console.error("❌ Error getting todo list:", error.message);
        process.exit(1);
    }
}

function buildCardDescription(issue) {
    return [
        `Issue ID: ${issue.id || "N/A"}`,
        `Title: ${issue.title}`,
        `Description: ${issue.description || ""}`,
        `Priority: ${issue.priority || "MEDIUM"}`,
        `Status: ${issue.status || "OPEN"}`,
        `Reporter: ${issue.reporter || "Unknown"}`,
        `Date: ${issue.date || "N/A"}`,
        `Chat ID: ${issue.chatId || "N/A"}`
    ].join("\n\n");
}

function getFileExtension(contentType, mediaUrl) {
    if ((contentType || "").includes("image/jpeg")) return "jpg";
    if ((contentType || "").includes("image/png")) return "png";
    if ((contentType || "").includes("image/webp")) return "webp";
    if ((contentType || "").includes("video/mp4")) return "mp4";

    const cleanUrl = String(mediaUrl || "").split("?")[0];
    const parts = cleanUrl.split(".");
    if (parts.length > 1) {
        return parts.pop().toLowerCase();
    }
    return "bin";
}

async function attachMediaToCard(cardId, mediaUrl) {
    if (!mediaUrl) {
        return;
    }

    try {
        const mediaResponse = await axios.get(mediaUrl, {
            responseType: "arraybuffer",
            timeout: 20000
        });

        const contentType = mediaResponse.headers["content-type"] || "application/octet-stream";
        const extension = getFileExtension(contentType, mediaUrl);
        const form = new FormData();
        form.append("file", Buffer.from(mediaResponse.data), {
            filename: `evidence.${extension}`,
            contentType
        });

        const uploadResponse = await axios.post(
            `${BASE_URL}/cards/${cardId}/attachments?${AUTH_PARAMS}`,
            form,
            {
                headers: form.getHeaders(),
                maxBodyLength: Infinity
            }
        );

        if ((contentType || "").startsWith("image/") && uploadResponse.data && uploadResponse.data.id) {
            await axios.put(
                `${BASE_URL}/cards/${cardId}?${AUTH_PARAMS}`,
                { idAttachmentCover: uploadResponse.data.id }
            );
        }
    } catch (_error) {
        try {
            await axios.post(
                `${BASE_URL}/cards/${cardId}/attachments?${AUTH_PARAMS}`,
                {
                    url: mediaUrl,
                    name: "evidence"
                }
            );
        } catch (_fallbackError) {
            // Keep going even if attachment fails.
        }
    }
}

async function uploadIssuesAsCards(todoListId) {
    try {
        console.log("📤 Uploading issues as Trello cards...\n");
        let createdCount = 0;
        let failedCount = 0;

        for (const issue of issues) {
            try {
                const cardName = issue.title;
                const description = buildCardDescription(issue);

                const cardResponse = await axios.post(
                    `${BASE_URL}/cards?${AUTH_PARAMS}`,
                    {
                        name: cardName,
                        desc: description,
                        idList: todoListId,
                        due: issue.dueDate || null
                    }
                );

                console.log(`   ✅ Created: "${cardName}"`);
                createdCount++;

                // Add image attachment if available
                if (issue.mediaUrl) {
                    await attachMediaToCard(cardResponse.data.id, issue.mediaUrl);
                }
            } catch (error) {
                console.log(`   ❌ Failed to create: "${issue.title}"`);
                console.log(`      Error: ${error.response?.data?.message || error.message}`);
                failedCount++;
            }
        }

        console.log(`\n✅ Created ${createdCount}/${issues.length} cards`);
        if (failedCount > 0) {
            console.log(`❌ Failed: ${failedCount} cards`);
        }
    } catch (error) {
        console.error("❌ Error uploading cards:", error.message);
        process.exit(1);
    }
}

async function main() {
    console.log("=================================");
    console.log("🔄 REFRESH TRELLO ISSUES");
    console.log("=================================\n");

    // Step 1: Delete existing cards
    await deleteExistingCards();

    // Step 2: Get todo list ID
    console.log("🔍 Getting todo list...");
    const todoListId = await getTodoListId();
    console.log(`✅ Todo list ID: ${todoListId}\n`);

    // Step 3: Upload issues as cards
    await uploadIssuesAsCards(todoListId);

    console.log("\n=================================");
    console.log("✅ REFRESH COMPLETE!");
    console.log("=================================");
}

main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
});
