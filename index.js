import { Octokit } from "octokit";
import "dotenv/config";
const octokit = new Octokit({ auth: `${process.env.GH_PAT}` });

const is_hubber = async (handle) => {
  try {
    const member_of_github = await octokit.request('GET /orgs/{org}/members/{username}', {
      org: 'github',
      username: handle
    });
    return member_of_github.status == 204;
  } catch (e) {
    return false;
  }
}

const fetch_stargazers = async (owner, repo, per_page = 100) => {
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
  } while (payload.data.length == per_page);
  return gazers;
};


const main = async () => {
  const gazers = await fetch_stargazers("github", "gh-valet");
  console.log(`Total stars: ${gazers.length}`);
  const hubbers = await Promise.all(gazers.map(async (gazer) => {
    const works_at_github = await is_hubber(gazer.login);
    return {
      login: gazer.login,
      is_hubber: works_at_github,
    }
  }));
  console.log(`Hubbers: ${hubbers.filter(h => h.is_hubber).length}`);
  console.log(`Percentage of hubbers: ${(hubbers.filter(h => h.is_hubber).length / hubbers.length) * 100}%`);
};

main();
