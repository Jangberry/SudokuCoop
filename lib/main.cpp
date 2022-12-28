#include <napi.h>
#include <qqwing.hpp>
#include "functions.h"

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "generateBoard"),
              Napi::Function::New(env, functions::generateBoardWrapped));
  return exports;
}

NODE_API_MODULE(testaddon, InitAll)