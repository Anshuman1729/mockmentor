# PRD Status Sync Setup Guide

This document describes how to set up the GitHub Action workflow that automatically syncs PRD status from `CLAUDE.md` to Google Sheets and Slack canvas.

## Overview

The sync workflow:
- **Triggers:** On push to `main` (if CLAUDE.md changed), daily at 9 AM UTC, or manually
- **Extracts:** PRD status tables from CLAUDE.md using regex/markdown parsing
- **Syncs:** Updates a Google Sheet and Slack canvas with structured status data
- **Reports:** Notifies Slack on failures (if webhook configured)

## Prerequisites

- GitHub repository with Actions enabled
- (Optional) Google Sheets account with API access
- (Optional) Slack workspace with a custom bot

## File Structure

```
.github/
  workflows/
    sync-prd-status.yml          # Main workflow
scripts/
  prd-status-extractor.js        # Parse CLAUDE.md
  sync-to-sheets.js              # Google Sheets sync
  sync-to-slack.js               # Slack canvas sync
docs/
  prd-sync-setup.md              # This file
```

## Setup Steps

### 1. Google Sheets Integration (Optional)

#### Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable the Google Sheets API:
   - Search "Google Sheets API"
   - Click "Enable"

#### Create a Service Account

1. Go to **Service Accounts** in your Google Cloud project
2. Click "Create Service Account"
3. Fill in service account name (e.g., `prd-sync-bot`)
4. Grant these roles:
   - `Editor` (for simplicity) — or `Sheets Editor` if available
5. Click "Create and Continue"
6. Skip optional steps, finish

#### Create and Download JSON Key

1. Click the created service account
2. Go to **Keys** tab
3. Click "Add Key" → "Create new key"
4. Select **JSON**
5. Save the downloaded `*.json` file securely

#### Create the Sheet

1. Create a new Google Sheet (or use existing)
2. Name it (e.g., "PrepSignals PRD Status")
3. Create a sheet tab named `PRD Status` (exact name)
4. Share the sheet with the service account email:
   - Get the email from the JSON key: `client_email` field
   - Share the sheet, grant **Editor** access

#### Add GitHub Secrets

In your GitHub repository:
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:

**`GOOGLE_SHEETS_ID`**
- Value: The sheet ID from the URL
- Example: `1a2B3c4D5e6F7g8H9i0J1k2L3m4N5o6P`
- (URL format: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`)

**`GOOGLE_SHEETS_CREDENTIALS`**
- Value: Contents of the service account JSON key, **base64-encoded**
- Command to encode:
  ```bash
  cat ~/Downloads/service-account.json | base64 -w 0
  ```
- Paste the entire base64 string (single line, no newlines)

---

### 2. Slack Canvas Integration (Optional)

#### Create a Slack Bot

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App"
3. Select "From scratch"
4. Name: `PRD Sync Bot` (or similar)
5. Select your workspace
6. Click "Create App"

#### Configure Bot Permissions

1. Go to **OAuth & Permissions**
2. Add these **Bot Token Scopes**:
   - `canvases:write` — write to canvases
   - `canvases:read` — read canvas metadata
3. Click "Install to Workspace"
4. Authorize the app
5. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

#### Create a Canvas

1. Open Slack in your workspace
2. Click the canvas icon in the sidebar
3. Click "+" → "Create a new canvas"
4. Name: `PRD Status` (or similar)
5. Right-click canvas tab → "Copy canvas link" or get ID from URL

#### Add GitHub Secrets

In your GitHub repository, add these secrets:

**`SLACK_BOT_TOKEN`**
- Value: The OAuth token from step 2 (starts with `xoxb-`)

**`SLACK_CANVAS_ID`**
- Value: Canvas ID from the URL
- Example: `F12ABC34DEF`
- (Get from Slack canvas link: `https://slack.com/canvas/T00000000/C12ABC34DEF`)

---

### 3. Optional: Slack Webhook for Failure Notifications

If you want the workflow to notify Slack of failures:

#### Create an Incoming Webhook

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Select your app
3. Go to **Incoming Webhooks**
4. Click "Add New Webhook to Workspace"
5. Select the channel (e.g., `#engineering`)
6. Authorize
7. Copy the webhook URL

#### Add GitHub Secret

**`SLACK_WEBHOOK_URL`**
- Value: The webhook URL from step 2

---

## Running the Workflow

### Automatic Triggers

- **On push to main:** Whenever `CLAUDE.md` changes
- **Daily:** Every day at 9 AM UTC
- **Manual:** In GitHub UI, Actions tab → "Sync PRD Status" → "Run workflow"

### Manual Test (Local)

```bash
# Extract PRD status
node scripts/prd-status-extractor.js

# Test Google Sheets sync (requires credentials)
GOOGLE_SHEETS_ID="..." GOOGLE_SHEETS_CREDENTIALS="..." node scripts/sync-to-sheets.js

# Test Slack canvas sync (requires token)
SLACK_BOT_TOKEN="..." SLACK_CANVAS_ID="..." node scripts/sync-to-slack.js
```

## Troubleshooting

### Extraction fails

- Check `CLAUDE.md` exists and contains `### Section` headers with markdown tables
- Tables must have format:
  ```
  | Item | Status |
  |---|---|
  | ... | ... |
  ```

### Google Sheets sync fails

- Verify service account email is shared to the sheet with Editor access
- Check sheet has a tab named exactly `PRD Status`
- Credentials must be valid JSON (not truncated/corrupted)
- API might need 5-10 minutes after enabling

### Slack canvas sync fails

- Bot token must start with `xoxb-`
- Canvas ID must be correct (not the message ID or channel ID)
- Bot must be invited to the channel if it's private
- `canvases:write` scope required

### Workflow doesn't trigger on push

- Verify workflow file is in `.github/workflows/` directory
- Branch protection rules might require approval
- Check "Actions" tab in GitHub for workflow status

## Monitoring

1. **GitHub Actions:** https://github.com/[owner]/[repo]/actions
2. **Google Sheets:** https://docs.google.com/spreadsheets/d/[SHEET_ID]
3. **Slack Canvas:** Open in Slack app

## Advanced Configuration

### Change schedule

Edit `.github/workflows/sync-prd-status.yml`:
```yaml
schedule:
  - cron: '0 18 * * *'  # Run at 6 PM UTC instead
```

### Add other destinations

Create new sync scripts following the pattern of `sync-to-*.js`:
1. Extract data using `prd-status-extractor.js`
2. Transform to target format
3. Send via HTTP/API
4. Add step to workflow YAML

### Local testing with different CLAUDE.md

```bash
# Test with a different file
node scripts/prd-status-extractor.js /path/to/other/CLAUDE.md > /tmp/test.json
```

## Deactivating Sync

If you want to disable a destination:

- **Google Sheets:** Remove `GOOGLE_SHEETS_ID` and `GOOGLE_SHEETS_CREDENTIALS` secrets
- **Slack Canvas:** Remove `SLACK_BOT_TOKEN` and `SLACK_CANVAS_ID` secrets
- **Failure notifications:** Remove `SLACK_WEBHOOK_URL` secret

The workflow will skip disabled destinations and report in logs.

## Security Notes

- **Credentials:** Never commit credentials to Git. Use GitHub Secrets only.
- **Service Account:** Restrict Google service account to specific sheets (not all files).
- **Bot Token:** Rotate periodically. Consider using fine-grained personal access tokens if Slack supports it.
- **Base64 Encoding:** Only encodes to obscure, not encrypt. Treat like plaintext.

## References

- [Google Sheets API v4](https://developers.google.com/sheets/api)
- [Slack Canvas API](https://api.slack.com/docs/canvases)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Cron Schedule Syntax](https://crontab.guru/)
