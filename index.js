import dotenv from 'dotenv';
dotenv.config();
import commandLineArgs from "command-line-args";
import ora from 'ora';
import { Octokit } from "octokit";

// Checks if a user is a member of an org
const is_org_member = async (octokit, org, handle) => {
  try {
    const member_of_org = await octokit.request(
      "GET /orgs/{org}/members/{username}",
      {
        org,
        username: handle,
      }
    );
    return member_of_org.status == 204;
  } catch (e) {
    if (e.message.includes('API rate limit')) {
      console.log(`😥 You exceeded the API rate limits for your PAT... Need to wait a while and try again and with a smaller --limit option!`)
      process.exit(1);
    }

    return false;
  }
};

// Fetches all the stargazers of a repo
const fetch_stargazers = async (octokit, owner, repo, per_page, limit) => {
  let page = 1;
  let gazers = [];
  let payload = [];
  do {
    try {
      payload = await octokit.request(`GET /repos/{owner}/{repo}/stargazers`, {
        owner,
        repo,
        per_page,
        page,
      });
    } catch (e) {
      if (e.message.includes('API rate limit')) {
        console.log(`😥 You exceeded the API rate limits for your PAT... Need to wait a while and try again and with a smaller --limit option!`)
        process.exit(1);
      }
    }
    gazers.push(...payload.data);
    page++;
  } while (payload.data.length == per_page && gazers.length < limit);
  return gazers;
};


const main = async () => {
  
  // CLI options
  const optionDefinitions = [
    { name: "org", type: String, multiple: false },
    { name: "repo", type: String, multiple: false},
    { name: "limit", type: Number, multiple: false },
    { name: "token", type: String, multiple: false }
  ];
  const options = commandLineArgs(optionDefinitions);
  
  // GitHub API client
  const octokit = new Octokit({ auth: options.token || process.env.GITHUB_TOKEN });

  // Spinner
  const spinner = ora({ 
    text: "Fetching Stargazers",
    spinner: {
      "interval": 80,
      "frames": [
        "⭐⭐⭐⭐⭐⭐⭐",
        "🌟⭐⭐⭐⭐⭐⭐",
        "🌟🌟⭐⭐⭐⭐⭐",
        "🌟🌟🌟⭐⭐⭐⭐",
        "🌟🌟🌟🌟⭐⭐⭐",
        "🌟🌟🌟🌟🌟⭐⭐",
        "🌟🌟🌟🌟🌟🌟⭐",
        "🌟🌟🌟🌟🌟🌟🌟",
      ]
    },
    indent: 4,
  }).start();

  
  // Fetch Stargazers of the repo
  const gazers = await fetch_stargazers(octokit, options.org, options.repo, 100, options.limit || 1000);
  spinner.succeed(`Fetched ${gazers.length} Stargazers`);

  // Second spinner for checking if the users are members of the org
  const spinner_2 = ora({
    text: "Checking if Stargazers are org members",
    spinner: {
      "interval": 80,
      "frames": [
        "👀🔎\u3000\u3000\u3000\u3000",
        "\u3000👀🔎\u3000\u3000\u3000",
        "\u3000\u3000👀🔎\u3000\u3000",
        "\u3000\u3000\u3000👀🔎\u3000",
        "\u3000\u3000\u3000\u3000👀🔎"
      ]
    },
    indent: 4,
  }).start();

  // Check if the users are members of the org
  const members_of_org = await Promise.all(
    gazers.map(async (gazer) => {
      const works_at_org = await is_org_member(octokit, options.org, gazer.login);
      return {
        login: gazer.login,
        is_org_member: works_at_org,
      };
    })
  );

  // Print the results
  const org_member_stars = members_of_org.filter((member) => member.is_org_member).length;
  const percentage_member_stars = Math.round((org_member_stars / gazers.length) * 100);
  spinner_2.succeed(`${percentage_member_stars}% (${org_member_stars}/${gazers.length}) of ${options.org}/${options.repo}'s ⭐'s come from within ${options.org}`);

  const report = `## 🌟 StarGazer Report

    - 🏗️ Organization: ${options.org}
    - 👨‍💻 Repository: ${options.repo}
    - 🌟 Total stars: ${gazers.length}
    - 👀 Org-member stars: ${org_member_stars}
    - ❣️ Non-org-member stars: ${gazers.length - org_member_stars}
    - 👨‍🔬 ~${percentage_member_stars}% of stars come from within ${options.org}
  `;

  console.log(report);
  return report;
};

main();
