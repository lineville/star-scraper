import 'dotenv';
import commandLineArgs from "command-line-args";
import ora from 'ora';
import { Octokit } from "octokit";

// Setup
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const is_org_member = async (org, handle) => {
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
    return false;
  }
};

const fetch_stargazers = async (owner, repo, per_page, limit) => {
  let page = 1;
  let gazers = [];
  let payload = [];
  do {
    payload = await octokit.request(`GET /repos/{owner}/{repo}/stargazers`, {
      owner,
      repo,
      per_page,
      page,
    });
    gazers.push(...payload.data);
    page++;
  } while (payload.data.length == per_page && gazers.length < limit);
  return gazers;
};

const main = async () => {
  const optionDefinitions = [
    { name: "org", type: String, multiple: false },
    { name: "repo", type: String, multiple: false},
    { name: "limit", type: Number, multiple: false },
  ];
  const options = commandLineArgs(optionDefinitions);

  const spinner = ora({ 
    text: "Fetching Stargazers",
    spinner: "aesthetic",
    indent: 4,
    isSilent: true
  }).start();
  
  
  const gazers = await fetch_stargazers(options.org, options.repo, 100, options.limit);
  spinner.succeed();

  console.log(`Total stars: ${gazers.length}`);
  const members_of_org = await Promise.all(
    gazers.map(async (gazer) => {
      const works_at_org = await is_org_member(options.org, gazer.login);
      return {
        login: gazer.login,
        is_org_member: works_at_org,
      };
    })
  );
  console.log(`Members: ${members_of_org.filter((h) => h.is_org_member).length}`);
  console.log(
    `Percentage of org members: ${
      (members_of_org.filter((h) => h.is_org_member).length / members_of_org.length) * 100
    }%`
  );
};

main();
