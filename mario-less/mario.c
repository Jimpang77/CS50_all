#include <cs50.h>
#include <stdio.h>
void print_row(int bricks, int height);
int main(void)
{
    int height;
    do
    {
        // prompt user for height until it is between 1 and 8
        height = get_int("Height:");
    }
    while (height < 1);

    // print pyramid of height given
    for (int i = 0; i < height; i++)
    {
        print_row(i + 1, height);
    }
}
void print_row(int bricks, int height)
{
    //prints spaces before the hashes
    for (int i = 0; i < height - bricks; i++)
    {
        printf(" ");
    }
    //prints hashes
    for (int i = 0; i < bricks; i++)
    {
        printf("#");
    }
    printf("\n");
}
