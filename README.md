# 🌟 Star Scraper

CLI tool and GitHub Action to get some basic stats about a repo's stars and how many of those stars come from members of that organization 👀

## Installation

```bash
yarn global add star-scraper
# or
# npm i -g star-scraper
# or
# cargo install star-scraper
```

![star-scraper](https://user-images.githubusercontent.com/25349044/175988348-fbb5f343-7faa-4fe1-a38f-d092296b522a.gif)

## Usage

```bash
star-scraper --org <my-github-org> \
             --repo <my-github-repo> \
             --token <my-github-pat> \
             --limit <max-records-to-fetch>
```

- `--org`, `--repo` and `--token` are required.
- `--token` can optionally be supplied as an environment variable via `GITHUB_TOKEN`.
- `--limit` is optional and defaults to 100,000.

## Run as a GitHub action

- Fork this repo
- Set the `GH_TOKEN` actions secret on the repo
- Manually run the star gazer report workflow
