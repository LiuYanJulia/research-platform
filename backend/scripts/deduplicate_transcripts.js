#!/usr/bin/env node

/**
 * Deduplication Script for Transcript Files
 *
 * This script removes duplicate transcript entries that were created due to
 * OpenAI Realtime API sending duplicate transcription events.
 *
 * Usage: node deduplicate_transcripts.js <path_to_transcript.json>
 */

const fs = require('fs');
const path = require('path');

function deduplicateTranscript(transcriptPath) {
  console.log(`Processing: ${transcriptPath}`);

  // Read the transcript file
  const data = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));

  if (!Array.isArray(data)) {
    console.error('Error: Transcript file is not an array');
    return;
  }

  console.log(`Original entries: ${data.length}`);

  // Deduplicate
  const deduplicated = [];
  let lastEntry = null;
  let duplicatesRemoved = 0;

  for (const entry of data) {
    // Check if this is a duplicate of the last entry
    const isDuplicate = lastEntry &&
      lastEntry.text === entry.text &&
      Math.abs(lastEntry.timestamp - entry.timestamp) < 1000; // Within 1 second

    if (isDuplicate) {
      console.log(`  Duplicate: "${entry.text}" (${entry.timestamp}ms vs ${lastEntry.timestamp}ms)`);
      duplicatesRemoved++;
    } else {
      deduplicated.push(entry);
      lastEntry = entry;
    }
  }

  console.log(`Duplicates removed: ${duplicatesRemoved}`);
  console.log(`Final entries: ${deduplicated.length}`);

  // Create backup
  const backupPath = transcriptPath.replace('.json', '_backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
  console.log(`Backup created: ${backupPath}`);

  // Write deduplicated data
  fs.writeFileSync(transcriptPath, JSON.stringify(deduplicated, null, 2));
  console.log(`Deduplicated file saved: ${transcriptPath}`);
}

function processDirectory(dirPath) {
  console.log(`\nProcessing directory: ${dirPath}\n`);

  const files = fs.readdirSync(dirPath);
  const transcriptFiles = files.filter(f =>
    f.startsWith('transcript_') &&
    f.endsWith('.json') &&
    !f.includes('_backup')
  );

  console.log(`Found ${transcriptFiles.length} transcript files\n`);

  for (const file of transcriptFiles) {
    const filePath = path.join(dirPath, file);
    deduplicateTranscript(filePath);
    console.log('---\n');
  }
}

// Main execution
if (process.argv.length < 3) {
  console.log('Usage: node deduplicate_transcripts.js <path>');
  console.log('  <path> can be a single transcript file or a directory');
  console.log('');
  console.log('Examples:');
  console.log('  node deduplicate_transcripts.js ../uploads/transcripts/transcript_session_123.json');
  console.log('  node deduplicate_transcripts.js ../uploads/transcripts/');
  process.exit(1);
}

const targetPath = process.argv[2];

if (!fs.existsSync(targetPath)) {
  console.error(`Error: Path does not exist: ${targetPath}`);
  process.exit(1);
}

const stats = fs.statSync(targetPath);

if (stats.isDirectory()) {
  processDirectory(targetPath);
} else if (stats.isFile()) {
  deduplicateTranscript(targetPath);
} else {
  console.error('Error: Path is neither a file nor a directory');
  process.exit(1);
}

console.log('\n✓ Deduplication complete!');
