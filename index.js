import 'dotenv';
import commandLineArgs from "command-line-args";
import ora from 'ora';
import { Octokit } from "octokit";


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
    return false;
  }
};

const fetch_stargazers = async (octokit, owner, repo, per_page, limit) => {
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
    { name: "token", type: String, multiple: false }
  ];
  const options = commandLineArgs(optionDefinitions);
  
  const octokit = new Octokit({ auth: options.token || process.env.GITHUB_TOKEN });


  const spinner = ora({ 
    text: "Fetching Stargazers",
    spinner: "aesthetic",
    indent: 4,
  }).start();
  
  const gazers = await fetch_stargazers(octokit, options.org, options.repo, 100, options.limit || 1000);
  spinner.succeed(`Fetched ${gazers.length} Stargazers`);

  const spinner_2 = ora({
    text: "Checking if Stargazers are org members",
    spinner: "aesthetic",
    indent: 4,
  }).start();
  const members_of_org = await Promise.all(
    gazers.map(async (gazer) => {
      const works_at_org = await is_org_member(octokit, options.org, gazer.login);
      return {
        login: gazer.login,
        is_org_member: works_at_org,
      };
    })
  );
  const org_member_stars = members_of_org.filter((member) => member.is_org_member).length;
  const percentage_member_stars = (org_member_stars / gazers.length) * 100;
  spinner_2.succeed(`(${org_member_stars}/${gazers.length}) -- ${percentage_member_stars}% of stars on repo ${options.org}/${options.repo} come from members of the ${options.org} organization.`);

  const report = `## 🌟 StarGazer Report

    - 🏗️ Organization: ${options.org}
    - 👨‍💻 Repository: ${options.repo}
    - 🌟 Total stars: ${gazers.length}
    - 👀 Org-member stars: ${org_member_stars}
    - ❣️ Non-org-member stars: ${gazers.length - org_member_stars}
    - 👨‍🔬 ${percentage_member_stars}% of stars come from within the org
  `;
  
  console.log(report);
  return report;
};

main();
