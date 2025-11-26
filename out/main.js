import { Scrapper } from "./Scrapper.js";
import { scrapeSeekJobs } from "./scrappers/seekScrapper.js";
async function getJobs() {
    const scrapper = new Scrapper();
    try {
        await scrapper.init_browser();
        await scrapper.initializeSeekPage();
        const seekPage = scrapper.getSeekPage();
        for (let i = 1; i < 6; i++) {
            const jobs = await scrapeSeekJobs(seekPage, `https://www.seek.com.au/software-engineer-jobs/remote?page=${i}`);
            jobs.forEach(job => {
                console.log(job);
            });
        }
    }
    catch (error) {
        console.error('Scraping error:', error);
    }
    finally {
        await scrapper.close();
    }
}
getJobs();
//# sourceMappingURL=main.js.map