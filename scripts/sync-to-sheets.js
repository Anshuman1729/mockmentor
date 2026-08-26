#!/usr/bin/env node
/**
 * Sync PRD Status to Google Sheets
 * Uses Google Sheets API v4 to update PRD status sheet
 * Requires: GOOGLE_SHEETS_ID, GOOGLE_SHEETS_CREDENTIALS (JSON string or base64)
 */

const https = require('https');
const { extractPRDStatus } = require('./prd-status-extractor.js');
const path = require('path');

/**
 * Get OAuth2 access token using service account
 */
const getAccessToken = async (credentials) => {
  const payload = JSON.stringify({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  });

  // Sign JWT (simplified - in production, use proper JWT library)
  // For GitHub Actions, this will be handled by gcloud or we'll use a pre-existing token
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.access_token) {
            resolve(result.access_token);
          } else {
            reject(new Error(`Failed to get access token: ${data}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
};

/**
 * Make authenticated request to Google Sheets API
 */
const sheetsRequest = (method, path, accessToken, body = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'sheets.googleapis.com',
      path: path,
      method: method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(
              new Error(
                `API error (${res.statusCode}): ${JSON.stringify(result)}`
              )
            );
          } else {
            resolve(result);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

/**
 * Convert PRD sections to sheet values
 */
const convertToSheetValues = (sections) => {
  const values = [];

  // Header row
  values.push(['Section', 'Item', 'Status', 'Notes', 'Last Updated']);

  const timestamp = new Date().toISOString();

  // Data rows
  for (const section of sections) {
    for (const item of section.items) {
      values.push([
        section.section,
        item.name,
        item.status,
        item.notes || '',
        timestamp,
      ]);
    }
  }

  return values;
};

/**
 * Main sync function
 */
const syncToSheets = async () => {
  try {
    // Validate environment
    const sheetsId = process.env.GOOGLE_SHEETS_ID;
    const credsEnv = process.env.GOOGLE_SHEETS_CREDENTIALS;

    if (!sheetsId) {
      throw new Error('GOOGLE_SHEETS_ID environment variable is required');
    }
    if (!credsEnv) {
      throw new Error(
        'GOOGLE_SHEETS_CREDENTIALS environment variable is required'
      );
    }

    console.log('📊 PRD Status → Google Sheets Sync Started');
    console.log(`Sheet ID: ${sheetsId}`);

    // Parse credentials (base64 or direct JSON)
    let credentials;
    try {
      if (credsEnv.startsWith('{')) {
        credentials = JSON.parse(credsEnv);
      } else {
        credentials = JSON.parse(Buffer.from(credsEnv, 'base64').toString());
      }
    } catch (error) {
      throw new Error(
        `Failed to parse GOOGLE_SHEETS_CREDENTIALS: ${error.message}`
      );
    }

    // Extract PRD data
    const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
    console.log(`📄 Reading CLAUDE.md from ${claudeMdPath}`);
    const sections = extractPRDStatus(claudeMdPath);
    console.log(`✅ Extracted ${sections.length} sections`);

    // Get access token
    console.log('🔐 Getting Google Sheets API access token...');
    const accessToken = await getAccessToken(credentials);
    console.log('✅ Access token acquired');

    // Convert to sheet values
    const values = convertToSheetValues(sections);
    console.log(`📋 Prepared ${values.length} rows for sheet`);

    // Clear existing data
    console.log('🗑️  Clearing existing sheet data...');
    const clearPath = `/v4/spreadsheets/${sheetsId}/values/'PRD Status'!A:E`;
    await sheetsRequest('DELETE', clearPath, accessToken);
    console.log('✅ Sheet cleared');

    // Write new data
    console.log('✍️  Writing PRD data to sheet...');
    const updatePath = `/v4/spreadsheets/${sheetsId}/values/'PRD Status'?valueInputOption=RAW`;
    const updateBody = {
      range: "'PRD Status'!A1",
      values: values,
    };
    const result = await sheetsRequest('PUT', updatePath, accessToken, updateBody);
    console.log(`✅ Updated ${result.updates?.updatedRows || 0} rows`);

    console.log('✨ Sync completed successfully!');
    return { success: true, rows: values.length };
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    process.exit(1);
  }
};

// Run if executed directly
if (require.main === module) {
  syncToSheets().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { syncToSheets };
