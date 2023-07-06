import axios from "axios";


async function queryBlockIDNum(blockID) {
    const query = `
        query {
        blocks(ids: ["${blockID}"]) {
            edges {
            cursor
            node {
                id
                timestamp
                height
                previous
            }
            }
        }
        }
    `;
    const response = await axios.post('https://arweave.net/graphql', { query });
    const block = response.data.data.blocks.edges[0].node;
    return block;
}


export default async function queryTransactionIDsBetweenBlocks(blockFromID, blockToID) {
  const blockFrom = await queryBlockIDNum(blockFromID);
  const blockTo = await queryBlockIDNum(blockToID);
  
  const query = `
    query {
      transactions(
        first: ${blockTo.height - blockFrom.height}
      ) {
        edges {
          node {
            id
          }
        }
      }
    }
  `;
  
  const response = await axios.post('https://arweave.net/graphql', { query });
  const transactions = response.data.data.transactions.edges.map(
    (edge) => edge.node.id
  );
  return transactions;
}



