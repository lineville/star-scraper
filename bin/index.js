#!/usr/bin/env node

import dotenv from "dotenv";
dotenv.config();
import commandLineArgs from "command-line-args";
import ora from "ora";
import { Octokit } from "octokit";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

const MAX_STAR_GAZERS = 100000;
const MAX_ORG_MEMBERS = 100000;

marked.setOptions({ renderer: new TerminalRenderer() });

const fetch_org_members = async (octokit, params, per_page, page) => {
  return await octokit.request("GET /orgs/{org}/members", {
    org: params.org,
    per_page,
    page,
  });
};

const fetch_stargazers = async (octokit, params, per_page, page) => {
  return await octokit.request(`GET /repos/{owner}/{repo}/stargazers`, {
    owner: params.owner,
    repo: params.repo,
    per_page,
    page,
  });
};

// Fetches all, handles pagination for the given retriever function
const fetch_all = async (octokit, params, per_page, limit, retriever) => {
  let page = 1;
  let total_data = [];
  let payload = [];
  do {
    try {
      payload = await retriever(octokit, params, per_page, page);
    } catch (e) {
      if (e.message.includes("API rate limit")) {
        console.log(
          `😥 You exceeded the API rate limits for your PAT... Need to wait a while and try again and with a smaller --limit option!`
        );
        process.exit(1);
      }
    }
    total_data.push(...payload.data);
    page++;
  } while (payload.data.length == per_page && total_data.length < limit);
  return total_data;
};

const fetch_all_stargazers = (octokit, owner, repo, per_page, limit) =>
  fetch_all(
    octokit,
    { owner: owner, repo: repo },
    per_page,
    limit,
    fetch_stargazers
  );
const fetch_all_org_members = (octokit, org, per_page, limit) =>
  fetch_all(octokit, { org: org }, per_page, limit, fetch_org_members);

// Checks if a user is a member of an org
const is_org_member = (org_members, handle) => org_members.has(handle);

const main = async () => {
  // CLI options
  const optionDefinitions = [
    { name: "org", type: String, multiple: false },
    { name: "repo", type: String, multiple: false },
    { name: "limit", type: Number, multiple: false },
    { name: "token", type: String, multiple: false },
  ];
  const options = commandLineArgs(optionDefinitions);

  // GitHub API client
  const octokit = new Octokit({
    auth: options.token || process.env.GITHUB_TOKEN,
  });

  // Spinner start
  const spinner = ora({
    text: "Fetching Stargazers",
    spinner: {
      interval: 80,
      frames: [
        "⭐⭐⭐⭐⭐⭐⭐",
        "🌟⭐⭐⭐⭐⭐⭐",
        "🌟🌟⭐⭐⭐⭐⭐",
        "🌟🌟🌟⭐⭐⭐⭐",
        "🌟🌟🌟🌟⭐⭐⭐",
        "🌟🌟🌟🌟🌟⭐⭐",
        "🌟🌟🌟🌟🌟🌟⭐",
        "🌟🌟🌟🌟🌟🌟🌟",
      ],
    },
    indent: 4,
  }).start();

  // Fetch Stargazers of the repo
  const gazers = await fetch_all_stargazers(
    octokit,
    options.org,
    options.repo,
    100,
    options.limit || MAX_STAR_GAZERS
  );

  // Stop spinner
  spinner.succeed(`Fetched ${gazers.length} Stargazers`);

  // Second spinner for checking if the users are members of the org
  const spinner_2 = ora({
    text: "Checking if Stargazers are org members",
    spinner: {
      interval: 80,
      frames: [
        "👀🔎\u3000\u3000\u3000\u3000",
        "\u3000👀🔎\u3000\u3000\u3000",
        "\u3000\u3000👀🔎\u3000\u3000",
        "\u3000\u3000\u3000👀🔎\u3000",
        "\u3000\u3000\u3000\u3000👀🔎",
      ],
    },
    indent: 4,
  }).start();

  // Fetch all the members of the org
  const org_members = await fetch_all_org_members(
    octokit,
    options.org,
    100,
    options.limit || MAX_ORG_MEMBERS
  );

  // Stop 2nd spinner
  spinner_2.succeed(`Fetched ${org_members.length} org members from ${options.org}`);

  // Check if the stargazers are a member of the set of users from the org
  const internal_org_stars = gazers.filter((g) =>
    is_org_member(new Set(org_members.map(m => m.login)), g.login)
  ).length;

  const external_stars = gazers.length - internal_org_stars;

  const percentage_member_stars = Math.round(
    (internal_org_stars / gazers.length) * 100
  );

  // Print the results
  const report = `# 🌟 StarGazer Report\n\n
    - 🏗️ Organization: ${options.org}
    - 👨‍💻 Repository: ${options.repo}
    - 🌟 Total stars: ${gazers.length}
    - 👀 Org-member stars: ${internal_org_stars}
    - ❣️ Non-org-member stars: ${external_stars}
    - 👨‍🔬 ~${percentage_member_stars}% of stars come from within ${options.org}
  `;

  console.log("\n\n");

  console.log(marked(report));

  return report;
};

main();
