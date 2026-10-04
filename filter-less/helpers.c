#include "helpers.h"
#include <math.h>

// Convert image to grayscale
void grayscale(int height, int width, RGBTRIPLE image[height][width])
{
    // Loop over all pixels
    for (int i = 0; i < height; i++)
    {
        for (int j = 0; j < width; j++)
        {
            // Take average of red, green, and blue

            int green = image[i][j].rgbtGreen;
            int red = image[i][j].rgbtRed;
            int blue = image[i][j].rgbtBlue;
            int avg = round((green + red + blue) / 3.0);

            // Update pixel values
            image[i][j].rgbtRed = avg;
            image[i][j].rgbtGreen = avg;
            image[i][j].rgbtBlue = avg;
        }
    }

    return;
}

// Convert image to sepia
void sepia(int height, int width, RGBTRIPLE image[height][width])
{
    // Loop over all pixels
    for (int i = 0; i < height; i++)
    {
        for (int j = 0; j < width; j++)
        {
            int green = image[i][j].rgbtGreen;
            int red = image[i][j].rgbtRed;
            int blue = image[i][j].rgbtBlue;

            // Find sepia values

            int sep_red = round((red * 0.393) + (green * 0.769) + (blue * 0.189));
            int sep_green = round((red * 0.349) + (green * 0.686) + (blue * 0.168));
            int sep_blue = round((red * 0.272) + (green * 0.534) + (blue * 0.131));
            if (sep_red > 255)
            {
                sep_red = 255;
            }
            if (sep_green > 255)
            {
                sep_green = 255;
            }
            if (sep_blue > 255)
            {
                sep_blue = 255;
            }
            image[i][j].rgbtRed = sep_red;
            image[i][j].rgbtGreen = sep_green;
            image[i][j].rgbtBlue = sep_blue;
            // Update pixel values
        }
    }
    return;
}

// Reflect image horizontally
void reflect(int height, int width, RGBTRIPLE image[height][width])
{
    // Loop over rows
    for (int i = 0; i < height; i++)
    {
        // Loop to the middle of the row
        for (int j = 0; j < width / 2; j++)
        {
            // Swap pixels
            RGBTRIPLE temp = image[i][j];
            image[i][j] = image[i][width - 1 - j];
            image[i][width - 1 - j] = temp;
        }
    }

    return;
}
// Blur image
void blur(int height, int width, RGBTRIPLE image[height][width])
{
    RGBTRIPLE copy[height][width];

    // Copy original image
    for (int i = 0; i < height; i++)
    {
        for (int j = 0; j < width; j++)
        {
            copy[i][j] = image[i][j];
        }
    }

    for (int i = 0; i < height; i++)
    {
        for (int j = 0; j < width; j++)
        {
            int red = 0;
            int green = 0;
            int blue = 0;
            int count = 0;

            // Check surrounding pixels
            for (int x = i - 1; x <= i + 1; x++)
            {
                for (int y = j - 1; y <= j + 1; y++)
                {
                    if (x >= 0 && x < height && y >= 0 && y < width)
                    {
                        red += copy[x][y].rgbtRed;
                        green += copy[x][y].rgbtGreen;
                        blue += copy[x][y].rgbtBlue;
                        count++;
                    }
                }
            }

            image[i][j].rgbtRed = round((float) red / count);
            image[i][j].rgbtGreen = round((float) green / count);
            image[i][j].rgbtBlue = round((float) blue / count);
        }
    }

    return;
}
