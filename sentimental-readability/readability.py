from cs50 import get_string

# Prompt the user for text
text = get_string("Text: ")

# Function to count letters


def count_letters(text):
    return sum(1 for char in text if char.isalpha())

# Function to count words


def count_words(text):
    return len(text.split())

# Function to count sentences


def count_sentences(text):
    return sum(1 for char in text if char in ".!?")


# Count letters, words, and sentences
letters = count_letters(text)
words = count_words(text)
sentences = count_sentences(text)

# Compute Coleman-Liau index
L = (letters / words) * 100  # avg letters per 100 words
S = (sentences / words) * 100  # avg sentences per 100 words
index = 0.0588 * L - 0.296 * S - 15.8
grade = round(index)

# Print grade level
if grade < 1:
    print("Before Grade 1")
elif grade >= 16:
    print("Grade 16+")
else:
    print(f"Grade {grade}")
