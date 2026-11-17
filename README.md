# Daybreak Budget

A responsive budget planner with paycheck setup, recurring expenses, monthly snapshots, an expense pie chart, and cumulative savings goal progress.

## Run locally

From this directory, run `python3 -m http.server 8000 --directory public` and open http://localhost:8000. The budget and sample dashboard work on the local server. The AI button requires the Cloudflare Worker and its AI binding.

## Deploy from GitHub

1. Create a private GitHub repository named `daybreak-budget`. Put the contents of this folder at the repository root, including `wrangler.jsonc`, `public/`, and `src/`.
2. In Cloudflare **Workers & Pages**, create a Worker and choose **Import a repository**. Authorize access to the new GitHub repository and select it.
3. Use the production branch containing the files, leave the build command blank, and use `npx wrangler deploy` as the deploy command. Deploy the Worker named in `wrangler.jsonc`. If that Worker name is taken in the account, change it in both places.
4. Open the Worker URL and try the sample dashboard and **Get AI suggestions**. Workers AI use is billed according to the account's Workers AI plan and usage.

[Cloudflare GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)

## Data and calculations

- Each browser stores its own budget and monthly history locally. Clearing site data removes them. Sign-in and automatic device sync are outside this version.
- Weekly and biweekly schedules count paydays in each calendar month from a known payday. Monthly and twice-monthly schedules count one and two checks respectively. Holiday shifts are not inferred. Older recorded budgets retain their original totals until updated. Gross-pay entry uses the actual withholding and deductions from a pay stub. The state is saved on the budget profile.
- The Add expenses form logs spending for the month being viewed. Name a funded budget category (for example, “I just spent $60 on gas”) to track usage against its allocation. Other entries are grouped under Extra in the expense chart, with merchant totals in its expandable legend. Extra spending and category overages reduce the remaining budget. Entries are saved in the same browser.
- Each month stores one snapshot. Recording the same month updates it. Use the same goal name across months to accumulate contributions.
- The budget check runs locally. The optional AI action sends monthly totals and amounts for standard categories to the Worker and Workers AI. Profile names, state, custom labels, goal names, and individual payroll deductions stay in the browser.

- Log a savings contribution with “I put $500 into my apartment fund.” Daybreak matches an existing goal, saves the contribution for the displayed month, and includes it in cumulative progress and that month’s savings total. Enter each contribution once via chat or the setup form.
