{
  "targets": [
    {
      "target_name": "process_control",
      "sources": [
        "src/binding.cpp",
        "src/ProcessMonitor.cpp",
        "src/ProcessKiller.cpp",
        "src/ProcessWhitelist.cpp"
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
            "psapi.lib",
            "kernel32.lib"
          ]
        }]
      ]
    }
  ]
}
