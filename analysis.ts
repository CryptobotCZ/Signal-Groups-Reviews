import yargs from 'https://deno.land/x/yargs/deno.ts'
import { Arguments } from 'https://deno.land/x/yargs/deno-types.ts'
import * as zip from "https://deno.land/x/zip@v1.1.0/unzip.ts";
import * as path from "https://deno.land/std/path/mod.ts";
import { open } from 'https://deno.land/x/open/index.ts';
import { copy } from "https://deno.land/std@0.195.0/streams/mod.ts";


const workspaceDirectoryName = 'analysis-workspace';

async function install() {
     async function downloadFromGithubZip(repo: string) {
          const url = `https://github.com/${repo}/archive/refs/heads/master.zip`;
          const filename = repo.split('/').at(-1) ?? 'target-directory';
          const unzippedDirFileName = `${filename}-master`;

          console.log(`Downloading repository ${repo}...`);

          await zip.unZipFromURL(url);
          await Deno.rename(unzippedDirFileName, filename);
     }

     async function prepareWorkingDirectory() {
     console.log('Preparing working directory...');

     await Deno.mkdir(path.join(workspaceDirectoryName, 'cornix-config'), { recursive: true });
     await Deno.mkdir(path.join(workspaceDirectoryName, 'orders'), { recursive: true });
     await Deno.mkdir(path.join(workspaceDirectoryName, 'raw-data'), { recursive: true });
     await Deno.mkdir(path.join(workspaceDirectoryName, 'pre-processed'), { recursive: true });
     await Deno.mkdir(path.join(workspaceDirectoryName, 'results'), { recursive: true });
     }

     console.log('Crypto signal analysis - installation');

     await downloadFromGithubZip('CryptobotCZ/crypto-signals-analysis');
     await downloadFromGithubZip('CryptobotCZ/crypto-trade-backtracker');
     await prepareWorkingDirectory();

     console.log('Installation done!');
}

async function analyzeSignals(
     signals: string,
     inputPath: string,
     ordersOutputPath: string,
     intermediateOutputPath: string,
     finalReportPath: string,
     cornixConfig?: string
) {
     const command = new Deno.Command('deno', {
          args: [
               'run',
               '--allow-read',
               '--allow-write',
               './crypto-signals-analysis/main.ts',
               'export-from-source',
               '--locale', 'cz-CZ', '--delimiter', ';',
               '--signals ', signals,
               '--outputPath', ordersOutputPath,
               '--format', 'order-json',
               inputPath,
          ]
     });

     console.log("1/4 - Analyzing signal group data, parsing orders....");
     let result = command.outputSync();

     if (result.code !== 0) {
          console.error('Error when analyzing signal group data');
          return;
     }

     const firstBacktrackCmd = new Deno.Command('deno', {
          args: [
               'run',
               '--allow-read',
               '--allow-write',
               './crypto-trade-backtracker/main.ts',
               '--cachePath', './crypto-trade-backtracker/cache',
               '--fromDate', '1672534800000',
               '--downloadBinanceData',
               '--detailedLog',
               '--outputPath', intermediateOutputPath,
               ordersOutputPath,
          ]
     });

     console.log("2/4 - Starting first run of backtracking - collecting data...");
     result = firstBacktrackCmd.outputSync();

     if (result.code !== 0) {
          console.error('Error when running backtracking');
          return;
     }

     const secondBacktrackCmd = new Deno.Command('deno', {
          args: [
               'run',
               '--allow-read',
               '--allow-write',
               './crypto-trade-backtracker/main.ts',
               '--cachePath', './crypto-trade-backtracker/cache',
               '--fromDetailedLog',
               '--delimiter', ';',
               '--outputPath', finalReportPath,
               ...(cornixConfig != null ? [ '--cornixConfig', cornixConfig] : []),
               intermediateOutputPath,
          ]
     });

     console.log("3/4 - Starting second run of backtracking - running with used config...");
     secondBacktrackCmd.outputSync();


     const chartsBacktrackRun = new Deno.Command('deno', {
          args: [
               'run',
               '--allow-read',
               '--allow-write',
               './crypto-trade-backtracker/main.ts',
               '--cachePath', './crypto-trade-backtracker/cache',
               '--fromDetailedLog',
               '--delimiter', ';',
               '--outputPath', finalReportPath.replace('.csv', '-charts.json'),
               ...(cornixConfig != null ? [ '--cornixConfig', cornixConfig] : []),
               intermediateOutputPath,
          ]
     });
     console.log('4/4 - Starting third run of backtracking - exporting data for charts...');
     chartsBacktrackRun.outputSync();
}

async function analyzeSignalGroup(name: string, signals = 'generic', cornixConfigPath?: string) {
     const workspace = path.join(Deno.cwd(), workspaceDirectoryName);

     const inputPath = path.join(workspace, 'raw-data', name);
     const ordersOutputPath = path.join(workspace, 'orders', name + '-orders.json');
     const intermediateOutputPath = path.join(workspace, 'pre-processed', name + '-intermediate.json');
     const finalReportPath = path.join(workspace, 'results', name + '-report.csv');

     cornixConfigPath ??= path.join(workspace, 'cornix-config', name + '-cornix-config.json');

     await analyzeSignals(signals, inputPath, ordersOutputPath, intermediateOutputPath, finalReportPath, cornixConfigPath);
}

//
async function runChartsServer() {
     const workspace = path.join(Deno.cwd(), workspaceDirectoryName);
     const chartDataPath = path.join(workspace, 'results');

     const chartsServer = new Deno.Command('deno', {
          args: [
               'run',
               '--allow-read',
               '--allow-write',
               '--allow-net',
               './crypto-trade-backtracker/charts/server.ts',
               'start',
               chartDataPath
          ],
          stdout: "piped",
          stderr: "piped",
     });
     console.log('Starting charts server...');
     const chartsServerProcess = chartsServer.spawn();

     console.log('Opening web browser...');
     await open('http://localhost:8080');
}

async function showSupportedGroups() {
     const command = new Deno.Command('deno', {
          args: [
               'run',
               '--allow-read',
               '--allow-write',
               './crypto-signals-analysis/main.ts',
               'supported-groups'
          ]
     });
     await command.output();
}

yargs(Deno.args)
  .command('install', 'Install crypto analysis suite', (yargs: any) => {}, async (argv: Arguments) => {
       await install();
  })
  .command('update', 'Update crypto analysis suite', (yargs: any) => {
  }, async (argv: Arguments) => {
       console.log('TODO');
  })
  .command(['analyze <directory> <signals>'], 'Analyze group', () => {}, async (argv: any) => {
       await analyzeSignalGroup(argv.directory, argv.signals);
  })
  .command(['supported-groups'], 'Show supported groups', () => {}, async (argv: any) => {
     await showSupportedGroups();
  })
  .command('charts', 'Show charts from finished analysis', (yargs: any) => { }, async (argv: Arguments) => {
     await runChartsServer();
  })
  .strictCommands()
  .version('version', '0.0.1').alias('version', 'V')
  .argv;
