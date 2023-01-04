#  Sudoku coop

This is a simple node.js + express + ws app allowing to play sudoku in cooperation

## Installation

###  Download

Just run `git clone github.com/jangberry/sudoku-coop`

###  Run

For convenience, a docker_compose has been made, so it's as easy as `docker compose up -d`.

Alternatively, you can run `npm install` then `npm start` or `npm run prod`.

## Usage

Simply browse to the server (most probably [http://localhost:8080/](http://localhost:8080/)).

Create a lobby, a sudoku, and start filling it.

You can put small numbers for hints by holding CTRL or ALT while tying your number. Alternatively, for mobile users, you can type `^` before your number (buggy workaround for now).

## API

//TODO

## TODOS

- [ ] API doc
- [ ] polish visual marking
- [ ] improve the robustness of inputs handlers
- [ ] dark theme
- [ ] implement as much as possible things as objects/events
  - [ ] visuals controler
  - [ ] conection controler
- [ ] chat
