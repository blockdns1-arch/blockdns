#!/usr/bin/env node
// Creates and updates the four BlockDNS Vercel projects from this single repository.
//
// All four projects point at the same repo with rootDirectory=frontend and identical
// build settings; only NEXT_PUBLIC_SITE differs, so each URL renders its own site.
// Running the script again is safe: existing projects are patched, env vars are only
// rewritten when the value changed, and redeploys are opt-out with --skip-deploy.
//
//   VERCEL_TOKEN=xxx node scripts/deploy-vercel.mjs --dry-run
//   VERCEL_TOKEN=xxx node scripts/deploy-vercel.mjs
//   VERCEL_TOKEN=xxx node scripts/deploy-vercel.mjs --only=blockdns-swap --skip-deploy
//
// The token is never written to disk by this script. If VERCEL_TOKEN is not in the
// environment it is read from the gitignored base-deploy.env at the repo root.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.vercel.com";

const GITHUB_REPO = process.env.VERCEL_GITHUB_REPO || "blockdns1-arch/blockdns";
const BRANCH = process.env.VERCEL_BRANCH || "main";
const ROOT_DIRECTORY = "frontend";
const INSTALL_COMMAND = "npm install";
const BUILD_COMMAND = "npm run build";
const OUTPUT_DIRECTORY = ".next";

const SITES = [
  { project: "blockdns-home", site: "home" },
  { project: "blockdns-swap", site: "swap" },
  { project: "blockdns-explorer", site: "explorer" },
  { project: "blockdns-founder", site: "founder" },
];

const ADDRESS_ENV = {
  NEXT_PUBLIC_BDNS_ADDRESS: "BDNS",
  NEXT_PUBLIC_REGISTRY_ADDRESS: "BlockDNSRegistry",
  NEXT_PUBLIC_PRICER_ADDRESS: "BlockDNSPricer",
  NEXT_PUBLIC_RESOLVER_ADDRESS: "BlockDNSResolver",
  NEXT_PUBLIC_MARKET_ADDRESS: "BlockDNSMarketplace",
  NEXT_PUBLIC_SWAP_ADDRESS: "BlockDNSwap",
  NEXT_PUBLIC_BRIDGE_ADDRESS: "BdnBridge",
  NEXT_PUBLIC_BURN_ENGINE_ADDRESS: "BDNSBurnEngine",
  NEXT_PUBLIC_STAKING_VAULT_ADDRESS: "BDNSStakingVault",
  NEXT_PUBLIC_SPLITTER_ADDRESS: "BDNSRoyaltySplitter",
  NEXT_PUBLIC_MESSENGER_ADDRESS: "L2CrossDomainMessenger",
};

const args = process.argv.slice(2);
const flag = (name) => args.some((value) => value === `--${name}` || value.startsWith(`--${name}=`));
const value = (name, fallback) => {
  const hit = args.find((entry) => entry.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const DRY_RUN = flag("dry-run");
const SKIP_DEPLOY = flag("skip-deploy");
const PRINT_ENV = flag("print-env");
// Judges must be able to open the four URLs without a login, so protection removal is
// the default. Pass --keep-protection to leave password or SSO protection in place.
const PUBLIC_SITES = !flag("keep-protection");
const ONLY = value("only")
  ?.split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
// Team-scoped Vercel accounts need the team on every call. The numeric team id is
// awkward to find by hand, so accept the slug from the project URL instead and
// resolve it, and fall back to auto-detection when the token sees exactly one team.
const TEAM_SLUG = value("team", process.env.VERCEL_TEAM_SLUG?.trim() || "").replace(/^https?:\/\/vercel\.com\//, "");

function readToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN.trim();
  const local = join(ROOT, "base-deploy.env");
  if (!existsSync(local)) return "";
  for (const line of readFileSync(local, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*VERCEL_TOKEN\s*=\s*(.+?)\s*$/);
    if (match) return match[1].replace(/^["']|["']$/g, "");
  }
  return "";
}

const TOKEN = readToken();
let teamId = process.env.VERCEL_TEAM_ID?.trim() || "";

function apiUrl(pathname, query = {}) {
  const url = new URL(pathname, API);
  if (teamId) url.searchParams.set("teamId", teamId);
  for (const [key, entry] of Object.entries(query)) url.searchParams.set(key, entry);
  return url.toString();
}

async function call(method, pathname, { query, body } = {}) {
  const response = await fetch(apiUrl(pathname, query), {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: { code: "BAD_RESPONSE", message: text.slice(0, 300) } };
  }
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `${method} ${pathname} failed (${response.status})`);
    error.code = payload?.error?.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

function loadDeployment() {
  const file = join(ROOT, "deployments", "base-sepolia.json");
  if (!existsSync(file)) throw new Error(`missing ${file}: run the Base Sepolia deploy first`);
  return JSON.parse(readFileSync(file, "utf8"));
}

// Every project gets the same chain, explorer and contract configuration. Only
// NEXT_PUBLIC_SITE changes, which is what makes the four deployments different sites.
function envForProject(site, deployment) {
  const contracts = deployment.contracts || {};
  const env = {
    NEXT_PUBLIC_SITE: site.site,
    NEXT_PUBLIC_L2_CHAIN_ID: String(deployment.chainId ?? 84532),
    NEXT_PUBLIC_L2_CHAIN_NAME: "Base Sepolia",
    NEXT_PUBLIC_L2_RPC_URL: "https://sepolia.base.org",
    NEXT_PUBLIC_L2_EXPLORER_NAME: "Basescan",
    NEXT_PUBLIC_L2_EXPLORER_URL: "https://sepolia.basescan.org",
    NEXT_PUBLIC_NATIVE_CURRENCY_NAME: "Ether",
    NEXT_PUBLIC_NATIVE_CURRENCY_SYMBOL: "ETH",
    NEXT_PUBLIC_EXPLORER_URL: "https://sepolia.basescan.org",
    NEXT_PUBLIC_IPFS_GATEWAY: "https://gateway.pinata.cloud",
    NEXT_PUBLIC_SITE_HOME_URL: "https://blockdns-home.vercel.app",
    NEXT_PUBLIC_SITE_SWAP_URL: "https://blockdns-swap.vercel.app",
    NEXT_PUBLIC_SITE_EXPLORER_URL: "https://blockdns-explorer.vercel.app",
    NEXT_PUBLIC_SITE_FOUNDER_URL: "https://blockdns-founder.vercel.app",
  };

  for (const [key, contractName] of Object.entries(ADDRESS_ENV)) {
    const address = contracts[contractName];
    if (!address) throw new Error(`deployment manifest has no contract "${contractName}" for ${key}`);
    env[key] = address;
  }

  // Optional passthroughs, only set when the developer already has them locally.
  for (const key of ["NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "NEXT_PUBLIC_PINATA_JWT"]) {
    if (process.env[key]) env[key] = process.env[key];
  }

  return env;
}

const PROJECT_SETTINGS = {
  framework: "nextjs",
  rootDirectory: ROOT_DIRECTORY,
  installCommand: INSTALL_COMMAND,
  buildCommand: BUILD_COMMAND,
  outputDirectory: OUTPUT_DIRECTORY,
};

async function findProject(name) {
  const result = await call("GET", `/v9/projects/${encodeURIComponent(name)}`);
  return result;
}

// A team-scoped token must send teamId on every request. Accept the slug that
// appears in vercel.com/<slug>/... and resolve it to the numeric id.
async function resolveTeam() {
  if (teamId) return `VERCEL_TEAM_ID (${teamId})`;
  if (TEAM_SLUG) {
    const team = await call("GET", `/v2/teams/${encodeURIComponent(TEAM_SLUG)}`);
    teamId = String(team.id);
    return `team slug "${TEAM_SLUG}" -> ${team.name || team.slug} (${teamId})`;
  }

  const listed = await call("GET", "/v2/teams", { query: { limit: 20 } });
  const teams = listed.teams || [];
  if (teams.length === 1) {
    teamId = String(teams[0].id);
    return `auto-detected the only team this token can use: ${teams[0].name || teams[0].slug} (${teamId})`;
  }
  if (teams.length === 0) return "personal account (no team scope)";
  throw new Error(
    `this token can use ${teams.length} teams (${teams.map((team) => team.slug).join(", ")}).\n` +
      "Pass the one to use with --team=<slug> or VERCEL_TEAM_SLUG=<slug>. Projects created without\n" +
      "the right teamId would land in the wrong account."
  );
}

// Judges must be able to open the sites without a login. Team plans can enable
// deployment protection (password or Vercel authentication), which would hide all four
// URLs behind a prompt, so surface it instead of silently shipping a locked site.
function protectionIssue(project) {
  const name = project?.name || project?.projectId || "project";
  if (project?.passwordProtection) {
    return `${name}: Vercel password protection is ON - the site is not publicly reachable`;
  }
  const sso = project?.ssoProtection;
  if (sso && (sso.enabled === true || Object.keys(sso).length > 0)) {
    return `${name}: Vercel Authentication (SSO) protection is ON - the site is not publicly reachable`;
  }
  if (project?.oidc && (project.oidc.enabled === true || Object.keys(project.oidc).length > 0)) {
    return `${name}: OIDC protection is ON - the site is not publicly reachable`;
  }
  return "";
}

async function disableProtection(id) {
  // Deployment Protection is disabled by clearing every protection field. Schema
  // support differs across API versions: v9 rejects `oidc` as an unknown property,
  // so fall back to progressively smaller bodies until one is accepted.
  const attempts = [
    { version: "v10", body: { ssoProtection: null, oidc: null, passwordProtection: null } },
    { version: "v9", body: { ssoProtection: null, passwordProtection: null } },
    { version: "v9", body: { ssoProtection: null } },
  ];
  let lastError;
  for (const { version, body } of attempts) {
    try {
      return await call("PATCH", `/${version}/projects/${id}`, {
        query: { skipAutoDetectionConfirmation: "1" },
        body,
      });
    } catch (error) {
      lastError = error;
      if (error?.status !== 400 && error?.status !== 404) throw error;
    }
  }
  throw lastError;
}

async function createProject(site) {
  // `link` is rejected on create ("should NOT have additional property `link`"), so
  // the repository is attached afterwards through the dedicated endpoint.
  return call("POST", "/v10/projects", {
    body: {
      name: site.project,
      ...PROJECT_SETTINGS,
    },
  });
}

async function linkProject(id) {
  // Connects the GitHub repository so every push to main redeploys the project.
  return call("POST", `/v10/projects/${id}/link`, {
    body: { type: "github", repo: GITHUB_REPO, productionBranch: BRANCH },
  });
}

async function updateProject(id) {
  // PATCH rejects read-only fields, so send only what the API accepts.
  await call("PATCH", `/v9/projects/${id}`, {
    query: { skipAutoDetectionConfirmation: "1" },
    body: PROJECT_SETTINGS,
  });
}

async function syncEnv(id, desired) {
  const existing = (await call("GET", `/v10/projects/${id}/env`)).envs || [];
  const current = new Map(existing.map((entry) => [entry.key, entry.value]));

  for (const [key, value] of Object.entries(desired)) {
    if (current.get(key) === value) continue;
    if (current.has(key)) {
      await call("DELETE", `/v9/projects/${id}/env/${encodeURIComponent(key)}`);
      process.stdout.write(`    env ${key}: replaced\n`);
    } else {
      process.stdout.write(`    env ${key}: created\n`);
    }
    await call("POST", `/v10/projects/${id}/env`, {
      body: { key, value, type: "plain", target: ["production", "preview", "development"] },
    });
  }
}

// The deployments API rejects a bare repository name: it needs the numeric
// repository id plus the owner (org) id. Take them from whichever project is
// already linked to GitHub, and fall back to this repository's known ids.
async function gitSourceFor() {
  for (const site of SITES) {
    try {
      const link = (await findProject(site.project))?.link;
      if (link?.repoId) return { repoId: link.repoId, orgId: link.orgId ?? link.repoOwnerId };
    } catch {
      // a project that is missing or unreadable just means "not linked yet"
    }
  }
  return {
    repoId: Number(process.env.VERCEL_GIT_REPO_ID || 1395216887),
    orgId: Number(process.env.VERCEL_GIT_ORG_ID || 335220200),
  };
}

async function deploy(id, site, project) {
  const gitSource = { type: "github", repo: GITHUB_REPO, ref: BRANCH, ...(await gitSourceFor()) };
  const created = await call("POST", "/v13/deployments", {
    body: {
      name: site.project,
      project: id,
      target: "production",
      gitSource,
    },
  });

  const idToWatch = created?.id || created?.uid;
  if (!idToWatch) return { status: "submitted" };

  for (let attempt = 0; attempt < 80; attempt++) {
    const status = await call("GET", `/v13/deployments/${idToWatch}`);
    const state = status?.readyState || status?.status;
    if (state === "READY") return { status: "READY", url: status.url };
    if (state === "ERROR" || state === "CANCELED") {
      return { status: state, error: status?.error?.message || status?.inspectorUrl };
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  return { status: "TIMEOUT" };
}

// Prints the exact env vars for each project so a manual Vercel dashboard setup,
// or a teammate without a token, can paste the same values the API would set.
// Everything here is public chain data except the two optional passthroughs.
function printEnv() {
  const deployment = loadDeployment();
  console.log(
    [
      "# Vercel environment variables",
      "",
      "Paste these into each project's **Settings → Environment Variables**.",
      "Generated by `node scripts/deploy-vercel.mjs --print-env` from `deployments/base-sepolia.json`.",
      "All values are public chain data; enable all three targets (Production, Preview, Development).",
      "",
    ].join("\n")
  );

  for (const site of SITES) {
    const env = envForProject(site, deployment);
    console.log(`\n## ${site.project}\n`);
    console.log("```bash");
    for (const [key, value] of Object.entries(env)) console.log(`${key}=${value}`);
    console.log("```\n");
  }
}

async function main() {
  const deployment = loadDeployment();

  if (PRINT_ENV) {
    printEnv();
    return;
  }

  if (!TOKEN) {
    if (!DRY_RUN) {
      console.error(
        [
          "VERCEL_TOKEN is missing.",
          "",
          "Create a token at https://vercel.com/account/tokens and either export it:",
          "  $env:VERCEL_TOKEN='xxx'   # PowerShell",
          "or add VERCEL_TOKEN=xxx to the gitignored base-deploy.env at the repo root.",
          "",
          "If the token belongs to a team, pass its slug: --team=<slug> or VERCEL_TEAM_SLUG=<slug>.",
        ].join("\n")
      );
      process.exitCode = 1;
      return;
    }
    console.log("no VERCEL_TOKEN found, printing the plan only (dry run)");
  } else {
    const whoami = await call("GET", "/v2/user");
    console.log(`authenticated as ${whoami.user?.username || whoami.user?.email || "unknown"}`);
    console.log(`scope: ${await resolveTeam()}`);
  }

  console.log(
    `repo=${GITHUB_REPO}#${BRANCH} rootDirectory=${ROOT_DIRECTORY} build="${BUILD_COMMAND}" output=${OUTPUT_DIRECTORY}`
  );
  if (DRY_RUN) console.log("dry run: no Vercel API writes will be made");

  const sites = ONLY && ONLY.length > 0 ? SITES.filter((site) => ONLY.includes(site.project)) : SITES;
  if (sites.length === 0) throw new Error(`--only matched no project, expected one of: ${SITES.map((s) => s.project).join(", ")}`);

  const summary = [];
  const protection = [];

  for (const site of sites) {
    console.log(`\n${site.project} (NEXT_PUBLIC_SITE=${site.site})`);
    const env = envForProject(site, deployment);
    let project;
    let created = false;

    if (!TOKEN) {
      console.log(`  would create project, sync ${Object.keys(env).length} env vars, deploy ${site.project}`);
      summary.push({ ...site, action: "create", url: `https://${site.project}.vercel.app` });
      continue;
    }

    try {
      project = await findProject(site.project);
      console.log("  exists, updating settings");
    } catch (error) {
      if (error.status !== 404) throw error;
      if (DRY_RUN) {
        console.log("  would create project linked to GitHub");
        console.log(`  would sync env: ${Object.keys(env).length} vars (NEXT_PUBLIC_SITE=${site.site}, ${Object.keys(ADDRESS_ENV).length} addresses)`);
        summary.push({ ...site, action: "create", url: `https://${site.project}.vercel.app` });
        continue;
      }
      project = await createProject(site);
      created = true;
      console.log("  created");
    }

    if (!DRY_RUN) {
      if (!created) await updateProject(project.id);
      await syncEnv(project.id, env);
      if (!project.link) {
        await linkProject(project.id);
        console.log("  linked GitHub repository");
      }
    } else {
      console.log(`  would sync env: ${Object.keys(env).length} vars (NEXT_PUBLIC_SITE=${site.site}, ${Object.keys(ADDRESS_ENV).length} addresses)`);
    }

    const locked = protectionIssue(project);
    if (locked) {
      protection.push(locked);
      if (PUBLIC_SITES) {
        if (DRY_RUN) {
          console.log(`  would remove deployment protection (${locked})`);
        } else {
          await disableProtection(project.id);
          console.log("  removed deployment protection so the site is public");
        }
      } else {
        console.log(`  WARNING ${locked}`);
      }
    } else if (!DRY_RUN) {
      console.log("  deployment protection: off (public)");
    }

    if (SKIP_DEPLOY || DRY_RUN) {
      console.log("  deploy skipped");
      summary.push({ ...site, action: created ? "created" : "updated", url: `https://${site.project}.vercel.app` });
      continue;
    }

    const result = await deploy(project.id, site, project);
    if (result.status === "READY") {
      const url = `https://${result.url.replace(/^https?:\/\//, "")}`;
      console.log(`  deployed: ${url}`);
      summary.push({ ...site, action: created ? "created" : "updated", url });
    } else {
      console.log(`  deploy ${result.status}${result.error ? `: ${result.error}` : ""}`);
      summary.push({ ...site, action: created ? "created" : "updated", url: `https://${site.project}.vercel.app`, deploy: result.status });
    }
  }

  console.log("\nsummary");
  for (const entry of summary) {
    console.log(`  ${entry.project.padEnd(20)} NEXT_PUBLIC_SITE=${entry.site.padEnd(9)} ${entry.url}${entry.deploy ? ` (${entry.deploy})` : ""}`);
  }

  if (protection.length > 0) {
    console.log("\ndeployment protection");
    for (const issue of protection) console.log(`  ${issue}`);
    if (!PUBLIC_SITES) {
      console.log(
        "\n  The four URLs must be open to anyone, otherwise nobody outside the team can judge them.\n" +
          "  Re-run with --public to remove protection, or set it to Disabled in the Vercel dashboard\n" +
          "  under Project > Settings > Deployment Protection."
      );
    }
  }

  if (!DRY_RUN && !SKIP_DEPLOY) {
    console.log("\nEvery project redeploys automatically on each push to " + BRANCH + ".");
  }
}

main().catch((error) => {
  console.error(`\nfailed: ${error.message}${error.code ? ` (${error.code})` : ""}`);
  if (/gitRepositoryNotFound|git_repo|integration|permission/i.test(error.message)) {
    console.error(
      "\nThe token cannot see the GitHub repository. Install the Vercel GitHub App on the repo\n" +
        "(vercel.com/settings/integrations) or run the script with a token from that account."
    );
  }
  if (/team/i.test(error.message) && /scope|access|forbidden/i.test(error.message)) {
    console.error(
      "\nThe token does not have access to that team. Create the token from inside the team\n" +
        "(vercel.com/<team>/settings/tokens) so it carries the team scope."
    );
  }
  process.exitCode = 1;
});
