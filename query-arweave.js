import Arweave from 'arweave';
import redstone from "redstone-api";
import Heroku from 'heroku-client';


const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https'
});


const currentArPrice = (await redstone.getPrice("AR")).value
function winstonToDollars(winston) {
    const arweave = winston / 10 ** 12;
    const dollarWorth = currentArPrice * arweave;
    return dollarWorth;
}


async function updateHeroku(previousBlockNumber) {
    const heroku = new Heroku({ token: process.env.HEROKU_API_KEY });
    const appName = 'arweave-whale-alert';
    const key = 'PREVIOUS_BLOCK_ID';
    const configVars = { [key]: previousBlockNumber };
    heroku.patch(`/apps/${appName}/config-vars`, { body: configVars })
    .then(() => {
        return true
    })
    .catch((e) => {
        console.log(e)
        return false
    });
}

function shortenAddress(address) {
    const shortenedAddress = address.slice(0, 7) + "..." + address.slice(-7);
    return shortenedAddress;
}


export default async function listenForTransactions() {

    const currentBlock = await arweave.blocks.getCurrent()
    const previous_block = currentBlock.previous_block;

    const currentDate = new Date();

    if (previous_block === process.env.PREVIOUS_BLOCK_ID) {
        console.log('NO new block', shortenAddress(previous_block), currentDate.toLocaleString())
    } else {
        console.log('NEW block', shortenAddress(previous_block), currentDate.toLocaleString())

        const saveBlock = await updateHeroku(previous_block)
        if (saveBlock === false) {
            throw new Error('Failed to update previous block!')
        }

        const previousBlocksTxns = (await arweave.blocks.get(previous_block)).txs;

        const largeArTransferDollars = 10000;
        const largeArTransfers = [];

        const txnPromises = previousBlocksTxns.map(async (txn) => {
            try {
                const transaction = await arweave.transactions.get(txn);
                if (transaction.quantity) {
                    const dollarWorth = winstonToDollars(transaction.quantity);
                    if (dollarWorth >= largeArTransferDollars) {
                        largeArTransfers.push(transaction);
                    }
                }
            } catch (e) {
                console.log(e);
            }
        });

        await Promise.all(txnPromises);

        if (largeArTransfers.length === 0) {
            return false;
        } else {
            return largeArTransfers;
        }

    }
}


