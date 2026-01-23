{
  "targets": [
    {
      "target_name": "fs_sandbox",
      "sources": [
        "src/binding.cpp",
        "src/FsSandbox.cpp",
        "src/PathValidator.cpp",
        "src/ExtensionFilter.cpp"
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
            "kernel32.lib"
          ]
        }]
      ]
    }
  ]
}
