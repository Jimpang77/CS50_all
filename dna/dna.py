import csv
import sys


def main():

    # Check for proper command-line usage
    if len(sys.argv) != 3:
        print("Usage: python dna.py data.csv sequence.txt")
        sys.exit(1)

    # Read database file into a variable
    database_filename = sys.argv[1]
    with open(database_filename, newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        database = list(reader)  # each row is a dict with name and STR counts
        str_sequences = reader.fieldnames[1:]  # skip "name" column

    # Read DNA sequence file into a variable
    sequence_filename = sys.argv[2]
    with open(sequence_filename) as f:
        dna_sequence = f.read().strip()

    # Find longest match of each STR in DNA sequence
    str_counts = {}
    for STR in str_sequences:
        str_counts[STR] = longest_match(dna_sequence, STR)

    # Check database for matching profiles
    for person in database:
        match = True
        for STR in str_sequences:
            if int(person[STR]) != str_counts[STR]:
                match = False
                break
        if match:
            print(person["name"])
            return

    print("No match")
    return


def longest_match(sequence, subsequence):
    """Returns length of longest run of subsequence in sequence."""

    longest_run = 0
    subsequence_length = len(subsequence)
    sequence_length = len(sequence)

    for i in range(sequence_length):
        count = 0
        while True:
            start = i + count * subsequence_length
            end = start + subsequence_length
            if sequence[start:end] == subsequence:
                count += 1
            else:
                break
        longest_run = max(longest_run, count)

    return longest_run


if __name__ == "__main__":
    main()
