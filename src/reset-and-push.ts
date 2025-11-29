import Database from "./Database.js";
import GoogleSheetsExporter from "./GoogleSheetsExporter.js";

async function resetAndExport() {
  const db = new Database();
  await db.InitDB();

  // Step 1: Reset all jobs to unpushed
  console.log('\nï¿½ï¿½ Step 1: Resetting all jobs to unpushed...');
  const resetCount = await db.resetAllToPushed(false);
  console.log(`âœ… Reset ${resetCount} jobs to unpushed`);

  // Step 2: Get all unpushed jobs
  const unpushedJobs = await db.getUnpushedJobs();
  console.log(`\ní³Š Step 2: Found ${unpushedJobs.length} unpushed jobs`);

  if (unpushedJobs.length === 0) {
    console.log('No jobs to export');
    return;
  }

  // Step 3: Export to Google Sheets
  console.log('\ní³¤ Step 3: Exporting to Google Sheets...');
  const exporter = new GoogleSheetsExporter();
  await exporter.initialize();
  
  const spreadsheetId = await exporter.createSpreadsheet(
    unpushedJobs,
    `All Job Listings - ${new Date().toISOString().split('T')[0]}`
  );

  // Step 4: Save export record
  const jobHashes = unpushedJobs.map(job => job.hash);
  await db.addExportRecord(spreadsheetId, jobHashes);
  
  // Step 5: Mark all as pushed
  console.log('\nâœ… Step 4: Marking all jobs as pushed...');
  const markedCount = await db.bulkMarkAsPushed(jobHashes);
  console.log(`âœ… Marked ${markedCount} jobs as pushed`);

  console.log(`\ní¾‰ Done! View your complete job list at:`);
  console.log(`https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
}

resetAndExport();

