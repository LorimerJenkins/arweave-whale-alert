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


async function updateHeroku(key, value) {
    const heroku = new Heroku({ token: process.env.HEROKU_API_KEY });
    const appName = 'arweave-whale-alert';
    const configVars = { [key]: value };
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
    const largeArTransferDollars = parseInt(process.env.LARGE_AR_TRANSFERS_DOLLARS);
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
        const saveBlock = await updateHeroku('lastIndexedBlock', lastFullBlock);
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
    const queryBlocks = await arweave.blocks.getCurrent();
    const currentBlock = queryBlocks.indep_hash
    const lastFullBlock = queryBlocks.previous_block;
    const lastIndexedCurrentBlock = process.env.currentBlock
    const lastIndexedBlock = process.env.lastIndexedBlock
    const currentDate = new Date();

    if (lastFullBlock === lastIndexedBlock) {

        console.log(`NO new block. Current block: ${shortenAddress(currentBlock)}. Last block: ${shortenAddress(lastFullBlock)}. Current time: ${currentDate.toLocaleString()}.`)
    
    } else if (lastFullBlock === lastIndexedCurrentBlock) {

        console.log(`NEW block. Current block: ${shortenAddress(currentBlock)}. Last block: ${shortenAddress(lastFullBlock)}. Current time: ${currentDate.toLocaleString()}.`)
        let largeArTransfers = await queryBlock(lastFullBlock, true);
        await updateHeroku('currentBlock', currentBlock);
        return largeArTransfers;

    } else if (lastFullBlock !== lastIndexedCurrentBlock) {

        const blocksMissed = lastFullBlock - lastIndexedBlock;
        console.log(`We have MISSED and not indexed ${blocksMissed} blocks. Current block: ${shortenAddress(currentBlock)}. Last block: ${shortenAddress(lastFullBlock)}. Current time: ${currentDate.toLocaleString()}.`)

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

        await updateHeroku('currentBlock', currentBlock);
        if (largeArTransfers.length === 0) {
            return false;
        } else {
            return largeArTransfers;
        }
    }


}

