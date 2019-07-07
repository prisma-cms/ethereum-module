
import PrismaModule from "@prisma-cms/prisma-module";

class EthModule extends PrismaModule {


  constructor(props = {}) {

    super(props);

    Object.assign(this, {
      Query: {
        ethNet: this.ethNet,
        ethGetTransaction: this.ethGetTransaction,
        ethTransactionCount: this.ethTransactionCount,
        ethSyncState: this.ethSyncState,
        ethGetBlockNumber: this.ethGetBlockNumber,
        ethGetBlock: this.ethGetBlock,
        ethGetBlockTransactionCount: this.ethGetBlockTransactionCount,
      },
      Mutation: {
      },
    });

  }


  async ethNet(source, args, ctx, info) {

    const {
      web3: {
        eth: {
          net,
        },
      },
    } = ctx;

    // console.log("web3.net", net);

    // // console.log("web3.net id", await net.getId());
    // console.log("web3.net getPeerCount", await net.getPeerCount());

    const result = {
      id: await net.getId(),
      isListening: await net.isListening(),
      peerCount: await net.getPeerCount(),
      networkType: await net.getNetworkType(),
    }

    // console.log("web3.net result", result);
    // await web3.eth.isSyncing()
    //   .then(console.log);

    return result;

  }


  getProcessor(ctx) {
    return new (this.getProcessorClass())(ctx);
  }


  getProcessorClass() {
    return PersonalAccountProcessor;
  }


  createPersonalAccountProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).createWithResponse("PersonalAccount", args, info);
  }


  async ethTransactionCount(source, args, ctx, info) {

    const {
      web3: {
        eth,
      },
    } = ctx;

    const {
      address,
    } = args;

    return await eth.getTransactionCount(address);
  }


  async ethGetTransaction(source, args, ctx, info) {

    const {
      web3: {
        eth,
      },
    } = ctx;

    const {
      where: {
        hash,
      },
    } = args;

    return await eth.getTransaction(hash);
  }


  async ethSyncState(source, args, ctx, info) {

    const {
      web3: {
        eth,
      },
    } = ctx;

    const result = await eth.isSyncing();

    // console.log("ethSyncState.result", result);

    return result;
  }


  async ethGetBlockNumber(source, args, ctx, info) {

    const {
      web3: {
        eth,
      },
    } = ctx;

    const result = await eth.getBlockNumber();

    // console.log("ethSyncState.result", result);

    return result;
  }


  async ethGetBlock(source, args, ctx, info) {

    const {
      web3: {
        eth,
      },
    } = ctx;

    const {
      where: {
        hash,
        number,
      },
    } = args;

    // console.log("ethGetBlock.args", args);

    const result = await eth.getBlock(hash || number);

    // console.log("ethGetBlock.result", result);

    return result;
  }


  async ethGetBlockTransactionCount(source, args, ctx, info) {

    const {
      web3: {
        eth,
      },
    } = ctx;

    const {
      where: {
        hash,
        number,
      },
    } = args;

    const result = await eth.getBlockTransactionCount(hash || number);

    // console.log("ethGetBlockTransactionCount.result", result);

    return result;
  }


  getResolvers() {

    const resolvers = super.getResolvers();


    Object.assign(resolvers.Query, this.Query);

    Object.assign(resolvers.Mutation, this.Mutation);

    Object.assign(resolvers.Subscription, this.Subscription);


    Object.assign(resolvers, {
    });

    return resolvers;
  }

}

export default EthModule;