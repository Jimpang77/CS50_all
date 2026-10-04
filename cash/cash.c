#include <cs50.h>
#include <stdio.h>

int main(void)
{
    // asks for change and continues to ask if negative
    int change = get_int("Change owed: ");
    while (change < 0)
    {
        change = get_int("Change owed: ");
    }
    int quarter = 25;
    int dime = 10;
    int nickel = 5;
    int penny = 1;
    int count = 0;
    // how many quarters
    while (change > 24)
    {
        change = change - quarter;
        count++;
    }

    // how many dimes
    while (change > 9)
    {
        change = change - dime;
        count++;
    }

    // how many nickels
    while (change > 4)
    {
        change = change - nickel;
        count++;
    }

    // how many pennies
    while (change > 0)
    {
        change = change - penny;
        count++;
    }

    printf("%d\n", count);
}
