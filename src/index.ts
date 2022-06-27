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

const DEFAULT_LIMIT: number = 100_000;

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

  // Parse & validate CLI options
  const options = commandLineArgs(optionDefinitions);

  if (!options.org || !options.repo) {
    throw new Error("Need to specify --org and --repo");
    process.exit(1);
  }

  // Create GitHub API client using token from cli or env
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
    },
    (res) => res.data.map((stargazer) => stargazer?.login)
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

  // Fetch all org members
  const org_members = new Set(
    await octokit.paginate(
      "GET /orgs/{org}/members",
      {
        org: options.org,
        per_page: 100,
        filter: "all",
      },
      (res) => res.data.map((member) => member.login)
    )
  );

  // Stop 2nd spinner
  spinner_2.succeed(
    `Fetched ${org_members.size} org members from ${options.org}`
  );

  // Filter the star_gazers by the ones that belong to the org
  const internal_org_stars = star_gazers.filter((g) =>
    g ? org_members.has(g) : false
  );

  // Stargazer count of non-org members
  const external_stars: number = star_gazers.length - internal_org_stars.length;

  // Percentage of org member stars of the total stars
  const percentage_member_stars: number = Math.round(
    (internal_org_stars.length / star_gazers.length) * 100
  );

  // Print the results
  const report: string = `# 🌟 StarGazer Report\n\n
    - 🏗️ Organization: ${options.org}
    - 👨‍💻 Repository: ${options.repo}
    - 🌟 Total stars: ${star_gazers.length}
    - 👀 Org-member stars: ${internal_org_stars.length}
    - ❣️ Non-org-member stars: ${external_stars}
    - 👨‍🔬 ~${percentage_member_stars}% of stars come from within ${options.org}
  `;

  console.log("\n\n");

  console.log(marked(report));

  return report;
};

await main();

process.exit(0);
