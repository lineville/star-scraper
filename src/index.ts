#!/usr/bin/env bun

import dotenv from "dotenv";
dotenv.config();
import commandLineArgs from "command-line-args";
import ora, { Ora } from "ora";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";
import { Octokit } from "@octokit/core";
import { PaginateInterface, paginateRest } from "@octokit/plugin-paginate-rest";

// Global Configuration
const GitHubClient = Octokit.plugin(paginateRest);
marked.setOptions({ renderer: new TerminalRenderer() });
const DEFAULT_LIMIT: number = 100_000;
const MAX_PAGE_SIZE: number = 100;

// __________________________________________________________________________

// Handles CLI options
const handleCLIOptions = async () => {
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

  if (options.org == null) {
    process.stderr.write("Need to specify --org");
    process.exit(1);
  }

  const token = options.token ?? process.env.GITHUB_TOKEN;
  if (!token) {
    process.stderr.write("No GitHub token specified or found in environment");
    process.exit(1);
  }

  return { options, token };
};

const fetchStarGazers = async (
  octokit: Octokit & {
    paginate: PaginateInterface;
  },
  org: string,
  repo: string
): Promise<string[]> => {
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
      owner: org,
      repo: repo,
      per_page: MAX_PAGE_SIZE,
    },
    (res) => res.data.map((stargazer) => stargazer?.login)
  );

  // Stop spinner
  spinner.succeed(`Found ${star_gazers.length} star gazers from ${org}/${repo}`);

  return star_gazers;
};

const fetchOrgMembers = async (
  octokit: Octokit & {
    paginate: PaginateInterface;
  },
  org: string
): Promise<Set<string>> => {
  // Spinner for checking if the users are members of the org
  const spinner: Ora = ora({
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
        org,
        per_page: MAX_PAGE_SIZE,
        filter: "all",
      },
      (res) => res.data.map((member) => member.login)
    )
  );

  // Stop org members spinner
  spinner.succeed(`Found ${org_members.size} org members in ${org}`);

  return org_members;
};

const fetchRepos = async (
  octokit: Octokit & {
    paginate: PaginateInterface;
  },
  org: string
): Promise<string[]> => {
  // Spinner for checking if the users are members of the org
  const spinner: Ora = ora({
    text: `Fetching all public repos in org ${org}`,
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
  const repos = await octokit.paginate(
    "GET /orgs/{org}/repos",
    { org, type: "public", per_page: MAX_PAGE_SIZE, sort: "updated"},
    (res) => res.data.map((repo) => repo?.name)
  );

  // Stop org members spinner
  spinner.succeed(`Found ${repos.length} public repos in ${org}`);

  return repos;
};

const createStarGazerReport = (
  org: string,
  repo: string,
  star_gazers: string[],
  org_members: Set<string>
): string => {
  // Filter the star_gazers by the ones that belong to the org
  const internal_org_stars: number = star_gazers.filter((sg) =>
    sg ? org_members.has(sg) : false
  ).length;

  // Stargazer count of non-org members
  const external_stars: number = star_gazers.length - internal_org_stars;

  // Percentage of org member stars of the total stars
  const percentage_member_stars: number = Math.round(
    (internal_org_stars / star_gazers.length) * 100
  );

  // Print the results
  const report: string = `# 🌟 StarGazer Report\n\n
    - 🏗️ Organization: ${org}
    - 👨‍💻 Repository: ${repo}
    - 🌟 Total stars: ${star_gazers.length}
    - 👀 Org-member stars: ${internal_org_stars}
    - ❣️ Non-org-member stars: ${external_stars}
    - 👨‍🔬 ~${percentage_member_stars}% of stars come from within ${org}
  \n\n`;

  return report;
};

// Main entry point
const main = async () => {
  // Parse CLI options
  const { options, token } = await handleCLIOptions();

  // Create GitHub API client using token from cli or env
  const octokit = new GitHubClient({ auth: token });

  const org_members = await fetchOrgMembers(octokit, options.org);

  let report = "";
  let repos =
    options.repo == null
      ? await fetchRepos(octokit, options.org)
      : [options.repo];

  for (const repo of repos.slice(0, 5)) {
    const star_gazers = await fetchStarGazers(octokit, options.org, repo);
    report += createStarGazerReport(
      options.org,
      repo,
      star_gazers,
      org_members
    );
  }

  console.log(marked(report));

  return report;
};

// Call main, wait for it to finish, and then exit
await main();
process.exit(0);
