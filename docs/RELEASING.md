# Releases and npm publishing

Merge the release-please PR to create the GitHub tag and run the `Release`
workflow. The publisher checks out that exact tag, verifies the package version,
runs tests and builds every exported entry point, including the CDN bundles.
Publish and Storybook use Node 24 with a regular `npm ci`.

The GitHub release and npm publication are separate steps. A green
`release-please` job does not mean the package reached npm. Check the `publish`
job and `npm view @fairu/player version`.

## Authentication

Node 24's npm supports trusted publishing. The workflow already grants
`id-token: write`; npm tries OIDC before falling back to `NPM_TOKEN`.
The package owner must have configured the following trusted publisher in
the npm settings for `@fairu/player`:

- GitHub organization: `sushidev-team`
- Repository: `fairu-player`
- Workflow filename: `release.yml`
- GitHub environment: none (this workflow does not use an environment)

Without that relationship, the existing `NPM_TOKEN` secret must contain a valid
token with publishing access to this package. An npm `E404` on the `PUT` for an
existing, publicly readable package can indicate missing write access or invalid
credentials. Do not rename or recreate the package to work around that response.
See the [npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).

## Retry a failed publication

Use **Actions → Release → Run workflow** on `main`, and enter the existing tag,
for example `v1.8.0`. This builds the tag's source using the current workflow;
it does not move a tag or create a second GitHub release.

Only retry a version that is absent from npm. Published npm versions cannot be
overwritten. Fixes committed after a tag need a new release to reach consumers.
