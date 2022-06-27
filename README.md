# 🌟 Star Scraper

CLI tool and GitHub Action to get some basic stats about a repo's stars and how many of those stars come from members of that organization 👀

## Installation

```bash
yarn global add star-scraper
# or
npm i -g star-scraper
```
![star-scraper](https://user-images.githubusercontent.com/25349044/175988348-fbb5f343-7faa-4fe1-a38f-d092296b522a.gif)

## Local Development

```bash
yarn
yarn start --org <my-github-org> \
                    --repo <my-github-repo> \
                    --token <my-github-pat> \
                    --limit <max-stars-to-fetch>
```

- `--limit` is optional and defaults to 1,000.
- `--org`, `--repo` and `--token` are required.

Or simply run this as a GitHub action by forking and setting the repo secret `GH_TOKEN` to your GitHub PAT.

