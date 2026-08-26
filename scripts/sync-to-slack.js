#!/usr/bin/env node
/**
 * Sync PRD Status to Slack Canvas
 * Uses Slack API to update a canvas with PRD status information
 * Requires: SLACK_BOT_TOKEN, SLACK_CANVAS_ID
 */

const https = require('https');
const { extractPRDStatus } = require('./prd-status-extractor.js');
const path = require('path');

/**
 * Make authenticated request to Slack API
 */
const slackRequest = (method, path, token, body = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'slack.com',
      path: path,
      method: method,
      headers: {
        Authorization: `Bearer ${token}`,
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
          if (!result.ok) {
            reject(
              new Error(
                `Slack API error: ${result.error || 'Unknown error'}`
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
 * Convert PRD sections to Slack Block Kit format
 */
const convertToSlackBlocks = (sections) => {
  const blocks = [];

  // Header
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: '📊 PrepSignals PRD Status',
      emoji: true,
    },
  });

  // Last updated timestamp
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Last Updated:* ${new Date().toISOString()}`,
    },
  });

  blocks.push({ type: 'divider' });

  // Iterate sections
  for (const section of sections) {
    // Section header
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${section.section}*`,
      },
    });

    // Count statuses
    const statusCounts = {};
    for (const item of section.items) {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
    }

    // Summary line
    const summary = Object.entries(statusCounts)
      .map(([status, count]) => `${status}: ${count}`)
      .join(' • ');
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: summary,
      },
    });

    // Item details (group by status)
    const statusGroups = {};
    for (const item of section.items) {
      if (!statusGroups[item.status]) {
        statusGroups[item.status] = [];
      }
      statusGroups[item.status].push(item);
    }

    // Render each status group
    const statusOrder = ['Done', 'In Progress', 'De-prioritised', 'Not tracked'];
    for (const status of statusOrder) {
      if (statusGroups[status]) {
        const items = statusGroups[status];
        const itemText = items
          .map((item) => {
            const emoji =
              status === 'Done'
                ? '✅'
                : status === 'In Progress'
                  ? '🟡'
                  : status === 'De-prioritised'
                    ? '⬛'
                    : '❓';
            return `${emoji} ${item.name}${item.notes ? ` — ${item.notes}` : ''}`;
          })
          .join('\n');

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: itemText,
          },
        });
      }
    }

    blocks.push({ type: 'divider' });
  }

  // Footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: 'Auto-synced from CLAUDE.md PRD Status tables | Updates on push to main',
      },
    ],
  });

  return blocks;
};

/**
 * Main sync function
 */
const syncToSlack = async () => {
  try {
    // Validate environment
    const token = process.env.SLACK_BOT_TOKEN;
    const canvasId = process.env.SLACK_CANVAS_ID;

    if (!token) {
      throw new Error('SLACK_BOT_TOKEN environment variable is required');
    }
    if (!canvasId) {
      throw new Error('SLACK_CANVAS_ID environment variable is required');
    }

    console.log('📣 PRD Status → Slack Canvas Sync Started');
    console.log(`Canvas ID: ${canvasId}`);

    // Extract PRD data
    const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
    console.log(`📄 Reading CLAUDE.md from ${claudeMdPath}`);
    const sections = extractPRDStatus(claudeMdPath);
    console.log(`✅ Extracted ${sections.length} sections`);

    // Convert to Slack blocks
    const blocks = convertToSlackBlocks(sections);
    console.log(`📋 Prepared ${blocks.length} Slack blocks`);

    // Update canvas
    console.log('📝 Updating Slack canvas...');
    const result = await slackRequest(
      'POST',
      '/api/canvases.edit',
      token,
      {
        canvas_id: canvasId,
        changes: [
          {
            operation: 'replace_all',
            data: {
              blocks: blocks,
            },
          },
        ],
      }
    );

    console.log('✅ Canvas updated successfully');
    console.log(`Canvas URL: https://slack.com/canvas/${result.canvas_id}`);

    console.log('✨ Sync completed successfully!');
    return { success: true, blocks: blocks.length };
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    process.exit(1);
  }
};

// Run if executed directly
if (require.main === module) {
  syncToSlack().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { syncToSlack };
