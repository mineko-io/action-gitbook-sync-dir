# Gitbook Sync Dir Action

Synchronizes a repository directory to a cloud-based [Gitbook](https://www.gitbook.com/) space.

## Usage
Create a github workflow in the `.github` folder, e.g. `.github/workflows/gitbook.yml`:

```yml
name: Sync dir to Gitbook
on: [push]

jobs:
  gitbook:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          fetch-depth: 0
      - uses: wagoid/action-gitbook-sync-dir@v1
        with:
          token: ${{ secret.GITBOOK_TOKEN }}
          dir: doc/adr
          space: foo-bar
          group: ADRs
```

## Inputs

### `token`

### `dir`

### `space`

### `group`
