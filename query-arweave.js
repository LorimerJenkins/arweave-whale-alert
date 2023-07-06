import Arweave from 'arweave';
import redstone from 'redstone-api';
import Heroku from 'heroku-client';


const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https',
});


const currentArPrice = (await redstone.getPrice('AR')).value;
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
    try {
        await heroku.patch(`/apps/${appName}/config-vars`, { body: configVars });
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
}

function shortenAddress(address) {
    const shortenedAddress = address.slice(0, 7) + '...' + address.slice(-7);
    return shortenedAddress;
}

async function queryBlock(lastFullBlock, saveBlockToHeroku) {
    const previousBlocksTxns = (await arweave.blocks.get(lastFullBlock)).txs;
    const largeArTransferDollars = process.env.LARGE_AR_TRANSFERS_DOLLARS;
    let largeArTransfers = [];

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

    if (saveBlockToHeroku) {
        const saveBlock = await updateHeroku(lastFullBlock);
        if (saveBlock === false) {
            throw newError('Failed to update previous block!');
        }
    }

    if (largeArTransfers.length === 0) {
        return false;
    } else {
        return largeArTransfers;
    }
}


export default async function listenForTransactions() {
    const currentBlock = await arweave.blocks.getCurrent();
    const lastFullBlock = currentBlock.previous_block;
    const lastIndexedBlock = process.env.PREVIOUS_BLOCK_ID
    const currentDate = new Date();


    console.log('lastFullBlock', typeof lastFullBlock)
    console.log('lastIndexedBlock', typeof lastIndexedBlock)


    if (lastFullBlock === lastIndexedBlock) {
        console.log('NO new block', shortenAddress(lastFullBlock), currentDate.toLocaleString());

    } else if (lastFullBlock === lastIndexedBlock + 1) {
        console.log('NEW block', shortenAddress(lastFullBlock), currentDate.toLocaleString());

        let largeArTransfers = await queryBlock(lastFullBlock, true);
        return largeArTransfers;
    } else {
        const blocksMissed = lastFullBlock - lastIndexedBlock;
        console.log('We have MISSED and not indexed', blocksMissed, 'blocks at', currentDate.toLocaleString());

        let largeArTransfers = [];

        for (let i = 0; i < blocksMissed; i++) {
            const index = i + 1;
            const queryMissedBlocks = await queryBlock(lastFullBlock - index, false);
            if (queryMissedBlocks.length !== 0) {
                largeArTransfers = largeArTransfers.concat(queryMissedBlocks);
            }
        }

        const queryCurrentFullBlock = await queryBlock(lastFullBlock, true);
        if (queryCurrentFullBlock.length !== 0) {
            largeArTransfers = largeArTransfers.concat(queryCurrentFullBlock);
        }

        if (largeArTransfers.length === 0) {
            return false;
        } else {
            return largeArTransfers;
        }
    }
}

