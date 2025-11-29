import Database from "./Database.js"

async function test(){
    const database = new Database();
    await database.InitDB()
    const reset = await database.resetAllToPushed();
    const jobs = await database.getUnpushedJobs();
    console.log(jobs.length) 
}

test()