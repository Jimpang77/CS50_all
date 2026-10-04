#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[])
{
    FILE *img = NULL;
    int file_count = 0;

    // Accept a single command-line argument
    if (argc != 2)
    {
        printf("Usage: ./recover FILE\n");
        return 1;
    }
    // Open the memory card

    FILE *card = fopen(argv[1], "r");

    // create buffer for a block of data
    uint8_t buffer[512];
    // While there's still data left to read from the memory card
    while (fread(buffer, 1, 512, card) == 512)
    {
        // Create JPEGs from the data
        if (buffer[0] == 0xff && buffer[1] == 0xd8 && buffer[2] == 0xff &&
            (buffer[3] & 0xf0) == 0xe0)
        {
            char filename[8];
            sprintf(filename, "%03i.jpg", file_count);
            if (img != NULL)
            {
                fclose(img);
            }
            img = fopen(filename, "w");
            file_count++;
        }
        if (img != NULL)
        {
            fwrite(buffer, 1, 512, img);
        }
    }
    fclose(img);
    fclose(card);
}
