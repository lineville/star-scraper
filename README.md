# 🌟 Star Scraper

CLI tool and GitHub Action to get some basic stats about a repo's stars and how many of those stars come from members of that organization 👀

## Installation

```bash
yarn global add star-scraper
# or
npm i -g star-scraper
```

![output](https://user-images.githubusercontent.com/25349044/175360213-ee0970b1-e3cc-499a-bd62-845b0f18f8d2.gif)


## Local Development

```bash
yarn
yarn start --org <my-github-org> \
                    --repo <my-github-repo> \
                    --token <my-github-pat> \
                    --limit <max-stars-to-fetch>
```

- `<max-stars-to-fetch>` is optional and defaults to 1,000.
- `--org`, `--repo` and `--token` are required.

Or simply run this as a GitHub action by forking and setting the repo secret `GH_TOKEN` to your GitHub PAT.

