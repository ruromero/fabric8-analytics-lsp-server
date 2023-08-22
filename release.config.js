module.exports = {
  branches: [
    "master"
  ],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/npm",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/github",
      {
        assets: ["bin/**"]
      }
    ],
    [
      "@semantic-release/git",
      {
        assets: ["package.json", "CHANGELOG.md"],
        message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ]
  ],
  prepare: [
    {
      // build the Linux executable
      "path": "@semantic-release/exec",
      "cmd": "pkg . -t node18-linux-x64 -o bin/analytics-lsp-linux"
    },
    {
      // build the macOS executable
      "path": "@semantic-release/exec",
      "cmd": "pkg . -t node18-macos-x64 -o bin/analytics-lsp-macos"
    },
    {
      // build the windows executable
      "path": "@semantic-release/exec",
      "cmd": "pkg . -t node18-win-x64 -o bin/analytics-lsp-win.exe"
    },
    {
      // shasum
      "path": "@semantic-release/exec",
      "cmd": "shasum -a 256 analytics-lsp-linux > bin/analytics-lsp-linux.sha256 && shasum -a 256 analytics-lsp-macos > bin/analytics-lsp-macos.sha256 && shasum -a 256 analytics-lsp-win.exe > bin/analytics-lsp-win.sha256"
    },
  ]
}
