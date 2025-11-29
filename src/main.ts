import Scrapper from "./Scrapper.js";

async function main(): Promise<void> {
  let scrapper : Scrapper | null = null;
  try{
    scrapper = new Scrapper();
    await scrapper.init_browser();
    console.log("Initializing the pages now")
    await scrapper.initPages();
    await scrapper.init_scrapers();

    const spreadsheetId = await scrapper.exportToGoogleSheets()

    if (spreadsheetId) {
      console.log("Done exporting")
      console.log(`https://docs.google.com/spreadsheets/d/${spreadsheetId}`)
    }

    await scrapper.viewExportHistory()

    // this is closing - important or else the resources on the server will be getting used up
    await scrapper.getBrowser()?.close();
  } catch(error) {
    console.log('Browser was not initialized or already closed' + error)
  }
}

main()