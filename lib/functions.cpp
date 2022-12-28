#include <napi.h>
#include "functions.h"
#include <qqwing.hpp>
#include <iostream>
#include <math.h>

const int *functions::generateBoard(qqwing::SudokuBoard::Difficulty difficulty, qqwing::SudokuBoard::Symmetry symmetry)
{
    qqwing::SudokuBoard *board = new qqwing::SudokuBoard;
    bool done = false;
    while (!done)
    {
        bool havePuzzle = board->generatePuzzleSymmetry(symmetry);
        if (!havePuzzle)
        {
            throw std::runtime_error("Failed to generate puzzle");
        }

        board->setRecordHistory(true);
        board->solve();

        if (difficulty != board->getDifficulty())
        {
            havePuzzle = false;
            done = false;
        }
        else
        {
            done = true;
        }
    }

    return board->getPuzzle();
}

Napi::Array functions::generateBoardWrapped(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    // Check the arguments passed.
    if (info.Length() < 1 || info.Length() > 2)
    {
        Napi::TypeError::New(env, "Wrong number of arguments (1 or 2)").ThrowAsJavaScriptException();
        return Napi::Array::New(env);
    }

    if ((!info[0].IsNumber() || std::isnan(info[0].ToNumber().FloatValue())) ||
        (info.Length() == 2 && (!info[1].IsNumber() || std::isnan(info[1].ToNumber().FloatValue()))))
    {
        Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
        return Napi::Array::New(env);
    }

    int difficulty = info[0].As<Napi::Number>().Int32Value();

    if (difficulty < 1 || difficulty > 4)
    {
        Napi::TypeError::New(env, "Difficulty must be between 1 (simple) and 4 (expert)").ThrowAsJavaScriptException();
        return Napi::Array::New(env);
    }

    int symmetry = 5; // Default value (random)
    if (info.Length() == 2 && info[1].IsNumber())
    {
        symmetry = info[1].As<Napi::Number>().Int32Value();
    }

    if (symmetry < 0 || symmetry > 5)
    {
        Napi::TypeError::New(env, "Symetry must be one of 0:None, 1:Rotate90, 2:Rotate180, 3:Mirror, 4:Flip, 5:Random (default)").ThrowAsJavaScriptException();
        return Napi::Array::New(env);
    }

    const int *puzzle;
    try
    {
        puzzle = functions::generateBoard(static_cast<qqwing::SudokuBoard::Difficulty>(difficulty), static_cast<qqwing::SudokuBoard::Symmetry>(symmetry));
    }
    catch (std::runtime_error &e)
    {
        Napi::TypeError::New(env, e.what()).ThrowAsJavaScriptException();
        return Napi::Array::New(env);
    }

    Napi::Array result = Napi::Array::New(env, 81);

    for (int i = 0; i < 81; i++)
    {
        result[i] = puzzle[i];
    }

    return result;
}