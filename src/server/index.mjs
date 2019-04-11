
import startServer from "@prisma-cms/server";

import Module from "../";

import Web3 from "web3";

const module = new Module({
});

const resolvers = module.getResolvers();

// console.log("resolvers", resolvers);

const {
  ...other
} = resolvers;

const {
  GethServer = "http://localhost:8545",
} = process.env;


if (!GethServer) {
  throw ("Env GethServer required");
}


const web3Options = {
  defaultAccount: '0x0',
  defaultBlock: 'latest',
  defaultGas: 1,
  defaultGasPrice: 0,
  transactionBlockTimeout: 50,
  transactionConfirmationBlocks: 24,
  transactionPollingTimeout: 480,
  // transactionSigner: new CustomTransactionSigner(),
}

// const web3 = new Web3(GethServer);
const web3 = new Web3(GethServer);
// web3.setProvider(new web3.providers.HttpProvider(GethServer), null, web3Options);

// console.log("web3", web3);

startServer({
  typeDefs: 'src/schema/generated/api.graphql',
  resolvers: {
    ...other,
  },
  contextOptions: {
    // db: null,
    web3,
  },
});
