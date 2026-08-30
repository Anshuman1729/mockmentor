#!/usr/bin/env node
/**
 * PRD Status Extractor
 * Parses CLAUDE.md and extracts all PRD status tables
 * Exports structured JSON: [{section, items: [{name, status, notes}]}]
 */

const fs = require('fs');
const path = require('path');

// Map emoji/status to canonical status
const normalizeStatus = (status) => {
  const normalized = status.trim();
  if (normalized.includes('✅')) return 'Done';
  if (normalized.includes('🟡')) return 'In Progress';
  if (normalized.includes('⬛')) return 'De-prioritised';
  if (normalized.includes('❓')) return 'Not tracked';
  return normalized;
};

// Extract tables from markdown content
const extractTables = (content) => {
  const sections = [];
  const lines = content.split('\n');

  // Find "## PRD Status" section
  let prdStatusStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('## PRD Status')) {
      prdStatusStart = i;
      break;
    }
  }

  if (prdStatusStart === -1) {
    // No PRD Status section found, try to extract from specific known sections
    return extractTablesFromLines(lines, 0, lines.length);
  }

  // Extract only from PRD Status section onward
  return extractTablesFromLines(lines, prdStatusStart, lines.length);
};

// Helper function to extract tables from a range of lines
const extractTablesFromLines = (lines, startIdx, endIdx) => {
  const sections = [];
  let currentSection = null;
  let inTable = false;
  let tableLines = [];

  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i];

    // Look for section headers (### Section Name)
    if (line.match(/^### /)) {
      // Save previous section if exists
      if (currentSection && tableLines.length > 0) {
        const parsed = parseTable(tableLines);
        if (parsed.length > 0) {
          sections.push({
            section: currentSection,
            items: parsed,
          });
        }
      }
      currentSection = line.replace(/^### /, '').trim();
      inTable = false;
      tableLines = [];
    }

    // Stop at ## or higher level headers (unless it's the PRD Status header we're looking for)
    if (line.match(/^## /) && !line.includes('PRD Status')) {
      // Save current section and stop
      if (currentSection && tableLines.length > 0) {
        const parsed = parseTable(tableLines);
        if (parsed.length > 0) {
          sections.push({
            section: currentSection,
            items: parsed,
          });
        }
      }
      break;
    }

    // Detect table start (markdown table header with |---|---|)
    if (line.includes('|') && line.includes('---|')) {
      inTable = true;
      tableLines = [];
      continue;
    }

    // Collect table lines
    if (inTable && line.trim().startsWith('|')) {
      tableLines.push(line);
    } else if (inTable && !line.trim().startsWith('|')) {
      // End of table
      if (tableLines.length > 0) {
        const parsed = parseTable(tableLines);
        if (parsed.length > 0 && currentSection) {
          sections.push({
            section: currentSection,
            items: parsed,
          });
        }
      }
      inTable = false;
      tableLines = [];
    }
  }

  // Handle last section
  if (currentSection && tableLines.length > 0) {
    const parsed = parseTable(tableLines);
    if (parsed.length > 0) {
      sections.push({
        section: currentSection,
        items: parsed,
      });
    }
  }

  return sections;
};

// Parse individual markdown table
const parseTable = (lines) => {
  if (lines.length < 1) return [];

  const items = [];

  // All lines passed are data rows (header and separator already excluded by caller)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break;

    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);

    if (cells.length >= 2) {
      const name = cells[0];
      const statusRaw = cells[1];
      const notes = cells.length > 2 ? cells[2] : '';

      items.push({
        name,
        status: normalizeStatus(statusRaw),
        statusRaw, // Keep original for reference
        notes: notes.trim(),
      });
    }
  }

  return items;
};

// Main extraction
const extractPRDStatus = (claudeMdPath) => {
  try {
    const content = fs.readFileSync(claudeMdPath, 'utf-8');
    const sections = extractTables(content);
    return sections;
  } catch (error) {
    console.error(`Error reading ${claudeMdPath}:`, error.message);
    process.exit(1);
  }
};

// CLI usage
if (require.main === module) {
  const claudeMdPath = process.argv[2] || path.join(process.cwd(), 'CLAUDE.md');

  if (!fs.existsSync(claudeMdPath)) {
    console.error(`File not found: ${claudeMdPath}`);
    process.exit(1);
  }

  const data = extractPRDStatus(claudeMdPath);

  // Pretty print JSON
  console.log(JSON.stringify(data, null, 2));
}

module.exports = { extractPRDStatus, normalizeStatus };
