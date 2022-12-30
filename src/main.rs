use clap::Parser;
use octocrab::{
    models::{StarGazer, User},
    Octocrab,
};
use spinners::{Spinner, Spinners};
use std::env;

// Global Configuration
const DEFAULT_LIMIT: u32 = 10000;

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

async fn fetch_star_gazers(
    client: &Octocrab,
    org: &str,
    repo: &str,
    limit: u32,
) -> Result<Vec<StarGazer>, Box<dyn std::error::Error>> {
    let mut star_gazers: Vec<StarGazer> = Vec::new();

    let mut page: u8 = 1;
    let per_page: u8 = 100;

    loop {
        let mut new_star_gazers = client
            .repos(org, repo)
            .list_stargazers()
            .per_page(per_page)
            .page(page)
            .send()
            .await?;

        let new_star_gazers_count = new_star_gazers.items.len();

        star_gazers.append(&mut new_star_gazers.items);

        if star_gazers.len() >= limit as usize {
            break;
        }

        if new_star_gazers_count < per_page as usize {
            break;
        }

        page += 1;
    }

    Ok(star_gazers)
}

async fn fetch_org_members(
    client: &Octocrab,
    org: &str,
    limit: u32,
) -> Result<Vec<User>, Box<dyn std::error::Error>> {
    let mut org_members: Vec<User> = Vec::new();

    let mut page: u8 = 1;
    let per_page: u8 = 100;

    loop {
        let mut new_org_members = client
            .orgs(org)
            .list_members()
            .per_page(per_page)
            .page(page)
            .send()
            .await?;

        let new_org_members_count = new_org_members.items.len();

        org_members.append(&mut new_org_members.items);

        if org_members.len() >= limit as usize {
            break;
        }

        if new_org_members_count < per_page as usize {
            break;
        }

        page += 1;
    }

    Ok(org_members)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();
    let token = args
        .token
        .unwrap_or_else(|| env::var("GITHUB_TOKEN").expect("GITHUB_TOKEN not set"));

    let client = octocrab::OctocrabBuilder::new()
        .personal_token(token)
        .build()?;

    let limit = match args.limit {
        Some(limit) => limit,
        None => DEFAULT_LIMIT,
    };

    // Start first spinner
    let mut spinner = Spinner::new(Spinners::Aesthetic, "Fetching stargazers".into());

    let star_gazers = fetch_star_gazers(&client, &args.org, &args.repo, limit).await?;

    // Stop first spinner
    spinner.stop_with_symbol(format!("({}) 🌟", star_gazers.len()).as_str());

    // Start second spinner
    let mut spinner2 = Spinner::new(Spinners::Aesthetic, "Fetching org members".into());

    let members = match fetch_org_members(&client, &args.org, limit).await {
        Ok(org_members) => {
            let members: Vec<String> = org_members.iter().map(|u| u.to_owned().login).collect();
            spinner2.stop_with_symbol(format!("({}) 🌟", members.len()).as_str());
            members
        }
        Err(_e) => {
            spinner2.stop();
            println!("{} Is not an org so all of the stars are external, try again with a repo that belongs to an organization (not an individual account)", &args.org);
            std::process::exit(0);
        }
    };

    let internal_org_stars = star_gazers
        .iter()
        .filter(|sg| members.contains(&sg.user.as_ref().unwrap().login))
        .count();

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
