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


async function queryBlock(lastFullBlock, currentBlock, updateHeroku) {
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

    if (updateHeroku) {
        const saveLastFullBlock = await updateHeroku('lastIndexedBlock', lastFullBlock);
        if (saveLastFullBlock === false) {
            throw newError('Failed to update lastIndexedBlock!');
        }
        const saveLastIndexedCurrentBlock = await updateHeroku('lastIndexedCurrentBlock', currentBlock);
        if (saveLastIndexedCurrentBlock === false) {
            throw newError('Failed to update lastIndexedCurrentBlock!');
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
    const currentFullBlock = queryBlocks.previous_block;
    const lastIndexedCurrentBlock = process.env.lastIndexedCurrentBlock
    const lastIndexedBlock = process.env.lastIndexedBlock
    const currentDate = new Date();

    if (currentFullBlock === lastIndexedBlock) {

        console.log(`NO new block. Current block: ${shortenAddress(currentBlock)}. Last block: ${shortenAddress(currentFullBlock)}. Current time: ${currentDate.toLocaleString()}.`)
    
    } else if (currentFullBlock === lastIndexedCurrentBlock) {

        console.log(`NEW block. Current block: ${shortenAddress(currentBlock)}. Last block: ${shortenAddress(currentFullBlock)}. Current time: ${currentDate.toLocaleString()}.`)
        let largeArTransfers = await queryBlock(currentFullBlock, currentBlock, true);
        return largeArTransfers;

    } else if (currentFullBlock !== lastIndexedCurrentBlock) {

        const blocksMissed = currentFullBlock - lastIndexedBlock;
        console.log(`We have MISSED and not indexed ${blocksMissed} blocks. Current block: ${shortenAddress(currentBlock)}. Last block: ${shortenAddress(currentFullBlock)}. Current time: ${currentDate.toLocaleString()}.`)

        let largeArTransfers = [];

        for (let i = 0; i < blocksMissed; i++) {
            const index = i + 1;
            const queryMissedBlocks = await queryBlock(currentFullBlock - index, currentBlock, false);
            if (queryMissedBlocks.length !== 0) {
                largeArTransfers = largeArTransfers.concat(queryMissedBlocks);
            }
        }

        const queryCurrentFullBlock = await queryBlock(currentFullBlock, currentBlock, true);
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

