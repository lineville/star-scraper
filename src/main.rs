use clap::Parser;
use octocrab::{Octocrab, models::User};
use spinners::{Spinner, Spinners};
use std::env;

// Global Configuration
const DEFAULT_LIMIT: u8 = 100;

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
    limit: Option<u8>,
}


async fn fetch_star_gazers(
    client: &Octocrab,
    org: &str,
    repo: &str,
    limit: u8,
) -> Result<Vec<User>, Box<dyn std::error::Error>> {
    let page = client
        .repos(org, repo)
        .list_stargazers()
        .per_page(limit)
        .send()
        .await?;

    let results = client.all_pages(page).await?;
    Ok(results)
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

    star_gazers.iter().for_each(|sg| {
        println!("{}", sg.login);
    });

    // Stop first spinner
    spinner.stop_with_symbol(format!("({}) 🌟", star_gazers.len()).as_str());

    // // Start second spinner
    // let mut spinner2 = Spinner::new(Spinners::Aesthetic, "Fetching org members".into());

    // TODO Use the orgs.list_members method (once released) to get org members

    // // Stop second spinner
    // spinner2.stop_with_symbol("🌟");

    // let internal_org_stars: usize = star_gazers
    //     .iter()
    //     .filter(|&user| org_members.contains(user))
    //     .collect::<Vec<&String>>()
    //     .len();

    // let external_stars: usize = star_gazers.len() - internal_org_stars;

    // let percentage_member_stars =
    //     ((internal_org_stars as f64 / star_gazers.len() as f64) * 100.0).ceil();

    // let report: String = String::from(format!(
    //     "# 🌟 StarGazer Report\n\n
    // - 🏗️ Organization: {}
    // - 👨‍💻 Repository: {}
    // - 🌟 Total stars: {}
    // - 👀 Org-member stars: {}
    // - ❣️ Non-org-member stars: {}
    // - 👨‍🔬 ~{}% of stars come from within {}
    // ",
    //     &args.org,
    //     &args.repo,
    //     star_gazers.len(),
    //     internal_org_stars,
    //     external_stars,
    //     percentage_member_stars,
    //     &args.org
    // ));

    // println!("\n\n");

    // termimad::print_text(&report);

    Ok(())
}
