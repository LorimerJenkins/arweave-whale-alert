import listenForTransactions from './query-arweave.js';
import postToTwitter from './ping.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function mainLoop() {
  while (true) {
    const whaleTransactions = await listenForTransactions();

    if (whaleTransactions) {
      await postToTwitter(whaleTransactions);
    }

    await delay(30000);
  }
}

mainLoop().catch((error) => {
  console.error('An error occurred:', error);
});
console.log('Arweave Whale Alert: **LIVE**')