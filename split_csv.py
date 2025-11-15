#!/usr/bin/env python3
"""
Split the large CSV file into smaller batches for easier Supabase import
"""

import csv
import os

def split_csv(input_file, batch_size=10000):
    """Split CSV into smaller files"""
    
    base_name = os.path.splitext(input_file)[0]
    batch_count = 0
    current_batch = 0
    
    with open(input_file, 'r', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        headers = reader.fieldnames
        
        current_file = None
        current_writer = None
        
        for row_count, row in enumerate(reader):
            # Start new batch file
            if row_count % batch_size == 0:
                if current_file:
                    current_file.close()
                
                batch_count += 1
                batch_filename = f"{base_name}_batch_{batch_count}.csv"
                current_file = open(batch_filename, 'w', encoding='utf-8', newline='')
                current_writer = csv.DictWriter(current_file, fieldnames=headers)
                current_writer.writeheader()
                print(f"Creating {batch_filename}...")
            
            current_writer.writerow(row)
        
        if current_file:
            current_file.close()
    
    print(f"\nSplit complete! Created {batch_count} batch files.")
    print(f"Each batch contains up to {batch_size} recipes.")

if __name__ == "__main__":
    input_file = '/Users/alastairblair/Development/Recipe-Parser-Native/all_converted_recipes.csv'
    print("Splitting large CSV into 10,000 recipe batches...")
    split_csv(input_file, batch_size=10000)