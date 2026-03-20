const axios = require("axios");

/**
 * Migration script to add issue IDs to existing Trello cards
 * Run this once to update all existing cards with their issue IDs
 * 
 * Usage:
 * node update-trello-card-ids.js {BOARD_ID} {TRELLO_KEY} {TRELLO_TOKEN}
 */

const BOARD_ID = process.argv[2];
const TRELLO_KEY = process.argv[3];
const TRELLO_TOKEN = process.argv[4];

if (!BOARD_ID || !TRELLO_KEY || !TRELLO_TOKEN) {
    console.error("❌ Usage: node update-trello-card-ids.js <BOARD_ID> <TRELLO_KEY> <TRELLO_TOKEN>");
    process.exit(1);
}

const BASE_URL = "https://api.trello.com/1";
const AUTH_PARAMS = `key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;

async function getAllCards() {
    try {
        console.log("📋 Fetching all cards from Trello board...");
        const response = await axios.get(
            `${BASE_URL}/boards/${BOARD_ID}/cards?${AUTH_PARAMS}`
        );
        return response.data;
    } catch (error) {
        console.error("❌ Error fetching cards:", error.message);
        process.exit(1);
    }
}

function hasIssueId(cardName) {
    // Check if card already has ID format: ID-123, ISSUE-456, or #789
    return /^(ID|ISSUE)(-|#)\d+/.test(cardName) || /^#\d+/.test(cardName);
}

function extractIssueIdFromDescription(description) {
    // Try to extract issue ID from description
    if (!description) return null;

    const patterns = [
        /ID[:\s-]+(\d+)/i,
        /ISSUE[:\s-]+(\d+)/i,
        /Issue ID[:\s-]+(\d+)/i,
        /Chat ID[:\s-]+(\d+)/i
    ];

    for (const pattern of patterns) {
        const match = description.match(pattern);
        if (match) {
            return match[1];
        }
    }
    return null;
}

function generateIssueId() {
    // Generate ID based on current timestamp
    // Format: 16 digit timestamp number
    return Math.floor(Date.now() / 1000).toString();
}
const cards = await getAllCards();
let updated = 0;
let skipped = 0;
let failed = 0;

console.log(`\n📊 Found ${cards.length} cards to process\n`);

for (const card of cards) {
    // Skip if already has ID format
    if (hasIssueId(card.name)) {
        console.log(`⏭️  Skipped: "${card.name}" (already has ID format)`);
        skipped++;
        continue;
    }

    // Try to extract ID from description
    const issueId = extractIssueIdFromDescription(card.desc);

    if (issueId) {
        const success = await updateCardName(card.id, card.name, issueId);
        if (success) {
            updated++;
        } else {
            failed++;
        }
    } else {
        console.log(`⚠️  Could not find issue ID for: "${card.name}"`);
        console.log(`   Description: ${card.desc ? card.desc.substring(0, 50) : "N/A"}`);
        skipped++;
    }
}

console.log(`\n=================================`);
console.log(`📊 Migration Summary:`);
console.log(`   ✅ Updated: ${updated}`);
console.log(`   ⏭️  Skipped: ${skipped}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`=================================\n`);

migrateCards().catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
});
