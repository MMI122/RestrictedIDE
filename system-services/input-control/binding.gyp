{
  "targets": [
    {
      "target_name": "input_control",
      "sources": [
        "src/binding.cpp",
        "src/InputHook.cpp",
        "src/KeyboardFilter.cpp",
        "src/MouseFilter.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "include"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "conditions": [
        ["OS=='win'", {
          "libraries": [
            "user32.lib"
          ]
        }]
      ]
    }
  ]
}
