/**
 * @OnlyCurrentDoc
 */

// 📡 WEBHOOK CONFIG - Update this with your bot server URL
const BOT_SERVER_URL = "https://karmm-bug-tracker.onrender.com"; // Change this to your bot server

/**
 * Your doPost function starts here...
 */
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Bugs");

  if (!sheet) {
    return ContentService.createTextOutput("❌ Sheet not found");
  }

  const data = JSON.parse(e.postData.contents);
  const rows = sheet.getDataRange().getValues();

  // =========================
  // 🔄 UPDATE STATUS
  // =========================
  if (data.action === "update") {
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] == data.id) {
        sheet.getRange(i + 1, 8).setValue(data.status);
        beautifyDashboard(sheet);
        
        // 📡 Send webhook to bot server for Trello sync
        sendWebhookToBot({
          action: "update",
          id: data.id,
          status: data.status
        });
        
        return ContentService.createTextOutput("Updated");
      }
    }
  }

  // =========================
  // 👤 ASSIGN
  // =========================
  if (data.action === "assign") {
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] == data.id) {
        sheet.getRange(i + 1, 12).setValue(data.assignee);
        beautifyDashboard(sheet);
        return ContentService.createTextOutput("Assigned");
      }
    }
  }

  // =========================
  // 🔴 DELETE
  // =========================
  if (data.action === "delete") {
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] == data.id) {
        sheet.deleteRow(i + 1);
        beautifyDashboard(sheet);
        return ContentService.createTextOutput("Deleted");
      }
    }
  }

  // =========================
  // 🟢 CREATE BUG
  // =========================
  const newRow = sheet.getLastRow() + 1;

  sheet.getRange(newRow, 1, 1, 12).setValues([[
    data.id,
    data.title,
    data.description,
    data.steps,
    data.expected,
    data.actual,
    data.priority,
    data.status,
    data.image,
    data.reporter,
    data.date,
    "" // assignee
  ]]);

  // 📸 PREVIEW
  sheet.getRange(newRow, 13).setFormula(`=IMAGE(I${newRow},1)`);

  // 🔥 Row height
  sheet.setRowHeight(newRow, 250);

  // 🎨 BEAUTIFY
  beautifyDashboard(sheet);

  return ContentService.createTextOutput("Created");
}

// =========================
// 📡 SEND WEBHOOK TO BOT
// =========================
function sendWebhookToBot(payload) {
  try {
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(BOT_SERVER_URL + "/webhook/sheet-sync", options);
    const responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      console.log("✅ Webhook sent successfully:", payload);
    } else {
      console.log("⚠️ Webhook failed with code:", responseCode);
    }
  } catch (error) {
    console.log("❌ Webhook error:", error.toString());
  }
}

// =========================
// 🎨 DASHBOARD STYLING
// =========================
function beautifyDashboard(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = 13;

  // Freeze header
  sheet.setFrozenRows(1);

  // Header style
  const header = sheet.getRange(1, 1, 1, lastCol);
  header.setBackground("#111827");
  header.setFontColor("#ffffff");
  header.setFontWeight("bold");

  // Column widths
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 250);
  sheet.setColumnWidth(3, 400);
  sheet.setColumnWidth(7, 120);
  sheet.setColumnWidth(8, 150);
  sheet.setColumnWidth(9, 200);
  sheet.setColumnWidth(10, 200);
  sheet.setColumnWidth(11, 180);
  sheet.setColumnWidth(12, 150);
  sheet.setColumnWidth(13, 250);

  // Row banding
  sheet.getRange(2, 1, lastRow).applyRowBanding(
    SpreadsheetApp.BandingTheme.LIGHT_GREY
  );

  // Conditional formatting
  const rules = [];

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("HIGH")
      .setBackground("#ef4444")
      .setFontColor("#fff")
      .setRanges([sheet.getRange("G2:G")])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("MEDIUM")
      .setBackground("#facc15")
      .setRanges([sheet.getRange("G2:G")])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("LOW")
      .setBackground("#22c55e")
      .setFontColor("#fff")
      .setRanges([sheet.getRange("G2:G")])
      .build()
  );

  // ========== STATUS COLUMN FORMATTING ==========
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("OPEN")
      .setBackground("#ef4444")
      .setFontColor("#fff")
      .setRanges([sheet.getRange("H2:H")])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("IN PROGRESS")
      .setBackground("#facc15")
      .setFontColor("#000")
      .setRanges([sheet.getRange("H2:H")])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("IN REVIEW")
      .setBackground("#8b5cf6")
      .setFontColor("#fff")
      .setRanges([sheet.getRange("H2:H")])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("DONE")
      .setBackground("#22c55e")
      .setFontColor("#fff")
      .setRanges([sheet.getRange("H2:H")])
      .build()
  );

  sheet.setConditionalFormatRules(rules);

  // Filters
  if (!sheet.getFilter()) {
    sheet.getRange(1, 1, lastRow, lastCol).createFilter();
  }

  // Alignment
  sheet.getRange(2, 1, lastRow, lastCol).setVerticalAlignment("middle");
}

// =========================
// 🔔 ONCHANGE TRIGGER (Optional - for direct cell changes)
// =========================
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  
  // Only handle "Bugs" sheet
  if (sheet.getName() !== "Bugs") {
    return;
  }

  // Column H is Status (column 8)
  if (e.range.getColumn() === 8) {
    const row = e.range.getRow();
    const issueId = sheet.getRange(row, 1).getValue(); // Get ID from column A
    const newStatus = e.value; // New status value

    if (issueId && newStatus) {
      console.log(`Status changed for issue ${issueId} to ${newStatus}`);
      
      // Send webhook
      sendWebhookToBot({
        action: "update",
        id: issueId,
        status: newStatus
      });

      // Beautify after change
      beautifyDashboard(sheet);
    }
  }
}
