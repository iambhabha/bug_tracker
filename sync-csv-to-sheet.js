const fs = require('fs');
const path = require('path');
const axios = require('axios');
const csv = require('csv-parse/sync');
require('dotenv').config();

const SHEET_WEBHOOK = process.env.SHEET_WEBHOOK;
const CSV_FILE = path.join(__dirname, 'AB9e2e0x - karmm.csv');

function parseCardDescription(desc) {
    if (!desc) return {};
    const lines = desc.split('\n');
    const info = {};
    let currentKey = '';

    lines.forEach(line => {
        const titleMatch = line.match(/^(Title|Description|Steps|Expected|Actual|Priority|Status|Reporter|Date|Chat ID):\s*(.*)/i);
        if (titleMatch) {
            currentKey = titleMatch[1].toLowerCase().replace(' ', '');
            info[currentKey] = titleMatch[2].trim();
        } else if (currentKey && line.trim()) {
            info[currentKey] += '\n' + line.trim();
        }
    });

    return info;
}

function extractIssueIdFromText(text) {
    if (!text) return null;
    const match = text.match(/Issue ID:\s*(\d+)/i) || text.match(/(\d{13})/);
    return match ? match[1] : null;
}

async function sync() {
    console.log("🚀 Starting Sequential Sync from CSV to Google Sheets (Reliable Mode)...\n");

    if (!fs.existsSync(CSV_FILE)) {
        console.error(`❌ CSV File not found: ${CSV_FILE}`);
        return;
    }

    try {
        // Step 1: Read and Parse CSV
        const fileContent = fs.readFileSync(CSV_FILE, 'utf-8');
        const records = csv.parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true
        });

        console.log(`📋 Found ${records.length} records in CSV.\n`);
        console.log(`⚠️  Using sequential mode with delay to ensure Google Script doesn't time out.\n`);

        let syncCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        const failedRecords = [];

        // Load already synced IDs to skip them
        const syncedIdsFile = path.join(__dirname, 'already-synced-ids.txt');
        const alreadySyncedIds = fs.existsSync(syncedIdsFile)
            ? fs.readFileSync(syncedIdsFile, 'utf-8').split('\n').map(id => id.trim()).filter(id => id)
            : [];

        console.log(`ℹ️  Will skip ${alreadySyncedIds.length} IDs already in the Sheet.\n`);

        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const cardName = record['Card Name'];
            const cardDesc = record['Card Description'];
            const listName = record['List Name'];

            const bugId = extractIssueIdFromText(cardDesc) || record['Card ID'];

            // SKIP if already synced
            if (alreadySyncedIds.includes(String(bugId))) {
                skippedCount++;
                continue;
            }

            const attachmentLinks = record['Attachment Links'] || '';
            const imageUrl = attachmentLinks.split(',')[0].trim();

            const parsedInfo = parseCardDescription(cardDesc);

            const title = parsedInfo.title || cardName;
            // Map "Issues" list to "OPEN" status as requested by user
            let status = listName || parsedInfo.status || "OPEN";
            if (status.toLowerCase() === "issues") status = "OPEN";

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
                date: parsedInfo.date || record['Last Activity Date'] || new Date().toISOString(),
                chatId: parsedInfo.chatid || "N/A",
                image: imageUrl,
                skipBeautify: true // NEW: Skip expensive styling during bulk sync
            };

            console.log(`📡 [${i + 1}/${records.length}] Syncing: [${bugId}] "${title.substring(0, 40)}..."`);

            let success = false;
            let retries = 0;
            const maxRetries = 3;

            while (!success && retries < maxRetries) {
                try {
                    if (retries > 0) {
                        const waitTime = Math.pow(2, retries) * 1000;
                        console.log(`   🔄 Retry ${retries}/${maxRetries} after ${waitTime}ms...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }

                    const response = await axios.post(SHEET_WEBHOOK, payload, {
                        timeout: 90000, // Increased timeout to 90s
                        headers: { 'Content-Type': 'application/json' }
                    });

                    const result = String(response.data);

                    if (result.includes("Created") || result.includes("OK") || result.includes("Updated")) {
                        console.log(`   ✅ Success: ${result}`);
                        syncCount++;
                        success = true;
                    } else {
                        console.warn(`   ⚠️ Warning: Unexpected response: ${result.substring(0, 100)}`);
                        retries++;
                    }
                } catch (error) {
                    console.error(`   ❌ Attempt ${retries + 1} failed: ${error.message}`);
                    retries++;
                    if (retries >= maxRetries) {
                        failedCount++;
                        failedRecords.push({ id: bugId, title: title, error: error.message });
                    }
                }
            }

            // Small delay to let Google Script finish (increased from 2s to 3s for stability)
            if (i < records.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        if (failedRecords.length > 0) {
            console.log("\n❌ FAILED RECORDS SUMMARY:");
            failedRecords.forEach(f => console.log(`   - [${f.id}] ${f.title}: ${f.error}`));

            // Save failed records to a JSON for later retry
            fs.writeFileSync('failed-sync-records.json', JSON.stringify(failedRecords, null, 2));
            console.log(`\n📄 Failed records saved to failed-sync-records.json`);
        }

        console.log("\n=================================");
        console.log(`✅ SYNC SESSION COMPLETE!`);
        console.log(`🆕 Total Synced: ${syncCount}`);
        console.log(`⏭️  Total Skipped: ${skippedCount}`);
        console.log(`❌ Total Failed: ${failedCount}`);
        console.log("=================================\n");

    } catch (error) {
        console.error("❌ Error during CSV sync:", error.message);
    }
}

sync();
