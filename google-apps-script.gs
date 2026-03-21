/**
 * @OnlyCurrentDoc
 */

// 📡 WEBHOOK CONFIG - Update this with your bot server URL
const BOT_SERVER_URL = "https://karmm-bug-tracker.onrender.com"; // Change this to your bot server

function getColumnIndexByHeader(sheet, headerName, fallbackIndex) {
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 14)).getValues()[0];
  const target = String(headerName || "").trim().toLowerCase();

  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i] || "").trim().toLowerCase() === target) {
      return i + 1;
    }
  }

  return fallbackIndex;
}

function normalizeChatIdPreviewColumns(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    return;
  }

  const colChatId = 13;
  const colPreview = 14;

  const headerChat = sheet.getRange(1, colChatId).getValue();
  const headerPreview = sheet.getRange(1, colPreview).getValue();

  // Enforce header names for stable behavior.
  if (String(headerChat || "").trim().toLowerCase() !== "chat id") {
    sheet.getRange(1, colChatId).setValue("Chat ID");
  }
  if (String(headerPreview || "").trim().toLowerCase() !== "preview") {
    sheet.getRange(1, colPreview).setValue("Preview");
  }

  if (lastRow < 2) {
    return;
  }

  for (let row = 2; row <= lastRow; row++) {
    const chatCell = sheet.getRange(row, colChatId);
    const previewCell = sheet.getRange(row, colPreview);
    const imageCell = sheet.getRange(row, 9);

    const chatFormula = chatCell.getFormula();
    const previewFormula = previewCell.getFormula();
    const chatValue = chatCell.getValue();
    const previewValue = previewCell.getValue();

    // If preview formula is accidentally in Chat ID column, move it to Preview.
    if (chatFormula && String(chatFormula).toUpperCase().indexOf("=IMAGE(") === 0) {
      if (!previewFormula) {
        previewCell.setFormula(chatFormula);
      }
      chatCell.clearContent();
      continue;
    }

    // If chat ID was previously written in old Preview column, move it to Chat ID.
    if (!chatValue && previewValue && !previewFormula) {
      const normalizedPreviewValue = String(previewValue).trim();
      if (/^-?\d+$/.test(normalizedPreviewValue)) {
        chatCell.setValue(normalizedPreviewValue);
        previewCell.clearContent();
      }
    }

    // Ensure Preview column has image formula if image URL exists and no formula is present.
    if (!previewCell.getFormula()) {
      const imageValue = String(imageCell.getValue() || "").trim();
      if (imageValue) {
        previewCell.setFormula(`=IMAGE(I${row})`);
      }
    }
  }
}

function fixExistingChatIdPreviewColumns() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Bugs");
  if (!sheet) {
    return "Sheet not found";
  }

  normalizeChatIdPreviewColumns(sheet);
  beautifyDashboard(sheet);
  return "✅ Chat ID / Preview columns repaired";
}

/**
 * Initialize sheet headers - Run this once
 */
function setupSheetHeaders() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Bugs");
  
  if (!sheet) {
    return "Sheet not found";
  }

  // Set headers if first row is empty
  const firstRow = sheet.getRange(1, 1, 1, 14).getValues()[0];
  
  if (!firstRow[0]) {
    sheet.getRange(1, 1, 1, 14).setValues([[
      "ID",
      "Title",
      "Description",
      "Steps",
      "Expected",
      "Actual",
      "Priority",
      "Status",
      "Image",
      "Reporter",
      "Date",
      "Assignee",
      "Chat ID",
      "Preview"
    ]]);
    
    beautifyDashboard(sheet);
    return "✅ Headers initialized!";
  }
  
  return "Headers already exist";
}

/**
 * Your doPost function starts here...
 */
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Bugs");

  if (!sheet) {
    return ContentService.createTextOutput("❌ Sheet not found");
  }

  normalizeChatIdPreviewColumns(sheet);

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
  // � LINK CHAT
  // =========================
  if (data.action === "linkchat") {
    const chatIdColumn = getColumnIndexByHeader(sheet, "Chat ID", 13);

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] == data.id) {
        sheet.getRange(i + 1, chatIdColumn).setValue(data.chatId);
        beautifyDashboard(sheet);
        return ContentService.createTextOutput("Chat ID linked");
      }
    }
  }

  // =========================
  // �👤 ASSIGN
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
  const chatIdColumn = getColumnIndexByHeader(sheet, "Chat ID", 13);
  const previewColumn = getColumnIndexByHeader(sheet, "Preview", 14);

  sheet.getRange(newRow, 1, 1, 14).setValues([[
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
    "", // assignee
    data.chatId || "", // chatId
    "" // preview (formula will be added below)
  ]]);

  // 📸 PREVIEW - Fixed IMAGE formula
  sheet.getRange(newRow, chatIdColumn).setValue(data.chatId || "");
  sheet.getRange(newRow, previewColumn).setFormula(`=IMAGE(I${newRow})`);

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
  const lastCol = 14;

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
  sheet.setColumnWidth(13, 150);
  sheet.setColumnWidth(14, 250);

  // Row banding
  sheet.getRange(2, 1, lastRow).applyRowBanding(
    SpreadsheetApp.BandingTheme.LIGHT_GREY
  );

  // Conditional formatting
  const rules = [];

  // ========== PRIORITY COLUMN FORMATTING (G) ==========
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("CRITICAL")
      .setBackground("#7f1d1d")
      .setFontColor("#ffffff")
      .setRanges([sheet.getRange("G2:G")])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("HIGH")
      .setBackground("#dc2626")
      .setFontColor("#ffffff")
      .setRanges([sheet.getRange("G2:G")])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("MEDIUM")
      .setBackground("#f59e0b")
      .setFontColor("#111827")
      .setRanges([sheet.getRange("G2:G")])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("LOW")
      .setBackground("#10b981")
      .setFontColor("#ffffff")
      .setRanges([sheet.getRange("G2:G")])
      .build()
  );

  // ========== STATUS COLUMN FORMATTING (H) ==========
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("OPEN")
      .setBackground("#2563eb")
      .setFontColor("#ffffff")
      .setRanges([sheet.getRange("H2:H")])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("IN PROGRESS")
      .setBackground("#0ea5e9")
      .setFontColor("#ffffff")
      .setRanges([sheet.getRange("H2:H")])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("IN DEVELOPMENT")
      .setBackground("#0ea5e9")
      .setFontColor("#ffffff")
      .setRanges([sheet.getRange("H2:H")])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("DOING")
      .setBackground("#0ea5e9")
      .setFontColor("#ffffff")
      .setRanges([sheet.getRange("H2:H")])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("IN REVIEW")
      .setBackground("#7c3aed")
      .setFontColor("#ffffff")
      .setRanges([sheet.getRange("H2:H")])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("BUG NOT RESOLVED")
      .setBackground("#ea580c")
      .setFontColor("#ffffff")
      .setRanges([sheet.getRange("H2:H")])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("FUTURE UPDATE")
      .setBackground("#334155")
      .setFontColor("#ffffff")
      .setRanges([sheet.getRange("H2:H")])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("DONE")
      .setBackground("#16a34a")
      .setFontColor("#ffffff")
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
