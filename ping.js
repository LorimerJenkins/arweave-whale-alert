import redstone from "redstone-api";
import { TwitterApi } from 'twitter-api-v2';
import axios from 'axios';

const currentArPrice = (await redstone.getPrice("AR")).value
function winstonToDollars(winston) {
    const arweave = winston / 10 ** 12;
    const dollarWorth = currentArPrice * arweave;
    const formattedValue = dollarWorth.toLocaleString("en-US", { minimumFractionDigits: 2 });
    return formattedValue;
}


function winstonToArweave(winston) {
    const arweave = winston / 10 ** 12;
    const roundedValue = arweave.toFixed(5);
    return roundedValue;
}


function shortenAddress(address) {
    const shortenedAddress = address.slice(0, 7) + "..." + address.slice(-7);
    return shortenedAddress;
}


async function sendSlackMessage(message) {
    await axios.post('https://slack.com/api/chat.postMessage', { 
        channel: process.env.SLACK_CHANNEL_ID,
        text: message
    }, { headers: { 'Authorization': `Bearer ${process.env.SLACK_TOKEN}`, 'Content-Type': 'application/json' } });
}

async function sendTweet(message) {
    const twitterClient = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET,
    }, );
    let res;
    try {
        res = await twitterClient.v2.tweet(message);
    } catch (err) {
        console.error(err);
    }
    console.log(res);
}


export default async function postToTwitter(whaleTransactions) {

    for (const transaction of whaleTransactions) {
        const message = `🚨 ${winstonToArweave(transaction.quantity)} AR ($${winstonToDollars(transaction.quantity)} USD) transferred to ${shortenAddress(transaction.target)} 
        
Transaction ID: https://viewblock.io/arweave/tx/${transaction.id}`;
        try {
            await sendSlackMessage(message);
            console.log("POSTED TO SLACK");
        } catch (err) {
            console.log(err);
        }
        try {
            await sendTweet(message);
            console.log("POSTED TO TWITTER");
        } catch (err) {
            console.log(err);
        }
        console.log(message)
    }

}