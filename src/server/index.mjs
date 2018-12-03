
import startServer from "@prisma-cms/server";

import Module from "../";

import Web3 from "web3";

const module = new Module({
});

const resolvers = module.getResolvers();

// console.log("resolvers", resolvers);

const {
  Subscription,
  ...other
} = resolvers;



const GethServer = process.env.GethServer;

if(!GethServer){
  throw("Env GethServer required");
}
 
const web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider(GethServer));


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
