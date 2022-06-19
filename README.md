# 🌟 Star Scraper

CLI tool and GitHub Action to get some basic stats about a repo's stars and how many of those stars come from members of that organization 👀

## Usage

```bash
yarn
yarn --silent start --org <my-github-org> \
                    --repo <my-github-repo> \
                    --token <my-github-pat> \
                    --limit <max-stars-to-fetch>
```

- `<max-stars-to-fetch>` is optional and defaults to 1,000.
- `--org`, `--repo` and `--token` are required.

Or simply run this as a GitHub action by forking and setting the repo secret `GH_TOKEN` to your GitHub PAT.
