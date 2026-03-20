#!/usr/bin/env node

const IssuesMigration = require('./migration');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('🚀 Starting Karmm Issues Migration to Trello\n');

    // Check if JSON file provided
    const jsonFilePath = process.argv[2];

    if (!jsonFilePath) {
        console.log('❌ Usage: node migrate-issues.js <path-to-issues.json>');
        console.log('\nExample JSON format:');
        console.log(JSON.stringify([
            {
                "title": "Login button not working",
                "description": "User cannot click login button on home page",
                "priority": "HIGH",
                "status": "OPEN",
                "reporter": "John Doe",
                "date": "2024-03-20",
                "chatId": "123456",
                "image": "https://..."
            }
        ], null, 2));
        process.exit(1);
    }

    try {
        // Read and parse JSON file
        if (!fs.existsSync(jsonFilePath)) {
            throw new Error(`File not found: ${jsonFilePath}`);
        }

        const rawData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
        console.log(`📂 Loaded ${rawData.length} issues from ${jsonFilePath}\n`);

        // Format data
        const formattedData = IssuesMigration.formatSheetData(rawData);

        // Run migration
        const migration = new IssuesMigration();
        const result = await migration.migrateIssuesFromSheet(formattedData);

        if (result.errorCount > 0) {
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

main();
