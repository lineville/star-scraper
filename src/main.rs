use clap::Parser;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use spinners::{Spinner, Spinners};
use std::collections::HashSet;
use std::env;
use std::iter::FromIterator;

// Global Configuration
const DEFAULT_LIMIT: u32 = 100_000;
const MAX_PAGE_SIZE: u32 = 100;

// CLI Arguments
#[derive(Parser, Debug)]
#[clap(author, version, about, long_about = None)]
struct Args {
  /// Organization name
  #[clap(short, long, value_parser)]
  org: String,

  /// Repo name
  #[clap(short, long, value_parser)]
  repo: String,

  /// GitHub token
  #[clap(short, long, value_parser)]
  token: Option<String>,

  // Limit the number of records to fetch
  #[clap(short, long, value_parser)]
  limit: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug)]
struct User {
  login: String,
}

async fn fetch_all_users(
  client: &Client,
  url: &str,
  limit: u32,
) -> Result<Vec<User>, Box<dyn std::error::Error>> {
  let mut total_data = Vec::new();
  let mut page = 1;

  loop {
    let response = client
      .get(url)
      .query(&[("page", page), ("per_page", MAX_PAGE_SIZE)])
      .send()
      .await?;

    match response.error_for_status_ref() {
      Ok(_response) => {
        let payload = response.json::<serde_json::Value>().await?;
        let users: Vec<User> = payload
          .as_array()
          .unwrap()
          .iter()
          .map(|star_gazer| User {
            login: star_gazer.as_object().unwrap()["login"]
              .as_str()
              .unwrap()
              .to_string(),
          })
          .collect();

        let payload_length = users.len();
        total_data.extend(users);
        page += 1;

        if payload_length < MAX_PAGE_SIZE as usize || total_data.len() >= limit as usize {
          break;
        }
      }
      Err(response) => {
        return Err(response.into());
      }
    }
  }
  Ok(total_data)
}

async fn fetch_star_gazers(
  client: &Client,
  org: &str,
  repo: &str,
  limit: u32,
) -> Result<Vec<User>, Box<dyn std::error::Error>> {
  let url = format!(
    "https://api.github.com/repos/{owner}/{repo}/stargazers",
    owner = org,
    repo = repo
  );

  fetch_all_users(client, &url, limit).await
}

async fn fetch_org_members(
  client: &Client,
  org: &str,
  limit: u32,
) -> Result<Vec<User>, Box<dyn std::error::Error>> {
  let url = format!("https://api.github.com/orgs/{org}/members", org = org);

  fetch_all_users(client, &url, limit).await
}

fn build_client(token: &str) -> Client {
  let mut headers = HeaderMap::new();
  headers.insert(
    AUTHORIZATION,
    HeaderValue::from_str(&format!("token {}", token)).unwrap(),
  );
  headers.insert(
    ACCEPT,
    HeaderValue::from_static("application/vnd.github.v3+json"),
  );
  headers.insert(USER_AGENT, HeaderValue::from_static("request"));

  Client::builder().default_headers(headers).build().unwrap()
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
  let args = Args::parse();
  let token = args
    .token
    .unwrap_or_else(|| env::var("GITHUB_TOKEN").expect("GITHUB_TOKEN not set"));
  let client = build_client(&token);

  let limit = args.limit.unwrap_or(DEFAULT_LIMIT);

  // Start first spinner
  let mut spinner = Spinner::new(Spinners::Aesthetic, "Fetching stargazers".into());

  let star_gazers = fetch_star_gazers(&client, &args.org, &args.repo, limit)
    .await?
    .iter()
    .map(|user| user.login.clone())
    .collect::<Vec<String>>();

  // Stop first spinner
  spinner.stop();

  // Start second spinner
  let mut spinner2 = Spinner::new(Spinners::Aesthetic, "Fetching org members".into());

  let org_members = HashSet::<String>::from_iter(
    fetch_org_members(&client, &args.org, limit)
      .await?
      .iter()
      .map(|user| user.login.clone()),
  );

  // Stop second spinner
  spinner2.stop();

  let internal_org_stars: usize = star_gazers
    .iter()
    .filter(|&user| org_members.contains(user))
    .collect::<Vec<&String>>()
    .len();

  let external_stars: usize = star_gazers.len() - internal_org_stars;

  let percentage_member_stars =
    ((internal_org_stars as f64 / star_gazers.len() as f64) * 100.0).ceil();

  let report: String = String::from(format!(
    "# 🌟 StarGazer Report\n\n
    - 🏗️ Organization: {}
    - 👨‍💻 Repository: {}
    - 🌟 Total stars: {}
    - 👀 Org-member stars: {}
    - ❣️ Non-org-member stars: {}
    - 👨‍🔬 ~{}% of stars come from within {}
    ",
    &args.org,
    &args.repo,
    star_gazers.len(),
    internal_org_stars,
    external_stars,
    percentage_member_stars,
    &args.org
  ));

  println!("\n\n");

  termimad::print_text(&report);

  Ok(())
}
