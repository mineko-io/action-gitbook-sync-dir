# Gitbook Sync Dir Action

Synchronizes markdown files of repository directory to a cloud-based [Gitbook](https://www.gitbook.com/) space.
Uses filename as document title. Does not support sub-directories.

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
          org: mineko
          space: foo-bar
          group: ADRs
          apiEndpoint: https://api-beta.gitbook.com/v1
```

## Inputs

### `token`
gitbook access token

### `dir`
repository directory to sync

### `org`
organization title

### `space`
space name

### `apiEndpoint`
endpoint to gitbook api

### `group`
optional name of group to create / sync pages under
