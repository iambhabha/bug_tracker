const fs = require("fs");
const axios = require("axios");
require("dotenv").config();

/**
 * Script to populate chatId for existing issues
 * 
 * This script:
 * 1. Reads from issues.json
 * 2. Extracts reporter names and matches with telegram-users.json
 * 3. Sends linkchat webhooks to update Google Sheet
 */

const SHEET_WEBHOOK_URL = process.env.SHEET_WEBHOOK;
const FORCE_CHAT_ID = process.env.FORCE_CHAT_ID || process.argv[2] || "";

if (!SHEET_WEBHOOK_URL) {
  console.error("❌ SHEET_WEBHOOK_URL not found in .env");
  process.exit(1);
}

function isValidTelegramChatId(chatId) {
  if (!chatId) {
    return false;
  }

  const normalized = String(chatId).trim();
  if (!normalized || normalized === "YOUR_CHAT_ID_HERE") {
    return false;
  }

  return /^-?\d+$/.test(normalized);
}

function extractReporterName(reporterString) {
  // Extract name from formats like:
  // "Bhabha", "@username", "unknown (Bhabha)", "First Last"
  
  if (reporterString.includes("(") && reporterString.includes(")")) {
    // Format: "unknown (Bhabha)"
    const match = reporterString.match(/\(([^)]+)\)/);
    return match ? match[1] : reporterString;
  }
  
  if (reporterString.startsWith("@")) {
    // Format: "@username"
    return reporterString;
  }
  
  return reporterString;
}

function getChatIdFromMapping(reporter, userMapping) {
  const reporterName = extractReporterName(reporter);
  
  for (const user of userMapping) {
    // Check exact match
    if (user.username === reporterName && isValidTelegramChatId(user.chatId)) {
      return user.chatId;
    }
    
    // Check if username contains reporter name (case insensitive)
    if (user.username.toLowerCase().includes(reporterName.toLowerCase()) && isValidTelegramChatId(user.chatId)) {
      return user.chatId;
    }
    
    // Check if reporter name contains username (case insensitive)
    if (reporterName.toLowerCase().includes(user.username.toLowerCase()) && isValidTelegramChatId(user.chatId)) {
      return user.chatId;
    }
  }
  
  return null;
}

async function populateChatIds() {
  try {
    // Read issues from JSON
    let issues = [];
    if (fs.existsSync("./issues.json")) {
      const data = fs.readFileSync("./issues.json", "utf-8");
      issues = JSON.parse(data);
    }

    if (issues.length === 0) {
      console.log("📭 No issues found in issues.json");
      return;
    }

    if (isValidTelegramChatId(FORCE_CHAT_ID)) {
      console.log(`📋 Found ${issues.length} issues`);
      console.log(`⚡ Force mode enabled: applying chatId ${FORCE_CHAT_ID} to all issues\n`);

      let updated = 0;
      for (const issue of issues) {
        try {
          await axios.post(SHEET_WEBHOOK_URL, {
            action: "linkchat",
            id: issue.id,
            chatId: String(FORCE_CHAT_ID)
          });
          updated++;
          console.log(`✅ Linked chatId ${FORCE_CHAT_ID} → Issue ${issue.id}`);
        } catch (error) {
          console.error(`❌ Error linking chatId for issue ${issue.id}:`, error.message);
        }
      }

      console.log(`\n📊 Summary:`);
      console.log(`   ✅ Updated: ${updated}`);
      console.log(`   ℹ️  Total issues: ${issues.length}`);
      return;
    }

    // Read user mapping
    let userMapping = [];
    if (fs.existsSync("./telegram-users.json")) {
      const mappingData = fs.readFileSync("./telegram-users.json", "utf-8");
      userMapping = JSON.parse(mappingData);
    }

    const validMappings = userMapping.filter((entry) => isValidTelegramChatId(entry.chatId));

    if (userMapping.length === 0) {
      console.log("⚠️  No user mapping found. Create telegram-users.json with reporter -> chatId mapping");
      console.log("📝 File format:");
      console.log('[');
      console.log('  { "username": "Bhabha", "chatId": "123456789" },');
      console.log('  { "username": "@username", "chatId": "987654321" }');
      console.log(']');
      return;
    }

    if (validMappings.length === 0) {
      console.log("⚠️  Mapping file found, but no valid chat IDs were present.");
      console.log("   Replace placeholders like YOUR_CHAT_ID_HERE with numeric Telegram chat IDs.");
      return;
    }

    console.log(`📋 Found ${issues.length} issues`);
    console.log(`👥 User mapping: ${userMapping.length} users (${validMappings.length} valid chat IDs)\n`);
    
    let updated = 0;
    let alreadyHad = 0;
    let matched = 0;
    let noMatch = 0;
    const failedIssues = [];

    for (const issue of issues) {
      if (issue.chatId) {
        // Already has chatId
        alreadyHad++;
        continue;
      }

      // Try to find chatId from reporter mapping
      const foundChatId = getChatIdFromMapping(issue.reporter, userMapping);
      
      if (!foundChatId) {
        console.log(`⚠️  No match found for reporter: "${issue.reporter}" (Issue: ${issue.id})`);
        noMatch++;
        failedIssues.push({
          id: issue.id,
          title: issue.title,
          reporter: issue.reporter
        });
        continue;
      }

      try {
        await axios.post(SHEET_WEBHOOK_URL, {
          action: "linkchat",
          id: issue.id,
          chatId: foundChatId
        });
        
        console.log(`✅ Linked chatId ${foundChatId} for "${extractReporterName(issue.reporter)}" → Issue ${issue.id}`);
        matched++;
        updated++;
      } catch (error) {
        console.error(`❌ Error linking chatId for issue ${issue.id}:`, error.message);
        failedIssues.push({
          id: issue.id,
          title: issue.title,
          reporter: issue.reporter,
          error: error.message
        });
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ℹ️  Already had chatId: ${alreadyHad}`);
    console.log(`   🔗 Matched from mapping: ${matched}`);
    console.log(`   ❌ No match found: ${noMatch}`);

    if (noMatch > 0 && failedIssues.length > 0) {
      console.log(`\n📝 Issues without chat ID:`);
      failedIssues.slice(0, 5).forEach(issue => {
        console.log(`   - [${issue.id}] "${issue.reporter}" - ${issue.title}`);
      });
      if (failedIssues.length > 5) {
        console.log(`   ... and ${failedIssues.length - 5} more`);
      }
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

// Run the script
console.log("🚀 Starting chatId population from reporter names...\n");
populateChatIds().then(() => {
  console.log("\n✨ Done!");
});
