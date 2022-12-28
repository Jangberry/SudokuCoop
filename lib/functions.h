// c header file

#ifndef FUNCTIONS_H
#define FUNCTIONS_H

#include <napi.h>
#include <qqwing.hpp>

namespace functions {
    const int* generateBoard(qqwing::SudokuBoard::Difficulty difficulty, qqwing::SudokuBoard::Symmetry symmetry);
    
    Napi::Array generateBoardWrapped(const Napi::CallbackInfo& info);
}

#endif