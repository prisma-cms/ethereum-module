

import PrismaModule from "@prisma-cms/prisma-module";

import PrismaProcessor from "@prisma-cms/prisma-processor";
import chalk from "chalk";

const ethCoinbase = async function (source, args, ctx, info) {

  const {
    web3,
  } = ctx;


  const result = await web3.eth.getCoinbase()
    .then(r => r)
    .catch(e => {
      throw (e);
    });

  // console.log("accounts", result);

  return result ? {
    address: result,
  } : null;
}


/**
 * Для получения общих аккаунтов и персональных служат разные методы
 */
const getAccounts = async function (method, source, args, ctx, info) {

  const result = await method()
    .then(r => r)
    .catch(e => {
      throw (e);
    });

  // console.log("accounts", result);

  return result ? result.map(address => ({ address })) : [];
}


// const ethAccounts = async function (source, args, ctx, info) {

//   const {
//     web3,
//   } = ctx;

//   return getAccounts(web3.eth.getAccounts);
// }


const ethPersonalAccounts = async function (source, args, ctx, info) {

  const {
    web3,
  } = ctx;

  return getAccounts(web3.eth.personal.getAccounts);
}


const ethUnlockPersonalAccount = async function (source, args, ctx, info) {

  const {
    web3,
  } = ctx;

  const {
    address,
    password,
    duration,
  } = args;


  const unlockResult = await web3.eth.personal.unlockAccount(address, password, duration)
    .catch(e => {
      throw (e);
    });

  // console.log("result", unlockResult);

  return unlockResult;
}




export class EthPersonalAccountProcessor extends PrismaProcessor {

  constructor(props) {

    super(props);

    this.objectType = "PersonalAccount";

  }


  async create(objectType, args, info) {

    const {
      web3,
    } = this.ctx;

    const {
      data: {
        password,
      },
    } = args;

    // Регистрируем новый кошелек
    const address = await web3.eth.personal.newAccount(password)
      .then(r => r)
      .catch(e => {
        throw (e)
      });

    return {
      address,
    }

  }

}


class EthPersonalAccountModule extends PrismaModule {


  constructor(props = {}) {

    super(props);

    this.Query = {
      ethCoinbase,
      ethPersonalAccounts,
    };

    this.Mutation = {
      ethUnlockPersonalAccount,
      // ethCreateEthPersonalAccountProcessor: this.ethCreateEthPersonalAccountProcessor.bind(this),
    }
  };



  getProcessor(ctx) {
    return new (this.getProcessorClass())(ctx);
  }


  getProcessorClass() {
    return EthPersonalAccountProcessor;
  }


  ethCreateEthPersonalAccountProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).createWithResponse("PersonalAccount", args, info);
  }



  getResolvers() {

    const resolvers = super.getResolvers();


    Object.assign(resolvers.Query, this.Query);

    Object.assign(resolvers.Mutation, this.Mutation);

    Object.assign(resolvers.Subscription, this.Subscription);


    Object.assign(resolvers, {
      EthPersonalAccount: {
        balance: (source, args, ctx, info) => {

          // console.log("resolvers", ctx.resolvers);

          const {
            resolvers: {
              Query: {
                ethBalance,
              },
            },
          } = ctx;

          return ethBalance(source, args, ctx, info);

        },
      },
    });

    return resolvers;
  }

}

export default EthPersonalAccountModule;