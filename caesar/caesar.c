#include <cs50.h>
#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// declares digits and rotate
bool only_digits(string s);
char rotate(char c, int k);

int main(int argc, string argv[])
{
    // Check for exactly one command line argument
    if (argc != 2)
    {
        printf("Usage: ./caesar key\n");
        return 1;
    }

    // Check that argv[1] contains only digits
    if (!only_digits(argv[1]))
    {
        printf("Usage: ./caesar key\n");
        return 1;
    }

    // Convert key to integer
    int key = atoi(argv[1]);

    // Prompt user for plaintext
    string plaintext = get_string("plaintext: ");

    printf("ciphertext: ");

    // Encrypt and print each character
    for (int i = 0, len = strlen(plaintext); i < len; i++)
    {
        printf("%c", rotate(plaintext[i], key));
    }

    printf("\n");

    return 0;
}

// Returns true if string contains only digits
bool only_digits(string s)
{
    for (int i = 0, len = strlen(s); i < len; i++)
    {
        if (!isdigit(s[i]))
        {
            return false;
        }
    }
    return true;
}

// Rotates character by k positions
char rotate(char c, int k)
{
    k = k % 26; // Reduce large keys

    if (isupper(c))
    {
        return ((c - 'A' + k) % 26) + 'A';
    }
    else if (islower(c))
    {
        return ((c - 'a' + k) % 26) + 'a';
    }
    else
    {
        // Non letters unchanged
        return c;
    }
}
