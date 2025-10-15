#!/bin/bash

# Migration script to fix the interaction_logs timestamp column
# Run this script to change the timestamp column from TIMESTAMP/DATETIME to BIGINT

echo "================================"
echo "Interaction Logs Migration Script"
echo "================================"
echo ""
echo "This will drop and recreate the interaction_logs table."
echo "Make sure you have backed up any important data!"
echo ""
read -p "Enter your MySQL root password: " -s password
echo ""
echo ""
echo "Running migration..."
echo ""

mysql -u root -p"$password" research_platform < fix_timestamp_column.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "The interaction_logs table structure is now:"
    echo ""
    mysql -u root -p"$password" research_platform -e "DESCRIBE interaction_logs;"
else
    echo ""
    echo "❌ Migration failed. Please check the error messages above."
    exit 1
fi
