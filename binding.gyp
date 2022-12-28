{
    "targets": [{
        "target_name": "sudoku_generator",
        "cflags!": ["-fno-exceptions"],
        "cflags_cc!": ["-fno-exceptions"],
        "sources": [
            "lib/main.cpp",
            "lib/functions.cpp",
            "lib/qqwing/src/cpp/qqwing.cpp"
        ],
        'include_dirs': [
            "<!@(node -p \"require('node-addon-api').include\")",
            "lib/qqwing/target/automake",
            # <!(make -C lib/qqwing cppconfigure > /dev/null 2> /dev/null)
            "lib/qqwing/src/cpp"
        ],
        'libraries': [],
        'dependencies': [
            "<!(node -p \"require('node-addon-api').gyp\")"
        ],
        'defines': ['NAPI_CPP_EXCEPTIONS'],
        'actions': [
            {
                'action_name': 'configure qqwing',
                'action': ['setpriv', '--reuid=1000', '--regid=1000', '--init-groups', '--inh-caps=-all', 'make', '-C', 'lib/qqwing', 'cppconfigure'],
                'inputs': ['lib/qqwing/src'],
                'outputs': ['lib/qqwing/target/automake']
            }
        ]
    }]
}
