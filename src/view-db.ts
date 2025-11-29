import Database from "./Database.js";

async function viewDatabase() {
  const db = new Database();
  await db.InitDB();

  const allJobs = await db.getAllJobs();
  console.log(`\ní³Š Total jobs in database: ${allJobs.length}\n`);

  // Show first 5 jobs as sample
  allJobs.slice(0, 5).forEach((job, index) => {
    console.log(`\n${index + 1}. ${job.data.title}`);
    console.log(`   Company: ${job.data.company}`);
    console.log(`   Source: ${job.data.source}`);
    console.log(`   Hash: ${job.hash.slice(0, 16)}...`);
    console.log(`   Pushed: ${job.data.pushed}`);
  });

  // Count by source
  const bySource = allJobs.reduce((acc, job) => {
    acc[job.data.source] = (acc[job.data.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`\ní³ˆ Jobs by source:`, bySource);
  
  // Count unpushed
  const unpushed = allJobs.filter(job => !job.data.pushed);
  console.log(`\ní³¤ Unpushed jobs: ${unpushed.length}`);
}

viewDatabase();

