#!/usr/bin/env node

import dotenv from "dotenv";
dotenv.config();
import commandLineArgs from "command-line-args";
import ora, { Ora } from "ora";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";
import { Octokit } from "@octokit/core";
import { paginateRest } from "@octokit/plugin-paginate-rest";

const MyOctokit = Octokit.plugin(paginateRest);

marked.setOptions({ renderer: new TerminalRenderer() });

// ________CONSTANTS________
const DEFAULT_LIMIT: number = 100_000;

// Checks if a user is a member of an org
const is_org_member = (org_members: Set<string>, handle: string): boolean =>
  org_members.has(handle);

// Validates CLI options
const validateOptions = (options) => {
  if (!options.org || !options.repo) {
    throw new Error("Need to specify --org and --repo");
  }
};

// Main entry point
const main = async () => {
  // Define CLI options
  const optionDefinitions = [
    { name: "org", type: String, multiple: false },
    { name: "repo", type: String, multiple: false },
    {
      name: "limit",
      type: Number,
      multiple: false,
      defaultValue: DEFAULT_LIMIT,
    },
    { name: "token", type: String, multiple: false },
  ];

  // Parse + validate CLI options
  const options = commandLineArgs(optionDefinitions);
  validateOptions(options);

  // Create GitHub API client
  const octokit = new MyOctokit({
    auth: options.token || process.env.GITHUB_TOKEN,
  });

  // Spinner start
  const spinner: Ora = ora({
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

  // Fetch stargazers
  const star_gazers = await octokit.paginate(
    "GET /repos/{owner}/{repo}/stargazers",
    {
      owner: options.org,
      repo: options.repo,
      per_page: 100,
    }
  );

  // Stop spinner
  spinner.succeed(`Fetched ${star_gazers.length} Stargazers`);

  // Second spinner for checking if the users are members of the org
  const spinner_2: Ora = ora({
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

  // TODO: Not fetching all the org members... Fetch all the members of the org
  const org_members = await octokit.paginate("GET /orgs/{org}/members", {
    org: options.org,
    per_page: 100,
  });

  // Stop 2nd spinner
  spinner_2.succeed(
    `Fetched ${org_members.length} org members from ${options.org}`
  );

  // Check if the stargazers are a member of the set of users from the org
  const internal_org_stars: number = star_gazers.filter((g) =>
    is_org_member(new Set(org_members.map((m) => m.login)), g.login)
  ).length;

  const external_stars: number = star_gazers.length - internal_org_stars;

  const percentage_member_stars: number = Math.round(
    (internal_org_stars / star_gazers.length) * 100
  );

  // Print the results
  const report: string = `# 🌟 StarGazer Report\n\n
    - 🏗️ Organization: ${options.org}
    - 👨‍💻 Repository: ${options.repo}
    - 🌟 Total stars: ${star_gazers.length}
    - 👀 Org-member stars: ${internal_org_stars}
    - ❣️ Non-org-member stars: ${external_stars}
    - 👨‍🔬 ~${percentage_member_stars}% of stars come from within ${options.org}
  `;

  console.log("\n\n");

  console.log(marked(report));

  return report;
};

main();
