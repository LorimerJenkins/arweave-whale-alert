import Arweave from 'arweave';
import redstone from 'redstone-api';
import Heroku from 'heroku-client';
import queryTransactionIDsBetweenBlocks from './arweaveGQL.js';


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


async function updateHerokuFn(key, value) {
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


async function queryBlock(lastFullBlock, currentBlock) {
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
            // ignore download errors as we are looking for $AR transfers
        }
    });

    await Promise.all(txnPromises);


    const saveLastFullBlock = await updateHerokuFn('lastIndexedBlock', lastFullBlock);
    if (saveLastFullBlock === false) {
        throw newError('Failed to update lastIndexedBlock!');
    }
    const savelastCurrentBlock = await updateHerokuFn('lastCurrentBlock', currentBlock);
    if (savelastCurrentBlock === false) {
        throw newError('Failed to update lastCurrentBlock!');
    }
    

    if (largeArTransfers.length === 0) {
        return false;
    } else {
        return largeArTransfers;
    }
}




async function queryTransactions(missedTransactions) {
    let largeArTransfers = [];

    const txnPromises = missedTransactions.map(async (txn) => {
        console.log(txn)
        try {
            const transaction = await arweave.transactions.get(txn);
            console.log(transaction)
        if (transaction.quantity) {
                const dollarWorth = winstonToDollars(transaction.quantity);
                if (dollarWorth >= largeArTransferDollars) {
                largeArTransfers.push(transaction);
            }
        }
        } catch (e) {
            // ignore download errors as we are looking for $AR transfers
        }
    });

    await Promise.all(txnPromises);


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
    const lastCurrentBlock = process.env.lastCurrentBlock
    const lastIndexedBlock = process.env.lastIndexedBlock
    const currentDate = new Date();

    if (currentFullBlock === lastIndexedBlock) {

        console.log(`NO new block. currentBlock: ${shortenAddress(currentBlock)}. currentFullBlock: ${shortenAddress(currentFullBlock)}. Current time: ${currentDate.toLocaleString()}.`)
    
    } else if (currentFullBlock === lastCurrentBlock) {

        console.log(`NEW block. currentBlock: ${shortenAddress(currentBlock)}. currentFullBlock: ${shortenAddress(currentFullBlock)}. Current time: ${currentDate.toLocaleString()}.`)
        let largeArTransfers = await queryBlock(currentFullBlock, currentBlock);
        return largeArTransfers;

    } else if (currentFullBlock !== lastCurrentBlock) {

        console.log(`We have MISSED blocks. currentBlock: ${shortenAddress(currentBlock)}. currentFullBlock: ${shortenAddress(currentFullBlock)}. Current time: ${currentDate.toLocaleString()}.`)

        const missedTransactions = await queryTransactionIDsBetweenBlocks(lastCurrentBlock, currentFullBlock)

        let largeArTransfers = await queryTransactions(missedTransactions)


        const saveLastFullBlock = await updateHerokuFn('lastIndexedBlock', currentFullBlock);
        if (saveLastFullBlock === false) {
            throw newError('Failed to update lastIndexedBlock!');
        }
        const savelastCurrentBlock = await updateHerokuFn('lastCurrentBlock', currentBlock);
        if (savelastCurrentBlock === false) {
            throw newError('Failed to update lastCurrentBlock!');
        }

        //


        return largeArTransfers

    }

}

