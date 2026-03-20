#!/usr/bin/env node

const fs = require("fs");
const { parse } = require("csv-parse/sync");

function normalizeRow(row) {
    const normalized = {};

    for (const [key, value] of Object.entries(row)) {
        normalized[(key || "").trim().toLowerCase()] = value;
    }

    return {
        id: normalized.id || String(Date.now()),
        title: normalized.title || normalized.name || "Untitled",
        description: normalized.description || "",
        priority: (normalized.priority || "MEDIUM").toUpperCase(),
        status: (normalized.status || "OPEN").toUpperCase(),
        reporter: normalized.reporter || "Unknown",
        date: normalized.date || new Date().toISOString(),
        chatId: normalized.chatid || "",
        image: normalized.image || normalized.imageurl || normalized.preview || normalized.video || normalized.videourl || "",
        preview: normalized.preview || "",
        video: normalized.video || normalized.videourl || "",
        mediaUrl: normalized.image || normalized.imageurl || normalized.preview || normalized.video || normalized.videourl || "",
        dueDate: normalized.duedate || null
    };
}

function main() {
    const inputPath = process.argv[2];
    const outputPath = process.argv[3] || "issues.json";

    if (!inputPath) {
        console.log("Usage: node csv-to-json.js <input.csv> [output.json]");
        process.exit(1);
    }

    if (!fs.existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        process.exit(1);
    }

    const raw = fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, "");
    const rows = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
        trim: true
    });

    if (!rows.length) {
        console.error("CSV must include at least one data row.");
        process.exit(1);
    }

    const output = rows.map((row) => normalizeRow(row));

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log(`Converted ${output.length} rows to ${outputPath}`);
}

main();
