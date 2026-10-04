# gets height declines if less than or equal to 0

while True:
    try:
        height = int(input("Height: "))
        if 1 <= height <= 8:
            break
    except ValueError:
        pass
# prints out the #
for i in range(1, height + 1):
    spaces = height - i
    hashes = i
    print(" " * spaces + "#" * hashes + "  " + "#" * hashes)
