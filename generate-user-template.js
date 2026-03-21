#!/usr/bin/env node

const fs = require("fs");

/**
 * Auto-generate telegram-users.json from unique reporters in issues.json
 * This will create a template that you just need to fill with chat IDs
 */

function main() {
  if (!fs.existsSync("./issues.json")) {
    console.error("❌ issues.json not found");
    process.exit(1);
  }

  const data = fs.readFileSync("./issues.json", "utf-8");
  const issues = JSON.parse(data);

  // Extract unique reporters
  const reporters = new Set();
  issues.forEach(issue => {
    if (issue.reporter) {
      reporters.add(issue.reporter);
    }
  });

  const reporterArray = Array.from(reporters).sort();

  console.log(`📋 Found ${reporterArray.length} unique reporters:`);
  console.log("   " + reporterArray.join(", "));

  // Generate mapping template
  const mapping = reporterArray.map(reporter => ({
    username: reporter,
    chatId: "",
    count: issues.filter(i => i.reporter === reporter).length
  }));

  // Save as template
  fs.writeFileSync("telegram-users-template.json", JSON.stringify(mapping, null, 2));

  console.log(`\n✅ Template saved to telegram-users-template.json`);
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Check your Telegram bot's Render logs`);
  console.log(`   2. Find the chat.id for each reporter`);
  console.log(`   3. Fill in the chatId fields in telegram-users-template.json`);
  console.log(`   4. Rename it to telegram-users.json`);
  console.log(`   5. Run: node populate-chatids.js`);

  console.log(`\n📊 Reporter email counts:`);
  mapping.forEach(item => {
    console.log(`   "${item.username}": ${item.count} issues`);
  });
}

main();
