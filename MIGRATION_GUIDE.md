# 🚀 Issues Migration Guide - Telegram to Trello

Ab har ek puraana issue Trello mein jaa sakta hai!

## Option 1: Using HTTP Endpoint (Easiest) 🌐

### Step 1: Export your data from Google Sheets as JSON
1. Open your Google Sheet with all issues
2. Copy all the data (or download as CSV)
3. Convert to JSON format:
```json
[
  {
    "title": "Login button not working",
    "description": "User cannot click login button on home page",
    "priority": "HIGH",
    "status": "OPEN",
    "reporter": "John Doe",
    "date": "2024-03-20",
    "chatId": "123456",
    "image": "https://link-to-image.jpg"
  },
  {
    "title": "App crashes on startup",
    "description": "App immediately crashes when opened",
    "priority": "CRITICAL",
    "status": "OPEN",
    "reporter": "Jane Smith",
    "date": "2024-03-21",
    "chatId": "789012",
    "image": ""
  }
]
```

### Step 2: Send to migration endpoint
```bash
curl -X POST http://localhost:3000/migrate-to-trello \
  -H "Content-Type: application/json" \
  -d @issues.json
```

Or using JavaScript:
```javascript
const issues = [ /* your array of issues */ ];

fetch('http://localhost:3000/migrate-to-trello', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ issues: issues })
})
.then(res => res.json())
.then(data => console.log(`✅ ${data.message}`))
```

---

## Option 2: Using CLI Script 🖥️

```bash
# Run migration from JSON file
node migrate-issues.js ./issues.json
```

Expected output:
```
🚀 Starting Karmm Issues Migration to Trello

📂 Loaded 25 issues from ./issues.json

📋 Starting migration of 25 issues...
✅ Created card: Login button not working (ID: xxx)
✅ Created card: App crashes on startup (ID: yyy)
...

📊 Migration complete!
✅ Success: 25
❌ Failed: 0
```

---

## Data Format Reference

Your JSON should have this structure (all fields optional):
```javascript
{
  "title": "Issue title - REQUIRED",
  "description": "Detailed description",
  "priority": "HIGH|MEDIUM|LOW|CRITICAL",  // Maps to Trello labels
  "status": "OPEN|IN PROGRESS|DONE",       // Shows in card title
  "reporter": "Person who reported",
  "date": "YYYY-MM-DD or ISO format",
  "chatId": "Telegram chat ID",
  "image": "URL to screenshot/evidence",
  "dueDate": "YYYY-MM-DD (optional)"
}
```

---

## What happens during migration?

✅ Each issue becomes a **Trello card**
✅ Priority maps to **Trello labels** (HIGH=Red, MEDIUM=Yellow, LOW=Green)
✅ All details stored in **card description**
✅ Card placed in **"To Do" list**
✅ Images linked in description

---

## How to export from Google Sheets

### Method 1: Manual Export
1. Open your Google Sheet
2. Click **File → Download → .csv** or **.xlsx**
3. Convert CSV to JSON using online tool or script

### Method 2: Google Sheets API
If you want to automate sheet export, use Google Sheets API:
```javascript
// Install: npm install googleapis
const sheets = require('googleapis').sheets('v4');
// [Implementation code here]
```

---

## After Migration

- New issues from Telegram → **both Sheets AND Trello** ✓
- Old issues now in **Trello** ✓
- Everything stays in **sync** ✓

🎯 Done! Ab pura purana data Trello mein hai!
