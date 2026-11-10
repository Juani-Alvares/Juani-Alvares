# Featured projects

Add the `featured` topic to a public repository to include it in the profile. Remove the topic to remove it. Forks, archived repositories and the profile repository are always excluded.

The **Update featured projects** workflow runs daily at 06:43 UTC (03:43 Argentina) and supports **Run workflow** in the Actions tab. Scheduled runs can be delayed by GitHub. No README edits or personal access tokens are needed.

The generator reads all pages of public repositories, sorts selected repositories by name, uses their GitHub description, and lists languages verified by GitHub's languages API. It does not infer frameworks from topics. Missing descriptions receive neutral text; missing language data is explicitly indicated. Set the repository's About description to improve its card.

Only text between `<!-- FEATURED-PROJECTS:START -->` and `<!-- FEATURED-PROJECTS:END -->` is replaced. Missing or duplicate markers and API failures stop the update without changing the README. No timestamps are generated, so unchanged data produces no commit.

The job uses the automatic `GITHUB_TOKEN` with only `contents: write` to commit the README. Its concurrency group is shared with the existing asset workflow to avoid simultaneous pushes. A concurrent human change is rebased; conflicts fail safely rather than overwriting it.

Local checks (Node.js 20 or newer):

```sh
node --test automation/featured-projects.test.mjs
node automation/featured-projects.mjs
```

Set `GITHUB_TOKEN` in the environment for authenticated API requests; never put it in a file.
