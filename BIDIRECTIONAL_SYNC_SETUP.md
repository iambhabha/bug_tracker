# Bidirectional Sync Setup Guide

## Overview
This feature enables automatic synchronization between Google Sheets and Trello boards. When you update a status on one platform, it automatically reflects on the other.

### Features
- ✅ **Trello → Google Sheets**: When a card is moved to a different list on Trello (e.g., "In Development"), the Google Sheet updates automatically
- ✅ **Google Sheets → Trello**: When you change the status in the Google Sheet (e.g., mark as "IN PROGRESS"), the corresponding Trello card moves to the correct list automatically

## Architecture

### New Components

1. **TrelloSyncWebhookController** (`src/controllers/TrelloSyncWebhookController.js`)
   - Listens for Trello card movements
   - Identifies issue IDs from card names
   - Updates Google Sheets when Trello status changes

2. **SheetSyncWebhookController** (`src/controllers/SheetSyncWebhookController.js`)
   - Listens for Google Sheets status updates
   - Routes changes to Trello
   - Supports multiple status types (OPEN, IN PROGRESS, DONE)

3. **Sync Webhook Endpoints** (in `server.js`)
   - `POST /webhook/trello-sync` - Receives Trello card change events
   - `POST /webhook/sheet-sync` - Receives Google Sheets updates

## Setup Instructions

### Step 1: Configure Trello Webhook

You need to find the IDs of your Trello list columns and set them as environment variables.

#### Find Your Trello List IDs:

```bash
# Get your board lists using Trello API
curl "https://api.trello.com/1/boards/{BOARD_ID}/lists?key={TRELLO_KEY}&token={TRELLO_TOKEN}"
```

Look for the list objects and note their `id` values for:
- TODO/Backlog list
- In Progress/In Development list  
- Done/Completed list

#### Set Environment Variables:

Add these to your `.env` file:
```env
TRELLO_LIST_TODO_ID=xxxxxxxxxxxxx
TRELLO_LIST_IN_PROGRESS_ID=yyyyyyyyyyyyy
TRELLO_LIST_DONE_ID=zzzzzzzzzzzzz
```

### Step 2: Configure Trello Webhook URL

Go to Trello Power-Ups or use their API to register a webhook:

```bash
curl -X POST \
  "https://api.trello.com/1/tokens/{TRELLO_TOKEN}/webhooks?key={TRELLO_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "callbackURL": "https://your-bot-domain.com/webhook/trello-sync",
    "idModel": "{BOARD_ID}",
    "description": "Sync Trello to Google Sheets"
  }'
```

### Step 3: Configure Google Sheets Webhook

Your Google Sheet should already send updates to a webhook URL. Make sure it's configured to send to:

```
https://your-bot-domain.com/webhook/sheet-sync
```

The webhook payload should include:
```json
{
  "action": "update",
  "id": "123",
  "status": "IN PROGRESS"
}
```

## Issue ID Mapping

The system identifies issues by:
1. Looking at the Trello card name
2. Extracting the issue ID using these patterns:
   - `ID-123: Bug Title`
   - `ISSUE-456: Another Title`
   - `#789 - Title`

Make sure your card names follow one of these formats for sync to work.

## Status Mapping

The system maps between different status formats:

| Trello List | Google Sheet Status | Internal Status |
|-------------|-------------------|-----------------|
| TODO/Backlog | OPEN | OPEN |
| In Progress/In Development | IN PROGRESS | IN PROGRESS |
| Done/Completed | DONE | DONE |

## Testing

### Test Trello → Sheets Sync:
1. On Trello, move a card to the "In Progress" list
2. Check that the corresponding sheet row updates to "IN PROGRESS"

### Test Sheets → Trello Sync:
1. In Google Sheets, change a row's status to "DONE"
2. Check that the corresponding Trello card moves to the "Done" list

## Troubleshooting

### Sync not working?

1. **Check Environment Variables**
   ```bash
   echo $TRELLO_LIST_TODO_ID
   echo $TRELLO_LIST_IN_PROGRESS_ID
   echo $TRELLO_LIST_DONE_ID
   ```

2. **Verify Issue ID Format**
   - Ensure Trello card names follow the ID pattern (e.g., `ID-123: Title`)
   - The system uses regex to extract IDs from names

3. **Check Webhook Logs**
   ```bash
   # Watch your server logs for sync messages
   tail -f logs/server.log
   ```

4. **Test API Endpoints Manually**
   ```bash
   # Test Trello sync webhook
   curl -X POST http://localhost:3000/webhook/trello-sync \
     -H "Content-Type: application/json" \
     -d '{
       "action": {"type": "updateCard", "data": {"card": {"id": "xxxx", "name": "ID-123: Test", "idList": "yyyy"}}},
       "model": {"id": "xxxx"}
     }'
   ```

## API Reference

### Trello Sync Webhook Payload
```json
{
  "action": {
    "type": "updateCard",
    "data": {
      "card": {
        "id": "card_id",
        "name": "ID-123: Issue Title",
        "idList": "list_id"
      }
    }
  },
  "model": {"id": "card_id"}
}
```

### Google Sheets Sync Webhook Payload
```json
{
  "action": "update",
  "id": "123",
  "status": "IN PROGRESS"
}
```

## Advanced Configuration

To customize status names or add new statuses, modify:

1. **TrelloSyncWebhookController.listStatusMap** - Map Trello list IDs to status names
2. **SheetSyncWebhookController** - Add handlers for additional Trello list types
3. **TrelloIssueGateway** - Add new methods like `markCustomStatus()`

## Notes

- Sync is **one-way per operation** (either Trello→Sheets OR Sheets→Trello in a single event)
- To prevent circular updates, the system should be configured with proper webhook guards
- The system tries multiple ID format patterns for flexibility
- Media/attachments are preserved during syncs
