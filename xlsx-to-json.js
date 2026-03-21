#!/usr/bin/env node

const fs = require("fs");
const XLSX = require("xlsx");

function normalizeRow(row) {
    const normalized = {};

    for (const [key, value] of Object.entries(row)) {
        normalized[(key || "").trim().toLowerCase()] = value;
    }

    return {
        id: normalized.id || String(Date.now()),
        title: normalized.title || normalized.name || "Untitled",
        description: normalized.description || "",
        steps: normalized.steps || "",
        expected: normalized.expected || "",
        actual: normalized.actual || "",
        priority: (normalized.priority || "MEDIUM").toUpperCase(),
        status: (normalized.status || "OPEN").toUpperCase(),
        reporter: normalized.reporter || "Unknown",
        date: normalized.date || new Date().toISOString(),
        chatId: normalized["chat id"] || normalized.chatid || "",
        image: normalized.image || normalized.imageurl || normalized.preview || normalized.video || normalized.videourl || "",
        preview: normalized.preview || "",
        video: normalized.video || normalized.videourl || "",
        mediaUrl: normalized.image || normalized.imageurl || normalized.preview || normalized.video || normalized.videourl || "",
        dueDate: normalized.duedate || null
    };
}

function main() {
    const inputPath = process.argv[2] || "Karmm Bug Tracker.xlsx";
    const outputPath = process.argv[3] || "issues.json";
    const sheetName = process.argv[4] || "Bugs";

    if (!fs.existsSync(inputPath)) {
        console.error(`❌ Input file not found: ${inputPath}`);
        process.exit(1);
    }

    try {
        console.log(`📖 Reading ${inputPath}...`);
        const workbook = XLSX.readFile(inputPath);
        
        // List available sheets
        console.log(`📄 Available sheets: ${workbook.SheetNames.join(", ")}`);
        
        if (!workbook.SheetNames.includes(sheetName)) {
            console.error(`❌ Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(", ")}`);
            process.exit(1);
        }

        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        if (!rows.length) {
            console.error("❌ Sheet is empty or has no data rows.");
            process.exit(1);
        }

        console.log(`📋 Found ${rows.length} rows`);
        
        const output = rows.map((row, index) => {
            try {
                return normalizeRow(row);
            } catch (error) {
                console.warn(`⚠️  Error processing row ${index + 1}: ${error.message}`);
                return null;
            }
        }).filter(item => item !== null);

        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

        console.log(`✅ Converted ${output.length} issues to ${outputPath}\n`);
        
        // Show first issue as preview
        if (output.length > 0) {
            console.log("📝 Sample (first issue):");
            console.log(JSON.stringify(output[0], null, 2));
        }
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

main();
