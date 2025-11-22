# Transcript Deduplication Script

## Problem

The OpenAI Realtime API sometimes sends duplicate transcription events, causing the same text to be saved multiple times with timestamps only ~200-400ms apart.

Example of duplicates:
```json
{
  "text": "Okay, so I'm now starting the main task.",
  "timestamp": 7098
},
{
  "text": "Okay, so I'm now starting the main task.",
  "timestamp": 7304
}
```

## Solution

### 1. Frontend Fix (Already Applied)

The frontend now includes deduplication logic that prevents duplicates from being saved in the first place. This fix applies to **new recordings only**.

### 2. Clean Up Existing Files

For **existing transcript files** that already contain duplicates, use this script:

```bash
# Navigate to scripts directory
cd backend/scripts

# Process a single transcript file
node deduplicate_transcripts.js ../uploads/transcripts/transcript_session_123.json

# Process all transcript files in a directory
node deduplicate_transcripts.js ../uploads/transcripts/

# Process pilot data transcripts
node deduplicate_transcripts.js "../../pilot data/audio transcript/"
```

## How It Works

1. **Reads the transcript file** - Parses the JSON array
2. **Identifies duplicates** - Two entries are considered duplicates if:
   - They have identical text
   - Their timestamps are within 1000ms of each other
3. **Creates a backup** - Saves original as `*_backup.json`
4. **Saves deduplicated version** - Overwrites the original file with cleaned data

## Example Output

```
Processing directory: ../uploads/transcripts/

Found 3 transcript files

Processing: ../uploads/transcripts/transcript_session_1762096692449.json
Original entries: 156
  Duplicate: "Okay, so I'm now starting the main task." (7304ms vs 7098ms)
  Duplicate: "Okay, so the design task is to ask me..." (14299ms vs 13977ms)
  Duplicate: "to design..." (16300ms vs 15934ms)
Duplicates removed: 78
Final entries: 78
Backup created: ../uploads/transcripts/transcript_session_1762096692449_backup.json
Deduplicated file saved: ../uploads/transcripts/transcript_session_1762096692449.json
---

✓ Deduplication complete!
```

## Safety Features

- **Automatic backups** - Original files are preserved as `*_backup.json`
- **Non-destructive** - You can restore from backup if needed
- **Validation** - Checks file format before processing
- **Detailed logging** - Shows exactly what duplicates were removed

## Restore from Backup

If you need to restore the original file:

```bash
cp transcript_session_123_backup.json transcript_session_123.json
```
