# prompt user until input is valid
while True:
    try:
        dollars = float(input("Change owed: "))
        if dollars >= 0:
            break
    except ValueError:
        pass

# convert to cents:
cents = round(dollars * 100)

coins = 0

# Quarters
coins += cents // 25
cents %= 25

# Dimes
coins += cents // 10
cents %= 10

# Nickels
coins += cents // 5
cents %= 5

# Pennies
coins += cents

print(coins)
