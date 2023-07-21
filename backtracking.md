# Backtracking and signal group analysis

Step by step guide how to do backtracking and signal group analysis.

0. Prerequisites - there is just one requirement - [deno](https://deno.land/).

1. Prepare your workspace by running `deno run --allow-all analysis.ts install`

   This will download required tools and create a `analysis-workspace` directory.

2. Export telegram chat history to .html.
    When export is finished, you should see something like `ChatExport_2023-07-20` in `Downloads/Telegram Desktop` directory.
    Copy the entire directory to `analysis-workspace/raw-data` and rename it based on the signal group you want to analyze.

    For example I will use name `generic-group`. There will be following directory structure: `analysis-workspace/raw-data/generic-group`
    and inside should be files like `messages.html`

3. Run `deno run --allow-all analysis.ts generic-group altsignals`. `generic-group` is the name of the directory 
   you used to save the exported data from Telegram. `altsignals` is name of the signal group you want to analyze.

   To see all supported groups, use `deno run --allow-all analysis.ts supported-groups`.

4. Optional: See the trades charts. Run `deno run --allow-all analysis.ts charts`. It should automatically open the default 
  web browser with charts page. If not, open following page in a browser: <http://localhost:8080>

After running the backtracking, results should be stored in `analysis-workspace/results` directory in `.csv` format.
