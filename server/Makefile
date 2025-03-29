CC = gcc
CFLAGS = -Wall -Wextra -O2

EXE = server

all: $(EXE)

$(EXE): server.c
	$(CC) $(CFLAGS) server.c -o $(EXE)

clean:
	rm -f $(EXE)

run: $(EXE)
	./$(EXE)

.PHONY: all clean run
